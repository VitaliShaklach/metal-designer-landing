# Лендинг: рысь, переключатель, призывы — план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на первом экране лендинга переключатель «Мангал | Рысь»: мангал как сейчас, рысь — лента «Было → Переработка → Стало → Чертежи» с 3D; новые тексты призывов и блок «Посмотрите, каким будет ваш проект» со ссылкой на `editor/`.

**Architecture:** рысь на странице ничего не считает. Скрипт `tools/lynx-capture.js` (только для разработки) один раз на версию забирает из `C:\dev\metal-designer\art\private\lynx.html` модель, цифры и картинки и кладёт их в `lynx/`. Страница грузит `lynx/` по нажатию «Рысь» и показывает модель своим маленьким просмотрщиком в `md/lynx.js` (свой рендерер, отдельный от мангала). Выбранное изделие живёт в адресе: `#item=rys`.

**Tech Stack:** HTML, CSS, классические скрипты; three.js r128 из `vendor/three/`; тесты `node:test` и `@playwright/test`.

**Spec:** [docs/superpowers/specs/2026-11-01-landing-lynx-editor-link-design.md](../specs/2026-11-01-landing-lynx-editor-link-design.md) — дополнение к [2026-10-29-landing-v2-design.md](../specs/2026-10-29-landing-v2-design.md). Читать обе.

## Global Constraints

- Ветка `landing-v2-mangal`. В `master` ничего не сливать и не пушить без команды Виталия.
- `C:\dev` — только чтение. Скрипт отдаёт `C:\dev\metal-designer` через `python -m http.server` (он только читает) и читает файлы; ничего туда не пишет.
- На странице нигде нет слова «демо» (и в адресах ссылок тоже). Ссылки на `demo.html` нет.
- Тексты дословно: кнопка «Прислать фото и пожелания»; строка «Спроектирую ваше изделие бесплатно»; подпись рыси «Даже фигуру по фото проектирую за 1–3 дня»; второй шаг ленты «Гранёная модель, разметка швов»; блок «Посмотрите, каким будет ваш проект» / «Мангал, печь, рысь. Размеры меняете сами — бесплатно.» / кнопка «Подогнать под свои размеры →»; под лентой кнопка «Прислать фото своей фигуры»; строка под «Как работаем» — «Обычно 1 день. Срочно сделаю быстрее.»
- Подписи автора фото нигде нет. Скачивания DXF рыси нет.
- Telegram — `https://t.me/SHVA_1984`. Ссылка редактора — относительная `editor/` (до выхода редактора она ведёт в 404 — это ожидаемо, всё выходит одним разом).
- Карточка ссылки (`og:*`) и заголовок первого экрана не меняются.
- Без сторонних серверов на странице; телефон 390 px без горизонтальной прокрутки; 3D не занимает весь экран телефона.
- Поменялся `md/*.js` или `css/*.css` — дата `?v=` во всех тегах `index.html` (см. `CLAUDE.md`).
- npm и npx — с `NODE_OPTIONS=--use-system-ca`. Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Открыли сразу `#item=rys`, потом нажали «Мангал».** Мангал был скрыт при загрузке, у `#stage` была нулевая высота: модель должна встать по размеру и в кадр, без растянутой картинки → задача 3, тест `rysFirst`.
2. **Телефон: палец на 3D рыси.** Страница должна листаться дальше, 3D рыси не выше 3D мангала (`min(48svh, 380px)`) → задача 3, тест `phoneLayout`.
3. **`lynx/model.json` не загрузился или нет WebGL.** Вместо 3D — картинка `lynx/poster.jpg`, остальная лента и цифры на месте, ошибок на странице нет → задача 3, тест `noModel`.
4. **Ссылка мангала с размерами после похода в рысь.** `#len=600&…` → «Рысь» → «Мангал»: адрес снова `#len=600&…`, ползунки те же → задача 3, тест `backToMangal`.
5. **Новая ссылка в открытой вкладке** (`#item=rys` ⇄ `#len=…`): переключатель и видимый блок следуют за адресом → задача 3, тест `hashchange`.

---

## Файлы

| Файл | Что в нём |
|---|---|
| `tools/lynx-capture.js` | Создать. Сборщик `lynx/` из `C:\dev` (Node + Playwright). `polyToModel()` — чистая функция |
| `lynx/` | Создать. `model.json`, `stats.json`, `photo-1.jpg`…`photo-3.jpg`, `rework.jpg`, `nest.jpg`, `sheet.jpg`, `poster.jpg` |
| `md/lynx.js` | Создать. `lynxGeometry()` (чистая), `initLynx()`, просмотрщик рыси |
| `md/link.js` | Изменить. `readItem()`, `itemHash()` |
| `md/landing.js` | Изменить. Выбранное изделие, переключатель, адрес, пауза цикла мангала |
| `index.html`, `css/landing.css` | Изменить. Переключатель, лента, блок проекта, тексты |
| `tests/unit/lynx.test.js`, `tests/unit/link.test.js` | Создать / дописать |
| `tests/e2e/lynx.spec.js`, `tests/e2e/blocks.spec.js` | Создать / поправить |
| `package.json` | Скрипт `lynx` |
| `CLAUDE.md` | «Что где лежит» и как обновить рысь |

---

### Task 1: Сборщик рыси и файлы `lynx/` для версии 5

**Files:**
- Create: `tools/lynx-capture.js`, `lynx/*`
- Modify: `package.json` (скрипт `"lynx": "node tools/lynx-capture.js"`), `CLAUDE.md`
- Test: `tests/unit/lynx.test.js`

**Interfaces:**
- Produces: `lynx/model.json` — `{"version": 5, "name": "Рысь 5", "H": 1000, "V": number[], "P": number[]}`, где `V` и `P` скопированы как есть из `MODELS_POLY.lynx5` (`V` — тройки координат в мм×10; `P` — индексы вершин грани, `-1` — конец грани).
- Produces: `lynx/stats.json` — `{"version": 5, "tiles": [[big, small], …]}`: строки, готовые к показу, как плитки `drawStats()` в `md/landing.js`. Плитки по порядку: детали, масса, длина реза, высота (`H`, «1000 мм»), толщина металла.
- Produces: `polyToModel(src: string, version: number) -> {version, name, H, V, P}` — экспорт из `tools/lynx-capture.js` (`module.exports`), `src` — текст `plates-lynxN.js`.

- [ ] **Step 1: Тест `polyToModel`** в `tests/unit/lynx.test.js` (тест требует файл напрямую через `require('../../tools/lynx-capture.js')`, скрипт запускает Playwright только при `require.main === module`):

```js
test('polyToModel: берёт V, P, имя и высоту из plates-lynxN.js', () => {
  const src = "MODELS_POLY.lynx7={V:[0,0,0,10,0,0,10,10,0],P:[0,1,2,-1]};\n" +
    "FIGURES.lynx7={name:'Рысь 7',H:1000,poly:true,backIf:c=>c[1]>.73,build:()=>modelPoly('lynx7'),ref:'lynx7'};";
  assert.deepEqual(polyToModel(src, 7), {version: 7, name: 'Рысь 7', H: 1000, V: [0,0,0,10,0,0,10,10,0], P: [0,1,2,-1]});
});
```

- [ ] **Step 2:** `NODE_OPTIONS=--use-system-ca npm test` — FAIL (нет модуля).
- [ ] **Step 3: `polyToModel`** — выполнить `src` в `vm` с заглушками `MODELS_POLY = {}`, `FIGURES = {}`, `modelPoly = () => null`; взять `MODELS_POLY['lynx'+N]` и `FIGURES['lynx'+N]`.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5: Сборщик.** `node tools/lynx-capture.js <N>` (по умолчанию 5):
  1. `model.json` — через `polyToModel` из `C:\dev\metal-designer\art\private\plates-lynx<N>.js`.
  2. Поднимает `python -m http.server 8010 --directory C:\dev\metal-designer` (останавливает в конце), открывает `http://localhost:8010/art/private/lynx.html` в `chromium` из `@playwright/test`, окно 1400 × 900. Страница грузит three.js с CDN — для сборщика это нормально.
  3. Выбирает `#figSel` = `lynx<N>`, ждёт, пока пропадёт `#loading`. `poster.jpg` — снимок `#stage` после кнопки `.vbar [data-v="iso"]`.
  4. `stats.json` — из плиток `#stats` (детали, масса, рез — по подписям) плюс высота из `FIGURES.H` и толщина из `#sT`. Если подписи не нашлись — упасть с понятной ошибкой, а не писать пустое.
  5. `nest.jpg` — вкладка `[data-tab="nest"]`, снимок первого листа раскроя; `sheet.jpg` — вкладка `[data-tab="sheets"]`, снимок первого листа. Раскрой у рыси считается минутами: таймаут ожидания 10 минут.
  6. `rework.jpg` — `#figSel` = `lynx` (исходная гранёная модель из Meshy с нарисованными швами, *решение плана*; опция `--rework <id>` выбирает другую), вид `iso`, снимок `#stage`.
  7. `photo-1.jpg`…`photo-3.jpg` — из `C:\dev\lynx_meshy\` по порядку `2_Poing_07_anfas.jpg`, `3_Hellabrunn_profil.jpg`, `3_Hellabrunn_szadi.jpg`, уменьшенные до ширины 1200 px (картинку открыть в странице с `width:1200px` и снять элемент в JPEG, качество 80). Все JPEG — качество 80.
- [ ] **Step 6: Запуск** `NODE_OPTIONS=--use-system-ca npm run lynx -- 5`. Проверить: в `lynx/` 9 файлов; `stats.json` — 5 плиток с числами; картинки открыть и посмотреть глазами (не пустые, рысь целиком, без панелей редактора). `git status` в `C:\dev\metal-designer` — без изменений.
- [ ] **Step 7: `CLAUDE.md`** — в «Что где лежит» строки про `lynx/` и `tools/lynx-capture.js`; в «Как проверять» — «новая версия рыси: `NODE_OPTIONS=--use-system-ca npm run lynx -- 6`, посмотреть картинки, закоммитить `lynx/`».
- [ ] **Step 8: Commit** — `git add tools lynx tests/unit/lynx.test.js package.json CLAUDE.md`, «Рысь: сборщик lynx/ из C:\dev и файлы версии 5».

---

### Task 2: Геометрия и просмотрщик рыси (`md/lynx.js`)

**Files:**
- Create: `md/lynx.js`
- Test: `tests/unit/lynx.test.js` (дописать; модуль через `loadEngine({extra: ['lynx']})`)

**Interfaces:**
- Consumes: `lynx/model.json`, `lynx/stats.json` (задача 1).
- Produces: `lynxGeometry(model) -> {pos: number[], edges: number[]}` — `pos`: треугольники (по 9 чисел), `edges`: отрезки рёбер (по 6 чисел), координаты в мм (`V / 10`), модель сдвинута так, что центр рамки по X и Z — 0, низ — `y = 0`.
- Produces: `initLynx(box: HTMLElement, poster: HTMLImageElement) -> Promise<boolean>` — один раз грузит `lynx/model.json`, создаёт свой `THREE.WebGLRenderer` в `box`, `OrbitControls`, рисует по требованию (событие `change` контролов и `ResizeObserver`). `true` — 3D показано; `false` — нет WebGL или файл не загрузился: `box` скрыт, `poster` показан. Повторный вызов возвращает тот же промис.
- Produces: `lynxStatsHtml(stats) -> string` — плитки в той же разметке, что `drawStats()` (`<div class="stat"><b>…</b><span>…</span></div>`).

- [ ] **Step 1: Тесты** в `tests/unit/lynx.test.js`:

```js
test('lynxGeometry: четырёхугольник — два треугольника и четыре ребра', () => {
  const g = e.ev(`lynxGeometry({V:[0,0,0, 100,0,0, 100,100,0, 0,100,0], P:[0,1,2,3,-1]})`);
  assert.equal(g.pos.length, 18);
  assert.equal(g.edges.length, 24);
});
test('lynxGeometry: общее ребро двух граней — один отрезок', () => {
  const g = e.ev(`lynxGeometry({V:[0,0,0, 100,0,0, 100,100,0, 0,100,0], P:[0,1,2,-1, 0,2,3,-1]})`);
  assert.equal(g.edges.length, 5 * 6);
});
test('lynxGeometry: мм, центр по X и Z, низ на нуле', () => {
  const g = e.ev(`lynxGeometry({V:[0,50,0, 200,50,0, 200,150,40], P:[0,1,2,-1]})`);
  const xs = g.pos.filter((_, i) => i % 3 === 0), ys = g.pos.filter((_, i) => i % 3 === 1);
  assert.equal(Math.min(...xs), -10); assert.equal(Math.max(...xs), 10);
  assert.equal(Math.min(...ys), 0);   assert.equal(Math.max(...ys), 10);
});
test('lynxGeometry: настоящая рысь — все индексы в пределах V', () => {
  const m = require('../../lynx/model.json');
  const g = e.ev(`lynxGeometry(${JSON.stringify(m)})`);
  assert.ok(g.pos.length > 0 && g.pos.every(Number.isFinite));
});
test('lynxStatsHtml: плитка на каждую строку stats', () => {
  const html = e.ev(`lynxStatsHtml({tiles: [['1000 мм', 'высота'], ['2 мм', 'сталь']]})`);
  assert.equal((html.match(/class="stat"/g) || []).length, 2);
  assert.match(html, /<b>1000 мм<\/b><span>высота<\/span>/);
});
```

- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3: `lynxGeometry`, `lynxStatsHtml`** — грань — веер треугольников от первой вершины; рёбра — пары соседних вершин грани (и последняя с первой), без повторов (ключ `min-max`).
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5: `initLynx`** — `fetch('lynx/model.json')`; `MeshStandardMaterial` сталь (`color 0x8a8f96`, `metalness 0.6`, `roughness 0.45`, `flatShading: true`, `side: DoubleSide`) + `LineSegments` рёбер тёмным (`0x2b2f33`); свет как у мангала в `md/model.js`; камера — изометрия, вся рысь в кадре; на телефоне один палец — вращать, как у мангала. Проверка WebGL — как `ok` в `md/model.js`. Ошибка `fetch` или нет WebGL → `false`, без исключений в консоль. При загрузке файл ничего не делает (только объявляет функции) — его грузит стенд `tests/engine.js`. Подключить `md/lynx.js` в `index.html` после `md/link.js`.
- [ ] **Step 6: Commit** — «Рысь: геометрия и просмотрщик md/lynx.js».

---

### Task 3: Переключатель «Мангал | Рысь», лента и адрес

**Files:**
- Modify: `index.html`, `css/landing.css`, `md/link.js`, `md/landing.js`
- Test: `tests/unit/link.test.js` (дописать), `tests/e2e/lynx.spec.js` (создать)

**Interfaces:**
- Consumes: `initLynx`, `lynxStatsHtml` (задача 2); `lynx/*` (задача 1).
- Produces: `readItem(hash: string) -> 'mangal' | 'rys'` — `'rys'` только при `item=rys`, всё остальное — `'mangal'`.
- Produces: `itemHash(item, state) -> string` — `'#item=rys'` для рыси, `linkHash(state)` для мангала (ссылки мангала не меняются, `item=mangal` не пишем).
- Produces: в `md/landing.js` `setItem(item)` — показывает элементы `[data-item="<item>"]`, прячет остальные `[data-item]`, ставит `aria-pressed` у кнопок `#items button`, при `'rys'` вызывает `initLynx` и рисует `#lynxStats`, пишет адрес через `writeLink()` (он теперь пишет `itemHash(item, state)`). Пока показана рысь, цикл мангала не рисует кадры; при возврате — `sizeStage()` и `fitView()`.

Разметка (внутри `section.hero`, после `h1`):
- `#items` — `role="group" aria-label="Изделие"`, две кнопки `data-item="mangal"` «Мангал» и `data-item="rys"` «Рысь».
- `data-item="mangal"` получают: `#stage`, `.sizes`, `.metal`, `#lstats`, `#getBtn`. Блок `#get` при рыси скрыт (и кнопка в исходное «Показать…»).
- `div.lynx[data-item="rys"][hidden]`: `p.lynxsub` с подписью рыси; `ol.ribbon` из 4 `li`: `.r-was` (подпись «Было», три `img` `lynx/photo-1..3.jpg`), `.r-rework` (подпись «Переработка», `img lynx/rework.jpg`, текст «Гранёная модель, разметка швов»), `.r-now` (подпись «Стало», `#lynx3d` и `img#lynxPoster[hidden] lynx/poster.jpg`), `.r-draw` (подпись «Чертежи», `img lynx/nest.jpg`, `img lynx/sheet.jpg`); `#lynxStats.stats`; `a.btn` «Прислать фото своей фигуры» → Telegram. У всех `img` — `alt`, `loading="lazy"`.
- `dialog#lbox` — картинка крупно: клик по любой `img` ленты открывает её в `#lbox`, клик или `Esc` закрывает.
- Стрелки между шагами — CSS (`::after`), не текст.

Вёрстка ленты:
- Компьютер: одна строка, «Стало» самое широкое (примерно `grid-template-columns: 1fr 1fr 2.4fr 1fr`), высота `#lynx3d` как у `#stage`.
- Телефон (`max-width` как у правила `#stage` в `css/landing.css`): строка из 4 маленьких картинок (3 фото + переработка) с подписью «Было» над 3D; ниже `#lynx3d` высотой `min(48svh, 380px)`; ниже чертежи. Порядок — через `grid-template-areas`, DOM не меняется.

- [ ] **Step 1: Unit-тесты** в `tests/unit/link.test.js`:

```js
test('readItem: рысь только по item=rys', () => {
  assert.equal(e.ev(`readItem('#item=rys')`), 'rys');
  assert.equal(e.ev(`readItem('#len=600&wid=280&top=900&t=4&deep=0')`), 'mangal');
  assert.equal(e.ev(`readItem('#item=pech')`), 'mangal');
  assert.equal(e.ev(`readItem('')`), 'mangal');
});
test('itemHash: мангал — прежняя ссылка, рысь — #item=rys', () => {
  const s = {len: 1000, wid: 500, top: 900, t: 4, deep: 0};
  assert.equal(e.ev(`itemHash('mangal', ${JSON.stringify(s)})`), '#len=1000&wid=500&top=900&t=4&deep=0');
  assert.equal(e.ev(`itemHash('rys', ${JSON.stringify(s)})`), '#item=rys');
});
```

- [ ] **Step 2:** `npm test` — FAIL. **Step 3:** `readItem`, `itemHash` в `md/link.js`. **Step 4:** `npm test` — PASS.
- [ ] **Step 5: E2E-тесты** `tests/e2e/lynx.spec.js` (оба проекта, desktop и phone; `watch(page)` как в `link.spec.js`, в конце каждого — нет `pageerror`):
  - `default`: `/` — видны `#stage` и `.sizes`, `.lynx` скрыт, кнопка «Мангал» `aria-pressed="true"`; запросов к `lynx/model.json` не было (`page.on('request')`).
  - `switch`: клик «Рысь» → `.lynx` виден, `#stage`, `.sizes`, `#getBtn` скрыты; `#lynx3d canvas` появился; `#lynxStats .stat` — 5 штук; `.lynxsub` = «Даже фигуру по фото проектирую за 1–3 дня»; есть текст «Гранёная модель, разметка швов»; адрес `#item=rys`.
  - `rysFirst`: `/#item=rys` → рысь видна; клик «Мангал» → ширина и высота `#stage canvas` > 0, `#lstats` содержит «800 × 420», адрес `#len=800&wid=420&top=970&t=4&deep=1`.
  - `backToMangal`: `/#len=600&wid=280&top=900&t=4&deep=0` → «Рысь» → «Мангал» → `#sLen` = 600, адрес снова `#len=600&wid=280&top=900&t=4&deep=0`.
  - `hashchange`: на открытой странице `location.hash = '#item=rys'` → видна рысь; `location.hash = '#len=600&wid=280&top=900&t=4&deep=0'` → мангал, `#sLen` = 600.
  - `noModel`: `page.route('**/lynx/model.json', r => r.abort())`, клик «Рысь» → `#lynxPoster` виден, `#lynx3d` скрыт, `#lynxStats .stat` — 5, `pageerror` нет.
  - `lightbox`: клик по `img` фото → `#lbox` открыт с той же `src`; `Esc` → закрыт.
  - `cta`: под лентой `a` «Прислать фото своей фигуры» с `href="https://t.me/SHVA_1984"`.
  - `phoneLayout` (только phone): на рыси нет горизонтальной прокрутки (`scrollWidth <= innerWidth`); высота `#lynx3d` ≤ 380; верх `#lynx3d` ниже низа всех четырёх картинок «Было/Переработка», а эти четыре стоят в одной строке (разница `top` ≤ 2 px); `.r-draw` ниже `#lynx3d`; после `mouse.wheel`/`touchscreen` прокрутка `window.scrollY` растёт.
- [ ] **Step 6:** `NODE_OPTIONS=--use-system-ca npx playwright test tests/e2e/lynx.spec.js` — FAIL.
- [ ] **Step 7: Разметка, стили, `setItem`**, `hashchange` в `md/landing.js` обновляет и `state`, и изделие; `?v=` — новая дата во всех тегах.
- [ ] **Step 8:** `npx playwright test` (весь набор) и `npm test` — PASS.
- [ ] **Step 9: Глазами** — `python tests/serve.py`, http://localhost:8000/#item=rys на 1440 и 390: лента читается «было → стало», рысь крутится, картинки открываются крупно.
- [ ] **Step 10: Commit** — «Лендинг: переключатель Мангал | Рысь, лента рыси, #item=rys».

---

### Task 4: Призывы, блок «Посмотрите, каким будет ваш проект», строка «Как работаем»

**Files:**
- Modify: `index.html`, `css/landing.css`, `CLAUDE.md` (строка про песочницу: «С лендинга на неё ссылки нет» → «кнопка „Подогнать под свои размеры“ ведёт на `editor/`»)
- Test: `tests/e2e/blocks.spec.js` (поправить старые ожидания, дописать)

**Interfaces:**
- Consumes: ничего из задач 1–3, кроме общей разметки `index.html`.

Что меняется в `index.html`:
- `#me a.btn-main` и `.cta-bar a.btn-main` — текст «Прислать фото и пожелания».
- `#me .lead` — «Спроектирую ваше изделие бесплатно. Пришлите фото и пожелания в Telegram — отвечу и назову срок.» В `.cta-bar` строки нет: на телефоне полоса должна остаться узкой (*решение плана*).
- `#how .note` — «Обычно 1 день. Срочно сделаю быстрее.»
- Новая `section.proj.wrap#proj` между `.vs` и `#how`: `h2` «Посмотрите, каким будет ваш проект», `p` «Мангал, печь, рысь. Размеры меняете сами — бесплатно.», `a.btn` (без `btn-main`, обводкой) `href="editor/"` «Подогнать под свои размеры →».

- [ ] **Step 1: Тесты** в `tests/e2e/blocks.spec.js` — заменить ожидания строк 32 и 34 и дописать:
  - `#how .note` = «Обычно 1 день. Срочно сделаю быстрее.»
  - `#me a.btn-main` и `.cta-bar a.btn-main` = «Прислать фото и пожелания»; `#me .lead` содержит «Спроектирую ваше изделие бесплатно»
  - `#proj h2` = «Посмотрите, каким будет ваш проект»; `#proj a` с текстом «Подогнать под свои размеры →», `href="editor/"`, без класса `btn-main`
  - `#proj` стоит после `.vs` и перед `#how` (сравнить `boundingBox().y`)
  - нет слова «демо»: `document.body.innerText` и все `a[href]` не содержат `/демо|demo/i`
  - тексты «пока запускаюсь» и «Прислать описание изделия» на странице не встречаются
- [ ] **Step 2:** `npx playwright test tests/e2e/blocks.spec.js` — FAIL.
- [ ] **Step 3:** правки `index.html`, стиль `.proj` (кнопка заметно слабее `btn-main`), `?v=`, `CLAUDE.md`.
- [ ] **Step 4:** `npm test` и `npx playwright test` — PASS. Глазами на 1440 и 390.
- [ ] **Step 5: Commit** — «Лендинг: «Прислать фото и пожелания», блок проекта со ссылкой на editor/».

---

## После всех задач

Полный прогон `npm test` и `npx playwright test`, ссылка http://localhost:8000/#item=rys Виталию. Push ветки и слияние в `master` — только по его команде и только вместе с редактором (спека, «Порядок»).
