// Переключатель «Мангал | Рысь»: лента рыси, адрес #item=rys, возврат к мангалу с его размерами
const {test, expect} = require('@playwright/test');

// ошибки страницы и консоли, адреса запросов — за всё время теста
function watch(page) {
  const w = {pageErrors: [], errors: [], requests: []};
  page.on('pageerror', e => w.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') w.errors.push(m.text()); });
  page.on('request', r => w.requests.push(r.url()));
  return w;
}
const clean = w => {
  expect(w.pageErrors).toEqual([]);
  expect(w.errors).toEqual([]);
};

// адрес пишется не сразу, а после паузы — ждём, пока он станет нужным
const hashIs = (page, h) => expect.poll(() => page.evaluate(() => location.hash)).toBe(h);
const btn = (page, name) => page.locator('#items button', {hasText: name});

test('default: мангал, кнопка «Мангал» нажата, файлы рыси не грузятся', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('.sizes')).toBeVisible();
  await expect(page.locator('.lynx')).toBeHidden();
  await expect(btn(page, 'Мангал')).toHaveAttribute('aria-pressed', 'true');
  await expect(btn(page, 'Рысь')).toHaveAttribute('aria-pressed', 'false');
  expect(w.requests.filter(u => u.includes('/lynx/'))).toEqual([]);
  clean(w);
});

test('switch: «Рысь» — лента, 5 плиток, тексты, адрес #item=rys', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await btn(page, 'Рысь').click();
  await expect(page.locator('.lynx')).toBeVisible();
  for (const s of ['#stage', '.sizes', '.metal', '#lstats', '#getBtn']) await expect(page.locator(s)).toBeHidden();
  await expect(btn(page, 'Рысь')).toHaveAttribute('aria-pressed', 'true');
  await expect(btn(page, 'Мангал')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lynxStats .stat')).toHaveCount(5);
  await expect(page.locator('#lynxStats')).toContainText('1000 мм');
  await expect(page.locator('.lynxsub')).toHaveText('Даже фигуру по фото проектирую за 1–3 дня');
  await expect(page.locator('.r-rework')).toContainText('Гранёная модель, разметка швов');
  for (const [s, cap] of [['.r-was', 'Было'], ['.r-rework', 'Переработка'], ['.r-now', 'Стало'], ['.r-draw', 'Чертежи']]) {
    await expect(page.locator(`${s} .rcap`)).toHaveText(cap);
  }
  await expect(page.locator('.r-now img')).toHaveAttribute('src', 'lynx/poster.jpg');
  // все картинки ленты загрузились
  const imgs = page.locator('.ribbon img');
  await expect(imgs).toHaveCount(7);
  await expect.poll(() => imgs.evaluateAll(l => l.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
  await hashIs(page, '#item=rys');
  clean(w);
});

test('rysFirst: открыли #item=rys, нажали «Мангал» — модель по размеру, пример по умолчанию', async ({page}) => {
  const w = watch(page);
  await page.goto('/#item=rys');
  await expect(page.locator('.lynx')).toBeVisible();
  await expect(page.locator('#stage')).toBeHidden();
  // пока мангал скрыт, окно меняет размер (повернули телефон, растянули окно)
  const vp = page.viewportSize();
  await page.setViewportSize({width: vp.width - 60, height: vp.height + 120});
  await btn(page, 'Мангал').click();
  await expect(page.locator('#stage')).toBeVisible();
  const m = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas'), st = document.getElementById('stage');
    return {cw: c.width, ch: c.height, aspect: camera.aspect, stageAspect: st.clientWidth / st.clientHeight};
  });
  expect(m.cw).toBeGreaterThan(0);
  expect(m.ch).toBeGreaterThan(0);
  expect(m.aspect).toBeCloseTo(m.stageAspect, 2);                          // картинка не растянута
  // модель в кадре: все углы рамки видимых деталей — внутри экрана
  const inView = await page.evaluate(() => {
    const box = new THREE.Box3();
    group.traverseVisible(o => { if (o.isMesh && !o.userData.dim) box.expandByObject(o); });
    const pts = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      pts.push(new THREE.Vector3(x, y, z).project(camera));
    }
    return pts.every(p => Math.abs(p.x) <= 1.001 && Math.abs(p.y) <= 1.001);
  });
  expect(inView).toBe(true);
  await expect(page.locator('#lstats')).toContainText('800 × 420');
  await hashIs(page, '#len=800&wid=420&top=970&t=4&deep=1');
  clean(w);
});

test('backToMangal: ссылка с размерами переживает поход в рысь и обратно', async ({page}) => {
  const w = watch(page);
  const link = '#len=600&wid=280&top=900&t=4&deep=0';
  await page.goto('/' + link);
  await btn(page, 'Рысь').click();
  await hashIs(page, '#item=rys');
  await btn(page, 'Мангал').click();
  await expect(page.locator('#sLen')).toHaveValue('600');
  await expect(page.locator('#lstats')).toContainText('600 × 280');
  await hashIs(page, link);
  clean(w);
});

test('hashchange: новая ссылка в открытой вкладке переключает изделие и ползунки', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await page.evaluate(() => { location.hash = '#item=rys'; });
  await expect(page.locator('.lynx')).toBeVisible();
  await expect(page.locator('#stage')).toBeHidden();
  await expect(btn(page, 'Рысь')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { location.hash = '#len=600&wid=280&top=900&t=4&deep=0'; });
  await expect(page.locator('.lynx')).toBeHidden();
  await expect(page.locator('#stage')).toBeVisible();
  await expect(btn(page, 'Мангал')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sLen')).toHaveValue('600');
  await hashIs(page, '#len=600&wid=280&top=900&t=4&deep=0');
  clean(w);
});

test('paused: пока показана рысь, мангал не рисует кадры', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await btn(page, 'Рысь').click();
  const frames = await page.evaluate(() => new Promise(done => {
    let n = 0;
    const draw = renderer.render.bind(renderer);
    renderer.render = (...a) => { n++; return draw(...a); };
    setTimeout(() => done(n), 500);
  }));
  expect(frames).toBe(0);
  clean(w);
});

test('getHidden: рысь сворачивает «Что получаете», кнопка в исходном виде', async ({page}) => {
  const w = watch(page);
  await page.goto('/');
  await page.locator('#getBtn').click();
  await expect(page.locator('#get')).toBeVisible();
  await btn(page, 'Рысь').click();
  await expect(page.locator('#get')).toBeHidden();
  await btn(page, 'Мангал').click();
  await expect(page.locator('#getBtn')).toHaveText('Показать чертежи и DXF ↓');
  await expect(page.locator('#getBtn')).toHaveAttribute('aria-expanded', 'false');
  clean(w);
});

test('lightbox: картинка ленты открывается крупно той же картинкой, Esc и клик закрывают', async ({page}) => {
  const w = watch(page);
  await page.goto('/#item=rys');
  for (const s of ['.r-was img >> nth=1', '.r-draw img >> nth=0']) {
    const img = page.locator(s);
    const src = await img.evaluate(i => i.src);
    await img.click();
    await expect(page.locator('#lbox')).toBeVisible();
    expect(await page.locator('#lbox img').evaluate(i => i.src)).toBe(src);
    await page.keyboard.press('Escape');
    await expect(page.locator('#lbox')).toBeHidden();
  }
  await page.locator('.r-now img').click();
  await expect(page.locator('#lbox')).toBeVisible();
  await page.locator('#lbox').click();
  await expect(page.locator('#lbox')).toBeHidden();
  clean(w);
});

test('cta: под лентой кнопка «Прислать фото своей фигуры» в Telegram', async ({page}) => {
  const w = watch(page);
  await page.goto('/#item=rys');
  const a = page.locator('.lynx a', {hasText: 'Прислать фото своей фигуры'});
  await expect(a).toBeVisible();
  await expect(a).toHaveAttribute('href', 'https://t.me/SHVA_1984');
  // кнопка — после ленты и цифр
  const [r, st, b] = await Promise.all(['.ribbon', '#lynxStats', '.lynx a'].map(s => page.locator(s).boundingBox()));
  expect(st.y).toBeGreaterThanOrEqual(r.y + r.height);
  expect(b.y).toBeGreaterThanOrEqual(st.y + st.height);
  clean(w);
});

test('layout: лента читается «было → стало», без горизонтальной прокрутки', async ({page, isMobile}) => {
  const w = watch(page);
  await page.goto('/#item=rys');
  await expect.poll(() => page.locator('.ribbon img').evaluateAll(l => l.every(i => i.complete))).toBe(true);
  const m = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      was: [...document.querySelectorAll('.r-was img, .r-rework img')].map(i => i.getBoundingClientRect()).map(b => ({top: b.top, bottom: b.bottom})),
      steps: ['.r-was', '.r-rework', '.r-now', '.r-draw'].map(s => { const b = r(s); return {top: b.top, bottom: b.bottom, left: b.left, width: b.width}; }),
      now: r('.r-now'), draw: r('.r-draw'),
    };
  });
  expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
  if (isMobile) {
    // четыре миниатюры «Было/Переработка» — одной строкой, выше «Стало»; чертежи — ниже «Стало»
    const tops = m.was.map(b => b.top);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
    expect(m.now.top).toBeGreaterThanOrEqual(Math.max(...m.was.map(b => b.bottom)));
    expect(m.draw.top).toBeGreaterThanOrEqual(m.now.bottom);
    expect(m.now.height).toBeLessThanOrEqual(380);
  } else {
    // одна строка слева направо, «Стало» — самое широкое
    for (const s of m.steps) expect(Math.abs(s.top - m.steps[0].top)).toBeLessThanOrEqual(1);
    for (let i = 1; i < 4; i++) expect(m.steps[i].left).toBeGreaterThan(m.steps[i - 1].left);
    expect(m.steps[2].width).toBe(Math.max(...m.steps.map(s => s.width)));
  }
  clean(w);
});
