// Мастерская обводки (#188, план docs/superpowers/plans/2026-11-28-workshop-light-tone.md): свет от камеры и «Тон гипса» в режиме обводки (Овчарка 7, «Открыть модель»).
// У обычных фигур (Овчарка 6 и др.) — свет сцены как был. Только desktop: npx playwright test tests/e2e/shepherd-light.spec.js --project=desktop
const {test, expect} = require('@playwright/test');

// 158 тыс. треугольников: SwiftShader из playwright.config.js слишком медленный — видеокарта, окно 1440 × 1400 (холст целиком на экране)
test.use({viewport: {width: 1440, height: 1400}, launchOptions: {args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu']}});
test.skip(({isMobile}) => isMobile, 'мастерская — только десктоп');

const ready = f => f === 'shepherd7_orig' ? () => typeof OW !== 'undefined' && OW.on && OW.o3 : f => typeof CUR !== 'undefined' && CUR && !OW.on && ST.fig === f;
// открыть фигуру с чистым браузером (настройки мастерской — по умолчанию); errs — ошибки консоли
async function open(page, f = 'shepherd7_orig') {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('/shepherd-v6j3w/#f=' + f);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(ready(f), f, {timeout: 120000});
  return errs;
}
// другая фигура из списка — и дождаться, что открылась
async function pick(page, f) {
  await page.evaluate(f => { $('figSel').value = f; $('figSel').dispatchEvent(new Event('change')); }, f);
  await page.waitForFunction(ready(f), f, {timeout: 120000});
}
async function view(page, k) {
  await page.click(`.vbar [data-v="${k}"]`);
  await page.waitForFunction(() => !camAnim, null, {timeout: 10000});
  await page.waitForTimeout(150);
}
const tone = (page, s) => page.evaluate(s => { const r = $('sTone'); r.value = s; r.dispatchEvent(new Event('input', {bubbles: true})); }, s);
// все лампы сцены (с детьми камер, если камеры в сцене): сколько и какие видимы
const lights = page => page.evaluate(() => {
  const L = new Set(); [scene, camera, camO].forEach(o => o.traverse(x => { if (x.isLight) L.add(x); }));
  return {n: L.size, vis: [...L].filter(x => x.visible).map(x => x.type + ':' + x.intensity).sort()};
});
// точки модели (кадр фигуры) → светлота пикселя под ними активной камерой: кадр рисуется заново, пиксели — из буфера WebGL (среднее 3 × 3)
const lum = (page, P) => page.evaluate(P => {
  const c = curCam(); c.updateMatrixWorld(); renderer.render(scene, c);
  const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(36);
  return P.map(p => { const v = new THREE.Vector3(...p).project(c), x = Math.round((v.x + 1) / 2 * W), y = Math.round((v.y + 1) / 2 * H);
    gl.readPixels(x - 1, y - 1, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px); let s = 0; for (let i = 0; i < 36; i += 4) s += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; return s / 9; });
}, P);
// точка модели на луче спереди (x, y) и нормаль треугольника под ней
const hit = (page, P) => page.evaluate(P => P.map(([x, y]) => {
  const h = owRay(OW.G, [x, y, 5000], [0, 0, -1]); if (!h) return null;
  const F = OW.F, V = OW.V, a = F[h.tri * 3] * 3, b = F[h.tri * 3 + 1] * 3, q = F[h.tri * 3 + 2] * 3, e1 = [0, 1, 2].map(k => V[b + k] - V[a + k]), e2 = [0, 1, 2].map(k => V[q + k] - V[a + k]),
    n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
  return {p: [x, y, 5000 - h.t], n: n.map(v => v / l)};
}), P);

test('вход в режим: свет от камеры вместо света сцены, «Тон гипса» виден без «Править фигуру», шаг 1', async ({page}) => {
  test.slow();
  const errs = await open(page);
  expect(await page.evaluate(() => [LIGHT_SCENE.length > 0 && LIGHT_SCENE.every(l => !l.visible), [LIGHT_CAM.hemi, LIGHT_CAM.key, LIGHT_CAM.fill].every(l => l.visible)])).toEqual([true, true]);
  expect(await page.evaluate(() => [ST.edit, $('sTone').offsetParent !== null, $('sTone').value, $('toneVal').textContent])).toEqual([false, true, '1', '1']);
  expect(await page.evaluate(() => { const t = owTone(1); return [OW.o3.plaster.color.getHex() === t.color, LIGHT_CAM.key.intensity, LIGHT_CAM.fill.intensity, LIGHT_CAM.hemi.intensity]; })).toEqual([true, .9, .22, .3]);
  expect(errs).toEqual([]);
});

test('«Тон гипса» 4 — гипс и лампы по owTone(4); после перезагрузки — тот же шаг', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await tone(page, 4);
  const want = await page.evaluate(() => owTone(4)), got = () => page.evaluate(() => ({v: $('sTone').value, t: $('toneVal').textContent, c: [OW.o3.plaster, OW.o3.seam, OW.o3.photo].map(m => m.color.getHex()),
    l: [LIGHT_CAM.hemi.intensity, LIGHT_CAM.key.intensity, LIGHT_CAM.fill.intensity]}));
  const exp = {v: '4', t: '4', c: [want.color, want.color, want.color], l: [want.hemi, want.key, want.fill]};
  expect(await got()).toEqual(exp);
  expect(await page.evaluate(() => store('ow-tone'))).toBe('4');
  await page.reload();
  await page.waitForFunction(ready('shepherd7_orig'), null, {timeout: 120000});
  expect(await got()).toEqual(exp);
  expect(errs).toEqual([]);
});

test('«Спереди»: свет симметричен — точка уха или морды и её зеркало у зеркальной модели одной яркости (±6)', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await view(page, 'front');
  expect(await page.evaluate(() => Math.abs(curCam().position.x - controls.target.x) < .5 && Math.abs(controls.target.x) < .5), 'камера «Спереди» — на плоскости симметрии x = 0').toBe(true);
  // модель Meshy симметрична не до точки (у зеркальных треугольников разные нормали в вершинах), поэтому сравниваем с самой собой: та же модель, отражённая по x (scale.x = −1), —
  // при симметричном свете пиксель точки p у модели равен зеркальному пикселю у отражённой модели. Точки — уши (y ≥ 838) и морда, спереди
  const grid = []; for (const y of [700, 780, 880, 900, 930, 960]) for (const x of [20, 40, 60, 80, 100]) grid.push([x, y]);
  const P = (await hit(page, grid)).filter(Boolean).map(h => h.p);
  expect(P.length).toBeGreaterThanOrEqual(15);
  const r = await page.evaluate(P => {
    const c = curCam(), gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(36);
    const xy = P.map(p => { const v = new THREE.Vector3(...p).project(c); return [Math.floor((v.x + 1) / 2 * W), Math.floor((v.y + 1) / 2 * H)]; });
    const read = mir => { renderer.render(scene, c); return xy.map(([x, y]) => { gl.readPixels(mir ? W - 2 - x : x - 1, y - 1, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px); let s = 0; for (let i = 0; i < 36; i += 4) s += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; return s / 9; }); };
    const A = read(false); OW.mesh.scale.x = -1; OW.mesh.updateMatrixWorld(true); const B = read(true); OW.mesh.scale.x = 1; OW.mesh.updateMatrixWorld(true); req3D();
    return {A, B};
  }, P);
  P.forEach((p, i) => expect(Math.abs(r.A[i] - r.B[i]), `точка ${p.map(Math.round)}: ${r.A[i].toFixed(1)}, у зеркала ${r.B[i].toFixed(1)}`).toBeLessThanOrEqual(6));
  expect(errs).toEqual([]);
});

test('ортокамера «Спереди» (#184): гипс освещён так же, как в перспективе с того же направления (±6)', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await view(page, 'front');
  expect(await page.evaluate(() => VIEW.ortho)).toBe(true);
  const P = (await hit(page, [[0, 780], [0, 820], [25, 800], [-25, 800], [60, 700]])).filter(Boolean).map(h => h.p);
  expect(P.length).toBeGreaterThanOrEqual(4);
  const O = await lum(page, P);
  await page.evaluate(() => viewOrtho(false));
  expect(await page.evaluate(() => VIEW.ortho)).toBe(false);
  const Q = await lum(page, P);
  P.forEach((p, i) => expect(Math.abs(O[i] - Q[i]), `точка ${p.map(Math.round)}: орто ${O[i].toFixed(1)}, перспектива ${Q[i].toFixed(1)}`).toBeLessThanOrEqual(6));
  expect(errs).toEqual([]);
});

test('Овчарка 7 → 6 → 7 → 6: ламп не прибавляется, у Овчарки 6 — свет сцены как был', async ({page}) => {
  test.slow();
  const errs = await open(page, 'shepherd6');
  const L0 = await lights(page);
  expect(L0.vis).toEqual(['DirectionalLight:0.35', 'DirectionalLight:0.45', 'DirectionalLight:0.85', 'HemisphereLight:0.8']);
  for (const f of ['shepherd7_orig', 'shepherd6', 'shepherd7_orig', 'shepherd6']) await pick(page, f);
  expect(await lights(page)).toEqual(L0);
  expect(await page.evaluate(() => [LIGHT_SCENE.every(l => l.visible), [LIGHT_CAM.hemi, LIGHT_CAM.key, LIGHT_CAM.fill].some(l => l.visible)])).toEqual([true, false]);
  expect(errs).toEqual([]);
});
