// «Где стоит» (#118): в «Подготовить отдельно» и «Не рубится» у каждой детали — миниатюра изделия: всё полупрозрачное, деталь строки — оранжевая.
// Модель — та, что строят карты (cardModel), но с крышей: строки крыши в блоке есть всегда. Какая деталь красится:
// строки блока — по таблице карт (CARD_UNITS: rows → tags), крыша — по таблице WHERE_ROOF, «Не рубится» — по метке лазерной детали (pt).
// Миниатюры рисуются после «Рассчитать» по одной за шаг (whereFill), крупная — по клику (whereOpen) и запоминается.
// Без WebGL (ok = false) картинок нет, остальное как раньше.

// галочки модели: крыша, лист на ней и колосник печи — всегда (на экране крыша по умолчанию снята, колосник можно спрятать, а в таблице он есть)
const WHERE_FLAGS = {rain: true, sheet: true, grate: true};
// строки крыши (карт у неё нет): название строки → метка на модели; у стоек ещё положение: 1 — передние (z > W/2), 0 — задние (метка одна)
const WHERE_ROOF = [[/^Трубка Ø26/, 'tubes'], [/^Арматура Ø16, передние/, 'bars', 1], [/^Арматура Ø16, задние/, 'bars', 0], [/^Лист от дождя/, 'sheet']];
// лазерная деталь без своей карты → карта, на которой она (пластины ручки колосника — у колосника)
const WHERE_PT = {cgrH: 'cgr'};

const whereKeyRow = r => 'r:' + r.n;
const whereKeyOff = ty => 'o:' + ty.p.pt;

// Ножка на модели собрана из площадки под дном, трубы и стыка; патрубка и заглушки отдельными деталями нет — они часть трубы (#118: красим их метками).
// Строки блоков → какой кусок ножки: труба, патрубок (JNT сверху), заглушка (торец трубы под патрубком), площадка под ножку («Не рубится»)
const WHERE_LEG = [[/^Ножка /, 'tube'], [/^Патрубок ножки/, 'sleeve'], [/^Заглушка ножки/, 'plug']];
function legPiece(g, kind) {
  const legs = g.children.filter(o => o.userData.part === 'legs' && !o.userData.dim && !o.userData.leg);   // без собственных меток
  if (kind === 'plate') return legs.filter(o => o.geometry.type === 'BoxGeometry');
  const tubes = legs.filter(o => o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop === 2);
  if (kind === 'tube') return tubes;
  return tubes.map(m => {   // метка — тонкий цилиндр чуть шире трубы на нужном месте; создаётся один раз на модель
    const top = m.position.y + m.geometry.parameters.height / 2, yj = top - JNT, h = kind === 'sleeve' ? JNT : .8;
    let k = g.children.find(o => o.userData.leg === kind && o.userData.src === m);
    if (!k) {
      k = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, h, 24), m.material);
      k.position.set(m.position.x, kind === 'sleeve' ? yj + JNT / 2 : yj - h / 2, m.position.z);
      k.userData.part = 'legs'; k.userData.leg = kind; k.userData.src = m;   // метка детали та же, что у ножки: фильтры снимка (S.parts) её пропускают
      g.add(k); g.updateMatrixWorld(true);
    }
    return k;
  });
}

const unitTags = u => [...u.tags, ...(u.twin || [])];

// Верхние объекты модели g, которые красятся для ключа key. Все экземпляры детали (обе боковины, все ножки), без швов и масс карт:
// cardParts здесь не нужен — он считает соединения и массу, на каждый «Рассчитать» это лишние ~0,7 с
function whereObjs(g, key) {
  const v = key.slice(2), top = g.children.filter(o => !o.userData.dim);
  const tagged = tags => top.filter(o => tags.includes(o.userData.part));
  if (key[0] === 'r') {
    const roof = WHERE_ROOF.find(([re]) => re.test(v));
    if (roof) {
      const [, tag, front] = roof;
      return tagged([tag]).filter(o => front === undefined || (new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z > W / 2) === !!front);
    }
    const leg = WHERE_LEG.find(([re]) => re.test(v));
    if (leg) return legPiece(g, leg[1]);
    return tagged(CARD_UNITS.filter(u => u.rows.some(re => re.test(v))).flatMap(unitTags));
  }
  if (v === 'legs') return legPiece(g, 'plate');   // «Не рубится»: площадка под ножку 80 × 80
  return tagged(CARD_UNITS.filter(u => u.laser === v || u.id === WHERE_PT[v]).flatMap(unitTags));
}

// Деталь целиком не выше дна изделия (ножки, площадки, патрубок, заглушка, направляющие шибера) — её смотрим снизу: сверху она за дном
function whereBelow(g, objs) {
  const bot = g.children.filter(o => o.userData.part === 'gBot' || o.userData.part === 'sBot');
  if (!bot.length) return false;
  const top = o => new THREE.Box3().setFromObject(o).max.y;
  return Math.max(...objs.map(top)) <= Math.max(...bot.map(top)) + .01;
}

// Картинка: изделие в изометрии (то, что под дном, — снизу) призраком, objs — оранжевым. Рисует модель из group (внутри cm.run). Возвращает data-URL PNG или ''
function whereShot(objs, big) {
  if (!objs.length) return '';
  const view = whereBelow(group, objs) ? 'isoLow' : 'iso';
  const rect = focusRect(view, objs);   // кадр по самим деталям с полем: так их видно, а не всё изделие мелко
  if (!rect) return '';
  const n = pickScale([(rect.hi[0] - rect.lo[0]) * 10, (rect.hi[1] - rect.lo[1]) * 10], big ? [450, 300] : [120, 80]);
  const img = renderView(view, n, {pxPerMm: big ? 4 : 2, hlObj: new Set(objs), ghost: true, edges: cardEdges, rect});
  return img ? img.url : '';
}

/* ---------- на странице ---------- */
const WHR = {t: 0, thumb: new Map(), big: new Map(), busy: new Set()};
const whEsc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const whereOn = () => typeof ok !== 'undefined' && !!ok;

// Картинки верны, пока модель та же: размеры, толщина, единицы и галочки (без размеров на модели, выбора детали и вида). Другая — прежние картинки
// и недорисованные шаги в сторону
let whSig = null;
function whereSync() {
  const sig = JSON.stringify([L1, W, T, UNIT, S, S.mode], (k, v) => k === 'dims' || k === 'sel' || k === 'parts' ? undefined : v);
  if (sig === whSig) return;
  whSig = sig;
  WHR.t++; WHR.thumb.clear(); WHR.big.clear(); WHR.busy.clear();
}

// ячейка с миниатюрой для html таблицы: кнопка — клик открывает крупную; картинка уже есть — сразу, нет — место под неё
function whereCell(key, title) {
  if (!whereOn()) return '';
  whereSync();
  const u = WHR.thumb.get(key);
  if (u === '') return '';
  return `<button type="button" class="wh" data-wk="${whEsc(key)}" data-wt="${whEsc(title)}" title="Где стоит: ${whEsc(title)}" aria-label="Где стоит: ${whEsc(title)}">${u ? `<img alt="" src="${u}">` : ''}</button>`;
}

const whBtns = (box, key) => [...box.querySelectorAll('button.wh')].filter(b => b.dataset.wk === key);
function whPut(box, key, url) {
  whBtns(box, key).forEach(b => { if (url) b.innerHTML = `<img alt="" src="${url}">`; else b.remove(); });
}

// Дорисовать миниатюры в box по одной за шаг (~0,1 с), пока страница отвечает. alive() — false: результат устарел, бросить
function whereFill(box, alive) {
  if (!whereOn() || !box || !box.querySelectorAll) return;
  whereSync();
  if (WHR.busy.has(box)) return;
  const keys = [...new Set([...box.querySelectorAll('button.wh')].map(b => b.dataset.wk))].filter(k => !WHR.thumb.has(k));
  if (!keys.length) return;
  const tk = WHR.t, cm = openCardModel(WHERE_FLAGS);
  WHR.busy.add(box);
  const same = new Map();   // одинаковый набор объектов — одна картинка
  const stop = () => { if (WHR.t === tk) WHR.busy.delete(box); cm.close(); };
  const step = () => {
    if (WHR.t !== tk || !alive()) { stop(); return; }
    try {
      const t0 = performance.now();
      do {
        const k = keys.shift();
        let sig = '';
        const objs = cm.run(g => { const r = whereObjs(g, k); sig = r.map(o => g.children.indexOf(o)).join(); return r; });
        let url = same.get(sig);
        if (url === undefined) { url = cm.run(() => whereShot(objs, false)); same.set(sig, url); }
        WHR.thumb.set(k, url);
        whPut(box, k, url);
      } while (keys.length && performance.now() - t0 < 100);
    } catch (e) { stop(); throw e; }
    if (keys.length) setTimeout(step, 0); else stop();
  };
  setTimeout(step, 0);
}

let whDlg = null;
function whereDialog() {
  if (whDlg) return whDlg;
  const d = document.createElement('dialog');
  d.className = 'wdlg';
  d.innerHTML = '<div class="wbox"><div class="whead"><b></b><button type="button" class="wx" aria-label="Закрыть">×</button></div><div class="wimg"></div></div>';
  d.addEventListener('click', e => { if (e.target === d || e.target.classList.contains('wx')) d.close(); });   // мимо окна — это сам dialog
  document.body.appendChild(d);
  return whDlg = d;
}

// Клик по миниатюре: окно с крупной картинкой и названием детали; картинка считается один раз
let whKey = null;   // ключ, который сейчас в окне: ответ на старый клик чужой картинкой не показываем
function whereOpen(key, title) {
  if (!whereOn()) return;
  whereSync();   // модель могла поменяться после «Рассчитать»: крупная считается по текущей, и в кэш идёт под её токеном
  const d = whereDialog(), img = d.querySelector('.wimg'), show = u => { img.innerHTML = u ? `<img alt="${whEsc(title)}" src="${u}">` : '<p>Картинки нет</p>'; };
  whKey = key;
  d.querySelector('b').textContent = title;
  if (WHR.big.has(key)) show(WHR.big.get(key)); else img.innerHTML = '<p>Рисую…</p>';
  if (!d.open) d.showModal();
  if (WHR.big.has(key)) return;
  const tk = WHR.t;
  setTimeout(() => {
    const cm = openCardModel(WHERE_FLAGS);
    let url = '';
    try { url = cm.run(g => whereShot(whereObjs(g, key), true)); }
    catch (e) { console.error(e); }
    finally { cm.close(); }
    if (WHR.t === tk && url) WHR.big.set(key, url);
    if (d.open && whKey === key) show(url);
  }, 30);   // «Рисую…» успевает отрисоваться
}

// клик по коробке результата (nestBox, gilBox): миниатюра → окно
function whereClick(e) {
  const b = e.target.closest && e.target.closest('button.wh');
  if (b) whereOpen(b.dataset.wk, b.dataset.wt);
}
