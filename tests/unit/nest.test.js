// Раскрой на лист: все детали мангала одной толщины (решение 31.10) — на одном листе, компактно, без наложений; DXF листа — R12
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadEngine} = require('../engine.js');

const e = loadEngine({extra: ['nest']});
const at = (o = {}) => e.ev(`setSize(${JSON.stringify({len: 800, wid: 420, top: 970, t: 4, deep: 1, ...o})})`);
const sheets = (sz = 1) => e.ev(`laserSheets(${sz})`);
// сколько экземпляров деталей каждой толщины
const want = () => e.ev('laserParts()').reduce((a, p) => ({...a, [p.mm]: (a[p.mm] || 0) + p.q}), {});

// проверки раскладки, общие для всех размеров мангала и листа
function check(ss, where) {
  const got = {};
  for (const s of ss) {
    got[s.mm] = (got[s.mm] || 0) + s.items.length;
    for (const it of s.items) {
      assert.equal(it.p.mm, s.mm, `${where}: ${it.p.file} на листе ${s.mm} мм`);
      assert.deepEqual([it.w, it.h], it.rot ? [it.m.h, it.m.w] : [it.m.w, it.m.h], `${where}: рамка ${it.p.file}`);
      assert.ok(it.x >= 10 - 1e-6 && it.y >= 10 - 1e-6 && it.x + it.w <= s.L - 10 + 1e-6 && it.y + it.h <= s.W - 10 + 1e-6,
        `${where}: ${it.p.file} вылезает за край листа`);
    }
    s.items.forEach((a, i) => s.items.slice(i + 1).forEach(b => {
      const apart = a.x + a.w + 5 <= b.x + 1e-6 || b.x + b.w + 5 <= a.x + 1e-6 || a.y + a.h + 5 <= b.y + 1e-6 || b.y + b.h + 5 <= a.y + 1e-6;
      assert.ok(apart, `${where}: ${a.p.file} и ${b.p.file} ближе 5 мм`);
    }));
    assert.ok(s.fill > 0 && s.fill <= 1, `${where}: заполнение ${s.fill}`);
  }
  assert.deepEqual(got, want(), `${where}: разложены не все детали`);
}

test('default: 800 × 420 × 4 — все 15 деталей на одном листе 4 мм 1250 × 2500, в полосе короче половины', () => {
  at();
  const ss = sheets();
  check(ss, 'default');
  assert.equal(ss.length, 1);
  assert.deepEqual([ss[0].mm, ss[0].L, ss[0].W, ss[0].items.length], [4, 2500, 1250, 15]);
  assert.ok(ss[0].len < 1250, `полоса ${ss[0].len} мм`);
});

test('one: при любой толщине и любом листе — один лист этой толщины', () => {
  for (const t of [2, 3, 4, 5, 6]) for (let sz = 0; sz < 4; sz++) {
    at({t});
    assert.deepEqual(sheets(sz).map(s => s.mm), [t], `${t} мм, лист ${sz}`);
  }
});

test('grid: крайние размеры мангала на всех листах — всё влезает, не пересекается', () => {
  for (const [len, wid] of [[400, 250], [1200, 500]]) for (let sz = 0; sz < 4; sz++) {
    at({len, wid});
    check(sheets(sz), `${len} × ${wid}, лист ${sz}`);
  }
});

test('sel: выбрано дно — на листе только дно', () => {
  at();
  e.ev(`S.sel = {el: 'grill', part: 'gBot'}`);
  const ss = sheets();
  e.ev(`S.sel = {el: null, part: null}`);
  assert.deepEqual(ss.flatMap(s => s.items.map(it => it.p.file)), ['grill_bottom']);
});

test('dxf: лист — R12, рамка SHEET, контуры CUT, номера MARK, конец EOF', () => {
  at();
  for (const s of sheets()) {
    const text = e.ev(`sheetDxf(laserSheets(1).find(s => s.mm === ${s.mm}))`);
    assert.ok(text.includes('AC1009'));
    for (const lay of ['SHEET', 'CUT', 'MARK']) assert.match(text, new RegExp(`\\r\\n8\\r\\n${lay}\\r\\n`), `${s.mm} мм: нет слоя ${lay}`);
    assert.ok(text.endsWith('EOF\r\n'));
    assert.ok(!/NaN|undefined/.test(text), `${s.mm} мм: NaN в DXF`);
  }
});
