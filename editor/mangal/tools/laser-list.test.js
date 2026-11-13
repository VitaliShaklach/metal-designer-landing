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

// «Прижать к краю» (пересмотр 14.11): одна настройка с «Гильотиной»; справа — та же раскладка, сдвинутая целиком (не зеркально: деталь не меняется)
test('«С листа» справа: раскладка сдвинута к правому краю, детали те же и так же повёрнуты; ключ меняется', ()=>{
  const c=loadMangal({mode:'both'});
  const get=side=>run(c,`(N=>${RES}(N).map(R=>(nestSide(R,N.W,NEST_EDGE,N.side),R.sheets.map(s=>s.items.map(it=>({id:it.id,tr:it.tr,pts:it.pts,bb:it.bb}))))))(nestJob({cgr:true,side:'${side}'}))`);
  const L=get('l'),R=get('r'),W=2500,E=10;
  L.forEach((sheets,gi)=>sheets.forEach((it,si)=>{const ri=R[gi][si],dx=W-E-Math.max(...it.map(i=>i.bb[2]));
    assert.ok(Math.abs(Math.min(...it.map(i=>i.bb[0]))-E)<1e-6,'слева не у края');
    assert.ok(Math.abs(Math.max(...ri.map(i=>i.bb[2]))-(W-E))<1e-6,'справа не у края');
    it.forEach((a,k)=>{const b=ri[k];assert.equal(b.id,a.id);assert.equal(b.tr.c,a.tr.c);assert.equal(b.tr.s,a.tr.s);
      assert.ok(Math.abs(b.tr.x-a.tr.x-dx)<1e-6&&Math.abs(b.tr.y-a.tr.y)<1e-6,'сдвиг tr');
      assert.ok(b.pts.every((p,j)=>Math.abs(p[0]-a.pts[j][0]-dx)<1e-6&&Math.abs(p[1]-a.pts[j][1])<1e-6),'сдвиг контура');
      assert.ok(Math.abs(b.bb[0]-a.bb[0]-dx)<1e-6&&Math.abs(b.bb[2]-a.bb[2]-dx)<1e-6,'сдвиг рамки');});}));
  assert.notEqual(run(c,`nestJob({side:'r'}).key`),run(c,'nestJob().key'));
  // DXF листа справа: детали там же, где на рисунке
  const dxf=run(c,`(N=>{const res=${RES}(N);res.forEach(R=>nestSide(R,N.W,NEST_EDGE,N.side));return nestDxf(N,N.groups[0],res[0].sheets[0]);})(nestJob({side:'r'}))`);
  const xs=[];const t=dxf.split('\r\n');for(let i=0;i<t.length-1;i++)if(t[i]==='10'&&t[i-2]==='8'&&t[i-1]==='CUT')xs.push(+t[i+1]);
  assert.ok(xs.length>0&&Math.max(...xs)>W/2,'DXF не сдвинут');
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
