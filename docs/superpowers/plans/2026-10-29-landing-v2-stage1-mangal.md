# Лендинг v2, этап 1 «Мангал»: план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новый лендинг «Metal Designer для цеха»: на первом экране живой 3D-мангал из `C:\dev` с подвижными длиной, шириной, высотой и толщиной и управлением как в `C:\dev`, ниже — размеры, раскрой, DXF, листы А3 как у собаки, карты деталей А4, «Сейчас / с Metal Designer», «Как работаем» и контакты Виталия.

**Architecture:** Движок мангала (`params, parts, model, dims, cut, dxf`) копируется из `C:\dev\metal-designer\mangal\js` в `md/` без изменений. Эталон цифр снимается с самого `C:\dev` (только чтение, в памяти) с настройками лендинга из `md/defaults.js`. Потом в копии длина, ширина и толщина становятся переменными по правилам спеки. Интерфейс хобби-сайта (`ui.js`) переносится частями: управление и выбор деталей — в `md/controls.js`, остальное заменяет `md/landing.js`. Листы и карты — новые модули по образцу `C:\dev\metal-designer\art\js\sheets.js`; виды для листов рисует сама 3D-модель ортокамерой.

**Tech Stack:** HTML, CSS, классические скрипты в общей глобальной области (как в `C:\dev`), three.js r128 + OrbitControls + CSS2DRenderer локальными копиями, Node 24 (`node:test`), `@playwright/test` (только для разработки), Python `http.server` для локального сервера.

**Spec:** [docs/superpowers/specs/2026-10-29-landing-v2-design.md](../specs/2026-10-29-landing-v2-design.md)

**Задачи в GitHub:** родительская #24 «Лендинг v2 — этап 1: мангал»; задачи плана 1–12 = подзадачи #25–#36 (`[N/12]` в названии), блокировки — родными связями GitHub. Одна задача — одна сессия (`/implement #номер`).

## Global Constraints

- Только HTML, CSS и JavaScript в браузере; без сервера, базы данных, ключей API и платных сервисов.
- Библиотеки и шрифты — только копиями в репозитории; при открытии страницы ничего не грузится со сторонних серверов: three.js r128 с OrbitControls и CSS2DRenderer; шрифты Oswald, Golos Text, JetBrains Mono (OFL).
- Телефон 390 px без горизонтальной прокрутки; блок модели не выше 55 % экрана телефона.
- **`C:\dev\metal-designer` не трогаем**: только чтение и копирование. Никаких правок, коммитов и запусков, которые пишут туда файлы.
- `master` сразу публикуется. Вся работа — в ветке `landing-v2-mangal`; в `master` — только по команде Виталия, целиком после этапа. Ветку можно пушить: сайт собирается только из `master`.
- Автотесты: `node --test tests/unit/` (расчёты, ссылка, листы, карты) и `npx playwright test` (страница, проекты `desktop` 1440 × 900 и `phone` 390 × 844). `@playwright/test` — только в `devDependencies`; `node_modules/`, `test-results/`, `playwright-report/` — в `.gitignore`.
- У всех `<script>` и `<link rel="stylesheet">` страницы метка `?v=2026-10-29`; при правке файла — новая дата во всех тегах.
- Настройки по умолчанию: 800 × 420 × 970, 5 мм, без крыши, с колёсами, глубокие прорези включены. Цифры при них совпадают с `C:\dev` при тех же настройках (эталон `tests/golden.json`).
- Тексты: русский, на «вы», цеховой тон, без «революций» и «AI». Название — «Metal Designer для цеха». Telegram — `https://t.me/SHVA_1984`. Ссылки на `demo.html` на странице нет.
- Скопированные из `C:\dev` файлы сохраняют свой стиль; новые файлы — в стиле `js/` песочницы: читаемо, с короткими комментариями по-русски.
- Каждый коммит заканчивается строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- npm и npx на этой машине запускать с `NODE_OPTIONS=--use-system-ca` (Kaspersky, см. глобальный CLAUDE.md).

## Review Focus

1. **Крайние размеры дают устаревшие строки.** При 1000 × 500 в раскрое не должно остаться «780», «400 × 400», «× 420» из размера по умолчанию → задача 2, тест `stale`.
2. **Общий localStorage с хобби-сайтом.** Тот же домен `vitalishaklach.github.io`: если там выбраны сантиметры (`md-unit = cm`), лендинг всё равно показывает мм → задача 2, тест `unit`.
3. **Нет WebGL** (старый телефон, отключено): нет 3D, но цифры, вкладки, DXF, листы спецификации и раскроя, карты работают; вместо модели и видов — понятная надпись → задача 1 (e2e `noWebGL`) и задача 7 (тест `noWebGL`).
4. **Битая ссылка с размерами** (`#len=abc`, `#len=99999`, `#t=7`, обрезанная) открывает пример по умолчанию без ошибок в консоли → задача 4, тесты `badLink`.
5. **Карточка ссылки не появляется в Telegram**: относительный `og:image` или неверный размер картинки → задача 11, шаг 5.

---

## Файлы

| Файл | Что в нём |
|---|---|
| `md/params.js`, `md/parts.js`, `md/model.js`, `md/dims.js`, `md/cut.js`, `md/dxf.js` | Копия движка из `C:\dev\metal-designer\mangal\js`. Правки: размеры (задача 2), толщина (задача 3), `metalRows()` (задача 7) |
| `md/defaults.js` | Настройки лендинга поверх движка: без крыши и трубок под стойки |
| `md/stats.js` | Чистые функции: раскрой как на экране, детали под лазер, цифры панели |
| `md/link.js` | Ссылка с размерами: разбор и сборка части адреса после `#` |
| `md/landing.js` | Страница: настройки, цикл отрисовки, камера, вкладки, печать |
| `md/controls.js` | Управление как в `C:\dev`: пробел + тянуть, выбор детали, имя при наведении, «? Управление» |
| `md/views.js` | Ортогональные виды 3D-модели в PNG для листов, с подсветкой деталей |
| `md/sheet-kit.js` | Помощники листов: рамка, штамп, размерные линии, таблица (копия из `art/js/sheets.js` с правками) |
| `md/sheets.js` | Листы А3: общий вид, сборка, детали, спецификация, раскрой |
| `md/nest.js` | Раскладка деталей на лист 1250 × 2500 |
| `md/cards.js` | Карты деталей А4 |
| `vendor/three/` | `three.min.js`, `OrbitControls.js`, `CSS2DRenderer.js`, `LICENSE` |
| `fonts/` | `fonts.css`, woff2 (кириллица и латиница), лицензии OFL |
| `css/landing.css`, `css/md.css` | Стили лендинга (калька) и стили блоков движка |
| `index.html` | Новый лендинг целиком |
| `img/og.png` | Карточка ссылки 1200 × 630 |
| `tests/engine.js`, `tests/golden.json`, `tests/unit/*.test.js` | Стенд движка в Node, эталон, тесты расчётов |
| `package.json`, `playwright.config.js`, `tests/e2e/*.spec.js` | Тесты страницы в браузере |

Демо (`demo.html`, `js/`) не меняется.

---

### Task 1: Мангал из C:\dev на новой странице, цифры сверены с C:\dev

**Files:**
- Create: `md/params.js`, `md/parts.js`, `md/model.js`, `md/dims.js`, `md/cut.js`, `md/dxf.js` — побайтовые копии из `C:\dev\metal-designer\mangal\js\`
- Create: `vendor/three/three.min.js`, `vendor/three/OrbitControls.js`, `vendor/three/CSS2DRenderer.js`, `vendor/three/LICENSE`
- Create: `md/defaults.js`, `md/stats.js`, `md/landing.js`, `tests/engine.js`, `tests/golden.json`, `tests/unit/engine.test.js`
- Create: `fonts/fonts.css`, `fonts/*.woff2`, `fonts/OFL-Oswald.txt`, `fonts/OFL-GolosText.txt`, `fonts/OFL-JetBrainsMono.txt`, `css/landing.css`, `css/md.css`
- Create: `package.json`, `playwright.config.js`, `tests/e2e/first-screen.spec.js`
- Modify: `index.html` (переписать целиком), `.gitignore`

**Interfaces:**
- Produces в `tests/engine.js`: `loadEngine({dir = 'md', storage = {}, extra = []} = {}) -> {ev(expr: string): any}`.
  - Склеивает в один исходник (как `C:\dev\metal-designer\mangal\tools\smoke.js`) файлы движка из `dir` (`params, parts, model, dims, cut, dxf`), затем `md/defaults.js`, `md/stats.js` и файлы из `extra` (имена из `md/`, их добавляют следующие задачи). Выполняет всё в `vm` вместе с настоящим `vendor/three/three.min.js`.
  - DOM — заглушки: `getElementById` отдаёт объект с `innerHTML`, `appendChild`, `addEventListener`, `style`, `classList`; `querySelectorAll() → []`. У `<canvas>` (`createElement`/`createElementNS`) `getContext` возвращает `null`, поэтому `model.js` ловит ошибку WebGL и ставит `ok = false`.
  - `localStorage` читает и пишет `storage`.
- Produces в `md/defaults.js` — настройки лендинга, выполняются после движка: `S.rain = false`; у детали `tubes` в `PARTS` (группа `roof`) флаги `{rain: true}`, чтобы без крыши не было и трубок под стойки; затем `recompute()`.
- Produces в `md/stats.js`:
  - `cutList() -> Array<{grp: string} | {n: string, s: string, q: number, kg: number, note: string, pt: string[]}>` — строки раскроя с тем же отбором, что в `drawCut()` (`elOk`, `partOk`, `q > 0`); заголовок группы — перед первой видимой строкой группы; `kg = m * q`, округление до 0,001; `pt` — всегда массив;
  - `laserList() -> Array<{file, name, mm, q, w, h, cutMm, pierce, loops, circles, bends}>` из `laserParts()` и `partMM()`; `cutMm` — рез одной детали в мм до 0,1; `loops`, `circles`, `bends` — количества;
  - `statsData() -> {len, wid, top, t, kg, parts, cutM, holes, slots, wheels}`: `len = L1*10`, `wid = W*10`, `top = T*10`, `t = t*10` (мм); `kg` — сумма `cutList()`, округлённая до целого; `parts` — сумма `q` в `laserList()`; `cutM` — сумма `cutMm*q` в метрах до 0,1; `holes = holes().length*2`, `slots = slots().length*2`; `wheels = S.wheels`.
- Produces в `md/landing.js`:
  - `renderAll()` — `recompute()` → `build3D()` → панель цифр `#lstats`; задачи 2–10 дописывают сюда свои шаги;
  - `fitView()` — цель камеры в центр рамки `group`, расстояние — чтобы модель целиком влезала в `#stage`; направление взгляда — как у начальной камеры `model.js`.
- Разметка: шапка «Metal Designer для цеха · Виталий · Telegram»; заголовок первого экрана в одну строку (смысл «подогнали размер — проект готов», текст на исполнителе); `#stage` (при `!ok` внутри надпись «3D не открылось на этом устройстве — цифры и чертежи ниже работают»); `#lstats`; `a.btn-main` «Прислать описание изделия» → `https://t.me/SHVA_1984` (`target="_blank" rel="noopener"`); `.cta-bar` — та же кнопка, закреплена внизу экрана на ширине до 719 px.
- `#lstats` из `statsData()`: `800 × 420`, `верх 970`, `сталь 5 мм`, `≈ N кг`, `N деталей под лазер`, `рез N м`, `отверстий / прорезей 34 / 52`, `DXF готов`.
- `package.json`: `{"private": true, "scripts": {"test": "node --test tests/unit/", "test:e2e": "playwright test"}, "devDependencies": {"@playwright/test": "<точная версия>"}}`.
- `playwright.config.js`: `testDir: 'tests/e2e'`, `webServer: {command: 'python -m http.server 8000', url: 'http://localhost:8000/', reuseExistingServer: true}`, `use.baseURL: 'http://localhost:8000/'`, проекты `desktop` (`viewport 1440 × 900`) и `phone` (`390 × 844`, `isMobile`, `hasTouch`), Chromium с WebGL через SwiftShader (`launchOptions.args: ['--enable-unsafe-swiftshader']`; если в тесте `ok === false` — подобрать флаги так, чтобы WebGL работал).

- [ ] **Step 1: Ветка**

Работа идёт в ветке `landing-v2-mangal` (уже создана, спека и план в ней): `git switch landing-v2-mangal`.

- [ ] **Step 2: Скопировать движок, сверить копии**

`cp` шести файлов из `C:/dev/metal-designer/mangal/js/` в `md/`.
Run: `for f in params parts model dims cut dxf; do cmp md/$f.js C:/dev/metal-designer/mangal/js/$f.js; done`
Expected: пустой вывод.

- [ ] **Step 3: Скачать three.js r128 и лицензию**

URL — те же, что в `C:\dev\metal-designer\mangal\index.html`:
- `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`
- `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/renderers/CSS2DRenderer.js`
- `https://raw.githubusercontent.com/mrdoob/three.js/r128/LICENSE`

Run: `node -e "console.log(require('./vendor/three/three.min.js').REVISION)"`
Expected: `128`

- [ ] **Step 4: Тест эталона**

```js
// tests/unit/engine.test.js
// golden: snapshot(loadEngine({dir: 'C:/dev/metal-designer/mangal/js'}))  ← C:\dev только читается
//         deepEqual snapshot(loadEngine()) и deepEqual JSON из tests/golden.json
//   где snapshot(e) = {cut: e.ev('cutList()'), laser: e.ev('laserList()'), stats: e.ev('statsData()')}
// shape: в эталоне 8 деталей под лазер — grill_side_back, grill_side_front, grill_bottom, grill_end_right,
//        grill_end_left, grill_air_slider (q 2), leg_mount_plate (q 4), wheel_pad (q 4);
//        stats.len 800, wid 420, top 970, t 5, parts 15, holes 34, slots 52;
//        в cut есть {n: 'Дно жаровни', s: '800 × 420'}; нет строк с pt 'tubes', 'bars', 'sheet' и строк печи
```

Эталон записывается один раз: `UPDATE_GOLDEN=1 node --test tests/unit/` пишет `tests/golden.json` из снимка `C:\dev`.

- [ ] **Step 5: Тест падает**

Run: `node --test tests/unit/`
Expected: FAIL `Cannot find module '../engine.js'`

- [ ] **Step 6: Написать `md/defaults.js`, `md/stats.js`, `tests/engine.js`, `package.json`; записать эталон**

Run: `UPDATE_GOLDEN=1 node --test tests/unit/`, затем `node --test tests/unit/`
Expected: оба запуска `pass`; в `tests/golden.json` нет «Трубка Ø26×3».

- [ ] **Step 7: Playwright и тест первого экрана**

Run: `NODE_OPTIONS=--use-system-ca npm i -D @playwright/test@latest && NODE_OPTIONS=--use-system-ca npx playwright install chromium`
Затем в `package.json` закрепить точную версию (без `^`), в `.gitignore` добавить `node_modules/`, `test-results/`, `playwright-report/`.

```js
// tests/e2e/first-screen.spec.js
// loads: page.evaluate(() => ok) === true; #lstats содержит '800 × 420', 'верх 970', 'сталь 5 мм', '34 / 52'
//        и '≈ N кг', где N === statsData().kg
// layout (phone): #stage не выше 0.55 * innerHeight; documentElement.scrollWidth <= innerWidth
// offline: все сетевые запросы страницы — на localhost:8000
// console: за время теста нет 'pageerror' и console.error
// noWebGL: page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null }) —
//          в #stage надпись про 3D, #lstats заполнена, нет 'pageerror'
```

Run: `npx playwright test`
Expected: FAIL (на странице старый лендинг, `ok` не определён)

- [ ] **Step 8: Шрифты**

Запросить `https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap` с User-Agent Chrome (иначе Google отдаёт не woff2). Оставить блоки `@font-face` только для `cyrillic` и `latin`, скачать файлы, на которые они ссылаются, в `fonts/`, адреса в `fonts/fonts.css` сделать относительными. Лицензии — `https://raw.githubusercontent.com/google/fonts/main/ofl/{oswald,golostext,jetbrainsmono}/OFL.txt`.
Run: `grep -c "fonts.gstatic" fonts/fonts.css`
Expected: `0`

- [ ] **Step 9: Стили, `index.html`, `md/landing.js`**

- `css/md.css` — из `C:\dev\metal-designer\mangal\css\style.css` правила для подписей размеров на модели, `.stats/.stat`, вкладок (`[role=tab]`, `.tabpane`, `.tabnote`), таблиц (`.tbl`, `th`, `td`, `.grp`, `.tot`, `.n`, `.r`, `small`), эскизов (`.dxfsk` и эскизов раскроя), списка размеров (`.dimgrid`, `.dg`, `.chk`, `.dimbar`, `.dxfmsg`), `.buy`, подсказки управления. Шрифты: `--f-display: Oswald` (заголовки), `--f-body: 'Golos Text'` (текст), `--f-mono: 'JetBrains Mono'` (цифры и подписи), как в `C:\dev`.
- `css/landing.css` — калька и цвета из нынешнего `index.html` (`:root`, фон-сетка) плюс шапка, первый экран, `.cta-bar`. `#stage` на ширине до 719 px — `height: min(55svh, 420px)`.
- `index.html`: голова — `<title>Metal Designer для цеха</title>`, `lang="ru"`, `viewport`, `fonts/fonts.css`, оба CSS; тело — разметка из Interfaces; скрипты в конце `body`: `vendor/three/*` → `md/params.js, parts.js, model.js, dims.js, cut.js, dxf.js, defaults.js, stats.js` → `md/landing.js`.
- `md/landing.js`: `ResizeObserver` на `#stage` и цикл `requestAnimationFrame` (`controls.update()`, `renderer.render`, `labels.render`) — по образцу `sizeStage()` и цикла в `C:\dev\metal-designer\mangal\js\ui.js`; при загрузке `renderAll()` и `fitView()`.

- [ ] **Step 10: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed` в обоих проектах.

- [ ] **Step 11: Commit**

```bash
git add md vendor fonts css tests index.html package.json package-lock.json playwright.config.js .gitignore
git commit -m "Лендинг v2: мангал из C:\dev на новой странице, цифры сверены с C:\dev"
```

---

### Task 2: Длина, ширина, высота ползунками

**Files:**
- Modify: `md/params.js`, `md/cut.js` (строки, где размер зашит текстом), `md/landing.js`, `index.html`
- Create: `tests/unit/size.test.js`, `tests/e2e/sliders.spec.js`

**Interfaces:**
- Consumes: `loadEngine`, `cutList`, `laserList`, `statsData`, `renderAll`, `fitView` (задача 1).
- Produces в `md/params.js`:
  - `SIZE = {len: {min: 400, max: 1200, step: 10, def: 800}, wid: {min: 250, max: 500, step: 10, def: 420}, top: {min: 800, max: 1100, step: 10, def: 970}}` — мм; задача 3 добавит `t` и `deep`;
  - `setSize({len, wid, top})` — мм → `L1 = len/10`, `W = wid/10`, `TOPH = top/10`, `S.wheels = wid >= 300`, затем `recompute()`;
  - `deriveSize()` — пересчёт всего, что зависит от `L1` и `W`; первая строка `recompute()`.
- Produces в `md/landing.js`: `state = {len, wid, top}` (из `SIZE.*.def`); `renderAll()` начинается с `setSize(state)`.
- Разметка: `input[type=range]#sLen`, `#sWid`, `#sTop` с `min/max/step` из `SIZE` и подписями «Длина», «Ширина», «Высота» со значением в мм.

- [ ] **Step 1: Тесты**

```js
// tests/unit/size.test.js
// default: setSize({len:800, wid:420, top:970}) → снимок deepEqual tests/golden.json
// grid: len ∈ {400,500,800,1200} × wid ∈ {250,300,500}, top 1100:
//   в JSON снимка нет 'NaN' и 'undefined'; у каждой laser w > 0 и h > 0;
//   каждый контур partMM(p).loops замкнут (первая точка = последняя)
// rows (при 1000 × 500 и при 400 × 250, мм):
//   'Дно жаровни'                          s === `${len} × ${wid}`
//   'Боковина жаровни (задняя и передняя)' s.startsWith(`${len} × `)
//   'Задвижка поддува (планка)'            s === `${len-20} × 30 × 3`
//   'Уголок 30×30×4 — опора колосника'     s === `L ${len-20}`
//   'Уголок 30×30×3 в жаровне'             s === `L ${len/8}`
//   'Решётка сверху'                       s === `${len/2} × ${wid-20}`
// deep: DEEP_X.length === Math.round(len/200) (400→2, 500→3, 800→4, 1200→6);
//       DEEP_X по возрастанию, шаг 5 см, последняя = L1-10; все > GA_XS[1]+GA_L (правее уголков)
// wheels: wid 290 → нет строк с pt 'wheels' и 'pads', нет 'wheel_pad' в laser, есть 'Пятка ножки без колеса' (q 4);
//         wid 300 → колёса есть
// hooks: AIR_HOOK[0] > AIR_X0 && AIR_HOOK[1] < AIR_X0 + AIR_L
// mass: при wid 420 kg растёт с len: 400 < 800 < 1200
// stale: при 1000 × 500 в JSON cutList() нет '780', '400 × 400', '× 420'
// unit: loadEngine({storage: {'md-unit': 'cm'}}).ev('u(80)') === '800'
// tests/e2e/sliders.spec.js
// sliders: #sLen → 1200 — число кг в #lstats растёт; модель целиком в кадре (рамка group в проекции камеры внутри [-1, 1])
// extremes: #sLen 400 и 1200, #sWid 250 и 500, #sTop 800 и 1100 — нет 'pageerror'; при #sWid 280 statsData().wheels === false
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL `setSize is not defined`

- [ ] **Step 3: Переменные размеры в `md/params.js`**

`L1` и `W` выносятся из общей строки констант в `let L1=80, W=42;`. В `let` и в `deriveSize()` переводятся все значения, которые при загрузке читают `L1` или `W`, с прежними формулами: `HBZ, ZK0, ZK1, DR_Z, SH_ZL, SH_ZR, LEGS_K, LEGS_M, GR_RZ, GRL_W, GA_Z, MAN_Z, CG_W, CG_L, CA_L, CA_X0`. Проверка после правки: `grep -nE "^(const|let) " md/params.js` — ни одна оставшаяся `const` не читает переведённые имена.

Новые правила (при 800 × 420 дают ровно нынешние числа):

```js
const k = L1/80;                                   // всё «слева» — пропорционально длине
GA_XS = [10*k, 30*k]; GA_X0 = 10*k; GA_L = 10*k;   // уголки в жаровне: 10–20 и 30–40 см
GN_X = 25*k;                                       // вырез под ручку решётки
GRL_X0 = GN_X - 20*k; GRL_L = 40*k;                // низкая решётка
G2_L = L1/2; G2_W = W-2;                           // две решётки сверху: 400 × 400
const n = Math.round(L1/20);                       // глубоких прорезей: 4 при 80 см
DEEP_X = Array.from({length: n}, (_, i) => L1-10-5*(n-1-i));   // 55, 60, 65, 70 — по возрастанию
AIR_L = L1-6;                                      // задвижка поддува: 74
const h = Math.round((holes()[1]+holes()[2])/2*10)/10;
AIR_HOOK = [h, L1-h];                              // скобы: 10,8 и 69,2
```

Колёса: в `legsList()` для `S.mode === 'grill'` флаг колеса — `S.wheels ? 1 : 0` (тормоз как сейчас), тогда без колёс ножки идут на пятках, как в `C:\dev`. Единицы: `let UNIT='mm';` без чтения `localStorage`. Строки раскроя в `md/cut.js`, где размер написан текстом (`'400 × 400'` и подобные), — на переменные.

- [ ] **Step 4: Ползунки на странице**

Ползунок → `state` → `renderAll()` → `fitView()`.

- [ ] **Step 5: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed`, включая эталон по умолчанию.

- [ ] **Step 6: Commit**

```bash
git add md tests index.html
git commit -m "Лендинг v2: длина, ширина, высота ползунками; решётки, задвижки, прорези и колёса по правилам спеки"
```

---

### Task 3: Толщина 2–6 мм и галочка «Глубокие прорези»

**Files:**
- Modify: `md/params.js`, `md/cut.js`, `md/dxf.js`, `md/landing.js`, `index.html`
- Create: `tests/unit/thickness.test.js`, `tests/e2e/thickness.spec.js`

**Interfaces:**
- Consumes: `SIZE`, `setSize`, `deriveSize`, `state` (задача 2).
- Produces:
  - `SIZE.t = {options: [2, 3, 4, 5, 6], def: 5}`, `SIZE.deep = {options: [0, 1], def: 1}`;
  - `setSize({len, wid, top, t, deep})` — дополнительно `t = t/10` (переменная движка), `S.deep = !!deep`;
  - `deriveSize()` пересчитывает и всё, что читает `t`: `PCX, STR, GR_W, GP_W` и значения из задачи 2, где есть `t`;
  - `state = {len, wid, top, t, deep}`.
- Разметка: переключатель толщины `#sT` (кнопки «2 мм» … «6 мм», `aria-pressed`); галочка `#cDeep` «Глубокие прорези» (включена).

- [ ] **Step 1: Тесты**

```js
// tests/unit/thickness.test.js
// default: setSize({len:800, wid:420, top:970, t:5, deep:1}) → снимок deepEqual tests/golden.json
// grid: t ∈ {2,6} × deep ∈ {0,1} при 400 × 250 и 1200 × 500 — нет 'NaN', контуры замкнуты
// thick: при t 3 масса 'Дно жаровни' === 7.913 (800 × 420 × 3 × 7,85e-6), файл дна 'grill_bottom_3mm_x1.dxf';
//        'leg_mount_plate' остаётся 5 мм, 'wheel_pad' 6 мм, 'grill_air_slider' 3 мм
// mass: при 800 × 420 kg растёт с t: 2 < 5 < 6
// deep: при deep 0 DEEP_X в контуре боковины не участвует — врезок у 'grill_side_front' меньше, чем при deep 1
// tests/e2e/thickness.spec.js
// thickness: кнопка «3 мм» — кг падает, в #lstats 'сталь 3 мм'
// deep: снять #cDeep — прорезей на модели нет, statsData() пересчитан, нет 'pageerror'
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL (`setSize` не меняет толщину)

- [ ] **Step 3: Толщина в движке**

`t` выносится в `let t=0.5;`. Массы боковин, дна и торцов в `md/cut.js` считаются от `t` (`t*7.85/1000` вместо `SH`); площадки под ножки остаются 5 мм (`SH`). В `laserParts()` (`md/dxf.js`) у боковин, дна и торцов толщина `t*10` вместо `5`.

- [ ] **Step 4: Переключатель и галочка на странице**

- [ ] **Step 5: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed`

- [ ] **Step 6: Commit**

```bash
git add md tests index.html
git commit -m "Лендинг v2: толщина металла 2–6 мм и галочка глубоких прорезей"
```

---

### Task 4: Ссылка с размерами

**Files:**
- Create: `md/link.js`, `tests/unit/link.test.js`, `tests/e2e/link.spec.js`
- Modify: `md/landing.js`, `index.html` (скрипт)

**Interfaces:**
- Consumes: `SIZE`, `state`, `renderAll` (задачи 2, 3).
- Produces в `md/link.js` (чистые функции, по образцу `js/link.js` песочницы):
  - `readLink(hash: string) -> {len, wid, top, t, deep}` — каждое значение проверяется по `SIZE`: целое, в диапазоне и кратно шагу, либо из `options`; иначе берётся `def`;
  - `linkHash(state) -> string` — `'#len=1000&wid=500&top=900&t=4&deep=0'`, ключи всегда в этом порядке.
- В `md/landing.js`: при загрузке `state = readLink(location.hash)`; `renderAll()` в конце делает `history.replaceState(null, '', linkHash(state))`.

- [ ] **Step 1: Тесты**

```js
// tests/unit/link.test.js  (loadEngine({extra: ['link']}))
// roundTrip: readLink(linkHash({len:1000,wid:500,top:900,t:4,deep:0})) deepEqual тому же объекту
// exact: linkHash({len:1000,wid:500,top:900,t:4,deep:0}) === '#len=1000&wid=500&top=900&t=4&deep=0'
// badLink: readLink('#len=abc&wid=99999&top=905&t=7&deep=2') deepEqual {len:800,wid:420,top:970,t:5,deep:1}
// partial: readLink('#len=600') deepEqual {len:600,wid:420,top:970,t:5,deep:1}; readLink('') — всё по умолчанию
// tests/e2e/link.spec.js
// link: открыть '/#len=600&wid=280&top=900&t=4&deep=0' — ползунки 600, 280, 900; толщина 4 мм; галочка снята; колёс нет
// write: #sLen → 1200 — адрес содержит 'len=1200'
// badLink: открыть '/#len=abc' — ползунок длины 800, нет 'pageerror' и console.error
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL `readLink is not defined`

- [ ] **Step 3: Написать `md/link.js`, подключить на странице**

- [ ] **Step 4: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed`

- [ ] **Step 5: Commit**

```bash
git add md tests index.html
git commit -m "Лендинг v2: ссылка с размерами мангала"
```

---

### Task 5: Управление как в C:\dev и выбор деталей

**Files:**
- Create: `md/controls.js`, `tests/e2e/controls.spec.js`
- Modify: `index.html` (подсказка «? Управление», плашка выбранной детали), `md/landing.js`

**Interfaces:**
- Consumes: `renderAll`, `fitView` (задача 1); глобалы движка `S.sel, selParts, inSel, partName, elOf, PART_SET, build3D, group, camera, controls, renderer`.
- Produces в `md/controls.js` (перенос из `C:\dev\metal-designer\mangal\js\ui.js`, функции с теми же именами, где это возможно):
  - пробел + тянуть — сдвиг (`spacePan`); правая кнопка + тянуть — сдвиг (OrbitControls); колесо — зум;
  - `partAt(ev) -> string | null` — деталь под курсором или пальцем (raycaster по `group`);
  - `applySel(part: string | null)` — выбор детали: `S.sel`, затем `renderAll()`; плашка «Показана деталь: … ✕»;
  - `fitSel()`, `flyTo(p, target)` — камера к выбранной детали, как в `C:\dev`;
  - клик по детали — `applySel(part)`; двойной клик по пустому — `applySel(null)`; наведение — имя детали в подсказке у курсора; касание на телефоне — выбор;
  - подсказка «? Управление» — тот же текст, что в `C:\dev\metal-designer\mangal\index.html` (мышь, телефон), без строк про «Поделиться видом» и «Настройки».

- [ ] **Step 1: Тесты**

```js
// tests/e2e/controls.spec.js  (desktop)
// zoom: колесо над #stage меняет camera.position.distanceTo(controls.target)
// pick: клик по центру #stage → S.sel.part !== null, плашка выбранной детали видна
// reset: двойной клик по пустому углу #stage → S.sel.part === null, плашка скрыта
// hover: наведение на центр модели — подсказка с именем детали не пустая
// help: кнопка «? Управление» открывает окно с 'Колесо' и 'Один палец'
// (phone) tap: касание центра #stage → S.sel.part !== null
```

- [ ] **Step 2: Тесты падают**

Run: `npx playwright test tests/e2e/controls.spec.js`
Expected: FAIL (выбора деталей ещё нет)

- [ ] **Step 3: Написать `md/controls.js`, подключить после `md/landing.js`**

- [ ] **Step 4: Тесты проходят**

Run: `npx playwright test`
Expected: `passed`

- [ ] **Step 5: Commit**

```bash
git add md index.html tests
git commit -m "Лендинг v2: управление как в C:\dev — зум, сдвиг, выбор детали, подсказка"
```

---

### Task 6: Вкладки «Размеры», «Раскрой и масса», «Лазер · DXF»

**Files:**
- Modify: `index.html` (раздел «Что получаете»), `md/landing.js`
- Create: `tests/unit/dxf.test.js`, `tests/e2e/tabs.spec.js`

**Interfaces:**
- Consumes: `renderAll`, `state` (задачи 1–3), `applySel` (задача 5); `dimList, dimVisible, drawCut, drawDxf, saveAll, laserParts, partMM, dxfText` (движок).
- Produces в `md/landing.js`: `showTab(name: 'dims' | 'cut' | 'dxf' | 'sheets' | 'cards')`; `renderAll()` дополняется вызовами `dimList()` и `drawCut()` (`drawDxf()` уже вызывает `build3D()`).
- Разметка (id — как ждёт движок): `#dimList`, `#dAll`, `#dNone`; `#cut`, `#metal`, скрытый `#stats` (его заполняет `drawCut`, на странице цифры берутся из `#lstats`); `#dxfAll` («Скачать все (ZIP)»), `#dxfMsg`, `#dxfTbl`.
- На модели по умолчанию три размера — по ползункам: `S.dims = new Set(['l80', 'w39', 'top'])`.

- [ ] **Step 1: Тесты**

```js
// tests/unit/dxf.test.js
// dims: dimVisible().map(r => r.id) содержит 'l80', 'w39', 'top'
// dxf: для каждой p из laserParts() текст dxfText(partMM(p)) содержит 'AC1009' и 'CUT', заканчивается на 'EOF\r\n'
// tests/e2e/tabs.spec.js
// tabs: вкладки переключаются, на модели три подписи размеров; после #sLen → 1000 подпись длины '1000'
// cut: при 1000 × 500 в #cut есть 'Дно жаровни' и '1000 × 500'; в #metal есть 'Лист 5 мм'
// sel: после applySel('gBot') в #cut только строки дна и итог
// zip: «Скачать все (ZIP)» → загрузка 'mangal_dxf_8_detaley.zip'
// layout (phone): таблицы прокручиваются внутри своего блока, documentElement.scrollWidth <= innerWidth
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/ && npx playwright test tests/e2e/tabs.spec.js`
Expected: юнит-тесты `pass` (движок это умеет); e2e FAIL (вкладок нет)

- [ ] **Step 3: Разметка и обработчики**

Обработчики `#dimList` (`change`), `#dAll`, `#dNone` — по образцу `ui.js` в `C:\dev`.

- [ ] **Step 4: Тесты проходят**

Run: `npx playwright test`
Expected: `passed`

- [ ] **Step 5: Commit**

```bash
git add index.html md tests
git commit -m "Лендинг v2: вкладки «Размеры», «Раскрой и масса», «Лазер · DXF»"
```

---

### Task 7: Чертежи — общий вид и спецификация, печать в PDF

**Files:**
- Create: `md/views.js`, `md/sheet-kit.js`, `md/sheets.js`, `tests/unit/sheets.test.js`, `tests/e2e/sheets.spec.js`
- Modify: `md/cut.js` (вынести `metalRows()`), `md/landing.js`, `index.html` (вкладка «Чертежи», `#printBox`, скрипты), `css/md.css` (печать)

**Interfaces:**
- Consumes: `cutList, statsData` (задача 1); `showTab` (задача 6); `group, scene, ok, T, L1, W, H1, HX, XL, XR` (движок).
- Produces в `md/views.js`:
  - `VIEWS` — `front {r:[1,0,0], up:[0,1,0], d:[0,0,1]}`, `left {r:[0,0,1], up:[0,1,0], d:[-1,0,0]}`, `top {r:[1,0,0], up:[0,0,-1], d:[0,1,0]}`, `iso` с `d = norm([1, .75, 1.5])` — как в `art/js/sheets.js`;
  - `modelBoxMm(view) -> {w, h} | null` — габарит проекции модели в мм;
  - `renderView(view, scale, {pxPerMm = 8, highlight = null, hide = null} = {}) -> {url, wMm, hMm, toPaper([x,y,z]) -> [xMm, yMm]} | null` — PNG вида в масштабе `1:scale`. `highlight` — множество id деталей, залитых акцентом `#c4480c`, остальные белые; `hide` — множество id, которых на снимке нет; `toPaper` переводит точку модели (см) в мм бумаги от левого верхнего угла картинки.
  - Как рисуется: отдельный `WebGLRenderer({antialias: true, preserveDrawingBuffer: true})`, создаётся один раз; `OrthographicCamera` по рамке `group`; на время снимка у мешей временные материалы — белый `MeshBasicMaterial` с `polygonOffset` (подсвеченные — цвета акцента); рёбра — `LineSegments(EdgesGeometry(mesh.geometry, 25))` цвета `#1c2a40` для видимых мешей `group`, кроме `userData.dim`. Всё, что не `group` (земля), на время снимка скрыто. После снимка всё возвращается, рёбра удаляются. Id детали меша — `userData.part`.
- Produces в `md/cut.js`: `metalRows() -> Array<[name: string, qty: string, where: string]>` — массив `mt`, который сейчас строится внутри `drawCut()`; `drawCut()` берёт его отсюда.
- Produces в `md/sheet-kit.js`: `r2, shEsc, SCALES, pickScale, scaleTxt, arrow, dimH, dimV, svgTable, SH_STYLE, stamp, wrapSheet, wrapA4, shDate` — копия из `C:\dev\metal-designer\art\js\sheets.js` (строки 4–37, 233, 239), без глобалов фигуры (`ST`, `CUR`): название, масса и металл приходят в `b` (`b.name`, `b.mass`, `b.metal`); ячейка `email` → «Разработка: Metal Designer для цеха».
- Produces в `md/sheets.js`: `buildSheets() -> Array<{title: string, svg: string}>` — в этой задаче листы «Общий вид» и «Спецификация»; задачи 8 и 9 вставляют свои, итоговый порядок: общий вид → сборка → детали → спецификация → раскрой.
- Produces в `md/landing.js`: `printSheets(list, a4: boolean)` — по образцу `printSvgs` в `art/js/ui.js` (`#printBox`, `@page A3 landscape` или `A4 portrait`, `window.print()`, уборка по `afterprint`).
- Лист «Общий вид»: виды спереди, слева (справа от главного), сверху (под главным), изометрия; масштаб — `pickScale` по `modelBoxMm`; размеры — длина жаровни `L1`, общая длина `XR()+HX-XL()`, ширина `W`, высота верха `T`, глубина жаровни `H1` (`dimH/dimV`, точки через `toPaper`); техтребования — толщины листов из `metalRows()`, «Масса металла ≈ N кг», «*Размеры для справок». Без WebGL вместо видов надпись «Общий вид недоступен без 3D на этом устройстве».
- Лист «Спецификация», сколько нужно: `svgTable`, колонки «Поз.», «Наименование», «Размер, мм», «Кол.», «Масса, кг», 32 строки на лист, заголовки групп из `cutList()` отдельной строкой; на последнем — «Итого металла ≈ N кг» и список «Металл» из `metalRows()`.
- Штамп: «Мангал L × W × H, t мм» (из `statsData`), масштаб, масса, лист `n` из `N`, дата `shDate()`.
- Вкладка «Чертежи»: превью листов (SVG во всю ширину блока) и кнопка «PDF для печати» → `printSheets(buildSheets(), false)`. Листы строятся при открытии вкладки и после смены настроек, если вкладка открыта.

- [ ] **Step 1: Тесты**

```js
// tests/unit/sheets.test.js  (extra: ['views', 'sheet-kit', 'sheets'])
// golden: после выноса metalRows() снимок по умолчанию по-прежнему deepEqual tests/golden.json
// noWebGL: renderView('front', 10) === null && modelBoxMm('front') === null; первый лист содержит 'Общий вид недоступен'
// count: buildSheets().length === 1 + Math.ceil(rows / 32), rows — длина cutList() вместе с заголовками групп
// a3: каждая svg содержит 'viewBox="0 0 420 297"'
// spec: первые 15 символов каждого n из cutList() (после shEsc) есть в листах спецификации
// stamp: первый лист содержит 'Мангал 800 × 420 × 970, 5 мм'
// tests/e2e/sheets.spec.js
// png: renderView('front', 10).url начинается с 'data:image/png'
// scale: расстояние между toPaper([0,0,0]) и toPaper([L1,0,0]) === L1 мм ± 0,01
// restore: после renderView('iso', 10, {highlight: new Set(['gBot'])}) скриншот #stage совпадает со снятым до него
// views: на первом листе 4 <image> с 'data:image/png'; при 1000 × 500 × 900 на листе есть '1000', '500', '900'
// print: emulateMedia({media: 'print'}) после printSheets — видны только листы, каждый 420 × 297 мм
// layout (phone): превью листов без горизонтальной прокрутки страницы
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL `renderView is not defined`

- [ ] **Step 3: Написать `md/views.js`, вынести `metalRows()`, написать `sheet-kit.js` и `sheets.js`, вкладку «Чертежи»**

- [ ] **Step 4: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed`

- [ ] **Step 5: Commit**

```bash
git add md tests index.html css
git commit -m "Лендинг v2: чертежи — виды модели, общий вид и спецификация, печать в PDF"
```

---

### Task 8: Чертежи — порядок сборки и детали

**Files:**
- Modify: `md/sheets.js`, `tests/unit/sheets.test.js`, `tests/e2e/sheets.spec.js`

**Interfaces:**
- Consumes: `renderView` с `highlight`/`hide`, `wrapSheet, dimH, dimV, svgTable` (задача 7); `laserParts, partMM, dxfName` (движок).
- Produces в `md/sheets.js`:
  - `ASM_STEPS` — 8 шагов из спеки, у каждого `{title, parts: string[]}` (id деталей из `userData.part`):
    1. «Дно и боковины» — `gBot, side0, side1`;
    2. «Торцы» — `gEnd, gEnd0`;
    3. «Уголки в жаровне и опоры колосника» — `gAng` и уголки колосника;
    4. «Площадки и патрубки ножек — к дну»;
    5. «Ножки, площадки колёс, колёса» — `legs, pads, wheels` (без колёс — `feet`);
    6. «Скобы и задвижки поддува» — `hook, air`;
    7. «Ручка» — `handle`;
    8. «Колосник и решётки — кладутся» — колосник, `g2` и другие решётки.

    Точные id шагов 3, 4 и 8 — по меткам `tag(...)` в `md/model.js`. Если площадки и патрубки ножек не отделяются от ножек по id, шаги 4 и 5 объединяются, и Виталию об этом говорится в отчёте задачи.
  - `asmSteps() -> Array<{title, parts: string[]}>` — `ASM_STEPS` без деталей, которых нет в текущей модели, и без пустых шагов;
  - листы «Порядок сборки» — по 4 шага на лист А3: изометрия, детали шага подсвечены, детали прошлых шагов белые, будущих нет (`hide`); под видом — номер, название шага и список деталей;
  - листы «Детали» — развёртки всех `laserParts()` (контуры, отверстия, гибы пунктиром) с габаритными размерами, `N отв. Ø D`, толщиной и количеством; деталей на лист — сколько влезает в масштабе листа.

- [ ] **Step 1: Тесты** (дописать)

```js
// cover: каждый id детали, который есть в текущей модели (части group, кроме userData.dim),
//        встречается ровно в одном шаге asmSteps(); проверить при 800 × 420 и при wid 280 (без колёс)
// order: заголовки шагов — в порядке спеки
// details: в листах «Детали» есть имя каждой детали laserParts() и её габарит `${w} × ${h}`
// sheetsOrder: заголовки buildSheets() идут: общий вид → сборка → детали → спецификация
// e2e: на листе сборки по одной картинке 'data:image/png' на шаг
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL `asmSteps is not defined`

- [ ] **Step 3: Дописать `md/sheets.js`**

- [ ] **Step 4: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test tests/e2e/sheets.spec.js`
Expected: `pass` / `passed`

- [ ] **Step 5: Commit**

```bash
git add md tests
git commit -m "Лендинг v2: чертежи — порядок сборки и детали"
```

---

### Task 9: Чертежи — раскрой на лист 1250 × 2500

**Files:**
- Create: `md/nest.js`, `tests/unit/nest.test.js`
- Modify: `md/sheets.js`, `index.html` (скрипт)

**Interfaces:**
- Consumes: `laserParts, partMM` (движок); `wrapSheet` (задача 7).
- Produces:
  - `md/nest.js`: `nest(items: Array<{id, w, h, q}>, sheet = {w: 2500, h: 1250}, gap = 10) -> Array<{sheet: number, id, x, y, w, h, rot: boolean}>` — раскладка рамок деталей по полосам (детали по убыванию высоты, поворот на 90°, если так влезает лучше); каждый экземпляр (`q`) — отдельная запись;
  - `md/sheets.js`: листы «Раскрой» — по листу А3 на каждый лист металла 1250 × 2500 каждой толщины: контуры деталей (из `partMM`) на своих местах с номерами позиций, подпись «Лист N мм, 1250 × 2500, № i из K», заполнение в %.

- [ ] **Step 1: Тесты**

```js
// tests/unit/nest.test.js  (extra: [..., 'nest'])
// all: для каждой толщины число размещённых записей === сумме q деталей этой толщины
// inside: каждая рамка (с учётом rot) внутри листа 2500 × 1250 с отступом gap от края
// noOverlap: рамки на одном листе не пересекаются (с зазором gap)
// group: детали разных толщин не лежат на одном листе
// default: при 800 × 420 × 5 все детали 5 мм помещаются на 1 лист
// sheets: в buildSheets() есть лист 'Раскрой' на каждую толщину; при t 3 — лист с 'Лист 3 мм'
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL `nest is not defined`

- [ ] **Step 3: Написать `md/nest.js`, листы «Раскрой», подключить скрипт**

- [ ] **Step 4: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed`

- [ ] **Step 5: Commit**

```bash
git add md tests index.html
git commit -m "Лендинг v2: чертежи — раскрой на лист 1250 × 2500 по толщинам"
```

---

### Task 10: Карты деталей А4

**Files:**
- Create: `md/cards.js`, `tests/unit/cards.test.js`, `tests/e2e/cards.spec.js`
- Modify: `md/landing.js`, `index.html` (вкладка «Карты деталей», скрипт)

**Interfaces:**
- Consumes: `wrapA4, stamp, dimH, dimV, shEsc, shDate`, `printSheets` (задача 7); `state` с толщиной (задача 3); `laserParts, partMM, dxfName, fmt` (движок).
- Produces в `md/cards.js`:
  - `partKg(m, mm) -> number` — масса детали: площадь самого большого контура минус остальные контуры и отверстия `π r²`, умножить на толщину и 7,85 г/см³;
  - `buildCards() -> Array<{title: string, svg: string}>` — карта А4 на каждую деталь `laserParts()`: название, имя файла `dxfName(p)`, лист `p.mm` мм, кол-во `p.q`, габарит `w × h`, рез на 1 шт в м, врезок, масса 1 шт; чертёж детали (контуры, отверстия, гибы пунктиром) вписан в поле 170 × 150 мм с габаритными размерами; при отверстиях подпись `N отв. Ø D`; штамп.
- Вкладка «Карты деталей»: превью карт и кнопка «PDF для печати» → `printSheets(buildCards(), true)`.

- [ ] **Step 1: Тесты**

```js
// tests/unit/cards.test.js  (extra: [..., 'cards'])
// count: buildCards().length === laserParts().length (8 по умолчанию)
// a4: каждая svg содержит 'viewBox="0 0 210 297"'
// bottom: карта 'grill_bottom' содержит '800 × 420' и '13,19'   // 800 × 420 × 5 мм × 7,85 = 13,19 кг
// side: масса боковины < 6,123 кг (сплошной лист 800 × 195 × 5) и > 5,5 — отверстия и прорези вычтены
// thick: при t 3 карта дна содержит '3 мм' и '7,91'
// tests/e2e/cards.spec.js
// preview: во вкладке 8 карт; при 1000 × 500 на карте дна '1000 × 500'
// print: в режиме печати каждая карта 210 × 297 мм
```

- [ ] **Step 2: Тесты падают**

Run: `node --test tests/unit/`
Expected: FAIL `buildCards is not defined`

- [ ] **Step 3: Написать `md/cards.js` и вкладку**

- [ ] **Step 4: Тесты проходят**

Run: `node --test tests/unit/ && npx playwright test`
Expected: `pass` / `passed`

- [ ] **Step 5: Commit**

```bash
git add md tests index.html
git commit -m "Лендинг v2: карты деталей А4"
```

---

### Task 11: Сравнение с проектировщиком, шаги, контакты, карточка ссылки

**Files:**
- Modify: `index.html`, `css/landing.css`
- Create: `img/og.png`, `tests/e2e/blocks.spec.js`

**Interfaces:**
- Consumes: первый экран с ползунками (задача 2) — для картинки карточки.
- Тексты — дословно из спеки: раздел «4. Сейчас / с Metal Designer» (таблица из 6 строк) и «5. Как работаем» (4 шага). Строка под шагами: «Обычно 1 день. Срочно сделаю быстрее. Бесплатно, пока запускаюсь».
- Контакты (шапка и блок «Виталий»): имя; Telegram `https://t.me/SHVA_1984`; телефон (`tel:`) и Viber (`viber://chat?number=%2B…`) — когда Виталий даст номер; до тех пор их разметки нет. Кнопка «Прислать описание изделия».
- Мета: `og:title` «Metal Designer для цеха»; `og:description` «Мангал под размер клиента: двигаете размеры — 3D, раскрой, чертежи и DXF пересчитываются сразу»; `og:image` `https://vitalishaklach.github.io/metal-designer-landing/img/og.png`; `og:url` `https://vitalishaklach.github.io/metal-designer-landing/`; `og:type` `website`; `twitter:card` `summary_large_image`; `<meta name="description">` — тот же текст, что `og:description`.

- [ ] **Step 1: Тесты**

```js
// tests/e2e/blocks.spec.js
// copy: на странице есть 'Бесплатно, пока запускаюсь', все 6 строк таблицы и 4 шага — дословно из спеки
// noDemo: нет ни одной ссылки на 'demo.html'
// tg: не меньше 3 ссылок на https://t.me/SHVA_1984, у всех target="_blank" rel="noopener"
// og: og:image начинается с 'https://vitalishaklach.github.io/metal-designer-landing/'
// layout (phone): documentElement.scrollWidth <= innerWidth; .cta-bar видна после прокрутки вниз
//                 и не закрывает последнюю кнопку блока «Виталий»
```

- [ ] **Step 2: Тесты падают**

Run: `npx playwright test tests/e2e/blocks.spec.js`
Expected: FAIL (блоков ещё нет)

- [ ] **Step 3: Разделы, стили, мета**

На телефоне таблица — две колонки друг под другом, как в спеке.

- [ ] **Step 4: Картинка карточки**

Playwright: `browser_resize` 1200 × 630, `browser_evaluate` скрывает всё, кроме шапки, заголовка, `#stage` и `#lstats`, `browser_take_screenshot` → `img/og.png`.

- [ ] **Step 5: Проверка карточки (Review Focus 5)**

Run: `python -c "import struct;d=open('img/og.png','rb').read(24);print(struct.unpack('>II',d[16:24]))"` и `ls -l img/og.png`
Expected: `(1200, 630)`, размер меньше 1 МБ.

- [ ] **Step 6: Тесты проходят**

Run: `npx playwright test`
Expected: `passed`

- [ ] **Step 7: Commit**

```bash
git add index.html css img tests
git commit -m "Лендинг v2: сравнение с проектировщиком, шаги, контакты, карточка ссылки"
```

---

### Task 12: Финал — CLAUDE.md, полная проверка, сдача

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-20-landing-design.md` (первой строкой — «Заменена [спекой v2](2026-10-29-landing-v2-design.md)»)

- [ ] **Step 1: CLAUDE.md**

Обновить:
- описание лендинга («первый экран — 3D-мангал из движка `md/`»);
- правило про библиотеки («только копии в `vendor/` и `fonts/`, ничего со сторонних серверов»);
- «Что где лежит» (`md/`, `vendor/`, `fonts/`, `css/`, `tests/`, `package.json`);
- «`C:\dev\metal-designer` не трогаем: всё нужное копируем сюда»;
- проверку: `npm test` и `npx playwright test` (с `NODE_OPTIONS=--use-system-ca`), вместо «автотестов нет»;
- метку `?v=` для `md/*.js` и `css/*.css`.

- [ ] **Step 2: Финальная проверка**

Run: `npm test && npx playwright test`
Expected: `pass` / `passed` в обоих проектах.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs
git commit -m "Лендинг v2: CLAUDE.md под новый лендинг, старая спека помечена заменённой"
```

- [ ] **Step 4: Отдать Виталию**

Виталий открывает `http://localhost:8000/`, проверяет вид и цифры, сверяет пару размеров с товарищем. Влить `landing-v2-mangal` в `master` и `git push` — только по его команде. После публикации Виталий кидает ссылку себе в «Избранное» Telegram и смотрит карточку.
