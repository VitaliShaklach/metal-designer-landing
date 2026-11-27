/* ---------- Оригинал для обводки (#175): чистые функции режима — браузер и Node (tools/ow-core.test.js) ---------- */
// Сетка клеток по треугольникам: точка под курсором на модели в 158 тыс. треугольников без перебора всех (луч идёт по клеткам, проверяет только их треугольники).
// V — Float32Array xyz, F — Uint32Array по 3 индекса. h — сторона клетки, мм (по умолчанию — из числа треугольников: ~десяток на клетку у поверхности).
function owGrid(V,F,h){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++){const x=V[i+k];if(x<min[k])min[k]=x;if(x>max[k])max[k]=x;}
  for(let k=0;k<3;k++){min[k]-=1e-3;max[k]+=1e-3;}
  const nt=F.length/3,size=max.map((x,k)=>x-min[k]),big=Math.max(...size);if(!h)h=big/Math.max(1,1.6*Math.cbrt(nt));
  const n=size.map(s=>Math.max(1,Math.min(512,Math.ceil(s/h)))),cs=size.map((s,k)=>s/n[k]),nc=n[0]*n[1]*n[2];
  const cell=(x,k)=>Math.max(0,Math.min(n[k]-1,Math.floor((x-min[k])/cs[k])));
  // в каждую клетку, куда заходит габарит треугольника (границы включительно: треугольник на стыке клеток — в обеих, луч по краю не проскочит)
  const box=new Int32Array(nt*6);for(let t=0;t<nt;t++){const a=F[t*3]*3,b=F[t*3+1]*3,c=F[t*3+2]*3;
    for(let k=0;k<3;k++){const lo=Math.min(V[a+k],V[b+k],V[c+k]),hi=Math.max(V[a+k],V[b+k],V[c+k]);box[t*6+k]=cell(lo,k);box[t*6+3+k]=cell(hi,k);}}
  const start=new Uint32Array(nc+1);
  for(let t=0;t<nt;t++){const q=t*6;for(let z=box[q+2];z<=box[q+5];z++)for(let y=box[q+1];y<=box[q+4];y++)for(let x=box[q];x<=box[q+3];x++)start[(z*n[1]+y)*n[0]+x+1]++;}
  for(let i=0;i<nc;i++)start[i+1]+=start[i];
  const list=new Uint32Array(start[nc]),fill=start.slice(0,nc);
  for(let t=0;t<nt;t++){const q=t*6;for(let z=box[q+2];z<=box[q+5];z++)for(let y=box[q+1];y<=box[q+4];y++)for(let x=box[q];x<=box[q+3];x++)list[fill[(z*n[1]+y)*n[0]+x]++]=t;}
  return {V,F,min,max,n,cs,start,list,stamp:new Uint32Array(nt),mark:0};}
// Луч o + d·t (t > 0) по сетке: ближайший треугольник, обе стороны. → {t, tri, u, v} (u, v — барицентрические у 2-й и 3-й точки) или null
function owRay(G,o,d){const {V,F,min,max,n,cs,start,list,stamp}=G;let t0=0,t1=Infinity;
  for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-12){if(o[k]<min[k]||o[k]>max[k])return null;continue;}
    const ta=(min[k]-o[k])/d[k],tb=(max[k]-o[k])/d[k];t0=Math.max(t0,Math.min(ta,tb));t1=Math.min(t1,Math.max(ta,tb));if(t0>t1)return null;}
  const i=[0,0,0],st=[0,0,0],tm=[Infinity,Infinity,Infinity],td=[Infinity,Infinity,Infinity];
  for(let k=0;k<3;k++){const p=o[k]+d[k]*t0;i[k]=Math.max(0,Math.min(n[k]-1,Math.floor((p-min[k])/cs[k])));
    if(d[k]>0){st[k]=1;tm[k]=(min[k]+(i[k]+1)*cs[k]-o[k])/d[k];td[k]=cs[k]/d[k];}else if(d[k]<0){st[k]=-1;tm[k]=(min[k]+i[k]*cs[k]-o[k])/d[k];td[k]=-cs[k]/d[k];}}
  if(++G.mark>=0xffffffff){stamp.fill(0);G.mark=1;}const mark=G.mark;let best=null;
  for(;;){const ci=(i[2]*n[1]+i[1])*n[0]+i[0];
    for(let j=start[ci];j<start[ci+1];j++){const t=list[j];if(stamp[t]===mark)continue;stamp[t]=mark;
      // Мёллер — Трумбор
      const a=F[t*3]*3,b=F[t*3+1]*3,c=F[t*3+2]*3,e1x=V[b]-V[a],e1y=V[b+1]-V[a+1],e1z=V[b+2]-V[a+2],e2x=V[c]-V[a],e2y=V[c+1]-V[a+1],e2z=V[c+2]-V[a+2],
        px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-12)continue;
      const sx=o[0]-V[a],sy=o[1]-V[a+1],sz=o[2]-V[a+2],u=(sx*px+sy*py+sz*pz)/det;if(u<0||u>1)continue;
      const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)/det;if(v<0||u+v>1)continue;
      const tt=(e2x*qx+e2y*qy+e2z*qz)/det;if(tt>1e-9&&(!best||tt<best.t))best={t:tt,tri:t,u,v};}
    const k=tm[0]<tm[1]?(tm[0]<tm[2]?0:2):(tm[1]<tm[2]?1:2);
    if(best&&best.t<=tm[k])return best;   // ближе выхода из клетки — дальше клетки ничего ближе не дадут
    if(tm[k]>t1)return best;i[k]+=st[k];if(i[k]<0||i[k]>=n[k])return best;tm[k]+=td[k];}}
/* ---------- #176 разметка на оригинале: перо, свободные концы ---------- */
// перо соскочило за край силуэта (луч ушёл в ухо за мордой): соседние точки дальше gap мм — штрих рвётся на куски, а не тянется хордой через воздух
const OW_GAP=20;   // мм: дальше — перо соскочило (спека, Review Focus 2)
function owSplit(raw,gap=OW_GAP){const out=[];let cur=[];
  for(const p of raw){const q=cur[cur.length-1];if(q&&Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])>gap){out.push(cur);cur=[];}cur.push(p);}
  if(cur.length)out.push(cur);return out;}
/* свободные концы (красные точки): концы открытых линий (line, pen), у которых ни один отрезок другой линии не ближе eps мм (порог — как у замкнутости пера, mkClosed);
   своя линия прицепляет, только если подошла к концу дальней частью (дальше 3·eps по линии) — петля «6», а не соседние точки. Зачёркивания (cross) не считаются ни концами, ни целью.
   Концы — в хеш по клеткам C мм; каждый отрезок смотрит только клетки своего габарита (+eps) — 1000 линий × 500 точек без перебора всех пар. → [[x,y,z],…] */
function owFreeEnds(mk,eps=6){const L=mk.filter(s=>(s.k==='line'||s.k==='pen')&&s.pts.length),far=3*eps,e2=eps*eps,C=Math.max(4*eps,24),iC=1/C;
  // все точки — в один Float64Array (X), длина по линии до каждой точки — в A: дальше циклы по числам, без массивов-точек
  let np=0;const S=new Int32Array(L.length+1);L.forEach((s,i)=>{S[i]=np;np+=s.pts.length;});S[L.length]=np;
  const X=new Float64Array(np*3),A=new Float64Array(np);
  L.forEach((s,i)=>s.pts.forEach((p,j)=>{const o=(S[i]+j)*3;X[o]=p[0];X[o+1]=p[1];X[o+2]=p[2];if(j){const u=X[o]-X[o-3],v=X[o+1]-X[o-2],w=X[o+2]-X[o-1];A[S[i]+j]=A[S[i]+j-1]+Math.sqrt(u*u+v*v+w*w);}}));
  // концы: точка (индекс в X), линия, первый ли, длина линии
  const EP=[],ES=[],EF=[],EL=[];L.forEach((s,i)=>{if(s.closed)return;const a=S[i],b=S[i+1]-1;EP.push(a,b);ES.push(i,i);EF.push(1,0);EL.push(A[b],A[b]);});
  const ne=EP.length;if(!ne)return [];const on=new Uint8Array(ne);
  const H=new Map(),key=(x,y,z)=>((x&1023)*1024+(y&1023))*1024+(z&1023);   // ключ — малое целое (быстрый Map); клетки дальше 1024 по оси сливаются — лишний кандидат, расстояние всё равно проверяется
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let k=0;k<ne;k++){const o=EP[k]*3;for(let d=0;d<3;d++){lo[d]=Math.min(lo[d],X[o+d]-eps);hi[d]=Math.max(hi[d],X[o+d]+eps);}
    const q=key(Math.floor(X[o]*iC),Math.floor(X[o+1]*iC),Math.floor(X[o+2]*iC));let b=H.get(q);if(!b)H.set(q,b=[]);b.push(k);}
  // отрезок ia–ib линии i (длина по линии a0…a1) прицепляет конец k, если ближе eps; своя линия — только дальней частью
  const test=(k,ia,ib,i,a0,a1)=>{if(on[k]||ES[k]===i&&(EF[k]?a0<=far:EL[k]-a1<=far))return;const o=EP[k]*3,px=X[o],py=X[o+1],pz=X[o+2],ax=X[ia],ay=X[ia+1],az=X[ia+2],
      ux=X[ib]-ax,uy=X[ib+1]-ay,uz=X[ib+2]-az,l2=ux*ux+uy*uy+uz*uz,t=l2?Math.max(0,Math.min(1,((px-ax)*ux+(py-ay)*uy+(pz-az)*uz)/l2)):0,dx=ax+ux*t-px,dy=ay+uy*t-py,dz=az+uz*t-pz;
    if(dx*dx+dy*dy+dz*dz<=e2)on[k]=1;};
  for(let i=0;i<L.length;i++){const s0=S[i],n=S[i+1]-s0,m=L[i].closed?n:Math.max(1,n-1);
    for(let j=0;j<m;j++){const ia=(s0+j)*3,ib=(s0+(j+1)%n)*3,a0=A[s0+j],a1=j+1<n?A[s0+j+1]:a0+Math.sqrt((X[ib]-X[ia])**2+(X[ib+1]-X[ia+1])**2+(X[ib+2]-X[ia+2])**2);
      const x0=Math.min(X[ia],X[ib])-eps,x1=Math.max(X[ia],X[ib])+eps,y0=Math.min(X[ia+1],X[ib+1])-eps,y1=Math.max(X[ia+1],X[ib+1])+eps,z0=Math.min(X[ia+2],X[ib+2])-eps,z1=Math.max(X[ia+2],X[ib+2])+eps;
      if(x0>hi[0]||y0>hi[1]||z0>hi[2]||x1<lo[0]||y1<lo[1]||z1<lo[2])continue;   // рядом ни одного конца
      const cx0=Math.floor(x0*iC),cx1=Math.floor(x1*iC),cy0=Math.floor(y0*iC),cy1=Math.floor(y1*iC),cz0=Math.floor(z0*iC),cz1=Math.floor(z1*iC);
      if((cx1-cx0+1)*(cy1-cy0+1)*(cz1-cz0+1)>ne){for(let k=0;k<ne;k++)test(k,ia,ib,i,a0,a1);continue;}   // длинный отрезок через много клеток — проще все концы
      for(let x=cx0;x<=cx1;x++)for(let y=cy0;y<=cy1;y++)for(let z=cz0;z<=cz1;z++){const B=H.get(key(x,y,z));if(B)for(let q=0;q<B.length;q++)test(B[q],ia,ib,i,a0,a1);}}}
  const out=[];for(let k=0;k<ne;k++)if(!on[k]){const o=EP[k]*3;out.push([X[o],X[o+1],X[o+2]]);}return out;}
/* ближайшая точка модели к p в радиусе r мм — по той же сетке клеток, что луч (owGrid), ближайшая точка треугольника — tlClosest (tlines.js).
   → {p:[x,y,z], n — нормаль грани (по обходу треугольника: у модели Meshy наружу — она замкнута, обход согласован), d — расстояние, tri} или null */
function owNear(G,p,r){const {V,F,min,n,cs,start,list,stamp}=G,lo=[0,0,0],hi=[0,0,0];
  for(let k=0;k<3;k++){lo[k]=Math.max(0,Math.floor((p[k]-r-min[k])/cs[k]));hi[k]=Math.min(n[k]-1,Math.floor((p[k]+r-min[k])/cs[k]));if(lo[k]>hi[k])return null;}
  if(++G.mark>=0xffffffff){stamp.fill(0);G.mark=1;}const mark=G.mark;let best=null,bt=-1,bd=r*r;
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){const ci=(z*n[1]+y)*n[0]+x;
    for(let j=start[ci];j<start[ci+1];j++){const t=list[j];if(stamp[t]===mark)continue;stamp[t]=mark;const a=F[t*3]*3,b=F[t*3+1]*3,c=F[t*3+2]*3,R=Math.sqrt(bd);
      if(Math.min(V[a],V[b],V[c])>p[0]+R||Math.max(V[a],V[b],V[c])<p[0]-R||Math.min(V[a+1],V[b+1],V[c+1])>p[1]+R||Math.max(V[a+1],V[b+1],V[c+1])<p[1]-R||Math.min(V[a+2],V[b+2],V[c+2])>p[2]+R||Math.max(V[a+2],V[b+2],V[c+2])<p[2]-R)continue;
      const q=tlClosest(p,[V[a],V[a+1],V[a+2]],[V[b],V[b+1],V[b+2]],[V[c],V[c+1],V[c+2]]),d=(q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2;if(d<bd){bd=d;best=q;bt=t;}}}
  if(!best)return null;const a=F[bt*3]*3,b=F[bt*3+1]*3,c=F[bt*3+2]*3,u=[V[b]-V[a],V[b+1]-V[a+1],V[b+2]-V[a+2]],w=[V[c]-V[a],V[c+1]-V[a+1],V[c+2]-V[a+2]],
    nn=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(nn[0],nn[1],nn[2])||1;
  return {p:[best[0],best[1],best[2]],n:[nn[0]/l,nn[1]/l,nn[2]/l],d:Math.sqrt(bd),tri:bt};}
/* штрихи → отрезки по поверхности модели (как mkDrape у плит, но по сетке owGrid — на 158 тыс. треугольников без перебора): между точками штриха — через TL_STEP мм,
   каждая — на ближайшую точку модели (сначала в 8 мм, хорда линии по кликам может уйти глубже — до 40), подъём TL_LIFT мм по нормали наружу; не легла — разрыв.
   Соседние точки на модели дальше 4·TL_STEP — легли на разные поверхности (хорда через ухо, щель): отрезок между ними не рисуем, а не тянем через воздух.
   → Float32Array отрезков (пары точек) и .nrm — нормаль под каждой точкой (для отсечения обратной стороны, как калька #169) */
function owDrape(G,list){const seg=[],nrm=[];
  const on=q=>{const h=owNear(G,q,8)||owNear(G,q,40);if(!h)return null;const r=h.p.map((x,k)=>x+h.n[k]*TL_LIFT);r.n=h.n;return r;};
  for(const s of list){const P=s.closed?[...s.pts,s.pts[0]]:s.pts;if(P.length<2)continue;let prev=null;
    for(let j=0;j+1<P.length;j++){const A=P[j],B=P[j+1],m=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2])/TL_STEP));
      for(let k=j?1:0;k<=m;k++){const q=on([A[0]+(B[0]-A[0])*k/m,A[1]+(B[1]-A[1])*k/m,A[2]+(B[2]-A[2])*k/m]);if(q&&prev&&Math.hypot(q[0]-prev[0],q[1]-prev[1],q[2]-prev[2])<=4*TL_STEP){seg.push(...prev,...q);nrm.push(...prev.n,...q.n);}prev=q;}}}
  const out=new Float32Array(seg);out.nrm=new Float32Array(nrm);return out;}
/* путь пера на оригинале: точки руки (owPick, уже на модели) → куски по скачкам (owSplit) → каждый кусок из ≥ 3 точек — mkPen (сглаживание, магнит к seg, замкнутость),
   сглаженные точки — обратно на поверхность (хорды сглаживания срезают выпуклость). → штрихи {k:'pen', pts, closed?} */
function owStrokes(raw,G,seg,magnet){return owSplit(raw).filter(q=>q.length>=3).map(q=>{const s=mkPen(q,seg,magnet);s.pts=s.pts.map(p=>{const h=owNear(G,p,20);return h?h.p:p;});return s;});}
/* ---------- #177 калька «Текстура»: облако швов для магнита ----------
   Швы сваренной модели Meshy на текстуре — светлые (белые на сером). Облако — точки поверхности (кадр фигуры, мм) под светлыми пикселями: каждый треугольник обходится в uv,
   для каждого пикселя внутри (центр пикселя, край — внутри) со светлотой max(r,g,b) ≥ thr — точка по барицентрическим. Линии из картинки не вытаскиваем — только точки для магнита.
   px — как getImageData: {W, H, data: RGBA, строка 0 — верх}; uv — как у текстуры three.js (flipY): v = 1 — верхняя строка. step — брать каждый step-й пиксель по обеим осям (сетка общая для всех треугольников). → Float32Array xyz */
function owSeamCloud(V,T,F,px,thr=.80,step=1){const {W,H,data}=px,lim=thr*255-1e-9,out=[];step=Math.max(1,step|0);
  for(let t=0;t<F.length;t+=3){const a=F[t],b=F[t+1],c=F[t+2],xa=T[a*2]*W-.5,ya=(1-T[a*2+1])*H-.5,xb=T[b*2]*W-.5,yb=(1-T[b*2+1])*H-.5,xc=T[c*2]*W-.5,yc=(1-T[c*2+1])*H-.5;
    const d=(xb-xa)*(yc-ya)-(xc-xa)*(yb-ya);if(Math.abs(d)<1e-12)continue;
    let x0=Math.max(0,Math.ceil(Math.min(xa,xb,xc)-1e-7)),y0=Math.max(0,Math.ceil(Math.min(ya,yb,yc)-1e-7));const x1=Math.min(W-1,Math.floor(Math.max(xa,xb,xc)+1e-7)),y1=Math.min(H-1,Math.floor(Math.max(ya,yb,yc)+1e-7));
    x0=Math.ceil(x0/step)*step;y0=Math.ceil(y0/step)*step;if(x0>x1||y0>y1)continue;
    const A=a*3,B=b*3,C=c*3,ux=V[B]-V[A],uy=V[B+1]-V[A+1],uz=V[B+2]-V[A+2],wx=V[C]-V[A],wy=V[C+1]-V[A+1],wz=V[C+2]-V[A+2];
    for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){const o=(y*W+x)*4,m=Math.max(data[o],data[o+1],data[o+2]);if(m<lim)continue;
      const s=((x-xa)*(yc-ya)-(xc-xa)*(y-ya))/d,r=((xb-xa)*(y-ya)-(x-xa)*(yb-ya))/d;if(s<-1e-7||r<-1e-7||s+r>1+1e-7)continue;
      out.push(V[A]+ux*s+wx*r,V[A+1]+uy*s+wy*r,V[A+2]+uz*s+wz*r);}}
  return new Float32Array(out);}
/* магнит к шву и к своим линиям сразу (#177): A — облако швов отрезками нулевой длины (сетка mkSnapGrid строится один раз и остаётся в A._g), B — свои штрихи (меняются после каждого штриха).
   → Float32Array A+B с готовой сеткой _g: клетки облака (те же массивы) + клетки своих линий (номера сдвинуты на длину A). Массивы клеток облака не меняются — копия, где добавились свои */
function owSnapJoin(A,B){if(!A._g)A._g=mkSnapGrid(A);const out=new Float32Array(A.length+B.length);out.set(A);out.set(B,A.length);if(!B.length){out._g=A._g;return out;}
  const gb=mkSnapGrid(B),sh=A.length/6,g=new Map(A._g);g.cs=A._g.cs;
  gb.forEach((ks,key)=>{const a=g.get(key),m=ks.map(k=>k+sh);g.set(key,a?a.concat(m):m);});out._g=g;return out;}
/* маска швов для кальки «Текстура» (#177): светлота max(r,g,b) → 0…255 плавно между порогами thr = [гипс, шов] (как smoothstep в шейдере); уровни уменьшения — максимум 2×2 до 1×1:
   издалека тонкий шов не гаснет (среднее у обычных уровней текстуры опускает его ниже порога — калька теряла швы, которые видны у «Текстуры» Meshy).
   px — как getImageData (строка 0 — верх); строки уровней — снизу вверх (текстура из массива в WebGL, flipY нет). → [{W, H, data: Uint8Array W·H}, …] */
function owSeamMips(px,thr){const {W,H,data}=px,lo=thr[0]*255,k=1/(thr[1]*255-lo),d0=new Uint8Array(W*H);
  for(let y=0;y<H;y++){const r=(H-1-y)*W;for(let x=0;x<W;x++){const o=(y*W+x)*4,t=Math.max(0,Math.min(1,(Math.max(data[o],data[o+1],data[o+2])-lo)*k));d0[r+x]=Math.round(255*t*t*(3-2*t));}}
  const out=[{W,H,data:d0}];
  while(out[out.length-1].W>1||out[out.length-1].H>1){const p=out[out.length-1],w=Math.max(1,p.W>>1),h=Math.max(1,p.H>>1),d=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const X=Math.min(p.W-1,x*2+dx),Y=Math.min(p.H-1,y*2+dy),v=p.data[Y*p.W+X];if(v>m)m=v;}d[y*w+x]=m;}
    out.push({W:w,H:h,data:d});}
  return out;}
// облако швов (owSeamCloud, xyz) → отрезки нулевой длины для магнита (mkSnap) с готовой сеткой mkSnapGrid — один раз при входе, дальше склеивается со своими линиями (owSnapJoin) без пересборки
function owSeamSeg(C){const seg=new Float32Array(C.length*2);for(let i=0;i<C.length;i+=3){seg[i*2]=seg[i*2+3]=C[i];seg[i*2+1]=seg[i*2+4]=C[i+1];seg[i*2+2]=seg[i*2+5]=C[i+2];}seg._g=mkSnapGrid(seg);return seg;}
/* ---------- #178 фото-кальки «Фото спереди» / «Фото сбоку»: фото Meshy светится на модель, как проектор ----------
   m — 8 чисел одной аффинной матрицы (камера ракурса ∘ подгон фото по силуэту ∘ кадр OBJ → кадр фигуры; считает tools/photo-fit.js у Claude): u = a0·x+a1·y+a2·z+a3, v = b0·x+b1·y+b2·z+b3,
   точка — в кадре фигуры (мм), u, v — 0…1 по картинке, v вниз (0 — верхняя строка). Тот же расчёт — в шейдере кальки (owork.js, owPhotoMat) */
function owPhotoUV(m,p){return [m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7]];}
/* какой пиксель фото ph = {m, dir, mirror, head?} светит на точку p с нормалью n (наружу): от камеры фото (n · dir ≥ 0) или uv вне картинки — null (гипс).
   mirror — фото ещё и зеркально по X (собака симметрична: профиль на обе стороны) — для точки (−x, y, z) с нормалью (−nx, ny, nz); из двух берётся та сторона, что смотрит на камеру прямее.
   head = {m, y0, z0} — снимок головы крупно со своей матрицей (общий подгон по всей собаке кладёт глаза фото на ~25 мм ниже глаз модели; так же делал project.js видами head-*):
   для точки (той стороны, что выбрана) в коробке головы y ≥ y0, z ≥ z0 — ещё и uv головы, если он на картинке; на странице голова главнее, где её фото не прозрачное.
   → {uv:[u,v], mir — взято зеркально, cos — насколько прямо смотрит (−n · dir, 0…1), head:[u,v]|null} | null. Шейдер (owPhotoMat) — то же правило */
function owPhotoPick(ph,p,n){const d=ph.dir,side=(q,nn,mir)=>{const cs=-(nn[0]*d[0]+nn[1]*d[1]+nn[2]*d[2]);if(cs<=0)return null;const uv=owPhotoUV(ph.m,q);
    return uv[0]<0||uv[0]>1||uv[1]<0||uv[1]>1?null:{uv,mir,cs,q};};
  const a=side(p,n,false),b=ph.mirror?side([-p[0],p[1],p[2]],[-n[0],n[1],n[2]],true):null,r=a&&b?(b.cs>a.cs?b:a):a||b;if(!r)return null;
  const H=ph.head,h=H&&r.q[1]>=H.y0&&r.q[2]>=H.z0?owPhotoUV(H.m,r.q):null;
  return {uv:r.uv,mir:r.mir,cos:r.cs,head:h&&h[0]>=0&&h[0]<=1&&h[1]>=0&&h[1]<=1?h:null};}
/* ---------- #179 модель из «Открыть модель» — в кадр фигуры, как у встроенных ----------
   кадр: центр по X и Z — 0, низ — 0, высота (Y) — 1000 мм; точка → p·s + d. Без этого зеркало (ось X = 0) и разметка не в мм. Высота 0 (плоская) — масштаб по наибольшей стороне, точка — 1 */
const OW_H=1000;
function owFrame(V){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++){const x=V[i+k];if(x<lo[k])lo[k]=x;if(x>hi[k])hi[k]=x;}
  const h=hi[1]-lo[1],big=Math.max(hi[0]-lo[0],h,hi[2]-lo[2]),s=h>1e-9?OW_H/h:big>1e-9?OW_H/big:1;
  return {s,d:[-(lo[0]+hi[0])/2*s,-lo[1]*s,-(lo[2]+hi[2])/2*s]};}
// копия точек в кадре f = {s, d}
function owApply(V,f){const W=new Float32Array(V.length);for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++)W[i+k]=V[i+k]*f.s+f.d[k];return W;}
/* обход треугольников модели из файла не гарантирован (у Meshy — наружу, у чужого STL/OBJ — как выйдет), а owNear берёт нормаль по обходу: подъём штриха (TL_LIFT) и отсечение обратной стороны.
   Объём со знаком Σ a·(b×c)/6 от центра габарита (у замкнутой модели — её объём, от точки не зависит; у дырявой — от центра честнее): < 0 — модель вывернута, переворачиваем каждый треугольник.
   → {F (копия, если перевёрнут), vol, flipped} */
function owOrient(V,F){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++){if(V[i+k]<lo[k])lo[k]=V[i+k];if(V[i+k]>hi[k])hi[k]=V[i+k];}
  const o=lo.map((x,k)=>(x+hi[k])/2),q=(i,k)=>V[i+k]-o[k];let s=0;
  for(let t=0;t<F.length;t+=3){const a=F[t]*3,b=F[t+1]*3,c=F[t+2]*3;s+=q(a,0)*(q(b,1)*q(c,2)-q(b,2)*q(c,1))+q(a,1)*(q(b,2)*q(c,0)-q(b,0)*q(c,2))+q(a,2)*(q(b,0)*q(c,1)-q(b,1)*q(c,0));}
  const vol=s/6;if(vol>=0)return {F,vol,flipped:false};const G=new Uint32Array(F.length);for(let t=0;t<F.length;t+=3){G[t]=F[t];G[t+1]=F[t+2];G[t+2]=F[t+1];}return {F:G,vol,flipped:true};}
/* модель из парсера (parseOBJ / parseGLB / parseSTL: {V:[[x,y,z]], F:[[a,b,c]], T?:[[u,v]]}) → данные режима: V — Float32Array в кадре фигуры (owFrame), F — Uint32Array с обходом наружу (owOrient),
   T — Float32Array uv или null (нет uv у модели). → {V, F, T, frame, flipped, vol} */
function owMesh(m){const nv=m.V.length,V0=new Float32Array(nv*3),F0=new Uint32Array(m.F.length*3);
  m.V.forEach((p,i)=>{V0[i*3]=p[0];V0[i*3+1]=p[1];V0[i*3+2]=p[2];});m.F.forEach((f,i)=>{F0[i*3]=f[0];F0[i*3+1]=f[1];F0[i*3+2]=f[2];});
  let T=null;if(m.T&&m.T.length===nv){T=new Float32Array(nv*2);m.T.forEach((t,i)=>{T[i*2]=t[0];T[i*2+1]=t[1];});}
  const o=owOrient(V0,F0),frame=owFrame(V0);return {V:owApply(V0,frame),F:o.F,T,frame,flipped:o.flipped,vol:o.vol};}
