/* ---------- вкладка «Настройки» в колонке мастерской (после studio/ui/check.js; на публичной странице её нет) ----------
   Пороги правил Проверки (TH_INFO в studio/js/rules.js): подпись, число, единица — мм сайта или градусы. Поменял порог — Проверка пересчиталась
   (__studio.thChanged). Не число, ноль, отрицательное или несовместимое (thBad) не принимается: сообщение, в поле прежнее значение.
   Два вида порогов (решения Q4, Q20, Q27: «1 мм — для всех фигур; для отдельной фигуры меняется в „Настройках“»):
   - «Для открытой фигуры» (так по умолчанию, когда открыта рабочая копия) — figure.th: уходит на диск с автосохранением и потом с публикацией
     (FIGURES[id].th), у других фигур не меняется. Порог, заданный у фигуры, помечен «своё»;
   - «Для всех фигур» — work/settings.json (/api/settings): у каждой фигуры, где этот порог не свой.
   Проверка склеивает их thMerge: свои, которые вместе с общими не годятся, не берёт — тогда здесь предупреждение.
   «Вернуть как было»: у фигуры — снять её свои пороги (она снова берёт общие), у всех — общие пороги начальные (TH_DEFAULT). */
(function(){
  const SD=window.__studio;if(!SD||typeof STUDIO==='undefined'||typeof TH_INFO==='undefined')return;
  const pane=SD.tab('set','Настройки');
  const el=(tag,attrs,text)=>{const e=document.createElement(tag);Object.assign(e,attrs||{});if(text!==undefined)e.textContent=text;return e;};
  const ruleOf=n=>RULES.find(r=>r.n===n)||{n,title:'Правило '+n};
  let common=null,scope='all',err='',msg='';   // common — общие пороги с сервера (null — ещё не пришли); scope — 'fig' | 'all'
  const typing=new Map();                       // поле → набранный, ещё не принятый текст: перерисовка (ответ сервера) его не стирает
  let q=Promise.resolve();                      // запросы общих порогов — по очереди: ответы приходят в том же порядке

  const scopeEl=el('div',{id:'setScope',role:'radiogroup'}),hintEl=el('div',{className:'setHint',id:'setHint'}),warnEl=el('div',{id:'setWarn',hidden:true}),
    rowsEl=el('div',{id:'setRows'}),resetB=el('button',{type:'button',id:'setReset'},'Вернуть как было'),msgEl=el('div',{id:'setMsg'});
  const radio=(id,v,text)=>{const l=el('label',{className:'setR'}),r=el('input',{type:'radio',name:'setScope',id,value:v});l.append(r,document.createTextNode(text));
    r.addEventListener('change',()=>{if(r.checked){scope=v;typing.clear();say('');draw();}});scopeEl.append(l);return r;};
  const figR=radio('setFig','fig','Для открытой фигуры'),allR=radio('setAll','all','Для всех фигур');
  pane.append(scopeEl,hintEl,warnEl,rowsEl,el('div',{className:'setHint'},'«Здесь криво» проверяет вдвое строже. Прорезь (правило 16) — не уже толщины листа, её выбирают на странице'),resetB,msgEl);

  const own=()=>{const c=SD.cur();return c&&c.figure.th||{};};
  const okNum=v=>typeof v==='number'&&isFinite(v)&&v>0;
  // что видно в поле: у фигуры — её порог (свой или общий), у всех — общий
  const valOf=k=>scope==='fig'&&okNum(own()[k])?own()[k]:(common||TH_DEFAULT)[k];
  const say=(t,bad)=>{msg=t||'';err=bad?msg:'';msgEl.textContent=msg;msgEl.classList.toggle('bad',!!bad);};

  // перерисовка полей; поле, где стоял курсор (Enter или Tab к соседнему), снова в фокусе
  function draw(){const c=SD.cur();if(!c&&scope==='fig')scope='all';
    const a=document.activeElement,focusK=a&&a.classList&&a.classList.contains('setIn')?a.dataset.k:'';
    figR.disabled=!c;figR.checked=scope==='fig';allR.checked=scope==='all';
    hintEl.textContent=scope==='fig'?'Только у «'+(ST.name||c.figure.name)+'»: уходит вместе с ней. Остальные пороги — общие'
      :c?'У всех фигур, где порог не свой':'Рабочая копия не открыта: меняются пороги всех фигур';
    const why=c&&common?thMerge(common,own()).why:'';warnEl.hidden=!why;
    warnEl.textContent=why?'Свои пороги «'+(ST.name||c.figure.name)+'» не годятся вместе с общими ('+why+'): Проверка берёт общие. Снять свои — «Вернуть как было» для открытой фигуры':'';
    rowsEl.textContent='';const mine=scope==='fig'?own():{},G=new Map();
    TH_INFO.forEach(x=>{let g=G.get(x.rule);if(!g){g=el('div',{className:'setGrp'});g.dataset.rule=String(x.rule);g.append(el('div',{className:'setRule'},x.rule+'. '+ruleOf(x.rule).title));G.set(x.rule,g);rowsEl.append(g);}
      const row=el('div',{className:'setRow'}),inp=el('input',{type:'text',className:'setIn',inputMode:'decimal',value:typing.has(x.k)?typing.get(x.k):fmtN(valOf(x.k),4),disabled:!common,autocomplete:'off'});
      row.dataset.k=inp.dataset.k=x.k;inp.setAttribute('aria-label',ruleOf(x.rule).title+': '+x.label+', '+x.unit);
      inp.addEventListener('input',()=>typing.set(x.k,inp.value));inp.addEventListener('change',()=>commit(x,inp));
      row.append(el('span',{className:'setL'},x.label),inp,el('span',{className:'setU'},x.unit));
      if(x.k in mine)row.append(el('span',{className:'setOwn',title:'Свой порог у этой фигуры'},'своё'));
      g.append(row);});
    resetB.disabled=!common||scope==='fig'&&!Object.keys(mine).length;
    resetB.title=scope==='fig'?'Снять свои пороги фигуры: она снова берёт общие':'Общие пороги — начальные';
    msgEl.textContent=msg;msgEl.classList.toggle('bad',!!err);
    if(focusK){const f=rowsEl.querySelector('.setIn[data-k="'+focusK+'"]');if(f&&!f.disabled)f.focus();}}

  // общие пороги с сервера — по очереди (прежний запрос не вышел — следующий всё равно идёт)
  const post=b=>(q=q.catch(()=>{}).then(()=>SD.api('settings',b)));
  const changed=c=>{if(SD.thChanged)SD.thChanged(c);};
  // поле → число: запятая или точка. Пусто, не число, ноль и меньше, несовместимое с другими (thBad) — не принимается, в поле снова прежнее
  function commit(x,inp){typing.delete(x.k);const typed=inp.value.trim(),s=typed.replace(',','.'),v=s===''?NaN:Number(s),was=valOf(x.k);
    const no=why=>{say('Не принято'+(typed?' «'+typed+'»':'')+': '+why,true);draw();};
    if(v===was){inp.value=fmtN(v,4);return;}
    if(scope==='fig'){const c=SD.cur();if(!c)return no('рабочая копия закрыта');
      const t=Object.assign({},c.figure.th||{},{[x.k]:v}),why=thBad(Object.assign({},TH_DEFAULT,common||{},t));
      if(why)return no(why);c.figure.th=t;SD.touch();say('');draw();changed();return;}
    const why=thBad(Object.assign({},TH_DEFAULT,common||{},{[x.k]:v}));if(why)return no(why);
    post({set:{[x.k]:v}}).then(r=>{common=r.th;say('');draw();changed(common);},e=>no(e.message));}

  resetB.addEventListener('click',()=>{typing.clear();
    if(scope==='fig'){const c=SD.cur();if(!c)return;delete c.figure.th;SD.touch();say('Свои пороги фигуры сняты: она берёт общие');draw();changed();return;}
    post({reset:true}).then(r=>{common=r.th;say('Общие пороги — начальные');draw();changed(common);},e=>{say('Не вышло: '+e.message,true);draw();});});

  // открылась рабочая копия — вид «Для открытой фигуры», закрылась — «Для всех фигур»
  SD.watch(()=>{scope=SD.cur()?'fig':'all';typing.clear();say('');draw();});
  draw();
  post({}).then(r=>{common=r.th;draw();},e=>{say('Настройки не читаются: '+e.message,true);draw();});
})();
