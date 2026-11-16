/* ---------- Проверка для панели мастерской: то, что считает страница (в фоне, studio/ui/check-worker.js) ----------
   Обычный скрипт: в браузере и в Node — рядом с rules.js, fix.js, auto.js.
   reviewCheck(E, o) → Issue[] — checkFigure без правила 12 (детали и гибка считаются долго; их показывает сама страница и проверяет публикация).
   reviewFix(E, issue, o) → {E, moved, dev, why, worse}
     одиночное «Исправить» (решение Q28): правка fixIssue и тот же суд, что у автоматики (judgeAll), но без отката:
     worse — [{rule, title, was, now}], какие правила станут хуже. E — уже без лишних точек (compact), как после ручной правки на странице;
     при отказе E = null и why — причина. moved и dev — мм сайта.
     o — как у checkFigure; o.issues — строки Проверки до правки (чтобы не считать заново). Швы S ставятся на новые рёбра,
     если у фигуры они и так на всех рёбрах (как у рыси 14).
   reviewBatch(E, o) — пачка (решения Q24, Q28, Q29), генератор: «Исправить все ошибки этого типа» (o.rules = [n]) или «Исправить всё безопасное»
     (без o.rules — все правила, что чинит автоматика). Это цикл автоматики autoSteps с тем же судом (judgeAll, правило 11, «Оставить так»,
     швы на линии эталона) на своей копии фигуры. yield {round, k, of, …} после каждой пробы; next(true) — «Стоп»: посчитанное до него применимо.
     Ответ: {E — фигура после пачки без лишних точек (compact) или null, если починить нечего; fixed — сколько строк чинимых правил ушло, of — сколько
     их было; left — сколько осталось (у одного правила — его строк, у «всего безопасного» — всех ошибок); moved — наибольший сдвиг точки, мм сайта;
     reasons — [{why, n}] причины, почему строки чинимых правил остались (одинаковые, кроме мм, — одной строкой с разбросом); stopped}.
   reviewSlots(E, pts, scale, prev) → {slots, pts, idx} — прорези по местам, а не по номерам точек: ручные правки и compact перенумеровывают точки.
     pts — точки каждой прорези, какими они были (мм модели); прорезь — открытый контур E, у которого не меньше половины точек лежат
     на прежних местах (ближе 1 мм сайта). Не нашлась — прорези сейчас нет (её залатали или разорвали): в slots её нет, а в pts её
     прежние точки остаются — «Отменить» вернёт дыру, и она снова будет прорезью. pts и idx в ответе — той же длины, что на входе;
     idx — номера точек каждой прорези или null, если её сейчас нет. prev — прежние idx: контур из тех же точек — та же прорезь, где бы он
     ни был (страница поменяла размер или повернула фигуру — точки сдвинулись все разом, номера те же).
   Проход по одной (решения Q25, Q31): места — issue.at, мм модели; «то же место» — ближе REVIEW_SAME мм сайта (строже keepMatch:
     у рыси соседние короткие рёбра одного угла — разные строки; «Оставить так» тоже закрывает одну строку — keepHits).
   reviewNext(issues, rule, at, seen, scale) → Issue | null — «Следующая»: ближайшая к at строка правила rule (не сведение),
     места которой нет в seen ([at, …]); все уже были — null.
   reviewFind(issues, rule, at, scale) → Issue | null — строка правила rule на месте at (для «Предыдущая»); её починили — null.
   reviewHere(E, c, o) → Issue[] — «Здесь криво» (решение Q20): шар REVIEW_HERE_R мм сайта вокруг c (мм модели), пороги вдвое строже, без сведений.
   reviewDev(E, R, scale) → {dev, max} — «Карта отклонений»: отклонение каждой грани от R (эталон или фигура, какой её открыли), мм сайта;
   reviewMapHex(d) → '#rrggbb' — её цвет: «совпадает» зелёный, REVIEW_MAP_MAX мм и дальше — красный. */
const REVIEW_SKIP=[12],REVIEW_SAME=1;
function reviewCheck(E,o){o=o||{};return checkFigure(E,Object.assign({},o,{skip:REVIEW_SKIP.concat(o.skip||[])}));}
const reviewAllSeams=E=>!!(E.S&&E.S.length)&&addAllSeams(E).S.length===E.S.length;
function reviewFix(E,issue,o){o=o||{};const r=fixIssue(E,issue,Object.assign({},o,{seams:reviewAllSeams(E)}));
  if(r.why)return {E:null,moved:0,dev:0,why:r.why,worse:[]};
  const T=compact(r.E);
  const j=judgeAll(o.issues||reviewCheck(E,o),reviewCheck(T,Object.assign({},o,{slots:o.slots?reviewSlots(T,o.slots.map(L=>L.map(v=>E.V[v])),o.scale||1).slots:o.slots})));
  return {E:T,moved:r.moved,dev:r.dev,why:null,worse:j.worse.map(w=>({rule:w.rule,title:(RULES.find(x=>x.n===w.rule)||{}).title||'',was:w.was,now:w.now}))};}
// пачка: «Исправить все ошибки этого типа» (o.rules = [n]) и «Исправить всё безопасное» (без o.rules)
function* reviewBatch(E,o){o=o||{};const sc=o.scale||1,skip=REVIEW_SKIP.concat(o.skip||[]);
  const A=yield* autoSteps(E,Object.assign({},o,{skip,seams:reviewAllSeams(E)}));
  const aim=n=>A.rules.includes(n),sum=(c,f)=>Object.keys(c).reduce((s,k)=>s+(f(+k)?c[k]:0),0);
  const of=sum(A.before,aim),left=sum(A.after,o.rules?aim:()=>true),fixed=Math.max(0,of-sum(A.after,aim));
  // сдвиг: наибольший у правок (там и точки, слитые в другую) и у точек итога против исходной (правки одного места складываются)
  const done=A.log.filter(l=>l.done);let moved=0;done.forEach(l=>{moved=Math.max(moved,l.moved||0);});
  const used=new Set(A.E.P.flat());used.forEach(v=>{if(v<E.V.length)moved=Math.max(moved,V3.len(V3.sub(A.E.V[v],E.V[v]))*sc);});
  const by=new Map();A.log.forEach(l=>{if(!l.done&&aim(l.issue.rule))reviewWhy(by,l.why);});
  const reasons=[...by.values()].map(x=>({why:x.tpl.split('#').map((s,k)=>k?reviewSpan(x.mm[k-1])+s:s).join(''),n:x.n})).sort((a,b)=>b.n-a.n||(a.why<b.why?-1:1));
  return {E:done.length?compact(A.E):null,fixed:done.length?fixed:0,of,left,moved:done.length?moved:0,reasons,stopped:A.stopped};}
// причины отказов пачки: одинаковые, кроме чисел перед «мм», — одна строка с разбросом («неплоской на 1,05–1,48 мм»)
const REVIEW_MM=/-?\d+(?:,\d+)?(?= мм)/g;   // числа — как пишет fmtN (rules.js): без разрядов, запятая
function reviewWhy(by,why){const tpl=why.replace(REVIEW_MM,'#'),nums=why.match(REVIEW_MM)||[];let x=by.get(tpl);
  if(!x)by.set(tpl,x={tpl,n:0,mm:nums.map(()=>null)});x.n++;
  nums.forEach((s,k)=>{const v=+s.replace(',','.'),m=x.mm[k];if(!m)x.mm[k]={lo:v,hi:v,ls:s,hs:s};else{if(v<m.lo){m.lo=v;m.ls=s;}if(v>m.hi){m.hi=v;m.hs=s;}}});}
const reviewSpan=m=>m.lo===m.hi?m.ls:m.ls+'–'+m.hs;
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
function reviewNear(issues,rule,at,pick){let best=null,bd=Infinity;
  (issues||[]).forEach(i=>{if(i.info||i.rule!==rule||!pick(i))return;const d=V3.len(V3.sub(i.at,at));if(d<bd){bd=d;best=i;}});return best;}
const reviewSame=(i,at,scale)=>V3.len(V3.sub(i.at,at))*(scale||1)<REVIEW_SAME;
function reviewNext(issues,rule,at,seen,scale){return reviewNear(issues,rule,at,i=>!(seen||[]).some(p=>reviewSame(i,p,scale)));}
function reviewFind(issues,rule,at,scale){return reviewNear(issues,rule,at,i=>reviewSame(i,at,scale));}

// «Здесь криво» (решение Q20): Проверка шара REVIEW_HERE_R мм сайта вокруг c (мм модели), пороги вдвое строже (checkFigure o.region, thStrict:
// плоскость 0,5 мм при обычном 1). Только ошибки, без сведений; места «Оставить так» не показываются, как в списке
const REVIEW_HERE_R=60;
function reviewHere(E,c,o){return reviewCheck(E,Object.assign({},o||{},{region:{c,r:REVIEW_HERE_R}})).filter(i=>!i.info);}
// «Карта отклонений»: наибольшее отклонение каждой грани (faceDev, мм сайта) от эталона или, если его нет, от фигуры, какой её открыли
// (R — эталон {V, F}, фигура {V, P} или готовый индекс; индекс кешируется по объекту, refOf) → {dev: [мм сайта по граням], max}.
// Не посчиталась грань (NaN) — в max не идёт
function reviewDev(E,R,scale){const D=faceDev(E,refOf(R),scale||1),dev=Array.from(D);return {dev,max:dev.reduce((m,x)=>isFinite(x)&&x>m?x:m,0)};}
// цвет карты: «совпадает» — зелёный, REVIEW_MAP_MAX/2 — жёлтый, REVIEW_MAP_MAX мм и дальше — красный (как на сайте у узких деталей)
const REVIEW_MAP_MAX=2,REVIEW_MAP_STOPS=[[0x2e,0x9e,0x4f],[0xe8,0xc6,0x2a],[0xd0,0x1f,0x1f]];
function reviewMapHex(d){const t=Math.max(0,Math.min(1,(d||0)/REVIEW_MAP_MAX))*2,k=Math.min(1,Math.floor(t)),u=t-k,a=REVIEW_MAP_STOPS[k],b=REVIEW_MAP_STOPS[k+1];
  return '#'+a.map((x,i)=>Math.round(x+(b[i]-x)*u).toString(16).padStart(2,'0')).join('');}
