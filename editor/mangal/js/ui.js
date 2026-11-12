/* ---------- интерфейс ---------- */
const ROOF=()=>S.rain?' <b>Крыша от дождя</b>: трубки по углам, стойки и лист.':'';   // в лиде — только с галочкой
// режим: заголовок, лид, группы галочек, переключатель
const LEDE={both:()=>`Три части. <b>Жаровня</b> ${u(L1)} × ${u(W)} × ${us(H1)} под шампуры — отдельный элемент. <b>Печь под казан</b> ${u(L2)} × ${u(WK)} × ${us(H2)} слева, под покупную плиту 450 × 450 мм с кольцами; топка с открытого левого торца.${ROOF()} Ручка справа. Четыре ножки на поворотных колёсах Ø100 мм, под печью две — с тормозом. Ножки откручиваются (М16).`,
  grill:()=>`<b>Мангал</b> ${u(L1)} × ${u(W)} × ${us(H1)} под шампуры: задвижки поддува, колосниковая решётка, съёмная перегородка, глубокие прорези. Четыре ножки на поворотных колёсах Ø100 мм, у ручки две — с тормозом: выкатывается целиком. Ножки откручиваются (М16).${ROOF()}`,
  stove:()=>`<b>Печь под казан</b> ${u(L2)} × ${u(WK)} × ${us(H2)} под покупную плиту 450 × 450 мм с кольцами; топка с левого торца, труба сзади. Ручка на перегородке справа. Четыре ножки на поворотных колёсах Ø100 мм, у ручки две — с тормозом. Ножки откручиваются (М16).${ROOF()}`};
const TTL={both:'Мангал с казанницей',grill:'Мангал',stove:'Печь под казан'};
function modeUI(){document.getElementById('ttl').textContent=document.title=TTL[S.mode];document.getElementById('lede').innerHTML=LEDE[S.mode]();
  document.getElementById('grpGrill').hidden=!gOn();document.getElementById('grpStove').hidden=!sOn();
  document.querySelectorAll('#modeSeg button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===S.mode));
  if(typeof fillEls==='function')fillEls();}
function updUI(){modeUI();
  document.getElementById('hTopV').textContent=us(T);
  document.getElementById('hFireV').textContent=us(H2);
  document.getElementById('hBarV').textContent=`${u(BAR_F)} / ${us(BAR_B)}`;
  document.getElementById('rainSm').textContent=`\nстойки ${u(BAR_F)} / ${us(BAR_B)}, лист 0,5 мм`;   // в подсказке «?» — второй строкой
  document.querySelectorAll('.roofOpt').forEach(e=>e.hidden=!S.rain);   // без крыши — только сама галочка
  document.querySelectorAll('[data-u]').forEach(e=>e.textContent=us(+e.dataset.u));   // числа в кнопках: с подписью и без
  document.querySelectorAll('[data-n]').forEach(e=>e.textContent=u(+e.dataset.n));
  document.querySelectorAll('#unitSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===UNIT));
  notesUI();
  const gap=Math.round(slopeY(W/2)-kzTop()), head=BAR_TOP_F;
  document.getElementById('fit').innerHTML=
    `<span>Верх жаровни: <b>${us(T)}</b> ${T>=95&&T<=100?'':`<span class="warn">· при росте 184 см удобно ${u(95)}–${us(100)}</span>`}</span>`+
    (S.rain?`<span>Крыша спереди: <b>${us(head)}</b> ${head>=190?'':'<span class="warn">· ниже головы</span>'}</span>`:'')+
    (sOn()?`<span>Казан ${KZ.v} л в проёме Ø${u(KZ.open*2)}: в топке <b>${u(KZ.sink)}</b> из ${us(KZ.d)}</span>`:'')+
    (S.mode==='both'?`<span>Ножки без колёс: жаровня <b>${u(B-WH)}</b>, печь <b>${us(KB-WH)}</b></span>`:`<span>Ножки без колёс: <b>${us((gOn()?B:KB)-WH)}</b></span>`)+
    (sOn()&&S.rain?`<span>От крышки казана до крыши: <b class="${gap<25?'warn':''}">${us(gap)}</b></span>`:'');
}
// пробел + тянуть мышью = двигать эскиз (как в Figma)
let spacePan=null,spaceHeld=false,overStage=false;
stage.addEventListener('pointerenter',()=>overStage=true);stage.addEventListener('pointerleave',()=>{if(!spacePan)overStage=false;});
addEventListener('keydown',e=>{if(e.code!=='Space'||!overStage)return;const a=document.activeElement;
  if(a&&(a.tagName==='TEXTAREA'||(a.tagName==='INPUT'&&a.type==='text')))return;
  e.preventDefault();if(a&&a.blur)a.blur();if(!spaceHeld&&ok){spaceHeld=true;controls.enabled=false;stage.style.cursor='grab';}},{capture:true});
addEventListener('keyup',e=>{if(e.code!=='Space')return;if(spaceHeld)e.preventDefault();spaceHeld=false;spacePan=null;if(ok)controls.enabled=true;stage.style.cursor='';},{capture:true});
stage.addEventListener('pointerdown',e=>{if(!spaceHeld||!ok)return;e.preventDefault();spacePan={x:e.clientX,y:e.clientY};stage.style.cursor='grabbing';stage.setPointerCapture(e.pointerId);});
stage.addEventListener('pointermove',e=>{if(!spacePan)return;const dx=e.clientX-spacePan.x,dy=e.clientY-spacePan.y;spacePan={x:e.clientX,y:e.clientY};
  const d=camera.position.distanceTo(controls.target),k=2*d*Math.tan(camera.fov*Math.PI/360)/renderer.domElement.clientHeight;
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
  const off=right.multiplyScalar(-dx*k).add(up.multiplyScalar(dy*k));camera.position.add(off);controls.target.add(off);});
stage.addEventListener('pointerup',()=>{if(spacePan){spacePan=null;stage.style.cursor=spaceHeld?'grab':'';}});
function sizeStage(){if(!ok)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);labels.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
if(ok){new ResizeObserver(sizeStage).observe(stage);sizeStage();(function loop(){requestAnimationFrame(loop);if(camAnim){const k=Math.min(1,(performance.now()-camAnim.s)/700),e=k<.5?2*k*k:1-(-2*k+2)**2/2;camera.position.lerpVectors(camAnim.p0,camAnim.p1,e);controls.target.lerpVectors(camAnim.t0,camAnim.t1,e);if(k>=1)camAnim=null;}controls.update();renderer.render(scene,camera);labels.render(scene,camera);})();}


function render(){recompute();updUI();build3D();dimList();drawCut();}
const hTop=document.getElementById('hTop'),hFire=document.getElementById('hFire'),hBar=document.getElementById('hBar');
hTop.addEventListener('input',()=>{TOPH=+hTop.value;render();});
hFire.addEventListener('input',()=>{H2=+hFire.value;render();});
document.getElementById('dimList').addEventListener('change',e=>{const id=e.target.dataset.id;if(!id)return;e.target.checked?S.dims.add(id):S.dims.delete(id);build3D();});
document.getElementById('dAll').addEventListener('click',()=>{dimVisible().forEach(r=>S.dims.add(r.id));build3D();dimList();});
document.getElementById('dNone').addEventListener('click',()=>{dimVisible().forEach(r=>S.dims.delete(r.id));build3D();dimList();});
hBar.addEventListener('input',()=>{BAR_F=+hBar.value;render();});
document.querySelectorAll('#kzSeg button').forEach(bt=>bt.addEventListener('click',()=>{setKZ(+bt.dataset.v);document.querySelectorAll('#kzSeg button').forEach(x=>x.setAttribute('aria-pressed',x===bt));render();}));
document.getElementById('cLegs').addEventListener('change',e=>{S.legs=e.target.checked;build3D();});
document.getElementById('cLegTw').addEventListener('change',e=>{S.legTw=e.target.checked;build3D();});
document.getElementById('cWheels').addEventListener('change',e=>{S.wheels=e.target.checked;build3D();});
document.getElementById('cKazan').addEventListener('change',e=>{S.kazan=e.target.checked;render();});
document.getElementById('cRain').addEventListener('change',e=>{S.rain=e.target.checked;if(!elOk(S.sel.el))S.sel={el:null,part:null};render();fillParts();setHint();});   // сняли крышу — выбор крыши сбрасывается
[['cSheet','sheet'],['cBolt','bolt'],['cWsh1','wsh1'],['cWsh2','wsh2'],['cNut','nut']].forEach(([id,k])=>document.getElementById(id).addEventListener('change',e=>{S[k]=e.target.checked;build3D();}));
document.getElementById('cAngles').addEventListener('change',e=>{S.angles=e.target.checked;build3D();});
document.getElementById('cXray').addEventListener('change',e=>{if(!ok)return;const on=e.target.checked;M.steel.transparent=on;M.steel.opacity=on?.28:1;M.steel.depthWrite=!on;M.steel.needsUpdate=true;});
document.getElementById('cDraft').addEventListener('change',e=>{S.draft=e.target.checked;build3D();});
document.querySelectorAll('#shSeg button').forEach(bt=>bt.addEventListener('click',()=>{S.sh=bt.dataset.v;document.querySelectorAll('#shSeg button').forEach(x=>x.setAttribute('aria-pressed',x===bt));build3D();}));
document.querySelectorAll('#grSeg button').forEach(bt=>bt.addEventListener('click',()=>{S.grType=bt.dataset.v;document.querySelectorAll('#grSeg button').forEach(x=>x.setAttribute('aria-pressed',x===bt));render();}));
document.getElementById('cGrate').addEventListener('change',e=>{S.grate=e.target.checked;build3D();});
document.getElementById('cWood').addEventListener('change',e=>{S.wood=e.target.checked;build3D();});
document.getElementById('cGrates2').addEventListener('change',e=>{S.grates2=e.target.checked;build3D();});
document.getElementById('cGrillGrate').addEventListener('change',e=>{S.grillGrate=e.target.checked;build3D();});
document.getElementById('cGAng').addEventListener('change',e=>{S.gAng=e.target.checked;build3D();});
document.getElementById('cAirSl').addEventListener('change',e=>{S.airSl=e.target.checked;build3D();});
document.getElementById('cHook').addEventListener('change',e=>{S.hook=e.target.checked;build3D();});
document.querySelectorAll('#airSeg button').forEach(bt=>bt.addEventListener('click',()=>{S.air=bt.dataset.v;document.querySelectorAll('#airSeg button').forEach(x=>x.setAttribute('aria-pressed',x===bt));build3D();}));
document.getElementById('cDiv').addEventListener('change',e=>{S.div=e.target.checked;build3D();notesUI();});
document.querySelectorAll('#divSeg button').forEach(bt=>bt.addEventListener('click',()=>{S.divPos=+bt.dataset.v;document.querySelectorAll('#divSeg button').forEach(x=>x.setAttribute('aria-pressed',x===bt));build3D();}));
document.getElementById('cLogo').addEventListener('change',e=>{S.logo=e.target.checked;build3D();drawCut();});
document.getElementById('cMan').addEventListener('change',e=>{S.man=e.target.checked;build3D();});
[['cCgr','cgr'],['cCgrPlate1','cgrPlate1'],['cCgrPlate2','cgrPlate2'],['cCgrAng','cgrAng']].forEach(([id,k])=>document.getElementById(id).addEventListener('change',e=>{S[k]=e.target.checked;render();}));
document.getElementById('cDeep').addEventListener('change',e=>{S.deep=e.target.checked;build3D();});
document.getElementById('cChimX').addEventListener('change',e=>{S.chimX=e.target.checked;build3D();});
document.getElementById('cObe').addEventListener('change',e=>{S.obe=e.target.checked;build3D();drawCut();});
document.getElementById('cDamper').addEventListener('change',e=>{S.damper=e.target.checked;build3D();});
document.getElementById('cFb').addEventListener('change',e=>{S.fb=e.target.checked;build3D();});
document.getElementById('cChim').addEventListener('change',e=>{S.chim=e.target.checked;build3D();});
document.getElementById('cTie').addEventListener('change',e=>{S.tie=e.target.checked;build3D();});
document.getElementById('cLintel').addEventListener('change',e=>{S.lintel=e.target.checked;build3D();});
document.getElementById('cDoor').addEventListener('change',e=>{S.door=e.target.checked;build3D();});
document.getElementById('cDoorOpen').addEventListener('change',e=>{S.doorOpen=e.target.checked;build3D();});
document.getElementById('cSkewD').addEventListener('change',e=>{S.skewD=e.target.checked;build3D();});
document.getElementById('cSkew').addEventListener('change',e=>{S.skew=e.target.checked;build3D();});
document.getElementById('cPlate').addEventListener('change',e=>{S.plate=e.target.checked;build3D();});
document.getElementById('cLift').addEventListener('change',e=>{S.lift=e.target.checked;build3D();dimList();});
/* ---------- подсказки: пояснение галочки — в значке «?», показывается при наведении (на телефоне — по нажатию) ---------- */
(()=>{let box=document.getElementById('tipBox');if(!box){box=document.createElement('div');box.id='tipBox';box.hidden=true;document.body.appendChild(box);}
  document.querySelectorAll('.controls .chk').forEach(l=>{const sm=l.querySelector('small');if(!sm)return;
    const i=document.createElement('i');i.className='tip';i.textContent='?';
    const tn=sm.previousSibling,w=document.createElement('span');w.className='nw';   // «?» приклеен к последнему слову — не переносится один
    if(tn&&tn.nodeType===3){const m=tn.textContent.match(/^(.*?)(\S+)\s*$/s);if(m){tn.textContent=m[1];w.textContent=m[2];}}
    w.appendChild(i);sm.parentNode.insertBefore(w,sm);
    const show=()=>{const tx=sm.textContent.trim();if(!tx)return;box.textContent=tx;box.hidden=false;const r=i.getBoundingClientRect(),w=box.offsetWidth;
      box.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left-w/2))+'px';box.style.top=(r.bottom+6)+'px';};
    i.addEventListener('mouseenter',show);i.addEventListener('mouseleave',()=>box.hidden=true);
    i.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();box.hidden?show():box.hidden=true;});});
  document.querySelector('.controls').addEventListener('scroll',()=>box.hidden=true);})();
/* ---------- выбор элемента и детали: на 3D, в размерах и раскрое остаётся только он ---------- */
const CAM0=[[150,190,280],[15,60,19]];   // общий вид
const selEl=document.getElementById('selEl'),selPart=document.getElementById('selPart');
function fillEls(){selEl.innerHTML=`<option value="">${({both:'Весь мангал',grill:'Весь мангал',stove:'Вся печь'})[S.mode]}</option>`+PARTS.filter(e=>elOk(e.id)).map(e=>`<option value="${e.id}">${e.name}</option>`).join('');selEl.value=S.sel.el||'';}
fillEls();
function fillParts(){const e=elOf(S.sel.el);selPart.disabled=!e;
  selPart.innerHTML='<option value="">'+(e?'Весь элемент':'—')+'</option>'+(e?e.d.filter(([id])=>partOk(id)).map(([id,n])=>`<option value="${id}">${n}</option>`).join(''):'');
  selPart.value=S.sel.part||'';}
function flyTo(p,tg){if(!ok)return;camAnim={p0:camera.position.clone(),t0:controls.target.clone(),p1:p,t1:tg,s:performance.now()};}
function fitSel(){if(!ok)return;
  if(!S.sel.el&&S.mode==='both'){flyTo(new THREE.Vector3(...CAM0[0]),new THREE.Vector3(...CAM0[1]));return;}   // отдельный блок — наезд на рамку всего блока
  group.updateMatrixWorld(true);const bb=new THREE.Box3();
  // мелкие детали по краям мангала (скобы задвижек) — наезжаем на один экземпляр: правый крючок на передней боковине, там же его размеры
  const one=S.sel.part==='hook'?(o=>o.position.z>W/2&&o.position.x>40):null;
  group.children.forEach(o=>{if(o.visible&&!o.userData.dim&&!o.isCSS2DObject&&(!one||one(o)))bb.expandByObject(o);});
  if(bb.isEmpty())return;
  const c=bb.getCenter(new THREE.Vector3()),r=bb.getSize(new THREE.Vector3()).length()/2;
  const vf=camera.fov*Math.PI/360,hf=Math.atan(Math.tan(vf)*camera.aspect);   // половины углов обзора
  const dir=camera.position.clone().sub(controls.target).normalize(),d=Math.max(r,8)/Math.sin(Math.min(vf,hf))*(S.sel.el?1.35:.95);
  // деталь — в верхней части картинки: смотрим чуть ниже её центра
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1),tg=c.clone().sub(up.multiplyScalar(r>12&&S.sel.el?d*Math.tan(vf)*.45:0));   // мелкие детали — точно в центре, чтобы вращать вокруг них
  flyTo(tg.clone().add(dir.multiplyScalar(d)),tg);}
function setHint(){document.getElementById('pickHint').textContent=S.sel.el?`Показано: ${S.sel.part?partName(S.sel.part):elOf(S.sel.el).name}. Размеры и масса — только для него, на раскрое — подсвечен · двойной клик по пустому месту — всё`:'Выберите элемент или кликните деталь на модели — в размерах и массе останется только она, на раскрое — подсветится';}
function applySel(){fillParts();setHint();
  build3D();dimList();drawCut();fitSel();}
selEl.addEventListener('change',()=>{S.sel={el:selEl.value||null,part:null};applySel();});
selPart.addEventListener('change',()=>{S.sel.part=selPart.value||null;applySel();});
document.querySelectorAll('#modeSeg button').forEach(bt=>bt.addEventListener('click',()=>{if(S.mode===bt.dataset.v)return;S.mode=bt.dataset.v;S.sel={el:null,part:null};recompute();updUI();applySel();document.querySelectorAll('.controls .grp').forEach(g=>g._fold&&g._fold());}));
fillParts();
/* ---------- «Скопировать вид»: камера + деталь + размеры + галочки одной строкой (?view=…) ---------- */
function viewString(){const r=v=>+v.toFixed(1),p=camera.position,g=controls.target;
  const f={};Object.keys(S).forEach(k=>{if(typeof S[k]==='boolean'||k==='sh'||k==='grType'||k==='mode')f[k]=S[k];});
  f.kz=KZ.v;f.H2=H2;f.TOPH=TOPH;f.BAR_F=BAR_F;if(ok&&M.steel.transparent)f.xray=true;
  const q=new URLSearchParams({view:[p.x,p.y,p.z,g.x,g.y,g.z].map(r).join(','),fov:camera.fov,asp:camera.aspect.toFixed(2),dims:[...S.dims].join(','),flags:JSON.stringify(f)});
  if(S.sel.el)q.set('sel',S.sel.el+(S.sel.part?'.'+S.sel.part:''));
  return '?'+q.toString();}
document.getElementById('copyView').addEventListener('click',async()=>{if(!ok)return;
  const txt=location.href.split(/[?#]/)[0]+viewString(),box=document.getElementById('viewBox'),inp=document.getElementById('viewTxt'),msg=document.getElementById('viewMsg');
  inp.value=txt;box.hidden=false;let done=false;
  try{await navigator.clipboard.writeText(txt);done=true;}catch(e){}
  if(!done){inp.focus();inp.select();try{done=document.execCommand('copy');}catch(e){}}
  msg.textContent=done?'Ссылка скопирована — откроет этот же вид':'Выделено — нажмите Ctrl+C';
  clearTimeout(box._t);box._t=setTimeout(()=>box.hidden=true,12000);});
/* ---------- галочки, кнопки и ползунки — по состоянию S (после ссылки с видом) ---------- */
const CHK={cMan:'man',cLogo:'logo',cAirSl:'airSl',cHook:'hook',cDiv:'div',cCgr:'cgr',cCgrPlate1:'cgrPlate1',cCgrPlate2:'cgrPlate2',cCgrAng:'cgrAng',cDeep:'deep',cGAng:'gAng',cGrillGrate:'grillGrate',cGrates2:'grates2',cSkew:'skew',cSkewD:'skewD',
  cPlate:'plate',cLift:'lift',cKazan:'kazan',cFb:'fb',cObe:'obe',cDamper:'damper',cChim:'chim',cChimX:'chimX',cTie:'tie',cLintel:'lintel',cDoor:'door',cDoorOpen:'doorOpen',cGrate:'grate',cAngles:'angles',cDraft:'draft',cWood:'wood',
  cLegs:'legs',cLegTw:'legTw',cWheels:'wheels',cRain:'rain',cSheet:'sheet',cBolt:'bolt',cWsh1:'wsh1',cWsh2:'wsh2',cNut:'nut'};
function syncInputs(){
  for(const id in CHK){const e=document.getElementById(id);if(e)e.checked=!!S[CHK[id]];}
  const seg=(id,v)=>document.querySelectorAll('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v)===String(v)));
  seg('airSeg',S.air);seg('divSeg',S.divPos);seg('kzSeg',KZ.v);seg('grSeg',S.grType);seg('shSeg',S.sh);
  hTop.value=TOPH;hFire.value=H2;hBar.value=BAR_F;}

// ссылка с видом: ?view=cx,cy,cz,tx,ty,tz&fov=35&dims=id,id&flags={"wood":false}&sel=el.part — обычная страница с этим видом;
// &shot=1 — снимок без интерфейса (для PDF и проверок), &parts=grill,stove — старое деление на части
const Q=new URLSearchParams(location.search),SHOT=Q.has('shot');
if(SHOT)document.body.classList.add('shot');
if(Q.has('view')&&ok){
  S.dims=new Set((Q.get('dims')||'').split(',').filter(Boolean));
  if(Q.has('parts'))S.parts=new Set(Q.get('parts').split(','));
  const f=JSON.parse(Q.get('flags')||'{}');   // размеры из ползунков и казан — отдельно, остальное — галочки S
  if('kz' in f){setKZ(f.kz);delete f.kz;}
  if('H2' in f){H2=f.H2;delete f.H2;} if('LEG' in f){TOPH=f.LEG+13;delete f.LEG;} if('TOPH' in f){TOPH=f.TOPH;delete f.TOPH;} if('BAR_F' in f){BAR_F=f.BAR_F;delete f.BAR_F;}
  if(f.xray){M.steel.transparent=true;M.steel.opacity=SHOT?.22:.28;M.steel.depthWrite=false;M.steel.needsUpdate=true;document.getElementById('cXray').checked=true;delete f.xray;}   // прозрачный корпус
  if('unit' in f)delete f.unit;
  if('cgrPlate' in f){f.cgrPlate1=f.cgrPlate2=f.cgrPlate;delete f.cgrPlate;}   // старые ссылки: одна галочка на обе половины
  Object.assign(S,f);recompute();
  syncInputs();
  const v=Q.get('view').split(',').map(Number);camera.fov=+(Q.get('fov')||35);camera.updateProjectionMatrix();
  camera.position.set(v[0],v[1],v[2]);controls.target.set(v[3],v[4],v[5]);}
if(Q.has('sel')){const [e,pt]=Q.get('sel').split('.');if(!e||(elOf(e)&&elOk(e)))S.sel={el:e||null,part:pt||null};selEl.value=e||'';fillParts();}
window.addEventListener('error',e=>SHOT&&document.body.insertAdjacentHTML('afterbegin','<h1 style="color:red">'+e.message+' @'+e.lineno+'</h1>'));
render();setHint();
if(ok&&!Q.has('view')&&!Q.has('sel')){sizeStage();fitSel();if(camAnim){camera.position.copy(camAnim.p1);controls.target.copy(camAnim.t1);camAnim=null;}}   // старт: камера на весь блок текущего режима
if(Q.has('sel')&&ok&&(Q.has('fit')||!Q.has('view'))){sizeStage();fitSel();if(camAnim&&Q.has('view')){camera.position.copy(camAnim.p1);controls.target.copy(camAnim.t1);camAnim=null;}}   // ?sel=stove.chim — сразу показать деталь (&fit — подогнать камеру)
/* ---------- единицы: мм / см ---------- */
document.querySelectorAll('#unitSeg button').forEach(b=>b.addEventListener('click',()=>{if(UNIT===b.dataset.v)return;UNIT=b.dataset.v;
  try{localStorage.setItem('md-unit',UNIT);}catch(e){}
  updUI();build3D();dimList();drawCut();}));

/* ---------- сворачиваемые группы: панель настроек и список размеров ---------- */
const store=(k,v)=>{try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');localStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}};
const grpFold=store('md-grp')||{},grpIsShut=k=>k in grpFold?grpFold[k]:k!==mainGrp();   // по умолчанию раскрыта только главная группа
document.querySelectorAll('.controls .grp').forEach(g=>{const k=g.dataset.g,bt=g.querySelector('.gt');
  const set=sh=>{g.classList.toggle('shut',sh);bt.setAttribute('aria-expanded',String(!sh));};
  g._fold=()=>set(grpIsShut(k));g._fold();
  bt.addEventListener('click',()=>{const sh=!g.classList.contains('shut');set(sh);grpFold[k]=sh;store('md-grp',grpFold);});});
document.getElementById('dimList').addEventListener('click',e=>{const bt=e.target.closest('h3 button');if(!bt)return;
  const dg=bt.closest('.dg'),k=dg.dataset.el,sh=!dg.classList.contains('shut');dg.classList.toggle('shut',sh);bt.setAttribute('aria-expanded',String(!sh));
  dimFold[k]=sh;store('md-dims',dimFold);foldBtn();});
const foldBtn=()=>{const all=[...document.querySelectorAll('#dimList .dg')];document.getElementById('dFold').textContent=all.length&&all.every(d=>d.classList.contains('shut'))?'Развернуть группы':'Свернуть группы';};
document.getElementById('dFold').addEventListener('click',()=>{const all=[...document.querySelectorAll('#dimList .dg')],open=all.every(d=>d.classList.contains('shut'));
  all.forEach(d=>dimFold[d.dataset.el]=!open);store('md-dims',dimFold);dimList();});
// после каждой перерисовки списка — подпись кнопки
new MutationObserver(foldBtn).observe(document.getElementById('dimList'),{childList:true});foldBtn();

/* ---------- вкладки под 3D: Размеры | Раскрой и масса (mass) | Лазер · DXF (cut) | Что купить | Заметки ---------- */
const TABS=[...document.querySelectorAll('.tabbar button')];
function showTab(k){if(k==='dxf')k='cut';if(!TABS.some(b=>b.dataset.tab===k))k='dims';   // «Лазер · DXF» (до v1.2) теперь в «Раскрое» — старые ссылки и память
  TABS.forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;document.getElementById('tab-'+b.dataset.tab).hidden=!on;});
  store('md-tab',k);if(k==='cut')nestUI(true);}   // настройки раскроя и готовый результат — сразу; считается раскрой только по «Рассчитать»
TABS.forEach((b,i)=>{b.addEventListener('click',()=>showTab(b.dataset.tab));
  b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;const n=TABS[(i+d+TABS.length)%TABS.length];n.focus();showTab(n.dataset.tab);});});
showTab((location.hash.match(/^#(dims|cut|mass|dxf|buy|notes)$/)||[])[1]||store('md-tab')||'dims');
// внутренние вкладки «Лазер · DXF»: Лазер (С листа | Из заготовок) | Гильотина. Каждая открывает свою панель #sub-<data-sub>; выбор не запоминается —
// страница всегда открывается на «Лазер → С листа»
document.querySelectorAll('.subtabs').forEach(bar=>{const bs=[...bar.querySelectorAll(':scope>[role=tab]')];
  const show=k=>bs.forEach(b=>{const on=b.dataset.sub===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;document.getElementById('sub-'+b.dataset.sub).hidden=!on;});
  bs.forEach((b,i)=>{b.addEventListener('click',()=>show(b.dataset.sub));
    b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;const n=bs[(i+d+bs.length)%bs.length];n.focus();show(n.dataset.sub);});});});

/* ---------- клик по детали на модели — выбрать её; под курсором — имя детали ---------- */
const PART_OF={cgrAngB:'cgrAng',cgrAngF:'cgrAng',rings:'plate',coal:null};   // теги 3D, у которых в списке другая деталь
function partAt(ev){if(!ok||!group)return null;
  const r=renderer.domElement.getBoundingClientRect(),m=new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);
  const rc=new THREE.Raycaster();rc.setFromCamera(m,camera);
  const vis=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
  for(const h of rc.intersectObjects(group.children,true)){if(!vis(h.object))continue;
    let o=h.object;while(o.parent&&o.parent!==group)o=o.parent;if(o.userData.dim)continue;
    let p=o.userData.part;if(p in PART_OF)p=PART_OF[p];if(!p)continue;
    const e=PARTS.find(e=>e.d.some(d=>d[0]===p&&partOk(p)));
    if(e)return {el:e.id,part:p,name:partName(p)};
    const e2=PARTS.find(e=>e.id===PDF_PART[p]);   // деталь без строки в списке (решётки, шампуры) — выбираем элемент
    if(e2&&elOk(e2.id))return {el:e2.id,part:null,name:e2.name};}
  return null;}
(()=>{if(!ok)return;const cv=renderer.domElement,tagEl=document.getElementById('hovTag');let down=null,last=0;
  cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};tagEl.hidden=true;});
  cv.addEventListener('pointerup',e=>{if(!down||spaceHeld||e.button!==0)return;const mv=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;
    if(mv>5||dt>500)return;const p=partAt(e);if(!p)return;
    if(S.sel.el===p.el&&S.sel.part===p.part)return;
    S.sel={el:p.el,part:p.part};selEl.value=p.el;applySel();});
  cv.addEventListener('dblclick',e=>{if(partAt(e)||!S.sel.el)return;S.sel={el:null,part:null};selEl.value='';applySel();});
  cv.addEventListener('pointermove',e=>{if(e.buttons||spaceHeld||e.pointerType==='touch'){tagEl.hidden=true;return;}
    const now=performance.now();if(now-last<50)return;last=now;const p=partAt(e);stage.classList.toggle('pickable',!!p);
    if(!p){tagEl.hidden=true;return;}const r=stage.getBoundingClientRect();tagEl.textContent=p.name;tagEl.style.left=(e.clientX-r.left)+'px';tagEl.style.top=(e.clientY-r.top)+'px';tagEl.hidden=false;});
  cv.addEventListener('pointerleave',()=>{tagEl.hidden=true;});})();

/* ---------- телефон: панель настроек — шторка снизу ---------- */
(()=>{const pn=document.getElementById('controls'),bt=document.getElementById('drawerBtn');
  const set=o=>{pn.classList.toggle('open',o);bt.setAttribute('aria-expanded',String(o));bt.textContent=o?'Готово':'Настройки';};
  bt.addEventListener('click',()=>set(!pn.classList.contains('open')));
  document.getElementById('drawerClose').addEventListener('click',()=>set(false));
  addEventListener('keydown',e=>{if(e.key==='Escape'&&pn.classList.contains('open'))set(false);});})();

/* ---------- заглушка загрузки 3D ---------- */
(()=>{const l=document.getElementById('loading');if(!l)return;
  if(ok)requestAnimationFrame(()=>requestAnimationFrame(()=>l.remove()));
  else{l.classList.add('err');l.textContent='3D-модель не загрузилась (нет WebGL или нет связи с CDN) — размеры, раскрой и DXF ниже работают';}})();

/* ---------- справка «Управление» и горячие клавиши ---------- */
(()=>{const hp=document.getElementById('help'),bt=document.getElementById('helpBtn');
  const set=o=>{hp.hidden=!o;bt.setAttribute('aria-expanded',String(o));if(o)document.getElementById('helpClose').focus();};
  bt.addEventListener('click',()=>set(hp.hidden));
  document.getElementById('helpClose').addEventListener('click',()=>{set(false);bt.focus();});
  addEventListener('pointerdown',e=>{if(!hp.hidden&&!hp.contains(e.target)&&e.target!==bt)set(false);});
  const press=sel=>{const b=document.querySelector(sel);if(b)b.click();};
  addEventListener('keydown',e=>{
    const a=document.activeElement;if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(a&&(a.tagName==='TEXTAREA'||a.tagName==='SELECT'||(a.tagName==='INPUT'&&a.type!=='checkbox'&&a.type!=='range')))return;
    const k=e.key;
    if(k==='Escape'){if(!hp.hidden){set(false);bt.focus();}else if(S.sel.el){S.sel={el:null,part:null};selEl.value='';applySel();}return;}
    if(k==='?'||(e.code==='Slash'&&e.shiftKey)){e.preventDefault();set(hp.hidden);return;}
    const c=e.code;
    if(c==='KeyF'){fitSel();}
    else if(c==='Digit1')press('#modeSeg [data-v=both]');
    else if(c==='Digit2')press('#modeSeg [data-v=grill]');
    else if(c==='Digit3')press('#modeSeg [data-v=stove]');
    else if(c==='KeyD'){const vis=dimVisible();press(vis.some(r=>!S.dims.has(r.id))?'#dAll':'#dNone');}
    else if(c==='KeyX')press('#cXray');
    else if(c==='KeyU')press(`#unitSeg [data-v=${UNIT==='mm'?'cm':'mm'}]`);
    else return;
    e.preventDefault();});})();

/* ---------- «Заметки» и «Что купить» — под то, что проектируем ---------- */
function notesUI(){const g=gOn(),k=sOn(),both=S.mode==='both',el=document.getElementById('notesBox');
  document.querySelectorAll('#tab-buy li[data-m]').forEach(li=>{const m=li.dataset.m;li.hidden=!(m==='g'?g:m==='s'?k:m===S.mode);});
  document.querySelectorAll('#tab-buy li[data-r]').forEach(li=>li.hidden=!S.rain);   // покупное для крыши
  const bw=document.getElementById('brakeWhere');if(bw)bw.textContent=both?'под печью':g?'у ручки мангала':'у ручки печи';
  if(!el)return;
  const how=[
    g&&`<li><b>Жаровня ${u(L1)} × ${u(W)} × ${us(H1)}</b> под шампуры — лист 5 мм: боковины стоят на дне, торцы — между боковинами.${both?` Приваривается встык к перегородке печи по центру, ступенька ${(WK-W)/2*10} мм с каждой стороны.`:''}</li>`,
    g&&S.cgr&&`<li><b>Колосниковая решётка</b> — 2 половины из перфолиста 5–10 мм на уголках 30×30×4 над отверстиями поддува: воздух идёт под угли, зола проваливается на дно. От решётки до верха бортов ${us(13)}.</li>`,
    g&&`<li><b>Поддув</b> — ${holes().length} отверстий Ø15 мм в каждой боковине; задвижки снаружи регулируют жар.</li>`,
    k&&`<li><b>Печь под казан шириной ${us(WK)}</b> — под покупную плиту 450 × 450 мм с кольцами. Ширину уточните по купленной плите: внутренний размер между рёбрами минус 2–3 мм — плита садится на стенки как крышка.</li>`,
    k&&`<li><b>Топка</b> с ${S.mode==='stove'?'торца':'открытого левого торца'}: дверца на петлях, колосник на уголках, снизу поддувало с шибером, труба 60×60 мм сзади.</li>`,
    `<li><b>Ножки</b> — труба Ø40, откручиваются (шпилька М16 в гайку под дном). Внизу площадка 150 × 150 × 5 мм под поворотные колёса Ø100, два колеса — с тормозом ${both?'под печью':g?'у ручки':'у ручки печи'}.</li>`,
    S.rain&&`<li><b>Крыша от дождя</b> — стойки из арматуры Ø16 в трубках по углам, лист крепится болтами М8 с барашками — снимается без ключа.</li>`];
  const att=[
    `Колёса (обод пластиковый) от жара защищены: над каждым — стальная площадка, ножка остывает по длине. Опасны только угли, выпавшие на землю рядом с колесом.`,
    `Все 4 колеса поворотные, 2 — с тормозом: на месте зажмите тормоза.`,
    g&&S.cgr&&`<b>Уголки под колосник</b> приваривайте по верху и торцам: шов по нижнему краю закроет отверстия поддува.`,
    g&&S.div&&`<b>Перегородка жаровни</b> съёмная — висит «ушками» в прорезях боковин, переставляется на ${DIV_POS.map(v=>u(v)).join(' / ')} ${UN()} от торца.`,
    k&&`<b>Колосник печи</b>: уголки 40×40×4 в 60 мм от дна, на них ${S.grType==='plate'?'лист 15 мм с отверстиями Ø20':'решётка из арматуры Ø20'} (переключатель в «Топке»), вынимается через торец.`,
    `Все размеры — номинальные. Перед резкой сверьте покупные изделия (${[k&&'плиту','колёса','болты'].filter(Boolean).join(', ')}) с фактическими.`];
  el.innerHTML=`<div><h3>Как устроено — ${({both:'печь + мангал',grill:'мангал',stove:'печь'})[S.mode]}</h3><ul>${how.filter(Boolean).join('')}</ul></div>`+
    `<div><h3>На что обратить внимание</h3><ol class="q">${att.filter(Boolean).map(x=>`<li>${x}</li>`).join('')}</ol></div>`;}
