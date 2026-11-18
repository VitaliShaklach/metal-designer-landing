/* ---------- Сетка фигуры: чтение файлов, упрощение, растяжение, детали ----------
   Сетка = {V:[[x,y,z]…], F:[[a,b,c]…]} — мм, Y вверх, морда смотрит на +Z.
   Деталь = соседние треугольники в одной плоскости: один плоский кусок листа. */

const V3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];}};
const triN=(V,f)=>V3.cross(V3.sub(V[f[1]],V[f[0]]),V3.sub(V[f[2]],V[f[0]]));   // нормаль × 2·площадь

function meshBox(V){const mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];V.forEach(p=>{for(let i=0;i<3;i++){if(p[i]<mn[i])mn[i]=p[i];if(p[i]>mx[i])mx[i]=p[i];}});return {min:mn,max:mx,size:[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]]};}

// треугольники «суп» → общие вершины; вырожденные и повторные грани выкидываем
function weld(tris,eps){const P=[];tris.forEach(t=>t.forEach(p=>P.push(p)));if(!P.length)return {V:[],F:[]};
  if(!eps){const b=meshBox(P);eps=Math.max(...b.size)*1e-6||1e-6;}
  const map=new Map(),V=[],F=[],seen=new Set(),key=p=>Math.round(p[0]/eps)+','+Math.round(p[1]/eps)+','+Math.round(p[2]/eps);
  const id=p=>{const k=key(p);let i=map.get(k);if(i===undefined){i=V.length;V.push([p[0],p[1],p[2]]);map.set(k,i);}return i;};
  tris.forEach(t=>{const f=t.map(id);if(f[0]===f[1]||f[1]===f[2]||f[0]===f[2])return;const k=[...f].sort((a,b)=>a-b).join();if(seen.has(k))return;seen.add(k);F.push(f);});
  return {V,F};}
function cleanMesh(m){const used=new Map(),V=[];const F=m.F.map(f=>f.map(i=>{let j=used.get(i);if(j===undefined){j=V.length;V.push(m.V[i].slice());used.set(i,j);}return j;}));return {V,F};}

/* ---------- чтение файлов ---------- */
function parseOBJ(txt){const P=[],T=[];txt.split(/\r?\n/).forEach(l=>{const s=l.trim().split(/\s+/);
  if(s[0]==='v')P.push([+s[1],+s[2],+s[3]]);
  else if(s[0]==='f'){const ix=s.slice(1).map(w=>{const i=parseInt(w,10);return i<0?P.length+i:i-1;});for(let k=1;k+1<ix.length;k++)T.push([P[ix[0]],P[ix[k]],P[ix[k+1]]]);}});
  return weld(T.filter(t=>t.every(Boolean)));}
function parseSTL(buf){const u8=new Uint8Array(buf),dv=new DataView(buf);
  const n=buf.byteLength>=84?dv.getUint32(80,true):0;
  if(n&&84+n*50===buf.byteLength){const T=[];for(let i=0;i<n;i++){const o=84+i*50+12,t=[];for(let k=0;k<3;k++)t.push([dv.getFloat32(o+k*12,true),dv.getFloat32(o+k*12+4,true),dv.getFloat32(o+k*12+8,true)]);T.push(t);}return weld(T);}
  const txt=new TextDecoder().decode(u8),P=[];txt.replace(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g,(_,a,b,c)=>{P.push([+a,+b,+c]);return '';});
  const T=[];for(let i=0;i+2<P.length;i+=3)T.push([P[i],P[i+1],P[i+2]]);return weld(T);}
// GLB (glTF 2.0, двоичный): все сетки с учётом матриц узлов; Draco не поддерживаем
function parseGLB(buf){const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x46546C67)throw new Error('это не GLB');
  let off=12,json=null,bin=null;while(off<buf.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);
    if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,off+8,len)));else if(type===0x004E4942)bin=buf.slice(off+8,off+8+len);off+=8+len;}
  if((json.extensionsUsed||[]).includes('KHR_draco_mesh_compression'))throw new Error('файл сжат Draco — сохраните модель как OBJ или STL без сжатия');
  const acc=i=>{const a=json.accessors[i],bv=json.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4,VEC2:2}[a.type],
      T={5126:[Float32Array,4],5125:[Uint32Array,4],5123:[Uint16Array,2],5121:[Uint8Array,1]}[a.componentType],st=bv.byteStride||n*T[1],o=(bv.byteOffset||0)+(a.byteOffset||0),d=new DataView(bin),r=[];
    const get=p=>a.componentType===5126?d.getFloat32(p,true):a.componentType===5125?d.getUint32(p,true):a.componentType===5123?d.getUint16(p,true):d.getUint8(p);
    for(let i=0;i<a.count;i++){const e=[];for(let k=0;k<n;k++)e.push(get(o+i*st+k*T[1]));r.push(n===1?e[0]:e);}return r;};
  const mmul=(a,b)=>{const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[j*4+i]+=a[k*4+i]*b[j*4+k];return r;};
  const local=nd=>{if(nd.matrix)return nd.matrix;const [x,y,z,w]=nd.rotation||[0,0,0,1],[sx,sy,sz]=nd.scale||[1,1,1],[tx,ty,tz]=nd.translation||[0,0,0];
    return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0, 2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0, 2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0, tx,ty,tz,1];};
  const T=[],I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const walk=(ni,pm)=>{const nd=json.nodes[ni],m=mmul(pm,local(nd));
    if(nd.mesh!==undefined)json.meshes[nd.mesh].primitives.forEach(pr=>{if(pr.mode!==undefined&&pr.mode!==4)return;
      const P=acc(pr.attributes.POSITION).map(p=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]);
      const ix=pr.indices!==undefined?acc(pr.indices):P.map((_,i)=>i);for(let i=0;i+2<ix.length;i+=3)T.push([P[ix[i]],P[ix[i+1]],P[ix[i+2]]]);});
    (nd.children||[]).forEach(c=>walk(c,m));};
  const sc=json.scenes?json.scenes[json.scene||0].nodes:json.nodes.map((_,i)=>i);sc.forEach(i=>walk(i,I));return weld(T);}

/* ---------- поверхность из формулы (для встроенных фигур) — «surface nets» ---------- */
function sdfMesh(fn,mn,mx,cell){const nx=Math.ceil((mx[0]-mn[0])/cell)+1,ny=Math.ceil((mx[1]-mn[1])/cell)+1,nz=Math.ceil((mx[2]-mn[2])/cell)+1;
  const S=new Float32Array(nx*ny*nz),id=(i,j,k)=>i+nx*(j+ny*k),P=(i,j,k)=>[mn[0]+i*cell,mn[1]+j*cell,mn[2]+k*cell];
  // далеко от поверхности — одно значение на блок 4×4×4 (в разы быстрее)
  const B=4,R=cell*B*.87+cell;for(let K=0;K<nz;K+=B)for(let J=0;J<ny;J+=B)for(let I=0;I<nx;I+=B){const d=fn(P(I+B/2,J+B/2,K+B/2)),far=Math.abs(d)>R;
    for(let k=K;k<Math.min(K+B,nz);k++)for(let j=J;j<Math.min(J+B,ny);j++)for(let i=I;i<Math.min(I+B,nx);i++)S[id(i,j,k)]=(i&&j&&k&&i<nx-1&&j<ny-1&&k<nz-1)?(far?d:fn(P(i,j,k))):1;}
  const VI=new Int32Array(nx*ny*nz).fill(-1),V=[];
  const E=[[0,0,0,1,0,0],[0,1,0,1,1,0],[0,0,1,1,0,1],[0,1,1,1,1,1],[0,0,0,0,1,0],[1,0,0,1,1,0],[0,0,1,0,1,1],[1,0,1,1,1,1],[0,0,0,0,0,1],[1,0,0,1,0,1],[0,1,0,0,1,1],[1,1,0,1,1,1]];
  for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){let s=[0,0,0],c=0;
    E.forEach(e=>{const a=S[id(i+e[0],j+e[1],k+e[2])],b=S[id(i+e[3],j+e[4],k+e[5])];if((a<0)!==(b<0)){const t=a/(a-b);s[0]+=i+e[0]+t*(e[3]-e[0]);s[1]+=j+e[1]+t*(e[4]-e[1]);s[2]+=k+e[2]+t*(e[5]-e[2]);c++;}});
    if(c){VI[id(i,j,k)]=V.length;V.push([mn[0]+s[0]/c*cell,mn[1]+s[1]/c*cell,mn[2]+s[2]/c*cell]);}}
  const F=[],quad=(a,b,c,d,flip)=>{if(a<0||b<0||c<0||d<0)return;if(flip)F.push([a,c,b],[a,d,c]);else F.push([a,b,c],[a,c,d]);};
  for(let k=1;k<nz-1;k++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){const s0=S[id(i,j,k)]<0;
    if(i<nx-1&&(S[id(i+1,j,k)]<0)!==s0)quad(VI[id(i,j-1,k-1)],VI[id(i,j,k-1)],VI[id(i,j,k)],VI[id(i,j-1,k)],!s0);
    if(j<ny-1&&(S[id(i,j+1,k)]<0)!==s0)quad(VI[id(i-1,j,k-1)],VI[id(i-1,j,k)],VI[id(i,j,k)],VI[id(i,j,k-1)],!s0);
    if(k<nz-1&&(S[id(i,j,k+1)]<0)!==s0)quad(VI[id(i-1,j-1,k)],VI[id(i,j-1,k)],VI[id(i,j,k)],VI[id(i-1,j,k)],!s0);}
  return {V,F};}
// срезать плоскость: убрать грани, лежащие на стене (открытая спина у головы на стену)
function openCut(m,axis,val,dir,tol){const F=m.F.filter(f=>{const n=V3.norm(triN(m.V,f));return !(n[axis]*dir>.7&&f.every(i=>Math.abs(m.V[i][axis]-val)<tol));});
  const r=cleanMesh({V:m.V,F});const B=boundaryVerts(r.F);B.forEach(i=>{if(Math.abs(r.V[i][axis]-val)<tol*1.5)r.V[i][axis]=val;});return r;}
function boundaryVerts(F){const c=new Map();F.forEach(f=>{for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=a<b?a+'_'+b:b+'_'+a;c.set(key,(c.get(key)||0)+1);}});
  const s=new Set();c.forEach((n,k)=>{if(n===1)k.split('_').forEach(x=>s.add(+x));});return s;}

/* ---------- упрощение: стягивание рёбер по квадрикам (Garland–Heckbert) ---------- */
function clusterMesh(m,cell){const map=new Map(),V=[],cnt=[];const vi=m.V.map(p=>{const k=Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell)+','+Math.floor(p[2]/cell);let i=map.get(k);
    if(i===undefined){i=V.length;V.push([0,0,0]);cnt.push(0);map.set(k,i);}V[i][0]+=p[0];V[i][1]+=p[1];V[i][2]+=p[2];cnt[i]++;return i;});
  V.forEach((p,i)=>{p[0]/=cnt[i];p[1]/=cnt[i];p[2]/=cnt[i];});const seen=new Set(),F=[];
  m.F.forEach(f=>{const g=f.map(i=>vi[i]);if(g[0]===g[1]||g[1]===g[2]||g[0]===g[2])return;const k=[...g].sort((a,b)=>a-b).join();if(seen.has(k))return;seen.add(k);F.push(g);});return cleanMesh({V,F});}
function simplify(m,target,o={}){
  let mesh=m;if(mesh.F.length>60000&&!o.noCluster){const b=meshBox(mesh.V),d=V3.len(b.size);let c=d/400;do{mesh=clusterMesh(m,c);c*=1.25;}while(mesh.F.length>60000);}
  if(mesh.F.length<=target)return cleanMesh(mesh);
  const V=mesh.V.map(p=>p.slice()),F=mesh.F.map(f=>f.slice()),alive=F.map(()=>true),VF=V.map(()=>new Set());F.forEach((f,i)=>f.forEach(v=>VF[v].add(i)));
  const Q=V.map(()=>new Float64Array(10)),addQ=(q,a,b,c,d,w)=>{q[0]+=w*a*a;q[1]+=w*a*b;q[2]+=w*a*c;q[3]+=w*a*d;q[4]+=w*b*b;q[5]+=w*b*c;q[6]+=w*b*d;q[7]+=w*c*c;q[8]+=w*c*d;q[9]+=w*d*d;};
  F.forEach(f=>{const n=triN(V,f),ar=V3.len(n)/2;if(!ar)return;const u=V3.mul(n,1/(2*ar)),d=-V3.dot(u,V[f[0]]);f.forEach(v=>addQ(Q[v],u[0],u[1],u[2],d,ar));});
  // края (открытая спина) держим на месте: плоскость поперёк края с большим весом
  const ec=new Map();F.forEach((f,fi)=>{for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=a<b?a+'_'+b:b+'_'+a;const e=ec.get(key);if(e)e.n++;else ec.set(key,{n:1,a,b,f:fi});}});
  ec.forEach(e=>{if(e.n!==1)return;const ed=V3.sub(V[e.b],V[e.a]),L=V3.len(ed);if(!L)return;const p=V3.norm(V3.cross(ed,triN(V,F[e.f]))),d=-V3.dot(p,V[e.a]);[e.a,e.b].forEach(v=>addQ(Q[v],p[0],p[1],p[2],d,L*L*50));});
  const err=(q,p)=>{const [x,y,z]=p;return q[0]*x*x+2*q[1]*x*y+2*q[2]*x*z+2*q[3]*x+q[4]*y*y+2*q[5]*y*z+2*q[6]*y+q[7]*z*z+2*q[8]*z+q[9];};
  const ver=new Int32Array(V.length);let avgA=0;F.forEach(f=>avgA+=V3.len(triN(V,f))/2);avgA/=F.length||1;const LAM=(typeof LAMBDA!=="undefined"?LAMBDA:.05)*avgA;
  const best=(u,v)=>{const q=new Float64Array(10);for(let i=0;i<10;i++)q[i]=Q[u][i]+Q[v][i];
    const a=q[0],b=q[1],c=q[2],d=q[4],e=q[5],f=q[7],det=a*(d*f-e*e)-b*(b*f-c*e)+c*(b*e-c*d);let cands=[V[u],V[v],V3.mul(V3.add(V[u],V[v]),.5)];
    if(Math.abs(det)>1e-9){const r=[-q[3],-q[6],-q[8]];const x=(r[0]*(d*f-e*e)-b*(r[1]*f-e*r[2])+c*(r[1]*e-d*r[2]))/det,y=(a*(r[1]*f-e*r[2])-r[0]*(b*f-c*e)+c*(b*r[2]-r[1]*c))/det,z=(a*(d*r[2]-r[1]*e)-b*(b*r[2]-r[1]*c)+r[0]*(b*e-c*d))/det;
      const p=[x,y,z],L=V3.len(V3.sub(V[u],V[v]));if(V3.len(V3.sub(p,V3.mul(V3.add(V[u],V[v]),.5)))<L*2)cands.push(p);}
    const L2=V3.dot(V3.sub(V[u],V[v]),V3.sub(V[u],V[v]));let bp=null,be=Infinity;cands.forEach(p=>{const ev=err(q,p)+LAM*L2;if(ev<be){be=ev;bp=p;}});return {cost:be,p:bp};};
  // куча (мин) — ленивая: устаревшие записи узнаём по версиям вершин
  const H=[],push=x=>{H.push(x);let i=H.length-1;while(i){const p=(i-1)>>1;if(H[p].cost<=x.cost)break;H[i]=H[p];i=p;}H[i]=x;},
    pop=()=>{const top=H[0],x=H.pop();if(H.length){let i=0;for(;;){let c=2*i+1;if(c>=H.length)break;if(c+1<H.length&&H[c+1].cost<H[c].cost)c++;if(H[c].cost>=x.cost)break;H[i]=H[c];i=c;}H[i]=x;}return top;};
  const nb=v=>{const s=new Set();VF[v].forEach(fi=>F[fi].forEach(w=>{if(w!==v)s.add(w);}));return s;};
  const pushEdge=(u,v)=>{const b=best(u,v);push({cost:b.cost,u,v,p:b.p,vu:ver[u],vv:ver[v]});};
  ec.forEach(e=>pushEdge(e.a,e.b));
  let live=F.length;
  while(live>target&&H.length){const x=pop();const {u,v}=x;if(ver[u]!==x.vu||ver[v]!==x.vv||!VF[u].size||!VF[v].size)continue;
    // не ломаем сетку: общих соседей у u и v — столько же, сколько общих граней
    const nu=nb(u),nv=nb(v);let common=0;nu.forEach(w=>{if(nv.has(w))common++;});let shared=0;VF[u].forEach(fi=>{if(VF[v].has(fi))shared++;});if(common!==shared||!shared)continue;
    // не переворачиваем грани и не делаем иголок
    let bad=false;const chk=(w)=>{VF[w].forEach(fi=>{if(bad||VF[u].has(fi)&&VF[v].has(fi))return;const f=F[fi],n0=triN(V,f),g=f.map(i=>i===u||i===v?x.p:V[i]);
      const n1=V3.cross(V3.sub(g[1],g[0]),V3.sub(g[2],g[0])),l0=V3.len(n0),l1=V3.len(n1);if(!l1||V3.dot(n0,n1)<.2*l0*l1){bad=true;return;}
      const e2=Math.max(V3.len(V3.sub(g[1],g[0])),V3.len(V3.sub(g[2],g[1])),V3.len(V3.sub(g[0],g[2])));if(l1/(e2*e2)<(typeof QMIN!=="undefined"?QMIN:.02))bad=true;});};
    chk(u);chk(v);if(bad){continue;}
    VF[u].forEach(fi=>{if(VF[v].has(fi)){alive[fi]=false;live--;F[fi].forEach(w=>{if(w!==u&&w!==v)VF[w].delete(fi);});}});
    VF[v].forEach(fi=>{if(alive[fi]){F[fi]=F[fi].map(i=>i===v?u:i);VF[u].add(fi);}});
    [...VF[u]].forEach(fi=>{if(!alive[fi])VF[u].delete(fi);});VF[v].clear();V[u]=x.p;for(let i=0;i<10;i++)Q[u][i]+=Q[v][i];ver[u]++;ver[v]++;
    nb(u).forEach(w=>pushEdge(u,w));}
  return cleanMesh({V,F:F.filter((_,i)=>alive[i])});}

/* ---------- растяжение: высота / ширина / глубина в мм; плоское остаётся плоским ---------- */
function fitMesh(m,dims){const b=meshBox(m.V),s=[dims.W/(b.size[0]||1),dims.H/(b.size[1]||1),dims.D/(b.size[2]||1)];
  const cx=(b.min[0]+b.max[0])/2;   // по x — центр (ось симметрии), снизу y=0, стена z=0
  return {V:m.V.map(p=>[(p[0]-cx)*s[0],(p[1]-b.min[1])*s[1],(p[2]-b.min[2])*s[2]]),F:m.F};}

/* ---------- детали: соседние треугольники в одной плоскости; m.T (из какой грани-многоугольника) — треугольники одной грани всегда вместе ---------- */
const DENS={steel:7850,inox:7900,corten:7850,alu:2700};
function buildParts(m,tolDeg=.5,tolMm=.3){const {V,F}=m,SK=new Set((m.S||[]).flatMap(([a,b])=>[a+'_'+b,b+'_'+a])),N=F.map(f=>V3.norm(triN(V,f))),cos=Math.cos(tolDeg*Math.PI/180);
  const E=new Map(),ek=(a,b)=>a<b?a+'_'+b:b+'_'+a;F.forEach((f,fi)=>{for(let k=0;k<3;k++){const key=ek(f[k],f[(k+1)%3]);(E.get(key)||E.set(key,[]).get(key)).push(fi);}});
  const part=new Int32Array(F.length).fill(-1),groups=[];
  F.forEach((f,s)=>{if(part[s]>=0)return;const g=[s],pl=V3.dot(N[s],V[f[0]]);part[s]=groups.length;
    for(let q=0;q<g.length;q++){const fi=g[q],ff=F[fi];for(let k=0;k<3;k++)(E.get(ek(ff[k],ff[(k+1)%3]))||[]).forEach(o=>{
      if(part[o]>=0)return;if(SK.size&&SK.has(ff[k]+'_'+ff[(k+1)%3])&&!(m.T&&m.T[o]===m.T[fi]))return;if(!(m.T&&m.T[o]===m.T[fi])){if(V3.dot(N[o],N[s])<cos)return;if(F[o].some(i=>Math.abs(V3.dot(N[s],V[i])-pl)>tolMm))return;}part[o]=groups.length;g.push(o);});}
    groups.push(g);});
  // контур детали: рёбра, которые не делятся с треугольником той же детали
  const parts=groups.map((g,pi)=>{const n=V3.norm(g.reduce((s,fi)=>V3.add(s,triN(V,F[fi])),[0,0,0]));let area=0;g.forEach(fi=>area+=V3.len(triN(V,F[fi]))/2);
    const nxt=new Map();g.forEach(fi=>{const f=F[fi];for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],o=E.get(ek(a,b)).filter(x=>x!==fi);if(!o.some(x=>part[x]===pi))nxt.set(a,b);}});
    const loops=[],used=new Set();nxt.forEach((_,st)=>{if(used.has(st))return;const L=[];let c=st;while(c!==undefined&&!used.has(c)){used.add(c);L.push(c);c=nxt.get(c);}if(L.length>2)loops.push(L);});
    loops.sort((a,b)=>b.length-a.length);
    // убираем лишние вершины на прямой (из-за триангуляции)
    const loop=(loops[0]||[]).filter((v,i,L)=>{const a=V[L[(i+L.length-1)%L.length]],b=V[v],c=V[L[(i+1)%L.length]];const d1=V3.norm(V3.sub(b,a)),d2=V3.norm(V3.sub(c,b));return V3.dot(d1,d2)<.99995;});
    const c=V3.mul(loop.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/(loop.length||1));
    return {tris:g,n,area,loop,full:loops[0]||[],holes:loops.length-1,c};});
  // соседи и углы между гранями
  const edges=[];E.forEach((fs,key)=>{const [a,b]=key.split('_').map(Number);const ps=[...new Set(fs.map(fi=>part[fi]))];
    if(ps.length===1&&fs.length===1){edges.push({a,b,p:[ps[0]],open:true,len:V3.len(V3.sub(V[a],V[b]))});return;}
    if(ps.length!==2)return;const [p,q]=ps,P=parts[p],Qp=parts[q];const ang=Math.acos(Math.max(-1,Math.min(1,V3.dot(P.n,Qp.n))))*180/Math.PI;
    const convex=V3.dot(V3.sub(Qp.c,P.c),P.n)<0;edges.push({a,b,p:[p,q],len:V3.len(V3.sub(V[a],V[b])),dih:convex?180-ang:180+ang,convex});});
  // стороны детали (по развёртке): длина, сосед, угол между гранями
  const EB=new Map();edges.forEach(e=>EB.set(ek(e.a,e.b),e));
  parts.forEach((P,pi)=>{const keep=new Set(P.loop),f=P.full,st=f.findIndex(v=>keep.has(v));P.segs=[];if(st<0)return;
    for(let k=0;k<f.length;){const i0=(st+k)%f.length;let len=0,j=k;do{const a=f[(st+j)%f.length],b=f[(st+j+1)%f.length];len+=V3.len(V3.sub(V[b],V[a]));j++;}while(!keep.has(f[(st+j)%f.length]));
      const e=EB.get(ek(f[i0],f[(i0+1)%f.length]))||{};P.segs.push({len,nb:e.open||!e.p?-1:e.p.find(x=>x!==pi),dih:e.dih});k=j;}});
  // нумерация: от самой верхней детали — по соседям, чтобы соседние номера лежали рядом
  const adj=parts.map(()=>new Set());edges.forEach(e=>{if(e.p.length===2){adj[e.p[0]].add(e.p[1]);adj[e.p[1]].add(e.p[0]);}});
  const order=[],seen=new Set();const byTop=parts.map((_,i)=>i).sort((i,j)=>parts[j].c[1]-parts[i].c[1]||parts[i].c[0]-parts[j].c[0]);
  byTop.forEach(s=>{if(seen.has(s))return;const q=[s];seen.add(s);while(q.length){const i=q.shift();order.push(i);[...adj[i]].sort((a,b)=>parts[b].c[1]-parts[a].c[1]||parts[a].c[0]-parts[b].c[0]).forEach(j=>{if(!seen.has(j)){seen.add(j);q.push(j);}});}});
  order.forEach((pi,k)=>{parts[pi].no=k+1;});
  parts.forEach((P,pi)=>{P.id=pi;P.adj=[...adj[pi]];Object.assign(P,flatten(V,P));});
  return {parts,edges,partOf:part};}

// развёртка детали на плоскость: длинная сторона — по X, узкая — по Y
function flatten(V,P){if(P.loop.length<3)return {pts:[],L:0,W:0,minW:0,perim:0};const o=V[P.loop[0]];let u=V3.norm(V3.sub(V[P.loop[1]],o));const w=V3.norm(V3.cross(P.n,u));
  let pts=P.loop.map(i=>{const d=V3.sub(V[i],o);return [V3.dot(d,u),V3.dot(d,w)];});
  // ширина детали — наименьшая по всем направлениям (по сторонам выпуклой оболочки)
  const hull=convexHull(pts);let bw=Infinity,ba=0;hull.forEach((p,i)=>{const q=hull[(i+1)%hull.length],a=Math.atan2(q[1]-p[1],q[0]-p[0]),c=Math.cos(a),s=Math.sin(a);
    let mn=Infinity,mx=-Infinity;hull.forEach(h=>{const y=-s*h[0]+c*h[1];if(y<mn)mn=y;if(y>mx)mx=y;});if(mx-mn<bw){bw=mx-mn;ba=a;}});
  const c=Math.cos(-ba),s=Math.sin(-ba);pts=pts.map(p=>[c*p[0]-s*p[1],s*p[0]+c*p[1]]);
  const mnx=Math.min(...pts.map(p=>p[0])),mny=Math.min(...pts.map(p=>p[1]));pts=pts.map(p=>[p[0]-mnx,p[1]-mny]);
  const L=Math.max(...pts.map(p=>p[0])),W=Math.max(...pts.map(p=>p[1]));let perim=0;pts.forEach((p,i)=>{const q=pts[(i+1)%pts.length];perim+=Math.hypot(q[0]-p[0],q[1]-p[1]);});
  return {pts,L,W,minW:bw,perim};}
function convexHull(P){const p=P.map(x=>x.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];p.forEach(x=>{while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],x)<=0)lo.pop();lo.push(x);});
  for(let i=p.length-1;i>=0;i--){const x=p[i];while(up.length>1&&cr(up[up.length-2],up[up.length-1],x)<=0)up.pop();up.push(x);}
  lo.pop();up.pop();return lo.concat(up);}

// итоги: масса, рез, швы, листы
function totals(R,o){const dens=DENS[o.mat]||7850,t=o.t;let area=0,cut=0,weld=0,open=0;R.parts.forEach(p=>{area+=p.area;cut+=p.perim;});
  R.edges.forEach(e=>{if(e.open)open+=e.len;else weld+=e.len;});
  const mass=area*1e-6*t*1e-3*dens,minW=Math.min(...R.parts.map(p=>p.minW)),sheet=o.sheet[0]*o.sheet[1];
  return {n:R.parts.length,area,cut,weld,open,mass,minW,sheets:Math.max(1,Math.ceil(area/(sheet*.7)))};}

/* ---------- мелкие «иголки»: стянуть короткое ребро или перевернуть диагональ ----------
   thr — наименьшая ширина треугольника, мм (плазма ≈ 30, лазер ≈ 15) */
function fixSlivers(m,thr,maxIt=400){let V=m.V.map(p=>p.slice()),F=m.F.map(f=>f.slice());
  const h=f=>{const a=V[f[0]],b=V[f[1]],c=V[f[2]],L=Math.max(V3.len(V3.sub(b,a)),V3.len(V3.sub(c,b)),V3.len(V3.sub(a,c)));return V3.len(triN(V,f))/(L||1);};
  const ek=(a,b)=>a<b?a+'_'+b:b+'_'+a;const skip=new Set();
  for(let it=0;it<maxIt;it++){const E=new Map();F.forEach((f,fi)=>{for(let k=0;k<3;k++){const key=ek(f[k],f[(k+1)%3]);(E.get(key)||E.set(key,[]).get(key)).push(fi);}});
    let wi=-1,wh=thr;F.forEach((f,fi)=>{if(skip.has(f.join()))return;const x=h(f);if(x<wh){wh=x;wi=fi;}});if(wi<0)break;
    const f=F[wi],ed=[0,1,2].map(k=>[f[k],f[(k+1)%3],f[(k+2)%3]]).map(([a,b,o])=>({a,b,o,L:V3.len(V3.sub(V[a],V[b]))})).sort((x,y)=>x.L-y.L);
    const short=ed[0],long=ed[2];let done=false;
    // «колпак» (тупой угол) — переворачиваем длинное ребро, если соседний треугольник почти в той же плоскости
    if(short.L>thr){const o=(E.get(ek(long.a,long.b))||[]).find(x=>x!==wi);if(o!==undefined){const g=F[o],p=g.find(v=>v!==long.a&&v!==long.b);
      const n1=V3.norm(triN(V,f)),n2=V3.norm(triN(V,g));if(V3.dot(n1,n2)>Math.cos(25*Math.PI/180)&&!E.has(ek(long.o,p))){
        const t1=[long.o,long.a,p],t2=[long.o,p,long.b];if(V3.dot(triN(V,t1),n1)>0&&V3.dot(triN(V,t2),n1)>0&&Math.min(h(t1),h(t2))>wh){
          F[wi]=f[0]===long.a&&f[1]===long.b||f[1]===long.a&&f[2]===long.b||f[2]===long.a&&f[0]===long.b?[long.o,long.a,p]:[long.o,p,long.a];
          F[o]=f[0]===long.a&&f[1]===long.b||f[1]===long.a&&f[2]===long.b||f[2]===long.a&&f[0]===long.b?[long.o,p,long.b]:[long.o,long.b,p];done=true;}}}}
    // «иголка» — стягиваем самое короткое ребро в середину
    if(!done){const {a,b}=short,mid=V3.mul(V3.add(V[a],V[b]),.5);const fa=F.filter(g=>g.includes(a)||g.includes(b));
      const na=new Set(),nb=new Set();F.forEach(g=>{if(g.includes(a))g.forEach(x=>x!==a&&na.add(x));if(g.includes(b))g.forEach(x=>x!==b&&nb.add(x));});
      let common=0;na.forEach(x=>{if(nb.has(x))common++;});const shared=(E.get(ek(a,b))||[]).length;
      let ok=common===shared&&shared>0;if(ok)fa.forEach(g=>{if(g.includes(a)&&g.includes(b))return;const q=g.map(i=>i===a||i===b?mid:V[i]),n0=triN(V,g),n1=V3.cross(V3.sub(q[1],q[0]),V3.sub(q[2],q[0]));if(V3.dot(n0,n1)<=.3*V3.len(n0)*V3.len(n1))ok=false;});
      if(ok){V[a]=mid;F=F.filter(g=>!(g.includes(a)&&g.includes(b))).map(g=>g.map(i=>i===b?a:i));done=true;}}
    if(!done)skip.add(f.join());}
  return cleanMesh({V,F});}

/* ---------- ручная гранёная модель: многоугольники → в плоскость → треугольники ----------
   polys — грани-многоугольники; fix(i,p) — держит точку на своём месте (середина x=0, стена z=0…) */
function planarize(V,polys,fix,it=400){V=V.map(p=>p.slice());
  for(let k=0;k<it;k++){const acc=V.map(()=>[0,0,0]),cnt=V.map(()=>0);
    polys.forEach(P=>{if(P.length<4)return;const c=V3.mul(P.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/P.length);let n=[0,0,0];
      P.forEach((i,j)=>{const a=V[i],b=V[P[(j+1)%P.length]];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);});n=V3.norm(n);
      P.forEach(i=>{const d=V3.dot(V3.sub(V[i],c),n);acc[i]=V3.add(acc[i],V3.sub(V[i],V3.mul(n,d)));cnt[i]++;});});
    V=V.map((p,i)=>{const q=cnt[i]?V3.mul(acc[i],1/cnt[i]):p;return fix?fix(i,q):q;});}
  return V;}
// грани наружу: соседние грани — согласованно, а в целом — от центра фигуры
function orientPolys(V,polys,center){const ek=(a,b)=>a<b?a+'_'+b:b+'_'+a,E=new Map();polys.forEach((P,pi)=>P.forEach((a,j)=>{const k=ek(a,P[(j+1)%P.length]);(E.get(k)||E.set(k,[]).get(k)).push(pi);}));
  const done=new Set(),out=polys.map(P=>P.slice());
  polys.forEach((_,s)=>{if(done.has(s))return;const q=[s],comp=[s];done.add(s);
    while(q.length){const pi=q.shift(),P=out[pi];P.forEach((a,j)=>{const b=P[(j+1)%P.length];(E.get(ek(a,b))||[]).forEach(o=>{if(done.has(o))return;const Q=out[o],k=Q.indexOf(a);if(Q[(k+1)%Q.length]===b)Q.reverse();done.add(o);q.push(o);comp.push(o);});});}
    let vote=0;comp.forEach(pi=>{const P=out[pi],c=V3.mul(P.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/P.length),n=V3.cross(V3.sub(V[P[1]],V[P[0]]),V3.sub(V[P[2]],V[P[0]]));vote+=Math.sign(V3.dot(n,V3.sub(c,center)));});
    if(vote<0)comp.forEach(pi=>out[pi].reverse());});
  return out;}
function polyMesh(V,polys){const F=[];polys.forEach(P=>earClip(V,P).forEach(t=>F.push(t)));return {V,F};}

/* ---------- слить почти плоские грани (как Limited Dissolve в Blender) ----------
   Соседние треугольники, которые отходят от общей плоскости меньше чем на deg° и tolMm мм, — одна грань-многоугольник.
   Грань растёт от самого большого треугольника и остаётся «диском» (без дыр и перемычек).
   Точки на шве ровно двух граней убираем — после выравнивания шов прямой. Возвращает {V,P}. */
function dissolve(m,deg,tolMm){const {V,F}=m,N=F.map(f=>V3.norm(triN(V,f))),A=F.map(f=>V3.len(triN(V,f))/2),C=F.map(f=>V3.mul(V3.add(V3.add(V[f[0]],V[f[1]]),V[f[2]]),1/3));
  const cos=Math.cos(deg*Math.PI/180),ek=(a,b)=>a<b?a+'_'+b:b+'_'+a,E=new Map();F.forEach((f,fi)=>{for(let k=0;k<3;k++){const key=ek(f[k],f[(k+1)%3]);(E.get(key)||E.set(key,[]).get(key)).push(fi);}});
  const across=(fi,a,b)=>(E.get(ek(a,b))||[]).find(x=>x!==fi);
  const reg=new Int32Array(F.length).fill(-1),P=[];let nid=0;
  F.map((_,i)=>i).sort((a,b)=>A[b]-A[a]).forEach(s=>{if(reg[s]>=0)return;const id=nid++,tris=[s],vs=new Set(F[s]);reg[s]=id;
    let ns=V3.mul(N[s],A[s]),cs=V3.mul(C[s],A[s]),as=A[s];
    for(;;){const n=V3.norm(ns),c=V3.mul(cs,1/as);let best=-1,bd=-2;
      tris.forEach(t=>{const f=F[t];for(let k=0;k<3;k++){const o=across(t,f[k],f[(k+1)%3]);if(o===undefined||reg[o]>=0)continue;const d=V3.dot(N[o],n);if(d<cos||d<=bd)continue;
        const g=F[o];if(g.some(v=>Math.abs(V3.dot(V3.sub(V[v],c),n))>tolMm))continue;
        // диск: треугольник касается грани одним ребром, а третьей вершиной уже лежит на ней — получится перемычка или дыра
        const on=[0,1,2].filter(j=>{const x=across(o,g[j],g[(j+1)%3]);return x!==undefined&&reg[x]===id;});
        if(on.length===1&&vs.has(g[(on[0]+2)%3]))continue;
        best=o;bd=d;}});
      if(best<0)break;reg[best]=id;tris.push(best);F[best].forEach(v=>vs.add(v));ns=V3.add(ns,V3.mul(N[best],A[best]));cs=V3.add(cs,V3.mul(C[best],A[best]));as+=A[best];}
    // контур грани: рёбра, за которыми не эта грань
    const nxt=new Map();let ok=true;tris.forEach(t=>{const f=F[t];for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],o=across(t,a,b);if(o===undefined||reg[o]!==id){if(nxt.has(a))ok=false;nxt.set(a,b);}}});
    const L=[];if(ok){let c=nxt.keys().next().value;while(c!==undefined&&L.length<=nxt.size){L.push(c);c=nxt.get(c);if(c===L[0])break;}if(L.length!==nxt.size)ok=false;}
    if(ok&&L.length>=3)P.push(L);else tris.forEach(t=>P.push(F[t].slice()));});
  // точки на шве ровно двух граней (не на открытом краю), почти на прямой между соседями, — лишние; кончик уха — нет
  const VP=V.map(()=>new Set()),open=new Set();P.forEach((Q,pi)=>Q.forEach(v=>VP[v].add(pi)));
  E.forEach((fs,key)=>{if(fs.length===1)key.split('_').forEach(x=>open.add(+x));});
  const offLine=(p,a,b)=>{const ab=V3.sub(b,a),l=V3.dot(ab,ab)||1,t=Math.max(0,Math.min(1,V3.dot(V3.sub(p,a),ab)/l));return V3.len(V3.sub(p,V3.add(a,V3.mul(ab,t))));};
  V.forEach((_,v)=>{if(open.has(v)||VP[v].size!==2)return;const [a,b]=[...VP[v]];if(P[a].length<4||P[b].length<4)return;
    const Q=P[a],k=Q.indexOf(v);if(offLine(V[v],V[Q[(k+Q.length-1)%Q.length]],V[Q[(k+1)%Q.length]])>tolMm)return;
    [a,b].forEach(pi=>{P[pi]=P[pi].filter(x=>x!==v);});});
  return compact({V,P});}
// многоугольник → треугольники «отрезанием ушей» (для невыпуклых граней веер не годится)
function earClip(V,Q){const n=Q.length;if(n<4)return [Q.slice()];let nn=[0,0,0];Q.forEach((i,j)=>{const a=V[i],b=V[Q[(j+1)%n]];nn[0]+=(a[1]-b[1])*(a[2]+b[2]);nn[1]+=(a[2]-b[2])*(a[0]+b[0]);nn[2]+=(a[0]-b[0])*(a[1]+b[1]);});
  // координаты в плоскости грани; обход против часовой
  const N=V3.norm(nn),o=V[Q[0]];let u=Math.abs(N[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(N,V3.dot(u,N))));const w=V3.cross(N,u);
  const P2=new Map();Q.forEach(i=>{const d=V3.sub(V[i],o);P2.set(i,[V3.dot(d,u),V3.dot(d,w)]);});const p=i=>P2.get(i);
  let sz=0;Q.forEach(i=>{const q=p(i);sz=Math.max(sz,Math.abs(q[0]),Math.abs(q[1]));});const eps=1e-9*sz*sz;
  const cr=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  // точка внутри уха: строго внутри по сторонам многоугольника, касание диагонали — тоже мешает
  const inT=(x,a,b,c)=>cr(a,b,x)>eps&&cr(b,c,x)>eps&&cr(c,a,x)>-eps;
  const R=Q.slice(),T=[];let guard=0;
  while(R.length>3&&guard++<n*n){let cut=-1,best=-1,bc=eps;
    for(let k=0;k<R.length;k++){const ia=R[(k+R.length-1)%R.length],ib=R[k],ic=R[(k+1)%R.length],a=p(ia),b=p(ib),c=p(ic),x=cr(a,b,c);if(x<=eps)continue;
      if(x>bc){bc=x;best=k;}if(R.some(j=>j!==ia&&j!==ib&&j!==ic&&inT(p(j),a,b,c)))continue;cut=k;break;}
    if(cut<0)cut=best;   // ушей «по правилам» нет (почти прямые углы, совпадающие точки) — режем самый выпуклый угол
    if(cut<0){for(let k=1;k+1<R.length;k++)T.push([R[0],R[k],R[k+1]]);return T;}
    T.push([R[(cut+R.length-1)%R.length],R[cut],R[(cut+1)%R.length]]);R.splice(cut,1);}
  T.push(R);return T;}

/* ---------- камера на деталь: деталь лицом к зрителю, занимает около трети кадра ----------
   c, n — центр и нормаль детали (наружу), size — её наибольший размер, box — габарит фигуры, cur — текущее направление камеры (от цели к камере).
   Возвращает {pos, target}; ближе 250 мм не подлетаем, дальше вида на всю фигуру — не отлетаем */
function partCam(c,n,size,box,cur,fov=35){let d=V3.norm(V3.add(n,V3.mul(cur||[0,0,1],.25)));if(Math.abs(d[1])>.97)d=V3.norm(V3.add(d,[0,0,.2]));
  const tn=Math.tan(fov*Math.PI/360),far=Math.max(...box.size)*.6/tn,dist=Math.min(far,Math.max(250,size*1.5/tn));
  return {pos:V3.add(c,V3.mul(d,dist)),target:c.slice(),dist};}
