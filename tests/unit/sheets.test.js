// Листы А3 «Общий вид» и «Спецификация» в Node: без WebGL видов нет, а спецификация, штамп и формат — есть
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine, snapshot} = require('../engine.js');

const e = loadEngine({extra: ['views', 'sheet-kit', 'sheets']});
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

test('count: общий вид и по листу спецификации на каждые 32 строки', () => {
  for (const [len, wid, t] of [[800, 420, 4], [1000, 500, 6], [400, 250, 2]]) {
    at({len, wid, t});
    const rows = e.ev('cutList().length'), sh = e.ev('buildSheets()');
    assert.equal(sh.length, 1 + Math.ceil(rows / 32), `${len} × ${wid}: листов`);
    assert.deepEqual(sh.map(s => s.title), ['Общий вид', ...Array(sh.length - 1).fill('Спецификация')]);
  }
});

test('count: 33 строки — два листа спецификации, итог и металл на последнем', () => {
  at();
  // строк раскроя по умолчанию 23 — дописываем копии, чтобы перешагнуть 32
  const sh = e.ev(`(() => { const f = cutList; cutList = () => { const r = f(); return r.concat(r.slice(1, 11)); };
    try { return buildSheets(); } finally { cutList = f; } })()`);
  assert.equal(sh.length, 3);
  assert.ok(!sh[1].svg.includes('Итого металла'));
  assert.ok(sh[2].svg.includes('Итого металла'));
  assert.ok(sh[2].svg.includes('Труба Ø40×3'));
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
    const spec = e.ev('buildSheets().slice(1).map(s => s.svg).join("")');
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
