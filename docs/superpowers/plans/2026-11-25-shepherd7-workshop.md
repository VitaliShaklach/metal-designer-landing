# Мастерская обводки по оригиналу (Овчарка 7) — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** режим «оригинал для обводки» на `/shepherd-v6j3w/`: любая модель (встроенная Овчарка 7 или открытая из файла) — в гипсе, без расчёта, с кальками «Текстура» / «Фото спереди» / «Фото сбоку», пером с магнитом и сохранением разметки.

**Architecture:** новый режим страницы рядом с обычной фигурой: своё состояние `OW`, свой рендер `owRender()` (сетка модели + шейдер кальки + штрихи разметки), расчёт (`compute`) не вызывается. Разметка — общие функции `markup.js` (штрихи, зеркало, сглаживание, магнит), только поверхность другая. Чистые функции режима — в `js/ow-core.js` (тестируются в Node), всё, что трогает three.js и DOM, — в `js/owork.js`.

**Tech Stack:** браузерный JS без сборки, three.js r128 (`vendor/`), `node --test` для чистых функций, `tools/smoke.js` для страницы.

**Spec:** `docs/superpowers/specs/2026-11-25-shepherd7-workshop-design.md`

## Global Constraints

- Только HTML/CSS/JS в браузере; three.js r128 из `vendor/`; ничего со сторонних серверов.
- Одна логика: перо, «Сохранить», версии — те же функции (`markup.js`, `figJSON`, `verPut`, `mkKey`), без копий.
- Без открытого тикета код не правим: номер — в `.claude/ticket`. Тикеты нарезает Виталий (`/to-tickets`); одна задача плана — один тикет.
- Коммит, push и закрытие тикета — только после «работает» Виталия; ветка `shepherd6`, в `master` — нет.
- Поменялся любой `js/*.js` или `css/*.css` страницы — новая дата `?v=` во **всех** тегах `shepherd-v6j3w/index.html`.
- Перед коммитом: `NODE_OPTIONS=--use-system-ca npm test`, `NODE_OPTIONS=--use-system-ca npm run test:editor`, `node --test shepherd-v6j3w/tools/`.
- Цвета (спека): гипс светлый тёплый серо-бежевый, швы «Текстуры» тёмно-коричневые почти чёрные, перо ярко-зелёное.
- Только десктоп (у разметки на телефоне инструментов нет — как сейчас).
- Овчарки 1–6, их кальки и «Овчарка 5 — оригинал (вид)» не меняются.

## Review Focus

1. **Фото на дальней лапе.** Орто-проектор кладёт фото ближней лапы и на дальнюю (та же точка экрана фото). Ожидание: точки, обращённые от камеры фото (нормаль · направление ≥ 0), — гипс; дальняя лапа под ближней может быть смазана — допустимо («хоть как»). Тест — Task 4.
2. **Перо соскочило за край силуэта** (луч ушёл в ухо за мордой или в пустоту). Ожидание: промах — точка пропущена; скачок между соседними точками > 20 мм — штрих рвётся на два, а не протягивает хорду через воздух. Тест — Task 2.
3. **Модель из файла без uv или без картинки текстуры** (STL, OBJ без PNG). Ожидание: открывается гипсом, перо работает, калек «Текстура» в списке нет, сообщение «Текстуры нет — калька „Текстура“ недоступна». Тест — Task 5.
4. **Открыли сохранённый .json модели из файла, а саму модель — нет.** Ожидание: сообщение «Сначала откройте модель <имя>», разметка не теряется (лежит в браузере по имени модели). Тест — Task 5.
5. **GLB, который не прочитать** (Draco, текстура внешним файлом, несколько сеток). Ожидание: Draco — как сейчас, понятная ошибка; внешняя текстура — открыть без текстуры с сообщением; несколько сеток — склеить в одну. Тест — Task 5.

---

## Карта файлов

| Файл | Что | Задачи |
|---|---|---|
| `shepherd-v6j3w/js/ow-core.js` (новый) | чистые функции режима: свободные концы, разрыв штриха, облако швов, фото-матрица, кадр модели | 2–5 |
| `shepherd-v6j3w/tools/ow-core.test.js` (новый) | тесты `ow-core.js` (`node --test`) | 2–5 |
| `shepherd-v6j3w/js/owork.js` (новый) | режим на странице: загрузка, сцена, материалы, быстрый поиск точки, штрихи | 1–5 |
| `shepherd-v6j3w/js/ui.js` | вход в режим из выпадашки и из «Открыть модель», `renderAll`/`figJSON`/`mkUI`/перо — ветка режима; вид Овчарки 7 (#174) уходит | 1, 2, 5 |
| `shepherd-v6j3w/js/mesh.js` | `parseGLB`/`parseOBJ` отдают uv и картинку текстуры | 5 |
| `shepherd-v6j3w/js/figures.js` | `FIGURES.shepherd7_orig` — фигура режима | 1, 4 |
| `shepherd-v6j3w/css/style.css` | `body.owview` — что скрыто | 1 |
| `shepherd-v6j3w/index.html` | скрипты, `fileIn multiple`, `?v=` | 1, 5 |
| `shepherd-v6j3w/tools/photo-fit.js` (новый) | у Claude: фото + камеры `cams.json` + подгон силуэта → `js/photos-<id>.js` и `img/photo-<id>-<вид>.png` | 4 |
| `shepherd-v6j3w/tools/smoke.js` | проверки режима | 1–5 |

---

### Task 1: Овчарка 7 — рабочая фигура «без расчёта» в гипсе

Заменяет вид #174: тот же пункт выпадашки «Овчарка 7 — оригинал» и ссылка `#f=shepherd7_orig`, но это фигура режима.

**Files:**
- Create: `shepherd-v6j3w/js/owork.js`, `shepherd-v6j3w/js/ow-core.js` (пустой каркас с шапкой — функции добавят задачи 2–5), `shepherd-v6j3w/tools/ow-core.test.js`
- Modify: `shepherd-v6j3w/js/figures.js` (строка `FIGURES.shepherd7_orig`), `shepherd-v6j3w/js/ui.js` (`loadFigure`, `renderAll`, `setBase`, `origEnter` — убрать ветку `plaster` из #174), `shepherd-v6j3w/css/style.css`, `shepherd-v6j3w/index.html`
- Test: `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Consumes: `origDecode` (`js/orig.js`) — V/T/F из `ORIG.<id>`.
- Produces:
  - `FIGURES.shepherd7_orig={name:'Овчарка 7 — оригинал',ow:'shepherd5',need:'orig-shepherd5'}` — `ow` = ключ в `ORIG`; без `view`, без `poly`.
  - `OW` — состояние режима: `{on:bool, id:string, src:'fig'|'file', name:string, V:Float32Array, T:Float32Array|null, F:Uint32Array, img:HTMLImageElement|null, photos:Photo[], calka:'tex'|'front'|'side'|'', mesh:THREE.Mesh|null}`.
  - `owOpen(src:{id,name,V,T,F,img,photos}, srcKind:'fig'|'file')` — войти в режим: кадр (встроенная `ORIG.*` уже в кадре фигуры; модель из файла приходит уже в кадре — `owFrame`/`owApply`, Task 6), `document.body.classList.add('owview')`, `ST.fig=id`, `ST.verBase=id`, `renderAll()`.
  - `owLeave()` — выйти (выбор другой фигуры, `setBase`).
  - `owRender()` — сцена режима; `renderAll()` в режиме вызывает только её (без `compute`, `stats`, таблиц).
  - `owPick(ev) -> {p:[x,y,z], uv:[u,v]|null, n:[x,y,z]}|null` — точка под курсором, с ускорением (сетка клеток по треугольникам или BVH — по замеру; цель ≤ 4 мс на вызов на 158 336 треугольниках).
- Гипс: `MeshLambertMaterial`, цвет — тёплый серо-бежевый (подобрать так, чтобы при свете сцены вышел светлый, как гипс на скрине вида; пример `0xb8b0a4`).
- `body.owview` скрывает: цифры сверху (`#stats`), «Углы», вкладки расчёта, панели «Размер фигуры», «Грани», «Металл», «Перфорация сгибов», «Вид», таблицы деталей; видно — «Редактор» (Править фигуру), блок кальки, разметка, «Сохранить».

- [ ] **Step 1: Write the failing smoke checks** (`tools/smoke.js`, блок #146/#174):
  - `FIGURES.shepherd7_orig.ow==='shepherd5'`, нет `view`, нет `poly`; пункт выпадашки на месте, подпись «Овчарка 7 — оригинал»;
  - в `ui.js` нет `if(f.plaster)$('cOrigTex')` (ветка #174 убрана); `renderAll` в режиме не зовёт `compute` (строка `if(OW.on){owRender();return;}` в начале `renderAll`);
  - `owork.js` и `ow-core.js` подключены в `index.html` после `orig.js` и до `ui.js`;
  - `css/style.css` содержит правило `body.owview` для `#stats` и `.angbtn`.
- [ ] **Step 2: Run** `node shepherd-v6j3w/tools/smoke.js` → эти проверки FAIL.
- [ ] **Step 3: Implement** `owOpen/owLeave/owRender/owPick`, строку в `figures.js`, ветку в `loadFigure` (`if(FIGURES[id].ow){…owOpen…;return;}`), стили, скрипты и `?v=`.
- [ ] **Step 4: Run** smoke → PASS; `npm test`, `npm run test:editor` → зелёные.
- [ ] **Step 5: Глазами** (Playwright-скрипт в scratchpad, как `s7.js` из #174): `#f=shepherd7_orig` и выбор из выпадашки → гипс, панели расчёта скрыты, ошибок консоли 0; замер `owPick` (100 вызовов по морде) — среднее ≤ 4 мс. Переход Овчарка 7 → Овчарка 6 → Овчарка 7 — без ошибок.

---

### Task 2: Разметка в режиме — перо, магнит к своим линиям, красные концы, сохранение

**Files:**
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/js/owork.js`, `shepherd-v6j3w/js/ui.js` (`mkUI`, обработчики `pointerdown/move/up` пера, `figJSON`, `figFromJSON`/`finishOpen` для файла режима)
- Test: `shepherd-v6j3w/tools/ow-core.test.js`, `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Consumes: `owPick` (Task 1), из `markup.js` — `mkPen`, `mkSnap`, `mkMirror`, `mkSave`, `mkLoad`, `mkKey`.
- Produces:
  - `owFreeEnds(mk: Stroke[], eps=6) -> [x,y,z][]` — концы штрихов (`k:'line'|'pen'`, не `closed`), у которых ни одна точка другого штриха (и других точек своего) не ближе `eps` мм. `Stroke` — как в `markup.js`: `{k, pts:[[x,y,z],…], closed?}`. Зачёркивания (`cross`) не считаются. Перебор по сетке клеток `eps` (как `tlGrid` в `tlines.js`); 1000 штрихов × 500 точек — < 50 мс.
  - `ow-core.js` подключается в браузере как обычный скрипт и в Node через `vm` (как `markup.js` в `markup.test.js`).
  - `owSplit(raw:[x,y,z][], gap=20) -> [x,y,z][][]` — разрыв штриха пера, где соседние точки дальше `gap` мм (Review Focus 2).
  - `owSnapSeg() -> Float32Array|null` — отрезки для магнита: свои штрихи (пары соседних точек) + (Task 3) швы текстуры; при выключенной галочке «Магнит» — `null`.
  - Штрихи рисуются по точкам пера как есть (они уже на поверхности), с подъёмом к камере, как калька #169 (`TL_MAT`, запас 6 мм), цвет ярко-зелёный (`0x22d65a`); зеркальные — тот же цвет бледнее; свободные концы — красные точки (`0xd01f1f`, размер 8 px).
  - Инструмент «Линия» (клики далеко друг от друга): отрезок между кликами укладывается на поверхность через `tlinesOnFigure` с треугольниками модели (`P` — тройки, `FT={F,T}`), как `mkDrape`.
  - `figJSON()` в режиме → `{type:'md-art',v:1,ow:{src:'fig'|'file',id,name},name,mk}` — без V/F/P.
  - Ключ разметки в браузере: встроенная — `mkKey('shepherd7_orig')`; из файла — `mkKey('file:'+имяФайлаМодели)`.
  - Скрыты: «Нарезать» (`#bMkApply`), «Отменить/Повторить» правок формы.

- [ ] **Step 1: Write the failing tests** (`ow-core.test.js`, по образцу `tools/markup.test.js`): `owFreeEnds` — прямоугольник из 4 отдельных линий со щелями 3 мм → `[]`; две параллельные линии без перемычек → 4 конца; одна замкнутая (`closed:true`) → `[]`; линия, конец в 8 мм от другой → этот конец в ответе; `cross` не даёт концов. `owSplit` — штрих 0,1,2 мм … со скачком 35 мм посередине → 2 куска; без скачков → 1 кусок; точки ровно через 20 мм → 1 кусок.
- [ ] **Step 2: Run** `node --test shepherd-v6j3w/tools/ow-core.test.js` → FAIL.
- [ ] **Step 3: Implement** `owFreeEnds`, `owSplit` в `js/ow-core.js`; перо/линия/зачёркивание/зеркало/«Очистить»/«Магнит» в режиме через `owPick`; рисование штрихов и красных концов в `owRender`; `figJSON`/открытие `.json` режима; скрытие «Нарезать».
- [ ] **Step 4: Smoke checks:** `mkUI` показывает разметку при `OW.on`; `#bMkApply` скрыт в режиме; `figJSON` режима без `V`; цвет пера `0x22d65a` в `owork.js`. Run smoke → PASS.
- [ ] **Step 5: Глазами** (Playwright): провести перо по морде (имитация `mouse.down/move/up`), сохранить → в файле `mk` с точками на поверхности (каждая точка ≤ 1 мм от ближайшего треугольника — проверить в Node по сетке модели); две линии без перемычек → 4 красные точки, прямоугольник со щелями 3 мм → 0; открыть сохранённый `.json` → разметка на месте.

---

### Task 3: Калька «Текстура» и магнит к шву

**Files:**
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/js/owork.js`, `shepherd-v6j3w/js/ui.js` (выбор кальки `#traceSel`/`#cTrace` в режиме)
- Test: `shepherd-v6j3w/tools/ow-core.test.js`, `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Consumes: `OW.T`, `OW.img` (Task 1), `owSnapSeg` (Task 2).
- Produces:
  - Материал «Текстура»: `ShaderMaterial` с текстурой `OW.img`, освещение как у гипса; яркость текселя `L = max(r,g,b)`; `L ≥ 0.80` → цвет швов (тёмно-коричневый, `0x2a1d14`), `L ≤ 0.65` → гипс, между — плавно. Порог — константа `OW_SEAM=[0.65,0.80]` в `owork.js`.
  - `owSeamCloud(V,T,F, px:{W,H,data:Uint8ClampedArray}, thr=0.80, step=1) -> Float32Array` — точки поверхности (кадр фигуры) под светлыми пикселями текстуры: обход треугольников в uv, для каждого светлого пикселя — точка по барицентрическим. Это облако для магнита, а не линии.
  - `owSnapSeg()` добавляет к своим штрихам облако швов (точки как отрезки нулевой длины); магнит — `mkSnap` с радиусом `MK_SNAP` (5 мм) — как сейчас.
  - Список калек в режиме: «Текстура» (по умолчанию), «Фото спереди», «Фото сбоку» (последние две — Task 4, если у фигуры есть `photos`). Галочка «Калька» выключает — гипс.

- [ ] **Step 1: Write the failing tests** (`ow-core.test.js`): `owSeamCloud` на одном треугольнике (0,0,0)-(100,0,0)-(0,100,0), uv = те же /100, картинка 10×10 с белым столбцом x=5 → все точки облака с x ≈ 50…60 мм, ни одной вне треугольника; чёрная картинка → пустое облако.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `owSeamCloud` (картинку в пиксели — через `canvas.getContext('2d').getImageData` в `owork.js`; облако считать один раз при входе в режим, в `later(…,'Готовлю кальку…')`), материал кальки, выбор кальки.
- [ ] **Step 4: Run** тесты и smoke → PASS.
- [ ] **Step 5: Глазами:** Овчарка 7 спереди / сбоку / 3/4 / голова крупно с калькой «Текстура» и с галочкой «Текстура» Meshy (вид как есть) на тех же ракурсах — швы в тех же местах (сравнить снимки); время облака швов на 158 тыс. треугольников — записать (цель ≤ 3 с); перо у шва с магнитом прилипает (точка штриха ≤ 1 мм от точки облака), без магнита — нет.

---

### Task 4: Кальки «Фото спереди» и «Фото сбоку»

**Files:**
- Create: `shepherd-v6j3w/tools/photo-fit.js`, `shepherd-v6j3w/js/photos-shepherd7.js`, `shepherd-v6j3w/img/photo-shepherd7-front.png`, `shepherd-v6j3w/img/photo-shepherd7-side.png`
- Modify: `shepherd-v6j3w/js/ow-core.js`, `shepherd-v6j3w/js/owork.js`, `shepherd-v6j3w/js/figures.js`
- Test: `shepherd-v6j3w/tools/ow-core.test.js`, `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Produces:
  - `Photo = {key:'front'|'side', name:'Фото спереди'|'Фото сбоку', img:'img/photo-…png', m:[a0,a1,a2,a3,b0,b1,b2,b3], dir:[x,y,z], mirror:bool}` — `u = a0·x+a1·y+a2·z+a3`, `v = b0·x+b1·y+b2·z+b3` (0..1 по картинке, точка — в кадре фигуры, мм); `dir` — направление взгляда камеры фото; `mirror` — светить ещё и зеркально по X (у бока — `true`).
  - `PHOTOS.shepherd7=[Photo,Photo]` в `js/photos-shepherd7.js`, грузится по выбору кальки (как `LAZY`); `FIGURES.shepherd7_orig.photos='shepherd7'`.
  - `owPhotoUV(m, p:[x,y,z]) -> [u,v]` (ow-core) — то же, что в шейдере; для тестов и магнита не нужен.
  - `photo-fit.js` (Node, у Claude): `node shepherd-v6j3w/tools/photo-fit.js <obj> <cams.json> <xf.json> <id> front=<фото.png>,<снимок.png> side=<фото.png>,<снимок.png>` — камера ракурса из `cams.json` (орто: `target`, `dir`, `up`, `half`, `px`; формула — `camera()` в `from-dev/art/tools/plates/project.js`) ∘ подгон фото к снимку по силуэту (масштаб, сдвиг, перекос — как `fitGen` там же) ∘ перевод кадра OBJ → кадр фигуры (модель → высота 600 мм → `xf.json`: `p·s + d`, как `orig.js`) = одна аффинная матрица `m`. Пишет `js/photos-<id>.js` и копии фото в `img/` (фон белый → прозрачный, сторона ≤ 1024).
  - Источники для Овчарки 7: модель `from-dev/art/tools/plates/src/shepherd5/model/Meshy_AI_welded_adult_shepherd_final_20261122_image-to-3d-texture.obj`, `src/shepherd5/proj/cams.json` (`front`, `profile`), снимки `proj/view-front.png`, `proj/view-profile.png`, фото `proj/g-front.png`, `proj/g-profile.png`, кадр `out/shepherd5/xf.json`.
  - Шейдер фото: `uv` по `m`; нормаль · `dir` ≥ 0 (смотрит от камеры) или `uv` вне 0..1, или прозрачный пиксель → гипс; иначе цвет фото поверх гипса (непрозрачность 0,85). При `mirror` — та же проверка для `x → −x`, берётся та сторона, что смотрит на камеру.

- [ ] **Step 1: Write the failing tests** (`ow-core.test.js`): `owPhotoUV` с матрицей «вид спереди, 1000 мм на всю картинку, центр в (0,500)» → точка (0,500,0) → (0.5,0.5); (500,1000,0) → (1,0) (v вниз); смена z не меняет uv.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `owPhotoUV`, `photo-fit.js`, прогнать его для Овчарки 7 (в лог — совпадение силуэта по каждому виду; ожидаемо ≈ 0,8, как в #173), шейдер и пункты кальки.
- [ ] **Step 4: Run** тесты и smoke (файл `photos-shepherd7.js` есть, `m` — 8 чисел, фото ≤ 1 МБ каждое, не подключены до выбора) → PASS.
- [ ] **Step 5: Глазами:** Овчарка 7 спереди / сбоку / 3/4 / голова крупно с каждой фото-калькой; морда на фото спереди ложится на морду модели (глаза, нос — в пределах ~10 мм); дальняя сторона от камеры — гипс (Review Focus 1).

---

### Task 5: «Открыть модель» — всегда обводка

**Files:**
- Modify: `shepherd-v6j3w/js/mesh.js` (`parseGLB`, `parseOBJ`), `shepherd-v6j3w/js/ui.js` (`openFile`, `fileIn` обработчик), `shepherd-v6j3w/index.html` (`<input id="fileIn" … multiple>`, подсказка «?» у «Открыть модель»)
- Test: `shepherd-v6j3w/tools/smoke.js`

**Interfaces:**
- Consumes: `owOpen` (Task 1).
- Produces:
  - `owFrame(V: Float32Array) -> {s:number, d:[x,y,z]}` (ow-core) — масштаб и сдвиг в кадр фигуры: центр по X и Z — 0, низ — 0, высота — 1000 мм (точка → `p·s + d`); `owApply(V, f) -> Float32Array` — копия точек в кадре. Без этого не работает зеркало (ось — X = 0) и разметка не в мм.
  - `parseGLB(buf) -> {V,F,T?:number[][]|undefined, img?:Blob|undefined}` — `TEXCOORD_0` первого примитива с текстурой; картинка — `images[i].bufferView` → `Blob` (`mimeType`); текстура по `uri` (внешний файл) → без картинки. Несколько сеток — склеить (как сейчас).
  - `parseOBJ(txt) -> {V,F,T?}` — uv из `vt`/`f a/b/c` (одна вершина страницы = пара точка+uv, как `orig.js`).
  - `openFile(files: File[])`: `.json` → как раньше (`figFromJSON`/`finishOpen`), а если в нём `ow` — режим: встроенная (`ow.src==='fig'`) → открыть фигуру `ow.id` и разметку; из файла → «Сначала откройте модель <ow.name>», разметка из файла кладётся в браузер под `mkKey('file:'+ow.name)`. `.obj` (+ `.png` среди выбранных), `.glb`, `.stl` → `owOpen(…,'file')`. Старое расчётное открытие (упрощение `isDense`, `SIMP`) для файлов модели больше не вызывается.
  - Сообщения: «Открыта модель для обводки: N треугольников», «Текстуры нет — калька „Текстура“ недоступна».

- [ ] **Step 1: Write the failing tests:** `ow-core.test.js` — `owFrame` на кубе 0..2 → после `owApply`: min Y = 0, max Y = 1000, центр X = 0 и Z = 0 (±1e-6); smoke — `parseOBJ` на кубе с `vt` отдаёт `T` той же длины, что `V`; `parseGLB` на маленьком GLB-фикстуре (треугольник с uv и PNG 2×2 в буфере — собрать байтами прямо в тесте) отдаёт `T` и `img` типа `image/png`; GLB с `uri` текстуры → `img` нет; `openFile` для `.stl` не вызывает `compute` (строка-проверка ветки в `ui.js`); подсказка «?» у «Открыть модель» говорит про обводку. Старые проверки открытия модели с расчётом — переписать под новое поведение (не удалять без замены).
- [ ] **Step 2: Run** smoke → FAIL.
- [ ] **Step 3: Implement** `owFrame`/`owApply`, парсеры, `openFile`, `multiple`, подсказку.
- [ ] **Step 4: Run** smoke, `npm test`, `npm run test:editor` → зелёные.
- [ ] **Step 5: Глазами:** открыть через «Открыть модель» OBJ + PNG Овчарки (`from-dev/art/tools/plates/src/shepherd5/model/…obj` и `.png`) → гипс, калька «Текстура», перо; открыть один OBJ без PNG → гипс, сообщение про текстуру, перо работает; открыть сохранённый `.json` Овчарки 7 → разметка на месте.

---

## Проверка всего (после последней задачи)

- `npm test`, `npm run test:editor`, `node --test shepherd-v6j3w/tools/` — зелёные.
- Снимки Овчарки 7: спереди, сбоку, 3/4, голова — с каждой из трёх калек и с пером (зелёные штрихи, красные концы).
- Ссылка: `http://localhost:8000/shepherd-v6j3w/#f=shepherd7_orig`.
