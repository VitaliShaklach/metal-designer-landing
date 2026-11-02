# Редактор: переезд из C:\dev в editor/ — план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `editor/` открывается и работает: главная с двумя карточками, страница мангала с печью (v1.5.0) и страница рыси 14, без обращений к сторонним серверам.

**Architecture:** страницы из `C:\dev` копируются как есть в `editor/mangal/` и `editor/lynx/`; в копиях правятся только шесть вещей из спеки (CDN → `vendor/` и `fonts/`, навигация, полоса сверху, вырезание фигур, индикатор раскроя, метки `?v=`). Тесты — Playwright (`tests/e2e/editor.spec.js`) и `smoke.js` разделов.

**Tech Stack:** HTML, CSS, классические скрипты; three.js r128 из `vendor/three/`; `@playwright/test` (desktop 1440 × 900, phone 390 × 844); `node` для `smoke.js`.

**Spec:** [docs/superpowers/specs/2026-11-02-editor-move-design.md](../specs/2026-11-02-editor-move-design.md)

## Global Constraints

- Только HTML, CSS, JS в браузере; без сервера, БД и ключей; сайт на GitHub Pages из `master`.
- При открытии страницы ничего со сторонних серверов: Three.js, OrbitControls, CSS2DRenderer — `vendor/three/`, шрифты — `fonts/fonts.css`.
- `C:\dev` только читается: копируем оттуда, не меняем, не запускаем то, что туда пишет.
- Версии: мангал v1.5.0, «Искусство» v0.27.1 — подписью внизу страниц; метка кеша `?v=2026-11-02k` (дата меняется при правке файла, как в проекте); хук и CHANGELOG из `C:\dev` не берём.
- Телефон 390 px: без горизонтальной прокрутки.
- Правок перенесённого кода — только шесть (спека, решение 4). Больше ничего не «улучшаем».
- Коммиты локально, `git push` и `master` — только по команде Виталия.

## Review Focus

Входы и состояния, которых спека явно не называет, но на которых человек споткнётся:
1. Любой файл страницы не нашёлся (404: картинка, `favicon`, лениво подгружаемый `models.js`): страница тихо ломается. Тест собирает ответы 4xx и ждёт пустой список.
2. Нет WebGL (старый телефон, отключено): страница должна показать понятное сообщение, а не белый экран. Проверить, что делает перенесённый код; если ничего — спросить Виталия, не чинить молча.
3. «Открыть модель» получила чужой файл (GLB с Draco, OBJ с ошибкой, `.json` не от этой страницы): сообщение в строке состояния, страница жива.
4. Раскрой рыси считается минутами и блокирует страницу: индикатор должен успеть нарисоваться до начала расчёта и крутиться, пока страница занята.
5. Телефон 390 px: мангал из `C:\dev` может не влезать; тогда в полосе сверху «Удобнее открыть на компьютере».

---

## File Structure

- `editor/index.html` — главная: две карточки, призыв писать Виталию.
- `editor/editor.css` — стили главной и полосы сверху (`.edbar`) — общие для трёх страниц.
- `editor/img/mangal.png` — картинка карточки мангала (копия `C:\dev\metal-designer\mangal\img\og.png`). Картинка карточки рыси — `../lynx/poster.jpg`, он уже в репозитории.
- `editor/mangal/` — копия `C:\dev\metal-designer\mangal\` (`index.html`, `css/`, `js/`, `img/`, `tools/smoke.js`).
- `editor/lynx/` — страница рыси: `index.html` (из `art/private/lynx.html`), `css/style.css`, `js/*` (из `art/js`), `js/lynx-model.js`, `js/lynx-plates.js`, `js/plates-lynx14.js`, `tools/smoke.js` (из `art/tools`).
- `tests/e2e/editor.spec.js` — браузерные тесты всех страниц редактора.
- `package.json` — скрипт `test:editor`.

## Interfaces

Общий помощник теста (определяется в Task 1, используется в Tasks 2–5), `tests/e2e/editor.spec.js`:

`async function openEditor(page, path: string): Promise<{external: string[], failed: string[], errors: string[]}>` — открывает `path`, ждёт `load`, возвращает за всё время: `external` — запросы не на `localhost:8000`; `failed` — ответы 4xx и 5xx; `errors` — `pageerror` и `console.error`. Каждая страница обязана вернуть три пустых списка.

Полоса сверху: `<div class="edbar">` с двумя ссылками: `<a class="edbar-back" href="../">← Редактор</a>` и `<a class="edbar-tg" href="https://t.me/SHVA_1984" target="_blank" rel="noopener">Прислать фото и пожелания в Telegram</a>`. Копируется в начало `<body>` обеих страниц; стили — `editor/editor.css`.

---

### Task 1: Мангал и печь

**Files:**
- Create: `editor/mangal/index.html`, `editor/mangal/css/style.css`, `editor/mangal/js/*.js` (8 файлов: `cut dims dxf model nest params parts ui`), `editor/mangal/img/*`, `editor/mangal/tools/smoke.js`, `editor/editor.css`, `tests/e2e/editor.spec.js`
- Modify: `package.json` (скрипт `test:editor`: `node editor/mangal/tools/smoke.js && node editor/lynx/tools/smoke.js` — вторая половина заработает после Task 2)

**Interfaces:**
- Produces: `openEditor` (см. выше), `.edbar`, `editor/editor.css`; адрес `editor/mangal/`.

- [ ] **Step 1: Написать падающие тесты** в `tests/e2e/editor.spec.js`:
  - `mangal: открывается без ошибок и без сторонних запросов` — `openEditor(page, '/editor/mangal/')`; `external`, `failed`, `errors` пустые; `await expect(page.locator('#stage canvas')).toHaveCount(1)`.
  - `mangal: полоса сверху` — `.edbar-back` ведёт на `../`, `.edbar-tg` на `https://t.me/SHVA_1984`, текст «Прислать фото и пожелания в Telegram».
  - `mangal: нет ссылок на другие разделы` — ни один `a[href]` не ведёт на `../index.html`, `karkas`, `art`.
  - `mangal: DXF скачивается` — открыть вкладку «DXF» (найти по тексту), нажать «Скачать» у первой детали, `page.waitForEvent('download')`, имя заканчивается на `.dxf`.
  - `mangal: на телефоне без горизонтальной прокрутки` — `scrollWidth <= innerWidth` (только проект `phone`).
- [ ] **Step 2: Запустить** `NODE_OPTIONS=--use-system-ca npx playwright test tests/e2e/editor.spec.js` — ожидаем падение (404).
- [ ] **Step 3: Скопировать** папку `C:\dev\metal-designer\mangal\` в `editor/mangal/` (без `BACKLOG.md`); поправить в `index.html`: три CDN-скрипта → `../../vendor/three/three.min.js`, `OrbitControls.js`, `CSS2DRenderer.js`; Google Fonts → `<link rel="stylesheet" href="../../fonts/fonts.css?v=2026-11-02k">`; `href="../index.html"` и всякая навигация на другие разделы → `../` («← Редактор»); `?v=1.5.0` → `?v=2026-11-02k` (подпись `v1.5.0` внизу оставить). Вставить `.edbar` в начало `<body>`, подключить `../editor.css`.
- [ ] **Step 4: Если тест телефона показал переполнение** — в `.edbar` добавить строку «Удобнее открыть на компьютере» (видна только на ширине ≤ 600 px), вёрстку мангала не менять. Если переполнения нет — не добавлять.
- [ ] **Step 5: Прогнать** `npx playwright test tests/e2e/editor.spec.js -g mangal` и `node editor/mangal/tools/smoke.js` — все зелёные.
- [ ] **Step 6: Коммит** — `Редактор: мангал и печь из C:\dev (v1.5.0), без CDN`.

---

### Task 2: Рысь 14

**Files:**
- Create: `editor/lynx/index.html`, `editor/lynx/css/style.css`, `editor/lynx/js/` (`bend bend3d edit figures mesh models models-poly prod sheets tips trace ui view3d` из `art/js`), `editor/lynx/js/lynx-model.js`, `editor/lynx/js/lynx-plates.js`, `editor/lynx/js/plates-lynx14.js` (из `art/private`), `editor/lynx/tools/smoke.js`
- Modify: `tests/e2e/editor.spec.js`

**Interfaces:**
- Consumes: `openEditor`, `.edbar`, `editor/editor.css` из Task 1.
- Produces: адрес `editor/lynx/`; единственная фигура `FIGURES.lynx14` с именем «Рысь».

- [ ] **Step 1: Написать падающие тесты:**
  - `lynx: открывается без ошибок и без сторонних запросов` — `openEditor(page, '/editor/lynx/')`, три списка пустые; `#loading` скрыт; `#stage canvas` один.
  - `lynx: одна фигура «Рысь»` — `#figSel option` ровно одна, текст «Рысь».
  - `lynx: нет собак и быка в тексте и в загруженных файлах` — среди `request.url()` нет `doberman`, `bull`, `trace`; `document.body.textContent` не содержит «Доберман», «быка».
  - `lynx: полоса сверху` и `lynx: нет ссылок на другие разделы` — как в Task 1.
  - `lynx: сохранить и открыть возвращают ту же рысь` — «Сохранить» → скачанный `.json`; перезагрузить страницу; `setInputFiles` на `#fileIn` этим файлом; ждём `#loading` скрыт; число деталей (`#parts tr`) то же.
  - `lynx: чужой файл не ломает страницу` — `setInputFiles` на `#fileIn` текстом «не модель» с именем `x.glb`; `#msg` непустой, `errors` пустой, `#stage canvas` остаётся.
  - `lynx: DXF и PDF скачиваются` — вкладка с DXF, скачивание `.dxf`; кнопка PDF — событие `download` с `.pdf`.
- [ ] **Step 2: Запустить** — падение (404).
- [ ] **Step 3: Скопировать файлы** из списка; в `index.html` (бывший `lynx.html`): пути `../js/…` → `js/…`, `../css/style.css` → `css/style.css`; оставить только `plates-lynx14.js`; CDN и шрифты — как в Task 1 (`../../vendor/three/…`, `../../fonts/fonts.css`); `../../index.html` и `../../mangal/img/favicon.svg` → `../` и `../mangal/img/favicon.svg`; `?v=0.27.1` → `?v=2026-11-02k` (подпись «Искусство v0.27.1» внизу оставить); вставить `.edbar`.
- [ ] **Step 4: Вырезать лишнее правкой `figures.js`:** удалить все `FIGURES.<id>=…` кроме `lynx14`, имя поставить «Рысь»; `ref`/`trace`-ссылки убрать; в `index.html` оставить в `#figSel` одну `<option value="lynx14">Рысь</option>`; выбор по умолчанию в `ui.js` указывает на `lynx14` (поправить константу выбора, а не логику). Проверить в консоли страницы, что `models.js` (131 КБ) нужен рыси; если нет — не копировать и убрать `<script>` и запись `LAZY.models`.
- [ ] **Step 5: Проверить** `npx playwright test tests/e2e/editor.spec.js -g lynx` и `node editor/lynx/tools/smoke.js` — зелёные. Если smoke падает из-за вырезанных фигур, поправить только то, что ссылается на них, и записать это в сообщение коммита.
- [ ] **Step 6: Коммит** — `Редактор: рысь 14 из C:\dev (Искусство v0.27.1), без собак и CDN`.

---

### Task 3: Индикатор раскроя рыси

**Files:**
- Modify: `editor/lynx/index.html`, `editor/lynx/css/style.css`, `editor/lynx/js/ui.js`
- Test: `tests/e2e/editor.spec.js`

**Interfaces:**
- Consumes: страница рыси из Task 2.
- Produces: элемент `#nestWait` с текстом «Считаю раскрой, это может занять несколько минут» и звёздочкой `✻`, вращающейся CSS-анимацией `transform: rotate` (она идёт без главного потока).

- [ ] **Step 1: Падающий тест** `lynx: во время раскроя виден индикатор` — открыть страницу, из самой страницы нажать вкладку «Раскрой» (`setTimeout(() => btn.click(), 0)` — вкладка считает прямо в обработчике и не даёт обычному клику вернуться); `await expect(page.locator('#nestWait')).toBeVisible({timeout: 5000})` и `toContainText('Считаю раскрой')`; затем не ждать конца расчёта, закрыть страницу.
- [ ] **Step 2: Запустить** — падение (`#nestWait` нет).
- [ ] **Step 3: Реализовать** в `ui.js`: перед запуском раскроя показать `#nestWait` и отдать браузеру кадр (`requestAnimationFrame` дважды или `setTimeout(…, 50)`), потом считать; скрыть `#nestWait` по окончании. Если в коде индикатор уже есть, поменять только вид. Анимация — CSS `@keyframes` с `transform: rotate(360deg)`, `prefers-reduced-motion` — медленнее (как у `.loading i`).
- [ ] **Step 4: Осознанное отклонение от спеки, показать Виталию:** в спеке «звёздочки по кругу `✻ ✶ ✳ ✢`» — менять символ по таймеру нельзя, пока страница занята расчётом (JS стоит). Поэтому одна `✻` вращается CSS-анимацией. Если Виталий хочет именно смену символов — нужен Web Worker для раскроя, это отдельная большая задача.
- [ ] **Step 5: Проверить** тест зелёный; руками: на десктопе после нажатия «Раскрой» звёздочка видна и крутится, пока идёт расчёт.
- [ ] **Step 6: Коммит** — `Редактор: индикатор раскроя рыси`.

---

### Task 4: Главная editor/

**Files:**
- Create: `editor/index.html`, `editor/img/mangal.png`
- Modify: `editor/editor.css`, `tests/e2e/editor.spec.js`

**Interfaces:**
- Consumes: `editor/editor.css`; страницы `editor/mangal/` и `editor/lynx/`.

- [ ] **Step 1: Падающие тесты:**
  - `home: открывается без ошибок и без сторонних запросов` — `openEditor(page, '/editor/')`.
  - `home: две карточки ведут на мангал и рысь` — `a.card[href="mangal/"]` с заголовком «Мангал и печь под казан», `a.card[href="lynx/"]` с заголовком «Рысь»; обе картинки загрузились (`naturalWidth > 0`).
  - `home: призыв писать Виталию` — виден текст «Пришлите фото и пожелания — спроектирую ваше изделие бесплатно» и ссылка на `https://t.me/SHVA_1984`.
  - `home: на телефоне без горизонтальной прокрутки`.
- [ ] **Step 2: Запустить** — падение.
- [ ] **Step 3: Сделать страницу** в стиле лендинга (шрифты `../fonts/fonts.css`, цвета и сетка из `css/landing.css`: переменные `--accent`, `--blue`, `--paper`), без скриптов; картинка мангала — копия `og.png`, рыси — `../lynx/poster.jpg`; ссылка «← Лендинг» ведёт на `../`.
- [ ] **Step 4: Проверить** тесты `-g home` зелёные; глазами на десктопе и 390 px.
- [ ] **Step 5: Коммит** — `Редактор: главная с карточками мангала и рыси`.

---

### Task 5: Тест `golden` и выход

**Files:**
- Modify: `tests/unit/engine.test.js`, `tests/golden.json`, `CLAUDE.md`
- Delete: `demo.html`, `js/` (песочница)

**Interfaces:**
- Consumes: все предыдущие задачи зелёные.

- [ ] **Step 1: Определить, откуда `golden` берёт «как C:\dev»** (читает `tests/unit/engine.test.js`, `tests/engine.js`); заменить сверку с `C:\dev` на сверку с замороженным `tests/golden.json`, пересчитанным один раз из текущего `md/` движка; записать в комментарии теста дату и «лендинг ведётся сам, не сверяется с C:\dev».
- [ ] **Step 2: Запустить** `NODE_OPTIONS=--use-system-ca npm test` — зелёный, красного `golden` больше нет.
- [ ] **Step 3: Удалить** `demo.html` и `js/`; убедиться, что на них никто не ссылается (`grep -rn "demo.html\|js/demo" --exclude-dir=node_modules .`), тест `noDemo` (текст страницы без слова «демо») остаётся.
- [ ] **Step 4: Обновить `CLAUDE.md`:** описание проекта (редактор в `editor/`, откуда он, что дальше развивается здесь), раздел «Что где лежит» (`editor/`, убрать `demo.html`, `js/`), строка про `golden`.
- [ ] **Step 5: Полный прогон:** `NODE_OPTIONS=--use-system-ca npm test`, `npm run test:editor`, `NODE_OPTIONS=--use-system-ca npx playwright test` — всё зелёное; пройти по приёмке из спеки (семь пунктов) глазами.
- [ ] **Step 6: Коммит** — `Редактор выходит: golden на собственном эталоне, demo.html удалён`. `git push` и `master` — только по команде Виталия.

---

## Self-review

- **Покрытие спеки:** цели → Tasks 1, 2, 4; не цели и анти-цели → нет задач на них; решение 1 (что едет) → 1, 2; решение 4 (шесть правок) → 1 (CDN, навигация, полоса, `?v=`), 2 (вырезание), 3 (индикатор); решение 5 (калька не едет) → Task 2 (нет `trace-*`); решение 6 (главная) → 4; решения 7–9 (версии, тесты, `demo.html`) → 1, 2, 5; решение 10 (ссылка с лендинга) → ничего не меняется; приёмка 1–7 → тесты Tasks 1–4 и Step 5 Task 5.
- **Типы:** `openEditor` и `.edbar` определены в Task 1 и используются так же в Tasks 2–4.
- **Отклонение от спеки:** Task 3, Step 4 — вращение одной звёздочки вместо смены четырёх символов. Нужно подтверждение Виталия.
- **Пропорция:** план короче половины спеки по сути кода, код в нём только имена тестов и значения из спеки.
