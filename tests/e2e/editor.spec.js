// Редактор (editor/): страницы открываются без ошибок и без сторонних серверов, DXF скачивается.
const {test, expect} = require('@playwright/test');

const HOST = 'localhost:8000';

// Открывает страницу и собирает за всё время: запросы не на свой сервер, ответы 4xx/5xx, ошибки страницы и консоли.
async function openEditor(page, path) {
  const r = {external: [], failed: [], errors: []};
  page.on('request', q => { if (!/^(data|blob):/.test(q.url()) && new URL(q.url()).host !== HOST) r.external.push(q.url()); });
  page.on('response', s => { if (s.status() >= 400) r.failed.push(s.status() + ' ' + s.url()); });
  page.on('pageerror', e => r.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') r.errors.push(m.text()); });
  await page.goto(path, {waitUntil: 'load'});
  return r;
}

test('mangal: открывается без ошибок и без сторонних запросов', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/');
  await expect(page.locator('#stage canvas')).toHaveCount(1);
  expect(r.external).toEqual([]);
  expect(r.failed).toEqual([]);
  expect(r.errors).toEqual([]);
});

test('mangal: полоса сверху', async ({page}) => {
  await openEditor(page, '/editor/mangal/');
  const back = page.locator('.edbar-back'), tg = page.locator('.edbar-tg');
  await expect(back).toHaveAttribute('href', '../');
  await expect(back).toContainText('← Все изделия');
  await expect(tg).toHaveAttribute('href', 'https://t.me/SHVA_1984');
  await expect(tg).toHaveText('Прислать фото и пожелания в Telegram');
});

test('mangal: нет ссылок на другие разделы', async ({page}) => {
  await openEditor(page, '/editor/mangal/');
  const hrefs = await page.locator('a[href]').evaluateAll(a => a.map(x => x.getAttribute('href')));
  expect(hrefs.filter(h => /index\.html|karkas|art/.test(h))).toEqual([]);
});

test('mangal: подпись версии внизу', async ({page}) => {
  await openEditor(page, '/editor/mangal/');
  await expect(page.locator('.ver')).toHaveText('v1.5.0');
});

test('mangal: DXF скачивается', async ({page}) => {
  await openEditor(page, '/editor/mangal/');
  await page.locator('[role=tab][data-tab=cut]').click();
  await page.locator('#nestRun').click();
  const btn = page.locator('#nestBox .dxfbtn.dl').first();
  await expect(btn).toBeVisible();
  const [d] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  expect(d.suggestedFilename()).toMatch(/.dxf$/);
});

test('mangal: «Поделиться видом» даёт ссылку, которая открывает тот же вид', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/?view=900,700,900,0,300,0&dims=');
  await page.locator('#copyView').click();
  await expect(page.locator('#viewMsg')).not.toBeEmpty();
  const link = await page.locator('#viewTxt').inputValue();
  expect(link).toContain('/editor/mangal/?view=');
  await page.goto(link);  // та же вкладка: две страницы с WebGL на процессоре разом не тянут
  await expect(page.locator('#stage canvas')).toHaveCount(1);
  await page.locator('#copyView').click();
  expect((await page.locator('#viewTxt').inputValue()).split('?')[1]).toBe(link.split('?')[1]);
  expect([...r.errors, ...r.failed, ...r.external]).toEqual([]);
});

test('mangal: на телефоне без горизонтальной прокрутки', async ({page}, info) => {
  test.skip(info.project.name !== 'phone');
  await openEditor(page, '/editor/mangal/');
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

// Вкладки как на лендинге (#75): порядок, подпись «что внутри», старые адреса и память, стрелки
test('mangal: вкладки — порядок, подписи, старые адреса', async ({page}) => {
  await openEditor(page, '/editor/mangal/');
  const tabs = page.locator('.tabbar [role=tab]');
  expect(await tabs.evaluateAll(t => t.map(b => b.dataset.tab))).toEqual(['dims', 'mass', 'cut', 'sheets', 'cards', 'buy', 'notes']);
  expect(await tabs.locator('b').allTextContents()).toEqual(['Размеры', 'Раскрой и масса', 'Лазер · DXF', 'Чертежи', 'Карты деталей', 'Что купить', 'Заметки']);
  expect(await tabs.locator('small').allTextContents()).toEqual(
    ['какие показать на модели', 'детали, вес, металл', 'лист, заготовки, гильотина', 'листы А3 и PDF для печати', 'А4 на каждую деталь: рез, швы, гибка', 'покупное со ссылками', 'как устроено']);
  // стрелки: вправо с «Размеров» — «Раскрой и масса», влево с первой — последняя
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-mass')).toBeVisible();
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-notes')).toBeVisible();
  // старые адреса — ссылкой снаружи: страница открывается заново (смена одного хеша её не перезагружает)
  for (const [h, pane] of [['mass', 'mass'], ['cut', 'cut'], ['dxf', 'cut']]) {
    await page.goto('about:blank');
    await page.goto('/editor/mangal/#' + h);
    await expect(page.locator('#tab-' + pane)).toBeVisible();
    await expect(page.locator(`[role=tab][data-tab=${pane}]`)).toHaveAttribute('aria-selected', 'true');
  }
  // запомненная вкладка
  await page.locator('[role=tab][data-tab=buy]').click();
  await page.goto('/editor/mangal/');
  await expect(page.locator('#tab-buy')).toBeVisible();
});

test('mangal: вкладки — на телефоне столбцом с подписями, на десктопе в строку', async ({page}, info) => {
  await openEditor(page, '/editor/mangal/');
  const bar = await page.locator('.tabbar').boundingBox();
  const boxes = await page.locator('.tabbar [role=tab]').evaluateAll(t => t.map(b => b.getBoundingClientRect().toJSON()));
  const small = page.locator('.tabbar [role=tab] small');
  if (info.project.name === 'phone') {
    for (let i = 0; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].width - bar.width)).toBeLessThanOrEqual(1);   // во всю ширину
      if (i) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);   // одна под другой
    }
    for (const s of await small.all()) await expect(s).toBeVisible();
    for (const t of ['dims', 'mass', 'cut', 'sheets', 'cards', 'buy', 'notes']) {
      await page.locator(`[role=tab][data-tab=${t}]`).click();
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw, t).toBeLessThanOrEqual(iw);
    }
  } else {
    expect(new Set(boxes.map(b => Math.round(b.top))).size).toBe(1);   // в строку
    const bar2 = await page.locator('.tabbar').evaluate(e => [e.scrollWidth, e.clientWidth]);
    expect(bar2[0]).toBeLessThanOrEqual(bar2[1]);   // все вкладки влезли, ничего не спрятано за краем
  }
});

// ---------- рысь (editor/lynx/) ----------

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

test('mangal: во время раскроя виден индикатор, потом скрывается', async ({page}) => {
  await openEditor(page, '/editor/mangal/');
  await expect(page.locator('#nestWait')).toBeHidden();
  // расчёт быстрый: индикатор мелькает, поэтому следим за атрибутом hidden
  await page.evaluate(() => {
    const e = document.getElementById('nestWait');
    window.__nestSeen = [];
    new MutationObserver(() => window.__nestSeen.push(!e.hidden)).observe(e, {attributes: true, attributeFilter: ['hidden']});
  });
  await page.locator('[role=tab][data-tab=cut]').click();
  await page.locator('#nestRun').click();
  await expect.poll(() => page.evaluate(() => window.__nestSeen.join())).toMatch(/^true,false/);
  await expect(page.locator('#nestWait')).toBeHidden();
  await expect(page.locator('#nestBox svg').first()).toBeVisible();
});

// ---------- мангал: раскрой по кнопке «Рассчитать» ----------

// Раскрой посчитан: лист и таблица на месте, «Рассчитать» неактивна, над схемой кнопка «Скачать DXF листа»
async function mangalCut(page) {
  await page.locator('#nestRun').click();
  await expect(page.locator('#nestBox svg').first()).toBeVisible();
  await expect(page.locator('#nestBox .ntbl').first()).toBeVisible();
  await expect(page.locator('#nestRun')).toBeDisabled();
  await expect(page.locator('#nestBox [data-act=sheet]').first()).toBeVisible();
  await expect(page.locator('#dxfAll, #zagAll, #gilAll')).toHaveCount(0);   // кнопок архива нет
}
// #103: у каждого листа порядок детей фигуры — figcaption, кнопка «Скачать DXF листа», схема; по листу — true/false
const aboveSvg = (page, box) => page.locator(`${box} figure.nsheet`).evaluateAll(fs => fs.map(f => {
  const k = [...f.children], i = k.findIndex(e => e.matches('[data-act=sheet], [data-act=gil]') || e.querySelector('[data-act=sheet], [data-act=gil]')), v = k.findIndex(e => e.matches('svg'));
  return k[0].tagName === 'FIGCAPTION' && i === 1 && v === 2;
}));
// Результата нет: листа нет, «Рассчитать» снова активна, кнопок листа нет
async function mangalNoCut(page) {
  await expect(page.locator('#nestRun')).toBeEnabled();
  await expect(page.locator('#nestRun')).toHaveText('Рассчитать');
  await expect(page.locator('#nestBox svg')).toHaveCount(0);
  await expect(page.locator('#nestBox [data-act=sheet]')).toHaveCount(0);
}
// Галочка или кнопка настроек — нажатием из кода: на телефоне панель настроек — закрытая шторка
const press = (page, sel) => page.evaluate(s => document.querySelector(s).click(), sel);
// Задержка сравнения ключа — 0,3 с; ждём с запасом, что результат НЕ пропал
const settle = page => page.waitForTimeout(800);

test('mangal: до «Рассчитать» раскроя нет — ни по #cut, ни из памяти браузера', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await expect(page.locator('#tab-cut')).toBeVisible();
  await settle(page);
  await mangalNoCut(page);
  await page.evaluate(() => localStorage.setItem('md-tab', '"cut"'));
  await page.goto('/editor/mangal/');
  await expect(page.locator('#tab-cut')).toBeVisible();
  await settle(page);
  await mangalNoCut(page);
  await mangalCut(page);
  expect(r.errors).toEqual([]);
});

test('mangal: вид модели раскрой не убирает — человек, размеры, вращение, другая вкладка', async ({page}) => {
  test.slow();   // «Показать все» размеры и вращение на SwiftShader — секунды
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  await press(page, '#cMan');
  await page.locator('[role=tab][data-tab=dims]').click();
  await page.locator('#dAll').click();
  const c = await page.locator('#stage canvas').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2 + 120, c.y + c.height / 2 + 40, {steps: 5});
  await page.mouse.up();
  await page.locator('[role=tab][data-tab=cut]').click();
  await settle(page);
  await expect(page.locator('#nestBox svg').first()).toBeVisible();
  await expect(page.locator('#nestRun')).toBeDisabled();
  expect(r.errors).toEqual([]);
});

// #117: колосник мангала — перфолист с металлобазы: галочки «Колосник на листе» нет, на схеме и в таблицах листа его нет, «Не на листе» нет;
// старая память md-ncgr2 / md-ncgr его не возвращает; строкой — в «Подготовить отдельно»
test('mangal: колосника мангала нет на листе и в DXF, галочки и блока «Не на листе» нет — он в «Подготовить отдельно»', async ({page}) => {
  test.slow();
  await page.addInitScript(() => { localStorage.setItem('md-ncgr', 'true'); localStorage.setItem('md-ncgr2', 'true'); });
  const r = await openEditor(page, '/editor/mangal/#cut');
  await expect(page.locator('#nCgr, #nCgrBox')).toHaveCount(0);
  await expect(page.locator('#tab-cut')).not.toContainText('Колосник на листе');
  await mangalCut(page);
  await expect(page.locator('#nestBox .ntbl:not(.ptbl) tr', {hasText: 'Колосник мангала'})).toHaveCount(0);
  await expect(page.locator('#nestBox svg title', {hasText: 'Колосник мангала'})).toHaveCount(0);
  await expect(page.locator('#nestBox .noff, #nestBox .nfoot')).toHaveCount(0);
  await expect(page.locator('#nestBox')).not.toContainText('не на листе');
  const row = page.locator('#nestBox .prep tbody tr', {hasText: 'Колосник 1 и Колосник 2'});
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('перфолист 5–10 мм, с металлобазы, подрезать в размер');
  await expect(row.locator('button:not(.wh), [data-act]')).toHaveCount(0);
  await expect(page.locator('#nestBox [data-act=part]')).not.toHaveCount(0);
  const files = await page.locator('#nestBox .ntbl small.fn').allTextContents();
  expect(files.filter(f => /grill_grate_[12]_/.test(f))).toEqual([]);
  expect(files).toContain('grill_grate_handle_5mm_x4.dxf');   // ручка колосника — лазер
  expect(r.errors).toEqual([]);
});

test('mangal: перегородка жаровни стоит по умолчанию — в таблице листа и DXF; снятая галочка убирает её', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await expect(page.locator('#cDiv')).toBeChecked();
  await mangalCut(page);
  const row = page.locator('#nestBox .ntbl:not(.otbl) tr', {hasText: 'Перегородка жаровни'});
  await expect(row).toHaveCount(1);
  const [d] = await Promise.all([page.waitForEvent('download'), row.locator('button[data-act=part]').click()]);
  expect(d.suggestedFilename()).toMatch(/^grill_divider_5mm_x1.*\.dxf$/);
  await page.locator('#cDiv').evaluate(e => e.click());   // на телефоне галочка за экраном панели
  await mangalNoCut(page);
  await mangalCut(page);
  await expect(page.locator('#nestBox tr', {hasText: 'Перегородка жаровни'})).toHaveCount(0);
  await expect(page.locator('#nestBox svg title', {hasText: 'Перегородка жаровни'})).toHaveCount(0);
  expect(r.errors).toEqual([]);
});

// Каждая правка — новый расчёт (~3 с на SwiftShader), поэтому правки — в трёх тестах
test('mangal: правки убирают раскрой — скобы задвижек, лист', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  await press(page, '#cHook');   // зовёт только build3D, а скобы уходят с листа
  await mangalNoCut(page);
  await mangalCut(page);
  await page.locator('#nSheet').selectOption('1500x3000');
  await mangalNoCut(page);
  expect(r.errors).toEqual([]);
});

test('mangal: правки убирают раскрой — зазор, режим, высота топки', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  await page.locator('#nGap').fill('8');
  await mangalNoCut(page);
  await mangalCut(page);
  await press(page, '#modeSeg [data-v=stove]');
  await mangalNoCut(page);
  await mangalCut(page);
  await page.locator('#hFire').evaluate(e => { e.value = String(+e.value + 2); e.dispatchEvent(new Event('input')); });
  await mangalNoCut(page);
  expect(r.errors).toEqual([]);
});

// ---------- мангал: «Лазер · DXF» — внутренние вкладки, «С листа» (#76) ----------

const SUBS = ['list', 'zag', 'gil'];   // варианты: «Лазер → С листа», «Лазер → Из заготовок», «Гильотина»
// открыть вариант: «С листа» и «Из заготовок» — внутри «Лазера»
async function openSub(page, v) {
  await page.locator(`.subtabs [role=tab][data-sub=${v === 'gil' ? 'gil' : 'laser'}]`).click();
  if (v !== 'gil') await page.locator(`.subtabs [role=tab][data-sub=${v}]`).click();
  await expect(page.locator('#sub-' + v)).toBeVisible();
}

test('mangal: «Лазер · DXF» — внутренние вкладки, сразу «Лазер → С листа», лист общий', async ({page}) => {
  test.slow();   // вкладки по очереди, 3D на SwiftShader
  // старая память браузера: «Заготовки с гильотины» и «гильотина | лазер» у детали — страницу не ломают
  await page.addInitScript(() => { localStorage.setItem('md-ngil', 'true'); localStorage.setItem('md-gilsel', '{"grill_bottom":"laser"}'); });
  const r = await openEditor(page, '/editor/mangal/#cut');
  const top = page.locator('#tab-cut > .subtabs [role=tab]');
  expect(await top.locator('b').allTextContents()).toEqual(['Лазер', 'Гильотина']);
  expect(await page.locator('#sub-laser .subtabs [role=tab] b').allTextContents()).toEqual(['С листа', 'Из заготовок']);
  await expect(page.locator('[data-sub=laser]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-sub=list]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#sub-list')).toBeVisible();
  await expect(page.locator('#sub-zag')).toBeHidden();
  await expect(page.locator('#sub-gil')).toBeHidden();
  // лист и «Угол листа» — над вариантами, общие (пересмотр 14.11); зазор — в «С листа»; простыни текста и старых галочек нет (#117: и «Колосник на листе»)
  for (const id of ['#nSheet', '#nCorner']) {
    await expect(page.locator(id)).toHaveCount(1);
    expect(await page.locator(id).evaluate(e => !e.closest('.subpane')), id).toBe(true);
  }
  await expect(page.locator('#nCorner')).toHaveValue('lb');
  expect(await page.locator('#nCorner option').allTextContents()).toEqual(['↙ слева снизу', '↖ слева сверху', '↘ справа снизу', '↗ справа сверху']);
  expect(await page.locator('#nGap').evaluate(e => e.closest('.subpane').id)).toBe('sub-list');
  await expect(page.locator('#nCgr, #nCgrBox')).toHaveCount(0);
  await expect(page.locator('#nGil, #nGilReset')).toHaveCount(0);
  expect(await page.locator('#nEdge').evaluate(e => e.closest('.subpane').id)).toBe('sub-gil');   // кромка — только в «Гильотине»
  const hint = page.locator('#sub-list .vhint');
  await expect(hint).toBeVisible();
  expect((await hint.textContent()).length).toBeLessThanOrEqual(80);
  expect(await page.locator('#tab-cut .tabnote:not(.vhint):not(.stub)').count()).toBe(0);
  // до «Рассчитать» ни схемы, ни таблицы нет
  await expect(page.locator('#nestBox svg')).toHaveCount(0);
  await openSub(page, 'zag');
  await expect(page.locator('#sub-zag .stub')).toHaveCount(0);
  await expect(page.locator('#zagBox .ntbl')).toHaveCount(0);
  await openSub(page, 'gil');
  await expect(page.locator('#sub-gil .stub')).toHaveCount(0);
  await expect(page.locator('#gilBox svg')).toHaveCount(0);
  await openSub(page, 'list');
  expect(r.errors).toEqual([]);
});

test('mangal: «С листа» — схема, таблица, итоги и «Скачать DXF листа»', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const tot = page.locator('#nestBox .ntot').first();
  for (const t of ['Рез', 'Врезки', 'Лист', 'Заполнение']) await expect(tot).toContainText(t);
  await expect(tot).toContainText('1 лист 1250 × 2500');
  const sheetBtn = page.locator('#nestBox [data-act=sheet]');
  await expect(sheetBtn).toHaveCount(1);
  await expect(sheetBtn).toHaveText('Скачать DXF листа');
  await expect(page.locator('#nestBox figure.nsheet [data-act=sheet]')).toHaveCount(1);   // кнопка — в самой фигуре листа
  expect(await aboveSvg(page, '#nestBox')).toEqual([true]);   // и над схемой: подпись, кнопка, схема (#103)
  const [d] = await Promise.all([page.waitForEvent('download'), sheetBtn.click()]);
  expect(d.suggestedFilename()).toBe('list_5mm_1250x2500.dxf');
  await expect(sheetBtn.locator('xpath=following-sibling::*[1]')).toHaveText('Скачано: list_5mm_1250x2500.dxf');   // надпись — сразу у нажатой кнопки
  await expect(page.locator('#nestBox .dxfmsg')).toHaveCount(1);
  // кнопка DXF детали в таблице осталась; надпись — в той же ячейке, под кнопкой
  const partBtn = page.locator('#nestBox .ntbl [data-act=part]').first();
  const [dp] = await Promise.all([page.waitForEvent('download'), partBtn.click()]);
  expect(dp.suggestedFilename()).toMatch(/^grill_.*.dxf$/);
  await expect(partBtn.locator('xpath=ancestor::td').locator('.dxfmsg')).toContainText('Скачано: grill_');
  await expect(page.locator('#nestBox .dxfmsg')).toHaveCount(2);
  expect(r.errors).toEqual([]);
});

// #105: раскладка «С листа» перебирает стратегии — лист мангала по умолчанию (1250 × 2500) занят короче эталона 1010 мм (зазор 5, снят до правки, см. dense.test.js)
test('mangal: раскладка «С листа» плотнее эталона — занятая длина листа меньше 1010 мм', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const len = await page.evaluate(() => LIST.cur.res[0].sheets[0].len);
  expect(len).toBeLessThan(1010);
  expect(len).toBeGreaterThan(500);
  expect(r.errors).toEqual([]);
});

// #104: гравировка номера видна на детали: «С листа» — штрихи, без текстового номера; галочка снята — номера текстом; «Гильотина» штрихов не показывает
test('mangal: гравировка на схеме «С листа» — штрихи; галочка снята — текст; «Гильотина» без штрихов', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const sv = page.locator('#nestBox svg.nestsv').first();
  expect(await sv.locator('path.engr').count()).toBeGreaterThan(5);
  expect(await sv.locator('.np:has(path.engr) text').count()).toBe(0);   // у детали со штрихами номера текстом нет
  await expect(sv.locator('path.engr').first()).toHaveCSS('stroke', 'rgb(204, 51, 51)');
  await page.locator('#nEngrave').uncheck();
  await expect(page.locator('#nestRun')).toBeEnabled();
  await mangalCut(page);
  await expect(page.locator('#nestBox path.engr')).toHaveCount(0);
  expect(await page.locator('#nestBox svg.nestsv .np text').count()).toBeGreaterThan(5);
  await page.locator('#nEngrave').check();
  await openSub(page, 'gil');
  await gilCut(page);
  await expect(page.locator('#gilBox svg.gilsv')).toHaveCount(1);
  await expect(page.locator('#gilBox path.engr')).toHaveCount(0);
  expect(await page.locator('#gilBox svg.gilsv text').count()).toBeGreaterThan(3);   // номера у заготовок — текстом
  expect(r.errors).toEqual([]);
});

// #102: ручка колосника — четыре пластины 30 × 80 × 5: строка с DXF в «С листа», в «Гильотине» — «Не рубится»
// #123: на дне жаровни лазер гравирует квадраты 80 × 80 под площадки ножек и «низ» — у дна на схеме штрихов больше, чем у одного номера
test('mangal: «С листа» — у дна жаровни красные квадраты под площадки ножек и «низ», не только номер', async ({page}, info) => {
  test.skip(info.project.name === 'phone', 'расчёт не зависит от ширины экрана — только desktop');
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  // по детали схемы: подпись и отрезки штрихов (SVG в мм — длина отрезка в мм при любом повороте детали)
  const parts = await page.locator('#nestBox svg.nestsv .np').evaluateAll(gs => gs.map(g => {
    const d = (g.querySelector('path.engr') || {getAttribute: () => ''}).getAttribute('d') || '';
    const seg = [...d.matchAll(/M([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)/g)].map(m => Math.hypot(m[3] - m[1], m[4] - m[2]));
    return {t: g.querySelector('title').textContent, n: seg.length, sq: seg.filter(l => Math.abs(l - 80) < .05).length};
  }));
  const bot = parts.filter(p => /— Дно жаровни$/.test(p.t));
  expect(bot).toHaveLength(1);
  expect(bot[0].sq).toBe(16);                                        // 4 квадрата × 4 стороны
  expect(bot[0].n).toBeGreaterThanOrEqual(16 + 17 + 3);              // + «низ» (17 штрихов) + номер
  expect(bot[0].n).toBeGreaterThan(Math.max(...parts.filter(p => !/Дно/.test(p.t)).map(p => p.n)));
  await expect(page.locator('#nestBox')).toContainText('номер, квадраты под площадки ножек и «низ» — на нижней грани');
  expect(r.errors).toEqual([]);
});

test('mangal: пластины ручки колосника — DXF в «С листа», в «Гильотине» «Не рубится: у́же 50 мм»', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const row = page.locator('#nestBox .ntbl tr', {hasText: 'Пластина ручки колосника'});
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('4');
  const [d] = await Promise.all([page.waitForEvent('download'), row.locator('[data-act=part]').click()]);
  expect(d.suggestedFilename()).toBe('grill_grate_handle_5mm_x4.dxf');
  await openSub(page, 'gil');
  await gilCut(page);
  const off = page.locator('#gilBox .otbl tr', {hasText: 'Пластина ручки колосника'});
  await expect(off).toHaveCount(1);
  await expect(off).toContainText('у́же 50 мм');
  await expect(page.locator('#gilBox .gtbl tr', {hasText: 'Пластина ручки колосника'})).toHaveCount(0);
  expect(r.errors).toEqual([]);
});

// #103: несколько листов в толщине — «Скачать DXF листа 1», «… 2», каждая над своим листом, в «С листа» и в «Гильотине»
test('mangal: «оба» на листе 1000 × 2000 — «Скачать DXF листа 1», «… 2» над своими листами', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await press(page, '#modeSeg [data-v=both]');
  await page.locator('#nSheet').selectOption('1000x2000');
  await mangalCut(page);
  const names = await page.locator('#nestBox [data-act=sheet]').allTextContents();
  expect(names).toContain('Скачать DXF листа 1');
  expect(names).toContain('Скачать DXF листа 2');
  const flags = await aboveSvg(page, '#nestBox');
  expect(flags.length).toBe(names.length);
  expect(flags.every(Boolean)).toBe(true);
  await expect(page.locator('#nestBox figure.nsheet [data-act=sheet]')).toHaveCount(names.length);
  await openSub(page, 'gil');
  await gilCut(page);
  const gn = await page.locator('#gilBox [data-act=gil]').allTextContents();
  expect(gn.length).toBeGreaterThan(1);
  expect(gn.some(t => t === 'Скачать DXF листа 1')).toBe(true);
  expect(gn.some(t => t === 'Скачать DXF листа 2')).toBe(true);
  expect((await aboveSvg(page, '#gilBox')).every(Boolean)).toBe(true);
  expect(r.errors).toEqual([]);
});

test('mangal: печь — «С листа»: три кнопки листа (5, 3, 15 мм)', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await press(page, '#modeSeg [data-v=stove]');
  await mangalCut(page);
  await expect(page.locator('#nestBox .ntot')).toHaveCount(3);
  await expect(page.locator('#nestBox [data-act=sheet]')).toHaveCount(3);
  expect((await aboveSvg(page, '#nestBox')).every(Boolean)).toBe(true);
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#nestBox .nblock').nth(2).locator('[data-act=sheet]').click()]);
  expect(d.suggestedFilename()).toBe('list_15mm_1250x2500.dxf');
  expect(r.errors).toEqual([]);
});

test('mangal: опубликованная страница — DXF листа сохраняется одним файлом в .zip', async ({page}) => {
  await page.addInitScript(() => { window.claude = {use: () => Promise.resolve({save: async o => { window.__saved = o.filename; }})}; });
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const btn = page.locator('#nestBox [data-act=sheet]');
  await btn.click();
  await expect.poll(() => page.evaluate(() => window.__saved)).toBe('list_5mm_1250x2500.zip');
  await expect(btn.locator('xpath=following-sibling::*[1]')).toHaveText('Сохранено: list_5mm_1250x2500.zip');
  expect(r.errors).toEqual([]);
});

test('mangal: внутренние вкладки — на телефоне столбцом, без прокрутки вбок на каждом варианте', async ({page}, info) => {
  test.slow();   // вкладки по очереди, 3D на SwiftShader
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  for (const sel of ['#tab-cut > .subtabs', '#sub-laser .subtabs']) {
    const bar = await page.locator(sel).boundingBox();
    const boxes = await page.locator(sel + ' [role=tab]').evaluateAll(t => t.map(b => b.getBoundingClientRect().toJSON()));
    if (info.project.name === 'phone') {
      boxes.forEach((b, i) => {
        expect(Math.abs(b.width - bar.width), sel).toBeLessThanOrEqual(1);
        if (i) expect(b.top, sel).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
      });
      for (const s of await page.locator(sel + ' [role=tab] small').all()) await expect(s).toBeVisible();
    } else expect(new Set(boxes.map(b => Math.round(b.top))).size, sel).toBe(1);
  }
  for (const v of SUBS) {
    await openSub(page, v);
    if (v === 'gil') await gilCut(page);
    if (v === 'zag') await zagCut(page);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, v).toBeLessThanOrEqual(iw);
    // блок «Не рубится» (#92): сам листается внутри своей таблицы, страницу не растягивает; «Не на листе» в «С листа» нет (#117)
    if (v === 'list') await expect(page.locator('#nestBox .noff')).toHaveCount(0);
    if (v === 'gil') {
      const tb = page.locator('#gilBox .noff .tbl').first();
      await expect(tb).toBeVisible();
      const [cw, bw] = await tb.evaluate(e => [e.getBoundingClientRect().width, document.body.clientWidth]);
      expect(cw, v).toBeLessThanOrEqual(bw);
    }
  }
  expect(r.errors).toEqual([]);
});

// ---------- мангал: «Гильотина» — что рубить, решает правило, полосы поперёк листа у выбранного края (#59, пересмотр 14.11) ----------

// Схема гильотины посчитана: таблица на месте, «Рассчитать» неактивна
async function gilCut(page) {
  await page.locator('#gilRun').click();
  await expect(page.locator('#gilBox .gtbl').first()).toBeVisible();
  await expect(page.locator('#gilRun')).toBeDisabled();
}
const gilRow = (page, name) => page.locator('#gilBox .gtbl tr', {hasText: name});
// левый и правый край заготовок на первой схеме, в мм листа (rect в SVG — в мм)
const gilSpan = page => page.locator('#gilBox svg.gilsv').first().evaluate(s => {
  const r = [...s.querySelectorAll('.gp rect')].map(e => [+e.getAttribute('x'), +e.getAttribute('width')]);
  return [Math.min(...r.map(q => q[0])), Math.max(...r.map(q => q[0] + q[1]))];
});
// верх и низ заготовок на схеме гильотины в координатах SVG (y вниз)
const gilSpanY = page => page.locator('#gilBox svg.gilsv').first().evaluate(s => {
  const r = [...s.querySelectorAll('.gp rect')].map(e => [+e.getAttribute('y'), +e.getAttribute('height')]);
  return [Math.min(...r.map(q => q[0])), Math.max(...r.map(q => q[0] + q[1]))];
});

test('mangal: «Гильотина» — по «Рассчитать», без галочек, «Не рубится» с причиной, полосы слева, архив', async ({page}) => {
  test.slow();
  // старая память галочек «рубим» и «гильотина | лазер» не читается и страницу не ломает
  await page.addInitScript(() => { localStorage.setItem('md-gilsel2', '{"grill_bottom":false}'); localStorage.setItem('md-gilsel', '{"grill_bottom":"laser"}'); });
  const r = await openEditor(page, '/editor/mangal/#cut');
  await openSub(page, 'gil');
  await expect(page.locator('#sub-gil .vhint')).toBeVisible();
  expect((await page.locator('#sub-gil .vhint').textContent()).length).toBeLessThanOrEqual(80);
  await expect(page.locator('#gilBox [data-act=gil]')).toHaveCount(0);
  await gilCut(page);
  await expect(page.locator('#gilBox svg.gilsv')).toHaveCount(1);
  await expect(page.locator('#gilBox input[type=checkbox]')).toHaveCount(0);
  const tot = page.locator('#gilBox .ntot').first();
  for (const t of ['Лист', 'Заготовки', 'Резы']) await expect(tot).toContainText(t);
  await expect(tot).toContainText('1 лист 1250 × 2500');
  // задвижки и скобы (у́же 50 мм) — не на схеме и не в основной таблице; в блоке «Не рубится» с причиной и DXF; колосника мангала нет нигде (#117)
  await expect(page.locator('#gilBox .ntbl:not(.ptbl) tr', {hasText: 'Колосник мангала'})).toHaveCount(0);
  for (const n of ['Задвижка поддува', 'Скоба задвижки', 'Колосник мангала']) {
    await expect(page.locator('#gilBox .gtbl tr', {hasText: n})).toHaveCount(0);
    await expect(page.locator('#gilBox svg.gilsv title', {hasText: n})).toHaveCount(0);
  }
  const offRow = n => page.locator('#gilBox .otbl tr', {hasText: n});
  await expect(offRow('Задвижка поддува')).toContainText('у́же 50 мм');   // с ударением: «у́же», не «уже»
  await expect(page.locator('#gilBox .noff h4')).toHaveText('Не рубится');
  const note = page.locator('#gilBox .nfoot');
  await expect(note).toHaveText('10 деталей не на схеме — ниже');
  await expect(page.locator('#gilBox')).not.toContainText('Не рубится: ');
  expect(await note.evaluate(e => !!(e.compareDocumentPosition(document.querySelector('#gilBox svg.gilsv')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);   // над схемой
  const [ds] = await Promise.all([page.waitForEvent('download'), offRow('Задвижка поддува').locator('button[data-act=part]').click()]);
  expect(ds.suggestedFilename()).toBe('grill_air_slider_5mm_x2.dxf');
  await expect(page.locator('#gilBox svg.gilsv title', {hasText: 'Дно жаровни'})).toHaveCount(1);   // память md-gilsel2 не читается
  await expect(page.locator('#gilBox')).not.toContainText('Не на схеме');
  // полосы — от левого края листа (подрезка 10)
  expect((await gilSpan(page))[0]).toBe(10);
  const gilBtn = page.locator('#gilBox [data-act=gil]');
  await expect(gilBtn).toHaveText('Скачать DXF листа');
  expect(await aboveSvg(page, '#gilBox')).toEqual([true]);   // над схемой (#103)
  const [d] = await Promise.all([page.waitForEvent('download'), gilBtn.click()]);
  expect(d.suggestedFilename()).toBe('gilotina_5mm_1250x2500.dxf');
  await expect(gilBtn.locator('xpath=following-sibling::*[1]')).toHaveText('Скачано: gilotina_5mm_1250x2500.dxf');
  await expect(page.locator('#nestRun')).toBeEnabled();   // «С листа» не посчитана — «Гильотина» её не трогает
  expect(r.errors).toEqual([]);
});

// #106: в ряд идёт заготовка ниже ряда — на мангале по умолчанию, лист 1500 × 3000, в одном ряду две заготовки разной высоты; резов не больше 35 (было 28, +25 %), число резов видно
test('mangal: «Гильотина» плотнее — лист 1500 × 3000: в ряду заготовки разной высоты, резы видны в подписи листа', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await page.locator('#nSheet').selectOption('1500x3000');
  await openSub(page, 'gil');
  await gilCut(page);
  const cuts = +(/резов (\d+)/.exec(await page.locator('#gilBox figcaption').first().textContent())[1]);
  expect(cuts).toBeGreaterThan(0);
  expect(cuts).toBeLessThanOrEqual(35);
  await expect(page.locator('#gilBox .ntot').first()).toContainText('Резы');
  // рамки заготовок на схеме: рядом (впритык по x) стоят две с общим низом и разной высотой (>1 мм)
  const mixed = await page.locator('#gilBox svg.gilsv').first().evaluate(s => {
    const r = [...s.querySelectorAll('.gp rect')].map(e => ['x', 'y', 'width', 'height'].map(k => +e.getAttribute(k)));
    return r.some(a => r.some(b => a !== b && Math.abs(a[0] + a[2] - b[0]) < 0.6 && Math.abs((a[1] + a[3]) - (b[1] + b[3])) < 0.6 && Math.abs(a[3] - b[3]) > 1));
  });
  expect(mixed).toBe(true);
  expect(r.errors).toEqual([]);
});

test('mangal: «Угол листа» — гильотина и «С листа» в выбранном углу, выбор запоминается', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await openSub(page, 'gil');
  await gilCut(page);
  const [l0, l1] = await gilSpan(page);
  const [t0, t1] = await gilSpanY(page);
  expect(t1).toBe(1250 - 10);   // ↙: низ заготовок у нижней подрезки
  await page.locator('#nCorner').selectOption('rt');
  await expect(page.locator('#gilRun')).toBeEnabled();   // угол поменяли — схема устарела
  await gilCut(page);
  const [r0, r1] = await gilSpan(page);
  expect(r1).toBe(2500 - 10);
  expect(r1 - r0).toBe(l1 - l0);   // та же схема, отражена
  const [u0, u1] = await gilSpanY(page);
  expect(u0).toBe(10);   // ↗: верх у подрезки (SVG, y вниз)
  expect(u1 - u0).toBe(t1 - t0);
  // «С листа» тоже в ↗: правый край деталей у края листа, левый — во второй половине, верх — у края
  await openSub(page, 'list');
  await expect(page.locator('#nestRun')).toBeEnabled();
  await mangalCut(page);
  const xs = await page.locator('#nestBox svg.nestsv').first().evaluate(s => {
    const b = [...s.querySelectorAll('.np path')].map(p => p.getBBox());
    return [Math.min(...b.map(q => q.x)), Math.max(...b.map(q => q.x + q.width)), Math.min(...b.map(q => q.y))];
  });
  expect(xs[0]).toBeGreaterThan(2500 / 2);
  expect(Math.abs(xs[1] - (2500 - 10))).toBeLessThan(1);
  expect(Math.abs(xs[2] - 10)).toBeLessThan(1);
  // выбор угла запоминается
  await page.reload();
  await expect(page.locator('#nCorner')).toHaveValue('rt');
  expect(r.errors).toEqual([]);
});

test('mangal: «Угол листа» — старая память md-gilside угол не меняет, мусор в md-corner — ↙', async ({page}) => {
  await page.addInitScript(() => { localStorage.setItem('md-gilside', '"r"'); localStorage.setItem('md-corner', '"xx"'); });
  const r = await openEditor(page, '/editor/mangal/#cut');
  await expect(page.locator('#nCorner')).toHaveValue('lb');
  expect(r.errors).toEqual([]);
});

test('mangal: «Гильотина» в печи — колосник 15 мм не рубится, правка модели и кромки убирает схему', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await press(page, '#modeSeg [data-v=stove]');
  await openSub(page, 'gil');
  await gilCut(page);
  await expect(page.locator('#gilBox .nblock h3')).toHaveText(['Лист 5 мм', 'Лист 3 мм', 'Лист 15 мм']);
  const b15 = page.locator('#gilBox .nblock').nth(2);
  await expect(b15.locator('.gnone')).toHaveText('Ничего не рубим');
  await expect(b15.locator('.noff h4')).toHaveText('Не рубится');
  await expect(b15.locator('.otbl tr', {hasText: 'Колосник печи'})).toContainText('толще 8 мм');
  await expect(b15.locator('.gtbl')).toHaveCount(0);
  await expect(page.locator('#gilBox [data-act=gil]')).toHaveCount(2);   // 5 и 3 мм; на 15 мм рубить нечего
  expect(await aboveSvg(page, '#gilBox')).toEqual([true, true]);   // над схемой (#103)
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#gilBox .nblock').nth(1).locator('[data-act=gil]').click()]);
  expect(d.suggestedFilename()).toBe('gilotina_3mm_1250x2500.dxf');
  // правка модели: схема убрана, «Рассчитать» снова активна; подрезка кромки — тоже
  await page.locator('#hFire').evaluate(e => { e.value = String(+e.value + 2); e.dispatchEvent(new Event('input')); });
  await expect(page.locator('#gilRun')).toBeEnabled();
  await expect(page.locator('#gilBox svg')).toHaveCount(0);
  await expect(page.locator('#gilBox [data-act=gil]')).toHaveCount(0);
  await gilCut(page);
  await page.locator('#nEdge').fill('0');
  await expect(page.locator('#gilRun')).toBeEnabled();
  expect(r.errors).toEqual([]);
});

// ---------- мангал: «Лазер → Из заготовок» — все детали, которым нужен лазер; от «Гильотины» не зависит (#60, пересмотр 14.11) ----------

// «Из заготовок» посчитана: таблица на месте, «Рассчитать» неактивна
async function zagCut(page) {
  await page.locator('#zagRun').click();
  await expect(page.locator('#zagBox .nblock').first()).toBeVisible();
  await expect(page.locator('#zagRun')).toBeDisabled();
}
const zagRow = (page, name) => page.locator('#zagBox .ntbl tr', {hasText: name});

test('mangal: «Из заготовок» — по «Рассчитать», итоги, все детали под лазер, DXF у каждой заготовки', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await openSub(page, 'zag');
  await expect(page.locator('#sub-zag .vhint')).toHaveText('Врезки с запасом: каждый паз с кромки считается врезкой');
  await zagCut(page);
  const tot = page.locator('#zagBox .ntot').first();
  for (const t of ['Рез', 'Врезки', 'Заготовки']) await expect(tot).toContainText(t);
  await expect(tot).toContainText(/Врезки \d+/);   // число не фиксируем (план, задача 3): оно меняется вместе с прорезями
  await expect(tot).toContainText('Заготовки 9');
  // боковины, задвижки, скобы — да (нужен лазер); дно и торец (прямоугольники) и колосник мангала (не лазер, #117) — нет
  for (const n of ['Боковина жаровни задняя', 'Боковина жаровни передняя', 'Перегородка жаровни', 'Задвижка поддува', 'Скоба задвижки']) await expect(zagRow(page, n)).toHaveCount(1);
  for (const n of ['Дно жаровни', 'Торец жаровни', 'Колосник мангала']) await expect(zagRow(page, n)).toHaveCount(0);
  await expect(page.locator('#zagBox')).not.toContainText('Не на схеме');
  await expect(page.locator('#zagBox [data-act=sheet], #zagBox .nbtns')).toHaveCount(0);   // листа нет — только кнопки заготовок
  await expect(page.locator('#zagBox [data-act=zag]')).toHaveCount(5);
  const [d1] = await Promise.all([page.waitForEvent('download'), zagRow(page, 'Боковина жаровни задняя').locator('button[data-act=zag]').click()]);
  expect(d1.suggestedFilename()).toBe('grill_side_back_5mm_x1_zag.dxf');
  await expect(zagRow(page, 'Боковина жаровни задняя').locator('td.dl .dxfmsg')).toHaveText('Скачано: grill_side_back_5mm_x1_zag.dxf');   // надпись — в той же ячейке
  // «С листа» и «Гильотина» не посчитаны — «Из заготовок» их не трогает
  await expect(page.locator('#nestRun')).toBeEnabled();
  await expect(page.locator('#gilRun')).toBeEnabled();
  expect(r.errors).toEqual([]);
});

test('mangal: «Из заготовок» — «Гильотина» её не трогает', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await openSub(page, 'zag');
  await zagCut(page);
  // подрезка кромки и угол — результат «Из заготовок» остаётся
  await openSub(page, 'gil');
  await gilCut(page);
  await page.locator('#nEdge').fill('0');
  await page.locator('#nCorner').selectOption('rt');
  await openSub(page, 'zag');
  await expect(page.locator('#zagRun')).toBeDisabled();
  await expect(zagRow(page, 'Боковина жаровни задняя')).toHaveCount(1);
  await expect(zagRow(page, 'Колосник мангала')).toHaveCount(0);   // #117: колосник мангала — не лазер
  expect(r.errors).toEqual([]);
});

test('mangal: «Из заготовок» в печи — 3 мм без заготовок, колосник 15 мм под лазер', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await press(page, '#modeSeg [data-v=stove]');
  await openSub(page, 'zag');
  await zagCut(page);
  await expect(page.locator('#zagBox .nblock h3')).toHaveText(['Лист 5 мм', 'Лист 3 мм', 'Лист 15 мм']);
  await expect(page.locator('#zagBox .nblock').nth(1).locator('.gnone')).toHaveText('Заготовок под лазер нет');
  await expect(zagRow(page, 'Колосник печи')).toHaveCount(1);
  await expect(page.locator('#zagBox [data-act=zag]')).toHaveCount(3);
  expect(r.errors).toEqual([]);
});

test('mangal: детали поменяли во время счёта — устаревший раскрой не показывается', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await page.evaluate(() => { document.getElementById('nestRun').click(); document.getElementById('cHook').click(); });
  await mangalNoCut(page);
  await settle(page);
  await mangalNoCut(page);
  expect(r.errors).toEqual([]);
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

test('home: открывается без ошибок и без сторонних запросов', async ({page}) => {
  const r = await openEditor(page, '/editor/');
  expect(r.external).toEqual([]);
  expect(r.failed).toEqual([]);
  expect(r.errors).toEqual([]);
});

test('home: две карточки ведут на мангал и рысь', async ({page}) => {
  await openEditor(page, '/editor/');
  const m = page.locator('a.card[href="mangal/"]'), l = page.locator('a.card[href="lynx/"]');
  await expect(m).toContainText('Мангал и печь под казан');
  await expect(l).toContainText('Рысь');
  for (const c of [m, l]) {
    const loaded = await c.locator('img').evaluate(i => i.complete && i.naturalWidth > 0);
    expect(loaded).toBe(true);
  }
  await m.click();
  await expect(page).toHaveURL(/\/editor\/mangal\/$/);
  await page.goBack();
  await l.click();
  await expect(page).toHaveURL(/\/editor\/lynx\/$/);
});

test('home: блока «Пришлите фото» нет, кнопка Telegram в шапке', async ({page}) => {
  await openEditor(page, '/editor/');
  await expect(page.getByText('Пришлите фото и пожелания')).toHaveCount(0);
  await expect(page.locator('.cta')).toHaveCount(0);
  const tg = page.locator('a.top-tg[href="https://t.me/SHVA_1984"]');
  await expect(tg).toBeVisible();
  await expect(tg).toHaveAttribute('target', '_blank');
});

test('home: нет перехода на лендинг', async ({page}) => {
  await openEditor(page, '/editor/');
  const hrefs = await page.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  expect(hrefs.filter(h => h === '../' || h === '../index.html' || h === '/')).toEqual([]);
});

for (const p of ['mangal', 'lynx']) test(`${p}: кнопка «Все изделия» заметная, не ниже 44 px`, async ({page}) => {
  await openEditor(page, `/editor/${p}/`);
  const back = page.locator('.edbar-back');
  await expect(back).toBeVisible();
  const [h, bg] = await back.evaluate(e => [e.getBoundingClientRect().height, getComputedStyle(e).backgroundColor]);
  expect(h).toBeGreaterThanOrEqual(44);
  expect(bg).toBe('rgb(196, 72, 12)');
  await back.click();
  await expect(page).toHaveURL(/\/editor\/$/);
});

test('home: на телефоне без горизонтальной прокрутки', async ({page}, info) => {
  test.skip(info.project.name !== 'phone');
  await openEditor(page, '/editor/');
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

// «Раскрой и масса» (#63): только металл цеха, описание в одну строку, итог = цифра в шапке, сборка — в «Заметках»
test('mangal: «Раскрой и масса» — только металл, итог в шапке, подробности в «Заметках»', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#mass');
  const rows = () => page.locator('#cut tbody tr:not(.grp):not(.tot)');
  const names = () => rows().evaluateAll(tr => tr.map(x => x.cells[0].firstChild.textContent));
  const n = await names();
  expect(n.filter(x => /^(Колесо|Болт|Шайба|Гайка|Петля|Плита)/.test(x))).toEqual([]);
  expect(n).toContain('Площадка под колесо (низ ножки)');
  expect(n.filter(x => /^Решётка/.test(x))).toEqual([]);   // #117: решётки — только показ на 3D, как шампуры
  const notes = await page.locator('#cut tbody small').allTextContents();
  expect(notes.filter(s => s.length > 80)).toEqual([]);
  const tot = page.locator('#cut tr.tot td.n').last();
  await expect(tot).toHaveText('60,2');
  await expect(page.locator('#stats')).toContainText('≈ 60,2 кг');
  // печь: без плиты, около 87,3 кг
  await page.locator('#modeSeg [data-v=stove]').click();
  await expect(tot).toHaveText('87,3');
  await expect(page.locator('#stats')).toContainText('≈ 87,3 кг');
  expect((await names()).filter(x => /^Плита/.test(x))).toEqual([]);
  // «Заметки»: сборка по деталям — строки с подробностями, в том числе убранная плита
  await page.locator('[role=tab][data-tab=notes]').click();
  await expect(page.locator('#notesBox .asm h3')).toHaveText('Сборка по деталям');
  expect(await page.locator('#notesBox .asm li').count()).toBeGreaterThan(5);
  await expect(page.locator('#notesBox')).toContainText('Не приваривать: плита снимается');
  expect(r.errors).toEqual([]);
});

// ---------- мангал: лист крупно — клик по схеме листа и гильотины (#62) ----------

// Клик по схеме открывает её на весь экран; «+» и «−» меняют масштаб, «Весь лист» возвращает, тянуть — двигать, Esc закрывает
async function zoomCheck(page, svgSel) {
  const zoom = page.locator('#zoom');
  await expect(zoom).toBeHidden();
  await page.locator(svgSel).first().click({position: {x: 40, y: 40}});
  await expect(zoom).toBeVisible();
  const box = await zoom.boundingBox(), vp = page.viewportSize();
  expect(Math.round(box.width)).toBe(vp.width);   // на весь экран
  expect(Math.round(box.height)).toBe(vp.height);
  await expect(page.locator('#zoomBox svg')).toHaveCount(1);
  await expect(page.locator('#zoomTtl')).not.toHaveText('');
  const k0 = parseInt(await page.locator('#zoomK').textContent());
  await page.locator('#zoomIn').click();
  const k1 = parseInt(await page.locator('#zoomK').textContent());
  expect(k1).toBeGreaterThan(k0);
  await page.locator('#zoomOut').click();
  await page.locator('#zoomOut').click();
  expect(parseInt(await page.locator('#zoomK').textContent())).toBeLessThan(k1);
  // масштаб действительно меняет размер схемы (а не только число)
  await page.locator('#zoomFit').click();
  const w1 = (await page.locator('#zoomBox svg').boundingBox()).width;
  await page.locator('#zoomIn').click();
  await page.locator('#zoomIn').click();
  expect((await page.locator('#zoomBox svg').boundingBox()).width).toBeGreaterThan(w1 * 2);
  // тянуть — двигает схему
  const zb = await page.locator('#zoomBox').boundingBox(), s0 = await page.locator('#zoomBox').evaluate(e => e.scrollLeft);
  await page.mouse.move(zb.x + zb.width * 0.7, zb.y + zb.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(zb.x + zb.width * 0.3, zb.y + zb.height * 0.5, {steps: 4});
  await page.mouse.up();
  expect(await page.locator('#zoomBox').evaluate(e => e.scrollLeft)).toBeGreaterThan(s0);
  await page.keyboard.press('Escape');
  await expect(zoom).toBeHidden();
  await expect(page.locator('#zoomBox svg')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/noscroll/);
}

test('mangal: клик по схеме листа открывает её крупно, «+» «−», Esc', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  await zoomCheck(page, '#nestBox svg.nestsv');
  expect(r.errors).toEqual([]);
});

test('mangal: клик по схеме гильотины открывает её крупно, «✕» закрывает', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await openSub(page, 'gil');
  await gilCut(page);
  await zoomCheck(page, '#gilBox svg.gilsv');
  await page.locator('#gilBox svg.gilsv').first().click({position: {x: 40, y: 40}});
  await expect(page.locator('#zoom')).toBeVisible();
  await page.locator('#zoomX').click();
  await expect(page.locator('#zoom')).toBeHidden();
  expect(r.errors).toEqual([]);
});

// ---------- мангал: «Чертежи» по кнопке «Рассчитать» (#67) ----------

// Чертежи посчитаны: листы на месте, «Рассчитать» неактивна, «Скачать PDF» активна
async function mangalSheets(page) {
  await press(page, '#shRun');   // на телефоне 3D-сцена может лежать поверх кнопки после прокрутки
  await expect(page.locator('#shBox svg.shs').first()).toBeVisible({timeout: 60000});
  await expect(page.locator('#shRun')).toBeDisabled();
  await expect(page.locator('#shPdf')).toBeEnabled();
}
// Результата нет: листов нет, «Рассчитать» активна, «Скачать PDF» неактивна
async function mangalNoSheets(page) {
  await expect(page.locator('#shRun')).toBeEnabled();
  await expect(page.locator('#shRun')).toHaveText('Рассчитать');
  await expect(page.locator('#shBox svg')).toHaveCount(0);
  await expect(page.locator('#shPdf')).toBeDisabled();
}

test('mangal: «Чертежи» — до «Рассчитать» листов нет, после — комплект, PDF только с ним', async ({page}) => {
  test.slow();
  await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; window.__printN = document.querySelectorAll('#printBox svg').length; }; });
  const r = await openEditor(page, '/editor/mangal/#sheets');
  await expect(page.locator('#tab-sheets')).toBeVisible();
  await mangalNoSheets(page);
  await mangalSheets(page);
  const caps = await page.locator('#shBox figcaption').allTextContents();
  expect(caps.length).toBeGreaterThan(4);
  expect(caps[0]).toContain('Общий вид');
  expect(caps[caps.length - 1]).toContain('Раскрой');
  await page.locator('#shPdf').click();
  expect(await page.evaluate(() => [window.__printed, window.__printN])).toEqual([1, caps.length]);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});

test('mangal: «Чертежи» — изменение деталей убирает листы, вид модели — нет', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#sheets');
  await mangalSheets(page);
  // размеры на модели и другая вкладка листов не трогают
  await page.locator('[role=tab][data-tab=dims]').click();
  await press(page, '#dAll');
  await settle(page);
  await page.locator('[role=tab][data-tab=sheets]').click();
  await expect(page.locator('#shBox svg.shs').first()).toBeVisible();
  await expect(page.locator('#shPdf')).toBeEnabled();
  // деталь поменяли — листов нет, кнопка снова активна
  await page.locator('#hTop').evaluate(e => { e.value = String(+e.value + 2); e.dispatchEvent(new Event('input')); });
  await mangalNoSheets(page);
  await mangalSheets(page);
  await press(page, '#modeSeg [data-v=stove]');
  await expect(page.locator('#shBox svg')).toHaveCount(0);
  expect(r.errors).toEqual([]);
});

// печь и «оба» (#69): чертежи считаются по той же кнопке; строки «пока не готовы» нет. По тесту на режим — каждый укладывается в таймаут на телефоне
for (const [mode, name, spec] of [['stove', 'Печь под казан 600 × 440 × 970, 3–15 мм', 'Дверца, лист 3 мм'], ['both', 'Мангал с печью 1400 × 440 × 970, 3–15 мм', 'Боковина жаровни (задняя и передняя)']]) {
  test(`mangal: «Чертежи» — режим «${mode}»: комплект считается по кнопке, «пока не готовы» нет, PDF`, async ({page}) => {
    test.slow();
    await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; window.__printN = document.querySelectorAll('#printBox svg').length; }; });
    const r = await openEditor(page, '/editor/mangal/#sheets');
    await press(page, `#modeSeg [data-v=${mode}]`);
    await expect(page.locator('#shStove')).toHaveCount(0);
    await expect(page.locator('#shRun')).toBeVisible();
    await mangalNoSheets(page);
    await mangalSheets(page);
    const caps = await page.locator('#shBox figcaption').allTextContents();
    expect(caps[0]).toContain('Общий вид');
    expect(caps.filter(c => c.includes('Раскрой')).length).toBeGreaterThanOrEqual(3);   // листы 5, 3 и 15 мм
    const txt = await page.locator('#shBox').evaluate(e => e.textContent);
    expect(txt).toContain(name);
    expect(txt).toContain(spec);
    expect(txt).not.toContain('пока не готов');
    if (mode === 'both') expect(txt).toContain('Боковина печи (задняя и передняя)');
    await page.locator('#shPdf').click();
    expect(await page.evaluate(() => [window.__printed, window.__printN])).toEqual([1, caps.length]);
    // деталь поменяли — листов нет, кнопка снова активна
    await page.locator('#hTop').evaluate(e => { e.value = String(+e.value + 2); e.dispatchEvent(new Event('input')); });
    await mangalNoSheets(page);
    expect(r.errors).toEqual([]);
    expect(r.external).toEqual([]);
  });
}

test('mangal: «Чертежи» на телефоне без горизонтальной прокрутки', async ({page}, info) => {
  test.slow();
  await openEditor(page, '/editor/mangal/#sheets');
  await mangalSheets(page);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

// ---------- мангал: «Карты деталей» по кнопке «Рассчитать» (#68) ----------

const CARDS = 14;   // деталей цеха по умолчанию: 10 листовых и 4 не с лазера (боковины — две карты); решёток нет — только показ на 3D (#117)

// Карты посчитаны: карта на каждую деталь, «Рассчитать» неактивна, «Скачать PDF» активна
async function mangalCards(page) {
  await press(page, '#cdRun');
  await expect(page.locator('#cdBox svg.shs')).toHaveCount(CARDS, {timeout: 90000});
  await expect(page.locator('#cdRun')).toBeDisabled();
  await expect(page.locator('#cdPdf')).toBeEnabled();
}
// Результата нет: карт нет, «Рассчитать» активна, «Скачать PDF» неактивна
async function mangalNoCards(page) {
  await expect(page.locator('#cdRun')).toBeEnabled();
  await expect(page.locator('#cdRun')).toHaveText('Рассчитать');
  await expect(page.locator('#cdBox svg')).toHaveCount(0);
  await expect(page.locator('#cdPdf')).toBeDisabled();
}

test('mangal: «Карты деталей» — до «Рассчитать» карт нет, после — карта на деталь с видами 3D, PDF только с ними', async ({page}) => {
  test.slow();
  await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; window.__printN = document.querySelectorAll('#printBox svg').length; window.__printA4 = document.getElementById('printBox').classList.contains('a4'); }; });
  const r = await openEditor(page, '/editor/mangal/#cards');
  await expect(page.locator('#tab-cards')).toBeVisible();
  await mangalNoCards(page);
  await mangalCards(page);
  // на каждой карте 6 картинок 3D: 4 вида, швы и соседи, где на мангале
  expect(await page.evaluate(() => [...document.querySelectorAll('#cdBox svg')].map(s => s.querySelectorAll('image').length))).toEqual(Array(CARDS).fill(6));
  const bottom = page.locator('#cdBox .shprev').filter({hasText: '1. Дно жаровни'});
  await expect(bottom).toContainText('800 × 420');
  await expect(bottom).toContainText('шов 800 мм');
  await page.locator('#cdPdf').click();
  expect(await page.evaluate(() => [window.__printed, window.__printN, window.__printA4])).toEqual([1, CARDS, true]);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});

test('mangal: «Карты деталей» — после карт модель на экране та же, изменение деталей убирает карты, вид модели — нет', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cards');
  const state = () => page.evaluate(() => ({n: group.children.length, vis: group.children.filter(o => o.visible).length, inScene: scene.children.length}));
  const before = await state();
  await mangalCards(page);
  expect(await state()).toEqual(before);   // снимали свою модель, не экранную
  await page.locator('[role=tab][data-tab=dims]').click();
  await press(page, '#dAll');
  await settle(page);
  await page.locator('[role=tab][data-tab=cards]').click();
  await expect(page.locator('#cdBox svg.shs')).toHaveCount(CARDS);
  await expect(page.locator('#cdPdf')).toBeEnabled();
  await page.locator('#hTop').evaluate(e => { e.value = String(+e.value + 2); e.dispatchEvent(new Event('input')); });
  await mangalNoCards(page);
  await mangalCards(page);
  await press(page, '#modeSeg [data-v=stove]');
  await expect(page.locator('#cdBox svg')).toHaveCount(0);
  expect(r.errors).toEqual([]);
});

// печь и «оба» (#69): карта на каждую деталь цеха, та же кнопка; карт печи «пока не готовы» нет
for (const [mode, n, ids] of [['stove', 17, ['Дверца топки', 'Колосник печи', 'Шибер поддувала', 'Отсекатель пламени']], ['both', 28, ['Перегородка печи', 'Боковина жаровни задняя', 'Боковина печи задняя', 'Дверца топки']]]) {
  test(`mangal: «Карты деталей» — режим «${mode}»: ${n} карт по кнопке, у каждой виды 3D, PDF`, async ({page}) => {
    test.slow();
    await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; window.__printN = document.querySelectorAll('#printBox svg').length; }; });
    const r = await openEditor(page, '/editor/mangal/#cards');
    await press(page, `#modeSeg [data-v=${mode}]`);
    await expect(page.locator('#cdStove')).toHaveCount(0);
    await mangalNoCards(page);
    await press(page, '#cdRun');
    await expect(page.locator('#cdBox svg.shs')).toHaveCount(n, {timeout: 180000});
    await expect(page.locator('#cdRun')).toBeDisabled();
    await expect(page.locator('#cdPdf')).toBeEnabled();
    const imgs = await page.evaluate(() => [...document.querySelectorAll('#cdBox svg')].map(s => s.querySelectorAll('image').length));
    expect(Math.min(...imgs)).toBeGreaterThanOrEqual(5);   // 4 вида, швы и соседи, где на мангале (у части — без швов 5)
    const txt = await page.locator('#cdBox').evaluate(e => e.textContent);
    ids.forEach(t => expect(txt).toContain(t));
    expect(txt).not.toContain('пока не готов');
    await page.locator('#cdPdf').click();
    expect(await page.evaluate(() => [window.__printed, window.__printN])).toEqual([1, n]);
    expect(r.errors).toEqual([]);
    expect(r.external).toEqual([]);
  });
}

test('mangal: «Карты деталей» на телефоне без горизонтальной прокрутки', async ({page}) => {
  test.slow();
  await openEditor(page, '/editor/mangal/#cards');
  await mangalCards(page);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
});

// ---------- мангал: «Подготовить отдельно» — металл без DXF под таблицами «С листа» и «Гильотина» (#107) ----------

const prepBlock = (page, box) => page.locator(`#${box} .prep`);
const prepNames = (page, box) => page.locator(`#${box} .prep tbody tr td:first-child`).allInnerTexts();
// Крыша — те же четыре строки с галочкой «Крыша от дождя» и без неё
const ROOF_ROWS = [/^Трубка Ø26×3/, /^Арматура Ø16, передние стойки/, /^Арматура Ø16, задние стойки/, /^Лист от дождя — профлист/];

test('mangal: Подготовить отдельно — блок под таблицами «С листа» и «Гильотина», без DXF, крыша всегда', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const b = prepBlock(page, 'nestBox');
  await expect(b).toHaveCount(1);
  await expect(b.locator('h4')).toHaveText('Подготовить отдельно');
  await expect(b).toContainText('Уголки, трубы, арматура, профлист: на схеме их нет, режутся и готовятся отдельно');
  await expect(b).toContainText('Покупное (колёса, крепёж) — во вкладке «Что купить»');
  await expect(b.locator('thead th')).toHaveText(['Деталь', 'Эскиз', 'Кол-во', 'Размер, мм', 'Как делать']);   // #117
  await expect(b.locator('button:not(.wh), [data-act]')).toHaveCount(0);   // кнопки DXF нет; миниатюры «где стоит» (#118) — .wh
  // блок ниже последней таблицы листа
  const [pt, tbot] = await page.evaluate(() => [document.querySelector('#nestBox .prep').getBoundingClientRect().top,
    [...document.querySelectorAll('#nestBox .ntbl:not(.ptbl)')].pop().getBoundingClientRect().bottom]);
  expect(pt).toBeGreaterThan(tbot - 1);
  let names = await prepNames(page, 'nestBox');
  for (const re of ROOF_ROWS) expect(names.filter(n => re.test(n)), String(re)).toHaveLength(1);   // «Крыша от дождя» снята
  expect(names.join('\n')).not.toMatch(/^(Колосник мангала|Пластины ручки|Боковина|Дно жаровни|Колесо|Болт)/m);
  expect(names.join('\n')).toMatch(/^Колосник 1 и Колосник 2 — перфолист/m);   // #117: перфолист с металлобазы
  await press(page, '#cRain');   // крыша не лазерная: лист не пересчитывается, блок тот же
  await settle(page);
  await expect(page.locator('#nestRun')).toBeDisabled();
  expect(await prepNames(page, 'nestBox')).toEqual(names);   // галочка состав не меняет
  // «Гильотина»: тот же блок
  await openSub(page, 'gil');
  await gilCut(page);
  await expect(prepBlock(page, 'gilBox')).toHaveCount(1);
  expect(await prepNames(page, 'gilBox')).toEqual(names);
  await expect(prepBlock(page, 'gilBox').locator('button:not(.wh), [data-act]')).toHaveCount(0);
  // печь: профтруба, заслонка, шибер; жаровни нет
  await press(page, '#modeSeg [data-v=stove]');
  await gilCut(page);
  names = await prepNames(page, 'gilBox');
  expect(names.join('\n')).toMatch(/Труба — профтруба/);
  expect(names.join('\n')).toMatch(/Направляющая шибера/);
  expect(names.join('\n')).not.toMatch(/Решётка в жаровне/);
  for (const re of ROOF_ROWS) expect(names.filter(n => re.test(n)), String(re)).toHaveLength(1);
  expect(r.errors).toEqual([]);
});

test('mangal: Подготовить отдельно — на телефоне листается внутри своей таблицы, страница не растягивается', async ({page}) => {
  test.slow();
  await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  for (const v of ['list', 'gil']) {
    await openSub(page, v);
    if (v === 'gil') await gilCut(page);
    const tb = page.locator(`#${v === 'gil' ? 'gilBox' : 'nestBox'} .prep .tbl`);
    await expect(tb).toBeVisible();
    const [cw, bw, sw, iw] = await tb.evaluate(e => [e.getBoundingClientRect().width, document.body.clientWidth, document.documentElement.scrollWidth, window.innerWidth]);
    expect(cw, v).toBeLessThanOrEqual(bw);
    expect(sw, v).toBeLessThanOrEqual(iw);
    // #117: картинки на месте — в таблице, которая листается сама
    const box = v === 'gil' ? 'gilBox' : 'nestBox';
    expect(await page.locator(`#${box} .prep svg.pic`).count(), v).toBe(await page.locator(`#${box} .prep tbody tr`).count());
    await expect(page.locator(`#${box} .prep svg.pic`).first()).toBeVisible();
  }
});

// ---------- #117: «Подготовить отдельно» — объёмные картинки деталей, «Эскиз» в одну вертикаль с таблицей листа ----------

test('mangal: Подготовить отдельно — у каждой строки объёмная картинка с подписью размера; мангал, печь, «оба»', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  for (const mode of ['grill', 'stove', 'both']) {
    await press(page, `#modeSeg [data-v=${mode}]`);
    await settle(page);
    await mangalCut(page);
    const n = await page.locator('#nestBox .prep tbody tr').count();
    expect(n, mode).toBeGreaterThan(5);
    await expect(page.locator('#nestBox .prep tbody tr td.pk svg.pic'), mode).toHaveCount(n);
    await expect(page.locator('#nestBox .prep tbody tr td.pk small.piccap'), mode).toHaveCount(n);
    const bb = await page.locator('#nestBox .prep svg.pic').first().boundingBox();
    expect(Math.round(bb.width), mode).toBe(110);
    expect(Math.round(bb.height), mode).toBe(70);
    const labels = await page.locator('#nestBox .prep svg.pic').evaluateAll(a => a.map(e => e.getAttribute('aria-label')));
    // уголки — как стоят на изделии; в печи нет уголков жаровни, в мангале — 40×40
    if (mode !== 'stove') expect(labels.find(l => /^Уголок 30×30×3/.test(l)), mode).toMatch(/полка снизу/);
    if (mode !== 'grill') expect(labels.find(l => /^Уголок 40×40×4/.test(l)), mode).toMatch(/полка снизу/);
    if (mode === 'stove') expect(labels.join('|')).not.toMatch(/Уголок 30×30/);
    if (mode === 'grill') {
      expect(labels.join('|')).not.toMatch(/Уголок 40×40/);
      expect(labels.find(l => /^Уголок 30×30×4/.test(l))).toMatch(/полка сверху/);
      await expect(page.locator('#nestBox .prep tbody tr', {hasText: 'Уголок 30×30×4'}).locator('small.piccap')).toHaveText(/^30×30×4 · L \d+$/);
    }
  }
  expect(r.errors).toEqual([]);
});

test('mangal: Подготовить отдельно — «Эскиз» в одну вертикаль с «Эскизом» таблицы листа (±2 px), «С листа» и «Гильотина»', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop');
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  const dx = box => page.evaluate(b => {
    const T = [...document.querySelectorAll(`#${b} table.ntbl:not(.ptbl):not(.otbl)`)].pop();
    return document.querySelector(`#${b} .ptbl thead th:nth-child(2)`).getBoundingClientRect().left - T.querySelector('thead th:nth-child(3)').getBoundingClientRect().left;
  }, box);
  for (const mode of ['grill', 'stove']) {
    await press(page, `#modeSeg [data-v=${mode}]`);
    await settle(page);
    await openSub(page, 'list');
    await mangalCut(page);
    expect(Math.abs(await dx('nestBox')), mode + ' С листа').toBeLessThanOrEqual(2);
    await openSub(page, 'gil');
    await gilCut(page);
    expect(Math.abs(await dx('gilBox')), mode + ' Гильотина').toBeLessThanOrEqual(2);
  }
  expect(r.errors).toEqual([]);
});

// ---------- #118: «Где стоит» — миниатюра изделия с деталью оранжевым в «Подготовить отдельно» и «Не рубится» ----------

// все миниатюры блока нарисованы (картинка по одной за шаг, после «Рассчитать»)
const whereDone = (page, sel) => page.waitForFunction(s => { const b = [...document.querySelectorAll(s + ' button.wh')]; return b.length > 0 && b.every(x => x.querySelector('img[src]')); }, sel, {timeout: 60000});

test('mangal: Где стоит — до «Рассчитать» миниатюр нет; после — у каждой строки обоих блоков; клик открывает окно, Esc закрывает', async ({page}) => {
  test.setTimeout(240000);   // три режима, в каждом два расчёта и картинки на SwiftShader
  const r = await openEditor(page, '/editor/mangal/#cut');
  await expect(page.locator('button.wh')).toHaveCount(0);
  for (const mode of ['grill', 'stove', 'both']) {
    await press(page, `#modeSeg [data-v=${mode}]`);
    await settle(page);
    await openSub(page, 'list');
    await mangalCut(page);
    const n = await page.locator('#nestBox .prep tbody tr').count();
    await expect(page.locator('#nestBox .prep tbody tr button.wh'), mode).toHaveCount(n);
    await whereDone(page, '#nestBox .prep');
    await openSub(page, 'gil');
    await gilCut(page);
    await expect(page.locator('#gilBox .prep tbody tr button.wh'), mode).toHaveCount(await page.locator('#gilBox .prep tbody tr').count());
    const off = await page.locator('#gilBox .otbl tbody tr').count();
    if (off) await expect(page.locator('#gilBox .otbl tbody tr button.wh'), mode).toHaveCount(off);
    await whereDone(page, '#gilBox');
  }
  // окно: большая картинка и название детали; крестик, Esc и клик мимо закрывают; в «С листа» таблицу листа миниатюры не трогают
  await openSub(page, 'list');
  const first = page.locator('#nestBox .prep tbody tr').first();
  const name = (await first.locator('td:first-child > div > :first-child, td:first-child').first().innerText()).trim();
  const dlg = page.locator('dialog.wdlg');
  await first.locator('button.wh').click();
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.wimg img')).toBeVisible();
  await expect(dlg.locator('.whead b')).toContainText(name.slice(0, 12));
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await first.locator('button.wh').click();
  await dlg.locator('.wx').click();
  await expect(dlg).toBeHidden();
  await first.locator('button.wh').click();
  await expect(dlg.locator('.wimg img')).toBeVisible();
  await page.mouse.click(5, 5);   // мимо окна — по затемнению
  await expect(dlg).toBeHidden();
  await expect(page.locator('#nestBox .ntbl:not(.ptbl):not(.otbl) button.wh')).toHaveCount(0);   // таблицу листа не трогаем
  expect(r.errors).toEqual([]);
});

test('mangal: Где стоит — на 390 страница не едет вбок, окно во всю ширину; на десктопе «Эскиз» остаётся в одной вертикали с таблицей листа (±2 px)', async ({page}, info) => {
  test.slow();
  await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  await whereDone(page, '#nestBox .prep');
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
  if (info.project.name === 'desktop') {
    const dx = await page.evaluate(() => {
      const T = [...document.querySelectorAll('#nestBox table.ntbl:not(.ptbl):not(.otbl)')].pop();
      return document.querySelector('#nestBox .ptbl thead th:nth-child(2)').getBoundingClientRect().left - T.querySelector('thead th:nth-child(3)').getBoundingClientRect().left;
    });
    expect(Math.abs(dx)).toBeLessThanOrEqual(2);
  } else {
    await page.locator('#nestBox .prep button.wh').first().click();
    const bw = await page.locator('dialog.wdlg').evaluate(e => [e.getBoundingClientRect().width, window.innerWidth]);
    expect(bw[0]).toBeGreaterThanOrEqual(bw[1] - 1);
  }
});

test('mangal: «Решётка в жаровне», «2 решётки сверху», «Уголки в жаровне» — подписи показа, состав не меняют; решёток нет ни в блоке, ни в «Что купить»', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  for (const [id, kitTxt] of [['cGAng', 'показ на модели · в комплекте всегда'], ['cGrillGrate', 'только показ на модели · не делаем и не покупаем'],
    ['cGrates2', 'только показ на модели · не делаем и не покупаем']]) {
    const kit = page.locator(`label:has(#${id}) small.kit`);
    await expect(kit, id).toHaveText(kitTxt);
    expect(await kit.evaluate(e => getComputedStyle(e).display), id).toBe('block');
  }
  const buy = await page.locator('#tab-buy li').allTextContents();
  expect(buy.filter(s => /решётк/i.test(s) && !/колосников/i.test(s))).toEqual([]);   // колосниковая решётка (перфолист) — металл, остаётся
  await mangalCut(page);
  const names = await prepNames(page, 'nestBox');
  for (const id of ['cGAng', 'cGrillGrate', 'cGrates2']) await press(page, '#' + id);
  await settle(page);
  await expect(page.locator('#nestRun')).toBeDisabled();   // раскрой не устарел
  expect(await prepNames(page, 'nestBox')).toEqual(names);
  expect(names.join('\n')).toMatch(/^Уголок 30×30×3 в жаровне/m);
  expect(names.join('\n')).not.toMatch(/Решётка/);
  expect(r.errors).toEqual([]);
});
