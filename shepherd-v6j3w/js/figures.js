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

/* ---------- ленивые файлы фигур: need:'models' — фигура строится только после js/models.js ----------
   figureReady(id,cb,fail): файл уже есть — вернёт true, строить можно сразу (cb не зовётся); нет — добавит <script> один раз, вернёт false, cb — после onload.
   Версия файла — та же, что у figures.js (?v= из его src), отдельно поднимать не нужно. */
const LAZY={models:{ok:()=>typeof MODELS!=='undefined',wait:null}};
const LAZY_V=(typeof document!=='undefined'&&document.currentScript&&/\?v=[^&#]*/.exec(document.currentScript.src)||[''])[0];
function figureReady(id,cb,fail){const n=FIGURES[id]&&FIGURES[id].need,L=LAZY[n];if(!L||L.ok())return true;
  if(!L.wait){L.wait=[];const s=document.createElement('script'),end=()=>{const w=L.wait;L.wait=null;w.forEach(([c,f])=>L.ok()?c():f&&f());};
    s.src='js/'+n+'.js'+LAZY_V;s.onload=end;s.onerror=()=>{s.remove();end();};document.head.appendChild(s);}
  L.wait.push([cb,fail]);return false;}

/* ---------- Овчарка 2 (тикет #142): реалистичная модель Meshy, упрощённая скриптом; в скобках — граней после сборки ----------
   Файл js/plates-<id>.js (собирает tools/make-shepherd.js <id>) грузится, только когда фигуру выбрали. */
[['shepherd2_1000',948],['shepherd2_700',678],['shepherd2_500',488],['shepherd2_350',344]].forEach(([id,n])=>{const file='plates-'+id;
  FIGURES[id]={name:`Овчарка 2 (${n})`,H:1000,poly:true,need:file,build:()=>modelPoly(id)};
  LAZY[file]={ok:()=>typeof MODELS_POLY!=='undefined'&&!!MODELS_POLY[id],wait:null};});
/* ---------- Овчарка 3 (тикет #142): плиты конвейера по модели Meshy с текстурой швов; собирает tools/make-shepherd.js shepherd3 ----------
   ref — калька js/trace-shepherd3.js (густые швы морды), в том же кадре, что фигура: по ней морду доводят в мастерской */
FIGURES.shepherd3={name:'Овчарка 3',H:1000,poly:true,need:'plates-shepherd3',build:()=>modelPoly('shepherd3'),ref:'shepherd3'};
LAZY['plates-shepherd3']={ok:()=>typeof MODELS_POLY!=='undefined'&&!!MODELS_POLY.shepherd3,wait:null};
/* ---------- Овчарка 5 (тикет #142): плиты конвейера по гранёной модели Meshy 7.1 со швами на текстуре; собирает tools/make-shepherd.js shepherd5 ----------
   ref — калька js/trace-shepherd5.js (швы исходной текстуры), по ней морду доводят в мастерской */
FIGURES.shepherd5={name:'Овчарка 5',H:1000,poly:true,need:'plates-shepherd5',build:()=>modelPoly('shepherd5'),ref:'shepherd5',
  // две кальки в одном кадре: с текстуры модели и со швов четырёх согласованных картинок (project.js → out/shepherd5/tex-p.png), выбор — рядом с галочкой «Калька»
  refs:[['shepherd5','с модели'],['shepherd5p','с картинок']]};
LAZY['plates-shepherd5']={ok:()=>typeof MODELS_POLY!=='undefined'&&!!MODELS_POLY.shepherd5,wait:null};
/* ---------- Оригинал (вид) (тикет #146): модель Meshy как есть, только смотреть; view — рабочая фигура (там расчёт), orig — ключ в ORIG ----------
   Для другой фигуры из Meshy — такая же строка + файл js/orig-<id>.js (from-dev/art/tools/plates/orig.js) + <option> в index.html */
FIGURES.shepherd5_orig={name:'Овчарка 5 — оригинал (вид)',view:'shepherd5',orig:'shepherd5',need:'orig-shepherd5'};
LAZY['orig-shepherd5']={ok:()=>typeof ORIG!=='undefined'&&!!ORIG.shepherd5,wait:null};
