// Порт md/views.js (лендинг) в редактор: из снимка убраны «человек для масштаба» и дрова печи (SHOT_OUT) — на чертеже им не место.
// Ортогональные виды 3D-модели в PNG для листов: снимает сама модель ортокамерой, отдельным рендером.
// На время снимка детали белые (подсвеченные — акцентом), рёбра тёмные, земли и размеров нет.
// После снимка всё возвращается: материалы, видимость, рёбра удаляются — модель на экране та же.
// Модель — в см (x — длина, y — вверх, z — ширина), бумага — в мм.

// r — вправо на листе, up — вверх, d — к зрителю (как в art/js/sheets.js). Вид слева — справа от главного, сверху — под ним
const VIEWS = {
  front: {r: [1, 0, 0], up: [0, 1, 0], d: [0, 0, 1]},
  left: {r: [0, 0, 1], up: [0, 1, 0], d: [-1, 0, 0]},
  top: {r: [1, 0, 0], up: [0, 0, -1], d: [0, 1, 0]},
};
(() => {
  const d = new THREE.Vector3(1, .75, 1.5).normalize(), r = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  VIEWS.iso = {r: r.toArray(), up: d.clone().cross(r).toArray(), d: d.toArray()};
  // изометрия снизу (#118): то, что приварено под дном, смотрим снизу — тот же угол, камера под изделием
  const l = new THREE.Vector3(1, -.75, 1.5).normalize(), rl = new THREE.Vector3(0, 1, 0).cross(l).normalize();
  VIEWS.isoLow = {r: rl.toArray(), up: l.clone().cross(rl).toArray(), d: l.toArray()};
})();

const SHOT_OUT = new Set(['man', 'wood']);   // не детали изделия
const SHOT_EDGE = 0x1c2a40, SHOT_HL = 0xc4480c, SHOT_GHOST_EDGE = 0x5a6b85, SHOT_MAX = 4096;   // рёбра, подсветка, бледные рёбра «призрака», предел картинки в px

// Детали на снимке: вся модель, как на экране без выбора детали (выбор на 3D листы не меняет), кроме hide.
// only — верхние объекты group, которые только и снимаются (один экземпляр детали на карте); null — все.
// Возвращает верхние объекты group и их меши
function shotParts(hide, only = null) {
  const top = group.children.filter(o => !o.userData.dim && !SHOT_OUT.has(o.userData.part) && (!S.parts || S.parts.has(PDF_PART[o.userData.part]))
    && !(hide && hide.has(o.userData.part)) && !(only && !only.has(o)));
  const meshes = [];
  top.forEach(o => o.traverse(m => {
    if (!m.isMesh) return;
    for (let p = m; p !== o; p = p.parent) if (!p.visible) return;   // скрытое внутри детали — скрыто и на снимке
    meshes.push(m);
  }));
  return {top, meshes};
}

// Рамка проекции мешей по их вершинам: lo, hi — по r и up, d0, d1 — по глубине (см)
function shotExtent(v, meshes) {
  const r = new THREE.Vector3(...v.r), up = new THREE.Vector3(...v.up), d = new THREE.Vector3(...v.d), p = new THREE.Vector3();
  const e = {lo: [Infinity, Infinity], hi: [-Infinity, -Infinity], d0: Infinity, d1: -Infinity};
  group.updateMatrixWorld(true);
  meshes.forEach(m => {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const a = p.dot(r), b = p.dot(up), c = p.dot(d);
      if (a < e.lo[0]) e.lo[0] = a; if (a > e.hi[0]) e.hi[0] = a;
      if (b < e.lo[1]) e.lo[1] = b; if (b > e.hi[1]) e.hi[1] = b;
      if (c < e.d0) e.d0 = c; if (c > e.d1) e.d1 = c;
    }
  });
  return e;
}

// Габарит проекции модели, мм модели; без 3D — null
function modelBoxMm(view) {
  if (!ok || !group) return null;
  const {meshes} = shotParts(null);
  if (!meshes.length) return null;
  const e = shotExtent(VIEWS[view], meshes);
  return {w: (e.hi[0] - e.lo[0]) * 10, h: (e.hi[1] - e.lo[1]) * 10};
}

// Рамка кадра вокруг объектов objs (#118, «где стоит»): их проекция с полем margin, не меньше minCm по ширине, подогнанная к пропорции aspect (ширина/высота).
// Возвращает {lo, hi} в см по r и up — для renderView({rect}); нет объектов в кадре — null
function focusRect(view, objs, aspect = 1.5, margin = .35, minCm = 22) {
  if (!ok || !group) return null;
  const {meshes} = shotParts(null, new Set(objs));
  if (!meshes.length) return null;
  const e = shotExtent(VIEWS[view], meshes);
  const cx = (e.lo[0] + e.hi[0]) / 2, cy = (e.lo[1] + e.hi[1]) / 2;
  let w = Math.max((e.hi[0] - e.lo[0]) * (1 + 2 * margin), minCm), h = Math.max((e.hi[1] - e.lo[1]) * (1 + 2 * margin), minCm / aspect);
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  return {lo: [cx - w / 2, cy - h / 2], hi: [cx + w / 2, cy + h / 2]};
}

// Рендер для снимков — один на страницу, создаётся при первом снимке
let shotR = null;
function shotRenderer() {
  if (shotR === null) {   // false — уже не вышло, второй раз не пробуем
    try { shotR = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true, alpha: true}); }
    catch (e) { shotR = false; }
    if (shotR) { shotR.setPixelRatio(1); shotR.setClearColor(0xffffff, 0); }
  }
  return shotR;
}

// Материалы снимков — одни на страницу: уничтоженный материал уносит с собой шейдер, и каждый следующий снимок
// компилировал бы его заново — на картах деталей это десятки снимков подряд
let shotM = null;
function shotMats() {
  if (!shotM) {
    const white = new THREE.MeshLambertMaterial({color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1});
    const accent = white.clone();
    accent.color.set(SHOT_HL);
    // «призрак» (#118): всё изделие, кроме подсвеченной детали, — полупрозрачное с бледным контуром
    const ghost = new THREE.MeshLambertMaterial({color: 0xa9b8d0, side: THREE.DoubleSide, transparent: true, opacity: .22, depthWrite: false});
    shotM = {white, accent, ghost, edgeMat: new THREE.LineBasicMaterial({color: SHOT_EDGE}),
      ghostEdge: new THREE.LineBasicMaterial({color: SHOT_GHOST_EDGE, transparent: true, opacity: .45, depthWrite: false})};
  }
  return shotM;
}

// Вид в масштабе 1:scale картинкой PNG. highlight — id деталей, залитых акцентом; hide — id, которых нет на снимке;
// only — верхние объекты group, которые только и снимаются; hlObj — верхние объекты, залитые акцентом;
// edges — Map геометрия → рёбра на серию снимков одной модели (рёбра не считаются заново; освобождает тот, кто дал Map).
// ghost — всё, кроме залитого акцентом, полупрозрачное с бледным контуром (#118, «где стоит»); залитое — непрозрачное, видно и то, что внутри.
// Без ghost — белое непрозрачное, как на листах и картах. rect — {lo, hi} кадра (см, focusRect) вместо рамки всей модели: деталь крупно.
// toPaper([x, y, z]) — точка модели (см) в мм бумаги от левого верхнего угла картинки. Без 3D — null
function renderView(view, scale, {pxPerMm = 8, highlight = null, hide = null, only = null, hlObj = null, edges = null, ghost = false, rect = null} = {}) {
  if (!ok || !group) return null;
  const R = shotRenderer();
  if (!R) return null;
  const v = VIEWS[view], {top, meshes} = shotParts(hide, only);
  if (!meshes.length) return null;
  const k = 10 / scale, pad = 1 / k;   // мм бумаги на см модели; поле 1 мм — рёбра у края не обрезаются
  const e = shotExtent(v, meshes);
  const lo = rect ? rect.lo : [e.lo[0] - pad, e.lo[1] - pad], hi = rect ? rect.hi : [e.hi[0] + pad, e.hi[1] + pad];
  const wMm = (hi[0] - lo[0]) * k, hMm = (hi[1] - lo[1]) * k;
  const px = Math.min(pxPerMm, SHOT_MAX / Math.max(wMm, hMm));
  R.setSize(Math.max(1, Math.round(wMm * px)), Math.max(1, Math.round(hMm * px)), false);

  // камера смотрит по -d на середину рамки, правый край кадра — r, верхний — up
  const r = new THREE.Vector3(...v.r), up = new THREE.Vector3(...v.up), d = new THREE.Vector3(...v.d);
  const c = r.clone().multiplyScalar((lo[0] + hi[0]) / 2).addScaledVector(up, (lo[1] + hi[1]) / 2);
  const hw = (hi[0] - lo[0]) / 2, hh = (hi[1] - lo[1]) / 2;
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 1, e.d1 - e.d0 + 20);
  cam.position.copy(c).addScaledVector(d, e.d1 + 10);
  cam.up.copy(up);
  cam.lookAt(c.clone().addScaledVector(d, e.d0));
  cam.updateMatrixWorld(true);

  // Свет — почти от глаза, чуть сверху-слева: грани к зрителю белые, бока труб и колёс темнее — видно форму.
  // Белый MeshBasicMaterial трубы не показал бы: рёбер по цилиндру нет (грани под 15°), белое на белом
  const amb = new THREE.AmbientLight(0xffffff, .5), sun = new THREE.DirectionalLight(0xffffff, .6);
  sun.position.copy(c).add(d.clone().addScaledVector(up, .5).addScaledVector(r, -.3).multiplyScalar(100));   // свету важно только направление
  sun.target.position.copy(c);
  const {white, accent, ghost: ghostMat, edgeMat, ghostEdge} = shotMats();

  // что вернуть после снимка
  const vis = [...scene.children, ...group.children].map(o => [o, o.visible]);
  const mats = meshes.map(m => [m, m.material]);
  const lines = [];   // рёбра на снимке: [меш, линии]
  const on = new Set(top);
  let url;
  try {
    scene.children.forEach(o => { if (o !== group) o.visible = false; });   // земля и свет сцены
    group.children.forEach(o => { o.visible = on.has(o); });
    scene.add(amb, sun, sun.target);
    meshes.forEach(m => {
      let part = null, o = m;
      for (let p = m; p && p !== group && !part; p = p.parent) part = p.userData.part;
      while (o.parent && o.parent !== group) o = o.parent;   // верхний объект group
      const hl = (highlight && highlight.has(part)) || (hlObj && hlObj.has(o));
      m.material = hl ? accent : ghost ? ghostMat : white;
      m.userData.shot = 1;
      if (ghost && hl && m.geometry.type === 'CylinderGeometry') return;   // у тонкого цилиндра рёбра по длине сливаются в чёрное: арматура была бы чёрной, а не оранжевой
      let eg = edges && edges.get(m.geometry);
      if (!eg) { eg = new THREE.EdgesGeometry(m.geometry, 25); if (edges) edges.set(m.geometry, eg); }
      const ed = new THREE.LineSegments(eg, ghost && !hl ? ghostEdge : edgeMat);
      ed.userData.shotEdge = 1;
      m.add(ed);
      lines.push([m, ed]);
    });
    R.render(scene, cam);
    url = R.domElement.toDataURL('image/png');
  } finally {
    scene.remove(amb, sun, sun.target);
    lines.forEach(([m, ed]) => { m.remove(ed); if (!edges) ed.geometry.dispose(); });
    mats.forEach(([m, mat]) => { m.material = mat; delete m.userData.shot; });
    vis.forEach(([o, s]) => { o.visible = s; });
  }
  const toPaper = p => {
    const q = new THREE.Vector3(...p);
    return [(q.dot(r) - lo[0]) * k, (hi[1] - q.dot(up)) * k];
  };
  return {url, wMm, hMm, toPaper};
}
