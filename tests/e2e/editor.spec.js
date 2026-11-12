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
  expect(d.suggestedFilename()).toMatch(/\.dxf$/);
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
  expect(await tabs.evaluateAll(t => t.map(b => b.dataset.tab))).toEqual(['dims', 'mass', 'cut', 'buy', 'notes']);
  expect(await tabs.locator('b').allTextContents()).toEqual(['Размеры', 'Раскрой и масса', 'Лазер · DXF', 'Что купить', 'Заметки']);
  expect(await tabs.locator('small').allTextContents()).toEqual(
    ['какие показать на модели', 'детали, вес, металл', 'лист, заготовки, гильотина', 'покупное со ссылками', 'как устроено']);
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
    for (const t of ['dims', 'mass', 'cut', 'buy', 'notes']) {
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

test('lynx: DXF и PDF скачиваются', async ({page}) => {
  test.setTimeout(420000);   // раскрой рыси считается минутами
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await page.locator('[role=tab][data-tab=nest]').click();
  const [d1] = await Promise.all([page.waitForEvent('download', {timeout: 400000}), page.locator('#bDxfNest').click()]);
  expect(d1.suggestedFilename()).toMatch(/\.dxf$/);
  await page.locator('[role=tab][data-tab=sheets]').click();
  const [d2] = await Promise.all([page.waitForEvent('download'), page.locator('#bDxfParts').click()]);
  expect(d2.suggestedFilename()).toMatch(/\.dxf$/);
  // PDF — окно печати браузера: кнопка вызывает window.print, скачивания файла нет
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.locator('#shPdf').click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBeGreaterThan(0);
});

test('lynx: на телефоне без горизонтальной прокрутки', async ({page}, info) => {
  test.skip(info.project.name !== 'phone');
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
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

// Раскрой посчитан: лист и таблица на месте, «Рассчитать» неактивна, архив можно скачать
async function mangalCut(page) {
  await page.locator('#nestRun').click();
  await expect(page.locator('#nestBox svg').first()).toBeVisible();
  await expect(page.locator('#nestBox .ntbl').first()).toBeVisible();
  await expect(page.locator('#nestRun')).toBeDisabled();
  await expect(page.locator('#dxfAll')).toBeEnabled();
}
// Результата нет: листа нет, «Рассчитать» снова активна, скачивать нечего
async function mangalNoCut(page) {
  await expect(page.locator('#nestRun')).toBeEnabled();
  await expect(page.locator('#nestRun')).toHaveText('Рассчитать');
  await expect(page.locator('#nestBox svg')).toHaveCount(0);
  await expect(page.locator('#dxfAll')).toBeDisabled();
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

// #74: колосник по умолчанию не на листе, и у зашедшего раньше (старое md-ncgr=true) тоже; строка и DXF в таблице остаются
test('mangal: колосник по умолчанию не на листе, строка и DXF в таблице, галочка запоминается', async ({page}) => {
  test.slow();
  await page.addInitScript(() => localStorage.setItem('md-ncgr', 'true'));
  const r = await openEditor(page, '/editor/mangal/#cut');
  await expect(page.locator('#nCgrBox')).toBeVisible();
  await expect(page.locator('#nCgr')).not.toBeChecked();
  await mangalCut(page);
  const grate = page.locator('#nestBox .ntbl tr', {hasText: 'Колосник мангала'});
  await expect(grate).toHaveCount(2);
  await expect(grate.locator('button[data-act=part]')).toHaveCount(2);
  await expect(grate.first()).toContainText('не на листе');
  await expect(page.locator('#nestBox svg title', {hasText: 'Колосник мангала'})).toHaveCount(0);
  await page.locator('#nCgr').check();
  await mangalNoCut(page);
  await mangalCut(page);
  await expect(page.locator('#nestBox svg title', {hasText: 'Колосник мангала'})).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#nCgr')).toBeChecked();
  expect(r.errors).toEqual([]);
});

// Каждая правка — новый расчёт (~3 с на SwiftShader), поэтому правки — в трёх тестах
test('mangal: правки убирают раскрой — скобы задвижек, колосник на листе, лист', async ({page}) => {
  test.slow();
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  await press(page, '#cHook');   // зовёт только build3D, а скобы уходят с листа
  await mangalNoCut(page);
  await mangalCut(page);
  await page.locator('#nCgr').check();
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
  // лист — над вариантами, один; зазор и колосник — в «С листа»; простыни текста и старых галочек нет
  await expect(page.locator('#nSheet')).toHaveCount(1);
  expect(await page.locator('#nSheet').evaluate(e => !e.closest('.subpane'))).toBe(true);
  expect(await page.locator('#nGap').evaluate(e => e.closest('.subpane').id)).toBe('sub-list');
  await expect(page.locator('#nCgrBox')).toContainText('Колосник на листе');
  await expect(page.locator('#nGil, #nEdge, #nGilReset')).toHaveCount(0);
  const hint = page.locator('#sub-list .vhint');
  await expect(hint).toBeVisible();
  expect((await hint.textContent()).length).toBeLessThanOrEqual(80);
  expect(await page.locator('#tab-cut .tabnote:not(.vhint):not(.stub)').count()).toBe(0);
  // до «Рассчитать» схемы нет; заглушки вариантов — строкой
  await expect(page.locator('#nestBox svg')).toHaveCount(0);
  for (const v of ['zag', 'gil']) {
    await openSub(page, v);
    await expect(page.locator(`#sub-${v} .stub`)).toBeVisible();
  }
  await openSub(page, 'list');
  expect(r.errors).toEqual([]);
});

test('mangal: «С листа» — схема, таблица, итоги и архив лазерщика', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await mangalCut(page);
  const tot = page.locator('#nestBox .ntot').first();
  for (const t of ['Рез', 'Врезки', 'Лист', 'Заполнение']) await expect(tot).toContainText(t);
  await expect(tot).toContainText('1 лист 1250 × 2500');
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#dxfAll').click()]);
  expect(d.suggestedFilename()).toBe('mangal_800x420x200_5mm_laser-list.zip');
  expect(r.errors).toEqual([]);
});

test('mangal: печь — архив «С листа» с толщинами через «-»', async ({page}) => {
  const r = await openEditor(page, '/editor/mangal/#cut');
  await press(page, '#modeSeg [data-v=stove]');
  await mangalCut(page);
  await expect(page.locator('#nestBox .ntot')).toHaveCount(3);
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#dxfAll').click()]);
  expect(d.suggestedFilename()).toBe('pech_600x440x500_5-3-15mm_laser-list.zip');
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
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw, v).toBeLessThanOrEqual(iw);
  }
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

test('lynx: во время раскроя виден индикатор', async ({page}) => {
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await expect(page.locator('#nestWait')).toBeHidden();
  // вкладка считает прямо в обработчике и не даёт обычному клику вернуться — нажимаем из самой страницы
  await page.evaluate(() => setTimeout(() => document.querySelector('[role=tab][data-tab=nest]').click(), 0));
  await expect(page.locator('#nestWait')).toBeVisible({timeout: 5000});
  await expect(page.locator('#nestWait')).toContainText('Считаю раскрой');
  await expect(page.locator('#nestWait .nestCnt')).toContainText(/из \d+/, {timeout: 60000});
  // кольцо крутится, пока идёт расчёт (CSS-анимация): поворот в замерах разный
  const y = () => page.locator('#nestWait .nestStar b').evaluate(e => getComputedStyle(e).transform);
  const seen = new Set();
  for (let i = 0; i < 5; i++) { seen.add(await y()); await page.waitForTimeout(300); }
  expect(seen.size).toBeGreaterThan(1);
});

test('lynx: индикатор виден в «Чертежах» и «Картах деталей»', async ({page}) => {
  test.setTimeout(420000);
  await openEditor(page, '/editor/lynx/');
  await lynxReady(page);
  await page.evaluate(() => setTimeout(() => document.querySelector('[role=tab][data-tab=cards]').click(), 0));
  await expect(page.locator('#cdWait')).toBeVisible({timeout: 5000});
  await expect(page.locator('#cdWait')).toContainText('карты');
  await expect(page.locator('#cdCnt')).toContainText(/из \d+/, {timeout: 60000});   // счётчик идёт
  await expect(page.locator('#cdWait')).toBeHidden({timeout: 120000});
  await expect(page.locator('#cards figure').first()).toBeVisible();
  await page.evaluate(() => setTimeout(() => document.querySelector('[role=tab][data-tab=sheets]').click(), 0));
  const w = page.locator('#tab-sheets .nestwait');
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

test('home: призыв писать Виталию', async ({page}) => {
  await openEditor(page, '/editor/');
  await expect(page.getByText('Пришлите фото и пожелания — спроектирую ваше изделие бесплатно')).toBeVisible();
  const tg = page.locator('a[href="https://t.me/SHVA_1984"]').first();
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
