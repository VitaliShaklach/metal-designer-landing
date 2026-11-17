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
  assert.deepEqual(run(c,'[...ENGR_MIRROR].sort()'),['gBot','gEnd0','lintel','sBot','sK1','side1']);
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

// ---------- #121: дно жаровни и печи низом вверх ----------
const PMM=require('./partmm-golden.json');   // partMM всех деталей до #121 (grill / stove / both, поддувало включено)
const BOTS=['gBot','sBot'];

test('ENGR_HIDDEN: дно жаровни и печи — нижняя грань, остальные как были', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.deepEqual(run(c,'ENGR_HIDDEN'),{legs:'top',pads:'top',cgrH:'bottom',grate:'bottom',hook:'bottom',air:'bottom',shib:'bottom',div:'top',gBot:'bottom',sBot:'bottom'});
});

test('дно печи с поддувалом: зеркало по X — ближнее к X=0 отверстие в 95 мм от края (было 55), число и Y отверстий прежние', ()=>{
  const c=loadMangal({mode:'stove',draft:true});
  const now=run(c,'partMM(laserParts().find(p=>p.pt==="sBot"))'),was=PMM.stove.find(x=>x[0]==='sBot')[2];
  const xs=now.circles.map(q=>q[0]),xw=was.circles.map(q=>q[0]);
  assert.ok(Math.abs(Math.min(...xw)-55)<.01,'было '+Math.min(...xw));
  assert.ok(Math.abs(Math.min(...xs)-95)<.01,'стало '+Math.min(...xs));
  assert.equal(now.circles.length,was.circles.length);
  const ys=a=>a.circles.map(q=>q[1]).sort((a,b)=>a-b);
  assert.deepEqual(ys(now),ys(was));
  assert.deepEqual(now.circles.map(q=>Math.round((now.w-q[0])*100)/100).sort((a,b)=>a-b),xw.slice().sort((a,b)=>a-b),'зеркало ровно по ширине дна');
});

test('дно жаровни и печи: рез, врезки, размеры прежние; остальные детали не изменились (grill, stove, both)', ()=>{
  for(const mode of ['grill','stove','both']){
    const c=loadMangal({mode,draft:true}),now=run(c,'laserParts().map(p=>[p.pt,p.file,partMM(p)])');
    assert.deepEqual(now.map(x=>x[0]),PMM[mode].map(x=>x[0]),mode);
    now.forEach(([pt,file,m],i)=>{const was=PMM[mode][i][2];
      if(BOTS.includes(pt)){for(const k of ['cut','pierce','w','h'])assert.equal(m[k],was[k],mode+' '+pt+' '+k);}
      else assert.deepEqual(m,was,mode+' '+pt);});
  }
});

// ---------- #123: разметка на дне — квадраты под площадки ножек и «низ» ----------
const MODES={grill:{gBot:4},stove:{sBot:4},both:{gBot:2,sBot:2}};
// дно в задании «С листа»: тип детали, метки и части гравировки
const bot=(c,pt,over='{}')=>run(c,`(()=>{const N=nestJob(${over}),ty=N.groups.flatMap(G=>G.types).find(t=>t.p.pt==='${pt}');if(!ty)return null;
  const mk=bottomMarks(ty.p),o={holes:ty.m.loops.slice(1).map(nestLoop).filter(Boolean),circ:ty.m.circles};
  return {mk,parts:mk&&bottomEngr(ty.no,ty.P,o,mk),eng:ty.eng,m:ty.m,P:ty.P,no:ty.no,file:partFile(ty)[1],geo:ty.p.geo(),legs:legsList(),box:BOT_BOX['${pt}']()};})()`);
const segs=L=>L.slice(0,-1).map((a,i)=>[a,L[i+1]]);
const segX=(a,b,c,d)=>{const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};

test('дно: квадратов по legsList — grill 4 / stove 4 / both 2 + 2; без ножек квадратов нет, «низ» есть', ()=>{
  for(const [mode,want] of Object.entries(MODES)){const c=loadMangal({mode,draft:true});
    for(const pt of ['gBot','sBot']){const b=bot(c,pt);
      if(!want[pt]){assert.equal(b,null,mode+' '+pt);continue;}
      assert.equal(b.mk.squares.length,want[pt],mode+' '+pt);
      assert.ok(b.parts.word.length>=8,mode+' '+pt+' «низ»');assert.ok(b.parts.num.length>0,mode+' '+pt+' номер');}}
  const c=loadMangal({mode:'grill',legs:false}),b=bot(c,'gBot');
  assert.equal(b.mk.squares.length,0);assert.equal(b.parts.sq.length,0);assert.ok(b.parts.word.length>=8,'«низ» без ножек');
  assert.ok(!/квадраты/.test(run(c,`(N=>nestHtml(N,${RES}(N)))(nestJob())`)));
});

test('дно: центры квадратов, перевёрнутые обратно в модель, — центры ножек (±0,01 мм); зеркало один раз', ()=>{
  for(const [mode,want] of Object.entries(MODES)){const c=loadMangal({mode,draft:true});
    for(const pt of Object.keys(want)){const b=bot(c,pt),xs=[],ys=[];b.geo.loops.forEach(l=>l.forEach(([x,y])=>{xs.push(x);ys.push(y);}));
      const mx=Math.min(...xs),my=Math.min(...ys),[x0,x1,z0,z1]=b.box;
      // мм детали → вид сверху (см): снять зеркало по X (дно в ENGR_MIRROR), сдвиг обратно; вид сверху y = −z
      const back=b.mk.squares.map(S=>{const cx=(S[0][0]+S[2][0])/2,cy=(S[0][1]+S[2][1])/2;return [(b.m.w-cx)/10+mx,-(cy/10+my)];});
      const legs=b.legs.filter(([x,z])=>x>x0&&x<x1&&z>z0&&z<z1).map(([x,z])=>[x,z]);
      assert.equal(back.length,legs.length);
      const key=p=>p.map(v=>Math.round(v*100)).join(),srt=a=>a.map(p=>[p[0],p[1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      srt(back).forEach((p,i)=>{const q=srt(legs)[i];assert.ok(Math.abs(p[0]-q[0])*10<.01&&Math.abs(p[1]-q[1])*10<.01,mode+' '+pt+' '+key(p)+' ≠ '+key(q));});
      for(const S of b.mk.squares){assert.ok(Math.abs(S[2][0]-S[0][0]-80)<1e-6&&Math.abs(S[2][1]-S[0][1]-80)<1e-6,'80 × 80');}}}
  // «оба»: ножки жаровни у правого торца (x ≈ L1 − LX) — на дне, перевёрнутом низом вверх, у левого края (x < середины)
  const c=loadMangal({mode:'both'}),b=bot(c,'gBot');
  assert.ok(b.mk.squares.every(S=>S[0][0]<b.m.w/2),'квадраты «оба» на жаровне — у левого края детали');
});

test('дно: квадраты целиком внутри; на дне печи с поддувалом не задевают отверстия', ()=>{
  for(const [mode,want] of Object.entries(MODES)){const c=loadMangal({mode,draft:true});
    for(const pt of Object.keys(want)){const b=bot(c,pt);
      for(const S of b.mk.squares){for(const [x,y] of S)assert.ok(x>0&&x<b.m.w&&y>0&&y<b.m.h,mode+' '+pt+' квадрат за дном');
        const [ax,ay]=S[0],[bx,by]=S[2];
        for(const [x,y,r] of b.m.circles){const dx=Math.max(ax-x,0,x-bx),dy=Math.max(ay-y,0,y-by);assert.ok(Math.hypot(dx,dy)>r,mode+' '+pt+' квадрат задевает отверстие');}}
      if(pt==='sBot')assert.ok(b.m.circles.length>0,'поддувало включено');}}
});

test('дно: номер и «низ» внутри дна, не заходят в квадраты и не пересекают их', ()=>{
  for(const [mode,want] of Object.entries(MODES)){const c=loadMangal({mode,draft:true});
    for(const pt of Object.keys(want)){const b=bot(c,pt),T=[...b.parts.num,...b.parts.word];
      for(const z of T){const a=[z[0],z[1]],e=[z[2],z[3]];
        for(const q of [a,e]){assert.ok(inside(b.P,q),mode+' '+pt+' вне дна');for(const S of b.mk.squares)assert.ok(!inside(S,q),mode+' '+pt+' в квадрате');}
        for(const S of b.mk.squares)for(const [p,r] of segs(S))assert.ok(!segX(a,e,p,r),mode+' '+pt+' пересекает квадрат');}
      // «низ» не налезает на номер
      const bx=L=>{const xs=L.flatMap(z=>[z[0],z[2]]),ys=L.flatMap(z=>[z[1],z[3]]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];},
        n=bx(b.parts.num),w=bx(b.parts.word);
      assert.ok(w[2]<n[0]||w[0]>n[2]||w[3]<n[1]||w[1]>n[3],mode+' '+pt+' «низ» на номере');}}
});

test('дно: «низ» под номером той же высоты, зазор 0,5 высоты (дно жаровни, grill)', ()=>{
  const c=loadMangal({mode:'grill'}),b=bot(c,'gBot');
  const bx=L=>{const xs=L.flatMap(z=>[z[0],z[2]]),ys=L.flatMap(z=>[z[1],z[3]]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];},
    n=bx(b.parts.num),w=bx(b.parts.word),h=n[3]-n[1];
  assert.ok(Math.abs((w[3]-w[1])-h)<1e-6,'высота как у номера');
  assert.ok(Math.abs((n[1]-w[3])-h/2)<1e-6,'под номером, зазор 0,5 h');
  assert.deepEqual(b.parts.word,run(c,`textSegs('низ',${(w[0]+w[2])/2},${(w[1]+w[3])/2},${h})`));
});

test('дно: рез и врезки прежние; галочка снята — гравировки нет; DXF детали — квадраты, номер и «низ» в ENGRAVE', ()=>{
  for(const [mode,want] of Object.entries(MODES)){const c=loadMangal({mode,draft:true});
    for(const pt of Object.keys(want)){const on=bot(c,pt),off=bot(c,pt,'{engr:false}');
      assert.equal(on.m.cut,off.m.cut);assert.equal(on.m.pierce,off.m.pierce);assert.equal(off.eng,null,mode+' '+pt);
      const L=lines(on.file,'ENGRAVE'),n=on.parts;
      assert.equal(n.sq.length,4*want[pt]);
      assert.equal(L.length,n.sq.length+n.num.length+n.word.length,mode+' '+pt+' ENGRAVE');
      assert.equal(on.eng.length,L.length);
      assert.equal(lines(on.file,'CUT').length,lines(off.file,'CUT').length);}}
});

test('дно: смена режима grill → both → stove меняет квадраты (кэш гравировки не отдаёт старые)', ()=>{
  const c=loadMangal({mode:'grill'});
  // квадраты в ty.eng — отрезки по 80 мм (цифры и буквы не выше 20 мм): считаем их в том, что отдал nestJob (через ENGR_MEMO)
  const n=pt=>run(c,`(()=>{const ty=nestJob().groups.flatMap(G=>G.types).find(t=>t.p.pt==='${pt}');return ty?ty.eng.filter(z=>Math.abs(Math.hypot(z[2]-z[0],z[3]-z[1])-80)<.01).length/4:null;})()`);
  assert.equal(n('gBot'),4);
  run(c,`S.mode='both';recompute();`);assert.equal(n('gBot'),2,'жаровня в «оба»');assert.equal(n('sBot'),2,'печь в «оба»');
  run(c,`S.mode='stove';recompute();`);assert.equal(n('sBot'),4,'печь');assert.equal(n('gBot'),null);
  run(c,`S.mode='grill';recompute();`);assert.equal(n('gBot'),4,'снова мангал');
});

test('«С листа»: подпись стороны у дна — номер, квадраты под площадки ножек и «низ» на нижней грани', ()=>{
  const c=loadMangal({mode:'grill'});
  const h=run(c,`(N=>nestHtml(N,${RES}(N)))(nestJob())`);
  assert.match(h,/номер, квадраты под площадки ножек и «низ» — на нижней грани/);
  assert.match(h,/номер — на нижней грани/,'у остальных деталей подпись прежняя');
});
