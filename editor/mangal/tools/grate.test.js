// колосник мангала по умолчанию не на листе (#74): строка и DXF в таблице остаются, на схеме и в «Итого по листу» — только с галочкой
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// поля раскроя как на странице (галочка «Колосник мангала на листе» в HTML снята) и память браузера ls — {ключ: значение}
function page(ctx,ls={}){const mem=Object.fromEntries(Object.entries(ls).map(([k,v])=>[k,JSON.stringify(v)]));
  ctx.__mem=mem;ctx.__els={nGap:{value:'5'},nSheet:{value:'1250x2500'},nCgr:{checked:false}};
  run(ctx,`(()=>{const on=new Map(),D0=document,el=id=>{const e=__els[id];if(!e)return D0.getElementById(id);e.addEventListener=e.addEventListener||((t,f)=>on.set(id+':'+t,f));return e;};
    localStorage={getItem:k=>k in __mem?__mem[k]:null,setItem:(k,v)=>{__mem[k]=String(v);}};
    document=new Proxy({},{get:(t,k)=>k==='getElementById'?el:D0[k]});__fire=(id,t)=>on.get(id+':'+t)();
    NST.init=false;nestInit();})()`);}
const GRATE='G=>G.types.filter(t=>NEST_CGR(t.p))';

test('первое открытие: колосник не на листе', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,'nestOpts().cgr'),false);
  const r=run(c,`(()=>{const N=nestJob(),G=N.groups[0];return {types:(${GRATE})(G).length,items:G.items.filter(i=>NEST_CGR(i.ty.p)).length,has:N.hasCgr};})()`);
  assert.deepEqual(r,{types:2,items:0,has:true});
});

test('старое md-ncgr=true в памяти браузера колосник не включает', ()=>{
  const c=loadMangal({mode:'grill'});page(c,{'md-ncgr':true,'md-gilsel':{grill_side_back_5mm_x1:'laser'},'md-ngil':true});
  assert.equal(run(c,'nestOpts().cgr'),false);
  assert.equal(c.__els.nCgr.checked,false);
});

test('галочку поставили: колосник на листе, выбор запоминается', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  c.__els.nCgr.checked=true;run(c,`__fire('nCgr','change')`);
  assert.equal(c.__mem['md-ncgr2'],'true');
  assert.equal(run(c,`nestJob().groups[0].items.filter(i=>NEST_CGR(i.ty.p)).length`),2);
  // новое открытие страницы — галочка из памяти
  const d=loadMangal({mode:'grill'});page(d,{'md-ncgr2':true});
  assert.equal(d.__els.nCgr.checked,true);
  assert.equal(run(d,'nestOpts().cgr'),true);
});

// таблица листа 5 мм: строки «№ — деталь — DXF» и итог по листу
const TABLE=`(N=>{const G=N.groups[0],g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
  const h=nestHtml(N,[v.value]),sec=h.split('<section')[1],rows=[...sec.matchAll(/<tr( class="on")?><td class="n r">(\\d+)<\\/td><td>([^<]*)[\\s\\S]*?<\\/tr>/g)].map(m=>({no:+m[2],name:m[3],dxf:/data-act="part"/.test(m[0])}));
  const tot=sec.match(/<tr class="tot">[\\s\\S]*?<td class="n r">([^<]*)<\\/td><td class="n r">([^<]*)<\\/td>/);
  const on=G.types.filter(t=>N.cgr||!NEST_CGR(t.p)),cut=on.reduce((a,t)=>a+t.m.cut*t.q,0),pierce=on.reduce((a,t)=>a+t.m.pierce*t.q,0),q=on.reduce((a,t)=>a+t.q,0);
  return {rows,grate:G.types.filter(t=>NEST_CGR(t.p)).map(t=>t.no),tot:[tot[1],tot[2]],want:[fmt(cut/1000,2),String(pierce)],tq:+sec.match(/Итого по листу 5 мм: (\\d+) шт/)[1],q,
    onSheet:v.value.sheets.flatMap(s=>s.items).filter(it=>NEST_CGR(G.items[it.id].ty.p)).length};})`;

test('галочка снята: строка колосника и его DXF в таблице, на листе и в «Итого» его нет', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,TABLE+'(nestJob({cgr:false}))');
  assert.equal(r.grate.length,2);
  r.grate.forEach(no=>{const row=r.rows.find(o=>o.no===no);assert.ok(row,'нет строки колосника '+no);assert.ok(row.dxf,'нет DXF колосника '+no);});
  assert.equal(r.onSheet,0);
  assert.deepEqual(r.tot,r.want);
  assert.equal(r.tq,r.q);
  // и с галочкой — колосник в цифрах (итог больше)
  const s=run(c,TABLE+'(nestJob({cgr:true}))');
  assert.equal(s.onSheet,2);
  assert.deepEqual(s.tot,s.want);
  assert.ok(s.tq===r.tq+2,'шт: '+s.tq+' против '+r.tq);
});

test('печь и «оба»: от галочки меняется только колосник мангала, толщины те же', ()=>{
  for(const mode of ['stove','both']){
    const c=loadMangal({mode});
    const sig=cgr=>run(c,`(N=>({mm:N.groups.map(G=>G.mm),t:N.groups.map(G=>G.types.map(t=>[t.p.file,t.q])),
      i:N.groups.map(G=>G.items.filter(i=>!NEST_CGR(i.ty.p)).map(i=>i.ty.p.file))}))(nestJob({cgr:${cgr}}))`);
    assert.deepEqual(sig(false),sig(true),mode);
  }
});

test('галочка меняет ключ раскроя: старый лист не остаётся', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.notEqual(run(c,'nestJob({cgr:false}).key'),run(c,'nestJob({cgr:true}).key'));
});
