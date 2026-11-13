// «Лазер · DXF → Гильотина» (#59): галочка «рубим» у детали, схема без кусков листа, «Не на схеме», итоги и архив гильотинщика
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// поля «Лазер · DXF» как на странице (колосник на листе снят, подрезка 10) и память браузера ls — {ключ: значение}
function page(ctx,ls={}){const mem=Object.fromEntries(Object.entries(ls).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
  ctx.__mem=mem;ctx.__els={nGap:{value:'5'},nSheet:{value:'1250x2500'},nCgr:{checked:false},nEdge:{value:'10'}};
  run(ctx,`(()=>{const on=new Map(),D0=document,el=id=>{const e=__els[id];if(!e)return D0.getElementById(id);e.addEventListener=e.addEventListener||((t,f)=>on.set(id+':'+t,f));return e;};
    localStorage={getItem:k=>k in __mem?__mem[k]:null,setItem:(k,v)=>{__mem[k]=String(v);}};
    document=new Proxy({},{get:(t,k)=>k==='getElementById'?el:D0[k]});
    NST.init=false;nestInit();})()`);}
// схема гильотины всех толщин по заданию N (как по кнопке «Рассчитать»)
const RES='(N=>N.groups.map(G=>gilScheme(N,G)))';
// что рубим: имена деталей (по одному на тип) и что на схеме
const ON=`(N=>N.groups.flatMap(G=>G.types.filter(t=>gilOn(t,N)).map(t=>t.p.name)))`;
const LAID=`(N=>${RES}(N).flatMap(P=>P.sheets.flatMap(s=>s.items.map(i=>i.r.ty.p.name))))`;

test('по умолчанию гильотина: уже 50 мм и толще 8 мм — лазер, остальные — рубим', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'GIL_MAX_MM'),8);
  assert.equal(run(c,'gilDef({w:800,h:30},5)'),'laser');
  assert.equal(run(c,'gilDef({w:800,h:420},5)'),'gil');
  assert.equal(run(c,'gilDef({w:400,h:400},15)'),'laser');
  assert.equal(run(c,'gilDef({w:400,h:400},8)'),'gil');
});

test('мангал по умолчанию: сняты задвижки, скобы и колосник; кусков листа на схеме нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>({on:${ON}(N),all:N.groups.flatMap(G=>G.types.map(t=>t.p.name)),laid:${LAID}(N),
    kinds:N.groups.flatMap(G=>gilRects(N,G).map(r=>r.kind))}))(nestJob())`);
  for(const n of ['Задвижка поддува','Скоба задвижки','Колосник мангала 1 (левая половина)','Колосник мангала 2 (правая, у ручки)'])
    {assert.ok(r.all.includes(n),'нет детали '+n);assert.ok(!r.on.includes(n),'рубим '+n);assert.ok(!r.laid.includes(n),'на схеме '+n);}
  for(const n of ['Дно жаровни','Боковина жаровни задняя','Торец жаровни правый'])assert.ok(r.on.includes(n)&&r.laid.includes(n),'не рубим '+n);
  assert.ok(r.kinds.length>0);
  assert.ok(r.kinds.every(k=>k==='gil'||k==='zag'),'на схеме только заготовки и готовые детали: '+r.kinds.join(','));
});

test('печь: колосник 15 мм по умолчанию не рубим — на листе 15 мм ничего', ()=>{
  const c=loadMangal({mode:'stove'});page(c);
  const r=run(c,`(N=>({mm:N.groups.map(G=>G.mm),n15:gilRects(N,N.groups.find(G=>G.mm===15)).length,on:${ON}(N),off:N.groups.map(G=>offList(N,G))}))(nestJob())`);
  assert.deepEqual(r.mm,[5,3,15]);
  assert.equal(r.n15,0);
  assert.ok(!r.on.includes('Колосник печи'));
  assert.match(r.off[2],/^Не на схеме: Колосник печи$/);
  // галочку поставили — рубим и 15 мм
  const g=run(c,`(N=>gilRects(N,N.groups.find(G=>G.mm===15)).length)(nestJob({gilSel:{stove_grate:true}}))`);
  assert.equal(g,1);
});

test('колосник мангала — одна настройка с «Колосник на листе»: память md-gilsel2 его не трогает', ()=>{
  const c=loadMangal({mode:'grill'});page(c,{'md-gilsel2':{grill_grate_1:true,grill_grate_2:true}});
  assert.ok(!run(c,`${ON}(nestJob())`).some(n=>/Колосник/.test(n)),'колосник из gilSel');
  assert.equal(run(c,`${ON}(nestJob({cgr:true}))`).filter(n=>/Колосник/.test(n)).length,2);
  // галочка колосника в «Гильотине» ставит «Колосник на листе» и пишет md-ncgr2, не md-gilsel2
  run(c,`gilSet(nestJob().groups[0].types.find(t=>t.p.file==='grill_grate_1'),true)`);
  assert.equal(c.__els.nCgr.checked,true);
  assert.equal(c.__mem['md-ncgr2'],'true');
  assert.equal(run(c,'nestOpts().cgr'),true);
  assert.equal(c.__mem['md-gilsel2'],'{"grill_grate_1":true,"grill_grate_2":true}','md-gilsel2 не тронута');
});

test('снятая деталь уходит со схемы и из цифр, остаётся строкой «Не на схеме»', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const before=run(c,`(N=>({laid:${LAID}(N),tot:gilTotals(N,${RES}(N))[0]}))(nestJob())`);
  run(c,`gilSet(nestJob().groups[0].types.find(t=>t.p.file==='grill_bottom'),false)`);
  assert.equal(c.__mem['md-gilsel2'],'{"grill_bottom":false}');
  const after=run(c,`(N=>({laid:${LAID}(N),tot:gilTotals(N,${RES}(N))[0],off:offList(N,N.groups[0])}))(nestJob())`);
  assert.ok(before.laid.includes('Дно жаровни'));
  assert.ok(!after.laid.includes('Дно жаровни'));
  assert.equal(after.tot.blanks,before.tot.blanks-1);
  assert.match(after.off,/^Не на схеме: .*Дно жаровни/);
  assert.match(after.off,/Задвижка поддува × 2/);
  assert.match(after.off,/Скоба задвижки × 4/);
  // задвижку поставили — рубим и её (выбор человека важнее умолчания)
  run(c,`gilSet(nestJob().groups[0].types.find(t=>t.p.file==='grill_air_slider'),true)`);
  assert.ok(run(c,`${LAID}(nestJob())`).includes('Задвижка поддува'));
});

test('итоги «Гильотины»: листы, заготовки, резы — по схеме', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>{const res=${RES}(N);return {t:gilTotals(N,res),n:res.map(P=>P.sheets.reduce((a,s)=>a+s.items.length,0)),
    cuts:res.map(P=>P.sheets.reduce((a,s)=>a+s.cuts,0)),q:N.groups.map(G=>G.types.filter(t=>gilOn(t,N)).reduce((a,t)=>a+t.q,0))};})(nestJob())`);
  assert.equal(r.t.length,1);
  assert.deepEqual(r.t[0],{mm:5,sheets:1,blanks:r.q[0],cuts:r.cuts[0]});
  assert.equal(r.n[0],r.q[0]);
  assert.ok(r.cuts[0]>0);
});

test('все сняты — «Ничего не рубим», архив пуст, без ошибок', ()=>{
  const c=loadMangal({mode:'both'});page(c);
  const all=run(c,'Object.fromEntries(nestJob().groups.flatMap(G=>G.types.map(t=>[t.p.file,false])))');
  const r=run(c,`(N=>{const res=${RES}(N);return {sh:res.map(P=>P.sheets.length),files:variantFiles(N,res,'gil'),html:gilHtml(N,res)};})(nestJob({gilSel:${JSON.stringify(all)}}))`);
  assert.deepEqual(r.sh,[0,0,0]);
  assert.deepEqual(r.files,[]);
  assert.match(r.html,/Ничего не рубим/);
  assert.doesNotMatch(r.html,/class="nestsv/);
});

test('архив «Гильотины»: DXF схемы и CSV заготовок, без кусков листа', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,`zipName('gil')`),'mangal_800x420x200_5mm_gilotina.zip');
  const f=run(c,`(N=>variantFiles(N,${RES}(N),'gil'))(nestJob())`);
  assert.deepEqual(f.map(x=>x[0]),['gilotina_5mm_1250x2500.dxf','gilotina_5mm.csv']);
  const csv=f[1][1].replace(/^﻿/,'').trim().split('\r\n');
  assert.equal(csv[0],'деталь;заготовка, мм;шт;вид');
  assert.ok(csv.slice(1).every(l=>!/кусок/i.test(l)),'кусок листа в CSV');
  const on=run(c,`(N=>N.groups[0].types.filter(t=>gilOn(t,N)).map(t=>t.no+' '+t.p.name))(nestJob())`);
  assert.deepEqual(csv.slice(1).map(l=>l.split(';')[0]),on);
  assert.ok(!/Задвижка|Скоба|Колосник/.test(f[1][1]));
  assert.match(f[0][1],/BLANK/);
  // печь: схемы и CSV тех толщин, где есть что рубить (15 мм — нет)
  const s=loadMangal({mode:'stove'});page(s);
  const fs=run(s,`(N=>variantFiles(N,${RES}(N),'gil').map(x=>x[0]))(nestJob())`);
  assert.deepEqual(fs,['gilotina_5mm_1250x2500.dxf','gilotina_5mm.csv','gilotina_3mm_1250x2500.dxf','gilotina_3mm.csv']);
  assert.equal(run(s,`zipName('gil')`),'pech_600x440x500_5-3-15mm_gilotina.zip');
});

test('старая память браузера (md-gilsel «гильотина | лазер», md-ngil) и мусор в md-gilsel2 страницу не ломают', ()=>{
  const clean=loadMangal({mode:'grill'});page(clean);
  const want=run(clean,`gilKey(nestJob())`);
  const c=loadMangal({mode:'grill'});
  page(c,{'md-gilsel':{grill_bottom:'laser',grill_air_slider:'gil'},'md-ngil':true,'md-gilsel2':'{не json'});
  assert.deepEqual(run(c,'nestOpts().gilSel'),{});
  assert.equal(run(c,'gilKey(nestJob())'),want);
  const d=loadMangal({mode:'grill'});page(d,{'md-gilsel2':{grill_bottom:'laser',grill_end_right:false,x:[1]}});
  assert.deepEqual(run(d,'nestOpts().gilSel'),{grill_end_right:false});
});

test('ключ «Гильотины» меняется от галочек, подрезки, листа; ключ «С листа» от галочек «рубим» — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const k=o=>run(c,`gilKey(nestJob(${JSON.stringify(o)}))`),l=o=>run(c,`nestJob(${JSON.stringify(o)}).key`);
  const base=k({});
  assert.notEqual(k({gilSel:{grill_bottom:false}}),base);
  assert.notEqual(k({edge:0}),base);
  assert.notEqual(k({cgr:true}),base);
  assert.notEqual(k({W:3000,H:1500}),base);
  assert.equal(l({gilSel:{grill_bottom:false}}),l({}));
  assert.equal(l({edge:0}),l({}));
});
