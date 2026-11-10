/* ---------- раскрой: листовые детали на лист металла ----------
   Детали — те же, что уходят в DXF (laserParts + partMM), в мм. Разная толщина — разные листы: 5 мм — основной, 3 / 15 — свои.
   Лист — длинной стороной по горизонтали, y вверх, как в DXF.
   Раскладка — по рамкам деталей (MaxRects), перенос nest/bestSpot/occupy/freshSheet с лендинга (md/nest.js): детали мангала почти прямоугольные,
   рамки заполнены на 90 % и больше. На схему и в DXF деталь идёт настоящим контуром (отверстия и внутренние контуры только рисуются).
   Отличия от лендинга: зазор и край — параметры, а не глобальные; деталь — контур pts, рамка — его габарит; на выходе — поворот и сдвиг tr. */
const area2=P=>{let a=0;P.forEach((p,i)=>{const q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];});return a/2;};
// ---------- геометрия контуров: зазор между деталями (тесты) и место для номера (nestLabelPt) ----------
function ptSegD(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function inPoly(p,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function segX(a,b,c,d){const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;}
function polyGap(A,B){let d=Infinity;for(let i=0;i<A.length;i++){const a=A[i],a2=A[(i+1)%A.length];for(let j=0;j<B.length;j++){const b=B[j],b2=B[(j+1)%B.length];if(segX(a,a2,b,b2))return 0;d=Math.min(d,ptSegD(a,b,b2),ptSegD(b,a,a2));}}if(inPoly(A[0],B)||inPoly(B[0],A))return 0;return d;}
function polyDist(P){return p=>{let d=Infinity;P.forEach((a,i)=>{d=Math.min(d,ptSegD(p,a,P[(i+1)%P.length]));});return d;};}
// ---------- раскладка рамок (MaxRects, как на лендинге) ----------
// Свободные прямоугольники листа W × H: рамка детали занимает w + зазор, поэтому рабочее поле шире на зазор (край margin — с каждой стороны)
const nestFresh=(W,H,gap,margin)=>[{x:margin,y:margin,w:W-2*margin+gap,h:H-2*margin+gap}];
// куда положить рамку w × h: место, где её правый край ближе всего к началу листа, затем ниже; поворот на 90° — если так ближе
function nestSpot(free,w,h,gap){let best=null;
  for(const [bw,bh,rot] of [[w,h,false],[h,w,true]]){const W2=bw+gap,H2=bh+gap;
    for(const f of free){if(W2>f.w+1e-6||H2>f.h+1e-6)continue;const c={x:f.x,y:f.y,w:bw,h:bh,rot};
      if(!best||c.x+c.w<best.x+best.w-1e-6||(Math.abs(c.x+c.w-best.x-best.w)<1e-6&&c.y<best.y))best=c;}}
  return best;}
// занять место: свободные прямоугольники, которые задевает рамка, режутся на куски вокруг неё; вложенные — выбрасываются
function nestOccupy(free,r,gap){const R={x:r.x,y:r.y,w:r.w+gap,h:r.h+gap},out=[];
  for(const f of free){if(R.x>=f.x+f.w||R.x+R.w<=f.x||R.y>=f.y+f.h||R.y+R.h<=f.y){out.push(f);continue;}
    if(R.x>f.x)out.push({x:f.x,y:f.y,w:R.x-f.x,h:f.h});
    if(R.x+R.w<f.x+f.w)out.push({x:R.x+R.w,y:f.y,w:f.x+f.w-R.x-R.w,h:f.h});
    if(R.y>f.y)out.push({x:f.x,y:f.y,w:f.w,h:R.y-f.y});
    if(R.y+R.h<f.y+f.h)out.push({x:f.x,y:R.y+R.h,w:f.w,h:f.y+f.h-R.y-R.h});}
  const inside=(a,b)=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h;
  return out.filter((a,i)=>!out.some((b,j)=>j!==i&&inside(a,b)&&(!inside(b,a)||j<i)));}
// items — {id,no,pts}: каждая штука отдельно; W — длинная сторона листа. Порядок — по большей стороне рамки, затем по площади, по убыванию;
// деталь — на первый лист, где есть место, иначе новый лист; не влезла и в пустой — в too. yield {done,of} на каждую деталь (страница не замирает).
// tr — поворот и сдвиг контура на лист: T(q) = [c·q0 − s·q1 + x, s·q0 + c·q1 + y]; повёрнутая на 90° (c=0, s=1) — T(q) = [−q1 + x, q0 + y].
// len — правый край раскладки от начала листа (с краем), used — доля металла листа, dense — доля металла в занятой полосе
function* nestGen(items,W,H,gap,margin){
  const parts=items.map(o=>{const xs=o.pts.map(p=>p[0]),ys=o.pts.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys),x1=Math.max(...xs),y1=Math.max(...ys);
    return {id:o.id,no:o.no,pts:o.pts,area:Math.abs(area2(o.pts)),x0,y0,x1,y1,w:x1-x0,h:y1-y0};})
    .sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h);
  const sheets=[],too=[];
  for(let i=0;i<parts.length;i++){const part=parts[i];yield {done:i,of:parts.length};
    // место ищется один раз: на первом листе, где есть; нет — на новом листе; нет и там — деталь больше листа
    let S=null,spot=null;for(const s of sheets)if((spot=nestSpot(s.free,part.w,part.h,gap))){S=s;break;}
    if(!S){const free=nestFresh(W,H,gap,margin);spot=nestSpot(free,part.w,part.h,gap);
      if(!spot){too.push({id:part.id,no:part.no});continue;}S={items:[],free,len:0};sheets.push(S);}
    S.free=nestOccupy(S.free,spot,gap);
    const tr=spot.rot?{f:false,c:0,s:1,x:spot.x+part.y1,y:spot.y-part.x0}:{f:false,c:1,s:0,x:spot.x-part.x0,y:spot.y-part.y0},
      pts=part.pts.map(q=>[tr.c*q[0]-tr.s*q[1]+tr.x,tr.s*q[0]+tr.c*q[1]+tr.y]),bb=[spot.x,spot.y,spot.x+spot.w,spot.y+spot.h];
    S.items.push({id:part.id,no:part.no,flip:false,tr,area:part.area,pts,bb});S.len=Math.max(S.len,bb[2]);}
  sheets.forEach(s=>{const a=s.items.reduce((q,o)=>q+o.area,0);s.used=a/(W*H);s.dense=a/((s.len-margin)*(H-2*margin)||1);delete s.free;});
  return {sheets,too,W,H,gap,used:sheets.length?sheets.reduce((a,s)=>a+s.used,0)/sheets.length:0};}

/* ---------- детали для раскладки ---------- */
const NEST_SHEETS={'1000x2000':[2000,1000],'1250x2500':[2500,1250],'1500x3000':[3000,1500]},NEST_EDGE=10;   // [длина, ширина]; от края листа 10 мм
// контур → точки без повтора последней и без двойных подряд; меньше 3 точек, не числа или нулевая площадь — null
function nestLoop(l){if(!Array.isArray(l))return null;const P=[],same=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6;
  for(const p of l){if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;if(!P.length||!same(P[P.length-1],p))P.push([p[0],p[1]]);}
  while(P.length>1&&same(P[0],P[P.length-1]))P.pop();
  return P.length>=3&&Math.abs(area2(P))>1?P:null;}
// значения полей: зазор 1…50 мм с шагом 0,5; лист — из списка; cgr — колосник мангала на листе (галочка, по умолчанию снята: два колосника — половина реза
// и почти все врезки листа, а подойдёт готовый перфолист; память браузера md-ncgr2, старый md-ncgr не читается); gil — заготовки с гильотины (галочка, по умолчанию снята);
// edge — подрезка кромки на схеме гильотины 0…30 мм, целые (по умолчанию 10); sel — выбор «гильотина | лазер» по деталям ({file: 'gil' | 'laser'}, память браузера md-gilsel)
const NEST_CGR=p=>p.pt==='cgr1'||p.pt==='cgr2';
const gilSelStore=()=>{try{const v=store('md-gilsel');return v&&typeof v==='object'?v:{};}catch(e){return {};}};   // store — в ui.js; до его загрузки — умолчания
function nestOpts(){const gi=document.getElementById('nGap'),si=document.getElementById('nSheet'),ci=document.getElementById('nCgr'),li=document.getElementById('nGil'),ei=document.getElementById('nEdge');
  let gap=parseFloat(String(gi&&gi.value!=null?gi.value:'').replace(',','.'));if(!Number.isFinite(gap))gap=5;gap=Math.min(50,Math.max(1,Math.round(gap*2)/2));
  let edge=parseFloat(String(ei&&ei.value!=null?ei.value:'').replace(',','.'));if(!Number.isFinite(edge))edge=10;edge=Math.min(30,Math.max(0,Math.round(edge)));
  const v=si&&typeof si.value==='string'?si.value:'',sk=NEST_SHEETS[v]?v:'1250x2500',[W,H]=NEST_SHEETS[sk];return {gap,sk,W,H,edge,cgr:!!(ci&&ci.checked===true),gil:!!(li&&li.checked===true),sel:gilSelStore()};}
// «гильотина | лазер» по умолчанию: деталь уже GIL_MIN_W — лазер, остальные — гильотина
const gilDef=m=>Math.min(m.w,m.h)<GIL_MIN_W?'laser':'gil';
// задание: группы по толщине (5 мм первой), в каждой — типы деталей (номер, контур, кол-во) и штуки для раскладки; key — для кэша.
// over — поменять поля (smoke: {cgr:true}, {gil:true,edge:10,sel:{…}}); hasCgr — есть ли колосник мангала (показать галочку).
// Колосник мангала в типах всегда (строка и DXF в таблице), на лист — только с cgr; без cgr у типа offSheet — нет на схеме, в «Итого» и на гильотине.
// У типа sel — «гильотина | лазер», kind — вид детали (partKind по sel), b — геометрия по заготовке (blankMM, только у zag).
// С gil на лазерную раскладку идут только детали «лазер» (kind 'list') — на кусок не больше листа минус подрезка (LW × LH); в таблицах остаются все типы (номера те же)
function nestJob(over){const o=Object.assign(nestOpts(),over),all=laserParts(),hasCgr=all.some(NEST_CGR),ths=[...new Set(all.map(p=>p.mm))].sort((a,b)=>(b===5)-(a===5)||a-b),groups=[];let no=0;
  ths.forEach(mm=>{const G={mm,types:[],items:[]};
    all.filter(p=>p.mm===mm&&p.q>0).forEach(p=>{let m=null;try{m=partMM(p);}catch(e){}const P=m&&nestLoop(m.loops[0]);if(!P)return;   // пустой или вырожденный контур — пропускаем
      const v=o.sel[p.file],sel=v==='gil'||v==='laser'?v:gilDef(m),kind=partKind(m,sel),ty={no:++no,p,m,P,q:p.q,sel,kind,b:kind==='zag'?blankMM(p,m):null,offSheet:!o.cgr&&NEST_CGR(p)};G.types.push(ty);
      if(!ty.offSheet&&(!o.gil||kind==='list'))for(let j=0;j<p.q;j++)G.items.push({id:G.items.length,no:ty.no,pts:P,ty});});
    if(G.types.length)groups.push(G);});
  const LW=o.gil?o.W-2*o.edge:o.W,LH=o.gil?o.H-2*o.edge:o.H;
  const key=JSON.stringify([o.W,o.H,o.gap,o.gil,o.gil?o.edge:0,groups.map(G=>[G.mm,G.items.length,G.types.map(ty=>[ty.no,ty.q,o.gil?ty.kind:'',ty.offSheet?1:0,ty.P.map(q=>q.map(v=>Math.round(v*10)))])])]);
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
function gilRows(N,G,R){const r=G.types.filter(ty=>ty.kind!=='list'&&!ty.offSheet).map(ty=>({no:ty.no,name:ty.p.name,w:ty.m.w,h:ty.m.h,q:ty.q,kind:ty.kind}));
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
function gilRects(N,G,R){const r=[];G.types.forEach(ty=>{if(ty.kind!=='list'&&!ty.offSheet)for(let j=0;j<ty.q;j++)r.push({w:ty.m.w,h:ty.m.h,kind:ty.kind,ty,no:ty.no});});
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
function nestDraw(N,res){const box=document.getElementById('nestBox');if(!box)return;NST.cur={N,res};box.innerHTML=nestHtml(N,res);}
function nestHtml(N,res){const box=document.getElementById('nestBox');
  const isOn=ty=>!!S.sel.el&&inSel(PDF_ELEM(ty.p.pt),ty.p.pt),wide=!(box&&box.clientWidth>0&&box.clientWidth<600);   // узкий экран (телефон): шрифт на листах крупнее — иначе номера ~4 px
  return N.groups.length?N.groups.map((G,gi)=>{const R=res[gi]||{sheets:[],too:[]},main=G.mm===5,ns=R.sheets.length,P=N.gil?gilScheme(N,G,R):null;
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
    G.types.forEach((ty,ti)=>{const p=ty.p,m=ty.m,k=N.gil?ty.kind:'list',b=k==='zag'?ty.b:m,o=partOut(N,ty);if(!ty.offSheet){tc+=m.cut*ty.q;tp+=m.pierce*ty.q;tq+=ty.q;if(k!=='gil'){zc+=b.cut*ty.q;zp+=b.pierce*ty.q;}}
      const nums=k==='gil'?`<td class="n r nolz" colspan="2">лазер не нужен</td>`:k==='zag'?`<td class="n r">${fmt(b.cut/1000,2)}${was(fmt(m.cut/1000,2))}</td><td class="n r" title="${PT}">${b.pierce}${was(m.pierce)}</td>`:`<td class="n r">${fmt(m.cut/1000,2)}</td><td class="n r">${m.pierce}</td>`;
      t+=`<tr${isOn(ty)?' class="on"':''}><td class="n r">${ty.no}</td><td>${p.name}${N.gil?`${sw(ty,ti)}<small class="kd kd-${k}">${KIND_TAG[k]}</small>`:''}${ty.offSheet?'<small>не на листе — в цифры листа не входит</small>':''}${p.note?`<small>${p.note}</small>`:''}${o?`<small class="fn">${o[0]}</small>`:''}</td><td>${dxfSketch(m,N.gil?k:'list',ty.b)}</td><td class="n r">${ty.q}</td><td class="n">${fmt(m.w,1)} × ${fmt(m.h,1)}</td>${nums}<td class="r dl">${o?btn(ti):''}</td></tr>`;});
    t+=N.gil?`<tr class="tot"><td colspan="5">Итого по листу ${G.mm} мм: ${tq} шт, рез и врезки — с учётом количества; лазер — по заготовкам и детали «лазер» целиком, мелко — если всё резать из листа</td><td class="n r">${fmt(zc/1000,2)}${was(fmt(tc/1000,2))}</td><td class="n r">${zp}${was(tp)}</td><td class="dl"></td></tr></tbody>`
      :`<tr class="tot"><td colspan="5">Итого по листу ${G.mm} мм: ${tq} шт, рез и врезки — с учётом количества</td><td class="n r">${fmt(tc/1000,2)}</td><td class="n r">${tp}</td><td class="dl"></td></tr></tbody>`;
    h+=`<div class="tbl"><table class="ntbl">${t}</table></div>`;
    if(N.gil){const gr=gilRows(N,G,R);
      h+=`<h4 class="ngil">На гильотину · ${G.mm} мм</h4>`+(gr.length?`<div class="tbl"><table class="gtbl"><thead><tr><th class="r">№ детали</th><th>Деталь</th><th>Заготовка, мм</th><th class="r">Шт</th><th>Вид</th></tr></thead><tbody>${gr.map(o=>`<tr><td class="n r">${o.no||'—'}</td><td>${o.name}</td><td class="n">${fmt(o.w,0)} × ${fmt(o.h,0)}</td><td class="n r">${o.q}</td><td>${GIL_KIND[o.kind]}</td></tr>`).join('')}</tbody></table></div>`:'<p class="tabnote">Ничего</p>');}
    return h+'</section>';}).join(''):'<p class="tabnote">Листовых деталей нет</p>';}
// «Скачать всё (ZIP)»: DXF каждого листа и каждой детали — то, что на вкладке; с gil — схемы гильотины, куски листа под лазер, детали zag по заготовке (_zag),
// gil без DXF, и gilotina_<N>mm.csv на толщину
// перед скачиванием ключ сверяется сразу: правка могла быть меньше 0,3 с назад, а старый раскрой качать нельзя
const nestUpToDate=()=>{const c=nestCalc();c.check();return c.ready()&&!!NST.cur;};
function saveAll(){if(!nestUpToDate())return;const {N,res}=NST.cur,F=[];
  N.groups.forEach((G,gi)=>{const R=res[gi];if(R&&N.gil){const P=gilScheme(N,G,R);P.sheets.forEach((sh,si)=>F.push([gilFile(N,G,P,si),gilDxf(N,G,sh)]));}
    if(R)R.sheets.forEach((sh,si)=>F.push([nestFile(N,G,R,si),nestDxf(N,G,sh)]));G.types.forEach(ty=>{const o=partOut(N,ty);if(o)F.push(o);});
    if(N.gil)F.push([`gilotina_${G.mm}mm.csv`,gilCsv(N,G,R)]);});
  if(F.length)saveOut(`${MODE_FILE()}_raskroy_${N.sk}.zip`,zipFiles(F));}
// «гильотина | лазер» у детали: запомнить (ключ — p.file) и пересчитать; null — сбросить всё к умолчаниям
function gilSet(file,v){const m=file?gilSelStore():{};if(file)m[file]=v;store('md-gilsel',m);nestUI(true);}
// кнопки над листом и в таблице; результат устарел — не качаем
function nestClick(e){const b=e.target.closest&&e.target.closest('button[data-act]');if(!b||!NST.cur)return;
  const {N,res}=NST.cur,G=N.groups[+b.dataset.g],R=res[+b.dataset.g];if(!G)return;
  if(b.dataset.act==='gsel'){const ty=G.types[+b.dataset.t];if(ty&&ty.sel!==b.dataset.v)gilSet(ty.p.file,b.dataset.v);return;}
  if(!nestUpToDate())return;
  if(b.dataset.act==='sheet'&&R&&R.sheets[+b.dataset.s])saveDxf(nestFile(N,G,R,+b.dataset.s),nestDxf(N,G,R.sheets[+b.dataset.s]));
  else if(b.dataset.act==='gil'&&R&&N.gil){const P=gilScheme(N,G,R),sh=P.sheets[+b.dataset.s];if(sh)saveDxf(gilFile(N,G,P,+b.dataset.s),gilDxf(N,G,sh));}
  else if(b.dataset.act==='part'&&G.types[+b.dataset.t]){const o=partOut(N,G.types[+b.dataset.t]);if(o)saveDxf(...o);}}

/* ---------- когда считать: только по кнопке «Рассчитать» (editor/common/calc.js), кусками по ~60 мс — страница не замирает ----------
   Результат держится, пока не поменялось задание: любая правка зовёт nestUI, через 0,3 с ключ задания (nestJob().key) сравнивается
   с ключом результата. Другой (размеры, режим, детали, лист, зазор, колосник, гильотина) — результат убран, кнопка снова активна;
   тот же (вращение, размеры на модели, галочки вида, выбор детали) — результат перерисован. */
const NST={res:null,t:0,init:false,cur:null};   // res — раскладка последнего расчёта; cur — что сейчас нарисовано ({N,res}): для кнопок скачивания
const nestCnt=t=>document.querySelectorAll('.nestCnt').forEach(e=>{e.textContent=t;});
// расчёт по кнопке: раскладка всех толщин; live() — false, если задание поменялось и расчёт уже не нужен
function nestRun(done,live){const N=nestJob(),all=N.groups.reduce((a,G)=>a+G.items.length,0),res=[];let gi=0,g=null,n=0;nestCnt('');
  const step=()=>{if(!live())return;const t0=performance.now();
    try{while(gi<N.groups.length){const G=N.groups[gi];if(!g)g=nestGen(G.items,N.LW,N.LH,N.gap,NEST_EDGE);const v=g.next();
        if(v.done){res.push(v.value);g=null;gi++;}else n=N.groups.slice(0,gi).reduce((a,G)=>a+G.items.length,0)+v.value.done;
        if(performance.now()-t0>60)break;}}
    catch(e){nestCalc().stale();throw e;}   // упало посреди счёта — кнопка не висит на «Считаю…»
    if(gi<N.groups.length){nestCnt(`· ${n} из ${all}`);setTimeout(step,0);return;}
    if(done(nestHtml(N,res))){NST.res=res;NST.cur={N,res};}};   // результат принят — его и качаем
  setTimeout(step,0);}
// кнопка «Рассчитать» — при первом обращении: nest.js грузится и без страницы (тесты раскладки в smoke.js)
let NCALC=null;
const nestCalc=()=>NCALC||(NCALC=makeCalc({btn:document.getElementById('nestRun'),box:document.getElementById('nestBox'),save:document.getElementById('dxfAll'),
  wait:document.getElementById('nestWait'),key:()=>nestJob().key,run:nestRun}));
// поля «Между деталями», «Лист», «Подрезка кромки» и галочки: значения из памяти браузера (store — в ui.js, к первому показу вкладки он уже есть)
function nestInit(){if(NST.init)return;NST.init=true;const gi=document.getElementById('nGap'),si=document.getElementById('nSheet'),ei=document.getElementById('nEdge');if(!gi||!si)return;
  const g=store('md-ngap'),s=store('md-sheet'),c=store('md-ncgr2'),l=store('md-ngil'),ed=store('md-nedge'),ci=document.getElementById('nCgr'),li=document.getElementById('nGil');if(Number.isFinite(+g)&&g!==null)gi.value=g;if(s&&NEST_SHEETS[s])si.value=s;if(ci&&typeof c==='boolean')ci.checked=c;if(li&&typeof l==='boolean')li.checked=l;
  if(ei&&Number.isFinite(+ed)&&ed!==null)ei.value=ed;
  const ch=()=>{const o=nestOpts();store('md-ngap',o.gap);store('md-sheet',o.sk);store('md-ncgr2',o.cgr);store('md-ngil',o.gil);store('md-nedge',o.edge);nestUI();};
  gi.addEventListener('input',ch);gi.addEventListener('change',()=>{gi.value=nestOpts().gap;ch();});si.addEventListener('change',ch);if(ci)ci.addEventListener('change',ch);if(li)li.addEventListener('change',()=>{ch();nestUI(true);});
  if(ei){ei.addEventListener('input',ch);ei.addEventListener('change',()=>{ei.value=nestOpts().edge;ch();});}
  const box=document.getElementById('nestBox'),all=document.getElementById('dxfAll'),rs=document.getElementById('nGilReset');if(box)box.addEventListener('click',nestClick);if(all)all.addEventListener('click',saveAll);if(rs)rs.addEventListener('click',()=>gilSet(null));}
// любая правка (build3D, drawCut, поля и галочки раскроя, «гильотина | лазер» у детали) и показ вкладки; сам ничего не считает
function nestUI(now){clearTimeout(NST.t);if(!now){NST.t=setTimeout(()=>nestUI(true),300);return;}
  const pane=document.getElementById('tab-cut'),vis=!!pane&&pane.hidden===false;
  if(vis)nestInit();   // до nestJob: задание — по полям со значениями из памяти браузера
  if(!vis&&!nestCalc().held())return;   // вкладка закрыта, результата нет — сравнивать нечего (nestJob считает контуры всех деталей)
  const N=nestJob();nestCalc().check(N.key);   // раскрой от правки поменялся бы — результат убран, «Рассчитать» снова активна
  if(!vis)return;
  const cb=document.getElementById('nCgrBox');if(cb)cb.hidden=!N.hasCgr;   // галочка колосника — только когда он есть (мангал, «Колосниковая решётка»)
  ['nEdgeBox','nGilReset'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=!N.gil;});   // подрезка кромки и «Сбросить выбор» — только с гильотиной
  if(nestCalc().ready())nestDraw(N,NST.res);}   // тот же раскрой — перерисовать: выбор на модели, отверстия, единицы
