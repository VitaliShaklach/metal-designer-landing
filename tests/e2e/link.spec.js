// Ссылка с размерами: адрес выставляет ползунки, толщину и галочку; любое изменение пишется в адрес
const {test, expect} = require('@playwright/test');

function watch(page) {
  const w = {pageErrors: [], errors: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  return w;
}

// ждём кадр, в котором страница перерисовалась
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
// адрес пишется не сразу, а после паузы — ждём, пока он станет нужным
const hashIs = (page, h) => expect.poll(() => page.evaluate(() => location.hash)).toBe(h);

test('link: ссылка выставляет ползунки, толщину и галочку', async ({page}) => {
  const w = watch(page);
  await page.goto('/#len=600&wid=280&top=900&t=4&deep=0');
  await expect(page.locator('#sLen')).toHaveValue('600');
  await expect(page.locator('#sWid')).toHaveValue('280');
  await expect(page.locator('#sTop')).toHaveValue('900');
  await expect(page.locator('#oLen')).toHaveText('600 мм');
  await expect(page.locator('#oWid')).toHaveText('280 мм');
  await expect(page.locator('#oTop')).toHaveText('900 мм');
  await expect(page.locator('#sT button', {hasText: '4 мм'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sT button', {hasText: '5 мм'})).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#cDeep')).not.toBeChecked();
  await expect(page.locator('#lstats')).toContainText('600 × 280');
  await expect(page.locator('#lstats')).toContainText('верх 900');
  await expect(page.locator('#lstats')).toContainText('сталь 4 мм');
  expect(await page.evaluate(() => S.wheels)).toBe(false);                 // ширина меньше 300 мм — без колёс
  await hashIs(page, '#len=600&wid=280&top=900&t=4&deep=0');
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('write: ползунок, толщина и галочка сразу меняют адрес, без новых записей в истории', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await hashIs(page, '#len=800&wid=420&top=970&t=5&deep=1');
  const steps = await page.evaluate(() => history.length);
  await page.locator('#sLen').fill('1200');
  await hashIs(page, '#len=1200&wid=420&top=970&t=5&deep=1');
  await page.locator('#sT button', {hasText: '3 мм'}).click();
  await hashIs(page, '#len=1200&wid=420&top=970&t=3&deep=1');
  await page.locator('#cDeep').uncheck();
  await hashIs(page, '#len=1200&wid=420&top=970&t=3&deep=0');
  expect(await page.evaluate(() => history.length)).toBe(steps);
  // перезагрузка открывает тот же мангал
  await page.reload();
  await expect(page.locator('#sLen')).toHaveValue('1200');
  await expect(page.locator('#sT button', {hasText: '3 мм'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#cDeep')).not.toBeChecked();
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

for (const bad of ['#len=abc', '#wid=99999', '#t=7', '#len=1000&wid=500&top=900&t=4']) {
  test(`badLink: ${bad} — пример по умолчанию, ошибок нет`, async ({page}) => {
    const w = watch(page);
    await page.goto('/' + bad);
    await expect(page.locator('#sLen')).toHaveValue('800');
    await expect(page.locator('#sWid')).toHaveValue('420');
    await expect(page.locator('#sTop')).toHaveValue('970');
    await expect(page.locator('#sT button', {hasText: '5 мм'})).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cDeep')).toBeChecked();
    await expect(page.locator('#lstats')).toContainText('800 × 420');
    await hashIs(page, '#len=800&wid=420&top=970&t=5&deep=1');
    expect(w.pageErrors).toEqual([]);
    expect(w.errors).toEqual([]);
  });
}

test('sameTab: новая ссылка в открытой вкладке — модель, ползунки и цифры по ней', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await page.evaluate(() => { location.hash = '#len=1000&wid=500&top=900&t=4&deep=0'; });
  await expect(page.locator('#sLen')).toHaveValue('1000');
  await expect(page.locator('#oWid')).toHaveText('500 мм');
  await expect(page.locator('#sT button', {hasText: '4 мм'})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#cDeep')).not.toBeChecked();
  await expect(page.locator('#lstats')).toContainText('1000 × 500');
  // битая ссылка в той же вкладке — пример по умолчанию, адрес исправлен
  await page.evaluate(() => { location.hash = '#t=7'; });
  await expect(page.locator('#sLen')).toHaveValue('800');
  await expect(page.locator('#lstats')).toContainText('800 × 420');
  await hashIs(page, '#len=800&wid=420&top=970&t=5&deep=1');
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('drag: пока тянут ползунок, адрес не переписывается на каждом кадре (Safari: не больше 100 раз за 10 с)', async ({page}) => {
  const w = watch(page);
  await page.addInitScript(() => {
    const replace = history.replaceState.bind(history);
    window.replaceCalls = 0;
    history.replaceState = (...a) => { window.replaceCalls++; return replace(...a); };
  });
  await page.goto('/');
  await hashIs(page, '#len=800&wid=420&top=970&t=5&deep=1');
  const before = await page.evaluate(() => replaceCalls);
  // 9 кадров перетаскивания подряд: каждый кадр — renderAll() с новой длиной
  const during = await page.evaluate(() => {
    for (let v = 400; v <= 1200; v += 100) { state.len = v; renderAll(); }
    return replaceCalls;
  });
  expect(during - before).toBe(0);
  await hashIs(page, '#len=1200&wid=420&top=970&t=5&deep=1');
  expect(await page.evaluate(() => replaceCalls) - before).toBe(1);
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});
