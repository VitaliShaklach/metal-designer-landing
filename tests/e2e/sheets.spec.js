// Вкладка «Чертежи»: виды модели в PNG, лист «Общий вид» с размерами, спецификация, печать листов А3
const {test, expect} = require('@playwright/test');

function watch(page) {
  const w = {pageErrors: [], errors: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  return w;
}

// ждём кадр, в котором страница перерисовалась
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// ползунок → значение
async function slide(page, id, v) {
  await page.locator(id).fill(String(v));
  await frame(page);
}

// листов по умолчанию: общий вид, 2 листа сборки (7 шагов по 4), детали, спецификация, раскрой
const SHEETS = 6;

async function openSheets(page) {
  await page.locator('#getBtn').click();
  await page.getByRole('tab', {name: 'Чертежи'}).click();
  await expect(page.locator('#tab-sheets')).toBeVisible();
}

test('png: вид модели — картинка PNG с размером в мм бумаги', async ({page}) => {
  await page.goto('/');
  const v = await page.evaluate(() => { const r = renderView('front', 10); return {url: r.url.slice(0, 22), w: r.wMm, h: r.hMm}; });
  expect(v.url).toBe('data:image/png;base64,');
  expect(v.w).toBeGreaterThan(90);   // 950 мм мангала с ручкой в 1:10
  expect(v.w).toBeLessThan(110);
  expect(v.h).toBeGreaterThan(90);   // верх 970 мм
});

test('scale: toPaper переводит см модели в мм бумаги по масштабу', async ({page}) => {
  await page.goto('/');
  const d = await page.evaluate(() => {
    const r = renderView('front', 10), a = r.toPaper([0, 0, 0]), b = r.toPaper([L1, 0, 0]);
    return {d: Math.hypot(b[0] - a[0], b[1] - a[1]), L1};
  });
  expect(Math.abs(d.d - d.L1)).toBeLessThan(0.01);
});

test('restore: после снимка модель на экране та же', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await frame(page);
  const before = await page.locator('#stage canvas').screenshot();
  const left = await page.evaluate(() => {
    renderView('iso', 10, {highlight: new Set(['gBot'])});
    renderView('top', 10, {hide: new Set(['side0'])});
    const all = [];
    scene.traverse(o => all.push(o));
    return {
      edges: all.filter(o => o.isLineSegments && o.userData.shotEdge).length,
      shot: all.filter(o => o.isMesh && o.userData.shot).length,
    };
  });
  expect(left).toEqual({edges: 0, shot: 0});
  await frame(page);
  const after = await page.locator('#stage canvas').screenshot();
  expect(after.equals(before)).toBe(true);
  expect(w.pageErrors).toEqual([]);
});

test('views: на общем виде 4 вида и размеры текущих настроек', async ({page}) => {
  // три смены размера — три пересборки листов по 11 снимков 3D на процессоре (SwiftShader): дольше 30 с
  test.slow();
  const w = watch(page);
  await page.goto('/');
  await openSheets(page);
  const first = page.locator('#sheetBox .shprev').first();
  await expect(first.locator('image')).toHaveCount(4);
  const hrefs = await first.locator('image').evaluateAll(els => els.map(e => e.getAttribute('href').slice(0, 15)));
  expect(hrefs).toEqual(Array(4).fill('data:image/png;'));
  await expect(page.locator('#sheetBox .shprev')).toHaveCount(SHEETS);
  await slide(page, '#sLen', 1000);
  await slide(page, '#sWid', 500);
  await slide(page, '#sTop', 900);
  await expect(first).toContainText('Мангал 1000 × 500 × 900');   // листы перестраиваются сами
  const dims = await first.locator('text').evaluateAll(els => els.map(e => e.textContent));
  for (const v of ['1000', '500', '900']) expect(dims).toContain(v + '*');   // размеры для справок
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

// страница — А3 (@page), лист на ней — 420 × 296 мм: ровно 297 Chrome иногда переносит на пустую страницу
test('print: в печати только листы, каждый А3 420 × 297 мм', async ({page}) => {
  await page.goto('/');
  await openSheets(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#shPdf').click();
  await page.emulateMedia({media: 'print'});
  const r = await page.evaluate(() => {
    const mm = 96 / 25.4;
    const svgs = [...document.querySelectorAll('#printBox svg')].map(s => {
      const b = s.getBoundingClientRect();
      return [Math.round(b.width / mm), Math.round(b.height / mm)];
    });
    const shown = [...document.body.children].filter(e => getComputedStyle(e).display !== 'none')
      .map(e => e.id || e.tagName.toLowerCase() + (e.className ? '.' + e.className : ''));
    const page = [...document.head.querySelectorAll('style')].map(s => s.textContent).join('');
    return {svgs, shown, page};
  });
  expect(r.svgs).toEqual(Array(SHEETS).fill([420, 296]));
  expect(r.shown).toEqual(['printBox']);
  expect(r.page).toContain('A3 landscape');
});

test('layout (phone): превью листов в ширину экрана, страница вбок не едет', async ({page}, info) => {
  test.skip(info.project.name !== 'phone', 'только телефон');
  await page.goto('/');
  await openSheets(page);
  await expect(page.locator('#sheetBox .shprev')).toHaveCount(SHEETS);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const b = await page.locator('#sheetBox svg').first().boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
});

test('noShot: 3D есть, а рендер снимков не создался — надпись вместо видов, листы на месте', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await page.evaluate(() => { shotR = false; });
  await openSheets(page);
  await expect(page.locator('#sheetBox .shprev')).toHaveCount(SHEETS);
  await expect(page.locator('#sheetBox .shprev').first()).toContainText('Общий вид недоступен');
  expect(w.pageErrors).toEqual([]);
});

test('noWebGL: вместо видов надпись, спецификация и раскрой есть', async ({page}) => {
  const w = watch(page);
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/');
  await openSheets(page);
  await expect(page.locator('#sheetBox .shprev')).toHaveCount(SHEETS);
  await expect(page.locator('#sheetBox .shprev').first()).toContainText('Общий вид недоступен без 3D на этом устройстве');
  await expect(page.locator('#sheetBox .shprev').first().locator('image')).toHaveCount(0);
  await expect(page.locator('#sheetBox .shprev', {hasText: 'Спецификация'})).toContainText('Итого металла');
  await expect(page.locator('#sheetBox .shprev').last()).toContainText('Лист 4 мм, 1250 × 2500, № 1 из 1');
  expect(w.pageErrors).toEqual([]);
  expect(w.errors.filter(e => !/WebGLRenderer: Error creating WebGL context/.test(e))).toEqual([]);
});

// Детали модели — как на снимке листов: всё в group, кроме размеров и частей вне S.parts (крыши нет)
test('cover: каждая деталь модели — ровно в одном шаге сборки, на узком мангале без колёс тоже', async ({page}) => {
  await page.goto('/');
  for (const wid of [420, 280]) {
    await slide(page, '#sWid', wid);
    const r = await page.evaluate(() => {
      const ids = new Set(group.children.filter(o => !o.userData.dim && S.parts.has(PDF_PART[o.userData.part])).map(o => o.userData.part));
      const steps = asmSteps();
      return {ids: [...ids], times: [...ids].map(id => steps.filter(s => s.parts.includes(id)).length), wheels: ids.has('wheels'), feet: ids.has('feet')};
    });
    expect(r.ids.length, `ширина ${wid}`).toBeGreaterThan(10);
    expect(r.times, `ширина ${wid}: ${r.ids.join(' ')}`).toEqual(r.ids.map(() => 1));
    expect([r.wheels, r.feet]).toEqual(wid >= 300 ? [true, false] : [false, true]);
  }
});

test('asm: на листах сборки по картинке PNG на шаг, детали шага подписаны', async ({page}) => {
  // общий вид и 7 шагов сборки — 11 снимков 3D на процессоре: рядом с другим тестом не укладывается в 30 с
  test.slow();
  const w = watch(page);
  await page.goto('/');
  await openSheets(page);
  const asm = page.locator('#sheetBox .shprev').filter({hasText: 'Порядок сборки'});
  await expect(asm).toHaveCount(2);
  const imgs = await asm.evaluateAll(fs => fs.map(f => [...f.querySelectorAll('image')].map(i => i.getAttribute('href').slice(0, 15))));
  expect(imgs).toEqual([Array(4).fill('data:image/png;'), Array(3).fill('data:image/png;')]);
  await expect(asm.first()).toContainText('Шаг 1. Дно и боковины');
  await expect(asm.last()).toContainText('Шаг 7. Колосник и решётки — кладутся');
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});
