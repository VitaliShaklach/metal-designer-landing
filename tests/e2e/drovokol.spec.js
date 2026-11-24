// Дровокол (drovokol-q7m4z/): скрытая страница, раскладка под лазер и DXF (#168). Только desktop: телефон 390 — глазами (скриншоты)
const {test, expect} = require('@playwright/test');
const fs = require('fs');
const {openEditor} = require('./editor-helpers');

const URL = '/drovokol-q7m4z/';
// «Рассчитать» во вкладке «Лазер · DXF» и дождаться результата (кнопка не «Считаю…», в коробке что-то есть)
async function calc(page) {
  await page.click('#t-nest');
  await page.click('#nestRun');
  await expect(page.locator('#nestRun')).toHaveText('Рассчитать', {timeout: 120000});
  await expect(page.locator('#nestBox')).not.toBeEmpty();
}
// удалить все строки ручек и добавить одну: тип, профиль, длина
async function oneHandle(page, type, prof, len) {
  while (await page.locator('#hrows .hrow').count()) await page.locator('#hrows .hrow .hDel').first().click();
  await page.click('#hAdd');
  const r = page.locator('#hrows .hrow').first();
  await r.locator('.hType').selectOption(type);
  await r.locator('.hProf').selectOption(String(prof));
  await r.locator('.hLen').selectOption(String(len));
}

test('drovokol: открывается без ошибок и без сторонних запросов', async ({page}) => {
  const r = await openEditor(page, URL);
  await expect(page.locator('.tabbar [role=tab]')).toHaveText([/Заказ/, /Лазер · DXF/, /Что купить/]);
  await expect(page.locator('#asmA svg')).toHaveAttribute('data-name', 'A1');
  await expect(page.locator('#asmB svg')).toHaveAttribute('data-name', 'B1');
  await expect(page.locator('#thumbs [data-thumb]')).toHaveCount(10);
  await expect(page.locator('#hrows .hrow')).toHaveCount(2);
  await expect(page.locator('#oPlates')).toHaveValue('4');
  await expect(page.locator('#bDxf')).toBeDisabled();
  expect(r.external).toEqual([]);
  expect(r.failed).toEqual([]);
  expect(r.errors).toEqual([]);
});

test('drovokol: клик по миниатюре B4 меняет правую картинку, левая — прежняя', async ({page}) => {
  await openEditor(page, URL);
  await page.click('[data-thumb="B4"]');
  await expect(page.locator('#asmB')).toContainText('B4');
  await expect(page.locator('#asmB')).toContainText('175°');
  await expect(page.locator('#asmA svg')).toHaveAttribute('data-name', 'A1');
  await expect(page.locator('[data-thumb="B4"]')).toHaveAttribute('aria-pressed', 'true');
});

test('drovokol: смена профиля в строке ручки меняет картинку её типа', async ({page}) => {
  await openEditor(page, URL);
  await page.locator('#hrows .hrow').nth(1).locator('.hProf').selectOption('3');
  await expect(page.locator('#asmB svg')).toHaveAttribute('data-name', 'B3');
  await page.locator('#hrows .hrow').nth(0).locator('.hN').click();
  await expect(page.locator('#asmA svg')).toHaveAttribute('data-name', 'A1');
});

test('drovokol: «Рассчитать» по умолчанию — лист, DXF с CUT и ENGRAVE', async ({page}) => {
  test.slow();
  const r = await openEditor(page, URL);
  await calc(page);
  await expect(page.locator('#nestBox figure.sheet')).toHaveCount(1);
  await expect(page.locator('#nestBox .stats')).toContainText('П × 4');
  await expect(page.locator('#nestBox .stats')).toContainText('A1-60 × 1');
  await expect(page.locator('#bDxf')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bDxf')]);
  expect(dl.suggestedFilename()).toMatch(/^drovokol-5mm-\d{4}-\d{2}-\d{2}\.dxf$/);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  expect(txt.startsWith('0\r\nSECTION')).toBe(true);
  for (const lay of ['SHEET', 'CUT', 'ENGRAVE']) expect(txt).toContain('\r\n8\r\n' + lay + '\r\n');
  expect(txt).not.toMatch(/NaN|\r\nTEXT\r\n/);
  expect((txt.match(/POLYLINE\r\n8\r\nCUT/g) || []).length).toBe(6);
  expect(r.errors).toEqual([]);
});

test('drovokol: изменение количества пластин убирает результат', async ({page}) => {
  test.slow();
  await openEditor(page, URL);
  await calc(page);
  await expect(page.locator('#nestRun')).toBeDisabled();
  await page.click('#t-order');
  await page.fill('#oPlates', '8');
  await page.click('#t-nest');
  await expect(page.locator('#nestBox')).toBeEmpty();
  await expect(page.locator('#nestRun')).toBeEnabled();
  await expect(page.locator('#nestRun')).toHaveText('Рассчитать');
  await expect(page.locator('#bDxf')).toBeDisabled();
});

/* ---------- крайние случаи (Review Focus 1–4) ---------- */
test('drovokol: все нули → «Нечего резать», DXF неактивна; «Что купить» пусто', async ({page}) => {
  await openEditor(page, URL);
  await page.fill('#oPlates', '0');
  await page.locator('#hrows .hrow').first().locator('.hN').fill('0');
  await page.locator('#hrows .hrow').nth(1).locator('.hN').fill('');
  await page.locator('#hrows .hrow').nth(1).locator('.hN').dispatchEvent('change');
  await expect(page.locator('#hrows .hrow').nth(1).locator('.hN')).toHaveValue('0');
  await calc(page);
  await expect(page.locator('#nestBox')).toContainText('Нечего резать');
  await expect(page.locator('#bDxf')).toBeDisabled();
  await page.click('#t-buy');
  await expect(page.locator('#buyBox')).toContainText('Покупать нечего');
});

test('drovokol: свой лист 500 × 500 + ручка 80 → «не помещается: A3-80», пластины разложены', async ({page}) => {
  test.slow();
  await openEditor(page, URL);
  await page.selectOption('#oSheet', 'own');
  await page.fill('#oSW', '500');
  await page.fill('#oSL', '500');
  await oneHandle(page, 'A', 3, 80);
  await calc(page);
  await expect(page.locator('#nestBox .too')).toContainText('Не помещается');
  await expect(page.locator('#nestBox .too')).toContainText('A3-80');
  await expect(page.locator('#nestBox .stats')).toContainText('П × 4');
  await expect(page.locator('#bDxf')).toBeEnabled();
});

test('drovokol: свой лист с пустой шириной — расчёт без NaN', async ({page}) => {
  test.slow();
  await openEditor(page, URL);
  await page.selectOption('#oSheet', 'own');
  await page.fill('#oSW', '');
  await page.locator('#oSW').dispatchEvent('change');
  await expect(page.locator('#oSW')).toHaveValue('1250');
  await calc(page);
  await expect(page.locator('#nestBox')).not.toContainText('NaN');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bDxf')]);
  expect(fs.readFileSync(await dl.path(), 'utf8')).not.toMatch(/NaN|undefined/);
});

test('drovokol: 200 пластин + 100 ручек — считается с индикатором, изменение заказа прерывает', async ({page}) => {
  test.slow();
  await openEditor(page, URL);
  await page.fill('#oPlates', '200');
  await page.locator('#hrows .hrow').first().locator('.hN').fill('50');
  await page.locator('#hrows .hrow').nth(1).locator('.hN').fill('50');
  await page.click('#t-nest');
  await page.click('#nestRun');
  await expect(page.locator('#nestWait')).toBeVisible();
  await expect(page.locator('#nestRun')).toHaveText('Считаю…');
  await expect(page.locator('#nestCnt')).toContainText('из 300', {timeout: 30000});
  // страница не висит: вкладки переключаются, поле правится — расчёт бросается
  await page.click('#t-order');
  await page.fill('#oPlates', '199');
  await page.click('#t-nest');
  await expect(page.locator('#nestWait')).toBeHidden();
  await expect(page.locator('#nestRun')).toHaveText('Рассчитать');
  await expect(page.locator('#nestBox')).toBeEmpty();
  await expect(page.locator('#bDxf')).toBeDisabled();
});
