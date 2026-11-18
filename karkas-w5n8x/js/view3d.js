/* ---------- 3D: трубы с настоящими скосами и подрезкой, узлы, выделение ---------- */
const stage=document.getElementById('stage');
let renderer,scene,camera,controls,labels,group,dimGroup,ok=true,camAnim=null,need=3;
function req3D(){need=Math.max(need,3);}
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.appendChild(renderer.domElement);}catch(e){ok=false;}
const MAT={};
if(ok){scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(35,1,10,60000);camera.position.set(2600,2200,3200);
  labels=new THREE.CSS2DRenderer();labels.domElement.style.cssText='position:absolute;inset:0;pointer-events:none';stage.appendChild(labels.domElement);
  controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(300,400,300);
  scene.add(new THREE.HemisphereLight(0xf2f4f5,0xb9b4ae,.9));
  const d=new THREE.DirectionalLight(0xffffff,.9);d.position.set(1500,3000,2200);scene.add(d);
  const d2=new THREE.DirectionalLight(0xbfd0e0,.4);d2.position.set(-2000,900,-1500);scene.add(d2);
  const std=(c,x={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,metalness:.5,roughness:.55,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1},x));
  MAT.steel=std(0x59616a);MAT.wood=std(0x9a7650,{metalness:.05,roughness:.85});   // брус — цвет дерева
  MAT.sel=std(0xd0561f);MAT.dim=std(0x59616a,{transparent:true,opacity:.18,depthWrite:false});
  MAT.weld=new THREE.MeshBasicMaterial({color:0xe08a1f,depthTest:false,transparent:true,opacity:.95});MAT.clash=new THREE.MeshBasicMaterial({color:0xd01f1f,depthTest:false,transparent:true});
  MAT.edge=new THREE.LineBasicMaterial({color:0x1b2124,transparent:true,opacity:.55});
  MAT.node=new THREE.MeshBasicMaterial({color:0x1f8fe0,depthTest:false,transparent:true,opacity:.9});MAT.handle=new THREE.MeshBasicMaterial({color:0xd0561f,depthTest:false,transparent:true});MAT.handle2=new THREE.MeshBasicMaterial({color:0x7d878c,depthTest:false,transparent:true,opacity:.85});MAT.add=new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true});MAT.addBg=new THREE.MeshBasicMaterial({color:0x1e9e5a,depthTest:false,transparent:true,side:THREE.DoubleSide});MAT.nodeSel=new THREE.MeshBasicMaterial({color:0xd0561f,depthTest:false,transparent:true});
  group=new THREE.Group();scene.add(group);dimGroup=new THREE.Group();scene.add(dimGroup);
  const grid=new THREE.GridHelper(20000,200,0xb9c0bd,0xd5dad7);grid.material.transparent=true;grid.material.opacity=.5;scene.add(grid);}
// тело трубы: 4 угла сечения на каждом конце, каждый — пересечение ребра с плоскостью реза
function memberGeo(c){const {A,B}=memberCorners(c),pts=[...A,...B],idx=[];
  for(let i=0;i<4;i++){const j=(i+1)%4;idx.push(i,j,4+j,i,4+j,4+i);}
  idx.push(0,2,1,0,3,2,4,5,6,4,6,7);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts.flat(),3));g.setIndex(idx);g.computeVertexNormals();return g;}
let SHOW_WELD=true,ONLY_GRP=null,DRAG=null,GROW=null;
function build3D(){if(!ok)return;req3D();
  [group,dimGroup].forEach(G=>{G.traverse(o=>{if(o.element&&o.element.parentNode)o.element.parentNode.removeChild(o.element);});G.clear();});
  const cuts=memberCuts();
  cuts.forEach(c=>{const dimmed=ONLY_GRP!==null&&(c.m.grp||'')!==ONLY_GRP,sel=SEL.m.has(c.m.id);
    const g=memberGeo(c),mesh=new THREE.Mesh(g,sel?MAT.sel:dimmed?MAT.dim:prof(c.m.prof).wood?MAT.wood:MAT.steel);mesh.userData.member=c.m.id;group.add(mesh);
    if(!dimmed){const e=new THREE.LineSegments(new THREE.EdgesGeometry(g,20),MAT.edge);e.userData.member=c.m.id;group.add(e);}});
  const R=Math.max(25,Math.min(120,sceneSize()*.024));   // размер стрелок — от размера каркаса
  // одиночные узлы (без труб — например, первый узел нового каркаса)
  M.nodes.filter(n=>!M.members.some(m=>m.a===n.id||m.b===n.id)).forEach(n=>{const s=new THREE.Mesh(new THREE.SphereGeometry(R*.7,14,10),SEL.n.has(n.id)?MAT.nodeSel:MAT.node);s.position.set(n.x,n.y,n.z);s.userData.node=n.id;s.renderOrder=12;group.add(s);});
  // выбран одиночный узел — зелёный «+» рядом: тянуть — первая труба из него
  if(!SEL.m.size){const n=M.nodes.find(q=>SEL.n.has(q.id)&&!M.members.some(m=>m.a===q.id||m.b===q.id));if(n){const pl=new THREE.Group(),bar=(x,y)=>pl.add(new THREE.Mesh(new THREE.BoxGeometry(x,y,R*.25),MAT.add));
    pl.add(new THREE.Mesh(new THREE.CircleGeometry(R*.75,24),MAT.addBg));bar(R*.95,R*.24);bar(R*.24,R*.95);pl.children.forEach(o=>o.renderOrder=14);
    pl.position.set(n.x+R*1.8,n.y+R*1.2,n.z);pl.quaternion.copy(camera.quaternion);pl.userData.grow={member:null,end:null,node:n.id};group.add(pl);}}
  // ручки-стрелки на концах выбранных труб: активный конец — оранжевая, второй — серая; тянуть — удлинить с этой стороны
  cuts.filter(c=>SEL.m.has(c.m.id)).forEach(c=>{const f=frame(c.m);[['a',c.ea,V3.mul(f.d,-1),f.A],['b',c.eb,f.d,f.B]].forEach(([k,e,out,N])=>{
    const act=activeEnd(c.m.id)===k,g=new THREE.ConeGeometry(R*(act?.75:.55),R*(act?2:1.4),16);g.translate(0,R*(act?1:.7),0);
    const h=new THREE.Mesh(g,act?MAT.handle:MAT.handle2);h.position.set(...V3.add(N,V3.mul(out,Math.max(0,e.ext)+R*.3)));
    h.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...out));h.userData.handle={member:c.m.id,end:k};h.userData.out=out;h.userData.len=R*(act?2:1.4);h.renderOrder=13;group.add(h);
    // зелёный «+» у активного конца: тянуть — из этого конца вырастает новая труба
    if(act&&SEL.m.size===1){const pl=new THREE.Group(),bar=(x,y)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(x,y,R*.25),MAT.add);pl.add(b);};
      const disc=new THREE.Mesh(new THREE.CircleGeometry(R*.75,24),MAT.addBg);pl.add(disc);bar(R*.95,R*.24);bar(R*.24,R*.95);pl.children.forEach(o=>o.renderOrder=14);
      const side=V3.norm(V3.cross(out,Math.abs(out[1])>.9?[1,0,0]:[0,1,0]));pl.position.set(...V3.add(N,V3.mul(side,R*1.8)));pl.quaternion.copy(camera.quaternion);
      pl.userData.grow={member:c.m.id,end:k,node:c.m[k]};group.add(pl);}});});
  if(SHOW_WELD){const cs=contacts(),r=Math.max(10,Math.min(35,sceneSize()*.007));
    cs.forEach(c=>{const clash=c.type==='clash',g=new THREE.TorusGeometry(r,r*.28,8,20),mk=new THREE.Mesh(g,clash?MAT.clash:MAT.weld);mk.position.set(...c.p);
      if(c.n){const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...c.n));mk.quaternion.copy(q);}mk.renderOrder=11;mk.userData.weld=1;group.add(mk);});}
  dims3D();}
const sceneSize=()=>{const bb=bbox();return Math.max(400,bb.max[0]-bb.min[0],bb.max[1]-bb.min[1],bb.max[2]-bb.min[2]);};
function flyTo(p,t){req3D();camAnim={p0:camera.position.clone(),t0:controls.target.clone(),p1:p,t1:t,s:performance.now()};}
function fitAll(instant){if(!ok)return;const bb=bbox(),c=new THREE.Vector3((bb.min[0]+bb.max[0])/2,(bb.min[1]+bb.max[1])/2,(bb.min[2]+bb.max[2])/2);
  const r=Math.max(300,new THREE.Vector3(bb.max[0]-bb.min[0],bb.max[1]-bb.min[1],bb.max[2]-bb.min[2]).length()/2);
  const vf=camera.fov*Math.PI/360,hf=Math.atan(Math.tan(vf)*camera.aspect),dist=r/Math.sin(Math.min(vf,hf))*1.05;
  let dir=camera.position.clone().sub(controls.target).normalize();if(!isFinite(dir.x))dir=new THREE.Vector3(.55,.45,.7).normalize();
  const p=c.clone().add(dir.multiplyScalar(dist));if(instant){camera.position.copy(p);controls.target.copy(c);}else flyTo(p,c);}
// что под курсором: труба или узел
function pickAt(ev){if(!ok)return null;const r=renderer.domElement.getBoundingClientRect();
  const m=new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,camera);rc.params.Line.threshold=4;
  // зелёный «+» — новая труба из конца
  {const g=group.children.find(o=>o.userData.grow);if(g){const q=g.position.clone().project(camera),d=Math.hypot((q.x+1)/2*r.width-(ev.clientX-r.left),(1-q.y)/2*r.height-(ev.clientY-r.top));if(q.z<=1&&d<22)return {grow:g.userData.grow};}}
  // стрелка на конце выбранной трубы — если курсор ближе 18 px к её основанию или острию
  {let best=null,bd=18;group.children.filter(o=>o.userData.handle).forEach(o=>{[0,o.userData.len||0].forEach(t=>{const q=o.position.clone().add(new THREE.Vector3(...o.userData.out).multiplyScalar(t)).project(camera);if(q.z>1)return;
    const d=Math.hypot((q.x+1)/2*r.width-(ev.clientX-r.left),(1-q.y)/2*r.height-(ev.clientY-r.top));if(d<bd){bd=d;best=o.userData.handle;}});});if(best)return {handle:best};}
  {let best=null,bd=14;M.nodes.filter(n=>!M.members.some(m=>m.a===n.id||m.b===n.id)).forEach(n=>{const p=new THREE.Vector3(n.x,n.y,n.z).project(camera);if(p.z>1)return;
    const sx=(p.x+1)/2*r.width,sy=(1-p.y)/2*r.height,d=Math.hypot(sx-(ev.clientX-r.left),sy-(ev.clientY-r.top));if(d<bd){bd=d;best=n.id;}});if(best)return {node:best};}
  const hits=rc.intersectObjects(group.children,false).filter(h=>h.object.isMesh);
  const mb=hits.find(h=>h.object.userData.member);return mb?{member:mb.object.userData.member,point:mb.point}:null;}
function sizeStage(){if(!ok)return;req3D();const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);labels.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
if(ok){new ResizeObserver(sizeStage).observe(stage);sizeStage();
  (function loop(){requestAnimationFrame(loop);if(camAnim){const k=Math.min(1,(performance.now()-camAnim.s)/600),e=k<.5?2*k*k:1-(-2*k+2)**2/2;camera.position.lerpVectors(camAnim.p0,camAnim.p1,e);controls.target.lerpVectors(camAnim.t0,camAnim.t1,e);if(k>=1)camAnim=null;}
    controls.update();if(!camAnim&&need<=0)return;need--;group.children.forEach(o=>{if(o.userData.grow)o.quaternion.copy(camera.quaternion);});renderer.render(scene,camera);labels.render(scene,camera);})();
  // рисуем только когда что-то изменилось: камера, правка, курсор, клавиши
  controls.addEventListener("change",req3D);["pointermove","pointerdown","pointerup","wheel","keydown","input","change","click"].forEach(e=>addEventListener(e,req3D,{passive:true,capture:true}));}
// виды: спереди / сбоку / сверху / изометрия
function viewDir(k){if(!ok)return;const D={front:[0,0,1],side:[1,0,0],top:[0,1,.0001],iso:[.55,.45,.7]}[k];camera.position.copy(controls.target.clone().add(new THREE.Vector3(...D).normalize().multiplyScalar(camera.position.distanceTo(controls.target))));fitAll();}
