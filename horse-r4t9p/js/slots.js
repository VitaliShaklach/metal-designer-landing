/* ---------- прорези по линиям сгиба (v0.28.0) — геометрия без DOM ----------
   Фигура с дугами — {pts:[[x,y]…], b:[bulge…]}: b[i] — дуга на ребре pts[i]→pts[i+1] (последнее — к pts[0]), как код 42 в DXF:
   0 — прямая, ±1 — полуокружность (плюс — против часовой), |b| > 1 — дуга больше 180°. bulge = tan(θ/4) = 2·стрелка/хорда.
   Вдоль линии сгиба: край | крайняя прорезь (до края) | перемычка eb | средняя | перемычка br | … | средняя | перемычка eb | крайняя | край.
   Средние — замкнутые «таблетки» шириной w (концы — полуокружности), слой PERF; крайние прорези — часть контура CUT (тикет #136).
   Нет крайней с этой стороны — линия начинается с перемычки eb («Перемычка у кромки»). */
const SLOT_DEF={w:2,len:40,br:3,eb:3,el:5,notch:true,D:3};
/* раскладка вдоль линии длиной L → [[t0,t1],…] в мм от начала линии (вместе с закруглениями) или null — прорезей нет.
   openA/openB — с этой стороны крайняя прорезь до края; o = {w, len, br, eb, el} */
function slotPlan(L,openA,openB,o){const {w,len,br,eb,el}=o;let a=openA?el:0,b=openB?el:0;
  // короткая линия с обоими концами на кромке (#140): две крайние по min(el, (L − br)/2), между ними перемычка br по центру
  if(openA&&openB&&L<2*el+br)a=b=(L-br)/2;else if(openA&&!openB&&L<el+eb)a=L-eb;else if(openB&&!openA&&L<el+eb)b=L-eb;
  if(openA&&a<w||openB&&b<w)return null;   // крайняя вышла уже ширины — линия слишком короткая
  const s=a?a+eb:eb,e=L-(b?b+eb:eb),M=e-s,out=[];if(a)out.push([0,a]);
  if(M>=w){let n=1;while((M-(n-1)*br)/n>len+1e-9)n++;const c=(M-(n-1)*br)/n;for(let i=0;i<n;i++)out.push([s+i*(c+br),s+i*(c+br)+c]);}
  if(b)out.push([L-b,L]);return out.length?out:null;}
// дуга через точку m (середину дуги) от s до e: bulge со знаком (m справа от хорды s→e — дуга против часовой)
function bulgeVia(s,e,m){const c=Math.hypot(e[0]-s[0],e[1]-s[1])||1e-12,cr=(e[0]-s[0])*(m[1]-s[1])-(e[1]-s[1])*(m[0]-s[0]),h=Math.abs(cr)/c;return (cr<0?1:-1)*2*h/c;}
// «таблетка» на прямой a + u·t от t0 до t1 (длина вместе с закруглениями), ширина w: 4 точки, две полуокружности — середины дуг на t0 и t1
function slotShape(a,u,t0,t1,w){const r=w/2,n=[-u[1],u[0]],P=(t,k)=>[a[0]+u[0]*t+n[0]*k,a[1]+u[1]*t+n[1]*k],x0=t0+r,x1=Math.max(x0,t1-r);
  const pts=[P(x0,r),P(x1,r),P(x1,-r),P(x0,-r)];return {pts,b:[0,bulgeVia(pts[1],pts[2],P(t1,0)),0,bulgeVia(pts[3],pts[0],P(t0,0))]};}
// длина ребра с дугой: хорда c, θ = 4·atan(b) → c·θ / (2·sin(θ/2))
const arcLen=(p,q,b)=>{const c=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!b)return c;const th=Math.abs(4*Math.atan(b));return c*th/(2*Math.sin(th/2));};
const shapeLen=S=>S.pts.reduce((a,p,i)=>a+arcLen(p,S.pts[(i+1)%S.pts.length],S.b[i]||0),0);
// точки дуги p→q (без p, с q): k отрезков на полуокружность
function arcPts(p,q,b,k=8){if(!b)return [q];const th=4*Math.atan(b),c=Math.hypot(q[0]-p[0],q[1]-p[1]),m=[(p[0]+q[0])/2,(p[1]+q[1])/2],nl=[-(q[1]-p[1])/c,(q[0]-p[0])/c],d=c/2/Math.tan(th/2),
    o=[m[0]+nl[0]*d,m[1]+nl[1]*d],n=Math.max(2,Math.ceil(k*Math.abs(th)/Math.PI)),out=[];
  for(let i=1;i<=n;i++){const a=th*i/n,cs=Math.cos(a),sn=Math.sin(a),x=p[0]-o[0],y=p[1]-o[1];out.push(i===n?q:[o[0]+x*cs-y*sn,o[1]+x*sn+y*cs]);}return out;}
// дуги — ломаной (для SVG и проверок)
const shapeFlat=(S,k=8)=>{const out=[];S.pts.forEach((p,i)=>{const q=S.pts[(i+1)%S.pts.length];if(S.b[i])out.push(...arcPts(p,q,S.b[i],k).slice(0,-1));out.push(q);});out.unshift(out.pop());return out;};
// перенос фигуры (поворот, сдвиг, зеркало): зеркало меняет направление обхода — знаки дуг тоже
function shapeTr(S,T){const o=T([0,0]),x=T([1,0]),y=T([0,1]),mir=(x[0]-o[0])*(y[1]-o[1])-(x[1]-o[1])*(y[0]-o[0])<0;return {pts:S.pts.map(T),b:S.b.map(v=>mir&&v?-v:v)};}
// контур без дуг → фигура
const plainShape=P=>({pts:P,b:P.map(()=>0)});
/* ---------- крайняя прорезь до края и разгрузочное отверстие: фигура выреза и врезка её в контур ---------- */
/* фигура выреза на конце линии: p — конец линии на кромке, u — внутрь детали вдоль линии. Полоса ширины w от t = −(max(w,D)+1) (снаружи детали)
   до t = el со скруглённым внутренним концом; D > w — вместе с кругом Ø D в p («замочная скважина»); el = 0 и D > 0 — только круг */
function endShape(p,u,w,el,D){const n=[-u[1],u[0]],W=(x,y)=>[p[0]+u[0]*x+n[0]*y,p[1]+u[1]*x+n[1]*y],r=w/2,R=D/2,x0=-(Math.max(w,D)+1),pts=[],b=[];
  const go=(q,mid)=>{if(pts.length){const s=pts[pts.length-1];b.push(mid?bulgeVia(s,q,mid):0);}pts.push(q);},close=mid=>b.push(mid?bulgeVia(pts[pts.length-1],pts[0],mid):0);
  if(el<=0){if(D<=0)return null;const A=W(-R,0),B=W(R,0);return {pts:[A,B],b:[bulgeVia(A,B,W(0,R)),bulgeVia(B,A,W(0,-R))]};}
  const ke=Math.max(x0+r,el-r),hole=D>w,xc=hole?Math.sqrt(R*R-r*r):0,deep=hole&&ke>xc;   // ke — центр закругления внутреннего конца
  go(W(x0,r));
  if(deep){go(W(-xc,r));go(W(xc,r),W(0,R));}
  go(W(ke,r));go(W(ke,-r),W(ke+r,0));
  if(deep){go(W(xc,-r));go(W(-xc,-r),W(0,-R));}
  else if(hole){/* короткая крайняя внутри круга: круг целиком, полоса только наружу */pts.length=0;b.length=0;go(W(x0,r));go(W(-xc,r));go(W(-xc,-r),W(R,0));}
  go(W(x0,-r));close(null);return {pts,b};}
// ребро фигуры i: прямая или дуга (центр o, радиус r, начальный угол a0, развёрнутый угол th со знаком)
function shEdge(S,i){const P=S.pts[i],Q=S.pts[(i+1)%S.pts.length],b=S.b[i]||0;if(!b)return {P,Q,b};const th=4*Math.atan(b),c=Math.hypot(Q[0]-P[0],Q[1]-P[1]),
    nl=[-(Q[1]-P[1])/c,(Q[0]-P[0])/c],d=c/2/Math.tan(th/2),o=[(P[0]+Q[0])/2+nl[0]*d,(P[1]+Q[1])/2+nl[1]*d];return {P,Q,b,th,o,r:Math.hypot(P[0]-o[0],P[1]-o[1]),a0:Math.atan2(P[1]-o[1],P[0]-o[0])};}
const shAt=(e,t)=>e.b?[e.o[0]+e.r*Math.cos(e.a0+e.th*t),e.o[1]+e.r*Math.sin(e.a0+e.th*t)]:[e.P[0]+(e.Q[0]-e.P[0])*t,e.P[1]+(e.Q[1]-e.P[1])*t];
// доля дуги до точки X на её окружности
function shFrac(e,X){const a=Math.atan2(X[1]-e.o[1],X[0]-e.o[0]),T=2*Math.PI;let d=e.th>0?a-e.a0:e.a0-a;d=((d%T)+T)%T;if(d>T-1e-9)d=0;return d/Math.abs(e.th);}
// пересечения двух рёбер → [[t на первом, t на втором, точка]]
function shCross(e,f){const out=[],E=1e-9;
  if(!e.b&&!f.b){const r=[e.Q[0]-e.P[0],e.Q[1]-e.P[1]],s=[f.Q[0]-f.P[0],f.Q[1]-f.P[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return out;
    const qp=[f.P[0]-e.P[0],f.P[1]-e.P[1]],t=(qp[0]*s[1]-qp[1]*s[0])/den,u=(qp[0]*r[1]-qp[1]*r[0])/den;if(t>-E&&t<1+E&&u>-E&&u<1+E)out.push([t,u,shAt(e,t)]);return out;}
  if(e.b&&!f.b)return shCross(f,e).map(([a,b,X])=>[b,a,X]);
  const C=f.b?f:null;
  if(!e.b){const d=[e.Q[0]-e.P[0],e.Q[1]-e.P[1]],m=[e.P[0]-C.o[0],e.P[1]-C.o[1]],A=d[0]*d[0]+d[1]*d[1],B=2*(m[0]*d[0]+m[1]*d[1]),Cc=m[0]*m[0]+m[1]*m[1]-C.r*C.r,D=B*B-4*A*Cc;if(D<0)return out;
    [...new Set([(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])].forEach(t=>{if(t<-E||t>1+E)return;const X=shAt(e,t),u=shFrac(C,X);if(u<1+E)out.push([t,u,X]);});return out;}
  const dx=C.o[0]-e.o[0],dy=C.o[1]-e.o[1],d=Math.hypot(dx,dy);if(d<1e-12||d>e.r+C.r||d<Math.abs(e.r-C.r))return out;
  const a=(e.r*e.r-C.r*C.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,e.r*e.r-a*a)),mx=e.o[0]+dx*a/d,my=e.o[1]+dy*a/d;
  [[mx+h*dy/d,my-h*dx/d],[mx-h*dy/d,my+h*dx/d]].slice(0,h>1e-12?2:1).forEach(X=>{const t=shFrac(e,X),u=shFrac(C,X);if(t<1+E&&u<1+E)out.push([t,u,X]);});return out;}
// участок фигуры от позиции a до b вперёд по обходу (позиция = номер ребра + доля) → рёбра [[начало, bulge]]
function shChain(S,a,b){const n=S.pts.length,out=[];if(b<=a)b+=n;let cur=a;while(cur<b-1e-12){const k=Math.floor(cur+1e-12),i=k%n,t0=Math.max(0,cur-k),t1=Math.min(1,b-k),e=shEdge(S,i);
    out.push([shAt(e,t0),e.b?Math.tan(e.th*(t1-t0)/4):0]);cur=k+1;}return out;}
const shPos=(S,pos)=>{const n=S.pts.length,k=Math.floor(pos)%n;return shAt(shEdge(S,k),pos-Math.floor(pos));};
/* вычесть фигуру S из контура C возле точки p на кромке C: от p по C назад и вперёд до границы S (точки A и B); участок C между ними (с p)
   заменяем участком границы S от A до B, лежащим внутри C. Граница S пересекает C не ровно в двух точках (задевает дальние рёбра,
   режет деталь пополам) — null. C может уже содержать дуги (от прошлой врезки) */
function cutInto(C,S,p){if(!S)return null;const nC=C.pts.length,nS=S.pts.length,E=1e-7,X=[];
  for(let i=0;i<nC;i++){const e=shEdge(C,i);for(let j=0;j<nS;j++)shCross(e,shEdge(S,j)).forEach(([t,u,q])=>{if(t>1-E||u>1-E)return;t=Math.max(0,t);u=Math.max(0,u);
    if(!X.some(x=>Math.hypot(x.q[0]-q[0],x.q[1]-q[1])<1e-6))X.push({c:i+t,s:j+u,q});});}
  if(X.length!==2)return null;
  // p — на каком месте контура
  // точно: проекция на отрезок, у дуги — по углу (перебор с шагом ребра ошибался у вершины длинного ребра — Г12 у Д11 терял полдетали)
  let pc=0,best=Infinity;for(let i=0;i<nC;i++){const e=shEdge(C,i);let t;
    if(e.b)t=Math.min(1,shFrac(e,p));else{const dx=e.Q[0]-e.P[0],dy=e.Q[1]-e.P[1];t=Math.max(0,Math.min(1,((p[0]-e.P[0])*dx+(p[1]-e.P[1])*dy)/(dx*dx+dy*dy||1)));}
    [t,0,1].forEach(v=>{const z=shAt(e,v),d=Math.hypot(z[0]-p[0],z[1]-p[1]);if(d<best-1e-12){best=d;pc=i+v;}});}
  X.sort((x,y)=>x.c-y.c);const inside=pc>X[0].c&&pc<X[1].c,K0=inside?X[1]:X[0],K1=inside?X[0]:X[1];   // оставляем контур от K0 до K1
  const keep=shChain(C,K0.c,K1.c),CF=shapeFlat(C,16),mid=(S0,a,b)=>{let m=b>a?(a+b)/2:(a+b+S0.pts.length)/2;return shPos(S0,m);};
  let cut;if(inPoly(mid(S,K1.s,K0.s),CF))cut=shChain(S,K1.s,K0.s);
  else if(inPoly(mid(S,K0.s,K1.s),CF)){const f=shChain(S,K0.s,K1.s),ends=f.map(x=>x[0]).slice(1).concat([K1.q]);cut=f.map((x,i)=>[ends[i],-x[1]]).reverse();}
  else return null;
  const all=keep.concat(cut),pts=[],b=[];all.forEach(([q,bv],i)=>{const nx=all[(i+1)%all.length][0];if(Math.hypot(nx[0]-q[0],nx[1]-q[1])<1e-9)return;pts.push(q);b.push(bv);});
  // точка пересечения у самой вершины (ближе 0,02 мм) — одна точка: в DXF координаты округляются до 0,01, отрезок стал бы нулевым (Г11 у Д11)
  for(let k=0;k<pts.length&&pts.length>3;){const j=(k+1)%pts.length,q=pts[k],z=pts[j];if(Math.hypot(z[0]-q[0],z[1]-q[1])<.02){b[k]=b[j];pts.splice(j,1);b.splice(j,1);if(j<k)k--;}else k++;}
  return pts.length>=3?{pts,b}:null;}
/* раскладка линии a→a+u·L в контуре C: открытые концы (openA/openB) — крайние прорези до края (длина из slotPlan), средние — между ними;
   у концов средние сдвигаются к середине, чтобы до кромки оставалось не меньше eb (острый угол линии с кромкой).
   → {ea, eb2 — длины крайних (0 — нет), mids:[[t0,t1]…]} или null — прорезей нет */
function slotLayout(a,u,L,C,openA,openB,o){const pl=slotPlan(L,openA,openB,o);if(!pl)return null;const ea=openA?pl[0][1]:0,eb2=openB?L-pl[pl.length-1][0]:0;
  const s=ea?ea+o.eb:o.eb,e=L-(eb2?eb2+o.eb:o.eb),dC=polyDist(C),at=t=>[a[0]+u[0]*t,a[1]+u[1]*t],r=o.w/2,good=t=>dC(at(t))-r>=o.eb-1e-6;
  let sA=0,sB=0;while(sA<=L&&!good(s+sA+r))sA+=.25;while(sB<=L&&!good(e-sB-r))sB+=.25;
  const M=e-s-sA-sB,mids=[];if(M>=o.w){let n=1;while((M-(n-1)*o.br)/n>o.len+1e-9)n++;const c=(M-(n-1)*o.br)/n;for(let i=0;i<n;i++){const t0=s+sA+i*(c+o.br);mids.push([t0,t0+c]);}}
  return ea||eb2||mids.length?{ea,eb2,mids}:null;}
/* внутренний угол контура P в конце линии q: ближайшая вершина не дальше w от q, угол контура в ней (со стороны металла) больше 190° —
   ступенька или дно выреза: там при гибе металл рвётся или выпирает, нужно разгрузочное отверстие */
function innerCorner(P,q,w){let k=-1,best=Infinity;P.forEach((v,i)=>{const d=Math.hypot(v[0]-q[0],v[1]-q[1]);if(d<best){best=d;k=i;}});if(k<0||best>w)return false;
  const n=P.length,v=P[k],a=P[(k+n-1)%n],c=P[(k+1)%n],x=[c[0]-v[0],c[1]-v[1]],y=[a[0]-v[0],a[1]-v[1]],T=2*Math.PI;
  let ang=Math.atan2(x[0]*y[1]-x[1]*y[0],x[0]*y[0]+x[1]*y[1]);ang=((ang%T)+T)%T;if(area2(P)<0)ang=T-ang;return ang*180/Math.PI>190;}
