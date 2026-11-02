// Цифры лендинга: эталон tests/golden.json — замороженный снимок собственного движка md/ при настройках
// лендинга по умолчанию (4 мм). Пересчитан один раз 02.11.2026: сверка с C:\dev убрана, потому что лендинг
// ведётся сам по себе и с C:\dev не сверяется (там мангал ушёл вперёд: колосник на листе, перегородка,
// задвижки 3 мм, и тест краснел без причины). Менять эталон — только осознанно, после правки движка:
// UPDATE_GOLDEN=1 npm test
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine, snapshot} = require('../engine.js');

const GOLDEN = path.join(__dirname, '..', 'golden.json');

test('golden: цифры не разошлись с эталоном', () => {
  const now = snapshot(loadEngine());
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n');
  assert.deepEqual(now, JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
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
