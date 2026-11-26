/* ---------- Оригинал для обводки (#175, спека docs/superpowers/specs/2026-11-25-shepherd7-workshop-design.md): модель как есть, в гипсе, без расчёта ----------
   Режим фигуры, а не вид: FIGURES.<id>.ow — ключ в ORIG (данные js/orig-<id>.js, общие с видом #146). Расчёт (compute), цифры, таблицы, «Углы» в режиме не работают —
   renderAll() зовёт только owRender(). Рабочая фигура до входа (CUR) остаётся в памяти нетронутой и снова считается, когда выбрали другую фигуру (setBase → owLeave).
   Точка под курсором — owPick: луч по сетке клеток (owGrid/owRay в ow-core.js), а не перебор 158 тыс. треугольников. */
const OW={on:false,id:'',src:'',name:'',V:null,T:null,F:null,img:null,photos:[],calka:'',calkaOn:true,seam:null,seamMs:0,mesh:null,G:null,box:null,o3:null,mk3:null,free:[],snap:null,snapK:''};   // mk3 — разметка на сцене, free — свободные концы, snap — отрезки магнита (#176); calka/calkaOn/seam — калька и облако швов (#177)
// гипс — светлый тёплый серо-бежевый (спека, «Цвета»)
const OW_PLASTER=0xb8b0a4;
/* #177 калька «Текстура»: светлота текселя L = max(r,g,b); L ≤ 0,65 — гипс, L ≥ 0,80 — шов (тёмно-коричневый, почти чёрный), между — плавно. Облако швов для магнита (owSeamCloud) — по тому же верхнему порогу:
   точка облака = пиксель, который калька рисует швом целиком. Калька видна при «Править фигуру» (как калька у всех фигур), галочка «Калька» выключает — гипс; «Текстура» Meshy (вид как есть) — главнее кальки */
const OW_SEAM=[0.65,0.80],OW_SEAM_C=0x2a1d14;
function owBox(V){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++){const x=V[i+k];if(x<min[k])min[k]=x;if(x>max[k])max[k]=x;}return {min,max,size:max.map((x,k)=>x-min[k])};}
// встроенная фигура режима: подгрузить данные (лениво, как вид #146) и открыть
function owLoad(id,after){FIG_WANT=id;const f=FIGURES[id];
  if(!figureReady(id,()=>{if(FIG_WANT===id)owLoad(id,after);},()=>{if(FIG_WANT===id){loading(false);$('figSel').value=ST.orig?ST.orig.id:OW.on?OW.id:ST.ver?'ver:'+ST.verBase+':'+ST.ver:ST.fig||'';msg('Оригинал не загрузился — проверьте интернет и выберите его ещё раз');}})){loading(true,'Загружаю оригинал…');return;}
  later(()=>{if(FIG_WANT!==id)return;const r=ORIG[f.ow],D=origDecode(r);owOpen({id,name:f.name,V:D.V,T:D.T,F:D.F,tex:r.tex},'fig');store('shepherd-fig',id);if(after)after();},'Открываю оригинал…');}
// войти в режим. src: {id, name, V, T, F, tex (адрес картинки текстуры) | img, photos}; kind: 'fig' — встроенная, 'file' — из «Открыть модель»
function owOpen(src,kind){origLeave();owDrop3D();
  Object.assign(OW,{on:true,id:src.id,src:kind,name:src.name,V:src.V,T:src.T||null,F:src.F,img:src.img||null,photos:src.photos||[],calka:src.T&&src.tex?'tex':'',calkaOn:true,seam:null,seamMs:0});   // калька по умолчанию — «Текстура», если у модели есть текстура (#177)
  OW.G=owGrid(OW.V,OW.F);OW.box=owBox(OW.V);
  // что было у рабочей фигуры и в режиме не нужно: инструмент разметки, «Углы», выбор деталей и точек
  if(ST.tool){ST.tool='';mkCtl();}ST.edit=false;$('cEdit').checked=false;   // как у любой фигуры (setBase): открывается без «Править фигуру»
  if(typeof ANG!=='undefined'&&ANG.on){ANG.on=false;ANG.pick=[];stage.classList.remove('angmode');$('angCard').hidden=true;}
  ST.fig=kind==='fig'?src.id:'';ST.verBase=kind==='fig'?src.id:'';ST.ver=0;ST.refId='';ST.tref='';ST.sel=ST.selB=ST.sv=ST.sp=ST.sp2=-1;ST.seam=null;ST.name=src.name;$('mName').value=ST.name;
  document.body.classList.add('owview');$('origBox').hidden=false;$('cOrigTex').checked=false;$('bSave').disabled=false;   // «Сохранить» — только разметка (owJSON, #176)
  $('origNote').textContent='Оригинал для обводки: модель как есть, расчёта нет';$('figSel').value=kind==='fig'?src.id:'';
  owBuild(src);fitBox(OW.box,true);renderAll();msg('Оригинал для обводки: '+fmt(OW.F.length/3)+' '+plural(OW.F.length/3,'треугольник','треугольника','треугольников')+', расчёта нет');}
function owLeave(){if(!OW.on)return;owDrop3D();Object.assign(OW,{on:false,V:null,T:null,F:null,img:null,G:null,box:null,photos:[],free:[],snap:null,snapK:'',calka:'',seam:null});
  document.body.classList.remove('owview');$('origBox').hidden=true;$('cOrigTex').checked=true;$('bSave').disabled=false;}   // «Текстура» — как была у вида #146 (по умолчанию включена)
function owDrop3D(){owMkDrop();const o=OW.o3;if(!o)return;OW.o3=OW.mesh=null;if(typeof root!=='undefined'&&root)root.remove(o.mesh);o.geo.dispose();o.plaster.dispose();o.basic.dispose();o.seam.dispose();if(o.mask)o.mask.dispose();if(o.tex)o.tex.dispose();}
// сетка на сцену: гипс с освещением; галочка «Текстура» — картинка Meshy как есть (как у вида #146)
function owBuild(src){if(!ok)return;while(root.children.length){const c=root.children.pop();c.geometry&&c.geometry.dispose();if(c.element)c.element.remove();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(OW.V,3));if(OW.T)g.setAttribute('uv',new THREE.BufferAttribute(OW.T,2));
  g.setAttribute('normal',new THREE.BufferAttribute(origNormals(OW.V,OW.F),3));g.setIndex(new THREE.BufferAttribute(OW.F,1));g.computeBoundingSphere();
  const plaster=new THREE.MeshLambertMaterial({color:OW_PLASTER,side:THREE.DoubleSide}),basic=new THREE.MeshBasicMaterial({color:OW_PLASTER,side:THREE.DoubleSide}),seam=owSeamMat(),mesh=new THREE.Mesh(g,plaster);
  const o=OW.o3={mesh,geo:g,plaster,basic,seam,mask:null,tex:null};OW.mesh=mesh;root.add(mesh);   // без userData.pick: детали (pickTri) у оригинала нет, точку ищет owPick
  if(OW.T&&src.tex){const t=new THREE.TextureLoader().load(src.tex+(typeof LAZY_V!=='undefined'?LAZY_V:''),()=>{if(OW.o3!==o)return;basic.map=t;basic.color.set(0xffffff);basic.needsUpdate=true;req3D();
      later(()=>owSeamPrep(o,t.image),'Готовлю кальку…');},undefined,()=>{});
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());o.tex=t;}}
/* #177 материал кальки «Текстура»: гипс (Lambert, тот же свет) + маска швов (owSeamMips, текстура o.mask) — 255 → цвет швов OW_SEAM_C, 0 → цвет гипса.
   Маска считается из тех же пикселей, что облако швов (owSeamPrep), уровни уменьшения — максимумом: издалека швы не гаснут, как гасли бы у текстуры Meshy с обычными уровнями */
function owSeamMat(){const m=new THREE.MeshLambertMaterial({color:OW_PLASTER,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{sh.uniforms.owSeamC={value:new THREE.Color(OW_SEAM_C)};
    sh.fragmentShader='uniform vec3 owSeamC;\n'+sh.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
  diffuseColor.rgb=mix(diffuseColor.rgb,owSeamC,texture2D(map,vUv).r);
#endif`);};return m;}
/* калька и облако швов (#177) — один раз при входе, когда пришла текстура: пиксели картинки (canvas → getImageData) → маска кальки (owSeamMips → DataTexture с готовыми уровнями)
   и облако для магнита (owSeamCloud → отрезки нулевой длины с сеткой mkSnapGrid). Время всего — в OW.seamMs и в консоль: цель ≤ 3 с на 158 тыс. треугольников */
function owSeamPrep(o,im){if(OW.o3!==o||!OW.T||!im)return;const t0=performance.now();let px;
  try{const W=im.naturalWidth||im.width,H=im.naturalHeight||im.height,cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d');cx.drawImage(im,0,0);px=cx.getImageData(0,0,W,H);}
  catch(e){console.warn('калька «Текстура»: пиксели текстуры не прочитать',e);msg('Текстуру не прочитать — калька «Текстура» недоступна');return;}
  const C=owSeamCloud(OW.V,OW.T,OW.F,{W:px.width,H:px.height,data:px.data},OW_SEAM[1]),seg=owSeamSeg(C);
  const L=owSeamMips({W:px.width,H:px.height,data:px.data},OW_SEAM),m=new THREE.DataTexture(L[0].data,L[0].W,L[0].H,THREE.LuminanceFormat,THREE.UnsignedByteType);
  m.mipmaps=L.map(l=>({data:l.data,width:l.W,height:l.H}));m.generateMipmaps=false;m.minFilter=THREE.LinearMipmapLinearFilter;m.magFilter=THREE.LinearFilter;m.unpackAlignment=1;
  m.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.needsUpdate=true;o.mask=m;o.seam.map=m;o.seam.needsUpdate=true;
  OW.seam={seg};OW.seamMs=Math.round(performance.now()-t0);OW.snapK='';console.log('калька «Текстура»: облако швов '+C.length/3+' точек, '+OW.seamMs+' мс');renderAll();}
// калька «Текстура» на модели сейчас: «Править фигуру», галочка «Калька», выбрана «Текстура», маска готова (owSeamPrep)
function owSeamOn(){const o=OW.o3;return !!(o&&ST.edit&&OW.calkaOn&&OW.calka==='tex'&&o.seam.map);}
// блок кальки на панели в режиме: галочка «Калька» и выбор — только когда калька готова (текстура пришла и прочиталась — есть маска); сверки (облака TRACE) у оригинала нет
function owCalkaUI(){const has=!!(OW.o3&&OW.o3.mask&&OW.calka),ts=$('traceSel');$('traceRow').hidden=!has;$('cTrace').checked=OW.calkaOn;ts.hidden=!(has&&OW.calkaOn);
  const h='<option value="tex">Текстура</option>';if(ts.innerHTML!==h)ts.innerHTML=h;if(has)ts.value=OW.calka;$('diffRow').hidden=true;$('diffNo').hidden=true;$('edTrace').hidden=true;}
// перерисовка в режиме: только сцена и то, что видно на панели; без расчёта
function owRender(){if(!OW.on)return;const o=OW.o3;if(o)OW.mesh.material=$('cOrigTex').checked&&o.tex?o.basic:owSeamOn()?o.seam:o.plaster;owMk3D();req3D();
  $('ttl').textContent=ST.name||OW.name;$('edBox').hidden=!ST.edit;owCalkaUI();mkUI();
  $('hint').textContent=ST.tool?'Разметка: левая кнопка — рисовать, правая — крутить, колесо — масштаб':'Оригинал для обводки: левая кнопка — крутить, колесо — масштаб, правая — сдвиг · галочка «Текстура» — швы Meshy или гипс';
  if(ok)renderer.domElement.setAttribute('aria-label',`3D-модель «${ST.name||OW.name}»: оригинал для обводки, ${Math.round(OW.box.size[0])} × ${Math.round(OW.box.size[1])} × ${Math.round(OW.box.size[2])} мм (Ш × В × Г)`);}
// точка под курсором: {p:[x,y,z], uv:[u,v]|null, n:[x,y,z], tri} или null (промах)
function owPick(ev){if(!ok||!OW.on||!OW.G)return null;const r=renderer.domElement.getBoundingClientRect(),rc=new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),camera);const O=rc.ray.origin,D=rc.ray.direction,h=owRay(OW.G,[O.x,O.y,O.z],[D.x,D.y,D.z]);if(!h)return null;
  const {V,T,F}=OW,a=F[h.tri*3],b=F[h.tri*3+1],c=F[h.tri*3+2],w=1-h.u-h.v,at=(A,i,k)=>A[a*k+i]*w+A[b*k+i]*h.u+A[c*k+i]*h.v,
    e1=[0,1,2].map(i=>V[b*3+i]-V[a*3+i]),e2=[0,1,2].map(i=>V[c*3+i]-V[a*3+i]),n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],
    l=(n[0]*D.x+n[1]*D.y+n[2]*D.z>0?-1:1)*(Math.hypot(...n)||1);   // нормаль — к камере: модель двусторонняя, обход треугольников у Meshy бывает внутрь
  return {p:[0,1,2].map(i=>at(V,i,3)),uv:T?[at(T,0,2),at(T,1,2)]:null,n:n.map(x=>x/l),tri:h.tri};}

/* ---------- #176 разметка на оригинале: перо, линия, зачёркивание — функции markup.js; поверхность — модель (owPick, owNear), а не плиты ----------
   Штрихи ярко-зелёные, зеркальные — бледнее; свободные концы (owFreeEnds) — красные точки. Рисуются как калька #169 (штрихи — лентой rbTlMat #181, MK_W / MK_W_MIR px; точки — tlMat): подтянуты к камере на TL_OVER мм,
   обратная сторона отсечена по нормали грани — линия на ухе не просвечивает с другой стороны. Видны при «Править фигуру», как разметка у всех фигур. */
const OW_PEN=0x22d65a,OW_PEN_MIR=0x9ddfae,OW_FREE=0xd01f1f,OW_MAT={};
const owMat=(c,size)=>OW_MAT[c+'|'+(size||0)]||(OW_MAT[c+'|'+(size||0)]=tlMat(c,size||1));   // материалы — по одному на цвет, на всю страницу
const OW_DR=new WeakMap();   // отрезки на поверхности по штриху (своему и его зеркалу): пересчёт, только когда у штриха поменялось число точек
function owDrapeOf(s,mir){let e=OW_DR.get(s);if(!e||e.n!==s.pts.length||e.c!==!!s.closed){e={n:s.pts.length,c:!!s.closed,o:null,m:undefined};OW_DR.set(s,e);}
  if(!mir)return e.o||(e.o=owDrape(OW.G,[s]));if(e.m===undefined){const m=mkMirror(s);e.m=m?owDrape(OW.G,[m]):null;}return e.m;}
function owCat(parts){parts=parts.filter(x=>x&&x.length);const n=parts.reduce((a,x)=>a+x.length,0),P=new Float32Array(n),N=new Float32Array(n);let o=0;parts.forEach(x=>{P.set(x,o);N.set(x.nrm,o);o+=x.length;});P.nrm=N;return P;}
function owMkDrop(){const m=OW.mk3;if(!m)return;OW.mk3=null;if(typeof root!=='undefined'&&root)root.remove(m.g);m.g.children.forEach(c=>c.geometry.dispose());}
// разметка на сцену: свои штрихи, зеркальные (симметрия), свободные концы, точки текущей линии; пересборка — когда поменялась разметка или симметрия
function owMk3D(){if(!ok||!OW.on||!OW.G)return;if(!ST.edit){owMkDrop();OW.free=[];return;}mkSync();const key=MK.key+'|'+MK.ver+'|'+ST.sym;if(OW.mk3&&OW.mk3.key===key)return;owMkDrop();
  const own=ST.mk.concat(ST.mkCur?[ST.mkCur]:[]),done=ST.sym?ST.mk.concat(ST.mk.map(mkMirror).filter(Boolean)):ST.mk,g=new THREE.Group();
  OW.free=owFreeEnds(done);   // текущая (ещё не законченная) линия концов не даёт
  const add=o=>{o.renderOrder=3;g.add(o);},
    lines=(S,c,w)=>{if(S.length)add(rbMesh(S,rbTlMat(c,w)));},   // #181: лентой w px — подтяжка, отсечение по nrm и глубина как у кальки
    dots=(pts,c,size)=>{const P=[],N=[];pts.forEach(p=>{const h=owNear(OW.G,p,8);if(!h)return;P.push(...h.p.map((x,k)=>x+h.n[k]*TL_LIFT));N.push(...h.n);});if(!P.length)return;
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('nrm',new THREE.Float32BufferAttribute(N,3));add(new THREE.Points(geo,owMat(c,size)));};
  lines(owCat(own.map(s=>owDrapeOf(s,false))),OW_PEN,MK_W);if(ST.sym)lines(owCat(own.map(s=>owDrapeOf(s,true))),OW_PEN_MIR,MK_W_MIR);
  dots(OW.free,OW_FREE,10);if(ST.mkCur)dots(ST.mkCur.pts,OW_PEN,6);
  root.add(g);OW.mk3={g,key};}
// магнит пера и линии: к своим штрихам (и их зеркалу при симметрии) — отрезки парами точек, как линии кальки для mkSnap; выключен — null
// #177: калька «Текстура» на модели — ещё и к шву (облако швов, его сетка не пересобирается: owSnapJoin)
function owSnapSeg(){if(!ST.magnet)return null;mkSync();const sm=owSeamOn()&&OW.seam,k=MK.key+'|'+MK.ver+'|'+ST.sym+'|'+(sm?1:0);if(OW.snapK===k)return OW.snap;
  const L=ST.mk.concat(ST.mkCur?[ST.mkCur]:[]).filter(s=>s.k!=='cross'),all=ST.sym?L.concat(L.map(mkMirror).filter(Boolean)):L,a=[];
  all.forEach(s=>{const P=s.closed?[...s.pts,s.pts[0]]:s.pts;if(P.length===1)a.push(...P[0],...P[0]);for(let i=0;i+1<P.length;i++)a.push(...P[i],...P[i+1]);});
  OW.snapK=k;return OW.snap=sm?owSnapJoin(OW.seam.seg,new Float32Array(a)):a.length?new Float32Array(a):null;}
// точка под курсором → [x,y,z] | null; точка (после магнита) → на поверхность модели
function owHit(e){const h=owPick(e);return h?h.p:null;}
function owSurf(p){const h=OW.G&&owNear(OW.G,p,20);return h?h.p:p;}
// «Сохранить» в режиме: только разметка (кадр фигуры, мм) и чья она — без сетки; модель Овчарки 7 и так на странице
function owJSON(){return {type:'md-art',v:1,ow:{src:OW.src,id:OW.id,name:OW.name},name:ST.name,mk:JSON.parse(mkSave(ST.mk))};}
// открыть файл режима: встроенная фигура → открыть её с разметкой из файла (видна сразу — «Править фигуру» включается). Модель из файла — задача 5 плана.
// Разметку основы не затираем: если на ней уже что-то есть и оно не то же, что в файле, — файл ложится новой версией в браузере (verPut), как «Сохранить»
function owFromJSON(j){const o=j.ow||{},f=FIGURES[o.id];if(o.src!=='fig'||!f||!f.ow){msg('Сначала откройте модель «'+(o.name||'?')+'»');return;}const mk=mkLoad(JSON.stringify(j.mk||[])),n=mk.length;
  loadFigure(o.id,()=>{mkSync();const own=mkSave(ST.mk);if(ST.mk.length&&own!==mkSave(mk)){const r=verPut(VSTO,o.id,{...j,mk:JSON.parse(mkSave(mk))});
      if(r&&!r.err){verOptions();owVerShow(j,o.id,r.n,true,`Разметка из файла открыта версией «${verName(o.id,r.n)}» — разметка «${f.name}» не тронута`);return;}}
    mkSet(mk);ST.name=j.name||f.name;$('mName').value=ST.name;ST.edit=true;$('cEdit').checked=true;renderAll();msg(`Открыта разметка: ${n} ${plural(n,'штрих','штриха','штрихов')} на «${f.name}»`);});}
// версия из браузера: та же фигура, разметка версии — своя (mkKey('<id>.<n>')); пусто — из самой версии
function owVersion(j,base,n){const edit=ST.edit;loadFigure(base,()=>owVerShow(j,base,n,edit));}
// фигура уже открыта (owOpen) — сделать её версией n: ключ разметки по версии, пустой — из JSON версии
function owVerShow(j,base,n,edit,note){ST.ver=n;ST.verBase=base;$('figSel').value='ver:'+base+':'+n;mkSync();if(!ST.mk.length&&Array.isArray(j.mk)&&j.mk.length)mkSet(j.mk);
  if(edit){ST.edit=true;$('cEdit').checked=true;}ST.name=j.name||ST.name;$('mName').value=ST.name;renderAll();msg(note||`Открыта версия «${verName(base,n)}»`);}
