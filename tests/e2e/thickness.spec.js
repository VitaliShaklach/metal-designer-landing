// Толщина кнопками и галочка «Глубокие прорези»: цифры и модель пересчитываются, ошибок нет
const {test, expect} = require('@playwright/test');

function watch(page) {
  const w = {pageErrors: [], errors: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  return w;
}

// ждём кадр, в котором страница перерисовалась
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const kg = async page => +(await page.locator('#lstats').innerText()).match(/≈ (\d+) кг/)[1];

test('thickness: по умолчанию нажата «4 мм»; «3 мм» — масса падает, на панели «сталь 3 мм»', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  const btn = v => page.locator('#sT button', {hasText: `${v} мм`});
  await expect(page.locator('#sT button')).toHaveText(['2 мм', '3 мм', '4 мм', '5 мм', '6 мм']);
  await expect(btn(4)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lstats')).toContainText('сталь 4 мм');
  const kg4 = await kg(page);
  await btn(3).click();
  await frame(page);
  await expect(btn(3)).toHaveAttribute('aria-pressed', 'true');
  await expect(btn(4)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lstats')).toContainText('сталь 3 мм');
  expect(await kg(page)).toBeLessThan(kg4);
  expect(await page.evaluate(() => [...new Set(laserList().map(p => p.mm))])).toEqual([3]);   // все детали — один лист
  await btn(6).click();
  await frame(page);
  expect(await kg(page)).toBeGreaterThan(kg4);
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('deep: снять галочку — глубоких прорезей на модели нет, цифры пересчитаны', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  const deep = page.locator('#cDeep');
  await expect(deep).toBeChecked();
  // вершин в контуре передней боковины на модели: глубокие прорези добавляют их
  const sidePts = () => page.evaluate(() => grillWallShape(false).getPoints().length);
  const cut = () => page.evaluate(() => laserList().find(p => p.file === 'grill_side_front').cutMm);
  const [pts1, cut1] = [await sidePts(), await cut()];
  await deep.uncheck();
  await frame(page);
  expect(await page.evaluate(() => S.deep)).toBe(false);
  expect(await sidePts()).toBeLessThan(pts1);
  expect(await cut()).toBeLessThan(cut1);
  await deep.check();
  await frame(page);
  expect(await cut()).toBe(cut1);
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('layout: кнопки толщины и галочка на первом экране телефона, над кнопкой внизу, без прокрутки вбок', async ({page, isMobile}) => {
  test.skip(!isMobile, 'только телефон');
  await page.goto('/');
  const m = await page.evaluate(() => ({
    bottom: document.querySelector('.metal').getBoundingClientRect().bottom,
    bar: document.querySelector('.cta-bar').getBoundingClientRect().top,
    stage: document.getElementById('stage').getBoundingClientRect().height,
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight,
  }));
  expect(m.bottom).toBeLessThanOrEqual(m.bar);
  expect(m.stage).toBeLessThanOrEqual(m.innerH * .55);
  expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
});
