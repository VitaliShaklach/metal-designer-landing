/* ---------- единицы и размеры на 3D (как у мангала, но модель в мм) ---------- */
const fmt=(v,d=1)=>v.toLocaleString('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:d,useGrouping:false});
let UNIT='mm';try{UNIT=localStorage.getItem('md-unit')==='cm'?'cm':'mm';}catch(e){}
const u=(v,d)=>(UNIT==='mm'?v:v/10).toLocaleString('ru-RU',{maximumFractionDigits:d??(UNIT==='mm'?0:1),useGrouping:false});   // мм — целые, см — с точностью до мм
const UN=()=>UNIT==='mm'?'мм':'см';
const us=(v,d)=>u(v,d)+' '+UN();
const DIMC=0xd0561f,DK=10;   // DK — масштаб стрелок и отступов (у мангала модель в см, здесь в мм)
function lab(text,pos,cls='d3'){const el=document.createElement('div');el.className=cls;el.textContent=text;const o=new THREE.CSS2DObject(el);o.userData.dim=1;o.position.copy(pos);dimGroup.add(o);return o;}
// размер как на чертеже: 2 выносные линии и размерная со стрелками; маленький — стрелки снаружи, подпись на полочке
function dim3(a,b,off,text,lp=.5){
  const V=THREE.Vector3,A=new V(...a),Bp=new V(...b),O=new V(...off),A2=A.clone().add(O),B2=Bp.clone().add(O);
  const has=O.lengthSq()>0,on=has?O.clone().normalize():null,L=A2.distanceTo(B2),d=B2.clone().sub(A2).normalize();
  const P=[A2,B2];
  if(has)P.push(A.clone().add(on.clone().multiplyScalar(.3*DK)),A2.clone().add(on.clone().multiplyScalar(.6*DK)),Bp.clone().add(on.clone().multiplyScalar(.3*DK)),B2.clone().add(on.clone().multiplyScalar(.6*DK)));
  if(text!==''){
    const ar=Math.min(1*DK,Math.max(.35*DK,L*.22)),out=L<2.5*ar;
    let pp=on||new V().crossVectors(d,new V(0,1,0));if(pp.lengthSq()<1e-6)pp=new V().crossVectors(d,new V(1,0,0));pp.normalize();
    const w=pp.multiplyScalar(ar*.28),arrow=(tip,dir)=>{const base=tip.clone().add(dir.clone().multiplyScalar(ar));P.push(tip,base.clone().add(w),tip,base.clone().sub(w));};
    if(out){arrow(A2,d.clone().negate());arrow(B2,d.clone());P.push(A2,A2.clone().sub(d.clone().multiplyScalar(ar*2)),B2,B2.clone().add(d.clone().multiplyScalar(ar*2)));}
    else{arrow(A2,d.clone());arrow(B2,d.clone().negate());}}
  let lp3=null;
  if(text){lp3=A2.clone().lerp(B2,lp);if(L<2.5*DK){const m=lp3.clone();lp3.add((on||new V(0,1,0)).clone().multiplyScalar(3.2*DK));P.push(m,lp3.clone());}}
  const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P),new THREE.LineBasicMaterial({color:DIMC,depthTest:false,transparent:true}));
  ls.renderOrder=10;ls.userData.dim=1;dimGroup.add(ls);
  if(lp3)lab(text,lp3);}
// список размеров: габариты и длина каждой позиции (своя галочка у каждой)
const DIMS=new Set(['gx','gy','gz']);
function dimRows(){const pos=positions(),r=[{h:'Габариты'},{id:'gx',name:'Ширина (X)'},{id:'gy',name:'Высота (Y)'},{id:'gz',name:'Глубина (Z)'}];
  if(pos.length){r.push({h:'Длины труб (длина реза)'});pos.forEach(p=>r.push({id:'p'+p.no,name:`Поз. ${p.no} · ${prof(p.prof).name}`,val:`L ${u(p.L)}`}));}
  return r;}
function dimVal(id){const bb=bbox();return id==='gx'?bb.max[0]-bb.min[0]:id==='gy'?bb.max[1]-bb.min[1]:id==='gz'?bb.max[2]-bb.min[2]:null;}
function dims3D(){if(!ok)return;const bb=bbox(),mn=bb.min,mx=bb.max,g=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])*.06+60;
  if(DIMS.has('gx'))dim3([mn[0],mn[1],mx[2]],[mx[0],mn[1],mx[2]],[0,0,g],us(mx[0]-mn[0]));
  if(DIMS.has('gy')){   // высота — у самой высокой точки каркаса (у навеса — у задних столбов), сбоку справа
    const top=M.nodes.reduce((b,n)=>n.y>b.y?n:b,M.nodes[0]||{y:0,z:mx[2]});dim3([mx[0],mn[1],top.z],[mx[0],mx[1],top.z],[g,0,0],us(mx[1]-mn[1]));}
  if(DIMS.has('gz'))dim3([mx[0],mn[1],mn[2]],[mx[0],mn[1],mx[2]],[g,0,0],us(mx[2]-mn[2]));
  const cuts=memberCuts();positions().forEach(p=>{if(!DIMS.has('p'+p.no))return;
    p.ids.forEach(id=>{const c=cuts.find(x=>x.m.id===id);if(!c)return;const f=frame(c.m),pr=prof(c.m.prof);
      // по длинной грани: от узла с учётом подрезки концов, со стороны +v (верх сечения)
      const off=V3.mul(f.v,pr.h/2+4*DK),A=V3.add(f.A,V3.mul(f.d,-c.ea.ext)),B=V3.add(f.B,V3.mul(f.d,c.eb.ext));
      dim3(A,B,off,`${p.no}: ${u(p.L)}`);});});
  // выбрана одна труба — её длина реза на модели; клик по числу — вписать новую длину
  if(SEL.m.size===1){const c=cuts.find(x=>x.m.id===[...SEL.m][0]);if(c){const f=frame(c.m),pr=prof(c.m.prof),off=V3.mul(f.v,pr.h/2+9*DK);
    const A=V3.add(f.A,V3.mul(f.d,-c.ea.ext)),B=V3.add(f.B,V3.mul(f.d,c.eb.ext));dim3(A,B,off,'');
    const o=lab(`✎ ${us(c.L)}`,new THREE.Vector3(...V3.add(V3.mul(V3.add(A,B),.5),off)),'d3 edit');o.element.title='Кликните и впишите новую длину реза';o.element.dataset.member=c.m.id;}}}
