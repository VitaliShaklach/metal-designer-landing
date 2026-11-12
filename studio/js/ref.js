/* ---------- эталон: похожесть (правило 11), изломы и линии (правило 7) ----------
   Обычный скрипт: в браузере — рядом с движком editor/lynx/js, в Node — в одном vm-контексте с ним (studio/lib/engine.js);
   refFrame берёт и studio/lib/refbuild.js через require.
   Эталон ref = {V, F, trace} — сетка Meshy в рамке модели (выбранная половина и её зеркало, studio/lib/refbuild.js),
   trace — калька в формате trace.js (base64) или null. Вместо эталона можно дать фигуру {V, P}: так похожесть меряется
   от открытой фигуры, когда эталона нет. Всё в мм модели; faceDev — в мм сайта (мм модели × scale). */

// рамка конвейеров: высота 600, x по центру, низ y = 0, z от 0 (C:\dev\metal-designer\art\tools\plates\ref.js)
function refFrame(V){const mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];
  V.forEach(p=>{for(let i=0;i<3;i++){if(p[i]<mn[i])mn[i]=p[i];if(p[i]>mx[i])mx[i]=p[i];}});
  const k=600/((mx[1]-mn[1])||1),cx=(mn[0]+mx[0])/2;return V.map(p=>[(p[0]-cx)*k,(p[1]-mn[1])*k,(p[2]-mn[2])*k]);}

// индекс эталона: треугольники в равномерной сетке (клетка — медиана ребра: так меньше всего треугольников на запрос), нормали, калька через traceLoad
function refIndex(ref){const V=ref.V,X=[],N=[],L=[];
  const tris=ref.F?ref.F:ref.P.flatMap(Q=>new Set(Q).size<3?[]:earClip(V,Q));
  tris.forEach(t=>{if(t.length!==3)return;const a=V[t[0]],b=V[t[1]],c=V[t[2]],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(n[0],n[1],n[2]);if(l<1e-12)return;   // нулевая площадь — не поверхность
    X.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);N.push(n[0]/l,n[1]/l,n[2]/l);L.push(Math.hypot(...u),Math.hypot(...w));});
  const n=N.length/3,Xa=Float64Array.from(X),mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];
  for(let i=0;i<n*9;i++){const k=i%3;if(Xa[i]<mn[k])mn[k]=Xa[i];if(Xa[i]>mx[k])mx[k]=Xa[i];}
  L.sort((a,b)=>a-b);const cell=Math.max(.5,L[L.length>>1]||1),dim=[0,1,2].map(k=>n?Math.floor((mx[k]-mn[k])/cell)+1:1),G=new Map();
  for(let t=0;t<n;t++){const lo=[0,1,2].map(k=>Math.floor((Math.min(Xa[t*9+k],Xa[t*9+3+k],Xa[t*9+6+k])-mn[k])/cell)),hi=[0,1,2].map(k=>Math.floor((Math.max(Xa[t*9+k],Xa[t*9+3+k],Xa[t*9+6+k])-mn[k])/cell));
    for(let i=lo[0];i<=hi[0];i++)for(let j=lo[1];j<=hi[1];j++)for(let k=lo[2];k<=hi[2];k++){const key=(i*dim[1]+j)*dim[2]+k;let c=G.get(key);if(!c)G.set(key,c=[]);c.push(t);}}
  return {isRef:true,n,X:Xa,N:Float64Array.from(N),cell,o:n?mn:[0,0,0],dim,G,mark:new Int32Array(n),stamp:0,T:ref.trace?traceLoad(ref.trace):null};}

// ближайшая точка треугольника t к p (Эриксон, «Real-Time Collision Detection» 5.1.5) → квадрат расстояния, точка — в q
function refTriNear(X,t,p,q){const o=t*9,ax=X[o],ay=X[o+1],az=X[o+2],abx=X[o+3]-ax,aby=X[o+4]-ay,abz=X[o+5]-az,acx=X[o+6]-ax,acy=X[o+7]-ay,acz=X[o+8]-az;
  const apx=p[0]-ax,apy=p[1]-ay,apz=p[2]-az,d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;let v=0,w=0;
  if(d1<=0&&d2<=0){v=0;w=0;}else{const bpx=apx-abx,bpy=apy-aby,bpz=apz-abz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
    if(d3>=0&&d4<=d3){v=1;w=0;}else{const vc=d1*d4-d3*d2;
      if(vc<=0&&d1>=0&&d3<=0){v=d1/(d1-d3);w=0;}else{const cpx=apx-acx,cpy=apy-acy,cpz=apz-acz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
        if(d6>=0&&d5<=d6){v=0;w=1;}else{const vb=d5*d2-d1*d6;
          if(vb<=0&&d2>=0&&d6<=0){v=0;w=d2/(d2-d6);}else{const va=d3*d6-d5*d4;
            if(va<=0&&d4-d3>=0&&d5-d6>=0){w=(d4-d3)/((d4-d3)+(d5-d6));v=1-w;}else{const den=1/(va+vb+vc);v=vb*den;w=vc*den;}}}}}}
  q[0]=ax+abx*v+acx*w;q[1]=ay+aby*v+acy*w;q[2]=az+abz*v+acz*w;return (q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2;}

// ближайшее место эталона к p: {d — мм модели, q — точка, t — треугольник}; поиск кольцами клеток вокруг клетки p,
// пока ближайшее не ближе стенок уже просмотренного куба клеток (треугольники за ними — дальше)
function refNear(R,p){const c=R.cell,o=R.o,[DX,DY,DZ]=R.dim,ci=Math.floor((p[0]-o[0])/c),cj=Math.floor((p[1]-o[1])/c),ck=Math.floor((p[2]-o[2])/c);
  const st=++R.stamp,q=[0,0,0],bq=[0,0,0],G=R.G,M=R.mark,X=R.X;let best=Infinity,bt=-1;
  const km=Math.max(ci,DX-1-ci,cj,DY-1-cj,ck,DZ-1-ck,0);
  // до стенок своей клетки по каждой оси (меньшая из двух сторон); куб k колец — на k клеток дальше
  const w=Math.min(p[0]-o[0]-ci*c,(ci+1)*c-p[0]+o[0],p[1]-o[1]-cj*c,(cj+1)*c-p[1]+o[1],p[2]-o[2]-ck*c,(ck+1)*c-p[2]+o[2]);
  const scan=(i,j,k)=>{if(i<0||j<0||k<0||i>=DX||j>=DY||k>=DZ)return;const L=G.get((i*DY+j)*DZ+k);if(!L)return;
    for(let n=0;n<L.length;n++){const t=L[n];if(M[t]===st)continue;M[t]=st;const d=refTriNear(X,t,p,q);if(d<best){best=d;bt=t;bq[0]=q[0];bq[1]=q[1];bq[2]=q[2];}}};
  for(let k=0;k<=km;k++){
    for(let dx=-k;dx<=k;dx++)for(let dy=-k;dy<=k;dy++){if(dx===k||dx===-k||dy===k||dy===-k)for(let dz=-k;dz<=k;dz++)scan(ci+dx,cj+dy,ck+dz);else{scan(ci+dx,cj+dy,ck-k);if(k)scan(ci+dx,cj+dy,ck+k);}}
    const wk=Math.max(0,w)+k*c;if(best<=wk*wk)break;}
  return {d:Math.sqrt(best),q:bq,t:bt};}
function refDist(R,p){return refNear(R,p).d;}

// наибольшее отклонение каждой грани от эталона, мм сайта: точки грани и сетка внутри неё через 10 мм сайта, потом мельче — вокруг худшей.
// У массива поле pos — место худшего отклонения каждой грани (мм модели)
function faceDev(E,R,scale){const V=E.V,P=E.P,h=10/scale,out=new Float64Array(P.length),at=[];
  P.forEach((Q,fi)=>{const T=new Set(Q).size<3?[]:earClip(V,Q).filter(t=>t.length===3);let best=-1,bp=null,bt=null,ba=0,bb=0,bn=1;
    const pt=(t,a,b)=>{const A=V[t[0]],B=V[t[1]],C=V[t[2]];return [A[0]+(B[0]-A[0])*a+(C[0]-A[0])*b,A[1]+(B[1]-A[1])*a+(C[1]-A[1])*b,A[2]+(B[2]-A[2])*a+(C[2]-A[2])*b];};
    const tryP=(t,a,b,n)=>{const p=pt(t,a,b),d=refDist(R,p);if(d>best){best=d;bp=p;bt=t;ba=a;bb=b;bn=n;}};
    T.forEach(t=>{const A=V[t[0]],B=V[t[1]],C=V[t[2]],L=Math.max(V3.len(V3.sub(B,A)),V3.len(V3.sub(C,B)),V3.len(V3.sub(A,C))),n=Math.max(1,Math.ceil(L/h));
      for(let i=0;i<=n;i++)for(let j=0;i+j<=n;j++)tryP(t,i/n,j/n,n);});
    // уточнение: два круга 5 × 5 вокруг худшей точки (шаг 1/2 и 1/8 шага сетки, внутри её треугольника)
    if(bt)for(let r=0,s=1/(2*bn);r<2;r++,s/=4){const a0=ba,b0=bb;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const a=a0+i*s,b=b0+j*s;if((i||j)&&a>=-1e-12&&b>=-1e-12&&a+b<=1+1e-12)tryP(bt,a,b,bn);}}
    out[fi]=Math.max(0,best)*scale;at.push(bp||(Q.length?V[Q[0]].slice():[0,0,0]));});
  out.pos=at;return out;}

// почему шов между гранями с нормалями n1, n2 нужен: на эталоне излом ≥ seam° (нормали эталона по обе стороны шва в 1,5 и 3 мм сайта)
// или нарисованная линия (калька: светлый шов или ржавчина ближе 3 мм сайта). es — общие рёбра [{a, b}]; по медиане выборок через 5 мм сайта
function refSeam(R,V,es,n1,n2,scale,seam){const D=3/scale,nm=V3.norm(V3.add(n1,n2)),cr=[],ln=[],T=R.T,rc=T?Math.ceil(D/TR_CELL)+1:0,cosS=Math.cos(seam*Math.PI/180);
  es.forEach(e=>{const A=V[e.a],B=V[e.b],L=V3.len(V3.sub(B,A)),u=V3.mul(V3.sub(B,A),1/(L||1)),dir=V3.norm(V3.cross(u,nm)),n=Math.max(1,Math.round(L*scale/5));
    for(let k=0;k<n;k++){const m=V3.add(A,V3.mul(V3.sub(B,A),(k+.5)/n));
      let c=1;[D/2,D].forEach(d=>{const a=refNear(R,V3.add(m,V3.mul(dir,d))).t,b=refNear(R,V3.sub(m,V3.mul(dir,d))).t;
        if(a>=0&&b>=0)c=Math.min(c,Math.abs(R.N[a*3]*R.N[b*3]+R.N[a*3+1]*R.N[b*3+1]+R.N[a*3+2]*R.N[b*3+2]));});   // |cos|: обход треугольников Meshy бывает разный
      cr.push(c);
      if(T){const q=refNear(R,m).q,j=traceNear(T,q[0],q[1],q[2],rc,1);ln.push(j<0?Infinity:Math.hypot(T.P[j*3]-q[0],T.P[j*3+1]-q[1],T.P[j*3+2]-q[2]));}}});
  const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
  return {crease:cr.length>0&&med(cr)<=cosS,line:ln.length>0&&med(ln)<=D};}

// грани половины фигуры (для замера похожести по половине, как в спеке): из зеркальной пары — та, что ближе к своей стороне;
// грань поперёк середины (сама себе зеркальная) — тоже; грань без пары (хвост рыси) — по своему центру.
// У рыси 14 слева 557 из 1133 (в замере спеки 10.11 — 558: одна пара у неё несимметрична на 0,6 мм)
function refHalf(E,half='left'){const s=half==='right'?-1:1,mm=mirrorMap(E.V),C=E.P.map(Q=>polyC(E.V,Q)[0]*s),K=new Map(),key=Q=>[...Q].sort((a,b)=>a-b).join();
  E.P.forEach((Q,i)=>K.set(key(Q),i));
  return E.P.map((Q,i)=>{const m=Q.map(v=>mm[v]===-2?v:mm[v]),j=m.some(v=>v<0)?undefined:K.get(key(m));return j===undefined?C[i]<0:j===i||C[i]<C[j];})
    .map((b,i)=>b?i:-1).filter(i=>i>=0);}

if(typeof module!=='undefined')module.exports={refFrame};
