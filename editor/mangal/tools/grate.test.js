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

// таблица листа 5 мм: строки «№ — деталь — DXF» и итог по листу; ниже — блок «Не на листе» (#92)
const TABLE=`(N=>{const G=N.groups[0],g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
  const h=nestHtml(N,[v.value]),parts=h.split('<section'),sec=parts[1],offSec=parts[2]||'',
  offRows=[...offSec.matchAll(/<tr><td class="n r">(\\d+)<\\/td><td>([^<]*)[\\s\\S]*?<\\/tr>/g)].map(m=>({no:+m[1],name:m[2],dxf:/data-act="part"/.test(m[0]),why:/снят «Колосник на листе»/.test(m[0])})),
  note=h.match(/<p class="nfoot">([^<]*)<\\/p>/),rows=[...sec.matchAll(/<tr( class="on")?><td class="n r">(\\d+)<\\/td><td>([^<]*)[\\s\\S]*?<\\/tr>/g)].map(m=>({no:+m[2],name:m[3],dxf:/data-act="part"/.test(m[0])}));
  const tot=sec.match(/<tr class="tot">[\\s\\S]*?<td class="n r">([^<]*)<\\/td><td class="n r">([^<]*)<\\/td>/);
  const on=G.types.filter(t=>N.cgr||!NEST_CGR(t.p)),cut=on.reduce((a,t)=>a+t.m.cut*t.q,0),pierce=on.reduce((a,t)=>a+t.m.pierce*t.q,0),q=on.reduce((a,t)=>a+t.q,0);
  return {rows,offRows,offSec,note:note&&note[1],noteBeforeFig:note?h.indexOf('<p class="nfoot">')<h.indexOf('<figure'):null,grate:G.types.filter(t=>NEST_CGR(t.p)).map(t=>t.no),tot:[tot[1],tot[2]],want:[fmt(cut/1000,2),String(pierce)],tq:+sec.match(/Итого по листу 5 мм: (\\d+) шт/)[1],q,
    onSheet:v.value.sheets.flatMap(s=>s.items).filter(it=>NEST_CGR(G.items[it.id].ty.p)).length};})`;

test('галочка снята: колосника нет в основной таблице, он в блоке «Не на листе» с причиной и DXF; итог = сумма строк', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,TABLE+'(nestJob({cgr:false}))');
  assert.equal(r.grate.length,2);
  r.grate.forEach(no=>{assert.ok(!r.rows.some(o=>o.no===no),'колосник '+no+' в основной таблице');
    const row=r.offRows.find(o=>o.no===no);assert.ok(row,'нет строки колосника '+no+' в блоке');assert.ok(row.dxf,'нет DXF колосника '+no);assert.ok(row.why,'нет причины '+no);});
  assert.match(r.offSec,/class="noff"/);assert.match(r.offSec,/<h4>Не на листе<\/h4>/);assert.match(r.offSec,/otbl/);
  assert.equal(r.onSheet,0);
  assert.deepEqual(r.tot,r.want);
  assert.equal(r.tq,r.q);
  assert.equal(r.note,'2 детали не на листе — ниже');
  assert.ok(r.noteBeforeFig,'сноска под схемой');
  // и с галочкой — колосник в основной таблице и в цифрах, блока нет
  const s=run(c,TABLE+'(nestJob({cgr:true}))');
  assert.equal(s.onSheet,2);
  assert.equal(s.offRows.length,0);assert.doesNotMatch(s.offSec,/noff/);assert.equal(s.note,null);
  s.grate.forEach(no=>assert.ok(s.rows.some(o=>o.no===no),'нет колосника '+no));
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

test('перегородка по умолчанию: есть в составе и в «Раскрой и масса», со снятой галочкой — нигде', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'S.div'),true);
  const has=()=>run(c,`({dxf:laserParts().some(p=>p.file==='grill_divider'),cut:massRows().rows.some(r=>/^Перегородка жаровни/.test(r.n||''))})`);
  assert.deepEqual(has(),{dxf:true,cut:true});
  run(c,'S.div=false');
  assert.deepEqual(has(),{dxf:false,cut:false});
});

// #102: ручка колосника — четыре пластины 30 × 80 × 5 из листа, не покупной уголок
test('ручка колосника: строка «Пластины ручки колосника» 30 × 80 × 5, 4 шт, 0,094 кг; уголка нет; итог = сумма строк; без колосника строки нет', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.deepEqual(run(c,'[CG_HA,CG_HL,CG_HT]'),[3,8,.5]);
  const rows=run(c,'massRows().rows');
  assert.ok(!rows.some(r=>/Ручка колосника — уголок|30×30×3/.test(r.n)&&/Ручка колосника/.test(r.n)),'уголок ручки остался');
  const pl=rows.filter(r=>/^Пластины ручки колосника/.test(r.n));
  assert.equal(pl.length,1);
  assert.equal(pl[0].s,'30 × 80 × 5');assert.equal(pl[0].q,4);
  assert.ok(Math.abs(pl[0].m-0.094)<0.001,'масса '+pl[0].m);
  const {tot}=run(c,'massRows()');
  assert.ok(Math.abs(rows.reduce((a,r)=>a+r.m*r.q,0)-tot)<1e-6,'итог = сумма строк');
  run(c,'S.cgr=false');
  assert.ok(!run(c,'massRows().rows').some(r=>/ручк[иа] колосника/i.test(r.n)));
  assert.ok(!run(c,'laserParts().some(p=>p.file==="grill_grate_handle")'));
});

test('ручка колосника: пластины не привязаны к «Колосник на листе» и не идут в «Из заготовок»', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'NEST_CGR({pt:"cgrH"})'),false);
  const r=run(c,`(N=>{const t=N.groups[0].types.find(t=>t.p.pt==='cgrH');return {q:t.q,kind:t.kind,mm:t.p.mm};})(nestJob({cgr:false}))`);
  assert.deepEqual(r,{q:4,kind:'gil',mm:5});
});

test('ручка колосника: печь — пластин нет; «оба» — один раз; у пластин есть гравировка', ()=>{
  const st=loadMangal({mode:'stove'});
  assert.ok(!run(st,'laserParts().some(p=>p.pt==="cgrH")'));
  assert.ok(!run(st,'massRows().rows.some(r=>/^Пластины ручки/.test(r.n))'));
  const both=loadMangal({mode:'both'});
  assert.equal(run(both,'massRows().rows.filter(r=>/^Пластины ручки/.test(r.n)).length'),1);
  assert.equal(run(both,'laserParts().filter(p=>p.pt==="cgrH").length'),1);
  const g=loadMangal({mode:'grill'});
  assert.ok(run(g,`(N=>N.groups[0].types.find(t=>t.p.pt==='cgrH').eng.length)(nestJob())`)>0,'нет штрихов номера');
});
