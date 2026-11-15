/* ---------- цикл автоматики: нашёл → починил → перепроверил (спека, «Чистая фигура» и «Автоматика», шаг 7) ----------
   Обычный скрипт: в браузере — рядом с движком editor/lynx/js и studio/js/rules.js, fix.js; в Node — в одном vm-контексте (studio/lib/engine.js).
   judgeAll(before, after) → {ok, worse: {rule, was, now}[]} — суд «ни одно правило не стало хуже»: before и after — ruleCounts или сами строки Проверки.
     Хуже — строк правила стало больше. Его же берёт панель Проверки для пачки (решение Q28).
   autoClean(E, o) → {E, log, before, after, rounds}
     o — как у checkFigure ({th, scale, kind, slots, keep, t, ref, base, skip}) и ещё:
       maxRounds = 20 — сколько проходов; onStep({round, rule, issue, done, why, fixed}) — после каждой попытки;
       seams — швы S на всех рёбрах, в том числе на новых (шаг 8 спеки); zone — радиус местной перепроверки, мм сайта (25).
     E на входе не меняется. Номера точек в ответе те же (убранные точки остаются в V без граней), поэтому o.slots и keep верны и после.
     log — {issue, done, why?}[]: сначала сделанные правки по порядку (ещё moved и dev, мм сайта), потом всё, что осталось в Проверке, с причиной.
     before и after — ruleCounts полной Проверки до и после; с seams «до» — фигура уже со швами на всех рёбрах.
   За проход правила чинятся в порядке AUTO_ORDER. Правка остаётся, только если:
     - строк её правила стало меньше и ни у одного правила строк не стало больше (правило 9 так только откатывает правку, которая его создала);
     - форма не ушла от эталона дальше th.ref (правило 11 — его держит fixIssue; эталона нет — от фигуры, какой она пришла);
     - места «Оставить так» (o.keep) не тронуты: их точки на месте, их грани целы;
     - швы на нарисованной линии эталона не сдвинуты и не убраны (риск 7 спеки), допуск AUTO_LINE_TOL.
   Иначе — откат, причина в журнал. Перепроверка после правки — местная: грани рядом с изменёнными, до и после (полная Проверка рыси — секунда,
   а попыток тысячи). В конце каждого прохода — полная Проверка против начала прохода; если стало хуже (местная не увидела), виновная правка
   ищется делением пополам, откатывается вместе со всеми после неё и больше не пробуется. Так «ни одно правило не стало хуже» верно
   для каждого прохода целиком и для всей чистки (before → after); для отдельной правки его проверяет местная перепроверка. */

const AUTO_ORDER=[14,13,2,3,5,4,10,1,6,7,8,16],AUTO_LINE_TOL=.1,AUTO_ZONE=25,AUTO_KFACE=new Set([1,4,6,7,9,11,13,14]);
const AUTO_WHY={9:'самопересечение автоматика не чинит: она только откатывает правку, которая его создала',
  11:'похожесть автоматика не чинит: грань была дальше допуска ещё до чистки',12:'производство автоматика не чинит',17:'DXF проверяется при публикации'};

function judgeAll(before,after){const cnt=x=>Array.isArray(x)?ruleCounts(x):x||{},b=cnt(before),a=cnt(after),worse=[];
  Object.keys(a).forEach(k=>{if(a[k]>(b[k]||0))worse.push({rule:+k,was:b[k]||0,now:a[k]});});
  worse.sort((x,y)=>x.rule-y.rule);return {ok:!worse.length,worse};}
const autoWorse=j=>j.worse.map(w=>`${w.rule} (было ${w.was}, стало ${w.now})`).join(', ');

// первый плохой из n шагов: ok(i) — после шага i всё ещё не хуже; известно, что после последнего — хуже
function autoFirstWorse(n,ok){let lo=-1,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(ok(m))lo=m;else hi=m;}return hi;}

// строка Проверки → ключ места: правило и его точки (номера точек от правок не меняются)
const autoKey=i=>i.rule+':'+(i.sub||'')+':'+[...i.verts].sort((a,b)=>a-b).join('_');

// что правка E → T поменяла: грани E, которых не стало или у которых сдвинулась точка, и такие же грани T
const AUTO_KEYS=new WeakMap();
const autoFaceKey=Q=>{let m=0;for(let i=1;i<Q.length;i++)if(Q[i]<Q[m])m=i;return fxKey(Q)+'>'+Q[(m+1)%Q.length];};   // те же точки в обратном обходе — другая грань (правило 13)
function autoKeys(X){let k=AUTO_KEYS.get(X);if(!k){k=X.P.map(autoFaceKey);k.set=new Set(k);AUTO_KEYS.set(X,k);}return k;}
function autoDiff(E,T){const n0=E.V.length,mv=new Map(),moved=v=>{let m=mv.get(v);if(m===undefined){m=v>=n0||fxD(T.V[v],E.V[v])>1e-9;mv.set(v,m);}return m;};
  const kE=autoKeys(E),kT=autoKeys(T),eb=[],ta=[];
  E.P.forEach((Q,i)=>{if(!kT.set.has(kE[i])||Q.some(moved))eb.push(i);});
  T.P.forEach((Q,i)=>{if(!kE.set.has(kT[i])||Q.some(moved))ta.push(i);});
  return {eb,ta,kT};}
// грани X, у которых есть точка ближе r к точкам pts или к их зеркалу x ↔ −x (зеркальная половина нужна правилу 10)
function autoNear(X,pts,r){const lo=[1e18,1e18,1e18],hi=[-1e18,-1e18,-1e18];pts.forEach(p=>{for(let k=0;k<3;k++){if(p[k]<lo[k])lo[k]=p[k];if(p[k]>hi[k])hi[k]=p[k];}});
  const r2=r*r,hit=new Map(),test=(x,y,z)=>{if(x<lo[0]-r||x>hi[0]+r||y<lo[1]-r||y>hi[1]+r||z<lo[2]-r||z>hi[2]+r)return false;
    for(let i=0;i<pts.length;i++){const p=pts[i],dx=p[0]-x,dy=p[1]-y,dz=p[2]-z;if(dx*dx+dy*dy+dz*dz<=r2)return true;}return false;};
  const near=v=>{let h=hit.get(v);if(h===undefined){const p=X.V[v];h=test(p[0],p[1],p[2])||test(-p[0],p[1],p[2]);hit.set(v,h);}return h;},out=[];
  X.P.forEach((Q,i)=>{if(Q.some(near))out.push(i);});return out;}

function autoClean(E,o){o=o||{};const sc=o.scale||1,maxRounds=o.maxRounds||20,skip0=o.skip||[],REF=o.ref?refOf(o.ref):null,zr=(o.zone||AUTO_ZONE)/sc;
  // эталона нет — похожесть меряется от фигуры, какой она пришла (а не от уже правленой: иначе уход копился бы с каждой правкой)
  const oo=Object.assign({},o,{base:o.base||(REF?null:E)});delete oo.onStep;delete oo.judge;delete oo.region;
  let cur=o.seams?addAllSeams(E):ecopy(E);   // своя копия: по ней кеши (грани, зеркало, края), а фигуру снаружи могут править на месте
  const full=X=>checkFigure(X,oo),ruleOnly=(X,n)=>checkFigure(X,Object.assign({},oo,{skip:FX_ALL.filter(k=>k!==n||skip0.includes(k))})).filter(i=>i.rule===n&&!i.info);
  // местная перепроверка: правила 11 (держит fixIssue), 12 и 15 (долгие) — только в полной
  const LSKIP=[...new Set(skip0.concat([11,12,15,17]))];
  const local=(X,fs)=>ruleCounts(checkFigure(fs?{V:X.V,P:fs.map(i=>X.P[i]),S:X.S}:X,Object.assign({},oo,{skip:LSKIP})).filter(i=>!fs||i.sub!=='inside-out'));
  let iss=full(cur);const before=ruleCounts(iss);
  // «Оставить так»: точки этих мест, а у правил про грань или деталь (AUTO_KFACE) — ещё и сами грани
  const KV=new Set(),KF=new Set();
  if(o.keep&&o.keep.length)keepHits(checkFigure(cur,Object.assign({},oo,{keep:null})),o.keep,sc).forEach(i=>{
    i.verts.forEach(v=>KV.add(v));if(AUTO_KFACE.has(i.rule))i.faces.forEach(f=>KF.add(autoFaceKey(cur.P[f])));});
  // шов на линии эталона? (по месту шва: фигура между правками другая, место то же)
  const LINE=new Map(),onLine=(X,a,b)=>{const A=X.V[a],B=X.V[b],k=(a<b?[A,B]:[B,A]).map(p=>p.map(x=>x.toFixed(3)).join()).join(';');let v=LINE.get(k);
    if(v===undefined){v=refOnLine(REF,A,B,sc);LINE.set(k,v);}return v;};
  const segD=(p,a,b)=>{const d=V3.sub(b,a),t=Math.max(0,Math.min(1,V3.dot(V3.sub(p,a),d)/(V3.dot(d,d)||1)));return fxD(p,V3.add(a,V3.mul(d,t)));};
  const BEFORE=new WeakMap();
  const judge=(E0,T,issue)=>{const D=autoDiff(E0,T);
    if(!D.eb.length&&!D.ta.length)return 'правка ничего не поменяла';
    if(KV.size){const used=new Set(T.P.flat());for(const v of KV)if(!used.has(v)||fxD(T.V[v],E0.V[v])>1e-9)return 'место «Оставить так» не трогаю';}
    for(const k of KF)if(!D.kT.set.has(k))return 'место «Оставить так» не трогаю';
    if(REF&&REF.T){const tol=AUTO_LINE_TOL/sc,seen=new Set();let segs=null;
      for(const f of D.eb){const Q=E0.P[f];for(let k=0;k<Q.length;k++){const a=Q[k],b=Q[(k+1)%Q.length],key=fxEk(a,b);if(a===b||seen.has(key))continue;seen.add(key);
        if(!onLine(E0,a,b))continue;
        segs=segs||D.ta.flatMap(i=>T.P[i].map((u,j,R)=>[T.V[u],T.V[R[(j+1)%R.length]]]));
        // шов на месте, если его концы и точки вдоль него (через 5 мм сайта) лежат на рёбрах новой фигуры
        const A=E0.V[a],B=E0.V[b],n=Math.max(2,Math.ceil(fxD(A,B)*sc/5)),pts=[A,B];for(let i=0;i<n;i++)pts.push(V3.add(A,V3.mul(V3.sub(B,A),(i+.5)/n)));
        if(pts.some(p=>!segs.some(s=>segD(p,s[0],s[1])<=tol)))return 'шов на линии эталона не двигаю';}}}
    let b,a;
    if(issue.sub==='inside-out'){b=local(E0,null);a=local(T,null);}
    else{const pts=[];D.eb.forEach(f=>E0.P[f].forEach(v=>pts.push(E0.V[v])));D.ta.forEach(f=>T.P[f].forEach(v=>pts.push(T.V[v])));
      // «до» у вариантов одной правки часто одно и то же (те же грани рядом) — считается один раз на фигуру
      const fb=autoNear(E0,pts,zr),kb=fb.join();let C=BEFORE.get(E0);if(!C)BEFORE.set(E0,C=new Map());
      b=C.get(kb);if(!b)C.set(kb,b=local(E0,fb));a=local(T,autoNear(T,pts,zr));}
    if((a[issue.rule]||0)>=(b[issue.rule]||0))return 'строка правила '+issue.rule+' после правки осталась';
    const j=judgeAll(b,a);return j.ok?null:'правка откатана: стало хуже правило '+autoWorse(j);};
  // точки, которые выравнивание (fxTidy) не двигает: места «Оставить так» и концы швов на линии эталона
  const PIN=new WeakMap(),pinOf=X=>{let p=PIN.get(X);if(!p){p=new Set(KV);if(REF&&REF.T){const cnt=new Map();X.P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length];if(a!==b){const e=fxEk(a,b);cnt.set(e,(cnt.get(e)||0)+1);}}));
    cnt.forEach((n,e)=>{if(n<2)return;const [a,b]=e.split('_').map(Number);if(onLine(X,a,b)){p.add(a);p.add(b);}});}PIN.set(X,p);}return p;};
  // когда место меняли в последний раз: отказ пробуется снова, только если рядом что-то поменялось
  const log=[],fail=new Map(),ban=new Map(),touch=new Map();let stamp=0,fixed=0,rounds=0;
  const fresh=(i,X)=>{const f=fail.get(autoKey(i));if(!f)return true;
    return i.verts.some(v=>(touch.get(v)||0)>f.at)||i.faces.some(fi=>X.P[fi]&&X.P[fi].some(v=>(touch.get(v)||0)>f.at));};
  for(let round=0;round<maxRounds;round++){rounds=round+1;const start=cur,cnt0=ruleCounts(iss),chain=[];let did=0;
    for(const rule of AUTO_ORDER){if(skip0.includes(rule)||!iss.some(i=>i.rule===rule&&!i.info)&&!did)continue;
      let L=ruleOnly(cur,rule),k=0;
      while(k<L.length){const i=L[k++],key=autoKey(i);if(ban.has(key)||!fresh(i,cur))continue;
        const r=fixIssue(cur,i,Object.assign({},oo,{judge,pin:pinOf(cur)}));
        if(r.why){fail.set(key,{at:stamp,why:r.why});if(o.onStep)o.onStep({round,rule,issue:i,done:false,why:r.why,fixed});continue;}
        const D=autoDiff(cur,r.E);stamp++;D.eb.forEach(f=>cur.P[f].forEach(v=>touch.set(v,stamp)));D.ta.forEach(f=>r.E.P[f].forEach(v=>touch.set(v,stamp)));
        cur=r.E;did++;fixed++;fail.delete(key);log.push({issue:i,done:true,moved:r.moved,dev:r.dev});chain.push({E:cur,key,issue:i,n:log.length-1});
        if(o.onStep)o.onStep({round,rule,issue:i,done:true,why:null,fixed});
        L=ruleOnly(cur,rule);k=0;}}   // номера граней после правки другие — список правила заново
    if(!did)break;
    iss=full(cur);let j=judgeAll(cnt0,iss);
    if(!j.ok){   // местная перепроверка не увидела: найти виновную правку, откатить её и всё после неё
      const bad=autoFirstWorse(chain.length,m=>judgeAll(cnt0,full(chain[m].E)).ok),c=chain[bad];
      j=bad===chain.length-1?j:judgeAll(cnt0,full(c.E));
      ban.set(c.key,'правка откатана: после неё стало хуже правило '+autoWorse(j));
      fixed-=log.length-c.n;log.length=c.n;cur=bad?chain[bad-1].E:start;iss=full(cur);fail.clear();}}   // отказы считались на откатанной фигуре — пробовать заново
  const after=ruleCounts(iss);
  iss.forEach(i=>{if(i.info)return;const key=autoKey(i),f=fail.get(key);
    log.push({issue:i,done:false,why:ban.get(key)||(f&&f.why)||AUTO_WHY[i.rule]||(RULE_FIX.has(i.rule)?'не дошла очередь: проходы кончились':'это правило автоматика не чинит')});});
  return {E:cur,log,before,after,rounds};}

if(typeof module!=='undefined')module.exports={judgeAll,autoClean,autoFirstWorse,AUTO_ORDER};
