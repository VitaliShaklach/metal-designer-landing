// Рысь на первом экране: только показываем готовое из lynx/ (собирает tools/lynx-capture.js), ничего не считаем.
// При загрузке файл только объявляет функции — его грузит и стенд tests/engine.js

// stats.json → плитки цифр в той же разметке, что панель мангала (drawStats в landing.js)
function lynxStatsHtml(stats) {
  return stats.tiles.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
}

// model.json → треугольники и рёбра для three.js. pos — по 9 чисел на треугольник, edges — по 6 на отрезок.
// Грань в P — индексы вершин до -1; на треугольники — веером от первой вершины.
// Ребро двух соседних граней — один отрезок: seen помнит пары вершин «меньшая-большая».
// Координаты — мм, центр рамки по X и Z — 0, низ — y = 0: камера и свет не зависят от того, где модель стояла в C:\dev.
// Есть высота H — модель целиком растянута до неё, как fitMesh в C:\dev; нет — V / 10
function lynxGeometry(model) {
  const V = model.V, lo = [0, 1, 2].map(() => Infinity), hi = lo.map(() => -Infinity);
  for (let i = 0; i < V.length; i++) { lo[i % 3] = Math.min(lo[i % 3], V[i]); hi[i % 3] = Math.max(hi[i % 3], V[i]); }
  const off = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  const s = model.H ? model.H / (hi[1] - lo[1]) : 1 / 10;
  const pt = i => [0, 1, 2].map(k => (V[3 * i + k] - off[k]) * s);
  const pos = [], edges = [], seen = new Set();
  let face = [];
  for (const i of model.P) {
    if (i >= 0) { face.push(i); continue; }
    for (let k = 1; k + 1 < face.length; k++) pos.push(...pt(face[0]), ...pt(face[k]), ...pt(face[k + 1]));
    face.forEach((a, k) => {
      const b = face[(k + 1) % face.length], key = Math.min(a, b) + '-' + Math.max(a, b);
      if (seen.has(key)) return;
      seen.add(key);
      edges.push(...pt(a), ...pt(b));
    });
    face = [];
  }
  return {pos, edges};
}

// Просмотрщик рыси в «Стало»: свой рендерер, камера и свет, отдельно от мангала (md/model.js).
// Кадр рисуется, только когда нужно — повернули или поменялся размер; между ними видеокарта отдыхает
let lynxView = null;    // {camera, mesh} — после удачной initLynx; по ним тесты проверяют поворот и кадр
let lynxStart = null;   // промис первой initLynx: модель грузится один раз
const LYNX_ISO = [.45, .3, .85];   // вид «iso», как кнопка вида в C:\dev (art/js/view3d.js)
const LYNX_TILT = [.9, 1.75];      // наклон мышью — в этих пределах (рад от взгляда сверху): рысь вписана в кадр на всём диапазоне

// true — 3D показано; false — нет WebGL или файл модели не загрузился: box скрыт, вместо него poster
function initLynx(box, poster) {
  lynxStart ??= startLynx(box).catch(() => false).then(shown => {
    box.hidden = !shown;
    poster.hidden = shown;
    return shown;
  });
  return lynxStart;
}

async function startLynx(box) {
  let renderer, model;
  // нет WebGL — файл и не просим. ok из md/model.js: мангал уже пробовал WebGL, вторая попытка дала бы вторую ошибку three.js в консоли
  if (!ok) return false;
  try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); } catch (e) { return false; }
  try {
    const r = await fetch('lynx/model.json?v=2026-11-02g');
    if (!r.ok) throw new Error(r.status);
    model = await r.json();
  } catch (e) { renderer.dispose(); return false; }

  const g = lynxGeometry(model), V3 = THREE.Vector3;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  // сталь с тёмными рёбрами граней, светлее, чем по плану (metalness .6 без отражений — почти чёрная), близко к C:\dev (art/js/view3d.js);
  // грани чуть отодвинуты вглубь, чтобы рёбра поверх них не мерцали
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x9aa1a8, metalness: .35, roughness: .6, flatShading: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(g.edges, 3));
  const scene = new THREE.Scene();
  scene.add(mesh, new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({color: 0x2b2f33})));
  // свет как у мангала (md/model.js)
  scene.add(new THREE.HemisphereLight(0xf2f4f5, 0xb9b4ae, 0.9));
  [[0xffffff, .75, 40, -250, 60], [0xffffff, .9, 120, 260, 200], [0xbfd0e0, .35, -180, 90, -120]].forEach(([c, k, x, y, z]) => {
    const d = new THREE.DirectionalLight(c, k);
    d.position.set(x, y, z);
    scene.add(d);
  });

  const bb = geo.boundingBox, camera = new THREE.PerspectiveCamera(35, 1, 10, 50000);
  const target = new V3(0, (bb.min.y + bb.max.y) / 2, 0);
  camera.position.copy(target).add(new V3(...LYNX_ISO));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  box.appendChild(renderer.domElement);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  // колесо и сдвиг выключены: колесо над рысью листает страницу, а рысь всегда целиком в кадре
  Object.assign(controls, {enableZoom: false, enablePan: false, minPolarAngle: LYNX_TILT[0], maxPolarAngle: LYNX_TILT[1]});
  controls.target.copy(target);
  controls.update();

  // В кадр — рамка рыси, повёрнутая как угодно вокруг вертикали: цилиндр по углам рамки (24 точки сверху и снизу).
  // Расстояние — чтобы цилиндр влез при любом наклоне из LYNX_TILT, направление взгляда — текущее
  const R = Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 / Math.cos(Math.PI / 24);
  const ring = [];
  for (let k = 0; k < 24; k++) for (const y of [bb.min.y, bb.max.y]) ring.push(new V3(R * Math.cos(k * Math.PI / 12), y, R * Math.sin(k * Math.PI / 12)).sub(target));
  function fit() {
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    const now = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    let dist = 0;
    for (const phi of [LYNX_TILT[0], now.phi, LYNX_TILT[1]]) {
      const back = new V3().setFromSphericalCoords(1, phi, now.theta);
      const right = new V3(0, 1, 0).cross(back).normalize(), up = back.clone().cross(right);
      for (const p of ring) dist = Math.max(dist, p.dot(back) + Math.abs(p.dot(right)) / tanH, p.dot(back) + Math.abs(p.dot(up)) / tanV);
    }
    camera.position.copy(target).addScaledVector(new V3().setFromSphericalCoords(1, now.phi, now.theta), dist * 1.04);
    controls.update();
  }

  let queued = false;
  const draw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
  };
  controls.addEventListener('change', draw);
  new ResizeObserver(() => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;   // скрыт (показан мангал) — размер 0 × 0 не ставим, иначе aspect NaN
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
    draw();
  }).observe(box);

  // Палец. OrbitControls на касании запрещает прокрутку страницы (preventDefault в touchstart) — его обработчики касаний
  // отрезаем ещё на подходе к холсту, в фазе перехвата у box, и крутим сами: при touch-action: pan-y (css/landing.css)
  // вертикальный жест браузер отдаёт прокрутке страницы, горизонтальный приходит сюда и вращает рысь вокруг вертикали
  const cv = renderer.domElement;
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) box.addEventListener(t, e => e.stopPropagation(), {capture: true, passive: true});
  let touchX = null;   // где был палец на прошлом шаге; null — палец не на рыси
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.isPrimary) touchX = e.clientX; });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch' || !e.isPrimary || touchX === null) return;
    const a = 2 * Math.PI * (e.clientX - touchX) / cv.clientHeight;   // как у OrbitControls: протянуть на высоту холста — полный оборот
    touchX = e.clientX;
    if (!a) return;
    camera.position.sub(target).applyAxisAngle(new V3(0, 1, 0), -a).add(target);
    controls.update();
  });
  for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, e => { if (e.pointerType === 'touch') touchX = null; });

  lynxView = {camera, mesh};
  return true;
}
