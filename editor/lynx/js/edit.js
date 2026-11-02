/* ---------- Редактор: модель из граней-многоугольников E={V,P} ----------
   Операции: двигать точку, выдавить, поднять/вдавить центр, разрезать, удалить грань.
   Симметрия — по плоскости x=0: всё, что делаем справа, повторяется слева. */

// модель для расчёта: треугольники + какой треугольник из какой грани
// S — швы, проведённые руками: пары точек; через них грани не склеиваются в одну деталь, даже в одной плоскости
function polyBase(V,P,S){const F=[],T=[];P.forEach((Q,pi)=>earClip(V,Q).forEach(t=>{F.push(t);T.push(pi);}));return {V,P,F,T,S:S||[]};}
const ecopy=E=>({V:E.V.map(p=>p.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())});
function polyNorm(V,Q){let n=[0,0,0];Q.forEach((i,j)=>{const a=V[i],b=V[Q[(j+1)%Q.length]];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);});return V3.norm(n);}
const polyC=(V,Q)=>V3.mul(Q.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/Q.length);
// насколько грань не плоская, мм
function polyDev(V,Q){if(Q.length<4)return 0;const n=polyNorm(V,Q),c=polyC(V,Q);return Math.max(...Q.map(i=>Math.abs(V3.dot(V3.sub(V[i],c),n))));}
// зеркальные точки: i ↔ j, если j = (−x, y, z); на середине — сама себе
function mirrorMap(V,tol=.6){const key=p=>Math.round(p[0]/tol)+','+Math.round(p[1]/tol)+','+Math.round(p[2]/tol),M=new Map();V.forEach((p,i)=>M.set(key(p),i));
  // точка у границы ячейки сетки может не найтись по ключу — тогда ищем ближайшую честно
  const near=q=>{let bj=-1,bd=tol;V.forEach((r,j)=>{const d=Math.hypot(r[0]-q[0],r[1]-q[1],r[2]-q[2]);if(d<bd){bd=d;bj=j;}});return bj;};
  return V.map(p=>{if(Math.abs(p[0])<tol)return -2;const q=[-p[0],p[1],p[2]];let j=M.get(key(q));if(j===undefined)j=near(q);return j<0?-1:j;});}  // -2 — на середине
function mirrorPoly(E,pi,mm){const Q=E.P[pi],t=Q.map(i=>mm[i]===-2?i:mm[i]);if(t.some(i=>i<0))return -1;const k=[...t].sort((a,b)=>a-b).join();
  return E.P.findIndex(R=>R.length===t.length&&[...R].sort((a,b)=>a-b).join()===k);}
function compact(E){const used=new Map(),V=[];const P=E.P.filter(Q=>Q.length>=3).map(Q=>Q.map(i=>{let j=used.get(i);if(j===undefined){j=V.length;V.push(E.V[i]);used.set(i,j);}return j;}));
  // швы — только те, что остались общим ребром двух граней
  const ec=new Map();P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=a<b?a+'_'+b:b+'_'+a;ec.set(key,(ec.get(key)||0)+1);}));
  const S=(E.S||[]).map(([a,b])=>[used.get(a),used.get(b)]).filter(([a,b])=>a!==undefined&&b!==undefined&&ec.get(a<b?a+'_'+b:b+'_'+a)===2);return {V,P,S};}
// точка на ребре: если уже есть — берём её
function vAt(E,p){const i=E.V.findIndex(q=>Math.abs(q[0]-p[0])<.05&&Math.abs(q[1]-p[1])<.05&&Math.abs(q[2]-p[2])<.05);if(i>=0)return i;E.V.push(p);return E.V.length-1;}
// вставить точку m в ребро a–b у всех граней (чтобы не было «щелей»)
function insertOnEdge(E,a,b,m){E.P.forEach(Q=>{for(let k=0;k<Q.length;k++){const x=Q[k],y=Q[(k+1)%Q.length];if(x===a&&y===b||x===b&&y===a){if(!Q.includes(m))Q.splice(k+1,0,m);return;}}});}

// сдвинуть точку; симметрия — зеркальную тоже; на середине x остаётся 0; край у стены (z=0) остаётся на стене
function moveVert(E,i,p,sym){const mm=sym?mirrorMap(E.V):null,open=openVerts(E),q=p.slice();
  if(sym&&mm[i]===-2)q[0]=0;if(open.has(i)&&Math.abs(E.V[i][2])<.5)q[2]=0;
  E.V[i]=q;if(sym&&mm[i]>=0)E.V[mm[i]]=[-q[0],q[1],q[2]];return E;}
function openVerts(E){const c=new Map();E.P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=a<b?a+'_'+b:b+'_'+a;c.set(key,(c.get(key)||0)+1);}));const s=new Set();c.forEach((n,k)=>{if(n===1)k.split('_').forEach(x=>s.add(+x));});return s;}

// операция над гранью и её зеркалом
function withMirror(E,pi,sym,fn){const mp=sym?mirrorPoly(E,pi,mirrorMap(E.V)):-1;const list=[pi];if(mp>=0&&mp!==pi)list.push(mp);
  const Qs=list.map(k=>E.P[k]);list.sort((a,b)=>b-a).forEach(k=>E.P.splice(k,1));Qs.forEach(Q=>fn(Q));return compact(E);}
// выдавить: грань уходит на d мм по нормали, по краям — боковые грани (d<0 — вдавить карман)
function extrude(E,pi,d,sym){E=ecopy(E);return withMirror(E,pi,sym,Q=>{const n=polyNorm(E.V,Q),nq=Q.map(i=>{E.V.push(V3.add(E.V[i],V3.mul(n,d)));return E.V.length-1;});
  Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length];E.P.push([a,b,nq[(k+1)%Q.length],nq[k]]);});E.P.push(nq);});}
// центр грани поднять (d>0) или вдавить (d<0): грань становится «пирамидкой» из треугольников
function poke(E,pi,d,sym){E=ecopy(E);return withMirror(E,pi,sym,Q=>{const c=V3.add(polyC(E.V,Q),V3.mul(polyNorm(E.V,Q),d));E.V.push(c);const ci=E.V.length-1;
  Q.forEach((a,k)=>E.P.push([a,Q[(k+1)%Q.length],ci]));});}
// разрезать пополам: по середине самой длинной стороны и противоположной
function splitPoly(E,pi,sym){E=ecopy(E);const mp=sym?mirrorPoly(E,pi,mirrorMap(E.V)):-1;const Qs=[E.P[pi]];if(mp>=0&&mp!==pi)Qs.push(E.P[mp]);const keep=Qs.map(Q=>Q.slice());
  keep.forEach(Q0=>{const idx=E.P.findIndex(R=>R.length===Q0.length&&R.every((v,k)=>v===Q0[k]));if(idx<0)return;const Q=E.P[idx],n=Q.length;
    let li=0,ll=-1;Q.forEach((a,k)=>{const L=V3.len(V3.sub(E.V[Q[(k+1)%n]],E.V[a]));if(L>ll+1e-6){ll=L;li=k;}});
    const a=Q[li],b=Q[(li+1)%n],m1=vAt(E,V3.mul(V3.add(E.V[a],E.V[b]),.5));
    if(n===3){const c=Q[(li+2)%3];E.P.splice(idx,1);insertOnEdge(E,a,b,m1);E.P.push([a,m1,c],[m1,b,c]);return;}
    const lj=(li+Math.floor(n/2))%n,c=Q[lj],d=Q[(lj+1)%n],m2=vAt(E,V3.mul(V3.add(E.V[c],E.V[d]),.5));
    const A=[m1],B=[m2];for(let k=(li+1)%n;;k=(k+1)%n){A.push(Q[k]);if(k===lj)break;}A.push(m2);for(let k=(lj+1)%n;;k=(k+1)%n){B.push(Q[k]);if(k===li)break;}B.push(m1);
    E.P.splice(idx,1);insertOnEdge(E,a,b,m1);insertOnEdge(E,c,d,m2);E.P.push(A,B);});
  return compact(E);}
function delPoly(E,pi,sym){E=ecopy(E);return withMirror(E,pi,sym,()=>{});}
// неплоские → выровнять (точки сдвигаются чуть-чуть) или разбить на треугольники
function nonPlanar(E,tol=.8){const r=[];E.P.forEach((Q,i)=>{if(polyDev(E.V,Q)>tol)r.push(i);});return r;}
function flattenAll(E,sym,pin){const mm=sym?mirrorMap(E.V):null,open=openVerts(E);
  const fix=(i,q)=>{if(pin!==undefined&&(i===pin||mm&&mm[pin]===i))return E.V[i].slice();if(mm&&mm[i]===-2)q[0]=0;if(open.has(i)&&Math.abs(E.V[i][2])<.5)q[2]=0;return q;};
  let V=planarize(E.V,E.P,fix,300);if(mm)V=V.map((p,i)=>mm[i]>=0&&i>mm[i]?[-V[mm[i]][0],V[mm[i]][1],V[mm[i]][2]]:p);return {V,P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())};}
function triangulateBad(E,tol=.8){const S=(E.S||[]).map(s=>s.slice());const bad=new Set(nonPlanar(E,tol));const P=[];E.P.forEach((Q,i)=>{if(!bad.has(i)){P.push(Q.slice());return;}for(let k=1;k+1<Q.length;k++)P.push([Q[0],Q[k],Q[k+1]]);});return {V:E.V.map(p=>p.slice()),P,S};}

// заготовки: куб и шар (икосаэдр, разбитый один раз), мм, спина на z=0
function blankBox(W=300,H=400,D=260){const x=W/2,V=[[-x,0,0],[x,0,0],[x,H,0],[-x,H,0],[-x,0,D],[x,0,D],[x,H,D],[-x,H,D]];
  return {V,P:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]};}
function blankSphere(R=220){const t=(1+Math.sqrt(5))/2;let V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(p=>V3.mul(V3.norm(p),R));
  let F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const mid=new Map(),m=(a,b)=>{const k=a<b?a+'_'+b:b+'_'+a;if(!mid.has(k)){V.push(V3.mul(V3.norm(V3.add(V[a],V[b])),R));mid.set(k,V.length-1);}return mid.get(k);};
  F=F.flatMap(([a,b,c])=>{const ab=m(a,b),bc=m(b,c),ca=m(c,a);return [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]];});
  // повернуть так, чтобы была симметрия по x=0, и поставить на пол
  V=V.map(([x,y,z])=>[y,z,x]);const b=meshBox(V);V=V.map(p=>[p[0],p[1]-b.min[1],p[2]-b.min[2]]);return {V,P:F};}

/* ---------- швы: убрать (слить две соседние грани) и провести (разрезать грань по прямой) ---------- */
// грань самопересекается? — контур в её плоскости
function polySelfX(V,Q){const n=Q.length;if(n<4)return false;const N=polyNorm(V,Q),o=V[Q[0]];let u=Math.abs(N[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(N,V3.dot(u,N))));const w=V3.cross(N,u);
  const P=Q.map(i=>{const d=V3.sub(V[i],o);return [V3.dot(d,u),V3.dot(d,w)];}),cr=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const X=(a,b,c,d)=>{const d1=cr(c,d,a),d2=cr(c,d,b),d3=cr(a,b,c),d4=cr(a,b,d);return d1&&d2&&d3&&d4&&(d1>0)!==(d2>0)&&(d3>0)!==(d4>0);};
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(X(P[i],P[(i+1)%n],P[j],P[(j+1)%n]))return true;}return false;}
function selfXPolys(E){const r=[];E.P.forEach((Q,i)=>{if(polySelfX(E.V,Q))r.push(i);});return r;}
// грани, которые протыкают другую грань (без общей точки): из листа не собрать — детали шли бы друг сквозь друга
// треугольники каждой грани; пары — по габаритам (сортировка по x); треугольник–треугольник: каждый пересекает плоскость другого,
// отрезки на линии пересечения плоскостей перекрываются больше eps. Касание (точкой, ребром, плоскостью) — не считаем
function triX(A,B,eps){const pl=T=>{const n=V3.cross(V3.sub(T[1],T[0]),V3.sub(T[2],T[0])),l=V3.len(n);if(l<1e-9)return null;const u=V3.mul(n,1/l);return [u,V3.dot(u,T[0])];};
  const pa=pl(A),pb=pl(B);if(!pa||!pb)return false;const dist=(T,p)=>T.map(q=>V3.dot(p[0],q)-p[1]),db=dist(B,pa),da=dist(A,pb);
  const cut=d=>Math.max(...d)>eps&&Math.min(...d)<-eps;if(!cut(da)||!cut(db))return false;
  const D=V3.cross(pa[0],pb[0]);if(V3.len(D)<1e-9)return false;
  // отрезок треугольника T на плоскости другого: точки на рёбрах, где знак расстояния меняется, → проекции на D
  const span=(T,d)=>{const t=[];for(let k=0;k<3;k++){const j=(k+1)%3;if(Math.abs(d[k])<=eps)t.push(V3.dot(D,T[k]));if((d[k]>eps&&d[j]<-eps)||(d[k]<-eps&&d[j]>eps)){const s=d[k]/(d[k]-d[j]);t.push(V3.dot(D,V3.add(T[k],V3.mul(V3.sub(T[j],T[k]),s))));}}return [Math.min(...t),Math.max(...t)];};
  const a=span(A,da),b=span(B,db);return Math.min(a[1],b[1])-Math.max(a[0],b[0])>eps*V3.len(D);}
function piercePolys(E,eps=.01){const V=E.V,F=[];E.P.forEach((Q,pi)=>{if(Q.length<3)return;const ts=Q.length===3?[Q]:earClip(V,Q),T=ts.map(t=>t.map(i=>V[i])),mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];
    T.forEach(t=>t.forEach(p=>{for(let k=0;k<3;k++){if(p[k]<mn[k])mn[k]=p[k];if(p[k]>mx[k])mx[k]=p[k];}}));F.push({pi,T,mn,mx,vs:new Set(Q)});});
  F.sort((a,b)=>a.mn[0]-b.mn[0]);const hit=new Set();
  for(let i=0;i<F.length;i++){const a=F[i];for(let j=i+1;j<F.length;j++){const b=F[j];if(b.mn[0]>a.mx[0]+eps)break;if(hit.has(a.pi)&&hit.has(b.pi))continue;
    if(b.mn[1]>a.mx[1]+eps||a.mn[1]>b.mx[1]+eps||b.mn[2]>a.mx[2]+eps||a.mn[2]>b.mx[2]+eps)continue;let sh=false;for(const v of b.vs)if(a.vs.has(v)){sh=true;break;}if(sh)continue;
    if(a.T.some(ta=>b.T.some(tb=>triX(ta,tb,eps)))){hit.add(a.pi);hit.add(b.pi);}}}
  return [...hit].sort((a,b)=>a-b);}
// есть ли у граней общее ребро
function polysAdjacent(E,a,b){const A=E.P[a],B=E.P[b];if(!A||!B||a===b)return false;const s=new Set();B.forEach((x,k)=>s.add(B[(k+1)%B.length]+'_'+x));return A.some((x,k)=>s.has(x+'_'+A[(k+1)%A.length]));}
// контур двух граней без общих рёбер; null — общих рёбер нет или их несколько участков (вышла бы дыра)
function mergeTwo(P,a,b){const es=new Map();[P[a],P[b]].forEach(Q=>Q.forEach((x,k)=>{const y=Q[(k+1)%Q.length];es.set(x+'_'+y,[x,y]);}));
  const nx=new Map();let cut=0,bad=false;es.forEach(([x,y])=>{if(es.has(y+'_'+x)){cut++;return;}if(nx.has(x))bad=true;nx.set(x,y);});if(!cut||bad)return null;
  const st=nx.keys().next().value,L=[];let v=st;while(v!==undefined&&L.length<=nx.size){L.push(v);v=nx.get(v);if(v===st)break;}
  return L.length===nx.size&&L.length>=3?L:null;}
// грань, в которой больше всего этих точек (номера граней после правок сдвигаются)
function findPoly(E,vs){let bi=-1,bn=0;E.P.forEach((Q,i)=>{const n=Q.filter(x=>vs.includes(x)).length;if(n>bn){bn=n;bi=i;}});return bi;}
// убрать шов: грани a и b — одна; с симметрией — и зеркальные; потом всё выравниваем в плоскость
function mergePolys(E,a,b,sym){E=ecopy(E);const mm=sym?mirrorMap(E.V):null,ma=sym?mirrorPoly(E,a,mm):-1,mb=sym?mirrorPoly(E,b,mm):-1,A2=ma>=0?E.P[ma].slice():null,B2=mb>=0?E.P[mb].slice():null;
  const one=(i,j)=>{const L=mergeTwo(E.P,i,j);if(!L)return false;E.P.splice(Math.max(i,j),1);E.P.splice(Math.min(i,j),1);E.P.push(L);return true;};
  if(!one(a,b))return null;
  if(A2&&B2&&!(ma===a&&mb===b)&&!(ma===b&&mb===a)){const i=findPoly(E,A2),j=findPoly(E,B2);if(i>=0&&j>=0&&i!==j)one(i,j);}
  return flattenAll(compact(E),sym);}
// провести шов: грань pi режется по прямой между её точками va и vb (не соседними); с симметрией — и зеркальная
function cutPoly(E,pi,va,vb,sym){E=ecopy(E);const mm=sym?mirrorMap(E.V):null,mr=i=>mm[i]===-2?i:mm[i],jobs=[[va,vb]];
  if(sym&&mm[va]!==-1&&mm[vb]!==-1){const a2=mr(va),b2=mr(vb);if(!(a2===va&&b2===vb)&&!(a2===vb&&b2===va))jobs.push([a2,b2]);}
  let done=0;jobs.forEach(([a,b],k)=>{const i=k?E.P.findIndex(Q=>Q.includes(a)&&Q.includes(b)&&!polyHasEdge(Q,a,b)):pi;if(i<0)return;const Q=E.P[i],ia=Q.indexOf(a),ib=Q.indexOf(b),n=Q.length;
    if(ia<0||ib<0||ia===ib||(ia+1)%n===ib||(ib+1)%n===ia)return;const A=[],B=[];for(let j=ia;;j=(j+1)%n){A.push(Q[j]);if(j===ib)break;}for(let j=ib;;j=(j+1)%n){B.push(Q[j]);if(j===ia)break;}
    E.P.splice(i,1,A,B);E.S.push([a,b]);done++;});
  return done?E:null;}
const polyHasEdge=(Q,a,b)=>Q.some((x,k)=>{const y=Q[(k+1)%Q.length];return x===a&&y===b||x===b&&y===a;});
// новая точка p на ребре a–b (у всех граней с этим ребром); с симметрией — и на зеркальном ребре. Возвращает {E,m} — m номер точки
function addEdgePoint(E,a,b,p,sym){E=ecopy(E);const mm=sym?mirrorMap(E.V):null,q=p.slice();
  const midE=sym&&(mm[a]===-2&&mm[b]===-2||mm[a]===b);if(midE)q[0]=0;
  const ins=(x,y,r)=>{E.V.push(r);const m=E.V.length-1;insertOnEdge(E,x,y,m);E.S=E.S.flatMap(s=>s[0]===x&&s[1]===y||s[0]===y&&s[1]===x?[[s[0],m],[m,s[1]]]:[s]);return m;},m=ins(a,b,q);
  if(sym&&!midE&&mm[a]!==-1&&mm[b]!==-1){const a2=mm[a]===-2?a:mm[a],b2=mm[b]===-2?b:mm[b];if(!(a2===a&&b2===b)&&!(a2===b&&b2===a))ins(a2,b2,[-q[0],q[1],q[2]]);}
  return {E,m};}
