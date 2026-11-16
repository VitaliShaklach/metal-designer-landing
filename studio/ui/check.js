/* ---------- вкладка «Проверка» в колонке мастерской (после studio/ui/panel.js; на публичной странице её нет) ----------
   Список ошибок открытой рабочей копии по правилам (studio/js/rules.js), клик по строке — камера летит к месту, грани места подкрашены
   цветом правила (HOOKS.paint страницы). «Исправить» → предпросмотр → «Сделать»; «Отменить» возвращает одну правку.
   Считает фоновый поток (studio/ui/check-worker.js): после каждой правки, и ручной тоже, список пересчитывается сам, страница не замирает.
   Геометрия уходит в поток в мм модели (__studio.toModel), scale = k: пороги и числа в строках — мм сайта.
   Прорези (figure.slots) ведутся по местам (reviewSlots): ручные правки и починка перенумеровывают точки.
   По одной (решения Q25, Q31): у выбранной строки «Предыдущая» / «Следующая» — к ближайшей на модели ошибке того же правила, где ещё не были
   (reviewNext); после «Сделать» и «Оставить так» строки нет — те же кнопки стоят над списком (#ckNav), проход идёт от этого места.
   «Оставить так» (Q35, только по одной): место {rule, at, text} — в figure.keep (уходит на диск с автосохранением, checkFigure его больше
   не показывает); группа «Оставлено так», у каждого места «Вернуть».
   «Показать неточности» (Q23, Q30): переключатель, по умолчанию выключен — все места списка на модели сразу, цветом своего правила, и легенда
   «цвет — правило — сколько»; клик по строке легенды оставляет один тип, повторный — все. Грань в нескольких местах — цвет того, что выше в списке.
   Клик по подсвеченной грани на модели (HOOKS.pick) выбирает строку этого места. С «Картой отклонений» вместе не работает (__studio.solo).
   Пачка (Q24, Q28, Q29): «Исправить все ошибки этого типа» у раскрытой группы правила и «Исправить всё безопасное» над списком.
   Поток считает её на копии фигуры (reviewBatch: тот же цикл и суд, что у автоматики, — правка остаётся, только если ни одно правило
   не стало хуже и правило 11 цело), по одной пробе: «Проверяю 37 из 178» и «Стоп». Итог — «Починю N из M, форма уйдёт не больше … мм»
   и причины отказов, «Сделать» / «Отмена»; после «Стоп» — то же для посчитанной части. «Сделать» — один шаг «Отменить» на всю пачку,
   после — «Починено N, осталось M» и причины. Правка фигуры (и «Оставить так») посреди пачки её снимает: считалась для другой фигуры.
   «Здесь криво» (Q20): кнопка, потом клик по поверхности — поток проверяет шар REVIEW_HERE_R мм сайта вокруг места вдвое строже обычного
   (reviewHere; плоскость 0,5 мм при обычном 1). Итог — строки или «По правилам здесь чисто»; строка, которая есть и в списке, выбирает её там,
   остальные подкрашивают свои грани. Одна кнопка — один клик; после правки место перепроверяется само.
   «Карта отклонений» (Q30): переключатель, по умолчанию выключен — каждая грань цветом своего отклонения (reviewDev: от эталона, без него —
   от фигуры, какой её открыли, и это сказано словами), легенда «совпадает … 2 мм и дальше» (reviewMapHex). С «Показать неточности» вместе
   не работает (__studio.solo); выключили — цвета модели как были.
   Пороги: общие (work/settings.json) и свои у фигуры (figure.th) поверх них; поменяли во вкладке «Настройки» — __studio.thChanged, пересчёт. */
(function(){
  const SD=window.__studio;if(!SD||typeof STUDIO==='undefined'||typeof Worker==='undefined')return;
  const pane=SD.tab('check','Проверка');
  const el=(tag,attrs,text)=>{const e=document.createElement(tag);Object.assign(e,attrs||{});if(text!==undefined)e.textContent=text;return e;};
  const sumEl=el('div',{id:'ckSum'}),doneEl=el('div',{id:'ckDone',hidden:true}),navEl=el('div',{id:'ckNav',hidden:true}),listEl=el('div',{id:'ckList'});
  const showL=el('label',{id:'ckShowL',hidden:true}),showIn=el('input',{type:'checkbox',id:'ckShow'}),legEl=el('div',{id:'ckLeg',hidden:true});
  const safeB=el('button',{type:'button',id:'ckSafe',hidden:true},'Исправить всё безопасное'),batchEl=el('div',{id:'ckBatch',hidden:true});
  const mapL=el('label',{id:'ckMapL',hidden:true}),mapIn=el('input',{type:'checkbox',id:'ckMap'}),mapLeg=el('div',{id:'ckMapLeg',hidden:true});
  const hereB=el('button',{type:'button',id:'ckHereB',hidden:true},'Здесь криво'),hereEl=el('div',{id:'ckHere',hidden:true});
  showL.append(showIn,document.createTextNode('Показать неточности'));mapL.append(mapIn,document.createTextNode('Карта отклонений'));
  pane.append(sumEl,showL,legEl,mapL,mapLeg,hereB,hereEl,safeB,doneEl,batchEl,navEl,listEl);
  const NO_COPY='Проверка работает с рабочей копией. Откройте её на вкладке «Фигуры»';
  const ruleOf=n=>RULES.find(r=>r.n===n)||{n,title:'Правило '+n,color:'#888888'};
  const keyOf=i=>autoKey(i)+'@'+i.at.map(x=>Math.round(x*10)).join('_')+'#'+(i.faces||[]).slice().sort((a,b)=>a-b).join('_');
  const mm=x=>fmtN(x,x<10?1:0);
  // цвет места: цвет правила; протыкание (правило 9) — фиолетовый, как на сайте
  const colorOf=i=>i.rule===9&&/протыкает/.test(i.text)?PIERCE_COLOR:ruleOf(i.rule).color;
  const COLS=new Map(),colObj=h=>COLS.get(h)||COLS.set(h,new THREE.Color(h)).get(h);

  let W=null,wErr='',th=null;
  let gen=0,seq=0;            // gen — номер состояния фигуры (растёт с каждой правкой); seq — номера запросов
  let inflight=0,again=false; // идёт пересчёт; пока он шёл, фигура поменялась — пересчитать ещё раз
  let issues=null,igen=-1;    // строки Проверки (null — ещё не считали) и для какой фигуры (gen) они посчитаны: после правки старые не нажимаются
  let sel='',prev=null;       // выбранная строка (keyOf) и её «Исправить»: {id, wait} → {res}
  let done=null,applying=false; // что сделали последним «Сделать» (для «Отменить»)
  let slotPts=[],slotIdx=[];  // прорези: точки, какими они были (мм модели), и номера точек (null — прорези сейчас нет)
  let paint=null;             // подкраска выбранного места: {faces:Set, color:THREE.Color, base: фигура страницы, для которой она, sig} — другая фигура (правка) её не берёт
  let show=false,only=null;   // «Показать неточности» и нажатая строка легенды (номер правила; null — все)
  let over=null;              // её подкраска: {map: грань → THREE.Color, who: грань → место (строка), base, sig}; null — выключена или список не для этой фигуры
  let drawn='',drawnBase=null; // какую подкраску 3D уже показывает и для какой фигуры страницы
  const openG=new Set();      // раскрытые группы
  let batch=null;             // пачка: {id, rules — [n] или null (всё безопасное), phase: 'run' | 'stop' | 'res', k, of, round — прогресс, res — итог потока}
  let walk=null;              // проход по одной: {rule, at — где сейчас, seen — где уже были, back / fwd — для «Предыдущая» и возврата «Следующей»} (места — мм модели)
  let hereOn=false,hereRes=null; // «Здесь криво»: ждём клика по модели; итог {c — место (мм модели), rows — строки или null, пока считается, err}
  let mapOn=false,dmap=null;  // «Карта отклонений»: включена; посчитанная {dev, max, col: грань → THREE.Color, n — граней, base, sig} или {err}
  // запросы карты и «Здесь криво» — по одному, как пересчёт списка: ждём ответа (номер запроса); пока ждали, фигура поменялась — спросить ещё раз
  let devWait=0,devAgain=false,hereWait=0,hereAgain=false;

  const modelE=()=>({V:SD.toModel(ST.base.V),P:ST.base.P,S:ST.base.S||[]});
  const opts=c=>({th:thMerge(th,c.figure.th).th,scale:c.k,kind:c.figure.kind||'stand',slots:c.figure.slots||[],keep:c.figure.keep||[],t:ST.t});
  const selIssue=()=>issues&&sel?issues.find(i=>keyOf(i)===sel)||null:null;
  const fresh=()=>!!issues&&igen===gen;

  // ---- подкраска и камера ----
  // грани места: свои или все грани у его точек (точка → грани — один раз на фигуру страницы; место → грани — один раз на строку)
  let VF=null;const FC=new WeakMap();
  const vfOf=()=>{if(!VF||VF.P!==ST.base.P){const m=new Map();ST.base.P.forEach((Q,f)=>Q.forEach(v=>{(m.get(v)||m.set(v,[]).get(v)).push(f);}));VF={P:ST.base.P,m};}return VF.m;};
  const facesOf=i=>{if(i.faces&&i.faces.length)return i.faces;const c=FC.get(i);if(c&&c.P===ST.base.P)return c.r;
    const m=vfOf(),r=[...new Set((i.verts||[]).flatMap(v=>m.get(v)||[]))].sort((a,b)=>a-b);FC.set(i,{P:ST.base.P,r});return r;};
  // выбранное место — поверх «Показать неточности» и «Карты отклонений» (они вместе не включаются)
  // после правки, пока новая карта считается, видна прежняя (если граней столько же) — модель не мигает обычными цветами, легенда пишет «Считаю…»
  const mapCol=()=>dmap&&dmap.col&&(dmap.base===ST.base||dmap.n===ST.base.P.length)?dmap.col:null;
  HOOKS.paint=pi=>{if(paint&&paint.base===ST.base&&paint.faces.has(pi))return paint.color;const m=mapCol();
    return over&&over.base===ST.base&&over.map.get(pi)||m&&m.get(pi)||null;};
  // 3D перерисовывается, только если подкраска поменялась (или фигура страницы другая, а красить есть что)
  function repaint(quiet){const sig=[paint?paint.sig:'',over?over.sig:'',dmap&&dmap.col?dmap.sig:''].join('|');if(sig===drawn&&(sig==='||'||drawnBase===ST.base))return;
    drawn=sig;drawnBase=ST.base;if(!quiet)renderAll();}
  // при «Показать неточности» выбранное место светлее остальных мест своего правила — иначе его среди них не видно
  const WHITE=new THREE.Color(1,1,1);
  function setPaint(i,quiet){const fs=i?facesOf(i):[],h=i?colorOf(i):'';
    paint=i?{faces:new Set(fs),color:show?colObj(h).clone().lerp(WHITE,.5):colObj(h),base:ST.base,sig:h+(show?'+':'')+':'+fs.join(',')}:null;repaint(quiet);}
  // строки ошибок так, как они идут в списке: по правилам, внутри правила — по порядку
  function errGroups(){const by=new Map();(issues||[]).forEach(i=>{if(!i.info)(by.get(i.rule)||by.set(i.rule,[]).get(i.rule)).push(i);});
    return [...by.keys()].sort((a,b)=>a-b).map(n=>[n,by.get(n)]);}
  // «Показать неточности»: грань берёт цвет первого в списке места, где она есть (только для посчитанного списка этой фигуры)
  function buildOver(){over=null;if(!show||!fresh()||!SD.cur())return;const map=new Map(),who=new Map();
    errGroups().forEach(([n,rows])=>{if(only!==null&&n!==only)return;rows.forEach(i=>{const c=colObj(colorOf(i));facesOf(i).forEach(f=>{if(!map.has(f)){map.set(f,c);who.set(f,i);}});});});
    over={map,who,base:ST.base,sig:[...map].map(([f,c])=>f+':'+c.getHexString()).join(',')};}
  const claim=SD.solo('issues',()=>{if(show)setShow(false);});   // включились — «Карта отклонений» и другие такие переключатели выключаются
  function setShow(v){show=!!v;showIn.checked=show;only=null;if(show)claim();buildOver();setPaint(selIssue());draw();}
  function setOnly(n){only=only===n?null:n;buildOver();repaint();draw();}
  showIn.addEventListener('change',()=>setShow(showIn.checked));
  // клик по подсвеченной грани — строка её места (камера не летит: место и так перед глазами); в режиме правки грань выбирает и редактор
  // Пока список пересчитывается («Оставить так»), подсветка прежняя — клик по ней ничего не выбирает, но и детали страница не выбирает
  // Нажата «Здесь криво» — клик забирает она (и в режиме правки): место — точка поверхности под курсором (pickHit страницы по последнему
  // pointerup: крючок получает только номер грани, а pointerup окна в фазе захвата приходит раньше обработчика холста)
  // Кнопку не видно (другая вкладка, Проверка не посчиталась) — нажатая «Здесь криво» снимается, клик идёт как обычно.
  // В режиме правки клик у точки начинает её перетаскивание и до крючка не доходит — тогда место берёт сам pointerup окна (если мышь не ушла)
  const hereReady=()=>!pane.hidden&&!hereB.hidden&&!!SD.cur()&&!!W&&!!th;
  function hereAt(ev){const p=pickHit(ev);if(!p)return false;hereOn=false;askHere(SD.toModel([p])[0]);return true;}
  let downAt=null;
  window.addEventListener('pointerdown',e=>{downAt={x:e.clientX,y:e.clientY};},true);
  window.addEventListener('pointerup',e=>{if(!hereOn||!ST.drag||e.target!==renderer.domElement||!downAt||Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)>5)return;
    if(hereReady())hereAt(e);else setHere(false);},true);
  let lastUp=null;window.addEventListener('pointerup',e=>{lastUp={clientX:e.clientX,clientY:e.clientY};},true);
  HOOKS.pick=f=>{
    if(hereOn){if(hereReady()){if(lastUp)hereAt(lastUp);return true;}setHere(false);}
    if(!show||!over||over.base!==ST.base)return false;const i=over.who.get(f);if(!i)return false;
    if(fresh()){if(SD.showTab)SD.showTab('check');select(i,true);}return !ST.edit;};
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&hereOn)setHere(false);});
  // «Карта отклонений» (Q30): включилась — «Показать неточности» выключились, и наоборот; цвета — reviewMapHex по отклонению грани
  const claimMap=SD.solo('map',()=>{if(mapOn)setMap(false);});
  function setMap(v){mapOn=!!v;mapIn.checked=mapOn;dmap=null;if(mapOn){claimMap();askDev();}repaint();draw();}
  mapIn.addEventListener('change',()=>setMap(mapIn.checked));
  function askDev(){const c=SD.cur();if(!mapOn||!c||!W)return;if(devWait){devAgain=true;return;}
    devWait=++seq;W.postMessage({type:'dev',id:devWait,gen,E:modelE(),scale:c.k});}
  // цвета — свои на каждую карту (у граней почти все оттенки разные: в общий кеш COLS их не кладём)
  function gotDev(m){const C=new Map(),col=new Map();m.dev.forEach((d,f)=>{const h=reviewMapHex(d);col.set(f,C.get(h)||C.set(h,new THREE.Color(h)).get(h));});
    dmap={dev:m.dev,max:m.max,col,n:m.dev.length,base:ST.base,sig:'m'+m.id};repaint();draw();}
  // «Здесь криво» (Q20): шар REVIEW_HERE_R мм сайта вокруг места, пороги вдвое строже; после правки и «Оставить так» место перепроверяется само
  function setHere(v){hereOn=!!v&&!!SD.cur();draw();}
  hereB.addEventListener('click',()=>setHere(!hereOn));
  function askHere(c){const cc=SD.cur();if(!cc||!W||!th)return;hereRes={c,rows:null};
    if(hereWait)hereAgain=true;else{hereWait=++seq;W.postMessage({type:'here',id:hereWait,gen,E:modelE(),c,o:opts(cc)});}draw();}
  // поток не считает: карта и «Здесь криво» выключаются (их переключателей не видно)
  function offLooks(){mapOn=false;mapIn.checked=false;dmap=null;hereOn=false;hereRes=null;devAgain=hereAgain=false;}
  // строка итога: есть такая же в списке — выбрать её (там «Исправить»), нет (видна только строже) — подкрасить её грани
  function hereRow(i){const c=SD.cur(),m=c&&fresh()&&reviewFind(issues,i.rule,i.at,c.k);if(m)return select(m,true);sel='';prev=null;setPaint(i);draw();}
  // камера — к месту, со стороны его граней; расстояние — по размеру места, но не дальше, чем сейчас
  function fly(i){const c=SD.cur();if(!c)return;const V=ST.base.V,at=SD.toPage([i.at])[0],t=new THREE.Vector3(at[0],at[1],at[2]);
    let n=[0,0,0];facesOf(i).forEach(f=>{const q=polyNorm(V,ST.base.P[f]);n=V3.add(n,q);});
    const dir=V3.len(n)>.3?new THREE.Vector3(...V3.norm(n)):camera.position.clone().sub(controls.target).normalize();
    let r=0;(i.verts||[]).forEach(v=>{if(V[v])r=Math.max(r,V3.len(V3.sub(V[v],at)));});
    const far=camera.position.distanceTo(controls.target),d=Math.max(Math.min(far,Math.max(220,r*4)),r*2.5);
    flyTo(t.clone().add(dir.multiplyScalar(d)),t);}

  // ---- пересчёт ----
  function recheck(E){const c=SD.cur();if(!c||!W||!th){issues=null;inflight=0;again=false;return draw();}
    if(inflight){again=true;return draw();}
    inflight=++seq;W.postMessage({type:'check',id:inflight,gen,E:E||modelE(),o:opts(c)});draw();}
  function onMsg(m){
    if(m.type==='check'){if(m.id!==inflight)return;inflight=0;
      if(again||m.gen!==gen||!SD.cur()){again=false;return recheck();}
      issues=m.issues;igen=m.gen;wErr='';const i=selIssue();if(!i){sel='';prev=null;}
      if(only!==null&&!issues.some(x=>!x.info&&x.rule===only))only=null;   // этого типа больше нет — легенда снова на все
      buildOver();setPaint(i);return draw();}
    if(m.type==='fix'){if(!prev||prev.id!==m.id||m.gen!==gen)return;prev={res:m};return draw();}
    // пачка: на каждую пробу поток ждёт ответа — «дальше», если не нажали «Стоп»
    if(m.type==='progress'){if(!batch||batch.id!==m.id)return;if(m.gen!==gen){dropBatch();return draw();}
      batch.k=m.k;batch.of=m.of;batch.round=m.round;if(batch.phase==='run')W.postMessage({type:'more',id:m.id});return drawBatch();}
    if(m.type==='batch'){if(!batch||batch.id!==m.id)return;if(m.gen!==gen){batch=null;return draw();}batch.phase='res';batch.res=m;return draw();}
    // «Здесь криво» и карта: ответ на последний запрос; фигура с тех пор поменялась — уже спросили заново (HOOKS.changed)
    if(m.type==='here'||m.type==='error'&&m.of==='here'){if(m.id!==hereWait)return;hereWait=0;if(!hereRes){hereAgain=false;return;}
      if(hereAgain||m.gen!==gen){hereAgain=false;return askHere(hereRes.c);}
      if(m.type==='here')hereRes.rows=m.issues;else hereRes.err=m.error;return draw();}
    if(m.type==='dev'||m.type==='error'&&m.of==='dev'){if(m.id!==devWait)return;devWait=0;if(!mapOn){devAgain=false;return;}
      if(devAgain||m.gen!==gen){devAgain=false;return askDev();}
      if(m.type==='dev')return gotDev(m);dmap={err:m.error};repaint();return draw();}
    if(m.type==='error'){
      if(m.of==='batch'){if(batch&&batch.id===m.id){batch.phase='res';batch.res={err:m.error};draw();}return;}
      if(m.of==='fix'){if(prev&&prev.id===m.id){prev={res:{why:'правка не вышла: '+m.error,worse:[]}};draw();}return;}
      if(m.of==='check'&&m.id===inflight){inflight=0;issues=null;wErr=m.error;offLooks();buildOver();repaint();if(again){again=false;return recheck();}}
      draw();}}

  // прорези — по местам: после любой правки находим их заново и пишем номера точек в фигуру (уйдут на диск с автосохранением)
  function trackSlots(E){const c=SD.cur();if(!c)return;const r=reviewSlots(E,slotPts,c.k,slotIdx);slotPts=r.pts;slotIdx=r.idx;c.figure.slots=r.slots;}

  HOOKS.changed.push(()=>{gen++;prev=null;if(!applying)done=null;dropBatch();if(ST.drag||!SD.cur())return draw();
    const E=modelE();trackSlots(E);recheck(E);reLook();});
  // поменялась фигура (или места «Оставить так») — карта и «Здесь криво» пересчитываются для неё
  function reLook(){if(mapOn)askDev();if(hereRes)askHere(hereRes.c);}
  SD.watch(()=>{const c=SD.cur();gen++;sel='';prev=null;done=null;dropBatch();issues=null;wErr='';walk=null;show=false;only=null;over=null;showIn.checked=false;
    offLooks();
    if(c){const f=c.figure;slotIdx=(f.slots||[]).map(L=>L.slice());slotPts=slotIdx.map(L=>L.map(v=>f.V[v]).filter(Boolean).map(p=>p.slice()));
      if(W)W.postMessage({type:'figure',ref:c.ref,base:c.base});setPaint(null);}
    else{slotPts=[];slotIdx=[];setPaint(null,true);}   // копия закрылась: страница сейчас сама перерисует другую фигуру
    recheck();});

  // ---- действия ----
  function go(i,still){sel=keyOf(i);prev=null;openG.add(String(i.rule));setPaint(i);if(!still)fly(i);draw();
    const r=listEl.querySelector('.ckRow.on');if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'});}
  // клик по строке: то же правило — шаг прохода (его можно вернуть «Предыдущей»), другое — новый проход
  const beenAt=(i,k)=>walk.seen.some(q=>reviewSame(i,q,k));
  function select(i,still){if(!fresh())return;const k=SD.cur().k;
    if(walk&&walk.rule===i.rule){if(!reviewSame(i,walk.at,k)){walk.back.push(walk.at);walk.fwd=[];}}else walk={rule:i.rule,seen:[],back:[],fwd:[]};
    walk.at=i.at;if(!beenAt(i,k))walk.seen.push(i.at);go(i,still);}
  // куда ведут кнопки: «Следующая» — сначала туда, откуда вернулись «Предыдущей», иначе ближайшая, где ещё не были; «Предыдущая» — назад по шагам
  // (починенные места пропускаются)
  function target(dir){if(!walk||!fresh())return null;const k=SD.cur().k,st=dir<0?walk.back:walk.fwd;
    for(let j=st.length-1;j>=0;j--){const t=reviewFind(issues,walk.rule,st[j],k);if(t)return {t,j};}
    return dir<0?null:{t:reviewNext(issues,walk.rule,walk.at,walk.seen,k),j:-1};}
  function step(dir){const g=target(dir);if(!g||!g.t)return;const k=SD.cur().k,st=dir<0?walk.back:walk.fwd,other=dir<0?walk.fwd:walk.back;
    st.length=Math.max(g.j,0);   // места выше найденного (и всё, если шли к новой) — уже починены
    other.push(walk.at);walk.at=g.t.at;if(!beenAt(g.t,k))walk.seen.push(g.t.at);go(g.t);}
  // «Оставить так» и «Вернуть»: поменялись места keep — список прежней фигуры уже не тот (gen), пересчёт и запись
  function setKeep(K){const c=SD.cur();if(!c)return;c.figure.keep=K;gen++;prev=null;dropBatch();SD.touch();recheck();if(hereRes)askHere(hereRes.c);}
  // поменялись пороги («Настройки», studio/ui/settings.js): common — новые общие (без него поменялись только пороги фигуры, figure.th).
  // Как с «Оставить так»: список, предпросмотр, пачка и «Здесь криво» посчитаны по старым порогам — пересчёт; карта от порогов не зависит
  SD.thChanged=common=>{if(common)th=common;gen++;prev=null;dropBatch();recheck();if(hereRes)askHere(hereRes.c);};
  function keepIt(i){const c=SD.cur();if(!c||!fresh())return;
    setKeep((c.figure.keep||[]).concat([{rule:i.rule,at:i.at.map(x=>Math.round(x*1e6)/1e6),text:i.text}]));}
  // вернули место — проход снова к нему зайдёт
  function unkeep(n){const c=SD.cur();if(!c)return;const K=c.figure.keep||[],k=K[n];
    if(walk&&k&&k.rule===walk.rule)walk.seen=walk.seen.filter(q=>!reviewSame({at:q},k.at,c.k));setKeep(K.filter((_,j)=>j!==n));}
  function askFix(i){const c=SD.cur();if(!c||!W||!fresh())return;prev={id:++seq,wait:true};
    W.postMessage({type:'fix',id:prev.id,gen,E:modelE(),o:opts(c),issue:i,issues});draw();}
  function doFix(i){const c=SD.cur(),E=prev&&prev.res&&prev.res.E;if(!c||!E)return;
    done={text:i.text};prev=null;applying=true;
    try{pushUndo();applyE({V:SD.toPage(E.V),P:E.P,S:E.S||[]});}finally{applying=false;}}
  // пачка: rules — [n] («Исправить все ошибки этого типа») или null («Исправить всё безопасное»); одна за раз
  function askBatch(rules){const c=SD.cur();if(!c||!W||!fresh()||batch)return;prev=null;
    batch={id:++seq,rules,phase:'run',k:0,of:0,round:0,res:null};
    W.postMessage({type:'batch',id:batch.id,gen,E:modelE(),o:opts(c),rules});draw();}
  function stopBatch(){if(!batch||batch.phase!=='run')return;batch.phase='stop';W.postMessage({type:'stop',id:batch.id});drawBatch();}
  // снять пачку: поток бросает расчёт, итог не придёт
  function dropBatch(){if(batch&&batch.phase!=='res'&&W)W.postMessage({type:'drop',id:batch.id});batch=null;}
  function doBatch(){const c=SD.cur(),r=batch&&batch.res,E=r&&r.E;if(!c||!E)return;
    done={text:'пачка',batch:{fixed:r.fixed,left:r.left,reasons:r.reasons||[]}};batch=null;prev=null;applying=true;
    try{pushUndo();applyE({V:SD.toPage(E.V),P:E.P,S:E.S||[]});}finally{applying=false;}}

  // ---- вид ----
  const btn=(cls,text,fn)=>{const b=el('button',{type:'button',className:cls},text);b.addEventListener('click',fn);return b;};
  // «Предыдущая» / «Следующая» — у выбранной строки или над списком (#ckNav)
  function navRow(p,n){const row=el('div',{className:'ckBtns ckNavB'}),b=btn('ckGoPrev','Предыдущая',()=>step(-1)),f=btn('ckGoNext','Следующая',()=>step(1));
    b.disabled=!(p&&p.t);f.disabled=!(n&&n.t);if(f.disabled&&walk)f.title='Это последняя ошибка правила '+walk.rule;row.append(b,f);return row;}
  function actBox(i){const a=el('div',{className:'ckAct'});fixBox(i,a);a.append(btn('ckKeep','Оставить так',()=>keepIt(i)),navRow(target(-1),target(1)));return a;}
  function fixBox(i,a){
    if(!i.fix){a.append(el('div',{className:'ckWhy'},'Это правило программа сама не чинит — поправьте руками'));return a;}
    if(!prev){a.append(btn('ckFix','Исправить',()=>askFix(i)));return a;}
    if(prev.wait){a.append(el('div',{className:'ckWait'},'Считаю правку…'));return a;}
    const r=prev.res;
    if(r.why){a.append(el('div',{className:'ckWhy'},'Починить нельзя: '+r.why));return a;}
    a.append(el('div',{className:'ckPrev'},'Форма уйдёт на '+mm(r.moved)+' мм. После правки до '+(SD.cur()&&SD.cur().ref?'эталона':'открытой фигуры')+' — не дальше '+mm(r.dev)+' мм'));
    if(r.worse&&r.worse.length)a.append(el('div',{className:'ckWorse'},'Но появятся новые ошибки: '+r.worse.map(w=>'«'+w.title+'» (было '+w.was+', станет '+w.now+')').join('; ')));
    const row=el('div',{className:'ckBtns'});row.append(btn('ckDo','Сделать',()=>doFix(i)),btn('ckNo','Не надо',()=>{prev=null;draw();}));a.append(row);return a;}
  function navBar(){if(!walk||!fresh()||selIssue())return;const p=target(-1),n=target(1);if(!(p&&p.t)&&!(n&&n.t))return;
    navEl.hidden=false;navEl.append(el('span',{className:'ckNavT'},'По очереди: '+walk.rule+'. '+ruleOf(walk.rule).title),navRow(p,n));}
  // причины отказов пачки: «причина — 3 места»; больше REASONS_MAX — «и ещё …»
  const REASONS_MAX=8,places=n=>n%10===1&&n%100!==11?'место':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'места':'мест';
  function whyList(box,R,title){if(!R||!R.length)return;box.append(el('div',{className:'ckBWhyT'},title));
    R.slice(0,REASONS_MAX).forEach(x=>box.append(el('div',{className:'ckBWhy'},x.why+(x.n>1?' — '+x.n+' '+places(x.n):''))));
    if(R.length>REASONS_MAX)box.append(el('div',{className:'ckBWhyT'},'и ещё причин: '+(R.length-REASONS_MAX)));}
  function drawBatch(){batchEl.textContent='';batchEl.hidden=!batch;if(!batch)return;const b=batch,r=b.res;
    batchEl.append(el('div',{className:'ckBT'},b.rules?'Все ошибки «'+b.rules[0]+'. '+ruleOf(b.rules[0]).title+'»':'Всё безопасное'));
    if(b.phase!=='res'){const row=el('div',{className:'ckBtns'}),t=b.phase==='stop'?'Останавливаю, проверяю посчитанное…':
        !b.of?'Считаю…':(b.round?'Проход '+(b.round+1)+': проверяю ':'Проверяю ')+Math.min(b.k+1,b.of)+' из '+b.of;
      row.append(el('span',{className:'ckBProg'},t));if(b.phase==='run')row.append(btn('ckStop','Стоп',stopBatch));batchEl.append(row);return;}
    const row=el('div',{className:'ckBtns'});
    if(r.err)batchEl.append(el('div',{className:'ckWhy'},'Пачка не посчиталась: '+r.err));
    else{const head=r.stopped?'Остановлено: '+(b.round?'проход '+(b.round+1)+', ':'')+'проверено '+Math.min(b.k,b.of)+' из '+b.of+'. ':'';
      batchEl.append(el('div',{className:'ckBRes'},head+(r.E?'Починю '+r.fixed+' из '+r.of+', форма уйдёт не больше '+mm(r.moved)+' мм':
        r.stopped?'Пока ничего не починено':r.of?'Починить не выйдет ни одной из '+r.of:'Чинить нечего')));
      whyList(batchEl,r.reasons,'Не починю:');if(r.E)row.append(btn('ckBDo','Сделать',doBatch));}
    row.append(btn('ckBNo',r.E?'Отмена':'Закрыть',()=>{batch=null;draw();}));batchEl.append(row);}
  function group(id,title,color,rows,render,top){const g=el('div',{className:'ckGroup'}),h=el('button',{type:'button',className:'ckGH'}),on=openG.has(id);g.dataset.rule=id;
    const sw=el('span',{className:'ckSw'});if(color)sw.style.background=color;else sw.classList.add('none');
    h.append(sw,el('span',{className:'ckGT'},title),el('span',{className:'ckN'},String(rows.length)));h.setAttribute('aria-expanded',String(on));
    h.addEventListener('click',()=>{if(on)openG.delete(id);else openG.add(id);draw();});g.append(h);
    if(on){const box=el('div',{className:'ckRows'});if(top)box.append(top);rows.forEach(i=>box.append(render(i)));g.append(box);}return g;}
  // легенда: строка на правило — цвет (у правила 9 — и протыкание), правило, сколько; нажата — на модели только этот тип.
  // Список старой фигуры — легенда не нажимается, пока не пришёл новый
  function legend(G){legEl.textContent='';legEl.hidden=!(show&&G.length);if(legEl.hidden)return;
    G.forEach(([n,rows])=>{const r=ruleOf(n),b=el('button',{type:'button',className:'ckLg'+(only===n?' on':only!==null?' off':''),disabled:!fresh()});b.dataset.rule=String(n);b.setAttribute('aria-pressed',String(only===n));
      [...new Set(rows.map(colorOf))].forEach(c=>{const sw=el('span',{className:'ckSw'});sw.style.background=c;b.append(sw);});
      b.append(el('span',{className:'ckLgT'},n+'. '+r.title),el('span',{className:'ckLgN'},String(rows.length)));
      b.title=only===n?'Показать все типы':'Показать на модели только этот тип';b.addEventListener('click',()=>setOnly(n));legEl.append(b);});}
  // легенда карты: полоса цветов «совпадает … REVIEW_MAP_MAX мм и дальше», с чем сравниваю, насколько дальше всего ушла
  function drawMap(){mapLeg.textContent='';mapLeg.hidden=!(mapOn&&SD.cur()&&!wErr);if(mapLeg.hidden)return;
    const bar=el('div',{className:'ckMapBar'}),sc=el('div',{className:'ckMapScale'}),mx=REVIEW_MAP_MAX;
    bar.style.background='linear-gradient(90deg,'+[0,mx/2,mx].map(reviewMapHex).join(',')+')';
    sc.append(el('span',{},'совпадает'),el('span',{},fmtN(mx/2)+' мм'),el('span',{},fmtN(mx)+' мм и дальше'));
    const d=dmap&&dmap.base===ST.base?dmap:null;
    mapLeg.append(bar,sc,el('div',{className:'ckMapNote'},SD.cur().ref?'Сравниваю с эталоном':'Эталона нет: сравниваю с фигурой, какой её открыли'),
      el('div',{className:'ckMapMax'+(dmap&&dmap.err?' bad':'')},dmap&&dmap.err?'Карта не посчиталась: '+dmap.err:!d?'Считаю…':d.max<.05?'Всё совпадает':'Дальше всего — '+mm(d.max)+' мм'));}
  // «Здесь криво»: ждём клика; итог — строки или «по правилам здесь чисто»
  function drawHere(){const c=SD.cur();hereEl.textContent='';hereB.classList.toggle('on',hereOn);hereB.setAttribute('aria-pressed',String(hereOn));
    hereEl.hidden=!(c&&!wErr&&(hereOn||hereRes));if(hereEl.hidden)return;
    if(hereOn)hereEl.append(el('div',{className:'ckHereT'},'Кликните по месту на модели: проверю шар '+REVIEW_HERE_R+' мм вокруг вдвое строже обычного'));
    if(!hereRes)return;const r=hereRes;
    if(r.err)hereEl.append(el('div',{className:'ckWhy'},'Не посчиталось: '+r.err));
    else if(!r.rows)hereEl.append(el('div',{className:'ckHereRes'},'Проверяю место…'));
    else{hereEl.append(el('div',{className:'ckHereRes'},r.rows.length?'Строже обычного здесь найдено: '+r.rows.length:'По правилам здесь чисто'));
      r.rows.forEach(i=>hereEl.append(btn('ckHereRow',i.rule+'. '+ruleOf(i.rule).title+': '+i.text,()=>hereRow(i))));}
    hereEl.append(btn('ckHereX','Закрыть',()=>{hereRes=null;hereOn=false;setPaint(selIssue());draw();}));}
  function draw(){const c=SD.cur();listEl.textContent='';doneEl.textContent='';doneEl.hidden=!(done&&c);navEl.textContent='';navEl.hidden=true;sumEl.classList.toggle('bad',!!wErr);
    showL.hidden=!c||!!wErr;if(showL.hidden||!issues)legend([]);mapL.hidden=hereB.hidden=showL.hidden;drawBatch();drawMap();drawHere();
    safeB.hidden=!c||!!wErr||!issues||!issues.some(i=>!i.info&&AUTO_ORDER.includes(i.rule));safeB.disabled=!fresh()||!!batch;
    if(wErr){sumEl.textContent='Проверка не посчиталась: '+wErr;return;}
    if(!c){sumEl.textContent=NO_COPY;return;}
    if(done){const u=el('button',{type:'button',id:'ckUndo'},'Отменить');u.addEventListener('click',()=>{done=null;undo();});
      const d=done.batch;doneEl.append(el('span',{},d?'Починено '+d.fixed+', осталось '+d.left+'. ':'Сделано: '+done.text+'. '),u);if(d)whyList(doneEl,d.reasons,'Не починено:');}
    if(!issues){sumEl.textContent='Считаю…';return;}
    const G=errGroups(),errs=issues.filter(i=>!i.info),infos=issues.filter(i=>i.info);legend(G);
    sumEl.textContent=(errs.length?'Ошибок: '+errs.length:'Ошибок нет')+(inflight?' · считаю…':'');
    G.forEach(([n,rows])=>{const r=ruleOf(n);
      const all=AUTO_ORDER.includes(n)?btn('ckAll','Исправить все ошибки этого типа',()=>askBatch([n])):null;if(all)all.disabled=!fresh()||!!batch;
      listEl.append(group(String(n),n+'. '+r.title,r.color,rows,i=>{const on=keyOf(i)===sel,it=el('div',{className:'ckItem'}),b=el('button',{type:'button',className:'ckRow'+(on?' on':''),disabled:!fresh()},i.text);   // список старой фигуры не нажимается, пока не пришёл новый
        b.addEventListener('click',()=>select(i));it.append(b);if(on&&fresh())it.append(actBox(i));return it;},all));});
    const K=c.figure.keep||[];
    if(K.length)listEl.append(group('keep','Оставлено так','',K.map((k,n)=>({k,n})),({k,n})=>{const r=el('div',{className:'ckKept'});
      r.append(el('span',{className:'ckKT'},k.rule+'. '+(k.text||ruleOf(k.rule).title)),btn('ckUnkeep','Вернуть',()=>unkeep(n)));return r;}));
    if(infos.length)listEl.append(group('info','Сведения','',infos,i=>el('div',{className:'ckInfo'},i.text)));
    navBar();}

  // для тестов и других вкладок: где камера, какие грани подкрашены
  SD.cam=()=>[...camera.position.toArray(),...controls.target.toArray()];
  SD.painted=()=>paint?[...paint.faces].sort((a,b)=>a-b):[];
  SD.marked=()=>over&&over.base===ST.base?[...over.map.keys()].sort((a,b)=>a-b):[];   // грани «Показать неточности»
  SD.mapDev=()=>{const d=dmap&&dmap.dev&&dmap.base===ST.base?dmap:null;return d&&mapOn?d.dev.slice():null;};   // «Карта отклонений»: мм сайта по граням
  SD.picked=()=>{const i=selIssue();return i&&SD.cur()?SD.toPage([i.at])[0]:null;};   // место выбранной строки, мм сайта

  safeB.addEventListener('click',()=>askBatch(null));

  // ---- старт ----
  try{W=new Worker('/studio/ui/check-worker.js');W.onmessage=e=>onMsg(e.data);W.onerror=e=>{wErr=e.message||'фоновый поток не запустился';inflight=0;issues=null;batch=null;offLooks();buildOver();repaint();draw();};
    W.postMessage({type:'init',urls:STUDIO.engine});}catch(e){wErr=e.message;}
  draw();
  SD.api('settings',{}).then(r=>{th=r.th;const c=SD.cur();if(c&&W)W.postMessage({type:'figure',ref:c.ref,base:c.base});recheck();},e=>{wErr=e.message;draw();});
})();
