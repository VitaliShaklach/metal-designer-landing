/* ---------- раскрой: листовые детали на лист металла ----------
   Детали — те же, что уходят в DXF (laserParts + partMM), в мм. Разная толщина — разные листы: 5 мм — основной, 3 / 15 — свои.
   Раскладка по внешнему контуру; отверстия и внутренние контуры только рисуются. Лист — длинной стороной по горизонтали, y вверх, как в DXF.
   Раскладка — копия из art/js/prod.js (area2, ptSegD, inPoly, segX, polyGap, polyDist, nestOrient, nestGen): общего кода у разделов нет.
   Отличия от art (помечены «мангал:»): без зеркала, клетка 5 мм, клетка ровно на ползазора свободна; для скорости — nearPoly, polyClose и шаги на подготовке. */
const area2=P=>{let a=0;P.forEach((p,i)=>{const q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];});return a/2;};
// ---------- раскладка по форме ----------
// Лист — сетка клеток cell мм. Каждая деталь пробуется во всех положениях «сторона вдоль листа»;
// ставим туда, где правый край раскладки получается ближе всего к началу листа — детали заполняют пустоты между собой.
// Занятость — клетки, которых касается деталь; проверка — та же деталь, расширенная на зазор. W — длинная сторона листа.
function ptSegD(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function inPoly(p,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function segX(a,b,c,d){const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;}
function polyGap(A,B){let d=Infinity;for(let i=0;i<A.length;i++){const a=A[i],a2=A[(i+1)%A.length];for(let j=0;j<B.length;j++){const b=B[j],b2=B[(j+1)%B.length];if(segX(a,a2,b,b2))return 0;d=Math.min(d,ptSegD(a,b,b2),ptSegD(b,a,a2));}}if(inPoly(A[0],B)||inPoly(B[0],A))return 0;return d;}
// мангал: есть ли сторона контура ближе d к точке — то же, что polyDist(P)(p) < d, но без Math.hypot и с ранним выходом (сетка детали в разы быстрее)
function nearPoly(P,p,d){const d2=d*d;for(let i=0,n=P.length;i<n;i++){const a=P[i],b=P[i+1<n?i+1:0],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)),ex=p[0]-a[0]-t*dx,ey=p[1]-a[1]-t*dy;if(ex*ex+ey*ey<d2)return true;}return false;}
// мангал: polyGap(A,B) < g — тот же ответ, но далёкие пары сторон отсеиваются по габариту и выход на первой близкой (боковины жаровни — 140 × 140 сторон)
function polyClose(A,B,g){for(let i=0;i<A.length;i++){const a=A[i],a2=A[(i+1)%A.length],x0=Math.min(a[0],a2[0])-g,x1=Math.max(a[0],a2[0])+g,y0=Math.min(a[1],a2[1])-g,y1=Math.max(a[1],a2[1])+g;
    for(let j=0;j<B.length;j++){const b=B[j],b2=B[(j+1)%B.length];if(Math.max(b[0],b2[0])<x0||Math.min(b[0],b2[0])>x1||Math.max(b[1],b2[1])<y0||Math.min(b[1],b2[1])>y1)continue;
      if(segX(a,a2,b,b2)||ptSegD(a,b,b2)<g||ptSegD(b,a,a2)<g)return true;}}
  return inPoly(A[0],B)||inPoly(B[0],A);}
function polyDist(P){return p=>{let d=Infinity;P.forEach((a,i)=>{d=Math.min(d,ptSegD(p,a,P[(i+1)%P.length]));});return d;};}
function nestOrient(P,cell,r,flips=[false]){const out=[],seen=new Set();
  flips.forEach(flip=>{const Q0=flip?P.map(p=>[-p[0],p[1]]):P,seenA=new Set();Q0.forEach((a,i)=>{const b=Q0[(i+1)%Q0.length];[0,Math.PI].forEach(add=>{
    const ang=-Math.atan2(b[1]-a[1],b[0]-a[0])+add,c=Math.cos(ang),s=Math.sin(ang);
    const ak=Math.round(ang*1e9);if(seenA.has(ak))return;seenA.add(ak);   // мангал: этот угол уже был — положение то же (у боковины 136 сторон, а углов 4)
    let Q=Q0.map(p=>[c*p[0]-s*p[1],s*p[0]+c*p[1]]);
    const mx=Math.min(...Q.map(q=>q[0])),my=Math.min(...Q.map(q=>q[1]));Q=Q.map(q=>[q[0]-mx,q[1]-my]);
    const key=Q.map(q=>Math.round(q[0])+','+Math.round(q[1])).sort().join(';');if(seen.has(key))return;seen.add(key);
    // клетки, чьи центры внутри детали, раздутой на ползазора (r — ползазора, мм); точный зазор проверяется отдельно
    // мангал: клетка ровно на ползазора не занята (< r, в art ≤ r) — иначе при зазоре, кратном клетке (5 мм), она занята у обеих соседних деталей и они отходят на клетку дальше
    // и клетка дальше ползазора от габарита детали — сразу свободна: до контура ещё дальше (у боковин жаровни 140 точек — без этого секунда на деталь)
    const o=Math.ceil(r/cell)+1,qw=Math.max(...Q.map(q=>q[0])),qh=Math.max(...Q.map(q=>q[1])),w=Math.ceil(qw/cell)+2*o+1,h=Math.ceil(qh/cell)+2*o+1,core=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=[(x-o+.5)*cell,(y-o+.5)*cell],bd=Math.hypot(Math.max(0,-p[0],p[0]-qw),Math.max(0,-p[1],p[1]-qh));
      if(bd<r-1e-6&&(inPoly(p,Q)||nearPoly(Q,p,r-1e-6)))core[y*w+x]=1;}
    const rows=m=>{const R=[];for(let y=0;y<h;y++){let x=0;const iv=[];while(x<w){if(m[y*w+x]){const s0=x;while(x<w&&m[y*w+x])x++;iv.push([s0,x-1]);}else x++;}R.push(iv);}return R;};
    const cr=rows(core);out.push({Q,w,h,o,core:cr,dil:cr,flip,tr:{f:flip,c,s,x:-mx,y:-my}});});});});
  return out;}
// мангал: деталь только поворачивается (flips=[false]) — на листе она такая же, как в DXF; клетка 5 мм (в art — 2,5), зазор всё равно точный (polyGap)
function* nestGen(items,W,H,gap,margin,cell=5,mode=2){const r=gap/2,GW=Math.floor((W-2*margin)/cell),GH=Math.floor((H-2*margin)/cell);
  // мангал: сетки деталей — по одной за шаг (yield), чтобы страница не замирала на подготовке
  const it=[];for(const o of items){it.push({id:o.id,no:o.no,area:Math.abs(area2(o.pts)),or:nestOrient(o.pts,cell,r,[false])});yield {done:0,of:items.length};}
  it.sort((a,b)=>mode===2?Math.max(...b.or.map(o=>o.w))-Math.max(...a.or.map(o=>o.w)):b.area-a.area);
  const sheets=[],too=[];
  const newSheet=()=>{const sh={items:[],occ:new Uint8Array(GW*GH),pre:new Int32Array((GW+1)*GH),len:0};sheets.push(sh);return sh;};
  const free=(sh,R,x,y)=>{for(let ry=0;ry<R.length;ry++){const iv=R[ry];if(!iv.length)continue;const base=(y+ry)*(GW+1);for(const [a,b] of iv)if(sh.pre[base+x+b+1]-sh.pre[base+x+a])return false;}return true;};
  const gapOK=(sh,o,x,y)=>{const ox=margin+(x+o.o)*cell,oy=margin+(y+o.o)*cell,P=o.Q.map(q=>[q[0]+ox,q[1]+oy]),bx=[Math.min(...P.map(p=>p[0]))-gap,Math.min(...P.map(p=>p[1]))-gap,Math.max(...P.map(p=>p[0]))+gap,Math.max(...P.map(p=>p[1]))+gap];
    if(bx[0]<margin-.01||bx[1]<margin-.01||bx[2]>W-margin+gap+.01||bx[3]>H-margin+gap+.01)return false;
    for(const it of sh.items){const b=it.bb;if(b[0]>bx[2]||b[2]<bx[0]||b[1]>bx[3]||b[3]<bx[1])continue;if(polyClose(P,it.pts,gap))return false;}return true;};
  const fit=(sh,o,limit)=>{for(let x=0;x+o.w<=GW;x++){if(x+o.w>=limit)return null;for(let y=0;y+o.h<=GH;y++)if(free(sh,o.dil,x,y)&&gapOK(sh,o,x,y))return {x,y};}return null;};
  const place=(sh,o,x,y)=>{o.core.forEach((iv,ry)=>{const Y=y+ry;if(Y>=GH)return;iv.forEach(([a,b])=>{for(let X=x+a;X<=x+b&&X<GW;X++)sh.occ[Y*GW+X]=1;});
      const base=Y*(GW+1);let acc=0;for(let X=0;X<GW;X++){sh.pre[base+X]=acc;acc+=sh.occ[Y*GW+X];}sh.pre[base+GW]=acc;});};
  for(let pi=0;pi<it.length;pi++){const p=it[pi];let done=false;yield {done:pi,of:it.length};
    for(const sh of sheets.concat([null])){const S=sh||newSheet();let best=null;
      p.or.forEach(o=>{if(o.w>GW||o.h>GH)return;const f=fit(S,o,best?(mode?best.x+1+o.w:best.score):Infinity);if(f){const score=mode?f.x*1e4+f.y:f.x+o.w;if(!best||score<best.score||score===best.score&&f.y<best.y)best={o,...f,score,right:f.x+o.w};}});
      if(best){place(S,best.o,best.x,best.y);const ox=margin+(best.x+best.o.o)*cell,oy=margin+(best.y+best.o.o)*cell;
        const pts=best.o.Q.map(q=>[q[0]+ox,q[1]+oy]);const t=best.o.tr;S.items.push({id:p.id,no:p.no,flip:best.o.flip,tr:{...t,x:t.x+ox,y:t.y+oy},area:p.area,x:0,y:0,pts,bb:[Math.min(...pts.map(q=>q[0])),Math.min(...pts.map(q=>q[1])),Math.max(...pts.map(q=>q[0])),Math.max(...pts.map(q=>q[1]))]});S.len=Math.max(S.len,margin+best.right*cell);done=true;break;}
      if(!sh){sheets.pop();break;}}
    if(!done)too.push({id:p.id,no:p.no});}
  sheets.forEach(s=>{const a=s.items.reduce((q,o)=>q+o.area,0);s.used=a/(W*H);s.dense=a/((s.len-margin)*(H-2*margin)||1);delete s.occ;delete s.pre;});
  return {sheets,too,W,H,gap,used:sheets.length?sheets.reduce((a,s)=>a+s.used,0)/sheets.length:0};}

/* ---------- детали для раскладки ---------- */
const NEST_SHEETS={'1000x2000':[2000,1000],'1250x2500':[2500,1250],'1500x3000':[3000,1500]},NEST_EDGE=10,NEST_CELL=5;   // [длина, ширина]; от края 10 мм — как в art
// контур → точки без повтора последней и без двойных подряд; меньше 3 точек, не числа или нулевая площадь — null
function nestLoop(l){if(!Array.isArray(l))return null;const P=[],same=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6;
  for(const p of l){if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;if(!P.length||!same(P[P.length-1],p))P.push([p[0],p[1]]);}
  while(P.length>1&&same(P[0],P[P.length-1]))P.pop();
  return P.length>=3&&Math.abs(area2(P))>1?P:null;}
// значения полей: зазор 1…50 мм с шагом 0,5; лист — из списка; cgr — колосник мангала на листе (галочка); gil — заготовки с гильотины (галочка, по умолчанию снята);
// edge — подрезка кромки на схеме гильотины 0…30 мм, целые (по умолчанию 10); sel — выбор «гильотина | лазер» по деталям ({file: 'gil' | 'laser'}, память браузера md-gilsel)
const NEST_CGR=p=>p.pt==='cgr1'||p.pt==='cgr2';
const gilSelStore=()=>{try{const v=store('md-gilsel');return v&&typeof v==='object'?v:{};}catch(e){return {};}};   // store — в ui.js; до его загрузки — умолчания
function nestOpts(){const gi=document.getElementById('nGap'),si=document.getElementById('nSheet'),ci=document.getElementById('nCgr'),li=document.getElementById('nGil'),ei=document.getElementById('nEdge');
  let gap=parseFloat(String(gi&&gi.value!=null?gi.value:'').replace(',','.'));if(!Number.isFinite(gap))gap=5;gap=Math.min(50,Math.max(1,Math.round(gap*2)/2));
  let edge=parseFloat(String(ei&&ei.value!=null?ei.value:'').replace(',','.'));if(!Number.isFinite(edge))edge=10;edge=Math.min(30,Math.max(0,Math.round(edge)));
  const v=si&&typeof si.value==='string'?si.value:'',sk=NEST_SHEETS[v]?v:'1250x2500',[W,H]=NEST_SHEETS[sk];return {gap,sk,W,H,edge,cgr:!(ci&&ci.checked===false),gil:!!(li&&li.checked===true),sel:gilSelStore()};}
// «гильотина | лазер» по умолчанию: деталь уже GIL_MIN_W — лазер, остальные — гильотина
const gilDef=m=>Math.min(m.w,m.h)<GIL_MIN_W?'laser':'gil';
// задание: группы по толщине (5 мм первой), в каждой — типы деталей (номер, контур, кол-во) и штуки для раскладки; key — для кэша.
// over — поменять поля (smoke: {cgr:false}, {gil:true,edge:10,sel:{…}}); hasCgr — есть ли колосник мангала (показать галочку).
// У типа sel — «гильотина | лазер», kind — вид детали (partKind по sel), b — геометрия по заготовке (blankMM, только у zag).
// С gil на лазерную раскладку идут только детали «лазер» (kind 'list') — на кусок не больше листа минус подрезка (LW × LH); в таблицах остаются все типы (номера те же)
function nestJob(over){const o=Object.assign(nestOpts(),over),all=laserParts(),hasCgr=all.some(NEST_CGR),L=o.cgr?all:all.filter(p=>!NEST_CGR(p)),ths=[...new Set(L.map(p=>p.mm))].sort((a,b)=>(b===5)-(a===5)||a-b),groups=[];let no=0;
  ths.forEach(mm=>{const G={mm,types:[],items:[]};
    L.filter(p=>p.mm===mm&&p.q>0).forEach(p=>{let m=null;try{m=partMM(p);}catch(e){}const P=m&&nestLoop(m.loops[0]);if(!P)return;   // пустой или вырожденный контур — пропускаем
      const v=o.sel[p.file],sel=v==='gil'||v==='laser'?v:gilDef(m),kind=partKind(m,sel),ty={no:++no,p,m,P,q:p.q,sel,kind,b:kind==='zag'?blankMM(p,m):null};G.types.push(ty);
      if(!o.gil||kind==='list')for(let j=0;j<p.q;j++)G.items.push({id:G.items.length,no:ty.no,pts:P,ty});});
    if(G.types.length)groups.push(G);});
  const LW=o.gil?o.W-2*o.edge:o.W,LH=o.gil?o.H-2*o.edge:o.H;
  const key=JSON.stringify([o.W,o.H,o.gap,o.gil,o.gil?o.edge:0,groups.map(G=>[G.mm,G.items.length,G.types.map(ty=>[ty.no,ty.q,o.gil?ty.kind:'',ty.P.map(q=>q.map(v=>Math.round(v*10)))])])]);
  return {...o,LW,LH,groups,key,hasCgr};}

/* ---------- рисунок листа (SVG, мм) ---------- */
const n1=v=>Math.round(v*10)/10;
// где писать номер: точка внутри детали дальше всего от краёв и отверстий (сетка 20 × 20), при равенстве — ближе к центру.
// Отверстия часто (колосник, дно печи) и места между ними мало — пишем поверх отверстий, у цифр подложка (CSS)
function nestLabelPt(P,holes,circ){const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),cx=(x0+x1)/2,cy=(y0+y1)/2;
  const dO=polyDist(P),dH=holes.map(h=>[h,polyDist(h)]);
  const pick=withHoles=>{let best=null;for(let i=1;i<20;i++)for(let j=1;j<20;j++){const p=[x0+(x1-x0)*i/20,y0+(y1-y0)*j/20];if(!inPoly(p,P))continue;let d=dO(p);
      if(withHoles){dH.forEach(([h,f])=>{d=Math.min(d,inPoly(p,h)?-1:f(p));});circ.forEach(([x,y,r])=>{d=Math.min(d,Math.hypot(p[0]-x,p[1]-y)-r);});}
      const s=Math.min(d,60)-.01*Math.hypot(p[0]-cx,p[1]-cy);if(d>0&&(!best||s>best.s))best={p,d,s};}return best;};
  const a=pick(false)||{p:[cx,cy],d:Math.min(x1-x0,y1-y0)/2},b=holes.length||circ.length?pick(true):null;
  return b&&b.d>=Math.min(25,a.d*.6)?b:a;}
// лист: рамка и размеры, детали — полный контур с отверстиями (как в DXF), гибы пунктиром, номер; big — широкий экран (шрифт мельче, рисунок крупнее).
// С gil — не лист, а кусок листа под лазер (nestPiece) в своём масштабе
function nestSvg(N,G,sh,isOn,big){const [W,H]=N.gil?nestPiece(N,sh):[N.W,N.H],fk=big?1:2,fs=Math.round((N.gil?Math.max(W,H)*.02:H*.035)*fk),pd=Math.round(fs*1.6),Y=y=>H-y,pt=q=>n1(q[0])+','+n1(Y(q[1]));
  let g=`<rect class="sh" x="0" y="0" width="${W}" height="${H}"/><text class="dim" x="${W/2}" y="${-fs*.5}" font-size="${fs}" text-anchor="middle">${W}</text><text class="dim" transform="translate(${-fs*.5},${H/2}) rotate(-90)" font-size="${fs}" text-anchor="middle">${H}</text>`;
  const lbl=[];   // нарисованные номера: мелкие одинаковые детали рядом (скобы задвижек, площадки) — один номер на кучку, иначе цифры наезжают друг на друга
  sh.items.forEach(it=>{const ty=G.items[it.id].ty,m=ty.m,tr=it.tr,T=q=>[tr.c*q[0]-tr.s*q[1]+tr.x,tr.s*q[0]+tr.c*q[1]+tr.y];
    const holes=m.loops.slice(1).map(nestLoop).filter(Boolean).map(l=>l.map(T)),circ=m.circles.map(([x,y,r])=>[...T([x,y]),r]);
    let d=[it.pts,...holes].map(l=>'M'+l.map(pt).join('L')+'Z').join('');
    circ.forEach(([x,y,r])=>{d+=`M${n1(x-r)},${n1(Y(y))}a${r},${r} 0 1,0 ${n1(2*r)},0a${r},${r} 0 1,0 ${n1(-2*r)},0Z`;});
    const bd=m.bends.map(b=>{const [a,c]=b.map(T);return `<line class="bd" x1="${n1(a[0])}" y1="${n1(Y(a[1]))}" x2="${n1(c[0])}" y2="${n1(Y(c[1]))}"/>`;}).join('');
    // номер не мельче 0,8 подписи листа — у узких полос (задвижка 38 мм) он выходит за деталь, зато читается
    const L=nestLabelPt(it.pts,holes,circ),fz=n1(Math.max(fs*.8,Math.min(1.3*L.d,Math.max(24,Math.min(60,L.d))*fk))),lw=String(ty.no).length*fz*.6;
    const hide=lbl.some(b=>b.no===ty.no&&Math.abs(b.x-L.p[0])<(b.w+lw)/2&&Math.abs(b.y-L.p[1])<(b.h+fz)/2);if(!hide)lbl.push({no:ty.no,x:L.p[0],y:L.p[1],w:lw,h:fz});
    g+=`<g class="np${isOn(ty)?' on':''}"><title>${ty.no} — ${ty.p.name}</title><path d="${d}"/>${bd}${hide?'':`<text x="${n1(L.p[0])}" y="${n1(Y(L.p[1]))}" dy=".36em" font-size="${fz}" text-anchor="middle">${ty.no}</text>`}</g>`;});
  return `<svg class="nestsv${N.gil?' npc':''}" viewBox="${-pd} ${-pd} ${W+pd+10} ${H+pd+10}" role="img" aria-label="${N.gil?'Кусок листа под лазер':'Лист'} ${G.mm} мм, ${H} × ${W}, деталей ${sh.items.length}">${g}</svg>`;}
// кусок листа под лазер (режим gil): от угла раскладки до её габарита плюс край NEST_EDGE, вверх до 10 мм, не больше листа минус подрезка (LW × LH); его режет гильотина
function nestPiece(N,sh){const up=v=>Math.ceil((v+NEST_EDGE)/10-1e-9)*10,mx=Math.max(0,...sh.items.map(it=>it.bb[2])),my=Math.max(0,...sh.items.map(it=>it.bb[3]));
  return [Math.min(N.LW,up(mx)),Math.min(N.LH,up(my))];}
// DXF всего листа: детали стоят как на рисунке (поворот и сдвиг tr), рамка листа — слой SHEET (в режиме gil — кусок листа под лазер)
function nestDxf(N,G,sh){const f=v=>Math.round(v*100)/100,[SW,SH]=N.gil?nestPiece(N,sh):[N.W,N.H],m={sheet:[[0,0],[SW,0],[SW,SH],[0,SH],[0,0]],loops:[],circles:[],bends:[]};
  sh.items.forEach(it=>{const d=G.items[it.id].ty.m,tr=it.tr,T=q=>[f(tr.c*q[0]-tr.s*q[1]+tr.x),f(tr.s*q[0]+tr.c*q[1]+tr.y)];
    d.loops.forEach(l=>m.loops.push(l.map(T)));d.circles.forEach(([x,y,r])=>m.circles.push([...T([x,y]),r]));d.bends.forEach(b=>m.bends.push(b.map(T)));});
  return dxfText(m);}
const nestFile=(N,G,R,si)=>N.gil?`list_${G.mm}mm_kusok_${nestPiece(N,R.sheets[si]).join('x')}${R.sheets.length>1?'_'+(si+1):''}.dxf`:`list_${G.mm}mm_${N.sk}${R.sheets.length>1?'_'+(si+1):''}.dxf`;
// режим gil: что режет гильотина в этой толщине — детали «гильотина» (gil — готовая, zag — заготовка под лазер) и куски листа под лазер (по одному на лазерную раскладку)
const GIL_KIND={gil:'готовая деталь',zag:'заготовка под лазер',piece:'кусок листа под лазер'},KIND_TAG={gil:'готовая деталь',zag:'заготовка под лазер',list:'лазер'};
function gilRows(N,G,R){const r=G.types.filter(ty=>ty.kind!=='list').map(ty=>({no:ty.no,name:ty.p.name,w:ty.m.w,h:ty.m.h,q:ty.q,kind:ty.kind}));
  ((R&&R.sheets)||[]).forEach((sh,si,a)=>{const [w,h]=nestPiece(N,sh);r.push({no:null,name:`Кусок листа под лазер${a.length>1?' '+(si+1):''}`,w,h,q:1,kind:'piece'});});
  return r;}
// CSV для гильотины: UTF-8 с BOM (Excel), разделитель «;»
function gilCsv(N,G,R){const c=v=>/[;"\r\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
  return '\uFEFF'+[['деталь','заготовка, мм','шт','вид'],...gilRows(N,G,R).map(o=>[(o.no?o.no+' ':'')+o.name,`${fmt(o.w,0)} × ${fmt(o.h,0)}`,o.q,GIL_KIND[o.kind]])].map(l=>l.map(c).join(';')).join('\r\n')+'\r\n';}

/* ---------- схема гильотины: прямоугольники заготовок на листе, только сквозные резы ----------
   Гильотина режет от края до края, ширины реза нет — зазор между заготовками 0, от края листа — подрезка кромки (поле, edge).
   Раскладка полосами, 3 стадии: лист поперёк на полосы (1), полоса — на ряды (2), ряд — на заготовки одной высоты, остаток ряда — отход (3).
   Перебор: полосы поперёк или вдоль листа × 4 сортировки × 4 правила поворота на 90°; не влезло на лист — следующий лист.
   Лучший вариант — меньше листов, при равенстве — меньше занятый прямоугольник (сумма по листам). */
const GIL_MIN_W=50;   // мм: деталь, у которой меньшая сторона уже 50, по умолчанию «лазер»: узкую полосу 5 мм гильотина ведёт винтом или саблей (задвижки 800 × 30, скобы 12 × 30)
function gilTry(rects,W,H,E,dir,sort,pol){const v=dir==='v',LS=(v?W:H)-2*E,LW=(v?H:W)-2*E,e=1e-6,fits=([a,b])=>a<=LS+e&&b<=LW+e;
  // ориентация — [поперёк полосы, вдоль полосы]; pol 0 — длинной стороной поперёк, 1 — вдоль, 2 и 3 — как выгоднее (новая полоса: 2 — уже, 3 — шире)
  const ors=r=>{const p=Math.max(r.w,r.h),q=Math.min(r.w,r.h),A=p===q?[[p,q]]:[[p,q],[q,p]];return (pol===1?A.reverse():A).filter(fits);};
  const R=rects.map((r,i)=>({r,i,o:ors(r)})),too=R.filter(x=>!x.o.length).map(x=>x.r),key=x=>{const [a,b]=x.o[0];return [[a,b],[b,a],[a*b,a],[Math.max(a,b),a]][sort];};
  const L=R.filter(x=>x.o.length).sort((x,y)=>{const a=key(x),b=key(y);return b[0]-a[0]||b[1]-a[1]||x.i-y.i;}),sheets=[];
  const pick=(c,f)=>c.reduce((m,x)=>!m||f(x)<f(m)?x:m,null),first=c=>{for(const o of L0)for(const x of c)if(x.o===o)return x;return null;};let L0=null;
  const fit=(sh,x)=>{L0=x.o;let c=[];
    sh.strips.forEach(st=>st.lv.forEach(lv=>x.o.forEach(o=>{if(Math.abs(lv.h-o[1])<e&&lv.used+o[0]<=st.w+e)c.push({st,lv,o});})));   // 1: ряд той же высоты
    let b=pick(c,y=>y.st.w-y.lv.used-y.o[0]);if(b)return b;
    c=[];sh.strips.forEach(st=>x.o.forEach(o=>{if(st.len+o[1]<=LW+e&&o[0]<=st.w+e)c.push({st,o});}));   // 2: новый ряд в полосе
    b=pol<2?first(c.sort((p,q)=>(p.st.w-p.o[0])-(q.st.w-q.o[0]))):pick(c,y=>(y.st.w-y.o[0])*y.o[1]);if(b)return b;
    c=x.o.filter(o=>sh.len+o[0]<=LS+e).map(o=>({o}));   // 3: новая полоса
    return pol<2?c[0]||null:pick(c,y=>pol===2?y.o[0]:-y.o[0]);};
  for(const x of L){let sh=null,f=null;for(const s of sheets){f=fit(s,x);if(f){sh=s;break;}}
    if(!f){sh={strips:[],len:0,items:[]};sheets.push(sh);f=fit(sh,x);}
    let {st,lv,o}=f;const [a,b]=o;
    if(!st){st={pos:sh.len,w:a,len:0,lv:[]};sh.strips.push(st);sh.len+=a;}
    if(!lv){lv={y:st.len,h:b,used:0};st.lv.push(lv);st.len+=b;}
    const s0=st.pos+lv.used,t0=lv.y;lv.used+=a;
    sh.items.push(v?{x:E+s0,y:E+t0,w:a,h:b,r:x.r}:{x:E+t0,y:E+s0,w:b,h:a,r:x.r});}
  const box=sheets.reduce((s,sh)=>s+Math.max(...sh.items.map(i=>i.x+i.w))*Math.max(...sh.items.map(i=>i.y+i.h)),0);
  return {sheets:sheets.map(sh=>({items:sh.items})),too,box};}
// резы гильотины по схеме: в прямоугольнике ищем сквозные резы (от края до края, не через заготовку) по краям заготовок; режем по всем резам того
// направления, где их больше, и так же — каждый кусок. ok=false — где-то сквозного реза нет (так гильотина не режет). Кусок без заготовок дальше не режем
function gilCuts(A,x0,y0,x1,y1){const e=1e-6,In=A.filter(r=>r.x<x1-e&&r.x+r.w>x0+e&&r.y<y1-e&&r.y+r.h>y0+e);
  if(!In.length)return {cuts:0,ok:true};
  if(In.length===1){const r=In[0];if(Math.abs(r.x-x0)<e&&Math.abs(r.y-y0)<e&&Math.abs(r.x+r.w-x1)<e&&Math.abs(r.y+r.h-y1)<e)return {cuts:0,ok:true};}
  const pos=(lo,hi,k,d)=>[...new Set(In.flatMap(r=>[r[k],r[k]+r[d]]))].filter(c=>c>lo+e&&c<hi-e&&!In.some(r=>r[k]<c-e&&r[k]+r[d]>c+e)).sort((a,b)=>a-b);
  const X=pos(x0,x1,'x','w'),Y=pos(y0,y1,'y','h');if(!X.length&&!Y.length)return {cuts:0,ok:false};
  const vx=X.length>=Y.length,C=vx?X:Y,b=[vx?x0:y0,...C,vx?x1:y1];let cuts=C.length,ok=true;
  for(let i=0;i<b.length-1;i++){const s=vx?gilCuts(In,b[i],y0,b[i+1],y1):gilCuts(In,x0,b[i],x1,b[i+1]);cuts+=s.cuts;ok=ok&&s.ok;}
  return {cuts,ok};}
function gilPack(rects,W,H,edge){let best=null;
  for(const dir of ['v','h'])for(let sort=0;sort<4;sort++)for(let pol=0;pol<4;pol++){const r=gilTry(rects,W,H,edge,dir,sort,pol);
    if(!best||r.too.length<best.too.length||r.too.length===best.too.length&&(r.sheets.length<best.sheets.length||r.sheets.length===best.sheets.length&&r.box<best.box-1e-6))best=r;}
  best.sheets.forEach(sh=>{const a=sh.items.reduce((s,i)=>s+i.w*i.h,0),bx=Math.max(0,...sh.items.map(i=>i.x+i.w))*Math.max(0,...sh.items.map(i=>i.y+i.h)),c=gilCuts(sh.items,0,0,W,H);
    Object.assign(sh,{cuts:c.cuts,ok:c.ok,used:a/(W*H),waste:(bx-a)/(W*H)});});   // отход — обрезки внутри занятого прямоугольника (от угла листа), с подрезкой; дальше — целый остаток листа
  return {sheets:best.sheets,too:best.too,W,H,edge};}
// заготовки для схемы: каждая штука детали «гильотина» — габарит детали; куски листа под лазер — по одному на лазерную раскладку
function gilRects(N,G,R){const r=[];G.types.forEach(ty=>{if(ty.kind!=='list')for(let j=0;j<ty.q;j++)r.push({w:ty.m.w,h:ty.m.h,kind:ty.kind,ty,no:ty.no});});
  ((R&&R.sheets)||[]).forEach((sh,si,a)=>{const [w,h]=nestPiece(N,sh);r.push({w,h,kind:'piece',si,no:null,name:`Кусок листа под лазер${a.length>1?' '+(si+1):''}`,sh});});return r;}
const gilScheme=(N,G,R)=>R.gil||(R.gil=gilPack(gilRects(N,G,R),N.W,N.H,N.edge));   // R — результат лазерной раскладки (кэш по ключу задания) — схему считаем один раз
// что написать в заготовке: номер детали (у куска — «кусок», коротко «К») и размер «800 × 195»
const gilLabel=r=>r.kind==='piece'?['кусок','К'+(r.name.match(/\d+$/)||[''])[0]]:[String(r.no),String(r.no)];
// схема гильотины (SVG, мм): рамка листа, заготовки — серые (готовая деталь) и светло-оранжевые (дальше на лазер), внутри номер и размер; линий лазера нет
function gilSvg(N,G,sh,isOn,big){const W=N.W,H=N.H,fk=big?1:2,fs=Math.round(H*.035*fk),pd=Math.round(fs*1.6),Y=y=>H-y;
  let g=`<rect class="sh" x="0" y="0" width="${W}" height="${H}"/><text class="dim" x="${W/2}" y="${-fs*.5}" font-size="${fs}" text-anchor="middle">${W}</text><text class="dim" transform="translate(${-fs*.5},${H/2}) rotate(-90)" font-size="${fs}" text-anchor="middle">${H}</text>`;
  sh.items.forEach(it=>{const r=it.r,on=r.kind==='piece'?r.sh.items.some(i=>isOn(G.items[i.id].ty)):isOn(r.ty),sz=`${fmt(r.w,0)} × ${fmt(r.h,0)}`,[nm,sn]=gilLabel(r);
    const nt=r.kind==='piece'?`${r.name}, ${sz}`:`${r.no} — ${r.ty.p.name}, ${sz} · ${GIL_KIND[r.kind]}`,cx=it.x+it.w/2,cy=Y(it.y+it.h/2);
    const fz=n1(Math.max(fs*.6,Math.min(fs*1.1,.5*Math.min(it.w,it.h)))),f2=n1(fz*.8),tw=(t,f)=>t.length*f*.62,pad=fz*.4;
    let tx;
    if(it.h>=fz+f2*1.3+2*pad&&it.w>=Math.max(tw(nm,fz),tw(sz,f2))+2*pad)tx=`<text x="${n1(cx)}" y="${n1(cy-f2*.55)}" dy=".36em" font-size="${fz}" text-anchor="middle">${nm}</text><text class="sz" x="${n1(cx)}" y="${n1(cy+fz*.6)}" dy=".36em" font-size="${f2}" text-anchor="middle">${sz}</text>`;
    else{const t=it.w>=tw(nm,fz)+2*pad?nm:sn;tx=`<text x="${n1(cx)}" y="${n1(cy)}" dy=".36em" font-size="${fz}" text-anchor="middle">${t}</text>`;}
    g+=`<g class="gp ${r.kind==='gil'?'gil':'las'}${on?' on':''}"><title>${nt}</title><rect x="${n1(it.x)}" y="${n1(Y(it.y+it.h))}" width="${n1(it.w)}" height="${n1(it.h)}"/>${tx}</g>`;});
  return `<svg class="nestsv gilsv" viewBox="${-pd} ${-pd} ${W+pd+10} ${H+pd+10}" role="img" aria-label="Схема гильотины, лист ${G.mm} мм, ${H} × ${W}, заготовок ${sh.items.length}, резов ${sh.cuts}">${g}</svg>`;}
// DXF схемы гильотины: рамка листа — SHEET, заготовки — BLANK, номер и размер — TEXT (R12 TEXT, латиница: «800x195»); линий CUT нет
function gilDxf(N,G,sh){const f=v=>Math.round(v*100)/100,W=N.W,H=N.H,m={sheet:rect(W,H),blanks:[],texts:[]};
  sh.items.forEach(it=>{const r=it.r,[x0,y0,x1,y1]=[it.x,it.y,it.x+it.w,it.y+it.h].map(f);m.blanks.push([[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]);
    const s1=`${r.kind==='piece'?'K'+(r.name.match(/\d+$/)||[''])[0]:r.no} ${fmt(r.w,0)}x${fmt(r.h,0)}`,s0=r.kind==='piece'?'K':String(r.no);
    let s=s1,h=Math.min(40,it.h*.3,it.w/(s1.length*.75));if(h<8){s=s0;h=Math.min(40,it.h*.5,it.w/(s0.length*.75));}
    m.texts.push([f((x0+x1)/2),f((y0+y1)/2),f(Math.max(1,h)),s]);});
  return dxfText(m);}
const gilFile=(N,G,P,si)=>`gilotina_${G.mm}mm_${N.sk}${P.sheets.length>1?'_'+(si+1):''}.dxf`;
// DXF детали для лазера: с gil у zag — по заготовке (_zag), у gil — не нужен (null)
const partOut=(N,ty)=>!N.gil||ty.kind==='list'?[dxfName(ty.p),dxfText(ty.m)]:ty.kind==='zag'?[dxfNameZ(ty.p),dxfText(ty.b)]:null;
// вкладка: на каждую толщину (5 → 3 → 15 мм) — заголовок, кнопки скачивания, лист, под ним детали этого листа (как была таблица «Лазер · DXF»);
// № в таблице — тот же, что на листе; выбранное на модели подсвечено. С gil: вместо листа — схема гильотины (gilSvg) и легенда, под ней —
// кусок листа под лазер с деталями «лазер»; в строках таблицы — переключатель «гильотина | лазер», рез и врезки по заготовке (мелко — «из листа»), ниже «На гильотину»
function nestDraw(N,res){const box=document.getElementById('nestBox');if(!box)return;box.classList.remove('busy');NST.cur={N,res};
  const isOn=ty=>!!S.sel.el&&inSel(PDF_ELEM(ty.p.pt),ty.p.pt),wide=!(box.clientWidth>0&&box.clientWidth<600);   // узкий экран (телефон): шрифт на листах крупнее — иначе номера ~4 px
  box.innerHTML=N.groups.length?N.groups.map((G,gi)=>{const R=res[gi]||{sheets:[],too:[]},main=G.mm===5,ns=R.sheets.length,P=N.gil?gilScheme(N,G,R):null;
    let h=`<section class="nblock${main?' main':''}"><h3>Лист ${G.mm} мм</h3>`,bt='';
    if(P)P.sheets.forEach((sh,si)=>{bt+=`<button class="dxfbtn" data-act="gil" data-g="${gi}" data-s="${si}">Скачать схему гильотины (DXF)${P.sheets.length>1?' '+(si+1):''}</button>`;});
    R.sheets.forEach((sh,si)=>{bt+=`<button class="dxfbtn" data-act="sheet" data-g="${gi}" data-s="${si}">${N.gil?'Скачать DXF куска под лазер':'Скачать DXF листа'}${ns>1?' '+(si+1):''}</button>`;});
    if(bt)h+=`<div class="nbtns">${bt}</div>`;
    const lsr=(sh,si)=>N.gil?`Кусок листа под лазер ${nestPiece(N,sh).join(' × ')}${ns>1?` (${si+1} из ${ns})`:''} · деталей ${sh.items.length} · зазор ${fmt(N.gap,1)} мм, от края ${NEST_EDGE} мм`
      :`${ns>1?`Лист ${si+1} из ${ns} · `:''}${N.H} × ${N.W} · деталей ${sh.items.length} · занято ${Math.round(sh.used*100)} % · зазор ${fmt(N.gap,1)} мм, от края ${NEST_EDGE} мм`;
    if(P){const np=P.sheets.length;
      P.sheets.forEach((sh,si)=>{h+=`<figure class="nsheet"><figcaption title="Отход — обрезки внутри занятого прямоугольника (от угла листа), вместе с подрезкой кромки; остальное — целый остаток листа">Лист ${G.mm} мм${np>1?`, ${si+1} из ${np}`:''} · гильотина: резов ${sh.cuts}, заготовок ${sh.items.length}, занято ${Math.round(sh.used*100)} %, отход ${Math.round(sh.waste*100)} % · ${N.H} × ${N.W}, подрезка кромки ${N.edge} мм</figcaption>${gilSvg(N,G,sh,isOn,wide)}</figure>`;});
      if(np)h+='<p class="glegend"><span><i class="lg gil">▪</i> серый — готовая деталь (только гильотина)</span><span><i class="lg las">▪</i> оранжевый — заготовка, дальше на лазер</span></p>';
      if(P.too.length)h+=`<p class="nwarn">Не помещается на лист с подрезкой кромки: ${P.too.map(r=>r.kind==='piece'?r.name:`${r.no} ${r.ty.p.name}`).join(', ')}</p>`;}
    R.sheets.forEach((sh,si)=>{h+=`<figure class="nsheet${N.gil?' nlaser':''}"><figcaption>${lsr(sh,si)}</figcaption>${nestSvg(N,G,sh,isOn,wide)}</figure>`;});
    if(R.too.length){const c={};R.too.forEach(o=>c[o.no]=(c[o.no]||0)+1);
      h+=`<p class="nwarn">Не поместилось: ${Object.keys(c).map(no=>{const ty=G.types.find(t=>t.no===+no);return `${no} ${ty.p.name}${c[no]>1?` × ${c[no]}`:''}`;}).join(', ')}</p>`;}
    const PT='Врезки по заготовке — с запасом: по одной на каждый паз или вырез с кромки, хотя цех может заходить с кромки без прожига';
    let tc=0,tp=0,tq=0,zc=0,zp=0,t=`<thead><tr><th class="r">№</th><th>Деталь</th><th>Эскиз</th><th class="r">Кол-во</th><th>Габарит, мм</th><th class="r">Рез, м</th><th class="r"${N.gil?` title="${PT}"`:''}>Врезок</th><th class="r dl">Скачать</th></tr></thead><tbody>`;
    const was=v=>`<small class="was">из листа ${v}</small>`,btn=ti=>`<button class="dxfbtn dl" data-act="part" data-g="${gi}" data-t="${ti}" title="Скачать DXF детали" aria-label="Скачать DXF детали">⬇\uFE0E DXF</button>`;
    const sw=(ty,ti)=>`<span class="gsel" role="group" aria-label="Чем резать: ${ty.p.name}">${[['gil','гильотина'],['laser','лазер']].map(([v,n])=>`<button data-act="gsel" data-g="${gi}" data-t="${ti}" data-v="${v}" aria-pressed="${ty.sel===v}">${n}</button>`).join('')}</span>`;
    G.types.forEach((ty,ti)=>{const p=ty.p,m=ty.m,k=N.gil?ty.kind:'list',b=k==='zag'?ty.b:m,o=partOut(N,ty);tc+=m.cut*ty.q;tp+=m.pierce*ty.q;tq+=ty.q;if(k!=='gil'){zc+=b.cut*ty.q;zp+=b.pierce*ty.q;}
      const nums=k==='gil'?`<td class="n r nolz" colspan="2">лазер не нужен</td>`:k==='zag'?`<td class="n r">${fmt(b.cut/1000,2)}${was(fmt(m.cut/1000,2))}</td><td class="n r" title="${PT}">${b.pierce}${was(m.pierce)}</td>`:`<td class="n r">${fmt(m.cut/1000,2)}</td><td class="n r">${m.pierce}</td>`;
      t+=`<tr${isOn(ty)?' class="on"':''}><td class="n r">${ty.no}</td><td>${p.name}${N.gil?`${sw(ty,ti)}<small class="kd kd-${k}">${KIND_TAG[k]}</small>`:''}${p.note?`<small>${p.note}</small>`:''}${o?`<small class="fn">${o[0]}</small>`:''}</td><td>${dxfSketch(m,N.gil?k:'list',ty.b)}</td><td class="n r">${ty.q}</td><td class="n">${fmt(m.w,1)} × ${fmt(m.h,1)}</td>${nums}<td class="r dl">${o?btn(ti):''}</td></tr>`;});
    t+=N.gil?`<tr class="tot"><td colspan="5">Итого по листу ${G.mm} мм: ${tq} шт, рез и врезки — с учётом количества; лазер — по заготовкам и детали «лазер» целиком, мелко — если всё резать из листа</td><td class="n r">${fmt(zc/1000,2)}${was(fmt(tc/1000,2))}</td><td class="n r">${zp}${was(tp)}</td><td class="dl"></td></tr></tbody>`
      :`<tr class="tot"><td colspan="5">Итого по листу ${G.mm} мм: ${tq} шт, рез и врезки — с учётом количества</td><td class="n r">${fmt(tc/1000,2)}</td><td class="n r">${tp}</td><td class="dl"></td></tr></tbody>`;
    h+=`<div class="tbl"><table class="ntbl">${t}</table></div>`;
    if(N.gil){const gr=gilRows(N,G,R);
      h+=`<h4 class="ngil">На гильотину · ${G.mm} мм</h4>`+(gr.length?`<div class="tbl"><table class="gtbl"><thead><tr><th class="r">№ детали</th><th>Деталь</th><th>Заготовка, мм</th><th class="r">Шт</th><th>Вид</th></tr></thead><tbody>${gr.map(o=>`<tr><td class="n r">${o.no||'—'}</td><td>${o.name}</td><td class="n">${fmt(o.w,0)} × ${fmt(o.h,0)}</td><td class="n r">${o.q}</td><td>${GIL_KIND[o.kind]}</td></tr>`).join('')}</tbody></table></div>`:'<p class="tabnote">Ничего</p>');}
    return h+'</section>';}).join(''):'<p class="tabnote">Листовых деталей нет</p>';}
// «Скачать всё (ZIP)»: DXF каждого листа и каждой детали — то, что на вкладке; с gil — схемы гильотины, куски листа под лазер, детали zag по заготовке (_zag),
// gil без DXF, и gilotina_<N>mm.csv на толщину
function saveAll(){if(NST.run||!NST.cur)return;const {N,res}=NST.cur,F=[];
  N.groups.forEach((G,gi)=>{const R=res[gi];if(R&&N.gil){const P=gilScheme(N,G,R);P.sheets.forEach((sh,si)=>F.push([gilFile(N,G,P,si),gilDxf(N,G,sh)]));}
    if(R)R.sheets.forEach((sh,si)=>F.push([nestFile(N,G,R,si),nestDxf(N,G,sh)]));G.types.forEach(ty=>{const o=partOut(N,ty);if(o)F.push(o);});
    if(N.gil)F.push([`gilotina_${G.mm}mm.csv`,gilCsv(N,G,R)]);});
  if(F.length)saveOut(`${MODE_FILE()}_raskroy_${N.sk}.zip`,zipFiles(F));}
// «гильотина | лазер» у детали: запомнить (ключ — p.file) и пересчитать; null — сбросить всё к умолчаниям
function gilSet(file,v){const m=file?gilSelStore():{};if(file)m[file]=v;store('md-gilsel',m);nestUI(true);}
// кнопки над листом и в таблице; пока идёт раскладка — не качаем (лист ещё старый)
function nestClick(e){const b=e.target.closest&&e.target.closest('button[data-act]');if(!b||!NST.cur)return;
  const {N,res}=NST.cur,G=N.groups[+b.dataset.g],R=res[+b.dataset.g];if(!G)return;
  if(b.dataset.act==='gsel'){const ty=G.types[+b.dataset.t];if(ty&&ty.sel!==b.dataset.v)gilSet(ty.p.file,b.dataset.v);return;}
  if(NST.run)return;
  if(b.dataset.act==='sheet'&&R&&R.sheets[+b.dataset.s])saveDxf(nestFile(N,G,R,+b.dataset.s),nestDxf(N,G,R.sheets[+b.dataset.s]));
  else if(b.dataset.act==='gil'&&R&&N.gil){const P=gilScheme(N,G,R),sh=P.sheets[+b.dataset.s];if(sh)saveDxf(gilFile(N,G,P,+b.dataset.s),gilDxf(N,G,sh));}
  else if(b.dataset.act==='part'&&G.types[+b.dataset.t]){const o=partOut(N,G.types[+b.dataset.t]);if(o)saveDxf(...o);}}

/* ---------- когда считать: только при открытой вкладке, через 0,3 с после правки; кусками по ~60 мс, кэш по ключу ---------- */
const NST={key:'',res:null,run:null,t:0,init:false,cur:null};   // cur — что сейчас нарисовано ({N,res}): для кнопок скачивания
const nestWait=on=>{const e=document.getElementById('nestWait');if(e)e.hidden=!on;if(!on)nestCnt('');};
const nestCnt=t=>document.querySelectorAll('.nestCnt').forEach(e=>{e.textContent=t;});
const nestMsg=t=>{const m=document.getElementById('nestMsg');if(m)m.textContent=t;};
// поля «Между деталями», «Лист», «Подрезка кромки» и галочки: значения из памяти браузера (store — в ui.js, к первому показу вкладки он уже есть)
function nestInit(){if(NST.init)return;NST.init=true;const gi=document.getElementById('nGap'),si=document.getElementById('nSheet'),ei=document.getElementById('nEdge');if(!gi||!si)return;
  const g=store('md-ngap'),s=store('md-sheet'),c=store('md-ncgr'),l=store('md-ngil'),ed=store('md-nedge'),ci=document.getElementById('nCgr'),li=document.getElementById('nGil');if(Number.isFinite(+g)&&g!==null)gi.value=g;if(s&&NEST_SHEETS[s])si.value=s;if(ci&&typeof c==='boolean')ci.checked=c;if(li&&typeof l==='boolean')li.checked=l;
  if(ei&&Number.isFinite(+ed)&&ed!==null)ei.value=ed;
  const ch=()=>{const o=nestOpts();store('md-ngap',o.gap);store('md-sheet',o.sk);store('md-ncgr',o.cgr);store('md-ngil',o.gil);store('md-nedge',o.edge);nestUI();};
  gi.addEventListener('input',ch);gi.addEventListener('change',()=>{gi.value=nestOpts().gap;ch();});si.addEventListener('change',ch);if(ci)ci.addEventListener('change',ch);if(li)li.addEventListener('change',()=>{ch();nestUI(true);});
  if(ei){ei.addEventListener('input',ch);ei.addEventListener('change',()=>{ei.value=nestOpts().edge;ch();});}
  const box=document.getElementById('nestBox'),all=document.getElementById('dxfAll'),rs=document.getElementById('nGilReset');if(box)box.addEventListener('click',nestClick);if(all)all.addEventListener('click',saveAll);if(rs)rs.addEventListener('click',()=>gilSet(null));}
function nestUI(now){clearTimeout(NST.t);if(!now){NST.t=setTimeout(()=>nestUI(true),300);return;}
  const pane=document.getElementById('tab-cut');if(!pane||pane.hidden!==false)return;
  nestInit();const N=nestJob(),cb=document.getElementById('nCgrBox');if(cb)cb.hidden=!N.hasCgr;   // галочка колосника — только когда он есть (мангал, «Колосниковая решётка»)
  ['nEdgeBox','nGilReset'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=!N.gil;});   // подрезка кромки и «Сбросить выбор» — только с гильотиной
  if(NST.res&&NST.key===N.key){NST.run=null;nestWait(false);nestMsg('');nestDraw(N,NST.res);return;}   // уже посчитано (лишний счёт, если шёл, — останавливаем)
  if(NST.run&&NST.run.key===N.key)return;   // уже считается
  const run={key:N.key,res:[],gi:0,g:null,done:0},all=N.groups.reduce((a,G)=>a+G.items.length,0);NST.run=run;
  const box=document.getElementById('nestBox');if(box){if(box.querySelector('svg'))box.classList.add('busy');else box.innerHTML='<p class="tabnote">Раскладываю…</p>';}
  nestWait(true);nestMsg('Раскладываю…');
  const step=()=>{if(NST.run!==run)return;const t0=performance.now();
    while(run.gi<N.groups.length){const G=N.groups[run.gi];if(!run.g)run.g=nestGen(G.items,N.LW,N.LH,N.gap,NEST_EDGE,NEST_CELL);const v=run.g.next();
      if(v.done){run.res.push(v.value);run.g=null;run.gi++;}else run.done=N.groups.slice(0,run.gi).reduce((a,G)=>a+G.items.length,0)+v.value.done;
      if(performance.now()-t0>60)break;}
    if(run.gi<N.groups.length){nestMsg(`Раскладываю… ${run.done} из ${all}`);nestCnt(`· ${run.done} из ${all}`);setTimeout(step,0);return;}
    NST.key=run.key;NST.res=run.res;NST.run=null;nestWait(false);nestMsg('');nestUI(true);};   // нарисовать; если детали сменились, пока считали, — посчитает заново
  setTimeout(step,0);}
