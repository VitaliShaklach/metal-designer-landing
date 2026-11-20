// Сборка коней 50/100/150 из модели Meshy (тикет #133, спека 2026-11-20-horse-page-design, план 2026-11-20-horse-page, задача 2).
// node horse-r4t9p/tools/make-horse.js [путь к horse150.obj] [--side +x|-x] [--only 150] [--preview]
//   эталон → Y вверх, морда на +Z, высота 800 мм, x = 0 — плоскость симметрии → половина (лучшая, --side) → для N: упростить половину до N/2
//   треугольников (точки шва — на x = 0) → зеркало → почти плоские треугольники в многоугольники (0,5° / 0,3 мм) → это ref (правило 11) →
//   чистка (короткие рёбра, ступеньки, иглы, узкие, грани наружу, выравнивание в плоскость; правка с самопересечением/протыканием/уходом от ref — откат) →
//   проверка → js/plates-horse{N}.js, tools/img/horse{N}_{front,side,iso}.png, tools/report.md.
// Детерминированно: повторный запуск с тем же эталоном даёт те же файлы.
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..'),JS=path.join(__dirname,'..','js'),args=process.argv.slice(2);
const opt=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
const SRC=args.find((a,i)=>!a.startsWith('--')&&!['--side','--only'].includes(args[i-1]))||path.join(ROOT,'from-dev/art/tools/plates/src/horse/horse150.obj');
// какая половина эталона идёт в дело: выбрано по анфасу (см. report.md, «Половина»)
const SIDE=opt('--side')||'+x',ONLY=opt('--only'),PREVIEW=args.includes('--preview'),NS=ONLY?[+ONLY]:[50,100,150],H=800;
// движок — в vm, как в smoke.js
const ctx={console,Math,TextDecoder};vm.createContext(ctx);
const FILES=['mesh','edit','models-poly','figures','prod','slots','sheets','bend','bend3d','angles-core'];
vm.runInContext(FILES.map(f=>fs.readFileSync(path.join(JS,f+'.js'),'utf8')).join('\n;\n'),ctx);
const run=s=>vm.runInContext(s,ctx),g=run;
const V3=g('V3'),parseOBJ=g('parseOBJ'),meshBox=g('meshBox'),simplify=g('simplify'),weld=g('weld'),dissolve=g('dissolve'),compact=g('compact'),polyBase=g('polyBase');
const C=require('./plates/clean.js')(g),{checkFigure,broken,surfDist,TH}=require('./check.js')(run),{render}=require('./plates/rend.js'),{hcat}=require('./plates/png.js');

/* ---------- эталон ---------- */
function loadRef(){const M=parseOBJ(fs.readFileSync(SRC,'utf8')),B=meshBox(M.V),k=H/B.size[1],cx=(B.min[0]+B.max[0])/2;
  // Meshy: Y вверх, морда на +Z (проверено: самая передняя точка — у носа, ниже середины; уши — max Y)
  let V=M.V.map(p=>[(p[0]-cx)*k,(p[1]-B.min[1])*k,(p[2]-B.min[2])*k]);if(SIDE==='-x')V=V.map(p=>[-p[0],p[1],p[2]]);
  // зеркало меняет обход граней — разворачиваем, чтобы смотрели наружу
  return {V,F:SIDE==='-x'?M.F.map(f=>[f[0],f[2],f[1]]):M.F.map(f=>f.slice())};}
// половина x ≥ 0: треугольники режем плоскостью x = 0, точки ближе 1e-6 — на плоскость
function half(M){const T=[],E=1e-6;M.F.forEach(f=>{let P=f.map(i=>M.V[i].slice());const out=[];
    P.forEach((a,k)=>{const b=P[(k+1)%3],ia=a[0]>=-E,ib=b[0]>=-E;if(ia)out.push(a);if(ia!==ib&&Math.abs(a[0]-b[0])>E){const t=a[0]/(a[0]-b[0]);out.push([0,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}});
    if(out.length<3)return;out.forEach(p=>{if(Math.abs(p[0])<=E)p[0]=0;});for(let k=1;k+1<out.length;k++)T.push([out[0],out[k],out[k+1]]);});
  return weld(T,1e-4);}
// зеркало половины: точки на x = 0 — общие. Треугольник целиком на x = 0 (упрощатель положил грань на шов) совпал бы со своим отражением — убираем оба
function mirror(M){const V=M.V.map(p=>p.slice()),idx=M.V.map((p,i)=>{if(Math.abs(p[0])<1e-9)return i;V.push([-p[0],p[1],p[2]]);return V.length-1;}),F=M.F.filter(f=>!f.every(i=>Math.abs(M.V[i][0])<1e-9));
  return {V,F:F.concat(F.map(f=>[idx[f[0]],idx[f[2]],idx[f[1]]])),seamFlat:M.F.length-F.length};}
// открытые точки половины (шов по x = 0) — на плоскость
function snapSeam(M){const c=new Map();M.F.forEach(f=>{for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=a<b?a+'_'+b:b+'_'+a;c.set(key,(c.get(key)||0)+1);}});
  const V=M.V.map(p=>p.slice());c.forEach((n,key)=>{if(n===1)key.split('_').forEach(i=>{V[+i][0]=0;});});return {V,F:M.F};}

/* ---------- вариант N: упрощение половины → зеркало → многоугольники ---------- */
// упрощение опускает кончики ушей — масштаб снова на высоту 800 мм (равномерно: плоское остаётся плоским, симметрия та же), низ y = 0, зад z = 0
function simplified(Hf,N){const m=snapSeam(simplify(Hf,Math.round(N/2))),S=mirror(m),D=dissolve(S,.5,.3),B=meshBox(D.V),k=H/B.size[1];
  return {V:D.V.map(p=>[p[0]*k,(p[1]-B.min[1])*k,(p[2]-B.min[2])*k]),P:D.P,S:[],tris:S.F.length,seamFlat:S.seamFlat};}
const copyE=E=>({V:E.V.map(p=>p.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())});

/* ---------- чистка ---------- */
// правка принята, если не появилось нового нарушения из «жёстких» (самопересечение, протыкание, уход от ref, открытые рёбра, развёрнутые, вырожденные, симметрия)
const HARD=['selfX','pierce','far','open','flipped','degenerate','sym'];
const worse=(A,B)=>HARD.find(k=>B[k].length>A[k].length);
const mirrorMap=g('mirrorMap'),polyNorm=g('polyNorm'),orientPolys=g('orientPolys');
// слить точки b → a (и зеркальные); грань, где обе точки не соседние, сначала режем по a–b. Выравнивание как в C.collapseShort
function mergePts(E,a,b){const mm=mirrorMap(E.V),T=copyE(E);let pairs=[[b,a]],p=V3.mul(V3.add(E.V[a],E.V[b]),.5);
  if(mm[a]===b){p[0]=0;}else if(mm[a]===-2&&mm[b]===-2){p[0]=0;}else if(mm[a]===-2&&mm[b]>=0){p[0]=0;pairs.push([mm[b],a]);}else if(mm[b]===-2&&mm[a]>=0){p[0]=0;pairs=[[a,b],[mm[a],b]];}
  else if(mm[a]>=0&&mm[b]>=0)pairs.push([mm[b],mm[a]]);
  const keep=pairs[0][1];T.V[keep]=p;if(pairs[1]&&pairs[1][1]!==keep)T.V[pairs[1][1]]=[-p[0],p[1],p[2]];
  pairs.forEach(([x,y])=>{const out=[];T.P.forEach(Q=>{const i=Q.indexOf(x),j=Q.indexOf(y),n=Q.length;if(i>=0&&j>=0&&(i+1)%n!==j&&(j+1)%n!==i){const A=[],B=[];for(let k=i;;k=(k+1)%n){A.push(Q[k]);if(k===j)break;}for(let k=j;;k=(k+1)%n){B.push(Q[k]);if(k===i)break;}out.push(A,B);}else out.push(Q);});
    T.P=out.map(Q=>Q.map(i=>i===x?y:i).filter((v,k,A)=>v!==A[(k+1)%A.length])).filter(Q=>Q.length>=3);});
  if(T.P.some(Q=>new Set(Q).size!==Q.length))return {why:'грань перехлестнулась'};
  const own=new Set(pairs.flat()),R=C.solve(T,new Map(),{it:600,sym:true,anchor:T.V.map((v,i)=>own.has(i)?v:E.V[i])});return {E:compact(R)};}
function cleanFig(E0,ref,log){let E=copyE(E0),R=checkFigure(E,{sym:true,ref});const tried=new Set();
  const take=(what,res)=>{if(!res||res.why){log.push(what+' — нет: '+(res?res.why:'не вышло'));return false;}const R2=checkFigure(res.E,{sym:true,ref}),w=worse(R,R2);
    if(w){log.push(what+' — откат: '+w);return false;}E=res.E;R=R2;log.push(what+' — да');return true;};
  // 2. короткие рёбра < 5 мм
  {const r=C.collapseShort(E,{maxLen:TH.short,sym:true,minW:TH.narrow});const R2=checkFigure(r.E,{sym:true,ref}),done=r.log.filter(x=>x.done).length;
    if(done){const w=worse(R,R2);if(w)log.push('короткие рёбра ('+done+') — откат: '+w);else{E=r.E;R=R2;log.push('короткие рёбра — слито '+done);}}
    r.log.filter(x=>!x.done).forEach(x=>log.push('короткое ребро '+x.L.toFixed(1)+' мм у '+x.at+' — нет: '+x.why));}
  for(let guard=0;guard<60;guard++){let did=false;
    // 3. ступеньки < 8 мм: слить точки
    for(const [a,b] of R.step){const k='s'+E.V[a].map(Math.round)+'|'+E.V[b].map(Math.round);if(tried.has(k))continue;tried.add(k);
      if(take('ступенька '+V3.len(V3.sub(E.V[a],E.V[b])).toFixed(1)+' мм у '+E.V[a].map(Math.round),mergePts(E,a,b))){did=true;break;}}
    if(did)continue;
    // 4. иглы < 5°: стянуть короткую сторону угла
    for(const pi of R.needle){const Q=E.P[pi],n=Q.length;let best=null;Q.forEach((b,k)=>{const a=Q[(k+n-1)%n],c=Q[(k+1)%n],u=V3.sub(E.V[a],E.V[b]),w=V3.sub(E.V[c],E.V[b]),ang=Math.acos(Math.max(-1,Math.min(1,V3.dot(u,w)/V3.len(u)/V3.len(w))))*180/Math.PI;
        if(ang<TH.needle&&(!best||ang<best.ang))best={ang,b,o:V3.len(u)<V3.len(w)?a:c};});if(!best)continue;
      const k='n'+E.V[best.b].map(Math.round)+'|'+E.V[best.o].map(Math.round);if(tried.has(k))continue;tried.add(k);
      if(take('игла '+best.ang.toFixed(1)+'° у '+E.V[best.b].map(Math.round),mergePts(E,best.o,best.b))){did=true;break;}}
    if(did)continue;
    // 6. узкие < 15 мм: слить грань с соседней (другой деталью) через самый плоский шов
    for(const pi of R.narrow){const Q=E.P[pi],n1=polyNorm(E.V,Q),nb=[];E.P.forEach((O,pj)=>{if(pj===pi)return;const s=new Set(O);if(!Q.some((x,k)=>s.has(x)&&s.has(Q[(k+1)%Q.length])&&O.some((y,m)=>y===Q[(k+1)%Q.length]&&O[(m+1)%O.length]===x)))return;
        nb.push({pj,d:Math.acos(Math.max(-1,Math.min(1,V3.dot(n1,polyNorm(E.V,O)))))*180/Math.PI});});nb.sort((x,y)=>x.d-y.d);
      for(const {pj,d} of nb){const k='w'+[pi,pj].map(i=>E.P[i].map(v=>E.V[v].map(Math.round)).sort().join(';')).sort().join('#');if(tried.has(k))continue;tried.add(k);
        const c=polyC(E.V,Q).map(Math.round),r=C.mergeSeam(E,pi,pj,{sym:true});if(take('узкая грань у '+c+' + соседняя (излом '+d.toFixed(1)+'°)',r)){did=true;break;}}
      if(did)break;}
    if(!did)break;}
  // 13. грани наружу
  if(R.flipped.length){const c=polyC(E.V,E.V.map((_,i)=>i));const P=orientPolys(E.V,E.P,c);take('грани наружу ('+R.flipped.length+')',{E:{V:E.V,P,S:E.S}});}
  // 1. плоскость ≤ 0,1 мм: выравнивание с минимальной правкой
  for(const it of [1500,4000]){if(!R.planar.length)break;take('выравнивание в плоскость ('+R.planar.length+' граней, '+it+' шагов)',{E:compact(C.solve(E,new Map(),{sym:true,it,lmin:1e-7}))});}
  return {E,R};}
const polyC=g('polyC');

/* ---------- запись фигуры ---------- */
// мм×10 с точностью 0,01 мм; округление по модулю — зеркальные точки остаются точно зеркальными
const rnd=v=>{const r=Math.sign(v)*Math.round(Math.abs(v)*100)/10;return Object.is(r,-0)?0:r;};
function fileText(N,E){const V=[],P=[];E.V.forEach(p=>V.push(...p.map(rnd)));E.P.forEach(Q=>P.push(...Q,-1));
  return `/* Конь (${N}) — собрано tools/make-horse.js (тикет #133) из модели Meshy horse150.obj: половина ${SIDE} отражена, упрощение до ${N} граней, чистка по правилам спеки 2026-11-20-horse-page-design.
   Руками не править — пересобрать скриптом. V — мм×10, P — углы граней, -1 — конец грани */
MODELS_POLY.horse${N}={V:[${V.join(',')}],P:[${P.join(',')}]};
FIGURES.horse${N}={name:'Конь (${N})',H:800,poly:true,build:()=>modelPoly('horse${N}')};
`;}
/* ---------- цифры, как на сайте: тот же расчёт, что compute0 + prodCalc в ui.js, настройки по умолчанию (2 мм, сталь, лазер, шов 0,5, «Гнуть», прорези) ---------- */
const SITE=`(id,ex)=>{ST={t:2,mat:'steel',gap:0.5,useT:true,minW:15,bend:true,tpl:false,engrave:true,perf:true,cut:'laser',slotW:2,slotL:40,slotBr:3,slotEb:3,slotEl:5,slotNotch:true,slotD:3};
  // как страница: setBase → dimsFromH(800) (Ш и Г округлены до мм) → setPolyDims
  const b0=figureMesh(id,12),z=meshBox(b0.V).size,b=polyBase(fitMesh({V:b0.V,F:[]},{H:800,W:Math.round(z[0]*800/z[1]),D:Math.round(z[2]*800/z[1])}).V,b0.P,b0.S),M3={V:b.V,F:b.F,T:b.T,S:b.S},R=buildParts(M3,1.5,1.5),wl=addBacking(R,M3);pairNumbers(R,M3.V);const T=totals(R,{t:2,mat:'steel',sheet:[2500,1250]});T.weld+=wl;
  let P,BL;const ban=new Set();for(let k=0;k<4;k++){P=bendPlan(R,M3.V,{sheet:[1250,2500],ban});const B=P.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,R,M3.V,P,{t:2,gap:0.5,useT:true})));BL=B.filter(b=>!b.bad);if(BL.length===B.length)break;B.filter(b=>b.bad).forEach(b=>b.bends.forEach(i=>ban.add(i)));}
  blankNumbers(BL,R);blankTwins(BL,R,P.J);const BJ=BL.flatMap(b=>b.bends.map(i=>P.J[i])),bendLen=BJ.reduce((a,j)=>a+j.len,0),inB=new Set(BL.flatMap(b=>b.parts)),bent=new Set(BJ.map(j=>[j.p,j.q].sort((x,y)=>x-y).join('_')));
  const extra=[],seen=new Set();R.edges.forEach(e=>{if(e.open||e.p.length!==2||Math.abs(180-e.dih)>=ex)return;const k=[...e.p].sort((x,y)=>x-y).join('_');if(seen.has(k))return;seen.add(k);
    extra.push({a:R.parts[e.p[0]].no,b:R.parts[e.p[1]].no,fold:Math.abs(180-e.dih),bent:bent.has(k)});});
  return {parts:R.parts.length,pieces:R.parts.filter(p=>!inB.has(p.id)).length+BL.length,blanks:BL.length,mass:T.mass,weld:T.weld-bendLen,bendLen,bends:BJ.length,minW:T.minW,
    extra:extra.sort((x,y)=>x.fold-y.fold),miss:[...new Set(BL.flatMap(B=>blankSlots(B).miss.map(t=>{const l=B.lines.find(l=>'Г'+B.no+' '+bendTxt(l)===t),o=slotOpt();return t+(l&&l.segs.some(q=>Math.hypot(q[2]-q[0],q[3]-q[1])<o.br+2*o.w)?'':' (не обрывок — разобрать)');})))],V:b0.V,F:b0.F,part:[...R.partOf]};}`;
/* ---------- отчёт ---------- */
function report(rows){const f=(v,d=1)=>v.toFixed(d).replace('.',','),L=[],row=(t,fn)=>L.push('| '+t+' | '+rows.map(fn).join(' | ')+' |');
  L.push('# Кони 50 / 100 / 150 — отчёт сборки','','Собрано `node horse-r4t9p/tools/make-horse.js` (тикет #133) из `from-dev/art/tools/plates/src/horse/horse150.obj` (Meshy, 208 треугольников, замкнутая). Файл пересоздаётся при каждом запуске.','');
  L.push('## Половина','',`Взята половина **${SIDE==='+x'?'+x':'−x'}** и отражена. Выбор по анфасу обеих половин, каждая отражена (сравнение до сборки): у +x уши прямые и острые, морда из крупных ровных граней; у −x уши круглые, морда раздроблена мелкими треугольниками. Высота 800 мм, Y вверх, морда на +Z, x = 0 — плоскость симметрии.`,'');
  L.push('## Цифры','','Как на сайте по умолчанию: сталь 2 мм, лазер, шов 0,5 мм, «Гнуть» и прорези включены. «Швы» — сварка без стыков, которые гнутся; «Проварка сгибов» — отдельно.','');
  L.push('| | '+rows.map(r=>`Конь (${r.N})`).join(' | ')+' |','|---|'+rows.map(()=>'---|').join(''));
  row('Треугольников после упрощения',r=>r.tris+(r.seamFlat?` (${r.seamFlat*2} легли на шов — убраны)`:''));
  row('Граней до → после чистки',r=>`${r.polys0} → ${r.polys1}`);
  row('Деталей до → после чистки',r=>`${r.parts0} → ${r.parts1} (−${f(r.lost*100)} %)`+(r.lost>.2?' 🔴 **потеря больше 20 %**':''));
  row('Деталей → позиций на резку',r=>`${r.site.parts} → ${r.site.pieces} (заготовок со сгибами ${r.site.blanks})`);
  row('Масса, сталь 2 мм',r=>`${f(r.site.mass)} кг`);
  row('Швы (сварка)',r=>`${f(r.site.weld/1000)} м`);
  const pl=(n,a,b,c)=>n%10===1&&n%100!==11?a:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?b:c;
  row('Проварка сгибов',r=>`${f(r.site.bendLen/1000)} м (${r.site.bends} ${pl(r.site.bends,'сгиб','сгиба','сгибов')})`);
  row('Самая узкая деталь',r=>`${Math.round(r.site.minW)} мм`);
  row('Габарит Ш × В × Г',r=>r.box.map(Math.round).join(' × ')+' мм');
  row('Неплоскость граней, макс.',r=>f(r.maxDev,3)+' мм');
  row('Нарушенные правила',r=>r.broken.length?r.broken.join(', '):'нет');
  row('Лишних швов (излом < 5°)',r=>String(r.site.extra.length));
  row('Сгиб без прорезей (предупреждение в «Итого», расчёт скрипта; страница может назвать ещё линию — см. комментарий #134)',r=>r.site.miss.length?r.site.miss.join(', ')+' — у линии есть обрывок короче 7 мм (перемычка + две ширины прорези) там, где она проходит через вырез заготовки; так по правилу 2 тикета #140':'нет');
  L.push('','Проверка — по записанному `js/plates-horse*.js` (после округления до 0,01 мм). Правила и пороги — `tools/check.js`: плоскость ≤ 0,1 мм, рёбра ≥ 5 мм, ступеньки ≥ 8 мм, углы ≥ 5°, узкие ≥ 15 мм, самопересечений и протыканий 0, симметрия ≤ 0,1 мм, грани наружу, вырожденных 0, похожесть ≤ 2 мм от упрощённой модели до чистки, открытых рёбер 0.','');
  rows.forEach(r=>{L.push(`## Конь (${r.N})`,'');
    L.push(`- Морда: самая передняя точка (${r.front.map(Math.round).join(', ')}), на высоте ${Math.round(r.front[1])} из 800. Самая высокая точка (кончик уха или темя): (${r.top.map(Math.round).join(', ')}).`);
    L.push('- Нарушенные правила: '+(r.broken.length?r.broken.map(k=>`**${k}** — ${JSON.stringify(r.R2[k])}`).join('; '):'нет.'));
    L.push('- Чистка:'+(r.log.length?'':' правок не понадобилось.'));r.log.forEach(x=>L.push('  - '+x));
    L.push(`- Лишние швы (излом < 5°; не сливаем, отдельной задачей): ${r.site.extra.length?r.site.extra.map(x=>`№${x.a}–№${x.b} (${f(x.fold)}°${x.bent?', гнётся':''})`).join(', '):'нет'}.`);
    L.push('',`![спереди](img/horse${r.N}_front.png) ![сбоку](img/horse${r.N}_side.png) ![три четверти](img/horse${r.N}_iso.png)`,'');});
  return L.join('\n')+'\n';}
/* ---------- запуск ---------- */
module.exports={loadRef,half,mirror,snapSeam,simplified,cleanFig,mergePts,fileText};
if(require.main===module&&!PREVIEW){const R0=loadRef(),Hf=half(R0),IMG=path.join(__dirname,'img'),rows=[],site=run(SITE),polyDev=g('polyDev');fs.mkdirSync(IMG,{recursive:true});
  NS.forEach(N=>{const id='horse'+N,E=simplified(Hf,N),R1=checkFigure(E,{sym:true,ref:E}),log=[],K=cleanFig(E,E,log),txt=fileText(N,K.E);fs.writeFileSync(path.join(JS,`plates-${id}.js`),txt);
    // проверка — по записанному файлу (после округления), как его прочтёт страница
    run(txt);const m=run(`modelPoly('${id}')`),EF={V:m.V,P:m.P,S:m.S},R2=checkFigure(EF,{sym:true,ref:E}),S=site(id,TH.extra);
    const front=EF.V.reduce((a,p)=>p[2]>a[2]?p:a),top=EF.V.reduce((a,p)=>p[1]>a[1]?p:a),maxDev=Math.max(...EF.P.map(Q=>polyDev(EF.V,Q))),lost=(R1.parts-R2.parts)/R1.parts;
    ['front','side','iso'].forEach(v=>render(path.join(IMG,`${id}_${v}.png`),S.V,S.F,()=>[196,200,208],v,{S:600,shade:true,group:fi=>S.part[fi]}));
    rows.push({N,tris:E.tris,seamFlat:E.seamFlat,polys0:E.P.length,polys1:EF.P.length,parts0:R1.parts,parts1:R2.parts,lost,site:S,broken:broken(R2),R2,box:meshBox(EF.V).size,front,top,maxDev,log});
    console.log(`Конь (${N}): треугольников ${E.tris}, граней ${E.P.length} → ${EF.P.length}, деталей ${R1.parts} → ${R2.parts} (−${(lost*100).toFixed(1)} %), позиций ${S.pieces}, масса ${S.mass.toFixed(1)} кг, швы ${(S.weld/1000).toFixed(1)} м, проварка ${(S.bendLen/1000).toFixed(1)} м, нарушено [${broken(R2)}], лишних швов ${S.extra.length}, неплоскость ${maxDev.toFixed(3)} мм`);});
  if(!ONLY)fs.writeFileSync(path.join(__dirname,'report.md'),report(rows));}
