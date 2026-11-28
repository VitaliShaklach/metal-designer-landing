/* ---------- Панель, таблицы, расчёт ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// числа по-русски; форматтер на каждое число заново — 0,4 мс, а таблица зовёт его сотни раз: держим по одному на число знаков
const FMT={},fmt=(x,d=0)=>(FMT[d]||(FMT[d]=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}))).format(Number(x));
const store=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}};
function msg(t){$('msg').textContent=t||'';}

// состояние фигуры
const ST={frame:null,edit:false,sym:true,sv:-1,sp:-1,sp2:-1,seam:null,traceUrl:false,verBase:'',ver:0,orig:null,refId:'',tref:'',name:'',fig:'shepherd',base:null,faces:260,diss:0,dims:{W:0,H:600,D:0},prop:true,t:2,mat:'steel',sheet:'1250x2500',sw:1250,sl:2500,cut:'laser',minW:15,weld:'tig',gap:0.5,useT:true,ngap:5,ngapOwn:false,engrave:true,tpl:false,bend:true,perf:true,slotW:2,slotL:40,slotBr:3,slotEb:3,slotEl:5,slotNotch:true,slotD:3,selB:-1,allParts:false,sel:-1,nums:false,small:true};
ST.layers=layersLoad(store('shepherd-layers'));   // слои мастерской (#145), хранятся в браузере
let SIMP={key:'',m:null},CUR=null,CALC_KEY='';   // CUR = {M3,R,T,small}
const DENSE=2000;                    // больше стольких треугольников — модель гладкая, упрощаем
const isDense=()=>!ST.base.P&&ST.base.F.length>DENSE;
const isPoly=()=>!!ST.base.P;   // модель из граней-многоугольников (руками / в редакторе) — живёт в мм как есть
const E=()=>({V:ST.base.V,P:ST.base.P,S:ST.base.S||[],H:ST.base.H||[]});
// грани, протыкающие другие: считаем только в редакторе или с подсветкой; на одну модель — один раз
const PRC=new WeakMap(),pierceOn=()=>isPoly()&&(ST.edit||ST.small),pierceOf=b=>{let s=PRC.get(b);if(!s){s=new Set(piercePolys({V:b.V,P:b.P}));PRC.set(b,s);}return s;};
// размеры многоугольной модели: тянем саму модель (x — от оси, y — от пола, z — от стены)
function setPolyDims(){ST.base=polyBase(fitMesh({V:ST.base.V,F:[]},ST.dims).V,ST.base.P,ST.base.S,ST.base.H);}
function syncDims(){const s=meshBox(ST.base.V).size;ST.dims={W:Math.round(s[0]),H:Math.round(s[1]),D:Math.round(s[2])};}
function natSize(){return meshBox(ST.base.V).size;}
function dimsFromH(H){const s=natSize();ST.dims={H,W:Math.round(s[0]*H/s[1]),D:Math.round(s[2]*H/s[1])};}
function sheetWL(){if(ST.sheet==='own')return [Math.max(ST.sw,ST.sl),Math.min(ST.sw,ST.sl)];const [a,b]=ST.sheet.split('x').map(Number);return [b,a];}

function loading(on,t){$('loading').hidden=!on;if(t)$('loadTxt').textContent=t;}
// тяжёлое — после отрисовки «Строю…»
function later(fn,t){loading(true,t||'Считаю…');setTimeout(()=>{try{fn();}catch(e){console.error(e);msg('Ошибка: '+e.message);}loading(false);},30);}

// производство: контуры реза под толщину и шов, раскладка на лист
function prodCalc(){const R=CUR.R,[W,H]=sheetWL();CUR.C=R.parts.map(p=>cutContour(p,ST.t,ST.gap,ST.useT));
  // гибка (галочка): заготовки со сгибами; если контур заготовки не вышел — её стыки варим и считаем заново
  CUR.BL=[];CUR.BP=null;if(ST.bend){const ban=new Set();for(let k=0;k<4;k++){const P=bendPlan(R,CUR.M3.V,{sheet:[H,W],ban}),BL=P.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,R,CUR.M3.V,P,{t:ST.t,gap:ST.gap,useT:ST.useT})));
    CUR.BP=P;CUR.BL=BL.filter(b=>!b.bad);if(CUR.BL.length===BL.length)break;BL.filter(b=>b.bad).forEach(b=>b.bends.forEach(id=>ban.add(id)));}
    blankNumbers(CUR.BL,R);blankTwins(CUR.BL,R,CUR.BP.J);}   // зеркальные — парой: Г3 и Г3.1, числа у Г3.1 — как у Г3
  const BJ=CUR.BP?CUR.BL.flatMap(b=>b.bends.map(id=>CUR.BP.J[id])):[];CUR.bentKey=new Set(BJ.map(j=>bendKey(j.p,j.q)));CUR.blankOf=new Int32Array(R.parts.length).fill(-1);CUR.BL.forEach((b,i)=>b.parts.forEach(pi=>CUR.blankOf[pi]=i));
  CUR.bendSt={V:BJ.filter(j=>j.kind==='V').length,m:BJ.filter(j=>j.kind==='m').length,len:BJ.reduce((a,j)=>a+j.len,0)};
  // куски на резку: отдельные детали и заготовки, по номеру первой детали
  // holes — отверстия (#155) в той же системе, что pts
  CUR.PC=R.parts.filter(p=>CUR.blankOf[p.id]<0).map(p=>({id:p.id,no:p.no,pts:CUR.C[p.id].pts,bad:CUR.C[p.id].bad,parts:[p.id],key:p.no,holes:p.hpts||[]}))
    .concat(CUR.BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts,parts:b.parts,key:R.parts[b.parts[0]].no,B:b,holes:b.holes||[]}))).sort((a,b)=>a.key-b.key);
  // раскладка тяжёлая (секунды) — считаем только когда нужна (Итого, Раскрой, Чертежи, DXF) и в фоне; одинаковые контуры — из кэша
  NEST.items=CUR.PC.filter(o=>!o.bad).map(o=>({id:o.id,no:o.no,pts:o.pts}));
  // уголки-шаблоны (галочка) — в раскрой вместе с деталями: под углы швов и сгибов (гнутые стыки — не швы)
  CUR.TPL=ST.tpl?weldTemplates(R,ST.t,ST.minW,ST.bend?(p,q)=>CUR.bentKey.has(bendKey(p,q)):null,CUR.BL.flatMap(b=>b.lines.map(l=>l.ang))):null;if(CUR.TPL)NEST.items.push(...CUR.TPL.map(o=>({id:'t'+o.a,no:tplNo(o.a),pts:o.pts})));
  // с гибкой — тоже внутренней стороной вверх: V и m на гравировке — «на себя» и «от себя»
  NEST.args=[W,H,ST.ngap,10,2.5,2,ST.engrave||ST.bend];
  NEST.want=JSON.stringify([NEST.args,NEST.items.map(o=>[o.no,o.pts.map(q=>q.map(v=>Math.round(v*10)))])]);CUR.N=NEST.key===NEST.want?NEST.N:null;
  CUR.cutLen=CUR.PC.reduce((a,o)=>a+(o.B?blankCut(o.B):perim(o.pts)),0);CUR.degen=CUR.PC.filter(o=>o.bad).length;CALC_KEY=calcKeyOf();}
// ключ задания для «Рассчитать» (editor/common/calc.js): всё, от чего раскрой, чертежи и карты были бы другими — фигура и точки, толщина, шов, резка, лист, галочки. Выбор детали, вид 3D, вкладка в него не входят
function calcKeyOf(){let h=0;CUR.M3.V.forEach(p=>{h=(Math.imul(h,31)+Math.round(p[0]*10)*7+Math.round(p[1]*10)*13+Math.round(p[2]*10)*17)|0;});
  return JSON.stringify([NEST.want,h,CUR.M3.V.length,(CUR.M3.P||CUR.M3.F||[]).length,CUR.R.parts.length,ST.name,ST.t,ST.mat,ST.weld,ST.cut,ST.gap,ST.useT,ST.bend,ST.tpl,ST.engrave,ST.perf,ST.slotW,ST.slotL,ST.slotBr,ST.slotEb,ST.slotEl,ST.slotNotch,ST.slotD,ST.sheet,ST.sw,ST.sl,ST.ngap]);}
function compute(){compute0();prodCalc();}
const NEST={key:'',want:'',N:null,run:null,wait:[]};
// раскладка по кусочкам, чтобы страница не замирала; cb — когда готово
const nestCnt=t=>document.querySelectorAll('.nestCnt').forEach(e=>{e.textContent=t;});   // индикатор (кольцо и «Считаю…») показывает calc.js, счёт — здесь
function ensureNest(cb){if(CUR&&CUR.N){cb&&cb();return;}if(cb)NEST.wait.push(cb);if(NEST.run&&NEST.run.key===NEST.want)return;
  const key=NEST.want,g=nestGen(NEST.items,...NEST.args),run={key};NEST.run=run;
  const step=()=>{if(NEST.run!==run)return;const t0=performance.now();let v;
    try{do{v=g.next();}while(!v.done&&performance.now()-t0<60);}
    catch(e){NEST.run=null;NEST.wait=[];failAll();throw e;}   // упало посреди счёта — кнопки не висят на «Считаю…»
    if(!v.done){nestCnt(`· ${v.value.done} из ${v.value.of}`);setTimeout(step,0);return;}
    nestCnt('');NEST.key=key;NEST.N=v.value;NEST.run=null;if(CUR&&NEST.want===key)CUR.N=v.value;const w=NEST.wait;NEST.wait=[];w.forEach(f=>f());if(!$('tab-sum').hidden)sumTable();};
  setTimeout(step,0);}
function compute0(){const b=ST.base;let S=b;
  if(isPoly()){const M3={V:b.V,F:b.F,T:b.T,S:b.S,H:b.H},R=buildParts(M3,1.5,1.5),wl=FIGURES[ST.fig]?.noBack?0:addBacking(R,M3,FIGURES[ST.fig]?.backIf),_p=pairNumbers(R,M3.V),T=totals(R,{t:ST.t,mat:ST.mat,sheet:sheetWL()});T.weld+=wl;T.open=Math.max(0,T.open-wl);
    CUR={M3,R,T,small:new Set(R.parts.filter(p=>p.minW<ST.minW-.5).map(p=>p.id)),bad:new Set(nonPlanar(E(),1.5)),selfx:new Set(selfXPolys(E())),pierce:pierceOn()?pierceOf(b):null};if(ST.sel>=R.parts.length)ST.sel=-1;if(ST.sp>=b.P.length)ST.sp=-1;if(ST.sv>=b.V.length)ST.sv=-1;return;}
  if(isDense()&&ST.faces<b.F.length){const key=b.F.length+':'+b.V.length+':'+ST.faces+':'+b.V[0];if(SIMP.key!==key){SIMP={key,m:simplify(b,ST.faces)};}S=SIMP.m;}
  else if(!isDense()&&ST.faces<b.F.length){const key='low:'+b.F.length+':'+ST.faces+':'+b.V[0];if(SIMP.key!==key){SIMP={key,m:simplify(b,ST.faces)};}S=SIMP.m;}
  const asIs=!isDense()&&ST.faces>=b.F.length;   // гранёная как есть: грани уже плоские, не трогаем
  let M3=fitMesh(S,ST.dims);if(ST.minW>0&&!asIs)M3=fitMesh(fixSlivers(M3,ST.minW),ST.dims);   // после чистки — снова точно в размер
  if(ST.diss>0)M3=mergeFlat(M3);
  const R=asIs||ST.diss>0?buildParts(M3,1.5,1.5):buildParts(M3);pairNumbers(R,M3.V);const T=totals(R,{t:ST.t,mat:ST.mat,sheet:sheetWL()});
  const small=new Set(R.parts.filter(p=>p.minW<ST.minW-.5).map(p=>p.id));
  CUR={M3,R,T,small,bad:new Set()};if(ST.sel>=R.parts.length)ST.sel=-1;}
// слить почти плоские грани в многоугольники → выровнять в плоскость (стена остаётся на z=0) → снова точно в размер
function mergeFlat(M3){const G=dissolve(M3,ST.diss,Math.max(ST.dims.W,ST.dims.H,ST.dims.D)*.01),open=openVerts(G);
  const V=planarize(G.V,G.P,(i,q)=>{if(open.has(i)&&Math.abs(G.V[i][2])<.5)q[2]=0;return q;},400);return fitMesh(polyMesh(V,G.P),ST.dims);}

function renderAll(fit){if(OW.on){owRender();return;}if(!CUR||ST.orig)return;   // оригинал для обводки (#175) — своя сцена, без расчёта   // под оригиналом (вид) рабочая фигура стоит как была, сцену не трогаем
  if(pierceOn()&&!CUR.pierce)CUR.pierce=pierceOf(ST.base);const ed=ST.edit&&isPoly(),T=ST.base.T,tri=set=>{const o=new Set();if(T)T.forEach((pi,fi)=>{if(set.has(pi))o.add(fi);});return o;};
  build3D(CUR.M3,CUR.R,{...(typeof angBuildOpts==='function'?angBuildOpts():{}),sel:ST.sel,bent:CUR.bentKey&&CUR.bentKey.size?e=>e.p.length===2&&CUR.bentKey.has(bendKey(e.p[0],e.p[1])):null,grp:selBlank()>=0?new Set(CUR.BL[selBlank()].parts):null,small:ST.small?CUR.small:null,nums:ST.nums&&!ed,mat:ST.mat,edges:!ed||ST.layers.edges,verts:ed&&vertsShown(),sv:ST.sv,hi:ed&&ST.sp>=0?tri(new Set([ST.sp,ST.sp2])):null,warn:isPoly()?tri(CUR.bad):null,blue:ed&&CUR.selfx?tri(CUR.selfx):null,pierce:pierceOn()&&CUR.pierce?tri(CUR.pierce):null,mark:ed&&ST.seam?ST.seam:null,tex:traceTex(),tlines:traceSeg(),markup:ed?mkDraw():null,plaster:!!(FIGURES[ST.verBase]||{}).plaster,diff:ed&&traceOn()&&ST.layers.diff?TRC.diff:null,backs:CUR.R.parts.filter(p=>p.back).map(p=>p.full.map(i=>V3.sub(CUR.M3.V[i],V3.mul(p.n,BACK_DEPTH))))});edUI();mkUI();layersUI();traceUI();if(fit)fitBox(meshBox(CUR.M3.V),fit==='instant');
  stats();sizeUI();facesUI();selUI();partsTable();sumTable();sheetsUI();$('ttl').textContent=ST.name||'Фигура';label3D();if(typeof angAfter==='function')angAfter();}
// 3D-окно для читалок экрана: название, детали, габарит — меняется вместе с фигурой и названием
function label3D(){if(!ok||!CUR||OW.on)return;const n=CUR.R.parts.length,b=meshBox(CUR.M3.V).size,pc=CUR.BL&&CUR.BL.length?CUR.PC.length:0;
  renderer.domElement.setAttribute('aria-label',`3D-модель «${ST.name||'Фигура'}»: ${n} ${plural(n,'деталь','детали','деталей')}${pc?`, ${pc} ${plural(pc,'позиция','позиции','позиций')} на резку`:''}, ${Math.round(b[0])} × ${Math.round(b[1])} × ${Math.round(b[2])} мм (Ш × В × Г)`);}
function stats(){const T=CUR.T,b=meshBox(CUR.M3.V).size;
  $('stats').innerHTML=[[`${Math.round(b[0])} × ${Math.round(b[1])} × ${Math.round(b[2])}`,'Ш × В × Г, мм'],CUR.BL&&CUR.BL.length?[`${T.n} → ${CUR.PC.length}`,`${plural(T.n,'деталь','детали','деталей')} → ${plural(CUR.PC.length,'позиция','позиции','позиций')} на резку (${CUR.BL.length} ${plural(CUR.BL.length,'гнутая','гнутые','гнутых')})`]:[`${T.n}`,plural(T.n,'деталь','детали','деталей')],[`≈ ${fmt(T.mass,1)} кг`,`${ST.t} мм, ${MATN[ST.mat]}`],[`${fmt(weldLen()/1000,1)} м`,'швов']]
    .map(([b,s])=>`<div class="stat"><b>${b}</b><span>${esc(s)}</span></div>`).join('');}
// швы без гнутых стыков
const weldLen=()=>CUR.T.weld-(CUR.bendSt&&CUR.BL.length?CUR.bendSt.len:0);
// угол между листами по шву; вогнутый (больше 180°) — «внутрь»
const angT=d=>d>180.5?Math.round(360-d)+'° внутрь':Math.round(d)+'°';
const MATN={steel:'сталь',inox:'нержавейка',corten:'кортен',alu:'алюминий'};
function sizeUI(){['H','W','D'].forEach(k=>{const el=$('d'+k);if(document.activeElement!==el)el.value=ST.dims[k];});$('cProp').checked=ST.prop;}
function facesUI(){$('fRng').disabled=$('dRng').disabled=isPoly();$('dRng').value=ST.diss;$('dVal').textContent=ST.diss?ST.diss+'°':'нет';if(isPoly()){$('fVal').textContent=ST.base.P.length+' (многоугольников)';$('fNote').textContent='Модель из граней-многоугольников: берём как есть, число граней меняется в редакторе. Чтобы упростить гладкую модель — откройте её заново';$('minW').value=ST.minW;$('cSmall').checked=ST.small;return;}
  const n=ST.base.F.length,r=$('fRng');r.max=Math.min(n,1500);r.min=Math.min(40,n);r.value=Math.min(ST.faces,n);$('fVal').textContent=Math.min(ST.faces,n);
  $('fNote').textContent=isDense()?`Модель гладкая: ${fmt(n)} ${plural(n,'треугольник','треугольника','треугольников')} — упрощаем до выбранного числа. 150–300 — как у фигур в мастерских, больше — глаже, но больше сварки`
    :ST.faces>=n?`Модель гранёная: ${n} ${plural(n,'треугольник','треугольника','треугольников')} — берём как есть, грани в одной плоскости сливаются в одну деталь. Ползунок влево — ещё проще`:`Модель гранёная (${n} ${plural(n,'треугольник','треугольника','треугольников')}) — упрощена до ${ST.faces}`;
  $('minW').value=ST.minW;$('cSmall').checked=ST.small;}

/* ---------- деталь: развёртка с длинами сторон и соседями ---------- */
function partSVG(p,big){const P=p.pts;if(!P.length)return '';const pad=big?Math.max(p.L,p.W)*.16+8:2,w=p.L+2*pad,h=p.W+2*pad,fs=Math.max(p.L,p.W)*.07+3;
  const q=mainPart(CUR.R,p),[ra,tt]=svgAlt(`${big?'Развёртка':'Эскиз'} детали № ${p.no}: ${Math.round(q.L)} × ${Math.round(q.W)} мм${big?', длины сторон и номера соседей':''}`);   // числа — как в таблице (у «.1» — основной)
  let s=`<svg class="${big?'flat':'mini'}" viewBox="${-pad} ${-pad} ${w} ${h}" ${big?'':'width="64" height="40"'}${ra}>${tt}<polygon points="${P.map(q=>q[0].toFixed(1)+','+(p.W-q[1]).toFixed(1)).join(' ')}" class="pf" vector-effect="non-scaling-stroke"/>${(p.hpts||[]).map(H=>`<polygon points="${H.map(q=>q[0].toFixed(1)+','+(p.W-q[1]).toFixed(1)).join(' ')}" class="pf" vector-effect="non-scaling-stroke"/>`).join('')}`;
  if(big){const cx=p.pts.reduce((s,q)=>s+q[0],0)/P.length,cy=p.pts.reduce((s,q)=>s+q[1],0)/P.length;
    p.segs.forEach((g,i)=>{const a=P[i],b=P[(i+1)%P.length],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=mx-cx,dy=my-cy,l=Math.hypot(dx,dy)||1,ox=mx+dx/l*fs*1.1,oy=my+dy/l*fs*1.1;
      const nb=g.nb>=0?CUR.R.parts[g.nb].no:null;
      s+=`<text x="${ox.toFixed(1)}" y="${(p.W-oy).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${Math.round(g.len)}</text>`;
      if(nb)s+=`<text x="${(mx-dx/l*fs*1.2).toFixed(1)}" y="${(p.W-(my-dy/l*fs*1.2)).toFixed(1)}" font-size="${(fs*.8).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="nb">→${nb}</text>`;});
    const eg=ST.engrave&&CUR.C&&CUR.C[p.id]&&!CUR.C[p.id].bad?engraveSegs(p.no,CUR.C[p.id].pts):null;
    if(eg)s+=`<path class="engr" d="${eg.map(z=>`M${z[0].toFixed(1)},${(p.W-z[1]).toFixed(1)}L${z[2].toFixed(1)},${(p.W-z[3]).toFixed(1)}`).join('')}"/>`;
    else s+=`<text x="${cx.toFixed(1)}" y="${(p.W-cy).toFixed(1)}" font-size="${(fs*1.5).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="no">${p.no}</text>`;}
  else if(ST.engrave&&CUR.C&&CUR.C[p.id]&&!CUR.C[p.id].bad){const eg=engraveSegs(p.no,CUR.C[p.id].pts);if(eg)s+=`<path class="engr" d="${eg.map(z=>`M${z[0].toFixed(1)},${(p.W-z[1]).toFixed(1)}L${z[2].toFixed(1)},${(p.W-z[3]).toFixed(1)}`).join('')}"/>`;}
  return s+'</svg>';}
// выбранная заготовка: кликнули строку заготовки или деталь, которая в ней
const selBlank=()=>!CUR.BL||!CUR.BL.length?-1:ST.selB>=0&&CUR.BL[ST.selB]?ST.selB:ST.sel>=0&&CUR.blankOf[ST.sel]>=0?CUR.blankOf[ST.sel]:-1;
// эскиз заготовки: вид изнутри (со стороны гравировки), контур реза, линии сгиба V — красным, m — синим; крупный — с подписями и номерами деталей.
// Классы свои (bk…): стили листов PDF (.no, .bv) действуют на всю страницу
function blankSVG(b,big){const t=bendAlign(b.pts,true),T=q=>{const z=trPt(t,q);return [z[0],t.W-z[1]];},pad=big?Math.max(t.L,t.W)*.1+8:2,fs=Math.max(t.L,t.W)*.035+2.5,f=v=>v.toFixed(1);
  const nl=b.lines.length,[ra,tt]=svgAlt(`${big?'Развёртка':'Эскиз'} заготовки Г${b.no}: ${Math.round(b.L)} × ${Math.round(b.W)} мм, ${nl} ${plural(nl,'сгиб','сгиба','сгибов')} (V — красным, m — синим), вид изнутри`);
  let s=`<svg class="${big?'flat':'mini'}" viewBox="${-pad} ${-pad} ${t.L+2*pad} ${t.W+2*pad}" ${big?'':'width="64" height="40"'}${ra}>${tt}<polygon points="${(perfOn()?shapeFlat(blankSlots(b).outline):b.pts).map(q=>T(q).map(f).join(',')).join(' ')}" class="pf" vector-effect="non-scaling-stroke"/>`;
  if(perfOn())blankSlots(b).holes.forEach(h=>{s+=`<path class="bkp" d="${shpD(shapeFlat(h).map(T))}" vector-effect="non-scaling-stroke"/>`;});   // средние прорези — как режут
  b.lines.forEach(l=>l.segs.forEach(z=>{const a=T([z[0],z[1]]),c=T([z[2],z[3]]);s+=`<path class="bl ${l.kind==='V'?'bkv':'bkm'}" d="M${f(a[0])},${f(a[1])}L${f(c[0])},${f(c[1])}" vector-effect="non-scaling-stroke"/>`;}));
  if(!big)return s+'</svg>';
  // номера деталей, потом подписи сгибов — без наложений: подпись ищет место вдоль линии, по обе стороны, дальше от неё; внутри тесно — снаружи контура
  const P=b.pts.map(T),NL=placeLabels(b.regions.map(z=>{const Q=z.pts.map(T);return {t:String(CUR.R.parts[z.pi].no),pts:Q,a:Math.abs(area2(Q))};}),fs,.62),box=NL.map(l=>{const w=l.t.length*l.h*.62;return [l.x-w/2,l.y-l.h/2,l.x+w/2,l.y+l.h/2];});
  const hit=b2=>box.some(c=>b2[0]<c[2]&&b2[2]>c[0]&&b2[1]<c[3]&&b2[3]>c[1]);
  b.lines.forEach(l=>{if(!l.segs.length)return;const z=l.segs.reduce((x,y)=>Math.hypot(y[2]-y[0],y[3]-y[1])>Math.hypot(x[2]-x[0],x[3]-x[1])?y:x),a=T([z[0],z[1]]),c=T([z[2],z[3]]),t=bendTxt(l);
    let an=Math.atan2(c[1]-a[1],c[0]-a[0]);if(an>Math.PI/2)an-=Math.PI;if(an<-Math.PI/2)an+=Math.PI;const cs=Math.cos(an),sn=Math.sin(an);let best=null;
    for(const ins of [true,false])for(const hh of [fs*.8,fs*.65])for(const off of [.15,.8,1.6,2.6])for(const q of [.5,.35,.65,.2,.8])for(const sd of [-1,1]){if(best)break;const w=t.length*hh*.62,d=sd*(hh/2+off*hh),cx=a[0]+(c[0]-a[0])*q-sn*d,cy=a[1]+(c[1]-a[1])*q+cs*d;
      const K=[[-w/2,-hh/2],[w/2,-hh/2],[w/2,hh/2],[-w/2,hh/2]].map(([x,y])=>[cx+cs*x-sn*y,cy+sn*x+cs*y]),bb=[Math.min(...K.map(k=>k[0])),Math.min(...K.map(k=>k[1])),Math.max(...K.map(k=>k[0])),Math.max(...K.map(k=>k[1]))];
      if((!ins||K.every(k=>inPoly(k,P)))&&!hit(bb))best={cx,cy,hh,bb};}   // внутри не нашлось места — рядом снаружи
    if(!best){const hh=fs*.65;best={cx:(a[0]+c[0])/2,cy:(a[1]+c[1])/2,hh,bb:null};}if(best.bb)box.push(best.bb);
    s+=`<text transform="translate(${f(best.cx)},${f(best.cy)}) rotate(${f(an*180/Math.PI)})" font-size="${f(best.hh)}" text-anchor="middle" dominant-baseline="middle" class="bkt ${l.kind==='V'?'bkv':'bkm'}">${esc(t)}</text>`;});
  NL.forEach(l=>{s+=`<text x="${f(l.x)}" y="${f(l.y)}" font-size="${f(l.h)}" text-anchor="middle" dominant-baseline="middle" class="bkt bkno">${l.t}</text>`;});
  return s+'</svg>';}
// соседи заготовки по сварке (детали вне её)
function blankWelds(b){const in_=new Set(b.parts),m=new Map();b.parts.forEach(pi=>partNbs(CUR.R,pi).forEach(g=>{if(!in_.has(g.nb))m.set(CUR.R.parts[g.nb].no,angT(g.dih));}));return [...m].sort((a,b)=>a[0]-b[0]);}
function blankUI(b){const dens=DENS[ST.mat]||7850,a=b.area,ns=b.parts.map(i=>CUR.R.parts[i].no);
  $('selBox').innerHTML=`<p class="selh">Заготовка Г${b.no} — детали ${ns.join(', ')}</p>${blankSVG(b,true)}
    <p class="note">Вид изнутри (со стороны гравировки). Габарит ${Math.round(b.L)} × ${Math.round(b.W)} мм · ${fmt(a/100,1)} см² · ${fmt(a*1e-9*ST.t*dens,3)} кг · рез ${Math.round(blankCut(b))} мм</p>
    <p class="note">Гнуть по порядку: ${b.lines.map(l=>`${l.k}) ${l.kind}${l.ang} — № ${CUR.R.parts[l.p].no} и ${CUR.R.parts[l.q].no}`).join('; ')}. V — на себя, m — от себя, число — угол между гранями после гибки</p>
    <p class="note">Сварка: ${blankWelds(b).map(([n,a])=>`к № ${n} (${a})`).join(', ')||'—'}</p>`;}
function selUI(){if(ST.selB>=0&&selBlank()===ST.selB){blankUI(CUR.BL[ST.selB]);return;}const p=ST.sel>=0?CUR.R.parts[ST.sel]:null;if(!p){$('selBox').innerHTML='<p class="note">Кликните грань на модели или строку в таблице</p>';return;}
  const q=mainPart(CUR.R,p),m=q.area*1e-6*ST.t*1e-3*(DENS[ST.mat]||7850),bi=CUR.blankOf?CUR.blankOf[p.id]:-1;   // числа зеркальной — как у основной
  $('selBox').innerHTML=`<p class="selh">Деталь № ${p.no}${p.back?' — подложка за прорезью (приварить изнутри по краю)':''}${CUR.small.has(p.id)?' <span class="bad">узкая</span>':''}</p>${partSVG(p,true)}
    <p class="note">Габарит ${Math.round(q.L)} × ${Math.round(q.W)} мм · ширина ${Math.round(q.minW)} мм · ${fmt(q.area/100,1)} см² · ${fmt(m,3)} кг · рез ${Math.round(q.perim)} мм</p>
    ${bi>=0?`<p class="note">Заготовка Г${CUR.BL[bi].no} (дет. ${CUR.BL[bi].parts.map(i=>CUR.R.parts[i].no).join(', ')}) · гнуть: ${CUR.BL[bi].lines.filter(l=>l.p===p.id||l.q===p.id).map(l=>`к № ${CUR.R.parts[l.p===p.id?l.q:l.p].no} — ${bendTxt(l)}`).join('; ')}</p>`:''}
    <p class="note">Сварка: ${partNbs(CUR.R,p.id).filter(g=>!isBentNb(p.id,g.nb)).map(g=>`к № ${CUR.R.parts[g.nb].no} — ${Math.round(g.len)} мм, угол ${angT(g.dih)}`).join('; ')||'—'}${q.segs.some(g=>g.nb<0)?'. Открытый край — '+Math.round(q.segs.filter(g=>g.nb<0).reduce((s,g)=>s+g.len,0))+' мм':''}</p>`;}
const isBentNb=(p,q)=>!!(CUR.bentKey&&CUR.bentKey.has(bendKey(p,q)));
// с гибкой — куски на резку: заготовка одной строкой; ссылка над таблицей — все детали (для сборки)
function piecesTable(){const dens=DENS[ST.mat]||7850,sb=selBlank();
  $('partsVw').innerHTML=`Позиций на резку: ${CUR.PC.length} (заготовок со сгибами ${CUR.BL.length}) · <button type="button" class="lnk" data-vw="parts">все детали (${CUR.R.parts.length})</button>`;
  $('parts').innerHTML=`<thead><tr><th>№</th><th>Эскиз</th><th>Размер, мм</th><th>Площадь, см²</th><th>Масса, кг</th><th>Рез, мм</th><th>Детали · гнуть по порядку</th><th>Сварка с (угол)</th></tr></thead><tbody>`+
    CUR.PC.map(o=>{const a=o.B?o.B.area:Math.abs(area2(o.pts)),cl=`${CUR.small.has(o.parts[0])&&!o.B?' bad':''}`;
      if(o.B){const b=o.B,bi=+o.id.slice(1);return `<tr data-b="${bi}" class="${bi===sb?'on':''}"><td>Г${b.no}</td><td>${blankSVG(b)}</td><td>${Math.round(b.L)} × ${Math.round(b.W)}</td><td>${fmt(a/100,1)}</td><td>${fmt(a*1e-9*ST.t*dens,3)}</td><td>${Math.round(blankCut(b))}</td>
        <td class="nbs">${b.parts.map(i=>CUR.R.parts[i].no).join(', ')}<br><small>${b.lines.map(l=>`${l.k}) ${l.kind}${l.ang}`).join(' ')}</small></td><td class="nbs">${blankWelds(b).map(([n,g])=>`${n}<small> ${g}</small>`).join(', ')}</td></tr>`;}
      const p=CUR.R.parts[o.parts[0]],q=mainPart(CUR.R,p);return `<tr data-p="${p.id}" class="${p.id===ST.sel?'on':''}${cl}"><td>${p.no}</td><td>${partSVG(p)}</td><td>${Math.round(q.L)} × ${Math.round(q.W)}</td><td>${fmt(q.area/100,1)}</td><td>${fmt(q.area*1e-9*ST.t*dens,3)}</td><td>${Math.round(q.perim)}</td><td>—</td>
        <td class="nbs">${p.back?'подложка глаза':partNbs(CUR.R,p.id).map(g=>`${CUR.R.parts[g.nb].no}<small> ${angT(g.dih)}</small>`).join(', ')}</td></tr>`;}).join('')+'</tbody>';}
function partsTable(){const bt=CUR.BL&&CUR.BL.length;if(bt&&!ST.allParts){piecesTable();return;}
  $('partsVw').innerHTML=bt?`Все детали: ${CUR.R.parts.length} · <button type="button" class="lnk" data-vw="pieces">позиции на резку (${CUR.PC.length})</button>`:'';
  const ps=[...CUR.R.parts].sort((a,b)=>a.no-b.no),dens=DENS[ST.mat]||7850,grp=selBlank();
  $('parts').innerHTML=`<thead><tr><th>№</th><th>Эскиз</th><th>Размер, мм</th><th>Ширина</th><th>Площадь, см²</th><th>Масса, кг</th><th>Рез, мм</th>${bt?'<th>Заготовка</th>':''}<th>Соседи (угол)</th></tr></thead><tbody>`+
    ps.map(p=>{const q=mainPart(CUR.R,p);return `<tr data-p="${p.id}" class="${p.id===ST.sel?'on':bt&&grp>=0&&CUR.blankOf[p.id]===grp?'grp':''}${CUR.small.has(p.id)?' bad':''}"><td>${p.no}</td><td>${partSVG(p)}</td><td>${Math.round(q.L)} × ${Math.round(q.W)}</td><td>${Math.round(q.minW)}</td><td>${fmt(q.area/100,1)}</td><td>${fmt(q.area*1e-9*ST.t*dens,3)}</td><td>${Math.round(q.perim)}</td>${bt?`<td>${CUR.blankOf[p.id]>=0?'Г'+CUR.BL[CUR.blankOf[p.id]].no:'—'}</td>`:''}
      <td class="nbs">${p.back?'подложка глаза':partNbs(CUR.R,p.id).map(g=>`${CUR.R.parts[g.nb].no}<small> ${isBentNb(p.id,g.nb)?'гнуть':angT(g.dih)}</small>`).join(', ')}</td></tr>`;}).join('')+'</tbody>';}
function sumTable(){const T=CUR.T,[sl,sw]=sheetWL(),warn=[];
  if(CUR.small.size)warn.push(`${CUR.small.size} дет. уже ${ST.minW} мм — подсвечены красным. Уменьшите число граней или увеличьте фигуру`);
  const H=ST.dims.H;if(ST.t<=1&&H>350||ST.t<1.5&&H>700)warn.push(`Лист ${ST.t} мм на фигуре ${H} мм — поведёт от сварки. Варите короткими прихватками вразбежку или возьмите толще`);
  if(CUR.degen)warn.push(`${CUR.degen} дет. после учёта толщины и шва выродились (слишком узкие) — уменьшите число граней, увеличьте фигуру или снимите «Учитывать толщину»`);
  if(CUR.N&&ST.engrave){const ms=CUR.N.sheets.flatMap(sh=>sh.items).flatMap(o=>itemMarks(o).miss),sm=ms.filter(t=>!t.includes(' сгиб ')),sb=ms.filter(t=>t.includes(' сгиб '));
    if(sm.length)warn.push(`Номер не влезает гравировкой (детали малы): ${sm.join(', ')} — это щепки от упрощения, их можно убрать: больше граней, «Мин. ширина детали» или крупнее фигура`);
    if(sb.length)warn.push(`Подпись сгиба не влезла (линия короткая или грань узкая): ${sb.join(', ')} — линия сгиба вырезана, подпись есть на листе «Гибка» в чертежах`);}
  if(perfOn()&&CUR.BL&&CUR.BL.length){const ms=CUR.BL.flatMap(b=>blankSlots(b).miss);if(ms.length)warn.push(`Сгиб без прорезей или без выреза на конце — линия слишком короткая или деталь рядом слишком узкая: ${[...new Set(ms)].join(', ')}`);}
  if(CUR.N&&CUR.N.too.length)warn.push(`Не влезают в лист: ${CUR.N.too.map(itemName).join(', ')} — выберите лист больше`);
  const holes=CUR.R.parts.filter(p=>p.holes).length;if(holes)warn.push(`У ${holes} дет. внутри дыра — проверьте модель`);
  $('warn').hidden=!warn.length;$('warn').innerHTML=warn.map(esc).join('<br>');
  const rows=[['Деталей',T.n],['Площадь металла',fmt(T.area/1e6,2)+' м²'],[`Масса (${ST.t} мм, ${MATN[ST.mat]})`,'≈ '+fmt(T.mass,1)+' кг'],['Длина реза (с учётом толщины)',fmt(CUR.cutLen/1000,1)+' м'],
    ['Длина швов',fmt(weldLen()/1000,1)+' м'],['Сварка',`${WELDN[weldOf()]} · зазор шва ${mmT(ST.gap)} мм`],['Открытый край (спина, низ)',fmt(T.open/1000,1)+' м'],['Самая узкая деталь',Math.round(T.minW)+' мм'],[`Листов ${sw} × ${sl}`,CUR.N?`${CUR.N.sheets.length} (детали в полосе ${sw} × ${Math.round(CUR.N.sheets[0]?CUR.N.sheets[0].len:0)} мм)`:'раскладываю…']];
  // гибка: сколько кусков на резку, сгибов и на сколько меньше сварки
  if(CUR.BL&&CUR.BL.length){const B=CUR.bendSt,ns=CUR.PC.length-CUR.BL.length;rows.splice(1,0,['Гибка (галочка «Гнуть»)',`${CUR.PC.length} ${plural(CUR.PC.length,'позиция','позиции','позиций')} на резку: заготовок со сгибами ${CUR.BL.length} + отдельных деталей ${ns}`],
    ['Сгибов (стыки, которые гнём вместо сварки)',`V ${B.V} (на себя) · m ${B.m} (от себя) · ${fmt(B.len/1000,1)} м по рёбрам модели — эти стыки не варим`]);}
  if(CUR.TPL&&CUR.TPL.length){const tp=CUR.TPL,ta=tp.reduce((a,o)=>a+Math.abs(area2(o.pts)),0),tl=tp.reduce((a,o)=>a+perim(o.pts),0);
    rows.push(['Уголки-шаблоны для сварки (оснастка, по одному на угол)',`${tp.length} шт · ${tp[0].a}°…${tp[tp.length-1].a}° · ≈ ${fmt(ta*1e-9*ST.t*(DENS[ST.mat]||7850),2)} кг · рез ${fmt(tl/1000,1)} м`]);}
  if(CUR.N){const cs=cutStats(CUR.N.sheets.flatMap(s=>s.items));const at=rows.findIndex(r=>r[0].startsWith('Длина реза'))+1;const pc=CUR.BL&&CUR.BL.length?'позицию':'деталь';rows.splice(at,0,[CUR.TPL&&CUR.TPL.length?`Врезок (по одной на ${pc} и уголок)`:`Врезок (по одной на ${pc})`,cs.pierce]);if(cs.perf)rows.splice(at+1,0,['Перфорация сгибов (слой PERF, отдельно от реза и врезок выше)',perfTxt(cs)]);if(ST.engrave)rows.splice(at+1,0,['Длина гравировки номеров',fmt(cs.eng/1000,1)+' м']);if(cs.bend)rows.splice(at+1,0,['Линии сгиба на заготовках — гравировка (слои BEND_V, BEND_M)',fmt(cs.bend/1000,1)+' м — короче, чем «Сгибов» выше, и это верно: линия кончается у кромки заготовки, а кромка у шва отступает от ребра на зазор и толщину']);}if(!CUR.N&&!$('tab-sum').hidden)ensureNest();
  // сгиб теперь проваривают по прорезям — длина по рёбрам модели, как «Сгибов»
  if(perfOn()&&CUR.BL&&CUR.BL.length){const at=rows.findIndex(r=>r[0]==='Длина швов')+1;rows.splice(at,0,['Проварка сгибов (по прорезям после гибки)',fmt(CUR.bendSt.len/1000,1)+' м']);}
  $('sum').innerHTML='<tbody>'+rows.map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')+'</tbody>';}

/* ---------- загрузка фигур и файлов ---------- */
function setBase(m,o={}){origLeave();owLeave();ST.base=m;SIMP={key:'',m:null};ST.sel=-1;ST.selB=-1;ST.name=o.name||ST.name;$('mName').value=ST.name;
  ST.faces=o.faces||(isDense()?250:m.F.length);if(o.dims)ST.dims=o.dims;else dimsFromH(o.H||600);ST.sv=ST.sp=-1;UNDO.length=REDO.length=0;ST.edit=false;$('cEdit').checked=false;if(m.P)setPolyDims();}
// Доберманам 4–6 сначала нужен models.js (figureReady); выбрали другую фигуру, пока грузился, — его onload ничего не строит
let FIG_WANT='';
function loadFigure(id,after){FIG_WANT=id;if(FIGURES[id].view){loadOrig(id);return;}if(FIGURES[id].ow){owLoad(id,after);return;}if(!figureReady(id,()=>{if(FIG_WANT===id)loadFigure(id,after);},()=>{if(FIG_WANT===id){loading(false);$('figSel').value=ST.fig||'';msg('Фигура не загрузилась — проверьте интернет и выберите её ещё раз');}})){loading(true,'Загружаю фигуру…');return;}
  later(()=>{const f=FIGURES[id];ST.fig=id;ST.verBase=id;ST.ver=0;ST.refId=f.ref||'';const htr=/trace=([a-z0-9_]+)/.exec(location.hash);ST.tref=htr?htr[1]:'';ST.frame=f.frame?{min:f.frame[0],max:f.frame[1]}:null;setBase(figureMesh(id,12),{name:f.name,faces:f.faces,H:f.H});const hn=/faces=(\d+)/.exec(location.hash),hd=/diss=(\d+)/.exec(location.hash);if(hn)ST.faces=+hn[1];if(hd)ST.diss=+hd[1];if(/edit/.test(location.hash)){ST.edit=true;$('cEdit').checked=true;}if(/trace/.test(location.hash)&&ST.refId)ST.traceUrl=true;if(ST.refId&&trOn())traceLoadFor(traceId());compute();renderAll('instant');store('shepherd-fig',id);msg('');const hv=/v=([a-z]+)/.exec(location.hash);if(hv)viewDir(hv[1],meshBox(CUR.M3.V),/og/.test(location.hash));if(after)after();},'Строю фигуру…');}
// файл фигуры .json (и версия из браузера — тот же JSON) → сетка и настройки
function figFromJSON(j,name){if(j.type!=='md-art')throw new Error('это не файл фигуры');ST.weld='mig';/* старые файлы без weld — полуавтомат, зазор из файла */const m=j.P?polyBase(j.V,j.P,j.S,Array.isArray(j.H)?j.H:[]):{V:j.V,F:j.F},o={name:j.name||name,dims:j.dims,faces:j.F.length,ref:j.ref,frame:j.frame};
  ['t','mat','sheet','sw','sl','cut','minW','weld','gap','useT','ngap','engrave','tpl','bend','perf','diss'].forEach(k=>{if(j[k]!==undefined)ST[k]=j[k];});
  // прорези: старый файл (perfL, perfStep, perfEdge) — размеры по умолчанию
  Object.entries(SLOT_KEYS).forEach(([k,d])=>{if(k in ST)ST[k]=j[k]!==undefined?j[k]:SLOT_DEF[d];});ST.ngapOwn=ST.ngap!==nestGap(ST.cut);metalUI();return {m,o};}
// показать открытое: калька берётся, только если файл фигуры-эталона уже загружен; ver — версия из браузера {base,n}, edit — вернуть режим правки
function finishOpen(m,o,ver,edit){if(!m.F.length)throw new Error('в файле нет граней');ST.tref='';ST.refId=o.ref&&typeof MODELS_POLY!=='undefined'&&MODELS_POLY[o.ref]?o.ref:'';ST.frame=o.frame?{min:o.frame[0],max:o.frame[1]}:null;ST.fig='';ST.verBase=ver?ver.base:'';ST.ver=ver?ver.n:0;
  $('figSel').value=ver?'ver:'+ver.base+':'+ver.n:'';setBase(m,o);if(edit){ST.edit=true;$('cEdit').checked=true;if(ST.refId&&trOn())traceLoadFor(traceId());}compute();renderAll('instant');}
// «Открыть модель» (#179): OBJ / GLB / STL — всегда оригинал для обводки (owFile, owork.js: гипс, перо, без расчёта), к OBJ — картинка текстуры вторым файлом; сохранённая фигура .json — как раньше
function openFile(files){files=[...files];const ext=f=>f.name.split('.').pop().toLowerCase(),mf=files.find(f=>OW_EXT.includes(ext(f))),pic=files.find(f=>OW_PIC.includes(ext(f)));
  if(mf){owFile(mf,pic);return;}const file=files.find(f=>ext(f)==='json')||files[0];if(!file)return;
  if(file===pic){msg('Картинка текстуры открывается вместе с моделью OBJ — выберите оба файла сразу');return;}const name=file.name.replace(/\.[^.]+$/,'');
  file.arrayBuffer().then(buf=>later(()=>{let m,o;
    if(ext(file)==='json'){const j=JSON.parse(new TextDecoder().decode(buf));if(j.ow){setTimeout(()=>owFromJSON(j));return;}({m,o}=figFromJSON(j,name));}   // ow — разметка оригинала для обводки (#176); после later — иначе он спрячет «Загружаю оригинал…»
    else throw new Error('нужен файл OBJ, STL, GLB или JSON');
    finishOpen(m,o);
    msg(`Открыто: ${m.F.length} ${plural(m.F.length,'треугольник','треугольника','треугольников')}${isDense()?' — упрощаю до '+ST.faces:''}`);},'Читаю модель…'));}
function figJSON(){if(OW.on)return owJSON();   // оригинал для обводки (#176): только разметка, без сетки
  const j={type:'md-art',v:1,name:ST.name,dims:ST.dims,t:ST.t,mat:ST.mat,sheet:ST.sheet,sw:ST.sw,sl:ST.sl,cut:ST.cut,minW:ST.minW,weld:ST.weld,gap:ST.gap,useT:ST.useT,ngap:ST.ngap,engrave:ST.engrave,tpl:ST.tpl,bend:ST.bend,perf:ST.perf,...Object.fromEntries(Object.keys(SLOT_KEYS).filter(k=>k in ST).map(k=>[k,ST[k]])),diss:0,
    V:CUR.M3.V.map(p=>p.map(x=>Math.round(x*100)/100)),F:CUR.M3.F};if(isPoly()){j.P=ST.base.P;j.S=ST.base.S||[];if(ST.base.H&&ST.base.H.length)j.H=ST.base.H;}   // H — отверстия (#154)
  if(ST.refId){j.ref=ST.refId;const fb=traceFrame();j.frame=[fb.min,fb.max].map(p=>p.map(x=>Math.round(x*100)/100));}
  if(typeof ST.mk!=='undefined')j.mk=ST.mk;   // разметка (если есть) — вместе с версией
  return j;}
/* ---------- оригинал (вид) (#146): фигура с view — только 3D модели Meshy, расчёта нет ----------
   Рабочая фигура view остаётся в памяти как была (правки, слои, разметка), оригинал рисуется поверх сцены; вернулись — всё на месте, камера та же.
   Нет рабочей фигуры (ссылка #f=shepherd5_orig) — сначала грузим её, потом открываем оригинал. */
function loadOrig(id){FIG_WANT=id;const f=FIGURES[id],run=()=>{if(CUR&&ST.verBase===f.view)later(()=>origEnter(id),'Открываю оригинал…');else loadFigure(f.view,()=>origEnter(id));};
  if(!figureReady(id,()=>{if(FIG_WANT===id)run();},()=>{if(FIG_WANT===id){loading(false);$('figSel').value=ST.orig?id:ST.ver?'ver:'+ST.verBase+':'+ST.ver:ST.fig||'';msg('Оригинал не загрузился — проверьте интернет и выберите его ещё раз');}})){loading(true,'Загружаю оригинал…');return;}
  run();}
function origEnter(id){const f=FIGURES[id],box=meshBox(CUR.M3.V),k=camKeep(box),back=ST.ver?'ver:'+ST.verBase+':'+ST.ver:ST.verBase,w=FIGURES[f.view].name;
  if('tool' in ST)ST.tool='';if(typeof mkCtl==='function')mkCtl();   // инструмент разметки выключается, сама разметка не трогается
  ST.orig={id,tex:$('cOrigTex').checked,back};document.body.classList.add('origview');$('origBox').hidden=false;$('bSave').disabled=true;
  origShow(f.orig,ST.orig.tex);camRestore(k,box);$('figSel').value=id;$('ttl').textContent=f.name;
  $('origNote').textContent='Это вид оригинала. Для расчёта выберите «'+w+'»';$('hint').textContent='Оригинал (вид): левая кнопка — крутить, колесо — масштаб, правая — сдвиг · галочка «Текстура» — швы или серый';msg('Это вид оригинала. Для расчёта выберите «'+w+'»');}
function origLeave(){if(!ST.orig)return;origDispose();ST.orig=null;document.body.classList.remove('origview');$('origBox').hidden=true;$('bSave').disabled=false;}
function origReturn(){const box=meshBox(CUR.M3.V),k=camKeep(box);$('figSel').value=ST.orig.back;origLeave();later(()=>{renderAll();camRestore(k,box);msg('');},'Возвращаю фигуру…');}
$('cOrigTex').addEventListener('change',e=>{if(OW.on){owRender();return;}if(!ST.orig)return;ST.orig.tex=e.target.checked;origTex(ST.orig.tex);});
/* ---------- версии фигуры в браузере (#148): «Сохранить» кладёт версию в память браузера и скачивает .json ---------- */
const VSTO={get:k=>localStorage.getItem(k),set:(k,v)=>localStorage.setItem(k,v)},verName=(b,n)=>((FIGURES[b]||{}).name||b)+'.'+n;   // нет памяти — бросает, verPut/verList это ловят
function verOptions(){const sel=$('figSel');sel.querySelectorAll('option[data-ver]').forEach(o=>o.remove());
  Object.keys(FIGURES).forEach(b=>{let at=[...sel.options].find(o=>o.value===b);if(!at)return;verList(VSTO,b).forEach(v=>{const o=document.createElement('option');o.value='ver:'+b+':'+v.n;o.dataset.ver=v.key;o.textContent=verName(b,v.n);at.after(o);at=o;});});}
function save(){if(ST.mkCur)mkFinish();const j=figJSON(),b=ST.verBase,r=b?verPut(VSTO,b,j):null,file=(ST.name||'figura')+(r&&r.n?'.'+r.n:'')+'.json';
  saveBlob(file,new Blob([JSON.stringify(j)],{type:'application/json'}));
  if(!r)return;if(r.err){msg('Версию в браузере сохранить не удалось — сохранён только файл');return;}
  ST.ver=r.n;if(Array.isArray(j.mk))store(mkKey(mkFig()),mkSave(j.mk));   // разметка едет в новую версию (ключ разметки — по версии), а не пропадает
  verOptions();$('figSel').value='ver:'+b+':'+r.n;msg(`Сохранено: «${verName(b,r.n)}» — в браузере и файлом ${file}`);}
function loadVersion(val){FIG_WANT=val;const [,base,n]=val.split(':'),back=()=>{$('figSel').value=ST.ver?'ver:'+ST.verBase+':'+ST.ver:ST.fig||'';},j=verGet(VSTO,verKey(base,+n));
  if(!j){msg('Эту версию не прочитать: в памяти браузера её нет');back();return;}
  if(j.ow){owVersion(j,base,+n);return;}   // версия оригинала для обводки (#176): фигура та же, разметка своя
  const go=()=>later(()=>{const {m,o}=figFromJSON(j,FIGURES[base]?FIGURES[base].name:base);const edit=ST.edit;finishOpen(m,o,{base,n:+n},edit);msg(`Открыта версия «${verName(base,+n)}»`);},'Открываю версию…'),
    rid=j.ref&&FIGURES[j.ref]?j.ref:base;
  if(!figureReady(rid,()=>{if(FIG_WANT===val)go();},()=>{if(FIG_WANT===val){loading(false);back();msg('Фигура не загрузилась — проверьте интернет и выберите версию ещё раз');}})){loading(true,'Загружаю фигуру…');return;}
  go();}

// скачать файл. Ссылку-blob держим минуту: Safari на iPad начинает загрузку не сразу, и через 2 с файл иногда уже «не найден»
const BLOB_TTL=60000;
function saveBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),BLOB_TTL);}
function metalUI(){$('sNGap').value=ST.ngap;$('cEngrave').checked=ST.engrave;$('cTpl').checked=!!ST.tpl;$('cBend').checked=!!ST.bend;$('sWeld').value=weldOf();$('sGap').value=ST.gap;$('cUseT').checked=ST.useT;$('sT').value=ST.t;$('sMat').value=ST.mat;$('sSheet').value=ST.sheet;$('sCut').value=ST.cut;$('sW').value=ST.sw;$('sL').value=ST.sl;$('ownSheet').hidden=ST.sheet!=='own';perfUI();}
// перфорация линий сгиба: только лазер и только с гибкой
// поля прорезей: id в панели → ключ ST → ключ SLOT_DEF (slots.js)
const SLOT_F=[['pW','slotW'],['pL','slotL'],['pBr','slotBr'],['pEl','slotEl'],['pEb','slotEb'],['pD','slotD']],SLOT_KEYS={slotW:'w',slotL:'len',slotBr:'br',slotEb:'eb',slotEl:'el',slotNotch:'notch',slotD:'D'};
function perfUI(){$('cPerf').checked=!!ST.perf;$('cNotch').checked=!!ST.slotNotch;SLOT_F.forEach(([id,k])=>{$(id).value=ST[k];});const pl=ST.cut==='plasma',nb=!ST.bend;$('cPerf').disabled=pl||nb;
  SLOT_F.forEach(([id])=>$(id).disabled=pl||nb||!ST.perf||id==='pEl'&&!ST.slotNotch);$('cNotch').disabled=pl||nb||!ST.perf;
  $('perfNote').innerHTML=pl?'Плазмой такие прорези не прорезать — только лазер':nb?'Прорези — на линиях сгиба: включите «Гнуть» в разделе «Металл»':ST.slotW<ST.t?'Ширина меньше толщины листа — лазер может не прорезать чисто, уточните у цеха':'Сквозные прорези по линиям V и m с короткими перемычками'+(ST.slotNotch?', крайние — до края детали':'')+(ST.slotD>0?', во внутренних углах — разгрузочное отверстие':'')+'. В DXF: прорези — слой PERF'+(ST.slotNotch||ST.slotD>0?', крайние и отверстия — в контуре CUT':'')+'; линии сгиба не гравируются; в метраже — отдельной строкой';}

/* ---------- события ---------- */
let RT=0;const recalc=(fit,heavy)=>{clearTimeout(RT);RT=setTimeout(()=>heavy?later(()=>{compute();renderAll(fit);}):(compute(),renderAll(fit)),heavy?150:60);};
$('figSel').addEventListener('change',e=>{const v=e.target.value;if(!v)return;if(ST.orig&&v===ST.orig.back){origReturn();return;}if(v.startsWith('ver:'))loadVersion(v);else loadFigure(v);});
$('bOpen').addEventListener('click',()=>$('fileIn').click());
$('fileIn').addEventListener('change',e=>{if(e.target.files.length)openFile(e.target.files);e.target.value='';});   // #179: несколько файлов — модель и картинка текстуры
$('bSave').addEventListener('click',save);
$('mName').addEventListener('input',e=>{ST.name=e.target.value;$('ttl').textContent=ST.name||'Фигура';label3D();});
['H','W','D'].forEach(k=>$('d'+k).addEventListener('change',e=>{const v=Math.max(50,+e.target.value||0);
  if(ST.prop){const r=v/ST.dims[k];['H','W','D'].forEach(q=>ST.dims[q]=Math.round(ST.dims[q]*r));}ST.dims[k]=v;if(isPoly()){pushUndo();setPolyDims();}recalc(true);}));
$('cProp').addEventListener('change',e=>{ST.prop=e.target.checked;});
$('bReset').addEventListener('click',()=>{if(isPoly()){syncDims();msg('Модель из граней — пропорции уже её собственные');return;}dimsFromH(ST.dims.H);recalc(true);});
$('fRng').addEventListener('input',e=>{ST.faces=+e.target.value;$('fVal').textContent=ST.faces;recalc(false,true);});
$('dRng').addEventListener('input',e=>{ST.diss=+e.target.value;$('dVal').textContent=ST.diss?ST.diss+'°':'нет';recalc(false,true);});
$('minW').addEventListener('change',e=>{ST.minW=Math.max(0,+e.target.value||0);recalc();});
$('cSmall').addEventListener('change',e=>{ST.small=e.target.checked;renderAll();});
$('cNums').addEventListener('change',e=>{ST.nums=e.target.checked;renderAll();});
document.querySelectorAll('.rot [data-r]').forEach(b=>b.addEventListener('click',()=>{const ax=b.dataset.r,H=ST.dims.H;
  const RV=ST.base.V.map(([x,y,z])=>ax==='x'?[x,-z,y]:ax==='y'?[z,y,-x]:[-y,x,z]);if(isPoly()){pushUndo();ST.base=polyBase(RV,ST.base.P,ST.base.S,ST.base.H);syncDims();setPolyDims();}else{ST.base={V:RV,F:ST.base.F};SIMP={key:'',m:null};dimsFromH(H);}later(()=>{compute();renderAll(true);});}));
$('sT').addEventListener('change',e=>{const t=+e.target.value;ST.gap=gapAfterT(ST.gap,weldOf(),ST.t,t);ST.t=t;$('sGap').value=ST.gap;perfUI();recalc();});
$('sWeld').addEventListener('change',e=>{ST.weld=e.target.value;ST.gap=weldGap(ST.weld,ST.t);$('sGap').value=ST.gap;recalc();});
$('sMat').addEventListener('change',e=>{ST.mat=e.target.value;recalc();});
$('sSheet').addEventListener('change',e=>{ST.sheet=e.target.value;$('ownSheet').hidden=ST.sheet!=='own';recalc();});
['sW','sL'].forEach(k=>$(k).addEventListener('change',e=>{ST[k==='sW'?'sw':'sl']=Math.max(100,+e.target.value||0);recalc();}));
$('sCut').addEventListener('change',e=>{ST.cut=e.target.value;ST.minW=ST.cut==='laser'?15:30;ST.ngap=ngapAfterCut(ST.ngap,ST.ngapOwn,ST.cut);$('sNGap').value=ST.ngap;perfUI();recalc();});
$('cPerf').addEventListener('change',e=>{ST.perf=e.target.checked;perfUI();recalc();});
// пределы: прорезь 1–10 мм, шаг не меньше прорези + 3, от края не меньше 3
// ширина и перемычки — не меньше 0,5 мм, прорезь — не короче ширины; ширина меньше толщины можно (только подсказка)
const perfFix=()=>{const n=(v,d)=>Number.isFinite(+v)&&+v>0?+v:d;ST.slotW=Math.max(.5,n(ST.slotW,2));ST.slotL=Math.max(ST.slotW,n(ST.slotL,40));ST.slotBr=Math.max(.5,n(ST.slotBr,3));ST.slotEl=Math.max(ST.slotW,n(ST.slotEl,5));ST.slotD=Math.max(0,Number.isFinite(+ST.slotD)?+ST.slotD:3);ST.slotEb=Math.max(.5,n(ST.slotEb,3));perfUI();recalc();};
SLOT_F.forEach(([id,k])=>$(id).addEventListener('change',e=>{ST[k]=+e.target.value;perfFix();}));
$('cNotch').addEventListener('change',e=>{ST.slotNotch=e.target.checked;perfUI();recalc();});
// клик по модели: строку таблицы — в видимую часть её собственной прокрутки (если она есть); страницу не трогаем
function revealRow(tr){for(let el=tr&&tr.parentElement;el&&el!==document.body;el=el.parentElement){const oy=getComputedStyle(el).overflowY;if((oy!=='auto'&&oy!=='scroll')||el.scrollHeight<=el.clientHeight)continue;
  const r=tr.getBoundingClientRect(),b=el.getBoundingClientRect();if(r.top<b.top)el.scrollTop+=r.top-b.top;else if(r.bottom>b.bottom)el.scrollTop+=r.bottom-b.bottom;return;}}
// клик по строке таблицы: открыть «Вид» и плавно показать эскиз детали; на телефоне шторку не открываем — ведём страницу к модели
function showSel(){const sb=$('selBox'),bh=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';$('controls').querySelector('[data-g="view"]').classList.remove('shut');
  if(getComputedStyle($('drawerBtn')).display==='none'){sb.scrollIntoView({behavior:bh,block:'nearest'});return;}
  drawer(false);$('stage').scrollIntoView({behavior:bh,block:'start'});}
$('parts').addEventListener('click',e=>{const tb=e.target.closest('tr[data-b]'),tr=e.target.closest('tr[data-p]');if(!tb&&!tr)return;
  // заготовка: подсветить целиком, камера — на неё (средняя точка и нормаль по площади)
  if(tb){const b=CUR.BL[+tb.dataset.b];ST.selB=+tb.dataset.b;ST.sel=-1;renderAll();const ps=b.parts.map(i=>CUR.R.parts[i]),A=ps.reduce((s,p)=>s+p.area,0);
    focusPart({c:V3.mul(ps.reduce((s,p)=>V3.add(s,V3.mul(p.c,p.area)),[0,0,0]),1/A),n:V3.norm(ps.reduce((s,p)=>V3.add(s,V3.mul(p.n,p.area)),[0,0,0])),L:b.L,W:b.W},meshBox(CUR.M3.V));}
  else{ST.sel=+tr.dataset.p;ST.selB=-1;renderAll();focusPart(CUR.R.parts[ST.sel],meshBox(CUR.M3.V));showSel();return;}
  $('controls').querySelector('[data-g="view"]').classList.remove('shut');});
$('partsVw').addEventListener('click',e=>{const b=e.target.closest('[data-vw]');if(!b)return;ST.allParts=b.dataset.vw==='parts';partsTable();});
// габарит того, что на сцене: оригинал для обводки (#175) или рабочая фигура
const figBox=()=>OW.on?OW.box:CUR?meshBox(CUR.M3.V):null;
document.querySelectorAll('.vbar [data-v]').forEach(b=>b.addEventListener('click',()=>{const bx=figBox();if(bx)viewDir(b.dataset.v,bx);}));
$('bFit').addEventListener('click',()=>{const bx=figBox();if(bx)fitBox(bx);});
// вкладки и группы панели
const TABS=[...document.querySelectorAll('.tabbar button')];
function showTab(k){TABS.forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;$('tab-'+b.dataset.tab).hidden=!on;});store('art-tab',k);if(k==='sum'&&CUR)sumTable();}
TABS.forEach((b,i)=>{b.addEventListener('click',()=>showTab(b.dataset.tab));
  b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;const n=TABS[(i+d+TABS.length)%TABS.length];n.focus();showTab(n.dataset.tab);});});// страница всегда открывается на «Деталях»: запомненная вкладка (art-tab) старт не определяет, иначе тяжёлый расчёт «Чертежей»/«Раскроя» вешает загрузку
showTab('parts');
// внутренние вкладки «Лазер · DXF»: Лазер | Гильотина; каждая открывает свою панель #sub-<data-sub>, выбор не запоминается
document.querySelectorAll('.subtabs').forEach(bar=>{const bs=[...bar.querySelectorAll(':scope>[role=tab]')];
  const show=k=>bs.forEach(b=>{const on=b.dataset.sub===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;$('sub-'+b.dataset.sub).hidden=!on;});
  bs.forEach((b,i)=>{b.addEventListener('click',()=>show(b.dataset.sub));
    b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;const n=bs[(i+d+bs.length)%bs.length];n.focus();show(n.dataset.sub);});});});
document.querySelectorAll('.controls .grp').forEach(g=>{const t=g.querySelector('.gt');if(t)t.addEventListener('click',()=>g.classList.toggle('shut'));});   // у блока «оригинал (вид)» заголовка нет
function drawer(o){const bt=$('drawerBtn');$('controls').classList.toggle('open',o);bt.setAttribute('aria-expanded',String(o));bt.textContent=o?'Готово':'Панель';}
$('drawerBtn').addEventListener('click',()=>drawer(!$('controls').classList.contains('open')));$('drawerClose').addEventListener('click',()=>drawer(false));
/* ---------- раскрой, чертежи, карты: только по кнопке «Рассчитать» (editor/common/calc.js), как в мангале ----------
   Открытие вкладки ничего не считает. Результат держится, пока не поменялся ключ задания (calcKeyOf): правка фигуры, точек, толщины и т. п. его убирает,
   смена вкладки и вида 3D — нет. «Чертежи» сами запускают раскрой, если его нет (раскрой листа входит в комплект всегда) */
let SHEETS_LIST=[],CARDS_LIST=[];
const figs=(L,id)=>L.map((s,i)=>`<figure class="sheet" id="${id}${i+1}"><figcaption>Лист ${i+1} из ${L.length} · ${esc(s.title)}</figcaption>${s.svg}</figure>`).join('');
const goBar=(L,id,what,msg)=>`<div class="dimbar"><select id="${id}Go" aria-label="Перейти к ${what}">${L.map((s,i)=>`<option value="${id}${i+1}">${what==='листу'?'Лист':'Карта'} ${i+1} · ${esc(s.title)}</option>`).join('')}</select>${msg?`<span class="dxfmsg">${msg}</span>`:''}</div>`;
function nestHtml(){const L=sheetsNest(),d=new Date(),date=d.toLocaleDateString('ru-RU'),s0=CUR.N.sheets[0];
  return `<p class="dxfmsg">Листов: ${CUR.N.sheets.length} · ${itemsTxt(CUR.N.sheets.flatMap(s=>s.items))} · зазор ${ST.ngap} мм${s0?` · плотность ${Math.round(s0.dense*100)}% в полосе с деталями ${sheetWL()[1]} × ${Math.round(s0.len)} мм, остальное свободно`:''} · ${cutTxt(cutStats(CUR.N.sheets.flatMap(s=>s.items)))}${CUR.degen?' · выродились: '+CUR.degen:''}</p>`
    +L.map((b,i)=>`<figure class="sheet"><figcaption>Раскрой ${i+1} из ${L.length}</figcaption>${wrapSheet(b,{n:i+1,N:L.length,date})}</figure>`).join('');}
const CALCS=[];
const calcFor=(ids,key,run)=>{const c=makeCalc({btn:$(ids.run),box:$(ids.box),save:$(ids.save),wait:$(ids.wait),key,run});CALCS.push(c);return c;};
const failAll=()=>{nestCnt('');CALCS.forEach(c=>c.stale());};
// «Лазер · DXF»: раскладка (ensureNest — кусками по ~60 мс), потом рисунки
const NEST_CALC=calcFor({run:'nestRun',box:'nestBox',save:'bDxfNest',wait:'nestWait'},()=>CALC_KEY,(done,live)=>ensureNest(()=>setTimeout(()=>{if(!live())return;
  try{done(nestHtml());}catch(e){failAll();throw e;}},0)));
// «Чертежи»: раскрой — свой, если ещё не считали (ensureNest), потом комплект одним куском после отрисовки «Считаю…»
const SHEETS_CALC=calcFor({run:'shRun',box:'sheets',save:'shPdf',wait:'shWait'},()=>CALC_KEY,(done,live)=>ensureNest(()=>setTimeout(()=>{if(!live())return;
  try{const sh=buildSheets();if(done(goBar(sh,'sh','листу')+figs(sh,'sheet')))SHEETS_LIST=sh;}catch(e){failAll();throw e;}},0)));
// «Карты»: раскладка не нужна, считаются по одной
const CARDS_CALC=calcFor({run:'cdRun',box:'cards',save:'shCards',wait:'cdWait'},()=>CALC_KEY,(done,live)=>{const g=buildCardsGen();$('cdCnt').textContent='';
  const step=()=>{if(!live())return;const t0=performance.now();let v;
    try{do{v=g.next();}while(!v.done&&performance.now()-t0<60);
      if(!v.done){$('cdCnt').textContent=`· ${v.value.what} ${v.value.done} из ${v.value.of}`;setTimeout(step,0);return;}
      const cd=v.value;$('cdCnt').textContent='';if(done(goBar(cd,'cd','карте',cd.length?`Карт: ${cd.length} · позиций на резку: ${CUR.PC.length}`:'')+figs(cd,'card')))CARDS_LIST=cd;}
    catch(e){$('cdCnt').textContent='';failAll();throw e;}};
  setTimeout(step,50);});
// правка: через 0,5 с (ползунки не дёргаем) ключ каждого расчёта сверяется с ключом его результата; другой — результат убран, «Рассчитать» активна
let CALC_T=0;
function sheetsUI(){clearTimeout(CALC_T);if(!CUR)return;CALC_T=setTimeout(()=>CALCS.forEach(c=>c.check()),500);}
// «Перейти к листу / карте» — внутри результата
['sheets','cards'].forEach(id=>$(id).addEventListener('change',e=>{const t=e.target;if(!t.matches||!t.matches('select'))return;const el=$(t.value);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}));
/* ---------- лист крупно: клик по листу раскроя или чертежа — на весь экран; колесо или + − — масштаб, тянуть — двигать, Esc — закрыть ---------- */
const ZM={k:1};
function zoomSet(k,cx,cy){const box=$('zoomBox'),s=box.querySelector('svg');if(!s)return;const r=box.getBoundingClientRect(),px=cx??r.width/2,py=cy??r.height/2,fx=(box.scrollLeft+px)/s.clientWidth,fy=(box.scrollTop+py)/s.clientHeight;
  ZM.k=Math.max(1,Math.min(12,k));s.style.width=(ZM.k*(r.width||innerWidth)-4)+'px';$('zoomK').textContent=Math.round(ZM.k*100)+'%';box.scrollLeft=fx*s.clientWidth-px;box.scrollTop=fy*s.clientHeight-py;}
// fx, fy — куда кликнули (доля ширины и высоты листа): это место — в середине экрана
function zoomOpen(svg,title,fx=.5,fy=.5){const z=$('zoom');$('zoomTtl').textContent=title||'';const c=svg.cloneNode(true),tl=c.querySelector('title');c.removeAttribute('width');c.removeAttribute('height');if(tl){tl.id+='z';c.setAttribute('aria-labelledby',tl.id);}$('zoomBox').replaceChildren(c);z.hidden=false;document.body.classList.add('noscroll');ZM.k=1;zoomSet(1);
  const box=$('zoomBox'),r=box.getBoundingClientRect();zoomSet(3,fx*c.clientWidth-box.scrollLeft,fy*c.clientHeight-box.scrollTop);box.scrollLeft=fx*c.clientWidth-r.width/2;box.scrollTop=fy*c.clientHeight-r.height/2;}
function zoomClose(){$('zoom').hidden=true;$('zoomBox').replaceChildren();document.body.classList.remove('noscroll');}
// снимок сгиба (карта, лист «Гибка») — крутить сгиб в 3D (bend3d.js); остальное — лист крупно
['nestBox','sheets','cards'].forEach(id=>$(id).addEventListener('click',e=>{const im=e.target.closest('image.bsh[data-b]');if(im){bwOpen(+im.getAttribute('data-b'),+im.getAttribute('data-k'));return;}const f=e.target.closest('figure.sheet'),s=f&&f.querySelector('svg');if(!s)return;const r=s.getBoundingClientRect();zoomOpen(s,f.querySelector('figcaption')?.textContent,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);}));
$('zoomIn').addEventListener('click',()=>zoomSet(ZM.k*1.5));$('zoomOut').addEventListener('click',()=>zoomSet(ZM.k/1.5));$('zoomFit').addEventListener('click',()=>zoomSet(1));$('zoomX').addEventListener('click',zoomClose);
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('zoom').hidden)zoomClose();});
$('zoomBox').addEventListener('wheel',e=>{e.preventDefault();const r=$('zoomBox').getBoundingClientRect();zoomSet(ZM.k*(e.deltaY<0?1.2:1/1.2),e.clientX-r.left,e.clientY-r.top);},{passive:false});
(()=>{const box=$('zoomBox');let d=null;box.addEventListener('pointerdown',e=>{d={x:e.clientX,y:e.clientY,l:box.scrollLeft,t:box.scrollTop};box.setPointerCapture(e.pointerId);box.classList.add('drag');});
  box.addEventListener('pointermove',e=>{if(!d)return;box.scrollLeft=d.l-(e.clientX-d.x);box.scrollTop=d.t-(e.clientY-d.y);});
  ['pointerup','pointercancel'].forEach(t=>box.addEventListener(t,()=>{d=null;box.classList.remove('drag');}));})();
// на листе крупно — тоже: тап по снимку сгиба без сдвига (лист тянут — не открываем); цель — по точке: при захвате указателя click приходит в само окно
(()=>{const box=$('zoomBox');let p0=null;box.addEventListener('pointerdown',e=>{p0=[e.clientX,e.clientY];});
  box.addEventListener('click',e=>{if(!p0||Math.hypot(e.clientX-p0[0],e.clientY-p0[1])>6)return;const el=document.elementFromPoint(e.clientX,e.clientY),im=el&&el.closest&&el.closest('image.bsh[data-b]');if(im)bwOpen(+im.getAttribute('data-b'),+im.getAttribute('data-k'));});})();
// печать листов: А3 альбомная или А4 книжная — размер страницы задаём на время печати (один PDF с А3 и А4 вперемешку браузеры печатают ненадёжно)
function printSvgs(L,what,a4){const pb=$('printBox'),pg=document.createElement('style');pb.innerHTML=L.join('');pb.classList.toggle('a4',!!a4);pg.textContent=`@media print{@page{size:${a4?'A4 portrait':'A3 landscape'};margin:0}}`;document.head.appendChild(pg);
  const t=document.title;document.title=(ST.name||'Фигура')+' — '+what;const done=()=>{document.title=t;pb.innerHTML='';pg.remove();removeEventListener('afterprint',done);};addEventListener('afterprint',done);window.print();}
// PDF — только готовые листы, и только свежие: правка могла быть меньше 0,5 с назад
$('shPdf').addEventListener('click',()=>{SHEETS_CALC.check();if(SHEETS_CALC.ready()&&SHEETS_LIST.length)printSvgs(SHEETS_LIST.map(s=>s.svg),'чертежи');});
$('shCards').addEventListener('click',()=>{CARDS_CALC.check();if(CARDS_CALC.ready()&&CARDS_LIST.length)printSvgs(CARDS_LIST.map(s=>s.svg),'карты деталей',true);});
function dl(name,text){saveBlob(name,new Blob([text],{type:'application/dxf'}));}
const fname=()=>(ST.name||'figura').replace(/[\/:*?"<>|]+/g,'').trim()+`_${MATN[ST.mat]||ST.mat}_${ST.t}mm`;   // «Доберман 9_сталь_2mm_raskroy.dxf» — цех сразу видит материал и толщину
$('bDxfNest').addEventListener('click',()=>{NEST_CALC.check();if(CUR&&CUR.N&&NEST_CALC.ready())dl(fname()+(weldOf()==='tig'?'_N2':'')+'_raskroy.dxf',dxfNest());});
$('bDxfParts').addEventListener('click',()=>CUR&&dl(fname()+(weldOf()==='tig'?'_N2':'')+'_detali.dxf',dxfParts()));
$('sGap').addEventListener('change',e=>{ST.gap=Math.max(0,+e.target.value||0);recalc();});
$('cUseT').addEventListener('change',e=>{ST.useT=e.target.checked;recalc();});
$('sNGap').addEventListener('change',e=>{ST.ngap=Math.max(1,+e.target.value||nestGap(ST.cut));ST.ngapOwn=true;recalc();});   // поменяли руками — смена резки его больше не трогает
$('cEngrave').addEventListener('change',e=>{ST.engrave=e.target.checked;recalc();});
$('cTpl').addEventListener('change',e=>{ST.tpl=e.target.checked;recalc();});
$('cBend').addEventListener('change',e=>{ST.bend=e.target.checked;ST.allParts=false;ST.selB=-1;perfUI();recalc();});

/* ---------- редактор ---------- */
const UNDO=[],REDO=[];
// снимок для «Отменить»; mk — разметка (только у «Нарезать», #152: отмена возвращает и фигуру, и применённые штрихи)
function snapE(mk){const b={V:ST.base.V,P:ST.base.P,S:ST.base.S||[],H:ST.base.H||[]};return JSON.stringify(mk?{...b,mk:JSON.parse(mkSave(ST.mk))}:b);}
function mkSet(mk){ST.mk=mkLoad(JSON.stringify(mk));ST.mkCur=null;mkReset();mkStore();}   // разметка подменена целиком — старые шаги отмены (#180) к ней не относятся
function pushUndo(){if(!isPoly())return;UNDO.push(snapE());if(UNDO.length>60)UNDO.shift();REDO.length=0;}
function applyE(e,keepSel){ST.base=polyBase(e.V,e.P,e.S,e.H);syncDims();if(!keepSel){ST.sp=-1;ST.sp2=-1;ST.sv=-1;ST.sel=-1;ST.seam=null;}compute();renderAll();}
function undo(){if(!UNDO.length)return;const s=JSON.parse(UNDO.pop());REDO.push(snapE(!!s.mk));if(s.mk)mkSet(s.mk);applyE(s);}
function redo(){if(!REDO.length)return;const s=JSON.parse(REDO.pop());UNDO.push(snapE(!!s.mk));if(s.mk)mkSet(s.mk);applyE(s);}
// перейти в редактор: любая модель становится набором граней-деталей в мм
function toPoly(){if(isPoly())return;const R=CUR.R,V=CUR.M3.V.map(p=>p.slice());ST.base=polyBase(V,R.parts.map(p=>p.full.slice()));ST.fig='';$('figSel').value='';syncDims();
  msg('Модель переведена в грани — теперь правится вручную');}
function edUI(){const on=ST.edit&&isPoly();$('hint').textContent=on?(ST.seam?'Провести шов: кликните 2 угла выбранной грани или место на её ребре (там встанет новая точка) · Esc — отмена':(ST.layers.verts?'Точку — тянуть мышкой · ':'Точки углов — галочка «Точки углов» · ')+'клик по грани — выбрать, Shift+клик — вторая грань · Delete — удалить грань · '+(ST.tool?'Ctrl+Z — убрать штрих разметки':'Ctrl+Z — отменить')):'Клик по грани — деталь · колесо — масштаб · правая кнопка — сдвиг';$('edBox').hidden=!ST.edit;stage.classList.toggle('editing',on);if(!ST.edit)return;
  const B=ST.base;let h='<p class="note">Кликните точку или грань на модели</p>';
  if(ST.sv>=0&&B.V[ST.sv]){const p=B.V[ST.sv];h=`<b>Точка</b> — тяните мышкой или введите координаты, мм<div class="xyz3"><label>X<input class="inp" id="vX" type="number" value="${Math.round(p[0])}"></label><label>Y<input class="inp" id="vY" type="number" value="${Math.round(p[1])}"></label><label>Z<input class="inp" id="vZ" type="number" value="${Math.round(p[2])}"></label></div>`;}
  else if(ST.sp>=0&&ST.sp2>=0&&B.P[ST.sp2])h=polysAdjacent(B,ST.sp,ST.sp2)?'<b>Две грани</b> — «Убрать шов» сольёт их в одну':'<b>Две грани</b> — они не соседние, слить нельзя';
  else if(ST.sp>=0&&B.P[ST.sp]){const Q=B.P[ST.sp],dev=polyDev(B.V,Q);h=`<b>Грань</b> — ${Q.length} ${plural(Q.length,'угол','угла','углов')}${Q.length>4?' (многоугольник)':''}${dev>1.5?', <span class="bad">неплоская на '+Math.round(dev)+' мм</span>':''}${CUR&&CUR.pierce&&CUR.pierce.has(ST.sp)?', <span class="prc">протыкает другую грань</span>':''}`;}
  if(ST.seam)h=`<b>Провести шов</b> — выбрано точек: ${ST.seam.length} из 2`;$('edSel').innerHTML=h;$('edOps').querySelectorAll('button').forEach(b=>b.classList.toggle('off',ST.sp<0));
  $('edOps').querySelector('[data-op=merge]').classList.toggle('off',!(ST.sp>=0&&ST.sp2>=0&&polysAdjacent(B,ST.sp,ST.sp2)));$('edOps').querySelector('[data-op=cut]').classList.toggle('on',!!ST.seam);
  const n=CUR&&CUR.bad?CUR.bad.size:0,nx=CUR&&CUR.selfx?CUR.selfx.size:0,nw=CUR&&CUR.small?CUR.small.size:0,np=CUR&&CUR.pierce?CUR.pierce.size:0;$('edPlan').className='note'+(n||nx||nw||np?' warn':'');$('edPlan').textContent=(np?`${np} ${plural(np,'грань протыкает','грани протыкают','граней протыкают')} другие — фиолетовые: детали прошли бы друг сквозь друга, отодвиньте точки. `:'')+(nx?`Самопересекающихся граней: ${nx} — синие, разрежьте их «Провести шов». `:'')+(nw?`Узких деталей: ${nw} — красные. `:'')+(n?`Неплоских граней: ${n} — подсвечены жёлтым. Плоский лист так не согнёшь: выровняйте (точки сдвинутся на миллиметры) или разбейте на треугольники`:'Все грани плоские — каждая режется одним куском');
  ['bFlat','bTri'].forEach(id=>$(id).classList.toggle('off',!n));$('bUndo').classList.toggle('off',!UNDO.length);$('bRedo').classList.toggle('off',!REDO.length);}
$('cEdit').addEventListener('change',e=>{ST.edit=e.target.checked;if(OW.on){renderAll();return;}if(ST.edit&&CUR){toPoly();compute();}if(ST.edit&&ST.refId&&trOn())traceLoadFor(traceId());renderAll();});
$('cSym').addEventListener('change',e=>{ST.sym=e.target.checked;if(ST.mk.length||ST.mkCur)renderAll();});   // зеркальная разметка видна сразу
$('edSel').addEventListener('change',e=>{if(ST.sv<0||!['vX','vY','vZ'].includes(e.target.id))return;pushUndo();const e2={V:ST.base.V.map(p=>p.slice()),P:ST.base.P};
  moveVert(e2,ST.sv,[+$('vX').value,+$('vY').value,+$('vZ').value],ST.sym);applyE(e2,true);});
$('edOps').addEventListener('click',e=>{const b=e.target.closest('button[data-op]');if(!b)return;if(ST.sp<0){msg('Сначала кликните грань на модели');return;}if(b.dataset.op==='merge'&&b.classList.contains('off')){msg('Для «Убрать шов» кликните грань, потом Shift+клик по соседней');return;}const d=Math.max(1,+$('edD').value||0),op=b.dataset.op;
  if(op==='cut'){ST.seam=ST.seam?null:[];ST.sv=-1;renderAll();return;}
  if(op==='merge'){const r=mergePolys(E(),ST.sp,ST.sp2,ST.sym);if(!r){msg('Эти грани не слить: нет общего шва или он из нескольких отрезков');return;}pushUndo();applyE(r);msg('Шов убран, грани выровнены');return;}
  pushUndo();
  const r={extrude:()=>extrude(E(),ST.sp,d,ST.sym),inset:()=>extrude(E(),ST.sp,-d,ST.sym),bump:()=>poke(E(),ST.sp,d,ST.sym),pit:()=>poke(E(),ST.sp,-d,ST.sym),split:()=>splitPoly(E(),ST.sp,ST.sym),del:()=>delPoly(E(),ST.sp,ST.sym)}[op]();applyE(r);});
$('bFlat').addEventListener('click',()=>{if($('bFlat').classList.contains('off'))return;pushUndo();applyE(flattenAll(E(),ST.sym),true);});
$('bTri').addEventListener('click',()=>{if($('bTri').classList.contains('off'))return;pushUndo();applyE(triangulateBad(E(),1.5));});
$('bUndo').addEventListener('click',undo);$('bRedo').addEventListener('click',redo);
$('bBlank').addEventListener('click',()=>{const k=$('blank').value,b=k==='box'?blankBox():blankSphere();ST.fig='';$('figSel').value='';
  ST.verBase='';ST.ver=0;const m=polyBase(b.V,b.P),s=meshBox(m.V).size;setBase(m,{name:k==='box'?'Заготовка — куб':'Заготовка — шар',dims:{W:Math.round(s[0]),H:Math.round(s[1]),D:Math.round(s[2])}});
  ST.edit=true;$('cEdit').checked=true;compute();renderAll('instant');});
addEventListener('keydown',e=>{if(!ST.edit||ST.orig||OW.on||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(mkUndoKey(e)&&mkUndoOn())return;const k=e.key.toLowerCase();   // выбран инструмент разметки — Ctrl+Z по разметке (#180), форма не трогается
  if((e.ctrlKey||e.metaKey)&&(k==='z'||k==='я')&&!e.shiftKey){e.preventDefault();undo();}else if((e.ctrlKey||e.metaKey)&&(k==='y'||k==='н'||k==='z'&&e.shiftKey)){e.preventDefault();redo();}
  else if(k==='delete'&&ST.sp>=0){pushUndo();applyE(delPoly(E(),ST.sp,ST.sym));}
  else if(k==='escape'&&ST.seam){ST.seam=null;renderAll();}});
// провести шов: точка выбрана; две — режем грань
function addCut(v){if(!ST.seam||ST.sp<0)return;if(!ST.seam.includes(v))ST.seam.push(v);
  if(ST.seam.length===2){const r=cutPoly(E(),ST.sp,ST.seam[0],ST.seam[1],ST.sym);if(r){pushUndo();applyE(r);msg('Шов проведён');return;}msg('Между этими точками уже есть край грани — выберите несоседние');ST.seam=[];}renderAll();}
// калька: облако эталона (js/trace-<id>.js, грузится по галочке) → атлас на наши грани; пересчёт, только когда меняется форма
const TRC={id:'',t:null,b0:null,key:'',at:null,loading:false};
// какая калька: у фигуры может быть несколько (FIGURES[ref].refs, #142 Овчарка 5) — все в кадре фигуры ST.refId; ST.tref — выбранная, '' — первая в списке (#149), без списка — основная
function traceId(){const R=(FIGURES[ST.refId]||{}).refs;return ST.tref&&R&&R.some(r=>r[0]===ST.tref)?ST.tref:R&&R.length?R[0][0]:ST.refId;}
// калька без облака (только линии, «форма оригинала»): сверки нет
const traceNoCloud=()=>TRC.id===traceId()&&!!TRC.L&&!TRC.t;
// слои (#145): калька включена галочкой в мастерской или ссылкой &trace; точки углов видны по галочке и пока идёт «Провести шов» (там по ним кликают)
const trOn=()=>!!(ST.traceUrl||ST.layers.trace&&ST.edit),vertsShown=()=>ST.layers.verts||!!ST.seam;
function traceOn(){return !!(trOn()&&ST.refId&&TRC.id===traceId()&&(TRC.t||TRC.L)&&CUR&&isPoly());}
// рамка кальки: габарит эталона в координатах фигуры (у правленой копии — её исходный габарит, ST.frame), иначе — габарит самой фигуры
function traceFrame(){const pb=meshBox(CUR.M3.V);if(!ST.frame)return pb;const rb=meshBox(ST.base.V),m=p=>p.map((x,k)=>(x-rb.min[k])*pb.size[k]/(rb.size[k]||1)+pb.min[k]),min=m(ST.frame.min),max=m(ST.frame.max);return {min,max,size:max.map((x,k)=>x-min[k])};}
function traceMapNow(){return traceMap(TRC.b0,traceFrame());}
// #147: у кальки с линиями (TRC.L, TRACE_L.<id>) поверхность не красим — белые линии TRC.seg поверх граней; облако остаётся для подсказок сверки (TRC.diff).
// калька без линий (Овчарка 3) — как раньше, атлас на гранях
function traceTex(){if(!traceOn())return null;traceUpd();return TRC.L?null:TRC.at;}
function traceSeg(){if(!traceOn()||!TRC.L)return null;traceUpd();return TRC.seg;}
function traceUpd(){const {V,P}=ST.base;let h=V.length*31+P.length;V.forEach((p,i)=>{h+=(p[0]*1.3+p[1]*2.7+p[2]*3.1)*((i%7)+1);});P.forEach(Q=>{h+=Q.length*17+Q[0];});(ST.base.S||[]).forEach(e=>{h+=e[0]*.7+e[1]*1.9;});const key=h.toFixed(3);
  // пока тянут точку — старый рисунок (те же треугольники / те же линии), пересчёт после отпускания
  if(TRC.key!==key&&ST.drag&&(TRC.L?TRC.seg:TRC.at&&TRC.at.uv.length===ST.base.F.length*6))return;
  if(TRC.key!==key){const t0=performance.now();const mp=traceMapNow();if(TRC.L){TRC.seg=tlinesOnFigure(TRC.L,mp,V,P,12,ST.base);TRC.at=null;}else TRC.at=traceAtlas(V,P,ST.base.F,ST.base.T,mp,TRC.t);
    TRC.diff=TRC.t?traceDiff(CUR.R.edges,V,ST.base.F,mp,TRC.t):null;TRC.key=key;if(!TRC.logged){TRC.logged=1;console.log(TRC.L?'калька: линии '+TRC.L.n+', на фигуре '+Math.round(TRC.seg.drawn*100)+' %':'калька: атлас '+TRC.at.W+'×'+TRC.at.H,Math.round(performance.now()-t0)+' мс');}}}
function layersUI(){$('cLEdges').checked=ST.layers.edges;$('cLVerts').checked=ST.layers.verts;}
function traceUI(){$('traceRow').hidden=!ST.refId;$('cTrace').checked=trOn();$('diffRow').hidden=!ST.refId;$('cDiff').checked=ST.layers.diff;$('cDiff').disabled=!trOn()||traceNoCloud();$('diffNo').hidden=!(trOn()&&traceNoCloud());const R=ST.refId&&(FIGURES[ST.refId]||{}).refs,ts=$('traceSel');ts.hidden=!(R&&trOn());
  if(R){const h=R.map(r=>`<option value="${r[0]}">Калька ${r[1]}</option>`).join('');if(ts.innerHTML!==h)ts.innerHTML=h;ts.value=traceId();}const d=ST.edit&&traceOn()&&ST.layers.diff?TRC.diff:null,el=$('edTrace');el.hidden=!d;if(!d)return;
  el.innerHTML=`Сверка с калькой: на шве эталона ${Math.round(d.on*100)}% длины наших швов, рядом (до ${TR_FAR} мм) — ${Math.round(d.near*100)}%. `+(d.red.length?`<b style="color:#d01f1f">Красные линии</b> — ${d.red.length} ${plural(d.red.length,'шов, которого','шва, которых','швов, которых')} у эталона нет: «Убрать шов». `:'')+(d.parts?`<b style="color:#c08a00">Жёлтые точки</b> — ${d.parts} ${plural(d.parts,'участок','участка','участков')} швов эталона, ${plural(d.parts,'которого','которых','которых')} нет у нас: «Провести шов».`:'')+(!d.red.length&&!d.parts?'Лишних и недостающих швов нет.':'');}
// калька: облако TRACE.<id> (для сверки) и/или линии TRACE_L.<id>; у «формы оригинала» (#149) только линии
const traceHas=rid=>!!(window.TRACE&&TRACE[rid]||window.TRACE_L&&TRACE_L[rid]);
// #172 облако для сверки: у варианта кальки (только линии) — облако исходной, третий элемент FIGURES[ref].refs; иначе своё
const traceCloudId=rid=>{const r=((FIGURES[ST.refId]||{}).refs||[]).find(r=>r[0]===rid);return r&&r[2]||rid;};
function traceLoadFor(rid){if(TRC.id===rid&&(TRC.t||TRC.L)||TRC.loading)return;const cid=traceCloudId(rid),done=()=>{TRC.loading=false;if(!traceHas(rid)){msg('Калька не загрузилась');return;}
    TRC.t=window.TRACE&&TRACE[cid]?traceLoad(TRACE[cid]):null;TRC.L=window.TRACE_L&&TRACE_L[rid]?tlinesLoad(TRACE_L[rid]):null;TRC.seg=null;TRC.id=rid;TRC.b0=meshBox(modelPoly(ST.refId).V);TRC.key='';msg('');renderAll();};
  // файлы по очереди: сама калька, затем облако исходной (если его ещё нет); облако не загрузилось — калька без сверки
  const need=[rid,cid].filter((x,i,a)=>a.indexOf(x)===i&&!(i?window.TRACE&&TRACE[x]:traceHas(x)));if(!need.length){done();return;}TRC.loading=true;msg('Загружаю кальку…');
  const next=()=>{const x=need.shift();if(x===undefined){done();return;}const s=document.createElement('script');s.src='js/trace-'+x+'.js?v=2026-11-23l';s.onload=next;s.onerror=x===rid?()=>{TRC.loading=false;msg('Калька не загрузилась');}:next;document.head.appendChild(s);};next();}
const layerSet=(k,v)=>{ST.layers[k]=v;store('shepherd-layers',layersSave(ST.layers));};   // нет доступа к памяти браузера — слои живут до перезагрузки
$('cLEdges').addEventListener('change',e=>{layerSet('edges',e.target.checked);renderAll();});
$('cLVerts').addEventListener('change',e=>{layerSet('verts',e.target.checked);if(!e.target.checked)ST.sv=-1;renderAll();});
$('cTrace').addEventListener('change',e=>{if(OW.on){OW.calkaOn=e.target.checked;renderAll();return;}ST.traceUrl=false;layerSet('trace',e.target.checked);if(trOn()&&ST.refId)traceLoadFor(traceId());renderAll();});
$('cDiff').addEventListener('change',e=>{layerSet('diff',e.target.checked);renderAll();});
/* ---------- разметка (#150): «Линия», «Зачеркнуть» — штрихи поверх граней, фигура не меняется; магнит к линиям кальки; зеркальная — бледная; хранится в браузере по фигуре ----------
   инструмент включён — левая кнопка ставит точки, крутить — правой (OrbitControls); выключен — как было. На телефоне (нет точного указателя) инструментов нет */
ST.tool='';ST.mk=[];ST.mkCur=null;ST.magnet=true;
const MK={key:null,ver:0,why:false,draw:null,dkey:'',mb0:null,fine:typeof matchMedia==='function'&&matchMedia('(pointer:fine)').matches,und:[],red:[]};   // und/red — шаги отмены разметки (#180), не UNDO/REDO формы
const mkFig=()=>ST.ver?ST.verBase+'.'+ST.ver:(ST.fig||(OW.on&&OW.src==='file'?'file:'+OW.id:'file'));   // #179: модель из файла в режиме обводки — разметка по имени её файла
function mkSync(){const k=mkKey(mkFig());if(MK.key!==k){MK.key=k;ST.mk=mkLoad(store(k));ST.mkCur=null;mkReset();MK.ver++;}}   // другая фигура или версия — свой стек отмены, с нуля
function mkStore(){if(MK.key)store(MK.key,mkSave(ST.mk));MK.ver++;}   // нет памяти браузера — разметка живёт до перезагрузки
function mkReset(){MK.und=[];MK.red=[];}
// шаг разметки через чистые функции отмены (markup.js, #180): f(h, …) → новое состояние; тот же h — ничего не сделано (false). Поменялись штрихи — в браузер (mkStore)
function mkDo(f,...a){const h={mk:ST.mk,cur:ST.mkCur,und:MK.und,red:MK.red},r=f(h,...a);if(r===h)return false;ST.mk=r.mk;ST.mkCur=r.cur;MK.und=r.und;MK.red=r.red;if(r.mk!==h.mk)mkStore();else MK.ver++;return true;}
function mkFinish(){const c=ST.mkCur;ST.mkCur=null;if(c&&c.pts.length>=2)mkDo(mkPush,[c]);else MK.ver++;}
// управление камерой: с инструментом левая кнопка не крутит, крутит правая
function mkCtl(){if(!ok)return;if(!MK.mb0)MK.mb0={...controls.mouseButtons};if(!ST.tool&&ST.mkCur)mkFinish();
  controls.mouseButtons=ST.tool?{LEFT:-1,MIDDLE:MK.mb0.MIDDLE,RIGHT:THREE.MOUSE.ROTATE}:{...MK.mb0};stage.classList.toggle('drawing',!!ST.tool);}
// отрезки штрихов на фигуре (пересчёт — когда меняется разметка, форма или симметрия)
function mkDraw(){mkSync();const bad=ST.mk.filter(s=>s.why);const k=MK.ver+'|'+ST.sym+'|'+ST.base.V.length+'|'+ST.base.P.length+'|'+(ST.base.V[0]||[]).join();if(MK.dkey===k&&MK.draw&&MK.draw.base===ST.base)return MK.draw;
  const own=ST.mk.filter(s=>!s.why),cur=ST.mkCur?[ST.mkCur]:[],mir=ST.sym?[...own,...cur].map(mkMirror).filter(Boolean):[];
  MK.draw={base:ST.base,own:mkDrape([...own,...cur],ST.base.V,ST.base.P,ST.base),mirror:mkDrape(mir,ST.base.V,ST.base.P,ST.base),bad:mkDrape(bad,ST.base.V,ST.base.P,ST.base),why:(()=>{const at=bad.length?apIndex(ST.base):null;return bad.map(s=>{const p=s.pts[Math.floor(s.pts.length/2)],f=at(p);return {p,t:s.why,n:f>=0?polyNorm(ST.base.V,ST.base.P[f]):null};});})(),pts:new Float32Array(cur.flatMap(s=>s.pts.flat()))};MK.dkey=k;return MK.draw;}
// оригинал для обводки (#176): разметка по модели, плит нет — инструменты и без isPoly
function mkUI(){const on=ST.edit&&(OW.on||isPoly()&&!ST.orig);if(!on&&ST.tool){ST.tool='';mkCtl();}$('mkBox').hidden=!(on&&MK.fine);if(!on)return;mkSync();
  $('mkTools').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.tool===ST.tool));$('cMagnet').checked=ST.magnet;
  const nl=ST.mk.filter(s=>s.k!=='cross').length,nc=ST.mk.length-nl,nz=ST.mk.filter(s=>s.closed).length,nf=OW.on?OW.free.length:0;$('bMkClear').classList.toggle('off',!ST.mk.length&&!ST.mkCur);
  $('mkNote').textContent=(ST.mk.length?`Разметка: ${nl} ${plural(nl,'линия','линии','линий')}, ${nc} ${plural(nc,'зачёркивание','зачёркивания','зачёркиваний')}${nz?`, замкнутых ${nz}`:''}. `+(OW.on&&nl?(nf?`Свободных концов: ${nf}${ST.sym?' (с зеркальными)':''} — красные точки. `:'Все концы прицеплены. '):''):'Разметки нет. ')+(ST.tool==='pen'?'Карандаш: ведите мышкой с зажатой левой кнопкой — линия сгладится сама; концы ближе 6 мм — замкнутая'+(OW.on?'':' — после «Нарезать» станет отверстием')+'. Крутить — правой кнопкой':ST.tool==='line'?'Линия: кликайте по фигуре — точки; двойной клик или Enter — конец, Esc — отменить линию. Крутить — правой кнопкой':ST.tool==='cross'?'Зачеркнуть: два клика поперёк шва. Esc — отменить. Крутить — правой кнопкой':'')+(mkUndoOn()?(ST.tool?'. ':'')+'Ctrl+Z — убрать последнее, Ctrl+Y — вернуть':'');}   // подсказка отмены (#180) — когда Ctrl+Z идёт по разметке
// отмена в разметке (#180): в режиме обводки — по разметке (при «Править фигуру»: без неё разметки не видно); у обычной фигуры — пока выбран инструмент, иначе Ctrl+Z — правки формы (undo/redo)
function mkUndoOn(){return OW.on?ST.edit:!!ST.tool;}   // объявление функции, не const: mkUI зовут и до этой строки
// «Карандаш» (#151): пока ведут — лёгкое превью (одна линия поверх, без пересборки сцены); отпустили — сгладить, магнит, замкнутость
// #181: лентой MK_W px поверх всего (без проверки глубины, как была линия); точки руки → отрезки парами
function mkPreview(pts){if(!ok)return;const seg=new Float32Array(Math.max(0,pts.length-1)*6);for(let i=0;i+1<pts.length;i++){seg.set(pts[i],i*6);seg.set(pts[i+1],i*6+3);}
  const m=rbMesh(seg,rbMat(OW.on?OW_PEN:0xe07a35,{width:MK_W,depthTest:false}));m.renderOrder=5;m.visible=pts.length>1;if(MK.pv){scene.remove(MK.pv);MK.pv.geometry.dispose();}MK.pv=m;scene.add(m);req3D();}
function mkClick(e){const h=OW.on?owHit(e):pickHit(e);if(!h)return;const p=OW.on?owSurf(mkSnap(h,owSnapSeg(),ST.magnet)):mkSnap(h,traceOn()?TRC.seg:null,ST.magnet),c=ST.mkCur;   // на оригинале (#176) — магнит к своим линиям, точка — на модель
  if(c){const q=c.pts[c.pts.length-1];if(Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])<1.5)return;}   // второй клик двойного — не новая точка
  if(!c)ST.mkCur={k:ST.tool,pts:[p]};else c.pts.push(p);MK.ver++;if(ST.tool==='cross'&&ST.mkCur.pts.length===2)mkFinish();renderAll();}
$('mkTools').addEventListener('click',e=>{const b=e.target.closest('button[data-tool]');if(!b)return;const t=b.dataset.tool;b.blur();mkFinish();ST.seam=null;ST.tool=ST.tool===t?'':t;mkCtl();renderAll();});
$('cMagnet').addEventListener('change',e=>{ST.magnet=e.target.checked;});
// «Нарезать» (#152): вся разметка разом; одно «Отменить» возвращает всё нажатие; удачные штрихи уходят из разметки, отказы остаются красными с причиной
$('bMkApply').addEventListener('click',()=>{mkFinish();mkSync();if(!ST.mk.length){msg('Нечего нарезать');renderAll();return;}
  const r=applyMarkup(E(),ST.mk,{sym:ST.sym}),fail=new Map(r.fail.map(f=>[f.i,f.why]));
  if(r.done.length){UNDO.push(snapE(true));if(UNDO.length>60)UNDO.shift();REDO.length=0;}
  ST.mk.forEach((s,i)=>{if(fail.has(i))s.why=fail.get(i);else delete s.why;});ST.mk=ST.mk.filter((s,i)=>!r.done.includes(i));if(r.done.length)mkReset();mkStore();if(r.done.length)applyE(r.E);   // нарезано — своя отмена через UNDO (#152), стек разметки (#180) с нуля; не вышло ничего — штрихи те же, стек живой
  msg(`Нарезано ${r.done.length}, не вышло ${r.fail.length}`+(r.fail.length?' — причины у красных линий':''));renderAll();});
$('bMkClear').addEventListener('click',()=>{const had=ST.mk.length;if(!mkDo(mkClearAll))return;renderAll();msg(!had?'Разметка очищена':mkUndoOn()?'Разметка очищена — Ctrl+Z вернёт':'Разметка очищена — вернуть: выберите инструмент разметки и Ctrl+Z');});   // одним шагом отмены (#180)
const typing=()=>{const el=document.activeElement;return !!el&&(/SELECT|TEXTAREA/.test(el.tagName)||el.tagName==='INPUT'&&!/checkbox|radio|button|range/.test(el.type));};   // галочка в фокусе — не ввод текста
addEventListener('keydown',e=>{if(!ST.tool||typing())return;
  if(e.key==='Escape'&&ST.mkCur){ST.mkCur=null;MK.ver++;renderAll();}else if(e.key==='Enter'&&ST.mkCur){e.preventDefault();mkFinish();renderAll();}});   // Enter не нажимает кнопку в фокусе
// Ctrl+Z / Ctrl+Y в разметке (#180): идёт линия — убрать её последнюю точку, иначе последний штрих; Ctrl+Y — вернуть. Где работает — mkUndoOn; без него ловит обработчик формы
addEventListener('keydown',e=>{const a=mkUndoKey(e);if(!a||!mkUndoOn()||typing())return;e.preventDefault();mkSync();
  if(mkDo(a==='undo'?mkUndo:mkRedo))renderAll();else msg(a==='undo'?'Разметки нет — убирать нечего':'Возвращать нечего');});
$('traceSel').addEventListener('change',e=>{if(OW.on){OW.calka=e.target.value;renderAll();return;}ST.tref=e.target.value;if(trOn()&&ST.refId)traceLoadFor(traceId());renderAll();});

// клик по грани — выбрать деталь; в редакторе — точку или грань, точку можно тянуть
(()=>{if(!ok)return;const cv=renderer.domElement,tag=$('hovTag');let down=null,drag=null,raf=0,pen=null;
  cv.addEventListener('pointerdown',e=>{if(OW.on){down=null;if(!ST.tool||!ST.edit||e.button!==0)return;   // оригинал для обводки (#175): деталей и точек нет — клик только для разметки (#176)
      if(ST.tool==='pen'){const h=owHit(e);pen={raw:h?[h]:[]};cv.setPointerCapture(e.pointerId);return;}down={x:e.clientX,y:e.clientY};return;}   // перо можно начать и мимо модели — точки пойдут, когда зайдёт на неё
    down={x:e.clientX,y:e.clientY};
    if(ST.tool==='pen'&&e.button===0&&ST.edit&&!ST.orig&&isPoly()&&CUR){down=null;const h=pickHit(e);if(h){pen={raw:[h]};cv.setPointerCapture(e.pointerId);}return;}   // карандаш (#151)
    if(e.button!==0||!ST.edit||ST.orig||!isPoly()||!CUR||ST.tool)return;
    const v=vertsShown()?pickVert(e,ST.base.V):-1;if(v<0)return;if(ST.seam){if(ST.sp>=0&&ST.base.P[ST.sp].includes(v)){down=null;addCut(v);}return;}ST.sv=v;ST.sp=-1;ST.sel=-1;drag={v,snap:snapE(),moved:false};ST.drag=true;controls.enabled=false;cv.setPointerCapture(e.pointerId);renderAll();});
  // на оригинале (#176) промах пера (мимо модели) — точка пропущена; рывок мыши дальше половины порога разрыва (OW_GAP) — берём и промежуточные точки мыши
  // (getCoalescedEvents: браузер копит их с частотой мыши), чтобы быстрый росчерк по модели не рвался, а рвался только настоящий соскок с края
  cv.addEventListener('pointermove',e=>{if(pen){const at=x=>OW.on?owHit(x):pickHit(x),n=pen.raw.length,h=at(e),q=pen.raw[n-1],
      put=p=>{const l=pen.raw[pen.raw.length-1];if(p&&(!l||Math.hypot(p[0]-l[0],p[1]-l[1],p[2]-l[2])>=.3))pen.raw.push(p);};
    if(OW.on&&h&&q&&e.getCoalescedEvents&&Math.hypot(h[0]-q[0],h[1]-q[1],h[2]-q[2])>OW_GAP/2)e.getCoalescedEvents().forEach(c=>put(at(c)));else put(h);if(pen.raw.length>n)mkPreview(pen.raw);return;}
    if(drag){const p=dragPoint(e,ST.base.V[drag.v]);if(!p)return;drag.moved=true;tag.hidden=true;if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;if(!drag)return;const e2={V:ST.base.V.map(q=>q.slice()),P:ST.base.P,S:ST.base.S||[]};moveVert(e2,drag.v,dragPoint(e,ST.base.V[drag.v])||p,ST.sym);applyE(e2,true);});return;}
    if(!CUR||e.buttons||OW.on){tag.hidden=true;return;}const t=pickTri(e);if(t<0){tag.hidden=true;return;}const p=CUR.R.parts[CUR.R.partOf[t]],r=stage.getBoundingClientRect();
    tag.textContent=`№ ${p.no} · ${Math.round(p.L)} × ${Math.round(p.W)} мм`;tag.style.left=(e.clientX-r.left)+'px';tag.style.top=(e.clientY-r.top)+'px';tag.hidden=false;});
  cv.addEventListener('pointerup',e=>{if(pen){const raw=pen.raw;pen=null;mkPreview([]);
      if(OW.on){const a=owStrokes(raw,OW.G,owSnapSeg(),ST.magnet);mkDo(mkPush,a);}   // оригинал (#176): скачок > 20 мм рвёт штрих, точки — на модели
      else if(raw.length>=3)mkDo(mkPush,[mkPen(raw,traceOn()?TRC.seg:null,ST.magnet)]);renderAll();return;}
    if(drag){const d=drag;drag=null;ST.drag=false;controls.enabled=true;if(d.moved){UNDO.push(d.snap);REDO.length=0;renderAll();}down=null;return;}
    if(OW.on){if(!down)return;const mv=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(mv<=5&&e.button===0&&ST.tool&&ST.edit)mkClick(e);return;}   // оригинал (#176): «Линия», «Зачеркнуть»
    if(!down||!CUR||ST.orig)return;const mv=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(mv>5||e.button!==0)return;
    if(ST.tool&&ST.edit&&isPoly()){mkClick(e);return;}   // разметка (#150)
    const t=pickTri(e),pi=t>=0?CUR.R.partOf[t]:-1;
    if(ST.edit&&isPoly()){const fp=t>=0?ST.base.T[t]:-1;
      if(ST.seam){if(fp!==ST.sp||ST.sp<0)return;const h=pickHit(e);if(!h)return;const B=ST.base,Q=B.P[ST.sp];let be=null,bd=15;   // ближайшее ребро выбранной грани
        Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],ab=V3.sub(B.V[b],B.V[a]),L=V3.len(ab),u=Math.max(0,Math.min(1,V3.dot(V3.sub(h,B.V[a]),ab)/(L*L||1))),q=V3.add(B.V[a],V3.mul(ab,u)),d=V3.len(V3.sub(h,q));if(d<bd&&u*L>8&&(1-u)*L>8){bd=d;be={a,b,q};}});
        if(!be){msg('Кликните ближе к ребру выбранной грани или по её углу');return;}
        // магнит: с калькой точка встаёт туда, где ребро пересекает шов эталона
        const mg=traceOn()&&TRC.t?seamOnEdge(B.V[be.a],B.V[be.b],h,traceMapNow(),TRC.t):null;if(mg)be.q=mg;
        pushUndo();const r=addEdgePoint(E(),be.a,be.b,be.q,ST.sym);applyE(r.E,true);addCut(r.m);if(mg&&ST.seam&&ST.seam.length===1)msg('Точка — на шве эталона');return;}
      if(e.shiftKey&&ST.sp>=0&&fp>=0&&fp!==ST.sp){ST.sp2=fp;ST.sv=-1;renderAll();return;}
      ST.sv=-1;ST.sp=fp;ST.sp2=-1;ST.sel=pi;renderAll();return;}
    if(typeof ANG!=='undefined'&&ANG.on){angTapUI(pi);return;}
    ST.sel=pi===ST.sel?-1:pi;ST.selB=-1;renderAll();
    if(pi>=0){$('controls').querySelector('[data-g="view"]').classList.remove('shut');revealRow($('parts').querySelector(`tr[data-p="${pi}"]`));}});
  cv.addEventListener('dblclick',()=>{if(ST.tool==='line'&&ST.mkCur){mkFinish();renderAll();}});
  cv.addEventListener('pointerleave',()=>tag.hidden=true);})();

// стартовая фигура: #f=… из адреса, иначе запомненная в браузере (свой ключ shepherd-fig — ключи собаки и коня с этим не путаются), иначе Овчарка; неизвестный id — тоже Овчарка
function startFig(hash,saved){const hf=/f=([a-z0-9_]+)/.exec(hash||'');return hf&&FIGURES[hf[1]]?hf[1]:saved&&FIGURES[saved]?saved:'shepherd';}
// старт
if(/og/.test(location.hash)){document.body.classList.add('og');ST.nums=false;ST.small=false;$('cNums').checked=false;}
metalUI();verOptions();
if(typeof THREE==='undefined'){loading(true,'Не загрузилась 3D-библиотека — проверьте интернет');}
else{const f=startFig(location.hash,store('shepherd-fig'));$('figSel').value=f;loadFigure(f);}
