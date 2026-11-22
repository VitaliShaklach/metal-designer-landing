/* ---------- сгиб в 3D: одна сцена (bendScene) — и для снимка сгиба (bendShot в view3d.js), и для окна «крутить сгиб» ---------- */
/* сгиб l элемента own — элемент уже согнут; в угол вставлен уголок «У141°» (≥178° — приложена линейка, уголков нет — дуга с цифрой угла); линия сгиба — толстой (V красная, m синяя).
   → {P — pieceGroup с добавками (P.G — что освободить), labs — подписи в 3D [{q, n, t, k}] (k: no — номер детали, bend — номер сгиба, tpl — уголок или угол дуги),
      vs — что должно влезть в кадр, probe — что не должно быть заслонено, hitAt(eye, q) — заслонено ли q от глаза, how — tpl | ruler | none, hit — уголок не встаёт, M, u, b, n — линия и биссектриса}; нет THREE или гибки → null */
function bendScene(own,l){if(typeof THREE==='undefined'||!CUR||!CUR.M3||!CUR.BP||!CUR.BP.J[l.id])return null;
  const {R}=CUR,{V}=CUR.M3,j=CUR.BP.J[l.id],a=Math.round(l.ang),tp=CUR.TPL&&CUR.TPL.find(o=>o.a===a),T=bendTpl(R,CUR.M3,j,own,tp?tp.pts:null),{M,u,e1,w2,b}=T,R0=95;
  const P=pieceGroup(own),col=l.kind==='V'?0xd03030:0x3030d0;
  // линия этого сгиба — толстой (линии WebGL всегда в 1 пиксель)
  const LA=V[j.A],LB=V[j.B],ll=V3.len(V3.sub(LB,LA)),cg=new THREE.CylinderGeometry(1.1,1.1,ll,10),cy=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({color:col}));P.G.push(cg);
  cy.position.set(...V3.mul(V3.add(LA,LB),.5));cy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...u));P.grp.add(cy);
  // уголок: контур толщиной 2 мм поперёк линии, прижат к граням (у вершины — выемка), светлая сталь, тёмная кромка; линейка — полоса поперёк линии на гранях
  let tc=null;if(tp){// базис правый (иначе обход граней зеркальный и уголок тёмный): третья ось — u или −u
    const uz=V3.dot(V3.cross(e1,T.e2),u)>0?u:V3.mul(u,-1),sh=new THREE.Shape(tp.pts.map(([x,y])=>new THREE.Vector2(x,y))),eg=new THREE.ExtrudeGeometry(sh,{depth:2,bevelEnabled:false}),O=V3.sub(V3.add(M,T.o),uz);
    eg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(...e1),new THREE.Vector3(...T.e2),new THREE.Vector3(...uz)).setPosition(...O));const ed=new THREE.EdgesGeometry(eg);P.G.push(eg,ed);
    P.grp.add(new THREE.Mesh(eg,new THREE.MeshStandardMaterial({color:0xb4bac0,metalness:.25,roughness:.5,side:THREE.DoubleSide})),new THREE.LineSegments(ed,new THREE.LineBasicMaterial({color:0x2b2f33})));
    const c2=tp.pts.reduce((s,q)=>[s[0]+q[0]/tp.pts.length,s[1]+q[1]/tp.pts.length],[0,0]);tc=V3.add(V3.add(M,T.o),V3.add(V3.mul(e1,c2[0]),V3.mul(T.e2,c2[1])));}
  else if(a>=TPL_MAX){const dx=V3.norm(V3.sub(e1,w2)),bx=new THREE.BoxGeometry(120,1.5,20),m4=new THREE.Matrix4().makeBasis(new THREE.Vector3(...dx),new THREE.Vector3(...b),new THREE.Vector3(...u)).setPosition(...V3.add(M,V3.mul(b,1.2)));
    bx.applyMatrix4(m4);P.G.push(bx);P.grp.add(new THREE.Mesh(bx,new THREE.MeshStandardMaterial({color:0xe8cf6a,metalness:.1,roughness:.6})));tc=V3.add(M,V3.mul(b,2));}
  // кадр: уголок, грани p и q от линии до ~R0, линия сгиба, вершины элемента рядом
  const ext=(pi,w)=>Math.max(10,...R.parts[pi].full.map(i=>V3.dot(V3.sub(V[i],M),w))),Ep=Math.min(ext(j.p,e1),R0),Eq=Math.min(ext(j.q,w2),R0),near=q=>V3.len(V3.sub(q,M))<R0;
  // уголков нет (галочка выключена) — дуга угла в угле, цифра — подписью; выставлять транспортиром
  let arc=null;if(!tp&&a<TPL_MAX){const r=Math.max(8,Math.min(30,.7*Math.min(Ep,Eq))),th=Math.acos(Math.max(-1,Math.min(1,V3.dot(e1,w2)))),at=t=>V3.add(V3.add(M,V3.mul(b,.6)),V3.add(V3.mul(e1,r*Math.cos(t)),V3.mul(T.e2,r*Math.sin(t))));
    const tg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...Array(25)].map((_,i)=>new THREE.Vector3(...at(th*i/24)))),48,.7,6,false);P.G.push(tg);P.grp.add(new THREE.Mesh(tg,new THREE.MeshBasicMaterial({color:0x1a1a1a})));
    arc=at(th/2);tc=V3.add(M,V3.mul(V3.sub(arc,M),1.45));}
  const ps=R.parts.filter(p=>own.has(p.id)),vs=T.P3.concat([V3.add(M,V3.mul(e1,Ep)),V3.add(M,V3.mul(w2,Eq)),V3.add(M,V3.mul(u,Math.max(-R0,-ll*T.at))),V3.add(M,V3.mul(u,Math.min(R0,ll*(1-T.at))))],
    [...new Set(ps.flatMap(p=>p.full))].map(i=>V[i]).filter(near));
  // заслонено ли: луч от глаза к точке упирается в элемент раньше неё
  const n=V3.norm(V3.cross(u,b)),ray=new THREE.Raycaster(),hitAt=(eye,q)=>{const dv=V3.sub(q,eye),dl=V3.len(dv);ray.set(new THREE.Vector3(...eye),new THREE.Vector3(...V3.mul(dv,1/dl)));const h=ray.intersectObjects(P.ms);return h.length&&h[0].distance<dl-Math.max(1.5,dl*.006);};
  const probe=[tc||V3.add(M,V3.mul(b,15)),V3.add(M,V3.add(V3.mul(e1,Ep*.5),V3.mul(b,1))),V3.add(M,V3.add(V3.mul(w2,Eq*.5),V3.mul(b,1)))];
  // подписи: номер детали — у сгиба поперёк грани от середины линии; у вогнутой детали эта точка бывает в вырезе — тогда в самое просторное место; номер сгиба — у линии, уголок — в угле
  const labs=ps.map(p=>{const q0=p.id===j.p?V3.add(M,V3.mul(e1,Ep*.62)):p.id===j.q?V3.add(M,V3.mul(w2,Eq*.62)):null;return {q:q0&&partHasPt(p,CUR.M3,q0,4)?q0:partLabelPt(p,CUR.M3),n:p.n,t:String(p.no),k:'no'};});
  labs.push({q:V3.sub(M,V3.mul(b,6)),n:b,t:String(l.k),k:'bend'});
  if(tp||arc)labs.push({q:tc,n:b,t:tp?tplNo(a):a+'°',k:'tpl'});
  return {P,l,j,T,M,u,b,n,ll,vs,probe,labs,hitAt,col,how:tp?'tpl':a>=TPL_MAX?'ruler':'none',hit:T.hit};}
/* откуда смотреть на сгиб: вдоль линии под ≈35° (в сторону и со стороны клина — видны и угол, и грани), «верх» — по биссектрисе угла; с обоих концов линии, в обе стороны — где уголок и обе грани у вершины не заслонены.
   B — из bendScene, asp — ширина/высота кадра → {v: {d, up, r}, c — куда смотрим, dist — расстояние, sc — сколько точек probe видно} */
function bendView(B,asp){const {M,u,b,n,vs,probe,hitAt}=B;let best=null;
  for(const s of [1,-1])for(const sd of [1,-1]){const d=V3.norm(V3.add(V3.add(V3.mul(u,s),V3.mul(n,sd*.5)),V3.mul(b,.42))),up=V3.norm(V3.sub(b,V3.mul(d,V3.dot(b,d)))),v={d,up,r:V3.norm(V3.cross(up,d))};
    const xs=vs.map(q=>V3.dot(V3.sub(q,M),v.r)),ys=vs.map(q=>V3.dot(V3.sub(q,M),v.up)),c=V3.add(M,V3.add(V3.mul(v.r,(Math.min(...xs)+Math.max(...xs))/2),V3.mul(v.up,(Math.min(...ys)+Math.max(...ys))/2))),dist=shotFit(vs,c,v,asp);
    const eye=V3.add(c,V3.mul(d,dist+5)),sc=probe.filter(q=>!hitAt(eye,q)).length;if(!best||sc>best.sc)best={v,c,dist,sc};if(sc===probe.length)break;}
  return best;}
// шапка окна: «Г8 · сгиб 2 из 6 · m156 — от себя · между № 20 и 23 · уголок У156°»; bi — заготовка, o — {how, hit} из bendScene (нет — чем выставить по галочке уголков)
function bendHead(bi,l,o){const B=CUR.BL[bi],nm=pi=>CUR.R.parts[pi].no;
  return `Г${B.no} · сгиб ${l.k} из ${B.lines.length} · ${l.kind}${l.ang} — ${l.kind==='V'?'на себя':'от себя'} · между № ${nm(l.p)} и ${nm(l.q)} · ${o?bendHow(l,o,true):tplSay(l.ang,true)}`;}

/* ---------- окно «крутить сгиб»: клик по снимку сгиба (data-b — заготовка, data-k — номер сгиба) — живое 3D на весь экран ----------
   свой рендерер и OrbitControls (основной вид не трогаем); ‹ › и ← → — сгибы заготовки, «Вид сгиба» — как на снимке, «Весь элемент», × и Esc — закрыть; при закрытии рендерер освобождаем */
let BW=null;
function bwOpen(bi,k){if(!CUR||!CUR.BL||!CUR.BL[bi]||typeof THREE==='undefined')return;if(!BW&&!bwInit())return;bwShow(bi,k);}
function bwInit(){let r;try{r=new THREE.WebGLRenderer({antialias:true});}catch(e){return false;}r.setPixelRatio(Math.min(devicePixelRatio,2));
  const el=document.createElement('div');el.className='bw';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Сгиб в 3D');
  el.innerHTML='<div class="bwbar"><span class="bwttl"></span><span class="bwbtns"><button type="button" data-a="prev" title="Предыдущий сгиб (←)" aria-label="Предыдущий сгиб">‹</button><button type="button" data-a="next" title="Следующий сгиб (→)" aria-label="Следующий сгиб">›</button>'
    +'<button type="button" data-a="bend" title="Камера на сгиб — как на снимке">Вид сгиба</button><button type="button" data-a="all" title="Показать элемент целиком">Весь элемент</button><button type="button" data-a="x" title="Закрыть (Esc)" aria-label="Закрыть">✕</button></span></div>'
    +'<div class="bwst"><div class="bwlb"></div><div class="bwhint">тянуть — крутить · колесо или два пальца — ближе/дальше · правая кнопка или два пальца — сдвиг</div></div><div class="bwdots"></div>';
  const st=el.querySelector('.bwst');st.prepend(r.domElement);document.body.appendChild(el);document.body.classList.add('noscroll');
  const sc=new THREE.Scene();sc.background=new THREE.Color(0xeef1f0);
  // свет — как у снимка (общий приглушён, главный — от камеры: свет pieceGroup)
  sc.add(new THREE.HemisphereLight(0xf2f4f5,0xb4aea6,.8*.55));[[0xffffff,.85,[900,1600,1800]],[0xbfd0e0,.35,[-1500,500,-900]],[0xfff4e8,.45,[400,-1400,1300]]].forEach(([c,i,p])=>{const d=new THREE.DirectionalLight(c,i*.55);d.position.set(...p);sc.add(d);});
  BW={el,st,r,sc,cam:new THREE.PerspectiveCamera(35,1,1,20000),lb:el.querySelector('.bwlb'),ls:[],need:3,raf:0,S:null,dn:null};BW.ctl=bwCtl();
  el.querySelector('.bwbar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;if(a==='x')bwClose();else if(a==='prev')bwStep(-1);else if(a==='next')bwStep(1);else if(a==='bend')bwBend();else if(a==='all')bwAll();});
  el.querySelector('.bwdots').addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(b)bwShow(BW.bi,+b.dataset.k);});
  // клавиши — только окну (в т. ч. Esc не закрывает лист крупно под ним)
  BW.key=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();bwClose();}else if(e.key==='ArrowLeft'){e.preventDefault();bwStep(-1);}else if(e.key==='ArrowRight'){e.preventDefault();bwStep(1);}};addEventListener('keydown',BW.key,true);
  const fit=()=>{if(!BW)return;const w=st.clientWidth||1,h=st.clientHeight||1;r.setSize(w,h,false);BW.cam.aspect=w/h;BW.cam.updateProjectionMatrix();BW.need=3;};fit();BW.ro=new ResizeObserver(fit);BW.ro.observe(st);
  // рисуем только когда что-то сдвинулось (OrbitControls с инерцией шлёт change, пока крутится)
  const loop=()=>{if(!BW)return;BW.raf=requestAnimationFrame(loop);BW.ctl.update();if(BW.need<=0)return;BW.need--;bwLight();r.render(sc,BW.cam);bwLabels();};loop();
  el.querySelector('[data-a="x"]').focus();return true;}
function bwCtl(){const c=new THREE.OrbitControls(BW.cam,BW.r.domElement);c.enableDamping=true;c.dampingFactor=.12;c.minDistance=20;c.maxDistance=8000;c.addEventListener('change',()=>{if(BW)BW.need=3;});return c;}
// камера: глаз pos, цель tgt, ось вращения up (OrbitControls запоминает ось при создании — с новой осью создаём заново)
function bwCam(pos,tgt,up){const {cam}=BW;if(up&&!new THREE.Vector3(...up).equals(cam.up)){cam.up.set(...up);BW.ctl.dispose();BW.ctl=bwCtl();}
  cam.position.set(...pos);BW.ctl.target.set(...tgt);cam.lookAt(...tgt);BW.ctl.update();BW.need=3;}
// убрать сцену сгиба: геометрии и материалы освободить
function bwDrop(){const S=BW&&BW.S;if(!S)return;BW.sc.remove(S.P.grp);S.P.grp.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});S.P.G.forEach(g=>g.dispose());BW.S=null;}
function bwShow(bi,k){const B=CUR&&CUR.BL&&CUR.BL[bi],l=B&&B.lines.find(x=>x.k===k);if(!BW)return;if(!l){bwClose();return;}
  bwDrop();const own=new Set(B.parts),S=bendScene(own,l);if(!S){bwClose();return;}Object.assign(BW,{bi,k,S,own});BW.sc.add(S.P.grp);
  const el=BW.el,col=x=>x.kind==='V'?'#c33':'#33c',esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  el.querySelector('.bwttl').textContent=bendHead(bi,l,S);el.querySelector('[data-a="prev"]').disabled=k<=1;el.querySelector('[data-a="next"]').disabled=k>=B.lines.length;
  // кружки сгибов: V — красные, m — синие, текущий — залит
  el.querySelector('.bwdots').innerHTML=B.lines.map(x=>`<button type="button" class="${x.kind==='V'?'v':'m'}${x.k===k?' on':''}" data-k="${x.k}" title="${esc(x.kind+x.ang+' — '+(x.kind==='V'?'на себя':'от себя'))}" aria-label="Сгиб ${x.k}">${x.k}</button>`).join('');
  BW.lb.innerHTML=S.labs.map(o=>`<span class="${o.k}"${o.k==='bend'?` style="color:${col(l)}"`:''}>${esc(o.t)}</span>`).join('');BW.ls=[...BW.lb.children];
  bwBend();}
function bwStep(d){if(!BW)return;const B=CUR&&CUR.BL&&CUR.BL[BW.bi];if(!B){bwClose();return;}const k=BW.k+d;if(k>=1&&k<=B.lines.length)bwShow(BW.bi,k);}
// «Вид сгиба» — тот же ракурс, что на снимке, под размер окна
function bwBend(){if(!BW||!BW.S)return;const w=BW.st.clientWidth||1,h=BW.st.clientHeight||1,o=bendView(BW.S,w/h);bwCam(V3.add(o.c,V3.mul(o.v.d,o.dist+5)),o.c,o.v.up);}
// «Весь элемент» — с той же стороны, элемент целиком в кадре
function bwAll(){if(!BW||!BW.S)return;const {cam}=BW,{V}=CUR.M3,t=BW.ctl.target.toArray(),d=V3.norm(V3.sub(cam.position.toArray(),t)),up=new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion).toArray(),v={d,up,r:V3.norm(V3.cross(up,d))};
  const vs=[...new Set(CUR.R.parts.filter(p=>BW.own.has(p.id)).flatMap(p=>p.full))].map(i=>V[i]).concat(BW.S.T.P3),o=vs.reduce((s,q)=>V3.add(s,V3.mul(q,1/vs.length)),[0,0,0]);
  const xs=vs.map(q=>V3.dot(V3.sub(q,o),v.r)),ys=vs.map(q=>V3.dot(V3.sub(q,o),v.up)),c=V3.add(o,V3.add(V3.mul(v.r,(Math.min(...xs)+Math.max(...xs))/2),V3.mul(v.up,(Math.min(...ys)+Math.max(...ys))/2)));
  bwCam(V3.add(c,V3.mul(d,shotFit(vs,c,v,(BW.st.clientWidth||1)/(BW.st.clientHeight||1))+5)),c);}
// свет от камеры (слева сверху от неё) — как на снимке: элемент одинаково освещён с любой стороны
function bwLight(){const {cam,S,ctl}=BW;if(!S)return;const d=cam.position.distanceTo(ctl.target),U=new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion),Rt=new THREE.Vector3(1,0,0).applyQuaternion(cam.quaternion);
  S.P.hl.position.copy(cam.position).addScaledVector(U,d*.6).addScaledVector(Rt,-d*.4);S.P.hl.target.position.copy(ctl.target);}
// подписи поверх: номер детали — если грань не ребром к нам и не заслонена; номер сгиба и уголок — всегда
function bwLabels(){const {S,cam,ls,st}=BW;if(!S)return;const w=st.clientWidth,h=st.clientHeight,eye=cam.position.toArray(),p=new THREE.Vector3();
  S.labs.forEach((o,i)=>{const el=ls[i];if(!el)return;p.set(...o.q).project(cam);let on=p.z<1&&Math.abs(p.x)<1.02&&Math.abs(p.y)<1.02;
    if(on&&o.k==='no'){const dv=V3.norm(V3.sub(eye,o.q));on=Math.abs(V3.dot(o.n,dv))>.15&&!S.hitAt(eye,V3.add(o.q,dv));}
    el.style.display=on?'':'none';if(on)el.style.transform=`translate(${((p.x+1)/2*w).toFixed(1)}px,${((1-p.y)/2*h).toFixed(1)}px) translate(-50%,-50%)`;});}
function bwClose(){if(!BW)return;const W=BW;cancelAnimationFrame(W.raf);removeEventListener('keydown',W.key,true);W.ro.disconnect();bwDrop();W.ctl.dispose();
  W.sc.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});W.r.dispose();if(W.r.forceContextLoss)W.r.forceContextLoss();W.el.remove();BW=null;
  const z=document.getElementById('zoom');if(!z||z.hidden)document.body.classList.remove('noscroll');}
