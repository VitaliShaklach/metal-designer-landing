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
function check(ss, where, gap = 5) {
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
      const apart = a.x + a.w + gap <= b.x + 1e-6 || b.x + b.w + gap <= a.x + 1e-6 || a.y + a.h + gap <= b.y + 1e-6 || b.y + b.h + gap <= a.y + 1e-6;
      assert.ok(apart, `${where}: ${a.p.file} и ${b.p.file} ближе ${gap} мм`);
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

// Зазор между деталями — настройка вкладки «Лазер · DXF»: по умолчанию 5, от 3 до 20 мм, шаг 0,5
test('gap: по умолчанию 5 мм; 3, 10 и 20 мм держатся на всех листах и крайних размерах; DXF пишет зазор в подпись', () => {
  assert.equal(e.ev('NEST_GAP'), 5);
  for (const gap of [3, 10, 20]) {
    assert.equal(e.ev(`setNestGap(${gap})`), gap);
    for (const [len, wid] of [[400, 250], [800, 420], [1200, 500]]) for (let sz = 0; sz < 4; sz++) {
      at({len, wid});
      check(sheets(sz), `зазор ${gap}, ${len} × ${wid}, лист ${sz}`, gap);
    }
    at();
    assert.match(e.ev('sheetDxf(laserSheets(1)[0])'), new RegExp(`GAP ${gap} MM`));
  }
  e.ev('setNestGap(5)');
});

test('gapClamp: меньше 3 — 3, больше 20 — 20, шаг 0,5, не число — 5', () => {
  for (const [v, want] of [[0, 3], [1, 3], [2.9, 3], [3.2, 3], [3.3, 3.5], [7.5, 7.5], [25, 20], ['abc', 5], [NaN, 5]])
    assert.equal(e.ev(`setNestGap(${Number.isNaN(v) ? 'NaN' : JSON.stringify(v)})`), want, `ввели ${v}`);
  e.ev('setNestGap(5)');
});

test('gapWide: зазор шире — полоса на листе не короче', () => {
  at({len: 1200, wid: 500});
  const len = gap => { e.ev(`setNestGap(${gap})`); return Math.max(...sheets().map(s => s.len)); };
  const a = len(3), b = len(20);
  e.ev('setNestGap(5)');
  assert.ok(b >= a, `3 мм — ${a}, 20 мм — ${b}`);
});
