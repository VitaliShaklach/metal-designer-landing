// Цифры лендинга при настройках по умолчанию: копия движка в md/ считает так же, как C:\dev
// Эталон tests/golden.json снимается с C:\dev (только чтение): UPDATE_GOLDEN=1 npm test
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine} = require('../engine.js');

const DEV = 'C:/dev/metal-designer/mangal/js';
const GOLDEN = path.join(__dirname, '..', 'golden.json');
const snapshot = e => ({cut: e.ev('cutList()'), laser: e.ev('laserList()'), stats: e.ev('statsData()')});

test('golden: копия в md/ считает как C:\\dev', {skip: !fs.existsSync(DEV) && 'нет C:\\dev на этой машине'}, () => {
  const dev = snapshot(loadEngine({dir: DEV}));
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, JSON.stringify(dev, null, 1) + '\n');
  assert.deepEqual(snapshot(loadEngine()), dev);
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
  const {len, wid, top, t, parts, holes, slots, wheels} = stats;
  assert.deepEqual({len, wid, top, t, parts, holes, slots, wheels},
    {len: 800, wid: 420, top: 970, t: 5, parts: 15, holes: 34, slots: 52, wheels: true});
  assert.ok(stats.kg > 0 && stats.cutM > 0);
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
