// «Чертежи» мангала (#67): листы А3 по кнопке «Рассчитать» — порядок, спецификация, раскрой, ключ задания
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

// раскладка всех толщин по заданию N, как по кнопке «Рассчитать» (без 3D — виды листов заменены надписью)
const RES='(N=>N.groups.map(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return v.value;}))';
function sheets(c,over='{}'){return run(c,`(()=>{ok=false;const N=nestJob(${over}),res=${RES}(N);return sheetsBuild(N,res);})()`);}
const text=svg=>[...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join('\n');

test('листы идут в порядке: общий вид, порядок сборки, детали, спецификация, раскрой', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const L=sheets(c),t=L.map(s=>s.title),first=n=>t.indexOf(n),last=n=>t.lastIndexOf(n);
  assert.equal(t[0],'Общий вид');
  assert.ok(first('Порядок сборки')===1);
  assert.ok(last('Порядок сборки')<first('Детали')&&last('Детали')<first('Спецификация')&&last('Спецификация')<first('Раскрой'));
  assert.equal(t[t.length-1],'Раскрой');
  L.forEach(s=>{assert.match(s.svg,/viewBox="0 0 420 297"/);assert.match(s.svg,/Metal Designer для цеха/);});
});

test('штамп: «Мангал L × W × H, 5 мм», номер листа и листов, масса из «Раскрой и масса»', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const L=sheets(c),kg=run(c,'kg1(massRows().tot)');
  const name=run(c,'`Мангал ${Math.round(L1*10)} × ${Math.round(W*10)} × ${Math.round(T*10)}, 5 мм`');
  assert.equal(name,'Мангал 800 × 420 × 970, 5 мм');
  L.forEach((s,i)=>{const tx=text(s.svg);assert.ok(tx.includes(name),'название '+i);assert.ok(tx.includes('≈ '+kg+' кг'),'масса '+i);
    assert.ok(tx.split('\n').includes(String(i+1))&&tx.split('\n').includes(String(L.length)),'лист '+(i+1)+' из '+L.length);});
});

test('«Раскрой»: по листу на каждый лист каждой толщины, подпись «Лист 5 мм, 1250 × 2500»', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const R=sheets(c).filter(s=>s.title==='Раскрой');
  assert.equal(R.length,1);
  assert.ok(text(R[0].svg).includes('Лист 5 мм, 1250 × 2500'));
  // печь и «оба»: 5, 3 и 15 мм — по листу
  for(const mode of ['stove','both']){
    const c2=loadMangal({mode});page(c2);
    const R2=sheets(c2).filter(s=>s.title==='Раскрой'),tx=R2.map(s=>text(s.svg).match(/Лист (\d+) мм, 1250 × 2500/)[1]);
    assert.deepEqual(tx,['5','3','15'],mode);
  }
});

test('«Раскрой»: колосник мангала — только с галочкой «Колосник на листе»', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const cnt=over=>{const R=sheets(c,over).filter(s=>s.title==='Раскрой');return (R[0].svg.match(/data-no="\d+"/g)||[]).length;};
  assert.equal(cnt('{cgr:true}')-cnt('{cgr:false}'),2);
});

test('«Раскрой»: боковина лежит с прорезями — контур тот же, что в DXF (26 прорезей шагом 30, шампуры через одну — 60)', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  assert.equal(run(c,'SLOT*10'),30);
  assert.equal(run(c,'slots().length'),26);
  const R=sheets(c).filter(s=>s.title==='Раскрой')[0];
  const side=run(c,'nestJob().groups[0].types.find(t=>t.p.pt===\'side0\').P.length');
  const pts=[...R.svg.matchAll(/<path class="t" data-no="(\d+)" d="([^"]+)"/g)].map(m=>({no:+m[1],n:m[2].split('L').length}));
  const no=run(c,'nestJob().groups[0].types.find(t=>t.p.pt===\'side0\').no');
  assert.ok(pts.some(p=>p.no===no&&p.n===side),'контур боковины в раскрое: '+side+' точек');
});

test('спецификация: строки и масса те же, что в «Раскрой и масса»; металл под таблицей', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const S2=sheets(c).filter(s=>s.title==='Спецификация').map(s=>text(s.svg)).join('\n');
  const rows=run(c,'massRows().rows.map(r=>[r.n,r.q])');
  rows.forEach(([n,q])=>{assert.ok(S2.includes(n.slice(0,20)),'нет строки «'+n+'»');});
  assert.ok(S2.includes('Итого металла ≈ '+run(c,'kg1(massRows().tot)')+' кг'));
  assert.ok(S2.includes('Лист 5 мм — '));   // блок «Металл»
  assert.ok(!S2.includes('…'),'в спецификации ничего не обрезано');
  // строка таблицы: позиция, имя, размер, количество, масса — как в «Раскрой и масса»
  const lines=S2.split('\n'),full=run(c,'massRows().rows.map(r=>[r.n,String(r.s).replace(/\\d+\\.\\d+/g,v=>fmt(+v,1)),String(r.q),kgTxt(r.m*r.q)])');
  full.forEach(([n,sz,q,kg])=>{const i=lines.indexOf(n);assert.ok(i>=0,'нет строки «'+n+'»');assert.deepEqual(lines.slice(i+1,i+4),[sz,q,kg],n);});
});

test('«Детали»: каждая деталь под лазер под своим номером, как в «С листа»', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const D=sheets(c).filter(s=>s.title==='Детали').map(s=>text(s.svg)).join('\n');
  run(c,'nestJob()').groups.forEach(G=>G.types.forEach(ty=>assert.ok(D.includes(`${ty.no}. ${ty.p.name}`),ty.p.name)));
});

test('ключ задания: деталь, режим и опции меняют его; вращение, размеры на модели и выбор — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const k=()=>run(c,'sheetsKey()'),k0=k();
  assert.equal(typeof k0,'string');
  run(c,'S.dims.add("x");S.sel.el="grill"');assert.equal(k(),k0,'размеры и выбор');
  run(c,'S.dims.clear();S.sel.el=null;S.rain=true');assert.notEqual(k(),k0,'крыша');
  run(c,'S.rain=false');assert.equal(k(),k0);
  run(c,'TOPH=100;recompute()');assert.notEqual(k(),k0,'высота');
  run(c,'TOPH=97;recompute()');assert.equal(k(),k0);
  run(c,'S.mode="stove"');assert.notEqual(k(),k0,'режим');
});

// Печь и «оба» (#69): чертежи строятся, готовность не проверяется, строки «пока не готовы» нет
test('печь и «оба»: комплект строится — листы по порядку, «пока не готовы» нет нигде', ()=>{
  for(const mode of ['stove','both']){
    const c=loadMangal({mode});page(c);
    assert.equal(run(c,'typeof sheetsReady'),'undefined',mode);
    const L=sheets(c),t=L.map(s=>s.title);
    assert.equal(t[0],'Общий вид');assert.equal(t[1],'Порядок сборки');assert.equal(t[t.length-1],'Раскрой');
    assert.ok(t.lastIndexOf('Порядок сборки')<t.indexOf('Детали')&&t.lastIndexOf('Детали')<t.indexOf('Спецификация')&&t.lastIndexOf('Спецификация')<t.indexOf('Раскрой'),mode);
    L.forEach(s=>{assert.match(s.svg,/viewBox="0 0 420 297"/);assert.ok(!text(s.svg).includes('пока не готов'),mode);});
  }
  const html=require('fs').readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
  assert.ok(!html.includes('пока не готов'),'в index.html строки «пока не готовы» нет');
});

test('печь и «оба»: штамп — изделие и толщины; общий вид — размеры печи', ()=>{
  for(const [mode,name,rows] of [['stove','Печь под казан 600 × 440 × 970, 3–15 мм',['Печь, длина × ширина','600 × 440 мм']],
    ['both','Мангал с печью 1400 × 440 × 970, 3–15 мм',['Жаровня, длина × ширина','800 × 420 мм','Печь, длина × ширина','600 × 440 мм']]]){
    const c=loadMangal({mode});page(c);
    const L=sheets(c),kg=run(c,'kg1(massRows().tot)');
    assert.equal(run(c,'sheetName()'),name);
    L.forEach((s,i)=>{const tx=text(s.svg);assert.ok(tx.includes(name),mode+' название '+i);assert.ok(tx.includes('≈ '+kg+' кг'),mode+' масса '+i);
      assert.ok(tx.includes('сталь 3, 5 и 15 мм'),mode+' металл в штампе '+i);});
    const G=text(L[0].svg).split('\n');
    rows.forEach(r=>assert.ok(G.includes(r),mode+': в «Общем виде» нет «'+r+'»'));
    assert.equal(G.includes('Отверстий / прорезей'),mode==='both',mode+': отверстия-прорези — только у жаровни');
  }
  // мангал не изменился
  const g=loadMangal({mode:'grill'});page(g);
  assert.equal(run(g,'sheetName()'),'Мангал 800 × 420 × 970, 5 мм');
  assert.ok(text(sheets(g)[0].svg).includes('сталь 5 мм'));
});

test('печь и «оба»: спецификация — все строки «Раскрой и масса»; в «оба» это мангал + печь', ()=>{
  const open=mode=>{const c=loadMangal({mode});page(c);return c;};
  for(const mode of ['stove','both']){
    const c=open(mode),S2=sheets(c).filter(s=>s.title==='Спецификация').map(s=>text(s.svg)).join('\n'),lines=S2.split('\n');
    const full=run(c,'massRows().rows.map(r=>[r.n,String(r.s).replace(/\\d+\\.\\d+/g,v=>fmt(+v,1)),String(r.q),kgTxt(r.m*r.q)])');
    full.forEach(([n,sz,q,kg])=>{const i=lines.indexOf(n);assert.ok(i>=0,mode+': нет строки «'+n+'»');assert.deepEqual(lines.slice(i+1,i+4),[sz,q,kg],n);});
    assert.ok(S2.includes('Итого металла ≈ '+run(c,'kg1(massRows().tot)')+' кг'));
    assert.ok(S2.includes('Лист 3 мм — ')&&S2.includes('Профтруба 60×60×2 — '),mode+': металл печи под таблицей');
  }
  // «оба» = мангал + печь: в спецификации строки обоих
  const nm=m=>run(open(m),'massRows().rows.map(r=>r.n)'),b=nm('both');
  [...nm('grill'),...nm('stove')].forEach(n=>{if(!/^Торец левый|^Ножка|^Перегородка \(/.test(n))assert.ok(b.includes(n),'в «оба» нет «'+n+'»');});
  assert.ok(b.some(n=>/^Боковина жаровни/.test(n))&&b.some(n=>/^Боковина печи/.test(n))&&b.some(n=>/^Перегородка \(.*= левый торец жаровни/.test(n)));
});

test('«Порядок сборки»: в печи шаги печи — дверца, колосник, шибер; в «оба» после жаровни, ножки позже тела', ()=>{
  for(const mode of ['stove','both']){
    const c=loadMangal({mode});page(c);
    const st=run(c,'ok=false;asmSteps().map(s=>s.title+": "+s.parts.join())');
    const at=re=>st.findIndex(x=>re.test(x));
    assert.ok(at(/Дно, боковины и перегородка печи/)>=0&&at(/Дверца/)>=0&&at(/Колосник и шибер/)>=0,mode+': '+st.join(' | '));
    assert.ok(at(/Дно, боковины и перегородка печи/)<at(/Труба/)&&at(/Труба/)<at(/Дверца/)&&at(/Дверца/)<at(/Колосник и шибер/),mode);
    assert.ok(at(/Дно, боковины и перегородка печи/)<at(/Площадки и патрубки ножек/),mode+': ножки после тела');
    // шаги без пустых и без повторов деталей
    const all=run(c,'ok=false;asmSteps().flatMap(s=>s.parts)');assert.equal(new Set(all).size,all.length);
    assert.ok(all.includes('shib')&&all.includes('grate')&&all.includes('door'));
  }
  const g=loadMangal({mode:'grill'});page(g);
  assert.ok(!run(g,'ok=false;asmSteps().flatMap(s=>s.parts)').some(p=>['sK0','door','grate'].includes(p)),'в мангале шагов печи нет');
});

test('«Детали» и «Раскрой» печи: каждая лазерная деталь под своим номером; колосник 15 мм — на своём листе', ()=>{
  for(const mode of ['stove','both']){
    const c=loadMangal({mode});page(c);
    const L=sheets(c),D=L.filter(s=>s.title==='Детали').map(s=>text(s.svg)).join('\n');
    run(c,'nestJob()').groups.forEach(G=>G.types.forEach(ty=>assert.ok(D.includes(`${ty.no}. ${ty.p.name}`),ty.p.name)));
    assert.ok(D.includes('Колосник печи')&&D.includes('Дверца топки')&&D.includes('Шибер поддувала')&&D.includes('Отсекатель пламени'),mode);
    const R=L.filter(s=>s.title==='Раскрой').map(s=>text(s.svg));
    assert.ok(R.some(t=>t.includes('Лист 15 мм, 1250 × 2500')&&t.includes('Колосник печи')),mode+': лист 15 мм');
  }
});
