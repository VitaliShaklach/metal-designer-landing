/* ---------- 3D: грани-детали, швы, номера, выбор ---------- */
const stage=document.getElementById('stage');
let renderer,scene,camera,controls,labels,root,ok=true,camAnim=null,need=3;
function req3D(){need=Math.max(need,3);}
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','3D-модель фигуры');stage.appendChild(renderer.domElement);}catch(e){ok=false;}
if(ok){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,5,30000);camera.position.set(700,600,1400);
  labels=new THREE.CSS2DRenderer();labels.domElement.style.cssText='position:absolute;inset:0;pointer-events:none';labels.domElement.setAttribute('aria-hidden','true');stage.appendChild(labels.domElement);
  controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,300,0);
  scene.add(new THREE.HemisphereLight(0xf2f4f5,0xb4aea6,.8));
  const d=new THREE.DirectionalLight(0xffffff,.85);d.position.set(900,1600,1800);scene.add(d);
  const d2=new THREE.DirectionalLight(0xbfd0e0,.35);d2.position.set(-1500,500,-900);scene.add(d2);
  // подсветка снизу-спереди: подбородок и низ шеи не проваливаются в черноту, детали различимы
  const d3=new THREE.DirectionalLight(0xfff4e8,.45);d3.position.set(400,-1400,1300);scene.add(d3);
  root=new THREE.Group();scene.add(root);
  const grid=new THREE.GridHelper(6000,60,0xb9c0bd,0xd5dad7);grid.material.transparent=true;grid.material.opacity=.5;scene.add(grid);}
const COL={steel:[0x6b737b,0x8a929a],inox:[0x9aa3ab,0xc2c9cf],corten:[0x8a4a2a,0xa8623a],alu:[0xa9b0b6,0xd0d5d9]};
let LBL=[];
// R — результат buildParts, M3 — сетка в мм; o: {sel, small:Set, nums, mat, warn/blue/pierce — треугольники неплоских / самопересечённых / протыкающих граней}
function build3D(M3,R,o){if(!ok)return;req3D();while(root.children.length){const c=root.children.pop();c.geometry&&c.geometry.dispose();if(c.element)c.element.remove();}LBL=[];
  const {V,F}=M3,pos=new Float32Array(F.length*9),col=new Float32Array(F.length*9),[c0,c1]=(COL[o.mat]||COL.steel).map(x=>new THREE.Color(x)),sel=new THREE.Color(0xd0561f),red=new THREE.Color(0xd01f1f),amb=new THREE.Color(0xe0a020),blu=new THREE.Color(0x3a6fe0),vio=new THREE.Color(0x9b3fd6),tmp=new THREE.Color();
  // калька (o.tex): грани белые — цвет даёт текстура; выделения — подкраска поверх рисунка
  const tx=o.tex,wh=new THREE.Color(1,1,1),tint=c=>tx?tmp.copy(wh).lerp(c,.6):tmp.copy(c);
  F.forEach((f,fi)=>{const pi=R.partOf[fi],h=((pi*2654435761)>>>0)/4294967296;if(tx)tmp.copy(wh);else tmp.copy(c0).lerp(c1,h);if(o.small&&o.small.has(pi))tint(red);if(o.warn&&o.warn.has(fi))tint(amb);if(o.blue&&o.blue.has(fi))tint(blu);if(o.pierce&&o.pierce.has(fi))tint(vio);if(o.grp&&o.grp.has(pi)&&pi!==o.sel)tint(amb);if(o.hi?o.hi.has(fi):pi===o.sel)tint(sel);
    f.forEach((v,k)=>{pos.set(V[v],fi*9+k*3);col.set([tmp.r,tmp.g,tmp.b],fi*9+k*3);});});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  let map=null;if(tx){g.setAttribute('uv',new THREE.BufferAttribute(tx.uv,2));if(!tx.tex){tx.tex=new THREE.DataTexture(tx.data,tx.W,tx.H,THREE.RGBAFormat);tx.tex.magFilter=tx.tex.minFilter=THREE.LinearFilter;tx.tex.generateMipmaps=false;tx.tex.needsUpdate=true;}map=tx.tex;}
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,map,metalness:tx?0:.45,roughness:tx?.85:.6,side:THREE.DoubleSide,flatShading:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));mesh.userData.pick=true;root.add(mesh);
  // подложки за прорезями — тёмные, утоплены внутрь
  if(o.backs&&o.backs.length){const bp=[];o.backs.forEach(P=>{const idx=P.map((_,i)=>i);earClip(P,idx).forEach(t=>t.forEach(i=>bp.push(...P[i])));});
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bg.computeVertexNormals();root.add(new THREE.Mesh(bg,new THREE.MeshStandardMaterial({color:0x1c1e20,metalness:.3,roughness:.8,side:THREE.DoubleSide})));}
  // швы между деталями — тёмные линии; открытый край — светлее
  // с калькой (o.diff): лишние швы — красные, недостающие швы эталона — жёлтые точки
  // с гибкой: гнутые стыки — тонким пунктиром
  const L=[],Lo=[],Lr=[],Lb=[],RS=new Set(o.diff?o.diff.red:[]);R.edges.forEach((e,i)=>(e.open?Lo:RS.has(i)?Lr:o.bent&&o.bent(e)?Lb:L).push(...V[e.a],...V[e.b]));
  const seg=(arr,c,op)=>{if(!arr.length)return;const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));root.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:c,transparent:true,opacity:op})));};
  seg(L,0x15191b,.8);seg(Lo,0xd0561f,.9);seg(Lr,0xe01818,1);
  if(Lb.length){const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(Lb,3));const ln=new THREE.LineSegments(bg,new THREE.LineDashedMaterial({color:0x2a6fd0,dashSize:4,gapSize:3,transparent:true,opacity:.9}));ln.computeLineDistances();root.add(ln);}
  if(o.diff&&o.diff.yel.length){const yg=new THREE.BufferGeometry();yg.setAttribute('position',new THREE.BufferAttribute(o.diff.yel,3));root.add(new THREE.Points(yg,new THREE.PointsMaterial({color:0xffc400,size:5,sizeAttenuation:false})));}
  // редактор: точки; выбранная — крупная оранжевая
  if(o.verts){const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(V.flat(),3));root.add(new THREE.Points(pg,new THREE.PointsMaterial({color:0x1f8fe0,size:7,sizeAttenuation:false})));
    if(o.mark&&o.mark.length){const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(o.mark.map(i=>V[i]).flat(),3));root.add(new THREE.Points(mg,new THREE.PointsMaterial({color:0xd0561f,size:13,sizeAttenuation:false,depthTest:false})));}
    if(o.sv>=0&&V[o.sv]){const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(V[o.sv],3));root.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xd0561f,size:13,sizeAttenuation:false,depthTest:false})));}}
  if(o.nums)R.parts.forEach(p=>{const el=document.createElement('span');el.className='pno'+(p.id===o.sel?' on':'');el.textContent=p.no;const l=new THREE.CSS2DObject(el);
    l.position.set(...V3.add(partLabelPt(p,M3),V3.mul(p.n,3)));l.userData.n=p.n;root.add(l);LBL.push(l);});}
// номера — только у граней, повёрнутых к камере
function lblVis(){const cp=camera.position;LBL.forEach(l=>{const p=l.position,n=l.userData.n,v=(cp.x-p.x)*n[0]+(cp.y-p.y)*n[1]+(cp.z-p.z)*n[2];l.visible=v>0;});}
function flyTo(p,t){req3D();camAnim={p0:camera.position.clone(),t0:controls.target.clone(),p1:p,t1:t,s:performance.now()};}
// полёт по дуге вокруг цели, а не по прямой (иначе при повороте на другую сторону камера проходит сквозь фигуру)
function arcDir(A,e){const d0=A.p0.clone().sub(A.t0),d1=A.p1.clone().sub(A.t1),l=d0.length()*(1-e)+d1.length()*e,u0=d0.normalize(),u1=d1.normalize();let w=u0.angleTo(u1);
  if(w<1e-3)return u0.lerp(u1,e).normalize().multiplyScalar(l);if(w>3.1){u1.add(new THREE.Vector3(0,.05,0)).normalize();w=u0.angleTo(u1);}
  return u0.multiplyScalar(Math.sin((1-e)*w)/Math.sin(w)).add(u1.multiplyScalar(Math.sin(e*w)/Math.sin(w))).normalize().multiplyScalar(l);}
// подлететь к детали: она лицом к зрителю (partCam в mesh.js)
function focusPart(p,box){if(!ok||!p)return;const cur=camera.position.clone().sub(controls.target).normalize(),r=partCam(p.c,p.n,Math.max(p.L||0,p.W||0),box,[cur.x,cur.y,cur.z],camera.fov);flyTo(new THREE.Vector3(...r.pos),new THREE.Vector3(...r.target));}
function fitBox(b,instant){if(!ok)return;sizeStage();const c=new THREE.Vector3((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);
  let dir=camera.position.clone().sub(controls.target).normalize();if(!isFinite(dir.x))dir=new THREE.Vector3(.45,.3,.85).normalize();
  // расстояние — чтобы все 8 углов габарита влезли и по высоте, и по ширине кадра
  const up=new THREE.Vector3(0,1,0),rt=new THREE.Vector3().crossVectors(up,dir).normalize(),u2=new THREE.Vector3().crossVectors(dir,rt),tv=Math.tan(camera.fov*Math.PI/360)*.88,th=tv*camera.aspect;let dist=0;
  for(let k=0;k<8;k++){const q=new THREE.Vector3(k&1?b.max[0]:b.min[0],k&2?b.max[1]:b.min[1],k&4?b.max[2]:b.min[2]).sub(c),z=q.dot(dir);dist=Math.max(dist,Math.abs(q.dot(rt))/th+z,Math.abs(q.dot(u2))/tv+z);}
  const p=c.clone().add(dir.multiplyScalar(dist+20));if(instant){camera.position.copy(p);controls.target.copy(c);req3D();}else flyTo(p,c);}
function viewDir(k,b,inst){if(!ok)return;const D={front:[0,0,1],side:[1,0,0],top:[0,1,.0001],iso:[.45,.3,.85]}[k];camera.position.copy(controls.target.clone().add(new THREE.Vector3(...D).normalize().multiplyScalar(camera.position.distanceTo(controls.target))));fitBox(b,inst);}
// под курсором: номер треугольника
function pickTri(ev){if(!ok)return -1;const r=renderer.domElement.getBoundingClientRect(),m=new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,camera);
  const h=rc.intersectObjects(root.children.filter(o=>o.userData.pick),false)[0];return h?h.faceIndex:-1;}
// точка поверхности под курсором
function pickHit(ev){if(!ok)return null;const r=renderer.domElement.getBoundingClientRect(),m=new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,camera);
  const h=rc.intersectObjects(root.children.filter(o=>o.userData.pick),false)[0];return h?[h.point.x,h.point.y,h.point.z]:null;}
// точка под курсором (ближе 14 px и не за гранью)
function pickVert(ev,V){if(!ok)return -1;const r=renderer.domElement.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top,m=new THREE.Vector2(mx/r.width*2-1,-my/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,camera);
  const h=rc.intersectObjects(root.children.filter(o=>o.userData.pick),false)[0],hd=h?h.distance:Infinity;let best=-1,bd=14;const q=new THREE.Vector3();
  V.forEach((p,i)=>{q.set(p[0],p[1],p[2]).project(camera);if(q.z>1)return;const d=Math.hypot((q.x+1)/2*r.width-mx,(1-q.y)/2*r.height-my);if(d>=bd)return;if(camera.position.distanceTo(new THREE.Vector3(...p))>hd+8)return;bd=d;best=i;});return best;}
// точка на плоскости, проходящей через p поперёк взгляда — для перетаскивания
function dragPoint(ev,p){const r=renderer.domElement.getBoundingClientRect(),m=new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,camera);
  const n=new THREE.Vector3();camera.getWorldDirection(n);const pl=new THREE.Plane().setFromNormalAndCoplanarPoint(n,new THREE.Vector3(...p)),o=new THREE.Vector3();return rc.ray.intersectPlane(pl,o)?[o.x,o.y,o.z]:null;}
function sizeStage(){if(!ok)return;req3D();const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);labels.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
if(ok){new ResizeObserver(sizeStage).observe(stage);sizeStage();
  (function loop(){requestAnimationFrame(loop);if(camAnim){const k=Math.min(1,(performance.now()-camAnim.s)/600),e=k<.5?2*k*k:1-(-2*k+2)**2/2;controls.target.lerpVectors(camAnim.t0,camAnim.t1,e);camera.position.copy(controls.target).add(arcDir(camAnim,e));if(k>=1)camAnim=null;}
    controls.update();if(!camAnim&&need<=0)return;need--;lblVis();renderer.render(scene,camera);labels.render(scene,camera);})();
  // рисуем только когда что-то изменилось
  controls.addEventListener('change',req3D);['pointermove','pointerdown','pointerup','wheel','keydown','input','change','click'].forEach(e=>addEventListener(e,req3D,{passive:true,capture:true}));}
/* ---------- снимки куска для карт деталей: та же фигура, что в 3D, кусок — оранжевым, зеркальный — синим ---------- */
// свой рендерер и сцена — основной вид не трогаем; сетка строится один раз на фигуру (CUR.M3), на кусок меняются только цвета
let SHOT=null;
function shotScene(){const R=CUR.R,M3=CUR.M3;if(!SHOT){const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}),sc=new THREE.Scene();r.setPixelRatio(1);sc.background=new THREE.Color(0xeef1f0);
    sc.add(new THREE.HemisphereLight(0xf2f4f5,0xb4aea6,.8));[[0xffffff,.85,[900,1600,1800]],[0xbfd0e0,.35,[-1500,500,-900]],[0xfff4e8,.45,[400,-1400,1300]]].forEach(([c,i,p])=>{const d=new THREE.DirectionalLight(c,i);d.position.set(...p);sc.add(d);});
    SHOT={r,sc,cam:new THREE.PerspectiveCamera(35,1,5,30000),ray:new THREE.Raycaster(),key:null,grp:null};}
  if(SHOT.key===M3&&SHOT.R===R)return SHOT;
  if(SHOT.grp){SHOT.sc.remove(SHOT.grp);SHOT.grp.traverse(o=>o.geometry&&o.geometry.dispose());}
  const {V,F}=M3,pos=new Float32Array(F.length*9),[c0,c1]=(COL[ST.mat]||COL.steel).map(x=>new THREE.Color(x)),base=new Float32Array(F.length*9),tmp=new THREE.Color();
  F.forEach((f,fi)=>{const pi=R.partOf[fi];tmp.copy(c0).lerp(c1,((pi*2654435761)>>>0)/4294967296);f.forEach((v,k)=>{pos.set(V[v],fi*9+k*3);base.set([tmp.r,tmp.g,tmp.b],fi*9+k*3);});});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(base.slice(),3));g.computeVertexNormals();
  const grp=new THREE.Group(),mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.45,roughness:.6,side:THREE.DoubleSide,flatShading:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));grp.add(mesh);
  // швы — тёмные линии, сгибы — синим пунктиром (как в 3D)
  const L=[],Lb=[];R.edges.forEach(e=>(e.p.length===2&&CUR.bentKey&&CUR.bentKey.has(bendKey(e.p[0],e.p[1]))?Lb:L).push(...V[e.a],...V[e.b]));
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(L,3));grp.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x15191b,transparent:true,opacity:.8})));
  if(Lb.length){const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(Lb,3));const ln=new THREE.LineSegments(bg,new THREE.LineDashedMaterial({color:0x2a6fd0,dashSize:4,gapSize:3}));ln.computeLineDistances();grp.add(ln);}
  SHOT.sc.add(grp);Object.assign(SHOT,{key:M3,R,grp,mesh,base});return SHOT;}
// элемент отдельно: лицо — оранжевым, изнанка — серо-голубым, край (швы к соседям) — красным, сгибы — синим пунктиром; hl — свет от камеры, ms — сетки (для луча)
function pieceGroup(own){const {R}=CUR,{V,F}=CUR.M3,pos=[],L=[],Lb=[];F.forEach((f,fi)=>{if(own.has(R.partOf[fi]))f.forEach(v=>pos.push(...V[v]));});
  R.edges.forEach(e=>{const a=e.p.filter(p=>own.has(p)).length;if(!a)return;(a===2?Lb:L).push(...V[e.a],...V[e.b]);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  const grp=new THREE.Group(),m=c=>new THREE.MeshStandardMaterial({color:c,metalness:.1,roughness:.7,side:THREE.FrontSide,flatShading:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  // изнанка — те же треугольники в обратном обходе (BackSide на общей геометрии не рисовался)
  const rv=[];for(let i=0;i<pos.length;i+=9)rv.push(...pos.slice(i,i+3),...pos.slice(i+6,i+9),...pos.slice(i+3,i+6));const gb=new THREE.BufferGeometry();gb.setAttribute('position',new THREE.Float32BufferAttribute(rv,3));gb.computeVertexNormals();
  const ms=[new THREE.Mesh(g,m(0xe07a35)),new THREE.Mesh(gb,m(0x6f7f92))];grp.add(...ms);
  // свет от камеры (слева сверху от неё) — элемент одинаково освещён с любой стороны
  const hl=new THREE.DirectionalLight(0xffffff,.9);grp.add(hl,hl.target);
  const lg=new THREE.BufferGeometry(),G=[g,gb,lg];lg.setAttribute('position',new THREE.Float32BufferAttribute(L,3));grp.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xd01f1f})));
  if(Lb.length){const bg=new THREE.BufferGeometry();G.push(bg);bg.setAttribute('position',new THREE.Float32BufferAttribute(Lb,3));const ln=new THREE.LineSegments(bg,new THREE.LineDashedMaterial({color:0x1f5fd0,dashSize:4,gapSize:3}));ln.computeLineDistances();grp.add(ln);}
  return {grp,hl,ms,G};}
// снимаем только элемент: фигуру прячем, общий свет сцены приглушаем в dim раз (со светом от камеры иначе пересвечено); → вернуть как было
function shotBegin(S,P,W,H,dim=.55){S.grp.visible=false;S.sc.add(P.grp);const lt=S.sc.children.filter(o=>o.isLight);lt.forEach(o=>{o.userData.i=o.intensity;o.intensity*=dim;});
  S.r.setSize(W,H,false);S.cam.aspect=W/H;S.cam.updateProjectionMatrix();
  return ()=>{S.sc.remove(P.grp);S.grp.visible=true;lt.forEach(o=>{o.intensity=o.userData.i;});P.G.forEach(g=>g.dispose());};}
// камера: вид v (d — от точки c к глазу), расстояние dist; свет — от камеры
function shotCam(S,P,v,c,dist){const eye=V3.add(c,V3.mul(v.d,dist+5));P.hl.position.set(...V3.add(eye,V3.add(V3.mul(v.up,dist*.6),V3.mul(v.r,-dist*.4))));P.hl.target.position.set(...c);
  S.cam.position.set(...eye);S.cam.up.set(...v.up);S.cam.lookAt(...c);S.cam.updateMatrixWorld();return eye;}
// расстояние, чтобы точки vs заполнили кадр с полем ~10% (asp — ширина/высота)
const shotFit=(vs,c,v,asp)=>{const tv=Math.tan(17.5*Math.PI/180);let d=0;vs.forEach(q=>{const o=V3.sub(q,c),z=V3.dot(o,v.d);d=Math.max(d,Math.abs(V3.dot(o,v.r))/(tv*asp*.88)+z,Math.abs(V3.dot(o,v.up))/(tv*.88)+z);});return d;};
// только элемент, в 3D с 4 сторон. own — номера деталей элемента; asp — ширина/высота клетки. → [{url, txt}]; нет WebGL → null
function pieceShots(own,tw,asp){if(!ok||!CUR||!CUR.M3)return null;let S;try{S=shotScene();}catch(e){return null;}
  const {R}=CUR,{V}=CUR.M3,P=pieceGroup(own),W=820,done=shotBegin(S,P,W,Math.round(W/asp));
  // ракурсы: основной, слева и справа сверху, сзади (изнанка); почти с ребра — поворот поменьше
  const ps=R.parts.filter(p=>own.has(p.id)),vs=[...new Set(ps.flatMap(p=>p.full))].map(i=>V[i]),c=vs.reduce((s,q)=>V3.add(s,V3.mul(q,1/vs.length)),[0,0,0]);
  const v0=stepView(ps),A=ps.reduce((s,p)=>s+p.area,0)||1,sc=v=>ps.reduce((s,p)=>s+p.area*Math.abs(V3.dot(p.n,v.d)),0)/A;
  const vw=[[0,0],[65,25],[-65,25],[180,0]].map(([t,u])=>{for(const k of [1,.6,.35]){const v=viewTilt(viewTurn(v0,t*k),u);if(sc(v)>.4||t===0)return v;}return viewTilt(viewTurn(v0,t*.35),u);});
  // элемент длинной стороной вдоль клетки (камеру можно повернуть на 90°)
  const out=vw.map((v0,i)=>{const v1={...v0,r:v0.up,up:V3.mul(v0.r,-1)},v=shotFit(vs,c,v1,asp)<shotFit(vs,c,v0,asp)?v1:v0;shotCam(S,P,v,c,shotFit(vs,c,v,asp));S.r.render(S.sc,S.cam);
    return {url:S.r.domElement.toDataURL('image/jpeg',.9),txt:i===3?'сзади — изнанка':'вид '+v.txt};});
  done();return out;}
/* снимок сгиба l элемента own — крупно; сцена — bendScene (bend3d.js, та же, что в окне «крутить сгиб»), ракурс — bendView; кадр — уголок и грани рядом (до ~10 см от него).
   → {url, labs: [{x, y, t, k}] — подписи в долях кадра (k: no — номер детали, bend — номер сгиба, tpl — уголок), hit — уголок не встаёт, how}; нет WebGL → null */
function bendShot(own,l,asp){if(!ok||!CUR||!CUR.M3||!CUR.BP)return null;let S;try{S=shotScene();}catch(e){return null;}
  const B=bendScene(own,l);if(!B)return null;const W=1600,done=shotBegin(S,B.P,W,Math.round(W/asp)),best=bendView(B,asp);
  const eye=shotCam(S,B.P,best.v,best.c,best.dist);S.r.render(S.sc,S.cam);const url=S.r.domElement.toDataURL('image/jpeg',.9);
  // подписи: номера деталей — видимые, в кадре и не ребром к нам; номер сгиба у линии и уголок — всегда
  const prj=q=>{const p=new THREE.Vector3(...q).project(S.cam);return [(p.x+1)/2,(1-p.y)/2];},inF=f=>f[0]>.05&&f[0]<.95&&f[1]>.06&&f[1]<.94,labs=[];
  B.labs.forEach(o=>{const f=prj(o.q);if(o.k==='no'){const dv=V3.norm(V3.sub(eye,o.q));if(!inF(f)||Math.abs(V3.dot(o.n,dv))<=.2||B.hitAt(eye,V3.add(o.q,dv)))return;}labs.push({x:f[0],y:f[1],t:o.t,k:o.k});});
  done();return {url,labs,hit:B.hit,how:B.how};}
/* ---------- шаг сборки снимком: собранное к шагу (done), новый элемент — оранжевым, остальное — светло-серым; не собранное не показываем ---------- */
// mine — детали нового элемента (оранжевый с обеих сторон — изнанка темнее: подложку видно сквозь прорезь изнанкой); сгибы — синим пунктиром, края — тёмными линиями
function stepGroup(done,mine,nbs){const {R}=CUR,{V,F}=CUR.M3,pos=[],cf=[],cb=[],L=[],Lb=[],Gh=[],Nb=[],O=new THREE.Color(0xe07a35),Ob=new THREE.Color(0xc0602a),G0=new THREE.Color(0xa9b0b6),Gb=new THREE.Color(0x868e96);
  F.forEach((f,fi)=>{const pi=R.partOf[fi];if(!done.has(pi))return;const m=mine.has(pi),a=m?O:G0,b=m?Ob:Gb;f.forEach(v=>{pos.push(...V[v]);cf.push(a.r,a.g,a.b);cb.push(b.r,b.g,b.b);});});
  // подложки за прорезями — не в сетке фигуры: контур прорези, утопленный внутрь на BACK_DEPTH
  R.parts.forEach(p=>{if(!p.back||!done.has(p.id))return;const m=mine.has(p.id),a=m?O:G0,b=m?Ob:Gb,Q=backPts(p);earClip(Q,Q.map((_,i)=>i)).forEach(t=>t.forEach(i=>{pos.push(...Q[i]);cf.push(a.r,a.g,a.b);cb.push(b.r,b.g,b.b);}));Q.forEach((q,i)=>L.push(...q,...Q[(i+1)%Q.length]));});
  // призрак — края несобранных деталей тонкими светлыми линиями (где элемент на фигуре); Nb — контур соседей, к кому варить, сквозь металл пунктиром
  R.edges.forEach(e=>{if(nbs&&e.p.some(p=>nbs.has(p)))Nb.push(...V[e.a],...V[e.b]);if(!e.p.some(p=>done.has(p))){Gh.push(...V[e.a],...V[e.b]);return;}(e.p.length===2&&e.p.every(p=>done.has(p))&&CUR.bentKey&&CUR.bentKey.has(bendKey(e.p[0],e.p[1]))?Lb:L).push(...V[e.a],...V[e.b]);});
  const mk=(P,C)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.computeVertexNormals();return g;};
  const rv=[],rc=[];for(let i=0;i<pos.length;i+=9){rv.push(...pos.slice(i,i+3),...pos.slice(i+6,i+9),...pos.slice(i+3,i+6));rc.push(...cb.slice(i,i+9));}
  const g=mk(pos,cf),gb=mk(rv,rc),m=()=>new THREE.MeshStandardMaterial({vertexColors:true,metalness:.1,roughness:.7,side:THREE.FrontSide,flatShading:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const grp=new THREE.Group(),ms=[new THREE.Mesh(g,m()),new THREE.Mesh(gb,m())],hl=new THREE.DirectionalLight(0xffffff,.75);grp.add(...ms,hl,hl.target,new THREE.AmbientLight(0xffffff,.5));   // свет ровный: рассеянный + от камеры (общий свет сцены выключен) — ни белых, ни чёрных граней
  const lg=new THREE.BufferGeometry(),G=[g,gb,lg];lg.setAttribute('position',new THREE.Float32BufferAttribute(L,3));grp.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x2b2f33,transparent:true,opacity:.75})));
  if(Lb.length){const bg=new THREE.BufferGeometry();G.push(bg);bg.setAttribute('position',new THREE.Float32BufferAttribute(Lb,3));const ln=new THREE.LineSegments(bg,new THREE.LineDashedMaterial({color:0x1f5fd0,dashSize:4,gapSize:3}));ln.computeLineDistances();grp.add(ln);}
  const seg=(P,mt)=>{const g=new THREE.BufferGeometry();G.push(g);g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));const l=new THREE.LineSegments(g,mt);if(mt.isLineDashedMaterial)l.computeLineDistances();grp.add(l);return l;};
  // невидимая поверхность несобранного (только глубина, рисуется после металла) — у призрака видны только ближние рёбра, как на рисунке
  const gp=[];F.forEach((f,fi)=>{if(!done.has(R.partOf[fi]))f.forEach(v=>gp.push(...V[v]));});if(gp.length){const gg=new THREE.BufferGeometry();G.push(gg);gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));
    const gm=new THREE.Mesh(gg,new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));gm.renderOrder=1;grp.add(gm);}
  if(Gh.length)seg(Gh,new THREE.LineBasicMaterial({color:0x8d969e,transparent:true,opacity:.6})).renderOrder=2;
  if(Nb.length)seg(Nb,new THREE.LineDashedMaterial({color:0x3a4046,dashSize:3,gapSize:2,depthTest:false,transparent:true,opacity:.7})).renderOrder=3;
  return {grp,hl,ms,G};}
const backPts=p=>p.full.map(i=>V3.sub(CUR.M3.V[i],V3.mul(p.n,BACK_DEPTH))),partC=p=>p.back?V3.sub(p.c,V3.mul(p.n,BACK_DEPTH)):partLabelPt(p,CUR.M3);
/* st — шаг (asmSteps), asp — ширина/высота клетки. Металлом — stepShown (другая половина фигуры — призраком). Вид — со стороны элемента (stepView); заслоняет — пробуем повернуть/наклонить.
   Кадр — элемент целиком и соседи, к кому варить, рядом с ним (не меньше 150 мм и 2,5 размера элемента). Швы шага — толстые красные.
   → {url, txt — откуда смотрим, labs: [{x, y, t, k: 'new' | 'nb'}] — номера в долях кадра, только видимые и не ребром}; нет WebGL → null */
function stepShot(st,asp){if(!ok||!CUR||!CUR.M3)return null;let S;try{S=shotScene();}catch(e){return null;}
  const {R}=CUR,{V}=CUR.M3,x=st.u[0],W=st.w[0],mine=new Set(x.ps.map(p=>p.id)),nbs=[...new Set(W.map(q=>q.nb))].map(i=>R.parts[i]);
  const P=stepGroup(stepShown(st),mine,new Set(nbs.map(p=>p.id))),Wd=1600,done=shotBegin(S,P,Wd,Math.round(Wd/asp),0);
  const ev=x.ps.flatMap(p=>p.back?backPts(p):p.full.map(i=>V[i])),c0=ev.reduce((s,q)=>V3.add(s,V3.mul(q,1/ev.length)),[0,0,0]),er=Math.max(...ev.map(q=>V3.len(V3.sub(q,c0)))),lim=er+Math.max(60,er*.6);
  const sm=W.flatMap(q=>q.ed).map(([a,b])=>V3.mul(V3.add(V[a],V[b]),.5)),vs=ev.concat(nbs.flatMap(p=>p.full.map(i=>V[i])).filter(q=>V3.len(V3.sub(q,c0))<=lim));
  const eyeHit=(eye,q)=>{const dv=V3.sub(q,eye),dl=V3.len(dv);S.ray.set(new THREE.Vector3(...eye),new THREE.Vector3(...V3.mul(dv,1/dl)));const h=S.ray.intersectObjects(P.ms);return h.length&&h[0].distance<dl-Math.max(1.5,dl*.006);};
  // соседи у шва: точки на их гранях рядом со швом (сюда же — номера), вес — длина шва
  const nq=nbs.map(p=>{const ed=W.filter(q=>q.nb===p.id).flatMap(q=>q.ed);return {p,len:ed.reduce((s,[a,b])=>s+V3.len(V3.sub(V[b],V[a])),0),qs:ed.map(([a,b])=>{const m=V3.mul(V3.add(V[a],V[b]),.5),d=V3.sub(partC(p),m),l=V3.len(d);return V3.add(m,V3.mul(d,Math.min(.5,Math.max(8,er*.25)/(l||1))));})};});
  const probe=x.ps.map(partC).concat(sm,nq.flatMap(o=>o.qs)).slice(0,32),A=x.ps.reduce((s,p)=>s+p.area,0)||1,NL=nq.reduce((s,o)=>s+o.len,0);
  const face=v=>{const e=x.ps.reduce((s,p)=>s+p.area*Math.max(0,V3.dot(p.n,v.d)),0)/A;return NL?(e+nq.reduce((s,o)=>s+o.len*Math.max(0,V3.dot(o.p.n,v.d)),0)/NL)/2:e;};
  // кадр под вид v: рамка по точкам vs в плоскости вида, не меньше 150 мм и 2,5 размера элемента — вокруг видно фигуру призраком (где элемент)
  const frame=v=>{const xs=vs.map(q=>V3.dot(V3.sub(q,c0),v.r)),ys=vs.map(q=>V3.dot(V3.sub(q,c0),v.up)),m0=Math.max(75,er*1.25),x0=Math.min(-m0,Math.min(...xs)),x1=Math.max(m0,Math.max(...xs)),y0=Math.min(-m0,Math.min(...ys)),y1=Math.max(m0,Math.max(...ys));
    const c=V3.add(c0,V3.add(V3.mul(v.r,(x0+x1)/2),V3.mul(v.up,(y0+y1)/2))),box=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(([a,b])=>V3.add(c0,V3.add(V3.mul(v.r,a),V3.mul(v.up,b))));return {c,dist:shotFit(vs.concat(box),c,v,asp)};};
  // ракурс: между элементом и соседями (острый шов — иначе соседи за элементом), потом — со стороны элемента, повороты
  const nE=V3.norm(x.ps.reduce((s,p)=>V3.add(s,V3.mul(p.n,p.area)),[0,0,0])),nN=NL?V3.norm(nq.reduce((s,o)=>V3.add(s,V3.mul(o.p.n,o.len)),[0,0,0])):nE,vb=stepView([{n:V3.norm(V3.add(nE,nN)),area:1}]),v0=stepView(x.ps),cand=[vb,v0,viewTurn(vb,30),viewTurn(vb,-30),viewTilt(vb,25),viewTurn(v0,30),viewTurn(v0,-30),viewTilt(v0,25),viewTilt(v0,-20),viewTurn(v0,55),viewTurn(v0,-55)];let best=null;
  for(const v of cand){const f=frame(v),eye=V3.add(f.c,V3.mul(v.d,f.dist+5)),vis=probe.filter(q=>!eyeHit(eye,q)).length/probe.length,sc=vis+.4*face(v)+(v===vb?.05:0);
    if(!best||sc>best.sc)best={v,...f,sc};if(vis===1&&face(v)>.45)break;}
  // швы шага — трубки (линии WebGL — в 1 пиксель); толщина — ≈ 4 px снимка
  const v=best.v,rr=Math.max(.6,best.dist*Math.tan(17.5*Math.PI/180)*2/(Wd/asp)*2.2),red=new THREE.MeshBasicMaterial({color:0xd01f1f});
  W.flatMap(q=>q.ed).forEach(([a,b])=>{const A2=V[a],B2=V[b],l=V3.len(V3.sub(B2,A2));if(l<.5)return;const cg=new THREE.CylinderGeometry(rr,rr,l,8),cy=new THREE.Mesh(cg,red);P.G.push(cg);
    cy.position.set(...V3.mul(V3.add(A2,B2),.5));cy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...V3.norm(V3.sub(B2,A2))));P.grp.add(cy);});
  const eye=shotCam(S,P,v,best.c,best.dist);P.hl.position.set(...V3.add(eye,V3.add(V3.mul(v.up,best.dist*.2),V3.mul(v.r,-best.dist*.12))));   // свет почти от глаза — видимая грань не тёмная
  S.r.render(S.sc,S.cam);const url=S.r.domElement.toDataURL('image/jpeg',.9);
  // номера: у нового элемента — в самом просторном месте грани (partLabelPt), у соседа — рядом со швом на его грани; видимые, в кадре, не ребром
  const prj=q=>{const p=new THREE.Vector3(...q).project(S.cam);return [(p.x+1)/2,(1-p.y)/2];},inF=f=>f[0]>.03&&f[0]<.97&&f[1]>.05&&f[1]<.95,labs=[];
  const put=(p,qs,k)=>{for(const q of qs){const dv=V3.norm(V3.sub(eye,q)),f=prj(q);if(inF(f)&&Math.abs(V3.dot(p.n,dv))>.2&&!eyeHit(eye,V3.add(q,dv))){labs.push({x:f[0],y:f[1],t:String(p.no),k});return;}}};
  x.ps.forEach(p=>put(p,[partC(p),...W.filter(q=>q.ed.length).map(q=>V3.mul(V3.add(partC(p),V3.mul(V3.add(V[q.ed[0][0]],V[q.ed[0][1]]),.5)),.5))],'new'));
  nq.forEach(o=>put(o.p,o.qs.concat([partC(o.p)]),'nb'));
  done();return {url,txt:v.txt,labs};}
