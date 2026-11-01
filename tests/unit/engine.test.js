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

// только числа: тексты пояснений на лендинге свои (без перегородки, прорези от длины).
// Масса — до 10 г: формулы те же, но порядок умножения другой, и последний знак может разойтись
// (площадка колеса: 3,53249… у md/ и 3,5325 у C:\dev)
const nums = ({cut, laser, stats}) => ({
  cut: cut.map(r => r.grp ? {grp: r.grp} : {n: r.n, s: r.s, q: r.q, kg: Math.round(r.kg * 100) / 100, pt: r.pt}),
  laser, stats,
});

// Сверка с C:\dev — при 5 мм, как там. Отличия лендинга:
// - перегородки жаровни нет (решение 31.10, задача 2);
// - все листовые детали одной толщины (решение 31.10): задвижки — 5 мм, а не 3, отсюда скоба задвижки шире под планку 5 мм.
// - колосник мангала — покупной перфолист, не лазер: в C:\dev он на листе с мангала v1.1.1 (01.11), а лендинг —
//   витрина, не редактор (решение Виталия 01.11); две половины колосника — лишние детали у C:\dev.
// Площадка под колесо и ножка с колесом — как в C:\dev: там площадка тоже 5 мм с мангала v1.2.0 (01.11)
const SAME_T = r => /^(Задвижка поддува|Скоба задвижки)/.test(r.n || '');
const SAME_T_LASER = ['grill_air_slider'];
const GRATE = p => /^grill_grate_/.test(p.file);

test('golden: при 5 мм копия в md/ считает как C:\\dev — без перегородки, все детали одной толщины', {skip: !fs.existsSync(DEV) && 'нет C:\\dev на этой машине'}, () => {
  const e5 = loadEngine();
  e5.ev('setSize({len: 800, wid: 420, top: 970, t: 5, deep: 1})');
  const dev = nums(snapshot(loadEngine({dir: DEV}))), md = nums(snapshot(e5));
  // колосник на листе — только у C:\dev: две половины, в панели цифр это +2 детали
  assert.deepEqual(dev.laser.filter(GRATE).map(p => [p.file, p.q]), [['grill_grate_1', 1], ['grill_grate_2', 1]]);
  assert.ok(!md.laser.some(GRATE), 'на лендинге колосник не лазерный');
  dev.laser = dev.laser.filter(p => !GRATE(p));
  dev.stats = {...dev.stats, parts: dev.stats.parts - 2};
  const div = dev.cut.find(r => r.n === 'Перегородка жаровни');
  assert.ok(div, 'в C:\\dev перегородка в раскрое есть');
  // лист перегородки уходит из раскроя
  assert.deepEqual(md.cut.filter(r => !SAME_T(r)), dev.cut.filter(r => r !== div && !SAME_T(r)));
  // задвижки — из того же листа 5 мм; строки те же, другие толщина, масса, ширина скобы
  assert.deepEqual(md.cut.filter(SAME_T).map(r => r.n), dev.cut.filter(SAME_T).map(r => r.n));
  const row = (s, n) => s.cut.find(r => r.n === n);
  assert.equal(row(md, 'Площадка под колесо (низ ножки)').s, '150 × 150 × 5');
  assert.match(row(dev, 'Задвижка поддува (планка)').s, / × 3$/);
  assert.match(row(md, 'Задвижка поддува (планка)').s, / × 5$/);
  // прорези под перегородку уходят из боковин: рез короче; задвижки — 5 мм; остальные детали — как в C:\dev
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
