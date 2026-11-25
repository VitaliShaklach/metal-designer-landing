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
