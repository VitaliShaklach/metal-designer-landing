/* ---------- калька: рисунок эталона (облако точек с цветом) прямо на гранях нашей модели + магнит к швам ----------
   облако — в кадре эталона (мм модели из MODELS_POLY); текущая фигура может быть растянута — map переводит её точки туда */
const TR_CELL=2,TR_SEAM=22,TR_RUST=26;   // шаг облака, мм (как в tools/plates/tracing.js): в клетке не больше одной точки; насколько шов светлее соседей, ржавчина темнее
// base64 → {P:xyz мм, C:rgb, S: 1 — светлый шов, 2 — тёмное (глаза), G — сетка клеток TR_CELL: индекс точки+1}
function traceLoad(b64){const bin=typeof atob==='function'?atob(b64):Buffer.from(b64,'base64').toString('binary'),n=bin.length/9|0,dv=new DataView(new ArrayBuffer(n*9));
  for(let i=0;i<n*9;i++)dv.setUint8(i,bin.charCodeAt(i));
  const P=new Float32Array(n*3),C=new Uint8Array(n*3),S=new Uint8Array(n),mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(let i=0;i<n;i++){const o=i*9;for(let k=0;k<3;k++){const x=dv.getInt16(o+k*2,true)/10;P[i*3+k]=x;if(x<mn[k])mn[k]=x;if(x>mx[k])mx[k]=x;C[i*3+k]=dv.getUint8(o+6+k);}
  }
  const o0=mn.map(x=>Math.floor(x/TR_CELL)-1),dim=mx.map((x,k)=>Math.floor(x/TR_CELL)-o0[k]+2),G=new Int32Array(dim[0]*dim[1]*dim[2]),t={n,P,C,S,G,o0,dim};
  for(let i=0;i<n;i++){const c=traceCell(t,P[i*3],P[i*3+1],P[i*3+2]);if(c>=0)G[c]=i+1;}
  // шов на текстуре эталона — светлая серая линия (точка заметно светлее соседей в 4 мм; линия ~1 мм, после усреднения — 150…200)
  // или ржавая полоса сварки (темнее соседей, рыжеватая); совсем тёмное (< 45) — глаза
  const lum=new Float32Array(n);for(let i=0;i<n;i++)lum[i]=.3*C[i*3]+.59*C[i*3+1]+.11*C[i*3+2];const [X,Y,Z]=dim;let ns=0;
  for(let i=0;i<n;i++){const r=C[i*3],g=C[i*3+1],b=C[i*3+2],sat=Math.max(r,g,b)-Math.min(r,g,b);
    const ci=Math.floor(P[i*3]/TR_CELL)-o0[0],cj=Math.floor(P[i*3+1]/TR_CELL)-o0[1],ck=Math.floor(P[i*3+2]/TR_CELL)-o0[2];let sum=0,cnt=0;
    for(let k=ck-2;k<=ck+2;k++)for(let j=cj-2;j<=cj+2;j++)for(let a=ci-2;a<=ci+2;a++){if(a<0||j<0||k<0||a>=X||j>=Y||k>=Z)continue;const q=G[(k*Y+j)*X+a]-1;if(q>=0){sum+=lum[q];cnt++;}}
    const av=sum/cnt;if(lum[i]<45&&av<70){S[i]=2;continue;}   // глаз: тёмное среди тёмного
    if(lum[i]>av+TR_SEAM&&sat<60&&lum[i]>=120||lum[i]<av-TR_RUST&&r>=b&&r>=g-5){S[i]=1;ns++;}}
  t.seams=ns;return t;}
function traceCell(t,x,y,z){const i=Math.floor(x/TR_CELL)-t.o0[0],j=Math.floor(y/TR_CELL)-t.o0[1],k=Math.floor(z/TR_CELL)-t.o0[2];
  return i<0||j<0||k<0||i>=t.dim[0]||j>=t.dim[1]||k>=t.dim[2]?-1:(k*t.dim[1]+j)*t.dim[0]+i;}
// ближайшая точка облака к p в соседних клетках (±r клеток); -1 — нет
function traceNear(t,x,y,z,r=1,want=0){const ci=Math.floor(x/TR_CELL)-t.o0[0],cj=Math.floor(y/TR_CELL)-t.o0[1],ck=Math.floor(z/TR_CELL)-t.o0[2],[X,Y,Z]=t.dim;let best=-1,bd=1e9;
  for(let k=ck-r;k<=ck+r;k++){if(k<0||k>=Z)continue;for(let j=cj-r;j<=cj+r;j++){if(j<0||j>=Y)continue;const row=(k*Y+j)*X;for(let i=ci-r;i<=ci+r;i++){if(i<0||i>=X)continue;const q=t.G[row+i]-1;if(q<0||want&&t.S[q]!==want)continue;
    const dx=t.P[q*3]-x,dy=t.P[q*3+1]-y,dz=t.P[q*3+2]-z,d=dx*dx+dy*dy+dz*dz;if(d<bd){bd=d;best=q;}}}}return best;}
// текущий размер фигуры → кадр эталона: поосевой масштаб по габаритам (b0 — эталон, b1 — сейчас); s — масштаб «эталон/сейчас»
function traceMap(b0,b1){const s=[0,1,2].map(k=>b0.size[k]/(b1.size[k]||1)),c0=(b0.min[0]+b0.max[0])/2,c1=(b1.min[0]+b1.max[0])/2;
  const f=p=>[(p[0]-c1)*s[0]+c0,(p[1]-b1.min[1])*s[1]+b0.min[1],(p[2]-b1.min[2])*s[2]+b0.min[2]];f.s=s;
  f.inv=p=>[(p[0]-c0)/s[0]+c1,(p[1]-b0.min[1])/s[1]+b1.min[1],(p[2]-b0.min[2])/s[2]+b1.min[2]];return f;}
/* атлас: каждая грань-многоугольник — прямоугольник в своей плоскости (шаг tx мм), раскладка полками; тексель → точка грани → кадр эталона →
   ближайшая точка облака (сперва рядом, потом вдоль нормали ±2…6 мм — грани у нас выровнены и могут отходить от поверхности эталона) */
function traceAtlas(V,P,F,T,map,t,tx=2){const AW=2048,PAD=2;
  const R=P.map(Q=>{const N=polyNorm(V,Q),o=V[Q[0]];let u=Math.abs(N[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(N,V3.dot(u,N))));const w=V3.cross(N,u);
    const q=Q.map(i=>{const d=V3.sub(V[i],o);return [V3.dot(d,u),V3.dot(d,w)];}),x0=Math.min(...q.map(p=>p[0])),y0=Math.min(...q.map(p=>p[1]));
    return {N,o,u,w,x0,y0,q,cw:Math.ceil((Math.max(...q.map(p=>p[0]))-x0)/tx)+PAD*2,ch:Math.ceil((Math.max(...q.map(p=>p[1]))-y0)/tx)+PAD*2};});
  if(R.some(r=>r.cw>AW))return traceAtlas(V,P,F,T,map,t,tx*1.5);
  const ord=R.map((_,i)=>i).sort((a,b)=>R[b].ch-R[a].ch);let x=0,y=0,sh=0;
  ord.forEach(i=>{const r=R[i];if(x+r.cw>AW){x=0;y+=sh;sh=0;}r.ax=x;r.ay=y;x+=r.cw;sh=Math.max(sh,r.ch);});
  const H=y+sh;if(H>4096)return traceAtlas(V,P,F,T,map,t,tx*Math.sqrt(H/4096)*1.05);
  // map — поосевое растяжение со сдвигом: точку грани o+u·a+w·b считаем в кадре эталона сразу, без массивов
  const data=new Uint8Array(AW*H*4),s=map.s,OFF=[2,-2,4,-4,6,-6];let inn=0,hit=0;
  R.forEach(r=>{const nr=V3.norm([r.N[0]/s[0],r.N[1]/s[1],r.N[2]/s[2]]),mo=map(r.o),mu=[r.u[0]*s[0],r.u[1]*s[1],r.u[2]*s[2]],mw=[r.w[0]*s[0],r.w[1]*s[1],r.w[2]*s[2]];
    // маска: внутри грани + PAD текселей вокруг (их берёт сглаживание текстуры); дальше — не ищем
    const W=r.cw,M=new Uint8Array(W*r.ch);for(let j=0;j<r.ch;j++)for(let i=0;i<W;i++)if(inPoly2(r.q,r.x0+(i-PAD+.5)*tx,r.y0+(j-PAD+.5)*tx))M[j*W+i]=2;
    for(let g=0;g<PAD;g++){const M0=M.slice();for(let j=0;j<r.ch;j++)for(let i=0;i<W;i++){if(M0[j*W+i])continue;let n=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const jj=j+dj,ii=i+di;if(jj>=0&&ii>=0&&jj<r.ch&&ii<W&&M0[jj*W+ii])n=1;}if(n)M[j*W+i]=1;}}
    for(let j=0;j<r.ch;j++){const b=r.y0+(j-PAD+.5)*tx;for(let i=0;i<r.cw;i++){const o=((r.ay+j)*AW+r.ax+i)*4,mk=M[j*W+i];data[o+3]=255;if(!mk){data[o]=data[o+1]=data[o+2]=170;continue;}
      const a=r.x0+(i-PAD+.5)*tx,x=mo[0]+mu[0]*a+mw[0]*b,y=mo[1]+mu[1]*a+mw[1]*b,z=mo[2]+mu[2]*a+mw[2]*b;
      let q=traceNear(t,x,y,z);for(let k=0;q<0&&k<OFF.length;k++)q=traceNear(t,x+nr[0]*OFF[k],y+nr[1]*OFF[k],z+nr[2]*OFF[k]);
      if(q>=0){data[o]=t.C[q*3];data[o+1]=t.C[q*3+1];data[o+2]=t.C[q*3+2];}else{data[o]=data[o+1]=data[o+2]=170;}
      if(mk===2){inn++;if(q>=0)hit++;}}}});
  // uv — на каждую вершину треугольников F, по порядку как в build3D
  const uv=new Float32Array(F.length*6);F.forEach((f,fi)=>{const r=R[T[fi]];f.forEach((v,k)=>{const d=V3.sub(V[v],r.o);
    uv[fi*6+k*2]=(r.ax+PAD+(V3.dot(d,r.u)-r.x0)/tx)/AW;uv[fi*6+k*2+1]=(r.ay+PAD+(V3.dot(d,r.w)-r.y0)/tx)/H;});});
  return {W:AW,H,data,uv,tx,cover:inn?hit/inn:0};}
function inPoly2(q,x,y){let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[i],b=q[j];if(a[1]>y!==b[1]>y&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
/* магнит: клик у ребра A–B (текущие мм) → место на ребре, где к нему подходит светлый шов эталона (в 12 мм от клика вдоль ребра); null — такого нет.
   шов поперёк ребра виден точками в стороне от ребра (2,5…6 мм) — по ним и ищем, самые близкие к ребру = место встречи; шов вдоль ребра (всё вплотную) — не повод ставить точку.
   end — сколько мм оставить до концов ребра */
function seamOnEdge(A,B,click,map,t,end=8){const a=map(A),b=map(B),ab=V3.sub(b,a),L=V3.len(ab);if(L<2*end+1)return null;const tc=V3.dot(V3.sub(map(click),a),ab)/(L*L),seen=new Set(),C=[],[X,Y,Z]=t.dim;
  for(let d=-12;d<=12;d+=1.5){const u=tc+d/L;if(u*L<end-2||(1-u)*L<end-2)continue;const p=V3.add(a,V3.mul(ab,u)),ci=Math.floor(p[0]/TR_CELL)-t.o0[0],cj=Math.floor(p[1]/TR_CELL)-t.o0[1],ck=Math.floor(p[2]/TR_CELL)-t.o0[2];
    for(let k=ck-3;k<=ck+3;k++){if(k<0||k>=Z)continue;for(let j=cj-3;j<=cj+3;j++){if(j<0||j>=Y)continue;for(let i=ci-3;i<=ci+3;i++){if(i<0||i>=X)continue;const q=t.G[(k*Y+j)*X+i]-1;if(q<0||t.S[q]!==1||seen.has(q))continue;seen.add(q);
      const w=[t.P[q*3]-a[0],t.P[q*3+1]-a[1],t.P[q*3+2]-a[2]],u2=V3.dot(w,ab)/(L*L),pd=V3.len(V3.sub(w,V3.mul(ab,u2)));if(pd<=6&&Math.abs(u2-tc)*L<=12&&u2*L>=end&&(1-u2)*L>=end)C.push({u:u2,pd});}}}}
  const off=C.filter(c=>c.pd>=2.5);let pick;
  if(off.length)pick=off.reduce((x,y)=>y.pd+Math.abs(y.u-tc)*L*.15<x.pd+Math.abs(x.u-tc)*L*.15?y:x);
  else{if(!C.length)return null;const us=C.map(c=>c.u);if((Math.max(...us)-Math.min(...us))*L>6)return null;pick=C.reduce((x,y)=>y.pd<x.pd?y:x);}
  const near=(off.length?off:C).filter(c=>Math.abs(c.u-pick.u)*L<=3&&c.pd<=pick.pd+2),u=near.reduce((s,c)=>s+c.u,0)/near.length;
  return V3.add(A,V3.mul(V3.sub(B,A),u));}
/* расхождения с эталоном: E — наши швы [{a,b,open}] (R.edges), V — текущие мм. Наши швы почти все чуть сдвинуты от эталона (выравнивание граней) —
   это видно на самой кальке; подсвечиваем только то, что исправляется швами:
   red — наш шов, у которого шва эталона нет и в TR_FAR мм (по медиане вдоль ребра) — кандидат «Убрать шов»;
   yel — точки швов эталона на нашей поверхности (ближе TR_SURF мм; дальше — это уже разница формы, не шва) и дальше TR_FAR мм от любого нашего шва, кучками (одиночные пятна текстуры не в счёт) — кандидат «Провести шов»; parts — сколько таких участков;
   on — доля длины наших швов, что лежит на шве эталона (медиана ≤ TR_NEAR), near — ≤ TR_FAR */
const TR_NEAR=4,TR_FAR=10,TR_SURF=5;
function traceDiff(E,V,F,map,t){const red=[],ST=2;let tot=0,on=0,nr=0;const G=new Map(),gk=(x,y,z)=>Math.floor(x/TR_FAR)+','+Math.floor(y/TR_FAR)+','+Math.floor(z/TR_FAR);
  E.forEach((e,i)=>{const A=V[e.a],B=V[e.b],L=V3.len(V3.sub(B,A)),n=Math.max(2,Math.round(L/ST)),ds=[];
    for(let k=0;k<=n;k++){const p=V3.add(A,V3.mul(V3.sub(B,A),k/n)),key=gk(...p);let c=G.get(key);if(!c)G.set(key,c=[]);c.push(p);
      if(e.open||k===0||k===n)continue;const q=map(p),dd=j=>j<0?1e9:Math.hypot(t.P[j*3]-q[0],t.P[j*3+1]-q[1],t.P[j*3+2]-q[2]);let d=dd(traceNear(t,q[0],q[1],q[2],2,1));if(d>TR_NEAR)d=Math.min(d,dd(traceNear(t,q[0],q[1],q[2],5,1)));ds.push(d);}
    if(e.open||!ds.length)return;ds.sort((x,y)=>x-y);const md=ds[ds.length>>1];tot+=L;if(md<=TR_NEAR)on+=L;if(md<=TR_FAR)nr+=L;else red.push(i);});
  // наша поверхность — занятые клетки по TR_SURF/2 мм
  const SG=new Set(),sk=(i,j,k)=>((i+256)*512+j+256)*512+k+256,R2=TR_SURF/2;   // клетки по TR_SURF/2 мм, где есть наша поверхность; ключ < 2³¹ — быстрый
  // растр в плоскости треугольника через 2 мм + его стороны: выборок ~ площадь, а не квадрат длинной стороны (у тонких треугольников)
  const put=(x,y,z)=>SG.add(sk(Math.floor(x/R2),Math.floor(y/R2),Math.floor(z/R2)));
  F.forEach(f=>{const A=V[f[0]],B=V[f[1]],C=V[f[2]],u=V3.sub(B,A),Lu=V3.len(u);if(Lu<1e-9)return;const ex=V3.mul(u,1/Lu),w=V3.sub(C,A),N=V3.cross(u,w);if(V3.len(N)<1e-9)return;
    const ey=V3.norm(V3.cross(V3.norm(N),ex)),cx=V3.dot(w,ex),cy=V3.dot(w,ey);
    [[A,B],[B,C],[C,A]].forEach(([P,Q])=>{const n=Math.ceil(V3.len(V3.sub(Q,P))/2);for(let k=0;k<=n;k++)put(P[0]+(Q[0]-P[0])*k/n,P[1]+(Q[1]-P[1])*k/n,P[2]+(Q[2]-P[2])*k/n);});
    const x0=Math.min(0,cx),x1=Math.max(Lu,cx);for(let y=1;y<cy;y+=2)for(let x=x0+1;x<x1;x+=2){const b2=y/cy,a2=(x-cx*b2)/Lu;if(a2<0||a2+b2>1)continue;
      put(A[0]+ex[0]*x+ey[0]*y,A[1]+ex[1]*x+ey[1]*y,A[2]+ex[2]*x+ey[2]*y);}});
  // ближе ~TR_SURF: в своей клетке или в соседних ±2 (по шару)
  const onSurf=p=>{const g=p.map(x=>Math.floor(x/R2));for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++){if(dx*dx+dy*dy+dz*dz>5)continue;if(SG.has(sk(g[0]+dx,g[1]+dy,g[2]+dz)))return true;}return false;};
  const far=new Map();for(let i=0;i<t.n;i++){if(t.S[i]!==1)continue;const p=map.inv([t.P[i*3],t.P[i*3+1],t.P[i*3+2]]);if(p[2]<3)continue;   // у стены — не фигура
    const g=p.map(x=>Math.floor(x/TR_FAR));let near=false;
    for(let dx=-1;dx<=1&&!near;dx++)for(let dy=-1;dy<=1&&!near;dy++)for(let dz=-1;dz<=1&&!near;dz++){const c=G.get((g[0]+dx)+','+(g[1]+dy)+','+(g[2]+dz));if(c)for(const q of c)if(Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<=TR_FAR){near=true;break;}}
    if(!near&&onSurf(p))far.set(i,p);}
  // участки: точки, связанные через соседние клетки (≤ 2 клетки); участок короче 4 точек — пятно, не шов
  const [X,Y,Z]=t.dim,lab=new Map(),yel=[];let parts=0;
  far.forEach((_,s0)=>{if(lab.has(s0))return;const comp=[s0];lab.set(s0,1);for(let h=0;h<comp.length;h++){const i=comp[h],ci=Math.floor(t.P[i*3]/TR_CELL)-t.o0[0],cj=Math.floor(t.P[i*3+1]/TR_CELL)-t.o0[1],ck=Math.floor(t.P[i*3+2]/TR_CELL)-t.o0[2];
      for(let k=ck-2;k<=ck+2;k++)for(let j=cj-2;j<=cj+2;j++)for(let a=ci-2;a<=ci+2;a++){if(a<0||j<0||k<0||a>=X||j>=Y||k>=Z)continue;const q=t.G[(k*Y+j)*X+a]-1;if(q>=0&&far.has(q)&&!lab.has(q)){lab.set(q,1);comp.push(q);}}}
    if(comp.length<4)return;parts++;comp.forEach(i=>yel.push(...far.get(i)));});
  return {red,yel:new Float32Array(yel),on:tot?on/tot:0,near:tot?nr/tot:0,parts};}
