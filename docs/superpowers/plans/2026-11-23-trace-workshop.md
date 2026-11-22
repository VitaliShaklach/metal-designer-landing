# Мастерская разметки по кальке — план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на странице `/shepherd-v6j3w/` Виталий видит оригинал Meshy, три чёткие кальки линиями, включает нужные слои, размечает линиями/карандашом/зачёркиванием, жмёт «Нарезать», сохраняет версии в браузере.

**Architecture:** движок страницы — набор глобальных скриптов (`js/*.js`, без модулей), состояние в `ST` (`js/ui.js`), 3D — `build3D(M3,R,o)` (`js/view3d.js`), правки граней — `js/edit.js` (`{V,P,S}`, симметрия через `mirrorMap`). Новое кладём отдельными файлами по одной задаче (`layers.js`, `tlines.js`, `markup.js`, `apply.js`, `orig.js`, `versions.js`), `ui.js` только подключает. Данные калек и оригинала — ленивые `js/*.js` с base64, их пишут скрипты в `from-dev/art/tools/plates/`.

**Tech Stack:** JS в браузере, three.js r128 (`vendor/`), Node 24 для скриптов и проверок (`vm`, `node:test`), Playwright (MCP) для глаз.

**Spec:** [docs/superpowers/specs/2026-11-23-trace-workshop-design.md](../specs/2026-11-23-trace-workshop-design.md) — читать вместе с планом; таблица «Решения грилинга» — закон.

## Global Constraints

- Только браузер, ничего с чужих серверов; three.js r128 из `vendor/`.
- Ленивые файлы (калька, оригинал) — ≤ 10 МБ каждый, грузятся по выбору.
- Любая правка скрипта страницы → поднять `?v=` у **всех** `<script>`/`<link>` в `shepherd-v6j3w/index.html` (одна дата-метка на страницу).
- Симметрия: при галочке «Симметрия» каждая правка повторяется на зеркальной половине (x → −x).
- Грань — плоский многоугольник без дыр; отверстие — отдельный список, не дыра в `P`.
- localStorage / IndexedDB — только в `try/catch` (как `store()` в `ui.js:6`); без них страница работает.
- Телефон 390 px: без горизонтальной прокрутки; инструменты рисования скрыты (`matchMedia('(pointer:fine)')`).
- Конь, собака, рысь, `editor/`, лендинг — не трогаем.
- Код — только под открытый тикет; один тикет = одна задача плана; коммит `… (#N)` после зелёных проверок; push и закрытие — после «работает» Виталия.
- `from-dev/` без git: скрипты там правим, но не коммитим; что нужно на странице — пишется в `shepherd-v6j3w/`.
- Проверки каждой задачи: `node shepherd-v6j3w/tools/smoke.js` (~10 мин, `всё ок`), `npm test`, `npm run test:editor`; npm — с `NODE_OPTIONS=--use-system-ca`.
- Ссылка в конце: `http://localhost:8000/shepherd-v6j3w/#f=shepherd5&edit…` (сервер — `python tests/serve.py`).

## Review Focus

1. Линия разметки пересекает плоскость симметрии (x = 0) при «Симметрия» — зеркальная копия совпадает с исходной; режется один раз, без двойных точек. → тест в задаче 7.
2. Линия «Линии»/«Карандаша» обрывается внутри грани, не дойдя до края и не замкнувшись — не режем молча криво: красная, «линия не доходит до края детали». → тест в задаче 7.
3. localStorage недоступен или полон — «Сохранить» всё равно скачивает .json и пишет «Версию в браузере сохранить не удалось»; слои/разметка работают в памяти. → тест в задаче 9 (и 2).
4. Переключение на «оригинал (вид)» с включённым инструментом или незаконченной разметкой — инструмент выключается, разметка сохранена, возврат — всё на месте, ракурс тот же. → тест в задаче 3.
5. Плита отошла от эталона дальше радиуса поиска — точки линий кальки там не рисуются (а не висят в воздухе); доля нарисованных ≥ 90 %. → тест в задаче 4.

---

### Task 1: Проба «плиты по изломам формы» (тикет 1)

Страницу не трогает. Итог — картинки и отчёт; решение принимает Виталий утром.

**Files:**
- Create: `from-dev/art/tools/plates/facets.js` (без git)
- Create: `shepherd-v6j3w/tools/probe-facets.md` (отчёт, в git), `shepherd-v6j3w/tools/img/probe-facets-*.png`

**Interfaces:**
- Produces: `node from-dev/art/tools/plates/facets.js <obj> ang=<°> [tag=_f8]` → `from-dev/art/tools/plates/out/plates<tag>.json` в формате `plates.js` (`{V,P}`, кадр 600 мм), тот же вход, что `make-shepherd.js` (`plates:true`).

- [ ] **Step 1:** Сетка модели (`src/shepherd5/model/*.obj`) → рёбра с двугранным изломом ≥ `ang` — границы; заливка треугольников по смежности без пересечения границ → области; области < 0,5 % площади головы сливать с соседом по самому слабому излому.
- [ ] **Step 2:** Каждую область → многоугольник по внешнему контуру, выровнять в плоскость (МНК), углы — общие точки соседних областей (как выравнивание `plates.js`); правая половина + зеркало по x.
- [ ] **Step 3:** Прогнать `ang` = 6, 8, 10, 12 → `out/plates_f6.json` … `_f12.json`; для каждого — `make-shepherd.js` во временный id (вариант `probe` в `VARIANTS`, не регистрировать на странице) → число деталей, самопересечения, деталей на голове.
- [ ] **Step 4:** Картинки «оригинал | вышло» для каждого порога: спереди, сбоку, 3/4, голова крупно (оригинал — серый с освещением, как `render.html`; вышло — `rend.js`). Лист с номерами (`feedback-show-thumbnails`).
- [ ] **Step 5:** `probe-facets.md`: таблица порог → деталей / на голове / самопересечения / узких; листы картинок; рекомендация. Коммит `Проба: плиты по изломам формы (#N)` (только `shepherd-v6j3w/tools/probe-*`).

Выход «готово»: 4 строки таблицы, у каждой картинка; самопересечения названы, если есть.

### Task 2: Слои + «Другие операции» (тикет 2)

**Files:**
- Create: `shepherd-v6j3w/js/layers.js`, `shepherd-v6j3w/tools/layers.test.js`
- Modify: `shepherd-v6j3w/js/ui.js` (`renderAll` строка ~79: `verts`, `diff`, линии граней; `traceUI`), `shepherd-v6j3w/js/view3d.js:37-43` (`o.edges` — рисовать ли швы), `shepherd-v6j3w/index.html` (галочки, блок `<details id="edMore">`), `shepherd-v6j3w/js/tips.js`, `package.json` (`test:editor` += `node --test shepherd-v6j3w/tools/*.test.js`), `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Produces: `LAYER_DEF={edges:true,verts:false,trace:false,diff:false}`; `layersLoad(raw:string|null)→{edges,verts,trace,diff}` (битый/пустой → `LAYER_DEF`); `layersSave(L)→string`; `ST.layers` в `ui.js`; ключ localStorage `'shepherd-layers'`. `build3D` получает `edges:ST.layers.edges`, `verts:ed&&ST.layers.verts`, `diff:ed&&traceOn()&&ST.layers.diff?TRC.diff:null`.

- [ ] **Step 1:** `layers.test.js`: `layersLoad(null)` = `LAYER_DEF`; `layersLoad('{"verts":true}')` → `verts:true`, остальное по умолчанию; `layersLoad('мусор')` = `LAYER_DEF`; `layersLoad(layersSave(L))` = `L`.
- [ ] **Step 2:** `node --test shepherd-v6j3w/tools/layers.test.js` → FAIL (нет `layers.js`).
- [ ] **Step 3:** `layers.js` (подключить его в тесте через `vm`, как `check.test.js`).
- [ ] **Step 4:** тест → PASS.
- [ ] **Step 5:** UI: в «Редакторе» галочки «Линии граней», «Точки углов», «Калька» (+ список), «Подсказки сверки»; меняют `ST.layers`, пишут `store('shepherd-layers',…)`, `renderAll()`. Галочка «Калька» = `ST.layers.trace` (заменяет `ST.trace`; `&trace` в ссылке по-прежнему включает). Кнопки `#edOps` (кроме «Отменить/Вернуть») — в `<details id="edMore"><summary>Другие операции</summary>…</details>`, закрыт. Подсказки «?» в `tips.js`.
- [ ] **Step 6:** smoke: новый блок — в `index.html` есть четыре галочки и `#edMore` без `open`; `LAYER_DEF` как в спеке; `ui.js` передаёт `verts`/`diff` только при включённом слое (поиск строк, как в существующих проверках `UI3.includes`).
- [ ] **Step 7:** глазами: Овчарка 5, «Править фигуру» → точек и пятен нет; включил «Точки углов» → есть; перезагрузка помнит. Телефон 390 — без прокрутки вбок.
- [ ] **Step 8:** проверки (Global Constraints) зелёные → коммит `Мастерская: слои и «Другие операции» (#N)`.

### Task 3: Оригинал (вид) (тикет 3)

**Files:**
- Create: `from-dev/art/tools/plates/orig.js` (без git) — сборщик; `shepherd-v6j3w/js/orig.js`; `shepherd-v6j3w/js/orig-shepherd5.js`, `shepherd-v6j3w/img/orig-shepherd5.png` (выход сборщика)
- Modify: `shepherd-v6j3w/js/figures.js`, `js/ui.js` (`loadFigure`, скрытие панелей), `js/view3d.js` (сцена оригинала), `index.html` (пункт выпадашки, галочка «Текстура», строка-заглушка), `tools/smoke.js`

**Interfaces:**
- Produces: `node from-dev/art/tools/plates/orig.js <obj> <png> <id> <xf.json>` → `ORIG[id]={V:b64 float32 xyz (кадр фигуры, мм), T:b64 float32 uv, F:b64 uint32, tex:'img/orig-<id>.png'}` в `js/orig-<id>.js`; текстура — PNG ≤ 2048 px (`png.js`), файл ≤ 6 МБ.
- `FIGURES['<id>_orig']={name:'Овчарка 5 — оригинал (вид)',view:'shepherd5',orig:'shepherd5',need:'orig-shepherd5'}` + `LAZY['orig-shepherd5']`.
- `orig.js`: `origShow(id, tex:boolean)` — строит меш в `root` вместо фигуры; `origDispose()` — убрать меш и текстуру (`dispose()`); `camKeep()→{d,t}` (направление и цель относительно габарита фигуры) / `camRestore(k,box)`.

- [ ] **Step 1:** сборщик: точки через `xf.json` фигуры (`out/shepherd5/xf.json`) — оригинал в том же кадре, что фигура; уменьшить текстуру до 2048.
- [ ] **Step 2:** smoke (FAIL до реализации): `FIGURES.shepherd5_orig.view==='shepherd5'`; файл есть и не подключён в `index.html`; `ORIG.shepherd5` декодируется: треугольников = 158336, габарит совпадает с фигурой `shepherd5` ±3 мм по каждой оси.
- [ ] **Step 3:** `ui.js`: фигура с `view` — без `compute()`, панели расчёта и мастерская скрыты (`hidden`), строка «Это вид оригинала. Для расчёта выберите <FIGURES[view].name>»; галочка «Текстура» (вкл.): с текстурой — `MeshBasicMaterial`, без — `MeshLambertMaterial` серый.
- [ ] **Step 4:** переключение фигура ↔ её оригинал: `camKeep()` до, `camRestore()` после (без `fitBox`); инструмент разметки выключается, разметка не трогается (Review Focus 4). На другую фигуру — `origDispose()`.
- [ ] **Step 5:** smoke → PASS; глазами: оригинал как в Meshy, переключение туда-обратно — ракурс тот же; телефон — без прокрутки вбок.
- [ ] **Step 6:** коммит `Оригинал (вид) в выпадашке (#N)`.

### Task 4: Чёткая калька линиями (тикет 4)

**Files:**
- Modify: `from-dev/art/tools/plates/tracing.js` (новый вывод линий, без git)
- Create: `shepherd-v6j3w/js/tlines.js`, `shepherd-v6j3w/tools/tlines.test.js`
- Modify: `shepherd-v6j3w/js/trace-shepherd5.js`, `trace-shepherd5p.js` (пересобрать), `js/ui.js` (`traceLoadFor`, `renderAll`), `js/view3d.js` (`o.tlines`), `tools/smoke.js`

**Interfaces:**
- Produces (файл кальки): в конце `trace-<id>.js` строка `TRACE_L.<id>='<b64>'` (+ `var TRACE_L=window.TRACE_L||{}` в начале); формат: uint32 число ломаных, затем на каждую uint32 n и n×3 int16 (мм×10, кадр 600 мм с `xf`, как облако).
- `tlinesLoad(b64)→{n:number, S:Uint32Array /*начала*/, P:Float32Array /*xyz мм*/}`
- `tlinesOnFigure(L, map /*traceMap*/, V, P /*грани*/, maxD=12)→Float32Array` — отрезки (пары точек) в кадре фигуры, точки спроецированы на ближайшую грань (≤ `maxD` мм, иначе точка пропущена) и сдвинуты на 0,6 мм по нормали наружу.
- `tlinesNear(L, map, p, r=5)→[x,y,z]|null` — ближайшая точка линий к `p` (кадр фигуры) в радиусе `r` мм; для магнита (задача 6).
- `build3D` опция `tlines:Float32Array` → `LineSegments` белые (0xffffff), `depthTest:true`, `renderOrder` выше граней.

- [ ] **Step 1:** `tracing.js`: пиксели шва (те же признаки, что облако: светлый серый l > 185, s < 70) в UV каждого треугольника → маска 4096² → утончение (Чжан — Суэн) → ломаные по 8-связности → в 3D через барицентрические координаты треугольника → упрощение Дугласа — Пекера 0,5 мм → отбросить < 8 мм. Пересобрать обе кальки Овчарки 5 (команды — `src/shepherd5/proj/README.txt` + `xf=`).
- [ ] **Step 2:** `tlines.test.js`: `tlinesLoad` на собранной вручную base64 из 2 ломаных возвращает `n===2` и точки ±0,1 мм; `tlinesOnFigure` на кубе 100 мм и линии на 1 мм над гранью → все отрезки лежат на 0,6 мм над гранью; линия в 30 мм от куба → пропущена; `tlinesNear` → ближайшая точка, дальше `r` → `null`.
- [ ] **Step 3:** тест → FAIL; `tlines.js`; тест → PASS.
- [ ] **Step 4:** `ui.js`: при загрузке кальки — `TRC.L=tlinesLoad(TRACE_L[id])`; пересчёт `tlinesOnFigure` там же, где атлас (по ключу формы); `build3D(…,{tlines})`, когда слой «Калька» вкл. Облако-атлас остаётся только для «Подсказок сверки» (поверхность не красим).
- [ ] **Step 5:** smoke: у обеих калек Овчарки 5 линий > 200, на фигуре нарисовано ≥ 90 % точек ломаных (Review Focus 5).
- [ ] **Step 6:** глазами: голова крупно — линии резкие на любом зуме, по сравнению с картинкой `ref-front.png` швы на местах. → коммит `Калька линиями (#N)`.

### Task 5: Калька «форма оригинала» + три кальки (тикет 5)

**Files:**
- Modify: `from-dev/art/tools/plates/tracing.js` (режим `edges=<°>`, без git), `shepherd-v6j3w/js/figures.js` (`refs`), `js/ui.js` (калька без облака), `tools/smoke.js`
- Create: `shepherd-v6j3w/js/trace-shepherd5f.js`

**Interfaces:**
- Consumes: формат `TRACE_L` и `tlines*` (задача 4).
- Produces: `tracing.js shepherd5f <obj> edges=4 out=… xf=…` — только `TRACE_L.shepherd5f` (рёбра сетки с изломом ≥ 4° → цепочки → упрощение), без облака. `FIGURES.shepherd5.refs=[['shepherd5p','с картинок'],['shepherd5','с модели'],['shepherd5f','форма оригинала']]` — первая в списке открывается по умолчанию. Калька без облака: подсказки сверки для неё скрыты (галочка неактивна, подсказка «у этой кальки нет сверки»).

- [ ] **Step 1:** порог — взять из пробы (задача 1, «тоньше нарезки»); по умолчанию 4°.
- [ ] **Step 2:** smoke (FAIL → PASS): три кальки в порядке спеки; `shepherd5f` грузится, линий > 300, ≥ 90 % на фигуре; при выборе `shepherd5f` `TRC.t===null` и атлас не строится.
- [ ] **Step 3:** глазами: «форма оригинала» повторяет рёбра оригинала (сравнить с «оригинал (вид)» под тем же ракурсом). → коммит `Калька «форма оригинала», три кальки (#N)`.

### Task 6: Разметка (тикет 6)

**Files:**
- Create: `shepherd-v6j3w/js/markup.js`, `shepherd-v6j3w/tools/markup.test.js`
- Modify: `js/ui.js` (инструменты, мышь, хранение), `js/view3d.js` (`o.markup`), `index.html` (кнопки «Линия», «Карандаш», «Зачеркнуть», «Очистить разметку», галочка «Магнит»), `js/tips.js`, `tools/smoke.js`

**Interfaces:**
- Consumes: `tlinesNear` (задача 4), `pickHit(ev)→[x,y,z]|null` (`view3d.js:68`, расширить до `{p,face}`: индекс грани `ST.base.T[faceIndex]`).
- Produces: штрих `{k:'line'|'pen'|'cross', pts:[[x,y,z],…], closed?:boolean}` (кадр фигуры, мм); `ST.mk=[]` — список штрихов; `mkSmooth(pts, r=4)→pts` (стабилизатор: точка тянется за курсором, пока отставание > r мм; затем Дуглас — Пекер 0,7 мм и сглаживание Чайкина ×2); `mkSnap(p, on)→p` (магнит: `tlinesNear(…,5)` или `p`); `mkMirror(s)→s` (x → −x; штрих, лежащий на x = 0 ±1 мм, не зеркалится); `mkClosed(pts)→boolean` (концы ближе 6 мм); `mkKey(fig)='shepherd-mk-'+fig`; `mkLoad(raw)`/`mkSave(mk)`.
- `build3D` опция `markup:{own:Float32Array, mirror:Float32Array}` — свои штрихи оранжевые (0xe07a35), зеркальные бледные (opacity .35).

- [ ] **Step 1:** `markup.test.js`: `mkSmooth` на зигзаге ±1,5 мм вдоль прямой 100 мм → отклонение от прямой ≤ 0,5 мм; `mkMirror` переворачивает x, штрих на оси возвращает тот же; `mkClosed` для окружности — true, для дуги 270° — false; `mkLoad(mkSave(mk))` = `mk`, `mkLoad('мусор')` = `[]`.
- [ ] **Step 2:** FAIL → `markup.js` → PASS.
- [ ] **Step 3:** `ui.js`: инструмент активен → левая кнопка рисует (`controls.mouseButtons.LEFT=null`, крутить — правой), выкл. — как было. «Линия»: клики → точки, двойной клик/Enter — конец; «Карандаш»: зажал-повёл; «Зачеркнуть»: черта (2 точки). Каждая точка через `mkSnap` (галочка «Магнит», по умолчанию вкл.). Esc — отменить текущий штрих. Штрихи сохраняются в `store(mkKey(ST.fig),…)` после каждого; при загрузке фигуры — читаются. Телефон: кнопки скрыты.
- [ ] **Step 4:** smoke: кнопки есть, по умолчанию инструмент выключен, «Магнит» вкл.; `mkKey` по id фигуры.
- [ ] **Step 5:** глазами: карандаш на морде не дрожит; магнит кладёт на белую линию; зеркальная бледная видна; перезагрузка — разметка на месте; «Очистить разметку». → коммит `Разметка: линия, карандаш, зачеркнуть (#N)`.

### Task 7: «Нарезать» (тикет 7)

**Files:**
- Create: `shepherd-v6j3w/js/apply.js`, `shepherd-v6j3w/tools/apply.test.js`
- Modify: `js/ui.js` (кнопка, отказы, `pushUndo`), `js/view3d.js` (красные штрихи), `index.html`, `tools/smoke.js`

**Interfaces:**
- Consumes: штрихи `ST.mk` (задача 6), `cutPoly`, `mergePolys`, `mirrorMap`, `checkFigure`-правила (как в `tools/check.js`: узкие ≥ 15 мм, самопересечений 0).
- Produces: `cutPolyline(E, pi, pts /*точки на грани, концы на её контуре*/, sym)→E|null` — разрез одной грани ломаной (новые точки на рёбрах и внутри); `applyMarkup(E, mk, {sym, snap:8, minW:15})→{E, done:number[], fail:[{i:number, why:string}]}`. Причины (`why`, точный текст): `'линия не доходит до края детали'`, `'выйдет деталь уже 15 мм'`, `'слить нельзя: выйдет дыра'`, `'выйдет самопересечение'`, `'замкнутая линия — отверстие (будет в следующей версии)'` (до задачи 8).

- [ ] **Step 1:** `apply.test.js` на кубе 200 мм (6 граней, `{V,P,S}`): линия поперёк грани от ребра до ребра → граней 7; та же с `sym` поперёк грани на x>0 → режутся обе зеркальные; линия поперёк оси x=0 при `sym` → режется один раз, без двойных точек (Review Focus 1); линия, оборванная внутри грани → `fail` `'линия не доходит до края детали'`, фигура без изменений (Review Focus 2); точка ближе 8 мм к углу → встаёт в угол (новой точки нет); разрез, дающий полосу 10 мм → `fail` `'выйдет деталь уже 15 мм'`; зачёркивание общего ребра двух граней → граней на 1 меньше; результат каждого — замкнутый, без самопересечений.
- [ ] **Step 2:** FAIL → `apply.js` → PASS.
- [ ] **Step 3:** штрих, идущий через несколько граней: разбить по граням (пересечения с рёбрами по поверхности), каждую — `cutPolyline`; порядок: сначала зачёркивания, потом разрезы.
- [ ] **Step 4:** UI: кнопка «Нарезать» — `pushUndo()`, `applyMarkup`, `applyE`; применённые штрихи убрать из `ST.mk`, отказы оставить красными с подписью причины (CSS2D-метка у середины штриха) и сводкой «Нарезано N, не вышло M»; пустая разметка → «Нечего нарезать».
- [ ] **Step 5:** smoke: на Овчарке 5 заготовленная разметка (3 линии на морде, 1 зачёркивание) → фигура симметрична, замкнута, без самопересечений; «Отменить» — как было.
- [ ] **Step 6:** глазами на морде. → коммит `«Нарезать»: применение разметки (#N)`.

### Task 8: Отверстие (тикет 8)

**Files:**
- Modify: `shepherd-v6j3w/js/apply.js` (замкнутый штрих), `js/edit.js` (`polyBase` — грани с отверстиями), `js/mesh.js` (`buildParts`/`totals`: площадь и рез), `js/prod.js` (`cutContour` — внутренний контур), `js/sheets.js` (`dxfNest` — слой CUT), `js/view3d.js` (дырка в 3D), `js/ui.js` (`save`/загрузка `H`), `tools/apply.test.js`, `tools/smoke.js`

**Interfaces:**
- Produces: `E.H=[[pi, [[x,y,z],…]], …]` — отверстия по граням (контур в плоскости грани); `holeAdd(E, pi, pts)→E|null` (контур целиком внутри грани, ≥ 5 мм от края, сам себя не пересекает); `polyBase(V,P,S,H)` — триангуляция грани с отверстием (мост от отверстия к контуру + `earClip`); деталь получает `p.holes=[[[u,v],…]]` в 2D; `.json` фигуры: поле `H`.

- [ ] **Step 1:** тесты: замкнутая кривая (окружность Ø 30) в грани куба → `E.H.length===1`, площадь детали меньше на π·15² ±1 %, рез больше на 2π·15 ±1 %; контур ближе 5 мм к краю → `fail`; DXF содержит контур отверстия в слое `CUT`.
- [ ] **Step 2:** FAIL → реализация → PASS.
- [ ] **Step 3:** 3D: грань с отверстием рисуется с дыркой (триангуляция с мостом), внутри видно тёмную изнанку соседних граней.
- [ ] **Step 4:** smoke: Овчарка 5 + отверстие в глазу → раскрой и DXF собираются, контур отверстия есть; `save` → загрузка `.json` → отверстие на месте.
- [ ] **Step 5:** глазами (3D и вкладка раскроя). → коммит `Отверстие из замкнутой линии (#N)`.

### Task 9: Версии (тикет 9)

**Files:**
- Create: `shepherd-v6j3w/js/versions.js`, `shepherd-v6j3w/tools/versions.test.js`
- Modify: `js/ui.js` (`save()`, выпадашка, загрузка версии), `index.html`, `js/tips.js`, `tools/smoke.js`

**Interfaces:**
- Consumes: `save()` (`ui.js:204`) — тот же JSON, что скачивается (с `P`, `S`, `H`, `ref`, `frame`), + разметка `mk`.
- Produces: `verList(st /*storage-обёртка {get,set}*/, base)→[{n, at, key}]`; `verPut(st, base, json)→{n}|{err:string}`; `verGet(st, key)→object|null`; ключи `'shepherd-ver-<base>-<n>'`, список `'shepherd-ver-<base>'`; имя в выпадашке `<FIGURES[base].name>.<n>` («Овчарка 5.1»). Версия грузится как фигура из `.json` (`ref` и кадр кальки сохраняются).

- [ ] **Step 1:** `versions.test.js` с поддельным хранилищем: `verPut` даёт n = 1, 2, 3; `verList` по порядку; `verGet` возвращает то же; хранилище бросает исключение → `verPut` → `{err}` (Review Focus 3), `verList` → `[]`.
- [ ] **Step 2:** FAIL → `versions.js` → PASS.
- [ ] **Step 3:** «Сохранить»: `verPut` + скачивание `.json`; ошибка хранилища → скачивание всё равно, сообщение «Версию в браузере сохранить не удалось — сохранён только файл». В выпадашке под базовой фигурой — её версии; выбор — загрузка версии с её разметкой.
- [ ] **Step 4:** smoke: `versions.js` подключён, «Сохранить» зовёт `verPut`; глазами: «Овчарка 5.1», «5.2», переключение, перезагрузка — версии на месте.
- [ ] **Step 5:** коммит `Версии фигуры в браузере (#N)`.

## Порядок и ночной запуск

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Задачи 1, 2, 3, 9 независимы; 5, 6 — после 4; 7 — после 6; 8 — после 7. Ночью — по порядку; на первом красном, который не чинится за 2 попытки, — остановиться и записать в тикет, что сломано. Задача 1 ночью даёт картинки и отчёт; решение по ней — Виталий утром, на задачи 2–9 она не влияет (кроме порога «формы оригинала» в задаче 5: без решения — 4°).
