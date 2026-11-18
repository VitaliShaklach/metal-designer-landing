/* ---------- интерфейс «Каркаса» ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const store=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}};
const msg=(t,el='msg')=>{const e=$(el);if(!e)return;e.textContent=t||'';clearTimeout(e._t);if(t)e._t=setTimeout(()=>e.textContent='',6000);};
const END_T={auto:'авто',miter:'скос',butt:'встык',cap:'сквозная',free:'ровно'};
const profOpts=sel=>Object.values(PROFILES).map(p=>`<option value="${p.id}"${p.id===sel?' selected':''}>${p.name}</option>`).join('');
const grpOpts=sel=>`<option value="">— без сборки —</option>`+M.groups.map(g=>`<option value="${g.id}"${g.id===sel?' selected':''}>${esc(g.name)}</option>`).join('');
const endInfo=e=>e.type==='miter'?`скос ${Math.round(e.ang)}°`:e.type==='butt'?(Math.round(e.ang)===90?'встык':`встык, рез ${Math.round(e.ang)}°`):e.type==='cap'?'сквозная':'ровно';

/* перерисовка всего: 3D, панели, таблицы; full=false — только 3D и панель выбора */
function renderAll(full=true){build3D();selUI();drawUI();if(!full)return;grpUI();tables();dimList();stats();jsonUI();sheetsUI();
  $('ttl').textContent=document.title=M.meta.name||'Каркас';if(document.activeElement!==$('mName'))$('mName').value=M.meta.name||'';
  store('kk-model',JSON.stringify(M));}
function drawUI(){const n=nodeById([...SEL.n].pop()||''),mid=[...SEL.m].pop();
  $('drawFrom').innerHTML=n?`<b>${mid?`Конец ${activeEnd(mid).toUpperCase()} трубы ${mid}`:'Узел '+n.id}</b> — координаты (мм), новая труба пойдёт отсюда. Направление — кнопками ниже`:'Кликните трубу у того конца, от которого рисовать. Для нового каркаса задайте первый узел:';
  if(n)['x','y','z'].forEach(k=>{const i=$('n'+k);if(document.activeElement!==i)i.value=n[k];});
  $('bNodeMv').hidden=!n;}
function stats(){const bb=bbox(),pos=positions(),L=pos.reduce((s,p)=>s+p.L*p.total,0);
  $('stats').innerHTML=[[`${u(bb.max[0]-bb.min[0])} × ${u(bb.max[2]-bb.min[2])} × ${u(bb.max[1]-bb.min[1])}`,`Ш × Г × В, ${UN()}`],[`${M.members.length}`,'труб в модели'],[`${fmt(L/1000,1)} м`,'трубы всего'],[`≈ ${Math.round(massTotal())} кг`,'металл']]
    .map(([b,s])=>`<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');}
/* панель «Выбрано» */
function selUI(){const box=$('selBox'),ms=[...SEL.m].map(id=>M.members.find(m=>m.id===id)).filter(Boolean),ns=[...SEL.n].map(nodeById).filter(Boolean);
  if(!ms.length&&!ns.length){box.innerHTML='<p class="note">Ничего не выбрано. Клик по трубе или узлу на модели</p>';return;}
  let h='';
  if(ms.length===1){const m=ms[0],c=memberCuts().find(x=>x.m.id===m.id),f=frame(m);
    const tc=touching(m.id),cl=contacts().filter(x=>x.type==='clash'&&(x.a===m.id||x.b===m.id)).map(x=>x.a===m.id?x.b:x.a);
    h+=`<div class="seg endseg" id="endSeg"><button data-e="a" aria-pressed="${activeEnd(m.id)==='a'}">Конец A</button><button data-e="b" aria-pressed="${activeEnd(m.id)==='b'}">Конец B</button></div>
      <p class="note"><b>Труба ${m.id}</b> · длина реза <b>${us(c.L)}</b> · концы: ${endInfo(c.ea)} / ${endInfo(c.eb)}${tc.length?`<br>Касается: ${tc.join(', ')} — приварить по месту касания`:''}${cl.length?`<br><b class="bad">Пересекается с ${cl.join(', ')} — проверьте модель</b>`:''}</p>
      <div class="row2"><label>Профиль<select data-k="prof">${profOpts(m.prof)}</select></label><label>Поворот<select data-k="rot">${[0,90].map(r=>`<option value="${r}"${(+m.rot||0)===r?' selected':''}>${r}°</option>`).join('')}</select></label></div>
      <div class="row2"><label>Конец A (${m.a})<select data-k="endA">${Object.entries(END_T).map(([k,t])=>`<option value="${k}"${m.endA===k?' selected':''}>${t}</option>`).join('')}</select></label><label>Конец B (${m.b})<select data-k="endB">${Object.entries(END_T).map(([k,t])=>`<option value="${k}"${m.endB===k?' selected':''}>${t}</option>`).join('')}</select></label></div>
      <div class="row2"><label>Длина реза — меняется активный конец<input class="inp" id="sLen" type="number" value="${c.L}"></label><label>Сборка<select data-k="grp">${grpOpts(m.grp)}</select></label></div>`;}
  else if(ms.length>1){h+=`<p class="note"><b>Выбрано труб: ${ms.length}</b>${ns.length?`, узлов: ${ns.length}`:''}</p>
      <div class="row2"><label>Профиль всем<select data-k="prof"><option value="">—</option>${profOpts('')}</select></label><label>Сборка всем<select data-k="grp"><option value="__">—</option>${grpOpts('__')}</select></label></div>`;}
  if(ms.length===2&&crossPoint(ms[0],ms[1]))h+=`<p class="note"><b>Трубы пересекаются крестом.</b> Крестовой стык — одна целая, другая режется на две и упирается в неё:</p>
      <div class="btns"><button type="button" data-cross="${ms[0].id},${ms[1].id}">Целая ${ms[0].id}</button><button type="button" data-cross="${ms[1].id},${ms[0].id}">Целая ${ms[1].id}</button></div>`;
  if(ns.length===1&&!ms.length){const n=ns[0];h+=`<p class="note"><b>Узел ${n.id}</b> · труб в узле: ${M.members.filter(m=>m.a===n.id||m.b===n.id).length}</p>
      <div class="xyz"><label>X<input class="inp" data-n="x" type="number" value="${n.x}"></label><label>Y<input class="inp" data-n="y" type="number" value="${n.y}"></label><label>Z<input class="inp" data-n="z" type="number" value="${n.z}"></label></div>`;}
  if(ms.length===1)h+=`<p class="note"><b>Направить трубу</b> — повернуть вокруг серого конца строго по оси (длина та же):</p>
    <div class="aimbar">${Object.entries({'-y':'↓ Y','+y':'↑ Y','+x':'→ X','-x':'← X','+z':'↙ Z','-z':'↗ Z'}).map(([k,t])=>`<button type="button" data-aim="${k}">${t}</button>`).join('')}</div>
    <div class="row2"><label>Наклон к горизонту, ° (0 — лежит, 90 — стоит)<input class="inp" id="angEl" type="number" step="1" value="${memberAngles(ms[0].id).el}"></label><label>Поворот в плане, ° (0 — по X, 90 — по Z)<input class="inp" id="angAz" type="number" step="1" value="${memberAngles(ms[0].id).az}"></label></div>`;
  h+=`<p class="note"><b>Переместить выбранное</b> — стрелками на шаг или точно (впишите dX / dY / dZ и Enter), мм:</p>
    <div class="movebar"><label>шаг<input class="inp" id="mvStep" type="number" value="${store('kk-step')||100}" min="1"></label>${Object.entries({'+y':'↑','-y':'↓','-x':'←','+x':'→','+z':'↙','-z':'↗'}).map(([k,t])=>`<button type="button" data-mv="${k}" title="${t} ${k.slice(1).toUpperCase()}">${t} ${k.slice(1).toUpperCase()}</button>`).join('')}</div>
    <div class="xyz"><label>dX<input class="inp" id="mvx" type="number" value="0"></label><label>dY<input class="inp" id="mvy" type="number" value="0"></label><label>dZ<input class="inp" id="mvz" type="number" value="0"></label><button id="bMove" type="button">Переместить</button></div>
    <div class="btns"><button id="bDel" type="button" class="danger">Удалить</button><button id="bDesel" type="button">Снять выбор</button></div>`;
  box.innerHTML=h;
  box.querySelectorAll('select[data-k]').forEach(s=>s.addEventListener('change',()=>{const k=s.dataset.k;let v=s.value;if(k==='prof'&&!v)return;if(k==='grp'&&v==='__')return;if(k==='rot')v=+v;setMembers(k,v);}));
  box.querySelectorAll('#endSeg button').forEach(b=>b.addEventListener('click',()=>select({handle:{member:ms[0].id,end:b.dataset.e}})));
  const sl=$('sLen');if(sl){sl.addEventListener('change',()=>setCutLen(ms[0].id,+sl.value,activeEnd(ms[0].id)));sl.addEventListener('keydown',e=>{if(e.key==='Enter')sl.blur();});}
  box.querySelectorAll('input[data-n]').forEach(i=>i.addEventListener('change',()=>{const n=ns[0];change(()=>{n[i.dataset.n]=Math.round(+i.value||0);});}));
  $('bMove').addEventListener('click',()=>moveSel(+$('mvx').value||0,+$('mvy').value||0,+$('mvz').value||0));
  ['mvx','mvy','mvz'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('bMove').click();}}));
  ['angEl','angAz'].forEach(id=>{const i=$(id);if(!i)return;const go=()=>setAngles(ms[0].id,+$('angEl').value||0,+$('angAz').value||0);i.addEventListener('change',go);i.addEventListener('keydown',e=>{if(e.key==='Enter')i.blur();});});
  box.querySelectorAll('[data-cross]').forEach(b=>b.addEventListener('click',()=>{const [k,c]=b.dataset.cross.split(',');msg(crossJoint(k,c));}));
  box.querySelectorAll('[data-aim]').forEach(b=>b.addEventListener('click',()=>aimMember(ms[0].id,b.dataset.aim)));
  box.querySelectorAll('[data-mv]').forEach(b=>b.addEventListener('click',()=>{const st=Math.max(1,+$('mvStep').value||100),d=AX[b.dataset.mv];store('kk-step',String(st));moveSel(d[0]*st,d[1]*st,d[2]*st);}));
  $('bDel').addEventListener('click',delSel);$('bDesel').addEventListener('click',()=>select(null,false));}
/* сборки */
function grpUI(){const pos=positions();
  $('grpBox').innerHTML=M.groups.length?M.groups.map(g=>{const n=M.members.filter(m=>m.grp===g.id).length;
    return `<div class="gitem${ONLY_GRP===g.id?' on':''}" data-g="${g.id}"><input class="inp gname" value="${esc(g.name)}"><label>×<input class="inp gq" type="number" min="1" value="${g.qty}"></label>
      <label class="chk"><input type="checkbox" class="gm"${g.mirror?' checked':''}><span>зерк.</span></label><small>${n} труб</small>
      <div class="btns"><button type="button" class="gsel">Выбрать</button><button type="button" class="gonly">${ONLY_GRP===g.id?'Показать все':'Только эта'}</button><button type="button" class="gdel">Убрать сборку</button></div></div>`;}).join(''):'<p class="note">Сборок нет. Выберите трубы и создайте сборку — например «Ферма» ×2</p>';
  $('grpBox').querySelectorAll('.gitem').forEach(el=>{const g=M.groups.find(x=>x.id===el.dataset.g);
    el.querySelector('.gname').addEventListener('change',e=>change(()=>g.name=e.target.value||g.name));
    el.querySelector('.gq').addEventListener('change',e=>change(()=>g.qty=Math.max(1,Math.round(+e.target.value||1))));
    el.querySelector('.gm').addEventListener('change',e=>change(()=>g.mirror=e.target.checked));
    el.querySelector('.gsel').addEventListener('click',()=>selectGroup(g.id));
    el.querySelector('.gonly').addEventListener('click',()=>{ONLY_GRP=ONLY_GRP===g.id?null:g.id;renderAll();});
    el.querySelector('.gdel').addEventListener('click',()=>change(()=>{M.members.forEach(m=>{if(m.grp===g.id)m.grp='';});M.groups=M.groups.filter(x=>x!==g);if(ONLY_GRP===g.id)ONLY_GRP=null;}));});}
/* эскиз заготовки: полоса в масштабе, концы — под своим углом */
function barSketch(L,angA,angB,maxL){const W=190,H=16,len=Math.max(40,W*Math.min(1,L/Math.max(maxL,1))),s=a=>a>=89.5?0:Math.min(H*1.5,H/Math.tan(a*Math.PI/180));
  const x0=2,x1=2+len,a=s(angA),b=s(angB);
  return `<svg class="barsk" width="${Math.ceil(x1+4)}" height="${H+4}" viewBox="0 0 ${Math.ceil(x1+4)} ${H+4}" aria-hidden="true"><polygon points="${x0+a},2 ${x1-b},2 ${x1},${H+2} ${x0},${H+2}"/></svg>`;}
function tables(){const pos=positions(),maxL=Math.max(1,...pos.map(p=>p.L)),cs=contacts(),noOf=id=>{const p=pos.find(q=>q.ids.includes(id));return p?p.no:id;};
  // примечание: на чём лежит позиция (по месту касания — приварить)
  const restNote=p=>{const on=new Set();p.ids.forEach(id=>cs.filter(c=>c.type==='rest'&&(c.a===id||c.b===id)).forEach(c=>on.add(noOf(c.a===id?c.b:c.a))));return on.size?`касается поз. ${[...on].join(', ')} — приварить по месту`:'';};
  const clashes=cs.filter(c=>c.type==='clash');$('warn').hidden=!clashes.length;
  $('warn').innerHTML=clashes.length?`<b>Проверьте модель:</b> трубы пересекаются насквозь — ${clashes.map(c=>`${c.a} и ${c.b}`+(c.cross?' (крестом — выберите обе, Shift+клик, и нажмите «Целая …»: крестовой стык)':` (на ${-c.gap} мм)`)).join('; ')}. На 3D — красные кольца`:'';
  let h='<thead><tr><th>Поз.</th><th>Эскиз</th><th>Профиль</th><th class="r">Длина, мм</th><th>Концы</th><th class="r">На сборку</th><th class="r">Всего</th><th class="r">Масса, кг</th></tr></thead><tbody>';
  let gcur=null;pos.forEach(p=>{if(p.grp!==gcur){gcur=p.grp;const g=grpOf(p.grp);h+=`<tr class="grp"><td colspan="8">${g?esc(g.name)+(g.qty>1?` · ×${g.qty}`:'')+(g.mirror?' · зеркальные':''):'Без сборки'}</td></tr>`;}
    const rn=restNote(p);h+=`<tr><td class="n">${p.no}</td><td>${barSketch(p.L,p.ang[0],p.ang[1],maxL)}</td><td>${prof(p.prof).name}${rn?`<small>${rn}</small>`:''}</td><td class="n r">${p.L}</td><td class="n">${p.ang.map(a=>a===90?'90°':a+'°').join(' / ')}</td><td class="n r">${p.qty}</td><td class="n r">${p.total}</td><td class="n r">${fmt(p.kg,2)}</td></tr>`;});
  h+=`<tr class="tot"><td colspan="6">Итого</td><td class="n r">${pos.reduce((s,p)=>s+p.total,0)}</td><td class="n r">${fmt(massTotal(),1)}</td></tr></tbody>`;
  $('cut').innerHTML=pos.length?h:'<tbody><tr><td>Труб пока нет — нарисуйте каркас или откройте пример</td></tr></tbody>';
  // спецификация по сборкам
  let s='<thead><tr><th>Поз.</th><th>Наименование</th><th>Материал</th><th class="r">L, мм</th><th class="r">Кол. на сб.</th><th class="r">Всего</th></tr></thead><tbody>';
  [...M.groups.map(g=>g.id),''].forEach((gid,gi)=>{const ps=pos.filter(p=>p.grp===gid);if(!ps.length)return;const g=grpOf(gid);
    s+=`<tr class="grp"><td colspan="6">${g?`${gi+1} · ${esc(g.name)} — ${g.qty} шт${g.mirror?' (зеркальные)':''}`:`${M.groups.length+1} · Без сборки`}</td></tr>`;
    ps.forEach(p=>{s+=`<tr><td class="n">${p.no}</td><td>${({tube:'Труба',angle:'Уголок',wood:'Брус'})[prof(p.prof).kind]||'Полоса'} · ${p.ang.map(a=>a===90?'90°':a+'°').join('/')}</td><td>${prof(p.prof).name} ${prof(p.prof).wood?'лиственница':esc(M.meta.steel||'')}</td><td class="n r">${p.L}</td><td class="n r">${p.qty}</td><td class="n r">${p.total}</td></tr>`;});});
  $('spec').innerHTML=pos.length?s+'</tbody>':'<tbody><tr><td>—</td></tr></tbody>';
  // металл и хлысты
  const nest=nesting();let t='<thead><tr><th>Профиль</th><th class="r">Нужно, м</th><th class="r">Хлыстов по 6 м</th><th class="r">Остаток, м</th><th class="r">Масса, кг</th><th>Как резать</th></tr></thead><tbody>';
  nest.forEach(n=>{const p=prof(n.prof);t+=`<tr><td>${p.name}</td><td class="n r">${fmt(n.need/1000,2)}</td><td class="n r">${n.bars.length}</td><td class="n r">${fmt(n.waste/1000,2)}</td><td class="n r">${fmt(n.need/1000*p.kgm,1)}</td><td><small class="fn">${n.bars.map((b,i)=>`${i+1}: ${b.cuts.map(c=>c.L).join(' + ')}${b.long?' (длиннее хлыста — стык)':''}`).join('<br>')}</small></td></tr>`;});
  $('metal').innerHTML=nest.length?t+'</tbody>':'<tbody><tr><td>—</td></tr></tbody>';}
/* список размеров */
function dimList(){$('dimList').innerHTML='<div class="dg">'+dimRows().map(r=>r.h?`<h4>${r.h}</h4>`:`<label class="chk"><input type="checkbox" data-id="${r.id}"${DIMS.has(r.id)?' checked':''}><span>${r.name}<b>${r.val||us(dimVal(r.id))}</b></span></label>`).join('')+'</div>';}
function jsonUI(){if(document.activeElement!==$('jsonTxt'))$('jsonTxt').value=JSON.stringify(M,null,1);}

/* чертежи: листы строятся, только когда вкладка открыта; иначе — пометка «устарели» */
let SHEETS_OLD=true;
let SHEETS_T=0;
// листы пересобираем через 0,5 с после последней правки, а не на каждую
function sheetsUI(now){if(typeof buildSheets!=='function')return;clearTimeout(SHEETS_T);if($('tab-sheets').hidden){SHEETS_OLD=true;return;}
  if(!now){SHEETS_T=setTimeout(()=>sheetsUI(true),500);return;}SHEETS_OLD=false;
  const sh=buildSheets();$('sheets').innerHTML=sh.length?sh.map((s,i)=>`<figure class="sheet" id="sheet${i+1}"><figcaption>Лист ${i+1} из ${sh.length} · ${esc(s.title)}</figcaption>${s.svg}</figure>`).join(''):'<p class="note">Труб пока нет — нарисуйте каркас или откройте пример</p>';
  $('shGo').innerHTML=sh.map((s,i)=>`<option value="${i+1}">Лист ${i+1} · ${esc(s.title)}</option>`).join('');$('shPdf').disabled=!sh.length;}
$('shGo').addEventListener('change',e=>{const el=$('sheet'+e.target.value);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});});
// PDF — через печать браузера: в печать идут только листы, по одному на страницу А3
$('shPdf').addEventListener('click',()=>{const sh=buildSheets();if(!sh.length)return;$('printBox').innerHTML=sh.map(s=>s.svg).join('');
  const t=document.title;document.title=(M.meta.name||'Каркас')+' — чертежи';const done=()=>{document.title=t;$('printBox').innerHTML='';removeEventListener('afterprint',done);};
  addEventListener('afterprint',done);window.print();});

/* ---------- события ---------- */
$('dProf').innerHTML=profOpts('40x40x1.5');
$('axes').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const r=drawAlong(b.dataset.a,+$('dLen').value,$('dProf').value);if(r)msg(r);});
$('bNode').addEventListener('click',()=>{let id;change(()=>{id=addNode(+$('nx').value||0,+$('ny').value||0,+$('nz').value||0).id;});SEL.n.clear();SEL.m.clear();SEL.end.clear();SEL.n.add(id);renderAll(false);msg('Узел '+id+' — теперь выберите направление трубы');});
$('bNodeMv').addEventListener('click',()=>{const n=nodeById([...SEL.n].pop()||'');if(!n)return;change(()=>{n.x=Math.round(+$('nx').value||0);n.y=Math.round(+$('ny').value||0);n.z=Math.round(+$('nz').value||0);});msg('Узел '+n.id+' перенесён');});
$('bJoin').addEventListener('click',()=>{const r=joinNodes($('dProf').value);if(r)msg(r);});
$('bCopy').addEventListener('click',()=>{if(!SEL.m.size)return msg('Выберите трубы для копии');const ids=[...SEL.m];change(()=>copyMembers(ids,+$('cx').value||0,+$('cy').value||0,+$('cz').value||0,Math.max(1,+$('cn').value||1)));});
$('bMirror').addEventListener('click',()=>{if(!SEL.m.size)return msg('Выберите трубы для зеркала');const ids=[...SEL.m];change(()=>mirrorMembers(ids,$('mAx').value,+$('mC').value||0));});
$('bGrp').addEventListener('click',()=>{const r=makeGroup($('gName').value.trim());if(r)msg(r);else $('gName').value='';});
$('cWeld').addEventListener('change',e=>{SHOW_WELD=e.target.checked;build3D();});
$('bUndo').addEventListener('click',undo);$('bRedo').addEventListener('click',redo);
$('mName').addEventListener('change',e=>change(()=>M.meta.name=e.target.value.trim()||'Каркас'));
document.querySelectorAll('.vbar [data-v]').forEach(b=>b.addEventListener('click',()=>viewDir(b.dataset.v)));$('bFit').addEventListener('click',()=>fitAll());
$('dimList').addEventListener('change',e=>{const id=e.target.dataset.id;if(!id)return;e.target.checked?DIMS.add(id):DIMS.delete(id);build3D();});
$('dAll').addEventListener('click',()=>{dimRows().forEach(r=>r.id&&DIMS.add(r.id));build3D();dimList();});
$('dNone').addEventListener('click',()=>{DIMS.clear();build3D();dimList();});
document.querySelectorAll('#unitSeg button').forEach(b=>b.addEventListener('click',()=>{UNIT=b.dataset.v;store('md-unit',UNIT);document.querySelectorAll('#unitSeg button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderAll();}));
document.querySelectorAll('#unitSeg button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===UNIT));
// вкладки
const TABS=[...document.querySelectorAll('.tabbar button')];
function showTab(k){TABS.forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));$('tab-'+b.dataset.tab).hidden=!on;});store('kk-tab',k);if(k==='json')jsonUI();if(k==='sheets'&&SHEETS_OLD)sheetsUI(true);}
TABS.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));showTab(store('kk-tab')||'dims');
// сворачиваемые группы панели
document.querySelectorAll('.controls .grp').forEach(g=>{const bt=g.querySelector('.gt');bt.addEventListener('click',()=>g.classList.toggle('shut'));});
// клик по модели — выбрать; наведение — имя
(()=>{if(!ok)return;const cv=renderer.domElement,tag=$('hovTag');let down=null,last=0;
  cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};tag.hidden=true;
    if(e.button!==0)return;const h=pickAt(e);
    if(h&&h.grow){const n0=nodeById(h.grow.node);GROW={n0,start:snap(),made:null,x0:e.clientX,y0:e.clientY,prof:$('dProf').value,grp:(M.members.find(x=>x.id===h.grow.member)||{}).grp||''};
      controls.enabled=false;cv.setPointerCapture(e.pointerId);down=null;e.preventDefault();return;}
    if(!h||!h.handle)return;   // взяли стрелку на конце трубы — тянем вдоль оси
    const m=M.members.find(x=>x.id===h.handle.member),k=h.handle.end,f=frame(m),fix=nodeById(k==='b'?m.a:m.b),mv=nodeById(m[k]);
    SEL.end.set(m.id,k);syncEnds();DRAG={m,k,fixId:fix.id,fix:P3(fix),dir:k==='b'?f.d:V3.mul(f.d,-1),mv,start:snap(),moved:false};controls.enabled=false;cv.setPointerCapture(e.pointerId);down=null;e.preventDefault();});
  // тянем «+»: ось — та из шести, что ближе к движению мыши на экране; длина — по лучу мыши, шаг 10 мм (Shift — 1)
  cv.addEventListener('pointermove',e=>{if(!GROW)return;const r=renderer.domElement.getBoundingClientRect(),dx=e.clientX-GROW.x0,dy=e.clientY-GROW.y0;if(Math.hypot(dx,dy)<6)return;
    const o0=GROW.n0,P0=[o0.x,o0.y,o0.z],scr=v=>{const q=new THREE.Vector3(...v).project(camera);return [(q.x+1)/2*r.width,(1-q.y)/2*r.height];},s0=scr(P0);
    let best=null,bd=-2;Object.entries(AX).forEach(([k,d])=>{const s1=scr(V3.add(P0,V3.mul(d,300))),vx=s1[0]-s0[0],vy=s1[1]-s0[1],l=Math.hypot(vx,vy)||1,c=(vx*dx+vy*dy)/(l*Math.hypot(dx,dy));if(c>bd){bd=c;best=[k,d];}});
    const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    const o=rc.ray.origin.toArray(),rd=rc.ray.direction.toArray(),dir=best[1],w=V3.sub(P0,o),b=V3.dot(dir,rd),d=V3.dot(dir,w),e2=V3.dot(rd,w),den=1-b*b;
    const step=e.shiftKey?1:10;let s=den<1e-6?0:(b*e2-d)/den;s=Math.max(step,Math.round(s/step)*step);
    const sn=snapAlong(P0,dir,s,{nodes:new Set([o0.id].concat(GROW.made?[GROW.made.n.id]:[])),members:new Set(GROW.made?[GROW.made.m.id]:[])});GROW.snap=sn;
    const p=sn?sn.p:V3.add(P0,V3.mul(dir,s));
    if(!GROW.made){const n={id:nextId(M.nodes,'n'),x:0,y:0,z:0};M.nodes.push(n);const m={id:nextId(M.members,'m'),a:o0.id,b:n.id,prof:GROW.prof,rot:0,endA:'auto',endB:'auto',grp:GROW.grp};M.members.push(m);GROW.made={n,m};}
    Object.assign(GROW.made.n,{x:Math.round(p[0]),y:Math.round(p[1]),z:Math.round(p[2])});build3D();
    const c=memberCuts().find(x=>x.m.id===GROW.made.m.id),rr=stage.getBoundingClientRect();tag.textContent=`${({'+x':'→ X','-x':'← X','+y':'↑ Y','-y':'↓ Y','+z':'↙ Z','-z':'↗ Z'})[best[0]]} · ${prof(GROW.prof).name} · L ${us(c?c.L:s)}`+(GROW.snap?` · прилипло: ${GROW.snap.what}`:'');
    tag.style.left=(e.clientX-rr.left)+'px';tag.style.top=(e.clientY-rr.top)+'px';tag.hidden=false;},true);
  const endGrow=()=>{if(!GROW)return;const g=GROW;GROW=null;controls.enabled=true;tag.hidden=true;if(!g.made){renderAll(false);return;}
    // конец совпал с существующим узлом — соединяем с ним
    mergeNode(g.made.n);
    UNDO.push(g.start);REDO.length=0;SEL.m.clear();SEL.end.clear();SEL.n.clear();SEL.m.add(g.made.m.id);SEL.end.set(g.made.m.id,'b');syncEnds();renderAll();msg('Новая труба — тяните «+» дальше или стрелку, чтобы поправить длину');};
  cv.addEventListener('pointerup',endGrow,true);cv.addEventListener('pointercancel',endGrow);
  cv.addEventListener('pointermove',e=>{if(!DRAG)return;const r=renderer.domElement.getBoundingClientRect(),rc=new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    // точка на оси трубы, ближайшая к лучу мыши
    const o=rc.ray.origin.toArray(),rd=rc.ray.direction.toArray(),w=V3.sub(DRAG.fix,o),b=V3.dot(DRAG.dir,rd),d=V3.dot(DRAG.dir,w),e2=V3.dot(rd,w),den=1-b*b;if(den<1e-6)return;
    let s=(b*e2-d)/den;const step=e.shiftKey?1:10;s=Math.max(step,Math.round(s/step)*step);
    const sn=snapAlong(DRAG.fix,DRAG.dir,s,{nodes:new Set([DRAG.mv.id,DRAG.fixId]),members:new Set([DRAG.m.id])});DRAG.snap=sn;   // прилипло к трубе или узлу
    const p=sn?sn.p:V3.add(DRAG.fix,V3.mul(DRAG.dir,s));DRAG.mv.x=Math.round(p[0]);DRAG.mv.y=Math.round(p[1]);DRAG.mv.z=Math.round(p[2]);DRAG.moved=true;build3D();
    const c=memberCuts().find(x=>x.m.id===DRAG.m.id),rr=stage.getBoundingClientRect();tag.textContent=`L ${us(c.L)}`+(DRAG.snap?` · прилипло: ${DRAG.snap.what}`:'');tag.style.left=(e.clientX-rr.left)+'px';tag.style.top=(e.clientY-rr.top)+'px';tag.hidden=false;},true);
  const endDrag=()=>{if(!DRAG)return;const d=DRAG;DRAG=null;controls.enabled=true;tag.hidden=true;if(d.moved){mergeNode(d.mv);UNDO.push(d.start);REDO.length=0;renderAll();}else renderAll(false);};
  cv.addEventListener('pointerup',endDrag,true);cv.addEventListener('pointercancel',endDrag);
  cv.addEventListener('pointerup',e=>{if(!down||e.button!==0)return;const mv=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;if(mv>5||dt>600)return;
    select(pickAt(e),e.shiftKey||e.ctrlKey||e.metaKey);});
  cv.addEventListener('pointermove',e=>{if(DRAG||GROW)return;if(e.buttons||e.pointerType==='touch'){tag.hidden=true;return;}const now=performance.now();if(now-last<60)return;last=now;
    const h=pickAt(e);stage.classList.toggle('pickable',!!h);if(!h){tag.hidden=true;return;}
    let t;if(h.grow){t='Тяните — из этого конца вырастет новая труба (направление — куда тянете)';}else if(h.handle){t='Тяните вдоль трубы — удлинить или укоротить с этой стороны';}else if(h.node){const n=nodeById(h.node);t=`Узел ${n.id}: ${u(n.x)}; ${u(n.y)}; ${u(n.z)}`;}else{const c=memberCuts().find(x=>x.m.id===h.member),g=grpOf(c.m.grp);t=`${prof(c.m.prof).name} · L ${us(c.L)}${g?' · '+g.name:''}`;}
    const r=stage.getBoundingClientRect();tag.textContent=t;tag.style.left=(e.clientX-r.left)+'px';tag.style.top=(e.clientY-r.top)+'px';tag.hidden=false;});
  cv.addEventListener('pointerleave',()=>tag.hidden=true);})();
// клавиши
addEventListener('keydown',e=>{const a=document.activeElement;if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT'))return;
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();redo();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();delSel();}
  else if(e.key==='Escape')select(null,false);
  else if(e.code==='KeyF')fitAll();});
// клик по размеру выбранной трубы на 3D — поле для новой длины
stage.addEventListener('click',e=>{const el=e.target.closest('.d3.edit');if(!el||el.querySelector('input'))return;e.stopPropagation();
  const id=el.dataset.member,c=memberCuts().find(x=>x.m.id===id);if(!c)return;el.innerHTML='';const i=document.createElement('input');i.type='number';i.value=c.L;el.appendChild(i);i.focus();i.select();
  const done=ok=>{if(done.x)return;done.x=1;if(ok&&+i.value>0&&+i.value!==c.L)setCutLen(id,+i.value,activeEnd(id));else build3D();};
  i.addEventListener('keydown',ev=>{if(ev.key==='Enter')done(true);if(ev.key==='Escape')done(false);ev.stopPropagation();});i.addEventListener('blur',()=>done(true));});
/* ---------- файл, ссылка, пример, JSON ---------- */
function loadModel(o,quiet){UNDO.push(snap());M=normModel(o);SEL.m.clear();SEL.n.clear();ONLY_GRP=null;renderAll();fitAll(true);if(!quiet)msg('Открыто: '+M.meta.name);}
$('exSel').addEventListener('change',e=>{const k=e.target.value;if(k&&typeof EXAMPLES!=='undefined'&&EXAMPLES[k])loadModel(JSON.parse(JSON.stringify(EXAMPLES[k])));e.target.value='';});
$('bNew').addEventListener('click',()=>{loadModel(emptyModel(),true);msg('Новый каркас: задайте первый узел в «Рисовать»');});
$('bSave').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(M,null,1)],{type:'application/json'}));
  a.download=(M.meta.name||'karkas').replace(/[^\wа-яё\- ]+/gi,'').trim().replace(/\s+/g,'_')+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);msg('Сохранено в файл');});
$('bOpen').addEventListener('click',()=>$('fOpen').click());
$('fOpen').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{loadModel(JSON.parse(await f.text()));}catch(err){msg('Не удалось прочитать файл: '+err.message);}e.target.value='';});
// ссылка: модель в адресе после #m= (сжато, если браузер умеет)
const b64u=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const ub64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function packModel(){const raw=new TextEncoder().encode(JSON.stringify(M));
  if(typeof CompressionStream==='function'){const z=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());return 'z'+b64u(z);}
  return 'j'+b64u(raw);}
async function unpackModel(s){const t=s[0],b=ub64(s.slice(1));if(t==='z'){const r=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();return JSON.parse(r);}return JSON.parse(new TextDecoder().decode(b));}
$('bShare').addEventListener('click',async()=>{const url=location.href.split('#')[0]+'#m='+await packModel();let done=false;try{await navigator.clipboard.writeText(url);done=true;}catch(e){}
  msg(done?'Ссылка скопирована — по ней откроется этот каркас':'Ссылка: '+url.slice(0,80)+'…');if(!done)prompt('Скопируйте ссылку',url);});
$('jApply').addEventListener('click',()=>{try{loadModel(JSON.parse($('jsonTxt').value));msg('Модель применена','jMsg');}catch(e){msg('Ошибка в JSON: '+e.message,'jMsg');}});
$('jCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('jsonTxt').value);msg('Скопировано','jMsg');}catch(e){$('jsonTxt').select();msg('Выделено — Ctrl+C','jMsg');}});
// телефон: панель — шторка
(()=>{const pn=$('controls'),bt=$('drawerBtn'),set=o=>{pn.classList.toggle('open',o);bt.setAttribute('aria-expanded',String(o));bt.textContent=o?'Готово':'Панель';};
  bt.addEventListener('click',()=>set(!pn.classList.contains('open')));$('drawerClose').addEventListener('click',()=>set(false));})();
/* ---------- старт: ссылка → сохранённое → пример навеса ---------- */
(async()=>{let o=null;const h=location.hash.match(/^#m=(.+)$/);
  if(h){try{o=await unpackModel(h[1]);}catch(e){msg('Ссылка повреждена — открыт пример');}}
  if(!o){try{const s=store('kk-model');if(s)o=JSON.parse(s);}catch(e){}}
  if(!o&&typeof EXAMPLES!=='undefined')o=JSON.parse(JSON.stringify(EXAMPLES['naves-3x2']));
  M=normModel(o||emptyModel());UNDO.length=0;renderAll();fitAll(true);
  const l=$('loading');if(l){if(ok)l.remove();else{l.classList.add('err');l.textContent='3D не загрузилась (нет WebGL или связи с CDN) — таблицы ниже работают';}}})();
