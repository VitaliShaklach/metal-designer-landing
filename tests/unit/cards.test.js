// Карты деталей А4 в Node (без WebGL): карта на каждую деталь, которую делает цех, — как режут, где стоит,
// к чему варить и какой длины шов, как гнуть. Швы — по 3D-модели для карт, она строится и без WebGL
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadEngine} = require('../engine.js');

const e = loadEngine({extra: ['views', 'sheet-kit', 'sheets', 'nest', 'cards']});
const at = (o = {}) => e.ev(`setSize(${JSON.stringify({len: 800, wid: 420, top: 970, t: 4, deep: 1, ...o})})`);
const card = id => e.ev(`buildCards().find(c => c.id === '${id}').svg`);
const data = id => e.ev('cardData()').find(u => u.id === id);
const seams = (u, to) => u.joins.find(j => j.to === to).seams;

// по порядку сборки; без колёс (узкий мангал) — пятки вместо площадок под колёса
const IDS = ['gBot', 'side0', 'side1', 'gEnd', 'gEnd0', 'gAng', 'cgrAng', 'legs', 'pads', 'hook', 'air', 'handle', 'cgr', 'gGrate', 'g2'];

test('count: карта на каждую деталь цеха, по порядку сборки; покупных нет', () => {
  at();
  assert.deepEqual(e.ev('buildCards().map(c => c.id)'), IDS);
  at({wid: 280});
  assert.deepEqual(e.ev('buildCards().map(c => c.id)'), IDS.map(id => id === 'pads' ? 'feet' : id));
  // номера карт — по шагам сборки
  const st = e.ev('cardData()').map(u => u.step);
  assert.ok(st.every((s, i) => s >= 0 && (!i || s >= st[i - 1])), st.join(','));
});

test('cover: каждая деталь модели — ровно на одной карте, на узком мангале тоже', () => {
  for (const wid of [420, 280]) {
    at({wid});
    const tags = e.ev('cardData()').flatMap(u => u.tags);
    assert.equal(new Set(tags).size, tags.length, `ширина ${wid}: деталь на двух картах`);
    // в модели для карт: всё, кроме пометки «ножка откручивается» и покупных колёс
    const model = e.ev(`withCardModel(g => [...new Set(g.children.filter(o => !o.userData.dim && S.parts.has(PDF_PART[o.userData.part]))
      .map(o => o.userData.part))])`).filter(p => !['legTw', 'wheels'].includes(p));
    assert.deepEqual([...tags].sort(), model.sort(), `ширина ${wid}`);
  }
});

test('cut: каждая строка раскроя с массой — на какой-то карте, прокат — ровно на одной', () => {
  at();
  const units = e.ev('cardData()'), cut = e.ev('cutList()').filter(r => !r.grp && r.kg > 0);
  const rows = units.flatMap(u => u.rows);
  assert.equal(new Set(rows).size, rows.length, 'строка проката на двух картах');
  for (const r of cut) {
    const onLaser = units.some(u => u.laser && r.pt.some(p => u.tags.includes(p)));
    assert.ok(rows.includes(r.n) || onLaser, r.n);
  }
});

test('a4: каждая карта — 210 × 297 мм, со штампом мангала', () => {
  at();
  for (const c of e.ev('buildCards()')) {
    assert.ok(c.svg.includes('viewBox="0 0 210 297"'), c.title);
    assert.ok(c.svg.includes('width="210mm" height="297mm"'), c.title);
    assert.ok(c.svg.includes('Мангал 800 × 420 × 970, 4 мм'), c.title);
  }
});

test('bottom: карта дна — габарит, файл, лист, рез и масса 800 × 420 × 4 мм × 7,85 = 10,55 кг', () => {
  at();
  const s = card('gBot');
  assert.ok(s.includes('1. Дно жаровни'));
  assert.ok(s.includes('800 × 420'));
  assert.ok(s.includes('grill_bottom_4mm_x1.dxf'));
  assert.ok(s.includes('лист 4 мм'));
  assert.ok(s.includes('10,55'));
  assert.ok(s.includes('рез 2,44 м'));   // периметр 2 × (800 + 420)
});

test('thick: при 3 мм карта дна — 3 мм и 7,91 кг', () => {
  at({t: 3});
  const s = card('gBot');
  assert.ok(s.includes('grill_bottom_3mm_x1.dxf'));
  assert.ok(s.includes('лист 3 мм'));
  assert.ok(s.includes('7,91'));
});

// Боковина 800 × 196 × 4 мм сплошным листом — 4,92 кг; минус 17 отверстий Ø 15 — 4,83 кг.
// Вырезы по краю (ручка решётки, глубокие прорези) — в самом контуре, они тоже вычитаются
test('side: масса боковины — за вычетом отверстий и прорезей', () => {
  const kg = deep => { at({deep}); return data('side0').kg; };
  const k1 = kg(1), k0 = kg(0);
  assert.ok(k0 < 4.83, `без глубоких прорезей ${k0}`);
  assert.ok(k1 < k0, `глубокие прорези легче: ${k1} < ${k0}`);
  assert.ok(k1 > 4.4, `не меньше разумного: ${k1}`);
  at();
  const s = card('side0');
  assert.ok(s.includes('17 отв. Ø 15'));
  assert.ok(s.includes(k1.toFixed(2).replace('.', ',') + ' кг'));
});

test('welds: дно варится к боковинам по длине, к торцам по ширине, к площадкам ножек по контуру', () => {
  at();
  const u = data('gBot');
  assert.deepEqual(seams(u, 'side0'), [{kind: 'line', len: 800}]);
  assert.deepEqual(seams(u, 'side1'), [{kind: 'line', len: 800}]);
  assert.deepEqual(seams(u, 'gEnd'), [{kind: 'line', len: 412}]);   // 420 − 2 × 4: торец между боковинами
  assert.deepEqual(seams(u, 'gEnd0'), [{kind: 'line', len: 412}]);
  assert.deepEqual(seams(u, 'legs'), Array(4).fill({kind: 'contour', len: 320}));   // площадка 80 × 80
  const s = card('gBot');
  assert.ok(s.includes('к № 2 Боковина жаровни задняя · шов 800 мм · угол 90°'));
  assert.ok(s.includes('к № 8 Ножка · 4 шва по 320 мм по контуру'));
  // труба ножки к площадке колеса — по кругу Ø 40
  assert.deepEqual(seams(data('legs'), 'pads'), [{kind: 'ring', len: 126}]);
});

test('stale: швы пересчитываются с размерами, старых длин на картах нет', () => {
  at({len: 1000, wid: 500});
  assert.deepEqual(seams(data('gBot'), 'side0'), [{kind: 'line', len: 1000}]);
  assert.deepEqual(seams(data('side0'), 'gEnd'), [{kind: 'line', len: 196}]);
  const s = card('gBot');
  assert.ok(s.includes('1000 × 500'));
  assert.ok(s.includes('шов 1000 мм') && s.includes('шов 492 мм'));
  assert.ok(!s.includes('шов 800 мм') && !s.includes('шов 412 мм'));
});

test('mirror: опора колосника — к задней боковине, зеркальная — к передней', () => {
  at();
  const u = data('cgrAng');
  assert.equal(u.q, 2);
  assert.deepEqual(seams(u, 'side0').map(s => s.len), [780, 780]);
  assert.deepEqual(seams(u, 'side1').map(s => s.len), [780, 780]);
  const s = card('cgrAng');
  assert.ok(s.includes('на другой стороне — к № 3 Боковина жаровни передняя'));
  assert.ok(s.includes('Передняя опора — зеркально'));
});

test('lay: колосник и решётки не варятся — кладутся', () => {
  at();
  for (const id of ['cgr', 'gGrate', 'g2']) {
    const u = data(id);
    assert.ok(u.joins.length && u.joins.every(j => j.kind === 'lay' && j.mine), id);
    const s = card(id);
    assert.ok(s.includes('кладётся на № ') && s.includes('не варить'), id);
    assert.ok(!/· шов \d/.test(s), id);
  }
  // а опора о колоснике знает
  assert.ok(card('cgrAng').includes('сверху кладётся № 13 Колосник'));
});

test('bends: гибка — у задвижки и скобы по 2 гиба 90°, у остальных нет', () => {
  at();
  for (const c of e.ev('buildCards()')) {
    const g = c.svg.includes('Гибка — по порядку');
    assert.equal(g, ['air', 'hook'].includes(c.id), c.title);
    if (g) assert.ok(c.svg.includes('1. 90°') && c.svg.includes('2. 90°') && !c.svg.includes('3. 90°'), c.title);
  }
  const h = card('hook');
  assert.ok(h.includes('лапка 7 мм') && h.includes('загиб 22 мм') && h.includes('полка между гибами 9 мм'));
  assert.ok(card('air').includes('отгиб 20 мм'));
});

test('noWebGL: без 3D вместо видов надпись, а заготовка, швы и сборка на месте', () => {
  at();
  const s = card('side0');
  assert.ok(s.includes('Виды недоступны без 3D'));
  assert.ok(s.includes('Заготовка — как режут') && s.includes('Сварка — к чему варить'));
  assert.ok(s.includes('Сборка: шаг 1 из 7 — Дно и боковины'));
});
