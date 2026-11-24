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
  plates:val('oPlates'),ears:val('oEars')??ORDER.ears,handles:ORDER.handles},ORDER);}
// поля — по заказу: пустое и отрицательное после ввода показывается тем, чем считается (0 или прошлое значение)
function writeOrder(){const o=ORDER,set=(id,v)=>{const e=$(id);if(e&&e.value!==String(v))e.value=v;};
  set('oT',o.t);set('oSheet',o.sheet);set('oSW',o.sw);set('oSL',o.sl);set('oGap',o.gap);set('oMargin',o.margin);set('oPlates',o.plates);set('oEars',o.ears);
  $('ownSheet').hidden=o.sheet!=='own';}
// любое изменение заказа: результат «Рассчитать» сверяется с новым ключом (устарел — убирается), «Что купить» пересчитывается сразу
function onOrderChange(){ORDER=readOrder();$('ownSheet').hidden=ORDER.sheet!=='own';CALC.check();orderViews();}
const orderViews=()=>{};   // картинки и «Что купить» — по мере тикетов (#166, #167)
$('panel').addEventListener('input',onOrderChange);
$('panel').addEventListener('change',()=>{onOrderChange();writeOrder();});

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
$('plateSvg').innerHTML=partSVG(platePart(),{dims:true,title:'Пластина 100 × 420'});
writeOrder();orderViews();
