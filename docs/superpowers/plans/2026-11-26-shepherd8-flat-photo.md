# Овчарка 8: плоские фото-кальки в ортовиде — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** «Овчарка 8 — оригинал» — копия Овчарки 7, у которой кальки «Фото спереди» / «Фото сбоку» не натягиваются на модель, а лежат плоской полупрозрачной картинкой в ортогональном виде «Спереди» / «Сбоку».

**Architecture:** фигура `shepherd8_orig` — та же модель и тот же режим обводки (`OW`, `owork.js`), что у `shepherd7_orig`, плюс флаг `flat:true`. Для неё виды «Спереди» и «Сбоку» рисуются ортогональной камерой. Фото-калька — прямоугольник с картинкой в плоскости вида, его углы — обратная матрица `m` из `PHOTOS.shepherd7` (та же подгонка #178, без слоя головы). Чистая математика — в `js/ow-core.js`, three.js — в `js/view3d.js` и `js/owork.js`.

**Tech Stack:** браузерный JS без сборки, three.js r128 (`vendor/`), `node --test`, `tools/smoke.js`.

**Spec:** `docs/superpowers/specs/2026-11-25-shepherd7-workshop-design.md` (режим обводки) + решения грилинга 26.11 ниже — для Овчарки 8 они главнее спеки.

## Решения грилинга (Виталий, 26.11)

| № | Решение |
|---|---|
| Q1 | Овчарка 7 не меняется вообще, включая её кальку-проекцию. Копия — «Овчарка 8 — оригинал». |
| Q2 | Та же модель Meshy, все инструменты как у семёрки (перо, «Линия», магнит, «Текстура», Ctrl+Z, «Открыть модель»). Разметка своя, стартует пустой. |
| Q3 | У Овчарки 8 виды «Спереди» и «Сбоку» — ортогональная камера (без перспективы). «3D», «Сверху», «Всё» — как сейчас. |
| Q4 | Одно фото собаки целиком спереди и одно сбоку, **без слоя головы**. Подгонка — та, что уже посчитана `photo-fit.js` по силуэту всей собаки (`PHOTOS.shepherd7[i].m`, поле `head` не используется). |
| Q5 | Ручной подстройки мышью нет (если автоподгонка плохая — следующий тикет). |
| Q6 | Повернул камеру — плоская калька прячется, видна обычная фигура. Проекции фото на модель у Овчарки 8 нет. |
| Q7 | Прозрачность фиксированная 50 %, вкл/выкл — галочкой «Калька». Ползунка нет. |

## Global Constraints

- Только HTML/CSS/JS в браузере; three.js r128 из `vendor/`; ничего со сторонних серверов.
- Одна логика: перо, «Сохранить», версии, разметка — те же функции (`markup.js`, `figJSON`, `verPut`, `owJSON`), без копий.
- Без открытого тикета код не правим: номер — в `.claude/ticket`.
- Овчарки 1–7, их кальки и «Овчарка 5 — оригинал (вид)» не меняются. Проверка — скриншоты Овчарки 7 «Фото спереди» до/после совпадают.
- Новых картинок нет: Овчарка 8 берёт `img/photo-shepherd7-front.png` и `img/photo-shepherd7-side.png`.
- Поменялся `js/*.js` или `css/*.css` — новая метка `?v=` во **всех** `<script>` и `<link rel="stylesheet">` в `shepherd-v6j3w/index.html`.
- Перед коммитом: `NODE_OPTIONS=--use-system-ca npm test`, `NODE_OPTIONS=--use-system-ca npm run test:editor`, `node --test shepherd-v6j3w/tools/`.
- Код — плотные однострочники; `//` не посреди строки (грабли #151, #154, #175).
- Только десктоп.

## Review Focus

1. **Перо в ортовиде.** Луч `Raycaster.setFromCamera` у ортокамеры идёт параллельно, из плоскости камеры; подтяжка ленты `TL_OVER` (#181) «к камере» считалась от позиции перспективной камеры. Ожидание: в ортовиде точка пера ложится туда же, куда кликнули, лента не уходит за модель и не висит перед ней. Тест — Task 2.
2. **Повернул камеру из «Спереди» и вернулся кнопкой.** Ожидание: при повороте — перспектива и калька скрыта; снова «Спереди» — орто и калька на месте, тот же масштаб. Тест — Task 2 и 3.
3. **Калька «Фото сбоку», а вид «Спереди»** (и наоборот). Ожидание: калька не видна, строка-подсказка «Фото сбоку видно в виде „Сбоку“»; вид сам не переключается. Тест — Task 3.
4. **Разметка поверх фото.** Ожидание: штрихи пера и линии видны поверх полупрозрачного фото, фото не перекрывает их. Тест — Task 3 (скриншот + порядок отрисовки).
5. **Овчарка 7 после правок.** Ожидание: семёрка — по-прежнему перспектива и проекция фото на модель с головой (`head`), разметка семёрки не видна в восьмёрке и наоборот. Тест — Task 1 и 3.

---

## Карта файлов

| Файл | Что | Задачи |
|---|---|---|
| `shepherd-v6j3w/js/figures.js` | `FIGURES.shepherd8_orig` | 1 |
| `shepherd-v6j3w/js/ow-core.js` | `owOrthoHalf`, `owPhotoQuad`, `owFlatShow` — чистые | 2, 3 |
| `shepherd-v6j3w/tools/ow-core.test.js` | их тесты | 2, 3 |
| `shepherd-v6j3w/js/view3d.js` | ортокамера для видов «Спереди»/«Сбоку» у фигуры с `flat` | 2 |
| `shepherd-v6j3w/js/owork.js` | плоская калька: сетка, видимость, подсказка | 3 |
| `shepherd-v6j3w/tools/smoke.js` | проверки страницы | 1–3 |
| `shepherd-v6j3w/index.html` | `?v=` | 1–3 |

---

### Task 1: «Овчарка 8 — оригинал» в списке — копия семёрки

**Files:**
- Modify: `shepherd-v6j3w/js/figures.js` (рядом с `FIGURES.shepherd7_orig`, стр. ~66)
- Test: `shepherd-v6j3w/tools/smoke.js` (блок рядом с проверками #175)

**Interfaces:**
- Produces: `FIGURES.shepherd8_orig={name:'Овчарка 8 — оригинал',ow:'shepherd5',need:'orig-shepherd5',photos:'shepherd7',flat:true}`; флаг `flat` читают Task 2 и 3 как `FIGURES[OW.id].flat`.

- [ ] **Step 1: Проверки в smoke (красные)**
  - «Овчарка 8 — оригинал» есть в выпадашке сразу после «Овчарка 7 — оригинал»; при выборе открывается режим обводки (`OW.on`, `OW.id==='shepherd8_orig'`), без расчёта.
  - Штрих, добавленный в Овчарке 8, не появляется в Овчарке 7, и наоборот (ключ разметки — по id фигуры).
  - Список калек восьмёрки тот же, что у семёрки: «Текстура», «Фото спереди», «Фото сбоку».
- [ ] **Step 2: Прогнать smoke Овчарки — красный** на этих проверках.
- [ ] **Step 3: Добавить `FIGURES.shepherd8_orig`** (строка выше). Если ключ разметки или версий не берёт id фигуры — это баг, остановиться и написать в тикет, а не заводить отдельное хранилище.
- [ ] **Step 4: smoke зелёный; `?v=` обновлён.**
- [ ] **Step 5: Коммит** `Овчарка 8 — копия семёрки для плоских калек (#N)`.

---

### Task 2: ортокамера в «Спереди» / «Сбоку» у Овчарки 8

**Files:**
- Modify: `shepherd-v6j3w/js/view3d.js` (`viewDir`, стр. ~110; `pickTri`; создание `camera`)
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/tools/ow-core.test.js`
- Test: `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Produces: `owOrthoHalf(dist:number, fovDeg:number):number` — полувысота кадра ортокамеры, при которой модель на расстоянии `dist` видна того же размера, что в перспективе: `dist*Math.tan(fovDeg*Math.PI/360)`.
- Produces: глобальная `camO` (`THREE.OrthographicCamera`) и функция `curCam():THREE.Camera` — активная камера (`camO` в ортовиде, иначе `camera`). Все места, где луч/рендер берут `camera` (`pickTri`, луч пера в `owork.js:124`, `renderer.render`, лента `#181`), переходят на `curCam()`.
- Produces: `VIEW.ortho:boolean` — включён ли ортовид; читает Task 3.

- [ ] **Step 1: Тест `owOrthoHalf`** в `ow-core.test.js`: `owOrthoHalf(1000,35)` ≈ `315.3` (±0.1); `owOrthoHalf(0,35)===0`.
- [ ] **Step 2: Прогнать — красный** (`node --test shepherd-v6j3w/tools/ow-core.test.js`, «owOrthoHalf is not defined»).
- [ ] **Step 3: `owOrthoHalf` в `ow-core.js`.** Зелёный.
- [ ] **Step 4: Проверки в smoke (красные):**
  - Овчарка 8, кнопка «Спереди» → `VIEW.ortho===true`, `curCam().isOrthographicCamera`; то же «Сбоку».
  - Овчарка 8, «3D» / «Сверху» / «Всё» → `VIEW.ortho===false`.
  - Овчарка 8, «Спереди», затем поворот мышью (имитация `controls` change с углом > 1°) → `VIEW.ortho===false`, вид продолжается в перспективе с того же направления.
  - Овчарка 7, «Спереди» → `VIEW.ortho===false` (семёрка не меняется).
  - Овчарка 8, «Спереди», клик пером в центр морды → точка штриха на поверхности (расстояние до ближайшего треугольника < 0,5 мм) и под курсором (повторная проекция в экран — в пределах 1 px).
- [ ] **Step 5: Сделать в `view3d.js`:** ортокамера включается в `viewDir('front'|'side')`, только если `FIGURES[текущая].flat`; размер кадра — `owOrthoHalf(расстояние камеры до target, 35)` × пропорция окна; колесо меняет `camO.zoom` (OrbitControls с ортокамерой так и работает); поворот > 1° от оси — назад на перспективу.
- [ ] **Step 6: smoke и `ow-core.test.js` зелёные; `?v=`.**
- [ ] **Step 7: Скриншоты** `s8-front-ortho.png`, `s8-side-ortho.png`, `s8-pen-ortho.png` (штрих пером в ортовиде); 0 ошибок консоли.
- [ ] **Step 8: Коммит** `Овчарка 8: «Спереди» и «Сбоку» — ортокамера (#N)`.

---

### Task 3: плоская фото-калька

**Files:**
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/tools/ow-core.test.js`
- Modify: `shepherd-v6j3w/js/owork.js` (`owPhotoUse`/`owPhotoMat`/`owCalkaUI`/`owRender`, стр. ~74–117)
- Test: `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Consumes: `FIGURES[id].flat` (Task 1), `VIEW.ortho`, `curCam()` (Task 2), `owPhotoUV(m,p)` (есть, `ow-core.js:130`), `PHOTOS.shepherd7[i]` (`{key,img,m,dir}`).
- Produces: `owPhotoQuad(m:number[8], dir:number[3], depth:number):number[4][3]` — углы картинки в кадре фигуры (мм) для uv `(0,0),(1,0),(1,1),(0,1)`; плоскость — перпендикулярно `dir`, координата вдоль `dir` = `depth`. Решение — обратная 2×2 к части `m` по двум осям, лежащим в плоскости.
- Produces: `owFlatShow(photoKey:'front'|'side', viewKey:string, ortho:boolean):boolean` — `ortho && photoKey===viewKey`.

- [ ] **Step 1: Тесты в `ow-core.test.js`:**
  - `owPhotoQuad` с `m` и `dir` фото «спереди» и «сбоку» из `js/photos-shepherd7.js`: для каждого угла `owPhotoUV(m, угол)` ≈ свой uv (±1e-6); у «спереди» все 4 угла с одинаковым z = `depth`, у «сбоку» — одинаковый x.
  - `owFlatShow('front','front',true)===true`; `('front','side',true)===false`; `('front','front',false)===false`.
- [ ] **Step 2: Прогнать — красный.**
- [ ] **Step 3: `owPhotoQuad`, `owFlatShow` в `ow-core.js`.** Зелёный.
- [ ] **Step 4: Проверки в smoke (красные):**
  - Овчарка 8, калька «Фото спереди», вид «Спереди» → сетка плоской кальки видна, `opacity===0.5`, `depthTest===false`; у модели нет фото-шейдера (`owPhotoMat` не назначен).
  - Тот же выбор, вид «3D» → плоская калька скрыта, модель в гипсе.
  - «Фото сбоку» при виде «Спереди» → скрыта, подсказка «Фото сбоку видно в виде „Сбоку“».
  - Галочка «Калька» снята → скрыта в любом виде.
  - Порядок отрисовки: `renderOrder` модели < плоской кальки < штрихов разметки.
  - Овчарка 7, «Фото спереди» → как раньше: проекция `owPhotoMat` с `head`, плоской кальки нет.
- [ ] **Step 5: Сделать в `owork.js`:** у фигуры с `flat` выбор фото-кальки строит `THREE.Mesh` из 4 углов `owPhotoQuad(ph.m, ph.dir, перед моделью: край рамки модели по dir + 1 мм)` с картинкой `ph.img` (`MeshBasicMaterial`, `transparent`, `opacity:.5`, `depthTest:false`, `depthWrite:false`, `side:DoubleSide`); видимость каждый кадр — `owFlatShow(ph.key, текущий вид, VIEW.ortho)`; поле `head` не читается. Картинка грузится по выбору кальки, как в #178. Без `flat` — путь #178 без изменений.
- [ ] **Step 6: smoke, модульные зелёные; `?v=`.**
- [ ] **Step 7: Скриншоты:** `s8-front-photo.png`, `s8-side-photo.png` (ортовид с калькой), `s8-3d-hidden.png`, `s8-pen-over-photo.png` (штрих поверх фото), `s7-front-photo-same.png` (семёрка не изменилась — сравнить с `s178-*`); 0 ошибок консоли.
- [ ] **Step 8: `test:editor` (~30 мин) зелёный; ревью (`mattpocock-skills:code-review`, один ревьюер).**
- [ ] **Step 9: Коммит** `Овчарка 8: плоские кальки «Фото спереди/сбоку» (#N)`.
