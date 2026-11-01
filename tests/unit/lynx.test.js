// Рысь: разбор файла модели из C:\dev и цифры для плиток
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {polyToModel, statsTiles} = require('../../tools/lynx-capture.js');

test('polyToModel: берёт V, P, имя и высоту из plates-lynxN.js', () => {
  const src = "MODELS_POLY.lynx7={V:[0,0,0,10,0,0,10,10,0],P:[0,1,2,-1]};\n" +
    "FIGURES.lynx7={name:'Рысь 7',H:1000,poly:true,backIf:c=>c[1]>.73,build:()=>modelPoly('lynx7'),ref:'lynx7'};";
  assert.deepEqual(polyToModel(src, 7), {version: 7, name: 'Рысь 7', H: 1000, V: [0,0,0,10,0,0,10,10,0], P: [0,1,2,-1]});
});

// Строки таблицы «Итого» страницы рыси, как они там написаны
const SUM = [
  ['Деталей', '143'],
  ['Площадь металла', '2,88 м²'],
  ['Масса (2 мм, Сталь)', '≈ 45,2 кг'],
  ['Длина реза (с учётом толщины)', '120,5 м'],
  ['Врезок (по одной на деталь)', '143'],
];

test('statsTiles: пять плиток по порядку — детали, масса, рез, высота, толщина', () => {
  assert.deepEqual(statsTiles(SUM, {H: 1000, t: '2 мм', mat: 'Сталь'}), [
    ['143 детали', 'из листа'],
    ['≈ 45,2 кг', 'металла'],
    ['рез 120,5 м', 'длина реза'],
    ['1000 мм', 'высота'],
    ['сталь 2 мм', 'толщина металла'],
  ]);
});

test('statsTiles: нет строки или в ней нет числа — ошибка с подписью, а не пустая плитка', () => {
  const opts = {H: 1000, t: '2 мм', mat: 'Сталь'};
  assert.throws(() => statsTiles(SUM.filter(([l]) => !l.startsWith('Длина реза')), opts), /Длина реза/);
  assert.throws(() => statsTiles([], opts), /Деталей/);
  assert.throws(() => statsTiles(SUM.map(([l, v]) => [l, l === 'Деталей' ? '' : v]), opts), /Деталей/);
  assert.throws(() => statsTiles(SUM.map(([l, v]) => [l, l.startsWith('Масса') ? '—' : v]), opts), /Масса/);
});
