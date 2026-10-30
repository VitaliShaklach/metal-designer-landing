// Управление как в C:\dev: колесо — зум, клик — деталь, двойной клик — вся модель, имя при наведении, «? Управление»
const {test, expect} = require('@playwright/test');

function watch(page) {
  const w = {pageErrors: [], errors: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  return w;
}

const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// точка на корпусе (центр дна жаровни на экране) и пустой угол #stage в координатах страницы.
// Не центр #stage: там пустота между ножками под жаровней
async function spots(page) {
  const b = await page.locator('#stage').boundingBox();
  const p = await page.evaluate(() => {
    const o = group.children.find(o => o.userData.part === 'gBot' && o.visible);
    const v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
    return {x: (v.x + 1) / 2, y: (1 - v.y) / 2};
  });
  return {center: {x: b.x + p.x * b.width, y: b.y + p.y * b.height}, empty: {x: b.x + 12, y: b.y + 12}};
}

const sel = page => page.evaluate(() => S.sel.el);

test.describe('мышь', () => {
  test.skip(({isMobile}) => isMobile, 'только десктоп');

  test('zoom: колесо над моделью приближает и отдаляет', async ({page}) => {
    await page.goto('/');
    const {center} = await spots(page);
    const dist = () => page.evaluate(() => camera.position.distanceTo(controls.target));
    const d0 = await dist();
    await page.mouse.move(center.x, center.y);
    await page.mouse.wheel(0, -400);
    await frames(page);
    const d1 = await dist();
    expect(d1).toBeLessThan(d0);
    await page.mouse.wheel(0, 800);
    await frames(page);
    expect(await dist()).toBeGreaterThan(d1);
  });

  test('pick: клик по детали — плашка, на модели только она, панель цифр — весь мангал', async ({page}) => {
    const w = watch(page);
    await page.goto('/');
    const stats = await page.locator('#lstats').innerText();
    const {center} = await spots(page);
    await page.mouse.click(center.x, center.y);
    expect(await sel(page)).not.toBeNull();
    const bar = page.locator('#selBar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Показана деталь:');
    const all = await page.evaluate(() => group.children.filter(o => !o.userData.dim).length);
    const shown = await page.evaluate(() => group.children.filter(o => o.visible && !o.userData.dim).length);
    expect(shown).toBeLessThan(all);
    expect(await page.locator('#lstats').innerText()).toBe(stats);
    expect(w.pageErrors).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('reset: двойной клик по пустому и ✕ на плашке — снова вся модель', async ({page}) => {
    await page.goto('/');
    const {center, empty} = await spots(page);
    await page.mouse.click(center.x, center.y);
    expect(await sel(page)).not.toBeNull();
    await page.mouse.dblclick(empty.x, empty.y);
    expect(await sel(page)).toBeNull();
    await expect(page.locator('#selBar')).toBeHidden();

    await page.mouse.click(center.x, center.y);
    await page.locator('#selBar button').click();
    expect(await sel(page)).toBeNull();
    await expect(page.locator('#selBar')).toBeHidden();
  });

  test('dblpart: двойной клик по детали выбирает её, а не сбрасывает', async ({page}) => {
    await page.goto('/');
    const {center} = await spots(page);
    await page.mouse.dblclick(center.x, center.y);
    expect(await sel(page)).not.toBeNull();
    await expect(page.locator('#selBar')).toBeVisible();
  });

  test('hover: имя детали у курсора', async ({page}) => {
    await page.goto('/');
    const {center, empty} = await spots(page);
    await page.mouse.move(center.x, center.y);
    const tag = page.locator('#hovTag');
    await expect(tag).toBeVisible();
    expect((await tag.innerText()).trim()).not.toBe('');
    await page.mouse.move(empty.x, empty.y, {steps: 5});
    await expect(tag).toBeHidden();
  });

  test('help: «? Управление» — текст как в C:\\dev, мышь и телефон', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button', {name: '? Управление'}).click();
    const help = page.locator('#help');
    await expect(help).toBeVisible();
    for (const s of ['Колесо', 'Пробел', 'Клик по детали', 'Один палец', 'Касание детали']) await expect(help).toContainText(s);
    await expect(help).not.toContainText('Настройки');
    await page.locator('#helpClose').click();
    await expect(help).toBeHidden();
  });
});

test('tap: касание детали на телефоне выбирает её', async ({page, isMobile}) => {
  test.skip(!isMobile, 'только телефон');
  await page.goto('/');
  const {center} = await spots(page);
  await page.touchscreen.tap(center.x, center.y);
  expect(await sel(page)).not.toBeNull();
  await expect(page.locator('#selBar')).toBeVisible();
  // плашка и кнопка справки не наезжают друг на друга и не вылезают за модель
  const st = await page.locator('#stage').boundingBox(), bar = await page.locator('#selBar').boundingBox();
  const btn = await page.locator('#helpBtn').boundingBox();
  expect(bar.x + bar.width).toBeLessThanOrEqual(st.x + st.width);
  expect(bar.y >= btn.y + btn.height || bar.y + bar.height <= btn.y).toBe(true);
});
