/* ---------- страница дровокола: вкладки, панель заказа, «Рассчитать», DXF ---------- */
const $=id=>document.getElementById(id);
const fmt=(v,d=0)=>v.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
let ORDER=normOrder(ORDER_DEFAULT);   // заказ при открытии — по умолчанию, в браузере не запоминаем (решение грилинга 4)

/* ---------- вкладки (как у мангала и коня): клик и стрелки ---------- */
const TABS=[...document.querySelectorAll('.tabbar [role=tab]')];
function showTab(k){TABS.forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;$('tab-'+b.dataset.tab).hidden=!on;});}
TABS.forEach((b,i)=>{b.addEventListener('click',()=>showTab(b.dataset.tab));
  b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;const n=TABS[(i+d+TABS.length)%TABS.length];n.focus();showTab(n.dataset.tab);});});

/* ---------- панель заказа ---------- */
const val=id=>$(id)?$(id).value:undefined;
function readOrder(){return normOrder({t:val('oT'),sheet:val('oSheet'),sw:val('oSW'),sl:val('oSL'),gap:val('oGap'),margin:val('oMargin'),
  plates:val('oPlates'),ears:val('oEars')??ORDER.ears,handles:readHandles()},ORDER);}
// поля — по заказу: пустое и отрицательное после ввода показывается тем, чем считается (0 или прошлое значение)
function writeOrder(){const o=ORDER,set=(id,v)=>{const e=$(id);if(e&&e.value!==String(v))e.value=v;};
  set('oT',o.t);set('oSheet',o.sheet);set('oSW',o.sw);set('oSL',o.sl);set('oGap',o.gap);set('oMargin',o.margin);set('oPlates',o.plates);set('oEars',o.ears);
  $('ownSheet').hidden=o.sheet!=='own';}
// любое изменение заказа: результат «Рассчитать» сверяется с новым ключом (устарел — убирается), «Что купить» пересчитывается сразу
function onOrderChange(){ORDER=readOrder();$('ownSheet').hidden=ORDER.sheet!=='own';CALC.check();orderViews();}
const orderViews=()=>{};   // картинки и «Что купить» — по мере тикетов (#166, #167)
$('panel').addEventListener('input',onOrderChange);
$('panel').addEventListener('change',()=>{onOrderChange();writeOrder();});

/* ---------- ручки: картинки сборки, миниатюры A1–B5, строки заказа ---------- */
const SEL={A:1,B:1};   // профиль на картинке сборки своего типа; по умолчанию A1 и B1 — как ручки заказа по умолчанию
function showAsm(type,prof){SEL[type]=prof;$('asm'+type).innerHTML=asmSVG(type,prof);
  document.querySelectorAll(`#thumbs [data-thumb^="${type}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.thumb===type+prof)));}
$('thumbs').innerHTML=['A','B'].map(t=>`<div class="trow"><span class="tlab">${t}</span>${[1,2,3,4,5].map(p=>
  `<button type="button" class="thumbbtn" data-thumb="${t}${p}" aria-pressed="false" title="${t}${p}: угол ${HANDLE_PROFILES[p].angle}°, переход ${HANDLE_PROFILES[p].stub}">${thumbSVG(t,p)}<span>${t}${p} · ${HANDLE_PROFILES[p].angle}°</span></button>`).join('')}</div>`).join('');
$('thumbs').addEventListener('click',e=>{const b=e.target.closest('[data-thumb]');if(b)showAsm(b.dataset.thumb[0],+b.dataset.thumb[1]);});
const opts=(L,v,f=x=>x)=>L.map(x=>`<option value="${x}"${String(x)===String(v)?' selected':''}>${f(x)}</option>`).join('');
function hrowHtml(h){return `<div class="hrow"><select class="hType" aria-label="Тип ручки">${opts(['A','B'],h.type)}</select>`
  +`<select class="hProf" aria-label="Профиль">${opts([1,2,3,4,5],h.prof)}</select>`
  +`<select class="hLen" aria-label="Длина, см">${opts(HANDLE_LENS,h.len,x=>x+' см')}</select>`
  +`<span class="hx">×</span><input class="inp hN" type="number" min="0" step="1" value="${h.n}" aria-label="Штук">`
  +`<button type="button" class="hDel" aria-label="Удалить строку">✕</button></div>`;}
// строки ручек как в панели (одинаковые складывает normOrder)
const readHandles=()=>[...document.querySelectorAll('#hrows .hrow')].map(r=>({type:r.querySelector('.hType').value,prof:+r.querySelector('.hProf').value,len:+r.querySelector('.hLen').value,n:r.querySelector('.hN').value}));
const rowAsm=r=>showAsm(r.querySelector('.hType').value,+r.querySelector('.hProf').value);
$('hrows').innerHTML=ORDER.handles.map(hrowHtml).join('');
// клик и фокус по строке, смена типа или профиля — картинка своего типа показывает эту ручку
$('hrows').addEventListener('focusin',e=>{const r=e.target.closest('.hrow');if(r)rowAsm(r);});
$('hrows').addEventListener('click',e=>{const r=e.target.closest('.hrow');if(!r)return;if(e.target.closest('.hDel')){r.remove();onOrderChange();return;}rowAsm(r);});
$('hrows').addEventListener('change',e=>{const r=e.target.closest('.hrow');if(r&&e.target.matches('.hType,.hProf'))rowAsm(r);if(e.target.matches('.hN')){const n=cnt(e.target.value);if(e.target.value!==String(n))e.target.value=n;}});
$('hAdd').addEventListener('click',()=>{$('hrows').insertAdjacentHTML('beforeend',hrowHtml({type:'A',prof:SEL.A,len:60,n:1}));onOrderChange();});

/* ---------- «Лазер · DXF»: «Рассчитать» — общий makeCalc (editor/common/calc.js) ---------- */
let RESULT=null;   // {res, o} — показанный результат
const groupNames=L=>{const m=new Map();L.forEach(n=>m.set(n,(m.get(n)||0)+1));return [...m].map(([n,k])=>`${n} × ${k}`).join(', ');};
function resultHtml(res,o){if(res.empty)return '<p class="empty">Нечего резать: во вкладке «Заказ» все количества — 0</p>';
  const s=res.stats,too=res.too.length?`<p class="too">Не помещается на лист ${res.H} × ${res.W}: ${escH(groupNames(res.too))}</p>`:'';
  if(!res.sheets.length)return too+'<p class="empty">Нечего резать: ни одна деталь не помещается на лист</p>';
  const kinds=Object.entries(s.byKind).map(([n,k])=>`${escH(n)} × ${k}`).join(', ');
  const rows=[['Листов',`${s.sheets} · ${res.H} × ${res.W} мм`],['Заполнение листа (среднее)',fmt(s.fill*100)+' %'],['Деталей',kinds],
    ['Длина реза',fmt(s.cutLen/1000,2)+' м'],['Врезок (контур и каждое отверстие)',fmt(s.pierces)],['Масса металла (сталь, '+o.t+' мм)',fmt(s.mass,1)+' кг']];
  return too+`<table class="stats">${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`
    +res.sheets.map((sh,i)=>`<figure class="sheet"><figcaption>Лист ${i+1} из ${res.sheets.length} · деталей ${sh.items.length} · заполнение ${fmt(sh.used*100)} %</figcaption>${sheetSVG(sh,res.W,res.H)}</figure>`).join('');}
const CALC=makeCalc({btn:$('nestRun'),box:$('nestBox'),save:$('bDxf'),wait:$('nestWait'),key:()=>orderKey(ORDER),
  run(done,live){const o=ORDER,g=runOrderGen(o);$('nestCnt').textContent='';
    const step=()=>{if(!live())return;const t0=performance.now();let v;
      try{do{v=g.next();}while(!v.done&&performance.now()-t0<60);}catch(e){$('nestCnt').textContent='';CALC.stale();throw e;}
      if(!v.done){$('nestCnt').textContent=`· ${v.value.done} из ${v.value.of}`;setTimeout(step,0);return;}
      $('nestCnt').textContent='';const res=v.value;
      if(done(resultHtml(res,o))){RESULT={res,o};if(!res.sheets.length)$('bDxf').disabled=true;}};   // нечего резать — DXF неактивна
    setTimeout(step,30);}});
function saveText(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);}
$('bDxf').addEventListener('click',()=>{CALC.check();if(!CALC.ready()||!RESULT||!RESULT.res.sheets.length)return;saveText(dxfName(RESULT.o),orderDxf(RESULT.res,RESULT.o),'application/dxf');});

/* ---------- старт ---------- */
showAsm('A',SEL.A);showAsm('B',SEL.B);
writeOrder();orderViews();
