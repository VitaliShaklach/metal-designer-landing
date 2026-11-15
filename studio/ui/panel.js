/* ---------- панель мастерской (вкладывает сервер, studio/server.js; на публичной странице её нет) ----------
   «Мои фигуры», «Открыть опубликованную» (копией), автосохранение не позже чем через 500 мс после любой правки.
   Геометрия в figure.json — в рамке модели; страница живёт в мм сайта: V_страницы = V_модели × k, k = высота на странице / высота модели (на момент открытия). */
(function(){
  if(typeof STUDIO==='undefined'||typeof HOOKS==='undefined')return;
  const S=STUDIO;let cur=null,timer=0,saving=null,dirty=false;

  const api=(cmd,body)=>fetch('/api/'+cmd,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':S.token},body:JSON.stringify(body||{})})
    .then(r=>r.json().then(j=>{if(!r.ok)throw new Error(j.error||('ошибка '+r.status));return j;}));
  const el=(tag,attrs,text)=>{const e=document.createElement(tag);Object.assign(e,attrs||{});if(text!==undefined)e.textContent=text;return e;};

  // ---- вид ----
  const box=el('div',{id:'studioPanel'}),head=el('button',{id:'stHead',type:'button'},'Мастерская'),body=el('div',{id:'stBody'}),
    msgEl=el('div',{id:'stMsg'}),list=el('div',{id:'stList'}),pubBtn=el('button',{id:'stPub',type:'button'},'Открыть опубликованную'),pubList=el('div',{id:'stPubList',hidden:true});
  body.append(el('div',{className:'stT'},'Мои фигуры'),list,pubBtn,pubList,msgEl);box.append(head,body);document.body.append(box);
  head.addEventListener('click',()=>{body.hidden=!body.hidden;});
  const say=(t,bad)=>{msgEl.textContent=t||'';msgEl.classList.toggle('bad',!!bad);};
  pubBtn.addEventListener('click',()=>{pubList.hidden=!pubList.hidden;});

  function drawList(L){list.textContent='';
    if(!L.figures.length)list.append(el('div',{className:'stEmpty'},'Пока пусто — откройте опубликованную'));
    L.figures.forEach(f=>{const b=el('button',{type:'button',className:'stFig'+(cur&&cur.slug===f.slug?' on':'')},f.name+(f.localOnly?' (только здесь)':''));b.dataset.slug=f.slug;b.addEventListener('click',()=>openFigure(f.slug));list.append(b);});
    pubList.textContent='';
    L.published.forEach(p=>{const b=el('button',{type:'button',className:'stPubItem'},p.name);b.dataset.id=p.id;b.addEventListener('click',()=>copyPublished(p.id));pubList.append(b);});}
  const refresh=()=>api('list').then(drawList);

  // ---- открыть фигуру в странице ----
  const scaleSnap=(s,f)=>{if(Math.abs(f-1)<1e-9)return s;const j=JSON.parse(s);j.V=j.V.map(p=>p.map(x=>x*f));return JSON.stringify(j);};
  function applyFigure(slug,o){const f=o.figure;cur=null;dirty=false;
    ST.fig='';$('figSel').value='';ST.refId='';ST.frame=null;
    setBase(polyBase(f.V,f.P,f.S||[]),{name:f.name,H:f.H||1000});
    const k=meshBox(ST.base.V).size[1]/(meshBox(f.V).size[1]||1),f0=o.k?k/o.k:1;
    UNDO.length=REDO.length=0;(o.undo||[]).forEach(s=>UNDO.push(scaleSnap(s,f0)));(o.redo||[]).forEach(s=>REDO.push(scaleSnap(s,f0)));
    compute();renderAll('instant');cur={slug,figure:f,k};say(o.warning||'',!!o.warning);}
  function openFigure(slug){say('Открываю…');const pend=timer?(clearTimeout(timer),flush()):saving||Promise.resolve();   // несохранённое — сначала на диск
  return pend.then(()=>api('open',{slug})).then(o=>{later(()=>{applyFigure(slug,o);refresh();},'Открываю фигуру…');}).catch(e=>say('Не открылось: '+e.message,true));}
  function copyPublished(id){pubList.hidden=true;say('Копирую…');return api('copy',{id}).then(r=>openFigure(r.slug)).catch(e=>say('Не скопировалось: '+e.message,true));}

  // ---- автосохранение: не позже чем через 500 мс после первой правки ----
  const rnd=x=>Math.round(x*1e6)/1e6;
  function payload(){const k=cur.k;return {slug:cur.slug,figure:Object.assign({},cur.figure,{name:ST.name||cur.figure.name,V:ST.base.V.map(p=>p.map(x=>rnd(x/k))),P:ST.base.P,S:ST.base.S||[]}),undo:UNDO.slice(),redo:REDO.slice(),k:cur.k};}
  function flush(){timer=0;if(!cur||ST.fig!==''||!ST.base.P)return Promise.resolve();
    if(saving){dirty=true;return saving;}
    const p=payload();saving=api('save',p).then(()=>{if(cur&&cur.slug===p.slug)cur.figure=p.figure;say('Сохранено');}).catch(e=>say('Не сохранилось: '+e.message,true)).then(()=>{saving=null;if(dirty){dirty=false;schedule();}});return saving;}
  function schedule(){if(!timer)timer=setTimeout(flush,300);}
  HOOKS.changed.push(()=>{if(cur&&ST.fig===''&&!ST.drag)schedule();});   // во время перетаскивания точки не пишем: сохранится при отпускании
  $('mName').addEventListener('input',()=>{if(cur&&ST.fig==='')schedule();});
  window.__studio={cur:()=>cur,flush,say};

  // ---- старт: ждём, пока страница построит свою первую фигуру, и открываем последнюю ----
  const ready=()=>typeof CUR!=='undefined'&&CUR;
  (function boot(){if(!ready())return void setTimeout(boot,60);
    api('list').then(L=>{drawList(L);if(L.last&&L.figures.some(f=>f.slug===L.last))return openFigure(L.last);}).catch(e=>say('Мастерская не отвечает: '+e.message,true));})();
})();
