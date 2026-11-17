// колосник мангала — перфолист с металлобазы, не лазер (#117; раньше #74 — галочка «Колосник на листе»); перегородка и ручка колосника
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// поля раскроя как на странице и память браузера ls — {ключ: значение}; nCgr:{checked:true} — старое поле, его читать не должны
function page(ctx,ls={}){const mem=Object.fromEntries(Object.entries(ls).map(([k,v])=>[k,JSON.stringify(v)]));
  ctx.__mem=mem;ctx.__els={nGap:{value:'5'},nSheet:{value:'1250x2500'},nCgr:{checked:true}};
  run(ctx,`(()=>{const on=new Map(),D0=document,el=id=>{const e=__els[id];if(!e)return D0.getElementById(id);e.addEventListener=e.addEventListener||((t,f)=>on.set(id+':'+t,f));return e;};
    localStorage={getItem:k=>k in __mem?__mem[k]:null,setItem:(k,v)=>{__mem[k]=String(v);}};
    document=new Proxy({},{get:(t,k)=>k==='getElementById'?el:D0[k]});__fire=(id,t)=>on.get(id+':'+t)();
    NST.init=false;nestInit();})()`);}
// колосник мангала (2 половины) — всегда перфолист с металлобазы (#117): не лазер, галочки «Колосник на листе» нет
const CGR=p=>/^grill_grate_[12]$/.test(p.file)||p.pt==='cgr1'||p.pt==='cgr2';
test('колосника мангала нет в лазерных деталях, на листе и в «Итого» — в любом режиме', ()=>{
  for(const mode of ['grill','both']){
    const c=loadMangal({mode,cgr:true});page(c,{'md-ncgr2':true});
    const lp=run(c,'laserParts()');
    assert.ok(!lp.some(CGR),mode+': колосник в laserParts');
    assert.ok(lp.some(p=>p.pt==='cgrH'),mode+': пластины ручки должны остаться');
    const names=run(c,'nestJob({cgr:true}).groups.flatMap(G=>G.types.map(t=>t.p.name))');
    assert.ok(!names.some(n=>/Колосник мангала/.test(n)),mode+': колосник в задании');
  }
});

test('галочки «Колосник на листе» нет: поле nCgr не читается, nestOpts без cgr', ()=>{
  const c=loadMangal({mode:'grill'});page(c,{'md-ncgr2':true,'md-ncgr':true});
  assert.equal(run(c,"'cgr' in nestOpts()"),false);
  assert.equal(run(c,"typeof NEST_CGR"),'undefined');
});

// таблица листа 5 мм: строки «№ — деталь — DXF» и итог по листу; блока «Не на листе» и сноски нет (#117)
test('«С листа»: блока «Не на листе» и сноски «… не на листе — ниже» нет; итог = сумма строк', ()=>{
  const c=loadMangal({mode:'grill',cgr:true});page(c);
  const r=run(c,`(N=>{const G=N.groups[0],g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
    const h=nestHtml(N,[v.value]),tot=h.match(/<tr class="tot">[\\s\\S]*?<td class="n r">([^<]*)<\\/td><td class="n r">([^<]*)<\\/td>/);
    const cut=G.types.reduce((a,t)=>a+t.m.cut*t.q,0),pierce=G.types.reduce((a,t)=>a+t.m.pierce*t.q,0);
    return {h,tot:[tot[1],tot[2]],want:[fmt(cut/1000,2),String(pierce)],laid:v.value.sheets.reduce((a,s)=>a+s.items.length,0),q:G.types.reduce((a,t)=>a+t.q,0)};})(nestJob())`);
  assert.doesNotMatch(r.h,/Не на листе|не на листе|class="noff"|class="nfoot"/);
  assert.deepEqual(r.tot,r.want);
  assert.equal(r.laid,r.q,'на листе все детали задания');
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

test('ручка колосника: пластины — лазер, лист 5 мм, рубятся как готовая деталь', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(N=>{const t=N.groups[0].types.find(t=>t.p.pt==='cgrH');return {q:t.q,kind:t.kind,mm:t.p.mm};})(nestJob())`);
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
