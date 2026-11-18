/* ---------- Встроенные фигуры: гладкая форма из эллипсоидов → сетка → упрощение до граней ----------
   Мм, Y вверх, морда на +Z. Голова на стену — открытая спина (срез по плоскости стены). */
const SDF={
  ell:(p,c,r)=>{const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];return (Math.hypot(x,y,z)-1)*Math.min(r[0],r[1],r[2]);},
  // эллипсоид, повёрнутый вокруг Z (a) и X (b), градусы
  ellR:(p,c,r,a=0,b=0)=>{let x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2];const ca=Math.cos(-a*Math.PI/180),sa=Math.sin(-a*Math.PI/180);[x,y]=[ca*x-sa*y,sa*x+ca*y];
    const cb=Math.cos(-b*Math.PI/180),sb=Math.sin(-b*Math.PI/180);[y,z]=[cb*y-sb*z,sb*y+cb*z];return SDF.ell([x,y,z],[0,0,0],r);},
  cap:(p,a,b,r)=>{const ab=V3.sub(b,a),ap=V3.sub(p,a),t=Math.max(0,Math.min(1,V3.dot(ap,ab)/V3.dot(ab,ab)));return V3.len(V3.sub(ap,V3.mul(ab,t)))-r(t);},
  smin:(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k/4;},
  U:(k,...d)=>d.reduce((a,b)=>SDF.smin(a,b,k))};
// два уха / рога — зеркально по X
const sym=(f)=>p=>Math.min(f(p),f([-p[0],p[1],p[2]]));

const FIGURES={};

// построить фигуру: формула → плотная сетка → открытая спина
function figureMesh(id,cell=12){const f=FIGURES[id];if(f.poly)return f.build();if(f.mesh)return f.mesh();const sd=p=>Math.max(f.sdf(p),f.back-p[2],-p[1]);   // срез стеной сзади и снизу
  let m=sdfMesh(sd,f.box[0],f.box[1],cell);m=openCut(m,2,f.back,-1,cell*.8);return m;}

/* ---------- Доберман 2: модель руками, как у мастеров — крупные плоские грани ----------
   Голова и шея — 6 сечений от стены (z=0) к носу; между соседними — четырёхугольные грани.
   Уши — острые пирамиды, глаза — впадина. Точки задаём справа (x ≥ 0), левая половина — зеркало. */
function buildDoberman(){
  const R=[[0,[[0,0],[80,15],[135,190],[138,335],[118,415],[0,435]]],
    [110,[[0,60],[85,60],[130,195],[135,340],[110,428],[0,450]]],
    [210,[[0,215],[88,222],[120,280],[122,345],[88,410],[0,428]]],
    [290,[[0,200],[62,208],[78,250],[76,315],[52,356],[0,372]]],
    [370,[[0,195],[50,200],[58,240],[54,298],[36,322],[0,334]]],
    [405,[[0,205],[36,208],[42,240],[40,275],[28,300],[0,308]]]];
  const V=[],fixd=[],mir=[];const add=(p,f)=>{V.push(p);fixd.push(f||{});return V.length-1;};
  // вершина справа и её зеркало (на середине — одна)
  const pt=(p,f)=>{const i=add(p,Object.assign({mid:p[0]===0},f));mir[i]=p[0]===0?i:add([-p[0],p[1],p[2]],f);if(p[0]!==0)mir[mir[i]]=i;return i;};
  const ring=R.map(([z,ps],ri)=>ps.map(([x,y])=>pt([x,y,z],ri===0?{wall:1}:ri===R.length-1?{cap:z}:{})));
  const P=[];const quad=(i,j)=>[ring[i][j],ring[i][j+1],ring[i+1][j+1],ring[i+1][j]];
  for(let i=0;i<R.length-1;i++)for(let j=0;j<5;j++){
    if(i===0&&j===4){ // макушка у стены — тут стоит ухо
      const A=ring[0][4],B=ring[0][5],C=ring[1][5],D=ring[1][4],G=pt([48,450,55]),T=pt([150,660,50]);
      // ушная раковина: точка K утоплена внутрь уха — передняя грань становится воронкой из трёх
      const c3=V3.mul(V3.add(V3.add(V[G],V[D]),V[T]),1/3),K=pt(V3.add(V3.mul(c3,.55),V3.mul(V[A],.45)));
      P.push([G,A,B],[G,B,C],[G,C,D],[G,D,K],[D,T,K],[T,G,K],[A,D,T],[G,A,T]);continue;}
    if(i===2&&j===3){ // глаз — впадина посреди грани
      const q=quad(i,j),c=V3.mul(q.reduce((s,k)=>V3.add(s,V[k]),[0,0,0]),.25),n=V3.norm(V3.cross(V3.sub(V[q[2]],V[q[0]]),V3.sub(V[q[3]],V[q[1]])));
      const E=pt(V3.add(c,V3.mul(n,V3.dot(n,V3.sub(c,[0,300,120]))>0?-18:18)));q.forEach((k,m)=>P.push([k,q[(m+1)%4],E]));continue;}
    P.push(quad(i,j));}
  const cap=ring[R.length-1];P.push([...cap,...cap.slice(1,5).reverse().map(k=>mir[k])]);
  // левая половина
  const all=P.concat(P.filter(Q=>!(Q.length>4)).map(Q=>Q.map(k=>mir[k]).reverse()).filter(Q=>Q.some((k,m)=>k!==P[0][m])));
  // убираем повторы (грани на середине у зеркала совпадают с исходными)
  const seen=new Set(),polys=[];all.forEach(Q=>{const k=[...Q].sort((a,b)=>a-b).join();if(seen.has(k))return;seen.add(k);polys.push(Q);});
  const fix=(i,q)=>{const f=fixd[i];if(f.mid)q[0]=0;if(f.wall)q[2]=0;if(f.cap!==undefined)q[2]=f.cap;return q;};
  const or=orientPolys(V,polys,[0,300,120]);
  return polyBase(planarize(V,or,fix),or);}

/* ---------- Доберман 3 — по снимкам модели Meshy ----------
   Не кольцами, а явными плитами, как на фото. Спина — закрытая пластина крепления (z=0).
   Точки правой половины (x ≥ 0), мм при высоте 600; имя с «'» — зеркальная точка слева. */
function buildNamed(pts,faces,o={}){const V=[],idx={},fixd=[];
  const get=nm=>{const m=nm.endsWith("'"),b=m?nm.slice(0,-1):nm,p=pts[b];if(!p)throw new Error('нет точки '+b);const key=m&&p[0]!==0?nm:b;
    if(idx[key]===undefined){idx[key]=V.length;V.push(m?[-p[0],p[1],p[2]]:p.slice());fixd.push({mid:p[0]===0,wall:o.wall&&p[2]===0});}return idx[key];};
  const mirF=f=>f.map(n=>n.endsWith("'")?n.slice(0,-1):n+"'").reverse();
  let polys=[];faces.forEach(f=>{polys.push(f.map(get));if(!f.every(n=>pts[n.replace("'","")][0]===0))polys.push(mirF(f).map(get));});
  (o.whole||[]).forEach(f=>polys.push(f.map(get)));
  // впадины (глаз, ушная раковина): грань → воронка к точке, утопленной внутрь
  (o.pits||[]).forEach(([f,depth,toward])=>[f,mirF(f)].forEach((g,k)=>{const Q=g.map(get),i=polys.findIndex(P=>P.length===Q.length&&[...P].sort().join()===[...Q].sort().join());
    const c=V3.mul(Q.reduce((s,j)=>V3.add(s,V[j]),[0,0,0]),1/Q.length);let p;
    if(toward){const t=V[get(k?toward+"'":toward)];p=V3.add(V3.mul(c,1-depth),V3.mul(t,depth));}else{const n=polyNorm(V,Q),c0=[0,300,150];p=V3.add(c,V3.mul(n,V3.dot(n,V3.sub(c,c0))>0?-depth:depth));}
    V.push(p);fixd.push({});const K=V.length-1;polys.splice(i,1);Q.forEach((a,m)=>polys.push([a,Q[(m+1)%Q.length],K]));}));
  const fix=(i,q)=>{const f=fixd[i]||{};if(f.mid)q[0]=0;if(f.wall)q[2]=0;return q;};
  const or=orientPolys(V,polys,o.center||[0,300,150]);return polyBase(planarize(V,or,fix),or);}

function buildDoberman2(){
  const P={B0:[0,0,0],B1:[95,0,0],B2:[128,45,0],B3:[132,300,0],B4:[105,350,0],B5:[0,356,0],          // пластина на стене
    C0:[0,0,45],C1:[62,0,45],K0:[0,105,100],N1:[90,150,125],N2:[130,195,45],                       // низ, грудь, шея
    J0:[0,160,150],JA:[100,175,165],J1:[40,150,255],CH:[0,145,330],CH1:[32,148,325],L1:[46,186,328],LF:[0,182,352], // челюсть
    NB:[0,186,380],NSb:[36,188,372],NS:[40,212,378],NT:[0,216,390],                                 // нос
    MT:[0,242,368],MS:[46,238,358],SM:[56,300,222],ST:[0,322,212],Q:[84,248,215],                   // морда, стоп
    BR:[92,352,192],FM:[0,370,190],CK:[136,300,128],SK:[0,415,75],                                  // надбровье, скула, макушка
    EG:[62,414,92],ED:[128,392,142],EA:[146,372,32],ET:[100,600,135]};                               // ухо
  const F=[['B0','B1','C1','C0'],['C0','C1','K0'],['K0','C1','N1','J0'],['C1','B1','B2','N2'],['C1','N2','N1'],['B2','B3','N2'],['N2','B3','CK','JA'],['N1','N2','JA'],
    ['J0','N1','JA','J1'],['J0','J1','CH1','CH'],['J1','JA','L1','CH1'],['CH','CH1','L1','LF'],['LF','L1','NSb','NB'],['NB','NSb','NS','NT'],['NT','NS','MS','MT'],
    ['L1','JA','Q'],['L1','Q','MS','NS','NSb'],['Q','SM','MS'],['MT','MS','SM','ST'],['ST','SM','BR','FM'],['SM','Q','CK','BR'],['JA','CK','Q'],
    ['FM','BR','ED','EG','SK'],['BR','CK','ED'],['CK','B3','B4','EA','ED'],['SK','EG','EA','B4','B5'],
    ['EA','ED','ET'],['EG','EA','ET'],['EG','ED','ET']];
  const plate=['B0','B1','B2','B3','B4','B5',"B4'","B3'","B2'","B1'"];
  return buildNamed(P,F,{wall:true,whole:[plate],pits:[[['SM','Q','CK','BR'],18],[['EG','ED','ET'],.5,'EA']]});}

/* ---------- Доберман 4 — модель Meshy, которую сделал Виталий (art/js/models.js, 5000 треугольников запаса) ----------
   Гладкая: ползунок «Граней» упрощает до нужного числа, по умолчанию 200.
   Доберманам 4–6 нужен models.js (130 КБ) — его нет в index.html, подгружается, когда выбрана такая фигура (need, figureReady). */
// Доберман 5 — Meshy Smart Topology (T2.5, 500 полигонов) по оригинальному фото: 508 треугольников, ползунок упрощает дальше
// Доберман 6 — агент Meshy: фото на белом фоне → Meshy 7.1 → ремеш в четырёхугольники (516 граней, 1028 треугольников)
// Доберман 7 — плиты сняты с текстурной модели Meshy «Geometric Doberman» (art/tools/plates): плоские многоугольники, глаза — прорези
// Доберман 8 — рабочая копия «Доберман 7» для правки по кальке; правки Виталия (.json) сюда — art/tools/plates/fromjson.js doberman8 …
// Доберман 9 — Доберман 8 без коротких рёбер и лишних швов (art/tools/plates/marks/round2.js → fromjson.js)
// Доберман 10 — Доберман 9 без лишних швов второго круга: щёки, темя, лоб (art/tools/plates/marks/round3.js → fromjson.js)
// Доберман 11 — Доберман 10 со слитыми 31+30 и 31.1+30.1 (плоский шов): art/tools/plates/marks/round4.js → fromjson.js
FIGURES.doberman11={name:'Доберман 11',H:600,poly:true,build:()=>modelPoly('doberman11'),ref:'doberman7',frame:[[-145.5,0,0],[145.5,600,395]]};

/* ---------- ленивые файлы фигур: need:'models' — фигура строится только после js/models.js ----------
   figureReady(id,cb,fail): файл уже есть — вернёт true, строить можно сразу (cb не зовётся); нет — добавит <script> один раз, вернёт false, cb — после onload.
   Версия файла — та же, что у figures.js (?v= из его src), отдельно поднимать не нужно. */
const LAZY={models:{ok:()=>typeof MODELS!=='undefined',wait:null}};
const LAZY_V=(typeof document!=='undefined'&&document.currentScript&&/\?v=[^&#]*/.exec(document.currentScript.src)||[''])[0];
function figureReady(id,cb,fail){const n=FIGURES[id]&&FIGURES[id].need,L=LAZY[n];if(!L||L.ok())return true;
  if(!L.wait){L.wait=[];const s=document.createElement('script'),end=()=>{const w=L.wait;L.wait=null;w.forEach(([c,f])=>L.ok()?c():f&&f());};
    s.src='js/'+n+'.js'+LAZY_V;s.onload=end;s.onerror=()=>{s.remove();end();};document.head.appendChild(s);}
  L.wait.push([cb,fail]);return false;}
