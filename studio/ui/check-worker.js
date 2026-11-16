/* ---------- фоновый поток Проверки (его запускает studio/ui/check.js) ----------
   Проверка рыси целиком — около секунды, починка с судом — ещё столько же; в фоне страница при этом не замирает.
   Здесь тот же движок и те же скрипты мастерской, что в Node (STUDIO.engine — список от сервера, порядок как в studio/lib/engine.js).
   Сообщения сюда:
     {type:'init', urls}                 — загрузить скрипты;
     {type:'figure', ref, base}          — эталон и фигура, какой её открыли (мм модели); один объект на все пересчёты: индекс эталона кешируется по объекту;
     {type:'check', id, gen, E, o}       → {type:'check', id, gen, issues}            — reviewCheck;
     {type:'fix', id, gen, E, o, issue, issues} → {type:'fix', id, gen, E, moved, dev, why, worse} — reviewFix (одиночное «Исправить»);
     {type:'batch', id, gen, E, o, rules}  → пачка reviewBatch на копии фигуры (rules — [n] или null: всё безопасное), по одной пробе за раз:
       после каждой — {type:'progress', id, gen, k, of, round}, и поток ждёт ответа страницы: {type:'more', id} — дальше, {type:'stop', id} —
       закрыть расчёт на посчитанном; в конце {type:'batch', id, gen, E, fixed, of, left, moved, reasons, stopped}. {type:'drop', id} — бросить пачку.
       Страница отвечает сразу, поэтому пачка не ждёт; а «Стоп» доходит до потока между пробами, не дожидаясь конца.
     {type:'here', id, gen, E, c, o}     → {type:'here', id, gen, issues}             — «Здесь криво»: reviewHere, шар вокруг c (мм модели);
     {type:'dev', id, gen, E, scale}     → {type:'dev', id, gen, dev, max}            — «Карта отклонений»: reviewDev от эталона, а без него — от base.
   Ошибка → {type:'error', of, id, error}. E — мм модели, o — как у checkFigure (th, scale, kind, slots, keep, t). */
self.window=self;
let REF=null,BASE=null,B=null;   // B — идущая пачка: {id, gen, g}
const opts=o=>Object.assign({},o,{ref:REF,base:BASE});
function stepB(stop){const b=B;let r;
  try{r=b.g.next(!!stop);}catch(err){B=null;return self.postMessage({type:'error',of:'batch',id:b.id,error:String(err&&err.message||err)});}
  if(!r.done){const p=r.value;return self.postMessage({type:'progress',id:b.id,gen:b.gen,k:p.k,of:p.of,round:p.round});}
  B=null;self.postMessage(Object.assign({type:'batch',id:b.id,gen:b.gen},r.value));}
self.onmessage=e=>{const m=e.data;
  try{
    if(m.type==='init'){importScripts(...m.urls);return;}
    if(m.type==='figure'){REF=m.ref||null;BASE=m.base||null;return;}
    if(m.type==='check')return self.postMessage({type:'check',id:m.id,gen:m.gen,issues:reviewCheck(m.E,opts(m.o))});
    if(m.type==='fix'){const r=reviewFix(m.E,m.issue,Object.assign(opts(m.o),{issues:m.issues}));
      return self.postMessage({type:'fix',id:m.id,gen:m.gen,E:r.E,moved:r.moved,dev:r.dev,why:r.why,worse:r.worse});}
    if(m.type==='batch'){B={id:m.id,gen:m.gen,g:reviewBatch(m.E,Object.assign(opts(m.o),{rules:m.rules||null}))};return stepB(false);}
    if(m.type==='more'||m.type==='stop'){if(B&&B.id===m.id)stepB(m.type==='stop');return;}
    if(m.type==='drop'){if(B&&B.id===m.id)B=null;return;}
    if(m.type==='here')return self.postMessage({type:'here',id:m.id,gen:m.gen,issues:reviewHere(m.E,m.c,opts(m.o))});
    if(m.type==='dev'){const R=REF||BASE;if(!R)throw new Error('нет ни эталона, ни открытой фигуры');const r=reviewDev(m.E,R,m.scale);
      return self.postMessage({type:'dev',id:m.id,gen:m.gen,dev:r.dev,max:r.max});}
  }catch(err){self.postMessage({type:'error',of:m.type,id:m.id,error:String(err&&err.message||err)});}};
