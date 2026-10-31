// Вкладка «Карты деталей»: карта А4 на каждую деталь цеха — виды с 4 сторон, швы и соседи, где на мангале;
// меняется с размерами, печать А4, строится быстро
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

const CARDS = 15;   // деталей цеха по умолчанию: 8 лазерных и 7 из проката
// карты строятся по одной (страница между шагами отвечает), в Chromium без видеокарты все 15 — несколько секунд
const BUILT = {timeout: 20000};

async function openCards(page) {
  await page.locator('#getBtn').click();
  await page.getByRole('tab', {name: 'Карты деталей'}).click();
  await expect(page.locator('#tab-cards')).toBeVisible();
}

test('preview: 15 карт, на каждой 6 картинок 3D; карта дна меняется с размерами', async ({page}) => {
  test.setTimeout(60000);   // карты строятся дважды: при открытии и после ползунков
  const w = watch(page);
  await page.goto('/');
  await openCards(page);
  const cards = page.locator('#cardBox .shprev');
  await expect(cards).toHaveCount(CARDS, BUILT);
  // 4 вида, швы и соседи, где на мангале
  expect(await page.evaluate(() => [...document.querySelectorAll('#cardBox svg')].map(s => s.querySelectorAll('image').length)))
    .toEqual(Array(CARDS).fill(6));
  const bottom = cards.filter({hasText: '1. Дно жаровни'});
  await expect(bottom).toContainText('800 × 420');
  await expect(bottom).toContainText('10,55');
  await expect(bottom).toContainText('шов 800 мм');
  await slide(page, '#sLen', 1000);
  await slide(page, '#sWid', 500);
  await expect(bottom).toContainText('1000 × 500', BUILT);   // карты перестраиваются через 0,25 с после ползунка
  await expect(bottom).toContainText('шов 1000 мм', BUILT);
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('restore: после карт модель на экране та же — снимали свою модель, не экранную', async ({page}) => {
  await page.goto('/');
  const before = await page.evaluate(() => ({n: group.children.length, vis: group.children.filter(o => o.visible).length, inScene: scene.children.length}));
  await openCards(page);
  await expect(page.locator('#cardBox .shprev')).toHaveCount(CARDS, BUILT);
  const after = await page.evaluate(() => ({n: group.children.length, vis: group.children.filter(o => o.visible).length, inScene: scene.children.length}));
  expect(after).toEqual(before);
});

test('speed: все карты строятся быстрее 4 с', async ({page}) => {
  await page.goto('/');
  await openCards(page);
  await expect(page.locator('#cardBox .shprev')).toHaveCount(CARDS, BUILT);
  const ms = await page.evaluate(() => { const t = performance.now(); buildCards(); return performance.now() - t; });
  expect(ms).toBeLessThan(4000);
});

test('print: в печати только карты, каждая А4 210 × 297 мм', async ({page}) => {
  await page.goto('/');
  await openCards(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#cdPdf').click();
  await page.emulateMedia({media: 'print'});
  const r = await page.evaluate(() => {
    const mm = 96 / 25.4;
    const svgs = [...document.querySelectorAll('#printBox svg')].map(s => {
      const b = s.getBoundingClientRect();
      return [Math.round(b.width / mm), Math.round(b.height / mm)];
    });
    const shown = [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id);
    const page = [...document.head.querySelectorAll('style')].map(s => s.textContent).join('');
    return {svgs, shown, page, title: document.title};
  });
  // лист на 1 мм ниже страницы, как у листов А3: ровно 297 мм Chrome иногда переносит на пустую страницу
  expect(r.svgs).toEqual(Array(CARDS).fill([210, 296]));
  expect(r.shown).toEqual(['printBox']);
  expect(r.page).toContain('A4 portrait');
  expect(r.title).toContain('карты деталей');
});

test('noWebGL: карты есть и без 3D — вместо видов надпись, швы на месте', async ({page}) => {
  const w = watch(page);
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/');
  await openCards(page);
  const cards = page.locator('#cardBox .shprev');
  await expect(cards).toHaveCount(CARDS, BUILT);
  await expect(cards.first()).toContainText('Виды недоступны без 3D');
  await expect(cards.first()).toContainText('шов 800 мм');
  expect(w.pageErrors).toEqual([]);
});

test('layout (phone): карты в ширину экрана, страница вбок не едет', async ({page}, info) => {
  test.skip(info.project.name !== 'phone', 'только телефон');
  await page.goto('/');
  await openCards(page);
  await expect(page.locator('#cardBox .shprev')).toHaveCount(CARDS, BUILT);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const b = await page.locator('#cardBox svg').first().boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
});
