// Цифры лендинга: копия движка в md/ при 5 мм считает так же, как C:\dev, кроме двух решений Виталия 31.10 —
// нет перегородки жаровни (ни листа, ни прорезей под неё) и все листовые детали одной толщины.
// Эталон tests/golden.json — снимок md/ при настройках лендинга по умолчанию (4 мм), пишется после сверки
// с C:\dev (только чтение): UPDATE_GOLDEN=1 npm test
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine, snapshot} = require('../engine.js');

const DEV = 'C:/dev/metal-designer/mangal/js';
const GOLDEN = path.join(__dirname, '..', 'golden.json');

// только числа: тексты пояснений на лендинге свои (без перегородки, прорези от длины)
const nums = ({cut, laser, stats}) => ({
  cut: cut.map(r => r.grp ? {grp: r.grp} : {n: r.n, s: r.s, q: r.q, kg: r.kg, pt: r.pt}),
  laser, stats,
});

// Сверка с C:\dev — при 5 мм, как там. Отличия лендинга:
// - перегородки жаровни нет (решение 31.10, задача 2);
// - все листовые детали одной толщины (решение 31.10): задвижки и площадки под колёса — 5 мм, а не 3 и 6;
//   отсюда площадка колеса тоньше — ножка с колесом на 1 мм длиннее, а скоба задвижки шире под планку 5 мм
const SAME_T = r => /^(Задвижка поддува|Площадка под колесо|Скоба задвижки|Ножка .* с колесом)/.test(r.n || '');
const SAME_T_LASER = ['grill_air_slider', 'wheel_pad'];

test('golden: при 5 мм копия в md/ считает как C:\\dev — без перегородки, все детали одной толщины', {skip: !fs.existsSync(DEV) && 'нет C:\\dev на этой машине'}, () => {
  const e5 = loadEngine();
  e5.ev('setSize({len: 800, wid: 420, top: 970, t: 5, deep: 1})');
  const dev = nums(snapshot(loadEngine({dir: DEV}))), md = nums(snapshot(e5));
  const div = dev.cut.find(r => r.n === 'Перегородка жаровни');
  assert.ok(div, 'в C:\\dev перегородка в раскрое есть');
  // лист перегородки уходит из раскроя
  assert.deepEqual(md.cut.filter(r => !SAME_T(r)), dev.cut.filter(r => r !== div && !SAME_T(r)));
  // задвижки и площадки колёс — из того же листа 5 мм; строки те же, другие толщина, масса, длина ножки, ширина скобы
  assert.deepEqual(md.cut.filter(SAME_T).map(r => r.n), dev.cut.filter(SAME_T).map(r => r.n));
  const row = (s, n) => s.cut.find(r => r.n === n);
  assert.equal(row(dev, 'Площадка под колесо (низ ножки)').s, '150 × 150 × 6');
  assert.equal(row(md, 'Площадка под колесо (низ ножки)').s, '150 × 150 × 5');
  assert.match(row(dev, 'Задвижка поддува (планка)').s, / × 3$/);
  assert.match(row(md, 'Задвижка поддува (планка)').s, / × 5$/);
  // прорези под перегородку уходят из боковин: рез короче; задвижки и площадки колёс — 5 мм; остальные детали — как в C:\dev
  const side = p => /^grill_side/.test(p.file), sameT = p => SAME_T_LASER.includes(p.file);
  assert.deepEqual(md.laser.filter(p => !side(p) && !sameT(p)), dev.laser.filter(p => !side(p) && !sameT(p)));
  md.laser.filter(sameT).forEach((p, i) => {
    assert.equal(p.mm, 5, p.file);
    assert.deepEqual({...p, mm: 0}, {...dev.laser.filter(sameT)[i], mm: 0});
  });
  md.laser.filter(side).forEach((p, i) => {
    const d = dev.laser.filter(side)[i];
    assert.deepEqual({...p, cutMm: 0}, {...d, cutMm: 0});
    assert.ok(p.cutMm < d.cutMm, `${p.file}: рез без прорезей под перегородку короче`);
  });
  const {kg, cutM, ...rest} = md.stats, {kg: _k, cutM: _c, ...restDev} = dev.stats;
  assert.deepEqual(rest, restDev);
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, JSON.stringify(snapshot(loadEngine()), null, 1) + '\n');
});

test('golden: цифры не разошлись с эталоном', () => {
  assert.deepEqual(snapshot(loadEngine()), JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
});

test('shape: детали под лазер и панель цифр по умолчанию', () => {
  const {cut, laser, stats} = snapshot(loadEngine());
  assert.deepEqual(laser.map(p => [p.file, p.q]), [
    ['grill_side_back', 1], ['grill_side_front', 1], ['grill_bottom', 1], ['grill_end_right', 1],
    ['grill_end_left', 1], ['grill_air_slider', 2], ['leg_mount_plate', 4], ['wheel_pad', 4],
  ]);
  const {len, wid, top, t, kg, parts, cutM, holes, slots, wheels} = stats;
  assert.deepEqual({len, wid, top, t, kg, parts, cutM, holes, slots, wheels},
    {len: 800, wid: 420, top: 970, t: 4, kg: 53, parts: 15, cutM: 21, holes: 34, slots: 52, wheels: true});
  assert.ok(cut.some(r => r.n === 'Дно жаровни' && r.s === '800 × 420'));
});

test('shape: без крыши и печи', () => {
  const {cut} = snapshot(loadEngine());
  const roof = ['tubes', 'bars', 'bolts', 'wsh1', 'wsh2', 'nuts', 'sheet'];
  const stove = ['sK0', 'sK1', 'wall', 'sBot', 'tie', 'plate', 'chim', 'fb', 'door', 'grate'];
  const pts = cut.flatMap(r => r.pt || []);
  assert.deepEqual(pts.filter(p => roof.includes(p) || stove.includes(p)), []);
  assert.ok(!JSON.stringify(cut).includes('Трубка Ø26×3'));
  assert.ok(!cut.some(r => r.grp && /Крыша|Печь/.test(r.grp)));
});
