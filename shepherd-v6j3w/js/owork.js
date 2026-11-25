/* ---------- Оригинал для обводки (#175, спека docs/superpowers/specs/2026-11-25-shepherd7-workshop-design.md): модель как есть, в гипсе, без расчёта ----------
   Режим фигуры, а не вид: FIGURES.<id>.ow — ключ в ORIG (данные js/orig-<id>.js, общие с видом #146). Расчёт (compute), цифры, таблицы, «Углы» в режиме не работают —
   renderAll() зовёт только owRender(). Рабочая фигура до входа (CUR) остаётся в памяти нетронутой и снова считается, когда выбрали другую фигуру (setBase → owLeave).
   Точка под курсором — owPick: луч по сетке клеток (owGrid/owRay в ow-core.js), а не перебор 158 тыс. треугольников. */
const OW={on:false,id:'',src:'',name:'',V:null,T:null,F:null,img:null,photos:[],calka:'',mesh:null,G:null,box:null,o3:null};
// гипс — светлый тёплый серо-бежевый (спека, «Цвета»)
const OW_PLASTER=0xb8b0a4;
function owBox(V){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<V.length;i+=3)for(let k=0;k<3;k++){const x=V[i+k];if(x<min[k])min[k]=x;if(x>max[k])max[k]=x;}return {min,max,size:max.map((x,k)=>x-min[k])};}
// встроенная фигура режима: подгрузить данные (лениво, как вид #146) и открыть
function owLoad(id,after){FIG_WANT=id;const f=FIGURES[id];
  if(!figureReady(id,()=>{if(FIG_WANT===id)owLoad(id,after);},()=>{if(FIG_WANT===id){loading(false);$('figSel').value=ST.orig?ST.orig.id:OW.on?OW.id:ST.ver?'ver:'+ST.verBase+':'+ST.ver:ST.fig||'';msg('Оригинал не загрузился — проверьте интернет и выберите его ещё раз');}})){loading(true,'Загружаю оригинал…');return;}
  later(()=>{if(FIG_WANT!==id)return;const r=ORIG[f.ow],D=origDecode(r);owOpen({id,name:f.name,V:D.V,T:D.T,F:D.F,tex:r.tex},'fig');store('shepherd-fig',id);if(after)after();},'Открываю оригинал…');}
// войти в режим. src: {id, name, V, T, F, tex (адрес картинки текстуры) | img, photos}; kind: 'fig' — встроенная, 'file' — из «Открыть модель»
function owOpen(src,kind){origLeave();owDrop3D();
  Object.assign(OW,{on:true,id:src.id,src:kind,name:src.name,V:src.V,T:src.T||null,F:src.F,img:src.img||null,photos:src.photos||[],calka:''});
  OW.G=owGrid(OW.V,OW.F);OW.box=owBox(OW.V);
  // что было у рабочей фигуры и в режиме не нужно: инструмент разметки, «Углы», выбор деталей и точек
  if(ST.tool){ST.tool='';mkCtl();}ST.edit=false;$('cEdit').checked=false;   // как у любой фигуры (setBase): открывается без «Править фигуру»if(typeof ANG!=='undefined'&&ANG.on){ANG.on=false;ANG.pick=[];stage.classList.remove('angmode');$('angCard').hidden=true;}
  ST.fig=kind==='fig'?src.id:'';ST.verBase=kind==='fig'?src.id:'';ST.ver=0;ST.refId='';ST.tref='';ST.sel=ST.selB=ST.sv=ST.sp=ST.sp2=-1;ST.seam=null;ST.name=src.name;$('mName').value=ST.name;
  document.body.classList.add('owview');$('origBox').hidden=false;$('cOrigTex').checked=false;$('bSave').disabled=true;   // «Сохранить» разметки — задача 2 плана
  $('origNote').textContent='Оригинал для обводки: модель как есть, расчёта нет';$('figSel').value=kind==='fig'?src.id:'';
  owBuild(src);fitBox(OW.box,true);renderAll();msg('Оригинал для обводки: '+fmt(OW.F.length/3)+' '+plural(OW.F.length/3,'треугольник','треугольника','треугольников')+', расчёта нет');}
function owLeave(){if(!OW.on)return;owDrop3D();Object.assign(OW,{on:false,V:null,T:null,F:null,img:null,G:null,box:null,photos:[]});
  document.body.classList.remove('owview');$('origBox').hidden=true;$('cOrigTex').checked=true;$('bSave').disabled=false;}   // «Текстура» — как была у вида #146 (по умолчанию включена)
function owDrop3D(){const o=OW.o3;if(!o)return;OW.o3=OW.mesh=null;if(typeof root!=='undefined'&&root)root.remove(o.mesh);o.geo.dispose();o.plaster.dispose();o.basic.dispose();if(o.tex)o.tex.dispose();}
// сетка на сцену: гипс с освещением; галочка «Текстура» — картинка Meshy как есть (как у вида #146)
function owBuild(src){if(!ok)return;while(root.children.length){const c=root.children.pop();c.geometry&&c.geometry.dispose();if(c.element)c.element.remove();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(OW.V,3));if(OW.T)g.setAttribute('uv',new THREE.BufferAttribute(OW.T,2));
  g.setAttribute('normal',new THREE.BufferAttribute(origNormals(OW.V,OW.F),3));g.setIndex(new THREE.BufferAttribute(OW.F,1));g.computeBoundingSphere();
  const plaster=new THREE.MeshLambertMaterial({color:OW_PLASTER,side:THREE.DoubleSide}),basic=new THREE.MeshBasicMaterial({color:OW_PLASTER,side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,plaster);
  const o=OW.o3={mesh,geo:g,plaster,basic,tex:null};OW.mesh=mesh;root.add(mesh);   // без userData.pick: детали (pickTri) у оригинала нет, точку ищет owPick
  if(OW.T&&src.tex){const t=new THREE.TextureLoader().load(src.tex+(typeof LAZY_V!=='undefined'?LAZY_V:''),()=>{if(OW.o3!==o)return;basic.map=t;basic.color.set(0xffffff);basic.needsUpdate=true;req3D();},undefined,()=>{});
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());o.tex=t;}}
// перерисовка в режиме: только сцена и то, что видно на панели; без расчёта
function owRender(){if(!OW.on)return;if(OW.o3)OW.mesh.material=$('cOrigTex').checked&&OW.o3.tex?OW.o3.basic:OW.o3.plaster;req3D();
  $('ttl').textContent=ST.name||OW.name;$('edBox').hidden=!ST.edit;$('mkBox').hidden=true;
  $('hint').textContent='Оригинал для обводки: левая кнопка — крутить, колесо — масштаб, правая — сдвиг · галочка «Текстура» — швы Meshy или гипс';
  if(ok)renderer.domElement.setAttribute('aria-label',`3D-модель «${ST.name||OW.name}»: оригинал для обводки, ${Math.round(OW.box.size[0])} × ${Math.round(OW.box.size[1])} × ${Math.round(OW.box.size[2])} мм (Ш × В × Г)`);}
// точка под курсором: {p:[x,y,z], uv:[u,v]|null, n:[x,y,z], tri} или null (промах)
function owPick(ev){if(!ok||!OW.on||!OW.G)return null;const r=renderer.domElement.getBoundingClientRect(),rc=new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),camera);const O=rc.ray.origin,D=rc.ray.direction,h=owRay(OW.G,[O.x,O.y,O.z],[D.x,D.y,D.z]);if(!h)return null;
  const {V,T,F}=OW,a=F[h.tri*3],b=F[h.tri*3+1],c=F[h.tri*3+2],w=1-h.u-h.v,at=(A,i,k)=>A[a*k+i]*w+A[b*k+i]*h.u+A[c*k+i]*h.v,
    e1=[0,1,2].map(i=>V[b*3+i]-V[a*3+i]),e2=[0,1,2].map(i=>V[c*3+i]-V[a*3+i]),n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],
    l=(n[0]*D.x+n[1]*D.y+n[2]*D.z>0?-1:1)*(Math.hypot(...n)||1);   // нормаль — к камере: модель двусторонняя, обход треугольников у Meshy бывает внутрь
  return {p:[0,1,2].map(i=>at(V,i,3)),uv:T?[at(T,0,2),at(T,1,2)]:null,n:n.map(x=>x/l),tri:h.tri};}
