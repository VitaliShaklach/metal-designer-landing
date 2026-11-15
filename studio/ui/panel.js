/* ---------- панель мастерской (вкладывает сервер, studio/server.js; на публичной странице её нет) ----------
   Колонка слева: заголовок (сворачивает), строка состояния #stNow, вкладки. Вкладка «Фигуры»: «Мои фигуры» (рабочие копии, «×» — в корзину),
   «Взять фигуру с сайта» (копией). Другие вкладки добавляются через window.__studio.tab(id, title).
   Автосохранение не позже чем через 500 мс после любой правки.
   Геометрия в figure.json — в рамке модели; страница живёт в мм сайта и ставит фигуру по-своему (fitMesh: x — по центру, низ y = 0, z от 0,
   масштаб по каждой оси свой — размеры округлены до мм): V_страницы = (V_модели − mo) × s + po. Пересчёт запоминается при открытии (cur.map);
   k = s по высоте — масштаб для порогов Проверки и истории шагов. */
(function(){
  if(typeof STUDIO==='undefined'||typeof HOOKS==='undefined')return;
  const S=STUDIO;let cur=null,timer=0,saving=null,dirty=false;
  let busy=false,state='',shown='',lastL={figures:[],published:[]},opening='',openSeq=0;   // busy — идёт копия или удаление; state — что с записью; shown — какая фигура помечена «открыта»; opening — какую открываем
  const SITE='На экране фигура с сайта. Её правки не сохраняются',TRASH='studio/work/.trash';

  const api=(cmd,body)=>fetch('/api/'+cmd,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':S.token},body:JSON.stringify(body||{})})
    .then(r=>r.json().then(j=>{if(!r.ok)throw new Error(j.error||('ошибка '+r.status));return j;}));
  const el=(tag,attrs,text)=>{const e=document.createElement(tag);Object.assign(e,attrs||{});if(text!==undefined)e.textContent=text;return e;};

  // ---- вид ----
  const box=el('div',{id:'studioPanel'}),head=el('button',{id:'stHead',type:'button'},'Мастерская'),body=el('div',{id:'stBody'}),
    nowEl=el('div',{id:'stNow'}),tabsEl=el('div',{id:'stTabs'}),
    msgEl=el('div',{id:'stMsg'}),list=el('div',{id:'stList'}),pubBtn=el('button',{id:'stPub',type:'button'},'Взять фигуру с сайта'),pubList=el('div',{id:'stPubList',hidden:true});
  body.append(nowEl,tabsEl);box.append(head,body);document.body.append(box);
  // вкладки: tab(id, title) → содержимое вкладки; второй раз с тем же id — то же содержимое
  const TABS={};
  const showTab=id=>{for(const k in TABS){TABS[k].btn.classList.toggle('on',k===id);TABS[k].pane.hidden=k!==id;}};
  function tab(id,title){id=String(id);if(TABS[id])return TABS[id].pane;
    const btn=el('button',{type:'button',className:'stTab'},title),pane=el('div',{id:'stTab-'+id,className:'stPane',hidden:true});btn.dataset.tab=id;
    btn.addEventListener('click',()=>showTab(id));tabsEl.append(btn);body.append(pane);TABS[id]={btn,pane};
    if(Object.keys(TABS).length===1)showTab(id);return pane;}
  tab('figs','Фигуры').append(el('div',{className:'stT'},'Мои фигуры'),el('div',{className:'stHint'},'Ваши рабочие копии. Правки сохраняются сами'),list,pubBtn,pubList,msgEl);
  // колонка развёрнута — страница сдвинута вправо (body.st-open); 3D пересчитывает размер по resize
  const fold=open=>{body.hidden=!open;box.classList.toggle('shut',!open);document.body.classList.toggle('st-open',open);window.dispatchEvent(new Event('resize'));};
  head.addEventListener('click',()=>fold(body.hidden));document.body.classList.add('st-open');
  const say=(t,bad,wait)=>{msgEl.textContent=t||'';msgEl.classList.toggle('bad',!!bad);msgEl.classList.toggle('busy',!!wait);};
  pubBtn.addEventListener('click',()=>{pubList.hidden=!pubList.hidden;});
  const setBusy=b=>{busy=b;box.classList.toggle('stBusy',b);pubBtn.disabled=b;list.querySelectorAll('.stDel').forEach(x=>{x.disabled=b;});pubList.querySelectorAll('.stPubItem').forEach(x=>{x.disabled=b;});if(!b)msgEl.classList.remove('busy');};

  const WATCH=[],fireWatch=()=>WATCH.forEach(f=>{try{f();}catch(e){console.error(e);}});
  // рабочая копия на экране? (выбрали в выпадашке фигуру сайта — уже нет)
  const isOpen=()=>!!cur&&ST.fig==='';
  // строка состояния; s: '' | 'сохраняю…' | 'сохранено' | 'не сохранилось' (без s — прежнее)
  function now(s){if(s!==undefined)state=s;const o=isOpen();
    nowEl.textContent=o?'Открыта: '+(ST.name||cur.figure.name)+(state?' · '+state:''):SITE;nowEl.classList.toggle('bad',o&&state==='не сохранилось');
    const sl=o?cur.slug:'';if(sl!==shown)drawList(lastL);}

  function drawList(L){lastL=L;shown=isOpen()?cur.slug:'';list.textContent='';
    if(!L.figures.length)list.append(el('div',{className:'stEmpty'},'Фигур пока нет. Нажмите «Взять фигуру с сайта»'));
    L.figures.forEach(f=>{const on=shown===f.slug,row=el('div',{className:'stFig'+(on?' on':''),tabIndex:0}),del=el('button',{type:'button',className:'stDel',title:'Удалить',disabled:busy},'×');
      row.setAttribute('role','button');row.dataset.slug=f.slug;
      row.append(el('span',{className:'stName'},f.name+(f.localOnly?' (только здесь)':'')+(on?' · открыта':'')),del);
      row.addEventListener('click',()=>{if(!busy)openFigure(f.slug);});
      row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!busy)openFigure(f.slug);}});
      del.addEventListener('click',e=>{e.stopPropagation();removeFigure(f);});list.append(row);});
    pubList.textContent='';pubList.append(el('div',{className:'stT'},'Какую фигуру скопировать?'));
    L.published.forEach(p=>{const b=el('button',{type:'button',className:'stPubItem',disabled:busy},p.name);b.dataset.id=p.id;b.addEventListener('click',()=>copyPublished(p));pubList.append(b);});}
  const refresh=()=>api('list').then(drawList).catch(e=>say('Мастерская не отвечает: '+e.message,true));

  // ---- открыть фигуру в странице ----
  // шаги истории записаны в мм страницы того раза (её пересчёт m0 лежит рядом, в undo.json); сейчас страница могла поставить фигуру иначе (m1):
  // шаг → мм модели по m0 → мм страницы по m1. В старых файлах m0 нет — только масштаб k0
  const sameMap=(a,b)=>[0,1,2].every(i=>Math.abs(a.s[i]-b.s[i])<1e-9&&Math.abs(a.mo[i]-b.mo[i])<1e-9&&Math.abs(a.po[i]-b.po[i])<1e-9);
  const okMap=m=>m&&['s','mo','po'].every(n=>Array.isArray(m[n])&&m[n].length===3&&m[n].every(x=>typeof x==='number'&&isFinite(x)))&&m.s.every(x=>x>0);
  function reSnap(m0,k0,m1,k1){const mv=fn=>s=>{const j=JSON.parse(s);j.V=j.V.map(fn);return JSON.stringify(j);};
    if(okMap(m0))return sameMap(m0,m1)?s=>s:mv(p=>p.map((x,i)=>((x-m0.po[i])/m0.s[i]+m0.mo[i]-m1.mo[i])*m1.s[i]+m1.po[i]));
    const f=k0?k1/k0:1;return Math.abs(f-1)<1e-9?s=>s:mv(p=>p.map(x=>x*f));}
  function applyFigure(slug,o){const f=o.figure;cur=null;dirty=false;
    ST.fig='';$('figSel').value='';ST.refId='';ST.frame=null;
    setBase(polyBase(f.V,f.P,f.S||[]),{name:f.name,H:f.H||1000});
    const k=meshBox(ST.base.V).size[1]/(meshBox(f.V).size[1]||1),map=mapOf(f.V,ST.base.V,k),re=reSnap(o.map,o.k,map,k);
    UNDO.length=REDO.length=0;(o.undo||[]).forEach(s=>UNDO.push(re(s)));(o.redo||[]).forEach(s=>REDO.push(re(s)));
    compute();renderAll('instant');cur={slug,figure:f,k,map,ref:o.ref||null,base:{V:f.V,P:f.P}};   // base — фигура, какой её открыли (мм модели): её не правим
    now('');say(o.warning||'',!!o.warning);fireWatch();}
  // пересчёт «модель ↔ страница»: якорь — центр по x, низ по y, начало по z (как ставит fitMesh); масштаб по оси — отношение габаритов
  function mapOf(Vm,Vp,k){const a=meshBox(Vm),b=meshBox(Vp),anchor=x=>[(x.min[0]+x.max[0])/2,x.min[1],x.min[2]];
    return {s:[0,1,2].map(i=>a.size[i]>1e-9&&b.size[i]>1e-9?b.size[i]/a.size[i]:k),mo:anchor(a),po:anchor(b)};}
  // done(название) — что сказать после открытия (копия); с ним «Открываю…» не пишем: в #stMsg держится сообщение о копии. → Promise<открылась ли>
  // Открытий может идти несколько (кликнули одну, следом другую): применяется последнее; удалили фигуру, пока она открывалась, — её открытие снимается
  function openFigure(slug,done){if(!done)say('Открываю…');const seq=++openSeq;opening=slug;const stale=()=>seq!==openSeq;
    const pend=timer?(clearTimeout(timer),flush()):saving||Promise.resolve();   // несохранённое — сначала на диск
    return pend.then(()=>api('open',{slug})).then(o=>stale()?false:new Promise(res=>later(()=>{let ok=false;
      try{if(stale())return;opening='';applyFigure(slug,o);if(done&&!o.warning)say(done(o.figure.name));ok=true;}
      catch(e){console.error(e);say('Не открылось: '+e.message,true);}finally{refresh();res(ok);}},'Открываю фигуру…')))
      .catch(e=>{if(stale())return false;opening='';say('Не открылось: '+e.message,true);return false;});}
  // копия фигуры сайта: пока делается, кнопка и список выключены — второй клик второй копии не даёт
  function copyPublished(p){if(busy)return Promise.resolve();setBusy(true);say('Делаю копию «'+p.name+'», до минуты…',false,true);
    return api('copy',{id:p.id}).then(r=>openFigure(r.slug,n=>'Открыта «'+n+'». Фигура на сайте не изменилась').then(ok=>{if(ok)pubList.hidden=true;else refresh();}),
      e=>say('Не скопировалось: '+e.message,true)).then(()=>setBusy(false));}
  // рабочую копию больше не ведём: отложенная запись снята, идущая запись её не вернёт (cur уже другой)
  function drop(){cur=null;if(timer){clearTimeout(timer);timer=0;}dirty=false;state='';fireWatch();}
  // удалить рабочую копию (папка — в корзину). Открытую: сначала снять отложенную запись и дождаться идущей, иначе запись воскресит папку
  function removeFigure(f){if(busy||!window.confirm('Удалить «'+f.name+'»? Папка переедет в корзину '+TRASH))return Promise.resolve();
    const was=cur&&cur.slug===f.slug?cur:null;setBusy(true);if(was){drop();now();}if(opening===f.slug){openSeq++;opening='';}
    return (saving||Promise.resolve()).then(()=>api('remove',{slug:f.slug})).then(()=>{say('«'+f.name+'» удалена. Вернуть можно из '+TRASH);
      if(was&&!cur&&ST.fig===''){const id=$('figSel').options[0].value;$('figSel').value=id;loadFigure(id);}},   // на экране снова фигура с сайта — первая из выпадашки
      e=>{if(was&&!cur&&ST.fig===''){cur=was;schedule();fireWatch();}now();say('Не удалилось: '+e.message,true);})   // не удалилась — ведём её дальше и дописываем снятую правку
      .then(()=>{setBusy(false);return refresh();});}

  // ---- автосохранение: не позже чем через 500 мс после первой правки ----
  const rnd=x=>Math.round(x*1e6)/1e6;
  // точки страницы → мм модели и обратно (по cur.map)
  const toModel=V=>{const m=cur.map;return V.map(p=>p.map((x,i)=>rnd((x-m.po[i])/m.s[i]+m.mo[i])));};
  const toPage=V=>{const m=cur.map;return V.map(p=>p.map((x,i)=>(x-m.mo[i])*m.s[i]+m.po[i]));};
  function payload(){return {slug:cur.slug,figure:Object.assign({},cur.figure,{name:ST.name||cur.figure.name,V:toModel(ST.base.V),P:ST.base.P,S:ST.base.S||[]}),undo:UNDO.slice(),redo:REDO.slice(),k:cur.k,map:cur.map};}
  function flush(){timer=0;if(!cur||ST.fig!==''||!ST.base.P)return Promise.resolve();
    if(saving){dirty=true;return saving;}
    const p=payload(),was=cur.figure.name,mine=()=>cur&&cur.slug===p.slug;
    if(state!=='не сохранилось')now('сохраняю…');   // «не сохранилось» держится до следующей удачной записи
    saving=api('save',p).then(()=>{if(!mine())return;Object.assign(cur.figure,{name:p.figure.name,V:p.figure.V,P:p.figure.P,S:p.figure.S});   // остальное (прорези, «оставлено так») могло поменяться, пока шла запись
      if(state==='не сохранилось')say('');now('сохранено');if(p.figure.name!==was)refresh();},
      e=>{if(!mine())return;now('не сохранилось');say('Не сохранилось: '+e.message,true);})
      .then(()=>{saving=null;if(dirty){dirty=false;schedule();}});return saving;}
  function schedule(){if(!timer)timer=setTimeout(flush,300);}
  // На экран встала другая фигура (выпадашка «Фигура», «Открыть модель», «Начать с заготовки» — всё идёт через setBase страницы) — рабочая копия закрыта:
  // чужая фигура в её папку не пишется. Сама мастерская зовёт setBase только из applyFigure, там cur уже null
  const pageSetBase=setBase;setBase=function(){if(cur){drop();opening='';}return pageSetBase.apply(this,arguments);};
  HOOKS.changed.push(()=>{if(cur&&ST.fig!=='')drop();if(cur&&!ST.drag)schedule();now();});   // во время перетаскивания точки не пишем: сохранится при отпускании
  $('mName').addEventListener('input',()=>{if(isOpen())schedule();now();});
  // для других вкладок (studio/ui/check.js): api — команда серверу; touch — записать фигуру (поменялось что-то кроме геометрии);
  // watch(fn) — fn зовётся, когда рабочая копия открылась или закрылась
  // toModel / toPage — точки страницы в мм модели и обратно (у открытой копии); showTab(id) — показать вкладку
  // solo(id, off) → on(): переключатели раскраски модели, которые вместе не работают («Показать неточности», «Карта отклонений», решение Q30):
  // on() — «я включился», у всех остальных зовётся их off()
  const SOLO=new Map();
  const solo=(id,off)=>{SOLO.set(String(id),off);return ()=>SOLO.forEach((f,k)=>{if(k!==String(id))try{f();}catch(e){console.error(e);}});};
  window.__studio={cur:()=>cur,flush,say,tab,showTab,api,toModel,toPage,solo,touch:()=>{if(isOpen())schedule();},watch:fn=>{WATCH.push(fn);}};

  // ---- старт: ждём, пока страница построит свою первую фигуру, и открываем последнюю ----
  const ready=()=>typeof CUR!=='undefined'&&CUR;
  now();
  (function boot(){if(!ready())return void setTimeout(boot,60);
    window.dispatchEvent(new Event('resize'));   // страница построилась до того, как колонка её сдвинула
    api('list').then(L=>{drawList(L);if(L.last&&L.figures.some(f=>f.slug===L.last))return openFigure(L.last);}).catch(e=>say('Мастерская не отвечает: '+e.message,true));})();
})();
