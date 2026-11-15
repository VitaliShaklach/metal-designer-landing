/* ---------- вкладка «Проверка» в колонке мастерской (после studio/ui/panel.js; на публичной странице её нет) ----------
   Список ошибок открытой рабочей копии по правилам (studio/js/rules.js), клик по строке — камера летит к месту, грани места подкрашены
   цветом правила (HOOKS.paint страницы). «Исправить» → предпросмотр → «Сделать»; «Отменить» возвращает одну правку.
   Считает фоновый поток (studio/ui/check-worker.js): после каждой правки, и ручной тоже, список пересчитывается сам, страница не замирает.
   Геометрия уходит в поток в мм модели (__studio.toModel), scale = k: пороги и числа в строках — мм сайта.
   Прорези (figure.slots) ведутся по местам (reviewSlots): ручные правки и починка перенумеровывают точки.
   По одной (решения Q25, Q31): у выбранной строки «Предыдущая» / «Следующая» — к ближайшей на модели ошибке того же правила, где ещё не были
   (reviewNext); после «Сделать» и «Оставить так» строки нет — те же кнопки стоят над списком (#ckNav), проход идёт от этого места.
   «Оставить так» (Q35, только по одной): место {rule, at, text} — в figure.keep (уходит на диск с автосохранением, checkFigure его больше
   не показывает); группа «Оставлено так», у каждого места «Вернуть». */
(function(){
  const SD=window.__studio;if(!SD||typeof STUDIO==='undefined'||typeof Worker==='undefined')return;
  const pane=SD.tab('check','Проверка');
  const el=(tag,attrs,text)=>{const e=document.createElement(tag);Object.assign(e,attrs||{});if(text!==undefined)e.textContent=text;return e;};
  const sumEl=el('div',{id:'ckSum'}),doneEl=el('div',{id:'ckDone',hidden:true}),navEl=el('div',{id:'ckNav',hidden:true}),listEl=el('div',{id:'ckList'});pane.append(sumEl,doneEl,navEl,listEl);
  const NO_COPY='Проверка работает с рабочей копией. Откройте её на вкладке «Фигуры»',VIOLET='#9b3fd6';
  const ruleOf=n=>RULES.find(r=>r.n===n)||{n,title:'Правило '+n,color:'#888888'};
  const keyOf=i=>autoKey(i)+'@'+i.at.map(x=>Math.round(x*10)).join('_')+'#'+(i.faces||[]).slice().sort((a,b)=>a-b).join('_');
  const mm=x=>fmtN(x,x<10?1:0);
  // цвет места: цвет правила; протыкание (правило 9) — фиолетовый, как на сайте
  const colorOf=i=>i.rule===9&&/протыкает/.test(i.text)?VIOLET:ruleOf(i.rule).color;

  let W=null,wErr='',th=null;
  let gen=0,seq=0;            // gen — номер состояния фигуры (растёт с каждой правкой); seq — номера запросов
  let inflight=0,again=false; // идёт пересчёт; пока он шёл, фигура поменялась — пересчитать ещё раз
  let issues=null,igen=-1;    // строки Проверки (null — ещё не считали) и для какой фигуры (gen) они посчитаны: после правки старые не нажимаются
  let sel='',prev=null;       // выбранная строка (keyOf) и её «Исправить»: {id, wait} → {res}
  let done=null,applying=false; // что сделали последним «Сделать» (для «Отменить»)
  let slotPts=[],slotIdx=[];  // прорези: точки, какими они были (мм модели), и номера точек (null — прорези сейчас нет)
  let paint=null,paintSig=''; // подкраска: {faces:Set, color:THREE.Color, base: фигура страницы, для которой она} — другая фигура (правка) её не берёт
  const openG=new Set();      // раскрытые группы
  let walk=null;              // проход по одной: {rule, at — где сейчас, seen — где уже были, back / fwd — для «Предыдущая» и возврата «Следующей»} (места — мм модели)

  const modelE=()=>({V:SD.toModel(ST.base.V),P:ST.base.P,S:ST.base.S||[]});
  const opts=c=>({th:Object.assign({},th||{},c.figure.th||{}),scale:c.k,kind:c.figure.kind||'stand',slots:c.figure.slots||[],keep:c.figure.keep||[],t:ST.t});
  const selIssue=()=>issues&&sel?issues.find(i=>keyOf(i)===sel)||null:null;
  const fresh=()=>!!issues&&igen===gen;

  // ---- подкраска и камера ----
  const facesOf=i=>{if(i.faces&&i.faces.length)return i.faces;const vs=new Set(i.verts||[]),r=[];ST.base.P.forEach((Q,f)=>{if(Q.some(v=>vs.has(v)))r.push(f);});return r;};
  HOOKS.paint=pi=>paint&&paint.base===ST.base&&paint.faces.has(pi)?paint.color:null;
  function setPaint(i,quiet){const fs=i?facesOf(i):[],sig=i?colorOf(i)+':'+fs.join(','):'';if(sig===paintSig)return;
    paintSig=sig;paint=i?{faces:new Set(fs),color:new THREE.Color(colorOf(i)),base:ST.base}:null;if(!quiet)renderAll();}
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
      issues=m.issues;igen=m.gen;wErr='';const i=selIssue();if(!i){sel='';prev=null;}setPaint(i);return draw();}
    if(m.type==='fix'){if(!prev||prev.id!==m.id||m.gen!==gen)return;prev={res:m};return draw();}
    if(m.type==='error'){
      if(m.of==='fix'){if(prev&&prev.id===m.id){prev={res:{why:'правка не вышла: '+m.error,worse:[]}};draw();}return;}
      if(m.of==='check'&&m.id===inflight){inflight=0;issues=null;wErr=m.error;if(again){again=false;return recheck();}}
      draw();}}

  // прорези — по местам: после любой правки находим их заново и пишем номера точек в фигуру (уйдут на диск с автосохранением)
  function trackSlots(E){const c=SD.cur();if(!c)return;const r=reviewSlots(E,slotPts,c.k,slotIdx);slotPts=r.pts;slotIdx=r.idx;c.figure.slots=r.slots;}

  HOOKS.changed.push(()=>{gen++;prev=null;if(!applying)done=null;if(ST.drag||!SD.cur())return draw();
    const E=modelE();trackSlots(E);recheck(E);});
  SD.watch(()=>{const c=SD.cur();gen++;sel='';prev=null;done=null;issues=null;wErr='';walk=null;
    if(c){const f=c.figure;slotIdx=(f.slots||[]).map(L=>L.slice());slotPts=slotIdx.map(L=>L.map(v=>f.V[v]).filter(Boolean).map(p=>p.slice()));
      if(W)W.postMessage({type:'figure',ref:c.ref,base:c.base});setPaint(null);}
    else{slotPts=[];slotIdx=[];setPaint(null,true);}   // копия закрылась: страница сейчас сама перерисует другую фигуру
    recheck();});

  // ---- действия ----
  function go(i){sel=keyOf(i);prev=null;openG.add(String(i.rule));setPaint(i);fly(i);draw();
    const r=listEl.querySelector('.ckRow.on');if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'});}
  // клик по строке: то же правило — шаг прохода (его можно вернуть «Предыдущей»), другое — новый проход
  const beenAt=(i,k)=>walk.seen.some(q=>reviewSame(i,q,k));
  function select(i){if(!fresh())return;const k=SD.cur().k;
    if(walk&&walk.rule===i.rule){if(!reviewSame(i,walk.at,k)){walk.back.push(walk.at);walk.fwd=[];}}else walk={rule:i.rule,seen:[],back:[],fwd:[]};
    walk.at=i.at;if(!beenAt(i,k))walk.seen.push(i.at);go(i);}
  // куда ведут кнопки: «Следующая» — сначала туда, откуда вернулись «Предыдущей», иначе ближайшая, где ещё не были; «Предыдущая» — назад по шагам
  // (починенные места пропускаются)
  function target(dir){if(!walk||!fresh())return null;const k=SD.cur().k,st=dir<0?walk.back:walk.fwd;
    for(let j=st.length-1;j>=0;j--){const t=reviewFind(issues,walk.rule,st[j],k);if(t)return {t,j};}
    return dir<0?null:{t:reviewNext(issues,walk.rule,walk.at,walk.seen,k),j:-1};}
  function step(dir){const g=target(dir);if(!g||!g.t)return;const k=SD.cur().k,st=dir<0?walk.back:walk.fwd,other=dir<0?walk.fwd:walk.back;
    st.length=Math.max(g.j,0);   // места выше найденного (и всё, если шли к новой) — уже починены
    other.push(walk.at);walk.at=g.t.at;if(!beenAt(g.t,k))walk.seen.push(g.t.at);go(g.t);}
  // «Оставить так» и «Вернуть»: поменялись места keep — список прежней фигуры уже не тот (gen), пересчёт и запись
  function setKeep(K){const c=SD.cur();if(!c)return;c.figure.keep=K;gen++;prev=null;SD.touch();recheck();}
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
  function group(id,title,color,rows,render){const g=el('div',{className:'ckGroup'}),h=el('button',{type:'button',className:'ckGH'}),on=openG.has(id);g.dataset.rule=id;
    const sw=el('span',{className:'ckSw'});if(color)sw.style.background=color;else sw.classList.add('none');
    h.append(sw,el('span',{className:'ckGT'},title),el('span',{className:'ckN'},String(rows.length)));h.setAttribute('aria-expanded',String(on));
    h.addEventListener('click',()=>{if(on)openG.delete(id);else openG.add(id);draw();});g.append(h);
    if(on){const box=el('div',{className:'ckRows'});rows.forEach(i=>box.append(render(i)));g.append(box);}return g;}
  function draw(){const c=SD.cur();listEl.textContent='';doneEl.textContent='';doneEl.hidden=!(done&&c);navEl.textContent='';navEl.hidden=true;sumEl.classList.toggle('bad',!!wErr);
    if(wErr){sumEl.textContent='Проверка не посчиталась: '+wErr;return;}
    if(!c){sumEl.textContent=NO_COPY;return;}
    if(done){const u=el('button',{type:'button',id:'ckUndo'},'Отменить');u.addEventListener('click',()=>{done=null;undo();});doneEl.append(el('span',{},'Сделано: '+done.text+'. '),u);}
    if(!issues){sumEl.textContent='Считаю…';return;}
    const errs=issues.filter(i=>!i.info),infos=issues.filter(i=>i.info),by=new Map();errs.forEach(i=>{(by.get(i.rule)||by.set(i.rule,[]).get(i.rule)).push(i);});
    sumEl.textContent=(errs.length?'Ошибок: '+errs.length:'Ошибок нет')+(inflight?' · считаю…':'');
    [...by.keys()].sort((a,b)=>a-b).forEach(n=>{const r=ruleOf(n);
      listEl.append(group(String(n),n+'. '+r.title,r.color,by.get(n),i=>{const on=keyOf(i)===sel,it=el('div',{className:'ckItem'}),b=el('button',{type:'button',className:'ckRow'+(on?' on':''),disabled:!fresh()},i.text);   // список старой фигуры не нажимается, пока не пришёл новый
        b.addEventListener('click',()=>select(i));it.append(b);if(on&&fresh())it.append(actBox(i));return it;}));});
    const K=c.figure.keep||[];
    if(K.length)listEl.append(group('keep','Оставлено так','',K.map((k,n)=>({k,n})),({k,n})=>{const r=el('div',{className:'ckKept'});
      r.append(el('span',{className:'ckKT'},k.rule+'. '+(k.text||ruleOf(k.rule).title)),btn('ckUnkeep','Вернуть',()=>unkeep(n)));return r;}));
    if(infos.length)listEl.append(group('info','Сведения','',infos,i=>el('div',{className:'ckInfo'},i.text)));
    navBar();}

  // для тестов и других вкладок: где камера, какие грани подкрашены
  SD.cam=()=>[...camera.position.toArray(),...controls.target.toArray()];
  SD.painted=()=>paint?[...paint.faces].sort((a,b)=>a-b):[];
  SD.picked=()=>{const i=selIssue();return i&&SD.cur()?SD.toPage([i.at])[0]:null;};   // место выбранной строки, мм сайта

  // ---- старт ----
  try{W=new Worker('/studio/ui/check-worker.js');W.onmessage=e=>onMsg(e.data);W.onerror=e=>{wErr=e.message||'фоновый поток не запустился';inflight=0;draw();};
    W.postMessage({type:'init',urls:STUDIO.engine});}catch(e){wErr=e.message;}
  draw();
  SD.api('settings',{}).then(r=>{th=r.th;const c=SD.cur();if(c&&W)W.postMessage({type:'figure',ref:c.ref,base:c.base});recheck();},e=>{wErr=e.message;draw();});
})();
