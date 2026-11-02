/* ---------- Производство: контур реза под толщину и шов, раскладка на лист, DXF ----------
   Деталь лежит лицом на поверхности фигуры, рез перпендикулярный.
   Выпуклый шов (угол между листами θ < 180°): сторона уходит внутрь на gap/2 + t/tan(θ/2) — внутренние кромки сходятся,
   снаружи остаётся V-канавка под сварку. Вогнутый — на gap/2. Открытый край — на месте. */

// вид сварки: TIG (аргон) — встык с зазором 0,5 мм; полуавтомат — 1 мм, тонкий лист (до 1,5 мм) — 0,5
const WELDN={tig:'TIG (аргон)',mig:'полуавтомат (MIG/MAG)'},WELDS={tig:'TIG',mig:'полуавтомат'};
const weldOf=()=>ST.weld==='mig'?'mig':'tig',weldGap=(w,t)=>w==='mig'&&t>1.5?1:0.5;
// сменили толщину t0 → t1: стоял рекомендуемый зазор — новый рекомендуемый, свой — не трогаем
const mmT=g=>String(+g).replace('.',',');   // зазор словами: 0,5 · 1 · 1,25
const gapAfterT=(gap,w,t0,t1)=>gap===weldGap(w,t0)?weldGap(w,t1):gap;
// зазор между деталями на листе — под ширину реза: лазер 5 мм, плазма 7 (рез шире, кромка греется); сменили резку — рекомендуемый, свой (меняли руками) — не трогаем
const nestGap=c=>c==='plasma'?7:5,ngapAfterCut=(gap,own,c)=>own?gap:nestGap(c);
function edgeSetback(g,t,gap,useT){if(g.nb<0)return 0;let s=gap/2;if(useT&&g.dih<179.5)s+=Math.min(2*t,t/Math.tan(g.dih*Math.PI/360));return s;}   // на острых углах — не больше 2t, остальное заберёт шов
const area2=P=>{let a=0;P.forEach((p,i)=>{const q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];});return a/2;};
// контур реза детали p в тех же координатах, что p.pts; bad — деталь выродилась
function cutContour(p,t,gap,useT){const P=p.pts,n=P.length;if(n<3)return {pts:[],bad:true,s:[]};const ccw=area2(P)>0?1:-1;
  const s=p.segs.map(g=>edgeSetback(g,t,gap,useT));
  const L=P.map((a,i)=>{const b=P[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*ccw,ny=dx/l*ccw;return {p:[a[0]+nx*s[i],a[1]+ny*s[i]],d:[dx/l,dy/l]};});
  const r=meetLines(L,ccw);if(r.bad)return {pts:r.pts,bad:true,s};const u=untwist(r.pts,ccw);return {pts:u.pts,bad:u.bad,s};}
// узкий шип при сдвиге кромок выворачивается петлёй: несоседние стороны перекрещиваются («бантик»). Режем контур в точке пересечения на две петли,
// вывернутую (обход в другую сторону, снаружи детали) выбрасываем. Обе петли нормальные — деталь распалась на две: bad
function untwist(Q,ccw){for(let it=0;it<20;it++){const n=Q.length;let hit=null;
    for(let i=0;i<n&&!hit;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(segX(Q[i],Q[(i+1)%n],Q[j],Q[(j+1)%n])){hit=[i,j];break;}}
    if(!hit)return {pts:Q,bad:Q.length<3};
    const [i,j]=hit,a=Q[i],b=Q[i+1],c=Q[j],d=Q[(j+1)%n],ab=[b[0]-a[0],b[1]-a[1]],cd=[d[0]-c[0],d[1]-c[1]],k=((c[0]-a[0])*cd[1]-(c[1]-a[1])*cd[0])/(ab[0]*cd[1]-ab[1]*cd[0]),X=[a[0]+ab[0]*k,a[1]+ab[1]*k];
    const A=[X,...Q.slice(i+1,j+1)],B=[X,...Q.slice(j+1),...Q.slice(0,i+1)],sa=area2(A)*ccw,sb=area2(B)*ccw;
    if(sa>0&&sb>0)return {pts:sa>sb?A:B,bad:true};Q=sa>sb?A:B;}
  return {pts:Q,bad:true};}
// стороны-прямые {p, d}, уже сдвинутые внутрь → многоугольник: соседние пересекаем.
// Короткая сторона между острыми углами при сдвиге выворачивается — её убираем, соседи сходятся. eps — какую длину стороны ещё считать нормальной.
// bevel: у вогнутого угла, где продолжения сторон сходятся дальше 2s от вершины (острая выемка), — срез: две точки напротив вершины (нужен s — сдвиг стороны)
function meetLines(L,ccw,eps=0,bevel=false){const X=(pr,cur)=>{const den=pr.d[0]*cur.d[1]-pr.d[1]*cur.d[0];if(Math.abs(den)<1e-9)return null;const w=[cur.p[0]-pr.p[0],cur.p[1]-pr.p[1]],k=(w[0]*cur.d[1]-w[1]*cur.d[0])/den;return [pr.p[0]+pr.d[0]*k,pr.p[1]+pr.d[1]*k];};
  const nr=l=>[-l.d[1]*ccw,l.d[0]*ccw],raw=l=>{const s=l.s||0,n=nr(l);return {p:[l.p[0]-n[0]*s,l.p[1]-n[1]*s],d:l.d};};
  // стык соседних сторон: a — конец предыдущей, b — начало текущей (у острия — одна точка)
  const join=(pr,cur)=>{const M=X(pr,cur)||cur.p.slice();if(bevel&&(pr.d[0]*cur.d[1]-pr.d[1]*cur.d[0])*ccw<0){const O=X(raw(pr),raw(cur));
      if(O&&Math.hypot(M[0]-O[0],M[1]-O[1])>2*Math.max(pr.s||0,cur.s||0)+.01){const n1=nr(pr),n2=nr(cur);return {a:[O[0]+n1[0]*(pr.s||0),O[1]+n1[1]*(pr.s||0)],b:[O[0]+n2[0]*(cur.s||0),O[1]+n2[1]*(cur.s||0)]};}}
    return {a:M,b:M};};
  const act=L.map((_,i)=>i);let G;
  for(;;){const m=act.length;G=act.map((ci,k)=>join(L[act[(k+m-1)%m]],L[ci]));
    let worst=-1,wv=0;act.forEach((ci,k)=>{const a=G[k].b,b=G[(k+1)%m].a,v=(b[0]-a[0])*L[ci].d[0]+(b[1]-a[1])*L[ci].d[1];if(v<wv){wv=v;worst=k;}});
    if(worst<0||m<=3)break;act.splice(worst,1);}
  const Q=G.flatMap(g=>g.a===g.b?[g.a]:[g.a,g.b]);
  // выродилась: сторона всё равно перевернулась или площадь ≤ 0
  let bad=act.length<3||area2(Q)*ccw<=1;act.forEach((ci,k)=>{const a=G[k].b,b=G[(k+1)%act.length].a;if((b[0]-a[0])*L[ci].d[0]+(b[1]-a[1])*L[ci].d[1]<=eps)bad=true;});
  return {pts:Q,bad,act};}

/* ---------- подложка за прорезью (глаз): открытая петля не у стены → плоская деталь ----------
   Контур — выпуклая оболочка прорези + нахлёст BACK_LAP; приваривается изнутри по краю прорези, утоплена на BACK_DEPTH */
const BACK_LAP=8,BACK_DEPTH=8;
function openLoops(V,F){const E=new Set();F.forEach(f=>{for(let k=0;k<3;k++)E.add(f[k]+'_'+f[(k+1)%3]);});const nx=new Map();F.forEach(f=>{for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3];if(!E.has(b+'_'+a))nx.set(a,b);}});
  const used=new Set(),L=[];nx.forEach((_,s)=>{if(used.has(s))return;const Q=[];let v=s;while(v!==undefined&&!used.has(v)){used.add(v);Q.push(v);v=nx.get(v);}if(Q.length>=3)L.push(Q);});return L;}
// выпуклый многоугольник шире на d (стороны сдвинуты наружу)
function growConvex(P,d){const n=P.length,ccw=area2(P)>0?1:-1,L=P.map((a,i)=>{const b=P[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return {p:[a[0]+dy/l*ccw*d,a[1]-dx/l*ccw*d],d:[dx/l,dy/l]};});
  return L.map((cur,i)=>{const pr=L[(i+n-1)%n],den=pr.d[0]*cur.d[1]-pr.d[1]*cur.d[0];if(Math.abs(den)<1e-9)return cur.p.slice();const w=[cur.p[0]-pr.p[0],cur.p[1]-pr.p[1]],k=(w[0]*cur.d[1]-w[1]*cur.d[0])/den;return [pr.p[0]+pr.d[0]*k,pr.p[1]+pr.d[1]*k];});}
// добавить подложки в R.parts; вернуть длину их швов (по краю прорези)
/* ---------- зеркальные пары под одним номером: «7» — левая сторона (смотрим спереди), «7.1» — её зеркальная справа ----------
   Номер остаётся числом (7.1): сортировка и «собрано раньше» работают как были. Деталь на середине и без пары — просто номер */
// зеркальная деталь для каждой: id пары, сама себе (на середине) или −1
function partTwins(R,V){const mm=mirrorMap(V),key=Q=>Q.slice().sort((a,b)=>a-b).join(),K=new Map(R.parts.map(p=>[key(p.full),p.id]));
  return R.parts.map(p=>{if(!p.full.length||p.full.some(i=>mm[i]===-1))return -1;const q=K.get(key(p.full.map(i=>mm[i]===-2?i:mm[i])));return q===undefined?-1:q;});}
function pairNumbers(R,V){const tw=partTwins(R,V),seen=new Set();let n=0;
  [...R.parts].sort((a,b)=>a.no-b.no).forEach(p=>{if(seen.has(p.id))return;seen.add(p.id);n++;const q=tw[p.id];
    if(q>=0&&q!==p.id&&!seen.has(q)){seen.add(q);const Q=R.parts[q],L=p.c[0]<=Q.c[0]?p:Q,Rt=L===p?Q:p;L.no=n;Rt.no=n+.1;L.twin=Rt.id;Rt.twin=L.id;}else p.no=n;});
  return tw;}
/* зеркальная пара — одни и те же числа. Модель симметрична до десятых мм, и у X и X.1 расходится последняя цифра (V166 / V167, 186 × 80 / 81, 95° / 96°);
   сварщику — «гнуть одинаково»: в таблицах, картах, чертежах и подписях DXF у пары числа основной детали (без «.1»). Контур реза, линии и раскрой у каждой свои */
const twinIx=(R,i)=>R.parts[i].twin??i,mainPart=(R,p)=>p.twin!=null&&p.no%1?R.parts[p.twin]:p;
// угол шва a–b для подписи: у зеркального шва — один на двоих, берём шов с меньшими номерами (3.1–8.1 — как у 3–8). Грани плоские — угол по шву один
function seamDih(R,a,b){if(!R._sd){R._sd=new Map();R.edges.forEach(e=>{if(e.p.length===2&&!R._sd.has(bendKey(e.p[0],e.p[1])))R._sd.set(bendKey(e.p[0],e.p[1]),e.dih);});}
  const own=R._sd.get(bendKey(a,b)),a2=twinIx(R,a),b2=twinIx(R,b),mr=R._sd.get(bendKey(a2,b2));if(mr===undefined)return own;
  const no=i=>R.parts[i].no,s=no(a)+no(b),s2=no(a2)+no(b2);return s2<s-1e-6||Math.abs(s2-s)<1e-6&&Math.min(no(a2),no(b2))<Math.min(no(a),no(b))-1e-6?mr:own;}
// соседи детали по швам → [{nb, len, dih}] по номеру соседа. По рёбрам, а не по сторонам p.segs: прямой участок вдоль двух соседей там одна сторона, и второй сосед пропадал (23 / 23.1 у Д10).
// У X.1 — список X, соседи — их пары (если соседи у пары и правда те же): длины и углы одни
function partNbs(R,pi){const C=R._nb||(R._nb=[]);if(C[pi])return C[pi];const p=R.parts[pi],m=new Map();
  R.edges.forEach(e=>{if(e.p.length!==2||e.p[0]!==pi&&e.p[1]!==pi)return;const nb=e.p[0]===pi?e.p[1]:e.p[0];m.set(nb,(m.get(nb)||0)+e.len);});
  let L=[...m].map(([nb,len])=>({nb,len,dih:seamDih(R,pi,nb)}));const q=mainPart(R,p);
  if(q!==p){const M=partNbs(R,q.id).map(x=>({nb:twinIx(R,x.nb),len:x.len,dih:x.dih})),k=A=>A.map(x=>x.nb).sort((a,b)=>a-b).join();if(k(M)===k(L))L=M.slice();}
  return C[pi]=L.sort((x,y)=>R.parts[x.nb].no-R.parts[y.nb].no);}
// keep — фигура сама выбирает дыры под подложку: keep([x,y,z]) — центр дыры в долях габарита модели (0…1); без keep — у всех
function addBacking(R,M3,keep){const {V,F}=M3;if(!V.length)return 0;const ctr=V3.mul(V.reduce((s,p)=>V3.add(s,p),[0,0,0]),1/V.length),bx=meshBox(V);let wl=0;
  openLoops(V,F).forEach(Q=>{if(Q.every(i=>Math.abs(V[i][2])<1))return;   // край у стены — не прорезь
    let n=[0,0,0];Q.forEach((i,j)=>{const a=V[i],b=V[Q[(j+1)%Q.length]];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);});n=V3.norm(n);
    const c=V3.mul(Q.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/Q.length);if(keep&&!keep(c.map((x,k)=>(x-bx.min[k])/(bx.size[k]||1))))return;if(V3.dot(n,V3.sub(c,ctr))<0)n=V3.mul(n,-1);
    let u=V3.sub(V[Q[0]],c);u=V3.norm(V3.sub(u,V3.mul(n,V3.dot(u,n))));const w=V3.cross(n,u);
    const G=growConvex(convexHull(Q.map(i=>{const d=V3.sub(V[i],c);return [V3.dot(d,u),V3.dot(d,w)];})),BACK_LAP);
    // как у flatten: узкая сторона — по Y, от нуля
    let bw=Infinity,ba=0;G.forEach((p,i)=>{const q=G[(i+1)%G.length],a=Math.atan2(q[1]-p[1],q[0]-p[0]),cs=Math.cos(a),sn=Math.sin(a);let mn=1e9,mx=-1e9;G.forEach(h=>{const y=-sn*h[0]+cs*h[1];mn=Math.min(mn,y);mx=Math.max(mx,y);});if(mx-mn<bw){bw=mx-mn;ba=a;}});
    const cs=Math.cos(-ba),sn=Math.sin(-ba);let pts=G.map(p=>[cs*p[0]-sn*p[1],sn*p[0]+cs*p[1]]);const mnx=Math.min(...pts.map(p=>p[0])),mny=Math.min(...pts.map(p=>p[1]));pts=pts.map(p=>[p[0]-mnx,p[1]-mny]);
    const segs=pts.map((p,i)=>({len:Math.hypot(pts[(i+1)%pts.length][0]-p[0],pts[(i+1)%pts.length][1]-p[1]),nb:-1}));
    Q.forEach((i,j)=>{wl+=V3.len(V3.sub(V[Q[(j+1)%Q.length]],V[i]));});
    R.parts.push({id:R.parts.length,no:R.parts.length+1,back:true,tris:[],n,c,area:Math.abs(area2(pts)),loop:[],full:Q.slice(),holes:0,adj:[],pts,segs,L:Math.max(...pts.map(p=>p[0])),W:Math.max(...pts.map(p=>p[1])),minW:bw,perim:segs.reduce((a,g)=>a+g.len,0)});});
  return wl;}

// ---------- раскладка по форме ----------
// Лист — сетка клеток cell мм. Каждая деталь пробуется во всех положениях «сторона вдоль листа» (и перевёрнутой);
// ставим туда, где правый край раскладки получается ближе всего к началу листа — детали заполняют пустоты между собой.
// Занятость — клетки, которых касается деталь; проверка — та же деталь, расширенная на зазор. W — длинная сторона листа.
function ptSegD(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function inPoly(p,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function segX(a,b,c,d){const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;}
function polyGap(A,B){let d=Infinity;for(let i=0;i<A.length;i++){const a=A[i],a2=A[(i+1)%A.length];for(let j=0;j<B.length;j++){const b=B[j],b2=B[(j+1)%B.length];if(segX(a,a2,b,b2))return 0;d=Math.min(d,ptSegD(a,b,b2),ptSegD(b,a,a2));}}if(inPoly(A[0],B)||inPoly(B[0],A))return 0;return d;}
function polyDist(P){return p=>{let d=Infinity;P.forEach((a,i)=>{d=Math.min(d,ptSegD(p,a,P[(i+1)%P.length]));});return d;};}
function nestOrient(P,cell,r,flips=[false,true]){const out=[],seen=new Set();
  flips.forEach(flip=>{const Q0=flip?P.map(p=>[-p[0],p[1]]):P;Q0.forEach((a,i)=>{const b=Q0[(i+1)%Q0.length];[0,Math.PI].forEach(add=>{
    const ang=-Math.atan2(b[1]-a[1],b[0]-a[0])+add,c=Math.cos(ang),s=Math.sin(ang);let Q=Q0.map(p=>[c*p[0]-s*p[1],s*p[0]+c*p[1]]);
    const mx=Math.min(...Q.map(q=>q[0])),my=Math.min(...Q.map(q=>q[1]));Q=Q.map(q=>[q[0]-mx,q[1]-my]);
    const key=Q.map(q=>Math.round(q[0])+','+Math.round(q[1])).sort().join(';');if(seen.has(key))return;seen.add(key);
    // клетки, чьи центры внутри детали, раздутой на ползазора (r — ползазора, мм); точный зазор проверяется отдельно
    const o=Math.ceil(r/cell)+1,w=Math.ceil(Math.max(...Q.map(q=>q[0]))/cell)+2*o+1,h=Math.ceil(Math.max(...Q.map(q=>q[1]))/cell)+2*o+1,core=new Uint8Array(w*h),dist=polyDist(Q);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=[(x-o+.5)*cell,(y-o+.5)*cell];if(inPoly(p,Q)||dist(p)<=r)core[y*w+x]=1;}
    const rows=m=>{const R=[];for(let y=0;y<h;y++){let x=0;const iv=[];while(x<w){if(m[y*w+x]){const s0=x;while(x<w&&m[y*w+x])x++;iv.push([s0,x-1]);}else x++;}R.push(iv);}return R;};
    const cr=rows(core);out.push({Q,w,h,o,core:cr,dil:cr,flip,tr:{f:flip,c,s,x:-mx,y:-my}});});});});
  return out;}
function nest(...a){const g=nestGen(...a);let v;do{v=g.next();}while(!v.done);return v.value;}
// innerUp: деталь кладём зеркально — внутренней стороной вверх, гравировка номера уйдёт внутрь фигуры (лазер гравирует верх листа).
// Развёртка p.pts смотрит наружной стороной на нас (нормаль к зрителю), поэтому «внутрь вверх» = только зеркальные положения.
function* nestGen(items,W,H,gap,margin,cell=2.5,mode=2,innerUp=false){const r=gap/2,GW=Math.floor((W-2*margin)/cell),GH=Math.floor((H-2*margin)/cell);
  const it=items.map(o=>({id:o.id,no:o.no,area:Math.abs(area2(o.pts)),or:nestOrient(o.pts,cell,r,innerUp?[true]:[false,true])})).sort((a,b)=>mode===2?Math.max(...b.or.map(o=>o.w))-Math.max(...a.or.map(o=>o.w)):b.area-a.area);
  const sheets=[],too=[];
  const newSheet=()=>{const sh={items:[],occ:new Uint8Array(GW*GH),pre:new Int32Array((GW+1)*GH),len:0};sheets.push(sh);return sh;};
  const free=(sh,R,x,y)=>{for(let ry=0;ry<R.length;ry++){const iv=R[ry];if(!iv.length)continue;const base=(y+ry)*(GW+1);for(const [a,b] of iv)if(sh.pre[base+x+b+1]-sh.pre[base+x+a])return false;}return true;};
  const gapOK=(sh,o,x,y)=>{const ox=margin+(x+o.o)*cell,oy=margin+(y+o.o)*cell,P=o.Q.map(q=>[q[0]+ox,q[1]+oy]),bx=[Math.min(...P.map(p=>p[0]))-gap,Math.min(...P.map(p=>p[1]))-gap,Math.max(...P.map(p=>p[0]))+gap,Math.max(...P.map(p=>p[1]))+gap];
    if(bx[0]<margin-.01||bx[1]<margin-.01||bx[2]>W-margin+gap+.01||bx[3]>H-margin+gap+.01)return false;
    for(const it of sh.items){const b=it.bb;if(b[0]>bx[2]||b[2]<bx[0]||b[1]>bx[3]||b[3]<bx[1])continue;if(polyGap(P,it.pts)<gap)return false;}return true;};
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

/* ---------- DXF (R12, ASCII): контур — POLYLINE, гравировка и сгибы — LINE, TEXT — номера ---------- */
// слои объявлены в таблице LAYER (с цветом, линия сплошная): без таблицы CAD создаёт их сам, но программа станка может не показать список слоев
const DXF_LAY={CUT:7,SHEET:8};
function dxfDoc(ents){const L=['0'];for(let i=0;i<ents.length;i+=2)if(ents[i]==='8'&&!L.includes(ents[i+1]))L.push(ents[i+1]);
  const tab=['0','SECTION','2','TABLES','0','TABLE','2','LTYPE','70',1,'0','LTYPE','2','CONTINUOUS','70',0,'3','Solid line','72',65,'73',0,'40',0,'0','ENDTAB',
    '0','TABLE','2','LAYER','70',L.length,...L.flatMap(n=>['0','LAYER','2',n,'70',0,'62',DXF_COL[n]||DXF_LAY[n]||7,'6','CONTINUOUS']),'0','ENDTAB','0','ENDSEC'];
  return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70',4,'0','ENDSEC',...tab,'0','SECTION','2','ENTITIES',...ents,'0','ENDSEC','0','EOF'].join('\r\n')+'\r\n';}
const dn=v=>Math.round(v*100)/100;
// контур — одна замкнутая полилиния (R12 POLYLINE, флаг 70 = 1): цеха просят контур целиком, а не россыпь отрезков
function dxfPoly(e,P,lay,ox=0,oy=0){e.push('0','POLYLINE','8',lay,'66',1,'10',0,'20',0,'30',0,'70',1);P.forEach(a=>e.push('0','VERTEX','8',lay,'10',dn(a[0]+ox),'20',dn(a[1]+oy),'30',0));e.push('0','SEQEND','8',lay);}
function dxfTxt(e,x,y,h,t,lay='MARK'){e.push('0','TEXT','8',lay,'10',dn(x),'20',dn(y),'30',0,'40',dn(h),'1',t,'72',1,'73',2,'11',dn(x),'21',dn(y),'31',0);}
// номер в центре и номера соседей у сторон — для разметки
function dxfMarks(e,o,pts,ox,oy,segNb){const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),m=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  dxfTxt(e,cx+ox,cy+oy,Math.max(4,Math.min(20,m*.25)),String(o.no));
  if(segNb)pts.forEach((a,i)=>{const nb=segNb[i];if(nb==null)return;const b=pts[(i+1)%pts.length],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=cx-mx,dy=cy-my,l=Math.hypot(dx,dy)||1,k=Math.min(8,l*.35);
    dxfTxt(e,mx+dx/l*k+ox,my+dy/l*k+oy,Math.max(2.5,Math.min(6,m*.08)),String(nb));});}

/* ---------- гравировка номера: цифры из линий (как на табло), лазер проходит их на малой мощности ----------
   Цифра — клетка 1×2 (y вверх, как в DXF), между цифрами 0,5. «9» без нижней палочки — перевёрнутая она не похожа на «6» (у «6» есть верх). */
const DIGITS={0:[[[0,0],[1,0],[1,2],[0,2],[0,0]]],1:[[[.5,0],[.5,2],[.2,1.7]],[[.2,0],[.8,0]]],2:[[[0,2],[1,2],[1,1],[0,1],[0,0],[1,0]]],3:[[[0,2],[1,2],[1,0],[0,0]],[[0,1],[1,1]]],
  4:[[[0,2],[0,1],[1,1]],[[1,2],[1,0]]],5:[[[1,2],[0,2],[0,1],[1,1],[1,0],[0,0]]],6:[[[1,2],[0,2],[0,0],[1,0],[1,1],[0,1]]],7:[[[0,2],[1,2],[1,0]]],
  8:[[[0,0],[1,0],[1,2],[0,2],[0,0]],[[0,1],[1,1]]],9:[[[1,1],[0,1],[0,2],[1,2],[1,0]]],
  'У':[[[0,2],[.5,1]],[[1,2],[.3,0]]],'°':[[[.2,2],[.8,2],[.8,1.4],[.2,1.4],[.2,2]]],   // У152° — уголок-шаблон
  V:[[[0,2],[.5,0],[1,2]]],'.':[[[.35,0],[.65,0],[.65,.3],[.35,.3],[.35,0]]],   // 7.1 — зеркальная пара
  m:[[[0,0],[0,1.2]],[[0,.9],[.25,1.2],[.5,.9],[.5,0]],[[.5,.9],[.75,1.2],[1,.9],[1,0]]],'(':[[[.7,2],[.35,1.4],[.35,.6],[.7,0]]],')':[[[.3,2],[.65,1.4],[.65,.6],[.3,0]]]};   // V144 (2) — сгиб
// самое просторное место внутри детали: точка, дальше всего от кромок (перебор по сетке + уточнение).
// C — второй контур (контур реза заготовки): место внутри обоих, даль — от кромок обоих
function innerPoint(P,C){const dP=polyDist(P),dC=C&&polyDist(C),d=dC?p=>Math.min(dP(p),dC(p)):dP,inP=dC?p=>inPoly(p,P)&&inPoly(p,C):p=>inPoly(p,P),xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);let best=null,bd=-1,step=Math.max(x1-x0,y1-y0)/24;
  for(let x=x0+step/2;x<x1;x+=step)for(let y=y0+step/2;y<y1;y+=step){const p=[x,y];if(!inP(p))continue;const v=d(p);if(v>bd){bd=v;best=p;}}
  if(!best)return null;for(let k=0;k<3;k++){step/=3;const c=best;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const p=[c[0]+i*step,c[1]+j*step];if(!inP(p))continue;const v=d(p);if(v>bd){bd=v;best=p;}}}
  return {p:best,r:bd};}
// точка для номера детали в 3D: самое просторное место на её грани (как у гравировки), а не среднее углов p.c — у вогнутой детали оно за контуром.
// внутри — по треугольникам детали (дырки глаз не в счёт), даль — от кромок, включая края дырок; подложка (p.back) выпуклая — p.c. Кэш на детали
function partLabelPt(p,M3){if(p._lp&&p._lpV===M3.V)return p._lp;const {V,F}=M3;p._lpV=V;if(p.back||!p.tris||!p.tris.length)return p._lp=p.c;
  const n=p.n;let u=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(n,V3.dot(u,n))));const w=V3.cross(n,u),pr=i=>[V3.dot(V[i],u),V3.dot(V[i],w)];
  const T=p.tris.map(fi=>F[fi].map(pr)),ec=new Map();p.tris.forEach(fi=>{const f=F[fi];for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=a<b?a+'_'+b:b+'_'+a;ec.set(key,(ec.get(key)||0)+1);}});
  const S=[...ec].filter(([,c])=>c===1).map(([k])=>k.split('_').map(Number).map(pr)),inT=q=>T.some(([a,b,c])=>{const d1=(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),d2=(c[0]-b[0])*(q[1]-b[1])-(c[1]-b[1])*(q[0]-b[0]),d3=(a[0]-c[0])*(q[1]-c[1])-(a[1]-c[1])*(q[0]-c[0]);return (d1>=0&&d2>=0&&d3>=0)||(d1<=0&&d2<=0&&d3<=0);});
  const d=q=>S.reduce((m,[a,b])=>Math.min(m,ptSegD(q,a,b)),Infinity),xs=T.flat().map(q=>q[0]),ys=T.flat().map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  let best=null,bd=-1,step=Math.max(x1-x0,y1-y0)/24;for(let x=x0+step/2;x<x1;x+=step)for(let y=y0+step/2;y<y1;y+=step){const q=[x,y];if(!inT(q))continue;const v=d(q);if(v>bd){bd=v;best=q;}}
  if(!best)return p._lp=p.c;for(let k=0;k<3;k++){step/=3;const c=best;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const q=[c[0]+i*step,c[1]+j*step];if(!inT(q))continue;const v=d(q);if(v>bd){bd=v;best=q;}}}
  const h=p.full.reduce((s2,i)=>s2+V3.dot(V[i],n),0)/(p.full.length||1);return p._lp=V3.add(V3.add(V3.mul(u,best[0]),V3.mul(w,best[1])),V3.mul(n,h));}
// точка q (в плоскости детали) на самой детали — по её треугольникам; m — запас от кромки: 8 точек на круге радиуса m тоже на детали
function partHasPt(p,M3,q,m=0){if(!p.tris||!p.tris.length)return true;const {V,F}=M3,n=p.n,on=z=>p.tris.some(fi=>{const [a,b,c]=F[fi].map(i=>V[i]),s=(x,y)=>V3.dot(V3.cross(V3.sub(y,x),V3.sub(z,x)),n);return s(a,b)>=-1e-6&&s(b,c)>=-1e-6&&s(c,a)>=-1e-6;});
  if(!on(q))return false;if(!m)return true;const d=V3.norm(V3.cross(n,Math.abs(n[0])<.9?[1,0,0]:[0,1,0])),e=V3.cross(n,d);return [0,1,2,3,4,5,6,7].every(k=>on(V3.add(q,V3.add(V3.mul(d,m*Math.cos(k*Math.PI/4)),V3.mul(e,m*Math.sin(k*Math.PI/4))))));}
// отрезки гравировки номера внутри детали P (координаты те же, y вверх); null — деталь слишком узкая (меньше 3 мм высоты цифр).
// o.clip — контур, за который тоже нельзя (у заготовки: деталь P — грань модели, её край у шва срезан зазором под сварку)
function engraveSegs(no,P,o={}){const ip=innerPoint(P,o.clip);if(!ip)return null;const t=String(no),n=t.length,uw=n*1.5-.5,uh=2,  // ширина/высота блока в единицах
    clear=o.clear??2,u=Math.min((o.maxH||20)/2,(ip.r-clear)/Math.hypot(uw/2,uh/2));if(2*u<(o.minH||3))return null;
  const ox=ip.p[0]-uw*u/2,oy=ip.p[1]-uh*u/2,seg=[];
  [...t].forEach((ch,i)=>(DIGITS[ch]||[]).forEach(L=>{for(let k=0;k+1<L.length;k++)seg.push([ox+(i*1.5+L[k][0])*u,oy+L[k][1]*u,ox+(i*1.5+L[k+1][0])*u,oy+L[k+1][1]*u]);}));
  return seg;}
const DXF_COL={ENGRAVE:1,BEND_V:3,BEND_M:5,PERF:6};   // красный, зелёный, синий, малиновый
// надпись t по направлению ang (рад) с центром (cx, cy), высота знаков h → отрезки
function textSegs(t,cx,cy,h,ang){const u=h/2,uw=t.length*1.5-.5,c=Math.cos(ang),s=Math.sin(ang),T=(x,y)=>{const X=(x-uw/2)*u,Y=(y-1)*u;return [cx+c*X-s*Y,cy+s*X+c*Y];},out=[];
  [...t].forEach((ch,i)=>(DIGITS[ch]||[]).forEach(L=>{for(let k=0;k+1<L.length;k++){const a=T(i*1.5+L[k][0],L[k][1]),b=T(i*1.5+L[k+1][0],L[k+1][1]);out.push([a[0],a[1],b[0],b[1]]);}}));return out;}
// подпись сгиба вдоль линии z = [x1,y1,x2,y2], рядом с ней, целиком внутри контура P (может быть длиннее линии); h — высота знаков:
// busy — занятые места (четырёхугольники: номера деталей, другие подписи), подпись от них не ближе 1 мм; у результата .box — рамка подписи с запасом 0,5 мм.
// пробуем середину и места ближе к концам, с обеих сторон, дальше от линии (там, где деталь шире), от h до 2,5 мм; мельче — не подписываем
// выпуклые многоугольники A и B пересекаются (проверка по разделяющим осям)
function quadHit(A,B){for(const Q of [A,B])for(let i=0;i<Q.length;i++){const p=Q[i],q=Q[(i+1)%Q.length],nx=q[1]-p[1],ny=p[0]-q[0],pr=Z=>{let a=1e9,b=-1e9;Z.forEach(z=>{const v=z[0]*nx+z[1]*ny;a=Math.min(a,v);b=Math.max(b,v);});return [a,b];},[a0,a1]=pr(A),[b0,b1]=pr(B);if(a1<b0||b1<a0)return false;}return true;}
// рамка отрезков гравировки (по осям) с запасом pad — четырёхугольником
const segBox=(S,pad=0)=>{const xs=S.flatMap(z=>[z[0],z[2]]),ys=S.flatMap(z=>[z[1],z[3]]),x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,y0=Math.min(...ys)-pad,y1=Math.max(...ys)+pad;return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];};
function bendLabel(t,z,P,h=4,busy=[]){const uw=t.length*1.5-.5,d=polyDist(P);let ang=Math.atan2(z[3]-z[1],z[2]-z[0]);if(ang>Math.PI/2)ang-=Math.PI;if(ang<=-Math.PI/2)ang+=Math.PI;const c=Math.cos(ang),s=Math.sin(ang);
  for(let hh=h;hh>=2.5-1e-9;hh-=.5)for(const off of [1.2,4,8])for(const f of [.5,.35,.65,.2,.8])for(const sd of [1,-1]){const w=uw*hh/2,k=sd*(hh/2+off),cx=z[0]+(z[2]-z[0])*f-s*k,cy=z[1]+(z[3]-z[1])*f+c*k,box=[[-w/2,-hh/2],[w/2,-hh/2],[w/2,hh/2],[-w/2,hh/2],[0,0]].map(([x,y])=>[cx+c*x-s*y,cy+s*x+c*y]);
    if(!box.every(q=>inPoly(q,P)&&d(q)>.8))continue;const R=[[-w/2-.5,-hh/2-.5],[w/2+.5,-hh/2-.5],[w/2+.5,hh/2+.5],[-w/2-.5,hh/2+.5]].map(([x,y])=>[cx+c*x-s*y,cy+s*x+c*y]);
    // углы и середина внутри — мало: острый выступ кромки проходит сквозь длинную рамку между ними (было: подпись сгиба за контуром реза до 2,5 мм)
    if(P.some((a,i)=>{const b=P[(i+1)%P.length];return R.some((r,j)=>segX(a,b,r,R[(j+1)%4]));}))continue;
    if(busy.some(b=>quadHit(R,b)))continue;const g=textSegs(t,cx,cy,hh,ang);g.box=R;return g;}
  return null;}
// точка куска в координатах листа: зеркало по x (f), поворот, сдвиг — как положил раскрой
const trPt=(t,p)=>{const x=t.f?-p[0]:p[0];return [t.c*x-t.s*p[1]+t.x,t.s*x+t.c*p[1]+t.y];};
function dxfSegs(e,S,lay,ox=0,oy=0){S.forEach(s=>e.push('0','LINE','8',lay,'62',DXF_COL[lay]||7,'10',dn(s[0]+ox),'20',dn(s[1]+oy),'30',0,'11',dn(s[2]+ox),'21',dn(s[3]+oy),'31',0));}

/* ---------- уголки-шаблоны для сварки: клин под угол шва, один на каждое значение угла (многоразовый) ----------
   Рабочие края длиной TPL_L сходятся под углом a, полка шириной w; у вершины — выемка под кромки листов и валик шва.
   Угол — как в чертежах: round(min(θ, 360−θ)); выпуклый шов — уголок в стык изнутри, вогнутый («внутрь») — снаружи.
   Почти плоские (≥ TPL_MAX°) выставляют линейкой, совсем острые (< TPL_MIN°) — по месту: для них уголков нет */
const TPL_L=50,TPL_MAX=178,TPL_MIN=15;
function tplShape(a,t,minW){const r=a*Math.PI/180,c=Math.max(4,2*t),w=Math.max(20,minW+c+1),u2=[Math.cos(r),Math.sin(r)],n2=[Math.sin(r),-Math.cos(r)],bi=[Math.cos(r/2),Math.sin(r/2)];
  const at=(v,k)=>[v[0]*k,v[1]*k],add=(p,q)=>[p[0]+q[0],p[1]+q[1]],C1=[c,0],C2=at(u2,c),N=at(bi,c),P1=[TPL_L,0],P2=at(u2,TPL_L);
  // острый угол: внутренний край ушёл бы за полки — тогда треугольник
  if(w/Math.tan(r/2)>TPL_L-8)return [C1,P1,P2,C2,N];
  return [C1,P1,[TPL_L,w],at(bi,w/Math.sin(r/2)),add(P2,at(n2,w)),P2,C2,N];}
// углы швов фигуры (bent(p, q) — стык гнётся, уголок не нужен) и углы сгибов bends → [{a, pts, seams, out, bends}] по возрастанию; seams — сколько швов с этим углом, out — из них вогнутых (уголок снаружи), bends — сгибов
// шов — пара деталей (partNbs: все соседи, угол — как у зеркального), один раз
function weldTemplates(R,t,minW,bent,bends=[]){const M=new Map();R.parts.forEach((p,pi)=>partNbs(R,pi).forEach(g=>{if(g.nb<pi||g.dih==null||bent&&bent(pi,g.nb))return;const d=g.dih,a=Math.round(d>180.5?360-d:d);if(a>=TPL_MAX||a<TPL_MIN)return;
    const o=M.get(a)||{a,seams:0,out:0,bends:0};o.seams++;if(d>180.5)o.out++;M.set(a,o);}));
  bends.forEach(d=>{const a=Math.round(d);if(a>=TPL_MAX||a<TPL_MIN)return;const o=M.get(a)||{a,seams:0,out:0,bends:0};o.bends++;M.set(a,o);});
  return [...M.values()].sort((x,y)=>x.a-y.a).map(o=>({...o,pts:tplShape(o.a,t,minW)}));}
const tplNo=a=>'У'+a+'°',isTpl=o=>typeof o.id==='string'&&o.id[0]==='t',isBlank=o=>typeof o.id==='string'&&o.id[0]==='b',itemName=o=>isTpl(o)?'уголок '+o.no:isBlank(o)?'заготовка '+o.no:'№'+o.no;
// «деталей 136 + уголков 82», с гибкой — «заготовок 30 + деталей 10»
const itemsTxt=L=>{const t=L.filter(isTpl).length,b=L.filter(isBlank).length;return `${b?`заготовок ${b} + `:''}деталей ${L.length-t-b}${t?` + уголков ${t}`:''}`;};
