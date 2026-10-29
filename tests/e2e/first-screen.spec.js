// Первый экран: 3D-мангал без крыши, панель цифр, телефон, только свой сервер, консоль без ошибок
const {test, expect} = require('@playwright/test');

// ошибки страницы и консоли, адреса запросов — за всё время теста
function watch(page) {
  const w = {errors: [], pageErrors: [], requests: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  page.on('request', r => w.requests.push(r.url()));
  return w;
}

test('loads: 3D-модель и панель цифр по умолчанию', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  expect(await page.evaluate(() => ok)).toBe(true);
  await expect(page.locator('#stage canvas')).toHaveCount(1);
  await expect(page.locator('#no3d')).toBeHidden();
  const kg = await page.evaluate(() => statsData().kg);
  const text = await page.locator('#lstats').innerText();
  for (const s of ['800 × 420', 'верх 970', 'сталь 5 мм', `≈ ${kg} кг`, '15 деталей', '34 / 52', 'DXF готов']) {
    expect(text).toContain(s);
  }
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('model: на 3D нет крыши и трубок под стойки', async ({page}) => {
  await page.goto('/');
  const shown = await page.evaluate(() =>
    [...new Set(group.children.filter(o => o.visible && !o.userData.dim).map(o => o.userData.part))]);
  expect(shown).toContain('gBot');
  expect(shown).toContain('wheels');
  for (const p of ['tubes', 'bars', 'bolts', 'sheet']) expect(shown).not.toContain(p);
});

test('layout: без горизонтальной прокрутки, заголовок в одну строку', async ({page, isMobile}) => {
  await page.goto('/');
  const m = await page.evaluate(() => {
    const st = document.getElementById('stage').getBoundingClientRect();
    const h1 = document.querySelector('h1');
    return {
      stageH: st.height, innerH: innerHeight,
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
      h1Fits: h1.scrollWidth <= h1.clientWidth,
    };
  });
  expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
  expect(m.h1Lines).toBe(1);
  expect(m.h1Fits).toBe(true);
  if (isMobile) expect(m.stageH).toBeLessThanOrEqual(0.55 * m.innerH);
});

test('offline: все запросы — на свой сервер', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(w.requests.length).toBeGreaterThan(0);
  expect(w.requests.filter(u => !u.startsWith('http://localhost:8000/'))).toEqual([]);
});

test('noWebGL: вместо 3D надпись, цифры на месте', async ({page}) => {
  const w = watch(page);
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/');
  expect(await page.evaluate(() => ok)).toBe(false);
  await expect(page.locator('#no3d')).toBeVisible();
  await expect(page.locator('#no3d')).toContainText('3D не открылось');
  await expect(page.locator('#lstats')).toContainText('800 × 420');
  expect(w.pageErrors).toEqual([]);
  // единственная ошибка в консоли — сам three.js сообщает, что WebGL нет
  expect(w.errors.filter(e => !/WebGLRenderer: Error creating WebGL context/.test(e))).toEqual([]);
});
