// Редактор: главная (editor/) и общее для всех изделий. Тесты те же, что были в editor.spec.js (разбито, #132); общие помощники — в editor-helpers.js
const {test, expect} = require('@playwright/test');
const {openEditor} = require('./editor-helpers');

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
