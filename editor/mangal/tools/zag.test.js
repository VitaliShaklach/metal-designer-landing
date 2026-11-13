// «Лазер · DXF → Из заготовок» (#60): детали с галочкой «рубим», которым после гильотины нужен лазер; итоги, «Не на схеме», архив _zag.dxf
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

// результат «Из заготовок» по заданию N (как по кнопке «Рассчитать»)
const RES='(N=>N.groups.map(G=>zagTypes(N,G)))';
const NAMES=`(N=>N.groups.flatMap(G=>zagTypes(N,G).map(t=>t.p.name)))`;

test('по умолчанию: только детали «рубим», которым нужен лазер; готовые после гильотины и снятые — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>({z:${NAMES}(N),kinds:N.groups.flatMap(G=>zagTypes(N,G).map(t=>[t.kind,gilOn(t,N)]))}))(nestJob())`);
  for(const n of ['Боковина жаровни задняя','Боковина жаровни передняя'])assert.ok(r.z.includes(n),'нет '+n);
  for(const n of ['Дно жаровни','Торец жаровни правый','Задвижка поддува','Скоба задвижки','Колосник мангала 1 (левая половина)'])assert.ok(!r.z.includes(n),'лишняя '+n);
  assert.ok(r.kinds.every(([k,on])=>k==='zag'&&on),JSON.stringify(r.kinds));
});

test('галочки «Гильотины»: снятая деталь уходит из «Из заготовок» в «Не на схеме», колосник с «Колосник на листе» — приходит', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const off=run(c,`(N=>({z:${NAMES}(N),off:offList(N,N.groups[0])}))(nestJob({gilSel:{grill_side_back:false}}))`);
  assert.ok(!off.z.includes('Боковина жаровни задняя'));
  assert.match(off.off,/^Не на схеме: .*Боковина жаровни задняя/);
  assert.ok(run(c,`${NAMES}(nestJob({gilSel:{grill_air_slider:true}}))`).includes('Задвижка поддува'),'задвижка с отверстиями — заготовка под лазер');
  assert.equal(run(c,`${NAMES}(nestJob({cgr:true}))`).filter(n=>/Колосник мангала/.test(n)).length,2);
});

test('итоги: рез и врезки по заготовкам (с запасом), число заготовок — с учётом кол-ва', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>{const res=${RES}(N),T=zagTypes(N,N.groups[0]);return {t:zagTotals(N,res)[0],
    cut:T.reduce((a,t)=>a+t.b.cut*t.q,0),pierce:T.reduce((a,t)=>a+t.b.pierce*t.q,0),q:T.reduce((a,t)=>a+t.q,0),
    side:(t=>({b:t.b.pierce,m:t.m.pierce,bc:t.b.cut,mc:t.m.cut}))(T.find(t=>t.p.file==='grill_side_back'))};})(nestJob())`);
  assert.equal(r.t.mm,5);
  assert.equal(r.t.blanks,r.q);
  assert.ok(r.q>=2);
  assert.ok(Math.abs(r.t.cut-r.cut)<1e-6);
  assert.equal(r.t.pierce,r.pierce);
  // решение грилинга: каждый паз с кромки — врезка, поэтому у боковины врезок больше, чем с листа, а реза меньше (стороны режет гильотина)
  assert.ok(r.side.b>r.side.m,'врезки боковины: по заготовке '+r.side.b+', с листа '+r.side.m);
  assert.ok(r.side.bc<r.side.mc);
});

test('архив «Из заготовок»: имя …_laser-zagotovki.zip, внутри только _zag.dxf отмеченных деталей', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,`zipName('zag')`),'mangal_800x420x200_5mm_laser-zagotovki.zip');
  const f=run(c,`(N=>variantFiles(N,${RES}(N),'zag'))(nestJob())`),want=run(c,`(N=>N.groups.flatMap(G=>zagTypes(N,G).map(t=>dxfNameZ(t.p))))(nestJob())`);
  assert.deepEqual(f.map(x=>x[0]),want);
  assert.ok(f.length>=2);
  assert.ok(f.every(([n])=>/_zag\.dxf$/.test(n)),f.map(x=>x[0]).join(', '));
  f.forEach(([n,t])=>{assert.match(t,/\r\nBLANK\r\n/,n+': нет заготовки');assert.match(t,/\r\nCUT\r\n/,n+': нет реза');});
  // печь: толщины через «-», 15 мм (колосник не рубим) и 3 мм (дверца, шибер — готовые после гильотины) — без файлов
  const s=loadMangal({mode:'stove'});page(s);
  assert.equal(run(s,`zipName('zag')`),'pech_600x440x500_5-3-15mm_laser-zagotovki.zip');
  const fs=run(s,`(N=>variantFiles(N,${RES}(N),'zag').map(x=>x[0]))(nestJob())`);
  assert.ok(fs.length>0);
  assert.ok(fs.every(n=>/_5mm_x\d+_zag\.dxf$/.test(n)),fs.join(', '));
});

test('вкладка: итоги, «Не на схеме», таблица; нечего резать — строка, архив пуст', ()=>{
  const c=loadMangal({mode:'stove'});page(c);
  const h=run(c,`(N=>zagHtml(N,${RES}(N)))(nestJob())`);
  for(const t of ['Рез','Врезки','Заготовки'])assert.match(h,new RegExp('<span>'+t+' <b>'));
  assert.match(h,/Не на схеме: Колосник печи/);
  assert.match(h,/Заготовок под лазер нет/);   // 3 и 15 мм
  assert.match(h,/_zag\.dxf/);
  const all=run(c,'Object.fromEntries(nestJob().groups.flatMap(G=>G.types.map(t=>[t.p.file,false])))');
  const r=run(c,`(N=>{const res=${RES}(N);return {files:variantFiles(N,res,'zag'),html:zagHtml(N,res),has:zagHas(N)};})(nestJob({gilSel:${JSON.stringify(all)}}))`);
  assert.deepEqual(r.files,[]);
  assert.equal(r.has,false);
  assert.equal((r.html.match(/Заготовок под лазер нет/g)||[]).length,3);
});

test('ключ «Из заготовок» меняется от галочек «рубим» и колосника; от листа, зазора, подрезки — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const k=o=>run(c,`zagKey(nestJob(${JSON.stringify(o)}))`),base=k({});
  assert.notEqual(k({gilSel:{grill_side_back:false}}),base);
  assert.notEqual(k({cgr:true}),base);
  assert.equal(k({gilSel:{grill_bottom:false}}),base,'дно — готовая деталь, в «Из заготовок» его нет');
  assert.equal(k({W:3000,H:1500}),base);
  assert.equal(k({gap:8}),base);
  assert.equal(k({edge:0}),base);
});
