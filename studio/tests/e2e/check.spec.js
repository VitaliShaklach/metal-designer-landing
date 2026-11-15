// вкладка «Проверка» мастерской на фигуре-образце (studio/tests/helpers.js sampleFigure): npm run test:studio:e2e
// Файл идёт раньше studio.spec.js (по алфавиту); тот в начале сам чистит рабочую папку.
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const {sampleFigure}=require('../helpers.js');
const WORK=path.join(__dirname,'..','.work'),SLUG='obrazec';
const read=()=>JSON.parse(fs.readFileSync(path.join(WORK,SLUG,'figure.json'),'utf8'));
const NO_COPY='Проверка работает с рабочей копией. Откройте её на вкладке «Фигуры»';
test.describe.configure({mode:'serial'});
// образец кладётся заново перед каждым тестом: тесты друг от друга не зависят
test.beforeEach(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(path.join(WORK,SLUG),{recursive:true});
  fs.writeFileSync(path.join(WORK,SLUG,'figure.json'),JSON.stringify(sampleFigure()));fs.writeFileSync(path.join(WORK,'state.json'),JSON.stringify({last:SLUG}));});
test.afterAll(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(WORK,{recursive:true});});

// открыть мастерскую на образце и вкладку «Проверка»; ждать, пока список посчитается
async function open(page){await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await page.locator('.stTab[data-tab=check]').click();await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10',{timeout:30000});}
const grp=(page,n)=>page.locator(`.ckGroup[data-rule="${n}"]`);
const openGroup=async(page,n)=>{await grp(page,n).locator('.ckGH').click();await expect(grp(page,n).locator('.ckRow, .ckInfo').first()).toBeVisible();};
const cam=page=>page.evaluate(()=>window.__studio.cam());
const painted=page=>page.evaluate(()=>window.__studio.painted());
// цвет каждой грани в 3D: номер грани → [r, g, b] 0…255
const faceColors=page=>page.evaluate(()=>{const m=root.children.find(c=>c.userData.pick),col=m.geometry.getAttribute('color').array,by={};
  CUR.M3.T.forEach((pi,fi)=>{by[pi]=[col[fi*9],col[fi*9+1],col[fi*9+2]].map(x=>Math.round(x*255));});return by;});
const moved=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));

test('список: группы по правилам с числами, «Сведения»; вкладка «Фигуры» работает как раньше', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await open(page);
  await expect(page.locator('.stTab[data-tab=check]')).toHaveText('Проверка');await expect(page.locator('#stTab-check')).toBeVisible();
  expect(await page.locator('.ckGroup').evaluateAll(g=>g.map(x=>x.dataset.rule+':'+x.querySelector('.ckN').textContent))).toEqual(['1:1','2:6','6:2','10:1','info:1']);
  await expect(grp(page,1).locator('.ckGT')).toHaveText('1. Грань плоская');await expect(grp(page,'info').locator('.ckGT')).toHaveText('Сведения');
  await expect(page.locator('.ckRow')).toHaveCount(0);   // группы свёрнуты
  await openGroup(page,2);await expect(grp(page,2).locator('.ckRow')).toHaveCount(6);await expect(grp(page,2).locator('.ckRow').first()).toHaveText('ребро 4 мм');
  await openGroup(page,'info');await expect(grp(page,'info').locator('.ckInfo')).toHaveText('Эталона нет: похожесть меряю от открытой фигуры');
  await grp(page,2).locator('.ckGH').click();await expect(grp(page,2).locator('.ckRow')).toHaveCount(0);   // свернули
  expect(await painted(page)).toEqual([]);
  // «Фигуры» — как раньше; колонка не шире 320 px и без прокрутки вбок
  await page.locator('.stTab[data-tab=figs]').click();await expect(page.locator('.stFig.on')).toContainText('Образец · открыта');await expect(page.locator('#stPub')).toBeVisible();
  await page.locator('.stTab[data-tab=check]').click();await openGroup(page,6);
  expect((await page.locator('#studioPanel').boundingBox()).width).toBe(320);
  expect(await page.evaluate(()=>{const b=document.querySelector('#stBody');return b.scrollWidth<=b.clientWidth;})).toBe(true);
  expect(errs).toEqual([]);
});
test('клик по строке: камера летит к месту, грани места подкрашены цветом правила', async ({page}) => {
  await open(page);await openGroup(page,2);
  const c0=await cam(page),col0=await faceColors(page);
  await grp(page,2).locator('.ckRow').first().click();
  await expect(grp(page,2).locator('.ckRow').first()).toHaveClass(/on/);
  await expect.poll(async()=>moved(await cam(page),c0),{timeout:5000}).toBeGreaterThan(50);
  const f2=await painted(page);expect(f2.length).toBe(2);   // ребро — две его грани
  const col=await faceColors(page);
  f2.forEach(f=>expect(col[f]).toEqual([0xe0,0x70,0x20]));
  Object.keys(col).filter(f=>!f2.includes(+f)).forEach(f=>{expect(col[f]).not.toEqual([0xe0,0x70,0x20]);expect(col[f]).toEqual(col0[f]);});
  // камера смотрит на место: цель — середина ребра (мм сайта; у образца верхние углы на y = 400)
  await page.waitForTimeout(800);const c1=await cam(page);expect(c1[4]).toBeGreaterThan(390);expect(moved(c1.slice(0,3),c1.slice(3))).toBeLessThan(moved(c0.slice(0,3),c0.slice(3))+1);
  // другая строка — другая подкраска, цвет её правила
  await openGroup(page,1);await grp(page,1).locator('.ckRow').click();
  const f1=await painted(page);expect(f1.length).toBe(1);expect((await faceColors(page))[f1[0]]).toEqual([0xe0,0xa0,0x20]);
  await expect(page.locator('.ckRow.on')).toHaveCount(1);
  // выбрали фигуру сайта — копия закрыта: списка и подкраски нет
  await page.locator('#figSel').selectOption('lynx14');
  await expect(page.locator('#ckSum')).toHaveText(NO_COPY);await expect(page.locator('.ckGroup')).toHaveCount(0);expect(await painted(page)).toEqual([]);
});
test('«Исправить» → предпросмотр «уйдёт на … мм» → «Сделать» → строк меньше; «Отменить» возвращает', async ({page}) => {
  await open(page);await openGroup(page,1);
  const before=read();
  await grp(page,1).locator('.ckRow').click();
  await expect(page.locator('.ckAct .ckFix')).toHaveText('Исправить');await page.locator('.ckFix').click();
  await expect(page.locator('.ckPrev')).toHaveText('Форма уйдёт на 1,5 мм. После правки до открытой фигуры — не дальше 1,5 мм',{timeout:15000});
  await expect(page.locator('.ckWorse')).toHaveCount(0);
  // «Не надо» — фигура та же, снова «Исправить»
  await page.locator('.ckNo').click();await expect(page.locator('.ckFix')).toBeVisible();await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10');
  await page.locator('.ckFix').click();await expect(page.locator('.ckDo')).toHaveText('Сделать',{timeout:15000});
  await page.waitForTimeout(800);const c0=await cam(page);
  await page.locator('.ckDo').click();
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 9',{timeout:15000});await expect(grp(page,1)).toHaveCount(0);
  await expect(page.locator('#ckDone')).toContainText('Сделано: грань неплоская на 1,5 мм');
  expect(await painted(page)).toEqual([]);expect(moved(await cam(page),c0)).toBeLessThan(1e-6);   // после «Сделать» программа никуда не летит
  await expect.poll(()=>JSON.stringify(read().V)!==JSON.stringify(before.V),{timeout:3000}).toBe(true);   // правка ушла на диск
  await expect(page.locator('#stNow')).toHaveText('Открыта: Образец · сохранено',{timeout:3000});
  // «Отменить» возвращает одну эту правку
  await page.locator('#ckUndo').click();
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10',{timeout:15000});await expect(grp(page,1).locator('.ckN')).toHaveText('1');await expect(page.locator('#ckDone')).toBeHidden();
  await expect.poll(()=>{const f=read();return f.V.length===before.V.length&&f.V.every((p,i)=>p.every((x,k)=>Math.abs(x-before.V[i][k])<1e-6));},{timeout:3000}).toBe(true);
});
test('правка, от которой растёт другое правило: «появятся новые ошибки: …», «Сделать» работает', async ({page}) => {
  await open(page);await openGroup(page,6);
  await grp(page,6).locator('.ckRow').first().click();await page.locator('.ckFix').click();
  await expect(page.locator('.ckWorse')).toContainText('появятся новые ошибки: ',{timeout:15000});
  await expect(page.locator('.ckWorse')).toContainText('«Нет близких точек без ребра между ними (ступенька)» (было 0, станет ');
  await expect(page.locator('.ckPrev')).toHaveText(/Форма уйдёт на [\d,]+ мм/);
  await page.locator('.ckDo').click();
  await expect(grp(page,3)).toHaveCount(1,{timeout:15000});await expect(grp(page,6).locator('.ckN')).toHaveText('1');
  await page.locator('#ckUndo').click();await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10',{timeout:15000});await expect(grp(page,3)).toHaveCount(0);
});
test('правка, которую автоматика сделать не может: причина словами, фигура не изменилась', async ({page}) => {
  await open(page);await openGroup(page,10);
  const before=JSON.stringify(read()),n=await page.evaluate(()=>JSON.stringify([ST.base.V,ST.base.P]));
  await grp(page,10).locator('.ckRow').click();await page.locator('.ckFix').click();
  await expect(page.locator('.ckWhy')).toHaveText('Починить нельзя: правка уведёт форму от открытой фигуры на 3 мм (допуск 2 мм)',{timeout:15000});
  await expect(page.locator('.ckDo')).toHaveCount(0);await expect(page.locator('#ckDone')).toBeHidden();
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>JSON.stringify([ST.base.V,ST.base.P]))).toBe(n);expect(JSON.stringify(read())).toBe(before);
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10');
});
test('ручная правка в редакторе → список обновился сам; «Отменить» страницы — тоже', async ({page}) => {
  await open(page);await openGroup(page,2);
  await grp(page,2).locator('.ckRow').first().click();await page.locator('.ckFix').click();await expect(page.locator('.ckDo')).toBeVisible({timeout:15000});
  // «Разрезать пополам» грань 0 руками: появился шов без излома — правило 7; предпросмотр прежней фигуры снят
  await page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});
  await expect(grp(page,7)).toHaveCount(1,{timeout:15000});await expect(page.locator('.ckDo')).toHaveCount(0);
  await expect(page.locator('#ckSum')).not.toHaveText('Ошибок: 10');
  await page.evaluate(()=>$('bUndo').click());
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10',{timeout:15000});await expect(grp(page,7)).toHaveCount(0);
});
test('после правки строки старого списка не нажимаются, пока не пришёл новый; подкраска старых граней снята', async ({page}) => {
  // ответы фонового потока можно придержать: window.__hold = true — копятся в window.__held
  await page.addInitScript(()=>{const W0=window.Worker;window.__held=[];
    window.Worker=function(u,o){const w=new W0(u,o);let h=null;Object.defineProperty(w,'onmessage',{set(f){h=f;},get(){return h;}});
      w.addEventListener('message',e=>{const go=()=>h&&h(e);if(window.__hold)window.__held.push(go);else go();});return w;};});
  await open(page);await openGroup(page,2);await grp(page,2).locator('.ckRow').first().click();
  expect((await painted(page)).length).toBe(2);
  await page.evaluate(()=>{window.__hold=true;ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});
  await expect(grp(page,2).locator('.ckRow').first()).toBeDisabled();
  await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__held.length)).toBeGreaterThan(0);   // ответ точно придержан
  const col=await faceColors(page);expect(Object.values(col).some(c=>c[0]===0xe0&&c[1]===0x70&&c[2]===0x20)).toBe(false);   // старые номера граней не красим
  await grp(page,2).locator('.ckRow').first().click({force:true});await expect(page.locator('.ckAct')).toHaveCount(0);   // клик по старому списку ничего не делает
  await page.evaluate(()=>{window.__hold=false;window.__held.splice(0).forEach(f=>f());});
  await expect(grp(page,7)).toHaveCount(1,{timeout:15000});await expect(grp(page,2).locator('.ckRow').first()).toBeEnabled();
});
