// рабочая папка мастерской (studio/lib/workdir.js, names.js): node --test studio/tests/workdir.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path');
const W=require('../lib/workdir.js'),{slugify,nextName,freeSlug}=require('../lib/names.js'),{run}=require('./helpers.js');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'studio-wd-'));
const fig=name=>({type:'md-studio',v:1,name,kind:'stand',localOnly:false,H:1000,V:[[0,0,0],[1,0,0],[1,1,0]],P:[[0,1,2]],S:[],keep:[],slots:[],refHalf:'left'});

test('slugify и nextName', () => {
  assert.equal(slugify('Рысь 2'),'rys-2');assert.equal(slugify('Доберман №3!'),'doberman-3');assert.equal(slugify('  '),'figura');assert.equal(slugify('Щука'),'schuka');
  assert.equal(slugify('../../x'),'x');
  assert.equal(nextName('Рысь',['Рысь']),'Рысь 2');assert.equal(nextName('Рысь',['Рысь','Рысь 2']),'Рысь 3');assert.equal(nextName('Рысь',[]),'Рысь');
  assert.equal(nextName('Рысь 2',['Рысь','Рысь 2']),'Рысь 3');assert.equal(nextName('рысь',['Рысь']),'рысь 2');   // регистр не важен
  assert.equal(freeSlug('Рысь',['rys']),'rys-2');
});
test('свет выключился: обрезанный figure.json и брошенный .tmp — открывается последняя версия, битый файл не пропал (ревью, п. 2)', () => {
  const work=tmp(),d=path.join(work,'rys-2');W.saveFigure(work,'rys-2',fig('Рысь 2'),{undo:['x']});
  const good=fig('Рысь 2 (версия)');fs.mkdirSync(path.join(d,'versions'));fs.writeFileSync(path.join(d,'versions','001.json'),JSON.stringify(fig('старая')));fs.writeFileSync(path.join(d,'versions','002.json'),JSON.stringify(good));
  fs.writeFileSync(path.join(d,'figure.json'),JSON.stringify(fig('x')).slice(0,40));fs.writeFileSync(path.join(d,'figure.json.tmp'),JSON.stringify(fig('y')).slice(0,20));
  const r=W.readFigure(work,'rys-2');
  assert.deepEqual(r.figure,good);assert.match(r.warning,/повреждён/);assert.match(r.warning,/версия 002/);
  assert.ok(fs.readdirSync(d).some(f=>/^figure\.broken-\d+\.json$/.test(f)),'битый файл сохранён');assert.deepEqual(W.readFigure(work,'rys-2'),{figure:good,warning:null},'целая копия встала на место, второй раз без предупреждений');
  assert.deepEqual(W.listFigures(work).map(f=>f.slug),['rys-2']);
  // целый .tmp (свет выключился между записью и rename) новее версий
  const d2=path.join(work,'a');fs.mkdirSync(d2);fs.writeFileSync(path.join(d2,'figure.json'),'{');fs.writeFileSync(path.join(d2,'figure.json.tmp'),JSON.stringify(fig('свежая')));
  assert.equal(W.readFigure(work,'a').figure.name,'свежая');
  const d3=path.join(work,'b');fs.mkdirSync(d3);fs.writeFileSync(path.join(d3,'figure.json'),'{');assert.throws(()=>W.readFigure(work,'b'),/целой копии нет/);
  assert.throws(()=>W.readFigure(work,'../x'),/плохое имя/);
});
test('запись атомарная: после сохранения .tmp нет, повторное сохранение заменяет', () => {
  const work=tmp();W.saveFigure(work,'a',fig('1'),{});W.saveFigure(work,'a',fig('2'),{undo:['u']});
  assert.deepEqual(fs.readdirSync(path.join(work,'a')).sort(),['figure.json','undo.json']);assert.equal(W.readFigure(work,'a').figure.name,'2');
  assert.deepEqual(W.readUndo(work,'a').undo,['u']);assert.equal(W.readUndo(work,'zz').undo.length,0);
  W.saveFigure(work,'a',fig('3'),{undo:Array.from({length:100},(_,i)=>String(i))});assert.equal(W.readUndo(work,'a').undo.length,60);
  assert.deepEqual(W.listFigures(work).map(f=>f.slug),['a']);
});
test('настройки: set меняет, reset возвращает TH_DEFAULT', () => {
  const work=tmp(),TH=run('TH_DEFAULT');
  assert.deepEqual(W.settings(work,{},TH),TH);assert.equal(W.settings(work,{set:{planar:.3}},TH).planar,.3);assert.equal(W.settings(work,{},TH).planar,.3);
  assert.throws(()=>W.settings(work,{set:{planar:'x'}},TH));assert.throws(()=>W.settings(work,{set:{nosuch:1}},TH));
  assert.deepEqual(W.settings(work,{reset:true},TH),TH);assert.equal(W.settings(work,{},TH).planar,1);
});
test('last и контуры дыр', () => {
  const work=tmp();assert.equal(W.getLast(work),null);W.setLast(work,'rys-2');assert.equal(W.getLast(work),'rys-2');
  assert.deepEqual(W.openLoops([[0,1,2,3]]).map(l=>l.length),[4]);   // одна грань: край — один контур
  assert.deepEqual(W.openLoops(run('blankBox')(10,10,10).P),[]);
});
test('удалить: папка в .trash, в списке её нет, last сброшен, имя свободно', () => {
  const work=tmp();W.saveFigure(work,'rys-2',fig('Рысь 2'),{});W.saveFigure(work,'rys-3',fig('Рысь 3'),{});W.setLast(work,'rys-2');
  const r=W.removeFigure(work,'rys-2');
  assert.match(r.trash,/^rys-2-\d+$/);assert.ok(fs.existsSync(path.join(work,'.trash',r.trash,'figure.json')));
  assert.deepEqual(W.listFigures(work).map(f=>f.slug),['rys-3']);assert.equal(W.getLast(work),null);
  assert.throws(()=>W.removeFigure(work,'rys-2'),/нет такой фигуры/);assert.throws(()=>W.removeFigure(work,'../x'),/плохое имя/);
  W.setLast(work,'rys-3');W.removeFigure(work,'rys-3');W.saveFigure(work,'rys-2',fig('Рысь 2'),{});   // корзина не мешает новой папке с тем же именем
  assert.deepEqual(W.listFigures(work).map(f=>f.slug),['rys-2']);
});
test('удалить: last чужой фигуры не трогается; две папки с одним именем в одну миллисекунду не сталкиваются в корзине', () => {
  const work=tmp();W.saveFigure(work,'a',fig('А'),{});W.saveFigure(work,'b',fig('Б'),{});W.setLast(work,'b');
  const t1=W.removeFigure(work,'a').trash;assert.equal(W.getLast(work),'b');
  W.saveFigure(work,'a',fig('А'),{});const t2=W.removeFigure(work,'a').trash;assert.notEqual(t1,t2);
  assert.equal(fs.readdirSync(path.join(work,'.trash')).length,2);
});
