// Карты деталей А4 по образцу карт собаки (C:\dev\metal-designer\art\js\sheets.js, cardPiece): лист на каждую деталь,
// которую делает цех, — как режут, как она выглядит, где стоит на мангале, к чему варить, как гнуть.
// Покупное (колёса, болты) карт не получает — оно в спецификации.
// Швы считаются по 3D-модели: какие детали варятся, а какие кладутся или вставляются — таблица JOINS,
// длина и место шва — по касанию деталей. Модель для карт строится своя (cardModel): так швы есть и без WebGL.

const STEEL = 7.85e-6;   // кг на мм³ — 7,85 г/см³

// Площадь контура, мм² (формула шнурка; замкнут контур точкой-повтором или нет — всё равно)
function loopArea(l) {
  let s = 0;
  l.forEach(([x, y], i) => { const [x2, y2] = l[(i + 1) % l.length]; s += x * y2 - x2 * y; });
  return Math.abs(s) / 2;
}

// Масса детали, кг: самый большой контур — внешний, остальные контуры (прорези, вырезы) и отверстия вычитаем
function partKg(m, mm) {
  const a = m.loops.map(loopArea).sort((p, q) => q - p);
  const area = a[0] - a.slice(1).reduce((s, v) => s + v, 0) - m.circles.reduce((s, c) => s + Math.PI * c[2] ** 2, 0);
  return area * mm * STEEL;
}

/* ---------- что за детали ---------- */
// id — карта; tags — метки tag(...) в model.js, снимается первый экземпляр; twin — зеркальная или такая же пара
// (на той же карте, кол. — обеих); laser — pt детали под лазер (laserParts); rows — строки раскроя кроме лазерной;
// bends — гибка: профиль в мм и гибы по порядку; extra — строки к «Сварке», которых нет в JOINS;
// inner — швы внутри составной детали (ручка колосника к листу, патрубок к площадке ножки).
// Порядок — порядок сборки (ASM_STEPS в sheets.js): по нему номера карт
const CARD_UNITS = [
  {id: 'gBot', tags: ['gBot'], name: 'Дно жаровни', laser: 'gBot'},
  {id: 'side0', tags: ['side0'], name: 'Боковина жаровни задняя', laser: 'side0'},
  {id: 'side1', tags: ['side1'], name: 'Боковина жаровни передняя', laser: 'side1'},
  {id: 'gEnd', tags: ['gEnd'], name: 'Торец жаровни правый', laser: 'gEnd'},
  {id: 'gEnd0', tags: ['gEnd0', 'logo'], name: 'Торец жаровни левый', laser: 'gEnd0'},
  {id: 'gAng', tags: ['gAng'], name: 'Уголок в жаровне', rows: [/^Уголок 30×30×3 в жаровне/]},
  {id: 'cgrAng', tags: ['cgrAngB'], twin: ['cgrAngF'], name: 'Опора колосника', rows: [/^Уголок 30×30×4 — опора колосника/],
    twinTxt: 'Передняя опора — зеркально: к передней боковине, полкой внутрь'},
  {id: 'legs', tags: ['legs'], name: 'Ножка', laser: 'legs', rows: [/^Ножка /, /^Патрубок ножки/, /^Заглушка ножки/],
    inner: 'патрубок — к площадке по кругу, гайку М16 — внутрь патрубка; заглушку со шпилькой — в верхний торец трубы, заподлицо. Труба вкручивается в патрубок'},
  {id: 'pads', tags: ['pads'], name: 'Площадка под колесо', laser: 'pads',
    extra: () => S.wheels ? ['колесо — покупное, на 4 болта М8×20 с гайкой и шайбой; отверстия сверлить по колесу'] : []},
  {id: 'feet', tags: ['feet'], name: 'Пятка ножки', rows: [/^Пятка ножки/]},
  {id: 'hook', tags: ['hook'], name: 'Скоба задвижки', rows: [/^Скоба задвижки/], bends: hookBends},
  {id: 'air', tags: ['air'], name: 'Задвижка поддува', laser: 'air', bends: airBends},
  {id: 'handle', tags: ['handle'], name: 'Ручка', rows: [/^Ручка — труба/], inner: 'два кронштейна — к хвату по кругу, под 90°'},
  {id: 'cgr', tags: ['cgr1'], twin: ['cgr2'], name: 'Колосник', rows: [/^Колосник 1 и Колосник 2/, /^Ручка колосника/],
    twinTxt: 'Колосник 2 (правый, у ручки) — такой же', inner: 'ручку-уголок — к колоснику нижней кромкой полки, поперёк жаровни'},
  {id: 'gGrate', tags: ['gGrate'], name: 'Решётка в жаровне', rows: [/^Решётка в жаровне/]},
  {id: 'g2', tags: ['g2'], name: 'Решётка сверху', rows: [/^Решётка сверху/]},
  {id: 'div', tags: ['div'], name: 'Перегородка жаровни', laser: 'div'},
];

// Что с чем соединяется: weld — варить, lay — кладётся сверху, in — вставляется. [кто, к кому, как]
const JOINS = [
  ['side0', 'gBot', 'weld'], ['side1', 'gBot', 'weld'],
  ['gEnd', 'gBot', 'weld'], ['gEnd', 'side0', 'weld'], ['gEnd', 'side1', 'weld'],
  ['gEnd0', 'gBot', 'weld'], ['gEnd0', 'side0', 'weld'], ['gEnd0', 'side1', 'weld'],
  ['gAng', 'side1', 'weld'], ['cgrAng', 'side0', 'weld'], ['cgrAng', 'side1', 'weld'],
  ['legs', 'gBot', 'weld'], ['legs', 'pads', 'weld'], ['legs', 'feet', 'weld'],
  ['hook', 'side0', 'weld'], ['hook', 'side1', 'weld'], ['handle', 'gEnd', 'weld'],
  ['air', 'hook', 'in'], ['div', 'side0', 'in'], ['div', 'side1', 'in'],
  ['cgr', 'cgrAng', 'lay'], ['gGrate', 'gAng', 'lay'], ['g2', 'side0', 'lay'], ['g2', 'side1', 'lay'],
];

// Решётки на 3D по умолчанию выключены, а в раскрое есть: модель для карт строится с ними,
// но на картах других деталей их нет — иначе верхняя решётка закрыла бы жаровню
const CARD_FLAGS = {grillGrate: true, grates2: true}, CARD_ONLY_OWN = ['gGrate', 'g2'];

// Гибка задвижки: концы полосы отогнуты наружу — ручки. Профиль — вид сверху на полосу, мм
function airBends() {
  const f = AIR_TH * 10, l = AIR_L * 10, w = AIR_H * 10;
  return {pts: [[0, f], [0, 0], [l, 0], [l, f]], rows: [
    {ang: 90, txt: `отгиб ${mmTxt(f)} мм на левом конце — наружу`, len: w},
    {ang: 90, txt: `отгиб ${mmTxt(f)} мм на правом конце — в ту же сторону`, len: w},
  ]};
}

// Гибка скобы: Г-образно — лапка вниз к боковине, полка под задвижку, загиб вверх перед ней. Профиль — вид сбоку, мм
function hookBends() {
  const a = BR_LEG * 10, b = Math.round((BR_IN + BR_T) * 10), c = BR_UP * 10, w = BR_W * 10;
  return {pts: [[0, -a], [0, 0], [b, 0], [b, c]], rows: [
    {ang: 90, txt: `лапка ${mmTxt(a)} мм — вниз, к боковине`, len: w},
    {ang: 90, txt: `загиб ${mmTxt(c)} мм — вверх, перед задвижкой; полка между гибами ${b} мм`, len: w},
  ]};
}

/* ---------- 3D-модель для карт ---------- */
// Те же buildParts, что на экране, в своей группе: без размеров, человека и выбора детали, с решётками (CARD_FLAGS).
// Верхние объекты — с меткой детали, как в build3D()
function cardModel() {
  const sv = group, keep = {dims: S.dims, man: S.man}, g = new THREE.Group(), mk = [];
  for (const k in CARD_FLAGS) keep[k] = S[k];
  group = g;
  Object.assign(S, CARD_FLAGS, {dims: new Set(), man: false});
  try { buildParts(id => mk.push([g.children.length, id])); } finally { group = sv; Object.assign(S, keep); }
  let mi = 0, part = null;
  g.children.forEach((o, i) => {
    while (mi < mk.length && mk[mi][0] <= i) part = mk[mi++][1];
    o.userData.part = part;
  });
  g.updateMatrixWorld(true);
  return g;
}

// Модель для карт: в браузере она же снимается видами (views.js снимает то, что в group).
// cardEdges — рёбра её мешей на все снимки карт: деталь попадает на 3–6 снимков, рёбра считаются один раз.
// openCardModel() — модель на серию шагов: run(fn) подключает её к сцене только на время fn, между шагами
// на экране своя модель; close() — освободить (повторный вызов ничего не делает)
let cardEdges = null;
function openCardModel() {
  const g = cardModel(), edges = new Map(), onScene = typeof scene !== 'undefined' && scene;
  let open = true;
  const run = fn => {
    const sv = group, se = cardEdges;
    if (onScene) { group = g; scene.add(g); }
    cardEdges = edges;
    try { return fn(g); } finally {
      cardEdges = se;
      if (onScene) { scene.remove(g); group = sv; }
    }
  };
  const close = () => {
    if (!open) return;
    open = false;
    edges.forEach(eg => eg.dispose());
    const mats = new Set(Object.values(M));
    g.traverse(m => {
      if (m.geometry) m.geometry.dispose();
      if (m.material && !mats.has(m.material)) m.material.dispose();
    });
  };
  return {g, run, close};
}
// Модель для карт на время fn
function withCardModel(fn) {
  const cm = openCardModel();
  try { return cm.run(fn); } finally { cm.close(); }
}

const EPS = .05;   // см: детали, между которыми меньше, — касаются

// Рамка объекта и его меши с рамками (см, мир)
function objBoxes(o) {
  const ms = [];
  o.traverse(m => { if (m.isMesh) ms.push({box: new THREE.Box3().setFromObject(m), cyl: m.geometry.type === 'CylinderGeometry'}); });
  return {o, box: new THREE.Box3().setFromObject(o), ms};
}
const touch = (a, b) => ['x', 'y', 'z'].every(k => a.min[k] <= b.max[k] + EPS && b.min[k] <= a.max[k] + EPS);

// Экземпляры детали: верхние объекты меток, слипшиеся по касанию (у ножки — площадка, труба, стык)
function instances(objs) {
  const out = [];
  objs.forEach(x => {
    const hit = out.filter(c => c.some(y => touch(x.box, y.box)));
    const merged = [x, ...hit.flat()];
    hit.forEach(c => out.splice(out.indexOf(c), 1));
    out.push(merged);
  });
  // порядок — как строились: первый экземпляр — первый в модели
  return out.map(c => c.sort((a, b) => a.i - b.i)).sort((a, b) => a[0].i - b[0].i);
}

// Шов между двумя мешами: null — не касаются. Полоса — шов по линии; площадка — по контуру,
// труба торцом — по кругу; вытянутое касание (уголок полкой к стенке) — по длинной кромке.
// p — точки шва (см) для картинки, len — длина, мм
function seamOf(a, b) {
  const ax = ['x', 'y', 'z'], lo = {}, hi = {}, d = {};
  for (const k of ax) {
    lo[k] = Math.max(a.box.min[k], b.box.min[k]); hi[k] = Math.min(a.box.max[k], b.box.max[k]);
    if (hi[k] - lo[k] < -EPS) return null;
    d[k] = Math.max(0, hi[k] - lo[k]);
  }
  const [k0, k1, k2] = [...ax].sort((p, q) => d[q] - d[p]);
  const c = {x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2};
  const at = (v0, v1) => { const p = {...c}; p[k0] = v0; p[k1] = v1; p[k2] = c[k2]; return [p.x, p.y, p.z]; };
  if (d[k0] < .3) return null;   // касание точкой
  if (d[k1] < .6 || d[k0] / d[k1] > 3 && !a.cyl && !b.cyl) {
    const y1 = d[k1] < .6 ? c[k1] : lo[k1];   // по длинной кромке — по краю касания
    return {kind: d[k1] < .6 ? 'line' : 'edge', len: d[k0] * 10, p: [at(lo[k0], y1), at(hi[k0], y1)]};
  }
  if (a.cyl || b.cyl) {
    const r = Math.min(d[k0], d[k1]) / 2, p = [];
    for (let i = 0; i <= 24; i++) { const f = i / 24 * 2 * Math.PI; p.push(at(c[k0] + r * Math.cos(f), c[k1] + r * Math.sin(f))); }
    return {kind: 'ring', len: 2 * Math.PI * r * 10, p, d: r * 20};
  }
  return {kind: 'contour', len: 2 * (d[k0] + d[k1]) * 10,
    p: [at(lo[k0], lo[k1]), at(hi[k0], lo[k1]), at(hi[k0], hi[k1]), at(lo[k0], hi[k1]), at(lo[k0], lo[k1])]};
}

// Угол между деталями по шву: у листов — по их нормалям (самая тонкая сторона рамки)
function seamAngle(a, b) {
  if (a.cyl || b.cyl) return 90;
  const thin = x => { const s = new THREE.Vector3(); x.box.getSize(s); return ['x', 'y', 'z'].reduce((m, k) => s[k] < s[m] ? k : m, 'x'); };
  return thin(a) === thin(b) ? 0 : 90;
}

/* ---------- карты: данные ---------- */
// Детали карт по текущим настройкам — только те, что есть в модели g (cardModel) или в раскрое.
// {units — детали карт по порядку, objs — верхние объекты модели с рамками, steps — шаги сборки}
function cardParts(g) {
  const objs = g.children.map((o, i) => ({...objBoxes(o), i, part: o.userData.part}))
    .filter(x => !x.o.userData.dim && (!S.parts || S.parts.has(PDF_PART[x.part])));
  const cut = cutList().filter(r => !r.grp), lp = laserParts(), steps = asmSteps();
  const units = CARD_UNITS.map(u => {
    const own = objs.filter(x => u.tags.includes(x.part)), tw = objs.filter(x => (u.twin || []).includes(x.part));
    const rows = cut.filter(r => (u.rows || []).some(re => re.test(r.n)));
    const p = u.laser && lp.find(q => q.pt === u.laser);
    if (!own.length && !rows.length && !p) return null;
    // кол. — по раскрою: на 3D соседние штуки слипаются (две решётки сверху встык)
    const insts = [...instances(own), ...instances(tw)], q = p ? p.q : rows[0].q;
    return {...u, own, tw, insts, inst: insts[0] || [], q, rows, p, m: p && partMM(p),
      step: steps.findIndex(s => s.parts.some(t => u.tags.includes(t)))};
  }).filter(Boolean);
  units.forEach((u, i) => { u.no = i + 1; });
  const byId = Object.fromEntries(units.map(u => [u.id, u]));
  units.forEach(u => { u.joins = joinsOf(u, byId); u.kg = unitKg(u); u.notes = unitNotes(u, cut); });
  return {units, objs, steps};
}

// Детали карт без картинок — для проверок: номер, имя, кол., масса, соединения строками
function cardData() {
  return withCardModel(g => cardParts(g).units.map(u => ({
    id: u.id, no: u.no, name: u.name, q: u.q, kg: u.kg, step: u.step,
    tags: [...new Set([...u.own, ...u.tw].map(x => x.part))],
    joins: u.joins.map(j => ({to: j.u.id, kind: j.kind, mine: j.mine, ang: j.ang, seams: j.seams.map(s => ({kind: s.kind, len: Math.round(s.len)}))})),
    rows: u.rows.map(r => r.n), laser: u.p ? u.p.file : null,
  })));
}

// Масса 1 шт, кг: лазерная деталь — по контуру с вычетом отверстий; прокат — по раскрою, на штуку
function unitKg(u) {
  const laser = u.p ? partKg(u.m, u.p.mm) * u.p.q / u.q : 0;
  return laser + u.rows.reduce((s, r) => s + r.kg / u.q, 0);
}

// Указания из раскроя: заметки строк этой детали — своих и тех, что помечены её метками (лазерная строка)
function unitNotes(u, cut) {
  const ids = [u.id, ...u.tags, ...(u.twin || [])];
  const rs = cut.filter(r => u.rows.includes(r) || r.pt.some(t => ids.includes(t)));
  return [...new Set([...rs.map(r => r.note), u.p && u.p.note].filter(Boolean))];
}

// Швы экземпляра inst с деталью v (со всеми её экземплярами) и угол между листами: 90, если хоть один шов под углом
function seamsWith(inst, v) {
  const seams = [];
  let ang = 0;
  inst.forEach(x => [...v.own, ...v.tw].forEach(y => x.ms.forEach(ma => y.ms.forEach(mb => {
    const s = seamOf(ma, mb);
    if (s && s.len >= 5) { seams.push(s); ang = Math.max(ang, seamAngle(ma, mb)); }
  }))));
  return {seams, ang};
}

// Соединения детали: швы — по касанию с соседями (первый экземпляр против всех экземпляров соседа; не касается —
// другой экземпляр, other: «у второй так же»), lay и in — из таблицы.
// {u — сосед, kind, mine — эта деталь кладётся/вставляется (а не на неё), seams, ang, other}
function joinsOf(u, byId) {
  const out = [];
  JOINS.forEach(([a, b, kind]) => {
    if (a !== u.id && b !== u.id) return;
    const v = byId[a === u.id ? b : a];
    if (!v || out.some(j => j.u === v)) return;
    const j = {u: v, kind, mine: a === u.id, seams: [], ang: 90, other: false};
    if (kind === 'weld') {
      let w = seamsWith(u.inst, v);
      if (!w.seams.length) {
        const k = u.insts.findIndex(x => seamsWith(x, v).seams.length);
        if (k > 0) { w = seamsWith(u.insts[k], v); j.other = true; }
      }
      Object.assign(j, w);
    }
    out.push(j);
  });
  return out.sort((p, q) => p.u.no - q.u.no);
}

/* ---------- карты: текст ---------- */
const nameNo = v => `№ ${v.no} ${v.name}`;

// «шов 800 мм», «2 шва по 79 мм по кругу», «швы 196 + 412 мм»
function seamTxt(ss) {
  if (!ss.length) return 'шов — по месту';
  const L = ss.map(s => Math.round(s.len)), one = ss.every(s => s.kind === ss[0].kind);
  const how = one ? {ring: ' по кругу', contour: ' по контуру', edge: ' по кромке', line: ''}[ss[0].kind] : '';
  const same = L.every(v => v === L[0]);
  if (ss.length === 1) return `шов ${L[0]} мм${how}`;
  const n = ss.length, w = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'шва' : 'швов';
  if (same) return `${n} ${w} по ${L[0]} мм${how}`;
  return `швы ${L.join(' + ')} мм`;
}

// Строка «Сварка — к чему»: [что, как выставить]
function joinTxt(j) {
  const v = nameNo(j.u);
  if (j.kind === 'weld') {
    const ring = j.seams.some(s => s.kind === 'ring'), tool = ring ? 'трубу — угольником к листу' : j.ang ? 'угольником, 90°' : 'прижать струбциной';
    return [`${j.other ? 'на другой стороне — ' : ''}к ${v} · ${seamTxt(j.seams)}${j.ang && !ring ? ' · угол 90°' : ''}`, tool];
  }
  if (j.kind === 'lay') return j.mine ? [`кладётся на ${v}`, 'не варить'] : [`сверху кладётся ${v}`, 'не варить'];
  return j.mine ? [`вставляется в ${v}`, 'не варить'] : [`в неё вставляется ${v}`, 'не варить'];
}

/* ---------- карты: лист ---------- */
const SEAM_C = '#d01f1f';

// Рамка вида для набора объектов (см модели → мм модели)
function viewBox(view, only) {
  if (!ok || !group) return null;
  const {meshes} = shotParts(null, only);
  if (!meshes.length) return null;
  const e = shotExtent(VIEWS[view], meshes);
  return {w: (e.hi[0] - e.lo[0]) * 10, h: (e.hi[1] - e.lo[1]) * 10};
}

// Снимок вида, вписанный в поле w × h с центром (cx, cy): {svg, P(точка модели → мм листа)} или null
function fitShot(view, only, w, h, opt = {}) {
  const b = viewBox(view, only);
  if (!b) return null;
  const n = opt.scale || pickScale([b.w, b.h], [w, h]);
  const img = renderView(view, n, {pxPerMm: opt.px || 6, only, hlObj: opt.hl || null, hide: opt.hide || null, edges: cardEdges});
  if (!img) return null;
  const x = opt.cx - img.wMm / 2, y = opt.cy - img.hMm / 2;
  return {n, P: p => { const q = img.toPaper(p); return [x + q[0], y + q[1]]; },
    svg: `<image href="${img.url}" x="${r2(x)}" y="${r2(y)}" width="${r2(img.wMm)}" height="${r2(img.hMm)}" preserveAspectRatio="none"/>`};
}

// Блок «Заготовка — как режут»: развёртка лазерной детали с размерами и таблица заготовок на 1 шт.
function cardBlank(u, y) {
  let s = `<text class="h2" x="23" y="${r2(y + 4)}">Заготовка — как режут</text>`;
  y += 7;
  if (u.p) {
    const m = u.m, n = pickScale([m.w, m.h], [150, 46]), w = m.w / n, h = m.h / n, x = 30 + (165 - w) / 2;
    s += `<text class="sm" x="202" y="${r2(y - 3)}" text-anchor="end">${shEsc(`лист ${u.p.mm} мм · ${scaleTxt(n)} · пунктир — гиб, не резать`)}</text>`
      + partSvg(m, x, y + 6, n);
    y += 6 + h + 4;
    const hl = holesTxt(m);
    if (hl) { s += `<text class="td" x="${r2(x)}" y="${r2(y)}">${shEsc(hl)}</text>`; y += 2; }
    y += 2;
  }
  const rows = [
    ...(u.p ? [[u.p.name, `${mmTxt(u.m.w)} × ${mmTxt(u.m.h)} × ${u.p.mm}`, fmtQ(u.p.q / u.q), kgTxt(partKg(u.m, u.p.mm))]] : []),
    ...u.rows.map(r => [r.n, r.s, fmtQ(r.q / u.q), kgTxt(r.kg / r.q)]),
  ];
  s += svgTable(22, y, [{t: 'Заготовка', w: 98}, {t: 'Размер, мм', w: 45}, {t: 'На 1 шт.', w: 16, r: 1}, {t: 'Масса, кг', w: 22, r: 1}], rows, 5);
  return {s, y: y + 5 * (rows.length + 1)};
}
const fmtQ = v => String(Math.round(v * 100) / 100).replace('.', ',');

// Блок 3D: с 4 сторон, швы и соседи, где на мангале. Без 3D — строка вместо картинок
function cardViews(u, units, objs, y, H) {
  const own = new Set(u.inst.map(x => x.o));
  const hideOthers = new Set(CARD_ONLY_OWN.filter(t => !u.tags.includes(t)));
  const cellH = (H - 9) / 2, views = [['front', 'спереди'], ['left', 'слева'], ['top', 'сверху'], ['iso', 'изометрия']];
  // один масштаб на четыре вида
  const bs = own.size ? views.map(([v]) => viewBox(v, own)) : [];
  if (!bs.length || bs.some(b => !b)) {
    return {s: `<text class="sm" x="23" y="${r2(y + 5)}">${own.size ? 'Виды недоступны без 3D на этом устройстве — размеры, швы и гибка ниже' : 'На 3D-модели этой детали нет — размеры, швы и гибка ниже'}</text>`, y: y + 8};
  }
  const n4 = pickScale([Math.max(...bs.map(b => b.w)), Math.max(...bs.map(b => b.h))], [43, cellH - 4]);
  let s = `<path class="t" d="M20,${r2(y)}H205M112,${r2(y)}V${r2(y + H)}M20,${r2(y + H)}H205"/>`
    + `<text class="h2" x="23" y="${r2(y + 4.5)}">Деталь — с 4 сторон</text><text class="sm" x="109" y="${r2(y + 4.5)}" text-anchor="end">${scaleTxt(n4)}</text>`;
  views.forEach(([v, t], i) => {
    const cx = 20.5 + (i % 2) * 45.75, cy = y + 6.5 + Math.floor(i / 2) * (cellH + .6);
    const sh = fitShot(v, own, 43, cellH - 4, {scale: n4, cx: cx + 22.5, cy: cy + cellH / 2 - 1});
    if (sh) s += sh.svg;
    s += `<text class="lb" x="${r2(cx + 1)}" y="${r2(cy + cellH - 1)}">${t}</text>`;
  });

  // швы и соседи: деталь акцентом, соседи по шву белые, швы красным, «→№» — к какой детали
  const welds = u.joins.filter(j => j.kind === 'weld' && j.seams.length && !j.other), nb = new Set(own);
  welds.forEach(j => [...j.u.own, ...j.u.tw].forEach(x => {
    if (u.inst.some(a => a.ms.some(ma => x.ms.some(mb => seamOf(ma, mb))))) nb.add(x.o);
  }));
  // не варится — на картинке то, на чём лежит или во что вставляется
  const rest = welds.length ? [] : u.joins.filter(j => j.kind !== 'weld' && j.mine);
  rest.forEach(j => [...j.u.own, ...j.u.tw].forEach(x => nb.add(x.o)));
  // высокий блок — «где на мангале» сверху справа, швы под ним во всю колонку; низкий — рядом, швы слева
  const tall = H >= 100, wh0 = tall ? 40 : H - 16;
  const SW = tall ? {w: 88, h: H - wh0 - 18, cx: 158.5, cy: y + wh0 + 8 + (H - wh0 - 16) / 2} : {w: 58, h: H - 18, cx: 143.5, cy: y + 7 + (H - 16) / 2};
  s += `<text class="h2" x="115" y="${r2(y + 4.5)}">${welds.length || !rest.length ? 'Деталь — швы и соседи' : rest.some(j => j.kind === 'lay') ? 'Деталь — на чём лежит' : 'Деталь — куда вставляется'}</text>`;
  const sw = fitShot('iso', nb, SW.w, SW.h, {cx: SW.cx, cy: SW.cy, hl: own});
  if (sw) {
    s += sw.svg;
    const box = [], c0 = sw.P(centerOf(u.inst));
    welds.forEach(j => j.seams.forEach(se => {
      const Q = se.p.map(sw.P);
      s += `<path d="M${Q.map(q => r2(q[0]) + ',' + r2(q[1])).join('L')}" fill="none" stroke="${SEAM_C}" stroke-width=".55"/>`;
      // подпись «→№» — у середины шва, от центра детали наружу; занято — дальше или не пишем
      const m = Q[Math.floor(Q.length / 2)], d = Math.hypot(m[0] - c0[0], m[1] - c0[1]) || 1, tx = '→' + j.u.no;
      for (const r of [3, 5, 7.5]) {
        const p = [m[0] + (m[0] - c0[0]) / d * r, m[1] + (m[1] - c0[1]) / d * r], b = [p[0] - 2, p[1] - 1.3, p[0] + 2, p[1] + 1];
        if (box.some(z => b[0] < z[2] && b[2] > z[0] && b[1] < z[3] && b[3] > z[1])) continue;
        box.push(b);
        s += `<text class="td tg" x="${r2(p[0])}" y="${r2(p[1] + .8)}" text-anchor="middle" style="fill:${SEAM_C}">${tx}</text>`;
        break;
      }
    }));
  }
  s += `<text class="sm" x="115" y="${r2(y + H - 2)}">${welds.length ? 'красное — шов, →№ — к какой детали' : rest.length ? 'деталь — цветом, соседи — белые; не варится' : 'не варится'}</text>`;

  // где на мангале: весь мангал, деталь акцентом
  const all = new Set(objs.filter(x => !hideOthers.has(x.part) && x.part !== 'legTw').map(x => x.o));
  const wh = fitShot('iso', all, 27, wh0 - 6, {cx: 190.5, cy: y + 10 + (wh0 - 4) / 2, hl: own, px: 4});
  s += `<path class="t" style="stroke-width:.1" d="M176,${r2(y + 6)}V${r2(y + (tall ? wh0 + 6 : H - 4))}"/><text class="lb" x="190.5" y="${r2(y + 8.5)}" text-anchor="middle">где на мангале</text>`
    + (wh ? wh.svg : '');
  return {s, y: y + H};
}

// Центр экземпляра (см)
function centerOf(inst) {
  const b = new THREE.Box3();
  inst.forEach(x => b.union(x.box));
  const c = new THREE.Vector3();
  b.getCenter(c);
  return c.toArray();
}

// Блок «Гибка — по порядку»: профиль с номерами гибов слева, строки справа
function cardBends(u, y) {
  const B = u.bends();
  let s = `<text class="h2" x="23" y="${r2(y + 4.3)}">Гибка — по порядку</text><text class="sm" x="202" y="${r2(y + 4.3)}" text-anchor="end">профиль после гибки, мм · гнуть на листогибе</text>`;
  const xs = B.pts.map(p => p[0]), ys = B.pts.map(p => p[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const k = Math.min(60 / (w || 1), 26 / (h || 1)), x0 = 30 - Math.min(...xs) * k, y0 = y + 9 + Math.max(...ys) * k;
  const P = ([a, b]) => [x0 + a * k, y0 - b * k];
  s += `<path class="l" d="M${B.pts.map(p => P(p).map(r2).join(',')).join('L')}"/>`;
  // длины участков и номера гибов кружком
  B.pts.slice(1).forEach((p, i) => {
    const a = P(B.pts[i]), b = P(p), L = Math.round(Math.hypot(p[0] - B.pts[i][0], p[1] - B.pts[i][1]));
    s += `<text class="lb" x="${r2((a[0] + b[0]) / 2 + (a[0] === b[0] ? 1.2 : 0))}" y="${r2((a[1] + b[1]) / 2 + (a[1] === b[1] ? -1 : .8))}"${a[0] === b[0] ? '' : ' text-anchor="middle"'}>${L}</text>`;
  });
  B.pts.slice(1, -1).forEach((p, i) => {
    const [cx, cy] = P(p);
    s += `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="1.6" fill="#fff" stroke="#1f5fd0" stroke-width=".25"/><text class="lb" x="${r2(cx)}" y="${r2(cy + .8)}" text-anchor="middle" style="fill:#1f5fd0">${i + 1}</text>`;
  });
  // строки гибов: номер и угол, что гнуть, длина линии гиба, чем выставить — справа от профиля, с переносом
  let ty = y + 10;
  B.rows.forEach((r, i) => {
    wrapTxt(`${r.txt} · линия гиба ${mmTxt(r.len)} мм · выставить угольником`, 64).forEach((l, k2) => {
      s += `<text class="td" x="${k2 ? 105.5 : 98}" y="${r2(ty)}">${k2 ? '' : `<tspan class="tg" style="fill:#1f5fd0">${i + 1}. ${r.ang}°</tspan> — `}${shEsc(l)}</text>`;
      ty += 3.8;
    });
    ty += .8;
  });
  return {s, y: Math.max(y + 9 + h * k + 5, ty)};
}

// Блок «Сварка — к чему» и сборка: строки соединений, шаг сборки, указания из раскроя. ymax — до штампа.
// {s, y — где кончился}: с ymax = Infinity — сколько места нужно всем строкам
function cardWelds(u, steps, y, ymax) {
  let s = `<path class="t" style="stroke-width:.08" d="M20,${r2(y)}H205"/><text class="h2" x="23" y="${r2(y + 4.5)}">Сварка — к чему варить</text>`;
  y += 9;
  const rows = [...(u.inner ? [[`внутри детали: ${u.inner}`, '']] : []), ...u.joins.map(joinTxt), ...(u.extra ? u.extra().map(t => [t, '']) : [])];
  if (!rows.length) rows.push(['не варится', '']);
  rows.forEach(([a, b]) => {
    if (b) s += `<text class="td" x="202" y="${r2(y)}" text-anchor="end">${shEsc(b)}</text>`;
    wrapTxt(a, b ? 100 : 125).forEach((l, i) => { s += `<text class="td" x="${i ? 28 : 25}" y="${r2(y)}">${shEsc(l)}</text>`; y += 3.6; });
    y += .8;
  });
  if (u.twinTxt) { s += `<text class="td" x="25" y="${r2(y)}">${shEsc(u.twinTxt)}</text>`; y += 4.4; }
  if (u.step >= 0) {
    y += 1.5;
    s += `<text class="h2" x="23" y="${r2(y + 1)}" style="font-size:3.4px">${shEsc(`Сборка: шаг ${u.step + 1} из ${steps.length} — ${steps[u.step].title}`)}</text>`;
    y += 6;
  }
  // указания из раскроя — сколько влезет
  const lines = u.notes.flatMap(t => wrapTxt(t, 118));
  if (lines.length) { s += `<text class="h2" x="23" y="${r2(y)}" style="font-size:3.4px">Указания</text>`; y += 4.4; }
  const fit = Math.max(0, Math.floor((ymax - y) / 3.6));
  lines.slice(0, fit).forEach((l, i) => { s += `<text class="td" x="25" y="${r2(y + i * 3.6)}">${shEsc(l)}</text>`; });
  if (lines.length > fit) s += `<text class="sm" x="202" y="${r2(ymax)}" text-anchor="end">не влезло — см. спецификацию</text>`;
  return {s, y: y + Math.min(fit, lines.length) * 3.6};
}

// Тело карты: шапка, заготовка, 3D, гибка, сварка. Блок 3D забирает всё место, что осталось после остальных
const CARD_Y1 = 273;   // низ поля карты — над штампом
function cardPiece(u, units, objs, steps) {
  // составная деталь (ножка: площадка под лазер + трубы) — габарит по 3D, лазер — только про площадку
  const part = u.p && u.rows.length ? `${u.p.name.replace(/ \(.*\)$/, '').toLowerCase()}: ` : '';
  const head = [
    u.p && !part ? `лист ${u.p.mm} мм` : '',
    `габарит ${u.p && !part ? `${mmTxt(u.m.w)} × ${mmTxt(u.m.h)}` : instSize(u)} мм`,
    `масса ${kgTxt(u.kg)} кг/шт`,
    `кол. ${u.q}`,
    u.p ? `${part}${part ? `лист ${u.p.mm} мм, ` : ''}рез ${fmt(u.m.cut / 1000, 2)} м, врезок ${u.m.pierce}, файл ${dxfName(u.p)}` : '',
  ].filter(Boolean).join(' · ');
  const hl = wrapTxt(head, 120);
  let s = hl.map((l, i) => `<text class="td" x="23" y="${r2(22 + i * 3.8)}">${shEsc(l)}</text>`).join('');
  const A = cardBlank(u, 22 + hl.length * 3.8);
  s += A.s;
  const gH = u.bends ? cardBends(u, 0).y + 1 : 0, wH = cardWelds(u, steps, 0, Infinity).y;
  const H = Math.max(76, Math.min(130, CARD_Y1 - (A.y + 3) - gH - wH - 2));
  const V = cardViews(u, units, objs, A.y + 3, H);
  s += V.s;
  let y = V.y + 1;
  if (u.bends) { const G = cardBends(u, y); s += G.s; y = G.y + 1; }
  s += cardWelds(u, steps, y, CARD_Y1).s;
  return {s, kg: u.kg, n: u.p ? pickScale([u.m.w, u.m.h], [150, 46]) : null};
}

// Габарит экземпляра по 3D, мм: от большего к меньшему; без модели — «—»
function instSize(u) {
  if (!u.inst.length) return '—';
  const b = new THREE.Box3();
  u.inst.forEach(x => b.union(x.box));
  const s = new THREE.Vector3();
  b.getSize(s);
  return s.toArray().map(v => Math.round(v * 10)).sort((a, c) => c - a).join(' × ');
}

// Карты по одной: {N, next(), close()} — next() строит следующую карту {title, id, svg}: svg А4 со штампом
// «Мангал L × W × H, t мм», масса и металл в штампе — этой детали. Карта — 6 снимков 3D, все 15 — заметная работа,
// поэтому вкладка строит их по шагу и между шагами отдаёт страницу. После последней карты модель освобождается сама;
// бросили на середине — close()
function startCards() {
  const d = statsData(), date = shDate(), cm = openCardModel();
  let D, i = 0;
  try { D = cm.run(cardParts); } catch (e) { cm.close(); throw e; }
  const N = D.units.length;
  if (!N) cm.close();
  const next = () => {
    const u = D.units[i], n = ++i;
    try {
      return cm.run(() => {
        const c = cardPiece(u, D.units, D.objs, D.steps);
        const b = {head: `${u.no}. ${u.name}`, title: u.bends ? 'Карта детали со сгибами' : 'Карта детали', name: sheetName(d),
          scale: c.n ? scaleTxt(c.n) : '—', mass: `${kgTxt(c.kg)} кг`, metal: u.p ? `сталь ${u.p.mm} мм` : 'прокат, см. таблицу', body: c.s};
        return {title: u.name, id: u.id, svg: wrapA4(b, {n, N, date})};
      });
    } finally { if (n >= N) cm.close(); }
  };
  return {N, next, close: cm.close};
}

// Все карты разом — для печати и проверок
function buildCards() {
  const it = startCards(), out = [];
  try { while (out.length < it.N) out.push(it.next()); } finally { it.close(); }
  return out;
}
