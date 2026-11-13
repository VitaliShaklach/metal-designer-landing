// «Лазер · DXF → Гильотина» (#59, пересмотр 14.11): что рубить, решает правило (уже 50 мм, толще 8 мм — не рубится), галочек нет;
// колосник мангала — по «Колосник на листе»; схема — полосы поперёк листа у выбранного края (слева | справа); итоги и архив гильотинщика
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

// схема гильотины всех толщин по заданию N (как по кнопке «Рассчитать»)
const RES='(N=>N.groups.map(G=>gilScheme(N,G)))';
// что рубим: имена деталей (по одному на тип) и что на схеме
const ON=`(N=>N.groups.flatMap(G=>G.types.filter(t=>gilOn(t,N)).map(t=>t.p.name)))`;
const LAID=`(N=>${RES}(N).flatMap(P=>P.sheets.flatMap(s=>s.items.map(i=>i.r.ty.p.name))))`;

test('правило гильотины: уже 50 мм и толще 8 мм — не рубится (с причиной), остальное рубим', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'GIL_MIN_W'),50);
  assert.equal(run(c,'GIL_MAX_MM'),8);
  assert.equal(run(c,'gilWhy({w:800,h:30},5)'),'уже 50 мм');
  assert.equal(run(c,'gilWhy({w:12,h:30},5)'),'уже 50 мм');
  assert.equal(run(c,'gilWhy({w:800,h:420},5)'),'');
  assert.equal(run(c,'gilWhy({w:400,h:400},15)'),'толще 8 мм');
  assert.equal(run(c,'gilWhy({w:400,h:400},8)'),'');
});

test('мангал: задвижки и скобы не рубятся, колосник снят; остальное на схеме; галочек и памяти md-gilsel2 нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c,{'md-gilsel2':{grill_bottom:false,grill_air_slider:true}});   // старая память — не читается
  const r=run(c,`(N=>({on:${ON}(N),laid:${LAID}(N),no:noCut(N,N.groups[0]),html:gilHtml(N,${RES}(N)),
    kinds:N.groups.flatMap(G=>gilRects(N,G).map(r=>r.kind))}))(nestJob())`);
  for(const n of ['Задвижка поддува','Скоба задвижки','Колосник мангала 1 (левая половина)'])assert.ok(!r.laid.includes(n),'на схеме '+n);
  for(const n of ['Дно жаровни','Боковина жаровни задняя','Боковина жаровни передняя','Торец жаровни правый','Площадка под колесо'])assert.ok(r.laid.includes(n),'не рубим '+n);
  assert.equal(r.no,'Не рубится: Колосник мангала 1 (левая половина) — снят «Колосник на листе», Колосник мангала 2 (правая, у ручки) — снят «Колосник на листе», Задвижка поддува × 2 — уже 50 мм, Скоба задвижки × 4 — уже 50 мм');
  assert.ok(r.kinds.length>0&&r.kinds.every(k=>k==='gil'||k==='zag'),r.kinds.join(','));
  assert.doesNotMatch(r.html,/type="checkbox"|gchk|Рубим</,'галочки «рубим» остались');
  assert.doesNotMatch(r.html,/Не на схеме/);
  // строки, что не рубятся, — в таблице серые, с причиной
  assert.match(r.html,/<tr class="off[^"]*">(?:(?!<\/tr>).)*Задвижка поддува(?:(?!<\/tr>).)*не рубится — уже 50 мм/);
  // «Не рубится» — над схемой
  assert.ok(r.html.indexOf('Не рубится:')<r.html.indexOf('class="nestsv'),'строка «Не рубится» под схемой');
});

test('печь: колосник 15 мм не рубится — на листе 15 мм ничего, причина «толще 8 мм»', ()=>{
  const c=loadMangal({mode:'stove'});page(c);
  const r=run(c,`(N=>({mm:N.groups.map(G=>G.mm),n15:gilRects(N,N.groups.find(G=>G.mm===15)).length,no:N.groups.map(G=>noCut(N,G)),html:gilHtml(N,${RES}(N))}))(nestJob())`);
  assert.deepEqual(r.mm,[5,3,15]);
  assert.equal(r.n15,0);
  assert.deepEqual(r.no,['','','Не рубится: Колосник печи — толще 8 мм']);
  assert.equal((r.html.match(/Ничего не рубим/g)||[]).length,1);
});

test('колосник мангала — «Колосник на листе»: включён — оба на схеме, выключен — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,`${LAID}(nestJob({cgr:true}))`).filter(n=>/Колосник/.test(n)).length,2);
  assert.equal(run(c,`${LAID}(nestJob())`).filter(n=>/Колосник/.test(n)).length,0);
  assert.doesNotMatch(run(c,`(N=>noCut(N,N.groups[0]))(nestJob({cgr:true}))`),/Колосник/);
});

test('край прижима: по умолчанию слева, память md-gilside — «r» справа, мусор — слева', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,'nestOpts().side'),'l');
  const d=loadMangal({mode:'grill'});page(d,{'md-gilside':'"r"'});
  assert.equal(run(d,'nestOpts().side'),'r');
  const e=loadMangal({mode:'grill'});page(e,{'md-gilside':'xx'});
  assert.equal(run(e,'nestOpts().side'),'l');
});

test('схема — полосы поперёк листа у выбранного края: сквозные резы на всю ширину листа, с другой стороны целый остаток', ()=>{
  for(const side of ['l','r'])for(const [mode,cgr] of [['grill',false],['grill',true],['stove',false],['both',true]])
    for(const [W,H] of [[2500,1250],[3000,1500],[2000,1000]]){
      const c=loadMangal({mode});page(c);
      const r=run(c,`(N=>${RES}(N).map(P=>P.sheets.map(s=>s.items.map(i=>[i.x,i.y,i.w,i.h]))))(nestJob(${JSON.stringify({cgr,W,H,sk:W+'x'+H,side})}))`);
      const E=10,lbl=`${side} ${mode} cgr=${cgr} ${H}×${W}`;
      r.forEach((sheets,gi)=>sheets.forEach((it,si)=>{
        const L=`${lbl} толщина ${gi} лист ${si}`,x0=Math.min(...it.map(i=>i[0])),x1=Math.max(...it.map(i=>i[0]+i[2]));
        if(side==='l')assert.ok(Math.abs(x0-E)<1e-6,L+': не у левого края, x0='+x0);
        else assert.ok(Math.abs(x1-(W-E))<1e-6,L+': не у правого края, x1='+x1);
        // полосы: каждая — от низа листа до верха (сквозной рез поперёк), детали в полосе не вылезают за её границы
        const cuts=[...new Set(it.flatMap(i=>[i[0],i[0]+i[2]]))].filter(x=>!it.some(i=>i[0]<x-1e-6&&i[0]+i[2]>x+1e-6)).sort((a,b)=>a-b);
        assert.equal(cuts[0],x0,L);assert.equal(cuts[cuts.length-1],x1,L);
        // в полосе детали снизу вверх: самая нижняя у каждой полосы стоит на подрезке
        for(let k=0;k<cuts.length-1;k++){const s=it.filter(i=>i[0]>=cuts[k]-1e-6&&i[0]+i[2]<=cuts[k+1]+1e-6);
          if(s.length)assert.ok(Math.abs(Math.min(...s.map(i=>i[1]))-E)<1e-6,L+': полоса не от низа');}
        assert.ok(it.every(i=>i[1]>=E-1e-6&&i[1]+i[3]<=H-E+1e-6),L+': вне листа');}));}
});

test('схема отрубает меньше листа по длине: мангал на 1500 × 3000 — короче 1000 мм', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const len=side=>run(c,`(N=>${RES}(N)[0].sheets.map(s=>Math.max(...s.items.map(i=>i.x+i.w))-Math.min(...s.items.map(i=>i.x))))(nestJob({W:3000,H:1500,sk:'3000x1500',side:'${side}'}))`);
  const l=len('l'),r=len('r');
  assert.equal(l.length,1);
  assert.ok(l[0]<1000,'отрублено '+l[0]+' мм');
  assert.deepEqual(r,l,'справа — та же раскладка, сдвинута');
  // отход — обрезки в отрубленном куске, а не целый остаток: справа тот же, что слева
  const w=side=>run(c,`(N=>${RES}(N)[0].sheets.map(s=>[s.waste,s.used,s.cuts]))(nestJob({side:'${side}'}))`);
  assert.deepEqual(w('r'),w('l'));
  assert.ok(w('l')[0][0]<0.1,'отход '+w('l')[0][0]);
});

test('итоги «Гильотины»: листы, заготовки, резы — по схеме', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>{const res=${RES}(N);return {t:gilTotals(N,res),n:res.map(P=>P.sheets.reduce((a,s)=>a+s.items.length,0)),
    cuts:res.map(P=>P.sheets.reduce((a,s)=>a+s.cuts,0)),ok:res.every(P=>P.sheets.every(s=>s.ok)),q:N.groups.map(G=>G.types.filter(t=>gilOn(t,N)).reduce((a,t)=>a+t.q,0))};})(nestJob())`);
  assert.equal(r.t.length,1);
  assert.deepEqual(r.t[0],{mm:5,sheets:1,blanks:r.q[0],cuts:r.cuts[0]});
  assert.equal(r.n[0],r.q[0]);
  assert.ok(r.cuts[0]>0);
  assert.ok(r.ok,'есть место без сквозного реза');
});

test('архив «Гильотины»: DXF схемы и CSV заготовок; печь — без 15 мм', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,`zipName('gil')`),'mangal_800x420x200_5mm_gilotina.zip');
  const f=run(c,`(N=>variantFiles(N,${RES}(N),'gil'))(nestJob())`);
  assert.deepEqual(f.map(x=>x[0]),['gilotina_5mm_1250x2500.dxf','gilotina_5mm.csv']);
  const csv=f[1][1].replace(/^﻿/,'').trim().split('\r\n');
  assert.equal(csv[0],'деталь;заготовка, мм;шт;вид');
  const on=run(c,`(N=>N.groups[0].types.filter(t=>gilOn(t,N)).map(t=>t.no+' '+t.p.name))(nestJob())`);
  assert.deepEqual(csv.slice(1).map(l=>l.split(';')[0]),on);
  assert.ok(!/Задвижка|Скоба|Колосник/.test(f[1][1]));
  assert.match(f[0][1],/BLANK/);
  const s=loadMangal({mode:'stove'});page(s);
  const fs=run(s,`(N=>variantFiles(N,${RES}(N),'gil').map(x=>x[0]))(nestJob())`);
  assert.deepEqual(fs,['gilotina_5mm_1250x2500.dxf','gilotina_5mm.csv','gilotina_3mm_1250x2500.dxf','gilotina_3mm.csv']);
  assert.equal(run(s,`zipName('gil')`),'pech_600x440x500_5-3-15mm_gilotina.zip');
});

test('ключ «Гильотины» меняется от подрезки, листа, колосника; старая память галочек на него не влияет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const k=o=>run(c,`gilKey(nestJob(${JSON.stringify(o)}))`),base=k({});
  assert.notEqual(k({edge:0}),base);
  assert.notEqual(k({cgr:true}),base);
  assert.notEqual(k({W:3000,H:1500}),base);
  assert.notEqual(k({side:'r'}),base);
  const d=loadMangal({mode:'grill'});page(d,{'md-gilsel2':{grill_bottom:false},'md-gilsel':{grill_bottom:'laser'},'md-ngil':true});
  assert.equal(run(d,'gilKey(nestJob())'),base);
  assert.equal(run(d,'nestJob().key'),run(c,'nestJob().key'));
});
