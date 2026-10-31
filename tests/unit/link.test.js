// Ссылка с размерами: адрес после # ⇄ настройки мангала; битая ссылка — пример по умолчанию
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadEngine} = require('../engine.js');

const e = loadEngine({extra: ['link']});
const DEF = {len: 800, wid: 420, top: 970, t: 4, deep: 1};
const read = hash => e.ev(`readLink(${JSON.stringify(hash)})`);

test('exact: ключи всегда в одном порядке', () => {
  assert.equal(e.ev('linkHash({deep: 0, t: 4, top: 900, wid: 500, len: 1000})'), '#len=1000&wid=500&top=900&t=4&deep=0');
});

test('roundTrip: ссылка открывает ровно те настройки, из которых собрана', () => {
  const s = {len: 1000, wid: 500, top: 900, t: 4, deep: 0};
  assert.deepEqual(read(e.ev(`linkHash(${JSON.stringify(s)})`)), s);
  assert.deepEqual(read('#len=400&wid=250&top=1100&t=2&deep=1'), {len: 400, wid: 250, top: 1100, t: 2, deep: 1});
});

test('badLink: любое неверное значение — весь пример по умолчанию', () => {
  const ok = 'len=1000&wid=500&top=900&t=4&deep=0';
  for (const [k, bad] of [
    ['len', 'abc'], ['len', '1005'], ['len', '390'], ['len', '1.5e3'], ['len', '-800'], ['len', ''], ['len', '0x320'],
    ['wid', '99999'], ['top', '905'], ['t', '7'], ['t', '4.0'], ['deep', '2'], ['deep', 'true'],
  ]) {
    assert.deepEqual(read('#' + ok.replace(new RegExp(`(^|&)${k}=[^&]*`), `$1${k}=${bad}`)), DEF, `${k}=${bad}`);
  }
  assert.deepEqual(read('#len=abc&wid=99999&top=905&t=7&deep=2'), DEF);
  assert.deepEqual(read('#len=abc'), DEF);
  assert.deepEqual(read('#wid=99999'), DEF);
  assert.deepEqual(read('#t=7'), DEF);
});

test('truncated: обрезанная или пустая ссылка — пример по умолчанию, а не «почти ваш» мангал', () => {
  assert.deepEqual(read('#len=1000&wid=500&top=900&t=4'), DEF);
  assert.deepEqual(read('#len=1000&wid=500&top=900&t=4&de'), DEF);
  assert.deepEqual(read('#len=1000&wid=500&top=9'), DEF);
  assert.deepEqual(read('#len=600'), DEF);
  assert.deepEqual(read('#'), DEF);
  assert.deepEqual(read(''), DEF);
  assert.deepEqual(read('#%E0%A4%A'), DEF);
});

test('extra: лишние ключи не мешают, порядок ключей не важен', () => {
  assert.deepEqual(read('#deep=0&t=4&top=900&wid=500&len=1000&item=mangal'), {len: 1000, wid: 500, top: 900, t: 4, deep: 0});
});
