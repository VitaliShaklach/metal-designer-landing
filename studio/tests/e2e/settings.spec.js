// вкладка «Настройки» мастерской (#115) на фигуре-образце (studio/tests/helpers.js sampleFigure): npm run test:studio:e2e
// У образца одна строка правила 1 — неплоскость 1,5 мм. Порог плоскости 1 → 3 — строки нет, «Вернуть как было» — снова есть.
// Пороги двух видов (решения Q4, Q27): «Для открытой фигуры» — figure.th (уходит с фигурой), «Для всех фигур» — work/settings.json.
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const {sampleFigure}=require('../helpers.js');
const WORK=path.join(__dirname,'..','.work'),SLUG='obrazec',SETTINGS=path.join(WORK,'settings.json');
const read=()=>JSON.parse(fs.readFileSync(path.join(WORK,SLUG,'figure.json'),'utf8'));
const common=()=>fs.existsSync(SETTINGS)?JSON.parse(fs.readFileSync(SETTINGS,'utf8')).th:null;
test.describe.configure({mode:'serial'});
// образец и чистые настройки — перед каждым тестом (settings.json иначе переживает тест)
test.beforeEach(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(path.join(WORK,SLUG),{recursive:true});
  fs.writeFileSync(path.join(WORK,SLUG,'figure.json'),JSON.stringify(sampleFigure()));fs.writeFileSync(path.join(WORK,'state.json'),JSON.stringify({last:SLUG}));});
test.afterAll(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(WORK,{recursive:true});});

const grp=(page,n)=>page.locator(`.ckGroup[data-rule="${n}"]`);
const inp=(page,k)=>page.locator(`.setIn[data-k="${k}"]`);
// открыть образец, дождаться списка Проверки (n ошибок) и перейти на «Настройки»
async function open(page,n=10){await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await page.locator('.stTab[data-tab=check]').click();await expect(page.locator('#ckSum')).toHaveText('Ошибок: '+n,{timeout:30000});
  await page.locator('.stTab[data-tab=set]').click();await expect(page.locator('#stTab-set')).toBeVisible();}
// сколько ошибок и строк правила 1 в Проверке (вкладку переключает туда и обратно)
async function rule1(page,n,rows){await page.locator('.stTab[data-tab=check]').click();await expect(page.locator('#ckSum')).toHaveText('Ошибок: '+n,{timeout:30000});
  await expect(grp(page,1)).toHaveCount(rows?1:0);if(rows)await expect(grp(page,1).locator('.ckN')).toHaveText(String(rows));
  await page.locator('.stTab[data-tab=set]').click();}
const put=async(page,k,v)=>{await inp(page,k).fill(v);await inp(page,k).press('Enter');};

test('вкладка «Настройки» через __studio.tab: пороги правил с подписями и единицами, плоскость 1 мм', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await open(page);
  await expect(page.locator('.stTab[data-tab=set]')).toHaveText('Настройки');
  expect(await page.evaluate(()=>window.__studio.tab('set','x')===document.getElementById('stTab-set'))).toBe(true);   // та же вкладка: добавлена через tab
  expect(await page.locator('.setIn').evaluateAll(a=>a.map(x=>x.dataset.k))).toEqual(['planar','edge','near','ang','lineLo','lineHi','width','seam','sym','ref']);
  await expect(inp(page,'planar')).toHaveValue('1');await expect(inp(page,'lineHi')).toHaveValue('179,5');await expect(inp(page,'sym')).toHaveValue('0,1');
  const row=k=>page.locator(`.setRow[data-k="${k}"]`);
  await expect(row('planar').locator('.setU')).toHaveText('мм');await expect(row('ang').locator('.setU')).toHaveText('°');
  await expect(page.locator('.setGrp[data-rule="1"] .setRule')).toHaveText('1. Грань плоская');await expect(page.locator('.setGrp[data-rule="5"] .setRow')).toHaveCount(2);
  await expect(page.locator('.setGrp[data-rule="1"] .setRow[data-k=planar]')).toHaveCount(1);await expect(row('planar').locator('.setL')).toHaveText('неплоскость грани не больше');
  await expect(page.locator('#setFig')).toBeChecked();await expect(page.locator('#setAll')).not.toBeChecked();
  await expect(page.locator('#setReset')).toHaveText('Вернуть как было');
  expect((await page.locator('#studioPanel').boundingBox()).width).toBe(320);
  expect(await page.evaluate(()=>{const b=document.querySelector('#stBody');return b.scrollWidth<=b.clientWidth;})).toBe(true);
  expect(errs).toEqual([]);
});

test('для открытой фигуры: плоскость 1 → 3 — строки правила 1 пропали; после перезагрузки 3; «Вернуть как было» — вернулись', async ({page}) => {
  await open(page);
  await put(page,'planar','3');
  await expect(page.locator('.setRow[data-k=planar] .setOwn')).toBeVisible();
  await rule1(page,9,0);
  await expect.poll(()=>read().th&&read().th.planar,{timeout:5000}).toBe(3);expect(common()).toBe(null);   // общие настройки не тронуты
  await page.reload();await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await rule1(page,9,0);await expect(inp(page,'planar')).toHaveValue('3');
  await page.locator('#setReset').click();
  await expect(inp(page,'planar')).toHaveValue('1');await expect(page.locator('.setOwn')).toHaveCount(0);
  await rule1(page,10,1);
  await expect.poll(()=>'th' in read(),{timeout:5000}).toBe(false);
});

test('для всех фигур: порог в work/settings.json, переживает перезагрузку; своё у фигуры — поверх общего; «Вернуть как было»', async ({page}) => {
  await open(page);
  await page.locator('#setAll').check();
  await put(page,'planar','3,5');await expect(inp(page,'planar')).toHaveValue('3,5');
  await expect.poll(()=>common()&&common().planar,{timeout:5000}).toBe(3.5);
  await rule1(page,9,0);
  await page.reload();await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await rule1(page,9,0);
  await expect(page.locator('#setFig')).toBeChecked();await expect(inp(page,'planar')).toHaveValue('3,5');await expect(page.locator('.setOwn')).toHaveCount(0);   // фигура берёт общее
  await put(page,'planar','1,2');await rule1(page,10,1);   // своё у фигуры строже общего: строка 1,5 мм вернулась
  await page.locator('#setAll').check();await expect(inp(page,'planar')).toHaveValue('3,5');
  await page.locator('#setReset').click();await expect(inp(page,'planar')).toHaveValue('1');
  await expect.poll(()=>common()&&common().planar,{timeout:5000}).toBe(1);
  await expect.poll(()=>read().th&&read().th.planar,{timeout:5000}).toBe(1.2);   // своё у фигуры общий «Вернуть как было» не трогает
  await rule1(page,10,1);
});

test('не число, ноль и отрицательное не принимаются: сообщение, прежнее значение, список не сломался', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await open(page);
  for(const v of ['abc','-1','0','']){await put(page,'planar',v);
    await expect(page.locator('#setMsg')).toHaveClass(/bad/);await expect(page.locator('#setMsg')).toContainText('больше нуля');
    await expect(inp(page,'planar')).toHaveValue('1');}
  await put(page,'lineLo','179,6');await expect(page.locator('#setMsg')).toContainText('меньше');await expect(inp(page,'lineLo')).toHaveValue('172');
  await page.locator('#setAll').check();await put(page,'edge','-2');await expect(page.locator('#setMsg')).toContainText('больше нуля');await expect(inp(page,'edge')).toHaveValue('5');
  await rule1(page,10,1);
  await page.waitForTimeout(700);expect('th' in read()).toBe(false);expect(common()).toBe(null);
  await put(page,'planar','3');await expect(page.locator('#setMsg')).not.toHaveClass(/bad/);await rule1(page,9,0);   // после ошибки обычное значение принимается
  expect(errs).toEqual([]);
});

test('рабочей копии нет: «Для открытой фигуры» выключено, общие пороги меняются', async ({page}) => {
  fs.writeFileSync(path.join(WORK,'state.json'),JSON.stringify({last:null}));
  await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toContainText('фигура с сайта',{timeout:30000});
  await page.locator('.stTab[data-tab=set]').click();
  await expect(page.locator('#setFig')).toBeDisabled();await expect(page.locator('#setAll')).toBeChecked();
  await put(page,'planar','2');await expect.poll(()=>common()&&common().planar,{timeout:5000}).toBe(2);
  // открыли копию — она берёт общее, вид снова «Для открытой фигуры»
  await page.locator('.stTab[data-tab=figs]').click();await page.locator('.stFig[data-slug=obrazec]').click();
  await expect(page.locator('#stNow')).toHaveText(/Открыта: Образец/,{timeout:30000});
  await page.locator('.stTab[data-tab=set]').click();await expect(page.locator('#setFig')).toBeChecked();await expect(inp(page,'planar')).toHaveValue('2');
  await rule1(page,9,0);
});

test('общий порог, с которым свои пороги фигуры не годятся: предупреждение, Проверка берёт общие и не ломается', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await open(page);
  await put(page,'lineLo','175');await expect(page.locator('.setRow[data-k=lineLo] .setOwn')).toBeVisible();await expect(page.locator('#setWarn')).toBeHidden();
  await page.locator('#setAll').check();await put(page,'lineHi','174');
  await expect.poll(()=>common()&&common().lineHi,{timeout:5000}).toBe(174);
  await expect(page.locator('#setWarn')).toBeVisible();await expect(page.locator('#setWarn')).toContainText('Проверка берёт общие');
  await rule1(page,10,1);
  await page.locator('#setFig').check();await page.locator('#setReset').click();await expect(page.locator('#setWarn')).toBeHidden();
  expect(errs).toEqual([]);
});
