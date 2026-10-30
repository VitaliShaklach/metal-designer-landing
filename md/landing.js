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
    [`сталь ${d.t} мм`, 'боковины, дно, торцы'],
    [`≈ ${d.kg} кг`, 'металла'],
    [`${d.parts} ${plural(d.parts, 'деталь', 'детали', 'деталей')}`, 'под лазер'],
    [`рез ${fmt(d.cutM)} м`, 'длина реза'],
    [`${d.holes} / ${d.slots}`, 'отверстий / прорезей'],
    ['DXF готов', 'файл на каждую деталь'],
  ];
  document.getElementById('lstats').innerHTML =
    tiles.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
}

// Пересчитать всё по текущим настройкам; следующие задачи дописывают сюда свои шаги
function renderAll() {
  setSize(state);
  build3D();
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
SLIDERS.forEach(([k, id, out]) => {
  const el = document.getElementById(id), o = document.getElementById(out);
  Object.assign(el, {min: SIZE[k].min, max: SIZE[k].max, step: SIZE[k].step});
  el.addEventListener('input', () => {
    state[k] = +el.value;
    o.textContent = `${state[k]} мм`;
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
