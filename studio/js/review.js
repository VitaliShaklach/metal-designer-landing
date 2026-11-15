/* ---------- Проверка для панели мастерской: то, что считает страница (в фоне, studio/ui/check-worker.js) ----------
   Обычный скрипт: в браузере и в Node — рядом с rules.js, fix.js, auto.js.
   reviewCheck(E, o) → Issue[] — checkFigure без правила 12 (детали и гибка считаются долго; их показывает сама страница и проверяет публикация).
   reviewFix(E, issue, o) → {E, moved, dev, why, worse}
     одиночное «Исправить» (решение Q28): правка fixIssue и тот же суд, что у автоматики (judgeAll), но без отката:
     worse — [{rule, title, was, now}], какие правила станут хуже. E — уже без лишних точек (compact), как после ручной правки на странице;
     при отказе E = null и why — причина. moved и dev — мм сайта.
     o — как у checkFigure; o.issues — строки Проверки до правки (чтобы не считать заново). Швы S ставятся на новые рёбра,
     если у фигуры они и так на всех рёбрах (как у рыси 14).
   reviewSlots(E, pts, scale, prev) → {slots, pts, idx} — прорези по местам, а не по номерам точек: ручные правки и compact перенумеровывают точки.
     pts — точки каждой прорези, какими они были (мм модели); прорезь — открытый контур E, у которого не меньше половины точек лежат
     на прежних местах (ближе 1 мм сайта). Не нашлась — прорези сейчас нет (её залатали или разорвали): в slots её нет, а в pts её
     прежние точки остаются — «Отменить» вернёт дыру, и она снова будет прорезью. pts и idx в ответе — той же длины, что на входе;
     idx — номера точек каждой прорези или null, если её сейчас нет. prev — прежние idx: контур из тех же точек — та же прорезь, где бы он
     ни был (страница поменяла размер или повернула фигуру — точки сдвинулись все разом, номера те же). */
const REVIEW_SKIP=[12];
function reviewCheck(E,o){o=o||{};return checkFigure(E,Object.assign({},o,{skip:REVIEW_SKIP.concat(o.skip||[])}));}
const reviewAllSeams=E=>!!(E.S&&E.S.length)&&addAllSeams(E).S.length===E.S.length;
function reviewFix(E,issue,o){o=o||{};const r=fixIssue(E,issue,Object.assign({},o,{seams:reviewAllSeams(E)}));
  if(r.why)return {E:null,moved:0,dev:0,why:r.why,worse:[]};
  const T=compact(r.E);
  const j=judgeAll(o.issues||reviewCheck(E,o),reviewCheck(T,Object.assign({},o,{slots:o.slots?reviewSlots(T,o.slots.map(L=>L.map(v=>E.V[v])),o.scale||1).slots:o.slots})));
  return {E:T,moved:r.moved,dev:r.dev,why:null,worse:j.worse.map(w=>({rule:w.rule,title:(RULES.find(x=>x.n===w.rule)||{}).title||'',was:w.was,now:w.now}))};}
// контуры открытых рёбер — номера точек по кругу (как openLoops в studio/lib/workdir.js)
function reviewLoops(P){const cnt=new Map();P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length];if(a===b)return;const key=a<b?a+'_'+b:b+'_'+a;(cnt.get(key)||cnt.set(key,[]).get(key)).push([a,b]);}));
  const nx=new Map();cnt.forEach(es=>{if(es.length===1)nx.set(es[0][1],es[0][0]);});
  const seen=new Set(),L=[];nx.forEach((_,s)=>{if(seen.has(s))return;const c=[];let v=s;while(v!==undefined&&!seen.has(v)){seen.add(v);c.push(v);v=nx.get(v);}if(c.length>=3&&v===s)L.push(c);});return L;}
function reviewSlots(E,pts,scale,prev){const tol=1/(scale||1),loops=reviewLoops(E.P),used=new Set(),slots=[],out=[],idx=[];
  const same=(L,I)=>I&&L.length===I.length&&(s=>I.every(v=>s.has(v)))(new Set(L));
  (pts||[]).forEach((old,k)=>{const I=prev&&prev[k];let best=loops.findIndex((L,li)=>!used.has(li)&&same(L,I)),bn=best>=0?old.length:0;
    if(best<0)loops.forEach((L,li)=>{if(used.has(li))return;let n=0;old.forEach(p=>{if(L.some(v=>V3.len(V3.sub(E.V[v],p))<=tol))n++;});if(n>bn){bn=n;best=li;}});
    if(best>=0&&bn*2>=old.length){used.add(best);slots.push(loops[best].slice());idx.push(loops[best].slice());out.push(loops[best].map(v=>E.V[v].slice()));}else{idx.push(null);out.push(old);}});
  return {slots,pts:out,idx};}
