// Цифры лендинга при настройках по умолчанию: копия движка в md/ считает так же, как C:\dev,
// кроме перегородки жаровни — на лендинге её нет (решение Виталия 31.10): ни листа, ни прорезей под неё.
// Эталон tests/golden.json снимается с md/ после сверки с C:\dev (только чтение): UPDATE_GOLDEN=1 npm test
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

test('golden: копия в md/ считает как C:\\dev, без перегородки', {skip: !fs.existsSync(DEV) && 'нет C:\\dev на этой машине'}, () => {
  const dev = nums(snapshot(loadEngine({dir: DEV}))), md = nums(snapshot(loadEngine()));
  const div = dev.cut.find(r => r.n === 'Перегородка жаровни');
  assert.ok(div, 'в C:\\dev перегородка в раскрое есть');
  // лист перегородки уходит из раскроя и массы
  assert.deepEqual(md.cut, dev.cut.filter(r => r !== div));
  const kgDev = dev.cut.reduce((s, r) => s + (r.kg || 0), 0);
  assert.equal(md.stats.kg, Math.round(kgDev - div.kg));
  // прорези под перегородку уходят из боковин: рез короче, остальные детали — как в C:\dev
  const side = p => /^grill_side/.test(p.file);
  assert.deepEqual(md.laser.filter(p => !side(p)), dev.laser.filter(p => !side(p)));
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
    {len: 800, wid: 420, top: 970, t: 5, kg: 61, parts: 15, cutM: 21, holes: 34, slots: 52, wheels: true});
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
