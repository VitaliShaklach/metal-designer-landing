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
  await expect(back).toContainText('← Редактор');
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
  await expect(back).toContainText('← Редактор');
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
  await expect.poll(() => page.evaluate(() => window.__nestSeen.join())).toMatch(/^true,false/);
  await expect(page.locator('#nestWait')).toBeHidden();
  await expect(page.locator('#nestBox svg').first()).toBeVisible();
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
  // символ меняется, пока идёт расчёт (CSS-анимация): сдвиг колонки в замерах разный
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
