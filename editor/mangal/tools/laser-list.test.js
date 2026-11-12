// «Лазер · DXF → С листа» (#76): что уходит лазерщику — имя архива, файлы архива, итоги для оценки
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// раскладка всех толщин по заданию N (как по кнопке «Рассчитать»)
const RES='(N=>N.groups.map(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return v.value;}))';

test('имя архива: размеры, толщина, вариант', ()=>{
  assert.equal(run(loadMangal({mode:'grill'}),`zipName('list')`),'mangal_800x420x200_5mm_laser-list.zip');
  assert.equal(run(loadMangal({mode:'stove'}),`zipName('list')`),'pech_600x440x500_5-3-15mm_laser-list.zip');
  assert.equal(run(loadMangal({mode:'both'}),`zipName('list')`),'mangal_s_pechyu_800x420x200_600x440x500_5-3-15mm_laser-list.zip');
});

test('архив «С листа»: DXF каждого листа и каждой детали, колосник без галочки — только деталью', ()=>{
  const c=loadMangal({mode:'grill'});
  const f=run(c,`(N=>listFiles(N,${RES}(N)).map(x=>x[0]))(nestJob({cgr:false}))`);
  assert.deepEqual(f.filter(n=>n.startsWith('list_')),['list_5mm_1250x2500.dxf']);
  const parts=run(c,'laserParts().map(dxfName)');
  assert.deepEqual(f.filter(n=>!n.startsWith('list_')).sort(),[...parts].sort());
  assert.ok(f.includes('grill_grate_1_5mm_x1.dxf')&&f.includes('grill_grate_2_5mm_x1.dxf'),'нет DXF колосника: '+f.join(', '));
  assert.ok(f.every(n=>/\.dxf$/.test(n)),'в архиве лазерщика только DXF');
  // колосник не на листе: в DXF листа его нет — деталей на листе на 2 меньше, чем с галочкой
  const on=run(c,`(N=>${RES}(N)[0].sheets[0].items.length)(nestJob({cgr:true}))`),off=run(c,`(N=>${RES}(N)[0].sheets[0].items.length)(nestJob({cgr:false}))`);
  assert.equal(on-off,2);
});

test('печь и «оба»: в архиве листы всех толщин', ()=>{
  for(const mode of ['stove','both']){
    const f=run(loadMangal({mode}),`(N=>listFiles(N,${RES}(N)).map(x=>x[0]))(nestJob())`);
    for(const mm of [5,3,15])assert.ok(f.includes(`list_${mm}mm_1250x2500.dxf`),mode+': нет листа '+mm+' мм — '+f.filter(n=>n.startsWith('list_')).join(', '));
  }
});

// цифры из спеки (2026-11-09-mangal-cut-tabs-design.md, «Лазер → С листа»): лист 5 мм мангала по умолчанию — 46,14 м реза и 771 врезка,
// из них два колосника — 24,58 м и 686; без колосника остаётся 21,56 м и 85
test('итоги «С листа»: рез, врезки, листы, заполнение — без снятого колосника и с ним', ()=>{
  const c=loadMangal({mode:'grill'});
  const [g]=run(c,`(N=>listTotals(N,${RES}(N)))(nestJob({cgr:false}))`);
  assert.equal(g.mm,5);
  assert.equal(g.sheets,1);
  assert.ok(Math.abs(g.cut/1000-21.56)<0.02,'рез '+g.cut);
  assert.equal(g.pierce,85);
  assert.ok(g.fill>0.25&&g.fill<0.4,'заполнение '+g.fill);
  const [g2]=run(c,`(N=>listTotals(N,${RES}(N)))(nestJob({cgr:true}))`);
  assert.ok(Math.abs(g2.cut/1000-46.14)<0.02,'рез с колосником '+g2.cut);
  assert.equal(g2.pierce,771);
  assert.ok(g2.fill>g.fill);
});

test('итоги «С листа»: «Не поместилось» в рез и врезки не входит', ()=>{
  const c=loadMangal({mode:'grill'});
  // лист 400 × 300: большие детали не влезают («Не поместилось») — в рез идут только детали, что легли на лист
  const r=run(c,`(N=>{const res=${RES}(N),[t]=listTotals(N,res),laid=res[0].sheets.flatMap(s=>s.items);
    return {t,laid:laid.length,too:res[0].too.length,cut:laid.reduce((a,it)=>a+N.groups[0].items[it.id].ty.m.cut,0)};})(nestJob({W:400,H:300,sk:'x',gap:5}))`);
  assert.ok(r.too>0,'на маленьком листе что-то не влезло');
  assert.ok(r.laid>0);
  assert.equal(r.t.cut,r.cut);
});

// старая память браузера: «Заготовки с гильотины» (md-ngil) и «гильотина | лазер» у детали (md-gilsel) задание не меняют
test('старая память браузера (md-ngil, md-gilsel) задание не меняет', ()=>{
  const clean=run(loadMangal({mode:'grill'}),'nestJob().key');
  const c=loadMangal({mode:'grill'}),mem={'md-ngil':'true','md-gilsel':'{"grill_bottom":"laser","grill_side_back":"gil"}','md-nedge':'0'};
  c.__mem=mem;run(c,'localStorage={getItem:k=>k in __mem?__mem[k]:null,setItem:()=>{}}');
  assert.equal(run(c,'store("md-ngil")'),true,'память на месте');
  assert.equal(run(c,'nestJob().key'),clean);
  const o=run(c,'nestOpts()');
  assert.equal('gil' in o,false);
  assert.equal('sel' in o,false);
});
