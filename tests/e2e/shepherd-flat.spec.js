// Овчарка 7 (#184, план docs/superpowers/plans/2026-11-28-shepherd7-flat-photo.md): «Спереди» / «Сбоку» в ортокамере у фигур режима обводки,
// плоские фото-кальки и галочка «Модель». Только desktop: npx playwright test tests/e2e/shepherd-flat.spec.js --project=desktop
const {test, expect} = require('@playwright/test');

// 158 тыс. треугольников: SwiftShader из playwright.config.js слишком медленный — видеокарта, окно 1440 × 1400 (холст целиком на экране)
test.use({viewport: {width: 1440, height: 1400}, launchOptions: {args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu']}});
test.skip(({isMobile}) => isMobile, 'мастерская — только десктоп');

async function open(page, f = 'shepherd7_orig') {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('/shepherd-v6j3w/#f=' + f);
  if (f === 'shepherd7_orig') await page.waitForFunction(() => typeof OW !== 'undefined' && OW.on && OW.o3, null, {timeout: 120000});
  else await page.waitForFunction(f => typeof CUR !== 'undefined' && CUR && !OW.on && ST.fig === f, f, {timeout: 120000});
  return errs;
}
// кнопка вида и дождаться конца полёта камеры
async function view(page, k) {
  await page.click(k === 'all' ? '#bFit' : `.vbar [data-v="${k}"]`);
  await page.waitForFunction(() => !camAnim, null, {timeout: 10000});
  await page.waitForTimeout(150);
}
// точки кадра фигуры → px холста активной камерой
const project = (page, P) => page.evaluate(P => {
  const c = curCam(), r = renderer.domElement.getBoundingClientRect();
  c.updateMatrixWorld();
  return P.map(p => { const v = new THREE.Vector3(...p).project(c); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
}, P);
// «Править фигуру» и группа «Редактор» раскрыта (у headless нет точного указателя — MK.fine)
async function editOn(page) {
  await page.evaluate(() => { const c = $('cEdit'); c.checked = true; c.dispatchEvent(new Event('change')); MK.fine = true; $('controls').querySelector('[data-g="edit"]').classList.remove('shut'); renderAll(); });
}

test('«Спереди» и «Сбоку» у Овчарки 7 — ортокамера; «3D», «Сверху», «Всё» — перспектива', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await view(page, 'front');
  expect(await page.evaluate(() => [VIEW.ortho, VIEW.key, !!curCam().isOrthographicCamera])).toEqual([true, 'front', true]);
  await view(page, 'side');
  expect(await page.evaluate(() => [VIEW.ortho, VIEW.key, !!curCam().isOrthographicCamera])).toEqual([true, 'side', true]);
  for (const k of ['iso', 'top', 'all']) {
    await view(page, 'front');
    await view(page, k);
    expect(await page.evaluate(() => [VIEW.ortho, VIEW.key, !!curCam().isPerspectiveCamera]), k).toEqual([false, '', true]);
  }
  expect(errs).toEqual([]);
});

test('Овчарка 6 «Спереди» — перспектива, как раньше', async ({page}) => {
  test.slow();
  const errs = await open(page, 'shepherd6');
  await view(page, 'front');
  expect(await page.evaluate(() => [VIEW.ortho, !!curCam().isPerspectiveCamera])).toEqual([false, true]);
  expect(errs).toEqual([]);
});

test('выход из орто — тот же масштаб: точки плоскости цели на тех же местах (и после колеса)', async ({page}) => {
  test.slow();
  const errs = await open(page);
  // плоскость через цель поперёк взгляда: в перспективе с того же места она того же размера, что в орто (края габарита по глубине — нет: там перспектива)
  const plane = () => page.evaluate(() => { const t = controls.target, b = OW.box; return [[b.min[0], b.min[1], t.z], [b.max[0], b.max[1], t.z], [t.x, t.y, t.z]]; });
  for (const wheel of [0, -400]) {
    await view(page, 'front');
    const cv = await page.$('#stage canvas'), bb = await cv.boundingBox();
    if (wheel) { await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.wheel(0, wheel); await page.waitForTimeout(800); }
    const st = await page.evaluate(() => ({ortho: VIEW.ortho, zoom: camO.zoom}));
    expect(st.ortho, 'колесо в орто — масштаб, а не выход').toBe(true);
    if (wheel) expect(st.zoom, 'колесо меняет camO.zoom').toBeGreaterThan(1.05);
    const P = await plane(), a = await project(page, P);
    await page.evaluate(() => viewOrtho(false));
    expect(await page.evaluate(() => VIEW.ortho)).toBe(false);
    const b = await project(page, P);
    a.forEach((q, i) => expect(Math.hypot(q[0] - b[i][0], q[1] - b[i][1]), `точка ${i}, колесо ${wheel}: ${q} → ${b[i]}`).toBeLessThanOrEqual(2));
  }
  expect(errs).toEqual([]);
});

test('повернул мышью в «Спереди» — перспектива (левая без инструмента, правая с пером)', async ({page}) => {
  test.slow();
  const errs = await open(page);
  const cv = await page.$('#stage canvas'), bb = await cv.boundingBox(), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  const drag = async button => { await page.mouse.move(cx, cy); await page.mouse.down({button}); for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 8, cy); await page.mouse.up({button}); await page.waitForTimeout(600); };
  await view(page, 'front');
  await drag('left');
  expect(await page.evaluate(() => [VIEW.ortho, !!curCam().isPerspectiveCamera]), 'левая кнопка без инструмента').toEqual([false, true]);
  await editOn(page);
  await page.click('#mk_pen');
  await view(page, 'front');
  expect(await page.evaluate(() => VIEW.ortho)).toBe(true);
  await drag('right');
  expect(await page.evaluate(() => [VIEW.ortho, !!curCam().isPerspectiveCamera, ST.tool]), 'правая кнопка с пером').toEqual([false, true, 'pen']);
  expect(errs).toEqual([]);
});

test('перо в ортовиде: точка под курсором (≤ 1 px) и на поверхности модели', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await editOn(page);
  await page.evaluate(() => { const m = $('cMagnet'); m.checked = false; m.dispatchEvent(new Event('change')); });   // без магнита: точка — ровно та, что под курсором
  await page.click('#mk_line');
  for (const k of ['front', 'side']) {
    await view(page, k);
    expect(await page.evaluate(() => VIEW.ortho)).toBe(true);
    const [[x, y]] = await project(page, [k === 'front' ? [0, 820, 1150] : [60, 820, 1000]]);
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    const p = await page.evaluate(() => { const c = ST.mkCur; return c ? c.pts[c.pts.length - 1] : null; });
    expect(p, k + ': точка поставлена').not.toBeNull();
    expect(await page.evaluate(p => !!owNear(OW.G, p, 1), p), k + ': на поверхности модели').toBe(true);
    const [[px, py]] = await project(page, [p]);
    expect(Math.hypot(px - x, py - y), `${k}: под курсором (${x.toFixed(1)}, ${y.toFixed(1)}) → (${px.toFixed(1)}, ${py.toFixed(1)})`).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
  }
  expect(errs).toEqual([]);
});

test('ресайз в ортовиде — пропорции кадра camO = пропорции холста', async ({page}) => {
  test.slow();
  await page.setViewportSize({width: 1440, height: 900});
  const errs = await open(page);
  await view(page, 'front');
  for (const w of [1440, 1000]) {
    await page.setViewportSize({width: w, height: 900});
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({o: (camO.right - camO.left) / (camO.top - camO.bottom), c: renderer.domElement.clientWidth / renderer.domElement.clientHeight, ortho: VIEW.ortho}));
    expect(r.ortho).toBe(true);
    expect(Math.abs(r.o - r.c), `${w}: кадр ${r.o.toFixed(3)}, холст ${r.c.toFixed(3)}`).toBeLessThanOrEqual(0.01);
  }
  expect(errs).toEqual([]);
});
