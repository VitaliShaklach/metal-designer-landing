// Толщина боковин, дна и торцов 2–6 мм и галочка «Глубокие прорези»
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {loadEngine, snapshot: snap} = require('../engine.js');

const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'golden.json'), 'utf8'));
const e = loadEngine();
const at = (o = {}) => {
  const s = {len: 800, wid: 420, top: 970, t: 5, deep: 1, ...o};
  e.ev(`setSize(${JSON.stringify(s)})`);
  return snap(e);
};
const row = (cut, n) => cut.find(r => r.n === n);
const part = (laser, file) => laser.find(p => p.file === file);

test('default: 5 мм и прорези — цифры как в эталоне', () => {
  assert.deepEqual(at(), GOLDEN);
});

test('default: setSize без t и deep — тоже эталон (ссылка из задачи 2 не ломается)', () => {
  e.ev('setSize({len: 800, wid: 420, top: 970})');
  assert.deepEqual(snap(e), GOLDEN);
});

test('grid: 2 и 6 мм, с прорезями и без, на крайних размерах — нет NaN, контуры замкнуты', () => {
  for (const t of [2, 6]) for (const deep of [0, 1]) for (const [len, wid] of [[400, 250], [1200, 500]]) {
    const s = at({len, wid, t, deep}), where = `${len} × ${wid}, ${t} мм, deep ${deep}`;
    assert.ok(!/NaN|undefined|null/.test(JSON.stringify(s)), `${where}: NaN/undefined в цифрах`);
    const noise = s.cut.flatMap(r => [r.s, r.note]).filter(x => /\d[.,]\d{3,}/.test(x || ''));
    assert.deepEqual(noise, [], `${where}: хвосты дробей в раскрое`);
    for (const p of s.laser) {
      assert.ok(p.w > 0 && p.h > 0, `${where}: ${p.file} без размера`);
      assert.ok(Number.isInteger(p.mm), `${where}: ${p.file} — толщина ${p.mm}`);
    }
    for (const [file, ls] of e.ev('laserParts().map(p => [p.file, partMM(p).loops])'))
      for (const l of ls) assert.deepEqual(l[0], l[l.length - 1], `${where}: ${file} — контур не замкнут`);
  }
});

test('thick: при 3 мм дно 7,913 кг, файлы боковин, дна и торцов — 3 мм; площадки и задвижки своей толщины', () => {
  const {cut, laser, stats} = at({t: 3});
  assert.equal(row(cut, 'Дно жаровни').kg, 7.913);
  assert.equal(e.ev("dxfName(laserParts().find(p => p.file === 'grill_bottom'))"), 'grill_bottom_3mm_x1.dxf');
  for (const f of ['grill_side_back', 'grill_side_front', 'grill_bottom', 'grill_end_right', 'grill_end_left'])
    assert.equal(part(laser, f).mm, 3, f);
  assert.equal(part(laser, 'leg_mount_plate').mm, 5);
  assert.equal(part(laser, 'wheel_pad').mm, 6);
  assert.equal(part(laser, 'grill_air_slider').mm, 3);
  assert.equal(stats.t, 3);
  // площадка под ножку весит как при 5 мм
  const plate = r => row(r, 'Площадка под ножку (на дно)').kg;
  assert.equal(plate(cut), plate(GOLDEN.cut));
});

test('thick: толщина меняет внутренние размеры — боковина ниже, торец между боковинами шире', () => {
  const s6 = at({t: 6}).cut, s2 = at({t: 2}).cut;
  assert.equal(row(s2, 'Торец правый').s.split(' × ')[0], String(420 - 2 * 2));
  assert.equal(row(s6, 'Торец правый').s.split(' × ')[0], String(420 - 2 * 6));
});

test('mass: при 800 × 420 масса растёт с толщиной', () => {
  const kg = t => at({t}).stats.kg;
  assert.ok(kg(2) < kg(5) && kg(5) < kg(6));
});

test('deep: без галочки у боковины нет глубоких прорезей — врезок меньше, в раскрое о них ни слова', () => {
  const on = part(at({deep: 1}).laser, 'grill_side_front').cutMm;
  const off = at({deep: 0});
  assert.ok(part(off.laser, 'grill_side_front').cutMm < on);
  assert.ok(!/глубок/i.test(row(off.cut, 'Боковина жаровни (задняя и передняя)').note));
  assert.equal(e.ev('S.deep'), false);
  assert.ok(!e.ev("dimVisible().some(r => /^deep/.test(r.id))"), 'размеры глубоких прорезей остались в списке');
});

test('back: после 2 мм без прорезей 5 мм с прорезями снова даёт эталон', () => {
  at({len: 400, wid: 250, t: 2, deep: 0});
  assert.deepEqual(at(), GOLDEN);
});
