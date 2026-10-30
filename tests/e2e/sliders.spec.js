// Ползунки длины, ширины, высоты: цифры пересчитываются, модель остаётся в кадре, крайние значения без ошибок
const {test, expect} = require('@playwright/test');

function watch(page) {
  const w = {pageErrors: [], errors: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  return w;
}

// ползунок → значение; ждём кадр, в котором страница перерисовалась
async function slide(page, id, v) {
  await page.locator(id).fill(String(v));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const kg = async page => +(await page.locator('#lstats').innerText()).match(/≈ (\d+) кг/)[1];

// все 8 углов рамки модели в проекции камеры — внутри кадра
const inFrame = page => page.evaluate(() => {
  const box = new THREE.Box3();
  group.traverseVisible(o => { if (o.isMesh && !o.userData.dim) box.expandByObject(o); });
  camera.updateMatrixWorld();
  const out = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) out.push([p.x.toFixed(2), p.y.toFixed(2)]);
  }
  return out;
});

test('sliders: длина 1200 — масса растёт, подписи и панель в мм, модель в кадре', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await expect(page.locator('#oLen')).toHaveText('800 мм');
  const kg0 = await kg(page);
  await slide(page, '#sLen', 1200);
  await expect(page.locator('#oLen')).toHaveText('1200 мм');
  await expect(page.locator('#lstats')).toContainText('1200 × 420');
  expect(await kg(page)).toBeGreaterThan(kg0);
  expect(await page.evaluate(() => [L1, statsData().len])).toEqual([120, 1200]);
  expect(await inFrame(page)).toEqual([]);
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('sliders: повернул модель — ползунок не разворачивает её обратно', async ({page}) => {
  await page.goto('/');
  const dir = () => page.evaluate(() => camera.position.clone().sub(controls.target).normalize().toArray().map(v => +v.toFixed(3)));
  await page.evaluate(() => {   // поворот как мышью: камера по кругу вокруг цели
    const v = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), 1);
    camera.position.copy(controls.target).add(v);
    controls.update();
  });
  const before = await dir();
  await slide(page, '#sLen', 500);
  expect(await dir()).toEqual(before);
  expect(await inFrame(page)).toEqual([]);
});

test('extremes: крайние значения всех ползунков — без ошибок, модель в кадре, размеры рисуются', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  for (const [id, v] of [['#sLen', 400], ['#sWid', 250], ['#sTop', 800], ['#sLen', 1200], ['#sWid', 500], ['#sTop', 1100]]) {
    await slide(page, id, v);
    expect(await inFrame(page), `${id} = ${v}`).toEqual([]);
    // все размеры на модели разом: функции рисования не падают на крайних размерах
    const err = await page.evaluate(() => {
      try { S.dims = new Set(dimVisible().map(r => r.id)); build3D(); return null; } catch (e) { return e.message; }
      finally { S.dims = new Set(); build3D(); }
    });
    expect(err, `${id} = ${v}`).toBeNull();
  }
  await expect(page.locator('#lstats')).toContainText('1200 × 500');
  await expect(page.locator('#lstats')).toContainText('верх 1100');
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('wheels: ширина 280 — без колёс, ножки на пятках', async ({page}) => {
  await page.goto('/');
  await slide(page, '#sWid', 280);
  expect(await page.evaluate(() => statsData().wheels)).toBe(false);
  const shown = await page.evaluate(() =>
    [...new Set(group.children.filter(o => o.visible && !o.userData.dim).map(o => o.userData.part))]);
  expect(shown).toContain('feet');
  expect(shown).not.toContain('pads');
});

test('layout: ползунки на первом экране телефона, над кнопкой внизу', async ({page, isMobile}) => {
  test.skip(!isMobile, 'только телефон');
  await page.goto('/');
  const m = await page.evaluate(() => ({
    bottom: document.getElementById('sTop').getBoundingClientRect().bottom,
    bar: document.querySelector('.cta-bar').getBoundingClientRect().top,
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
  }));
  expect(m.bottom).toBeLessThanOrEqual(m.bar);
  expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
});
