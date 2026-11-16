// кнопка «Сохранить версию» (#84) на фигуре-образце: npm run test:studio:e2e
// Сервер в этом тесте до git не доходит: /api/version подставной (page.route) во всех тестах файла. Сам git и ветку drafts
// проверяет studio/tests/drafts.test.js на временном репозитории. Предохранитель: сервер e2e запущен с --repo на несуществующую папку
// (studio/tests/playwright.config.js), так что и случайный настоящий вызов в настоящий репозиторий не пойдёт.
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const {sampleFigure}=require('../helpers.js');
const ROOT=path.join(__dirname,'..','..','..'),WORK=path.join(__dirname,'..','.work'),SLUG='obrazec';
const read=()=>JSON.parse(fs.readFileSync(path.join(WORK,SLUG,'figure.json'),'utf8'));
const split=page=>page.evaluate(()=>{ST.edit=true;$('cEdit').checked=true;ST.sp=0;renderAll();$('op_split').click();});   // «Разрезать пополам» грань 0
test.describe.configure({mode:'serial'});
test.beforeEach(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(path.join(WORK,SLUG),{recursive:true});
  fs.writeFileSync(path.join(WORK,SLUG,'figure.json'),JSON.stringify(sampleFigure()));fs.writeFileSync(path.join(WORK,'state.json'),JSON.stringify({last:SLUG}));});
test.afterAll(()=>{fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(WORK,{recursive:true});
  expect(fs.existsSync(path.join(ROOT,'studio','.wt'))).toBe(false);});   // копия drafts в настоящем репозитории не появилась

// подставной /api/version: calls — что пришло и сколько граней было на диске в этот момент; answer — ответ; gate — придержать ответ
function fake(page,answer,gate){const calls=[];
  return page.route('**/api/version',async r=>{calls.push({body:r.request().postDataJSON(),P:read().P.length});if(gate)await gate;
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(typeof answer==='function'?answer(calls.length):answer)});}).then(()=>calls);}
const open=async page=>{await page.goto('/editor/lynx/');await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await page.waitForFunction(()=>window.__studio&&window.__studio.cur());};

test('«Сохранить версию»: несохранённая правка сначала на диск, пока идёт — «Сохраняю версию…», потом сообщение', async ({page}) => {
  let go;const gate=new Promise(r=>{go=r;});
  const calls=await fake(page,{n:1,pushed:true,msg:'Версия 1 сохранена и отправлена в облако'},gate);
  await open(page);
  const b=page.locator('#stVer');await expect(b).toBeVisible();await expect(b).toHaveText('Сохранить версию');await expect(b).toBeEnabled();
  expect((await b.boundingBox()).width).toBeLessThanOrEqual(320);
  const n0=read().P.length;
  await split(page);await b.click();   // сразу после правки: автосохранение ещё не успело
  await expect(page.locator('#stMsg')).toHaveText('Сохраняю версию…');await expect(page.locator('#stMsg')).toHaveClass(/busy/);
  await expect(b).toBeDisabled();await expect(page.locator('#stPub')).toBeDisabled();
  await expect.poll(()=>calls.length).toBe(1);
  const P=await page.evaluate(()=>ST.base.P.length);expect(P).toBeGreaterThan(n0);
  expect(calls[0]).toEqual({body:{slug:SLUG},P});   // сервер видит на диске то же, что на экране
  go();
  await expect(page.locator('#stMsg')).toHaveText('Версия 1 сохранена и отправлена в облако');
  await expect(page.locator('#stMsg')).not.toHaveClass(/bad|busy/);await expect(b).toBeEnabled();await expect(page.locator('#stPub')).toBeEnabled();
  await expect(page.locator('#stNow')).toHaveText('Открыта: Образец · сохранено');
});

test('нет сети — красное сообщение, «только на этом компе» — обычное; сбой сервера — «Версия не сохранилась»', async ({page}) => {
  const ans=[{n:2,pushed:false,msg:'Версия 2 на диске. Отправлю в облако при следующем сохранении'},null,{n:3,pushed:true,msg:'Версия 3 сохранена и отправлена в облако'}];
  await page.route('**/api/version',r=>{const a=ans.shift();return a?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(a)}):r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'нет такой фигуры: obrazec'})});});
  await open(page);
  await page.locator('#stVer').click();
  await expect(page.locator('#stMsg')).toHaveText('Версия 2 на диске. Отправлю в облако при следующем сохранении');await expect(page.locator('#stMsg')).toHaveClass(/bad/);
  await page.locator('#stVer').click();
  await expect(page.locator('#stMsg')).toHaveText('Версия не сохранилась: нет такой фигуры: obrazec');await expect(page.locator('#stMsg')).toHaveClass(/bad/);
  await page.locator('#stVer').click();
  await expect(page.locator('#stMsg')).toHaveText('Версия 3 сохранена и отправлена в облако');await expect(page.locator('#stMsg')).not.toHaveClass(/bad/);
  // фигура «только на этом компе»
  await page.unroute('**/api/version');
  fs.writeFileSync(path.join(WORK,SLUG,'figure.json'),JSON.stringify(Object.assign(sampleFigure(),{localOnly:true})));
  await fake(page,{n:4,pushed:false,local:true,msg:'Версия 4 на диске. Только на этом компе: в облако не отправляю'});
  await open(page);await page.locator('#stVer').click();
  await expect(page.locator('#stMsg')).toHaveText('Версия 4 на диске. Только на этом компе: в облако не отправляю');await expect(page.locator('#stMsg')).not.toHaveClass(/bad/);
});

test('правка не записалась на диск — версию не снимаем, следующее нажатие пробует запись снова; на экране фигура с сайта — кнопки нет', async ({page}) => {
  const calls=await fake(page,{n:1,pushed:true,msg:'Версия 1 сохранена и отправлена в облако'});
  await open(page);
  await page.route('**/api/save',r=>r.abort());
  await split(page);await page.locator('#stVer').click();
  await expect(page.locator('#stMsg')).toHaveText('Версия не сохранилась: последняя правка не записалась на диск');
  expect(calls.length).toBe(0);
  await page.unroute('**/api/save');
  await page.locator('#stVer').click();   // без новой правки: запись повторяется сама
  await expect(page.locator('#stMsg')).toHaveText('Версия 1 сохранена и отправлена в облако');
  expect(calls.length).toBe(1);expect(calls[0].P).toBe(await page.evaluate(()=>ST.base.P.length));
  await expect(page.locator('#stNow')).toHaveText('Открыта: Образец · сохранено');
  await page.locator('#figSel').selectOption('lynx14');
  await expect(page.locator('#stVer')).toBeHidden();
  await page.locator('.stFig',{hasText:'Образец'}).click();await expect(page.locator('#stNow')).toHaveText('Открыта: Образец',{timeout:30000});
  await expect(page.locator('#stVer')).toBeVisible();
});
