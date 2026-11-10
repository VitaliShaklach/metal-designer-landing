# Мастерская фигур, часть А: план работ

> **Для агентов:** ОБЯЗАТЕЛЬНЫЙ ПОД-СКИЛ: superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans, задача за задачей. Шаги — чекбоксы (`- [ ]`). Одна задача = один тикет (`/to-tickets` и `/implement` запускает Виталий).

**Цель:** программа на компе Виталия (`npm run studio`) сама чистит фигуру из Meshy или копию опубликованной, показывает остаток в Проверке и по кнопке выкладывает фигуру новой строкой в выпадашку «Фигура» на сайте. Без Claude и без ИИ.

**Архитектура:** геометрия Проверки и автоматики — обычные скрипты в `studio/js/`. В браузере они работают рядом с движком `editor/lynx/js/`, в Node — в одном `vm`-контексте с ним, как сейчас `smoke.js`. Сервер мастерской на Node (`studio/server.js`, только 127.0.0.1) отдаёт ту же страницу `editor/lynx/` и вкладывает в неё панель. Тяжёлую чистку сетки делает Python (libigl + CGAL) в `studio/py/`. Публикация и черновики идут через отдельные git worktree веток `master` и `drafts`, рабочую папку Виталия не трогают.

**Стек:** Node 24 (без новых npm-зависимостей), `node:test`, Playwright 1.64.1; Python 3.13, libigl 2.6.3, numpy 2.4.4, ezdxf; three.js r128 из `vendor/`.

**Спека:** `docs/superpowers/specs/2026-11-09-figure-studio-design.md`. Читать вместе с планом. Где текст спеки расходится с таблицей «Решения грилинга», действует таблица. **Часть Б в план не входит:** у неё свой короткий грилинг и свой план (решение Q19).

## Общие ограничения

- Лендинг (`index.html`, `md/`, `lynx/`, `tools/lynx-capture.js`) не трогаем. Рысь 14 на сайте не меняется: `editor/lynx/js/plates-lynx14.js` побайтно как сейчас.
- `C:\dev\metal-designer` только читаем и копируем. Никаких записей туда и запусков, которые пишут туда.
- Публичный сайт: только HTML, CSS, JS, без сервера и сторонних запросов; 390 px без прокрутки вбок. Поменялся `js/*.js` или `css/*.css` страницы — новая дата в `?v=` у всех её `<script>` и `<link>`.
- Публичная страница никогда не обращается к серверу мастерской, панели на ней нет.
- Мастерская: Node и Python (3.13, libigl 2.6.3 с CGAL и embree). Версии — в `studio/py/requirements.txt`, команда установки — в `CLAUDE.md`.
- Сервер мастерской: только `127.0.0.1`, порт по умолчанию **8765** (не 8000). Команды принимает только от своей страницы: заголовок `Origin` равен `http://127.0.0.1:<порт>`, `Host` равен `127.0.0.1:<порт>`, токен `X-Studio-Token` — случайный, 32 байта, новый на каждый запуск.
- Zip из Meshy — недоверенные данные: берём только `.obj`, `.mtl`, `.png` по голому имени файла, ничего не запускаем.
- Нигде нет ИИ, только геометрия по правилам. Асимметричных фигур нет: все зеркальные лево ↔ право.
- Алгоритмы `prod.js`, `bend.js`, `sheets.js` не меняем. `extrude` и `poke` в `edit.js` остаются: на них завязаны тесты.
- Фигуры с отметкой «только на этом компе» (`localOnly`, доберман) не попадают ни в `master`, ни в `drafts`. Доберман и бык не попадают в репозиторий вообще.
- Единицы. Геометрия хранится в рабочей рамке модели, её мм — «мм модели». Пороги Проверки — в «мм сайта»: мм модели × `scale`, где `scale = H / высота модели` (H — высота на сайте, по умолчанию 1000). У рыси 14 `scale = 1000 / 595,0`.
- Начальные пороги (`TH_DEFAULT`, мм сайта и градусы): `planar 0.1`, `edge 5`, `near 8`, `ang 5`, `lineLo 172`, `lineHi 179.5`, `width 15`, `seam 5`, `ref 2`, `H 1000`. Минимальная прорезь — толщина листа со страницы (`ST.t`, по умолчанию 2 мм).
- Слова — как в `GLOSSARY.md` и разделе «Слова» спеки: эталон, грань, шов, деталь, прорезь, мастерская, Проверка. Тексты интерфейса — по-русски.
- Ветка `figure-studio` от текущего `landing-v2-mangal` (в нём спека). В `master` — только по команде Виталия. Первая публикация — после слияния мастерской с `master` (риск 4 спеки).
- Перед каждым коммитом зелёные: `NODE_OPTIONS=--use-system-ca npm test`, `NODE_OPTIONS=--use-system-ca npm run test:editor`, `NODE_OPTIONS=--use-system-ca npx playwright test`, `npm run test:studio`. С задачи 5 к ним добавляется `NODE_OPTIONS=--use-system-ca npm run test:studio:e2e`, с задачи 11 — `python -m unittest discover -s studio/py/tests -v`. Тесты, которым нужны файлы из `C:\dev` (эталон `src5`, доберман), без этих файлов пропускаются (`skip`) с причиной.

## На что смотреть при ревью

1. **Посетитель уже был на сайте.** В `localStorage` лежит `art-fig=lynx14`, а на сайте вышла «Рысь 2». Первой открывается «Рысь 2»; `#f=lynx14` в адресе открывает рысь 14. Тест — в задаче 8.
2. **Свет выключился посреди автосохранения.** На диске обрезанный `figure.json` или брошенный `figure.json.tmp`. Мастерская открывает фигуру из последнего целого состояния и ничего не теряет молча. Тест — в задаче 5.
3. **Порт 8000 уже занят.** Виталий держит `python tests/serve.py` из рабочей папки, а Playwright из копии `master` по `reuseExistingServer` тестирует чужие файлы и даёт ложный «зелёный». Публикация гоняет Playwright на своём порту со своим сервером. Тест — в задаче 9.
4. **Чужой сайт в том же браузере** шлёт POST на `127.0.0.1:8765/api/publish`, в том числе через DNS-rebinding (чужой `Host`). Ответ 403, ничего не происходит. Тест — в задаче 5.
5. **Название с кавычками и скобками или уже занятое:** `Рысь "Лапа" <b>`, `</script>`, «Рысь». На сайте текст экранирован и в `<option>`, и в JS-файле; id не зависит от названия; занятое название — понятный отказ. Тест — в задаче 8.

---

## Часть 1. Проверка и автоматика в Node

### Задача 1: Стенд и правила Проверки по геометрии

**Файлы:**
- Создать: `studio/lib/engine.js`, `studio/js/rules.js`, `studio/tools/report.js`, `studio/tests/rules.test.js`, `studio/tests/helpers.js`
- Перенести: `editor/lynx/tools/plates/clean.js` → `studio/js/clean.js` (обычный скрипт: `function makeClean(g)`, тело прежнее; `if(typeof module!=='undefined')module.exports=makeClean`). Поправить `editor/lynx/tools/smoke.js:102` на новый путь.
- Изменить: `package.json` (`"test:studio": "node --test studio/tests/*.test.js"`)

**Интерфейсы:**
- Производит:
  - `STUDIO_JS = ['clean','ref','rules','fix','faces','auto']` в `studio/lib/engine.js`: порядок скриптов `studio/js/`, один на Node и на страницу мастерской. Файлы, которых ещё нет, пропускаются.
  - `loadFigureEngine({studio=true}={}) → {ctx, run(expr: string): any}`. Грузит `mesh, edit, models-poly, figures`, все `plates-*.js` из `editor/lynx/index.html`, затем `prod, sheets, bend, bend3d, trace` и `STUDIO_JS` в один `vm`-контекст.
  - В `rules.js` (глобальные имена): `TH_DEFAULT` (значения — в «Общих ограничениях»); `RULES: {n, title, color}[]`, 17 строк, `title` — столбец «Правило» спеки.
  - `checkFigure(E: {V,P,S}, o: {th?, scale: number, kind: 'stand'|'wall', slots?: number[][], keep?: Keep[], t?: number, ref?: RefIndex|null, base?: {V,P}, region?: {c: number[], r: number}}) → Issue[]`. С `region` проверяется только шар `r` вокруг `c`, а пороги вдвое строже.
  - `Issue = {rule: number, at: [x,y,z], faces: number[], verts: number[], val: number, text: string, fix: boolean, info: boolean}`. `val` — в мм сайта или градусах. `text` — по-русски, например «грань неплоская на 0,42 мм».
  - `Keep = {rule, at}`. `keepMatch(issue, keep, scale) → boolean`: правило то же, `at` ближе 5 мм сайта.
  - `ruleCounts(issues) → {[rule]: number}`; информационные строки не считаются.

- [ ] **Шаг 1: Тесты** `rules.test.js`. Фигуры для тестов — в `helpers.js` из `blankBox(300,400,260)`, `scale: 1`:

| Тест | Фигура | Ожидание |
|---|---|---|
| `куб чистый` | `blankBox` | `checkFigure` → `[]` |
| `правило 1` | угол верхней грани поднят так, что `polyDev` = 0,3 мм / 0,05 мм | одна строка правила 1 на этой грани / нет строк |
| `правило 2` | у куба срезан угол треугольником с рёбрами 4 мм (как `CB` в `smoke.js:102`) | строки правила 2, `val ≈ 4` |
| `правило 3` | на двух рёбрах у одного угла вставлены точки в 4 мм от угла | строка правила 3 с этими двумя точками |
| `правило 4` | верхняя грань разрезана из угла в точку в 10 мм от соседнего угла (угол < 5°) | строка правила 4 |
| `правило 5` | точка на ребре верхней грани сдвинута наружу так, что угол 176° / ровно на ребре | строка «почти на прямой» / строка «лишняя точка» |
| `правило 6` | `blankBox(300,400,10)` | 4 строки правила 6, `val = 10` |
| `правило 7` | верх разрезан `splitPoly` (излом 0°), эталона нет | строка правила 7 |
| `правило 8` | `delPoly` верхней грани / то же, контур в `o.slots` / дыра на z = 0 при `kind:'wall'` | строка / нет / нет |
| `правило 9` | крест из двух плит (как `piercePolys` в `smoke.js`) | строка правила 9 |
| `правило 10` | одна точка правой половины сдвинута на 0,5 мм | строка правила 10 |
| `правило 13` | у одной грани обратный обход | строка правила 13 |
| `правило 14` | грань из трёх точек на одной прямой | строка правила 14 |
| `правило 16` | прорезь шириной 1 мм в `o.slots`, `t: 2` | строка правила 16 |
| `оставить так` | правило 1, в `keep` то же место ± 3 мм / ± 8 мм | строки нет / строка есть |
| `строже в области` | `polyDev` верхней грани = 0,07 мм; без `region` / с `region` вокруг неё | нет / строка |

  Тесты на рыси 14 (`E = modelPoly('lynx14')`, `scale = 1000 / высота`):
```js
test('рысь 14: 1372 точки, 1133 грани, худшая неплоскость 1,33 мм', () => {
  assert.equal(E.V.length, 1372); assert.equal(E.P.length, 1133);
  const w = Math.max(...iss.filter(i => i.rule === 1).map(i => i.val));
  assert.ok(Math.abs(w - 1.33) < 0.05);
});
test('рысь 14: три скрина Виталия — есть строки правил 1, 3, 4, 6', ...);
test('рысь 14: Проверка без эталона и без правила 12 — меньше 2 с', ...);   // риск 3
```
- [ ] **Шаг 2:** `npm run test:studio` — FAIL (`checkFigure` не определён).
- [ ] **Шаг 3:** написать `rules.js`. Готовое из движка: `polyDev`, `nonPlanar`, `mirrorMap`, `openVerts`, `selfXPolys`, `piercePolys`, `orientPolys`, `buildParts`, `bendPlan`, `bendOverlap`, `cutContour`, `clean.width`. Как считать правила:
  - 5: угол 172…179,5° — «почти на прямой». Угол ≥ 179,5° во всех гранях точки — «лишняя точка».
  - 6: ширина детали из `buildParts(…, 1.5, 1.5)`, как у красной подсветки сайта.
  - 7 без эталона: излом шва < `seam`.
  - 12: `buildParts` и `bendPlan` без исключений и без `bad`.
  - 15: строка `info`, если `bendOverlap` развёртки двух соседних граней ≠ 0.
  - 11 и проверка эталоном в правиле 7 — задача 2. Правило 17 — задача 8.
  - Порядок строк: по правилу, внутри — по `val` от худшего.
- [ ] **Шаг 4:** `report.js`: `node studio/tools/report.js <lynx14 | файл.json> [--ref <obj>] [--half left|right]` печатает таблицу «Правило | Сколько | Худшее» и строки замера спеки (грани, точки, неплоские > 0,17 и > 0,84 мм, рёбра < 5 и < 17 мм, углы < 5° и < 12°, точки > 172°, пары ближе 8 мм, открытые рёбра). Отличия от таблицы спеки объяснить в коммите (например, правило 3 не считает пары с ребром).
- [ ] **Шаг 5:** `npm run test:studio` и `npm run test:editor` — PASS.
- [ ] **Шаг 6: Коммит** «Мастерская: правила Проверки и отчёт по рыси 14».

### Задача 2: Эталон: похожесть, изломы и линии

**Файлы:**
- Создать: `studio/js/ref.js`, `studio/lib/refbuild.js`, `studio/lib/png.js` (копия `C:\dev\metal-designer\art\tools\plates\png.js`), `studio/lib/sources.js`, `studio/tests/ref.test.js`
- Изменить: `studio/js/rules.js` (правило 11, эталон в правиле 7), `studio/tools/report.js` (`--ref`), `studio/tests/helpers.js` (`makePNG(w,h,fn) → Buffer`)

**Интерфейсы:**
- Потребляет: `checkFigure`, `Issue` (задача 1); `traceLoad`, `traceNear` из `editor/lynx/js/trace.js`.
- Производит:
  - `LYNX_REF = 'C:/dev/metal-designer/art/private/src5/lynx.obj'` (рядом `lynx.png`); переопределяется `STUDIO_LYNX_REF`.
  - `refFrame(V) → V'`: рамка конвейеров (высота 600, x по центру, низ y = 0, z от 0), как `tools/plates/ref.js` в `C:\dev`.
  - Node: `buildRef(objPath, pngPath|null, {half: 'left'|'right', frame: 'meshy'|'lynx14'}) → {V, F, trace: string|null}`. Берёт выбранную половину и её зеркало.
    - `frame:'meshy'` — `refFrame`, для новых моделей.
    - `frame:'lynx14'` — ровно то преобразование, которым `C:\dev\…\private\make-lynx14.js` переводил `src5` в рамку рыси 14 (рысь 14 высотой 595,0, а не 600). Если там рамка считалась по телу без хвоста и глаз, повторить так же. Совпадение проверяет тест медианы.
    - `trace` — облако линий текстуры в формате `trace.js` (перенос `tracing.js`); без PNG — `null`.
  - Браузер и Node: `refIndex(ref) → RefIndex` (сетка по треугольникам, облако через `traceLoad`); `refDist(R, p) → мм модели`; `faceDev(E, R, scale) → Float64Array` — наибольшее отклонение грани в мм сайта по точкам грани и сетке внутри неё с шагом 10 мм сайта.
  - `checkFigure`: правило 11 — грани с `faceDev > th.ref`. Правило 7 с эталоном — шов лишний, только если излом < `seam`, на эталоне рядом нет излома ≥ `seam` и `traceNear` не находит линии в 3 мм. Если `o.ref == null`, правило 11 меряется от `o.base` (фигура, какой её открыли), и в списке строка `info`: «Эталона нет: похожесть меряю от открытой фигуры».

- [ ] **Шаг 1: Тесты** `ref.test.js`:
  - `сфера`: эталон — сфера R 100 (мелкая сетка), фигура — икосаэдр в неё. `faceDev` совпадает со стрелкой сегмента до 0,05.
  - `зеркало`: у эталона справа бугор 10 мм, `half:'left'`. Бугра в индексе нет, `refDist` симметричен по x.
  - `линии`: куб с текстурой из `makePNG`, светлая полоса посередине грани. Шов по полосе не лишний, шов в 60 мм от неё лишний (правило 7).
  - `без эталона`: фигура сдвинута на 3 мм от `base` — строка правила 11 и строка `info`.
  - `рысь 14 против src5` (skip без файла): `buildRef(LYNX_REF, png, {half:'left', frame:'lynx14'})`. Медиана `refDist` по точкам ≤ 0,06 мм сайта (в спеке 0,04). Граней левой половины дальше 2 мм — 28 ± 3 из 558.
- [ ] **Шаг 2:** `npm run test:studio` — FAIL.
- [ ] **Шаг 3:** написать `ref.js`, `refbuild.js`, правку `rules.js`. `report.js --ref` печатает строки «точки: медиана, 90 %, дальше 2 мм» и «грани дальше 0,5 / 1 / 1,5 / 2 мм», как в замере 10.11 спеки.
- [ ] **Шаг 4:** `npm run test:studio` — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: эталон — похожесть, изломы и линии».

### Задача 3: Починка и цикл автоматики → черновик «Рысь 2»

**Файлы:**
- Создать: `studio/js/fix.js`, `studio/js/auto.js`, `studio/tools/auto.js`, `studio/tests/fix.test.js`

**Интерфейсы:**
- Потребляет: `checkFigure`, `Issue`, `keepMatch` (задача 1); `RefIndex`, `faceDev` (задача 2); `makeClean(g)` → `solve`, `collapseShort`, `mergeSeam`, `extraSeams`.
- Производит:
  - `fixIssue(E, issue, o) → {E, moved, dev, why}`. `E` на входе не меняется. `moved` — наибольший сдвиг точки, `dev` — наибольшее `faceDev` затронутых граней (оба в мм сайта). `why` — причина отказа по-русски, например «слить нельзя: грань станет неплоской на 3 мм», или `null`.
  - `autoClean(E, o & {maxRounds=20, onStep?}) → {E, log: {issue, done, why?}[], before, after}`. `before` и `after` — `ruleCounts`. Правка остаётся, только если ни одно правило не стало хуже и правило 11 цело. Иначе откат, и `why` в журнал. Места из `keep` не трогаются.
  - `addAllSeams(E) → E`: швы `S` на всех рёбрах между гранями (шаг 8 спеки).

- [ ] **Шаг 1: Тесты** `fix.test.js` на фигурах задачи 1. После `fixIssue` строки правила нет, `moved` ≤ ожидаемого:

| Правило | Как чинит (таблица правил спеки) |
|---|---|
| 1 | `solve`; если `dev > th.ref` — грань режется по диагонали на две плоские (тест: угол поднят на 6 мм, `th.ref: 1` → граней стало +1, обе плоские) |
| 2 | ребро стягивается в точку (`collapseShort`, `maxLen = th.edge / scale`) |
| 3 | точки сливаются в одну |
| 4 | игла сливается с соседней гранью по длинной стороне или стягивается короткая сторона |
| 5 | точка встаёт на прямую; «лишняя точка» удаляется |
| 6 | слить с соседом через самый плоский шов (`mergeSeam`) |
| 7 | убрать шов (`mergeSeam`) |
| 8 | дыра закрывается гранью; прорези и стена (`wall`, z = 0) не трогаются |
| 10 | пары точек подгоняются к зеркалу, точки середины — на x = 0 |
| 13 | грань разворачивается |
| 14 | точки сливаются, грань удаляется |
| 16 | прорезь расширяется, если правило 11 позволяет; иначе `why` |

  Ещё тесты:
  - `правило 11 держит`: починка уводит форму на 3 мм при `th.ref: 2` → не делается, `why` содержит «мм».
  - `откат`: починка, после которой растёт число строк другого правила, откатывается, в `log` есть `why`.
  - `оставить так`: место из `keep` после `autoClean` на месте.
  - `швы S`: после `addAllSeams` у `buildParts(E,1.5,1.5)` деталей столько же, сколько граней.
  - `рысь 14` (skip без src5): `autoClean` с эталоном укладывается в 5 минут. Ни одно правило не стало хуже. Строк правил 1–5 вместе — не больше трети от исходного. `faceDev` ≤ 2 везде, кроме мест с `why`.
- [ ] **Шаг 2:** `npm run test:studio` — FAIL.
- [ ] **Шаг 3:** написать `fix.js` и `auto.js`. Порядок починки за проход: 14, 13, 2, 3, 5, 4, 10, 1, 6, 7, 8, 16. Правило 9 только откатывает правку, которая его создала. Швы на линии эталона автоматика **не двигает** (риск 7 спеки). Инкрементальная или полная перепроверка — на выбор исполнителя, лишь бы тест рыси уложился в 5 минут.
- [ ] **Шаг 4:** `studio/tools/auto.js`: `node studio/tools/auto.js lynx14 --ref <obj> --half left --name "Рысь 2" --out <файл.json>` пишет фигуру в формате `save()` из `ui.js` (её открывает кнопка «Открыть модель») и печатает «было → стало» по `report.js`.
- [ ] **Шаг 5:** `npm run test:studio`, `npm run test:editor` — PASS. Прогнать `auto.js` на рыси, файл показать Виталию: открыть «Открыть модель» на `http://localhost:8000/editor/lynx/`.
- [ ] **Шаг 6: Коммит** «Мастерская: цикл автоматики, черновик «Рысь 2» из рыси 14».

## Часть 2. Публичная страница

### Задача 4: Без четырёх кнопок, свет по грани

**Файлы:**
- Изменить: `editor/lynx/index.html:59-60` (убрать строку `edD` и кнопки `op_extrude`, `op_inset`, `op_bump`, `op_pit`; `?v=`), `editor/lynx/js/ui.js` (из таблицы операций убрать `extrude, inset, bump, pit` и чтение `edD`), `editor/lynx/js/tips.js` (подсказки `extrude, inset, bump, pit, edD`), `editor/lynx/js/mesh.js` (`polyMesh`, `fitMesh`, новая `faceNormals`), `editor/lynx/js/view3d.js` (`build3D`), `editor/lynx/tools/smoke.js`, `tests/e2e/lynx.spec.js`

**Интерфейсы:**
- Производит:
  - `polyMesh(V, polys) → {V, F, FP}`, где `FP[i]` — номер грани у треугольника `i`. `fitMesh` и путь страницы до `build3D` (`toPoly`, `mergeFlat`) `FP` сохраняют.
  - `faceNormals(M3) → Float32Array(F.length*9)`: у всех треугольников грани одна нормаль — нормаль грани (сумма нормалей её треугольников по площади, единичная). Без `FP` — нормаль каждого треугольника, как сейчас.
  - `build3D`: если у `M3` есть `FP`, атрибут `normal` берётся из `faceNormals`, у материала фигуры `flatShading:false`.

- [ ] **Шаг 1: Тесты.** `smoke.js`:
  - в `index.html` нет `op_extrude|op_inset|op_bump|op_pit|id="edD"`, есть `op_split, op_del, op_merge, op_cut, bFlat, bTri, bUndo, bRedo, bBlank, bOpen, bSave`;
  - в `tips.js` нет ключей `extrude, inset, bump, pit, edD`;
  - рысь 14 через `polyMesh` → `fitMesh`: у треугольников одной грани нормали из `faceNormals` совпадают до 1e-6, длина 1, скалярное произведение с нормалью треугольника > 0;
  - старые тесты `extrude`, `poke` в `smoke.js:18-20` остаются.

  `lynx.spec.js` (desktop и phone):
  - в режиме «Править фигуру» четырёх кнопок и поля «На сколько, мм» нет;
  - «Разрезать пополам» на кубе-заготовке, «Отменить», «Вернуть» работают;
  - нет ошибок в консоли, нет прокрутки вбок.
- [ ] **Шаг 2:** `npm run test:editor` — FAIL.
- [ ] **Шаг 3:** правки по списку файлов, `?v=` у всех тегов `editor/lynx/index.html`.
- [ ] **Шаг 4:** все тесты — PASS. Глазами: лоб рыси 14 на `http://localhost:8000/editor/lynx/#v=front` без веера теней; жёлтая подсветка неплоских граней на месте.
- [ ] **Шаг 5: Коммит** «Рысь: без «Выдавить/Вдавить/Бугор/Впадина», свет по грани».

## Часть 3. Мастерская на компе

### Задача 5: Сервер, рабочая папка, автосохранение, «Открыть опубликованную»

**Файлы:**
- Создать: `studio/server.js`, `studio/lib/workdir.js`, `studio/lib/names.js`, `studio/ui/panel.js`, `studio/ui/panel.css`, `studio/tests/server.test.js`, `studio/tests/workdir.test.js`, `studio/tests/playwright.config.js`, `studio/tests/e2e/studio.spec.js`
- Изменить: `editor/lynx/js/ui.js` (`const HOOKS={changed:[],paint:null}`; `HOOKS.changed` зовётся после каждой смены `ST.base`, в том числе отмены, возврата и перетаскивания точки; `?v=`), `package.json` (`"studio": "node studio/server.js"`, `"test:studio:e2e": "playwright test -c studio/tests/playwright.config.js"`), `.gitignore` (`studio/work/`, `studio/.wt/`, `studio/tests/.work/`), `CLAUDE.md` (раздел «Мастерская»: что это, `npm run studio`, где рабочие папки), `tests/e2e/lynx.spec.js`

**Интерфейсы:**
- Потребляет: `STUDIO_JS` (задача 1), `buildRef`, `LYNX_REF` (задача 2).
- Производит:
  - `createStudio({root, work, port=8765, open=true}) → Promise<{url, token, close()}>`. CLI: `node studio/server.js [--port N] [--work DIR] [--no-open]`. Браузер открывается на `http://127.0.0.1:<порт>/editor/lynx/`.
  - Отдача файлов: GET любого файла репозитория, кроме `studio/work/**`, `studio/.wt/**`, `.git/**`; пути за пределами корня — 404. В ответ на `editor/lynx/` и `editor/lynx/index.html` сервер перед `</body>` вкладывает `<script>STUDIO={token:"…",port:N}</script>`, `panel.css` и скрипты `studio/js/<STUDIO_JS>.js` и `studio/ui/panel.js`. Файл на диске не меняется.
  - API: POST JSON, проверки `Origin`, `Host` и `X-Studio-Token` (иначе 403):
    - `/api/list` → `{figures: {slug, name, kind, localOnly, mtime}[], published: {id, name}[], last}`;
    - `/api/open {slug}` → `{figure, undo, redo, ref}`;
    - `/api/copy {id}` → `{slug}`;
    - `/api/save {slug, figure, undo, redo}`;
    - `/api/settings {set?|reset?}` → `{th}`;
    - `/api/job {job}` → `{stage, pct, done, error, result}` — ход долгих операций, берут задачи 9, 10 и 12.
  - Рабочая папка `work/<slug>/`:
    - `figure.json` = `{type:'md-studio', v:1, name, kind, localOnly, H, V, P, S, keep: Keep[], slots, refHalf}`;
    - `undo.json` = `{undo: string[], redo: string[]}`, до 60 шагов, как `UNDO` в `ui.js`;
    - `ref/ref.json` — вывод `buildRef`, `ref/src/` — копия эталона;
    - `versions/` — задача 6.

    Общие файлы: `work/settings.json` = `{th}`, `work/state.json` = `{last}`.
  - `writeAtomic(path, data)`: запись в `.tmp`, затем `rename`. `readFigure(slug)`: `figure.json` не читается → берётся новейший `versions/*.json`, битый файл сохраняется как `figure.broken-<время>.json`, в ответе предупреждение.
  - `slugify(name) → латиница` (транслит, без повторов); `nextName(base, taken) → string`: «Рысь» занята → «Рысь 2», «Рысь 2» занята → «Рысь 3».
  - `/api/copy {id}`: копия `modelPoly(id)` под `nextName`. `kind`, `slots`, `keep`, `th` — из `FIGURES[id]`, если есть. У рыси 14 их нет: `kind:'stand'`, прорези — открытые контуры (глаза), эталон — копия `LYNX_REF` через `buildRef(…, {half:'left', frame:'lynx14'})`. Эталона нет — Проверка пишет об этом (задача 2). `C:\dev` только читается.
  - Панель (`panel.js`, в стиле редактора): список «Мои фигуры», «Открыть опубликованную» (копией), открытая фигура грузится в страницу через `applyE`. На `HOOKS.changed` — автосохранение не позже чем через 500 мс. При запуске открывается фигура `last`.

- [ ] **Шаг 1: Тесты** `server.test.js` (сервер на свободном порту, `work` во временной папке):
  - `слушает только 127.0.0.1`: `server.address().address === '127.0.0.1'`;
  - `без токена / чужой Origin / чужой Host` → 403 (ревью, п. 4);
  - `страница мастерской`: GET `/editor/lynx/` содержит токен и `panel.js`; файл `editor/lynx/index.html` на диске без изменений;
  - `закрытые пути`: `/studio/work/x/figure.json`, `/.git/config`, `/%2e%2e/package.json` → 404;
  - `копия рыси`: `/api/copy {id:'lynx14'}` → slug `rys-2`, имя «Рысь 2», V и P как у `modelPoly('lynx14')`; с `STUDIO_LYNX_REF` на тестовый OBJ — `ref/ref.json` есть;
  - `закрыл и открыл`: `/api/save`, `close()`, новый `createStudio` → `/api/open` отдаёт ту же фигуру и `undo`, `/api/list` → `last` прежний.

  `workdir.test.js`:
  - `свет выключился` (ревью, п. 2): обрезанный `figure.json` и брошенный `.tmp` → `readFigure` отдаёт последнюю версию и предупреждение, битый файл переименован;
  - `slugify`, `nextName`;
  - `настройки`: `set {planar:0.3}` → в `th` 0,3; `reset` → `TH_DEFAULT`.

  `studio.spec.js` (Playwright, сервер `--port 8766 --work studio/tests/.work --no-open`):
  - на странице есть панель;
  - «Открыть опубликованную» → «Рысь» → в 3D «Рысь 2»;
  - «Разрезать пополам» → через 1 с `figure.json` изменился;
  - перезагрузка → граней столько же, «Отменить» откатывает разрез.

  `lynx.spec.js` (публичная): нет `#studioPanel`, нет запросов на `127.0.0.1:8765` и `:8766`.
- [ ] **Шаг 2:** тесты — FAIL.
- [ ] **Шаг 3:** написать сервер на встроенном `http`, без новых пакетов. Браузер на Windows открывается через `cmd /c start "" <url>`.
- [ ] **Шаг 4:** все тесты — PASS. `npm run studio` открывает мастерскую.
- [ ] **Шаг 5: Коммит** «Мастерская: сервер на 127.0.0.1, рабочая папка, автосохранение, копия рыси».

### Задача 6: Панель Проверки, карта отклонений, «Здесь криво», «Настройки»

**Файлы:**
- Изменить: `studio/ui/panel.js`, `studio/ui/panel.css`, `editor/lynx/js/ui.js` и `editor/lynx/js/view3d.js` (`build3D` берёт `o.paint(fi) → THREE.Color|null` из `HOOKS.paint` и красит треугольник поверх обычного цвета; `?v=`), `studio/tests/e2e/studio.spec.js`

**Интерфейсы:**
- Потребляет: `checkFigure`, `RULES`, `keepMatch` (задача 1); `refIndex`, `faceDev` (задача 2); `fixIssue`, `autoClean` (задача 3); `HOOKS`, `/api/save`, `/api/settings` (задача 5); `FP` (задача 4); `pushUndo`, `applyE`, `flyTo`, `pickHit` (`ui.js` и `view3d.js`).
- Производит: в панели вкладки «Проверка» и «Настройки».

- [ ] **Шаг 1: Тесты** `studio.spec.js` на фигуре-образце из `studio/tests/.work` (куб с правилами 1, 2, 6 из задачи 1):
  - `список`: группы по правилам с числом; цель «пусто»;
  - `клик по строке`: камера сдвинулась (`window.__studio.cam()` до и после), грани места подкрашены;
  - `Исправить`: предпросмотр с текстом «уйдёт на … мм», затем «Сделать» → строк меньше; «Отменить» возвращает;
  - `Оставить так`: строка ушла и не вернулась после перезагрузки; `keep` в `figure.json`;
  - `Исправить всё безопасное`: одно «Отменить» возвращает всё;
  - `Здесь криво`: клик по чистой грани → «по правилам здесь чисто»; по грани с `polyDev` 0,07 мм (меньше порога 0,1, больше половины) → строка;
  - `Карта отклонений`: переключатель включает раскраску и легенду «совпадает … 2 мм и дальше»; выключение возвращает цвета;
  - `Настройки`: `planar` 0,1 → 2 — строки правила 1 пропали; «Вернуть как было» — вернулись (приёмка 10).
- [ ] **Шаг 2:** `npm run test:studio:e2e` — FAIL.
- [ ] **Шаг 3:** написать.
  - Перепроверка — на каждый `HOOKS.changed`.
  - «Исправить» и «Исправить всё безопасное» идут через `pushUndo()` + `applyE()`. Всё безопасное — один `pushUndo`.
  - Цвета: правило 6 — красный, 1 — жёлтый, 9 — синий и фиолетовый (как `COL` в `view3d.js`), остальные — свои.
  - «Здесь криво»: `checkFigure` с `region: {c, r: 60 мм сайта}`.
  - Карта — `faceDev` по граням через `FP`.
  - Строки решений автоматики (`info` из `log`) — группа «Сведения». Кнопку «Поменять» у ролей кусков и выбора половины добавляет задача 12.
- [ ] **Шаг 4:** все тесты — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: панель Проверки, карта отклонений, настройки порогов».

### Задача 7: «Сохранить версию» и ветка `drafts`

**Файлы:**
- Создать: `studio/lib/git.js`, `studio/lib/drafts.js`, `studio/tests/drafts.test.js`
- Изменить: `studio/server.js` (`/api/version`), `studio/ui/panel.js` (кнопка «Сохранить версию»)

**Интерфейсы:**
- Потребляет: рабочую папку (задача 5).
- Производит:
  - `git(args, {cwd}) → Promise<{code, out, err}>`;
  - `ensureWorktree(repo, branch, dir, {orphan})`;
  - `saveVersion(repo, work, slug) → Promise<{n, pushed, msg}>`:
    - пишет `versions/NNN.json` (001, 002…; номер на сайте не тратит);
    - не `localOnly` — копирует `figure.json`, `versions/NNN.json` и исходник (`src/`, а у копий опубликованных — `ref/src/`) в `drafts:figures/<slug>/` через worktree `studio/.wt/drafts`, коммит «Черновик: <Название> v<N>», `git push origin drafts`;
    - ветки нет ни локально, ни на `origin` — создаётся сиротой (`git worktree add --orphan`).
  - Сообщения: нет сети — «Версия на диске. Отправлю в облако при следующем сохранении»; `localOnly` — «Только на этом компе: в облако не отправляю».

- [ ] **Шаг 1: Тесты** `drafts.test.js` (временный репозиторий с одним коммитом и `origin` — `git init --bare` во временной папке):
  - `первая версия`: в `origin` появилась `drafts`, в ней только `figures/rys-2/…`; `master` и текущая ветка не сдвинулись; `git status --porcelain` рабочей папки тот же;
  - `только на этом компе`: в `drafts` ничего, `versions/001.json` на диске;
  - `нет сети`: `origin` — несуществующий путь → `pushed:false` и сообщение; `origin` починили, вторая версия → в `origin/drafts` обе;
  - `название не меняется`: после трёх версий имя фигуры то же (номер даёт только публикация).
- [ ] **Шаг 2:** `node --test studio/tests/drafts.test.js` — FAIL.
- [ ] **Шаг 3:** написать `git.js`, `drafts.js`, кнопку.
- [ ] **Шаг 4:** `npm run test:studio` — PASS (приёмка 9).
- [ ] **Шаг 5: Коммит** «Мастерская: «Сохранить версию» — диск и ветка drafts».

## Часть 4. Сайт и публикация

### Задача 8: Сайт для нескольких фигур

**Файлы:**
- Создать: `studio/lib/site.js`, `studio/tests/site.test.js`, `editor/lynx/tools/figures.test.js`, `studio/tools/figure-files.js`, `studio/py/dxf_check.py` (копия `C:\dev\metal-designer\art\tools\dxf-check.py`), `studio/py/requirements.txt` (`ezdxf` — версия, которую поставит `pip`; остальное — в задаче 11)
- Изменить:
  - `editor/lynx/js/models-poly.js`: точность из файла, `m.V[i]/(m.k||10)`. Иначе округление до 0,1 мм модели (0,17 мм сайта) ломает правило 1 у опубликованной фигуры.
  - `editor/lynx/js/ui.js`: по умолчанию `#f=` из адреса, иначе **последняя** `<option>` в `#figSel`. Чтение и запись `art-fig` убрать. `?v=`.
  - `editor/lynx/tools/smoke.js:329-330` и `tests/e2e/editor.spec.js:94-100`: вместо «одна Рысь» — общее правило.
  - `package.json`: `test:editor` += `node --test editor/lynx/tools/figures.test.js`.

**Интерфейсы:**
- Потребляет: `checkFigure`, `TH_DEFAULT` (задача 1).
- Производит:
  - `listPublished(dir) → {id, name}[]` в порядке `<option>`;
  - `newId(ids) → 'fig1' | 'fig2' …`;
  - `writeFigure(dir, {id, name, H, kind, V, P, S, keep, th, slots}) → string[]` (изменённые файлы):
    - `editor/lynx/js/plates-<id>.js`: `MODELS_POLY.<id>={k:100,V:[…],P:[…],S:[…]}` и `FIGURES.<id>={name, H, poly:true, studio:true, kind, slots, keep, th, backIf: c=>[[x,y,z],…].some(q=>Math.hypot(c[0]-q[0],c[1]-q[1],c[2]-q[2])<.05), build:()=>modelPoly('<id>')}`. Строки — через `JSON.stringify`. Точки `backIf` — центры прорезей в долях габарита: подложки за найденными прорезями (решение 13 спеки);
    - `<script src="js/plates-<id>.js?v=<ГГГГ-ММ-ДД-ЧЧмм>">` после последнего `plates-*.js` в `editor/lynx/index.html`;
    - `<option value="<id>">` с экранированным названием — последней в `#figSel`;
    - карточка в `editor/index.html`: при двух фигурах и больше `<h2>` = «Фигуры», при одной — её название, картинка не меняется;
  - `removeFigure(dir, id) → string[]`: убирает файл, тег и строку; последнюю фигуру не снимает: «Последнюю фигуру с сайта не снять».
  - `checkName(name, published)`: пустое или занятое → понятный отказ.
  - `node studio/tools/figure-files.js <dir> <id> <out>`: `parts.dxf` и `nest.dxf` теми же функциями, что кнопки «DXF детали» и «DXF раскрой» в `ui.js`; листы А3 и карты А4 строятся без исключений. Затем `python studio/py/dxf_check.py <out>` — правило 17.

- [ ] **Шаг 1: Тесты** `site.test.js` (копия `editor/` во временной папке):
  - `публикация в файлы`: новая строка последняя, тег после `plates-lynx14`; файл грузится в `vm` с движком; `modelPoly('fig1')` совпадает с входом до 0,01 мм; `keep`, `th`, `kind` на месте; `plates-lynx14.js` побайтно прежний; карточка «Фигуры»;
  - `название` (ревью, п. 5): `Рысь "Лапа" <b>` и `</script>` — в HTML `&quot;`, `&lt;`, JS-файл разбирается и `FIGURES.fig1.name` равно исходному; «Рысь» → отказ;
  - `снять`: после `removeFigure('fig1')` файлы как до публикации, карточка «Рысь»; снять `lynx14`, когда она одна, → отказ;
  - `figure-files` на верхе рыси 14 (как `lynxTop` в `smoke.js`): `dxf_check.py` — код выхода 0.

  `figures.test.js`, для каждой `FIGURES[id].studio`: `checkFigure` со своими `kind`, `slots`, `th` и `keep` — ни одной строки кроме `info`; у каждой грани есть зеркальная; `cutContour` без `bad`; раскладка части фигуры (как `lynxTop`) ≤ 30 с. Для рыси 14 — только наличие в списке и имя «Рысь».

  `editor.spec.js`:
  - число `<option>` = число `FIGURES` в коде;
  - через `page.route` страница отдаётся с добавленной фигурой `fig1` («Рысь 2», копия рыси 14) → по умолчанию выбрана `fig1`;
  - то же с `localStorage art-fig=lynx14` → всё равно `fig1` (ревью, п. 1);
  - `#f=lynx14` → рысь 14.
- [ ] **Шаг 2:** `npm run test:studio` и `npm run test:editor` — FAIL.
- [ ] **Шаг 3:** `python -m pip install ezdxf`, версию — в `requirements.txt`. Написать `site.js`, `figure-files.js`, правки страницы.
- [ ] **Шаг 4:** все тесты из «Общих ограничений» — PASS; страница рыси открывается как раньше.
- [ ] **Шаг 5: Коммит** «Сайт: выпадашка для нескольких фигур, запись и снятие фигуры, DXF-проверка».

### Задача 9: «Опубликовать» и «Снять с сайта»

**Файлы:**
- Создать: `studio/lib/publish.js`, `studio/tests/publish.test.js`
- Изменить:
  - `studio/server.js`: `/api/publish {slug, name}` и `/api/unpublish {id}` — как задания через `/api/job`; второе нажатие во время работы — «Публикация уже идёт».
  - `studio/ui/panel.js`: «Опубликовать» — диалог с названием от `nextName` по опубликованным, его можно поменять. «Снять с сайта» — список опубликованных с подтверждением.
  - `playwright.config.js`: при `PW_PORT` — сервер на этом порту и `reuseExistingServer:false`.
  - `tests/serve.py`: порт из `sys.argv[1]`, по умолчанию 8000.
  - `CLAUDE.md`: правило «В `master` — только по команде Виталия» дополнить: кнопка «Опубликовать» в мастерской — его команда.

**Интерфейсы:**
- Потребляет: `writeFigure`, `removeFigure`, `newId`, `checkName`, `listPublished`, `figure-files.js` (задача 8); `git`, `ensureWorktree` (задача 7); `nextName`, `/api/job` (задача 5).
- Производит: `publish({repo, work, slug, name}, run=realRun) → Promise<{ok, id?, url?, msg}>` и `unpublish({repo, id}, run=realRun)`.
  1. `git fetch origin master`, worktree `studio/.wt/master` на `origin/master` (detached, после прошлого раза очищен). `node_modules` — junction на `<repo>/node_modules` (`fs.symlinkSync(…, 'junction')`).
  2. `writeFigure` / `removeFigure`.
  3. `run`: `npm test`, `npm run test:editor`, `npx playwright test` с `PW_PORT=8001`, `figure-files` + `dxf_check.py` по новой фигуре (у `unpublish` без них). Окружение — с `NODE_OPTIONS=--use-system-ca`.
  4. Всё зелёное → коммит «Фигура: <Название>» (снятие — «Снята фигура: <Название>») и `git push origin HEAD:master`. Сообщение: «Готово, сайт обновится примерно через минуту» и ссылка `https://vitalishaklach.github.io/metal-designer-landing/editor/lynx/#f=<id>`.
  5. Красное → без push; `msg` простыми словами: какой набор упал и первая строка ошибки.
  6. Push отклонён → «На GitHub появились новые правки — нажмите «Опубликовать» ещё раз»; нет сети → «Нет интернета — ничего не опубликовано».
  7. `localOnly` → отказ «Эта фигура только для этого компа». В `figure.json` пишется `published: id`.

- [ ] **Шаг 1: Тесты** `publish.test.js` (временный репозиторий из `master`-копии файлов `editor/`, `tests/`, `package.json`; `origin` — `git init --bare`; `run` — заглушка):
  - `зелёное`: в `origin/master` коммит «Фигура: Рысь 2» с тремя файлами; рабочая папка и её ветка не тронуты; `msg` и `url` как выше;
  - `красное`: заглушка роняет `test:editor` → `origin/master` прежний, `msg` с «test:editor»;
  - `master ушёл вперёд`: заглушка между `fetch` и `push` пушит чужой коммит → сообщение, второй вызов проходит;
  - `нет сети`, `localOnly`, `снять` (зелёное и последняя фигура);
  - `порт` (ревью, п. 3): `realRun` передаёт `PW_PORT=8001`; конфиг Playwright с этим окружением → `webServer.url` на 8001 и `reuseExistingServer === false`.
- [ ] **Шаг 2:** `node --test studio/tests/publish.test.js` — FAIL.
- [ ] **Шаг 3:** написать `publish.js`, API, кнопки, правки `playwright.config.js` и `serve.py`.
- [ ] **Шаг 4:** все тесты — PASS. Сквозной прогон `publish` с настоящим `realRun` на временном `origin` проходит (минуты; локально, не в `test:studio`).
- [ ] **Шаг 5: Коммит** «Мастерская: «Опубликовать» и «Снять с сайта» через копию master».

## Часть 5. Новые модели из Meshy

### Задача 10: Вход zip, рамка, поворот, упрощение

**Файлы:**
- Создать: `studio/lib/zip.js`, `studio/lib/prep.js`, `studio/tests/import.test.js`
- Изменить: `studio/tests/helpers.js` (`makeZip(files) → Buffer` через `zlib.deflateRawSync`), `studio/server.js` (`/api/import?name=&kind=wall|stand&local=0|1`, тело — zip до 300 МБ), `studio/ui/panel.js` (выбрать или перетащить zip, название, «Настенная / Стоящая», галочка «Только на этом компе»)

**Интерфейсы:**
- Производит:
  - `readZip(buf) → {name, data}[]`: центральный каталог, методы 0 и 8; шифрованные и прочие — ошибка.
  - `pickModel(entries) → {obj, mtl?, png?}` — только голые имена `.obj/.mtl/.png` (регистр не важен). PNG — по `map_Kd` из `.mtl`, иначе единственный. OBJ не один или нет вовсе — ошибка «В архиве N моделей OBJ, нужна одна». Файлы пишутся в `work/<slug>/src/<голое имя>`.
  - `frameModel(V, F, kind) → {V, F}` — `refFrame` из задачи 2.
  - `orientCheck(V, F) → {ok, suggest: 'rotY90'|'rotY-90'|'rotX90'|'rotX-90'|null}`. Не уверена — в панели вопрос «Повернуть» с кнопками; это единственный вопрос сверх названия и типа (риск 6).
  - `simplifyIfHeavy(m, MAX_TRIS=50000)` — `simplify` из `mesh.js` (QEM, как `make-models.js`). Порог подобрать по скорости задачи 12 и записать комментарием.

- [ ] **Шаг 1: Тесты** `import.test.js`:
  - `zip-slip`: записи `../../x.obj`, `C:/Windows/x.obj`, `a/b/model.obj`, `run.bat` → записан только `src/model.obj` (из `a/b/`), снаружи `work/<slug>/` ничего, `.bat` не записан;
  - `две модели` и `нет модели` → ошибки с текстом;
  - `.OBJ` и `.PNG` в верхнем регистре; `без PNG` → импорт идёт, в Проверке `info` «Текстуры нет — линии эталона не ищу»;
  - `рамка`: куб в метрах → высота 600, x по центру, низ 0, z от 0;
  - `поворот`: модель-образец (зеркальная фигура), повёрнутая на 90° вокруг Y → `ok:false`, `suggest` возвращает исходное;
  - `упрощение`: 200 000 треугольников → ≤ `MAX_TRIS`.
- [ ] **Шаг 2:** `node --test studio/tests/import.test.js` — FAIL.
- [ ] **Шаг 3:** написать `zip.js`, `prep.js`, API и форму входа.
- [ ] **Шаг 4:** `npm run test:studio` и `npm run test:studio:e2e` — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: вход zip из Meshy, рамка, поворот, упрощение».

### Задача 11: Python: куски, чистая оболочка, починка сетки

**Файлы:**
- Создать:
  - `studio/py/chunks.py`;
  - `studio/py/clean_shell.py` — из `C:\dev\…\private\clean-shell.py`;
  - `studio/py/repair.py` — из `sym7.py fix`, без рысьих чисел: «глаза выше 440», «хвост ниже 100», снятие кисточки;
  - `studio/py/tests/test_mesh.py`;
  - `studio/lib/py.js`.
- Изменить: `studio/py/requirements.txt` (`libigl==2.6.3`, `numpy==2.4.4`, `ezdxf`), `CLAUDE.md` (установка: `python -m pip install -r studio/py/requirements.txt`)

**Интерфейсы:**
- Производит:
  - `python studio/py/chunks.py in.obj out.json` → `{chunks: [{tris: [...], role: 'junk'|'inner'|'slot'|'attached'|'body', why}]}`:
    - `body` — самый большой кусок;
    - `junk` — меньше 0,1 % площади;
    - `inner` — внутри тела по `igl.winding_number`;
    - `slot` — затыкает дыру тела (края куска у открытого контура тела, ближе 1 мм) → прорезь с подложкой;
    - `attached` — снаружи, ближе 2 мм к телу (как хвост рыси).
  - `python studio/py/clean_shell.py in.obj out.obj [plug.obj]` — как в `C:\dev`.
  - `python studio/py/repair.py in.obj out.obj --half left|right --slots slots.json --edge E --thin T`:
    - левая или правая половина и зеркало;
    - стянуть рёбра короче E и треугольники тоньше T;
    - залатать дыры, кроме контуров из `slots.json`.
  - Код выхода 1 и JSON `{error}` при ошибке.
  - `runPy(script, args, {cwd}) → Promise<{code, out, err}>`, Python из `STUDIO_PYTHON` или `python`. Python не найден → «Python не найден: поставьте его по инструкции в CLAUDE.md».

- [ ] **Шаг 1: Тесты** `test_mesh.py` (`unittest`, фигуры строит сам тест на numpy):
  - `роли`: сфера-тело с дырой, диск-пробка, сфера внутри, один треугольник, цилиндр у бока → `body, slot, inner, junk, attached`;
  - `оболочка`: два куба внахлёст → одна замкнутая оболочка без самопересечений (`igl.copyleft.cgal`), объём ≈ объём объединения;
  - `починка`: рёбра < E стянуты, тонких нет, дыры залатаны, кроме контура из `slots.json`; зеркальная ошибка ≤ 1e-6;
  - `ошибка`: битый OBJ → код 1 и `{error}`.

  `runPy` в `studio/tests/import.test.js`: несуществующий `STUDIO_PYTHON` → текст ошибки.
- [ ] **Шаг 2:** `python -m unittest discover -s studio/py/tests -v` — FAIL.
- [ ] **Шаг 3:** написать `chunks.py`, `clean_shell.py`, `repair.py`, `py.js`.
- [ ] **Шаг 4:** тот же запуск и `npm run test:studio` — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: Python — куски модели, чистая оболочка, починка сетки».

### Задача 12: Конвейер целиком: зеркало, половина, грани, оба типа

**Файлы:**
- Создать: `studio/js/faces.js` (шаг 3 `make-lynx14.js`), `studio/lib/pipeline.js`, `studio/tests/pipeline.test.js`
- Изменить: `studio/server.js` (импорт после zip запускает конвейер как задание; `/api/rerun {slug, over}`), `studio/ui/panel.js` (ход по стадиям; кнопка «Поменять» у строк ролей кусков и половины)

**Интерфейсы:**
- Потребляет: задачи 2, 3, 10, 11.
- Производит:
  - `refineMirror(V, F) → {x0, yaw}`: плоскость симметрии уточняется по модели.
  - `facesFromTris(V, F, {ang:5, dist:2, mirror:true}) → {V, P}`. Пороги в рамке 600, как у рыси: «бантики» и неплоские — строже, узкие — к соседу, зеркальные пары, грань поперёк середины — одна вместе со своим зеркалом. У настенной с нарисованными швами швы текстуры — подсказка, как в `plates.js`.
  - `runPipeline(work, slug, onStage, over={}) → Promise<{E, log}>`. `over = {roles?: {[номер куска]: роль}, half?: 'left'|'right'}` — решения Виталия из «Поменять» в Проверке; с ними конвейер перезапускается. `H` новой фигуры — `TH.H` (1000).
    1. рамка, поворот, упрощение;
    2. куски → решения в `log` строками `info`;
    3. `refineMirror`;
    4. для `left` и `right`: `clean_shell` → `repair` → `facesFromTris` → `autoClean`;
    5. берётся половина с меньшей суммой `ruleCounts`;
    6. `addAllSeams`;
    7. `figure.json` и `ref/ref.json`.

    У `wall` стена на z = 0, открытые рёбра там законны (правило 8).

- [ ] **Шаг 1: Тесты** `pipeline.test.js`:
  - `самоцвет` (зеркальный гранёный многогранник, мелко триангулирован, шум 0,2 мм, плюс лишний треугольник):
    - замкнут, симметричен;
    - правил 1–5, 10 нет;
    - `faceDev` ≤ 2;
    - швы `S` на всех рёбрах;
    - лишний треугольник в `log` как `junk`;
  - `половина`: справа бугор → выбрана `left`; `over.half:'right'` → `right`, в `log` строка «половину выбрал Виталий»;
  - `роль поменяли`: лишний треугольник с `over.roles` = `attached` → остаётся в фигуре;
  - `настенная`: полукоробка, открытая на z = 0 → открытые рёбра только на z = 0;
  - `src5 для спорта` (skip без файла): весь конвейер ≤ 5 мин, печатается отчёт «было → стало»;
  - `доберман` (skip без `C:\dev\…\tools\plates\src\doberman7.obj`): `kind:'wall'`, `localOnly:true`, конвейер проходит; после «Сохранить версию» в `drafts` ничего; `git ls-files` без добермана (приёмка 7).
- [ ] **Шаг 2:** `node --test studio/tests/pipeline.test.js` — FAIL.
- [ ] **Шаг 3:** написать `faces.js`, `pipeline.js`, задание в сервере и «Поменять» в панели.
- [ ] **Шаг 4:** все тесты из «Общих ограничений» — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: конвейер новой модели — зеркало, грани, настенная и стоящая».

## Часть 6. Приёмка

### Задача 13: «Рысь 2» на сайт

Работа с Виталием (метка `ready-for-human`). Первый шаг — слияние `figure-studio` с `master` **по его команде** (риск 4).

**Файлы:**
- Создать: `studio/tools/shots.js` — снимки Playwright с трёх ракурсов: лоб, деталь № 176, шея. Камера — как на скринах Виталия от 09.11. Два прогона: рысь 14 на `:8000` и «Рысь 2» в мастерской.

- [ ] **Шаг 1:** `npm run studio` → «Открыть опубликованную» → «Рысь» → «Рысь 2» с эталоном `src5` → «Исправить всё безопасное».
- [ ] **Шаг 2:** с Виталием пройти остаток Проверки. Законные места (кисточка: правила 4, 6, 11) → «Оставить так». Цель — пусто, кроме них (приёмка 1, 3).
- [ ] **Шаг 3:** `node studio/tools/report.js` — «было → стало» по замеру из «Зачем». `node studio/tools/shots.js` — снимки до и после; три места чистые (приёмка 2).
- [ ] **Шаг 4:** Виталий смотрит глазами и говорит «красиво» (приёмка 4). Нет — правка и снова шаг 2.
- [ ] **Шаг 5:** «Сохранить версию» → в `origin/drafts` черновик, сайт не пересобрался (приёмка 9).
- [ ] **Шаг 6:** «Опубликовать» «Рысь 2». На сайте:
  - новая строка, открывается первой;
  - рысь 14 побайтно прежняя;
  - карточка «Фигуры»;
  - десктоп и телефон как раньше, без веера теней (приёмка 5, 12).
- [ ] **Шаг 7:** проверка «Снять с сайта» на временной фигуре: опубликовать копию, снять, первой снова «Рысь 2» (приёмка 8).

### Задача 14: Своя фигура Виталия и инструкция в Word

**Файлы:**
- Создать: `docs/studio-guide.docx` (скил `anthropic-skills:docx`), скриншоты внутри документа

- [ ] **Шаг 1:** поднять Playwright MCP (таблица MCP в глобальном `CLAUDE.md` Виталия). Виталий сам входит в Meshy, пароли Claude не вводит.
- [ ] **Шаг 2:** снять путь своей новой стоящей фигуры Виталия:
  - Meshy: «Изображение → 3D», Geometric, с текстурой, скачать OBJ zip;
  - `npm run studio`;
  - zip, Проверка, «Сохранить версию»;
  - «Опубликовать», «Снять с сайта»;
  - установка на новом компе: Node, Python, `pip install -r studio/py/requirements.txt`, `npm ci`.

  На скриншотах не видно почты и имени аккаунта.
- [ ] **Шаг 3:** документ по-русски, по шагам, со скриншотами. Пункт бэклога `C:\dev` «записать настройки Meshy» закрывается этим документом (сам бэклог в `C:\dev` не правим).
- [ ] **Шаг 4:** Виталий по документу сам, без Claude, проводит фигуру от zip до выпадашки (приёмка 6).
- [ ] **Шаг 5: Коммит** «Инструкция мастерской: Meshy → сайт».
