# Овчарка 7: плоские фото-кальки в ортовиде и галочка «Модель» — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на «Овчарка 7 — оригинал» в виде «Спереди» («Сбоку») калька «Фото спереди» («Фото сбоку») лежит плоской резкой картинкой (общее фото + фото головы) в ортокамере; галочка «Модель» прячет модель, оставляя её в глубине; перо по-прежнему кладёт точки на модель.

**Architecture:** ортокамера `camO` рядом с перспективной `camera` в `view3d.js`; активная — `curCam()`, все лучи и рендер берут её. Плоская калька — две плоскости (общее фото и фото головы) в `owork.js`, углы — обратная матрица `m` (`owPhotoQuad` в `ow-core.js`), картинки — те же текстуры, что у проекции (`owPhotoTex`: грани без швов + маска швов, #185). Проекция фото на модель (#178, #185) не меняется и работает во всех остальных случаях.

**Tech Stack:** браузерный JS без сборки, three.js r128 (`vendor/`, `OrbitControls` из `vendor/`), `node --test`, `tools/smoke.js`, Playwright (`tests/e2e/`).

**Spec:** тикет #184 (переписан 28.11: «Что делаем», «Решения (Виталий, 28.11)», «Критерии приёмки») + режим обводки `docs/superpowers/specs/2026-11-25-shepherd7-workshop-design.md`. План `2026-11-26-shepherd8-flat-photo.md` (копия «Овчарка 8») устарел — не исполнять.

## Global Constraints

- Только HTML/CSS/JS в браузере; three.js r128 из `vendor/`; ничего со сторонних серверов; новых зависимостей нет.
- Делаем в **Овчарке 7** (`shepherd7_orig`), копии фигуры нет; разметка, «Сохранить», версии — те же функции (`markup.js`, `owJSON`, `verPut`).
- Ортокамера в «Спереди» / «Сбоку» — у любой фигуры режима обводки (`OW.on`), включая модель из «Открыть модель»; у обычных фигур (Овчарки 1–6) — перспектива, как сейчас.
- Проекция фото на модель (#178, #185) в 3D-видах — без изменений; «Текстура» (#146, #177) — без изменений. Новых картинок нет: `img/photo-shepherd7-*.png`.
- Галочка «Модель»: выключена — модель не видна, но пишет глубину; фото 100 %. Включена — фото 50 % поверх гипса. Ползунков нет; ручной подгонки фото нет.
- Поменялся `js/*.js` или `css/*.css` — новая метка `?v=` во **всех** `<script>` и `<link rel="stylesheet">` `shepherd-v6j3w/index.html`.
- Перед коммитом: `NODE_OPTIONS=--use-system-ca npm test`, `NODE_OPTIONS=--use-system-ca npm run test:editor`, `node --test shepherd-v6j3w/tools/*.test.js`, `NODE_OPTIONS=--use-system-ca npx playwright test tests/e2e/shepherd-flat.spec.js --project=desktop`. Долгие прогоны — в отдельном окне (правило `test-progress`).
- Код — плотные однострочники; `//` не посреди строки. Только десктоп.

## Review Focus

1. **Перо в ортовиде.** Луч ортокамеры параллелен и идёт из плоскости камеры; подтяжка ленты `TL_OVER` (#181) считается от `cameraPosition`. Ожидание: точка пера — под курсором (≤ 1 px) и на поверхности модели (≤ 0,5 мм), лента не уходит за модель. Тест — Task 1, e2e «перо в ортовиде».
2. **Повернул мышью из «Спереди» и вернулся кнопкой.** Ожидание: поворот > 1° — перспектива с того же направления и того же масштаба (модель не прыгает), плоская калька скрыта, видна проекция; снова «Спереди» — орто и плоская калька. Тест — Task 1 (масштаб), Task 2 (видимость).
3. **Модель скрыта — штрихи с затылка.** Ожидание: штрих на затылке или на другом боку в виде «Спереди» с выключенной «Моделью» не виден (модель заслоняет глубиной). Тест — Task 3, e2e.
4. **Фото головы на плоскости.** Ожидание: морда — с фото головы (резко), стыка голова / тело не видно (край фото головы гаснет, как `owHe` в #185), кончики ушей не гаснут. Тест — Task 2, скриншот `f2-front-head.png` против `p5-*`.
5. **Окно поменяло размер в ортовиде** (развернули панель, ресайз). Ожидание: пропорции картинки не плывут — `camO` пересчитывает `left/right` по новой пропорции. Тест — Task 1, e2e «ресайз».

---

## Карта файлов

| Файл | Что | Задачи |
|---|---|---|
| `shepherd-v6j3w/js/ow-core.js` | `owOrthoHalf`, `owPhotoQuad`, `owFlatShow` — чистые | 1, 2 |
| `shepherd-v6j3w/tools/ow-core.test.js` | их тесты | 1, 2 |
| `shepherd-v6j3w/js/view3d.js` | `camO`, `curCam()`, `VIEW.ortho`, вход/выход из орто, ресайз, рендер | 1 |
| `shepherd-v6j3w/js/owork.js` | `owPick` на `curCam()`; плоская калька; галочка «Модель» | 1, 2, 3 |
| `shepherd-v6j3w/js/ui.js` | обработчик `cModel` | 3 |
| `shepherd-v6j3w/index.html` | `<label id="modelRow">` с `cModel` после `traceSel`; `?v=` | 3 |
| `shepherd-v6j3w/tools/smoke.js` | проверки страницы (статические) | 1–3 |
| `tests/e2e/shepherd-flat.spec.js` | поведение в браузере (desktop) | 1–3 |
| `CLAUDE.md` | строка «Овчарка (мастерская)» в таблице областей e2e | 3 |

---

### Task 1: ортокамера в «Спереди» / «Сбоку» у фигур режима обводки

**Files:**
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/tools/ow-core.test.js`
- Modify: `shepherd-v6j3w/js/view3d.js` (создание камеры ~стр. 6–8; `fitBox` ~104; `viewDir` ~110; `pickTri`/`pickHit`/`pickVert`/`dragPoint` ~112–123; `sizeStage` ~124; цикл рендера ~126–127)
- Modify: `shepherd-v6j3w/js/owork.js` (`owPick`, `rc.setFromCamera(…,camera)` ~стр. 139)
- Create: `tests/e2e/shepherd-flat.spec.js`
- Test: `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Produces: `owOrthoHalf(dist:number, fovDeg:number):number` — полувысота кадра орто, при которой предмет на расстоянии `dist` того же размера, что в перспективе с `fovDeg`: `dist·tan(fovDeg·π/360)`; обратное — `dist = half / tan(fovDeg·π/360)` (выход из орто).
- Produces: `camO` (`THREE.OrthographicCamera`, near/far как у `camera`), `curCam():THREE.Camera` (`VIEW.ortho ? camO : camera`), `VIEW={ortho:false, key:''}` (`key` — `'front'|'side'` в орто, иначе `''`). Читают Task 2 и 3.
- Produces: `viewOrtho(on:boolean)` в `view3d.js` — переключает `controls.object`, переносит позицию / цель / масштаб так, что картинка на экране не прыгает, вызывает `req3D()`.

- [ ] **Step 1: Тест `owOrthoHalf`** в `ow-core.test.js`: `owOrthoHalf(1000,35)` ≈ `315.299` (±0,01); `owOrthoHalf(0,35)===0`.
- [ ] **Step 2: Красный** (`node --test shepherd-v6j3w/tools/ow-core.test.js` — «owOrthoHalf is not defined»).
- [ ] **Step 3: `owOrthoHalf` в `ow-core.js`.** Зелёный.
- [ ] **Step 4: e2e (красные)** в `tests/e2e/shepherd-flat.spec.js` (desktop; страница `/shepherd-v6j3w/#f=shepherd7_orig`, ждать `OW.on && OW.o3`):
  - «Спереди» → `VIEW.ortho===true`, `VIEW.key==='front'`, `curCam().isOrthographicCamera`; «Сбоку» → `key==='side'`; «3D», «Сверху», «Всё» → `VIEW.ortho===false`.
  - Овчарка 6 (`#f=shepherd6`), «Спереди» → `VIEW.ortho===false`.
  - Масштаб при выходе: в «Спереди» запомнить экранную проекцию (`Vector3.project(curCam())`) точек `OW.box.min` и `OW.box.max`; `viewOrtho(false)` → обе точки на тех же местах ±2 px (перспектива с того же места; на плоскости цели совпадает точно, у краёв габарита — с погрешностью перспективы, отсюда ±2 px).
  - Поворот: в «Спереди» потянуть мышью на ~20° (правая кнопка — у режима правая крутит) → `VIEW.ortho===false`.
  - Перо: инструмент «Карандаш», «Спереди», клик в центр морды (экранная проекция точки `[0, 820, 1150]`) → последняя точка `ST.mkCur`/`ST.mk` — на поверхности (`owNear(OW.G,p,1)` не `null`) и её проекция в экран — в ≤ 1 px от клика.
  - Ресайз: в «Спереди» `page.setViewportSize` 1440×900 → 1000×900 → у `camO` `(right-left)/(top-bottom)` = пропорция холста ±0,01.
- [ ] **Step 5: Прогнать e2e — красный.**
- [ ] **Step 6: Сделать.** `viewDir(k,…)`: при `OW.on && (k==='front'||k==='side')` — `viewOrtho(true)` с `VIEW.key=k`, размер кадра — `owOrthoHalf(расстояние после fitBox, camera.fov)`; иначе — `viewOrtho(false)`. Выход по повороту: обработчик `controls` `'change'` — в орто, если угол между `camO.position − target` и осью вида > 1°, — `viewOrtho(false)` (перспектива: то же направление, расстояние — обратное `owOrthoHalf` от `half/camO.zoom`). Колесо в орто — `camO.zoom` (так делает `OrbitControls` с ортокамерой). Все `rc.setFromCamera(…, camera)`, `project(camera)`, `getWorldDirection`, `renderer.render`, `labels.render` → `curCam()`; `sizeStage` пересчитывает и `camO`.
- [ ] **Step 7: Проверка в smoke** (статическая, Node): в `view3d.js` и `owork.js` нет `setFromCamera(` с аргументом `camera` и нет `render(scene,camera)` — только `curCam()`.
- [ ] **Step 8: e2e, smoke, модульные зелёные; `?v=`.**
- [ ] **Step 9: Скриншоты** `.superpowers/f1-front-ortho.png`, `f1-side-ortho.png`, `f1-pen-ortho.png`; 0 ошибок консоли.
- [ ] **Step 10: Коммит** `Овчарка 7: «Спереди» и «Сбоку» в ортокамере (#184)`.

---

### Task 2: плоская фото-калька (общее фото + фото головы)

**Files:**
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/tools/ow-core.test.js`
- Modify: `shepherd-v6j3w/js/owork.js` (`owRender` ~стр. 130; `owDrop3D` ~30; рядом с `owPhotoMat`)
- Modify: `tests/e2e/shepherd-flat.spec.js`, `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Consumes: `VIEW.ortho`, `VIEW.key`, `curCam()` (Task 1); `owPhotoTex(im)` → текстура `.mask`, `.edge` (#185); `owPhotoUV(m,p)` (`ow-core.js`); `PHOTOS.shepherd7[i]` = `{key, img, m, dir, head:{img, m}}`; `OW_HEAD_BAND`, `OW_PHOTO_SEAM_C` (`owork.js`).
- Produces: `owPhotoQuad(m:number[8], dir:number[3], depth:number):number[4][3]` — углы картинки в кадре фигуры (мм) для uv `(0,0),(1,0),(1,1),(0,1)`: плоскость ⟂ `dir`, координата вдоль `dir` = `depth`; две другие — обратная 2×2 к части `m` по этим осям.
- Produces: `owFlatShow(photoKey:string, viewKey:string, ortho:boolean):boolean` — `ortho && photoKey===viewKey`.
- Produces: `OW.o3.flat` — `{g:THREE.Group, gen:THREE.Mesh, head:THREE.Mesh|null}`; материал — `owFlatMat()` (`ShaderMaterial`: `color = mix(fill, OW_PHOTO_SEAM_C, smoothstep(.3,.6,mask))`, `alpha = fill.a · owOp · краевой вес`; краевой вес — как `owHe` у проекции, только у фото головы). Читает Task 3 (`owOp`).

- [ ] **Step 1: Тесты в `ow-core.test.js`:**
  - `owPhotoQuad` для «спереди» и «сбоку» из `js/photos-shepherd7.js` (и `m` общего, и `head.m`): `owPhotoUV(m, угол[i])` ≈ uv угла ±1e-6; у «спереди» все 4 угла с z = `depth`, у «сбоку» — с x = `depth`.
  - `owFlatShow('front','front',true)===true`; `('front','side',true)===false`; `('front','front',false)===false`.
- [ ] **Step 2: Красный.**
- [ ] **Step 3: `owPhotoQuad`, `owFlatShow` в `ow-core.js`.** Зелёный.
- [ ] **Step 4: e2e (красные):**
  - «Фото спереди», «Спереди» → `OW.o3.flat.g.visible===true`, у модели — гипс (`OW.mesh.material===OW.o3.plaster`), обе плоскости есть (`gen`, `head`).
  - Тот же выбор, «3D» → `flat.g.visible===false`, у модели — проекция (`OW.mesh.material===OW.o3.photo`), как сейчас.
  - «Фото сбоку» в «Спереди» → плоская скрыта, проекция как сейчас; «Фото сбоку» в «Сбоку» → плоская видна.
  - Галочка «Калька» снята → плоская скрыта в любом виде.
  - Калька «Текстура» в «Спереди» → плоской нет, у модели — `OW.o3.seam`, как сейчас (#177).
  - `renderOrder`: плоская калька > модели, штрихи разметки > плоской кальки; у материала плоской `depthTest===false`, `depthWrite===false`.
- [ ] **Step 5: Красный.**
- [ ] **Step 6: Сделать в `owork.js`.** Плоскости — по углам `owPhotoQuad(ph.m, ph.dir, глубина)` и `owPhotoQuad(ph.head.m, ph.dir, глубина)`, глубина — край габарита модели со стороны камеры + 1 мм; текстуры — те же `o.ptex[…]`, что у проекции (грузятся по выбору, `owPhotoGet`); голова поверх общего; видимость и материал модели — в `owRender` по `owFlatShow(ph.key, VIEW.key, VIEW.ortho)`; вход и выход из орто (Task 1) вызывают `renderAll()`. `owDrop3D` убирает плоскости и их материалы.
- [ ] **Step 7: Проверка в smoke** (статическая): `owFlatMat` берёт маску швов и `OW_PHOTO_SEAM_C` (одна логика швов с проекцией #185); краевой вес головы — по `.edge` текстуры.
- [ ] **Step 8: e2e, smoke, модульные зелёные; `?v=`.**
- [ ] **Step 9: Скриншоты** `f2-front.png` (вся собака), `f2-front-head.png` (морда крупно — сравнить с `p5-*` проекции: швы морды не мыльные, стыка голова / тело нет, кончики ушей целы), `f2-side.png`, `f2-3d-projection.png` (проекция как в `p5-*`); 0 ошибок консоли.
- [ ] **Step 10: Коммит** `Овчарка 7: плоские кальки «Фото спереди / сбоку» в ортовиде (#184)`.

---

### Task 3: галочка «Модель»

**Files:**
- Modify: `shepherd-v6j3w/index.html` (после `<select id="traceSel">`, стр. ~65: `<label class="chk" id="modelRow" hidden><input type="checkbox" id="cModel" checked><span>Модель</span></label>`; `?v=`)
- Modify: `shepherd-v6j3w/js/owork.js` (`OW` — поле `modelOn:true`, сброс в `owOpen`; `owCalkaUI`; `owRender`; материал «только глубина»)
- Modify: `shepherd-v6j3w/js/ui.js` (обработчик `cModel` рядом с `cOrigTex` ~стр. 233)
- Modify: `tests/e2e/shepherd-flat.spec.js`, `shepherd-v6j3w/tools/smoke.js`, `CLAUDE.md`

**Interfaces:**
- Consumes: `OW.o3.flat`, `owFlatShow` (Task 2); `VIEW` (Task 1).
- Produces: `OW.modelOn:boolean`; `OW.o3.depth` — `MeshBasicMaterial({colorWrite:false, side:DoubleSide})`.

- [ ] **Step 1: e2e (красные):**
  - `#modelRow` виден только когда плоская калька на экране (Task 2), иначе скрыт.
  - `cModel` снята → `OW.mesh.material===OW.o3.depth`, `owOp` плоской = 1; включена → гипс, `owOp` = 0,5.
  - Модель скрыта, вид «Спереди»: штрих пером на затылке (поставить в 3D по `owPick`, вернуться в «Спереди») — пиксель экрана в проекции этой точки совпадает с пикселем фото без штриха (±8 по каналу): штрих заслонён.
  - Модель скрыта, «Спереди», клик пером в морду → точка на поверхности модели (`owNear(OW.G,p,1)` не `null`), под курсором ≤ 1 px.
  - Другая фигура и снова «Овчарка 7 — оригинал» → `cModel` включена (`OW.modelOn` сброшен).
  - «Сохранить» → `owJSON()` без поля модели — разметка как была.
- [ ] **Step 2: Красный.**
- [ ] **Step 3: Сделать.** Видимость `#modelRow` — в `owCalkaUI`; выбор материала модели в `owRender`: `owFlatShow(…) ? (OW.modelOn ? o.plaster : o.depth) : как сейчас`; `owOp` — `OW.modelOn ? .5 : 1`.
- [ ] **Step 4: Проверка в smoke** (статическая): `cModel` есть в `index.html` и скрыт по умолчанию (`hidden`), обработчик в `ui.js` вызывает `owRender()`.
- [ ] **Step 5: e2e, smoke, модульные зелёные; `?v=`.** В `CLAUDE.md` в таблицу «Область → команда» — строка «Овчарка (мастерская) | `npx playwright test tests/e2e/shepherd-flat.spec.js --project=desktop`».
- [ ] **Step 6: Скриншоты** `f3-model-off.png` (морда крупно, только фото), `f3-model-on.png` (50 % поверх гипса), `f3-pen-model-off.png` (штрих поверх фото, затылочный штрих не виден); 0 ошибок консоли.
- [ ] **Step 7: `test:editor` (~25 мин, в отдельном окне) зелёный; ревью `mattpocock-skills:code-review` (один ревьюер, обе оси).**
- [ ] **Step 8: Коммит** `Овчарка 7: галочка «Модель» — только фото, модель заслоняет (#184)`.
