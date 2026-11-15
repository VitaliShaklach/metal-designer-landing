/* ---------- Проверка: починка одного места и швы на всех рёбрах (спека, таблица правил «Чистая фигура») ----------
   Обычный скрипт: в браузере — рядом с движком editor/lynx/js и studio/js/rules.js, в Node — в одном vm-контексте с ним (studio/lib/engine.js).
   fixIssue(E, issue, o) → {E, moved, dev, why}
     E     — новая фигура {V, P, S}; при отказе — та же E, что пришла (она не меняется никогда).
     moved — наибольший сдвиг точки, мм сайта (точка, слитая с другой, считается по месту, куда она ушла).
     dev   — наибольшее отклонение затронутых граней от эталона, мм сайта (правило 11); эталона нет — от самой E.
     why   — причина отказа по-русски («слить нельзя: грань станет неплоской на 3 мм») или null.
   o: как у checkFigure — {th, scale, kind, slots, t, ref, base}. Номера точек не меняются: убранные точки остаются в V без граней
   (compact в конце работы), поэтому o.slots и номера в строках Проверки остаются верными.
   Правка остаётся, только если: строки правила стало меньше, форма ушла от эталона не дальше th.ref (правило 11 держит),
   изменённые грани плоские, граней-«бантиков» нет. Края (прорези, стена) не трогаются.
   o.seams — после правки швы S ставятся на все рёбра (addAllSeams): у новых рёбер (разрез грани) шов тоже есть, как у рыси 14.
   o.pin — точки (Set номеров), которые выравнивание не двигает.
   o.judge(E, T, issue, chg) → причина отказа или null — суд вместо «строки правила стало меньше»: его даёт цикл автоматики (studio/js/auto.js).
   addAllSeams(E) → E: швы S на всех рёбрах между гранями. */

const FX_ALL=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
const fxEk=(a,b)=>a<b?a+'_'+b:b+'_'+a;
const fxKey=Q=>[...Q].sort((a,b)=>a-b).join('_');
const fxD=(a,b)=>V3.len(V3.sub(a,b));
const fxMid=(a,b)=>V3.mul(V3.add(a,b),.5);

// грань без повторов подряд и без «шпилек» a, c, a
function fxFixFace(Q){const r=Q.slice();let ch=true;
  while(ch&&r.length>1){ch=false;
    for(let i=0;i<r.length;i++){const j=(i+1)%r.length;if(r[i]===r[j]){r.splice(j,1);ch=true;break;}}
    if(ch)continue;
    for(let i=0;i<r.length&&r.length>2;i++){const p=r[(i+r.length-1)%r.length],n=r[(i+1)%r.length];
      if(p===n){[i,(i+1)%r.length].sort((x,y)=>y-x).forEach(k=>r.splice(k,1));ch=true;break;}}}
  return r;}
// b → a, точка a встаёт в p; rep запоминает, куда ушла b
function fxWeld(T,rep,a,b,p){T.V[a]=p.slice();rep.set(b,a);
  T.P=T.P.map(Q=>fxFixFace(Q.map(v=>v===b?a:v))).filter(Q=>Q.length>=3);
  T.S=T.S.map(s=>s.map(v=>v===b?a:v)).filter(s=>s[0]!==s[1]);}
// убрать точку v из всех граней (она на прямой, форма не меняется); шов через неё сохраняется
function fxRemove(T,v){T.P=T.P.map(Q=>Q.filter(x=>x!==v)).filter(Q=>Q.length>=3);
  const ns=T.S.filter(s=>s.includes(v)).map(s=>s[0]===v?s[1]:s[0]);T.S=T.S.filter(s=>!s.includes(v));if(ns.length===2&&ns[0]!==ns[1])T.S.push([ns[0],ns[1]]);}
// швы, у которых ребра уже нет, уходят
function fxPruneS(T){const ed=new Set(),seen=new Set();T.P.forEach(Q=>Q.forEach((a,k)=>ed.add(fxEk(a,Q[(k+1)%Q.length]))));
  T.S=T.S.filter(([a,b])=>{const k=fxEk(a,b);if(!ed.has(k)||seen.has(k))return false;seen.add(k);return true;});}
// число открытых рёбер (одна грань у ребра)
function fxOpenCount(T){const c=new Map();T.P.forEach(Q=>Q.forEach((a,k)=>{const e=fxEk(a,Q[(k+1)%Q.length]);c.set(e,(c.get(e)||0)+1);}));let n=0;c.forEach(v=>{if(v===1)n++;});return n;}
// грани f и g — одна (по общим рёбрам); false — не сливаются
function fxMerge(T,f,g){const L=mergeTwo(T.P,f,g);if(!L)return false;T.P.splice(Math.max(f,g),1);T.P.splice(Math.min(f,g),1);T.P.push(L);return true;}

// выравнивание рядом с точками seed: свободны точки граней, где они есть (и зеркальные), остальные закреплены; решатель — clean.js solve
function fxTidy(c,T,seed,ring=1){if(c.raw)return;   // вариант «как есть»: выравнивание тянет соседние грани к идеальной плоскости и уводит форму
  const mm=c.mm,free=new Set(seed);   // зеркало — как у исходной фигуры: номера точек те же, слитые точки в грани не входят
  for(let r=0;r<ring;r++){const cur=new Set(free);T.P.forEach(Q=>{if(Q.some(v=>cur.has(v)))Q.forEach(v=>free.add(v));});}
  [...free].forEach(v=>{if(mm[v]>=0)free.add(mm[v]);});
  c.open.forEach(v=>free.delete(v));   // края (глаза, стена, прорези) не двигаем
  if(c.o.pin)c.o.pin.forEach(v=>free.delete(v));   // и точки, закреплённые циклом автоматики
  const fs=[];T.P.forEach((Q,i)=>{if(Q.some(v=>free.has(v)))fs.push(i);});
  const idx=new Map(),V=[];fs.forEach(i=>T.P[i].forEach(v=>{if(!idx.has(v)){idx.set(v,V.length);V.push(T.V[v].slice());}}));
  const sub={V,P:fs.map(i=>T.P[i].map(v=>idx.get(v))),S:[]},pins=new Map();
  idx.forEach((j,v)=>{if(!free.has(v))pins.set(j,T.V[v].slice());});
  const R=rulesClean().solve(sub,pins,{it:300,sym:true});
  idx.forEach((j,v)=>{if(free.has(v))T.V[v]=R.V[j];});}

// число строк правила n в фигуре T (остальные правила пропущены — быстро)
function fxCount(c,T,n){const o=c.o;return checkFigure(T,{scale:c.sc,kind:o.kind,slots:o.slots,th:o.th,t:o.t,ref:o.ref||null,skip:FX_ALL.filter(k=>k!==n)}).filter(i=>i.rule===n&&!i.info).length;}

// суд над вариантом: {why} или {T, moved, dev}
function fxJudge(c,T,rep,mv,opt){const E=c.E,sc=c.sc,th=c.th,n0=E.V.length,rule=c.issue.rule;
  if(T.P.some(Q=>new Set(Q).size!==Q.length))return {why:'грань перехлестнулась: точки совпали'};
  fxPruneS(T);if(c.o.seams)T.S=addAllSeams(T).S;
  if(rule!==8&&fxOpenCount(T)>c.openN)return {why:'правка оставила бы дыру'};
  const used=new Set();T.P.forEach(Q=>Q.forEach(v=>used.add(v)));
  let moved=Math.max(0,...mv);used.forEach(i=>{if(i<n0)moved=Math.max(moved,fxD(T.V[i],E.V[i])*sc);});
  rep.forEach((_,b)=>{let t=b;while(rep.has(t))t=rep.get(t);if(b<n0)moved=Math.max(moved,fxD(T.V[t],E.V[b])*sc);});
  // изменённые грани: новый набор точек или сдвинутая точка
  const old=new Set(E.P.map(fxKey)),chg=[];
  T.P.forEach((Q,i)=>{if(!old.has(fxKey(Q))||Q.some(v=>v>=n0||fxD(T.V[v],E.V[v])>1e-9))chg.push(i);});
  // плоскость: не хуже, чем было у граней у этого места (правило 1 — строго по порогу)
  const was=c.issue.rule===1?0:Math.max(0,...E.P.filter(Q=>Q.some(v=>c.issue.verts.includes(v))).map(Q=>polyDev(E.V,Q)*sc)),tol=Math.max(th.planar,was)+1e-6;
  let bad=0;chg.forEach(i=>{bad=Math.max(bad,polyDev(T.V,T.P[i])*sc);});
  if(bad>tol)return {why:(opt.merge?'слить нельзя: грань станет неплоской на ':'грань станет неплоской на ')+fmtN(bad)+' мм'};
  // свой суд (цикл автоматики, studio/js/auto.js): o.judge(E, T, строка, изменённые грани T) → причина отказа или null; он раньше похожести — она считается дольше.
  // weak — причина «ничего не вышло»: в ответ идёт, только если у других вариантов причины по делу нет
  if(c.o.judge){const w=c.o.judge(E,T,c.issue,chg);if(w)return {why:w,weak:/(осталась|не поменяла)$/.test(w)};}
  // правило 11: похожесть (у новой грани на месте дыры сравнивать не с чем — только с настоящим эталоном)
  let dev=0;
  if(!opt.noDev||c.o.ref){const R=c.R(),sub={V:T.V,P:chg.map(i=>T.P[i])};if(sub.P.length){const D=faceDev(sub,R,sc);dev=Math.max(0,...D);}
    if(dev>th.ref)return {why:'правка уведёт форму от '+(c.o.ref?'эталона':'открытой фигуры')+' на '+fmtN(dev)+' мм (допуск '+fmtN(th.ref)+' мм)'};}
  if(!c.o.judge&&fxCount(c,T,rule)>=c.before)return {why:'строка правила '+rule+' после правки осталась',weak:true};
  return {T,moved,dev};}

// запуск одного варианта: mk() → {T, rep, mv} или строка-причина
function fxRun(c,mk,opt){let r;try{r=mk();}catch(e){return {why:'правка не вышла: '+e.message};}
  if(typeof r==='string')return {why:r};return fxJudge(c,r.T,r.rep||new Map(),r.mv||[],Object.assign({},opt,{merge:opt.merge||!!r.merge}));}

// стянуть точки a и b в одну: варианты — на a, на b, посередине; зеркальная пара стягивается так же
function fxCollapse(c,a,b){const E=c.E,mm=c.mm;
  if([a,b,mm[a],mm[b]].some(v=>v>=0&&c.open.has(v)))return 'край (глаз или стена) не трогаю';
  if((mm[a]===-2)!==(mm[b]===-2)&&mm[a]!==b)return 'один конец на середине фигуры';
  const pair=mm[a]>=0&&mm[b]>=0&&mm[a]!==b&&mm[a]!==a&&mm[b]!==b;
  return [E.V[a],E.V[b],fxMid(E.V[a],E.V[b])].map(p0=>()=>{const T=ecopy(E),rep=new Map(),p=p0.slice();if(mm[a]===-2||mm[a]===b)p[0]=0;
    fxWeld(T,rep,a,b,p);const seed=new Set([a]);if(pair){fxWeld(T,rep,mm[a],mm[b],[-p[0],p[1],p[2]]);seed.add(mm[a]);}
    fxTidy(c,T,seed);return {T,rep};});}

const FX={
  // 1. плоская грань: решатель плоскостей; если форма уходит дальше — разрезать по диагонали на плоские
  1(c){const E=c.E,f=c.issue.faces[0],Q=E.P[f],th=c.th,sc=c.sc;
    const solve=ring=>()=>{const T=ecopy(E);fxTidy(c,T,new Set(Q),ring);return {T};};
    const split=()=>{if(Q.length<4)return 'грань уже треугольник';const T=ecopy(E),R=c.R();
      // диагонали: сначала по неплоскости кусков, при равных — по отклонению от эталона
      const pieces=(Q0,depth)=>{if(Q0.length<4||polyDev(T.V,Q0)*sc<=th.planar*.9||depth===0)return [Q0];
        const n=Q0.length,C=[];for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;const A=Q0.slice(i,j+1),B=Q0.slice(j).concat(Q0.slice(0,i+1));
          C.push({pc:[A,B],pd:Math.max(polyDev(T.V,A),polyDev(T.V,B))*sc});}
        const m=Math.min(...C.map(x=>x.pd)),tie=C.filter(x=>x.pd<=m+1e-6);
        const best=tie.length===1?tie[0]:tie.map(x=>({x,d:Math.max(0,...faceDev({V:T.V,P:x.pc},R,sc))})).sort((p,q)=>p.d-q.d)[0].x;
        return best.pc.flatMap(P=>pieces(P,depth-1));};
      const P=pieces(Q,3);if(P.length<2)return 'разрезать не на что';T.P.splice(f,1,...P.slice(0,1));T.P.push(...P.slice(1));
      // зеркальная грань режется так же (куски — через зеркальные точки, обход обратный): иначе у кусков не было бы зеркальных граней (правило 10)
      const m=mirrorPoly(E,f,c.mm);if(m>=0&&m!==f){const MP=P.map(R=>R.map(v=>c.mm[v]===-2?v:c.mm[v]).reverse());T.P.splice(m,1,MP[0]);T.P.push(...MP.slice(1));}
      return {T};};
    return {list:[solve(1),split],ordered:true,lastWhy:true};},   // lastWhy: разрез — запасной вариант, причина отказа — его
  // 2, 3. короткое ребро и ступенька: две точки — в одну
  2(c){const r=fxCollapse(c,c.issue.verts[0],c.issue.verts[1]);return typeof r==='string'?r:{list:r};},
  3(c){const r=fxCollapse(c,c.issue.verts[0],c.issue.verts[1]);return typeof r==='string'?r:{list:r};},
  // 4. игла: стянуть короткую сторону грани или слить грань с соседней через одну из сторон при острой точке
  4(c){const E=c.E,f=c.issue.faces[0],Q=E.P[f],v=c.issue.verts[0],n=Q.length,k=Q.indexOf(v),list=[];
    const sides=Q.map((a,i)=>({a,b:Q[(i+1)%n],L:fxD(E.V[a],E.V[Q[(i+1)%n]])})).sort((x,y)=>x.L-y.L);
    sides.slice(0,2).forEach(s=>{const r=fxCollapse(c,s.a,s.b);if(typeof r==='string')list.push(()=>r);else list.push(...r);});
    [[Q[(k+n-1)%n],v],[v,Q[(k+1)%n]]].forEach(([a,b])=>{const g=E.P.findIndex((R,i)=>i!==f&&R.some((x,j)=>x===b&&R[(j+1)%R.length]===a));
      if(g>=0)list.push(()=>{const T=ecopy(E);if(!fxMerge(T,f,g))return 'грани не сливаются';fxTidy(c,T,new Set(Q));return {T,merge:true};});});
    return {list};},
  // 5. почти на прямой: точка встаёт на прямую; ровно на прямой во всех гранях — убрать
  5(c){const E=c.E,v=c.issue.verts[0],mm=c.mm,sc=c.sc,pair=mm[v]>=0&&mm[v]!==v?mm[v]:-1,extra=c.issue.sub==='extra';
    if(c.open.has(v)||pair>=0&&c.open.has(pair))return 'край (глаз или стена) не трогаю';
    // проекция точки u грани Q на прямую её соседей: {q, off — отход, мм сайта}
    const proj=(T,Q,u)=>{const k=Q.indexOf(u),a=T.V[Q[(k+Q.length-1)%Q.length]],d=V3.sub(T.V[Q[(k+1)%Q.length]],a),t=Math.max(0,Math.min(1,V3.dot(V3.sub(T.V[u],a),d)/(V3.dot(d,d)||1))),q=V3.add(a,V3.mul(d,t));return {q,off:fxD(T.V[u],q)*sc};};
    return {list:[()=>{const T=ecopy(E),mv=[];
      const one=u=>{if(!extra){const Q=T.P.find(R=>R.includes(u)&&proj(T,R,u).off>1e-9);if(!Q)return;const p=proj(T,Q,u);mv.push(p.off);T.V[u]=p.q;}
        // на прямой во всех гранях — точка не нужна
        if(T.P.filter(R=>R.includes(u)).every(R=>proj(T,R,u).off<.01))fxRemove(T,u);};
      one(v);if(pair>=0)one(pair);fxTidy(c,T,new Set([v,pair].filter(x=>x>=0)));return {T,mv};}]};},
  // 6. узкая деталь: слить с соседом через самый плоский шов
  6(c){return fxMergeCands(c,c.issue.faces);},
  // 7. лишний шов: две грани — в одну
  7(c){const [f,g]=c.issue.faces;return {list:[()=>fxMergePair(c,f,g)],merge:true};},
  // 8. дыра: закрыть гранью (прорези и стена не входят в строку)
  8(c){const E=c.E,vs=new Set(c.issue.verts),SL=new Set();(c.o.slots||[]).forEach(L=>L.forEach((a,k)=>SL.add(fxEk(a,L[(k+1)%L.length]))));
    const cnt=new Map();E.P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=fxEk(a,b);(cnt.get(key)||cnt.set(key,[]).get(key)).push([a,b]);}));
    const nx=new Map();let bad=null;
    cnt.forEach((es,key)=>{if(es.length!==1)return;const [a,b]=es[0];if(!vs.has(a)||!vs.has(b)||SL.has(key))return;
      if(c.o.kind==='wall'&&Math.abs(E.V[a][2])<.5&&Math.abs(E.V[b][2])<.5)return;if(nx.has(b))bad='край дыры ветвится';nx.set(b,a);});   // заплата идёт против обхода края
    if(bad)return bad;if(nx.size<3)return 'край дыры не найден';
    const st=nx.keys().next().value,L=[];let u=st;while(u!==undefined&&L.length<=nx.size){L.push(u);u=nx.get(u);if(u===st)break;}
    if(L.length!==nx.size)return 'дыра из нескольких кусков — закрыть руками';
    return {list:[()=>{const T=ecopy(E);T.P.push(L);return {T};}],noDev:true};},
  // 10. симметрия: пара точек подгоняется к зеркалу, точка у середины — на x = 0
  10(c){const E=c.E,vs=c.issue.verts;
    if(vs.some(v=>c.open.has(v)))return 'край (глаз или стена) не трогаю';
    if(c.issue.sub==='nomirror')return 'зеркальной точки нет — подогнать не к чему';
    if(c.issue.sub==='noface')return 'у грани нет зеркальной: чинится правкой точек, не этой кнопкой';
    return {list:[()=>{const T=ecopy(E),mv=[];
      if(vs.length===2){const [i,j]=vs,p=E.V[i],q=E.V[j],x=(p[0]-q[0])/2,y=(p[1]+q[1])/2,z=(p[2]+q[2])/2;
        T.V[i]=[x,y,z];T.V[j]=[-x,y,z];}
      else{const i=vs[0];T.V[i]=[0,E.V[i][1],E.V[i][2]];}
      fxTidy(c,T,new Set(vs));return {T,mv};}]};},
  // 13. грань смотрит внутрь: развернуть (вывернута вся фигура — развернуть все)
  13(c){return {list:[()=>{const T=ecopy(c.E);if(c.issue.sub==='inside-out')T.P.forEach(Q=>Q.reverse());else T.P[c.issue.faces[0]].reverse();return {T};}]};},
  // 14. вырожденная грань: близкие точки — в одну; три точки на прямой — убрать среднюю
  14(c){const E=c.E,f=c.issue.faces[0],sc=c.sc;
    return {list:[()=>{const T=ecopy(E),rep=new Map();let Q=E.P[f].slice();
      for(let g=0;g<20&&Q.length>=3;g++){const k=Q.findIndex((a,i)=>{const b=Q[(i+1)%Q.length];return a===b||fxD(T.V[a],T.V[b])*sc<.01;});if(k<0)break;
        const a=Q[k],b=Q[(k+1)%Q.length];
        if(a===b)T.P=T.P.map(fxFixFace).filter(R=>R.length>=3);else fxWeld(T,rep,a,b,fxMid(T.V[a],T.V[b]));
        Q=fxFixFace(Q.map(v=>v===b?a:v));}
      if(Q.length===3&&new Set(Q).size===3&&T.P.some(R=>fxKey(R)===fxKey(Q))){
        // средняя точка — напротив самой длинной стороны; лежит на ней — не нужна
        const S=[[fxD(T.V[Q[0]],T.V[Q[1]]),Q[2],Q[0],Q[1]],[fxD(T.V[Q[1]],T.V[Q[2]]),Q[0],Q[1],Q[2]],[fxD(T.V[Q[2]],T.V[Q[0]]),Q[1],Q[2],Q[0]]].sort((x,y)=>y[0]-x[0])[0],
          [L,m,a,b]=S,h=V3.len(V3.cross(V3.sub(T.V[a],T.V[m]),V3.sub(T.V[b],T.V[m])))/(L||1);
        if(h*sc<.01)fxRemove(T,m);}
      return {T,rep};}]};},
  // 16. узкая прорезь: расширить поперёк, если правило 11 позволяет
  16(c){const E=c.E,L=c.issue.verts,sc=c.sc,t=c.o.t||2;
    return {list:[()=>{const V=E.V,n=polyNorm(V,L),cc=polyC(V,L);let u=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(n,V3.dot(u,n))));const w=V3.cross(n,u);
      // поперечник: наименьшая ширина по сторонам контура — как у правила 16 (clean.js width); направление — нормаль той стороны
      let best=1e18,dir=null;L.forEach((a,k)=>{const b=L[(k+1)%L.length],d=V3.sub(V[b],V[a]),dd=[V3.dot(d,u),V3.dot(d,w)],l=Math.hypot(dd[0],dd[1]);if(l<1e-9)return;
        const nx=-dd[1]/l,ny=dd[0]/l;let lo=1e18,hi=-1e18;L.forEach(i=>{const e=V3.sub(V[i],V[a]),s=V3.dot(e,u)*nx+V3.dot(e,w)*ny;lo=Math.min(lo,s);hi=Math.max(hi,s);});
        if(hi-lo<best){best=hi-lo;dir=V3.add(V3.mul(u,nx),V3.mul(w,ny));}});
      if(!dir)return 'направление прорези не найдено';
      if(best>=t/sc)return 'прорезь уже не уже листа';const need=(t/sc-best)/2*1.02+1e-6,T=ecopy(E),mv=[];
      L.forEach(i=>{const s=V3.dot(V3.sub(V[i],cc),dir)>=0?1:-1;T.V[i]=V3.add(V[i],V3.mul(dir,s*need));});mv.push(need*sc);
      return {T,mv};}]};}
};

// слить грань (или кусок из нескольких граней) с соседом: сначала через самый плоский шов; зеркальная пара — так же
function fxMergePair(c,f,g){const E=c.E,T=ecopy(E),mm=c.mm,jobs=[[E.P[f],E.P[g]]];
  const m1=mirrorPoly(E,f,mm),m2=mirrorPoly(E,g,mm);if(m1>=0&&m2>=0&&!(m1===f&&m2===g)&&!(m1===g&&m2===f))jobs.push([E.P[m1],E.P[m2]]);
  const seed=new Set();
  for(const [A,B] of jobs){const i=T.P.findIndex(Q=>fxKey(Q)===fxKey(A)),j=T.P.findIndex(Q=>fxKey(Q)===fxKey(B));if(i<0||j<0||i===j)return 'грани не найдены';
    if(!fxMerge(T,i,j))return 'грани не сливаются';A.concat(B).forEach(v=>seed.add(v));}
  fxTidy(c,T,seed);return {T,merge:true};}
function fxMergeCands(c,faces){const E=c.E,out=[],inside=new Set(faces);
  faces.forEach(f=>E.P.forEach((R,g)=>{if(inside.has(g)||!polysAdjacent(E,f,g))return;
    const n1=polyNorm(E.V,E.P[f]),n2=polyNorm(E.V,R),dih=Math.acos(Math.max(-1,Math.min(1,V3.dot(n1,n2))));out.push({f,g,dih});}));
  out.sort((x,y)=>x.dih-y.dih);
  if(!out.length)return 'соседей нет';
  return {list:out.slice(0,3).map(x=>()=>fxMergePair(c,x.f,x.g)),ordered:true,merge:true};}

// зеркало, края и число открытых рёбер фигуры — один раз на фигуру. Только в цикле автоматики (o.judge): там фигуры — свои копии,
// на месте их никто не правит; фигуру страницы правят на месте (тянут точку), для неё считается каждый раз
const FX_OF=new WeakMap();
function fxOf(E){let k=FX_OF.get(E);if(!k)FX_OF.set(E,k={mm:mirrorMap(E.V),open:openVerts(E),openN:fxOpenCount(E)});return k;}
function fixIssue(E,issue,o){o=o||{};const sc=o.scale||1,th=Object.assign({},TH_DEFAULT,o.th||{});
  const fail=why=>({E,moved:0,dev:0,why});
  if(issue.info||!RULE_FIX.has(issue.rule))return fail('это правило автоматика не чинит');
  const K=o.judge?fxOf(E):{mm:mirrorMap(E.V),open:openVerts(E),openN:fxOpenCount(E)},c={E,sc,th,o,issue,mm:K.mm,open:K.open,R:null,before:0};
  c.R=()=>c.RR||(c.RR=refOf(o.ref||o.base||E));
  let plan;try{plan=FX[issue.rule](c);}catch(e){return fail('правка не вышла: '+e.message);}
  if(typeof plan==='string')return fail(plan);
  c.before=o.judge?0:fxCount(c,E,issue.rule);c.openN=K.openN;
  const opt={merge:!!plan.merge,noDev:!!plan.noDev};let best=null,why=null,weak=true;
  // каждый вариант — сначала как есть (c.raw: без выравнивания), потом с выравниванием; берётся тот, где точки ушли меньше
  out:for(const mk of plan.list)for(const raw of [true,false]){c.raw=raw;const r=fxRun(c,mk,opt);if(r.why){if(!why||weak&&!r.weak||plan.lastWhy&&!r.weak){why=r.why;weak=!!r.weak;}continue;}
    if(!best||r.moved<best.moved-1e-9)best=r;if(plan.ordered)break out;}
  c.raw=false;
  return best?{E:best.T,moved:best.moved,dev:best.dev,why:null}:fail(why||'не получилось');}

// швы S на всех рёбрах между гранями (шаг 8 спеки): деталей станет столько же, сколько граней
function addAllSeams(E){const R=ecopy(E),have=new Set(R.S.map(([a,b])=>fxEk(a,b))),cnt=new Map();
  R.P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length];if(a===b)return;const key=fxEk(a,b);cnt.set(key,(cnt.get(key)||0)+1);}));
  cnt.forEach((n,key)=>{if(n>=2&&!have.has(key)){have.add(key);R.S.push(key.split('_').map(Number));}});return R;}

if(typeof module!=='undefined')module.exports={fixIssue,addAllSeams};
