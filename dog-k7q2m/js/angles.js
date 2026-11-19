/* ---------- режим «Углы»: тапаете детали по очереди — между соседями дуга с углом, как транспортир ----------
   Кнопка «∠ Углы» на панели видов. Пока режим включён, клик по грани не выбирает одну деталь, а добавляет её в цепочку
   (повторный клик — убрать; деталь не стыкуется ни с одной из выбранных — цепочка начинается заново с неё).
   Для каждой пары выбранных деталей с общим швом: на шве — сектор и дуга (видны сквозь металл), крупная цифра угла;
   внизу на модели — карточка: плоская картинка угла, номера деталей, длина шва, уголок-шаблон. Угол — seamDih, как в таблице. */
const ANG={on:false,pick:[],n:-1,note:''};
const ANG_COL=0x1f6fe0;// hookcheck
// общие рёбра деталей a и b
const angEdges=(a,b)=>CUR.R.edges.filter(e=>e.p.length===2&&e.p.includes(a)&&e.p.includes(b));
const angAdj=(a,b)=>angEdges(a,b).length>0;
// пары выбранных с общим швом — в порядке выбора
function angPairs(){const P=ANG.pick,out=[];P.forEach((b,i)=>P.slice(0,i).forEach(a=>{if(angAdj(a,b))out.push([a,b]);}));return out;}
// геометрия угла на шве a–b: M — середина самого длинного ребра шва, u — вдоль шва, e1/e2 — от шва по граням a и b, th — угол между ними (меньший клин), r — радиус дуги
function angGeom(a,b){const {V}=CUR.M3,R=CUR.R,E=angEdges(a,b);if(!E.length)return null;const e=E.reduce((x,y)=>y.len>x.len?y:x),A=V[e.a],B=V[e.b],M=V3.mul(V3.add(A,B),.5),u=V3.norm(V3.sub(B,A));
  // от шва в деталь: по треугольнику детали, прилегающему к ребру (центр неровной детали может лежать по другую сторону)
  const {F}=CUR.M3,dirIn=p=>{let d=V3.norm(V3.cross(p.n,u)),fi=F.findIndex((f,i)=>R.partOf[i]===p.id&&f.includes(e.a)&&f.includes(e.b)),w=fi>=0?F[fi].find(v=>v!==e.a&&v!==e.b):-1;
    const q=w>=0?V[w]:p.c;if(V3.dot(V3.sub(q,M),d)<0)d=V3.mul(d,-1);return d;};
  const pa=R.parts[a],pb=R.parts[b],e1=dirIn(pa),e2=dirIn(pb),th=Math.acos(Math.max(-1,Math.min(1,V3.dot(e1,e2))));
  const ext=(p,d)=>Math.max(5,...p.full.map(i=>V3.dot(V3.sub(V[i],M),d))),r=Math.max(10,Math.min(40,.45*Math.min(ext(pa,e1),ext(pb,e2))));
  const w=V3.sub(e2,V3.mul(e1,V3.dot(e1,e2))),e2p=V3.len(w)>1e-6?V3.norm(w):V3.norm(V3.cross(u,e1)),bis=V3.norm(V3.add(e1,e2));
  return {E,M,u,e1,e2,e2p,th,r,bis:V3.len(V3.add(e1,e2))>1e-6?bis:e2p};}
// угол цифрой — как в таблице (у зеркальной пары одно число), шов — суммарная длина
function angInfo(a,b){const R=CUR.R,d=seamDih(R,a,b),len=angEdges(a,b).reduce((s,e)=>s+e.len,0),deg=Math.round(d>180.5?360-d:d);
  const tp=CUR.TPL&&CUR.TPL.find(o=>o.a===deg),bent=typeof isBentNb==='function'&&isBentNb(a,b);return {d,deg,txt:angT(d),len,tp,bent};}
// 3D: сектор, дуга, «ножки» по граням, шов толстой линией, цифра. Рисуется после build3D, в root (build3D сам всё уберёт при следующей перерисовке)
function angDraw3D(){if(!ok||!ANG.on||!CUR||ST.edit)return;const {V}=CUR.M3;
  const top=m=>{m.renderOrder=10;return m;},fill=new THREE.MeshBasicMaterial({color:ANG_COL,transparent:true,opacity:.28,depthTest:false,depthWrite:false,side:THREE.DoubleSide}),
    line=new THREE.MeshBasicMaterial({color:ANG_COL,depthTest:false,depthWrite:false,transparent:true}),seam=new THREE.MeshBasicMaterial({color:ANG_COL});
  const tube=(pts,rad,mat)=>{const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q=>new THREE.Vector3(...q))),Math.max(2,pts.length*2),rad,6,false);root.add(top(new THREE.Mesh(g,mat)));};
  angPairs().forEach(([a,b])=>{const G=angGeom(a,b);if(!G)return;const {M,e1,e2,e2p,th,r}=G,at=(t,rr)=>V3.add(M,V3.add(V3.mul(e1,rr*Math.cos(t)),V3.mul(e2p,rr*Math.sin(t))));
    // сектор — веер треугольников
    const n=32,pos=[];for(let i=0;i<n;i++)pos.push(...M,...at(th*i/n,r),...at(th*(i+1)/n,r));const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));root.add(top(new THREE.Mesh(sg,fill)));
    const rad=Math.max(.5,r*.035);tube([...Array(n+1)].map((_,i)=>at(th*i/n,r)),rad,line);
    tube([M,V3.add(M,V3.mul(e1,r*1.3))],rad,line);tube([M,V3.add(M,V3.mul(e2,r*1.3))],rad,line);
    // шов — трубкой (видна только если не заслонена)
    G.E.forEach(e=>{const A=V[e.a],B=V[e.b],l=V3.len(V3.sub(B,A));if(l<.5)return;const cg=new THREE.CylinderGeometry(1.2,1.2,l,8),cy=new THREE.Mesh(cg,seam);
      cy.position.set(...V3.mul(V3.add(A,B),.5));cy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...V3.norm(V3.sub(B,A))));root.add(cy);});
    const el=document.createElement('span');el.className='angl';el.textContent=angInfo(a,b).txt;const lb=new THREE.CSS2DObject(el);lb.position.set(...at(th/2,r*1.55));root.add(lb);});}
// цвета граней для build3D: выбранные — как выбор, соседи выбранных (куда можно тапнуть дальше) — бледно-зелёные
function angBuildOpts(){if(!ANG.on||!CUR)return {};const sel=new Set(ANG.pick),near=new Set();ANG.pick.forEach(a=>CUR.R.edges.forEach(e=>{if(e.p.length===2&&e.p.includes(a)){const b=e.p[0]===a?e.p[1]:e.p[0];if(!sel.has(b))near.add(b);}}));return {multi:sel,near};}
// плоская картинка угла: две «пластины» из одной точки, сектор, дуга, цифра, номера деталей на концах
function angSVG(deg,na,nb){const t=Math.max(3,Math.min(177,deg))*Math.PI/180,L=50,r=20,x2=L*Math.cos(t),y2=-L*Math.sin(t),ax=r*Math.cos(t),ay=-r*Math.sin(t),big=0,
    bx=34*Math.cos(t/2),by=-34*Math.sin(t/2);
  const nx=60*Math.cos(t),ny=-60*Math.sin(t);
  return `<svg class="angpic" viewBox="-74 -70 148 90" aria-hidden="true"><path d="M0 0 L${r} 0 A${r} ${r} 0 ${big} 0 ${ax.toFixed(1)} ${ay.toFixed(1)} Z" class="sec"/>
    <path d="M${r} 0 A${r} ${r} 0 ${big} 0 ${ax.toFixed(1)} ${ay.toFixed(1)}" class="arc"/><line x1="0" y1="0" x2="${L}" y2="0" class="pl"/><line x1="0" y1="0" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="pl"/>
    <text x="${bx.toFixed(1)}" y="${(by+4).toFixed(1)}" class="deg">${deg}°</text><text x="${L/2+6}" y="16" class="no" text-anchor="middle">№${na}</text><text x="${nx.toFixed(1)}" y="${(ny+4).toFixed(1)}" class="no" text-anchor="middle">№${nb}</text></svg>`;}
// карточка на модели
function angCard(){const c=$('angCard');if(!c)return;if(!ANG.on||!CUR){c.hidden=true;return;}c.hidden=false;const R=CUR.R,P=angPairs(),no=i=>R.parts[i].no;
  const head=`<div class="angh"><b>Углы</b><span>${ANG.pick.length?'выбрано '+ANG.pick.length+': '+ANG.pick.map(i=>'№'+no(i)).join(' → '):'тапните деталь на модели'}</span><button type="button" data-a="reset"${ANG.pick.length?'':' disabled'}>Сброс</button><button type="button" data-a="off" aria-label="Выключить углы">✕</button></div>`;
  const tip=ANG.note?`<p class="angnote">${esc(ANG.note)}</p>`:ANG.pick.length===1?'<p class="angnote">Теперь тапните соседнюю деталь — она подсвечена зелёным</p>':ANG.pick.length&&!P.length?'<p class="angnote">Выбранные детали не стыкуются</p>':'';
  const rows=P.slice().reverse().map(([a,b])=>{const I=angInfo(a,b),deg=Math.round(I.d>180.5?360-I.d:I.d);
    return `<div class="angrow">${angSVG(deg,no(a),no(b))}<div><p class="angt">№ ${no(a)} и № ${no(b)} — <b>${esc(I.txt)}</b></p><p class="note">${I.bent?'стык гнём, не варим':'шов '+Math.round(I.len)+' мм'}${I.tp?' · уголок '+tplNo(I.tp.a):''}</p><button type="button" data-a="look" data-p="${a},${b}">Смотреть вдоль шва</button></div></div>`;}).join('');
  c.innerHTML=head+tip+(rows?`<div class="angrows">${rows}</div>`:'');}
// камера: смотрим вдоль шва снаружи клина-металла (чуть сбоку), с той стороны, где сейчас камера
function angLook(a,b){const G=angGeom(a,b);if(!G)return;const conv=seamDih(CUR.R,a,b)<=180.5,out=conv?V3.mul(G.bis,-1):G.bis,cp=camera.position,cur=[cp.x-G.M[0],cp.y-G.M[1],cp.z-G.M[2]],u=V3.dot(cur,G.u)<0?V3.mul(G.u,-1):G.u;
  const d=V3.norm(V3.add(V3.mul(u,.8),V3.mul(out,.6))),dist=Math.max(380,G.r*14);flyTo(new THREE.Vector3(...V3.add(G.M,V3.mul(d,dist))),new THREE.Vector3(...G.M));}
// клик по детали в режиме углов
function angTap(pi){ANG.note='';if(pi<0)return;const R=CUR.R,i=ANG.pick.indexOf(pi);
  if(i>=0)ANG.pick.splice(i,1);
  else if(!ANG.pick.length||ANG.pick.some(a=>angAdj(a,pi)))ANG.pick.push(pi);
  else{ANG.note=`№ ${R.parts[pi].no} не стыкуется с выбранными — начал заново`;ANG.pick=[pi];}
  ST.sel=ANG.pick.length?ANG.pick[ANG.pick.length-1]:-1;ST.selB=-1;renderAll();}
function angSet(on){ANG.on=on;ANG.note='';ANG.pick=on&&ST.sel>=0?[ST.sel]:[];const b=$('bAng');if(b)b.setAttribute('aria-pressed',on);$('stage').classList.toggle('angmode',on);renderAll();if(!on&&typeof edUI==='function')edUI();}
// после каждой перерисовки: цепочка — для текущей фигуры (сменилось число деталей — сброс), 3D и карточка
function angAfter(){if(!CUR)return;if(ANG.n!==CUR.R.parts.length){if(ANG.n>=0)ANG.pick=[];ANG.n=CUR.R.parts.length;}ANG.pick=ANG.pick.filter(i=>i<CUR.R.parts.length);
  angDraw3D();angCard();if(ANG.on&&!ST.edit)$('hint').textContent='Углы: тапайте детали по очереди · повторный тап — убрать · вращать — тянуть пальцем';}
(()=>{const b=$('bAng'),c=$('angCard');if(b)b.addEventListener('click',()=>angSet(!ANG.on));
  if(c)c.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a;
    if(a==='off')angSet(false);else if(a==='reset'){ANG.pick=[];ANG.note='';ST.sel=-1;renderAll();}else if(a==='look'){const [p,q]=t.dataset.p.split(',').map(Number);angLook(p,q);}});})();
