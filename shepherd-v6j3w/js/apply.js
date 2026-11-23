/* ---------- «Нарезать» (#152): разметка → правки граней разом ----------
   линия/кривая в пределах одной детали (грани) → разрез грани ломаной (новые точки на рёбрах и внутри); зачёркивание → слить две грани (mergePolys).
   Концы ближе AP_SNAP мм к углу встают в угол, к ребру — на ребро (без щепок). Что нельзя — не применяется, причина — у штриха; остальное применяется.
   Симметрия: штрих режется и на зеркальной половине (по точным зеркальным точкам); штрих поперёк оси x = 0 делается симметричным и режется один раз */
const AP_SNAP=8,AP_MINW=15,AP_STEP=1;
const AP_WHY={edge:'линия не доходит до края детали',narrow:'выйдет деталь уже 15 мм',hole:'слить нельзя: выйдет дыра',selfx:'выйдет самопересечение',
  closed:'замкнутая линия — отверстие (будет в следующей версии)',multi:'линия идёт через несколько деталей',none:'линия идёт по краю детали — резать нечего',
  nocross:'зачёркивание не пересекает шов между деталями',off:'линия не на фигуре'};
// плоскость грани: 2D-координаты (u,w) от первой точки
function apFrame(V,Q){const n=polyNorm(V,Q),o=V[Q[0]];let u=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(n,V3.dot(u,n))));const w=V3.cross(n,u);
  return {n,o,to2:p=>{const d=V3.sub(p,o);return [V3.dot(d,u),V3.dot(d,w)];},to3:q=>V3.add(o,V3.add(V3.mul(u,q[0]),V3.mul(w,q[1])))};}
// ближайшая грань к точке: индекс по треугольникам (tlTris/tlGrid из tlines.js)
function apIndex(E){const tr=tlTris(E.V,E.P),G=tlGrid(tr,t=>[[0,1,2].map(k=>Math.min(t.a[k],t.b[k],t.c[k])),[0,1,2].map(k=>Math.max(t.a[k],t.b[k],t.c[k]))],24,12);
  return p=>{let best=-1,bd=144;for(const k of G.at(p)){const t=tr[k],c=tlClosest(p,t.a,t.b,t.c),d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;best=t.pi;}}return best;};}
// гуще: точки через step мм
function apDense(pts,step){const o=[pts[0].slice()];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(...a.map((x,k)=>b[k]-x)),m=Math.max(1,Math.ceil(L/step));for(let s=1;s<=m;s++)o.push(a.map((x,k)=>x+(b[k]-x)*s/m));}return o;}
const apLen=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(...l[i].map((x,k)=>x-l[i-1][k]));return s;};
// ширина многоугольника в 2D — как у детали (по сторонам выпуклой оболочки, mesh.js flatten)
function apWidth(q){const h=convexHull(q);let bw=Infinity;h.forEach((p,i)=>{const r=h[(i+1)%h.length],a=Math.atan2(r[1]-p[1],r[0]-p[0]),c=Math.cos(a),s=Math.sin(a);let mn=Infinity,mx=-Infinity;h.forEach(z=>{const y=-s*z[0]+c*z[1];if(y<mn)mn=y;if(y>mx)mx=y;});bw=Math.min(bw,mx-mn);});return bw;}
// пересечение отрезков 2D a–b и c–d → параметр t на a–b или -1
function apSegX(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return -1;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>=0&&t<=1&&u>=0&&u<=1?t:-1;}
// ближайшая точка контура q2 (2D) к p: {k — ребро q2[k]–q2[k+1], t, p, d}
function apOnRing(q2,p){let best=null;q2.forEach((a,k)=>{const b=q2[(k+1)%q2.length],ab=[b[0]-a[0],b[1]-a[1]],l2=ab[0]**2+ab[1]**2,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1])/l2)):0,c=[a[0]+ab[0]*t,a[1]+ab[1]*t],d=Math.hypot(c[0]-p[0],c[1]-p[1]);
  if(!best||d<best.d)best={k,t,p:c,d};});return best;}
/* штрих (3D) на грани pi → путь разреза в 2D плоскости грани: {s, mid:[…], t} — концы на контуре, середина внутри; или {why}.
   Выход за край ≤ AP_SNAP мм (кликнули чуть дальше ребра) — обрезается; дальше — линия идёт через несколько деталей */
function apClip(E,pi,pts){const Q=E.P[pi],fr=apFrame(E.V,Q),q2=Q.map(i=>fr.to2(E.V[i])),d2=apDense(pts.map(fr.to2),AP_STEP),ins=d2.map(p=>inPoly2(q2,p[0],p[1])),n=d2.length;
  let a=ins.indexOf(true),b=ins.lastIndexOf(true);if(a<0)return {why:AP_WHY.off};
  for(let i=a;i<=b;i++)if(!ins[i]){const r=apOnRing(q2,d2[i]);if(r.d>.5)return {why:AP_WHY.multi};}   // вышла и вернулась
  if(apLen(d2.slice(0,a+1))>AP_SNAP+AP_STEP||apLen(d2.slice(b))>AP_SNAP+AP_STEP)return {why:AP_WHY.multi};
  const end=(i,j)=>{if(j>=0&&j<n&&!ins[j]){let best=null;q2.forEach((c,k)=>{const t=apSegX(d2[i],d2[j],c,q2[(k+1)%q2.length]);if(t>=0&&(!best||t<best.t))best={t,p:[d2[i][0]+(d2[j][0]-d2[i][0])*t,d2[i][1]+(d2[j][1]-d2[i][1])*t]};});if(best)return best.p;}
    const r=apOnRing(q2,d2[i]);return r.d<=AP_SNAP?r.p:null;};
  const s=end(a,a-1),t=end(b,b+1);if(!s||!t)return {why:AP_WHY.edge};
  let mid=apDP2(d2.slice(a,b+1),.5).filter(p=>Math.hypot(p[0]-s[0],p[1]-s[1])>AP_SNAP&&Math.hypot(p[0]-t[0],p[1]-t[1])>AP_SNAP);   // ближе AP_SNAP к концу — не отдельная точка (без щепок)
  return {fr,q2,s,mid,t};}
function apDP2(l,eps){if(l.length<3)return l;const keep=new Uint8Array(l.length);keep[0]=keep[l.length-1]=1;const st=[[0,l.length-1]];
  while(st.length){const [a,b]=st.pop(),A=l[a],B=l[b],ab=[B[0]-A[0],B[1]-A[1]],L2=ab[0]**2+ab[1]**2;let bi=-1,bd=eps*eps;
    for(let i=a+1;i<b;i++){const t=L2?Math.max(0,Math.min(1,((l[i][0]-A[0])*ab[0]+(l[i][1]-A[1])*ab[1])/L2)):0,d=(l[i][0]-A[0]-ab[0]*t)**2+(l[i][1]-A[1]-ab[1]*t)**2;if(d>bd){bd=d;bi=i;}}
    if(bi>=0){keep[bi]=1;st.push([a,bi],[bi,b]);}}
  return l.filter((_,i)=>keep[i]);}
/* разрез грани pi ломаной: pts — точки в 3D (кадр фигуры), концы — на её контуре (или ближе AP_SNAP к нему), середина — внутри.
   → {E, pts — точки, по которым прошёл разрез (для зеркала)} или {why}. E не меняется */
function cutPolyline(E,pi,pts,o={}){const snap=o.snap??AP_SNAP,minW=o.minW??AP_MINW,c=apClip(E,pi,pts);if(c.why)return c;
  E=ecopy(E);const Q=E.P[pi],q2=c.q2,fr=c.fr;
  // конец: угол ближе snap — он; иначе точка на ребре (во всех гранях с этим ребром, чтобы не было щелей)
  const endV=p=>{let bk=-1,bd=snap;q2.forEach((q,k)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;bk=k;}});if(bk>=0)return Q[bk];
    const r=apOnRing(q2,p),a=Q[r.k],b=Q[(r.k+1)%Q.length],P3=V3.add(E.V[a],V3.mul(V3.sub(E.V[b],E.V[a]),r.t));return {a,b,p:P3};};
  const es=endV(c.s),et=endV(c.t);
  if(typeof es==='number'&&es===et&&!c.mid.length)return {why:AP_WHY.none};
  // точка на ребре: ищем отрезок текущего контура, на котором она лежит (второй конец на том же ребре — ребро уже разбито первым)
  const put=e=>{if(typeof e==='number')return e;const R0=E.P[pi];let x=e.a,y=e.b,bd=Infinity;R0.forEach((a,k)=>{const b=R0[(k+1)%R0.length],A=E.V[a],ab=V3.sub(E.V[b],A),l2=V3.dot(ab,ab),t=l2?Math.max(0,Math.min(1,V3.dot(V3.sub(e.p,A),ab)/l2)):0,d=V3.len(V3.sub(e.p,V3.add(A,V3.mul(ab,t))));if(d<bd){bd=d;x=a;y=b;}});
    const m=vAt(E,e.p);if(m===x||m===y)return m;insertOnEdge(E,x,y,m);E.S=E.S.flatMap(s=>s[0]===x&&s[1]===y||s[0]===y&&s[1]===x?[[s[0],m],[m,s[1]]]:[s]);return m;};
  const sv=put(es),tv=put(et),mv=c.mid.map(q=>{E.V.push(fr.to3(q));return E.V.length-1;});
  const R=E.P[pi],is=R.indexOf(sv),it=R.indexOf(tv),n=R.length;if(is<0||it<0||is===it)return {why:AP_WHY.none};
  if(!mv.length&&((is+1)%n===it||(it+1)%n===is))return {why:AP_WHY.none};
  const A=[],B=[];for(let j=is;;j=(j+1)%n){A.push(R[j]);if(j===it)break;}A.push(...mv.slice().reverse());for(let j=it;;j=(j+1)%n){B.push(R[j]);if(j===is)break;}B.push(...mv);
  // проверки: обе части — простые многоугольники той же стороны, шире minW
  for(const X of [A,B]){if(X.length<3||polySelfX(E.V,X)||V3.dot(polyNorm(E.V,X),fr.n)<.9)return {why:AP_WHY.selfx};if(apWidth(X.map(i=>fr.to2(E.V[i])))<minW-1e-6)return {why:AP_WHY.narrow};}
  E.P.splice(pi,1,A,B);const path=[sv,...mv,tv];for(let i=1;i<path.length;i++)E.S.push([path[i-1],path[i]]);
  return {E,pts:path.map(i=>E.V[i].slice())};}
// штрих поперёк оси x = 0 (одно пересечение) → симметричный: правая половина + точка на оси + её зеркало; иначе как был
function apSymLine(pts){const cs=[];for(let i=1;i<pts.length;i++)if(pts[i-1][0]*pts[i][0]<0)cs.push(i);if(cs.length!==1)return null;const cr=cs[0];
  const a=pts[cr-1],b=pts[cr],t=a[0]/(a[0]-b[0]),C=[0,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],R=pts[0][0]>0?pts.slice(0,cr).reverse():pts.slice(cr);   // R — правая часть от оси наружу
  const right=R.filter(p=>p[0]>.5);return [...right.slice().reverse().map(p=>[-p[0],p[1],p[2]]),C,...right];}
/* применить разметку: сначала зачёркивания, потом линии. → {E, done:[номера штрихов], fail:[{i, why}]} */
function applyMarkup(E,mk,o={}){const sym=!!o.sym,done=[],fail=[];E=ecopy(E);
  const order=mk.map((s,i)=>i).sort((a,b)=>(mk[a].k==='cross'?0:1)-(mk[b].k==='cross'?0:1));
  for(const i of order){const s=mk[i];let r;
    if(s.k==='cross')r=apCross(E,s,sym);else if(s.closed)r={why:AP_WHY.closed};else r=apLine(E,s,sym,o);
    if(r.why)fail.push({i,why:r.why});else{E=r.E;done.push(i);}}
  return {E:compact(E),done:done.sort((a,b)=>a-b),fail:fail.sort((a,b)=>a.i-b.i)};}
function apCross(E,s,sym){if(s.pts.length<2)return {why:AP_WHY.nocross};const at=apIndex(E),a=at(s.pts[0]),b=at(s.pts[s.pts.length-1]);
  if(a<0||b<0)return {why:AP_WHY.off};if(a===b||!polysAdjacent(E,a,b))return {why:AP_WHY.nocross};const r=mergePolys(E,a,b,sym);return r?{E:r}:{why:AP_WHY.hole};}
// линия: грань — та, над которой больше всего точек штриха; с симметрией — и зеркальная (по точкам, где прошёл разрез)
function apLine(E,s,sym,o){let pts=s.pts;if(pts.length<2)return {why:AP_WHY.edge};const sl=sym?apSymLine(pts):null;if(sl)pts=sl;
  const at=apIndex(E),own=new Map();apDense(pts,2).forEach(p=>{const f=at(p);if(f>=0)own.set(f,(own.get(f)||0)+1);});if(!own.size)return {why:AP_WHY.off};
  const pi=[...own].sort((x,y)=>y[1]-x[1])[0][0],r=cutPolyline(E,pi,pts,o);if(r.why||!sym||sl)return r;
  const m=r.pts.map(p=>[-p[0],p[1],p[2]]);if(r.pts.every(p=>Math.abs(p[0])<=MK_AXIS))return r;   // на оси — не двоится
  const at2=apIndex(r.E),own2=new Map();apDense(m,2).forEach(p=>{const f=at2(p);if(f>=0)own2.set(f,(own2.get(f)||0)+1);});if(!own2.size)return {why:AP_WHY.off};
  const pj=[...own2].sort((x,y)=>y[1]-x[1])[0][0],r2=cutPolyline(r.E,pj,m,o);return r2.why?{why:r2.why}:r2;}
