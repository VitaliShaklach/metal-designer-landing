/* ---------- фоновый поток Проверки (его запускает studio/ui/check.js) ----------
   Проверка рыси целиком — около секунды, починка с судом — ещё столько же; в фоне страница при этом не замирает.
   Здесь тот же движок и те же скрипты мастерской, что в Node (STUDIO.engine — список от сервера, порядок как в studio/lib/engine.js).
   Сообщения сюда:
     {type:'init', urls}                 — загрузить скрипты;
     {type:'figure', ref, base}          — эталон и фигура, какой её открыли (мм модели); один объект на все пересчёты: индекс эталона кешируется по объекту;
     {type:'check', id, gen, E, o}       → {type:'check', id, gen, issues}            — reviewCheck;
     {type:'fix', id, gen, E, o, issue, issues} → {type:'fix', id, gen, E, moved, dev, why, worse} — reviewFix (одиночное «Исправить»).
   Ошибка → {type:'error', of, id, error}. E — мм модели, o — как у checkFigure (th, scale, kind, slots, keep, t). */
self.window=self;
let REF=null,BASE=null;
const opts=o=>Object.assign({},o,{ref:REF,base:BASE});
self.onmessage=e=>{const m=e.data;
  try{
    if(m.type==='init'){importScripts(...m.urls);return;}
    if(m.type==='figure'){REF=m.ref||null;BASE=m.base||null;return;}
    if(m.type==='check')return self.postMessage({type:'check',id:m.id,gen:m.gen,issues:reviewCheck(m.E,opts(m.o))});
    if(m.type==='fix'){const r=reviewFix(m.E,m.issue,Object.assign(opts(m.o),{issues:m.issues}));
      return self.postMessage({type:'fix',id:m.id,gen:m.gen,E:r.E,moved:r.moved,dev:r.dev,why:r.why,worse:r.worse});}
  }catch(err){self.postMessage({type:'error',of:m.type,id:m.id,error:String(err&&err.message||err)});}};
