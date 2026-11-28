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

/* ---------- #188 задача 2: галочка «Белые швы» — швы кальки «Текстура» белые (#f2f2f2) вместо тёмно-коричневых (OW_SEAM_C); облако швов и магнит (#177) от неё не зависят ---------- */
const maskReady = page => page.waitForFunction(() => OW.o3 && OW.o3.mask && OW.seam && !$('traceRow').hidden, null, {timeout: 120000});
const seamW = (page, on) => page.evaluate(on => { const c = $('cSeamW'); c.checked = on; c.dispatchEvent(new Event('change', {bubbles: true})); }, on);
// строка галочки на экране, галочка, цвет шва в шейдере кальки «Текстура»
const seamState = page => page.evaluate(() => { const r = $('seamWRow'); return {row: !!r && !r.hidden && r.offsetParent !== null, chk: !!$('cSeamW') && $('cSeamW').checked, c: OW.o3.seam.userData.owSeamC.value.getHex()}; });
async function editOn(page) {
  await page.evaluate(() => { const c = $('cEdit'); c.checked = true; c.dispatchEvent(new Event('change')); MK.fine = true; $('controls').querySelector('[data-g="edit"]').classList.remove('shut'); renderAll(); });
}
// точки облака швов, видимые спереди (луч спереди попадает в саму точку), → средняя светлота пикселя под ними: калька выключена (гипс) и включена (швы). Кадр — активной камерой, пиксель 1 × 1
const seamLum = page => page.evaluate(() => {
  const S = OW.seam.seg, P = [];
  for (let i = 0; i < S.length && P.length < 300; i += 6 * 41) { const p = [S[i], S[i + 1], S[i + 2]], h = owRay(OW.G, [p[0], p[1], 5000], [0, 0, -1]); if (h && Math.abs(5000 - h.t - p[2]) < 1.5) P.push(p); }
  const c = curCam(), gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4);
  const read = on => { OW.calkaOn = on; owRender(); renderer.render(scene, c); let s = 0;
    P.forEach(p => { const v = new THREE.Vector3(...p).project(c); gl.readPixels(Math.round((v.x + 1) / 2 * W), Math.round((v.y + 1) / 2 * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); s += .299 * px[0] + .587 * px[1] + .114 * px[2]; }); return s / P.length; };
  const r = {n: P.length, plaster: read(false), seam: read(true), mat: OW.mesh.material === OW.o3.seam}; owRender(); req3D(); return r;
});

test('«Белые швы»: скрыта, пока «Текстура» готовится; готова — видна, снята, швы тёмные; включил — швы белые и светлее гипса; после перезагрузки — включена', async ({page}) => {
  test.slow();
  const errs = await open(page);
  const s0 = await page.evaluate(() => ({mask: !!OW.o3.mask, shown: !!$('seamWRow') && !$('seamWRow').hidden && $('seamWRow').offsetParent !== null}));
  if (!s0.mask) expect(s0.shown, 'пока маски нет — строки нет').toBe(false);
  await maskReady(page);
  const C = await page.evaluate(() => OW_SEAM_C);
  expect(await seamState(page), 'маска готова: строка видна, галочка снята, швы OW_SEAM_C').toEqual({row: true, chk: false, c: C});
  await view(page, 'front');
  await editOn(page);
  const dark = await seamLum(page);
  expect(dark.n, 'видимых спереди точек шва').toBeGreaterThanOrEqual(40);
  expect(dark.mat, 'на модели — калька «Текстура»').toBe(true);
  expect(dark.seam, `тёмные швы темнее гипса: ${dark.seam.toFixed(1)} против ${dark.plaster.toFixed(1)}`).toBeLessThan(dark.plaster - 15);
  await seamW(page, true);
  expect(await seamState(page)).toEqual({row: true, chk: true, c: 0xf2f2f2});
  expect(await page.evaluate(() => [OW_SEAM_W, store('ow-seam-white')])).toEqual([0xf2f2f2, '1']);
  const white = await seamLum(page);
  expect(white.seam, `белые швы светлее гипса: ${white.seam.toFixed(1)} против ${white.plaster.toFixed(1)}`).toBeGreaterThan(white.plaster + 15);
  expect(Math.abs(white.plaster - dark.plaster), 'гипс от галочки не меняется').toBeLessThanOrEqual(2);
  await page.reload();
  await page.waitForFunction(ready('shepherd7_orig'), null, {timeout: 120000});
  await maskReady(page);
  expect(await seamState(page), 'после перезагрузки').toEqual({row: true, chk: true, c: 0xf2f2f2});
  await seamW(page, false);
  expect(await seamState(page), 'выключил — снова OW_SEAM_C').toEqual({row: true, chk: false, c: C});
  expect(await page.evaluate(() => store('ow-seam-white'))).toBe('0');
  expect(errs).toEqual([]);
});

test('магнит к шву (#177) липнет одинаково при вкл и выкл «Белых швах»', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await maskReady(page);
  await editOn(page);
  // точки рядом со швами (сдвиг 2…4 мм) → куда их тянет магнит; отрезки магнита — заново (OW.snapK = '')
  const snap = () => page.evaluate(() => { OW.snapK = ''; const S = OW.seam.seg, seg = owSnapSeg(), out = [];
    for (let i = 0, k = 0; i < S.length && out.length < 60; i += 6 * 997, k++) { const q = [S[i] + 2 + k % 3, S[i + 1] - 2, S[i + 2] + 1]; out.push(mkSnap(q, seg, true).map(x => Math.round(x * 1000) / 1000)); }
    let sum = 0; for (let i = 0; i < seg.length; i += 97) sum += seg[i];
    return {n: S.length, seg: seg.length, sum: Math.round(sum * 1000), on: owSeamOn(), out}; });
  const off = await snap();
  expect(off.on, 'калька «Текстура» на модели').toBe(true);
  expect(off.out.length).toBeGreaterThanOrEqual(20);
  await seamW(page, true);
  expect(await snap()).toEqual(off);
  await seamW(page, false);
  expect(await snap()).toEqual(off);
  expect(errs).toEqual([]);
});

test('тон и «Белые швы» сменены, пока «Текстура» готовится, — калька появляется в выбранном тоне и с белыми швами', async ({page}) => {
  test.slow();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('/shepherd-v6j3w/#f=shepherd7_orig');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(ready('shepherd7_orig'), null, {timeout: 120000, polling: 'raf'});
  const early = await page.evaluate(() => { const m = !!OW.o3.mask; const r = $('sTone'); r.value = 5; r.dispatchEvent(new Event('input', {bubbles: true}));
    const c = $('cSeamW'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles: true})); return m; });
  expect(early, 'сменили до готовности маски').toBe(false);
  await maskReady(page);
  await editOn(page);
  const r = await page.evaluate(() => { const o = OW.o3; return {seam: owSeamOn() && OW.mesh.material === o.seam, c: o.seam.color.getHex(), t: owTone(5).color, w: o.seam.userData.owSeamC.value.getHex(), v: $('sTone').value, chk: $('cSeamW').checked}; });
  expect(r).toEqual({seam: true, c: r.t, t: r.t, w: 0xf2f2f2, v: '5', chk: true});
  await view(page, 'front');
  const L = await seamLum(page);
  expect(L.seam, `белые швы на тоне 5 светлее гипса: ${L.seam.toFixed(1)} против ${L.plaster.toFixed(1)}`).toBeGreaterThan(L.plaster + 15);
  expect(errs).toEqual([]);
});

test('модель без текстуры («Открыть модель»): «Тон гипса» есть и работает, «Белых швов» нет', async ({page}) => {
  test.slow();
  const errs = await open(page);
  await maskReady(page);
  expect((await seamState(page)).row, 'у Овчарки 7 строка видна').toBe(true);
  // куб 200 мм без развёртки и картинки — как STL из «Открыть модель»
  await page.evaluate(() => { const s = 100, V = new Float32Array([-s, 0, -s, s, 0, -s, s, 2 * s, -s, -s, 2 * s, -s, -s, 0, s, s, 0, s, s, 2 * s, s, -s, 2 * s, s]),
    F = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]);
    owOpen({id: 'cube.stl', name: 'cube', V, T: null, F, tex: ''}, 'file'); });
  await page.waitForFunction(() => OW.on && OW.src === 'file' && OW.o3, null, {timeout: 30000});
  const r = await page.evaluate(() => ({tone: $('toneRow').offsetParent !== null, seamRow: !$('seamWRow').hidden && $('seamWRow').offsetParent !== null, tex: $('cOrigTex').disabled}));
  expect(r).toEqual({tone: true, seamRow: false, tex: true});
  await tone(page, 3);
  expect(await page.evaluate(() => [OW.o3.plaster.color.getHex() === owTone(3).color, LIGHT_CAM.key.intensity === owTone(3).key, $('toneVal').textContent])).toEqual([true, true, '3']);
  await pick(page, 'shepherd6');
  expect(await page.evaluate(() => $('seamWRow').hidden), 'вышли из режима — строки нет').toBe(true);
  expect(errs).toEqual([]);
});
