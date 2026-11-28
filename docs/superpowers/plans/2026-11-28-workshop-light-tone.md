# Мастерская обводки: свет от камеры, «Тон гипса» и «Белые швы» — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** в режиме обводки (Овчарка 7, «Открыть модель») гипс освещён светом от камеры (обе стороны одинаковые), тон гипса — 6 шагов от светлого до графита, галочка «Белые швы» красит швы кальки «Текстура» белым.

**Architecture:** чистая функция шагов `owTone` в `ow-core.js`; два набора ламп в `view3d.js` (сцены и «от камеры» — дети активной камеры), переключение — при входе в режим и выходе (`owOpen` / `owLeave`); тон и белые швы применяются к материалам режима в `owork.js`; настройки — `store()` (браузер), одни на всю мастерскую.

**Tech Stack:** браузерный JS без сборки, three.js r128 (`vendor/`), `node --test`, `tools/smoke.js`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-28-workshop-light-tone-design.md` (с «Решениями грилинга» Q1–Q7).

## Global Constraints

- **Делается после #184** (Q7): ортокамера `camO`, `curCam()`, `tests/e2e/shepherd-flat.spec.js` уже есть; лампы «от камеры» — и на `camera`, и на `camO`.
- Только режим обводки: у обычных фигур (Овчарки 1–6 и др.) свет, цвета, скриншоты — как были.
- Шаги: линейно между шагом 1 `.30 / .90 / .22 / #a29b90` и шагом 6 `.16 / .62 / .08 / #5f5a52` (рассеянный `HemisphereLight`, ключевой, подсветка, цвет гипса). По умолчанию — шаг 1.
- Ключевой свет — над зрителем: позиция в кадре камеры `(0, 1, 0.35)`; подсветка — от зрителя `(0, 0, 1)`; цель обеих — точка `(0, 0, −1)` в кадре камеры.
- «Белые швы» — `#f2f2f2`; выключена — `OW_SEAM_C` (`#2a1d14`), как сейчас. Облако швов и магнит (#177) — не зависят от галочки.
- Фото-кальки (#178, #185) и «Текстура» Meshy как есть (`cOrigTex`) — не меняются. Штрихи пера — цвета прежние.
- Настройки в браузере: ключи `ow-tone` (1…6) и `ow-seam-white` (`1`/`0`) через `store()` (`ui.js`); одни на всю мастерскую.
- Поменялся `js/*.js` или `css/*.css` — новая `?v=` во всех тегах `shepherd-v6j3w/index.html`.
- Перед коммитом: `NODE_OPTIONS=--use-system-ca npm test`, `NODE_OPTIONS=--use-system-ca npm run test:editor`, `node --test shepherd-v6j3w/tools/*.test.js`, `NODE_OPTIONS=--use-system-ca npx playwright test tests/e2e/shepherd-flat.spec.js tests/e2e/shepherd-light.spec.js --project=desktop`. Долгие прогоны — в отдельном окне.
- Код — плотные однострочники; `//` не посреди строки. Только десктоп.

## Review Focus

1. **Выход из режима и повторный вход.** Ожидание: после «Овчарка 7 → Овчарка 6 → Овчарка 7 → Овчарка 6» ламп в сцене столько же, сколько до первого входа; у Овчарки 6 — свет сцены, ламп «от камеры» нет. Тест — Task 1, e2e.
2. **Ортокамера #184.** Ожидание: в «Спереди» (орто) гипс освещён так же, как в перспективе с того же направления (лампы и на `camO`). Тест — Task 1, e2e (яркость пикселя в центре морды орто против перспективы ±6).
3. **Симметрия.** Ожидание: в «Спереди» зеркальные точки левого и правого уха одной яркости. Тест — Task 1, e2e (±6 по каналу).
4. **Модель без текстуры** («Открыть модель», STL). Ожидание: «Тон гипса» есть и работает, «Белых швов» нет. Тест — Task 2, e2e.
5. **Ползунок до загрузки текстуры.** Ожидание: сменил тон, пока «Текстура» готовится (`owSeamPrep`), — после готовности калька в выбранном тоне и с выбранным цветом швов. Тест — Task 2, e2e (тон меняется до `owSeamOn()`).

---

## Карта файлов

| Файл | Что | Задачи |
|---|---|---|
| `shepherd-v6j3w/js/ow-core.js` | `owTone(step)` — чистая | 1 |
| `shepherd-v6j3w/tools/ow-core.test.js` | её тест | 1 |
| `shepherd-v6j3w/js/view3d.js` | лампы сцены и «от камеры», `lightRig(cam)` | 1 |
| `shepherd-v6j3w/js/owork.js` | `owToneSet`, `owSeamWhite`; вызовы в `owOpen`/`owLeave`/`owBuild`/`owSeamPrep`; видимость строк на панели | 1, 2 |
| `shepherd-v6j3w/js/ui.js` | обработчики `sTone`, `cSeamW` | 1, 2 |
| `shepherd-v6j3w/index.html` | в `#origBox` после «Текстура»: ползунок и галочка; `?v=` | 1, 2 |
| `tests/e2e/shepherd-light.spec.js` | поведение в браузере (desktop) | 1, 2 |
| `shepherd-v6j3w/tools/smoke.js` | статические проверки | 1, 2 |
| `CLAUDE.md` | строка области e2e — дописать `shepherd-light.spec.js` | 2 |

---

### Task 1: свет от камеры и «Тон гипса»

**Files:**
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/tools/ow-core.test.js`
- Modify: `shepherd-v6j3w/js/view3d.js` (лампы ~стр. 9–13)
- Modify: `shepherd-v6j3w/js/owork.js` (`owOpen` ~18, `owLeave` ~28, `owBuild` ~32)
- Modify: `shepherd-v6j3w/index.html` (`#origBox`, стр. ~48–49: после метки «Текстура» — `<label class="rng" id="toneRow"><span>Тон гипса: <b id="toneVal">1</b></span><input type="range" id="sTone" min="1" max="6" step="1" value="1"></label>`)
- Modify: `shepherd-v6j3w/js/ui.js` (рядом с `cOrigTex` ~стр. 233)
- Create: `tests/e2e/shepherd-light.spec.js`
- Test: `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Produces: `owTone(step:number):{hemi:number, key:number, fill:number, color:number}` — шаг округляется и зажимается в 1…6; числа — линейно между шагом 1 и 6 (Global Constraints), цвет — по каналам, округление к целому.
- Produces: `lightRig(cam:boolean)` в `view3d.js` — `true`: лампы сцены выключены (`visible=false`), лампы «от камеры» (`LIGHT_CAM={hemi, key, fill}`) включены и висят на `camera` и `camO`; `false` — наоборот. Повторный вызов с тем же значением — ничего не добавляет.
- Produces: `owToneSet(step:number)` в `owork.js` — пишет `OW.tone`, `store('ow-tone')`, интенсивности `LIGHT_CAM`, цвет гипса у `plaster`, `seam`, `photo` (и `basic`, пока у него нет картинки), подпись `#toneVal`, `req3D()`.

- [ ] **Step 1: Тест `owTone`** в `ow-core.test.js`: `owTone(1)` → `{hemi:.30,key:.90,fill:.22,color:0xa29b90}` (±1e-9); `owTone(6)` → `{.16,.62,.08,0x5f5a52}`; `owTone(3)` → `{hemi:.244,key:.788,fill:.164,color:0x878177}` (±1e-9); `owTone(0)` как `owTone(1)`, `owTone(9)` как `owTone(6)`, `owTone(2.6)` как `owTone(3)`.
- [ ] **Step 2: Красный** (`node --test shepherd-v6j3w/tools/ow-core.test.js`).
- [ ] **Step 3: `owTone` в `ow-core.js`.** Зелёный.
- [ ] **Step 4: e2e (красные)** `tests/e2e/shepherd-light.spec.js` (desktop, `/shepherd-v6j3w/#f=shepherd7_orig`, ждать `OW.on && OW.o3`; перед тестом `localStorage.clear()`):
  - Вход: лампы «от камеры» видимы, лампы сцены — нет; `#sTone` виден без «Править фигуру», значение 1, `#toneVal` = «1»; цвет `OW.o3.plaster.color.getHex()===owTone(1).color`.
  - `#sTone` = 4 → гипс `owTone(4).color`, ключевой `owTone(4).key`; перезагрузка страницы → 4 (`store`).
  - Симметрия: «Спереди», яркость пикселей экрана в проекциях `[-60, 930, z]` и `[60, 930, z]` (z — по `owPick`/`owNear` на ухе) равна ±6.
  - Орто (#184): «Спереди» — пиксель центра морды; `viewOrtho(false)` — тот же пиксель ±6.
  - Выход и вход: «Овчарка 7 → 6 → 7 → 6» — число объектов `isLight` в `scene` (с детьми камер) то же, что после первой загрузки Овчарки 6; у Овчарки 6 лампы сцены видимы.
- [ ] **Step 5: Красный.**
- [ ] **Step 6: Сделать.** `owOpen` → `lightRig(true)` и `owToneSet(+store('ow-tone')||1)`; `owLeave` → `lightRig(false)`; `owBuild` создаёт материалы уже в тоне `OW.tone`; `#sTone` `input` → `owToneSet(+value)`.
- [ ] **Step 7: smoke (статические):** `#sTone` в `#origBox`, `min=1 max=6 step=1`; в `owork.js` `owOpen` зовёт `lightRig(true)`, `owLeave` — `lightRig(false)`.
- [ ] **Step 8: e2e, smoke, модульные зелёные; `?v=`.**
- [ ] **Step 9: Скриншоты** `.superpowers/t1-tone1-front.png`, `t1-tone3-front.png`, `t1-tone6-front.png`, `t1-tone1-side.png`, `t1-tone6-side.png`, `t1-shepherd6-same.png` (Овчарка 6 — как до правки); 0 ошибок консоли.
- [ ] **Step 10: Коммит** `Мастерская: свет от камеры и «Тон гипса» (#N)`.

---

### Task 2: галочка «Белые швы»

**Files:**
- Modify: `shepherd-v6j3w/index.html` (`#origBox`, после `#toneRow`: `<label class="chk" id="seamWRow" hidden><input type="checkbox" id="cSeamW"><span>Белые швы</span></label>`; `?v=`)
- Modify: `shepherd-v6j3w/js/owork.js` (`owSeamMat` ~стр. 42; `owSeamPrep` ~49; `owCalkaUI` / `owRender`)
- Modify: `shepherd-v6j3w/js/ui.js`, `tests/e2e/shepherd-light.spec.js`, `shepherd-v6j3w/tools/smoke.js`, `CLAUDE.md`

**Interfaces:**
- Consumes: `OW.o3.seam` (`owSeamMat`, униформа `owSeamC`), `OW.o3.mask` (готовность «Текстуры»), `owToneSet` (Task 1).
- Produces: `OW_SEAM_W=0xf2f2f2`; `owSeamWhite(on:boolean)` — пишет `OW.seamW`, `store('ow-seam-white')`, цвет униформы `owSeamC` (`OW_SEAM_W` / `OW_SEAM_C`), `req3D()`; применяется и к материалу, созданному до компиляции шейдера (`m.userData` хранит цвет, `onBeforeCompile` берёт его оттуда).

- [ ] **Step 1: e2e (красные):**
  - Пока «Текстура» не готова (`!OW.o3.mask`), `#seamWRow` скрыт; готова — виден, `#cSeamW` снята, цвет шва — `OW_SEAM_C`.
  - `#cSeamW` вкл → цвет униформы шва `0xf2f2f2`; пиксель на шве (точка облака `OW.seam.seg`, проекция в экран, «Править фигуру», калька «Текстура») светлее пикселя гипса рядом; перезагрузка → галочка включена.
  - Магнит: число точек `OW.seam.seg.length` и результат `owSnapSeg()` при вкл и выкл галочки — одинаковые.
  - Тон сменён до готовности «Текстуры» (`#sTone`=5 сразу после входа) → после `owSeamOn()` гипс кальки `owTone(5).color`, цвет шва — по галочке.
  - Модель без текстуры (`owFile` с STL из `tests/fixtures` или `owOpen({…, tex:''},'file')` с кубом) — `#toneRow` виден, `#seamWRow` скрыт.
- [ ] **Step 2: Красный.**
- [ ] **Step 3: Сделать.** Видимость `#seamWRow` — в `owCalkaUI` по `OW.o3.mask`; `owOpen` → `owSeamWhite(store('ow-seam-white')==='1')`; `#cSeamW` `change` → `owSeamWhite(checked)`.
- [ ] **Step 4: smoke (статические):** `#cSeamW` в `#origBox`, по умолчанию `hidden` у строки и без `checked`; `OW_SEAM_W=0xf2f2f2`.
- [ ] **Step 5: e2e, smoke, модульные зелёные; `?v=`.** В `CLAUDE.md` в строке «Овчарка (мастерская)» таблицы областей — команда с обоими файлами `shepherd-flat.spec.js shepherd-light.spec.js`.
- [ ] **Step 6: Скриншоты** `t2-tone6-white-head.png` (графит, белые швы, морда крупно), `t2-tone1-dark-head.png` (светлый, тёмные швы), `t2-pen-tone6.png` (зелёный штрих на графите); 0 ошибок консоли.
- [ ] **Step 7: `test:editor` (~25 мин, в отдельном окне) зелёный; ревью `mattpocock-skills:code-review` (один ревьюер).**
- [ ] **Step 8: Коммит** `Мастерская: галочка «Белые швы» (#N)`.
