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
  // три кальки в одном кадре (#149), выбор — рядом с галочкой «Калька», первая открывается по умолчанию: со швов четырёх согласованных картинок (project.js → out/shepherd5/tex-p.png),
  // с текстуры модели, «форма оригинала» — изломы 3D-формы модели ≥ 4° (tracing.js edges=4, только линии, без облака — сверки у неё нет)
  refs:[['shepherd5p','с картинок'],['shepherd5','с модели'],['shepherd5f','форма оригинала']]};
LAZY['plates-shepherd5']={ok:()=>typeof MODELS_POLY!=='undefined'&&!!MODELS_POLY.shepherd5,wait:null};
/* ---------- Овчарка 6 (тикеты #170, #171; план docs/superpowers/plans/2026-11-25-shepherd6.md): модель Овчарки 5, плиты конвейера настройками Добермана 7 (4° / 3 мм), пороги площади Овчарки 5 ----------
   «оригинал» (shepherd6r) — как вышла из конвейера, без чистки; собирает tools/make-shepherd.js shepherd6r. plaster — вид «в гипсе» (Q5): все грани одним светло-серым, линии граней тонкие */
/* кальки Овчарки 6 (#172, Q7, Q9) — одни файлы на обе фигуры, в кадре shepherd6 (кадр оригинала отличается ≤ 1 мм, линии всё равно ложатся на ближайшую грань):
   «с модели» — швы текстуры модели (tracing.js … xf=out/shepherd6/xf.json): сырая (с облаком для сверки) и варианты tools/trace-variants.js — без мусора (по умолчанию), выпрямленная;
   «с 3 фото» (#173) — швы трёх фото Meshy (спереди, сбоку, сзади; project.js → out/shepherd6/tex-p3.png, потом tracing.js png=), те же три варианта;
   третий элемент — облако для сверки у кальки без своего облака */
const S6REFS=[['shepherd6m2','с модели, без мусора','shepherd6m'],['shepherd6m','с модели, сырая'],['shepherd6m3','с модели, выпрямленная','shepherd6m'],
  ['shepherd6p2','с 3 фото, без мусора','shepherd6p'],['shepherd6p','с 3 фото, сырая'],['shepherd6p3','с 3 фото, выпрямленная','shepherd6p']];
FIGURES.shepherd6r={name:'Овчарка 6 — оригинал',H:1000,poly:true,plaster:true,need:'plates-shepherd6r',build:()=>modelPoly('shepherd6r'),ref:'shepherd6r',refs:S6REFS};
LAZY['plates-shepherd6r']={ok:()=>typeof MODELS_POLY!=='undefined'&&!!MODELS_POLY.shepherd6r,wait:null};
// «как доберман» (shepherd6, #171): плиты с clean=13 (короткие рёбра < 13 мм в точку) + слиты швы с изломом < 1°; собирает tools/make-shepherd.js shepherd6
FIGURES.shepherd6={name:'Овчарка 6 (как доберман)',H:1000,poly:true,plaster:true,need:'plates-shepherd6',build:()=>modelPoly('shepherd6'),ref:'shepherd6',refs:S6REFS};
LAZY['plates-shepherd6']={ok:()=>typeof MODELS_POLY!=='undefined'&&!!MODELS_POLY.shepherd6,wait:null};
/* ---------- Оригинал (вид) (тикет #146): модель Meshy как есть, только смотреть; view — рабочая фигура (там расчёт), orig — ключ в ORIG ----------
   Для другой фигуры из Meshy — такая же строка + файл js/orig-<id>.js (from-dev/art/tools/plates/orig.js) + <option> в index.html */
FIGURES.shepherd5_orig={name:'Овчарка 5 — оригинал (вид)',view:'shepherd5',orig:'shepherd5',need:'orig-shepherd5'};
/* ---------- Оригинал для обводки (#175, план docs/superpowers/plans/2026-11-25-shepherd7-workshop.md): ow — ключ в ORIG; рабочая фигура без расчёта, в гипсе (js/owork.js) ----------
   Овчарка 7 — модель Meshy 1 в 1 (158 336 треугольников), данные общие с видом Овчарки 5. Для другой модели — такая же строка + js/orig-<id>.js + <option> в index.html */
FIGURES.shepherd7_orig={name:'Овчарка 7 — оригинал',ow:'shepherd5',need:'orig-shepherd5'};
LAZY['orig-shepherd5']={ok:()=>typeof ORIG!=='undefined'&&!!ORIG.shepherd5,wait:null};
