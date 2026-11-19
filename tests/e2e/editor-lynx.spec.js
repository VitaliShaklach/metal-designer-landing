// Редактор: рысь (editor/lynx/). Тесты те же, что были в editor.spec.js (разбито, #132); общие помощники — в editor-helpers.js
const {test, expect} = require('@playwright/test');
const {openEditor} = require('./editor-helpers');

// Ждёт, пока рысь построится: индикатор скрыт, холст один
async function lynxReady(page) {
  await expect(page.locator('#loading')).toBeHidden({timeout: 30000});
  await expect(page.locator('#stage canvas')).toHaveCount(1);
}

test('lynx: открывается без ошибок и без сторонних запросов', async ({page}) => {
  const urls = [];
  page.on('request', q => urls.push(q.url()));
  const r = await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  expect(r.external).toEqual([]);
  expect(r.failed).toEqual([]);
  expect(r.errors).toEqual([]);
  expect(urls.filter(u => /doberman|bull|js\/trace-|models\.js/i.test(u))).toEqual([]);
});

test('lynx: в списке фигур одна «Рысь»', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  const opts = page.locator('#figSel option');
  await expect(opts).toHaveCount(1);
  await expect(opts).toHaveText('Рысь');
  await expect(page.locator('#mName')).toHaveValue('Рысь');
});

test('lynx: нет собак, быка и кальки на странице', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const txt = await page.evaluate(() => document.body.textContent);
  expect(txt).not.toMatch(/доберман|быка|бык\b/i);
  await expect(page.locator('#traceRow')).toHaveAttribute('hidden', '');   // строки «Калька» нет: файла кальки у редактора нет
  expect(await page.evaluate(() => Object.keys(FIGURES))).toEqual(['lynx14']);
});

test('lynx: полоса сверху', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  const back = page.locator('.edbar-back'), tg = page.locator('.edbar-tg');
  await expect(back).toHaveAttribute('href', '../');
  await expect(back).toContainText('← Все изделия');
  await expect(tg).toHaveAttribute('href', 'https://t.me/SHVA_1984');
  await expect(tg).toHaveText('Прислать фото и пожелания в Telegram');
});

test('lynx: нет ссылок на другие разделы', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  const hrefs = await page.locator('a[href]').evaluateAll(a => a.map(x => x.getAttribute('href')));
  expect(hrefs.filter(h => /index\.html|karkas|\/art|^\.\.\/\.\./.test(h))).toEqual([]);
});

test('lynx: подпись версии внизу', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  await expect(page.locator('.ver')).toHaveText('v0.27.1');
});

test('lynx: «Сохранить» и «Открыть модель» возвращают ту же рысь', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const rows = () => page.locator('#parts tr').count();
  const before = await rows();
  expect(before).toBeGreaterThan(10);
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#bSave').click()]);
  expect(d.suggestedFilename()).toMatch(/\.json$/);
  const file = await d.path();
  await page.reload();
  await lynxReady(page);
  await page.locator('#fileIn').setInputFiles(file);
  await lynxReady(page);
  await expect.poll(rows).toBe(before);
});

test('lynx: чужой файл не ломает страницу', async ({page}) => {
  const crashed = [];   // страница сама пишет пойманную ошибку в консоль; упавшей считаем только непойманную
  page.on('pageerror', e => crashed.push(e.message));
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const before = await page.locator('#parts tr').count();
  for (const f of [
    {name: 'x.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('это не модель')},
    {name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}')},
    {name: 'x.obj', mimeType: 'text/plain', buffer: Buffer.from('v 1 2\nf 1 2 3')},
  ]) {
    await page.locator('#msg').evaluate(e => { e.textContent = ''; });
    await page.locator('#fileIn').setInputFiles(f);
    await expect(page.locator('#msg')).not.toBeEmpty();
    await expect(page.locator('#stage canvas')).toHaveCount(1);
  }
  expect(await page.locator('#parts tr').count()).toBe(before);
  expect(crashed).toEqual([]);
});

// Куб из «Начать с заготовки»: считается за доли секунды, поэтому кнопки «Рассчитать» проверяем на нём; рысь целиком — в двух тестах ниже
async function lynxCube(page) {
  await page.evaluate(() => document.getElementById('bBlank').click());
  await expect(page.locator('#loading')).toBeHidden({timeout: 30000});
  await expect.poll(() => page.evaluate(() => CUR.R.parts.length)).toBe(6);
}

// нажать из самой страницы: на телефоне 3D-сцена может лежать поверх кнопки
const lynxPress = (page, sel) => page.evaluate(s => document.querySelector(s).click(), sel);

const lynxTab = (page, k) => page.evaluate(t => document.querySelector(`[role=tab][data-tab=${t}]`).click(), k);

// три вкладки рыси: кнопка «Рассчитать», куда ложится результат, чем его скачать
const LYNX_CALC = {
  nest: {run: '#nestRun', box: '#nestBox', save: '#bDxfNest'},
  sheets: {run: '#shRun', box: '#sheets', save: '#shPdf'},
  cards: {run: '#cdRun', box: '#cards', save: '#shCards'},
};

test('lynx: «Лазер · DXF», «Чертежи», «Карты»: открытие вкладки ничего не считает, скачивание неактивно, «Рассчитать» активна', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  for (const [k, c] of Object.entries(LYNX_CALC)) {
    await lynxTab(page, k);
    await page.waitForTimeout(700);   // раньше расчёт стартовал через 0,5 с после открытия
    await expect(page.locator(c.box)).toBeEmpty();
    await expect(page.locator(c.run)).toBeEnabled();
    await expect(page.locator(c.run)).toHaveText('Рассчитать');
    await expect(page.locator(c.save)).toBeDisabled();
  }
  await expect(page.locator('.nestwait:visible')).toHaveCount(0);
});

test('lynx: «Рассчитать» на «Чертежах» без раскроя — листы с «Раскрой листа» появляются, PDF только с ними', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.slow();   // «Рассчитать» у рыси: под нагрузкой дольше 30 с
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxCube(page);
  // раскроя нет: его не просили, «Лазер · DXF» пуста
  await lynxTab(page, 'nest');
  await expect(page.locator('#nestBox')).toBeEmpty();
  await lynxTab(page, 'sheets');
  await expect(page.locator('#sheets')).toBeEmpty();
  await expect(page.locator('#shPdf')).toBeDisabled();
  await lynxPress(page, '#shRun');
  await expect(page.locator('#sheets figure').first()).toBeAttached({timeout: 60000});
  await expect(page.locator('#sheets figcaption', {hasText: 'Раскрой листа'}).first()).toBeAttached();
  await expect(page.locator('#shRun')).toBeDisabled();
  await expect(page.locator('#shPdf')).toBeEnabled();
  // PDF — окно печати браузера: кнопка вызывает window.print
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await lynxPress(page, '#shPdf');
  await expect.poll(() => page.evaluate(() => window.__printed)).toBeGreaterThan(0);
  // раскрой посчитан для чертежей, но «Лазер · DXF» показывает его только по своей кнопке
  await lynxTab(page, 'nest');
  await expect(page.locator('#nestBox')).toBeEmpty();
  await expect(page.locator('#nestRun')).toBeEnabled();
});

test('lynx: изменение фигуры, точек и толщины убирает листы; смена вкладки и вида 3D — нет', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.slow();   // «Рассчитать» у рыси: под нагрузкой дольше 30 с
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxCube(page);
  const calcAll = async () => {
    for (const [k, c] of Object.entries(LYNX_CALC)) {
      await lynxTab(page, k);
      await lynxPress(page, c.run);
      await expect(page.locator(c.box + ' figure').first()).toBeAttached({timeout: 60000});
      await expect(page.locator(c.save)).toBeEnabled();
      await expect(page.locator(c.run)).toBeDisabled();
    }
  };
  const check = async fresh => {
    for (const [k, c] of Object.entries(LYNX_CALC)) {
      await lynxTab(page, k);
      await page.waitForTimeout(700);   // правка убирает листы через 0,5 с после неё
      if (fresh) { await expect(page.locator(c.box + ' figure').first()).toBeAttached(); await expect(page.locator(c.save)).toBeEnabled(); await expect(page.locator(c.run)).toBeDisabled(); }
      else { await expect(page.locator(c.box)).toBeEmpty(); await expect(page.locator(c.save)).toBeDisabled(); await expect(page.locator(c.run)).toBeEnabled(); }
    }
  };
  await calcAll();
  // вид 3D, выбор детали и вкладки — листы на месте
  await page.evaluate(() => document.querySelector('.vbar [data-v]').click());
  await page.evaluate(() => { ST.sel = 1; renderAll(); });
  await check(true);
  // толщина
  await page.evaluate(() => { const s = document.getElementById('sT'); s.value = '3'; s.dispatchEvent(new Event('change')); });
  await check(false);
  // точка: вершина куба сдвинута вместе с зеркальной
  await calcAll();
  await page.evaluate(() => { const b = ST.base, V = b.V.map(p => p.slice()), m = mirrorMap(V); V[0][1] += 7; if (m[0] >= 0 && m[0] !== 0) V[m[0]][1] += 7; applyE({V, P: b.P, S: b.S || []}, true); });
  await check(false);
  // фигура: другая заготовка
  await calcAll();
  await page.evaluate(() => { document.getElementById('blank').value = 'sphere'; document.getElementById('bBlank').click(); });
  await expect(page.locator('#loading')).toBeHidden({timeout: 30000});
  await check(false);
});

test('lynx: «Лазер · DXF» — DXF раскроя и DXF деталей скачиваются после «Рассчитать»', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.slow();   // «Рассчитать» у рыси: под нагрузкой дольше 30 с
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxCube(page);
  await lynxTab(page, 'nest');
  await lynxPress(page, '#nestRun');
  await expect(page.locator('#nestBox figure').first()).toBeAttached({timeout: 60000});
  const [d1] = await Promise.all([page.waitForEvent('download'), lynxPress(page, '#bDxfNest')]);
  expect(d1.suggestedFilename()).toMatch(/.dxf$/);
  await lynxTab(page, 'sheets');
  const [d2] = await Promise.all([page.waitForEvent('download'), lynxPress(page, '#bDxfParts')]);
  expect(d2.suggestedFilename()).toMatch(/.dxf$/);
});

// рысь целиком: раскрой считается минутами — «Чертежи» (раскрой запускают они сами) и «Лазер · DXF» отдельными тестами
test('lynx: рысь целиком — «Чертежи» по «Рассчитать» сами считают раскрой, PDF', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.setTimeout(420000);
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxTab(page, 'sheets');
  await page.waitForTimeout(700);
  await expect(page.locator('#sheets')).toBeEmpty();
  await lynxPress(page, '#shRun');
  await expect(page.locator('#sheets figcaption', {hasText: 'Раскрой листа'}).first()).toBeAttached({timeout: 400000});
  await expect(page.locator('#shPdf')).toBeEnabled();
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await lynxPress(page, '#shPdf');
  await expect.poll(() => page.evaluate(() => window.__printed)).toBeGreaterThan(0);
});

test('lynx: рысь целиком — DXF раскроя скачивается после «Рассчитать»', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.setTimeout(420000);
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxTab(page, 'nest');
  await expect(page.locator('#bDxfNest')).toBeDisabled();
  await lynxPress(page, '#nestRun');
  await expect(page.locator('#bDxfNest')).toBeEnabled({timeout: 400000});
  const [d1] = await Promise.all([page.waitForEvent('download', {timeout: 60000}), lynxPress(page, '#bDxfNest')]);
  expect(d1.suggestedFilename()).toMatch(/.dxf$/);
});

test('lynx: на телефоне без горизонтальной прокрутки', async ({page}, info) => {
  test.skip(info.project.name !== 'phone');
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

// ---------- рысь: вкладки как в мангале, старт на «Деталях» ----------

for (const tab of ['sheets', 'nest', 'cards']) {
  test(`lynx: открывается на «Деталях» при запомненной вкладке «${tab}», без зависаний в первые 3 с`, async ({page}) => {
    await page.addInitScript(t => {
      try { localStorage.setItem('art-tab', t); } catch (e) {}
      window.__long = [];
      // построение фигуры (индикатор «Строю фигуру…») от вкладки не зависит и на загруженной машине растягивается: считаем зависания только после него
      window.__built = null;
      new MutationObserver(() => { const l = document.getElementById('loading'); if (l && l.hidden && window.__built === null) window.__built = performance.now(); })
        .observe(document, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']});
      new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push([e.startTime, e.duration])))
        .observe({type: 'longtask', buffered: true});
    }, tab);
    await openEditor(page, '/editor/lynx/');
    await lynxReady(page);
    await expect(page.locator('[role=tab][data-tab=parts]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-parts')).toBeVisible();
    for (const k of ['sum', 'nest', 'sheets', 'cards']) await expect(page.locator('#tab-' + k)).toBeHidden();
    // тяжёлые вкладки сами ничего не считают: раскрой, листы и карты пусты и индикаторы скрыты
    await page.waitForTimeout(3000);
    await expect(page.locator('#nestBox')).toBeEmpty();
    await expect(page.locator('#sheets')).toBeEmpty();
    await expect(page.locator('#cards')).toBeEmpty();
    await expect(page.locator('#nestWait')).toBeHidden();
    const bad = await page.evaluate(() => window.__long.filter(([t, d]) => t >= window.__built && t < window.__built + 3000 && d > 1000));
    expect(bad).toEqual([]);
  });
}

test('lynx: «Лазер · DXF» с внутренними «Лазер» и «Гильотина»; в гильотине строка «не подходит», без кнопки', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const names = await page.locator('.tabbar > [role=tab] > b').allTextContents();
  expect(names).toEqual(['Детали', 'Итого', 'Лазер · DXF', 'Чертежи', 'Карты деталей']);
  for (const b of await page.locator('.tabbar > [role=tab]').all()) await expect(b.locator('small')).toHaveCount(1);
  await page.locator('[role=tab][data-tab=nest]').click();
  const subs = page.locator('#tab-nest .subtabs > [role=tab]');
  expect(await subs.locator('b').allTextContents()).toEqual(['Лазер', 'Гильотина']);
  await expect(page.locator('#sub-laser')).toBeVisible();
  await expect(page.locator('#sub-laser #bDxfNest')).toBeVisible();
  await expect(page.locator('#sub-gil')).toBeHidden();
  await subs.nth(1).click();
  await expect(page.locator('#sub-gil')).toBeVisible();
  await expect(page.locator('#sub-laser')).toBeHidden();
  await expect(page.locator('#sub-gil')).toContainText('Гильотина не подходит: мелкие детали');
  await expect(page.locator('#sub-gil button')).toHaveCount(0);
  await subs.nth(0).click();
  await expect(page.locator('#sub-laser #bDxfNest')).toBeVisible();
});

test('lynx: на телефоне вкладки столбцом, без прокрутки вбок', async ({page}, info) => {
  test.skip(info.project.name !== 'phone');
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const column = sel => page.evaluate(s => {
    const r = [...document.querySelectorAll(s)].map(e => e.getBoundingClientRect());
    return r.length > 1 && r.every((b, i) => b.width > 0 && (i === 0 || (b.top >= r[i - 1].bottom - 1 && Math.abs(b.left - r[0].left) < 1 && Math.abs(b.width - r[0].width) < 1)));
  }, sel);
  const noSide = async () => { const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); expect(sw).toBeLessThanOrEqual(iw); };
  expect(await column('.tabbar > [role=tab]')).toBe(true);
  await expect(page.locator('.tabbar > [role=tab]').first().locator('small')).toBeVisible();
  await noSide();
  await page.locator('[role=tab][data-tab=nest]').click();
  expect(await column('#tab-nest .subtabs > [role=tab]')).toBe(true);
  await noSide();
  await page.locator('#tab-nest .subtabs > [role=tab]').nth(1).click();
  await expect(page.locator('#sub-gil')).toBeVisible();
  await noSide();
});

test('lynx: во время раскроя виден индикатор', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.slow();   // «Рассчитать» у рыси: под нагрузкой дольше 30 с
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxTab(page, 'nest');
  await expect(page.locator('#nestWait')).toBeHidden();
  // кнопка считает прямо в обработчике и не даёт обычному клику вернуться — нажимаем из самой страницы
  await page.evaluate(() => setTimeout(() => document.getElementById('nestRun').click(), 0));
  await expect(page.locator('#nestWait')).toBeVisible({timeout: 5000});
  await expect(page.locator('#nestWait')).toContainText('Считаю раскрой');
  await expect(page.locator('#nestRun')).toHaveText('Считаю…');
  await expect(page.locator('#nestWait .nestCnt')).toContainText(/из \d+/, {timeout: 60000});
  // кольцо крутится, пока идёт расчёт (CSS-анимация): поворот в замерах разный
  const y = () => page.locator('#nestWait .nestStar b').evaluate(e => getComputedStyle(e).transform);
  const seen = new Set();
  for (let i = 0; i < 5; i++) { seen.add(await y()); await page.waitForTimeout(300); }
  expect(seen.size).toBeGreaterThan(1);
});

test('lynx: индикатор виден в «Чертежах» и «Картах деталей»', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.setTimeout(420000);
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await lynxTab(page, 'cards');
  await expect(page.locator('#cdWait')).toBeHidden();
  await page.evaluate(() => setTimeout(() => document.getElementById('cdRun').click(), 0));
  await expect(page.locator('#cdWait')).toBeVisible({timeout: 5000});
  await expect(page.locator('#cdWait')).toContainText('карты');
  await expect(page.locator('#cdCnt')).toContainText(/из \d+/, {timeout: 60000});   // счётчик идёт
  await expect(page.locator('#cdWait')).toBeHidden({timeout: 300000});   // карты рыси целиком: отдельно ~1 мин, рядом с другими тяжёлыми тестами — больше 2 мин
  await expect(page.locator('#cards figure').first()).toBeVisible();
  await lynxTab(page, 'sheets');
  await page.evaluate(() => setTimeout(() => document.getElementById('shRun').click(), 0));
  const w = page.locator('#shWait');
  await expect(w).toBeVisible({timeout: 5000});
  await expect(w).toContainText('Считаю раскрой');
  await expect(w.locator('.nestCnt')).toContainText(/из \d+/, {timeout: 60000});
});
