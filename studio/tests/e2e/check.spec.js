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
async function open(page,n=10){await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await page.locator('.stTab[data-tab=check]').click();await expect(page.locator('#ckSum')).toHaveText('Ошибок: '+n,{timeout:30000});}
const grp=(page,n)=>page.locator(`.ckGroup[data-rule="${n}"]`);
const openGroup=async(page,n)=>{await grp(page,n).locator('.ckGH').click();await expect(grp(page,n).locator('.ckRow, .ckInfo, .ckKept').first()).toBeVisible();};
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

// ---- по одной (Q25, Q31) и «Оставить так» (Q35) ----
// строки правила 2 образца: по три ребра у каждого из двух верхних углов (x > 0 и x < 0); рёбра одного угла — в 2 мм сайта друг от друга, углы — в 300 мм
const onRow=(page,n)=>grp(page,n).locator('.ckRow').evaluateAll(b=>b.findIndex(x=>x.classList.contains('on')));
const side=page=>page.evaluate(()=>Math.sign(window.__studio.picked()[0]));   // у какого угла выбранная строка
test('«Следующая» — к ближайшей ошибке того же правила, «Предыдущая» — назад; на последней «Следующая» выключена', async ({page}) => {
  await open(page);await openGroup(page,2);
  const next=page.locator('.ckAct .ckGoNext'),back=page.locator('.ckAct .ckGoPrev');
  await grp(page,2).locator('.ckRow').first().click();
  await expect(next).toHaveText('Следующая');await expect(back).toHaveText('Предыдущая');
  await expect(back).toBeDisabled();await expect(next).toBeEnabled();await expect(page.locator('#ckNav')).toBeHidden();
  await page.waitForTimeout(800);const c0=await cam(page),p0=await painted(page);
  const seq=[0],sides=[await side(page)];
  await next.click();seq.push(await onRow(page,2));sides.push(await side(page));
  expect(sides[1]).toBe(sides[0]);   // ближайшая на модели — у того же угла
  await expect.poll(async()=>moved(await cam(page),c0),{timeout:5000}).toBeGreaterThan(1);
  expect(await painted(page)).not.toEqual(p0);await expect(page.locator('.ckRow.on')).toHaveCount(1);
  // «Предыдущая» возвращает, «Следующая» ведёт туда же, где была
  await back.click();expect(await onRow(page,2)).toBe(0);await expect(back).toBeDisabled();
  await next.click();expect(await onRow(page,2)).toBe(seq[1]);
  // по всем шести без повторов: сначала свой угол целиком, потом другой
  for(let k=0;k<4;k++){await next.click();seq.push(await onRow(page,2));sides.push(await side(page));}
  expect([...seq].sort()).toEqual([0,1,2,3,4,5]);expect(sides.map(x=>x*sides[0])).toEqual([1,1,1,-1,-1,-1]);
  // на последней: «Следующая» выключена, клик ничего не ломает
  await expect(next).toBeDisabled();await expect(next).toHaveAttribute('title','Это последняя ошибка правила 2');
  await next.click({force:true});expect(await onRow(page,2)).toBe(seq[5]);await expect(page.locator('.ckRow.on')).toHaveCount(1);
  await back.click();expect(await onRow(page,2)).toBe(seq[4]);await back.click();expect(await onRow(page,2)).toBe(seq[3]);
  await expect(page.locator('.ckRow.on')).toHaveCount(1);await expect(grp(page,2).locator('.ckRow.on')).toHaveCount(1);   // другие правила проход не берёт
});
test('после «Сделать» вид тот же, выбор никуда не прыгает; «Следующая» ведёт от этого места', async ({page}) => {
  await open(page);await openGroup(page,2);
  await grp(page,2).locator('.ckRow').first().click();const s0=await side(page);
  await page.locator('.ckFix').click();await expect(page.locator('.ckDo')).toBeVisible({timeout:15000});
  await page.waitForTimeout(800);const c0=await cam(page);
  await page.locator('.ckDo').click();
  await expect(grp(page,2).locator('.ckN')).toHaveText('2',{timeout:15000});   // починка зеркальная: осталось по ребру у каждого угла
  const nav=page.locator('#ckNav');
  await expect(nav.locator('.ckGoNext')).toBeEnabled();await expect(nav.locator('.ckGoPrev')).toBeDisabled();
  await expect(page.locator('.ckRow.on')).toHaveCount(0);
  await page.waitForTimeout(800);expect(moved(await cam(page),c0)).toBeLessThan(1e-6);   // программа сама не перешла
  await nav.locator('.ckGoNext').click();
  const r1=await onRow(page,2);expect(r1).toBeGreaterThanOrEqual(0);expect(await side(page)).toBe(s0);   // ближайшая к починенному месту — у того же угла
  await expect(nav).toBeHidden();await expect(page.locator('.ckAct .ckGoNext')).toBeEnabled();
  await expect.poll(async()=>moved(await cam(page),c0),{timeout:5000}).toBeGreaterThan(1);
  await page.locator('.ckAct .ckGoNext').click();expect(await onRow(page,2)).toBe(1-r1);expect(await side(page)).toBe(-s0);await expect(page.locator('.ckAct .ckGoNext')).toBeDisabled();
  await page.locator('.ckAct .ckGoPrev').click();expect(await onRow(page,2)).toBe(r1);
});
test('«Оставить так»: строка ушла, запись в figure.json, после перезагрузки не вернулась', async ({page}) => {
  await open(page);await openGroup(page,10);
  await grp(page,10).locator('.ckRow').click();
  await expect(page.locator('.ckAct .ckKeep')).toHaveText('Оставить так');
  await page.locator('.ckKeep').click();
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 9',{timeout:15000});await expect(grp(page,10)).toHaveCount(0);
  await expect(grp(page,'keep').locator('.ckGT')).toHaveText('Оставлено так');await expect(grp(page,'keep').locator('.ckN')).toHaveText('1');
  await expect(grp(page,1).locator('.ckN')).toHaveText('1');await expect(grp(page,2).locator('.ckN')).toHaveText('6');   // остальное на месте
  await expect.poll(()=>read().keep.length,{timeout:3000}).toBe(1);
  const k=read().keep[0];expect(k.rule).toBe(10);expect(k.text).toBe('точки не зеркальны на 6 мм');
  [-75,-1.5,130].forEach((x,i)=>expect(k.at[i]).toBeCloseTo(x,4));
  await expect(page.locator('#stNow')).toHaveText('Открыта: Образец · сохранено',{timeout:3000});
  await open(page,9);
  await expect(grp(page,10)).toHaveCount(0);await expect(grp(page,'keep').locator('.ckN')).toHaveText('1');
  await openGroup(page,'keep');await expect(grp(page,'keep').locator('.ckKT')).toHaveText('10. точки не зеркальны на 6 мм');
});
test('«Вернуть» в группе «Оставлено так» возвращает строку в список; место без описания — названием правила', async ({page}) => {
  const f=sampleFigure();f.keep=[{rule:10,at:[-75,-1.5,130],text:'точки не зеркальны на 6 мм'},{rule:1,at:[0,-.75,65]}];
  fs.writeFileSync(path.join(WORK,SLUG,'figure.json'),JSON.stringify(f));
  await open(page,8);await openGroup(page,'keep');
  await expect(grp(page,'keep').locator('.ckN')).toHaveText('2');
  await expect(grp(page,'keep').locator('.ckKT')).toHaveText(['10. точки не зеркальны на 6 мм','1. Грань плоская']);
  await expect(grp(page,'keep').locator('.ckUnkeep').first()).toHaveText('Вернуть');
  await grp(page,'keep').locator('.ckUnkeep').first().click();
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 9',{timeout:15000});await expect(grp(page,10).locator('.ckN')).toHaveText('1');
  await expect(grp(page,'keep').locator('.ckN')).toHaveText('1');
  await expect.poll(()=>read().keep,{timeout:3000}).toEqual([{rule:1,at:[0,-.75,65]}]);
  await grp(page,'keep').locator('.ckUnkeep').click();
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10',{timeout:15000});await expect(grp(page,'keep')).toHaveCount(0);
  await expect.poll(()=>read().keep,{timeout:3000}).toEqual([]);
});

// ---- «Показать неточности» (Q23, Q30) ----
// места образца: правило 1 — низ; 2 — по ребру у срезанных углов (две грани); 6 — срезы; 10 — грани у опущенного угла (низ среди них)
const RULE_COL={1:[0xe0,0xa0,0x20],2:[0xe0,0x70,0x20],6:[0xd0,0x1f,0x1f],10:[0x2a,0x9a,0x50]};
const show=page=>page.locator('#ckShow');
const marked=page=>page.evaluate(()=>window.__studio.marked());
const lg=(page,n)=>page.locator(`#ckLeg .ckLg[data-rule="${n}"]`);
const legend=page=>page.locator('#ckLeg .ckLg').evaluateAll(b=>b.map(x=>x.dataset.rule+':'+x.querySelector('.ckLgN').textContent));
// точка экрана, где под курсором грань из списка faces (первая видимая): {x, y, f} или null
const spotOf=(page,faces)=>page.evaluate(faces=>{const m=root.children.find(c=>c.userData.pick),pos=m.geometry.getAttribute('position').array,r=renderer.domElement.getBoundingClientRect();
  for(const f of faces)for(let t=0;t<CUR.M3.T.length;t++){if(CUR.M3.T[t]!==f)continue;
    const c=k=>(pos[t*9+k]+pos[t*9+3+k]+pos[t*9+6+k])/3,p=new THREE.Vector3(c(0),c(1),c(2)).project(camera);
    const x=r.left+(p.x+1)/2*r.width,y=r.top+(1-p.y)/2*r.height;
    if(x>r.left+2&&x<r.right-2&&y>r.top+2&&y<r.bottom-2&&document.elementFromPoint(x,y)===renderer.domElement&&CUR.M3.T[pickTri({clientX:x,clientY:y})]===f)return {x,y,f};}
  return null;},faces);
const selRule=page=>page.locator('.ckRow.on').evaluate(b=>+b.closest('.ckGroup').dataset.rule);
test('«Показать неточности»: выключен; включили — места всех строк цветом правила, легенда; фильтр легендой; выключили — цвета как были', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await open(page);
  await expect(page.locator('#ckShowL')).toHaveText('Показать неточности');await expect(show(page)).not.toBeChecked();
  await expect(page.locator('#ckLeg')).toBeHidden();expect(await marked(page)).toEqual([]);
  await page.waitForTimeout(300);const col0=await faceColors(page);
  await show(page).check();
  await expect(page.locator('#ckLeg')).toBeVisible();
  expect(await legend(page)).toEqual(['1:1','2:6','6:2','10:1']);
  await expect(lg(page,2).locator('.ckLgT')).toHaveText('2. Нет коротких рёбер');
  expect(await lg(page,6).locator('.ckSw').evaluate(s=>getComputedStyle(s).backgroundColor)).toBe('rgb(208, 31, 31)');
  const M=await marked(page),col1=await faceColors(page);expect(M.length).toBeGreaterThan(4);
  // клик по строке легенды — только этот тип; повторный — снова все
  const by={};
  for(const n of [1,2,6,10]){await lg(page,n).click();await expect(lg(page,n)).toHaveAttribute('aria-pressed','true');
    by[n]=await marked(page);expect(by[n].length).toBeGreaterThan(0);
    const col=await faceColors(page);by[n].forEach(f=>expect(col[f]).toEqual(RULE_COL[n]));
    Object.keys(col).filter(f=>!by[n].includes(+f)).forEach(f=>expect(col[f]).toEqual(col0[f]));
    await lg(page,n).click();await expect(lg(page,n)).toHaveAttribute('aria-pressed','false');expect(await marked(page)).toEqual(M);}
  expect([...new Set(Object.values(by).flat())].sort((a,b)=>a-b)).toEqual(M);
  // в одном месте несколько ошибок — цвет той, что выше в списке (меньший номер правила); у образца низ — в правилах 1 и 10
  const top=f=>[1,2,6,10].find(n=>by[n].includes(f));
  expect(M.some(f=>[1,2,6,10].filter(n=>by[n].includes(f)).length>1)).toBe(true);
  M.forEach(f=>expect(col1[f]).toEqual(RULE_COL[top(f)]));
  Object.keys(col1).filter(f=>!M.includes(+f)).forEach(f=>expect(col1[f]).toEqual(col0[f]));
  // выключили — цвета модели как до включения
  await show(page).uncheck();await expect(page.locator('#ckLeg')).toBeHidden();expect(await marked(page)).toEqual([]);
  expect(await faceColors(page)).toEqual(col0);
  // подсвечены именно места строк списка: грани строк правила (клик по каждой строке) — ровно то, что легенда оставляла для правила
  for(const n of [1,2,6,10]){await openGroup(page,n);const rows=grp(page,n).locator('.ckRow'),U=new Set();
    for(let k=0;k<await rows.count();k++){await rows.nth(k).click();(await painted(page)).forEach(f=>U.add(f));}
    expect([...U].sort((a,b)=>a-b)).toEqual(by[n]);}
  expect(errs).toEqual([]);
});
test('клик по подсвеченному месту на модели выбирает его строку; без подсветки клик — как раньше', async ({page}) => {
  await open(page);
  await page.waitForTimeout(800);
  // без подсветки — выбор детали страницы, строки нет
  const any=await page.evaluate(()=>[...new Set(CUR.M3.T)]),s0=await spotOf(page,any);expect(s0).not.toBeNull();
  await page.mouse.click(s0.x,s0.y);await expect(page.locator('.ckRow.on')).toHaveCount(0);
  expect(await page.evaluate(()=>ST.sel)).toBeGreaterThanOrEqual(0);
  await page.mouse.click(s0.x,s0.y);expect(await page.evaluate(()=>ST.sel)).toBe(-1);   // второй клик снимает выбор детали
  await show(page).check();
  const M=await marked(page),s=await spotOf(page,M);expect(s).not.toBeNull();
  const col=await faceColors(page),c0=await cam(page);
  await page.locator('.stTab[data-tab=figs]').click();   // открыта другая вкладка — клик по месту вернёт «Проверку»
  await page.mouse.click(s.x,s.y);
  await expect(page.locator('#stTab-check')).toBeVisible();await expect(page.locator('.ckRow.on')).toHaveCount(1);
  const n=await selRule(page);expect(col[s.f]).toEqual(RULE_COL[n]);   // строка того правила, чьим цветом подсвечено место
  const lit=(await faceColors(page))[s.f];RULE_COL[n].forEach((x,k)=>expect(Math.abs(lit[k]-(x+255)/2)).toBeLessThanOrEqual(1));   // выбранное место светлее остальных мест правила
  await expect(grp(page,n).locator('.ckAct')).toBeVisible();expect(await painted(page)).toContain(s.f);
  expect(await page.evaluate(()=>ST.sel)).toBe(-1);   // клик забрала Проверка: деталь страницы не выбрана
  await page.waitForTimeout(600);expect(moved(await cam(page),c0)).toBeLessThan(1e-6);   // камера на месте: место и так перед глазами
  // в режиме правки клик выбирает и строку, и грань редактора
  await page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;renderAll();});await page.waitForTimeout(300);
  const s2=await spotOf(page,M);expect(s2).not.toBeNull();
  await page.mouse.click(s2.x,s2.y);
  await expect.poll(()=>page.evaluate(()=>ST.sp)).toBe(s2.f);expect(await painted(page)).toContain(s2.f);
});
test('после правки подсветка и числа в легенде обновились; «Отменить» — как было', async ({page}) => {
  await open(page);await show(page).check();
  expect(await legend(page)).toEqual(['1:1','2:6','6:2','10:1']);const M0=await marked(page);
  await openGroup(page,1);await grp(page,1).locator('.ckRow').click();await page.locator('.ckFix').click();
  await page.locator('.ckDo').click({timeout:15000});
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 9',{timeout:15000});
  await expect.poll(()=>legend(page)).toEqual(['2:6','6:2','10:1']);
  const M1=await marked(page),col=await faceColors(page);expect(M1.length).toBeGreaterThan(0);
  M1.forEach(f=>expect([RULE_COL[2],RULE_COL[6],RULE_COL[10]]).toContainEqual(col[f]));
  expect(Object.values(col).some(c=>c.join()===RULE_COL[1].join())).toBe(false);
  await page.locator('#ckUndo').click();
  await expect(page.locator('#ckSum')).toHaveText('Ошибок: 10',{timeout:15000});
  await expect.poll(()=>legend(page)).toEqual(['1:1','2:6','6:2','10:1']);expect(await marked(page)).toEqual(M0);
});
test('«Показать неточности» и другой переключатель вида (__studio.solo, «Карта отклонений») выключают друг друга', async ({page}) => {
  await open(page);
  await page.evaluate(()=>{window.__off=0;window.__mapOn=window.__studio.solo('map',()=>{window.__off++;});});
  await show(page).check();expect(await page.evaluate(()=>window.__off)).toBe(1);
  await page.evaluate(()=>window.__mapOn());
  await expect(show(page)).not.toBeChecked();await expect(page.locator('#ckLeg')).toBeHidden();expect(await marked(page)).toEqual([]);
  expect(await page.evaluate(()=>window.__off)).toBe(1);   // свой off не зовётся
  // после перезагрузки снова выключен
  await show(page).check();await open(page);await expect(show(page)).not.toBeChecked();expect(await marked(page)).toEqual([]);
});
