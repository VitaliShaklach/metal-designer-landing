/* ---------- редактор: выбор, отмена, правки модели ---------- */
const SEL={m:new Set(),n:new Set(),end:new Map()};   // end: труба → активный конец 'a' | 'b'; n — узлы активных концов (от них рисуем)
const UNDO=[],REDO=[];
const snap=()=>JSON.stringify(M);
// любая правка: change() — снимок для отмены, правка, перерисовка
function change(fn){UNDO.push(snap());if(UNDO.length>200)UNDO.shift();REDO.length=0;fn();cleanSel();renderAll();}
function undo(){if(!UNDO.length)return;REDO.push(snap());M=normModel(JSON.parse(UNDO.pop()));cleanSel();renderAll();}
function redo(){if(!REDO.length)return;UNDO.push(snap());M=normModel(JSON.parse(REDO.pop()));cleanSel();renderAll();}
function cleanSel(){[...SEL.end.keys()].forEach(id=>{if(!M.members.some(m=>m.id===id))SEL.end.delete(id);});[...SEL.m].forEach(id=>{if(!M.members.some(m=>m.id===id))SEL.m.delete(id);});[...SEL.n].forEach(id=>{if(!nodeById(id))SEL.n.delete(id);});}
// клик по трубе: активным становится ближний к месту клика конец; клик по ручке — её конец; Shift — добавить к выбору
function select(hit,add){
  if(hit&&hit.handle){SEL.end.set(hit.handle.member,hit.handle.end);syncEnds();renderAll(false);return;}
  if(!add){SEL.m.clear();SEL.n.clear();SEL.end.clear();}
  if(hit&&hit.member){const id=hit.member;if(add&&SEL.m.has(id)){SEL.m.delete(id);SEL.end.delete(id);}
    else{SEL.m.add(id);const m=M.members.find(x=>x.id===id),f=frame(m),P=hit.point?[hit.point.x,hit.point.y,hit.point.z]:f.B;
      SEL.end.set(id,V3.len(V3.sub(P,f.A))<V3.len(V3.sub(P,f.B))?'a':'b');}}
  if(hit&&hit.node){SEL.n.has(hit.node)&&add?SEL.n.delete(hit.node):SEL.n.add(hit.node);}
  syncEnds();renderAll(false);}
const activeEnd=id=>SEL.end.get(id)||'b';
// узлы активных концов выбранных труб (одиночные узлы без труб — тоже)
function syncEnds(){const keep=[...SEL.n].filter(id=>!M.members.some(m=>m.a===id||m.b===id));SEL.n=new Set(keep);
  SEL.m.forEach(id=>{const m=M.members.find(x=>x.id===id);if(m)SEL.n.add(m[activeEnd(id)]);});}
// нарисовать трубу от выбранного узла вдоль оси
const AX={'+x':[1,0,0],'-x':[-1,0,0],'+y':[0,1,0],'-y':[0,-1,0],'+z':[0,0,1],'-z':[0,0,-1]};
function drawAlong(ax,len,pr){const from=[...SEL.n].pop();if(!from)return 'Сначала кликните трубу у нужного конца (или создайте первый узел)';if(!(len>0))return 'Длина должна быть больше 0';
  const n0=nodeById(from),d=AX[ax];let nid;
  change(()=>{const n1=addNode(n0.x+d[0]*len,n0.y+d[1]*len,n0.z+d[2]*len);nid=n1.id;addMember(n0.id,n1.id,pr,curGrp());});
  const nm=M.members[M.members.length-1];SEL.m.clear();SEL.end.clear();SEL.n.clear();if(nm){SEL.m.add(nm.id);SEL.end.set(nm.id,'b');}syncEnds();renderAll(false);return '';}   // новая труба выбрана, активен её дальний конец — можно продолжать
function joinNodes(pr){const ns=[...SEL.n];if(ns.length!==2)return 'Выберите две трубы (вторую — Shift+клик) у тех концов, которые надо соединить';let r='';change(()=>{if(!addMember(ns[0],ns[1],pr,curGrp()))r='Такая труба уже есть';});return r;}
// длина трубы по оси: двигаем конец b вдоль оси
function setAxisLen(id,len){const m=M.members.find(x=>x.id===id);if(!m||!(len>0))return;change(()=>{const f=frame(m),a=nodeById(m.a),b=nodeById(m.b),others=M.members.filter(x=>x!==m&&(x.a===b.id||x.b===b.id));
  // если у конца b есть другие трубы — двигаем узел вместе с ними; иначе тоже двигаем (свободный конец)
  b.x=Math.round(a.x+f.d[0]*len);b.y=Math.round(a.y+f.d[1]*len);b.z=Math.round(a.z+f.d[2]*len);});}
// длина реза трубы = L: двигаем один конец вдоль оси; трубы в этом узле растягиваются вместе с ним
function setCutLen(id,L,end){const m=M.members.find(x=>x.id===id);if(!m||!(L>0))return;const c=memberCuts().find(x=>x.m.id===id),axis=L-c.ea.ext-c.eb.ext;if(!(axis>0))return;
  const deg=nid=>M.members.filter(x=>x!==m&&(x.a===nid||x.b===nid)).length,gy=Math.min(...M.nodes.map(n=>n.y)),onG=nid=>nodeById(nid).y<=gy+1;
  // конец на земле не трогаем (ножка удлиняется вверх); иначе двигаем конец, где меньше других труб
  const moveB=end?end==='b':onG(m.a)!==onG(m.b)?onG(m.a):deg(m.b)<=deg(m.a);   // end — какой конец двигать (активный)
  change(()=>{const f=frame(m),fix=nodeById(moveB?m.a:m.b),mv=nodeById(moveB?m.b:m.a),d=moveB?f.d:V3.mul(f.d,-1);
    mv.x=Math.round(fix.x+d[0]*axis);mv.y=Math.round(fix.y+d[1]*axis);mv.z=Math.round(fix.z+d[2]*axis);});}
// сдвиг выбранных труб: узлы, где к ним примыкают НЕвыбранные трубы, копируются — выбранное отрывается и едет, остальное стоит на месте
// (например, перемычка у низа стойки поднимается вдоль стойки, стойка не укорачивается); после сдвига совпавшие узлы склеиваются
// прилипание при протягивании: на луче от fix вдоль dir ищем узлы и оси других труб, через которые он проходит (±3 мм);
// если текущая длина s ближе tol к такой точке — возвращаем её (точно на оси трубы → потом Т-стык «встык»)
function snapAlong(fix,dir,s,skip,tol=80){let best=null;
  M.nodes.forEach(n=>{if(skip.nodes.has(n.id))return;const v=V3.sub(P3(n),fix),t=V3.dot(v,dir);if(t<5)return;if(V3.len(V3.sub(v,V3.mul(dir,t)))>3)return;
    if(Math.abs(t-s)<tol&&(!best||Math.abs(t-s)<Math.abs(best.s-s)))best={s:t,p:P3(n),what:'узел '+n.id};});
  M.members.forEach(o=>{if(skip.members.has(o.id))return;const f=frame(o),c=segClosest(fix,dir,1e6,f.A,f.d,f.L);if(c.dist>3||c.s<5)return;
    if(Math.abs(c.s-s)<tol&&(!best||Math.abs(c.s-s)<Math.abs(best.s-s)-1))best={s:c.s,p:c.Q,what:'труба '+o.id};});
  return best;}
// после правки: узел совпал с другим — склеиваем
function mergeNode(n){const ex=M.nodes.find(q=>q!==n&&Math.hypot(q.x-n.x,q.y-n.y,q.z-n.z)<1);if(!ex)return;
  M.members.forEach(m=>{if(m.a===n.id)m.a=ex.id;if(m.b===n.id)m.b=ex.id;});M.members=M.members.filter(m=>m.a!==m.b);M.nodes=M.nodes.filter(q=>q!==n);}
// направить трубу по оси: поворот вокруг неактивного конца, длина по оси сохраняется; активный конец отрывается от чужих труб
function aimMember(id,ax){const m=M.members.find(x=>x.id===id);if(!m)return;const k=activeEnd(id),f=frame(m),d=AX[ax];
  change(()=>{const fix=nodeById(k==='b'?m.a:m.b);let mv=nodeById(m[k]);
    if(M.members.some(o=>o!==m&&(o.a===mv.id||o.b===mv.id))){const n={id:nextId(M.nodes,'n'),x:0,y:0,z:0};M.nodes.push(n);m[k]=n.id;mv=n;}
    Object.assign(mv,{x:Math.round(fix.x+d[0]*f.L),y:Math.round(fix.y+d[1]*f.L),z:Math.round(fix.z+d[2]*f.L)});mergeNode(mv);gcNodes();});
  syncEnds();renderAll(false);}
// крестовой стык: оси двух труб пересекаются посередине — keep остаётся целой, cut режется в точке пересечения на две, обе половины встык к keep
function crossPoint(keep,cut){const fa=frame(keep),fb=frame(cut),c=segClosest(fa.A,fa.d,fa.L,fb.A,fb.d,fb.L);
  if(c.dist>1||c.s<1||c.s>fa.L-1||c.t<1||c.t>fb.L-1)return null;return c.P.map(v=>Math.round(v*100)/100);}   // точка на оси целой трубы (сотые мм — чтобы узел лёг точно на ось)
function splitAt(m,P){const n={id:nextId(M.nodes,'n'),x:P[0],y:P[1],z:P[2]};M.nodes.push(n);
  const m2=Object.assign({},m,{id:nextId(M.members,'m'),a:n.id,endA:'auto'});m.b=n.id;m.endB='auto';M.members.push(m2);return m2;}
function crossJoint(keepId,cutId){const k=M.members.find(x=>x.id===keepId),c=M.members.find(x=>x.id===cutId);if(!k||!c)return 'Выберите две трубы';
  const P=crossPoint(k,c);if(!P)return 'Эти трубы не пересекаются осями посередине';let m2;change(()=>{m2=splitAt(c,P);});
  return `Крестовой стык: ${keepId} целая, ${cutId} и ${m2.id} — встык к ней`;}
// углы трубы от неактивного конца к активному: наклон к горизонту (−90…90) и поворот в плане (0 — вдоль +X, 90 — вдоль +Z), градусы
function memberAngles(id){const m=M.members.find(x=>x.id===id),f=frame(m),d=activeEnd(id)==='b'?f.d:V3.mul(f.d,-1);
  return {el:Math.round(Math.asin(Math.max(-1,Math.min(1,d[1])))*180/Math.PI*10)/10,az:Math.round(((Math.atan2(d[2],d[0])*180/Math.PI)+360)%360*10)/10};}
// повернуть трубу на заданные углы вокруг неактивного конца, длина по оси та же
function setAngles(id,el,az){const m=M.members.find(x=>x.id===id);if(!m)return;const k=activeEnd(id),f=frame(m),e=el*Math.PI/180,a=az*Math.PI/180,d=[Math.cos(e)*Math.cos(a),Math.sin(e),Math.cos(e)*Math.sin(a)];
  change(()=>{const fix=nodeById(k==='b'?m.a:m.b);let mv=nodeById(m[k]);
    if(M.members.some(o=>o!==m&&(o.a===mv.id||o.b===mv.id))){const n={id:nextId(M.nodes,'n'),x:0,y:0,z:0};M.nodes.push(n);m[k]=n.id;mv=n;}
    Object.assign(mv,{x:Math.round(fix.x+d[0]*f.L),y:Math.round(fix.y+d[1]*f.L),z:Math.round(fix.z+d[2]*f.L)});mergeNode(mv);gcNodes();});
  syncEnds();renderAll(false);}
function moveSel(dx,dy,dz){if(!dx&&!dy&&!dz)return;const sel=[...SEL.m].map(id=>M.members.find(m=>m.id===id)).filter(Boolean);
  if(!sel.length&&!SEL.n.size)return;
  change(()=>{const moved=new Set(),clone={};
    sel.forEach(m=>['a','b'].forEach(k=>{const nid=m[k],shared=M.members.some(o=>!SEL.m.has(o.id)&&(o.a===nid||o.b===nid));
      if(shared){if(!clone[nid]){const o=nodeById(nid),n={id:nextId(M.nodes,'n'),x:o.x,y:o.y,z:o.z};M.nodes.push(n);clone[nid]=n.id;}m[k]=clone[nid];}
      moved.add(m[k]);}));
    if(!sel.length)SEL.n.forEach(id=>moved.add(id));
    moved.forEach(id=>{const n=nodeById(id);n.x+=dx;n.y+=dy;n.z+=dz;});
    moved.forEach(id=>{const n=nodeById(id),ex=M.nodes.find(q=>q!==n&&!moved.has(q.id)&&Math.hypot(q.x-n.x,q.y-n.y,q.z-n.z)<1);   // доехали до другого узла — соединяем
      if(ex){M.members.forEach(m=>{if(m.a===id)m.a=ex.id;if(m.b===id)m.b=ex.id;});M.nodes=M.nodes.filter(q=>q!==n);}});
    gcNodes();});
  syncEnds();renderAll(false);}
function delSel(){if(!SEL.m.size&&!SEL.n.size)return;change(()=>{SEL.m.forEach(id=>delMember(id));SEL.n.forEach(id=>delNode(id));gcNodes();});SEL.m.clear();SEL.n.clear();renderAll(false);}
function setMembers(key,val){if(!SEL.m.size)return;change(()=>SEL.m.forEach(id=>{const m=M.members.find(x=>x.id===id);if(m)m[key]=val;}));}
// текущая сборка для новых труб — сборка выбранной трубы
function curGrp(){const id=[...SEL.m][0];const m=id&&M.members.find(x=>x.id===id);return m?m.grp:(ONLY_GRP||'');}
function makeGroup(name){if(!SEL.m.size)return 'Сначала выберите трубы';let gid;change(()=>{gid=nextId(M.groups,'g');M.groups.push({id:gid,name:name||('Сборка '+(M.groups.length+1)),qty:1,mirror:false});SEL.m.forEach(id=>{const m=M.members.find(x=>x.id===id);if(m)m.grp=gid;});});return '';}
function selectGroup(gid){SEL.m.clear();SEL.n.clear();M.members.forEach(m=>{if((m.grp||'')===gid)SEL.m.add(m.id);});renderAll(false);}
