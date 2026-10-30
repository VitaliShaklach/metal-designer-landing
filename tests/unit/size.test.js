// Длина, ширина, высота: всё, что зависит от размера, пересчитывается по правилам спеки
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine, snapshot: snap} = require('../engine.js');

const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'golden.json'), 'utf8'));
const e = loadEngine();
const snapshot = () => snap(e);
const at = (len, wid, top = 970) => { e.ev(`setSize({len: ${len}, wid: ${wid}, top: ${top}})`); return snapshot(); };
const row = (cut, n) => cut.find(r => r.n === n);

// отрезки контура пересекаются или касаются (кроме соседних) — лазер получит битый контур
function selfCross(loop) {
  const P = loop.slice(0, -1), n = P.length, eps = 1e-6;
  const orient = (a, b, c) => Math.sign(Math.round(((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / eps));
  const onSeg = (a, b, c) => Math.min(a[0], b[0]) - eps <= c[0] && c[0] <= Math.max(a[0], b[0]) + eps &&
    Math.min(a[1], b[1]) - eps <= c[1] && c[1] <= Math.max(a[1], b[1]) + eps;
  const cross = (a, b, c, d) => {
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return (!o1 && onSeg(a, b, c)) || (!o2 && onSeg(a, b, d)) || (!o3 && onSeg(c, d, a)) || (!o4 && onSeg(c, d, b));
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;                                   // последний отрезок соседний с первым
    if (cross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return [P[i], P[j]];
  }
  return null;
}

test('default: 800 × 420 × 970 — цифры как в эталоне', () => {
  assert.deepEqual(at(800, 420, 970), GOLDEN);
});

test('grid: на крайних и промежуточных размерах нет NaN, контуры DXF замкнуты и не перекрещены', () => {
  for (const len of [400, 510, 730, 800, 1090, 1200]) for (const wid of [250, 300, 500]) {
    const s = at(len, wid, 1100), where = `${len} × ${wid}`;
    const json = JSON.stringify(s);
    assert.ok(!/NaN|undefined|null/.test(json), `${where}: NaN/undefined в цифрах`);
    const noise = s.cut.flatMap(r => [r.s, r.note]).filter(t => /\d[.,]\d{3,}/.test(t || ''));
    assert.deepEqual(noise, [], `${where}: хвосты дробей в раскрое`);
    for (const p of s.laser) assert.ok(p.w > 0 && p.h > 0, `${where}: ${p.file} без размера`);
    const loops = e.ev('laserParts().map(p => [p.file, partMM(p).loops])');
    for (const [file, ls] of loops) for (const l of ls) {
      assert.deepEqual(l[0], l[l.length - 1], `${where}: ${file} — контур не замкнут`);
      assert.equal(selfCross(l), null, `${where}: ${file} — контур пересекает сам себя`);
    }
  }
});

test('grid: вырезы боковины не налезают друг на друга ни на какой длине (шаг 10 мм)', () => {
  for (let len = 400; len <= 1200; len += 10) {
    at(len, 420);
    for (const [file, l] of e.ev("laserParts().filter(p => /side/.test(p.file)).map(p => [p.file, partMM(p).loops[0]])"))
      assert.equal(selfCross(l), null, `${len}: ${file} — контур пересекает сам себя`);
  }
});

for (const [len, wid] of [[1000, 500], [400, 250]]) {
  test(`rows: строки раскроя считаются от размера (${len} × ${wid})`, () => {
    const {cut} = at(len, wid);
    assert.equal(row(cut, 'Дно жаровни').s, `${len} × ${wid}`);
    assert.ok(row(cut, 'Боковина жаровни (задняя и передняя)').s.startsWith(`${len} × `));
    assert.equal(row(cut, 'Уголок 30×30×4 — опора колосника').s, `L ${len - 20}`);
    assert.equal(row(cut, 'Уголок 30×30×3 в жаровне').s, `L ${len / 8}`);
    assert.equal(row(cut, 'Решётка сверху').s, `${len / 2} × ${wid - 20}`);
  });
}

test('deep: глубоких прорезей round(длина / 200), шаг 50, последняя в 100 от правого торца, правее уголков', () => {
  for (const [len, n] of [[400, 2], [500, 3], [600, 3], [700, 4], [800, 4], [900, 5], [1000, 5], [1100, 6], [1200, 6]]) {
    at(len, 420);
    const x = e.ev('DEEP_X'), L1 = len / 10;
    assert.equal(x.length, n, `${len}: прорезей`);
    x.forEach((v, i) => i && assert.equal(v - x[i - 1], 5, `${len}: шаг`));
    assert.equal(x[x.length - 1], L1 - 10);
    assert.ok(x[0] - e.ev('DEEP_W') / 2 > e.ev('GA_XS[1] + GA_L'), `${len}: прорези над уголками`);
    const note = row(e.ev('cutList()'), 'Боковина жаровни (задняя и передняя)').note;
    assert.ok(note.includes(x.map(v => (L1 - v) * 10).reverse().join(', ')), `${len}: центры прорезей в тексте`);
  }
});

test('wheels: уже 300 мм — ножки на пятках, от 300 — колёса', () => {
  const narrow = at(800, 290);
  const pts = narrow.cut.flatMap(r => r.pt || []);
  assert.ok(!pts.includes('wheels') && !pts.includes('pads'));
  assert.ok(!narrow.laser.some(p => p.file === 'wheel_pad'));
  assert.equal(row(narrow.cut, 'Пятка ножки без колеса').q, 4);
  assert.ok(!narrow.cut.some(r => r.grp && /колёс|колеса/.test(r.grp)), 'заголовок группы обещает колёса');
  assert.equal(narrow.stats.wheels, false);
  const wide = at(800, 300);
  assert.ok(wide.cut.some(r => (r.pt || []).includes('wheels')));
  assert.ok(wide.laser.some(p => p.file === 'wheel_pad'));
  assert.equal(wide.stats.wheels, true);
});

test('damper: задвижка от крайних отверстий — на любой длине «открыто» открывает, «закрыто» закрывает крайнее', () => {
  for (let len = 400; len <= 1200; len += 10) {
    at(len, 420);
    const h = e.ev('holes()'), x0 = e.ev('AIR_X0'), l = e.ev('AIR_L'), r = e.ev('HOLE') / 2, shut = e.ev('Math.ceil(S.pitch*5)/10');
    const first = h[0], last = h[h.length - 1], end = x0 + l;
    assert.ok(first - r > x0, `${len}: первое отверстие под планкой`);
    assert.ok(last - r >= end - 1e-9, `${len}: при «открыто» крайнее отверстие под планкой`);
    assert.ok(last + r <= end + shut + 1e-9, `${len}: при «закрыто» крайнее отверстие открыто`);
  }
  const plank = n => row(at(n, 420).cut, 'Задвижка поддува (планка)').s;
  assert.equal(plank(800), '780 × 30 × 3');                // как в C:\dev
  assert.equal(plank(1000), '960 × 30 × 3');
});

test('hooks: скобы задвижки между 2-м и 3-м отверстием с каждого края, внутри планки', () => {
  for (const len of [400, 800, 1200]) {
    at(len, 420);
    const [a, b] = e.ev('AIR_HOOK'), x0 = e.ev('AIR_X0'), l = e.ev('AIR_L'), h = e.ev('holes()');
    assert.ok(a > x0 && b < x0 + l, `${len}: скобы на планке`);
    assert.ok(a > h[1] && a < h[2] && b > h[h.length - 3] && b < h[h.length - 2], `${len}: скобы между отверстиями`);
  }
});

test('mass: при ширине 420 масса растёт с длиной', () => {
  const kg = len => at(len, 420).stats.kg;
  assert.ok(kg(400) < kg(800) && kg(800) < kg(1200));
});

test('stale: при 1000 × 500 в раскрое не осталось чисел размера по умолчанию', () => {
  const json = JSON.stringify(at(1000, 500).cut);
  for (const s of ['780', '400 × 400', '× 420', '740', '100, 150, 200, 250 мм', '100–200']) assert.ok(!json.includes(s), s);
});

test('partition: перегородки нет — ни листа в раскрое, ни прорезей и размеров под неё', () => {
  for (const len of [400, 800, 1200]) {
    const {cut, laser} = at(len, 420);
    assert.ok(!cut.some(r => /Перегородка жаровни/.test(r.n || '')));
    assert.ok(!laser.some(p => p.file === 'grill_divider'));
    assert.ok(!/перегородк/i.test(JSON.stringify(cut)), `${len}: в раскрое упоминается перегородка`);
    // ручка правого колосника — посередине своей половины, как левая: перегородки, от которой её отодвигали, нет
    const [hx, mid] = e.ev('[cgHX()[1], Math.round((cgX()[1] + CG_L / 2) * 10) / 10]');
    assert.equal(hx, mid, `${len}: ручка правого колосника`);
  }
});

test('top: высота меняет верх, длины ножек и массу', () => {
  const lo = at(800, 420, 800), hi = at(800, 420, 1100);
  assert.equal(lo.stats.top, 800);
  assert.equal(hi.stats.top, 1100);
  assert.ok(lo.stats.kg < hi.stats.kg);
});

test('unit: сантиметры с хобби-сайта не влияют — везде мм', () => {
  const cm = loadEngine({storage: {'md-unit': 'cm'}});
  assert.equal(cm.ev('u(80)'), '800');
  assert.deepEqual(cm.ev('cutList()'), GOLDEN.cut);
});

test('back: после крайних размеров 800 × 420 × 970 снова даёт эталон', () => {
  at(400, 250, 800); at(1200, 500, 1100);
  assert.deepEqual(at(800, 420, 970), GOLDEN);
});
