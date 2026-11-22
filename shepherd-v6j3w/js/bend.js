/* ---------- Гибка (галочка «Гнуть»): соседние детали режутся одной заготовкой и гнутся по линии, а не варятся ----------
   Стык гнём, если угол между гранями после гибки не меньше BEND.ang, линия сгиба BEND.min…BEND.max мм, грань у сгиба не уже BEND.face,
   на заготовку не больше BEND.bends сгибов, две линии сгиба на одной детали не сходятся в одной вершине (угол коробки гнуть трудно), развёртка не налезает сама на себя, без щелей и влезает в лист.
   Гнутые стыки не замыкаются в кольцо (лес) — так вокруг вершины с дефектом угла хотя бы один стык остаётся сварным.
   V — выпуклый снаружи: смотрим на гравировку (изнутри) — гнуть на себя; m — вогнутый, гнуть от себя. Номера деталей не меняются. */
const BEND={ang:135,bends:7,face:20,min:20,max:300,slit:3};   // slit — несогнутый стык в развёртке сошёлся ближе — щель
const bendKey=(a,b)=>a<b?a+'_'+b:b+'_'+a;
// стыки деталей: пара деталей, линия (крайние точки A, B), длина, угол между гранями, вид V / m, грань у сгиба
function bendJoints(R,V){const J=new Map();
  R.edges.forEach(e=>{if(e.open||e.p.length!==2)return;const [p,q]=e.p[0]<e.p[1]?e.p:[e.p[1],e.p[0]],k=p+'_'+q;let j=J.get(k);if(!j)J.set(k,j={p,q,seg:[],dih:e.dih,convex:e.convex});j.seg.push([e.a,e.b]);});
  return [...J.values()].map((j,id)=>{const vs=[...new Set(j.seg.flat())],u=V3.norm(V3.sub(V[vs[1]],V[vs[0]])),t=i=>V3.dot(V3.sub(V[i],V[vs[0]]),u);
    let A=vs[0],B=vs[0];vs.forEach(i=>{if(t(i)<t(A))A=i;if(t(i)>t(B))B=i;});const ang=j.convex?j.dih:360-j.dih,len=j.seg.reduce((s,[a,b])=>s+V3.len(V3.sub(V[b],V[a])),0);
    // грань у сгиба: насколько деталь отходит от линии
    const uu=V3.norm(V3.sub(V[B],V[A])),off=pi=>Math.max(...R.parts[pi].full.map(i=>{const d=V3.sub(V[i],V[A]);return V3.len(V3.sub(d,V3.mul(uu,V3.dot(d,uu))));}));
    return {id,p:j.p,q:j.q,A,B,len,ang,dih:j.dih,kind:j.convex?'V':'m',face:Math.min(off(j.p),off(j.q)),seg:j.seg};});}
// деталь на плоскости, вид снаружи: точка → [x,y]
function bendFlat(V,P){const o=V[P.full[0]],n=P.n;let u=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(n,V3.dot(u,n))));const w=V3.cross(n,u),m=new Map();P.full.forEach(i=>{const d=V3.sub(V[i],o);m.set(i,[V3.dot(d,u),V3.dot(d,w)]);});return m;}
const bendCr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
// две детали развёртки налезают: стороны пересекаются насквозь или точка одной глубже eps внутри другой
function bendOverlap(P,Q,eps=.5){for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];for(let j=0;j<Q.length;j++){const c=Q[j],d=Q[(j+1)%Q.length],d1=bendCr(c,d,a),d2=bendCr(c,d,b),d3=bendCr(a,b,c),d4=bendCr(a,b,d),s=Math.hypot(d[0]-c[0],d[1]-c[1])*eps,t=Math.hypot(b[0]-a[0],b[1]-a[1])*eps;
    if((d1>s&&d2<-s||d1<-s&&d2>s)&&(d3>t&&d4<-t||d3<-t&&d4>t))return true;}}
  const deep=(X,Y)=>X.some((p,i)=>{const m=[(p[0]+X[(i+1)%X.length][0])/2,(p[1]+X[(i+1)%X.length][1])/2];return [p,m].some(r=>inPoly(r,Y)&&Y.every((y,k)=>ptSegD(r,y,Y[(k+1)%Y.length])>eps));});
  return deep(P,Q)||deep(Q,P);}
// узкая сторона и длина по выпуклой оболочке (наименьший по площади прямоугольник)
function bendDims(pts){const h=convexHull(pts);let best=null;h.forEach((p,i)=>{const q=h[(i+1)%h.length],a=Math.atan2(q[1]-p[1],q[0]-p[0]),c=Math.cos(a),s=Math.sin(a);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  h.forEach(r=>{const x=c*r[0]+s*r[1],y=-s*r[0]+c*r[1];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});const W=Math.min(x1-x0,y1-y0),L=Math.max(x1-x0,y1-y0);if(!best||W*L<best[0]*best[1])best=[W,L];});return best||[0,0];}
// влезает ли в лист W × L при каком-нибудь повороте
function bendFits(pts,W,L){const h=convexHull(pts);if(h.length<3)return true;return h.some((p,i)=>{const q=h[(i+1)%h.length],a=Math.atan2(q[1]-p[1],q[0]-p[0]),c=Math.cos(a),s=Math.sin(a);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  h.forEach(r=>{const x=c*r[0]+s*r[1],y=-s*r[0]+c*r[1];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});return Math.min(x1-x0,y1-y0)<=W&&Math.max(x1-x0,y1-y0)<=L;});}

/* какие стыки гнуть: жадно, лучшие первыми (пологие и длинные); зеркальный стык — парой.
   o: пороги BEND, sheet [W, L], convex — только V, line(j) — у эталона нарисован шов (такие в конец), ban — id стыков, которые не гнуть */
function bendPlan(R,V,o){o=Object.assign({},BEND,o||{});const [SW,SL]=o.sheet||[1250,2500],J=bendJoints(R,V),N=R.parts.length,F2=R.parts.map(P=>bendFlat(V,P)),mm=mirrorMap(V);
  const byAB=new Map(J.map(j=>[bendKey(j.A,j.B),j])),mi=i=>mm[i]===-2?i:mm[i];J.forEach(j=>{const m=byAB.get(bendKey(mi(j.A),mi(j.B)));j.mate=m&&m!==j?m.id:-1;});
  const JP=R.parts.map(()=>[]);J.forEach(j=>{JP[j.p].push(j);JP[j.q].push(j);});
  const why=new Map();J.forEach(j=>{const w=o.ban&&o.ban.has(j.id)?'контур':j.ang<o.ang?'угол':j.len>o.max?'длинная линия':j.len<o.min?'короткая линия':j.face<o.face?'узкая грань':o.convex&&j.kind!=='V'?'вогнутый':null;if(w)why.set(j.id,w);});
  const score=j=>(180-j.ang)-j.len/10+(o.line&&o.line(j)?1000:0),order=J.filter(j=>!why.has(j.id)).sort((a,b)=>score(a)-score(b));
  // заготовки: детали, их место на развёртке (поворот, сдвиг), сгибы
  let T=R.parts.map((_,i)=>({parts:[i],bends:[],pl:new Map([[i,{c:1,s:0,x:0,y:0}]])})),of=R.parts.map((_,i)=>i);
  const at=(t,pi,v)=>{const f=t.pl.get(pi),p=F2[pi].get(v);return [f.c*p[0]-f.s*p[1]+f.x,f.s*p[0]+f.c*p[1]+f.y];},poly=(t,pi)=>R.parts[pi].full.map(v=>at(t,pi,v));
  const tryJoin=(T,of,j)=>{const a=of[j.p],b=of[j.q];if(a===b)return 'кольцо';const ta=T[a],tb=T[b];if(ta.bends.length+tb.bends.length+1>o.bends)return 'много сгибов';
    // угол коробки: две линии сгиба на одной детали сходятся в вершине — пресс мнёт вершину; полоска между линиями, которые не касаются, — можно
    if(o.corner!==false)for(const id of ta.bends.concat(tb.bends)){const k=J[id];if((k.p===j.p||k.q===j.p||k.p===j.q||k.q===j.q)&&(k.A===j.A||k.A===j.B||k.B===j.A||k.B===j.B))return 'линии сходятся';}
    const a1=at(ta,j.p,j.A),b1=at(ta,j.p,j.B),a2=at(tb,j.q,j.A),b2=at(tb,j.q,j.B),th=Math.atan2(b1[1]-a1[1],b1[0]-a1[0])-Math.atan2(b2[1]-a2[1],b2[0]-a2[0]),c=Math.cos(th),s=Math.sin(th);
    const pl=new Map(ta.pl);tb.pl.forEach((f,pi)=>{const x0=c*f.x-s*f.y,y0=s*f.x+c*f.y,ax=c*a2[0]-s*a2[1],ay=s*a2[0]+c*a2[1];pl.set(pi,{c:c*f.c-s*f.s,s:s*f.c+c*f.s,x:x0-ax+a1[0],y:y0-ay+a1[1]});});
    const t={parts:ta.parts.concat(tb.parts),bends:ta.bends.concat(tb.bends,[j.id]),pl},inB=new Set(tb.parts);
    for(const p of ta.parts)for(const q of tb.parts)if(bendOverlap(poly(t,p),poly(t,q)))return 'налезает';
    // щель: несогнутый стык между двумя половинами лёг сам на себя — разрез нулевой ширины внутри заготовки
    for(const p of ta.parts)for(const k of JP[p]){const q=k.p===p?k.q:k.p;if(k===j||!inB.has(q))continue;if(Math.hypot(...[0,1].map(i=>at(t,p,k.A)[i]-at(t,q,k.A)[i]))<o.slit&&Math.hypot(...[0,1].map(i=>at(t,p,k.B)[i]-at(t,q,k.B)[i]))<o.slit)return 'щель';}
    if(!bendFits(t.parts.flatMap(pi=>poly(t,pi)),SW,SL))return 'не влезает в лист';
    const T2=T.slice(),of2=of.slice();T2[a]=t;T2[b]=null;t.parts.forEach(pi=>of2[pi]=a);return {T:T2,of:of2};};
  const done=new Set();order.forEach(j=>{if(done.has(j.id))return;done.add(j.id);const m=j.mate>=0?J[j.mate]:null;if(m)done.add(m.id);
    let r=tryJoin(T,of,j);if(typeof r==='string'){why.set(j.id,r);if(m)why.set(m.id,r);return;}
    if(m&&!why.has(m.id)){const r2=tryJoin(r.T,r.of,m);if(typeof r2==='string'){why.set(j.id,'зеркальный: '+r2);why.set(m.id,r2);return;}r=r2;}
    T=r.T;of=r.of;});
  const minNo=t=>Math.min(...t.parts.map(pi=>R.parts[pi].no));
  const blanks=T.filter(Boolean).sort((a,b)=>minNo(a)-minNo(b)).map(t=>({parts:t.parts.slice().sort((a,b)=>R.parts[a].no-R.parts[b].no),bends:t.bends}));
  const bent=new Set(blanks.flatMap(b=>b.bends)),bo=new Int32Array(N);let no=0;blanks.forEach((b,i)=>{b.parts.forEach(pi=>bo[pi]=i);if(b.parts.length>1)b.no=++no;b.order=bendOrder(b,J,R);});
  const weld=J.filter(j=>!bent.has(j.id)),cnt={};weld.forEach(j=>{const w=why.get(j.id)||'?';cnt[w]=(cnt[w]||0)+1;});
  const st={parts:N,blanks:blanks.length,multi:no,single:blanks.length-no,V:J.filter(j=>bent.has(j.id)&&j.kind==='V').length,m:J.filter(j=>bent.has(j.id)&&j.kind==='m').length,
    weld:weld.length,weldLen:weld.reduce((s,j)=>s+j.len,0),bendLen:J.filter(j=>bent.has(j.id)).reduce((s,j)=>s+j.len,0),joints:J.length,maxBends:Math.max(0,...blanks.map(b=>b.bends.length)),why:cnt};
  const pair=new Map(J.map(j=>[bendKey(j.p,j.q),j]));
  return {blanks,J,st,bent,of:bo,F2,why,pair,isBent:(p,q)=>{const j=pair.get(bendKey(p,q));return !!j&&bent.has(j.id);}};}

// порядок гибки: сначала крайние сгибы (у детали-листа дерева, меньшая — раньше), потом к середине → id стыков по порядку
function bendOrder(b,J,R){const deg=new Map(b.parts.map(p=>[p,0])),left=new Set(b.bends),gone=new Set(),out=[];b.bends.forEach(id=>{const j=J[id];deg.set(j.p,deg.get(j.p)+1);deg.set(j.q,deg.get(j.q)+1);});
  while(left.size){let best=null,ba=0;left.forEach(id=>{const j=J[id],lf=[j.p,j.q].filter(p=>deg.get(p)===1&&!gone.has(p));if(!lf.length)return;const a=Math.min(...lf.map(p=>R.parts[p].area));if(!best||a<ba){best={id,leaf:lf.find(p=>R.parts[p].area===a)};ba=a;}});
    if(!best){out.push(...left);break;}const j=J[best.id];left.delete(best.id);out.push(best.id);gone.add(best.leaf);deg.set(j.p,deg.get(j.p)-1);deg.set(j.q,deg.get(j.q)-1);}
  return out;}

/* поправка на толщину: развёртка короче суммы граней на BD (r = t, K = 0,33); δ — угол отгиба.
   V — грани детали снаружи сгиба: BD = 2(r+t)·tg(δ/2) − δ(r+K·t); m — снаружи фигуры внутренняя сторона сгиба: BD = 2r·tg(δ/2) − δ(r+K·t) (чуть меньше нуля) */
function bendDeduct(t,ang,kind){const d=(180-ang)*Math.PI/180,r=t,ba=d*(r+.33*t);return (kind==='V'?2*(r+t):2*r)*Math.tan(d/2)-ba;}

/* развёртка заготовки с поправкой и контур реза.
   Детали раскладываем от самой большой по дереву сгибов; дочерняя сдвигается к родителю на BD — линия сгиба посередине,
   по BD/2 с каждой стороны. Контур — обход внешних сторон: сварная сторона уходит внутрь на отступ (edgeSetback), открытая — на месте;
   на концах линии сгиба — короткая сторона по самой линии. o: {t, gap, useT} */
function bendBlank(b,R,V,P,o){const J=P.J,F2=P.F2,bent=new Set(b.bends),EB=new Map();R.edges.forEach(e=>EB.set(bendKey(e.a,e.b),e));
  const root=b.parts.reduce((x,p)=>R.parts[p].area>R.parts[x].area?p:x,b.parts[0]),pl=new Map([[root,{c:1,s:0,x:0,y:0}]]),BD=new Map();
  const at=(pi,v)=>{const f=pl.get(pi),p=F2[pi].get(v);return [f.c*p[0]-f.s*p[1]+f.x,f.s*p[0]+f.c*p[1]+f.y];};
  b.bends.forEach(id=>{const j=J[id];BD.set(id,o.useT?bendDeduct(o.t,j.ang,j.kind):0);});
  for(const q0=[root];q0.length;){const p=q0.shift();b.bends.forEach(id=>{const j=J[id];if(j.p!==p&&j.q!==p)return;const q=j.p===p?j.q:j.p;if(pl.has(q))return;
    const a1=at(p,j.A),b1=at(p,j.B),a2=F2[q].get(j.A),b2=F2[q].get(j.B),th=Math.atan2(b1[1]-a1[1],b1[0]-a1[0])-Math.atan2(b2[1]-a2[1],b2[0]-a2[0]),c=Math.cos(th),s=Math.sin(th);
    const f={c,s,x:a1[0]-(c*a2[0]-s*a2[1]),y:a1[1]-(s*a2[0]+c*a2[1])};pl.set(q,f);
    const l=Math.hypot(b1[0]-a1[0],b1[1]-a1[1])||1;let n=[-(b1[1]-a1[1])/l,(b1[0]-a1[0])/l];const cq=R.parts[q].full.map(v=>at(q,v)).reduce((s,z)=>[s[0]+z[0],s[1]+z[1]],[0,0]).map(x=>x/R.parts[q].full.length);
    if((cq[0]-a1[0])*n[0]+(cq[1]-a1[1])*n[1]<0)n=[-n[0],-n[1]];const d=BD.get(id);f.x-=n[0]*d;f.y-=n[1]*d;q0.push(q);});}
  // сторона v→w детали pi: сгиб (к какой детали) или отступ
  const side=(pi,v,w)=>{const e=EB.get(bendKey(v,w));if(!e||e.open||e.p.length!==2)return {s:0};const q=e.p[0]===pi?e.p[1]:e.p[0],j=P.pair.get(bendKey(pi,q));
    if(j&&bent.has(j.id))return {bend:j,q};return {s:edgeSetback({nb:q,dih:e.dih},o.t,o.gap,o.useT)};};
  const nx=new Map(b.parts.map(pi=>{const f=R.parts[pi].full,m=new Map();f.forEach((v,k)=>m.set(v,f[(k+1)%f.length]));return [pi,m];}));
  let s0=null;for(const pi of b.parts){for(const v of R.parts[pi].full)if(!side(pi,v,nx.get(pi).get(v)).bend){s0=[pi,v];break;}if(s0)break;}
  const S=[];if(s0){let [pi,v]=s0,guard=0;
    do{const w=nx.get(pi).get(v);S.push({a:at(pi,v),b:at(pi,w),s:side(pi,v,w).s});let p=pi,x=w;
      for(let k=0;k<64;k++){const y=nx.get(p).get(x),sd=side(p,x,y);if(!sd.bend)break;const A=at(p,x),Y=at(p,y),C=at(sd.q,x),l=Math.hypot(Y[0]-A[0],Y[1]-A[1])||1;
        S.push({con:true,p:[(A[0]+C[0])/2,(A[1]+C[1])/2],u:[(Y[0]-A[0])/l,(Y[1]-A[1])/l],s:0});p=sd.q;}
      pi=p;v=x;}while(!(pi===s0[0]&&v===s0[1])&&++guard<5000);}
  // прямые сторон; у короткой стороны по линии сгиба направление — от точки, где в неё входит предыдущая сторона, к точке выхода следующей
  const L0=S.map(z=>z.con?{p:z.p,d:z.u}:{p:z.a,d:(l=>[(z.b[0]-z.a[0])/l,(z.b[1]-z.a[1])/l])(Math.hypot(z.b[0]-z.a[0],z.b[1]-z.a[1])||1)});
  const X=(a,c)=>{const den=a.d[0]*c.d[1]-a.d[1]*c.d[0];if(Math.abs(den)<1e-9)return null;const w=[c.p[0]-a.p[0],c.p[1]-a.p[1]],k=(w[0]*c.d[1]-w[1]*c.d[0])/den;return [a.p[0]+a.d[0]*k,a.p[1]+a.d[1]*k];};
  S.forEach((z,i)=>{if(!z.con)return;const n=S.length,pr=X(L0[(i+n-1)%n],L0[i])||z.p,nx2=X(L0[(i+1)%n],L0[i])||z.p;if((nx2[0]-pr[0])*z.u[0]+(nx2[1]-pr[1])*z.u[1]<0)L0[i].d=[-z.u[0],-z.u[1]];});
  const raw=L0.map(l=>l.p),ccw=area2(raw)>0?1:-1,L=L0.map((l,i)=>({p:[l.p[0]-l.d[1]*ccw*S[i].s,l.p[1]+l.d[0]*ccw*S[i].s],d:l.d,s:S[i].s}));
  // соседние стороны сходятся почти в одной точке (ближе 0,05 мм) — одна точка: в DXF (округление до 0,01) иначе нулевой отрезок (Д10: Г20, Г23, Г23.1, Г25)
  const r=meetLines(L,ccw,-1e-6,true),PT=.05,near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=PT,pts=[];r.pts.forEach(q=>{if(!pts.length||!near(q,pts[pts.length-1]))pts.push(q);});
  while(pts.length>1&&near(pts[0],pts[pts.length-1]))pts.pop();
  let bad=r.bad||pts.length<3;for(let i=0;i<pts.length&&!bad;i++)for(let k=i+2;k<pts.length;k++){if(i===0&&k===pts.length-1)continue;if(segX(pts[i],pts[(i+1)%pts.length],pts[k],pts[(k+1)%pts.length])){bad=true;break;}}
  // участки деталей (для номеров) и линии сгиба, обрезанные по контуру
  const regions=b.parts.map(pi=>({pi,pts:R.parts[pi].full.map(v=>at(pi,v))}));
  const lines=b.order.map((id,k)=>{const j=J[id],m=v=>{const A=at(j.p,v),C=at(j.q,v);return [(A[0]+C[0])/2,(A[1]+C[1])/2];};return {id,k:k+1,kind:j.kind,ang:Math.round(j.ang),len:j.len,BD:BD.get(id),p:j.p,q:j.q,segs:bad?[]:clipSeg(m(j.A),m(j.B),pts).filter(z=>Math.hypot(z[2]-z[0],z[3]-z[1])>2)};});
  const [W,Lg]=bendDims(pts.length?pts:regions.flatMap(z=>z.pts));
  return {pts,bad,regions,lines,W,L:Lg,area:Math.abs(area2(pts))};}
// отрезок a–b внутри многоугольника P: куски
function clipSeg(a,b,P){const ts=[0,1],d=[b[0]-a[0],b[1]-a[1]];P.forEach((p,i)=>{const q=P[(i+1)%P.length],e=[q[0]-p[0],q[1]-p[1]],den=d[0]*e[1]-d[1]*e[0];if(Math.abs(den)<1e-12)return;
    const w=[p[0]-a[0],p[1]-a[1]],t=(w[0]*e[1]-w[1]*e[0])/den,u=(w[0]*d[1]-w[1]*d[0])/den;if(t>0&&t<1&&u>=-1e-9&&u<=1+1e-9)ts.push(t);});   // допуск: линия ровно через вершину контура — пересечение с кромкой выходит u = −1e-17 и терялось
  ts.sort((x,y)=>x-y);const out=[];for(let i=0;i+1<ts.length;i++){const t0=ts[i],t1=ts[i+1];if(t1-t0<1e-6)continue;const m=(t0+t1)/2;if(inPoly([a[0]+d[0]*m,a[1]+d[1]*m],P))out.push([a[0]+d[0]*t0,a[1]+d[1]*t0,a[0]+d[0]*t1,a[1]+d[1]*t1]);}
  return out;}
// поворот плоского контура: длинная сторона — по X, узкая — по Y, от нуля; f — зеркально (вид изнутри, как на листе) → преобразование для trPt
function bendAlign(P,f){const Q=f?P.map(p=>[-p[0],p[1]]):P,h=convexHull(Q);let bw=Infinity,ba=0;h.forEach((p,i)=>{const q=h[(i+1)%h.length],a=Math.atan2(q[1]-p[1],q[0]-p[0]),c=Math.cos(a),s=Math.sin(a);let mn=1e9,mx=-1e9;h.forEach(z=>{const y=-s*z[0]+c*z[1];mn=Math.min(mn,y);mx=Math.max(mx,y);});if(mx-mn<bw){bw=mx-mn;ba=a;}});
  const c=Math.cos(-ba),s=Math.sin(-ba),R=Q.map(p=>[c*p[0]-s*p[1],s*p[0]+c*p[1]]),x0=Math.min(...R.map(p=>p[0])),y0=Math.min(...R.map(p=>p[1]));
  return {f:!!f,c,s,x:-x0,y:-y0,L:Math.max(...R.map(p=>p[0]))-x0,W:Math.max(...R.map(p=>p[1]))-y0};}
// зеркальные заготовки — парой под одним номером: Г3 и Г3.1 (Г3 — с меньшими номерами деталей), остальные — по порядку
function blankNumbers(BL,R){let n=0;const done=new Set(),of=new Map();BL.forEach((b,i)=>b.parts.forEach(pi=>of.set(pi,i)));
  BL.forEach((b,i)=>{if(done.has(i))return;done.add(i);n++;const tw=b.parts.map(pi=>R.parts[pi].twin),k=tw.every(x=>x!=null)?of.get(tw[0]):undefined;
    if(k!==undefined&&k!==i&&!done.has(k)&&BL[k].parts.length===b.parts.length&&tw.every(x=>of.get(x)===k)){done.add(k);const c=Math.min(...b.parts.map(pi=>R.parts[pi].no))%1?[k,i]:[i,k];BL[c[0]].no=n;BL[c[1]].no=n+.1;}else b.no=n;});}
/* зеркальная заготовка — числа основной (Г3.1 — как у Г3): угол сгиба — по углу шва пары (seamDih), порядок гибки, габарит, площадь, рез.
   Геометрия у пары расходится в десятых мм, и последняя цифра скакала (V166 / V167, 186 × 80 / 81); контур и линии сгиба у каждой свои. Вызывать после blankNumbers */
function blankTwins(BL,R,J){BL.forEach(b=>{b.cut=perim(b.pts);b.lines.forEach(l=>{const d=seamDih(R,l.p,l.q);if(d!=null)l.ang=Math.round(l.kind==='V'?d:360-d);});});
  const byNo=new Map(BL.map(b=>[b.no,b]));
  BL.forEach(b=>{if(!(b.no%1))return;const m=byNo.get(Math.floor(b.no));if(!m)return;Object.assign(b,{L:m.L,W:m.W,area:m.area,cut:m.cut});
    // порядок гибки — как у основной: сгиб пары — зеркальный стык (mate)
    const k=new Map(m.lines.map(l=>[l.id,l.k])),ks=b.lines.map(l=>k.get(J[l.id].mate));
    if(m.lines.length!==b.lines.length||ks.some(x=>x==null)||new Set(ks).size!==ks.length)return;b.lines.forEach((l,i)=>l.k=ks[i]);b.lines.sort((x,y)=>x.k-y.k);b.order=b.lines.map(l=>l.id);});}
const bendTxt=l=>l.kind+l.ang+' ('+l.k+')';   // «V144 (2)»: вид, угол между гранями, номер в порядке гибки
/* ---------- уголок в угол сгиба — на готовом элементе (снимки «проверка уголком») ----------
   Плоскость уголка — поперёк линии сгиба, вершина — на линии, кромки — по граням p и q. Клин между гранями (меньше 180°) у V — изнутри фигуры (сторона гравировки), у m — снаружи.
   S — контур уголка (tplShape: вершина в 0, кромка 1 — по x, кромка 2 — под углом a), null — уголка нет; gap — зазор до граней, мм: уголок прижат, 0,3 мм — только чтобы на снимке грань и кромка не сливались; у вершины зазор даёт выемка уголка. Место вдоль линии: середина, потом ближе к концам — пока уголок не упирается в другие грани элемента (own).
   → {M, u, e1, e2, w2, b, o, at, hit, P3}: e1, w2 — кромки (от линии в грани), b — биссектриса клина, o — сдвиг уголка от линии (зазор), hit — места не нашлось (стоит посередине), P3 — контур в 3D */
function bendTpl(R,M3,j,own,S,gap=.3){const {V,F}=M3,A=V[j.A],B=V[j.B],u=V3.norm(V3.sub(B,A)),L=V3.len(V3.sub(B,A));
  const side=pi=>{const P=R.parts[pi],c=P.full.reduce((s,i)=>V3.add(s,V3.mul(V[i],1/P.full.length)),[0,0,0]),w=V3.norm(V3.cross(P.n,u));return V3.dot(V3.sub(c,A),w)<0?V3.mul(w,-1):w;};
  const e1=side(j.p),w2=side(j.q),e2=V3.norm(V3.sub(w2,V3.mul(e1,V3.dot(w2,e1)))),b=V3.norm(V3.add(e1,w2)),o=V3.mul(b,gap/Math.max(.05,Math.sin(Math.acos(Math.max(-1,Math.min(1,V3.dot(e1,w2))))/2))),tris=[];
  if(S)F.forEach((f,fi)=>{const pi=R.partOf[fi];if(own.has(pi)&&pi!==j.p&&pi!==j.q)tris.push(f.map(v=>V[v]));});
  // треугольник другой грани режет плоскость уголка — отрезок; попал внутрь контура — упирается
  const hits=M=>tris.some(T=>{const d=T.map(q=>V3.dot(V3.sub(q,M),u)),X=[];for(let i=0;i<3;i++){const k=(i+1)%3;if(d[i]*d[k]<0)X.push(V3.add(T[i],V3.mul(V3.sub(T[k],T[i]),d[i]/(d[i]-d[k]))));}
    if(X.length<2)return false;const to=q=>{const o=V3.sub(q,M);return [V3.dot(o,e1),V3.dot(o,e2)];};return clipSeg(to(X[0]),to(X[1]),S).length>0;});
  let at=.5,hit=!!S;if(S)for(const f of [.5,.35,.65,.2,.8])if(!hits(V3.add(V3.add(A,V3.mul(u,L*f)),o))){at=f;hit=false;break;}
  const M=V3.add(A,V3.mul(u,L*at));
  return {M,u,e1,e2,w2,b,o,at,hit,P3:S?S.map(([x,y])=>V3.add(V3.add(M,o),V3.add(V3.mul(e1,x),V3.mul(e2,y)))):[]};}
