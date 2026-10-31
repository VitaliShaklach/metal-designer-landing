// Блок «Что получаете»: кнопка раскрытия, вкладки «Размеры», «Раскрой и масса», «Лазер · DXF»,
// полоска с ползунком длины внизу экрана
const {test, expect} = require('@playwright/test');
const fs = require('fs');

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

async function open(page, tab) {
  await page.locator('#getBtn').click();
  await expect(page.locator('#get')).toBeVisible();
  if (tab) await page.getByRole('tab', {name: tab}).click();
}

// stored-zip: имена и содержимое файлов по локальным заголовкам
function unzip(buf) {
  const files = [];
  for (let o = 0; buf.readUInt32LE(o) === 0x04034b50;) {
    const size = buf.readUInt32LE(o + 18), nl = buf.readUInt16LE(o + 26), xl = buf.readUInt16LE(o + 28);
    const name = buf.toString('utf8', o + 30, o + 30 + nl), start = o + 30 + nl + xl;
    files.push([name, buf.toString('utf8', start, start + size)]);
    o = start + size;
  }
  return files;
}

test('fold: при загрузке блок свёрнут, кнопка раскрывает и сворачивает', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#get')).toBeHidden();
  await expect(page.locator('#getBtn')).toHaveText(/Показать чертежи и DXF/);
  await page.locator('#getBtn').click();
  await expect(page.locator('#get')).toBeVisible();
  await expect(page.locator('#getBtn')).toHaveText(/Скрыть чертежи/);
  await expect(page.locator('#getBtn')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#getBtn').click();
  await expect(page.locator('#get')).toBeHidden();
  await expect(page.locator('#getBtn')).toHaveText(/Показать чертежи и DXF/);
});

test('tabs: вкладки переключаются, на модели три размера, длина идёт за ползунком', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await expect(page.locator('#stage .d3')).toHaveCount(3);
  await expect(page.locator('#stage .d3').filter({hasText: /^800$/})).toHaveCount(1);
  await open(page);
  await expect(page.locator('#tab-dims')).toBeVisible();
  await expect(page.locator('#dimList input:checked')).toHaveCount(3);
  await page.getByRole('tab', {name: 'Раскрой и масса'}).click();
  await expect(page.locator('#tab-cut')).toBeVisible();
  await expect(page.locator('#tab-dims')).toBeHidden();
  await page.getByRole('tab', {name: 'Лазер · DXF'}).click();
  await expect(page.locator('#tab-dxf')).toBeVisible();
  await page.getByRole('tab', {name: 'Лазер · DXF'}).press('ArrowLeft');
  await expect(page.locator('#tab-cut')).toBeVisible();
  await slide(page, '#sLen', 1000);
  await expect(page.locator('#stage .d3').filter({hasText: /^1000$/})).toHaveCount(1);
  // «Скрыть все» — подписей нет, «Показать все» — больше трёх
  await page.getByRole('tab', {name: 'Размеры'}).click();
  await page.locator('#dNone').click();
  await expect(page.locator('#stage .d3')).toHaveCount(0);
  await page.locator('#dAll').click();
  expect(await page.locator('#stage .d3').count()).toBeGreaterThan(3);
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('fold: свёрнутые группы с хобби-сайта (тот же домен) лендинг не слушает', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('md-dims', JSON.stringify({all: true, grill: true})));
  await page.goto('/');
  await open(page);
  for (const el of ['all', 'grill']) await expect(page.locator(`#dimList .dg[data-el=${el}]`)).not.toHaveClass(/shut/);
  await expect(page.locator('#dimList input:checked')).toHaveCount(3);
  for (const id of ['l80', 'w39', 'top']) await expect(page.locator(`#dm_${id}`)).toBeVisible();
  // свернул «Жаровню» — после ползунка она так и свёрнута
  await page.locator('#dimList .dg[data-el=grill] h3 button').click();
  await slide(page, '#sLen', 1000);
  await expect(page.locator('#dimList .dg[data-el=grill]')).toHaveClass(/shut/);
  expect(await page.evaluate(() => localStorage.getItem('md-dims'))).toBe('{"all":true,"grill":true}');
});

test('cut: при 1000 × 500 дно 1000 × 500, в металле один лист 4 мм, крыши нет', async ({page}) => {
  await page.goto('/#len=1000&wid=500&top=970&t=4&deep=1');
  await open(page, 'Раскрой и масса');
  const bottom = page.locator('#cut tr', {hasText: 'Дно жаровни'});
  await expect(bottom).toContainText('1000 × 500');
  await expect(page.locator('#metal')).toContainText('Лист 4 мм');
  await expect(page.locator('#metal li', {hasText: /^Лист/})).toHaveCount(1);
  await expect(page.locator('#metal')).not.toContainText('крыши');
});

test('sel: выбрано дно — в раскрое только дно и итог, в DXF только дно', async ({page}) => {
  await page.goto('/');
  await open(page, 'Раскрой и масса');
  await page.evaluate(() => applySel({el: 'grill', part: 'gBot', name: partName('gBot')}));
  const rows = await page.locator('#cut tbody tr:not(.grp):not(.tot) td:first-child').allInnerTexts();
  expect(rows.map(r => r.split('\n')[0])).toEqual(['Дно жаровни']);
  await expect(page.locator('#cut tr.tot')).not.toHaveCount(0);
  await expect(page.locator('#dxfTbl tbody tr:not(.tot)')).toHaveCount(1);
  await page.evaluate(() => applySel(null));
  expect(await page.locator('#cut tbody tr:not(.grp):not(.tot)').count()).toBeGreaterThan(5);
});

test('zip: «Скачать все» — mangal_dxf_8_detaley.zip, 8 файлов R12 со слоем CUT', async ({page}) => {
  test.setTimeout(90000);   // Playwright сохраняет каждое скачивание секунд по 7–10, а файлов два
  await page.goto('/');
  await open(page, 'Лазер · DXF');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Скачать все (ZIP)'}).click()]);
  expect(dl.suggestedFilename()).toBe('mangal_dxf_8_detaley.zip');
  const files = unzip(fs.readFileSync(await dl.path()));
  expect(files.length).toBe(8);
  for (const [name, text] of files) {
    expect(name).toMatch(/\.dxf$/);
    expect(text).toContain('AC1009');
    expect(text).toMatch(/\r\n8\r\nCUT\r\n/);
  }
  await expect(page.locator('#dxfMsg')).toContainText('mangal_dxf_8_detaley.zip');
  // по одному файлу — кнопка DXF в строке
  const [one] = await Promise.all([page.waitForEvent('download'), page.locator('#dxfTbl .dxfbtn').first().click()]);
  expect(one.suggestedFilename()).toMatch(/^grill_.*_x\d+\.dxf$/);
});

test('nest: во вкладке DXF сначала листы — размер и толщина, потом детали; DXF листа', async ({page}) => {
  test.setTimeout(60000);   // скачивание в Playwright небыстрое
  await page.goto('/');
  await open(page, 'Лазер · DXF');
  const first = page.locator('#nestBox .nestsh').first();
  await expect(first.locator('figcaption')).toContainText('Лист 4 мм · 1250 × 2500');
  await expect(first.locator('svg.nestsk')).toBeVisible();
  expect(await page.evaluate(() => document.getElementById('nestBox').compareDocumentPosition(document.getElementById('dxfTbl')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await expect(page.locator('#nestBox figcaption')).toHaveText([/Лист 4 мм/])   // все детали — один лист (решение 31.10);
  await page.getByRole('button', {name: '1500 × 3000'}).click();
  await expect(page.getByRole('button', {name: '1500 × 3000'})).toHaveAttribute('aria-pressed', 'true');
  await expect(first.locator('figcaption')).toContainText('Лист 4 мм · 1500 × 3000');
  // ползунок длины — лист перекладывается
  const len0 = await first.locator('figcaption').innerText();
  await slide(page, '#sLen', 1200);
  await expect(first.locator('figcaption')).not.toHaveText(len0);
  const [dl] = await Promise.all([page.waitForEvent('download'), first.getByRole('button', {name: 'DXF листа'}).click()]);
  expect(dl.suggestedFilename()).toBe('mangal_list_4mm_1500x3000_1.dxf');
  const text = fs.readFileSync(await dl.path(), 'utf8');
  for (const lay of ['SHEET', 'CUT', 'MARK']) expect(text).toContain(`\r\n8\r\n${lay}\r\n`);
});

test('noLenBar: полоски с ползунком длины внизу нет (решение 31.10) — длина только на первом экране', async ({page}) => {
  await page.goto('/');
  await open(page, 'Раскрой и масса');
  await expect(page.locator('#lenBar')).toHaveCount(0);
  await expect(page.locator('input[type=range]')).toHaveCount(3);
  await slide(page, '#sLen', 1000);
  await expect(page.locator('#cut tr', {hasText: 'Дно жаровни'})).toContainText('1000 × 420');
});

test('layout: таблицы прокручиваются внутри блока, страница вбок не едет', async ({page}, info) => {
  test.skip(info.project.name !== 'phone', 'только телефон');
  await page.goto('/');
  for (const tab of ['Размеры', 'Раскрой и масса', 'Лазер · DXF']) {
    await open(page, tab);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (tab === 'Лазер · DXF') {   // лист целиком в ширину экрана
      const box = await page.locator('#nestBox svg.nestsk').first().boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    await page.locator('#getBtn').click();   // свернуть, следующий круг раскроет снова
  }
  await open(page, 'Раскрой и масса');
  const scrolls = await page.locator('#get .tbl:visible').evaluateAll(els => els.map(e => e.scrollWidth > e.clientWidth));
  expect(scrolls).toEqual([true]);
});

test('tabs (phone): три кнопки друг под другом с подписью, видны целиком, нажатая — залита', async ({page}, info) => {
  test.skip(info.project.name !== 'phone', 'только телефон');
  await page.goto('/');
  await open(page);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  const boxes = [];
  for (let i = 0; i < 3; i++) {
    await expect(tabs.nth(i).locator('small')).toBeVisible();
    boxes.push(await tabs.nth(i).boundingBox());
  }
  for (const b of boxes) expect(b.x >= 0 && b.x + b.width <= 390 && b.width > 300).toBe(true);   // на всю ширину, не за краем
  expect(boxes[0].y + boxes[0].height <= boxes[1].y && boxes[1].y + boxes[1].height <= boxes[2].y).toBe(true);
  await tabs.nth(2).click();
  await expect(page.locator('#tab-dxf')).toBeVisible();
  const bg = n => tabs.nth(n).evaluate(e => getComputedStyle(e).backgroundColor);
  expect(await bg(2)).not.toBe(await bg(0));
  // содержимое — под кнопками
  expect((await page.locator('#tab-dxf').boundingBox()).y).toBeGreaterThanOrEqual(boxes[2].y + boxes[2].height);
});

test('noWebGL: кнопка, вкладки и DXF работают без 3D', async ({page}) => {
  const w = watch(page);
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/');
  await open(page);
  await expect(page.getByRole('tab', {name: 'Размеры'})).toBeHidden();   // размерам негде появиться
  await expect(page.locator('#tab-dims')).toBeHidden();
  await expect(page.locator('#tab-cut')).toBeVisible();
  await page.getByRole('tab', {name: 'Раскрой и масса'}).press('ArrowRight');
  await expect(page.locator('#tab-dxf')).toBeVisible();
  await page.getByRole('tab', {name: 'Лазер · DXF'}).press('ArrowRight');
  await expect(page.locator('#tab-cut')).toBeVisible();
  await page.getByRole('tab', {name: 'Лазер · DXF'}).click();
  await expect(page.locator('#dxfTbl tbody tr:not(.tot)')).toHaveCount(8);
  await expect(page.locator('#nestBox .nestsh')).toHaveCount(1);
  await page.getByRole('tab', {name: 'Раскрой и масса'}).click();
  await expect(page.locator('#cut')).toContainText('Дно жаровни');
  await slide(page, '#sLen', 1000);
  await expect(page.locator('#cut tr', {hasText: 'Дно жаровни'})).toContainText('1000 × 420');
  expect(w.pageErrors).toEqual([]);
  expect(w.errors.filter(e => !/WebGLRenderer: Error creating WebGL context/.test(e))).toEqual([]);
});
