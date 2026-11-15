// мастерская в браузере: npm run test:studio:e2e
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const WORK=path.join(__dirname,'..','.work');
const figFile=slug=>path.join(WORK,slug,'figure.json');
const read=slug=>JSON.parse(fs.readFileSync(figFile(slug),'utf8'));
test.describe.configure({mode:'serial'});
test.beforeAll(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(WORK,{recursive:true});});

test('на странице есть панель мастерской, без ошибок в консоли', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('/editor/lynx/');
  await expect(page.locator('#studioPanel')).toBeVisible();await expect(page.locator('#stHead')).toHaveText('Мастерская');
  await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  expect(errs).toEqual([]);
});
test('«Открыть опубликованную» → «Рысь» → в 3D «Рысь 2»', async ({page}) => {
  await page.goto('/editor/lynx/');await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  await page.locator('#stPub').click();await page.locator('.stPubItem',{hasText:'Рысь'}).click();
  await expect(page.locator('#mName')).toHaveValue('Рысь 2',{timeout:30000});
  await expect(page.locator('.stFig.on')).toContainText('Рысь 2');
  expect(await page.evaluate(()=>ST.fig)).toBe('');expect(await page.evaluate(()=>ST.base.P.length)).toBe(read('rys-2').P.length);
});
test('разрез сохраняется за 1 с; после перезагрузки граней столько же, «Отменить» откатывает', async ({page}) => {
  await page.goto('/editor/lynx/');await expect(page.locator('#mName')).toHaveValue('Рысь 2',{timeout:30000});   // при старте открывается последняя
  const n0=read('rys-2').P.length,m0=fs.statSync(figFile('rys-2')).mtimeMs;
  await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR&&window.__studio&&window.__studio.cur());
  await page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});
  await expect.poll(()=>read('rys-2').P.length,{timeout:1000,intervals:[50]}).toBeGreaterThan(n0);
  const n1=read('rys-2').P.length;expect(fs.statSync(figFile('rys-2')).mtimeMs).toBeGreaterThan(m0);
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(WORK,'rys-2','undo.json'),'utf8')).undo.length,{timeout:1500}).toBeGreaterThan(0);
  await page.reload();await expect(page.locator('#mName')).toHaveValue('Рысь 2',{timeout:30000});
  await page.waitForFunction(()=>window.__studio&&window.__studio.cur());
  expect(await page.evaluate(()=>ST.base.P.length)).toBe(n1);
  await page.evaluate(()=>$('bUndo').click());   // кнопка в блоке «Править фигуру» — после перезагрузки он свёрнут
  expect(await page.evaluate(()=>ST.base.P.length)).toBe(n0);
  await expect.poll(()=>read('rys-2').P.length,{timeout:1500}).toBe(n0);   // и «Отменить» сохраняется
});
