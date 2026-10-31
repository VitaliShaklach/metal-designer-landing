// Листы А3 мангала в Node: без WebGL видов нет, а спецификация, детали, раскрой, штамп и формат — есть
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine, snapshot} = require('../engine.js');

const e = loadEngine({extra: ['views', 'sheet-kit', 'sheets', 'nest']});
const at = (o = {}) => e.ev(`setSize(${JSON.stringify({len: 800, wid: 420, top: 970, t: 4, deep: 1, ...o})})`);
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'golden.json'), 'utf8'));

test('golden: листы не меняют цифры по умолчанию', () => {
  at();
  e.ev('buildSheets()');
  assert.deepEqual(snapshot(e), golden);
});

test('noWebGL: видов нет, на общем виде надпись', () => {
  at();
  assert.equal(e.ev("renderView('front', 10)"), null);
  assert.equal(e.ev("modelBoxMm('front')"), null);
  assert.ok(e.ev('buildSheets()[0].svg').includes('Общий вид недоступен без 3D на этом устройстве'));
});

test('count: по листу спецификации на каждые 32 строки', () => {
  for (const [len, wid, t] of [[800, 420, 4], [1000, 500, 6], [400, 250, 2]]) {
    at({len, wid, t});
    const rows = e.ev('cutList().length'), sh = e.ev('buildSheets()');
    assert.equal(sh.filter(s => s.title === 'Спецификация').length, Math.ceil(rows / 32), `${len} × ${wid}: листов`);
  }
});

test('count: 33 строки — два листа спецификации, итог и металл на последнем', () => {
  at();
  // строк раскроя по умолчанию 23 — дописываем копии, чтобы перешагнуть 32
  const sh = e.ev(`(() => { const f = cutList; cutList = () => { const r = f(); return r.concat(r.slice(1, 11)); };
    try { return buildSheets(); } finally { cutList = f; } })()`);
  const spec = sh.filter(s => s.title === 'Спецификация');
  assert.equal(spec.length, 2);
  assert.ok(!spec[0].svg.includes('Итого металла'));
  assert.ok(spec[1].svg.includes('Итого металла'));
  assert.ok(spec[1].svg.includes('Труба Ø40×3'));
});

test('a3: каждый лист — 420 × 297 мм', () => {
  at();
  for (const s of e.ev('buildSheets()')) {
    assert.ok(s.svg.includes('viewBox="0 0 420 297"'), s.title);
    assert.ok(s.svg.includes('width="420mm" height="297mm"'), s.title);
  }
});

test('spec: все строки раскроя, итог и металл', () => {
  for (const [len, wid] of [[800, 420], [1000, 500]]) {
    at({len, wid});
    const spec = e.ev('buildSheets().filter(s => s.title === "Спецификация").map(s => s.svg).join("")');
    for (const n of e.ev('cutList().filter(r => !r.grp).map(r => shEsc(r.n).slice(0, 15))')) {
      assert.ok(spec.includes(n), `${len} × ${wid}: нет «${n}»`);
    }
    for (const g of e.ev('cutList().filter(r => r.grp).map(r => shEsc(r.grp).slice(0, 15))')) {
      assert.ok(spec.includes(g), `${len} × ${wid}: нет группы «${g}»`);
    }
    assert.ok(spec.includes(`Итого металла ≈ ${e.ev('statsData().kg')} кг`));
    for (const n of e.ev('metalRows().map(([n]) => shEsc(n))')) assert.ok(spec.includes(n), `нет металла «${n}»`);
  }
});

test('stamp: изделие, размеры и толщина из настроек, номер листа', () => {
  at();
  const sh = e.ev('buildSheets()');
  assert.ok(sh[0].svg.includes('Мангал 800 × 420 × 970, 4 мм'));
  assert.ok(sh[0].svg.includes('Metal Designer для цеха'));
  at({len: 1000, wid: 500, top: 900, t: 6});
  assert.ok(e.ev('buildSheets()[1].svg').includes('Мангал 1000 × 500 × 900, 6 мм'));
});

test('tech: техтребования — лист, масса, размеры для справок', () => {
  at({t: 5});
  const s = e.ev('buildSheets()[0].svg');
  assert.ok(s.includes('Технические требования'));
  assert.ok(s.includes('Лист 5 мм'));
  assert.ok(s.includes(`Масса металла ≈ ${e.ev('statsData().kg')} кг`));
  assert.ok(s.includes('*Размеры для справок'));
});

// Порядок сборки из спеки; шаги 4 и 5 объединены: площадка под ножку, патрубок и труба ножки — одна деталь 'legs'
const STEPS = [
  'Дно и боковины',
  'Торцы',
  'Уголки в жаровне и опоры колосника',
  'Площадки и патрубки ножек — к дну; ножки, площадки колёс, колёса',
  'Скобы и задвижки поддува',
  'Ручка',
  'Колосник и решётки — кладутся',
];

test('order: шаги сборки — в порядке спеки', () => {
  at();
  assert.deepEqual(e.ev('asmSteps().map(s => s.title)'), STEPS);
});

// Без 3D детали модели берутся из раскроя: там и решётки, которых на 3D по умолчанию нет. Колёса — только от 300 мм
test('cover: без 3D каждая деталь раскроя — ровно в одном шаге, на узком мангале тоже', () => {
  const legs = {420: ['legs', 'pads', 'wheels'], 280: ['legs', 'feet']};
  for (const wid of [420, 280]) {
    at({wid});
    assert.deepEqual(e.ev('asmSteps().map(s => s.parts)'), [
      ['gBot', 'side0', 'side1'],
      ['gEnd', 'gEnd0'],
      ['gAng', 'cgrAngB', 'cgrAngF'],
      legs[wid],
      ['hook', 'air'],
      ['handle'],
      ['cgr1', 'cgr2', 'g2', 'gGrate'],
    ], `ширина ${wid}`);
    // и ни одной детали модели вне шагов
    assert.deepEqual(e.ev('[...modelParts()].sort()'), e.ev('asmSteps().flatMap(s => s.parts).sort()'), `ширина ${wid}: детали вне шагов`);
  }
});

// 7 шагов по 4 на лист — 2 листа сборки
test('sheetsOrder: общий вид → сборка → детали → спецификация → раскрой', () => {
  for (const wid of [420, 280]) {
    at({wid});
    const t = e.ev('buildSheets().map(s => s.title)');
    assert.deepEqual(t.filter((x, i) => x !== t[i - 1]), ['Общий вид', 'Порядок сборки', 'Детали', 'Спецификация', 'Раскрой'], `ширина ${wid}`);
    assert.equal(t.filter(x => x === 'Порядок сборки').length, 2, `ширина ${wid}: листов сборки`);
  }
});

test('details: в листах «Детали» каждая деталь под лазер с габаритом', () => {
  const mm = v => String(Math.round(v * 10) / 10).replace('.', ',');
  for (const [len, wid] of [[800, 420], [1000, 500], [400, 280]]) {
    at({len, wid});
    const det = e.ev('buildSheets().filter(s => s.title === "Детали").map(s => s.svg).join("")');
    assert.ok(det.includes('Дно жаровни') && det.includes(`Габарит ${len} × ${wid} мм`), `${len} × ${wid}: дно`);
    for (const p of e.ev('laserList()')) {
      assert.ok(det.includes(`. ${p.name}<`), `${len} × ${wid}: нет «${p.name}»`);
      assert.ok(det.includes(`Лист ${p.mm} мм, ${p.q} шт. Габарит ${mm(p.w)} × ${mm(p.h)} мм`), `${len} × ${wid}: габарит «${p.name}»`);
    }
  }
  at();
  assert.ok(e.ev('buildSheets().filter(s => s.title === "Детали").map(s => s.svg).join("")').includes('17 отв. Ø 15'), 'отверстия боковины');
});

// Раскрой: лист А3 на каждый лист металла 1250 × 2500, все детали одной толщины (решение 31.10) — один лист
test('nest: лист «Раскрой» последним, подпись — толщина, лист, номер, заполнение', () => {
  for (const t of [3, 5]) {
    at({t});
    const sh = e.ev('buildSheets()'), nest = sh.filter(s => s.title === 'Раскрой');
    assert.equal(nest.length, 1, `${t} мм: листов раскроя`);
    assert.equal(sh[sh.length - 1].title, 'Раскрой', `${t} мм: раскрой не последний`);
    assert.match(nest[0].svg, new RegExp(`Лист ${t} мм, 1250 × 2500, № 1 из 1`), `${t} мм: подпись`);
    assert.match(nest[0].svg, /заполнение \d+ %/, `${t} мм: заполнение`);
  }
});

// На раскрое — каждый экземпляр детали с номером позиции, в таблице «На листе» — каждая деталь;
// выбранная на 3D деталь чертежи не урезает: лист — на всё изделие
test('nestParts: все экземпляры с номерами, выбор на 3D не мешает', () => {
  for (const [len, wid, sel] of [[800, 420, null], [1200, 500, null], [800, 420, 'gBot']]) {
    at({len, wid});
    if (sel) e.ev(`S.sel = {el: 'grill', part: '${sel}'}`);
    const svg = e.ev('buildSheets().filter(s => s.title === "Раскрой").map(s => s.svg).join("")');
    e.ev(`S.sel = {el: null, part: null}`);
    const ps = e.ev('laserParts().map(p => ({...p, esc: shEsc(p.name)}))'), where = `${len} × ${wid}${sel ? ', выбрано дно' : ''}`;
    assert.equal((svg.match(/<text class="tg"/g) || []).length, ps.reduce((a, p) => a + p.q, 0), `${where}: номеров на листе`);
    for (const p of ps) assert.ok(svg.includes(`>${p.esc.slice(0, 40)}`), `${where}: нет «${p.name}» в таблице`);
  }
});
