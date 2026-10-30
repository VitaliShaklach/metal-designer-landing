// Страница лендинга: цикл отрисовки, камера по модели, панель живых цифр.
// Движок (md/params … dxf), defaults.js и stats.js уже загружены;
// stage, ok, renderer, scene, camera, controls, labels, group — из model.js.

// Размеры мангала, мм, толщина стенок, мм, и глубокие прорези (1 — есть):
// ползунки, кнопки и галочка меняют их, renderAll() пересчитывает по ним всё
const state = {len: SIZE.len.def, wid: SIZE.wid.def, top: SIZE.top.def, t: SIZE.t.def, deep: SIZE.deep.def};

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
}

// Камера: цель — центр рамки модели, расстояние — чтобы все 8 углов рамки влезли в #stage.
// Направление взгляда — текущее: если модель повернули, ползунок её не разворачивает обратно
function fitView() {
  if (!ok) return;
  const box = new THREE.Box3();
  group.traverseVisible(o => { if (o.isMesh && !o.userData.dim) box.expandByObject(o); });
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
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(back, dist * 1.08);              // небольшой запас по краям
  controls.update();
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
  Object.assign(el, {min: SIZE[k].min, max: SIZE[k].max, step: SIZE[k].step, value: state[k]});
  o.textContent = `${state[k]} мм`;
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
  b.setAttribute('aria-pressed', v === state.t);
  b.addEventListener('click', () => {
    state.t = v;
    thick.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.t === v));
    redraw();
  });
  thick.appendChild(b);
});

// Глубокие прорези: галочка снята — прорезей нет ни на модели, ни в цифрах
const deep = document.getElementById('cDeep');
deep.checked = !!state.deep;
deep.addEventListener('change', () => { state.deep = deep.checked ? 1 : 0; redraw(); });

if (ok) {
  new ResizeObserver(sizeStage).observe(stage);
  sizeStage();
  (function frameLoop() {
    requestAnimationFrame(frameLoop);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  })();
} else {
  document.getElementById('no3d').hidden = false;
}
renderAll();
fitView();
