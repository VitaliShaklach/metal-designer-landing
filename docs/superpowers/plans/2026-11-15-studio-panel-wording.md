# Мастерская: понятная панель (тикет #108) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Цель:** панель мастерской — колонка слева с вкладкой «Фигуры», которая словами говорит, что открыто, сохранилось ли и с чего начать; рабочую копию можно удалить.

**Как устроено:** вид и тексты — в `studio/ui/panel.js` и `studio/ui/panel.css`. Одна новая команда сервера `remove` и функция `removeFigure` в `studio/lib/workdir.js`. `figure.json`, автосохранение и остальные команды не меняются.

**Стек:** обычный JavaScript в браузере, Node (сервер), Playwright, `node:test`.

**Спека:** `docs/superpowers/specs/2026-11-09-figure-studio-design.md`, решения Q26, Q32, Q34 в таблицах «Решения грилинга».

## Общие ограничения

- Действуют «Общие ограничения» и «На что смотреть при ревью» из `docs/superpowers/plans/2026-11-10-figure-studio.md`.
- Работа в `C:\Work\StartUp\landing-studio`, ветка `figure-studio`. В `master` — только по команде Виталия. `C:\dev\metal-designer` только читаем.
- Публичная страница про мастерскую не знает: `editor/` и `index.html` не трогаем.
- id и классы панели остаются: `#studioPanel`, `#stHead`, `#stBody`, `#stList`, `#stPub`, `#stPubList`, `.stPubItem`, `.stFig`, `.stFig.on`, `#stMsg`. На них опираются тесты и тикеты #83, #84, #86.
- `window.__studio`: `cur`, `flush`, `say` — без изменений; добавляется `tab`.
- Весь текст в панель — только через `textContent`.
- Команда `remove` проходит те же проверки, что остальные `/api/*`: `Origin`, `Host`, `X-Studio-Token`, иначе 403.
- Тесты перед коммитом: `npm run test:studio`, `NODE_OPTIONS=--use-system-ca npm run test:studio:e2e`.
- Порядок с соседями: этот тикет и #83 правят один файл `studio/ui/panel.js`. Этот — раньше #83, не одновременно.

## На что смотреть при ревью

1. **Двойной клик, пока идёт копия.** Второй клик по «Рысь» или по «Взять фигуру с сайта» не даёт вторую копию: пока копия делается, кнопка и пункты списка выключены.
2. **Переключение на фигуру сайта.** Выбрали фигуру в выпадашке «Фигура» страницы — состояние меняется на «На экране фигура с сайта…», пометка «открыта» в списке пропадает.
3. **Сохранение упало.** Сервер недоступен — в состоянии «не сохранилось» красным, и оно держится до следующего удачного сохранения.
4. **Удаление открытой фигуры.** Удалили ту, что на экране, — несохранённая правка не воскрешает папку (отложенная запись снимается), на экране снова фигура с сайта, после перезагрузки удалённая не открывается.
5. **Длинное название со знаками `<`, `>`, `&`** (60 знаков) показывается как текст и не раздвигает колонку шире 320 px.

---

### Задача 1: Удаление рабочей копии на сервере

**Файлы:**
- Изменить: `studio/lib/workdir.js`, `studio/server.js`
- Тест: `studio/tests/workdir.test.js`, `studio/tests/server.test.js`

**Интерфейсы:**
- Производит:
  - `removeFigure(work, slug) → {trash}` в `workdir.js`: папка `work/<slug>` переезжает в `work/.trash/<slug>-<время>`; `trash` — имя папки в корзине. Плохой `slug` — ошибка «плохое имя папки фигуры»; папки нет — ошибка «нет такой фигуры». Если `state.json` указывал на эту фигуру, `last` становится `null`.
  - Команда `POST /api/remove {slug} → {ok: true}`.

- [ ] **Шаг 1: Тесты.**

`workdir.test.js`:

```js
test('удалить: папка в .trash, в списке её нет, last сброшен, имя свободно', () => {
  const work=tmp();W.saveFigure(work,'rys-2',fig('Рысь 2'),{});W.saveFigure(work,'rys-3',fig('Рысь 3'),{});W.setLast(work,'rys-2');
  const r=W.removeFigure(work,'rys-2');
  assert.match(r.trash,/^rys-2-\d+$/);assert.ok(fs.existsSync(path.join(work,'.trash',r.trash,'figure.json')));
  assert.deepEqual(W.listFigures(work).map(f=>f.slug),['rys-3']);assert.equal(W.getLast(work),null);
  assert.throws(()=>W.removeFigure(work,'rys-2'),/нет такой фигуры/);assert.throws(()=>W.removeFigure(work,'../x'),/плохое имя/);
  W.setLast(work,'rys-3');W.removeFigure(work,'rys-3');W.saveFigure(work,'rys-2',fig('Рысь 2'),{});   // корзина не мешает новой папке с тем же именем
  assert.deepEqual(W.listFigures(work).map(f=>f.slug),['rys-2']);
});
```

`tmp()` и `fig(name)` — как помощники этого файла (временная папка и наименьшая годная фигура); если их нет под такими именами, взять те, что есть.

`server.test.js`:

```js
test('remove: копия уходит в корзину; без токена — 403; .trash по HTTP не отдаётся', async () => {
  const S=await start(tmp());
  try{const {slug}=j(await api(S,'copy',{id:'lynx14'}));
    assert.equal((await api(S,'remove',{slug},{token:null})).status,403);
    assert.equal((await api(S,'remove',{slug})).status,200);
    assert.deepEqual(j(await api(S,'list',{})).figures,[]);
    assert.equal(j(await api(S,'copy',{id:'lynx14'})).slug,slug);   // имя снова свободно
  }finally{await S.close();}
});
```

Вызовы `api` — в той же форме, что у соседних тестов файла.

- [ ] **Шаг 2:** `npm run test:studio` — FAIL: `W.removeFigure is not a function`, команда `remove` — 404.
- [ ] **Шаг 3: Написать** `removeFigure` (перенос через `fs.renameSync`, время — `Date.now()`) и строку `remove` в `API` сервера. `.trash` не подходит под `SLUG`, поэтому `listFigures` его не видит; `studio/work` закрыт для раздачи файлов целиком.
- [ ] **Шаг 4:** `npm run test:studio` — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: удаление рабочей копии в корзину».

### Задача 2: Колонка, вкладка «Фигуры», тексты и состояние

**Файлы:**
- Изменить: `studio/ui/panel.js`, `studio/ui/panel.css`
- Тест: `studio/tests/e2e/studio.spec.js`

**Интерфейсы:**
- Потребляет: `api('list' | 'open' | 'copy' | 'save' | 'remove')`, `HOOKS.changed`, `ST.fig`, `ST.name`.
- Производит:
  - `window.__studio.tab(id, title) → HTMLElement`: добавляет вкладку (кнопка `.stTab[data-tab=id]` в `#stTabs`) и возвращает её пустое содержимое `#stTab-<id>`. Повторный вызов с тем же `id` возвращает то же содержимое. Тикет #83 так добавляет «Проверка» (`check`) и «Настройки» (`settings`).
  - Элемент `#stNow` (строка состояния), класс `busy` у `#stMsg`, класс `st-open` у `<body>`, пока колонка развёрнута.

**Вид:**
- `#studioPanel` — колонка слева на всю высоту окна, ширина 320 px (`max-width: 100vw`), содержимое прокручивается внутри.
- Сверху `#stHead` «Мастерская»: клик сворачивает колонку в узкую кнопку в левом верхнем углу и разворачивает обратно.
- Под заголовком `#stNow`, ниже `#stTabs`, ниже содержимое вкладки. Сейчас вкладка одна: `figs`, «Фигуры»; в ней всё прежнее (`#stList`, `#stPub`, `#stPubList`, `#stMsg`).
- Пока колонка развёрнута и окно шире 900 px, страница рыси сдвинута вправо на 320 px (`body.st-open .wrap{margin-left:320px}`), чтобы колонка ничего не закрывала. После сворачивания и разворачивания — `window.dispatchEvent(new Event('resize'))`, чтобы 3D пересчитал размер.

**Тексты (точные):**

| где | текст |
|---|---|
| `#stNow`, рабочая копия открыта, правок не было | `Открыта: Рысь 2` |
| `#stNow`, идёт запись | `Открыта: Рысь 2 · сохраняю…` |
| `#stNow`, записано | `Открыта: Рысь 2 · сохранено` |
| `#stNow`, запись не удалась (класс `bad`) | `Открыта: Рысь 2 · не сохранилось` |
| `#stNow`, рабочей копии нет или `ST.fig !== ''` | `На экране фигура с сайта. Её правки не сохраняются` |
| вкладка | `Фигуры` |
| подпись под «Мои фигуры» (`.stHint`) | `Ваши рабочие копии. Правки сохраняются сами` |
| пустой список (`.stEmpty`) | `Фигур пока нет. Нажмите «Взять фигуру с сайта»` |
| открытая фигура в списке (`.stFig.on`) | `Рысь 2 · открыта` |
| кнопка удаления в строке фигуры (`.stDel`, `title`) | `Удалить` |
| подтверждение (`window.confirm`) | `Удалить «Рысь 3»? Папка переедет в корзину studio/work/.trash` |
| `#stMsg` после удаления | `«Рысь 3» удалена. Вернуть можно из studio/work/.trash` |
| `#stPub` | `Взять фигуру с сайта` |
| заголовок в `#stPubList` (`.stT`) | `Какую фигуру скопировать?` |
| `#stMsg.busy`, пока идёт копия | `Делаю копию «Рысь», до минуты…` |
| `#stMsg` после копии | `Открыта «Рысь 2». Фигура на сайте не изменилась` |

Название в `#stNow` — `ST.name`, а если пусто — имя из `figure.json`. Тексты ошибок («Не открылось: …», «Не скопировалось: …», «Мастерская не отвечает: …») остаются; у удаления — «Не удалилось: …».

- [ ] **Шаг 1: Тесты** в `studio/tests/e2e/studio.spec.js`. Старые три теста остаются; второй переименовать в `«Взять фигуру с сайта» → «Рысь» → в 3D «Рысь 2»`. Добавить:

```js
test('пустая мастерская: колонка слева, подсказка, с чего начать, состояние «фигура с сайта»', async ({page}) => {
  // ставится первым после beforeAll, пока в .work пусто
  await page.goto('/editor/lynx/');await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  const p=await page.locator('#studioPanel').boundingBox(),w=await page.locator('.wrap').boundingBox();
  expect(p.x).toBe(0);expect(p.width).toBe(320);expect(p.height).toBeGreaterThanOrEqual(880);expect(w.x).toBeGreaterThanOrEqual(320);   // колонка не закрывает страницу
  await expect(page.locator('.stTab[data-tab=figs]')).toHaveText('Фигуры');
  await expect(page.locator('#stPub')).toHaveText('Взять фигуру с сайта');
  await expect(page.locator('.stEmpty')).toHaveText('Фигур пока нет. Нажмите «Взять фигуру с сайта»');
  await expect(page.locator('.stHint')).toHaveText('Ваши рабочие копии. Правки сохраняются сами');
  await expect(page.locator('#stNow')).toHaveText('На экране фигура с сайта. Её правки не сохраняются');
  await page.locator('#stHead').click();expect((await page.locator('.wrap').boundingBox()).x).toBeLessThan(320);   // свернули — страница вернулась
  await page.locator('#stHead').click();await expect(page.locator('#stPub')).toBeVisible();
  const t=await page.evaluate(()=>{const a=window.__studio.tab('check','Проверка'),b=window.__studio.tab('check','Проверка');return [a===b,a.id,document.querySelectorAll('.stTab').length];});
  expect(t).toEqual([true,'stTab-check',2]);
});
```

  В тест копии (клик по «Рысь» заменить на `dblclick()`):

```js
  await expect(page.locator('#stPubList .stT')).toHaveText('Какую фигуру скопировать?');   // до клика по «Рысь»
  await expect(page.locator('#stMsg')).toHaveText('Открыта «Рысь 2». Фигура на сайте не изменилась',{timeout:30000});
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2');
  await expect(page.locator('.stFig.on')).toContainText('Рысь 2 · открыта');
  expect(fs.readdirSync(WORK).filter(d=>/^rys-/.test(d))).toEqual(['rys-2']);   // двойной клик не дал второй копии
```

  В тест разреза, после `op_split`:

```js
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2 · сохранено',{timeout:2000});
```

  Новые тесты в конце файла:

```js
test('удалить открытую копию: в корзину, на экране фигура с сайта, после перезагрузки не открывается', async ({page}) => {
  await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});
  await page.locator('#stPub').click();await page.locator('.stPubItem',{hasText:'Рысь'}).click();
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 3',{timeout:30000});
  page.once('dialog',d=>{expect(d.message()).toBe('Удалить «Рысь 3»? Папка переедет в корзину studio/work/.trash');d.accept();});
  await page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});   // правка прямо перед удалением
  await page.locator('.stFig.on .stDel').click();
  await expect(page.locator('#stMsg')).toHaveText('«Рысь 3» удалена. Вернуть можно из studio/work/.trash');
  await expect(page.locator('#stNow')).toHaveText('На экране фигура с сайта. Её правки не сохраняются');
  await page.waitForTimeout(700);expect(fs.existsSync(path.join(WORK,'rys-3'))).toBe(false);   // отложенная запись папку не воскресила
  expect(fs.readdirSync(path.join(WORK,'.trash')).some(d=>/^rys-3-\d+$/.test(d))).toBe(true);
  await page.reload();await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  await expect(page.locator('.stFig')).toHaveCount(1);await expect(page.locator('.stFig.on')).toHaveCount(0);
});
test('фигура сайта в выпадашке → состояние меняется; сбой записи → «не сохранилось»; длинное имя не шире колонки', async ({page}) => {
  await page.goto('/editor/lynx/');await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  await page.locator('.stFig',{hasText:'Рысь 2'}).click();await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});
  const long='<b>Рысь</b> & '+'очень длинное название '.repeat(3);
  await page.locator('#mName').fill(long);
  await expect(page.locator('#stNow')).toContainText('<b>Рысь</b> &');
  expect(await page.locator('#stNow b').count()).toBe(0);
  expect((await page.locator('#studioPanel').boundingBox()).width).toBe(320);
  await page.route('**/api/save',r=>r.abort());
  await page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});
  await expect(page.locator('#stNow')).toContainText('не сохранилось',{timeout:2000});
  await expect(page.locator('#stNow')).toHaveClass(/bad/);
  await page.unroute('**/api/save');
  await page.locator('#figSel').selectOption('lynx14');
  await expect(page.locator('#stNow')).toHaveText('На экране фигура с сайта. Её правки не сохраняются');
  await expect(page.locator('.stFig.on')).toHaveCount(0);
});
```

- [ ] **Шаг 2:** `NODE_OPTIONS=--use-system-ca npm run test:studio:e2e` — FAIL: нет `#stNow`, `.stTab`, `.stDel`, старый текст `#stPub`.
- [ ] **Шаг 3: Написать.**
  - Одна функция `now(state)` (`state`: `''`, `'сохраняю…'`, `'сохранено'`, `'не сохранилось'`) собирает `#stNow`. Вызывается из `applyFigure`, `flush` (до записи, после успеха, после сбоя), из `HOOKS.changed` и по `input` у `#mName`.
  - `say('Сохранено')` из `flush` убрать: это теперь в `#stNow`. Сбой записи пишется и в `#stNow`, и в `#stMsg`.
  - Пометка «открыта» и класс `on` — только когда рабочая копия открыта и `ST.fig === ''`; список перерисовывается при смене состояния.
  - `copyPublished`: на время копии `#stPub` и все `.stPubItem` получают `disabled`, `#stMsg` — класс `busy`; при ошибке `disabled` и `busy` снимаются.
  - Удаление: `.stDel` — кнопка «×» в строке `.stFig`, клик по ней фигуру не открывает. Если удаляется открытая: сначала снять отложенную запись (`clearTimeout`) и дождаться идущей, потом `cur = null`, потом `api('remove')`, потом открыть фигуру сайта — первую из `#figSel`, как делает сама страница при смене выпадашки.
  - `panel.css`: колонка, `#stTabs` и `.stTab` (`.stTab.on` — выбранная), `#stNow` (`overflow-wrap:anywhere`), `#stNow.bad`, `.stHint`, `.stDel`, `#stMsg.busy` (фон `var(--accent-soft)`), `button:disabled` в панели (`opacity:.5; cursor:default`), `body.st-open .wrap` при ширине окна от 900 px.
- [ ] **Шаг 4:** `npm run test:studio` и `NODE_OPTIONS=--use-system-ca npm run test:studio:e2e` — PASS.
- [ ] **Шаг 5: Коммит** «Мастерская: колонка с вкладкой «Фигуры», состояние, подсказки, «Взять фигуру с сайта», удаление».
