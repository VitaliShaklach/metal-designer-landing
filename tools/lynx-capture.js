// Сборщик рыси для лендинга (только для разработки): node tools/lynx-capture.js <версия>
// Забирает из C:\dev\metal-designer модель, цифры и картинки рыси и кладёт в lynx/. C:\dev только читается
const vm = require('node:vm');

// Текст plates-lynxN.js → {version, name, H, V, P}. V и P — как есть: V — мм×10, P — углы граней, -1 — конец грани
function polyToModel(src, version) {
  const ctx = {MODELS_POLY: {}, FIGURES: {}, modelPoly: () => null};
  vm.runInNewContext(src, ctx);
  const id = 'lynx' + version, poly = ctx.MODELS_POLY[id], fig = ctx.FIGURES[id];
  if (!poly || !fig) throw new Error(`В файле нет модели ${id}`);
  // Массивы из vm — из чужого контекста: копируем в свои
  return {version, name: fig.name, H: fig.H, V: Array.from(poly.V), P: Array.from(poly.P)};
}

const plural = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

// Строки таблицы «Итого» страницы рыси ([подпись, значение]) → плитки для лендинга, как у drawStats() мангала.
// Строку ищем по началу подписи
function statsTiles(rows, {H, t, mat}) {
  const pick = label => {
    const r = rows.find(([l]) => l.startsWith(label));
    if (!r) throw new Error(`В таблице «Итого» нет строки «${label}…»`);
    if (!/\d/.test(r[1])) throw new Error(`В таблице «Итого» у строки «${r[0]}» нет числа: «${r[1]}»`);
    return r[1];
  };
  const n = parseInt(pick('Деталей'), 10);
  return [
    [`${n} ${plural(n, 'деталь', 'детали', 'деталей')}`, 'из листа'],
    [pick('Масса'), 'металла'],
    [`рез ${pick('Длина реза')}`, 'длина реза'],
    [`${H} мм`, 'высота'],
    [`${mat.toLowerCase()} ${t}`, 'толщина металла'],
  ];
}

module.exports = {polyToModel, statsTiles};

const DEV = 'C:/dev/metal-designer';
const PHOTOS = ['2_Poing_07_anfas.jpg', '3_Hellabrunn_profil.jpg', '3_Hellabrunn_szadi.jpg'];
const JPEG = {type: 'jpeg', quality: 80};
// Поверх 3D — кнопки видов, подсказки, подписи: на снимке их нет
const HIDE = '#stage > :not(canvas) { display: none !important; }';

// Рысь считается долго, раскрой — минутами: ждём до 10 минут
const LONG = 10 * 60 * 1000;

// Свободный порт на этом компьютере: 8010 и соседние бывают заняты другими серверами
function freePort() {
  const net = require('node:net');
  return new Promise((ok, fail) => {
    const srv = net.createServer().once('error', fail).listen(0, '127.0.0.1', () => {
      const {port} = srv.address();
      srv.close(() => ok(port));
    });
  });
}

async function serverUp(url) {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Сервер ${url} не поднялся`);
}

// Дождаться, пока страница построит фигуру из адреса (#f=). Фигуры нет в lynx.html — страница молча
// открывает другую: тогда ошибка, а не картинки чужой версии
async function waitBuilt(page, id) {
  await page.waitForFunction(() => document.getElementById('loading').hidden && document.querySelector('#parts tr'),
    null, {timeout: LONG, polling: 500});
  const shown = await page.$eval('#figSel', s => s.value);
  if (shown !== id) throw new Error(`В lynx.html нет фигуры ${id} (открылась ${shown})`);
}

// Фигура в 3D, вид «3D» (изометрия), в режиме #og страницы: он для картинок — без подсветки
// узких деталей и врезок и без номеров. Отдельная вкладка поуже, чтобы фигура была крупнее в кадре
async function shotFigure(browser, url, id) {
  const page = await browser.newPage({viewport: {width: 800, height: 900}});
  try {
    await page.goto(`${url}#f=${id}&og&v=iso`);
    await waitBuilt(page, id);
    await page.waitForTimeout(1500);
    return await page.locator('#stage').screenshot({...JPEG, style: HIDE});
  } finally {
    await page.close();
  }
}

// Вкладка считает прямо в обработчике клика (раскрой — минутами), и обычный клик не дожидается конца.
// Жмём из самой страницы и сразу возвращаемся; готовность ждёт вызывающий
function openTab(page, tab) {
  return page.$eval(`[data-tab="${tab}"]`, b => { setTimeout(() => b.click(), 0); });
}

// Первый лист вкладки: раскрой или чертежи
async function shotFirstSheet(page, tab, box) {
  await openTab(page, tab);
  const svg = page.locator(`#${box} figure.sheet svg`).first();
  await svg.waitFor({timeout: LONG});
  return svg.screenshot(JPEG);
}

// Фото уменьшить до ширины 1200 px: показать в странице и снять элемент
async function shotPhoto(page, file) {
  const b64 = require('node:fs').readFileSync(file).toString('base64');
  await page.setContent(`<body style="margin:0"><img id="p" style="display:block;width:1200px" src="data:image/jpeg;base64,${b64}"></body>`);
  await page.waitForFunction(() => document.getElementById('p').complete);
  return page.locator('#p').screenshot(JPEG);
}

async function capture(version, rework) {
  const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
  const {chromium} = require('@playwright/test');

  // Всё собираем в память и пишем в lynx/ только в конце: упало посередине — прежние файлы целы
  const out = {}, id = 'lynx' + version;
  const model = polyToModel(fs.readFileSync(path.join(DEV, 'art', 'private', `plates-${id}.js`), 'utf8'), version);
  out['model.json'] = JSON.stringify(model);

  // http.server только отдаёт файлы и ничего не пишет в папку; слушает только этот компьютер.
  // Нет python — ошибка в serverUp, а не падение процесса без уборки
  const port = await freePort();
  const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', DEV], {stdio: 'ignore'});
  server.on('error', e => console.error('Не запустился python:', e.message));
  let browser = null;
  try {
    browser = await chromium.launch({args: ['--enable-unsafe-swiftshader']});
    const url = `http://127.0.0.1:${port}/art/private/lynx.html`;
    await serverUp(url);

    // Сначала быстрое: ошибка всплывёт сразу, а не после раскроя
    console.log(`Рысь ${version}: картинка 3D…`);
    out['poster.jpg'] = await shotFigure(browser, url, id);
    console.log(`Переработка (${rework})…`);
    out['rework.jpg'] = await shotFigure(browser, url, rework);

    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    page.on('pageerror', e => console.error('Ошибка на странице:', e.message));
    for (const [i, f] of PHOTOS.entries())
      out[`photo-${i + 1}.jpg`] = await shotPhoto(page, path.join(DEV, '..', 'lynx_meshy', f));

    console.log('Раскрой (до 10 минут)…');
    await page.goto(`${url}#f=${id}`);
    await waitBuilt(page, id);
    out['nest.jpg'] = await shotFirstSheet(page, 'nest', 'nestBox');
    console.log('Чертежи…');
    out['sheet.jpg'] = await shotFirstSheet(page, 'sheets', 'sheets');

    await openTab(page, 'sum');
    await page.locator('#sum tr').first().waitFor({timeout: LONG});
    const rows = await page.$$eval('#sum tr', trs => trs.map(tr => [...tr.cells].map(c => c.textContent.trim())));
    const sel = id => page.$eval(id, s => s.selectedOptions[0].textContent.trim());
    const tiles = statsTiles(rows, {H: model.H, t: await sel('#sT'), mat: await sel('#sMat')});
    out['stats.json'] = JSON.stringify({version, tiles}, null, 1);
  } finally {
    // Сервер — первым: если браузер не закроется, python всё равно не останется держать порт
    server.kill();
    if (browser) await browser.close();
  }

  const dir = path.join(__dirname, '..', 'lynx');
  fs.mkdirSync(dir, {recursive: true});
  for (const [name, data] of Object.entries(out)) fs.writeFileSync(path.join(dir, name), data);
  console.log(`Готово: ${Object.keys(out).length} файлов в lynx/`);
}

if (require.main === module) {
  const args = process.argv.slice(2), at = args.indexOf('--rework');
  const rework = at >= 0 ? args.splice(at, 2)[1] : 'lynx';
  const version = Number(args[0] || 5);
  if (!Number.isInteger(version) || version < 1 || !rework) {
    console.error('Запуск: npm run lynx -- <версия> [--rework <id фигуры>]');
    process.exit(1);
  }
  capture(version, rework).catch(e => { console.error('Не собрал рысь:', e.message); process.exit(1); });
}
