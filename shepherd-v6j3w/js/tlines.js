/* ---------- калька чёткими линиями (#147): ломаные швов эталона (TRACE_L.<id>, пишет from-dev/art/tools/plates/tracing.js) → тонкие линии на наших гранях ----------
   формат base64: uint32 число ломаных, на каждую uint32 n и n×3 int16 (мм×10, кадр эталона — тот же, что облако TRACE.<id>) */
// → {n — ломаных, S — начала ломаных в P (по точкам; S[n] — всего точек), P — xyz мм}
function tlinesLoad(b64){const bin=typeof atob==='function'?atob(b64):Buffer.from(b64,'base64').toString('binary'),dv=new DataView(new ArrayBuffer(bin.length));
  for(let i=0;i<bin.length;i++)dv.setUint8(i,bin.charCodeAt(i));
  let o=0;const n=dv.getUint32(o,true);o+=4;const S=new Uint32Array(n+1),pts=[];
  for(let i=0;i<n;i++){S[i]=pts.length/3;const m=dv.getUint32(o,true);o+=4;for(let j=0;j<m*3;j++){pts.push(dv.getInt16(o,true)/10);o+=2;}}
  S[n]=pts.length/3;return {n,S,P:new Float32Array(pts)};}
const TL_STEP=2,TL_LIFT=.6;   // шаг передискретизации, мм (отрезок между двумя гранями не ныряет внутрь фигуры); подъём над гранью наружу, мм
// треугольники граней (F,T — из polyBase; иначе earClip) → [{a,b,c,n}] + сетка по клеткам cs мм (габарит треугольника + pad)
function tlTris(V,P,FT){const N=P.map(Q=>{let n=[0,0,0];Q.forEach((i,j)=>{const a=V[i],b=V[Q[(j+1)%Q.length]];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);});
    const l=Math.hypot(n[0],n[1],n[2])||1;return [n[0]/l,n[1]/l,n[2]/l];});
  const F=FT?FT.F:[],T=FT?FT.T:[];if(!FT)P.forEach((Q,pi)=>earClip(V,Q).forEach(t=>{F.push(t);T.push(pi);}));
  return F.map((f,i)=>({a:V[f[0]],b:V[f[1]],c:V[f[2]],n:N[T[i]],pi:T[i]}));}
function tlGrid(items,box,cs,pad){const G=new Map();items.forEach((it,k)=>{const [mn,mx]=box(it),i0=mn.map(x=>Math.floor((x-pad)/cs)),i1=mx.map(x=>Math.floor((x+pad)/cs));
    for(let x=i0[0];x<=i1[0];x++)for(let y=i0[1];y<=i1[1];y++)for(let z=i0[2];z<=i1[2];z++){const key=x+','+y+','+z;let c=G.get(key);if(!c)G.set(key,c=[]);c.push(k);}});
  G.cs=cs;G.at=p=>G.get(Math.floor(p[0]/cs)+','+Math.floor(p[1]/cs)+','+Math.floor(p[2]/cs))||[];return G;}
// ближайшая точка треугольника abc к p (Эриксон, «Real-Time Collision Detection» 5.1.5)
function tlClosest(p,a,b,c){const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]],D=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  const d1=D(ab,ap),d2=D(ac,ap);if(d1<=0&&d2<=0)return a;
  const bp=[p[0]-b[0],p[1]-b[1],p[2]-b[2]],d3=D(ab,bp),d4=D(ac,bp);if(d3>=0&&d4<=d3)return b;
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v];}
  const cp=[p[0]-c[0],p[1]-c[1],p[2]-c[2]],d5=D(ab,cp),d6=D(ac,cp);if(d6>=0&&d5<=d6)return c;
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return [a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w];}
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return [b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w];}
  const dn=1/(va+vb+vc),v=vb*dn,w=vc*dn;return [a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w];}
/* линии на нашей фигуре: точки ломаных (через TL_STEP мм) → кадр фигуры (map.inv) → ближайшая точка наших граней ≤ maxD мм (дальше — плита отошла от эталона,
   точку не рисуем, а не вешаем в воздухе) → подъём TL_LIFT мм по нормали грани наружу. → Float32Array отрезков (пары точек);
   .drawn — доля нарисованных точек, .pts — всего точек; .pp — точки на фигуре по ломаным (null — не легла), для магнита (tlinesSnap);
   .nrm (#169) — нормаль грани под каждой точкой отрезков (тот же порядок, что у отрезков): калька рисуется поверх фигуры без проверки глубины, а по нормали отсекается обратная сторона */
function tlinesOnFigure(L,map,V,P,maxD=12,FT){const tr=tlTris(V,P,FT),cs=Math.max(maxD*2,16),G=tlGrid(tr,t=>[[0,1,2].map(k=>Math.min(t.a[k],t.b[k],t.c[k])),[0,1,2].map(k=>Math.max(t.a[k],t.b[k],t.c[k]))],cs,maxD);
  const seg=[],nrm=[],pp=[];let tot=0,hit=0;
  const onFig=q=>{const p=map.inv(q);let best=null,bd=maxD*maxD,bn=null;for(const k of G.at(p)){const t=tr[k],c=tlClosest(p,t.a,t.b,t.c),d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2;if(d<bd){bd=d;best=c;bn=t.n;}}
    if(!best)return null;const r=[best[0]+bn[0]*TL_LIFT,best[1]+bn[1]*TL_LIFT,best[2]+bn[2]*TL_LIFT];r.n=bn;return r;};
  for(let i=0;i<L.n;i++){const a0=L.S[i],a1=L.S[i+1],line=[];
    for(let j=a0;j<a1;j++){const A=[L.P[j*3],L.P[j*3+1],L.P[j*3+2]];if(j===a1-1){line.push(A);break;}const B=[L.P[j*3+3],L.P[j*3+4],L.P[j*3+5]],m=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2])/TL_STEP));
      for(let s=0;s<m;s++)line.push([A[0]+(B[0]-A[0])*s/m,A[1]+(B[1]-A[1])*s/m,A[2]+(B[2]-A[2])*s/m]);}
    const q=line.map(onFig);tot+=q.length;q.forEach((x,k)=>{if(!x)return;hit++;if(k&&q[k-1]){seg.push(...q[k-1],...x);nrm.push(...q[k-1].n,...x.n);}});pp.push(q);}
  const out=new Float32Array(seg);out.drawn=tot?hit/tot:0;out.pts=tot;out.pp=pp;out.nrm=new Float32Array(nrm);return out;}
// ближайшая точка линий кальки к p (кадр фигуры) в радиусе r мм → [x,y,z] (кадр фигуры) или null; сетка отрезков строится один раз на L
function tlinesNear(L,map,p,r=5){if(!L._g){const sg=[];for(let i=0;i<L.n;i++)for(let j=L.S[i];j+1<L.S[i+1];j++)sg.push(j);
    L._g=tlGrid(sg,j=>[[0,1,2].map(k=>Math.min(L.P[j*3+k],L.P[j*3+3+k])),[0,1,2].map(k=>Math.max(L.P[j*3+k],L.P[j*3+3+k]))],8,0);L._sg=sg;}
  const q=map(p),cs=L._g.cs,R=Math.ceil(r/cs);let best=null,bd=Infinity;const seen=new Set();
  for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)for(const k of L._g.get((Math.floor(q[0]/cs)+dx)+','+(Math.floor(q[1]/cs)+dy)+','+(Math.floor(q[2]/cs)+dz))||[]){if(seen.has(k))continue;seen.add(k);
    const j=L._sg[k],A=[L.P[j*3],L.P[j*3+1],L.P[j*3+2]],ab=[L.P[j*3+3]-A[0],L.P[j*3+4]-A[1],L.P[j*3+5]-A[2]],l2=ab[0]**2+ab[1]**2+ab[2]**2,
      t=l2?Math.max(0,Math.min(1,((q[0]-A[0])*ab[0]+(q[1]-A[1])*ab[1]+(q[2]-A[2])*ab[2])/l2)):0,c=[A[0]+ab[0]*t,A[1]+ab[1]*t,A[2]+ab[2]*t],d=Math.hypot(c[0]-q[0],c[1]-q[1],c[2]-q[2]);
    if(d<bd){bd=d;best=c;}}
  if(!best)return null;const b=map.inv(best);return Math.hypot(b[0]-p[0],b[1]-p[1],b[2]-p[2])<=r?b:null;}
