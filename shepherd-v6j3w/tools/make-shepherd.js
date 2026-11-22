// Сборка овчарки из модели Meshy (тикет #141; по образцу horse-r4t9p/tools/make-horse.js, тикет #133). Овчарка 2 — тикет #142.
// node shepherd-v6j3w/tools/make-shepherd.js [id | all] [путь к .obj]
//   id — shepherd (по умолчанию), shepherd2_1000, shepherd2_700, shepherd2_500, shepherd2_350; all — все по очереди.
//   эталон (уже Y вверх, морда на +Z, 1000 мм, симметричный) → низ y = 0, зад z = 0 → почти плоские треугольники в многоугольники (0,5° / 0,3 мм) →
//   это ref (правило 11) → чистка (короткие рёбра, ступеньки, иглы, узкие, грани наружу, выравнивание в плоскость; правка с нарушением — откат) →
//   проверка → js/plates-<id>.js, tools/img/<id>_{front,side,iso}.png, tools/report.md (shepherd) или tools/report-<id>.md.
// Упрощения нет: деталей — сколько дадут склейка и чистка (решение Виталия 21.11).
// Детерминированно: повторный запуск с тем же эталоном даёт те же файлы.
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..'),JS=path.join(__dirname,'..','js'),args=process.argv.slice(2);
// фигуры: src — эталон; nose — «шапочка» на нос (подогнана под эталон shepherd); у Овчарки 2 имя и ленивая загрузка — в js/figures.js
const VARIANTS={shepherd:{src:'from-dev/art/tools/plates/src/shepherd/shepherd_sym1000.obj',nose:true,ticket:141,
    about:'модель Meshy `shepherd544_purple.obj` (Smart Topology, 544 грани), повёрнутая (Y вверх, морда на +Z), высота 1000 мм, правая половина отзеркалена'}};
[1000,700,500,350].forEach(n=>{VARIANTS['shepherd2_'+n]={src:`from-dev/art/tools/plates/src/shepherd2/shepherd2_s${n}.obj`,nose:false,ticket:142,
    about:`реалистичная модель Meshy (Perfectly_Aligned, 2628 треугольников), упрощённая скриптом до ${n} треугольников (QEM на правой половине + зеркало; \`C:\\Work\\StartUp\\проекты\\овчарка-2\\tools\\simplify.py\`), высота 1000 мм, морда на +Z, симметричная`};});
// Овчарка 3 (тикет #142, план docs/superpowers/plans/2026-11-23-shepherd3-figure.md): вход — не треугольники, а готовые плиты конвейера (plates.js, кадр 600 мм) → ×1000/600, низ y = 0, зад z = 0;
// склейки почти плоских нет (плиты уже плоские), дальше — та же чистка и проверка. Пишет ещё xf — перевод кадра 600 мм в кадр фигуры для кальки (tracing.js xf=)
VARIANTS.shepherd3={src:'from-dev/art/tools/plates/out/plates.json',plates:true,nose:false,ticket:142,xf:'from-dev/art/tools/plates/out/shepherd3/xf.json',
  about:'плиты конвейера `plates.js round=1 seed=2e-4 mina=1.5e-4 pen=1 ang=35 mm=25` по модели Meshy `Meshy_AI_shepherd_saber_tail_perfect_gap_3d_20261122` (316 тыс. треугольников) и текстуре швов `tex-h3.png` (5 видов тела и густой профиль головы, `project.js`), высота 1000 мм, морда на +Z, симметричная'};
// Овчарка 5 (тикет #142): так же из плит конвейера, но модель Meshy 7.1 уже гранёная — допуск излома 8°, швы — с исходной текстуры модели (без project.js)
VARIANTS.shepherd5={src:'from-dev/art/tools/plates/out/plates_s5b.json',plates:true,snap:3,nose:false,ticket:142,xf:'from-dev/art/tools/plates/out/shepherd5/xf.json',
  head:'Швы головы — с исходной текстуры модели Meshy (`src/shepherd5/model/*.png`).',
  about:'плиты конвейера `plates.js round=1 seed=2e-4 mina=1.5e-4 pen=1 ang=8 mm=6` по модели Meshy 7.1 `Meshy_AI_welded_adult_shepherd_final_20261122` (158 тыс. треугольников, гранёная, швы на текстуре), высота 1000 мм, морда на +Z, симметричная'};
VARIANTS.shepherd3.head='Швы головы — с густого профиля головы (`head-profile-dense-v3.png`, текстура `tex-h3.png`).';
const ARG_ID=require.main===module&&args.find(a=>VARIANTS[a]||a==='all'),ARG_SRC=require.main===module&&args.find(a=>/\.obj$/i.test(a));
let ID=ARG_ID&&ARG_ID!=='all'?ARG_ID:'shepherd',SRC=ARG_SRC||path.join(ROOT,VARIANTS[ID].src);
const H=1000;
// движок — в vm, как в smoke.js
const ctx={console,Math,TextDecoder};vm.createContext(ctx);
const FILES=['mesh','edit','models-poly','figures','prod','slots','sheets','bend','bend3d','angles-core'];
vm.runInContext(FILES.map(f=>fs.readFileSync(path.join(JS,f+'.js'),'utf8')).join('\n;\n'),ctx);
const run=s=>vm.runInContext(s,ctx),g=run;
const V3=g('V3'),parseOBJ=g('parseOBJ'),meshBox=g('meshBox'),dissolve=g('dissolve'),compact=g('compact'),polyC=g('polyC');
const C=require('./plates/clean.js')(g),{checkFigure,broken,TH}=require('./check.js')(run),{render}=require('./plates/rend.js');

/* ---------- эталон ---------- */
// эталон уже повёрнут, симметричен (x = 0 — плоскость симметрии) и высотой 1000 мм; приводим к сайту: низ y = 0, зад z = 0, масштаб — на H (страховка)
function loadTris(){const M=parseOBJ(fs.readFileSync(SRC,'utf8')),B=meshBox(M.V),k=H/B.size[1],cx=(B.min[0]+B.max[0])/2;
  return {V:M.V.map(p=>[(p[0]-cx)*k,(p[1]-B.min[1])*k,(p[2]-B.min[2])*k]),F:M.F.map(f=>f.slice())};}
// плиты конвейера (Овчарка 3): лишние точки выкинуть, грани наружу (как export.js), затем тот же перевод, что у loadTris; B6 — габарит в кадре 600 мм (для xf)
// snap (Овчарка 5): у plates.js после выравнивания пара зеркальных точек может разойтись (до 1,6 мм в кадре 600) — ставим пару ровно зеркально в среднее положение, плоскость потом вернёт чистка
function snapMirror(V,lim){let n=0;V.forEach((p,i)=>{if(p[0]<=1e-6)return;let bd=1e9,bj=-1;V.forEach((r,j)=>{const d=Math.hypot(r[0]+p[0],r[1]-p[1],r[2]-p[2]);if(d<bd){bd=d;bj=j;}});
  if(bd>1e-6&&bd<=lim&&V[bj][0]<0){const m=[(p[0]-V[bj][0])/2,(p[1]+V[bj][1])/2,(p[2]+V[bj][2])/2];V[i]=m;V[bj]=[-m[0],m[1],m[2]];n++;}});return n;}
function loadPlates(){const J=JSON.parse(fs.readFileSync(SRC,'utf8'));if(VARIANTS[ID].snap)console.log('зеркальных пар подтянуто:',snapMirror(J.V,VARIANTS[ID].snap));const E=compact({V:J.V,P:J.P}),B=meshBox(E.V),c=B.min.map((x,k)=>(x+B.max[k])/2),P=orientPolys(E.V,E.P,c),k=H/B.size[1],cx=Math.abs(c[0])<1e-6?0:c[0];
  return {V:E.V.map(p=>[(p[0]-cx)*k,(p[1]-B.min[1])*k,(p[2]-B.min[2])*k]),P,S:[],tris:J.P.length,nose:[],B6:B};}
function loadRef(o){if(VARIANTS[ID].plates)return loadPlates();const T=loadTris(),N=(o&&o.nose===false)||!VARIANTS[ID].nose?{V:T.V,F:T.F,log:[]}:noseRound(T),D=dissolve({V:N.V,F:N.F},.5,.3);
  return {V:D.V,P:D.P,S:[],tris:T.F.length,nose:N.log};}

/* ---------- нос: «шапочка» вместо квадрата (просьба Виталия 21.11 по фото готовой овчарки) ----------
   Лобовая грань носа в эталоне — квадрат ~44 × 48 мм из 6 треугольников (кольцо из 6 точек, шов по x = 0). Делаем как у сварной овчарки на фото:
   кольцо шире (верх — NOSE.sx, низ — NOSE.sxb по x; вверх — NOSE.sy от центра носа, низ на месте), внутри — пластина поменьше (NOSE.k от кольца; при .55 боковые скосы уже 15 мм, при .45 — пластина), выдвинутая вперёд на NOSE.d мм по нормали носа;
   между кольцом и пластиной — скосы по кругу (верх, бока, низ). Спереди и сбоку нос читается закруглённым. Соседние грани морды тянутся за кольцом. */
const NOSE={sx:1.4,sxb:1.15,sy:1.15,k:.5,d:8};   // sx — верх кольца, sxb — низ (низ рядом с нёбом открытой пасти: шире — протыкает), sy — только вверх
function noseRound(M,o){o=Object.assign({},NOSE,o);const V=M.V.map(p=>p.slice()),log=[];
  // кончик носа — самая передняя точка; лобовые треугольники — те, что ближе 70 мм к кончику и смотрят вперёд-вниз (не верх переносицы и не бока)
  const tip=V.reduce((a,p,i)=>p[2]>V[a][2]?i:a,0),tn=f=>{const n=V3.cross(V3.sub(V[f[1]],V[f[0]]),V3.sub(V[f[2]],V[f[0]]));return V3.mul(n,1/(V3.len(n)||1));};
  const front=M.F.map((f,fi)=>fi).filter(fi=>{const f=M.F[fi],n=tn(f);return f.every(i=>V3.len(V3.sub(V[i],V[tip]))<70)&&n[2]>.55&&n[1]<.3;});
  // кольцо — рёбра лобовых треугольников, которые встречаются один раз, в порядке обхода (обход наружу, как у самих треугольников)
  const cnt=new Map(),key=(a,b)=>a+'_'+b;front.forEach(fi=>{const f=M.F[fi];for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3];cnt.set(key(a,b),1);}});
  const nxt=new Map();front.forEach(fi=>{const f=M.F[fi];for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3];if(!cnt.has(key(b,a)))nxt.set(a,b);}});
  const ring=[tip];while(ring.length<=nxt.size){const b=nxt.get(ring[ring.length-1]);if(b===undefined||b===tip)break;ring.push(b);}
  if(ring.length!==6||nxt.size!==6)throw new Error(`нос: ждали кольцо из 6 точек и 6 лобовых треугольников, нашли кольцо ${ring.length}, треугольников ${front.length} — эталон другой, поправить noseRound`);
  // нормаль носа — средняя по лобовым треугольникам (с площадью); центр — среднее кольца (x = 0 по симметрии)
  let n=[0,0,0];front.forEach(fi=>{const f=M.F[fi];n=V3.add(n,V3.cross(V3.sub(V[f[1]],V[f[0]]),V3.sub(V[f[2]],V[f[0]])));});n=V3.mul(n,1/V3.len(n));
  const c=V3.mul(ring.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/ring.length);c[0]=0;
  const w0=Math.max(...ring.map(i=>Math.abs(V[i][0])))*2;
  ring.forEach(i=>{const p=V[i],up=p[1]>c[1];V[i]=[p[0]*(up?o.sx:o.sxb),up?c[1]+(p[1]-c[1])*o.sy:p[1],p[2]];});
  const inner=ring.map(i=>{const p=V[i],q=V3.add(V3.add(c,V3.mul(V3.sub(p,c),o.k)),V3.mul(n,o.d));if(Math.abs(p[0])<1e-9)q[0]=0;V.push(q);return V.length-1;});
  const drop=new Set(front),F=M.F.filter((f,fi)=>!drop.has(fi));
  ring.forEach((a,k)=>{const b=ring[(k+1)%6],ia=inner[k],ib=inner[(k+1)%6];F.push([a,b,ib],[a,ib,ia]);});            // скосы по кругу
  for(let k=1;k+1<6;k++)F.push([inner[0],inner[k],inner[k+1]]);                                                        // пластина
  const w1=Math.max(...ring.map(i=>Math.abs(V[i][0])))*2;
  log.push(`нос: кольцо ${Math.round(w0)} → ${Math.round(w1)} мм шириной, пластина ×${o.k} выдвинута на ${o.d} мм, скосы по кругу (6 лобовых треугольников → 6 скосов + пластина)`);
  // точки, которые больше никому не нужны (внутренняя точка старой лобовой грани), — убираем
  const used=new Set(F.flat()),map=new Map(),V2=[];V.forEach((p,i)=>{if(used.has(i)){map.set(i,V2.length);V2.push(p);}});
  return {V:V2,F:F.map(f=>f.map(i=>map.get(i))),log};}
const copyE=E=>({V:E.V.map(p=>p.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())});

/* ---------- чистка (как у коня; короткие рёбра — ещё и по одному, если пачка откатилась) ---------- */
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
const mm1=v=>v.map(Math.round);
function cleanFig(E0,ref,log){let E=copyE(E0),R=checkFigure(E,{sym:true,ref});const tried=new Set();
  const take=(what,res)=>{if(!res||res.why){log.push(what+' — нет: '+(res?res.why:'не вышло'));return false;}const R2=checkFigure(res.E,{sym:true,ref}),w=worse(R,R2);
    if(w){log.push(what+' — откат: '+w);return false;}E=res.E;R=R2;log.push(what+' — да');return true;};
  // 2. короткие рёбра < 5 мм — сначала все разом (как у коня)
  {const r=C.collapseShort(E,{maxLen:TH.short,sym:true,minW:TH.narrow});const R2=checkFigure(r.E,{sym:true,ref}),done=r.log.filter(x=>x.done).length;
    if(done){const w=worse(R,R2);if(w)log.push('короткие рёбра разом ('+done+') — откат: '+w+'; дальше по одному');else{E=r.E;R=R2;log.push('короткие рёбра — слито '+done);}}
    r.log.filter(x=>!x.done).forEach(x=>log.push('короткое ребро '+x.L.toFixed(1)+' мм у '+x.at+' — нет: '+x.why));}
  for(let guard=0;guard<400;guard++){let did=false;
    // 2'. короткие рёбра по одному: слить концы
    for(const [a,b] of R.short){const k='r'+mm1(E.V[a])+'|'+mm1(E.V[b]);if(tried.has(k))continue;tried.add(k);
      if(take('короткое ребро '+V3.len(V3.sub(E.V[a],E.V[b])).toFixed(1)+' мм у '+mm1(E.V[a]),mergePts(E,a,b))){did=true;break;}}
    if(did)continue;
    // 3. ступеньки < 8 мм: слить точки
    for(const [a,b] of R.step){const k='s'+mm1(E.V[a])+'|'+mm1(E.V[b]);if(tried.has(k))continue;tried.add(k);
      if(take('ступенька '+V3.len(V3.sub(E.V[a],E.V[b])).toFixed(1)+' мм у '+mm1(E.V[a]),mergePts(E,a,b))){did=true;break;}}
    if(did)continue;
    // 4. иглы < 5°: стянуть короткую сторону угла
    for(const pi of R.needle){const Q=E.P[pi],n=Q.length;let best=null;Q.forEach((b,k)=>{const a=Q[(k+n-1)%n],c=Q[(k+1)%n],u=V3.sub(E.V[a],E.V[b]),w=V3.sub(E.V[c],E.V[b]),ang=Math.acos(Math.max(-1,Math.min(1,V3.dot(u,w)/V3.len(u)/V3.len(w))))*180/Math.PI;
        if(ang<TH.needle&&(!best||ang<best.ang))best={ang,b,o:V3.len(u)<V3.len(w)?a:c};});if(!best)continue;
      const k='n'+mm1(E.V[best.b])+'|'+mm1(E.V[best.o]);if(tried.has(k))continue;tried.add(k);
      if(take('игла '+best.ang.toFixed(1)+'° у '+mm1(E.V[best.b]),mergePts(E,best.o,best.b))){did=true;break;}}
    if(did)continue;
    // 6. узкие < 15 мм: слить грань с соседней (другой деталью) через самый плоский шов
    for(const pi of R.narrow){const Q=E.P[pi],n1=polyNorm(E.V,Q),nb=[];E.P.forEach((O,pj)=>{if(pj===pi)return;const s=new Set(O);if(!Q.some((x,k)=>s.has(x)&&s.has(Q[(k+1)%Q.length])&&O.some((y,m)=>y===Q[(k+1)%Q.length]&&O[(m+1)%O.length]===x)))return;
        nb.push({pj,d:Math.acos(Math.max(-1,Math.min(1,V3.dot(n1,polyNorm(E.V,O)))))*180/Math.PI});});nb.sort((x,y)=>x.d-y.d);
      for(const {pj,d} of nb){const k='w'+[pi,pj].map(i=>E.P[i].map(v=>E.V[v].map(Math.round)).sort().join(';')).sort().join('#');if(tried.has(k))continue;tried.add(k);
        const c=mm1(polyC(E.V,Q)),r=C.mergeSeam(E,pi,pj,{sym:true});if(take('узкая грань у '+c+' + соседняя (излом '+d.toFixed(1)+'°)',r)){did=true;break;}}
      if(did)break;}
    if(!did)break;}
  // 13. грани наружу
  if(R.flipped.length){const c=polyC(E.V,E.V.map((_,i)=>i));const P=orientPolys(E.V,E.P,c);take('грани наружу ('+R.flipped.length+')',{E:{V:E.V,P,S:E.S}});}
  // 1. плоскость ≤ 0,1 мм: выравнивание с минимальной правкой
  for(const it of [1500,4000]){if(!R.planar.length)break;take('выравнивание в плоскость ('+R.planar.length+' граней, '+it+' шагов)',{E:compact(C.solve(E,new Map(),{sym:true,it,lmin:1e-7}))});}
  // чистка может сдвинуть кончик уха на десятые мм — снова ровно H, низ y = 0 — растяжение только по высоте (аффинное: плоское остаётся плоским, симметрия та же; по x и z точки на месте)
  // уход от эталона тут не проверяем: точка у порога 2 мм от сдвига на сотые доли процента переходит его, а форма не меняется; прочие жёсткие правила — как везде
  {const B=meshBox(E.V),k=H/B.size[1];if(Math.abs(k-1)>1e-9){const E2={V:E.V.map(p=>[p[0],(p[1]-B.min[1])*k,p[2]]),P:E.P,S:E.S},R2=checkFigure(E2,{sym:true,ref}),w=HARD.filter(x=>x!=='far').find(x=>R2[x].length>R[x].length);
    const what='масштаб на высоту '+H+' мм (×'+k.toFixed(5)+', только по высоте, сдвиг до '+(B.max[1]*Math.abs(1-k)).toFixed(2)+' мм)';if(w)log.push(what+' — откат: '+w);else{E=E2;R=R2;log.push(what+' — да');}}}
  return {E,R};}

/* ---------- запись фигуры ---------- */
// мм×10 с точностью 0,01 мм; округление по модулю — зеркальные точки остаются точно зеркальными
const rnd=v=>{const r=Math.sign(v)*Math.round(Math.abs(v)*100)/10;return Object.is(r,-0)?0:r;};
function fileText(E){const V=[],P=[];E.V.forEach(p=>V.push(...p.map(rnd)));E.P.forEach(Q=>P.push(...Q,-1));
  if(VARIANTS[ID].plates)return `/* ${run(`FIGURES.${ID}?FIGURES.${ID}.name:''`)||ID} — собрано tools/make-shepherd.js ${ID} (тикет #142) из ${VARIANTS[ID].about.replace(/`/g,'')}; чистка по правилам спеки 2026-11-20-horse-page-design.
   Руками не править — пересобрать скриптом. V — мм×10, P — углы граней, -1 — конец грани. Имя, ленивая загрузка и калька (js/trace-${ID}.js) — FIGURES.${ID} в js/figures.js */
MODELS_POLY.${ID}={V:[${V.join(',')}],P:[${P.join(',')}]};
`;
  if(ID!=='shepherd')return `/* Овчарка 2 — собрано tools/make-shepherd.js ${ID} (тикет #142) из ${path.basename(SRC)} (${VARIANTS[ID].about.replace(/`/g,'')}), чистка по правилам спеки 2026-11-20-horse-page-design.
   Руками не править — пересобрать скриптом. V — мм×10, P — углы граней, -1 — конец грани. Имя и ленивая загрузка — FIGURES.${ID} в js/figures.js */
MODELS_POLY.${ID}={V:[${V.join(',')}],P:[${P.join(',')}]};
`;
  return `/* Овчарка — собрано tools/make-shepherd.js (тикет #141) из модели Meshy shepherd544_purple.obj (симметричная, 1000 мм: shepherd_sym1000.obj), чистка по правилам спеки 2026-11-20-horse-page-design.
   Руками не править — пересобрать скриптом. V — мм×10, P — углы граней, -1 — конец грани */
MODELS_POLY.${ID}={V:[${V.join(',')}],P:[${P.join(',')}]};
FIGURES.${ID}={name:'Овчарка',H:${H},poly:true,build:()=>modelPoly('${ID}')};
`;}
/* ---------- цифры, как на сайте: тот же расчёт, что compute0 + prodCalc в ui.js, настройки по умолчанию (2 мм, сталь, лазер, шов 0,5, «Гнуть», прорези) ---------- */
const SITE=`(id,ex)=>{ST={t:2,mat:'steel',gap:0.5,useT:true,minW:15,bend:true,tpl:false,engrave:true,perf:true,cut:'laser',slotW:2,slotL:40,slotBr:3,slotEb:3,slotEl:5,slotNotch:true,slotD:3};
  // как страница: setBase → dimsFromH(${H}) (Ш и Г округлены до мм) → setPolyDims
  const b0=figureMesh(id,12),z=meshBox(b0.V).size,b=polyBase(fitMesh({V:b0.V,F:[]},{H:${H},W:Math.round(z[0]*${H}/z[1]),D:Math.round(z[2]*${H}/z[1])}).V,b0.P,b0.S),M3={V:b.V,F:b.F,T:b.T,S:b.S},R=buildParts(M3,1.5,1.5),wl=addBacking(R,M3);pairNumbers(R,M3.V);const T=totals(R,{t:2,mat:'steel',sheet:[2500,1250]});T.weld+=wl;
  let P,BL;const ban=new Set();for(let k=0;k<4;k++){P=bendPlan(R,M3.V,{sheet:[1250,2500],ban});const B=P.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,R,M3.V,P,{t:2,gap:0.5,useT:true})));BL=B.filter(b=>!b.bad);if(BL.length===B.length)break;B.filter(b=>b.bad).forEach(b=>b.bends.forEach(i=>ban.add(i)));}
  blankNumbers(BL,R);blankTwins(BL,R,P.J);const BJ=BL.flatMap(b=>b.bends.map(i=>P.J[i])),bendLen=BJ.reduce((a,j)=>a+j.len,0),inB=new Set(BL.flatMap(b=>b.parts)),bent=new Set(BJ.map(j=>[j.p,j.q].sort((x,y)=>x-y).join('_')));
  const extra=[],seen=new Set();R.edges.forEach(e=>{if(e.open||e.p.length!==2||Math.abs(180-e.dih)>=ex)return;const k=[...e.p].sort((x,y)=>x-y).join('_');if(seen.has(k))return;seen.add(k);
    extra.push({a:R.parts[e.p[0]].no,b:R.parts[e.p[1]].no,fold:Math.abs(180-e.dih),bent:bent.has(k)});});
  return {parts:R.parts.length,pieces:R.parts.filter(p=>!inB.has(p.id)).length+BL.length,blanks:BL.length,mass:T.mass,weld:T.weld-bendLen,bendLen,bends:BJ.length,minW:T.minW,
    extra:extra.sort((x,y)=>x.fold-y.fold),miss:[...new Set(BL.flatMap(B=>blankSlots(B).miss.map(t=>{const l=B.lines.find(l=>'Г'+B.no+' '+bendTxt(l)===t),o=slotOpt();return t+(l&&l.segs.some(q=>Math.hypot(q[2]-q[0],q[3]-q[1])<o.br+2*o.w)?'':' (не обрывок — разобрать)');})))],V:b0.V,F:b0.F,part:[...R.partOf]};}`;
/* ---------- отчёт ---------- */
const NAMES={planar:'неплоские грани',short:'рёбра короче 5 мм',step:'ступеньки (точки ближе 8 мм без ребра)',needle:'углы меньше 5°',narrow:'узкие грани (деталь уже 15 мм)',selfX:'самопересечения',pierce:'протыкания',sym:'несимметричные точки',flipped:'развёрнутые грани',degenerate:'вырожденные грани',open:'открытые рёбра',far:'уход от эталона больше 2 мм'};
function report(r){const f=(v,d=1)=>v.toFixed(d).replace('.',','),L=[],row=(t,v)=>L.push('| '+t+' | '+v+' |');
  const pl=(n,a,b,c)=>n%10===1&&n%100!==11?a:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?b:c;
  const old=ID==='shepherd',V=VARIANTS[ID],nm=old?'Овчарка':r.name||ID;
  L.push(`# ${nm} — отчёт сборки`,'',`Собрано \`node shepherd-v6j3w/tools/make-shepherd.js${old?'':' '+ID}\` (тикет #${V.ticket}) из \`${V.src}\` — ${V.about}; ${r.tris} ${V.plates?"плит":"треугольников"}, замкнутая, без постамента. Упрощения нет. Файл пересоздаётся при каждом запуске.`,'');
  L.push('## Цифры','','Как на сайте по умолчанию: сталь 2 мм, лазер, шов 0,5 мм, «Гнуть» и прорези включены. «Швы» — сварка без стыков, которые гнутся; «Проварка сгибов» — отдельно.','');
  L.push(`| | ${nm} |`,'|---|---|');
  row(V.plates?'Плит конвейера (вход)':'Треугольников в эталоне',String(r.tris));
  row(V.plates?'Граней на входе → после чистки':'Граней после склейки почти плоских (0,5° / 0,3 мм) → после чистки',`${r.polys0} → ${r.polys1}`);
  row('Деталей до → после чистки',`${r.parts0} → ${r.parts1} (−${f(r.lost*100)} %)`);
  row('Деталей → позиций на резку',`${r.site.parts} → ${r.site.pieces} (заготовок со сгибами ${r.site.blanks})`);
  if(r.head!=null)row('Деталей на голове (центр детали в области картинок головы: глубже 330 мм от кончика морды, выше 560 мм)',String(r.head));
  row('Масса, сталь 2 мм',`${f(r.site.mass)} кг`);
  row('Швы (сварка)',`${f(r.site.weld/1000)} м`);
  row('Проварка сгибов',`${f(r.site.bendLen/1000)} м (${r.site.bends} ${pl(r.site.bends,'сгиб','сгиба','сгибов')})`);
  row('Самая узкая деталь',`${Math.round(r.site.minW)} мм`);
  row('Габарит Ш × В × Г',r.box.map(Math.round).join(' × ')+' мм');
  row('Неплоскость граней, макс.',f(r.maxDev,3)+' мм');
  row('Самопересечения / протыкания',`${r.R2.selfX.length} / ${r.R2.pierce.length}`);
  row('Нарушенные правила после чистки',r.broken.length?r.broken.map(k=>`${NAMES[k]||k}: ${r.R2[k].length}`).join(', '):'нет');
  row('Лишних швов (излом < 5°)',String(r.site.extra.length));
  row('Сгиб без прорезей (предупреждение в «Итого», расчёт скрипта)',r.site.miss.length?r.site.miss.join(', '):'нет');
  L.push('',`Проверка — по записанному \`js/plates-${ID}.js\` (после округления до 0,01 мм). Правила и пороги — \`tools/check.js\`: плоскость ≤ 0,1 мм, рёбра ≥ 5 мм, ступеньки ≥ 8 мм, углы ≥ 5°, узкие ≥ 15 мм, самопересечений и протыканий 0, симметрия ≤ 0,1 мм, грани наружу, вырожденных 0, похожесть ≤ 2 мм от эталона после склейки, открытых рёбер 0.`,'');
  if(old){L.push('## Почему деталей ~500, а не ~400','',`Оценка «~396 деталей» считалась при угле 8° (соседние треугольники с изломом до 8° — одна деталь). Сайт делит на детали при 1,5° (\`buildParts(…, 1.5, 1.5)\`), а склейка берёт только почти плоские грани (0,5° / 0,3 мм), чтобы не искажать форму. Грани с изломом 1,5–8° остаются отдельными деталями; слить их — значит выровнять в плоскость, это отдельная задача.`,'');
  L.push('## Нос','','Квадратный нос эталона (лобовая грань ~44 × 48 мм) переделан «шапочкой», как у сварной овчарки на фото Виталия (21.11): кольцо шире, внутри пластина, выдвинутая вперёд, между ними скосы по кругу. Сбоку кончик носа тупой и закруглённый, спереди нос шире. Параметры — `NOSE` в скрипте; `loadRef({nose:false})` — эталон без правки.','');
  r.nose.forEach(x=>L.push('- '+x));}
  else if(V.plates)L.push('## Голова','',`${V.head} Морду Виталий доводит до ~90 деталей в мастерской по кальке (\`js/trace-${ID}.js\`, кадр — \`xf.json\`), потом \`fromjson.js\`.`);
  else L.push('## Голова','','Нос как в эталоне, без «шапочки» (она подогнана под эталон старой Овчарки).');
  L.push('',`![голова спереди](img/${ID}_head_front.png) ![голова сбоку](img/${ID}_head_side.png) ![голова три четверти](img/${ID}_head_iso.png)`,'');
  L.push('## Форма','');
  L.push(`- Морда: самая передняя точка (${r.front.map(Math.round).join(', ')}), на высоте ${Math.round(r.front[1])} из ${H}. Самая высокая точка (кончик уха): (${r.top.map(Math.round).join(', ')}).`);
  if(old)L.push('- Глаз — щель под надбровьем в сетке эталона, чистка его не трогала (см. картинки). Глаз отдельной деталью — отдельный тикет.');
  L.push('','## Чистка','');
  const ok=r.log.filter(x=>/ — да$| — слито /.test(x));
  L.push(`Принято правок: ${ok.length}, отклонено (откат или нельзя): ${r.log.length-ok.length}. Правка, после которой появилось новое нарушение из жёстких (самопересечение, протыкание, уход от эталона, открытое ребро, развёрнутая или вырожденная грань, несимметрия), откатывается.`,'');
  L.push('Принято:','');ok.forEach(x=>L.push('- '+x));
  L.push('','Осталось после чистки (не убирается без жёсткого нарушения):','');
  r.broken.length?r.broken.forEach(k=>L.push(`- ${NAMES[k]||k}: ${r.R2[k].length} — ${JSON.stringify(r.R2[k].slice(0,40))}${r.R2[k].length>40?' …':''}`)):L.push('- ничего.');
  L.push('',`Лишние швы (излом < 5°; не сливаем, отдельной задачей): ${r.site.extra.length?r.site.extra.map(x=>`№${x.a}–№${x.b} (${f(x.fold)}°${x.bent?', гнётся':''})`).join(', '):'нет'}.`);
  if(old)L.push('','## Известные расхождения (smoke: ПРЕДУПР)','','Движок страницы — копия коня (и собаки). На овчарке вылезли крайние случаи, которых у коня нет; чинить в общем движке отдельными тикетами. В `tools/smoke.js` эти проверки печатаются как ПРЕДУПР и не валят прогон (список `KNOWN`; глушится проверка целиком — новая поломка в ней тоже уйдёт в ПРЕДУПР). Цифры раздела — снимок прогона smoke 21.11 (тикет #141), скрипт их не пересчитывает: после пересборки сверить с выводом `node shepherd-v6j3w/tools/smoke.js`.','',
    '- **Острый шов 17° у уха** — на уголок-шаблон 17° (в допуске: `TPL_MIN` = 15°) не влезает гравировка «У17°»; на двух сгибах уголок в 3D-картинке встаёт не с той стороны / не под тем углом.',
    '- **Мелкие детали кончика уха и лап (8–12 мм в узком месте, 5 зеркальных пар)** — узкие грани, чистка их не убрала без ухода от эталона. На них не влезают 9 подписей сгибов и 2 номера детали; у карты №1 нет места под длины сторон; одна подпись шага сборки у края снимка.',
    '- **Окно «крутить сгиб»** — у одного сгиба (Г17 и зеркальный) в шапке угол ~41° и V/m не совпадают с заготовкой (139°).',
    '- **Зеркальные пары в DXF** — у одной пары (Г80 / Г80.1) подписи сгибов разные.',
    '- **Гибка при 1,5 мм / шов 1 мм** — без повтора с запретом сгибов 2 заготовки выходят битыми (страница и сборка повторяют — у них всё целое).','');
  L.push('','<details><summary>Все попытки чистки</summary>','');r.log.forEach(x=>L.push('- '+x));L.push('','</details>','');
  L.push('## Картинки','',`![спереди](img/${ID}_front.png) ![сбоку](img/${ID}_side.png) ![три четверти](img/${ID}_iso.png)`,'');
  return L.join('\n')+'\n';}
/* ---------- запуск ---------- */
module.exports={loadTris,loadRef,noseRound,cleanFig,mergePts,fileText,NOSE,VARIANTS};
function make(){const E=loadRef(),IMG=path.join(__dirname,'img'),site=run(SITE),polyDev=g('polyDev');fs.mkdirSync(IMG,{recursive:true});
  const R1=checkFigure(E,{sym:true,ref:E}),log=[],K=cleanFig(E,E,log),txt=fileText(K.E);fs.writeFileSync(path.join(JS,`plates-${ID}.js`),txt);
  // проверка — по записанному файлу (после округления), как его прочтёт страница
  run(txt);const m=run(`modelPoly('${ID}')`),EF={V:m.V,P:m.P,S:m.S},R2=checkFigure(EF,{sym:true,ref:E}),S=site(ID,TH.extra);
  const front=EF.V.reduce((a,p)=>p[2]>a[2]?p:a),top=EF.V.reduce((a,p)=>p[1]>a[1]?p:a),maxDev=Math.max(...EF.P.map(Q=>polyDev(EF.V,Q))),lost=(R1.parts-R2.parts)/R1.parts;
  ['front','side','iso'].forEach(v=>render(path.join(IMG,`${ID}_${v}.png`),S.V,S.F,()=>[196,200,208],v,{S:800,shade:true,group:fi=>S.part[fi]}));
  // голова крупно (нос): грани ближе 330 мм к кончику морды по глубине и выше 560 мм
  {const tp=S.V.reduce((a,p)=>p[2]>a[2]?p:a),keep=S.F.map((f,i)=>i).filter(i=>S.F[i].every(v=>S.V[v][2]>tp[2]-330&&S.V[v][1]>560)),used=[...new Set(keep.flatMap(i=>S.F[i]))],mp=new Map(used.map((v,k)=>[v,k]));
    const HV=used.map(i=>S.V[i]),HF=keep.map(i=>S.F[i].map(v=>mp.get(v)));['front','side','iso'].forEach(v=>render(path.join(IMG,`${ID}_head_${v}.png`),HV,HF,()=>[196,200,208],v,{S:500,shade:true,group:k=>S.part[keep[k]]}));}
  // Овчарка 3: xf — кадр 600 мм (плиты, облако кальки) → кадр фигуры, по габаритам (как traceMap на странице); деталей на голове — центр детали в той же области, что картинки головы
  let head=null;if(VARIANTS[ID].plates){const B6=E.B6,BF=meshBox(EF.V),s=[0,1,2].map(k=>BF.size[k]/B6.size[k]),c6=(B6.min[0]+B6.max[0])/2,cF=(BF.min[0]+BF.max[0])/2;
    const xf={s,d:[cF-c6*s[0],BF.min[1]-B6.min[1]*s[1],BF.min[2]-B6.min[2]*s[2]],about:'кадр 600 мм (plates.js, tracing.js) → кадр фигуры '+ID+' (js/plates-'+ID+'.js): p·s + d; пишет tools/make-shepherd.js '+ID};
    const XF=path.join(ROOT,VARIANTS[ID].xf);fs.mkdirSync(path.dirname(XF),{recursive:true});fs.writeFileSync(XF,JSON.stringify(xf,null,1));
    const tp=S.V.reduce((a,p)=>p[2]>a[2]?p:a),acc=new Map();S.F.forEach((f,fi)=>{const p=S.part[fi],q=acc.get(p)||[0,0,0,0];f.forEach(v=>{q[0]+=S.V[v][1];q[1]+=S.V[v][2];q[3]++;});acc.set(p,q);});
    head=[...acc.values()].filter(q=>q[1]/q[3]>tp[2]-330&&q[0]/q[3]>560).length;}
  const name=ID==='shepherd'?'Овчарка':run(`FIGURES.${ID}?FIGURES.${ID}.name:''`)||ID;
  const r={name,nose:E.nose,tris:E.tris,polys0:E.P.length,polys1:EF.P.length,parts0:R1.parts,parts1:R2.parts,lost,site:S,broken:broken(R2),R2,box:meshBox(EF.V).size,front,top,maxDev,log,head};
  fs.writeFileSync(path.join(__dirname,ID==='shepherd'?'report.md':`report-${ID}.md`),report(r));
  if(head!==null)console.log(`${name}: деталей на голове ${head}; xf → ${VARIANTS[ID].xf}`);
  const m2=/\((\d+)\)/.exec(name);if(/^shepherd2_/.test(ID)&&(!m2||+m2[1]!==EF.P.length))console.log(`ВНИМАНИЕ: в имени «${name}» (js/figures.js) число граней не совпадает с собранным: ${EF.P.length} — поправить имя в figures.js и index.html`);
  console.log(`${name} [${ID}]: граней ${E.P.length} → ${EF.P.length}, деталей ${R1.parts} → ${R2.parts} (−${(lost*100).toFixed(1)} %), позиций ${S.pieces}, масса ${S.mass.toFixed(1)} кг, швы ${(S.weld/1000).toFixed(1)} м, проварка ${(S.bendLen/1000).toFixed(1)} м, нарушено [${broken(R2).map(k=>k+':'+R2[k].length)}], лишних швов ${S.extra.length}, неплоскость ${maxDev.toFixed(3)} мм`);}
if(require.main===module){const ids=ARG_ID==='all'?Object.keys(VARIANTS):[ID];
  if(ARG_SRC&&ids.length>1)throw new Error('путь к .obj — только для одной фигуры');
  ids.forEach(id=>{ID=id;SRC=ARG_SRC||path.join(ROOT,VARIANTS[id].src);make();});}
