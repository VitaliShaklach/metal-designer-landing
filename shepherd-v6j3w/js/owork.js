/* ---------- Оригинал для обводки (#175, спека docs/superpowers/specs/2026-11-25-shepherd7-workshop-design.md): модель как есть, в гипсе, без расчёта ----------
   Режим фигуры, а не вид: FIGURES.<id>.ow — ключ в ORIG (данные js/orig-<id>.js, общие с видом #146). Расчёт (compute), цифры, таблицы, «Углы» в режиме не работают —
   renderAll() зовёт только owRender(). Рабочая фигура до входа (CUR) остаётся в памяти нетронутой и снова считается, когда выбрали другую фигуру (setBase → owLeave).
   Точка под курсором — owPick: луч по сетке клеток (owGrid/owRay в ow-core.js), а не перебор 158 тыс. треугольников. */
const OW={on:false,id:'',src:'',name:'',V:null,T:null,F:null,img:null,photos:[],calka:'',calkaOn:true,modelOn:true,seam:null,seamMs:0,mesh:null,G:null,box:null,o3:null,mk3:null,free:[],snap:null,snapK:'',tone:1,seamW:false};   // mk3 — разметка на сцене, free — свободные концы, snap — отрезки магнита (#176); calka/calkaOn/seam — калька и облако швов (#177); modelOn — галочка «Модель» у плоской кальки (#184)
// гипс — светлый тёплый серо-бежевый (спека #175, «Цвета»); с #188 материалы режима берут цвет по «Тону гипса» — owTone(OW.tone).color (шаг 1 — #a29b90, чуть темнее этого)
const OW_PLASTER=0xb8b0a4;
/* #177 калька «Текстура»: светлота текселя L = max(r,g,b); L ≤ 0,65 — гипс, L ≥ 0,80 — шов (тёмно-коричневый, почти чёрный), между — плавно. Облако швов для магнита (owSeamCloud) — по тому же верхнему порогу:
   точка облака = пиксель, который калька рисует швом целиком. Калька видна при «Править фигуру» (как калька у всех фигур), галочка «Калька» выключает — гипс; «Текстура» Meshy (вид как есть) — главнее кальки */
const OW_SEAM=[0.65,0.80],OW_SEAM_C=0x2a1d14,OW_SEAM_W=0xf2f2f2;   // OW_SEAM_W — «Белые швы» (#188)
function owBox(V){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++){const x=V[i+k];if(x<min[k])min[k]=x;if(x>max[k])max[k]=x;}return {min,max,size:max.map((x,k)=>x-min[k])};}
// встроенная фигура режима: подгрузить данные (лениво, как вид #146) и открыть
function owLoad(id,after){FIG_WANT=id;const f=FIGURES[id];
  if(!figureReady(id,()=>{if(FIG_WANT===id)owLoad(id,after);},()=>{if(FIG_WANT===id){loading(false);$('figSel').value=ST.orig?ST.orig.id:OW.on?OW.id:ST.ver?'ver:'+ST.verBase+':'+ST.ver:ST.fig||'';msg('Оригинал не загрузился — проверьте интернет и выберите его ещё раз');}})){loading(true,'Загружаю оригинал…');return;}
  later(()=>{if(FIG_WANT!==id)return;const r=ORIG[f.ow],D=origDecode(r);owOpen({id,name:f.name,V:D.V,T:D.T,F:D.F,tex:r.tex},'fig');if(f.photos)owPhotosLoad(id,f.photos);store('shepherd-fig',id);if(after)after();},'Открываю оригинал…');}
// войти в режим. src: {id, name, V, T, F, tex (адрес картинки текстуры) | img, photos}; kind: 'fig' — встроенная, 'file' — из «Открыть модель»
function owOpen(src,kind){origLeave();owDrop3D();
  Object.assign(OW,{on:true,id:src.id,src:kind,name:src.name,V:src.V,T:src.T||null,F:src.F,img:src.img||null,photos:src.photos||[],calka:src.T&&src.tex?'tex':'',calkaOn:true,modelOn:true,seam:null,seamMs:0});$('cModel').checked=true;   // калька по умолчанию — «Текстура», если у модели есть текстура (#177)
  OW.G=owGrid(OW.V,OW.F);OW.box=owBox(OW.V);
  // что было у рабочей фигуры и в режиме не нужно: инструмент разметки, «Углы», выбор деталей и точек
  if(ST.tool){ST.tool='';mkCtl();}ST.edit=false;$('cEdit').checked=false;   // как у любой фигуры (setBase): открывается без «Править фигуру»
  if(typeof ANG!=='undefined'&&ANG.on){ANG.on=false;ANG.pick=[];stage.classList.remove('angmode');$('angCard').hidden=true;}
  ST.fig=kind==='fig'?src.id:'';ST.verBase=kind==='fig'?src.id:'';ST.ver=0;ST.refId='';ST.tref='';ST.sel=ST.selB=ST.sv=ST.sp=ST.sp2=-1;ST.seam=null;ST.name=src.name;$('mName').value=ST.name;
  document.body.classList.add('owview');$('origBox').hidden=false;$('cOrigTex').checked=false;$('cOrigTex').disabled=!(src.T&&src.tex);$('bSave').disabled=false;   // «Сохранить» — только разметка (owJSON, #176)
  $('origNote').textContent='Оригинал для обводки: модель как есть, расчёта нет';$('figSel').value=kind==='fig'?src.id:'';
  if(typeof lightRig==='function')lightRig(true);owToneSet(+store('ow-tone')||1);owSeamWhite(store('ow-seam-white')==='1');   // #188 свет от камеры, «Тон гипса» и «Белые швы» (из браузера) — до сборки: материалы сразу в тоне и с цветом швов
  owBuild(src);fitBox(OW.box,true);renderAll();msg('Оригинал для обводки: '+fmt(OW.F.length/3)+' '+plural(OW.F.length/3,'треугольник','треугольника','треугольников')+', расчёта нет');}
function owLeave(){if(!OW.on)return;owDrop3D();if(typeof VIEW!=='undefined'&&VIEW.ortho)viewOrtho(false);if(typeof lightRig==='function')lightRig(false);Object.assign(OW,{on:false,V:null,T:null,F:null,img:null,G:null,box:null,photos:[],free:[],snap:null,snapK:'',calka:'',seam:null});
  document.body.classList.remove('owview');$('origBox').hidden=true;$('modelRow').hidden=true;$('seamWRow').hidden=true;$('cOrigTex').checked=true;$('cOrigTex').disabled=false;$('bSave').disabled=false;}   // «Текстура» — как была у вида #146 (по умолчанию включена)
function owDrop3D(){owMkDrop();const o=OW.o3;if(!o)return;OW.o3=OW.mesh=null;if(typeof root!=='undefined'&&root){root.remove(o.mesh);root.remove(o.flat.g);}owFlatDrop(o.flat);o.flat.mg.dispose();o.flat.mh.dispose();o.geo.dispose();o.plaster.dispose();o.depth.dispose();o.basic.dispose();o.seam.dispose();if(o.mask)o.mask.dispose();if(o.tex)o.tex.dispose();o.photo.dispose();Object.values(o.ptex).forEach(t=>{t.dispose();if(t.mask)t.mask.dispose();});}   // #178: фото-калька и загруженные фото (#185: и маски швов); #184: плоская калька (плоскости и их материалы) и материал «только глубина»
// сетка на сцену: гипс с освещением; галочка «Текстура» — картинка Meshy как есть (как у вида #146)
function owBuild(src){if(!ok)return;while(root.children.length){const c=root.children.pop();c.geometry&&c.geometry.dispose();if(c.element)c.element.remove();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(OW.V,3));if(OW.T)g.setAttribute('uv',new THREE.BufferAttribute(OW.T,2));
  g.setAttribute('normal',new THREE.BufferAttribute(origNormals(OW.V,OW.F),3));g.setIndex(new THREE.BufferAttribute(OW.F,1));g.computeBoundingSphere();
  const plaster=new THREE.MeshLambertMaterial({color:owTone(OW.tone).color,side:THREE.DoubleSide}),basic=new THREE.MeshBasicMaterial({color:owTone(OW.tone).color,side:THREE.DoubleSide}),seam=owSeamMat(),photo=owPhotoMat(),mesh=new THREE.Mesh(g,plaster);
  const depth=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide}),FU=Object.assign({owOp:{value:.5}},photo.userData.U),flat={g:new THREE.Group(),gen:null,head:null,key:'',mg:owFlatMat(FU,0),mh:owFlatMat(FU,1)};flat.g.visible=false;   // #184 плоская калька: униформы — те же объекты, что у проекции; depth — модель при снятой «Модели»: не рисуется, только глубина (штрихи за ней не просвечивают)
  const o=OW.o3={mesh,geo:g,plaster,depth,basic,seam,photo,flat,ptex:{},mask:null,tex:null};OW.mesh=mesh;root.add(mesh);root.add(flat.g);   // без userData.pick: детали (pickTri) у оригинала нет, точку ищет owPick
  if(OW.T&&src.tex){const inl=src.tex.startsWith('data:'),t=new THREE.TextureLoader().load(src.tex+(inl||typeof LAZY_V==='undefined'?'':LAZY_V),()=>{if(OW.o3!==o)return;basic.map=t;basic.color.set(0xffffff);basic.needsUpdate=true;req3D();
      later(()=>owSeamPrep(o,t.image),'Готовлю кальку…');},undefined,()=>{if(OW.o3!==o||!inl)return;OW.calka='';$('cOrigTex').checked=false;$('cOrigTex').disabled=true;renderAll();msg('Картинку текстуры не прочитать — калька «Текстура» недоступна');});
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());o.tex=t;}}   // #179: картинка модели из файла — data:-ссылка (без метки ?v=)
/* #177 материал кальки «Текстура»: гипс (Lambert, тот же свет) + маска швов (owSeamMips, текстура o.mask) — 255 → цвет швов OW_SEAM_C, 0 → цвет гипса.
   Маска считается из тех же пикселей, что облако швов (owSeamPrep), уровни уменьшения — максимумом: издалека швы не гаснут, как гасли бы у текстуры Meshy с обычными уровнями */
function owSeamMat(){const m=new THREE.MeshLambertMaterial({color:owTone(OW.tone).color,side:THREE.DoubleSide});m.userData.owSeamC={value:new THREE.Color(OW.seamW?OW_SEAM_W:OW_SEAM_C)};   // #188 цвет швов — униформа в userData: owSeamWhite меняет её и до, и после компиляции шейдера
  m.onBeforeCompile=sh=>{sh.uniforms.owSeamC=m.userData.owSeamC;
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
/* #188 «Тон гипса»: шаг 1…6 (owToneStep) → OW.tone и браузер (одни на всю мастерскую), лампы «от камеры» (LIGHT_CAM, view3d.js) и цвет гипса у материалов режима: гипс, калька «Текстура»,
   фото-калька (гипс вне фото и вскользь); «Текстура» Meshy (basic) — только пока у неё нет картинки. Материалов ещё нет (вход, до owBuild) — их owBuild создаст уже в тоне */
function owToneSet(step){const s=owToneStep(step),t=owTone(s),o=OW.o3,L=typeof LIGHT_CAM!=='undefined'?LIGHT_CAM:null;OW.tone=s;store('ow-tone',String(s));
  if(L&&L.key){L.hemi.intensity=t.hemi;L.key.intensity=t.key;L.fill.intensity=t.fill;}if(o){[o.plaster,o.seam,o.photo].forEach(m=>m.color.setHex(t.color));if(!o.basic.map)o.basic.color.setHex(t.color);}
  $('sTone').value=s;$('toneVal').textContent=s;if(typeof req3D==='function')req3D();}
/* #188 «Белые швы»: швы кальки «Текстура» белые (OW_SEAM_W) или тёмно-коричневые (OW_SEAM_C) → OW.seamW и браузер (одни на всю мастерскую), униформа owSeamC материала кальки.
   Облако швов и магнит (#177) считаются по текстуре, а не по цвету кальки — от галочки не зависят; фото-кальки (#178, #185) — свой цвет швов */
function owSeamWhite(on){OW.seamW=!!on;store('ow-seam-white',OW.seamW?'1':'0');const o=OW.o3;if(o)o.seam.userData.owSeamC.value.setHex(OW.seamW?OW_SEAM_W:OW_SEAM_C);$('cSeamW').checked=OW.seamW;if(typeof req3D==='function')req3D();}
/* ---------- #178 кальки «Фото спереди» / «Фото сбоку»: фото Meshy светится на гипс, как проектор (спека, «Калька „Фото“») ----------
   Фото = {key, name, img, m, dir, mirror} (js/photos-<id>.js, собирает tools/photo-fit.js: камера ракурса ∘ подгон по силуэту ∘ кадр фигуры — одна матрица m). Файл с матрицами грузится при входе,
   картинка — когда её калька выбрана и видна (owRender → owPhotoGet), один раз. Пиксель — owPhotoUV, сторона — правило owPhotoPick (ow-core.js) в шейдере owPhotoMat:
   от камеры фото (нормаль · dir ≥ 0), вне картинки, прозрачный фон фото — гипс; у бока (mirror) — ещё и зеркально по X, берётся сторона, что смотрит на камеру прямее.
   Цвет фото — как есть, без светотени модели (#185 З3: грани резкие, как на самом фото); вскользь (нормаль дальше ~75° от взгляда камеры, #185: было ~65° — на щеке оставалось бежевое пятно) фото плавно уходит в освещённый гипс — там оно размазано полосами.
   Швы фото (белые, светлота OW_PHOTO_SEAM) — отдельной маской резким порогом поверх граней без швов (owPhotoPrep в ow-core.js; маска — owSeamMips, как у кальки «Текстура» #177): при увеличении
   грани фото мягкие (фото 1024 px на голову), а шов остаётся резким. Цвет шва — OW_PHOTO_SEAM_C (белый, как на фото).
   head = {img, m, y0, z0} — снимок головы крупно со своей матрицей: в коробке головы (y ≥ y0, z ≥ z0) он главнее общего фото там, где не прозрачный (общий подгон кладёт глаза ~25 мм ниже).
   #185 З4: к границе коробки и к краю картинки головы вес головы плавно спадает до 0 в полосе OW_HEAD_BAND мм (owHeadW в ow-core.js) — без ступеньки на шее; уши (y ≥ 838) вне полосы */
const OW_HEAD_BAND=40,OW_PHOTO_SEAM=[0.65,0.85],OW_PHOTO_SEAM_C=0xf2f2f2;   // грани фото — светлота 0,25…0,6, швы — 0,9 и выше (замер по g-*.png)
// файл фото-калек фигуры (матрицы): пришёл — список калек обновится; не пришёл — без фото, остальное работает
function owPhotosLoad(id,k){const set=()=>{if(OW.on&&OW.id===id&&typeof PHOTOS!=='undefined'&&PHOTOS[k]){OW.photos=PHOTOS[k];renderAll();}};
  if(lazyReady('photos-'+k,set,()=>console.warn('фото-кальки «'+k+'» не загрузились')))set();}
const owPhoto=()=>OW.photos.find(p=>p.key===OW.calka)||null;
// картинки фото: общее и голова (если есть)
const owPhotoImgs=p=>[p.img].concat(p.head?[p.head.img]:[]);
// фото на модели сейчас: «Править фигуру», галочка «Калька», выбрано фото, его картинки пришли
function owPhotoOn(){const o=OW.o3,p=owPhoto();return !!(o&&p&&ST.edit&&OW.calkaOn&&owPhotoImgs(p).every(f=>o.ptex[f]&&o.ptex[f].ready));}
// картинки фото — по одному разу на вход; не пришла — сообщение, без повторов до нового входа. Пришла — сообщение о той кальке, что выбрана сейчас (пока грузилось, могли переключить)
// #185: пришла — пиксели (canvas) → грани без швов и маска швов (owPhotoPrep) → две текстуры с уровнями и наибольшей анизотропией (без них фото на «Всё» рябит)
function owPhotoGet(o,p){owPhotoImgs(p).forEach(f=>{if(o.ptex[f])return;o.ptex[f]={ready:false,dispose(){}};new THREE.ImageLoader().load(f+(typeof LAZY_V!=='undefined'?LAZY_V:''),im=>{if(OW.o3!==o)return;
      try{o.ptex[f]=owPhotoTex(im);}catch(e){console.warn('фото-калька: пиксели фото не прочитать',e);msg('Фото «'+p.name+'» не прочитать — калька недоступна');return;}renderAll();
      if(owPhotoOn())msg('«'+owPhoto().name+'» на модели: сторона, отвёрнутая от камеры фото, — гипс');},undefined,()=>{if(OW.o3===o)msg('Фото «'+p.name+'» не загрузилось — проверьте интернет и откройте фигуру ещё раз');});
    msg('Загружаю «'+p.name+'»…');});}
// картинка фото → текстура граней без швов (строки снизу вверх, как у маски) с .mask — маской швов и .edge — к каким краям [слева, справа, сверху, снизу] собака подходит вплотную
// (там слой головы гаснет полосой, owHeadW); уровни — если WebGL 2 или стороны — степени двойки (WebGL 1 иначе не умеет)
function owPhotoTex(im){const W=im.naturalWidth||im.width,H=im.naturalHeight||im.height,cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d');cx.drawImage(im,0,0);
  const D=cx.getImageData(0,0,W,H).data,P=owPhotoPrep({W,H,data:D},OW_PHOTO_SEAM),op=(n,k)=>{for(let i=0;i<n;i++)if(D[k(i)*4+3])return true;return false;},mip=renderer.capabilities.isWebGL2||!(W&(W-1))&&!(H&(H-1)),an=renderer.capabilities.getMaxAnisotropy(),
    t=new THREE.DataTexture(P.fill,W,H,THREE.RGBAFormat,THREE.UnsignedByteType),mk=new THREE.DataTexture(P.mips[0].data,W,H,THREE.LuminanceFormat,THREE.UnsignedByteType);
  t.generateMipmaps=mip;mk.generateMipmaps=false;mk.mipmaps=mip?P.mips.map(l=>({data:l.data,width:l.W,height:l.H})):[];mk.unpackAlignment=1;
  [t,mk].forEach(x=>{x.minFilter=mip?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;x.magFilter=THREE.LinearFilter;x.anisotropy=an;x.needsUpdate=true;});t.mask=mk;t.edge=[op(H,i=>i*W),op(H,i=>i*W+W-1),op(W,i=>i),op(W,i=>(H-1)*W+i)];t.ready=true;return t;}
// материал фото-кальки с данными выбранного фото (без головы — слой головы выключен)
function owPhotoUse(o,p){const U=o.photo.userData.U,m=p.m,h=p.head;U.owPh.value=o.ptex[p.img];U.owMk.value=o.ptex[p.img].mask;U.owMu.value.set(m[0],m[1],m[2],m[3]);U.owMv.value.set(m[4],m[5],m[6],m[7]);U.owDir.value.set(p.dir[0],p.dir[1],p.dir[2]);U.owMir.value=p.mirror?1:0;
  U.owHd.value=h?1:0;if(h){U.owPh2.value=o.ptex[h.img];U.owMk2.value=o.ptex[h.img].mask;U.owMu2.value.set(h.m[0],h.m[1],h.m[2],h.m[3]);U.owMv2.value.set(h.m[4],h.m[5],h.m[6],h.m[7]);U.owHb.value.set(h.y0,h.z0);const E=o.ptex[h.img].edge,eu=OW_HEAD_BAND*Math.hypot(h.m[0],h.m[1],h.m[2]),ev=OW_HEAD_BAND*Math.hypot(h.m[4],h.m[5],h.m[6]);U.owHe.value.set(E[0]?eu:1e-6,E[1]?eu:1e-6,E[2]?ev:1e-6,E[3]?ev:1e-6);}return o.photo;}   // owHe — полоса в долях uv головы у краёв, где собака; пустой край — не гасится
// гипс (Lambert, тот же свет) + фото поверх (цвет как есть, швы — по маске); точка и нормаль — в кадре фигуры (атрибуты сетки: root без поворота и масштаба). Текстура читается всегда (вне ветвлений — уровни уменьшения считаются верно)
function owPhotoMat(){const U={owPh:{value:null},owMu:{value:new THREE.Vector4()},owMv:{value:new THREE.Vector4()},owDir:{value:new THREE.Vector3(0,0,-1)},owMir:{value:0},owMk:{value:null},owMk2:{value:null},owSeamC:{value:new THREE.Color(OW_PHOTO_SEAM_C)},
      owHd:{value:0},owBand:{value:OW_HEAD_BAND},owPh2:{value:null},owMu2:{value:new THREE.Vector4()},owMv2:{value:new THREE.Vector4()},owHb:{value:new THREE.Vector2()},owHe:{value:new THREE.Vector4(1e-6,1e-6,1e-6,1e-6)}},
    m=new THREE.MeshLambertMaterial({color:owTone(OW.tone).color,side:THREE.DoubleSide});m.userData.U=U;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader='varying vec3 vOwP;\nvarying vec3 vOwN;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n  vOwP=position;vOwN=normal;');
    sh.fragmentShader=OW_PH_GLSL+sh.fragmentShader.replace('#include <tonemapping_fragment>',`{vec3 n=normalize(vOwN),fx=vec3(-1.,1.,1.);vec2 ua=owUV(vOwP),ub=owUV(vOwP*fx);
  float ca=-dot(n,owDir),cb=owMir>.5?-dot(n*fx,owDir):-1.;bool va=ca>0.&&owIn(ua),vb=cb>0.&&owIn(ub),b=vb&&(!va||cb>ca);
  vec2 u=b?ub:ua;vec3 q=b?vOwP*fx:vOwP;${OW_PH_CW}c=vec4(mix(c.rgb,c2.rgb,c2.a*hw),max(c.a,c2.a*hw));
  float w=(va||vb)?c.a*smoothstep(.1,.25,b?cb:ca):0.;
  gl_FragColor.rgb=mix(gl_FragColor.rgb,c.rgb,w);}
#include <tonemapping_fragment>`);};return m;}
/* #184 кусок шейдера фото — общий у проекции (owPhotoMat) и плоской кальки (owFlatMat), чтобы швы и стык головы были одни: OW_PH_GLSL — униформы (их значения ставит owPhotoUse) и owUV / owIn;
   OW_PH_CW — по u (общее фото) и q (точка кадра фигуры для фото головы): c — общее фото, c2 — фото головы (швы — по маске цветом owSeamC), hw — вес головы (полоса OW_HEAD_BAND, край картинки по .edge) */
const OW_PH_GLSL=`uniform sampler2D owPh;
uniform vec4 owMu;
uniform vec4 owMv;
uniform vec3 owDir;
uniform float owMir;
uniform sampler2D owMk;
uniform sampler2D owMk2;
uniform vec3 owSeamC;
uniform float owHd;
uniform float owBand;
uniform sampler2D owPh2;
uniform vec4 owMu2;
uniform vec4 owMv2;
uniform vec2 owHb;
uniform vec4 owHe;
varying vec3 vOwP;
varying vec3 vOwN;
vec2 owUV(vec3 p){return vec2(dot(owMu.xyz,p)+owMu.w,dot(owMv.xyz,p)+owMv.w);}
bool owIn(vec2 u){return u.x>=0.&&u.x<=1.&&u.y>=0.&&u.y<=1.;}
`;
const OW_PH_CW=`vec4 c=texture2D(owPh,vec2(u.x,1.-u.y));c.rgb=mix(c.rgb,owSeamC,smoothstep(.3,.6,texture2D(owMk,vec2(u.x,1.-u.y)).r));
  vec2 u2=vec2(dot(owMu2.xyz,q)+owMu2.w,dot(owMv2.xyz,q)+owMv2.w);vec4 c2=texture2D(owPh2,vec2(u2.x,1.-u2.y));c2.rgb=mix(c2.rgb,owSeamC,smoothstep(.3,.6,texture2D(owMk2,vec2(u2.x,1.-u2.y)).r));
  float hw=owHd>.5&&owIn(u2)?smoothstep(owHb.x-owBand,owHb.x,q.y)*smoothstep(owHb.y-owBand,owHb.y,q.z)*smoothstep(0.,owHe.x,u2.x)*smoothstep(0.,owHe.y,1.-u2.x)*smoothstep(0.,owHe.z,u2.y)*smoothstep(0.,owHe.w,1.-u2.y):0.;`;
/* ---------- #184 плоская фото-калька: в ортовиде своего ракурса (owFlatShow) фото лежит картинкой поперёк взгляда — без перспективы и без растяжки по форме модели (тикет, «Что делаем»).
   Две плоскости в OW.o3.flat.g: общее фото (gen, renderOrder 1) и фото головы (head, 2) — углы owPhotoQuad по матрицам m и head.m; глубина — край габарита модели со стороны камеры + 1 мм.
   Текстуры, униформы и кусок шейдера — те же, что у проекции (o.ptex, o.photo.userData.U, OW_PH_CW): одни швы и один стык головы. Модель — гипс; калька поверх без глубины (depthTest / depthWrite выкл.),
   штрихи разметки (renderOrder 3) — поверх кальки и прячутся за моделью по её глубине. Прозрачность owOp (0,5 — поверх модели). Голова над общим без двойного фото: общее — с долей A·(1−hh) / (1−A·hh),
   голова — A·hh (A = owOp · max(альфа общего, hh), hh — альфа головы × вес): итог тот же, что у проекции, — mix(общее, голова, hh) с непрозрачностью A, а не голова полупрозрачно поверх полупрозрачного общего */
function owFlatMat(U,layer){return new THREE.ShaderMaterial({uniforms:Object.assign({},U,{owLayer:{value:layer}}),transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
  vertexShader:'varying vec3 vOwP;\nvarying vec3 vOwN;\nvoid main(){vOwP=position;vOwN=vec3(0.,0.,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:OW_PH_GLSL+`uniform float owOp;
uniform float owLayer;
void main(){vec2 u=owUV(vOwP);vec3 q=vOwP;${OW_PH_CW}
  float hh=c2.a*hw,A=owOp*max(owIn(u)?c.a:0.,hh);
  gl_FragColor=owLayer>.5?vec4(c2.rgb,A*hh):vec4(c.rgb,A*(1.-hh)/max(1e-4,1.-A*hh));}`});}
// плоская калька выбранного фото: униформы — owPhotoUse (как у проекции), плоскости — по фото и стороне камеры (пересборка, когда поменялись); модель под ней — гипс или, при снятой «Модели», только глубина
function owFlatUse(o,ph){owPhotoUse(o,ph);const f=o.flat,A=ph.dir.map(Math.abs),a=A.indexOf(Math.max(...A)),dp=VIEW.axis&&VIEW.axis.getComponent(a)<0?OW.box.min[a]-1:OW.box.max[a]+1,key=ph.key+'|'+dp;
  if(f.key!==key){owFlatDrop(f);f.key=key;const quad=(m,mat,ro)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(owPhotoQuad(m,ph.dir,dp).flat(),3));g.setIndex([0,1,2,0,2,3]);
      const q=new THREE.Mesh(g,mat);q.renderOrder=ro;f.g.add(q);return q;};f.gen=quad(ph.m,f.mg,1);f.head=ph.head?quad(ph.head.m,f.mh,2):null;}
  [f.mg,f.mh].forEach(m=>{m.uniforms.owOp.value=OW.modelOn?.5:1;});return OW.modelOn?o.plaster:o.depth;}   // #184 «Модель»: включена — фото 50 % поверх гипса, снята — фото 100 %, модель только в глубину
function owFlatDrop(f){[f.gen,f.head].forEach(q=>{if(q){f.g.remove(q);q.geometry.dispose();}});f.gen=f.head=null;f.key='';}
// блок кальки на панели в режиме: галочка «Калька» и выбор — только когда калька готова (текстура пришла и прочиталась — есть маска); сверки (облака TRACE) у оригинала нет
// #178: в списке ещё фото-кальки фигуры (OW.photos); пока готовится «Текстура» (она по умолчанию) — блок скрыт, как было
function owCalkaUI(){const o=OW.o3,ts=$('traceSel'),L=(o&&o.mask?[['tex','Текстура']]:[]).concat(OW.photos.map(p=>[p.key,p.name])),has=!!(o&&L.length&&!(OW.calka==='tex'&&!o.mask));
  $('traceRow').hidden=!has;$('cTrace').checked=OW.calkaOn;ts.hidden=!(has&&OW.calkaOn);$('seamWRow').hidden=!(o&&o.mask);   // #188 «Белые швы» — когда калька «Текстура» готова
  const h=L.map(([v,n])=>`<option value="${v}">${n}</option>`).join('');if(ts.innerHTML!==h)ts.innerHTML=h;if(has)ts.value=OW.calka;$('diffRow').hidden=true;$('diffNo').hidden=true;$('edTrace').hidden=true;}
// перерисовка в режиме: только сцена и то, что видно на панели; без расчёта
function owRender(){if(!OW.on)return;const o=OW.o3,ph=owPhoto();if(o&&ph&&ST.edit&&OW.calkaOn)owPhotoGet(o,ph);   // #178: фото грузится, когда его калька выбрана и видна
  const fl=!!(o&&ph&&!($('cOrigTex').checked&&o.tex)&&owPhotoOn()&&typeof VIEW!=='undefined'&&owFlatShow(ph.key,VIEW.key,VIEW.ortho));   // #184: плоская калька — в ортовиде своего ракурса, иначе проекция
  if(o){OW.mesh.material=$('cOrigTex').checked&&o.tex?o.basic:fl?owFlatUse(o,ph):owSeamOn()?o.seam:owPhotoOn()?owPhotoUse(o,ph):o.plaster;o.flat.g.visible=fl;}$('modelRow').hidden=!fl;$('cModel').checked=OW.modelOn;owMk3D();req3D();
  $('ttl').textContent=ST.name||OW.name;$('edBox').hidden=!ST.edit;owCalkaUI();mkUI();
  $('hint').textContent=ST.tool?'Разметка: левая кнопка — рисовать, правая — крутить, колесо — масштаб':'Оригинал для обводки: левая кнопка — крутить, колесо — масштаб, правая — сдвиг · галочка «Текстура» — швы Meshy или гипс';
  if(ok)renderer.domElement.setAttribute('aria-label',`3D-модель «${ST.name||OW.name}»: оригинал для обводки, ${Math.round(OW.box.size[0])} × ${Math.round(OW.box.size[1])} × ${Math.round(OW.box.size[2])} мм (Ш × В × Г)`);}
// точка под курсором: {p:[x,y,z], uv:[u,v]|null, n:[x,y,z], tri} или null (промах)
function owPick(ev){if(!ok||!OW.on||!OW.G)return null;const r=renderer.domElement.getBoundingClientRect(),rc=new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),curCam());const O=rc.ray.origin,D=rc.ray.direction,h=owRay(OW.G,[O.x,O.y,O.z],[D.x,D.y,D.z]);if(!h)return null;
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
// открыть файл режима: встроенная фигура → открыть её с разметкой из файла (видна сразу — «Править фигуру» включается). Модель из файла — owFileMk (#179).
// Разметку основы не затираем: если на ней уже что-то есть и оно не то же, что в файле, — файл ложится новой версией в браузере (verPut), как «Сохранить»
function owFromJSON(j){const o=j.ow||{},f=FIGURES[o.id];if(o.src==='file'){owFileMk(o,mkLoad(JSON.stringify(j.mk||[])));return;}if(o.src!=='fig'||!f||!f.ow){msg('Сначала откройте модель «'+(o.name||'?')+'»');return;}const mk=mkLoad(JSON.stringify(j.mk||[])),n=mk.length;
  loadFigure(o.id,()=>{mkSync();const own=mkSave(ST.mk);if(ST.mk.length&&own!==mkSave(mk)){const r=verPut(VSTO,o.id,{...j,mk:JSON.parse(mkSave(mk))});
      if(r&&!r.err){verOptions();owVerShow(j,o.id,r.n,true,`Разметка из файла открыта версией «${verName(o.id,r.n)}» — разметка «${f.name}» не тронута`);return;}}
    mkSet(mk);ST.name=j.name||f.name;$('mName').value=ST.name;ST.edit=true;$('cEdit').checked=true;renderAll();msg(`Открыта разметка: ${n} ${plural(n,'штрих','штриха','штрихов')} на «${f.name}»`);});}
// версия из браузера: та же фигура, разметка версии — своя (mkKey('<id>.<n>')); пусто — из самой версии
function owVersion(j,base,n){const edit=ST.edit;loadFigure(base,()=>owVerShow(j,base,n,edit));}
// фигура уже открыта (owOpen) — сделать её версией n: ключ разметки по версии, пустой — из JSON версии
function owVerShow(j,base,n,edit,note){ST.ver=n;ST.verBase=base;$('figSel').value='ver:'+base+':'+n;mkSync();if(!ST.mk.length&&Array.isArray(j.mk)&&j.mk.length)mkSet(j.mk);
  if(edit){ST.edit=true;$('cEdit').checked=true;}ST.name=j.name||ST.name;$('mName').value=ST.name;renderAll();msg(note||`Открыта версия «${verName(base,n)}»`);}

/* ---------- #179 «Открыть модель» — всегда для обводки (спека, «Решения»: «Открыть модель»): OBJ / GLB / STL → этот режим; старое расчётное открытие (упрощение и расчёт) убрано ----------
   Модель — в кадр фигуры (owMesh: центр по X и Z — 0, низ — 0, высота 1000 мм; обход треугольников — наружу по знаку объёма, у чужой модели он не гарантирован). Текстура: GLB — из файла (parseGLB → img),
   OBJ — картинка, выбранная вместе с ним, STL — нет. Нет текстуры или развёртки — гипс без кальки «Текстура» и с сообщением, перо работает. Разметка — в браузере по имени файла модели (mkFig в ui.js) */
const OW_EXT=['obj','glb','stl'],OW_PIC=['png','jpg','jpeg','webp'],OW_NOTEX='Текстуры нет — калька «Текстура» недоступна';
// почему нет текстуры — в скобках после OW_NOTEX (why из parseGLB или по типу файла)
const OW_WHY={obj:'выберите вместе с OBJ картинку текстуры',objuv:'в OBJ нет развёртки uv',stl:'у STL текстуры не бывает',uri:'у GLB текстура отдельным файлом — откройте модель как OBJ вместе с картинкой',
  multi:'у частей модели разные текстуры или текстура не у всех',nouv:'в модели нет развёртки uv',format:'картинка текстуры не PNG, JPG или WebP',none:''};
let OW_WAIT=null;   // разметка из .json, открытого раньше своей модели: {id — имя файла модели, mk} — ляжет на модель, когда её откроют (owFile)
function owFile(file,pic){const ext=file.name.split('.').pop().toLowerCase(),name=file.name.replace(/\.[^.]+$/,'');
  file.arrayBuffer().then(buf=>later(()=>{const m=ext==='obj'?parseOBJ(new TextDecoder().decode(buf)):ext==='stl'?parseSTL(buf):parseGLB(buf);if(!m.F.length)throw new Error('в файле нет граней');
    const D=owMesh(m),img=ext==='glb'?m.img:ext==='obj'&&D.T?pic:null,why=img&&D.T?'':ext==='stl'?'stl':ext==='obj'?(D.T?'obj':'objuv'):m.why||'nouv',n=D.F.length/3;
    if(D.flipped)console.log('модель «'+file.name+'»: треугольники смотрели внутрь (объём '+Math.round(D.vol)+') — обход перевёрнут');
    const go=tex=>{owOpen({id:file.name,name,V:D.V,T:D.T,F:D.F,tex},'file');
    msg('Открыта модель для обводки: '+fmt(n)+' '+plural(n,'треугольник','треугольника','треугольников')+(why?' · '+OW_NOTEX+(OW_WHY[why]?' ('+OW_WHY[why]+')':''):'')+(pic&&!img&&ext!=='obj'?' · картинку «'+pic.name+'» берём только к OBJ':''));
    if(OW_WAIT&&OW_WAIT.id===file.name){const w=OW_WAIT;OW_WAIT=null;owMkPut(w.mk);}};
    if(!img){go('');return;}const fr=new FileReader();fr.onload=()=>go(fr.result);fr.onerror=()=>{go('');msg('Модель открыта, но картинку текстуры не прочитать — калька «Текстура» недоступна');};fr.readAsDataURL(img);},'Читаю модель…'));}   // картинка — data:-ссылкой: ссылки blob на странице — только у скачивания (saveBlob в ui.js); не прочиталась — без текстуры
// разметка из файла — на открытую модель: была другая — не пропадает, Ctrl+Z возвращает её (два шага отмены #180: «добавить» и «очистить»)
function owMkPut(mk){mkSync();const n=mk.length;if(!n){renderAll();msg(`В файле разметки нет штрихов — разметка «${OW.name}» не тронута`);return;}const keep=ST.mk.length>0&&mkSave(ST.mk)!==mkSave(mk);if(keep){mkDo(mkClearAll);mkDo(mkPush,mk);}else mkSet(mk);
  ST.edit=true;$('cEdit').checked=true;renderAll();msg(`Открыта разметка: ${n} ${plural(n,'штрих','штриха','штрихов')} на «${OW.name}»`+(keep?' — прежняя разметка: Ctrl+Z дважды':''));}
// .json разметки модели из файла: модель открыта — разметка на неё; нет — «Сначала откройте модель», разметка ждёт модель (OW_WAIT), а если в браузере для неё пусто — ложится и туда (переживёт перезагрузку)
function owFileMk(o,mk){const id=o.id||o.name||'?',n=mk.length;if(!n){msg(`В файле разметки нет штрихов — открывать нечего (модель «${id}»)`);return;}if(OW.on&&OW.src==='file'&&OW.id===id){owMkPut(mk);return;}
  OW_WAIT={id,mk};const k=mkKey('file:'+id),busy=mkLoad(store(k)).length>0;if(!busy)store(k,mkSave(mk));
  msg(`Сначала откройте модель «${id}» — разметка из файла (${n} ${plural(n,'штрих','штриха','штрихов')}) ляжет на неё`+(busy?' (у модели в браузере своя разметка — файл ляжет поверх, если открыть модель до перезагрузки страницы; прежняя — Ctrl+Z)':''));}
