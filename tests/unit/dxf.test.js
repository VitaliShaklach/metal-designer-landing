// Вкладки «Размеры», «Раскрой и масса», «Лазер · DXF»: размеры по умолчанию, файлы DXF, список «Металл»
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadEngine} = require('../engine.js');

const e = loadEngine();
const at = (o = {}) => e.ev(`setSize(${JSON.stringify({len: 800, wid: 420, top: 970, t: 4, deep: 1, ...o})})`);

test('dims: на модели по умолчанию длина, ширина и высота', () => {
  at();
  const vis = e.ev('dimVisible().map(r => r.id)');
  for (const id of ['l80', 'w39', 'top']) assert.ok(vis.includes(id), `${id} нет среди размеров`);
  assert.deepEqual(e.ev('[...S.dims].sort()'), ['l80', 'top', 'w39']);
});

test('dxf: каждый файл — R12, контуры в слое CUT, конец EOF', () => {
  for (const [len, wid] of [[800, 420], [1000, 500], [400, 250]]) {
    at({len, wid});
    const files = e.ev('laserParts().map(p => [dxfName(p), dxfText(partMM(p))])');
    assert.ok(files.length > 0);
    for (const [name, text] of files) {
      assert.ok(text.includes('AC1009'), `${name}: не R12`);
      assert.match(text, /\r\n8\r\nCUT\r\n/, `${name}: нет слоя CUT`);
      assert.ok(text.endsWith('EOF\r\n'), `${name}: нет EOF в конце`);
    }
  }
});

// имя архива и его содержимое проверяет tests/e2e/tabs.spec.js (zip) — по настоящему скачиванию
test('zip: по умолчанию 8 деталей под лазер', () => {
  at();
  assert.equal(e.ev('laserParts().length'), 8);
});

test('metal: один лист толщины мангала, без крыши и пустых строк', () => {
  for (const [len, wid, t] of [[800, 420, 4], [1000, 500, 6], [800, 280, 2]]) {
    at({len, wid, t});
    const rows = e.ev('metalRows()'), where = `${len} × ${wid} × ${t}`;
    assert.deepEqual(rows.filter(([n]) => /^Лист/.test(n)).map(([n]) => n), [`Лист ${t} мм`], `${where}: листы`);
    assert.ok(rows.some(([n]) => n === 'Труба Ø40×3'), `${where}: нет трубы ножек`);
    assert.deepEqual(rows.filter(([, , w]) => /крыш/.test(w)), [], `${where}: строки крыши`);
    assert.deepEqual(rows.filter(([, q, w]) => /^0 м/.test(q) || /— 0 шт/.test(w)), [], `${where}: пустые строки`);
  }
});
