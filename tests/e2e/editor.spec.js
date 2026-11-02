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
