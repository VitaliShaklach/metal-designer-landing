// Стенд движка в Node: файлы склеиваются в один исходник (классические скрипты делят одну область,
// как в C:\dev\metal-designer\mangal\tools\smoke.js) и выполняются в vm вместе с настоящим three.js.
// DOM — заглушки; у <canvas> нет WebGL, поэтому model.js ставит ok = false и 3D не строит.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ENGINE = ['params', 'parts', 'model', 'dims', 'cut', 'dxf'];

// элемент-пустышка: всё, что движок трогает у узлов DOM
const stubEl = () => ({
  innerHTML: '', textContent: '', style: {}, dataset: {},
  classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
  appendChild: c => c, removeChild() {}, remove() {}, setAttribute() {},
  addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [],
  getContext: () => null,
});

// dir — откуда брать движок (md/ или C:\dev, только чтение); storage — содержимое localStorage;
// extra — модули лендинга из md/, которые добавляют следующие задачи
function loadEngine({dir = 'md', storage = {}, extra = []} = {}) {
  const src = [
    ...ENGINE.map(f => path.resolve(ROOT, dir, f + '.js')),
    ...['defaults', 'stats', ...extra].map(f => path.join(ROOT, 'md', f + '.js')),
  ].map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
  const ctx = {
    document: {
      getElementById: stubEl, createElement: stubEl, createElementNS: stubEl,
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: stubEl(),
    },
    localStorage: {
      getItem: k => (k in storage ? String(storage[k]) : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: k => { delete storage[k]; },
    },
    window: {addEventListener() {}},
    location: {hash: '', href: 'http://localhost/', search: ''},
    navigator: {userAgent: 'node'},
    devicePixelRatio: 1,
    performance: {now: () => 0},
    requestAnimationFrame() {},
    console, setTimeout, clearTimeout, TextEncoder, URLSearchParams,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'vendor/three/three.min.js'), 'utf8'), ctx, {filename: 'three.min.js'});
  vm.runInContext(src, ctx, {filename: 'engine.js'});
  return {
    // объекты — копией через JSON: без чужих прототипов из vm, deepEqual сравнивает только данные
    ev(expr) {
      const r = vm.runInContext(expr, ctx);
      return r !== null && typeof r === 'object' ? JSON.parse(JSON.stringify(r)) : r;
    },
  };
}

// снимок всех цифр: раскрой, детали под лазер, панель
const snapshot = e => ({cut: e.ev('cutList()'), laser: e.ev('laserList()'), stats: e.ev('statsData()')});

module.exports = {loadEngine, snapshot};
