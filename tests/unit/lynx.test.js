// Рысь: разбор файла модели из C:\dev и цифры для плиток
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {polyToModel, statsTiles} = require('../../tools/lynx-capture.js');
const {loadEngine} = require('../engine.js');

const e = loadEngine({extra: ['lynx']});

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

test('lynxStatsHtml: плитка на каждую строку stats, разметка как у панели мангала', () => {
  const html = e.ev(`lynxStatsHtml({tiles: [['1000 мм', 'высота'], ['2 мм', 'сталь']]})`);
  assert.equal((html.match(/class="stat"/g) || []).length, 2);
  assert.match(html, /<div class="stat"><b>1000 мм<\/b><span>высота<\/span><\/div>/);
});

test('lynxGeometry: грань-четырёхугольник — два треугольника и четыре ребра', () => {
  const g = e.ev(`lynxGeometry({V:[0,0,0, 100,0,0, 100,100,0, 0,100,0], P:[0,1,2,3,-1]})`);
  assert.equal(g.pos.length, 2 * 9);
  assert.equal(g.edges.length, 4 * 6);
});

test('lynxGeometry: общее ребро двух граней — один отрезок', () => {
  const g = e.ev(`lynxGeometry({V:[0,0,0, 100,0,0, 100,100,0, 0,100,0], P:[0,1,2,-1, 0,2,3,-1]})`);
  assert.equal(g.pos.length, 2 * 9);
  assert.equal(g.edges.length, 5 * 6);   // 4 по краю квадрата и диагональ 0–2 один раз
});

// координаты g.pos по осям: [xs, ys, zs]
const axes = a => [0, 1, 2].map(k => a.filter((_, i) => i % 3 === k));

test('lynxGeometry: мм (V / 10), центр рамки по X и Z — 0, низ — y = 0', () => {
  const g = e.ev(`lynxGeometry({V:[0,50,0, 200,50,0, 200,150,40], P:[0,1,2,-1]})`);
  const [xs, ys, zs] = axes(g.pos);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [-10, 10]);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, 10]);
  assert.deepEqual([Math.min(...zs), Math.max(...zs)], [-2, 2]);
  const [ex, ey] = axes(g.edges);
  assert.deepEqual([Math.min(...ex), Math.max(...ex), Math.min(...ey)], [-10, 10, 0]);   // рёбра — вместе с гранями
});

test('lynxGeometry: настоящая рысь из lynx/ — все числа конечные, высота — H мм, как в C:\dev (fitMesh)', () => {
  const m = require('../../lynx/model.json');
  const g = e.ev(`lynxGeometry(${JSON.stringify(m)})`);
  assert.ok(g.pos.length > 0 && g.edges.length > 0);
  assert.ok(g.pos.every(Number.isFinite) && g.edges.every(Number.isFinite));
  const ys = axes(g.pos)[1];
  assert.equal(Math.min(...ys), 0);
  assert.ok(Math.abs(Math.max(...ys) - m.H) < 1e-6, `высота ${Math.max(...ys)}, ждали ${m.H}`);
});
