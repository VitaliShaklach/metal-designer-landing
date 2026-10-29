/* ---------- 3D ---------- */
const stage=document.getElementById('stage');
let renderer,scene,camera,controls,group,labels,ok=true,camAnim=null;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.appendChild(renderer.domElement);}
catch(e){ok=false;}   // сообщение — в заглушке загрузки (ui.js)
const M={};
if(ok){
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(35,1,1,3000);
  camera.position.set(120,210,260);
  labels=new THREE.CSS2DRenderer();labels.domElement.style.cssText='position:absolute;inset:0;pointer-events:none';stage.appendChild(labels.domElement);
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.target.set(18,72,19.5);controls.maxPolarAngle=Math.PI;   // можно смотреть снизу
  scene.add(new THREE.HemisphereLight(0xf2f4f5,0xb9b4ae,0.9));
  const up=new THREE.DirectionalLight(0xffffff,0.75);up.position.set(40,-250,60);scene.add(up);   // подсветка снизу
  const d=new THREE.DirectionalLight(0xffffff,0.9);d.position.set(120,260,200);scene.add(d);
  const d2=new THREE.DirectionalLight(0xbfd0e0,0.35);d2.position.set(-180,90,-120);scene.add(d2);
  const std=(c,m=.5,r=.6,x={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,metalness:m,roughness:r,side:THREE.DoubleSide},x));
  M.steel=std(0x454c52,.55,.55); M.prop=std(0xb8703f,.35,.6); M.plate=std(0x2e3338);
  M.rubber=std(0x1a1a1a,0,.9); M.zinc=std(0xe2e6e9,.75,.3); M.wood=std(0x8a5a33,0,.7); M.skewer=std(0xc9ced2,.85,.3);
  M.meat=std(0x7b3a22,0,.8); M.bar=std(0x6b5a4c,.6,.5); M.bark=std(0x5a3d26,0,.95); M.endg=std(0xc49a6c,0,.9);
  {const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,64,64);g.fillStyle='#000';g.beginPath();g.arc(32,32,15,0,7);g.fill();
   const tx=new THREE.CanvasTexture(c);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(CG_L/2,CG_W/2);   // перфорация: отверстие на каждые 2 см — только рисунок
   M.perf=std(0x6b5a4c,.6,.5,{alphaMap:tx,alphaTest:.5});}
  M.sheet=std(0x9aa3a8,.6,.4,{transparent:true,opacity:.5,depthWrite:false});
  const gnd=new THREE.Mesh(new THREE.CircleGeometry(2000,96),new THREE.MeshStandardMaterial({color:0x8d948f,roughness:1,transparent:true,opacity:.28}));
  gnd.rotation.x=-Math.PI/2;gnd.position.set(20,0,19.5);scene.add(gnd);
}
function box(w,h,d,x,y,z,m){const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);me.position.set(x+w/2,y+h/2,z+d/2);group.add(me);return me;}
function cyl(r,len,axis,x,y,z,m,seg=24){const me=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,seg),m);
  if(axis==='x')me.rotation.z=Math.PI/2;if(axis==='z')me.rotation.x=Math.PI/2;me.position.set(x,y,z);group.add(me);return me;}
function ext(shape,m,depth=t){return new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24}),m);}
function ringShape(ro,ri){const s=new THREE.Shape();s.absarc(0,0,ro,0,Math.PI*2,false);if(ri){const p=new THREE.Path();p.absarc(0,0,ri,0,Math.PI*2,true);s.holes.push(p);}return s;}
// боковина жаровни: 80 × 12,5, сверху прорези, отверстия поддува; в задней — вырез под ручку решётки
// контур боковины жаровни (тот же — для 3D и для DXF)
function grillWallShape(back){
  const h=H1-t,s=new THREE.Shape(),deep=S.deep?DEEP_X:[];s.moveTo(0,0);s.lineTo(L1,0);s.lineTo(L1,h);
  const nt=[...slots().filter(x=>!deep.some(d=>Math.abs(d-x)<DEEP_W)&&!DIV_POS.some(p=>Math.abs(L1-p-x)<.9)&&!(back&&Math.abs(x-GN_X)<GN_W/2+.5)).map(x=>[x,0]),...deep.map(x=>[x,1]),...(back?[[GN_X,2]]:[]),...DIV_POS.map(p=>[L1-p,3])].sort((a,b)=>b[0]-a[0]);
  nt.forEach(([x,dp])=>{if(dp===3){s.lineTo(x+DIV_SW/2,h);s.lineTo(x+DIV_SW/2,h-DIV_SD);s.lineTo(x-DIV_SW/2,h-DIV_SD);s.lineTo(x-DIV_SW/2,h);}
    else if(dp===2){s.lineTo(x+GN_W/2,h);s.lineTo(x+GN_W/2,h-GN_D);s.lineTo(x-GN_W/2,h-GN_D);s.lineTo(x-GN_W/2,h);}
    else if(!dp){s.lineTo(x+SLOT_W/2,h);s.lineTo(x+SLOT_W/2,h-SLOT_D);s.lineTo(x-SLOT_W/2,h-SLOT_D);s.lineTo(x-SLOT_W/2,h);}
    else{const r=DEEP_W/2,q=DEEP_SW/2,y=h-DEEP_D;s.lineTo(x+r,h);s.lineTo(x+r,y);s.lineTo(x+q,y);s.lineTo(x+q,y-DEEP_SD);s.lineTo(x-q,y-DEEP_SD);s.lineTo(x-q,y);s.lineTo(x-r,y);s.lineTo(x-r,h);}});
  s.lineTo(0,h);s.lineTo(0,0);
  holes().forEach(x=>{const p=new THREE.Path();p.absarc(x,HOLE_Y-t,HOLE/2,0,Math.PI*2,true);s.holes.push(p);});
  return s;}
function grillWall(z,back){const me=ext(grillWallShape(back),M.steel);me.position.set(0,B+t,z);group.add(me);}
// боковина печи: 60 × 49,5; в задней — отверстие под трубу
function stoveWallShape(back){
  const s=new THREE.Shape();s.moveTo(-L2,KB+t);s.lineTo(0,KB+t);s.lineTo(0,T);s.lineTo(-L2,T);s.lineTo(-L2,KB+t);
  if(back&&S.chim){const y=chY0(),p=new THREE.Path();
    p.moveTo(CH_X-CH/2,y);p.lineTo(CH_X-CH/2,y+CH);p.lineTo(CH_X+CH/2,y+CH);p.lineTo(CH_X+CH/2,y);p.lineTo(CH_X-CH/2,y);s.holes.push(p);}
  return s;}
function stoveWall(z,back){const me=ext(stoveWallShape(back),M.steel);me.position.set(0,0,z);group.add(me);}
// торец с вырезом-логотипом: стенка z0…z0+wz, y0…y0+h, толщина t вдоль x, x1 — её правая грань. Глаза — островки на перемычках, тег 'logo'
function logoWall(tag,z0,wz,y0,h,x1){const s=new THREE.Shape(),p=new THREE.Path(),site=logoSite();
  s.moveTo(z0,y0);s.lineTo(z0+wz,y0);s.lineTo(z0+wz,y0+h);s.lineTo(z0,y0+h);s.lineTo(z0,y0);
  LOGO_OUT.forEach(([x,v],i)=>{const [z,y]=logoZY(x,v,site);i?p.lineTo(z,y):p.moveTo(z,y);});s.holes.push(p);
  const me=ext(s,M.steel,t);me.rotation.y=-Math.PI/2;me.position.set(x1,0,0);group.add(me);
  tag('logo');LOGO_EYES.forEach(([x,v])=>{const [za,ya]=logoZY(x,v,site),[zb,yb]=logoZY(x+1,v+2,site),zc=(za+zb)/2;
    box(t,ya-yb,zb-za,x1-t,yb,za,M.steel);box(t,site.top-ya+.05,LOGO_BR,x1-t,ya,zc-LOGO_BR/2,M.steel);});}   // глаз + перемычка к верху выреза
// человек 184 см у мангала (для понимания высоты крыши): стоит спереди, лицом к мангалу, держит шампур над жаровней
function man3D(){const k=MAN_H/184,x=gOn()?40:PCX,z=MAN_Z,c=new THREE.Group();group.add(c);
  const skin=new THREE.MeshStandardMaterial({color:0xd9a27c,roughness:.8}),shirt=new THREE.MeshStandardMaterial({color:0x3f6e8c,roughness:.9}),
    pants=new THREE.MeshStandardMaterial({color:0x2b2f36,roughness:.9}),shoe=new THREE.MeshStandardMaterial({color:0x17191c,roughness:.9});
  const V3=(a,b,cc)=>new THREE.Vector3(x+a,b*k,z+cc);
  const limb=(a,b,r,m)=>{const d=b.clone().sub(a),me=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),12),m);me.position.copy(a.clone().add(b).multiplyScalar(.5));
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());c.add(me);const j=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),m);j.position.copy(b);c.add(j);};
  [-1,1].forEach(sd=>{limb(V3(sd*10,93,0),V3(sd*10,48,1),7,pants);limb(V3(sd*10,48,1),V3(sd*10,6,2),5.5,pants);   // ноги
    const f=new THREE.Mesh(new THREE.BoxGeometry(10,6,26),shoe);f.position.copy(V3(sd*10,3,-5));c.add(f);});
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(21,17,60*k,16),shirt);tr.scale.z=.6;tr.position.copy(V3(0,122,0));c.add(tr);   // корпус
  const nk=new THREE.Mesh(new THREE.CylinderGeometry(5.5,6,10*k,12),skin);nk.position.copy(V3(0,155,0));c.add(nk);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(11*k,20,14),skin);hd.scale.set(.85,1.12,1);hd.position.copy(V3(0,MAN_H/k-12.5,0));c.add(hd);   // голова, макушка 184
  // руки к шампуру над жаровней: плечо → локоть → кисть
  const hy=T+3,hz=W+4;[-1,1].forEach(sd=>{const sh=V3(sd*20,147,0),el=V3(sd*24,118,-14),hn=new THREE.Vector3(x+sd*12,hy,hz);
    limb(sh,el,4.6,shirt);limb(el,hn,3.8,skin);});
  const sk=new THREE.Mesh(new THREE.BoxGeometry(.3,1.1,W+24),M.skewer);sk.position.set(x,hy+.5,W/2+4);c.add(sk);}   // шампур в руках
// флаги S, которые временно включаются для выбранной детали
function forcedFlags(){const f={};if(!S.sel.part)return f;
  PARTS.forEach(e=>e.d.forEach(([id,,fl])=>{if(id===S.sel.part&&fl)Object.assign(f,fl);}));
  if(S.sel.part==='shib'&&S.sh==='out')f.sh='in';
  return f;}
function build3D(){
  if(!ok)return;
  if(group){group.traverse(o=>{if(o.element&&o.element.parentNode)o.element.parentNode.removeChild(o.element);});scene.remove(group);}
  group=new THREE.Group();scene.add(group);
  const f=forcedFlags(),saved={};for(const k in f){saved[k]=S[k];S[k]=f[k];}
  const marks=[];
  try{buildParts(id=>marks.push([group.children.length,id]));}finally{Object.assign(S,saved);}
  // каждой детали — её id; показываем только выбранное
  let mi=0,part=null;
  group.children.forEach((o,i)=>{while(mi<marks.length&&marks[mi][0]<=i){part=marks[mi][1];mi++;}if(!o.userData.dim)o.userData.part=part;});
  const sp=selParts();
  group.children.forEach(o=>{if(o.userData.dim)return;const p=o.userData.part;
    if(sp&&!sp.has(p))o.visible=false;
    if(S.parts&&!S.parts.has(PDF_PART[p]))o.visible=false;});
  if(typeof drawDxf==='function')drawDxf();   // таблица DXF зависит от тех же галочек
}
function buildParts(tag){
  // жаровня
  const g=gOn(),k=sOn();
  if(g){
  tag('gBot');box(L1,t,W,0,B,0,M.steel);
  tag('side0');grillWall(0,true);
  tag('side1');grillWall(W-t,false);
  tag('gEnd');box(t,H1-t,W-2*t,L1-t,B+t,t,M.steel);
  tag('gEnd0');if(S.mode==='grill'){if(S.logo)logoWall(tag,t,W-2*t,B+t,H1-t,t);else box(t,H1-t,W-2*t,0,B+t,t,M.steel);}   // левый торец — у отдельного мангала (вместе его роль играет перегородка печи)
  tag('gGrate');
  if(S.grillGrate){const y=B+t+GA_H,z0=t+.5,rd=.4;
    [[GRL_X0,GRL_X0+GRL_L]].forEach(([a,b])=>{cyl(rd,GRL_L,'x',(a+b)/2,y+rd,z0,M.skewer,8);cyl(rd,GRL_L,'x',(a+b)/2,y+rd,z0+GRL_W,M.skewer,8);});
    [GRL_X0,GRL_X0+GRL_L].forEach(x=>cyl(rd,GRL_W,'z',x,y+rd,z0+GRL_W/2,M.skewer,8));
    for(let x=GRL_X0+2;x<GRL_X0+GRL_L-.5;x+=2)cyl(.2,GRL_W,'z',x,y+rd*2+.2,z0+GRL_W/2,M.skewer,6);
    const hy=B+H1-GN_D+rd;cyl(rd,z0+12,'z',GN_X,hy,(z0-12)/2,M.skewer,8);   // ручка через вырез
    cyl(1.2,6,'z',GN_X,hy,-9,M.wood,12);}
  tag('g2');
  if(S.grates2)[0,G2_L].forEach(x0=>{const y=T,z0=W/2-G2_W/2,rd=.4;
    [z0,z0+G2_W].forEach(z=>cyl(rd,G2_L-.4,'x',x0+G2_L/2,y+rd,z,M.skewer,8));
    [x0+.2,x0+G2_L-.2].forEach(x=>cyl(rd,G2_W,'z',x,y+rd,W/2,M.skewer,8));
    for(let x=x0+2;x<x0+G2_L-.5;x+=2)cyl(.2,G2_W,'z',x,y+rd*2+.2,W/2,M.skewer,6);
    cyl(rd,12,'z',x0+G2_L/2,y+rd,z0+G2_W+6,M.skewer,8);cyl(1.2,6,'z',x0+G2_L/2,y+rd,z0+G2_W+10,M.wood,12);});
  tag('air');
  if(S.airSl)[[-AIR_GAP-AIR_T,-1],[W+AIR_GAP,1]].forEach(([z,sd])=>{const dx=airOff(),y0=B+HOLE_Y-AIR_H/2,s=new THREE.Shape();
    s.moveTo(AIR_X0+dx,y0);s.lineTo(AIR_X0+dx+AIR_L,y0);s.lineTo(AIR_X0+dx+AIR_L,y0+AIR_H);s.lineTo(AIR_X0+dx,y0+AIR_H);s.lineTo(AIR_X0+dx,y0);
    holes().filter(x=>x-HOLE/2>AIR_X0+.2&&x+HOLE/2<AIR_X0+AIR_L-.2).forEach(x=>{const p=new THREE.Path();p.absarc(x+dx,B+HOLE_Y,HOLE/2,0,Math.PI*2,true);s.holes.push(p);});   // только отверстия, которые помещаются в планку
    const m=ext(s,M.prop,AIR_T);m.position.z=z;group.add(m);
    [AIR_X0+dx,AIR_X0+dx+AIR_L-.3].forEach(xe=>box(.3,AIR_H,AIR_TH,xe,y0,sd<0?z-AIR_TH:z+AIR_T,M.prop));   // ручки — концы полосы загнуты наружу
  });
  tag('hook');   // скобы задвижек: полоса Г-образно — лапка к стенке под планкой, полка под планкой, загиб вверх перед планкой
  if(S.hook)[-1,1].forEach(sd=>{const yb=B+HOLE_Y-AIR_H/2;AIR_HOOK.forEach(xh=>{const x0=xh-BR_W/2,zw=sd<0?-BR_T:W,zs=sd<0?-(BR_IN+BR_T):W,zf=sd<0?-(BR_IN+BR_T):W+BR_IN;
      box(BR_W,BR_LEG,BR_T,x0,yb-BR_T-BR_LEG,zw,M.steel);   // лапка — приварить к стенке
      box(BR_W,BR_T,BR_IN+BR_T,x0,yb-BR_T,zs,M.steel);      // полка — на ней стоит планка
      box(BR_W,BR_UP,BR_T,x0,yb,zf,M.steel);});});          // загиб вверх перед планкой
  tag('div');
  if(S.div){const x0=divX()-DIV_T/2,yb=divY0(),z0=0,z1=W,zi=DIV_IN,s=new THREE.Shape();   // перегородка: тело между боковинами, «ушки» в прорезях сверху
    s.moveTo(zi,yb);s.lineTo(z1-zi,yb);s.lineTo(z1-zi,T-DIV_SD);s.lineTo(z1+DIV_EAR,T-DIV_SD);s.lineTo(z1+DIV_EAR,T);s.lineTo(z0,T);s.lineTo(z0,T-DIV_SD);s.lineTo(zi,T-DIV_SD);s.lineTo(zi,yb);
    const me=ext(s,M.prop,DIV_T);me.rotation.y=-Math.PI/2;me.position.set(x0+DIV_T,0,0);group.add(me);
    box(DIV_T,DIV_HH,DIV_HL,x0,T-DIV_SD,-DIV_HL,M.prop);}   // ручка — прямоугольный выступ того же листа, наружу через прорезь задней боковины
  // уголки под колосник (задний — cgrAngB, передний — cgrAngF): полка вниз плотно по боковине над отверстиями, полка сверху внутрь: одна полка вверх — плотно к боковине, вторая внутрь под решётку, над отверстиями поддува
  if(S.cgr&&S.cgrAng)[[t,1],[W-t,-1]].forEach(([zw,sd])=>{tag(sd>0?'cgrAngB':'cgrAngF');box(CA_L,CA_T,CA_A,CA_X0,B+CA_TOP-CA_T,sd>0?zw:zw-CA_A,M.prop);box(CA_L,CA_A,CA_T,CA_X0,B+CA_Y,sd>0?zw:zw-CA_T,M.prop);});   // полка сверху внутрь + полка вниз по боковине
  // колосниковая решётка: 2 половины — «Колосник 1» (левая) и «Колосник 2» (правая, у ручки), лист с отверстиями, ручки — уголки 30×30×3
  if(S.cgr)[0,1].forEach(i=>{tag('cgr'+(i+1));if(!S['cgrPlate'+(i+1)])return;const y=B+CA_TOP,z0=W/2-CG_W/2;box(CG_L,CG_T,CG_W,cgX()[i],y,z0,M.perf);   // перфолист (отверстия — рисунком)
      [cgHX()[i]].forEach(xc=>{const yt=B+CA_TOP+CG_T,x0=xc-CG_HA/2;   // ручка — уголок 30×30×3: вертикальная полка приварена нижней кромкой, верхняя торчит вбок; поперёк жаровни
        box(CG_HT,CG_HA,CG_HL,x0,yt,W/2-CG_HL/2,M.prop);box(CG_HA,CG_HT,CG_HL,x0,yt+CG_HA-CG_HT,W/2-CG_HL/2,M.prop);});});
  tag('gAng');
  if(S.gAng)GA_XS.forEach(x0=>{const y=B+t+GA_H;box(GA_L,.3,GA_A,x0,y-.3,GA_Z-GA_A,M.steel);box(GA_L,GA_A,.3,x0,y-GA_A,GA_Z-.3,M.steel);});
  }
  // печь: дно, боковины, перегородка; левый торец открыт — топка
  if(k){
  tag('sBot');
  if(S.draft){const bt=ext(holedPlate(-L2,0,ZK0,ZK1),M.steel);bt.rotation.x=-Math.PI/2;bt.position.y=KB;group.add(bt);}
  else box(L2,t,WK,-L2,KB,ZK0,M.steel);
  if(S.draft){
    tag('guides');   // направляющие: квадрат 6×6 к дну + полоса 20×3 снизу, заходит под шибер
    [[SH_ZL,SH_ZL],[SH_ZR-SH_SP,SH_ZR-SH_GW]].forEach(([zs,zc])=>{box(SH_L,SH_GAP,SH_SP,SH_X0,KB-SH_GAP,zs,M.steel);box(SH_L,.3,SH_GW,SH_X0,KB-SH_GAP-.3,zc,M.steel);});
    tag('shib');
    const so=shOff();if(so!==null){box(SH_L,SH_T,SH_W,SH_X0+so,KB-SH_GAP,W/2-SH_W/2,M.plate);   // лежит на полосах, до дна 3 мм
      box(.3,2.5,8,SH_X0+so-.3,KB-SH_GAP-2.2,W/2-4,M.plate);}                     // ручка — отогнутый край
  }
  tag('sK0');stoveWall(ZK0,true);
  tag('sK1');stoveWall(ZK1-t,false);
  tag('fb');if(S.fb){const m=new THREE.Mesh(new THREE.BoxGeometry(FB_L,t,fbW()),M.steel);m.rotation.x=-fbA();m.position.set(FB_X0+FB_L/2,(fbY0()+fbY1())/2,ZK0+t+FB_Z/2);group.add(m);}   // наклонный отсекатель
  tag('obe');if(S.obe){const m=new THREE.Mesh(new THREE.CylinderGeometry(OBE_R,OBE_R,OBE_H,64,1,true),M.steel);m.position.set(PCX,T-OBE_H/2,W/2);group.add(m);}   // обечайка
  tag('damper');if(S.chim&&S.damper){const y=chY0()+CH+DMP_Y,zc=ZK0-CH_H+CH/2,d=new THREE.Mesh(new THREE.BoxGeometry(CH-.5,.3,CH-.5),M.steel);d.rotation.x=.5;d.position.set(CH_X,y,zc);group.add(d);
    cyl(.4,CH+9,'x',CH_X+3,y,zc,M.skewer,10);cyl(1,4,'x',CH_X+CH/2+8,y,zc,M.wood,12);}   // заслонка: пластина на оси, ручка снаружи
  //   // козырёк: приварен к задней боковине по верхнему краю отверстия трубы
  tag('chim');
  if(S.chim){const y0=chY0(),w=.2;   // профтруба 60×60×2: горизонтальный участок и вертикальный после колена
    const tube=(x0,y0,z0,lx,ly,lz)=>{
      if(ly>lx&&ly>lz){box(CH,ly,w,x0,y0,z0,M.steel);box(CH,ly,w,x0,y0,z0+CH-w,M.steel);box(w,ly,CH,x0,y0,z0,M.steel);box(w,ly,CH,x0+CH-w,y0,z0,M.steel);}
      else{box(CH,w,lz,x0,y0,z0,M.steel);box(CH,w,lz,x0,y0+CH-w,z0,M.steel);box(w,CH,lz,x0,y0,z0,M.steel);box(w,CH,lz,x0+CH-w,y0,z0,M.steel);}};
    tube(CH_X-CH/2,y0,ZK0-CH_H,CH,CH,CH_H);                 // горизонтально от стенки
    tube(CH_X-CH/2,y0,ZK0-CH_H,CH,CH+CH_V,CH);            // колено и 10 см вверх
    box(CH,.3,CH,CH_X-CH/2,y0,ZK0-CH_H,M.steel);
    tag('chimX');if(S.chimX)tube(CH_X-CH/2,y0+CH+CH_V+.3,ZK0-CH_H,CH,CH_X_L,CH);}   // удлинитель 1 м: зазор 3 мм — шов на месте
  tag('wall');box(t,H2-t,WK-2*t,0,KB+t,ZK0+t,M.steel);   // перегородка = левый торец жаровни
  tag('tie');if(S.tie)box(TIE_W,t,WK-2*t,-L2,T-t,ZK0+t,M.steel);   // полоса у дверцы: закрывает верх до плиты и держит боковины
  // плита с кольцами
  const lift=S.lift?22:0,kz=S.kazan&&!S.lift&&S.plate;
  tag('plate');
  if(S.plate){const pl=ext((()=>{const s=new THREE.Shape();s.moveTo(-PLX/2,-PLZ/2);s.lineTo(PLX/2,-PLZ/2);s.lineTo(PLX/2,PLZ/2);s.lineTo(-PLX/2,PLZ/2);s.lineTo(-PLX/2,-PLZ/2);
    const h=new THREE.Path();h.absarc(0,0,RINGS[0],0,Math.PI*2,true);s.holes.push(h);return s;})(),M.plate);
    pl.rotation.x=-Math.PI/2;pl.position.set(PCX,PTOP()-t+lift,W/2);group.add(pl);
    const x0=PCX-PLX/2,z0=W/2-PLZ/2;   // рёбра жёсткости — отбортовка по 4 краям плиты
    box(PLX,RIB_H-t,t,x0,T+lift,z0,M.plate);box(PLX,RIB_H-t,t,x0,T+lift,z0+PLZ-t,M.plate);
    box(t,RIB_H-t,PLZ,x0,T+lift,z0,M.plate);box(t,RIB_H-t,PLZ,x0+PLX-t,T+lift,z0,M.plate);}
  if(S.plate)RINGS.forEach((r,i)=>{if(kz&&!(RINGS[i+1]>=KZ.open-.01))return;const m=ext(ringShape(r-0.1,RINGS[i+1]),M.plate);m.rotation.x=-Math.PI/2;m.position.set(PCX,PTOP()-t+lift*(1+(i+1)*.45),W/2);group.add(m);});
  tag('kazan');if(kz)kazan3D();
  }
  // ручка
  tag('handle');
  if(g){HBZ.forEach(z=>cyl(1.25,HX,'x',L1+HX/2,HY,z,M.steel));
  cyl(1.6,HG,'z',L1+HX,HY,W/2,M.wood);}
  tag('sHandle');   // ручка отдельной печи — на перегородке, как у мангала
  if(S.mode==='stove'){[ZK0+4,ZK1-4].forEach(z=>cyl(1.25,HX,'x',HX/2,HY,z,M.steel));cyl(1.6,HG,'z',HX,HY,W/2,M.wood);}
  // ножки
  if(S.legs)legsList().forEach(([x,z,top,wh,brake])=>{
    tag('legs');
    box(8,t,8,x-4,top-t,z-4,M.steel);                       // площадка под дном
    const y0=wh?WH+PADT:FT,yj=top-t-JNT;cyl(2,top-t-y0,'y',x,y0+(top-t-y0)/2,z,M.steel);   // труба Ø40 — до площадки
    cyl(2.06,.35,'y',x,yj,z,M.rubber,24);                                                    // стык: тут ножка откручивается
    tag('legTw');if(S.legTw){const ar=new THREE.MeshBasicMaterial({color:DIMC}),y=yj-3,R=3.3;   // пометка: ножка откручивается — стрелка вокруг трубы
      const tor=new THREE.Mesh(new THREE.TorusGeometry(R,.18,8,32,Math.PI*1.5),ar);tor.rotation.x=Math.PI/2;tor.position.set(x,y,z);group.add(tor);
      const cn=new THREE.Mesh(new THREE.ConeGeometry(.6,1.4,12),ar);cn.position.set(x+.5,y,z-R);cn.rotation.z=-Math.PI/2;group.add(cn);}
    tag('legs');
    if(!wh){tag('feet');box(FTX,FT,FTX,x-FTX/2,0,z-FTX/2,M.steel);return;}   // пятка на земле
    tag('pads');{const s=new THREE.Shape();s.moveTo(-PADX/2,-PADZ/2);s.lineTo(PADX/2,-PADZ/2);s.lineTo(PADX/2,PADZ/2);s.lineTo(-PADX/2,PADZ/2);s.lineTo(-PADX/2,-PADZ/2);
      [[-4,-3],[4,-3],[4,3],[-4,3]].forEach(([dx,dz])=>{const h=new THREE.Path();h.absarc(dx,dz,.45,0,Math.PI*2,true);s.holes.push(h);});   // 4 отверстия под колесо — сверлить по факту
      const pd=ext(s,M.steel,PADT);pd.rotation.x=-Math.PI/2;pd.position.set(x,WH,z);group.add(pd);}        // площадка под колесо
    tag('wheels');if(S.wheels){box(10.1,.3,8.4,x-5.05,WH-.3,z-4.2,M.skewer);                     // площадка колеса 101×84
      cyl(3.2,1,'y',x,WH-.8,z,M.skewer,20);                                          // поворотный узел
      const wx=x+2.8;                                                                  // вынос оси — колесо поворачивается
      [-1,1].forEach(sd=>box(4.8,WH-1.3-WR+1,.3,wx-2.4-1.2,WR-1,z+sd*1.7-.15,M.skewer));
      cyl(WR,3,'z',wx,WR,z,M.rubber,32);cyl(2,3.3,'z',wx,WR,z,M.skewer,16);
      if(brake)box(3,.5,2.6,wx+WR-1,WR+2.5,z-1.3,M.prop);}                          // педаль тормоза
  });
  if(k){
  tag('lintel');if(S.lintel){if(S.logo)logoWall(tag,ZK0+t,WK-2*t,T-FL_H,FL_H-t,-L2+t);else box(t,FL_H-t,WK-2*t,-L2,T-FL_H,ZK0+t,M.steel);}   // глухой верх топки 150: приварен к боковинам и полосе
  tag('door');
  if(S.door){const g=new THREE.Group();g.position.set(-L2-DOOR_T,KB,ZK0);group.add(g);     // петли со стороны задней стенки
    const dm=new THREE.Mesh(new THREE.BoxGeometry(DOOR_T,DH(),WK),M.steel);dm.position.set(DOOR_T/2,DH()/2,WK/2);g.add(dm);
    const hd=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,14,12),M.skewer);hd.position.set(-2.2,DH()/2,WK-5);g.add(hd);
    [-6,6].forEach(dy=>{const st=new THREE.Mesh(new THREE.BoxGeometry(2.2,.8,.8),M.skewer);st.position.set(-1.1,DH()/2+dy,WK-5);g.add(st);});
    [7,DH()-7].forEach(y=>{const hn=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,7,14),M.skewer);hn.position.set(-.6,y,0);g.add(hn);});
    g.rotation.y=S.doorOpen?-1.75:0;
    // крючок на дверце, проушина на передней стенке
    const hk=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,HK_L,8),M.skewer);hk.rotation.x=Math.PI/2;hk.position.set(-.8,hkY(),WK-3+HK_L/2);g.add(hk);
    const hb=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,3.3,8),M.skewer);hb.rotation.z=Math.PI/2;hb.position.set(.85,hkY(),WK-3+HK_L);g.add(hb);
    const hp=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1,10),M.skewer);hp.rotation.z=Math.PI/2;hp.position.set(-.4,hkY(),WK-3);g.add(hp);
    const ey=new THREE.Mesh(new THREE.TorusGeometry(.7,.2,8,16),M.skewer);ey.rotation.y=Math.PI/2;ey.position.set(-L2+2.2,KB+hkY(),ZK1+.75);group.add(ey);}
  }
  tag('man');if(S.man)man3D();
  {const d0=group.children.length;dims3D();for(let i=d0;i<group.children.length;i++)group.children[i].userData.dim=1;}
  // трубки + стойки + лист
  tubes.forEach(([x,z])=>{tag('tubes');const m=ext(ringShape(TUBE_R,TUBE_RI),M.steel,TUBE_H);m.rotation.x=-Math.PI/2;m.position.set(x,T-TUBE_H,z);group.add(m);
    const pb=new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R,TUBE_R,.5,20),M.steel);pb.position.set(x,T-TUBE_H+.25,z);group.add(pb);});
  if(S.rain){
    tubes.forEach(([x,z])=>{const len=z>W/2?BAR_F:BAR_B,top=T-TUBE_H+.5+len;tag('bars');cyl(BAR_R,len,'y',x,T-TUBE_H+.5+len/2,z,M.bar,12);
      [['bolts','bolt'],['wsh1','wsh1'],['wsh2','wsh2'],['nuts','nut']].forEach(([id,k])=>{tag(id);if(!S[k])return;const bg=new THREE.Group();bg.position.set(x,top,z);group.add(bg);boltAsm(bg,k);});});
    tag('sheet');
    if(S.sheet){
    const zc=(SHEET.z0+SHEET.z1)/2,ang=Math.atan((BAR_TOP_F-BAR_TOP_B)/(RZ1-RZ0));
    const sh=new THREE.Mesh(new THREE.BoxGeometry(SHEET.x1-SHEET.x0,SHEET_T,(SHEET.z1-SHEET.z0)/Math.cos(ang)),M.sheet);
    sh.rotation.x=-ang;sh.position.set((SHEET.x0+SHEET.x1)/2,slopeY(zc)+SHEET_UP+SHEET_T/2,zc);group.add(sh);
    }
  }
  // колосник
  if(k){
  const y0=KB+t+GR_H;
  tag('angles');
  if(S.angles)[[ZK0+t,1],[ZK1-t,-1]].forEach(([zw,sd])=>{const zi=sd>0?zw:zw-GR_A;
      box(ANG_LEN,.4,GR_A,ANG_X0,y0-.4,zi,M.steel);
      box(ANG_LEN,GR_A,.4,ANG_X0,y0-GR_A,sd>0?zw:zw-.4,M.steel);});
  tag('grate');
  if(S.grate&&S.grType==='plate'){const sh=new THREE.Shape(),z0=W/2-GP_W/2,z1=W/2+GP_W/2;
    sh.moveTo(GR_X0,-z1);sh.lineTo(GR_X0+GR_LEN,-z1);sh.lineTo(GR_X0+GR_LEN,-z0);sh.lineTo(GR_X0,-z0);sh.lineTo(GR_X0,-z1);
    gpX().forEach(x=>gpZ().forEach(z=>{const h=new THREE.Path();h.absarc(x,-z,GP_D/2,0,Math.PI*2,true);sh.holes.push(h);}));
    const gm=ext(sh,M.bar,GP_T);gm.rotation.x=-Math.PI/2;gm.position.y=y0;group.add(gm);}
  if(S.grate&&S.grType!=='plate'){GR_RZ.forEach(z=>cyl(GR_BAR/2,GR_LEN,'x',GR_X0+GR_LEN/2,y0+GR_BAR/2,z,M.bar,12));        // по краям, лежат на уголках
    grBars().forEach(x=>cyl(GR_BAR/2,GR_W,'z',x,y0+GR_BAR*1.5,W/2,M.bar,12));}                              // поперечные сверху
  // дрова
  tag('wood');
  if(S.wood){const g=S.grate?grTop()-KB-t:0;[[13,KB+t+g+3.6,3.6],[24,KB+t+g+3.3,3.3],[18.5,KB+t+g+9.6,3.2]].forEach(([z,y,r],i)=>{
    const lg=new THREE.Mesh(new THREE.CylinderGeometry(r,r,36-i*3,14),[M.bark,M.endg,M.endg]);lg.rotation.z=Math.PI/2;lg.position.set(-L2+3+(36-i*3)/2+(i===2?4:0),y,z+(W-38)/2);group.add(lg);});}
  }
  // шампуры
  tag('skew');
  const skewer=(x,yb)=>{box(.3,1.1,W+20,x-.15,yb,-9,M.skewer);                        // yb — низ шампура (дно прорези)
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2,.25,8,20),M.skewer);ring.position.set(x,yb+.6,-11);ring.rotation.y=Math.PI/2;group.add(ring);
    for(let z=6;z<W-4;z+=4.3){const m=box(3.2,3.2,3.6,x-1.6,yb-1.2+Math.random()*.4,z,M.meat);m.rotation.y=Math.random()*.4;}};
  if(g&&S.skew)slots().filter((x,i)=>x>10&&x<52&&i%2===0).forEach(x=>skewer(x,T-SLOT_D));
  if(g&&S.skewD&&S.deep)DEEP_X.forEach(x=>skewer(x,T-DEEP_D));
}

// узел крепления листа крыши; начало координат — торец стойки. k — какая деталь: bolt / wsh1 / wsh2 / nut
// высоты слоёв от торца стойки: головка болта, шайба под листом, лист, шайба над листом, барашек
const BOLT_Y=(()=>{const h=BOLT_HD,w=h+WSH_T,s=w+SHEET_T,u=s+WSH_T;return {head:h/2,wsh1:h+WSH_T/2,sheet:w+SHEET_T/2,wsh2:s+WSH_T/2,nut:u+.35};})();
function boltAsm(g,k){
  const add=(geo,m,x,y,rz)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,0);if(rz)me.rotation.z=rz;g.add(me);return me;};
  if(k==='bolt'){add(new THREE.CylinderGeometry(.65,.65,BOLT_HD,6),M.skewer,0,BOLT_Y.head);        // головка — приварена к торцу стойки
    add(new THREE.CylinderGeometry(.34,.34,4,12),M.skewer,0,BOLT_HD+2);                               // стержень М8 L 40
    for(let y=BOLT_HD+.1;y<BOLT_HD+4;y+=.2){const r=add(new THREE.TorusGeometry(.36,.055,4,16),M.skewer,0,y);r.rotation.x=Math.PI/2;}}   // резьба
  if(k==='wsh1')add(new THREE.CylinderGeometry(WSH_R,WSH_R,WSH_T,28),M.zinc,0,BOLT_Y.wsh1);        // шайба Ø24 под листом — лежит на головке
  if(k==='wsh2')add(new THREE.CylinderGeometry(WSH_R,WSH_R,WSH_T,28),M.zinc,0,BOLT_Y.wsh2);        // шайба Ø24 над листом
  if(k==='nut'){add(new THREE.CylinderGeometry(.75,.75,.7,12),M.skewer,0,BOLT_Y.nut);               // барашек: ступица
    [-1,1].forEach(sd=>add(new THREE.BoxGeometry(1.2,1,.2),M.skewer,sd*1.2,BOLT_Y.nut+.3,-sd*.25));}}   // барашек: крылья
function kazan3D(){
  const bot=PTOP()-KZ.sink, th=Math.asin(KZ.r/KZ.R), pts=[];
  for(let i=0;i<=24;i++){const a=th*i/24;pts.push(new THREE.Vector2(Math.max(.01,KZ.R*Math.sin(a)),bot+KZ.R-KZ.R*Math.cos(a)));}
  const rim=kzRim();pts.push(new THREE.Vector2(KZ.r+1.2,rim),new THREE.Vector2(KZ.r+1.2,rim+.6));
  const iron=new THREE.MeshStandardMaterial({color:0x26282a,metalness:.4,roughness:.75,side:THREE.DoubleSide});
  const alu=new THREE.MeshStandardMaterial({color:0xc3c8cc,metalness:.8,roughness:.35,side:THREE.DoubleSide});
  const body=new THREE.Mesh(new THREE.LatheGeometry(pts,40),iron);body.position.set(PCX,0,W/2);group.add(body);
  const lp=[];for(let i=0;i<=16;i++){const a=Math.PI/2*i/16;lp.push(new THREE.Vector2(Math.max(.01,(KZ.r+.4)*Math.cos(a)),rim+.6+KZ.lid*Math.sin(a)));}
  const lid=new THREE.Mesh(new THREE.LatheGeometry(lp,40),alu);lid.position.set(PCX,0,W/2);group.add(lid);
  cyl(1.6,KZ.knob,'y',PCX,rim+.6+KZ.lid+KZ.knob/2,W/2,alu);
  [-1,1].forEach(sd=>{const e=new THREE.Mesh(new THREE.TorusGeometry(2.4,.5,8,16,Math.PI),iron);e.position.set(PCX,rim-.5,W/2+sd*(KZ.r+1.2));e.rotation.x=sd>0?-Math.PI/2:Math.PI/2;group.add(e);});
}
