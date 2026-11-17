// Гравировка номеров изнутри (#61): слой ENGRAVE в DXF листа, детали и заготовки, внутри контура; деталь лежит внутренней стороной вверх
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

const RES='(N=>N.groups.map(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return v.value;}))';
// отрезки слоя из текста DXF: [{x1,y1,x2,y2}]
const lines=(t,lay)=>{const a=t.split(/\r?\n/),out=[];for(let i=0;i<a.length-1;i++)if(a[i]==='0'&&a[i+1]==='LINE'){const e={};let j=i+2;while(j<a.length-1&&a[j]!=='0'){e[a[j]]=a[j+1];j+=2;}if(e['8']===lay)out.push({x1:+e['10'],y1:+e['20'],x2:+e['11'],y2:+e['21']});}return out;};
const inside=(P,[x,y])=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};

test('галочка «Гравировка номеров»: по умолчанию включена, снятая — engr:false', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'nestOpts().engr'),true);
  assert.equal(run(c,'nestJob({engr:false}).engr'),false);
});

test('все детали мангала получают номер; ENGR_MIRROR и ENGR_HIDDEN', ()=>{
  const c=loadMangal({mode:'grill'});
  const miss=run(c,'nestJob().groups.flatMap(G=>G.types.filter(ty=>!ty.eng||!ty.eng.length).map(ty=>ty.p.name))');
  assert.deepEqual(miss,[]);
  assert.deepEqual(run(c,'[...ENGR_MIRROR].sort()'),['gEnd0','lintel','sK1','side1']);
  const h=run(c,'ENGR_HIDDEN');
  assert.ok(!('cgr1' in h)&&!('cgr2' in h),'колосника мангала на лазере нет (#117)');
  for(const pt of ['legs','pads','cgrH','grate','hook','air','shib','div'])assert.ok(h[pt]==='top'||h[pt]==='bottom',pt);
});

test('DXF листа: слой ENGRAVE, номер на каждой детали листа, внутри её контура', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(N=>{const res=${RES}(N),sh=res[0].sheets[0],G=N.groups[0];
    return {txt:nestDxf(N,G,sh),items:sh.items.map(it=>({pts:it.pts,n:G.items[it.id].ty.eng.length}))};})(nestJob())`);
  const L=lines(r.txt,'ENGRAVE');
  assert.equal(L.length,r.items.reduce((a,i)=>a+i.n,0),'число отрезков = сумма по деталям листа');
  assert.ok(L.length>100);
});

test('DXF листа: каждый отрезок ENGRAVE внутри контура какой-то детали на листе', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(N=>{const res=${RES}(N),sh=res[0].sheets[0],G=N.groups[0];
    return {txt:nestDxf(N,G,sh),polys:sh.items.map(it=>it.pts)};})(nestJob())`);
  for(const l of lines(r.txt,'ENGRAVE'))assert.ok(r.polys.some(P=>inside(P,[l.x1,l.y1])&&inside(P,[l.x2,l.y2])),'отрезок вне контура: '+JSON.stringify(l));
});

test('DXF детали: ENGRAVE внутри контура, у задней боковины вырез под ручку на 220–280 мм', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(N=>N.groups[0].types.map(ty=>({pt:ty.p.pt,P:ty.P,txt:partFile(ty)[1],h:ty.m.h})))(nestJob())`);
  for(const d of r){const L=lines(d.txt,'ENGRAVE');assert.ok(L.length>0,d.pt);
    for(const l of L)assert.ok(inside(d.P,[l.x1,l.y1])&&inside(d.P,[l.x2,l.y2]),d.pt+' вне контура');}
  const s0=r.find(d=>d.pt==='side0'),cut=lines(s0.txt,'CUT');
  // вертикальные кромки выреза: от верха вниз на 60 мм (GN_D), на 220 и 280 мм от левого торца — как на модели при виде изнутри
  const edge=x=>cut.some(l=>Math.abs(l.x1-x)<.02&&Math.abs(l.x2-x)<.02&&Math.abs(Math.abs(l.y1-l.y2)-60)<.02&&Math.max(l.y1,l.y2)>s0.h-.02);
  assert.ok(edge(220),'кромка 220');assert.ok(edge(280),'кромка 280');
});

test('передняя боковина: контур зеркалится по X (внутренняя сторона вверх), задняя — как есть', ()=>{
  const c=loadMangal({mode:'grill'});
  const get=pt=>run(c,`(()=>{const p=laserParts().find(q=>q.pt==='${pt}'),G=p.geo(),xs=G.loops[0].map(q=>q[0]),mx=Math.min(...xs),w=Math.round((Math.max(...xs)-mx)*1000)/100;
    return {w,raw:G.loops[0].map(q=>Math.round((q[0]-mx)*1000)/100),got:partMM(p).loops[0].map(q=>q[0])};})()`);
  const s=get('side1'),srt=a=>a.map(x=>Math.round(x*100)/100).sort((a,b)=>a-b);
  const mir=srt(s.raw.map(x=>s.w-x));
  assert.deepEqual(srt(s.got),mir);
  assert.notDeepEqual(srt(s.raw),mir,'контур несимметричен — зеркало что-то меняет');
  const b=get('side0');assert.deepEqual(b.got,b.raw);
});

test('галочка снята: ENGRAVE нет нигде, гравировка в итогах 0', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(N=>{const res=${RES}(N);return {sheet:nestDxf(N,N.groups[0],res[0].sheets[0]),part:partFile(N.groups[0].types[0])[1],tot:listTotals(N,res)[0],html:nestHtml(N,res)};})(nestJob({engr:false}))`);
  assert.equal(lines(r.sheet,'ENGRAVE').length,0);assert.ok(!/ENGRAVE/.test(r.sheet+r.part));
  assert.equal(r.tot.eng,0);assert.ok(!/Гравировка/.test(r.html));
});

test('итоги «С листа» и «Из заготовок»: длина гравировки, рез не меняется', ()=>{
  const c=loadMangal({mode:'grill'});
  const on=run(c,`(N=>{const res=${RES}(N);return {tot:listTotals(N,res)[0],html:nestHtml(N,res)};})(nestJob())`),
    off=run(c,`(N=>listTotals(N,${RES}(N))[0])(nestJob({engr:false}))`);
  assert.ok(on.tot.eng>500,'гравировка, мм '+on.tot.eng);assert.equal(on.tot.cut,off.cut);assert.equal(on.tot.pierce,off.pierce);
  assert.match(on.html,/Гравировка <b>[\d,]+ м<\/b>/);
  const z=run(c,`(N=>({t:zagTotals(N,N.groups.map(G=>zagTypes(N,G)))[0],h:zagHtml(N,N.groups.map(G=>zagTypes(N,G)))}))(nestJob())`);
  assert.ok(z.t.eng>0);assert.match(z.h,/Гравировка <b>/);
  const z0=run(c,`(N=>zagTotals(N,N.groups.map(G=>zagTypes(N,G)))[0])(nestJob({engr:false}))`);
  assert.equal(z0.eng,0);assert.equal(z0.cut,z.t.cut);
});

test('DXF по заготовке: ENGRAVE есть, внутри контура детали', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(N=>zagTypes(N,N.groups[0]).map(ty=>({P:ty.P,txt:zagFile(ty)[1]})))(nestJob())`);
  assert.ok(r.length>0);
  for(const d of r){const L=lines(d.txt,'ENGRAVE');assert.ok(L.length>0);for(const l of L)assert.ok(inside(d.P,[l.x1,l.y1])&&inside(d.P,[l.x2,l.y2]));}
});

test('ключи заданий: галочка меняет «С листа» и «Из заготовок», «Гильотину» — нет', ()=>{
  const c=loadMangal({mode:'grill'});
  const k=run(c,`(()=>{const a=nestJob(),b=nestJob({engr:false});return {list:a.key!==b.key,zag:zagKey(a)!==zagKey(b),gil:gilKey(a)!==gilKey(b)};})()`);
  assert.deepEqual(k,{list:true,zag:true,gil:false});
});

test('engraveSegs: слишком узкая деталь — null; точки внутри контура, отверстия обходятся', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'engraveSegs(1,[[0,0],[100,0],[100,4],[0,4]])'),null);
  const P=[[0,0],[100,0],[100,60],[0,60]],s=run(c,'engraveSegs(12,[[0,0],[100,0],[100,60],[0,60]])');
  assert.ok(s&&s.length>5);
  for(const z of s)assert.ok(inside(P,[z[0],z[1]])&&inside(P,[z[2],z[3]]));
  // отверстие Ø40 в центре: цифры не лезут в него
  const h=run(c,'engraveSegs(12,[[0,0],[100,0],[100,60],[0,60]],{circ:[[50,30,20]]})');
  assert.ok(h&&h.length>5);
  for(const z of h)for(const q of [[z[0],z[1]],[z[2],z[3]]])assert.ok(Math.hypot(q[0]-50,q[1]-30)>=20,'в отверстии');
});

test('печь: гравировка у всех деталей', ()=>{
  const c=loadMangal({mode:'stove'});
  const miss=run(c,'nestJob().groups.flatMap(G=>G.types.filter(ty=>!ty.eng||!ty.eng.length).map(ty=>ty.p.name))');
  assert.deepEqual(miss,[]);
});

test('«С листа»: у деталей без внутренней стороны подписана грань гравировки; с выключенной галочкой подписи нет', ()=>{
  const c=loadMangal({mode:'grill'});
  const h=o=>run(c,`(N=>nestHtml(N,${RES}(N)))(nestJob(${o}))`);
  assert.match(h('{}'),/номер — на нижней грани/);
  assert.ok(!/номер — на/.test(h('{engr:false}')));
});

// ---------- #122: буквы «н», «и», «з» и строка текста ----------
const GOLD=require('./engrave-golden.json');   // engraveSegs до #122: номера 1, 12, 123 на четырёх контурах

test('буквы «н», «и», «з»: не пустые, внутри клетки 1 × 2; «з» не «3»', ()=>{
  const c=loadMangal({mode:'grill'});
  const G=run(c,'GLYPHS');
  for(const ch of ['н','и','з']){
    assert.ok(G[ch]&&G[ch].length>0,ch);
    for(const L of G[ch]){assert.ok(L.length>=2,ch);for(const [x,y] of L)assert.ok(x>=0&&x<=1&&y>=0&&y<=2,ch+' вне клетки: '+x+','+y);}}
  assert.notDeepEqual(G['з'],G['3']);
  assert.deepEqual(run(c,`textSegs('з',0,0,2)`).length>0,true);
  assert.notDeepEqual(run(c,`textSegs('з',0,0,2)`),run(c,`textSegs('3',0,0,2)`));
});

test('textSegs: «низ» по центру (100, 50), высота 20 — в прямоугольнике 40 × 20; неизвестный символ — ошибка', ()=>{
  const c=loadMangal({mode:'grill'});
  const s=run(c,`textSegs('низ',100,50,20)`),E=1e-9;
  assert.ok(s.length>0);
  for(const z of s)for(const [x,y] of [[z[0],z[1]],[z[2],z[3]]])assert.ok(x>=80-E&&x<=120+E&&y>=40-E&&y<=60+E,x+','+y);
  const xs=s.flatMap(z=>[z[0],z[2]]),ys=s.flatMap(z=>[z[1],z[3]]);
  assert.ok(Math.abs(Math.min(...xs)-80)<E&&Math.abs(Math.max(...xs)-120)<E,'на всю ширину');
  assert.ok(Math.abs(Math.min(...ys)-40)<E&&Math.abs(Math.max(...ys)-60)<E,'на всю высоту');
  assert.throws(()=>run(c,`textSegs('нИз',0,0,10)`),/И/);
  assert.throws(()=>run(c,`textSegs('a',0,0,10)`));
});

test('engraveSegs: номера 1, 12, 123 — те же отрезки, что до букв (#122)', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(GOLD.length,12);
  for(const g of GOLD)assert.deepEqual(run(c,`engraveSegs(${g.no},${JSON.stringify(g.P)},${JSON.stringify(g.o)})`),g.segs,'номер '+g.no);
});
