// Страница лендинга: цикл отрисовки, камера по модели, панель живых цифр.
// Движок (md/params … dxf), defaults.js и stats.js уже загружены;
// stage, ok, renderer, scene, camera, controls, labels, group — из model.js.

// Размеры мангала, мм, толщина стенок, мм, и глубокие прорези (1 — есть): берутся из ссылки после #
// (битая — пример по умолчанию); ползунки, кнопки и галочка меняют их, renderAll() пересчитывает по ним всё
const state = readLink(location.hash);

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
}

// Адрес — всегда текущий мангал, без новых шагов «Назад». Пишется через 0,3 с после последнего изменения:
// ползунок перерисовывает по кадру, а Safari бросает ошибку, если менять адрес чаще 100 раз за 10 с
let linkTimer = 0;
function writeLink() {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(() => history.replaceState(null, '', linkHash(state)), 300);
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

function sizeStage() {
  const w = stage.clientWidth, h = stage.clientHeight;
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
  });
});

// Толщина: кнопка на каждое значение из SIZE.t, нажатая — aria-pressed
const thick = document.getElementById('sT');
SIZE.t.options.forEach(v => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${v} мм`;
  b.dataset.t = v;
  b.addEventListener('click', () => { state.t = v; showState(); redraw(); });
  thick.appendChild(b);
});

// Глубокие прорези: галочка снята — прорезей нет ни на модели, ни в цифрах
const deep = document.getElementById('cDeep');
deep.addEventListener('change', () => { state.deep = deep.checked ? 1 : 0; redraw(); });

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

// Новая ссылка в уже открытой вкладке (вставили в адресную строку, открыли из мессенджера) — мангал по ней
window.addEventListener('hashchange', () => {
  Object.assign(state, readLink(location.hash));
  showState();
  redraw();
});

// Блок «Что получаете» свёрнут; кнопка под цифрами раскрывает его и прокручивает к нему, повторно — сворачивает.
// Всё посчитано и без неё: renderAll() рисует таблицы и в скрытом блоке
const getSec = document.getElementById('get'), getBtn = document.getElementById('getBtn');
getBtn.addEventListener('click', () => {
  getSec.hidden = !getSec.hidden;
  getBtn.textContent = getSec.hidden ? 'Показать чертежи и DXF ↓' : 'Скрыть чертежи ↑';
  getBtn.setAttribute('aria-expanded', String(!getSec.hidden));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // кому мешает анимация — без плавной прокрутки
  if (!getSec.hidden) getSec.scrollIntoView({behavior: calm ? 'auto' : 'smooth', block: 'start'});
});

// Вкладки как в C:\dev: клик или стрелки ←/→. Выбор не запоминаем — localStorage общий с хобби-сайтом
const TABS = [...getSec.querySelectorAll('[role=tab]')];
function showTab(name) {
  TABS.forEach(b => {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    document.getElementById('tab-' + b.dataset.tab).hidden = !on;
  });
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
      <figcaption><b>Лист ${s.mm} мм · ${s.W} × ${s.L}</b> · ${s.i} из ${s.n} · детали в полосе ${s.W} × ${s.len} мм · заполнение ${Math.round(s.fill * 100)} %</figcaption>
      ${sheetSvg(s)}
      <div class="nestfoot"><ol class="nestno">${names.map(([no, n]) => `<li><b>${no}</b> ${n}</li>`).join('')}</ol>
        <button type="button" class="dxfbtn" data-k="${k}">DXF листа</button></div>
      ${s.too.length ? `<p class="tabnote">Не влезают в лист: ${s.too.join(', ')} — выберите лист больше</p>` : ''}
    </figure>`;
  }).join('');
}
nestBox.addEventListener('click', e => {
  const b = e.target.closest('.dxfbtn');
  if (b) { const s = nestNow[+b.dataset.k]; saveOut(sheetFile(s), sheetDxf(s)); }
});

if (ok) {
  new ResizeObserver(sizeStage).observe(stage);
  sizeStage();
  (function frameLoop() {
    requestAnimationFrame(frameLoop);
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
