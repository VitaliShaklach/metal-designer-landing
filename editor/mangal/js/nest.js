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
// значения полей: зазор 1…50 мм с шагом 0,5; лист — из списка (общий для «С листа», «Из заготовок» и «Гильотины»); cgr — колосник мангала на листе
// (галочка, по умолчанию снята: два колосника — половина реза и почти все врезки листа, а подойдёт готовый перфолист; память браузера md-ncgr2, старый md-ncgr не читается);
// edge — подрезка кромки на схеме гильотины 0…30 мм, целые (по умолчанию 10, поле во вкладке «Гильотина», память md-nedge);
// gilSel — галочки «рубим» в «Гильотине», выбранные человеком: {file: true | false} (память md-gilsel2; не булево — не читается).
// Старые md-ngil («Заготовки с гильотины») и md-gilsel («гильотина | лазер» у детали) больше не читаются: режима с кусками листа нет (#76, #59)
const NEST_CGR=p=>p.pt==='cgr1'||p.pt==='cgr2';
function gilSelStore(){let v=null;try{v=typeof store==='function'?store('md-gilsel2'):null;}catch(e){}   // store — в ui.js; без него (тесты раскладки) — умолчания
  const o={};if(v&&typeof v==='object'&&!Array.isArray(v))Object.keys(v).forEach(k=>{if(typeof v[k]==='boolean')o[k]=v[k];});return o;}
function nestOpts(){const gi=document.getElementById('nGap'),si=document.getElementById('nSheet'),ci=document.getElementById('nCgr'),ei=document.getElementById('nEdge');
  let gap=parseFloat(String(gi&&gi.value!=null?gi.value:'').replace(',','.'));if(!Number.isFinite(gap))gap=5;gap=Math.min(50,Math.max(1,Math.round(gap*2)/2));
  let edge=parseFloat(String(ei&&ei.value!=null?ei.value:'').replace(',','.'));if(!Number.isFinite(edge))edge=10;edge=Math.min(30,Math.max(0,Math.round(edge)));
  const v=si&&typeof si.value==='string'?si.value:'',sk=NEST_SHEETS[v]?v:'1250x2500',[W,H]=NEST_SHEETS[sk];return {gap,sk,W,H,edge,cgr:!!(ci&&ci.checked===true),gilSel:gilSelStore()};}
// гильотина по умолчанию: деталь уже GIL_MIN_W или толще GIL_MAX_MM — не рубим (лазер), остальные — рубим
const gilDef=(m,mm)=>Math.min(m.w,m.h)<GIL_MIN_W||mm>GIL_MAX_MM?'laser':'gil';
// рубим ли деталь на гильотине: колосник мангала — та же настройка, что «Колосник на листе» (cgr); остальные — галочка человека (gilSel),
// без неё — умолчание gilDef. Деталь без контура (kind 'list') не рубим
const gilOn=(ty,o)=>ty.kind!=='list'&&(NEST_CGR(ty.p)?!!o.cgr:typeof (o.gilSel||{})[ty.p.file]==='boolean'?o.gilSel[ty.p.file]:gilDef(ty.m,ty.p.mm)==='gil');
// задание: группы по толщине (5 мм первой), в каждой — типы деталей (номер, контур, кол-во) и штуки для раскладки; key — для кэша.
// over — поменять поля (тесты: {cgr:true}, {edge:0}, {gilSel:{…}}); hasCgr — есть ли колосник мангала (показать галочку).
// Колосник мангала в типах всегда (строка и DXF в таблице), на лист — только с cgr; без cgr у типа offSheet — нет на листе и в «Итого».
// У типа kind — вид детали, если её рубить (partKind: gil — после гильотины готова, zag — заготовка под лазер; list — контура нет, не рубится),
// b — геометрия по заготовке (blankMM, только у zag). Рубим ли — gilOn (галочка «рубим» в «Гильотине»)
function nestJob(over){const o=Object.assign(nestOpts(),over),all=laserParts(),hasCgr=all.some(NEST_CGR),ths=[...new Set(all.map(p=>p.mm))].sort((a,b)=>(b===5)-(a===5)||a-b),groups=[];let no=0;
  ths.forEach(mm=>{const G={mm,types:[],items:[]};
    all.filter(p=>p.mm===mm&&p.q>0).forEach(p=>{let m=null;try{m=partMM(p);}catch(e){}const P=m&&nestLoop(m.loops[0]);if(!P)return;   // пустой или вырожденный контур — пропускаем
      const kind=partKind(m,'gil'),ty={no:++no,p,m,P,q:p.q,kind,b:kind==='zag'?blankMM(p,m):null,offSheet:!o.cgr&&NEST_CGR(p)};G.types.push(ty);
      if(!ty.offSheet)for(let j=0;j<p.q;j++)G.items.push({id:G.items.length,no:ty.no,pts:P,ty});});
    if(G.types.length)groups.push(G);});
  const key=JSON.stringify([o.W,o.H,o.gap,groups.map(G=>[G.mm,G.items.length,G.types.map(ty=>[ty.no,ty.q,ty.offSheet?1:0,ty.P.map(q=>q.map(v=>Math.round(v*10)))])])]);
  return {...o,groups,key,hasCgr};}

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
// лист: рамка и размеры, детали — полный контур с отверстиями (как в DXF), гибы пунктиром, номер; big — широкий экран (шрифт мельче, рисунок крупнее)
function nestSvg(N,G,sh,isOn,big){const W=N.W,H=N.H,fk=big?1:2,fs=Math.round(H*.035*fk),pd=Math.round(fs*1.6),Y=y=>H-y,pt=q=>n1(q[0])+','+n1(Y(q[1]));
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
  return `<svg class="nestsv" viewBox="${-pd} ${-pd} ${W+pd+10} ${H+pd+10}" role="img" aria-label="Лист ${G.mm} мм, ${H} × ${W}, деталей ${sh.items.length}">${g}</svg>`;}
// DXF всего листа: детали стоят как на рисунке (поворот и сдвиг tr), рамка листа — слой SHEET
function nestDxf(N,G,sh){const f=v=>Math.round(v*100)/100,m={sheet:[[0,0],[N.W,0],[N.W,N.H],[0,N.H],[0,0]],loops:[],circles:[],bends:[]};
  sh.items.forEach(it=>{const d=G.items[it.id].ty.m,tr=it.tr,T=q=>[f(tr.c*q[0]-tr.s*q[1]+tr.x),f(tr.s*q[0]+tr.c*q[1]+tr.y)];
    d.loops.forEach(l=>m.loops.push(l.map(T)));d.circles.forEach(([x,y,r])=>m.circles.push([...T([x,y]),r]));d.bends.forEach(b=>m.bends.push(b.map(T)));});
  return dxfText(m);}
const nestFile=(N,G,R,si)=>`list_${G.mm}mm_${N.sk}${R.sheets.length>1?'_'+(si+1):''}.dxf`;
// гильотина (вкладка «Гильотина», #59): что она рубит в этой толщине — детали с галочкой «рубим» (gilOn): gil — готовая, zag — заготовка под лазер
const GIL_KIND={gil:'готовая деталь',zag:'заготовка под лазер'};
const gilRows=(N,G)=>G.types.filter(ty=>gilOn(ty,N)).map(ty=>({no:ty.no,name:ty.p.name,w:ty.m.w,h:ty.m.h,q:ty.q,kind:ty.kind}));
// снятые детали одной строкой — чтобы не забылись: «Не на схеме: Задвижка поддува × 2, Скоба задвижки × 4»; всё рубим — ''
function offList(N,G){const off=G.types.filter(ty=>!gilOn(ty,N));return off.length?'Не на схеме: '+off.map(ty=>ty.p.name+(ty.q>1?` × ${ty.q}`:'')).join(', '):'';}
// CSV для гильотины: UTF-8 с BOM (Excel), разделитель «;»
function gilCsv(N,G){const c=v=>/[;"\r\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
  return '\uFEFF'+[['деталь','заготовка, мм','шт','вид'],...gilRows(N,G).map(o=>[o.no+' '+o.name,`${fmt(o.w,0)} × ${fmt(o.h,0)}`,o.q,GIL_KIND[o.kind]])].map(l=>l.map(c).join(';')).join('\r\n')+'\r\n';}

/* ---------- схема гильотины: прямоугольники заготовок на листе, только сквозные резы ----------
   Гильотина режет от края до края, ширины реза нет — зазор между заготовками 0, от края листа — подрезка кромки (поле, edge).
   Раскладка полосами, 3 стадии: лист поперёк на полосы (1), полоса — на ряды (2), ряд — на заготовки одной высоты, остаток ряда — отход (3).
   Перебор: полосы поперёк или вдоль листа × 4 сортировки × 4 правила поворота на 90°; не влезло на лист — следующий лист.
   Лучший вариант — меньше листов, при равенстве — меньше занятый прямоугольник (сумма по листам). */
const GIL_MIN_W=50;   // мм: деталь, у которой меньшая сторона уже 50, по умолчанию не рубим: узкую полосу 5 мм гильотина ведёт винтом или саблей (задвижки 800 × 30, скобы 12 × 30)
const GIL_MAX_MM=8;   // мм: лист толще по умолчанию не рубим — колосник печи 15 мм гильотина цеха не берёт
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
// заготовки для схемы: каждая штука детали с галочкой «рубим» — габарит детали; снятые на схему не идут, кусков листа под лазер нет
function gilRects(N,G){const r=[];G.types.forEach(ty=>{if(gilOn(ty,N))for(let j=0;j<ty.q;j++)r.push({w:ty.m.w,h:ty.m.h,kind:ty.kind,ty,no:ty.no});});return r;}
const gilScheme=(N,G)=>G.gil||(G.gil=gilPack(gilRects(N,G),N.W,N.H,N.edge));   // G — группа задания: схему считаем один раз
// схема гильотины (SVG, мм): рамка листа, заготовки — серые (готовая деталь) и светло-оранжевые (дальше на лазер), внутри номер и размер; линий лазера нет
function gilSvg(N,G,sh,isOn,big){const W=N.W,H=N.H,fk=big?1:2,fs=Math.round(H*.035*fk),pd=Math.round(fs*1.6),Y=y=>H-y;
  let g=`<rect class="sh" x="0" y="0" width="${W}" height="${H}"/><text class="dim" x="${W/2}" y="${-fs*.5}" font-size="${fs}" text-anchor="middle">${W}</text><text class="dim" transform="translate(${-fs*.5},${H/2}) rotate(-90)" font-size="${fs}" text-anchor="middle">${H}</text>`;
  sh.items.forEach(it=>{const r=it.r,on=isOn(r.ty),sz=`${fmt(r.w,0)} × ${fmt(r.h,0)}`,nm=String(r.no),sn=nm;
    const nt=`${r.no} — ${r.ty.p.name}, ${sz} · ${GIL_KIND[r.kind]}`,cx=it.x+it.w/2,cy=Y(it.y+it.h/2);
    const fz=n1(Math.max(fs*.6,Math.min(fs*1.1,.5*Math.min(it.w,it.h)))),f2=n1(fz*.8),tw=(t,f)=>t.length*f*.62,pad=fz*.4;
    let tx;
    if(it.h>=fz+f2*1.3+2*pad&&it.w>=Math.max(tw(nm,fz),tw(sz,f2))+2*pad)tx=`<text x="${n1(cx)}" y="${n1(cy-f2*.55)}" dy=".36em" font-size="${fz}" text-anchor="middle">${nm}</text><text class="sz" x="${n1(cx)}" y="${n1(cy+fz*.6)}" dy=".36em" font-size="${f2}" text-anchor="middle">${sz}</text>`;
    else{const t=it.w>=tw(nm,fz)+2*pad?nm:sn;tx=`<text x="${n1(cx)}" y="${n1(cy)}" dy=".36em" font-size="${fz}" text-anchor="middle">${t}</text>`;}
    g+=`<g class="gp ${r.kind==='gil'?'gil':'las'}${on?' on':''}"><title>${nt}</title><rect x="${n1(it.x)}" y="${n1(Y(it.y+it.h))}" width="${n1(it.w)}" height="${n1(it.h)}"/>${tx}</g>`;});
  return `<svg class="nestsv gilsv" viewBox="${-pd} ${-pd} ${W+pd+10} ${H+pd+10}" role="img" aria-label="Схема гильотины, лист ${G.mm} мм, ${H} × ${W}, заготовок ${sh.items.length}, резов ${sh.cuts}">${g}</svg>`;}
// DXF схемы гильотины: рамка листа — SHEET, заготовки — BLANK, номер и размер — TEXT (R12 TEXT, латиница: «800x195»); линий CUT нет
function gilDxf(N,G,sh){const f=v=>Math.round(v*100)/100,W=N.W,H=N.H,m={sheet:rect(W,H),blanks:[],texts:[]};
  sh.items.forEach(it=>{const r=it.r,[x0,y0,x1,y1]=[it.x,it.y,it.x+it.w,it.y+it.h].map(f);m.blanks.push([[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]);
    const s1=`${r.no} ${fmt(r.w,0)}x${fmt(r.h,0)}`,s0=String(r.no);
    let s=s1,h=Math.min(40,it.h*.3,it.w/(s1.length*.75));if(h<8){s=s0;h=Math.min(40,it.h*.5,it.w/(s0.length*.75));}
    m.texts.push([f((x0+x1)/2),f((y0+y1)/2),f(Math.max(1,h)),s]);});
  return dxfText(m);}
const gilFile=(N,G,P,si)=>`gilotina_${G.mm}mm_${N.sk}${P.sheets.length>1?'_'+(si+1):''}.dxf`;
// выбрано на модели — строка и деталь на листе подсвечены (у всех трёх вариантов)
const nestSelOn=ty=>!!S.sel.el&&inSel(PDF_ELEM(ty.p.pt),ty.p.pt);
// широкий экран — шрифт на листах мельче, рисунок крупнее; узкий (телефон) — крупнее, иначе номера ~4 px. Вкладка скрыта — по окну
const nestWide=id=>{const box=document.getElementById(id),bw=box&&box.clientWidth||(typeof innerWidth==='number'?innerWidth:0);return !(bw>0&&bw<600);};
// итоги «С листа» для лазерщика по толщинам: рез (мм) и врезки — по деталям, которые легли на лист (снятый колосник и «Не поместилось» не входят),
// листов, заполнение — доля металла деталей в листах
const listTotals=(N,res)=>N.groups.map((G,gi)=>{const R=res[gi]||{sheets:[]},laid=R.sheets.flatMap(s=>s.items),m=it=>G.items[it.id].ty.m;
  return {mm:G.mm,cut:laid.reduce((a,it)=>a+m(it).cut,0),pierce:laid.reduce((a,it)=>a+m(it).pierce,0),sheets:R.sheets.length,fill:R.sheets.length?laid.reduce((a,it)=>a+it.area,0)/(R.sheets.length*N.W*N.H):0};});
const sheetsWord=n=>n%10===1&&n%100!==11?'лист':[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?'листа':'листов';
// вкладка «С листа»: на каждую толщину (5 → 3 → 15 мм) — заголовок, итоги для оценки, кнопки скачивания, лист, под ним детали этого листа;
// № в таблице — тот же, что на листе; выбранное на модели подсвечено
function nestHtml(N,res){const tot=listTotals(N,res),wide=nestWide('nestBox');
  return N.groups.length?N.groups.map((G,gi)=>{const R=res[gi]||{sheets:[],too:[]},main=G.mm===5,ns=R.sheets.length,T=tot[gi];
    let h=`<section class="nblock${main?' main':''}"><h3>Лист ${G.mm} мм</h3>`,bt='';
    h+=`<p class="ntot"><span>Рез <b>${fmt(T.cut/1000,2)} м</b></span><span>Врезки <b>${T.pierce}</b></span><span>Лист <b>${ns} ${sheetsWord(ns)} ${N.H} × ${N.W}</b></span><span>Заполнение <b>${Math.round(T.fill*100)} %</b></span></p>`;
    R.sheets.forEach((sh,si)=>{bt+=`<button class="dxfbtn" data-act="sheet" data-g="${gi}" data-s="${si}">Скачать DXF листа${ns>1?' '+(si+1):''}</button>`;});
    if(bt)h+=`<div class="nbtns">${bt}</div>`;
    R.sheets.forEach((sh,si)=>{h+=`<figure class="nsheet"><figcaption>${ns>1?`Лист ${si+1} из ${ns} · `:''}${N.H} × ${N.W} · деталей ${sh.items.length} · занято ${Math.round(sh.used*100)} % · зазор ${fmt(N.gap,1)} мм, от края ${NEST_EDGE} мм</figcaption>${nestSvg(N,G,sh,nestSelOn,wide)}</figure>`;});
    if(R.too.length){const c={};R.too.forEach(o=>c[o.no]=(c[o.no]||0)+1);
      h+=`<p class="nwarn">Не поместилось: ${Object.keys(c).map(no=>{const ty=G.types.find(t=>t.no===+no);return `${no} ${ty.p.name}${c[no]>1?` × ${c[no]}`:''}`;}).join(', ')}</p>`;}
    let tq=0,t=`<thead><tr><th class="r">№</th><th>Деталь</th><th>Эскиз</th><th class="r">Кол-во</th><th>Габарит, мм</th><th class="r">Рез, м</th><th class="r">Врезок</th><th class="r dl">Скачать</th></tr></thead><tbody>`;
    const btn=ti=>`<button class="dxfbtn dl" data-act="part" data-g="${gi}" data-t="${ti}" title="Скачать DXF детали" aria-label="Скачать DXF детали">⬇︎ DXF</button>`;
    G.types.forEach((ty,ti)=>{const p=ty.p,m=ty.m;if(!ty.offSheet)tq+=ty.q;
      t+=`<tr${nestSelOn(ty)?' class="on"':''}><td class="n r">${ty.no}</td><td>${p.name}${ty.offSheet?'<small>не на листе — в цифры листа не входит</small>':''}${p.note?`<small>${p.note}</small>`:''}<small class="fn">${dxfName(p)}</small></td><td>${dxfSketch(m,'list')}</td><td class="n r">${ty.q}</td><td class="n">${fmt(m.w,1)} × ${fmt(m.h,1)}</td><td class="n r">${fmt(m.cut/1000,2)}</td><td class="n r">${m.pierce}</td><td class="r dl">${btn(ti)}</td></tr>`;});
    t+=`<tr class="tot"><td colspan="5">Итого по листу ${G.mm} мм: ${tq} шт, рез и врезки — с учётом количества</td><td class="n r">${fmt(T.cut/1000,2)}</td><td class="n r">${T.pierce}</td><td class="dl"></td></tr></tbody>`;
    h+=`<div class="tbl"><table class="ntbl">${t}</table></div>`;
    return h+'</section>';}).join(''):'<p class="tabnote">Листовых деталей нет</p>';}
// архивы вариантов «Лазер · DXF»: размеры (жаровня, печь — что есть в режиме), толщины через «-», вариант — mangal_800x420x200_5mm_laser-list.zip
const ZIP_VAR={list:'laser-list',zag:'laser-zagotovki',gil:'gilotina'};
function zipName(v,N){const r=x=>Math.round(x*10),sz=[S.mode!=='stove'&&`${r(L1)}x${r(W)}x${r(H1)}`,S.mode!=='grill'&&`${r(L2)}x${r(WK)}x${r(H2)}`].filter(Boolean);
  return `${MODE_FILE()}_${sz.join('_')}_${(N||nestJob()).groups.map(G=>G.mm).join('-')}mm_${ZIP_VAR[v]}.zip`;}
// архив «С листа» — только файлы лазерщика: DXF каждого листа и каждой детали (снятый колосник — только деталью, как в таблице)
const partFile=ty=>[dxfName(ty.p),dxfText(ty.m)];   // DXF одной детали: [имя, текст]
const listFiles=(N,res)=>N.groups.flatMap((G,gi)=>{const R=res[gi];return [...(R?R.sheets.map((sh,si)=>[nestFile(N,G,R,si),nestDxf(N,G,sh)]):[]),...G.types.map(partFile)];});
// кнопка DXF внутри «С листа» (data-act sheet — лист, part — деталь): [имя, текст] или null
function listOne(N,res,d){const G=N.groups[+d.g],R=res[+d.g];if(!G)return null;
  if(d.act==='sheet'&&R&&R.sheets[+d.s])return [nestFile(N,G,R,+d.s),nestDxf(N,G,R.sheets[+d.s])];
  return d.act==='part'&&G.types[+d.t]?partFile(G.types[+d.t]):null;}

/* ---------- «Гильотина» (#59): схема гильотины по кнопке «Рассчитать», у каждой детали галочка «рубим» ----------
   Снятая деталь просто уходит со схемы и из цифр (кусков листа под лазер нет) и остаётся в строке «Не на схеме». */
// ключ схемы: лист, подрезка, по каждой детали — рубим ли, кол-во, габарит, вид. Ключ другой — схема устарела
const gilKey=N=>JSON.stringify([N.W,N.H,N.edge,N.groups.map(G=>[G.mm,G.types.map(ty=>[ty.no,ty.p.file,ty.q,gilOn(ty,N)?1:0,n1(ty.m.w),n1(ty.m.h),ty.kind])])]);
// итоги для оценки металла и рубки по толщинам: листов, заготовок, резов — по схеме
const gilTotals=(N,res)=>N.groups.map((G,gi)=>{const P=res[gi]||{sheets:[]};
  return {mm:G.mm,sheets:P.sheets.length,blanks:P.sheets.reduce((a,s)=>a+s.items.length,0),cuts:P.sheets.reduce((a,s)=>a+s.cuts,0)};});
// архив гильотинщика: DXF схемы каждого листа и CSV заготовок — по толщинам, где есть что рубить; всё снято — пусто
const gilFiles=(N,res)=>N.groups.flatMap((G,gi)=>{const P=res[gi];if(!gilRows(N,G).length)return [];
  return [...(P?P.sheets.map((sh,si)=>[gilFile(N,G,P,si),gilDxf(N,G,sh)]):[]),[`gilotina_${G.mm}mm.csv`,gilCsv(N,G)]];});
const gilHas=N=>N.groups.some(G=>gilRows(N,G).length);   // есть что рубить — архив можно скачать
// кнопка DXF схемы листа: [имя, текст] или null
function gilOne(N,res,d){const G=N.groups[+d.g],P=res[+d.g],sh=d.act==='gil'&&P&&P.sheets[+d.s];return G&&sh?[gilFile(N,G,P,+d.s),gilDxf(N,G,sh)]:null;}
// вкладка «Гильотина»: на каждую толщину — итоги (лист, заготовки, резы), кнопки DXF схемы, схема, легенда, «Не на схеме», таблица с галочками «рубим».
// Нечего рубить в толщине — «Ничего не рубим», таблица остаётся (галочку можно поставить обратно)
function gilHtml(N,res){const tot=gilTotals(N,res),wide=nestWide('gilBox');
  return N.groups.length?N.groups.map((G,gi)=>{const P=res[gi]||{sheets:[],too:[]},T=tot[gi],np=P.sheets.length,off=offList(N,G);
    let h=`<section class="nblock${G.mm===5?' main':''}"><h3>Лист ${G.mm} мм</h3>`;
    if(!gilRows(N,G).length)h+='<p class="gnone">Ничего не рубим</p>';
    else{h+=`<p class="ntot"><span>Лист <b>${np} ${sheetsWord(np)} ${N.H} × ${N.W}</b></span><span>Заготовки <b>${T.blanks}</b></span><span>Резы <b>${T.cuts}</b></span></p>`;
      if(np)h+=`<div class="nbtns">${P.sheets.map((sh,si)=>`<button class="dxfbtn" data-act="gil" data-g="${gi}" data-s="${si}">Скачать DXF схемы${np>1?' '+(si+1):''}</button>`).join('')}</div>`;
      P.sheets.forEach((sh,si)=>{h+=`<figure class="nsheet"><figcaption>${np>1?`Лист ${si+1} из ${np} · `:''}${N.H} × ${N.W} · резов ${sh.cuts}, заготовок ${sh.items.length} · занято ${Math.round(sh.used*100)} %, отход ${Math.round(sh.waste*100)} % · подрезка кромки ${N.edge} мм</figcaption>${gilSvg(N,G,sh,nestSelOn,wide)}</figure>`;});
      if(np)h+='<p class="glegend"><span><i class="lg gil">▪</i> серый — готовая деталь, лазер не нужен</span><span><i class="lg las">▪</i> оранжевый — заготовка, дальше на лазер</span></p>';
      if(P.too.length){const c={};P.too.forEach(r=>c[r.no]=(c[r.no]||0)+1);
        h+=`<p class="nwarn">Не помещается на лист с подрезкой кромки: ${Object.keys(c).map(no=>{const ty=G.types.find(t=>t.no===+no);return `${no} ${ty.p.name}${c[no]>1?` × ${c[no]}`:''}`;}).join(', ')}</p>`;}}
    if(off)h+=`<p class="goff">${off}</p>`;
    let tq=0,t='<thead><tr><th class="gck">Рубим</th><th class="r">№</th><th>Деталь</th><th>Эскиз</th><th class="r">Кол-во</th><th>Заготовка, мм</th><th>Вид</th></tr></thead><tbody>';
    G.types.forEach((ty,ti)=>{const on=gilOn(ty,N),p=ty.p,m=ty.m,cl=[on?'':'off',nestSelOn(ty)?'on':''].filter(Boolean).join(' ');if(on)tq+=ty.q;
      t+=`<tr${cl?` class="${cl}"`:''}><td class="gck"><input type="checkbox" class="gchk" data-g="${gi}" data-t="${ti}"${on?' checked':''}${ty.kind==='list'?' disabled':''} aria-label="Рубим: ${p.name}"></td>`+
        `<td class="n r">${ty.no}</td><td>${p.name}${NEST_CGR(p)?'<small>та же галочка, что «Колосник на листе»</small>':''}</td><td>${dxfSketch(m,ty.kind,ty.b)}</td>`+
        `<td class="n r">${ty.q}</td><td class="n">${fmt(m.w,0)} × ${fmt(m.h,0)}</td><td>${on?GIL_KIND[ty.kind]:'не рубим'}</td></tr>`;});
    t+=`<tr class="tot"><td colspan="7">На гильотину ${G.mm} мм: ${tq} шт</td></tr></tbody>`;
    return h+`<div class="tbl"><table class="ntbl gtbl">${t}</table></div></section>`;}).join(''):'<p class="tabnote">Листовых деталей нет</p>';}
// галочка «рубим»: колосник мангала — это «Колосник на листе» (поле nCgr, память md-ncgr2), остальные — память md-gilsel2 по имени файла детали
function gilSet(ty,on){if(NEST_CGR(ty.p)){const ci=document.getElementById('nCgr');if(ci)ci.checked=on;store('md-ncgr2',on);}
  else{const m=gilSelStore();m[ty.p.file]=on;store('md-gilsel2',m);}}
// галочку поменяли: схема была — пересчитывается сразу (спека: «схема и цифры пересчитываются сразу»), не было — ждёт «Рассчитать».
// «Из заготовок» с другим набором деталей устаревает, как от любой правки, — до своей «Рассчитать»
function gilChange(e){const c=e.target;if(!c||!c.classList||!c.classList.contains('gchk')||!GIL.cur)return;
  const G=GIL.cur.N.groups[+c.dataset.g],ty=G&&G.types[+c.dataset.t];if(!ty)return;
  const had=GIL.calc().ready();gilSet(ty,c.checked);nestUI(true);if(had){const b=document.getElementById('gilRun');if(b&&!b.disabled)b.click();}}

/* ---------- «Из заготовок» (#60): лазерщику, когда металл уже нарублен ----------
   Детали с галочкой «рубим» в «Гильотине», которым после рубки нужен лазер (вид zag). Готовые после гильотины (gil: прямоугольник
   без отверстий) сюда не идут, снятые — в строке «Не на схеме», как в «Гильотине». Деталь — по заготовке (blankMM): лазер режет только то,
   что не лежит на сторонах заготовки; врезки с запасом — каждый паз с кромки считается врезкой (решение Виталия). */
const zagTypes=(N,G)=>G.types.filter(ty=>ty.kind==='zag'&&gilOn(ty,N));
const zagHas=N=>N.groups.some(G=>zagTypes(N,G).length);   // есть что отдать — архив можно скачать
// ключ: по каждой такой детали — номер, кол-во и её DXF по заготовке. Лист, зазор, подрезка кромки его не меняют
const zagKey=N=>JSON.stringify(N.groups.map(G=>[G.mm,zagTypes(N,G).map(ty=>[ty.no,ty.p.file,ty.q,dxfText(ty.b)])]));
// итоги для оценки по толщинам: рез (мм) и врезки по заготовкам, число заготовок — с учётом кол-ва
const zagTotals=(N,res)=>N.groups.map((G,gi)=>{const T=res[gi]||[];
  return {mm:G.mm,cut:T.reduce((a,ty)=>a+ty.b.cut*ty.q,0),pierce:T.reduce((a,ty)=>a+ty.b.pierce*ty.q,0),blanks:T.reduce((a,ty)=>a+ty.q,0)};});
const zagFile=ty=>[dxfNameZ(ty.p),dxfText(ty.b)];   // DXF по заготовке: CUT — что режет лазер, BLANK — заготовка
const zagFiles=(N,res)=>N.groups.flatMap((G,gi)=>(res[gi]||[]).map(zagFile));   // архив — только _zag.dxf
function zagOne(N,res,d){const ty=d.act==='zag'&&res[+d.g]&&res[+d.g][+d.t];return ty?zagFile(ty):null;}
// вкладка «Из заготовок»: на каждую толщину — итоги (рез, врезки, заготовки), «Не на схеме», таблица с DXF по заготовке;
// рядом с цифрами по заготовке — те же «с листа», для сравнения. Нечего резать в толщине — «Заготовок под лазер нет»
function zagHtml(N,res){const tot=zagTotals(N,res),was=v=>`<small class="was">с листа ${v}</small>`;
  return N.groups.length?N.groups.map((G,gi)=>{const T=res[gi]||[],Z=tot[gi],off=offList(N,G);
    let h=`<section class="nblock${G.mm===5?' main':''}"><h3>Лист ${G.mm} мм</h3>`;
    h+=T.length?`<p class="ntot"><span>Рез <b>${fmt(Z.cut/1000,2)} м</b></span><span>Врезки <b>${Z.pierce}</b></span><span>Заготовки <b>${Z.blanks}</b></span></p>`:'<p class="gnone">Заготовок под лазер нет</p>';
    if(off)h+=`<p class="goff">${off}</p>`;
    if(!T.length)return h+'</section>';
    let t=`<thead><tr><th class="r">№</th><th>Деталь</th><th>Эскиз</th><th class="r">Кол-во</th><th>Заготовка, мм</th><th class="r">Рез, м</th><th class="r">Врезок</th><th class="r dl">Скачать</th></tr></thead><tbody>`;
    T.forEach((ty,ti)=>{const p=ty.p,m=ty.m,b=ty.b;
      t+=`<tr${nestSelOn(ty)?' class="on"':''}><td class="n r">${ty.no}</td><td>${p.name}<small class="fn">${dxfNameZ(p)}</small></td><td>${dxfSketch(m,'zag',b)}</td><td class="n r">${ty.q}</td><td class="n">${fmt(m.w,0)} × ${fmt(m.h,0)}</td>`+
        `<td class="n r">${fmt(b.cut/1000,2)}${was(fmt(m.cut/1000,2))}</td><td class="n r">${b.pierce}${was(m.pierce)}</td>`+
        `<td class="r dl"><button class="dxfbtn dl" data-act="zag" data-g="${gi}" data-t="${ti}" title="Скачать DXF по заготовке" aria-label="Скачать DXF по заготовке">⬇︎ DXF</button></td></tr>`;});
    t+=`<tr class="tot"><td colspan="5">Итого из заготовок ${G.mm} мм: ${Z.blanks} шт, рез и врезки — с учётом количества</td><td class="n r">${fmt(Z.cut/1000,2)}</td><td class="n r">${Z.pierce}</td><td class="dl"></td></tr></tbody>`;
    return h+`<div class="tbl"><table class="ntbl">${t}</table></div></section>`;}).join(''):'<p class="tabnote">Листовых деталей нет</p>';}

// файлы варианта «Лазер · DXF»: list — «С листа», zag — «Из заготовок», gil — «Гильотина»
const VAR_FILES={list:listFiles,zag:zagFiles,gil:gilFiles};
const variantFiles=(N,res,v)=>VAR_FILES[v]?VAR_FILES[v](N,res):[];

/* ---------- когда считать: только по кнопке «Рассчитать» (editor/common/calc.js) ----------
   Результат держится, пока не поменялось задание: любая правка зовёт nestUI, через 0,3 с ключ каждого варианта сравнивается
   с ключом его результата. Другой (размеры, режим, детали, лист, зазор, колосник, галочки «рубим») — результат убран, кнопка снова активна;
   тот же (вращение, размеры на модели, галочки вида, выбор детали) — результат перерисован. */
const NST={t:0,init:false};   // t — задержка сравнения ключей; init — поля и кнопки «Лазер · DXF» уже подключены
const nestCnt=t=>document.querySelectorAll('.nestCnt').forEach(e=>{e.textContent=t;});
// расчёт «С листа» кусками по ~60 мс — страница не замирает: раскладка всех толщин; live() — false, если задание поменялось и расчёт уже не нужен
function nestRun(live,accept,fail){const N=nestJob(),all=N.groups.reduce((a,G)=>a+G.items.length,0),res=[];let gi=0,g=null,n=0;nestCnt('');
  const step=()=>{if(!live())return;const t0=performance.now();
    try{while(gi<N.groups.length){const G=N.groups[gi];if(!g)g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);const v=g.next();
        if(v.done){res.push(v.value);g=null;gi++;}else n=N.groups.slice(0,gi).reduce((a,G)=>a+G.items.length,0)+v.value.done;
        if(performance.now()-t0>60)break;}}
    catch(e){fail();throw e;}   // упало посреди счёта — кнопка не висит на «Считаю…»
    if(gi<N.groups.length){nestCnt(`· ${n} из ${all}`);setTimeout(step,0);return;}
    accept(N,res);};
  setTimeout(step,0);}
// быстрый расчёт («Гильотина», «Из заготовок») — одним шагом, после отрисовки «Считаю…»
const quickCalc=f=>(live,accept,fail)=>setTimeout(()=>{if(!live())return;let N,res;try{N=nestJob();res=f(N);}catch(e){fail();throw e;}accept(N,res);},0);
/* вариант «Лазер · DXF» — одна схема на три (#60): своя кнопка «Рассчитать» и свой ключ задания (key), расчёт (calc), отрисовка (html),
   последний результат (res) и что нарисовано (cur), архив своих файлов (variantFiles) — только когда есть что отдать (has),
   кнопки DXF внутри результата (one: data-атрибуты кнопки → [имя, текст] или null), своя строка «Скачано» (ids.msg). Результат устарел — не качаем */
function nestVariant(v,{ids,key,calc,html,has=()=>true,one}){const $=id=>document.getElementById(id),V={v,key,res:null,cur:null};let btn=null;
  // кнопка «Рассчитать» (makeCalc) — при первом обращении: nest.js грузится и без страницы (тесты раскладки в smoke.js)
  V.calc=()=>btn||(btn=makeCalc({btn:$(ids.run),box:$(ids.box),save:$(ids.save),wait:$(ids.wait),key:()=>key(nestJob()),
    run:(done,live)=>calc(live,(N,res)=>{if(done(html(N,res))){V.res=res;V.cur={N,res};V.state();}},()=>btn.stale())}));   // результат принят — его и качаем
  V.state=()=>{const b=$(ids.save);if(b&&V.cur&&V.calc().ready())b.disabled=!has(V.cur.N);};
  V.draw=(N,res)=>{const b=$(ids.box);if(!b)return;V.cur={N,res};b.innerHTML=html(N,res);V.state();};
  // перед скачиванием ключ сверяется сразу: правка могла быть меньше 0,3 с назад, а старый результат качать нельзя
  V.fresh=()=>{const c=V.calc();c.check();return c.ready()&&!!V.cur;};
  V.saveAll=()=>{if(!V.fresh())return;const {N,res}=V.cur,F=variantFiles(N,res,v);if(F.length)saveOut(zipName(v,N),zipFiles(F),ids.msg);};
  V.click=e=>{const b=e.target.closest&&e.target.closest('button[data-act]');if(!b||!V.cur||!V.fresh())return;const f=one(V.cur.N,V.cur.res,b.dataset);if(f)saveDxf(f[0],f[1],ids.msg);};
  V.init=()=>{const b=$(ids.box),a=$(ids.save);if(b)b.addEventListener('click',V.click);if(a)a.addEventListener('click',V.saveAll);};
  return V;}
const LIST=nestVariant('list',{ids:{box:'nestBox',run:'nestRun',save:'dxfAll',wait:'nestWait',msg:'dxfMsg'},key:N=>N.key,calc:nestRun,html:nestHtml,one:listOne});
const ZAG=nestVariant('zag',{ids:{box:'zagBox',run:'zagRun',save:'zagAll',wait:'zagWait',msg:'zagMsg'},key:zagKey,calc:quickCalc(N=>N.groups.map(G=>zagTypes(N,G))),html:zagHtml,has:zagHas,one:zagOne});
const GIL=nestVariant('gil',{ids:{box:'gilBox',run:'gilRun',save:'gilAll',wait:'gilWait',msg:'gilMsg'},key:gilKey,calc:quickCalc(N=>N.groups.map(G=>gilScheme(N,G))),html:gilHtml,has:gilHas,one:gilOne});
const VARS=[LIST,ZAG,GIL];
// поля «Лист», «Между деталями» и галочка колосника: значения из памяти браузера (store — в ui.js, к первому показу вкладки он уже есть)
// и «Подрезка кромки» гильотины (md-nedge); кнопки вариантов и галочки «рубим»
function nestInit(){if(NST.init)return;NST.init=true;const gi=document.getElementById('nGap'),si=document.getElementById('nSheet'),ei=document.getElementById('nEdge');if(!gi||!si)return;
  const g=store('md-ngap'),s=store('md-sheet'),c=store('md-ncgr2'),ed=store('md-nedge'),ci=document.getElementById('nCgr');if(Number.isFinite(+g)&&g!==null)gi.value=g;if(s&&NEST_SHEETS[s])si.value=s;if(ci&&typeof c==='boolean')ci.checked=c;
  if(ei&&Number.isFinite(+ed)&&ed!==null)ei.value=ed;
  const ch=()=>{const o=nestOpts();store('md-ngap',o.gap);store('md-sheet',o.sk);store('md-ncgr2',o.cgr);store('md-nedge',o.edge);nestUI();};
  gi.addEventListener('input',ch);gi.addEventListener('change',()=>{gi.value=nestOpts().gap;ch();});si.addEventListener('change',ch);if(ci)ci.addEventListener('change',ch);
  if(ei){ei.addEventListener('input',ch);ei.addEventListener('change',()=>{ei.value=nestOpts().edge;ch();});}
  VARS.forEach(V=>V.init());const gb=document.getElementById('gilBox');if(gb)gb.addEventListener('change',gilChange);}
// любая правка (build3D, drawCut, поля и галочки «Лазер · DXF») и показ вкладки; сам ничего не считает. У каждого варианта свой ключ
function nestUI(now){clearTimeout(NST.t);if(!now){NST.t=setTimeout(()=>nestUI(true),300);return;}
  const pane=document.getElementById('tab-cut'),vis=!!pane&&pane.hidden===false;
  if(vis)nestInit();   // до nestJob: задание — по полям со значениями из памяти браузера
  if(!vis&&!VARS.some(V=>V.calc().held()))return;   // вкладка закрыта, результатов нет — сравнивать нечего (nestJob считает контуры всех деталей)
  const N=nestJob();VARS.forEach(V=>V.calc().check(V.key(N)));   // от правки поменялся бы результат — он убран, «Рассчитать» снова активна
  if(!vis)return;
  const cb=document.getElementById('nCgrBox');if(cb)cb.hidden=!N.hasCgr;   // галочка колосника — только когда он есть (мангал, «Колосниковая решётка»)
  VARS.forEach(V=>{if(V.calc().ready())V.draw(N,V.res);});}   // тот же результат — перерисовать: выбор на модели, отверстия, единицы
