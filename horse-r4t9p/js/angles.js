/* ---------- режим «Углы»: тапаете детали по очереди — на шве между соседями угломер с транспортиром, как лежит настоящий ----------
   Кнопка «∠ Углы» на панели видов. Пока режим включён, клик по грани не выбирает одну деталь, а добавляет её в цепочку
   (повторный клик — убрать; деталь не стыкуется ни с одной из выбранных — цепочка начинается заново с неё). Каждая выбранная — своим цветом.
   Для каждой пары выбранных деталей с общим швом: на шве — угломер настоящего размера (головка R 45 мм со шкалой 0–180, линейка 100 мм),
   снаружи фигуры, и крупная цифра угла; внизу на модели — карточка. Расчёты — в angles-core.js, число угла — seamDih, как в таблице. */
const ANG={on:false,pick:[],key:'',note:'',fold:false};
const ANG_BLUE='#1f6fe0',GAUGE_R=45,RULER_L=100,RULER_W=12;
const angR=()=>CUR.R,angNo=i=>CUR.R.parts[i].no,angCol=pi=>angColor(Math.max(0,ANG.pick.indexOf(pi)));
const angInfoC=(a,b)=>angInfo(CUR.R,a,b,CUR.TPL,ST.bend?CUR.bentKey:null);
/* шкала транспортира на канвасе (кеш по углу и стороне): центр — шарнир, верхняя половина — головка; внешняя шкала 0 справа → 180 слева,
   внутренняя навстречу. Деление deg по внешней шкале — синее, жирное. back — для обратной стороны пластины: цифры зеркальные, чтобы читались */
const GAUGE_TEX=new Map();
function gaugeScaleTex(deg,back){const k=deg+(back?'b':'f');if(GAUGE_TEX.has(k))return GAUGE_TEX.get(k);
  const S=1024,c=S/2,cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');
  const at=(phi,r)=>[c+Math.cos(phi)*r,c-Math.sin(phi)*r];
  g.fillStyle='rgba(222,228,233,.93)';g.beginPath();g.moveTo(0,c);g.arc(c,c,c-1,Math.PI,0);g.closePath();g.fill();
  g.strokeStyle='#5d666e';g.lineWidth=5;g.stroke();
  const txt=(s,phi,r,size,col)=>{const [x,y]=at(phi,r);g.save();g.translate(x,y);g.rotate(Math.PI/2-phi);if(back)g.scale(-1,1);g.fillStyle=col;g.font=`700 ${size}px monospace`;g.textAlign='center';g.textBaseline='middle';g.fillText(s,0,0);g.restore();};
  for(let a=0;a<=180;a++){const phi=a*Math.PI/180,L=a%10===0?64:a%5===0?42:24,[x0,y0]=at(phi,c-5),[x1,y1]=at(phi,c-5-L);g.strokeStyle='#2b3238';g.lineWidth=a%10===0?4.5:2.4;
    g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();if(a%10===0){txt(String(a),phi,c-100,30,'#20262b');txt(String(180-a),phi,c-160,22,'#6b747c');}}
  const phi=deg*Math.PI/180,[x0,y0]=at(phi,c-4),[x1,y1]=at(phi,c-200);g.strokeStyle=ANG_BLUE;g.lineWidth=12;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();
  txt(String(deg),phi,c-100,36,ANG_BLUE);
  const tex=new THREE.CanvasTexture(cv);GAUGE_TEX.set(k,tex);return tex;}
/* один угломер: всё в плоскости поперёк шва. Локально: X — прямой край головки (по грани a; повёрнут так, что место, где линейка пересекает шкалу,
   читается числом deg по внешней шкале), Y — куда смотрит головка (наружу от грани a). Меши — прямо в root (build3D сам их уберёт) */
function angGaugeMesh(P,colA,colB,out){const cr=V3.dot(P.head,P.arm)<0,X=new THREE.Vector3(...(cr?V3.mul(P.base,-1):P.base)),Y=new THREE.Vector3(...P.head),Z=X.clone().cross(Y),
    M=new THREE.Matrix4().makeBasis(X,Y,Z).setPosition(new THREE.Vector3(...P.hinge)),add=(geo,mat,ord)=>{geo.applyMatrix4(M);const m=new THREE.Mesh(geo,mat);m.renderOrder=ord;out.push(m);return m;};
  const top=o=>new THREE.MeshBasicMaterial({transparent:true,depthTest:false,depthWrite:false,...o});
  add(new THREE.CircleGeometry(GAUGE_R,64,0,Math.PI),top({map:gaugeScaleTex(P.deg,false),side:THREE.FrontSide}),10);
  add(new THREE.CircleGeometry(GAUGE_R,64,0,Math.PI),top({map:gaugeScaleTex(P.deg,true),side:THREE.BackSide}),10);
  const strip=(len,w,x0,y0,rot,col,op,ord)=>{const g=new THREE.PlaneGeometry(len,w);g.translate(x0+len/2,y0,0);if(rot)g.rotateZ(rot);return add(g,top({color:col,opacity:op,side:THREE.DoubleSide}),ord);};
  strip(2*GAUGE_R,3,-GAUGE_R,1.5,0,colA,1,11);   // прямой край головки — цветом детали a
  const al=V3.dot(P.arm,[X.x,X.y,X.z]),ay=V3.dot(P.arm,[Y.x,Y.y,Y.z]),rot=Math.atan2(ay,al);
  strip(RULER_L+GAUGE_R,RULER_W,-GAUGE_R,0,rot,colB,.82,12);   // линейка 100 мм от шарнира + хвост через шарнир до обода — цветом детали b
  strip(RULER_L+GAUGE_R,1.2,-GAUGE_R,0,rot,'#1b2025',1,13);    // риска по оси линейки
  add(new THREE.CircleGeometry(4,24),top({color:'#1b2025',side:THREE.DoubleSide}),14);   // шарнир Ø 8
  const phi=P.deg*Math.PI/180;return new THREE.Vector3(Math.cos(phi)*(GAUGE_R+12),Math.sin(phi)*(GAUGE_R+12),0).applyMatrix4(M);}
// 3D: угломер на каждом шве между выбранными соседями, шов синей трубкой, крупная цифра у обода над делением
function angDraw3D(){if(!ok||!ANG.on||!CUR||ST.edit)return;const {V}=CUR.M3,seam=new THREE.MeshBasicMaterial({color:ANG_BLUE}),t=+ST.t||2;
  angPairs(CUR.R,ANG.pick).forEach(([a,b])=>{const P=gaugePose(CUR.R,CUR.M3,a,b,t);if(!P)return;const ms=[],lp=angGaugeMesh(P,angCol(a),angCol(b),ms);ms.forEach(m=>root.add(m));
    angEdges(CUR.R,a,b).forEach(e=>{const A=V[e.a],B=V[e.b],l=V3.len(V3.sub(B,A));if(l<.5)return;const cy=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,l,8),seam);
      cy.position.set(...V3.mul(V3.add(A,B),.5));cy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...V3.norm(V3.sub(B,A))));root.add(cy);});
    const el=document.createElement('span');el.className='angl';el.textContent=P.deg+'°';const lb=new THREE.CSS2DObject(el);lb.position.copy(lp);root.add(lb);});}
// цвета граней для build3D: выбранные — каждая своим цветом (Map), соседи выбранных (куда можно тапнуть дальше) — бледно-зелёные
function angBuildOpts(){if(!ANG.on||!CUR)return {};const sel=new Set(ANG.pick),near=new Set(),multi=new Map(ANG.pick.map((p,i)=>[p,angColor(i)]));
  ANG.pick.forEach(a=>CUR.R.edges.forEach(e=>{if(e.p.length===2&&e.p.includes(a)){const b=e.p[0]===a?e.p[1]:e.p[0];if(!sel.has(b))near.add(b);}}));return {multi,near};}
// плоская картинка угла: две «пластины» цветами деталей из одной точки, сектор, дуга, цифра, номера деталей на концах
function angSVG(deg,a,b){const t=Math.max(3,Math.min(177,deg))*Math.PI/180,L=50,r=20,x2=L*Math.cos(t),y2=-L*Math.sin(t),ax=r*Math.cos(t),ay=-r*Math.sin(t),
    bx=34*Math.cos(t/2),by=-34*Math.sin(t/2),nx=60*Math.cos(t),ny=-60*Math.sin(t);
  return `<svg class="angpic" viewBox="-74 -70 148 90" aria-hidden="true"><path d="M0 0 L${r} 0 A${r} ${r} 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)} Z" class="sec"/>
    <path d="M${r} 0 A${r} ${r} 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)}" class="arc"/><line x1="0" y1="0" x2="${L}" y2="0" class="pl" style="stroke:${angCol(a)}"/><line x1="0" y1="0" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="pl" style="stroke:${angCol(b)}"/>
    <text x="${bx.toFixed(1)}" y="${(by+4).toFixed(1)}" class="deg">${deg}°</text><text x="${L/2+6}" y="16" class="no" text-anchor="middle">№${angNo(a)}</text><text x="${nx.toFixed(1)}" y="${(ny+4).toFixed(1)}" class="no" text-anchor="middle">№${angNo(b)}</text></svg>`;}
// номер детали её цветом
const angNoH=(pi,sp)=>`<b class="angno" style="color:${angCol(pi)}">№${sp?' ':''}${angNo(pi)}</b>`;
// карточка на модели; свёрнутая — одна строка «Углы · №10 → №3 → №1 · 148°, 78° ▾»
function angCard(){const c=$('angCard');if(!c)return;if(!ANG.on||!CUR){c.hidden=true;return;}c.hidden=false;c.classList.toggle('fold',ANG.fold);const P=angPairs(CUR.R,ANG.pick),I=P.map(([a,b])=>angInfoC(a,b));
  const chain=ANG.pick.map(i=>angNoH(i)).join(' → '),tg=`<button type="button" class="angfold" data-a="fold" aria-expanded="${!ANG.fold}" aria-label="${ANG.fold?'Раскрыть':'Свернуть'} карточку углов">${ANG.fold?'▾':'▴'}</button>`;
  if(ANG.fold){c.innerHTML=`<div class="angh" data-a="fold"><b>Углы</b><span>${ANG.pick.length?chain+(I.length?' · '+I.slice().reverse().map(x=>x.deg+'°').join(', '):''):'тапните деталь на модели'}</span>${tg}</div>`;return;}
  const head=`<div class="angh"><b>Углы</b><span>${ANG.pick.length?'выбрано '+ANG.pick.length+': '+chain:'тапните деталь на модели'}</span><button type="button" data-a="reset"${ANG.pick.length?'':' disabled'}>Сброс</button>${tg}<button type="button" data-a="off" aria-label="Выключить углы">✕</button></div>`;
  const tip=ANG.note?`<p class="angnote">${esc(ANG.note)}</p>`:ANG.pick.length===1?'<p class="angnote">Теперь тапните соседнюю деталь — она подсвечена зелёным</p>':ANG.pick.length&&!P.length?'<p class="angnote">Выбранные детали не стыкуются</p>':'';
  const rows=P.map(([a,b],k)=>{const x=I[k];return `<div class="angrow">${angSVG(x.deg,a,b)}<div><p class="angt">${angNoH(a,1)} и ${angNoH(b,1)} — <b class="angdeg">${x.deg}°</b> · ${x.kind}</p>
    <p class="note">${x.bent?'стык гнём, не варим':'шов '+Math.round(x.len)+' мм'} · по другой шкале ${x.other}°${x.tpl?' · уголок '+tplNo(x.tpl.a):''}</p><button type="button" data-a="look" data-p="${a},${b}">Смотреть вдоль шва</button></div></div>`;}).reverse().join('');
  c.innerHTML=head+tip+(rows?`<div class="angrows">${rows}</div>`:'');}
// камера: смотрим вдоль шва снаружи (чуть сбоку, по биссектрисе наружных нормалей), с той стороны, где сейчас камера
function angLook(a,b){const G=angGeom(CUR.R,CUR.M3,a,b);if(!G)return;const s=V3.add(G.n1,G.n2),out=V3.len(s)>1e-6?V3.norm(s):G.n1,cp=camera.position,cur=[cp.x-G.M[0],cp.y-G.M[1],cp.z-G.M[2]],u=V3.dot(cur,G.u)<0?V3.mul(G.u,-1):G.u;
  const d=V3.norm(V3.add(V3.mul(u,.8),V3.mul(out,.6)));flyTo(new THREE.Vector3(...V3.add(G.M,V3.mul(d,420))),new THREE.Vector3(...G.M));}
// клик по детали в режиме углов
function angTapUI(pi){if(pi<0)return;const r=angTap(CUR.R,ANG.pick,pi);ANG.pick=r.pick;ANG.note=r.note;ST.sel=ANG.pick.length?ANG.pick[ANG.pick.length-1]:-1;ST.selB=-1;renderAll();}
// включить / выключить: на узком экране (до 900 px) карточка сразу свёрнута, шире — раскрыта; свёрнутость держится до выключения
function angSet(on){ANG.on=on;ANG.note='';ANG.pick=on&&ST.sel>=0?[ST.sel]:[];ANG.fold=on&&innerWidth<=900;const b=$('bAng');if(b)b.setAttribute('aria-pressed',on);$('stage').classList.toggle('angmode',on);renderAll();if(!on&&typeof edUI==='function')edUI();}
// после каждой перерисовки: цепочка — для текущей фигуры (сменилась фигура или число деталей — сброс), 3D и карточка
function angAfter(){if(!CUR)return;const k=ST.fig+':'+CUR.R.parts.length;if(ANG.key!==k){if(ANG.key)ANG.pick=[];ANG.key=k;}ANG.pick=ANG.pick.filter(i=>i<CUR.R.parts.length);
  angDraw3D();angCard();if(ANG.on&&!ST.edit)$('hint').textContent='Углы: тапайте детали по очереди · повторный тап — убрать · вращать — тянуть пальцем';}
(()=>{const b=$('bAng'),c=$('angCard');if(b)b.addEventListener('click',()=>angSet(!ANG.on));
  if(c)c.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a;
    if(a==='off')angSet(false);else if(a==='fold'){ANG.fold=!ANG.fold;angCard();}else if(a==='reset'){ANG.pick=[];ANG.note='';ST.sel=-1;renderAll();}else if(a==='look'){const [p,q]=t.dataset.p.split(',').map(Number);angLook(p,q);}});})();
