// «Лазер · DXF → С листа» (#76): что уходит лазерщику — имя архива, файлы архива, итоги для оценки
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// раскладка всех толщин по заданию N (как по кнопке «Рассчитать»)
const RES='(N=>N.groups.map(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return v.value;}))';

// «Скачать DXF листа» вместо архивов (пересмотр 14.11 (2), блок А): один лист — одна кнопка, один файл
test('архивов нет: zipName, variantFiles, listFiles, gilCsv, gilFiles, zagFiles, savePart не существуют', ()=>{
  const c=loadMangal({mode:'grill'});
  for(const n of ['zipName','variantFiles','listFiles','gilFiles','zagFiles','gilCsv','gilHas','zagHas','savePart','MODE_FILE','ZIP_VAR','VAR_FILES'])assert.equal(run(c,`typeof ${n}`),'undefined',n);
  assert.equal(run(c,'typeof zipFiles'),'function');   // saveDxf на опубликованной странице кладёт DXF в .zip
});

test('DXF листа «С листа»: имя list_5mm_1250x2500.dxf, в тексте лист и рез; колосник без галочки на листе нет', ()=>{
  const c=loadMangal({mode:'grill'});
  const f=run(c,`(N=>listOne(N,${RES}(N),{act:'sheet',g:'0',s:'0'}))(nestJob({cgr:false}))`);
  assert.equal(f[0],'list_5mm_1250x2500.dxf');
  assert.match(f[1],/\r\nSHEET\r\n/);assert.match(f[1],/\r\nCUT\r\n/);
  assert.equal(run(c,`(N=>listOne(N,${RES}(N),{act:'sheet',g:'0',s:'5'}))(nestJob())`),null);
  // деталь — прежний DXF детали (в таблице кнопки остаются), колосник без галочки — только деталью
  const p=run(c,`(N=>listOne(N,${RES}(N),{act:'part',g:'0',t:'0'}))(nestJob({cgr:false}))`);
  assert.match(p[0],/\.dxf$/);
  const parts=run(c,'laserParts().map(dxfName)');
  assert.ok(run(c,`(N=>N.groups[0].types.map(t=>partFile(t)[0]))(nestJob({cgr:false}))`).every(n=>parts.includes(n)));
  const on=run(c,`(N=>${RES}(N)[0].sheets[0].items.length)(nestJob({cgr:true}))`),off=run(c,`(N=>${RES}(N)[0].sheets[0].items.length)(nestJob({cgr:false}))`);
  assert.equal(on-off,2);
});

test('печь и «оба»: кнопки листа 5, 3 и 15 мм', ()=>{
  for(const mode of ['stove','both']){
    const c=loadMangal({mode});
    const h=run(c,`(N=>nestHtml(N,${RES}(N)))(nestJob())`);
    const names=[...h.matchAll(/data-act="sheet" data-g="(\d+)" data-s="(\d+)">([^<]*)</g)].map(m=>m[3]);
    assert.deepEqual(names,['Скачать DXF листа','Скачать DXF листа','Скачать DXF листа'],mode);
    const files=run(c,`(N=>{const res=${RES}(N);return N.groups.map((G,gi)=>listOne(N,res,{act:'sheet',g:String(gi),s:'0'})[0]);})(nestJob())`);
    assert.deepEqual(files,['list_5mm_1250x2500.dxf','list_3mm_1250x2500.dxf','list_15mm_1250x2500.dxf'],mode);
    assert.ok(!/Скачать архив|ZIP/.test(h));
    const figs=h.split('<figure class="nsheet">').slice(1);   // #103: подпись, кнопка, схема
    assert.equal(figs.length,3,mode);
    figs.forEach(f=>{const a=f.indexOf('</figcaption>'),b=f.indexOf('data-act="sheet"'),v=f.indexOf('<svg');assert.ok(a>0&&b>a&&v>b,mode+': кнопка листа должна стоять над схемой');});
  }
});

// цифры из спеки (2026-11-09-mangal-cut-tabs-design.md, «Лазер → С листа»): лист 5 мм мангала по умолчанию — 46,14 м реза и 771 врезка (до перегородки по умолчанию, #101; с ней — 47,47 м и 772),
// из них два колосника — 24,58 м и 686; без колосника остаётся 21,56 м и 85 (с перегородкой — 22,90 м и 86)
test('итоги «С листа»: рез, врезки, листы, заполнение — без снятого колосника и с ним', ()=>{
  const c=loadMangal({mode:'grill'});
  const [g]=run(c,`(N=>listTotals(N,${RES}(N)))(nestJob({cgr:false}))`);
  assert.equal(g.mm,5);
  assert.equal(g.sheets,1);
  assert.ok(Math.abs(g.cut/1000-23.78)<0.02,'рез '+g.cut);
  assert.equal(g.pierce,90);
  assert.ok(g.fill>0.25&&g.fill<0.4,'заполнение '+g.fill);
  const [g2]=run(c,`(N=>listTotals(N,${RES}(N)))(nestJob({cgr:true}))`);
  assert.ok(Math.abs(g2.cut/1000-48.35)<0.02,'рез с колосником '+g2.cut);
  assert.equal(g2.pierce,776);
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

// «Угол листа» (пересмотр 14.11 (2), блок Б): отражаются рамки деталей, деталь не зеркалится
test('«С листа» в каждом углу: прижато к своему углу, деталь не зеркалится, ключ меняется, DXF = рисунок', ()=>{
  const W=2500,H=1250,E=10;
  for(const mode of ['grill','both']){
    const c=loadMangal({mode});
    const get=corner=>run(c,`(N=>${RES}(N).map(R=>(nestCorner(R,N.W,N.H,N.corner),R.sheets.map(s=>s.items.map(it=>({id:it.id,tr:it.tr,pts:it.pts,bb:it.bb}))))))(nestJob({cgr:true,corner:'${corner}'}))`);
    const L=get('lb');
    for(const corner of ['lb','lt','rb','rt']){
      const R=get(corner),mx=corner[0]==='r',my=corner[1]==='t';
      L.forEach((sheets,gi)=>sheets.forEach((it,si)=>{const ri=R[gi][si],lbl=`${mode} ${corner} ${gi}/${si}`;
        const bx=ri.map(i=>i.bb);
        if(mx)assert.ok(Math.abs(Math.max(...bx.map(b=>b[2]))-(W-E))<1e-6,lbl+': не у правого');else assert.ok(Math.abs(Math.min(...bx.map(b=>b[0]))-E)<1e-6,lbl+': не у левого');
        if(my)assert.ok(Math.abs(Math.max(...bx.map(b=>b[3]))-(H-E))<1e-6,lbl+': не у верха');else assert.ok(Math.abs(Math.min(...bx.map(b=>b[1]))-E)<1e-6,lbl+': не у низа');
        it.forEach((a,k)=>{const b=ri[k];assert.equal(b.id,a.id);assert.equal(b.tr.c,a.tr.c,lbl);assert.equal(b.tr.s,a.tr.s,lbl);
          const dx=b.tr.x-a.tr.x,dy=b.tr.y-a.tr.y;
          assert.ok(b.pts.every((p,j)=>Math.abs(p[0]-a.pts[j][0]-dx)<1e-6&&Math.abs(p[1]-a.pts[j][1]-dy)<1e-6),lbl+': один сдвиг на деталь');
          const ex=mx?W-a.bb[2]:a.bb[0],ey=my?H-a.bb[3]:a.bb[1];
          assert.ok(Math.abs(b.bb[0]-ex)<1e-6&&Math.abs(b.bb[1]-ey)<1e-6&&Math.abs(b.bb[2]-b.bb[0]-(a.bb[2]-a.bb[0]))<1e-6&&Math.abs(b.bb[3]-b.bb[1]-(a.bb[3]-a.bb[1]))<1e-6,lbl+': рамка не отражение');});}));}}
  const c=loadMangal({mode:'both'});
  assert.notEqual(run(c,`nestJob({corner:'rt'}).key`),run(c,'nestJob().key'));
  // DXF листа в углу: точки CUT = контуры на рисунке, у каждой детали
  const dxf=run(c,`(N=>{const res=${RES}(N);res.forEach(R=>nestCorner(R,N.W,N.H,N.corner));const G=N.groups[0],sh=res[0].sheets[0];return {d:nestDxf(N,G,sh),pts:sh.items.map(it=>it.pts)};})(nestJob({corner:'rt'}))`);
  const cut=[],t=dxf.d.split('\r\n');for(let i=0;i<t.length-1;i++)if(t[i]==='10'&&t[i-2]==='8'&&t[i-1]==='CUT')cut.push([+t[i+1],+t[i+3]]);
  const want=dxf.pts.flat().map(p=>[Math.round(p[0]*100)/100,Math.round(p[1]*100)/100]);
  assert.ok(cut.length>0,'нет CUT');
  const key=p=>p.join(',');const have=new Set(cut.map(key));
  assert.ok(want.every(p=>have.has(key(p))),'точки контура на рисунке не совпали с DXF');
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

// несколько листов в толщине (лист 1000 × 2000, «оба» с колосником): угол на каждом листе, зазор не меньше заданного
test('«С листа» на 1000 × 2000: несколько листов, угол и зазор на каждом листе', ()=>{
  const W=2000,H=1000,E=10,gap=5,c=loadMangal({mode:'both'});
  for(const corner of ['lb','lt','rb','rt']){
    const r=run(c,`(N=>${RES}(N).map(R=>(nestCorner(R,N.W,N.H,N.corner),R.sheets.map(s=>{let g=1e9;
      for(let i=0;i<s.items.length;i++)for(let j=i+1;j<s.items.length;j++)g=Math.min(g,polyGap(s.items[i].pts,s.items[j].pts));
      return {bb:s.items.map(it=>it.bb),gap:g};}))))(nestJob({cgr:true,corner:'${corner}',W:${W},H:${H},sk:'${W}x${H}',gap:${gap}}))`);
    assert.ok(r.some(sheets=>sheets.length>1),'ждали несколько листов в толщине');
    if(corner==='lb'){const h=run(c,`(N=>nestHtml(N,${RES}(N)))(nestJob({cgr:true,W:${W},H:${H},sk:'${W}x${H}',gap:${gap}}))`);
      assert.ok(h.includes('>Скачать DXF листа 1<')&&h.includes('>Скачать DXF листа 2<'),'нет кнопок «Скачать DXF листа 1» и «… 2»');}
    r.forEach(sheets=>sheets.forEach((s,si)=>{const L=`${corner} лист ${si+1}`;
      if(corner[0]==='r')assert.ok(Math.abs(Math.max(...s.bb.map(b=>b[2]))-(W-E))<1e-6,L);else assert.ok(Math.abs(Math.min(...s.bb.map(b=>b[0]))-E)<1e-6,L);
      if(corner[1]==='t')assert.ok(Math.abs(Math.max(...s.bb.map(b=>b[3]))-(H-E))<1e-6,L);else assert.ok(Math.abs(Math.min(...s.bb.map(b=>b[1]))-E)<1e-6,L);
      assert.ok(s.gap>=gap-0.01,L+': зазор '+s.gap);}));}
});

// #102: пластины ручки колосника на схеме «С листа» и в DXF
test('пластины ручки: деталь grill_grate_handle ×4, 5 мм; на схеме 4 штуки под одним номером; зазор не меньше заданного; DXF-имя', ()=>{
  const c=loadMangal({mode:'grill'});
  const p=run(c,`laserParts().filter(p=>p.file==='grill_grate_handle').map(p=>[p.q,p.mm,p.pt,p.name,dxfName(p)])`);
  assert.deepEqual(p,[[4,5,'cgrH','Пластина ручки колосника','grill_grate_handle_5mm_x4.dxf']]);
  for(const cgr of [false,true]){
    const r=run(c,`(N=>{const R=${RES}(N)[0],G=N.groups[0],no=G.types.find(t=>t.p.pt==='cgrH').no;
      const its=R.sheets.flatMap(s=>s.items).filter(it=>G.items[it.id].ty.no===no);
      let g=1e9;R.sheets.forEach(s=>{for(let i=0;i<s.items.length;i++)for(let j=i+1;j<s.items.length;j++)g=Math.min(g,polyGap(s.items[i].pts,s.items[j].pts));});
      return {n:its.length,g,gap:N.gap,h:nestHtml(N,[R])};})(nestJob({cgr:${cgr}}))`);
    assert.equal(r.n,4);assert.ok(r.g>=r.gap-0.01,'зазор '+r.g);
    assert.match(r.h,/grill_grate_handle_5mm_x4\.dxf/);
  }
  const f=run(c,`(N=>partFile(N.groups[0].types.find(t=>t.p.pt==='cgrH')))(nestJob())`);
  assert.equal(f[0],'grill_grate_handle_5mm_x4.dxf');
});
