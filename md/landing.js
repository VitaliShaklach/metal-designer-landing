// Страница лендинга: цикл отрисовки, камера по модели, панель живых цифр.
// Движок (md/params … dxf), defaults.js и stats.js уже загружены;
// stage, ok, renderer, scene, camera, controls, labels, group — из model.js.

// Размеры мангала, мм, толщина стенок, мм, и глубокие прорези (1 — есть): берутся из ссылки после #
// (битая — пример по умолчанию); ползунки, кнопки и галочка меняют их, renderAll() пересчитывает по ним всё
const state = readLink(location.hash);
// Изделие на первом экране: 'mangal' или 'rys' (ссылка #item=rys); переключатель и адрес меняют его через setItem()
let item = readItem(location.hash);

// 1 деталь, 2 детали, 5 деталей
function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function drawStats() {
  const d = statsData();
  const tiles = [
    [`${d.len} × ${d.wid}`, 'жаровня, мм'],
    [`верх ${d.top}`, 'от земли, мм'],
    [`сталь ${d.t} мм`, 'все детали — один лист'],
    [`≈ ${d.kg} кг`, 'металла'],
    [`${d.parts} ${plural(d.parts, 'деталь', 'детали', 'деталей')}`, 'под лазер'],
    [`рез ${fmt(d.cutM)} м`, 'длина реза'],
    [`${d.holes} / ${d.slots}`, 'отверстий / прорезей'],
    ['DXF готов', 'файл на каждую деталь'],
  ];
  document.getElementById('lstats').innerHTML =
    tiles.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
}

// Пересчитать всё по текущим настройкам; следующие задачи дописывают сюда свои шаги.
// Таблицу DXF рисует build3D(), но без WebGL он сразу выходит — тогда её рисуем сами
function renderAll() {
  setSize(state);
  build3D();
  if (!ok) drawDxf();
  drawNest();
  dimList();
  drawCut();
  drawStats();
  writeLink();
  drawDocs();
}

// Адрес — всегда текущее изделие (у мангала — с размерами), без новых шагов «Назад». Пишется через 0,3 с после последнего изменения:
// ползунок перерисовывает по кадру, а Safari бросает ошибку, если менять адрес чаще 100 раз за 10 с
let linkTimer = 0;
function writeLink() {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(() => history.replaceState(null, '', itemHash(item, state)), 300);
}

// Вид на модель: цель — центр рамки видимых деталей (вся модель или выбранная деталь),
// расстояние — чтобы все 8 углов рамки влезли в #stage.
// Направление взгляда — текущее: если модель повернули, ползунок её не разворачивает обратно
function viewFor() {
  const box = new THREE.Box3();
  group.traverseVisible(o => { if (o.isMesh && !o.userData.dim) box.expandByObject(o); });
  if (box.isEmpty()) return {pos: camera.position.clone(), target: controls.target.clone()};   // видеть нечего — камера на месте
  const c = box.getCenter(new THREE.Vector3());
  const back = camera.position.clone().sub(controls.target).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right);
  const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
  let dist = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(c);
    const near = p.dot(back);                                              // насколько угол ближе к камере, чем центр
    dist = Math.max(dist, near + Math.abs(p.dot(right)) / tanH, near + Math.abs(p.dot(up)) / tanV);
  }
  return {pos: c.clone().addScaledVector(back, dist * 1.08), target: c};   // небольшой запас по краям
}

// Камера сразу на вид; начатый полёт камеры (flyTo) отменяется
function fitView() {
  if (!ok) return;
  const v = viewFor();
  camAnim = null;
  controls.target.copy(v.target);
  camera.position.copy(v.pos);
  controls.update();
}

// Плавный полёт камеры за 0,7 с, как в C:\dev; шаг полёта — в каждом кадре frameLoop
function flyTo(p, tg) {
  if (!ok) return;
  camAnim = {p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: tg, s: performance.now()};
}

function flyStep() {
  if (!camAnim) return;
  const k = Math.min(1, (performance.now() - camAnim.s) / 700), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
  controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
  if (k >= 1) camAnim = null;
}

// Скрытый #stage (показана рысь) — размер 0 × 0: такой не ставим, иначе камера получит aspect NaN
function sizeStage() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  labels.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Перерисовка — не чаще кадра, пока ползунок тянут
let pending = false;
function redraw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; renderAll(); fitView(); });
}

// Ползунки: min/max/step — из SIZE
const SLIDERS = [['len', 'sLen', 'oLen'], ['wid', 'sWid', 'oWid'], ['top', 'sTop', 'oTop']];
SLIDERS.forEach(([k, id]) => {
  const el = document.getElementById(id);
  Object.assign(el, {min: SIZE[k].min, max: SIZE[k].max, step: SIZE[k].step});
  el.addEventListener('input', () => {
    state[k] = +el.value;
    showState();
    redraw();
    flashHint();
  });
});

// Толщина: кнопка на каждое значение из SIZE.t, нажатая — aria-pressed
const thick = document.getElementById('sT');
SIZE.t.options.forEach(v => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${v} мм`;
  b.dataset.t = v;
  b.addEventListener('click', () => { state.t = v; showState(); redraw(); flashHint(); });
  thick.appendChild(b);
});

// Глубокие прорези: галочка снята — прорезей нет ни на модели, ни в цифрах
const deep = document.getElementById('cDeep');
deep.addEventListener('change', () => { state.deep = deep.checked ? 1 : 0; redraw(); flashHint(); });

// Ползунки, кнопки толщины и галочка показывают state
function showState() {
  SLIDERS.forEach(([k, id, out]) => {
    document.getElementById(id).value = state[k];
    document.getElementById(out).textContent = `${state[k]} мм`;
  });
  thick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.t === state.t));
  deep.checked = !!state.deep;
}
showState();

// Новая ссылка в уже открытой вкладке (вставили в адресную строку, открыли из мессенджера) — изделие и мангал по ней.
// Ссылка рыси размеры мангала не трогает: вернулись к мангалу — он прежний
window.addEventListener('hashchange', () => {
  const next = readItem(location.hash);
  if (next === 'mangal') Object.assign(state, readLink(location.hash));
  showState();
  setItem(next);
  redraw();
});

// Блок «Что получаете» свёрнут; кнопка под цифрами раскрывает его и прокручивает к нему, повторно — сворачивает.
// Всё посчитано и без неё: renderAll() рисует таблицы и в скрытом блоке
const getSec = document.getElementById('get'), getBtn = document.getElementById('getBtn');
function showGet(open) {
  getSec.hidden = !open;
  getBtn.textContent = open ? 'Скрыть чертежи ↑' : 'Показать чертежи и DXF ↓';
  getBtn.setAttribute('aria-expanded', String(open));
}
const calmMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;   // кому мешает анимация — без плавной прокрутки
getBtn.addEventListener('click', () => {
  showGet(getSec.hidden);
  if (!getSec.hidden) getSec.scrollIntoView({behavior: calmMotion() ? 'auto' : 'smooth', block: 'start'});
  drawDocs(true);
});

// Строка под ползунками: после правки размеров мигает (через 0,3 с после последней), ссылка в строке раскрывает блок ниже
const hint = document.getElementById('hint');
let flashTimer = 0, flashOff = 0;
function flashHint() {
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    hint.classList.add('flash');
    clearTimeout(flashOff);
    flashOff = setTimeout(() => hint.classList.remove('flash'), 3000);
  }, 300);
}
document.getElementById('hintGo').addEventListener('click', () => {
  if (getSec.hidden) getBtn.click(); else getSec.scrollIntoView({behavior: calmMotion() ? 'auto' : 'smooth', block: 'start'});
});

// Чертежи А3 и карты деталей А4: листы строятся, только пока их вкладка открыта. Открыли вкладку — сразу;
// сменили настройки — через 0,25 с после последней смены: снимок видов — заметная работа, на каждый кадр ползунка её не делаем.
// list — построенные листы, for — по каким настройкам
// Карты (start) строятся по одной за шаг, между шагами страница отвечает; превью меняются на месте, лишние — убираются.
// job — недостроенная серия: новые настройки её бросают, печать — достраивает разом
const DOCS = [
  {pane: 'tab-sheets', box: 'sheetBox', pdf: 'shPdf', cap: 'Лист', a4: false, build: buildSheets},
  {pane: 'tab-cards', box: 'cardBox', pdf: 'cdPdf', cap: 'Карта', a4: true, build: buildCards, start: startCards},
].map(d => ({...d, pane: document.getElementById(d.pane), box: document.getElementById(d.box), list: [], for: '', job: null}));
let docTimer = 0;
const docStale = d => JSON.stringify(state) !== d.for;   // листы построены не по текущим настройкам
function drawDocs(now) {
  clearTimeout(docTimer);
  const d = DOCS.find(d => !getSec.hidden && !d.pane.hidden && docStale(d));
  if (!d) return;
  if (now) showDoc(d); else docTimer = setTimeout(() => showDoc(d), 250);
}
const docFig = (d, s, i, n) => `<figure class="shprev"><figcaption>${d.cap} ${i + 1} из ${n} · ${s.title}</figcaption>${s.svg}</figure>`;
function stopDoc(d) {
  if (!d.job) return;
  clearTimeout(d.job.timer);
  d.job.it.close();
  d.job = null;
}
function showDoc(d) {
  stopDoc(d);
  d.for = JSON.stringify(state);
  if (!d.start) {
    d.list = d.build();
    d.box.innerHTML = d.list.map((s, i) => docFig(d, s, i, d.list.length)).join('');
    return;
  }
  const it = d.start(), job = {it, timer: 0};
  d.job = job;
  d.list = [];
  // за шаг — карты, пока не прошло ~0,2 с: каждая пауза — ещё и кадр 3D на экране, на слабой видеокарте он не бесплатный
  const step = () => {
    if (d.job !== job) return;
    const t0 = performance.now();
    do {
      const i = d.list.length, s = it.next(), old = d.box.children[i];
      d.list.push(s);
      if (old) old.outerHTML = docFig(d, s, i, it.N); else d.box.insertAdjacentHTML('beforeend', docFig(d, s, i, it.N));
    } while (d.list.length < it.N && performance.now() - t0 < 200);
    if (d.list.length < it.N) { job.timer = setTimeout(step, 0); return; }
    while (d.box.children.length > it.N) d.box.lastElementChild.remove();
    d.job = null;
  };
  if (it.N) step(); else { d.box.innerHTML = ''; d.job = null; }
}

// Печать листов по образцу printSvgs из C:\dev: листы — в #printBox, размер страницы — @page, после печати всё убирается
function printSheets(list, a4) {
  const pb = document.getElementById('printBox'), pg = document.createElement('style');
  pb.innerHTML = list.map(s => s.svg).join('');
  pb.classList.toggle('a4', !!a4);
  pg.textContent = `@media print{@page{size:${a4 ? 'A4 portrait' : 'A3 landscape'};margin:0}}`;
  document.head.appendChild(pg);
  const t = document.title;
  document.title = sheetName(statsData()) + (a4 ? ' — карты деталей' : ' — чертежи');   // имя файла PDF по умолчанию
  const done = () => { document.title = t; pb.innerHTML = ''; pg.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  window.print();
}
DOCS.forEach(d => document.getElementById(d.pdf).addEventListener('click', () => {
  // ползунок только что двигали или карты ещё строятся — печатаем текущие целиком, не ждём
  if (docStale(d) || d.job) {
    stopDoc(d);
    d.list = d.build();
    d.for = JSON.stringify(state);
    d.box.innerHTML = d.list.map((s, i) => docFig(d, s, i, d.list.length)).join('');
  }
  printSheets(d.list, d.a4);
}));

// Вкладки как в C:\dev: клик или стрелки ←/→. Выбор не запоминаем — localStorage общий с хобби-сайтом
const TABS = [...getSec.querySelectorAll('[role=tab]')];
function showTab(name) {
  TABS.forEach(b => {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    document.getElementById('tab-' + b.dataset.tab).hidden = !on;
  });
  drawDocs(true);
}
TABS.forEach(b => {
  b.addEventListener('click', () => showTab(b.dataset.tab));
  b.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const vis = TABS.filter(t => !t.hidden), n = vis[(vis.indexOf(b) + d + vis.length) % vis.length];
    n.focus();
    showTab(n.dataset.tab);
  });
});

// Без 3D размерам негде появиться — вкладки «Размеры» нет, блок открывается на раскрое
if (!ok) {
  document.getElementById('t-dims').hidden = true;
  showTab('cut');
}

// Размеры на модели: галочки, «Показать все», «Скрыть все», свернуть группу по заголовку (как в C:\dev).
// Свёрнутое помним в dimFold движка до перезагрузки — dimList() перерисовывает список при каждом ползунке.
// Движок читает dimFold из localStorage хобби-сайта (домен общий) — здесь его не слушаем и туда не пишем:
// раскрыты «Габариты» (ширина и высота по умолчанию) и «Жаровня» (длина), остальное свёрнуто
for (const k in dimFold) delete dimFold[k];
Object.assign(dimFold, {all: false, grill: false});
const dimEl = document.getElementById('dimList');
dimEl.addEventListener('change', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  e.target.checked ? S.dims.add(id) : S.dims.delete(id);
  build3D();
});
dimEl.addEventListener('click', e => {
  const bt = e.target.closest('h3 button');
  if (!bt) return;
  const dg = bt.closest('.dg'), shut = dg.classList.toggle('shut');
  bt.setAttribute('aria-expanded', String(!shut));
  dimFold[dg.dataset.el] = shut;
});
function allDims(on) {
  dimVisible().forEach(r => on ? S.dims.add(r.id) : S.dims.delete(r.id));
  build3D();
  dimList();
}
document.getElementById('dAll').addEventListener('click', () => allDims(true));
document.getElementById('dNone').addEventListener('click', () => allDims(false));

// Раскрой на лист во вкладке «Лазер · DXF»: размер листа — кнопками (SHEETS из nest.js, по умолчанию 1250 × 2500),
// на каждый лист — подпись с толщиной, превью, список позиций и свой DXF. Размер листа не в ссылке и не в localStorage
let sheetSz = 1, nestNow = [];
const nestBox = document.getElementById('nestBox'), sheetBtns = document.getElementById('sheetSz');
SHEETS.forEach(([w, l], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${w} × ${l}`;
  b.addEventListener('click', () => { sheetSz = i; drawNest(); });
  sheetBtns.appendChild(b);
});
function drawNest() {
  sheetBtns.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === sheetSz)));
  nestNow = laserSheets(sheetSz);
  nestBox.innerHTML = nestNow.map((s, k) => {
    const names = [...new Map(s.items.map(it => [it.no, it.p.name])).entries()].sort((a, b) => a[0] - b[0]);
    return `<figure class="nestsh">
      <figcaption><b>Лист ${s.mm} мм · ${s.W} × ${s.L}</b> · ${s.i} из ${s.n} · детали в полосе ${s.W} × ${s.len} мм · зазор ${String(NEST_GAP).replace('.', ',')} мм · заполнение ${Math.round(s.fill * 100)} %</figcaption>
      ${sheetSvg(s)}
      <div class="nestfoot"><ol class="nestno">${names.map(([no, n]) => `<li><b>${no}</b> ${n}</li>`).join('')}</ol>
        <button type="button" class="dxfbtn" data-k="${k}">DXF листа</button></div>
      ${s.too.length ? `<p class="tabnote">Не влезают в лист: ${s.too.join(', ')} — выберите лист больше</p>` : ''}
    </figure>`;
  }).join('');
}
// Зазор между деталями (setNestGap из nest.js): пока вводят — перекладываем по каждому верному числу,
// по выходу из поля — показываем то, что встало (3–20 мм, шаг 0,5). Листы «Раскрой» в чертежах — тоже с ним,
// их кэш по state зазора не видит, поэтому сбрасываем. Как и размер листа — не в ссылке и не в localStorage
const gapInp = document.getElementById('nestGap');
function setGap(fix) {
  const v = gapInp.value.trim() === '' ? NaN : gapInp.valueAsNumber;
  if (!Number.isFinite(v) && !fix) return;
  const was = NEST_GAP, now = setNestGap(Number.isFinite(v) ? v : NEST_GAP);
  if (fix) gapInp.value = now;
  if (now === was) return;
  drawNest();
  DOCS.forEach(d => { d.for = ''; });
  drawDocs();
}
gapInp.addEventListener('input', () => setGap(false));
gapInp.addEventListener('change', () => setGap(true));
nestBox.addEventListener('click', e => {
  const b = e.target.closest('.dxfbtn');
  if (b) { const s = nestNow[+b.dataset.k]; saveOut(sheetFile(s), sheetDxf(s)); }
});

if (ok) {
  new ResizeObserver(sizeStage).observe(stage);
  sizeStage();
  (function frameLoop() {
    requestAnimationFrame(frameLoop);
    if (item !== 'mangal') return;       // показана рысь — мангал кадры не рисует
    flyStep();
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  })();
} else {
  document.getElementById('no3d').hidden = false;
}
renderAll();
fitView();

// «Мангал | Рысь»: видны только блоки [data-item] выбранного изделия, кнопки — aria-pressed.
// Рысь: блок «Что получаете» свёрнут, цифры — из lynx/stats.json, он грузится один раз по первому показу;
// там же один раз грузится 3D рыси в «Стало» (initLynx, md/lynx.js), не вышло — вместо него постер.
// Пока #stage скрыт, окно могли повернуть или растянуть, а sizeStage() размер 0 × 0 пропускает:
// при возврате к мангалу ставим размер и камеру заново, модель — в кадр
const ITEM_BTNS = [...document.querySelectorAll('#items button')];
const ITEM_ELS = [...document.querySelectorAll('[data-item]')].filter(el => !ITEM_BTNS.includes(el));
let lynxStatsLoad = null;   // промис загрузки stats.json
function setItem(next) {
  item = next;
  ITEM_ELS.forEach(el => { el.hidden = el.dataset.item !== item; });
  ITEM_BTNS.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.item === item)));
  if (item === 'rys') {
    showGet(false);
    initLynx(document.getElementById('lynx3d'), document.getElementById('lynxPoster'));
    lynxStatsLoad ??= fetch('lynx/stats.json?v=2026-11-02g').then(r => r.json())
      .then(st => { document.getElementById('lynxStats').innerHTML = lynxStatsHtml(st); })
      .catch(() => { lynxStatsLoad = null; });   // не загрузилось — без цифр, следующий показ попробует снова
  } else if (ok) {
    sizeStage();
    fitView();
  }
  writeLink();
}
ITEM_BTNS.forEach(b => b.addEventListener('click', () => setItem(b.dataset.item)));
setItem(item);

// Любая картинка ленты рыси — крупно в #lbox; клик по нему закрывает, Esc закрывает сам <dialog>
const lbox = document.getElementById('lbox'), lboxImg = lbox.querySelector('img');
document.querySelector('.ribbon').addEventListener('click', e => {
  const img = e.target.closest('img');
  if (!img) return;
  lboxImg.src = img.src;
  lboxImg.alt = img.alt;
  lbox.showModal();
});
lbox.addEventListener('click', () => lbox.close());
