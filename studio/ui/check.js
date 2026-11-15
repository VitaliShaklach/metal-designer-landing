/* ---------- вкладка «Проверка» в колонке мастерской (после studio/ui/panel.js; на публичной странице её нет) ----------
   Список ошибок открытой рабочей копии по правилам (studio/js/rules.js), клик по строке — камера летит к месту, грани места подкрашены
   цветом правила (HOOKS.paint страницы). «Исправить» → предпросмотр → «Сделать»; «Отменить» возвращает одну правку.
   Считает фоновый поток (studio/ui/check-worker.js): после каждой правки, и ручной тоже, список пересчитывается сам, страница не замирает.
   Геометрия уходит в поток в мм модели (__studio.toModel), scale = k: пороги и числа в строках — мм сайта.
   Прорези (figure.slots) ведутся по местам (reviewSlots): ручные правки и починка перенумеровывают точки. */
(function(){
  const SD=window.__studio;if(!SD||typeof STUDIO==='undefined'||typeof Worker==='undefined')return;
  const pane=SD.tab('check','Проверка');
  const el=(tag,attrs,text)=>{const e=document.createElement(tag);Object.assign(e,attrs||{});if(text!==undefined)e.textContent=text;return e;};
  const sumEl=el('div',{id:'ckSum'}),doneEl=el('div',{id:'ckDone',hidden:true}),listEl=el('div',{id:'ckList'});pane.append(sumEl,doneEl,listEl);
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
  SD.watch(()=>{const c=SD.cur();gen++;sel='';prev=null;done=null;issues=null;wErr='';
    if(c){const f=c.figure;slotIdx=(f.slots||[]).map(L=>L.slice());slotPts=slotIdx.map(L=>L.map(v=>f.V[v]).filter(Boolean).map(p=>p.slice()));
      if(W)W.postMessage({type:'figure',ref:c.ref,base:c.base});setPaint(null);}
    else{slotPts=[];slotIdx=[];setPaint(null,true);}   // копия закрылась: страница сейчас сама перерисует другую фигуру
    recheck();});

  // ---- действия ----
  function select(i){if(!fresh())return;sel=keyOf(i);prev=null;openG.add(String(i.rule));setPaint(i);fly(i);draw();}
  function askFix(i){const c=SD.cur();if(!c||!W||!fresh())return;prev={id:++seq,wait:true};
    W.postMessage({type:'fix',id:prev.id,gen,E:modelE(),o:opts(c),issue:i,issues});draw();}
  function doFix(i){const c=SD.cur(),E=prev&&prev.res&&prev.res.E;if(!c||!E)return;
    done={text:i.text};prev=null;applying=true;
    try{pushUndo();applyE({V:SD.toPage(E.V),P:E.P,S:E.S||[]});}finally{applying=false;}}

  // ---- вид ----
  function actBox(i){const a=el('div',{className:'ckAct'}),btn=(cls,text,fn)=>{const b=el('button',{type:'button',className:cls},text);b.addEventListener('click',fn);return b;};
    if(!i.fix){a.append(el('div',{className:'ckWhy'},'Это правило программа сама не чинит — поправьте руками'));return a;}
    if(!prev){a.append(btn('ckFix','Исправить',()=>askFix(i)));return a;}
    if(prev.wait){a.append(el('div',{className:'ckWait'},'Считаю правку…'));return a;}
    const r=prev.res;
    if(r.why){a.append(el('div',{className:'ckWhy'},'Починить нельзя: '+r.why));return a;}
    a.append(el('div',{className:'ckPrev'},'Форма уйдёт на '+mm(r.moved)+' мм. После правки до '+(SD.cur()&&SD.cur().ref?'эталона':'открытой фигуры')+' — не дальше '+mm(r.dev)+' мм'));
    if(r.worse&&r.worse.length)a.append(el('div',{className:'ckWorse'},'Но появятся новые ошибки: '+r.worse.map(w=>'«'+w.title+'» (было '+w.was+', станет '+w.now+')').join('; ')));
    const row=el('div',{className:'ckBtns'});row.append(btn('ckDo','Сделать',()=>doFix(i)),btn('ckNo','Не надо',()=>{prev=null;draw();}));a.append(row);return a;}
  function group(id,title,color,rows,render){const g=el('div',{className:'ckGroup'}),h=el('button',{type:'button',className:'ckGH'}),on=openG.has(id);g.dataset.rule=id;
    const sw=el('span',{className:'ckSw'});if(color)sw.style.background=color;else sw.classList.add('none');
    h.append(sw,el('span',{className:'ckGT'},title),el('span',{className:'ckN'},String(rows.length)));h.setAttribute('aria-expanded',String(on));
    h.addEventListener('click',()=>{if(on)openG.delete(id);else openG.add(id);draw();});g.append(h);
    if(on){const box=el('div',{className:'ckRows'});rows.forEach(i=>box.append(render(i)));g.append(box);}return g;}
  function draw(){const c=SD.cur();listEl.textContent='';doneEl.textContent='';doneEl.hidden=!(done&&c);sumEl.classList.toggle('bad',!!wErr);
    if(wErr){sumEl.textContent='Проверка не посчиталась: '+wErr;return;}
    if(!c){sumEl.textContent=NO_COPY;return;}
    if(done){const u=el('button',{type:'button',id:'ckUndo'},'Отменить');u.addEventListener('click',()=>{done=null;undo();});doneEl.append(el('span',{},'Сделано: '+done.text+'. '),u);}
    if(!issues){sumEl.textContent='Считаю…';return;}
    const errs=issues.filter(i=>!i.info),infos=issues.filter(i=>i.info),by=new Map();errs.forEach(i=>{(by.get(i.rule)||by.set(i.rule,[]).get(i.rule)).push(i);});
    sumEl.textContent=(errs.length?'Ошибок: '+errs.length:'Ошибок нет')+(inflight?' · считаю…':'');
    [...by.keys()].sort((a,b)=>a-b).forEach(n=>{const r=ruleOf(n);
      listEl.append(group(String(n),n+'. '+r.title,r.color,by.get(n),i=>{const on=keyOf(i)===sel,it=el('div',{className:'ckItem'}),b=el('button',{type:'button',className:'ckRow'+(on?' on':''),disabled:!fresh()},i.text);   // список старой фигуры не нажимается, пока не пришёл новый
        b.addEventListener('click',()=>select(i));it.append(b);if(on&&fresh())it.append(actBox(i));return it;}));});
    if(infos.length)listEl.append(group('info','Сведения','',infos,i=>el('div',{className:'ckInfo'},i.text)));}

  // для тестов и других вкладок: где камера, какие грани подкрашены
  SD.cam=()=>[...camera.position.toArray(),...controls.target.toArray()];
  SD.painted=()=>paint?[...paint.faces].sort((a,b)=>a-b):[];

  // ---- старт ----
  try{W=new Worker('/studio/ui/check-worker.js');W.onmessage=e=>onMsg(e.data);W.onerror=e=>{wErr=e.message||'фоновый поток не запустился';inflight=0;draw();};
    W.postMessage({type:'init',urls:STUDIO.engine});}catch(e){wErr=e.message;}
  draw();
  SD.api('settings',{}).then(r=>{th=r.th;const c=SD.cur();if(c&&W)W.postMessage({type:'figure',ref:c.ref,base:c.base});recheck();},e=>{wErr=e.message;draw();});
})();
