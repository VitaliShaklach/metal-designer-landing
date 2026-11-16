// мастерская в браузере: npm run test:studio:e2e
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const WORK=path.join(__dirname,'..','.work');
const figFile=slug=>path.join(WORK,slug,'figure.json');
const read=slug=>JSON.parse(fs.readFileSync(figFile(slug),'utf8'));
const SITE='На экране фигура с сайта. Её правки не сохраняются';
const split=page=>page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});   // «Разрезать пополам» грань 0
test.describe.configure({mode:'serial'});
test.beforeAll(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(WORK,{recursive:true});});

test('пустая мастерская: колонка слева, подсказка, с чего начать, состояние «фигура с сайта»', async ({page}) => {
  // стоит первым после beforeAll, пока в .work пусто
  await page.goto('/editor/lynx/');await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  const p=await page.locator('#studioPanel').boundingBox(),w=await page.locator('.wrap').boundingBox();
  expect(p.x).toBe(0);expect(p.width).toBe(320);expect(p.height).toBeGreaterThanOrEqual(880);expect(w.x).toBeGreaterThanOrEqual(320);   // колонка не закрывает страницу
  expect((await page.locator('.edbar-back').boundingBox()).x).toBeGreaterThanOrEqual(320);   // и полосу сверху («← Все изделия»)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);   // прокрутки вбок не появилось
  await expect(page.locator('.stTab[data-tab=figs]')).toHaveText('Фигуры');
  await expect(page.locator('#stPub')).toHaveText('Взять фигуру с сайта');
  await expect(page.locator('.stEmpty')).toHaveText('Фигур пока нет. Нажмите «Взять фигуру с сайта»');
  await expect(page.locator('.stHint')).toHaveText('Ваши рабочие копии. Правки сохраняются сами');
  await expect(page.locator('#stNow')).toHaveText(SITE);
  await page.locator('#stHead').click();expect((await page.locator('.wrap').boundingBox()).x).toBeLessThan(320);   // свернули — страница вернулась
  expect((await page.locator('#studioPanel').boundingBox()).height).toBeLessThan(80);   // осталась узкая кнопка в углу
  await page.locator('#stHead').click();await expect(page.locator('#stPub')).toBeVisible();
  const t=await page.evaluate(()=>{const a=window.__studio.tab('check','Проверка'),b=window.__studio.tab('check','Проверка');a.textContent='тут будет Проверка';return [a===b,a.id,document.querySelectorAll('.stTab').length];});
  expect(t).toEqual([true,'stTab-check',3]);   // «Фигуры», «Проверка», «Настройки»
  // вкладки переключаются: видно содержимое одной, состояние — над вкладками, видно всегда
  await page.locator('.stTab[data-tab=check]').click();await expect(page.locator('#stTab-check')).toBeVisible();await expect(page.locator('#stPub')).toBeHidden();
  await expect(page.locator('.stTab.on')).toHaveText('Проверка');await expect(page.locator('#stNow')).toBeVisible();
  await page.locator('.stTab[data-tab=figs]').click();await expect(page.locator('#stPub')).toBeVisible();await expect(page.locator('#stTab-check')).toBeHidden();
});
test('на странице есть панель мастерской, без ошибок в консоли', async ({page}) => {
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('/editor/lynx/');
  await expect(page.locator('#studioPanel')).toBeVisible();await expect(page.locator('#stHead')).toHaveText('Мастерская');
  await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  expect(errs).toEqual([]);
});
test('«Взять фигуру с сайта» → «Рысь» → в 3D «Рысь 2»', async ({page}) => {
  await page.goto('/editor/lynx/');await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  await page.locator('#stPub').click();
  await expect(page.locator('#stPubList .stT')).toHaveText('Какую фигуру скопировать?');
  await page.locator('.stPubItem',{hasText:'Рысь'}).dblclick();
  await expect(page.locator('#mName')).toHaveValue('Рысь 2',{timeout:30000});
  await expect(page.locator('#stMsg')).toHaveText('Открыта «Рысь 2». Фигура на сайте не изменилась',{timeout:30000});
  await expect(page.locator('#stMsg')).not.toHaveClass(/busy/);await expect(page.locator('#stPub')).toBeEnabled();await expect(page.locator('#stPubList')).toBeHidden();
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2');
  await expect(page.locator('.stFig.on')).toContainText('Рысь 2 · открыта');
  expect(fs.readdirSync(WORK).filter(d=>/^rys-/.test(d))).toEqual(['rys-2']);   // двойной клик не дал второй копии
  expect(await page.evaluate(()=>ST.fig)).toBe('');expect(await page.evaluate(()=>ST.base.P.length)).toBe(read('rys-2').P.length);
});
test('пока делается копия: заметное сообщение, кнопка и список выключены', async ({page}) => {
  await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});
  let go;const gate=new Promise(r=>{go=r;});
  await page.route('**/api/copy',async r=>{await gate;await r.abort();});   // копия «висит», потом обрывается
  await page.locator('#stPub').click();await page.locator('.stPubItem',{hasText:'Рысь'}).click();
  await expect(page.locator('#stMsg')).toHaveText('Делаю копию «Рысь», до минуты…');await expect(page.locator('#stMsg')).toHaveClass(/busy/);
  await expect(page.locator('#stPub')).toBeDisabled();await expect(page.locator('.stPubItem').first()).toBeDisabled();
  go();
  await expect(page.locator('#stMsg')).toContainText('Не скопировалось: ');await expect(page.locator('#stMsg')).not.toHaveClass(/busy/);await expect(page.locator('#stMsg')).toHaveClass(/bad/);
  await expect(page.locator('#stPub')).toBeEnabled();await expect(page.locator('.stPubItem').first()).toBeEnabled();
  await page.unroute('**/api/copy');
  expect(fs.readdirSync(WORK).filter(d=>/^rys-/.test(d))).toEqual(['rys-2']);await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2');
});
test('разрез сохраняется за 1 с; после перезагрузки граней столько же, «Отменить» откатывает', async ({page}) => {
  await page.goto('/editor/lynx/');await expect(page.locator('#mName')).toHaveValue('Рысь 2',{timeout:30000});   // при старте открывается последняя
  const n0=read('rys-2').P.length,m0=fs.statSync(figFile('rys-2')).mtimeMs;
  await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR&&window.__studio&&window.__studio.cur());
  await split(page);
  await expect.poll(()=>read('rys-2').P.length,{timeout:1000,intervals:[50]}).toBeGreaterThan(n0);
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2 · сохранено',{timeout:2000});
  const n1=read('rys-2').P.length;expect(fs.statSync(figFile('rys-2')).mtimeMs).toBeGreaterThan(m0);
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(WORK,'rys-2','undo.json'),'utf8')).undo.length,{timeout:1500}).toBeGreaterThan(0);
  await page.reload();await expect(page.locator('#mName')).toHaveValue('Рысь 2',{timeout:30000});
  await page.waitForFunction(()=>window.__studio&&window.__studio.cur());
  expect(await page.evaluate(()=>ST.base.P.length)).toBe(n1);
  await page.evaluate(()=>$('bUndo').click());   // кнопка в блоке «Править фигуру» — после перезагрузки он свёрнут
  expect(await page.evaluate(()=>ST.base.P.length)).toBe(n0);
  await expect.poll(()=>read('rys-2').P.length,{timeout:1500}).toBe(n0);   // и «Отменить» сохраняется
});
test('удалить открытую копию: в корзину, на экране фигура с сайта, после перезагрузки не открывается', async ({page}) => {
  await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});
  await page.locator('#stPub').click();await page.locator('.stPubItem',{hasText:'Рысь'}).click();
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 3',{timeout:30000});
  // «Отмена» в подтверждении — ничего не удаляется
  page.once('dialog',d=>d.dismiss());await page.locator('.stFig.on .stDel').click();
  await expect(page.locator('.stFig')).toHaveCount(2);expect(fs.existsSync(path.join(WORK,'rys-3'))).toBe(true);await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 3');
  let asked='';page.once('dialog',d=>{asked=d.message();d.accept();});
  await split(page);   // правка прямо перед удалением
  await expect(page.locator('.stFig.on .stDel')).toHaveAttribute('title','Удалить');
  await page.locator('.stFig.on .stDel').click();
  await expect(page.locator('#stMsg')).toHaveText('«Рысь 3» удалена. Вернуть можно из studio/work/.trash');
  expect(asked).toBe('Удалить «Рысь 3»? Папка переедет в корзину studio/work/.trash');
  await expect(page.locator('#stNow')).toHaveText(SITE);
  await expect(page.locator('#mName')).toHaveValue('Рысь');expect(await page.evaluate(()=>ST.fig)).toBe('lynx14');
  await page.waitForTimeout(700);expect(fs.existsSync(path.join(WORK,'rys-3'))).toBe(false);   // отложенная запись папку не воскресила
  expect(fs.readdirSync(path.join(WORK,'.trash')).some(d=>/^rys-3-\d+$/.test(d))).toBe(true);
  await page.reload();await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  await expect(page.locator('.stFig')).toHaveCount(1);await expect(page.locator('.stFig.on')).toHaveCount(0);
  // удалить не открытую: на экране всё как было
  await page.locator('#stPub').click();await page.locator('.stPubItem',{hasText:'Рысь'}).click();await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 3',{timeout:30000});
  await page.locator('.stFig',{hasText:'Рысь 2'}).click();await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});
  // гонка: «Рысь 3» уже открывается (ответ сервера получен), и её тут же удаляют — открытие снимается, папка не воскресает
  let go;const gate=new Promise(r=>{go=r;});
  await page.route('**/api/open',async r=>{const resp=await r.fetch();await gate;await r.fulfill({response:resp});});
  await page.locator('.stFig',{hasText:'Рысь 3'}).click();await page.waitForTimeout(300);
  page.once('dialog',d=>d.accept());await page.locator('.stFig',{hasText:'Рысь 3'}).locator('.stDel').click();
  await expect(page.locator('#stMsg')).toHaveText('«Рысь 3» удалена. Вернуть можно из studio/work/.trash');
  go();await page.waitForTimeout(500);await page.unroute('**/api/open');
  await expect(page.locator('#mName')).toHaveValue('Рысь 2');
  await split(page);await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2 · сохранено',{timeout:2000});expect(fs.existsSync(path.join(WORK,'rys-3'))).toBe(false);
  await page.evaluate(()=>$('bUndo').click());await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2 · сохранено',{timeout:2000});
  await expect(page.locator('#stMsg')).toHaveText('«Рысь 3» удалена. Вернуть можно из studio/work/.trash');
  await expect(page.locator('.stFig')).toHaveCount(1);await expect(page.locator('.stFig.on')).toHaveCount(1);
});
test('фигура сайта в выпадашке → состояние меняется; сбой записи → «не сохранилось»; длинное имя не шире колонки', async ({page}) => {
  await page.goto('/editor/lynx/');await page.waitForFunction(()=>typeof CUR!=='undefined'&&CUR);
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});   // при старте открылась последняя
  await page.locator('.stFig',{hasText:'Рысь 2'}).click();await expect(page.locator('#stMsg')).toHaveText('Открываю…');await expect(page.locator('#stMsg')).toHaveText('',{timeout:30000});   // и ещё раз кликом: дождаться конца
  const n0=read('rys-2').P.length;
  const long='<b>Рысь</b> & '+'очень длинное название '.repeat(3);
  await page.locator('#mName').fill(long);
  await expect(page.locator('#stNow')).toContainText('<b>Рысь</b> &');
  expect(await page.locator('#stNow b').count()).toBe(0);
  expect((await page.locator('#studioPanel').boundingBox()).width).toBe(320);
  await expect(page.locator('.stFig.on')).toContainText('<b>Рысь</b> &',{timeout:3000});   // сохранилось — и в списке новое название, текстом
  expect(await page.locator('#stList b').count()).toBe(0);
  expect(await page.evaluate(()=>{const b=document.querySelector('#stBody');return b.scrollWidth<=b.clientWidth;})).toBe(true);
  await page.route('**/api/save',r=>r.abort());
  await split(page);
  await expect(page.locator('#stNow')).toContainText('не сохранилось',{timeout:2000});
  await expect(page.locator('#stNow')).toHaveClass(/bad/);
  await page.evaluate(()=>{$('mName').value='Рысь 2';$('mName').dispatchEvent(new Event('input'));});   // ещё правка, запись всё так же падает
  await page.waitForTimeout(600);await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2 · не сохранилось');   // держится
  await page.unroute('**/api/save');
  await page.evaluate(()=>window.__studio.flush());
  await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2 · сохранено',{timeout:2000});await expect(page.locator('#stNow')).not.toHaveClass(/bad/);
  const n1=read('rys-2').P.length;expect(n1).toBeGreaterThan(n0);
  await page.locator('#figSel').selectOption('lynx14');
  await expect(page.locator('#stNow')).toHaveText(SITE);
  await expect(page.locator('.stFig.on')).toHaveCount(0);
  // правка фигуры сайта рабочую копию не трогает
  await split(page);
  await page.waitForTimeout(700);expect(read('rys-2').P.length).toBe(n1);
  await expect(page.locator('#stNow')).toHaveText(SITE);
  // «Начать с заготовки» поверх открытой копии: копия закрыта, заготовка в её папку не пишется
  await page.locator('.stFig',{hasText:'Рысь 2'}).click();await expect(page.locator('#stNow')).toHaveText('Открыта: Рысь 2',{timeout:30000});
  await page.evaluate(()=>$('bBlank').click());
  await expect(page.locator('#stNow')).toHaveText(SITE);await expect(page.locator('.stFig.on')).toHaveCount(0);
  await page.waitForTimeout(700);expect(read('rys-2').P.length).toBe(n1);expect(read('rys-2').name).toBe('Рысь 2');
});
