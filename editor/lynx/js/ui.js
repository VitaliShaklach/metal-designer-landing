/* ---------- Панель, таблицы, расчёт ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// числа по-русски; форматтер на каждое число заново — 0,4 мс, а таблица зовёт его сотни раз: держим по одному на число знаков
const FMT={},fmt=(x,d=0)=>(FMT[d]||(FMT[d]=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}))).format(Number(x));
const store=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}};
function msg(t){$('msg').textContent=t||'';}

// состояние фигуры
const ST={frame:null,edit:false,sym:true,sv:-1,sp:-1,sp2:-1,seam:null,trace:false,refId:'',name:'',fig:'lynx14',base:null,faces:260,diss:0,dims:{W:0,H:600,D:0},prop:true,t:2,mat:'steel',sheet:'1250x2500',sw:1250,sl:2500,cut:'laser',minW:15,weld:'tig',gap:0.5,useT:true,ngap:5,ngapOwn:false,engrave:true,tpl:false,bend:true,perf:true,perfL:2,perfStep:20,perfEdge:10,selB:-1,allParts:false,sel:-1,nums:false,small:true};
let SIMP={key:'',m:null},CUR=null,SHEETS_OLD=true,SHEETS_T=0;   // CUR = {M3,R,T,small}
const DENSE=2000;                    // больше стольких треугольников — модель гладкая, упрощаем
const isDense=()=>!ST.base.P&&ST.base.F.length>DENSE;
const isPoly=()=>!!ST.base.P;   // модель из граней-многоугольников (руками / в редакторе) — живёт в мм как есть
const E=()=>({V:ST.base.V,P:ST.base.P,S:ST.base.S||[]});
// грани, протыкающие другие: считаем только в редакторе или с подсветкой; на одну модель — один раз
const PRC=new WeakMap(),pierceOn=()=>isPoly()&&(ST.edit||ST.small),pierceOf=b=>{let s=PRC.get(b);if(!s){s=new Set(piercePolys({V:b.V,P:b.P}));PRC.set(b,s);}return s;};
// размеры многоугольной модели: тянем саму модель (x — от оси, y — от пола, z — от стены)
function setPolyDims(){ST.base=polyBase(fitMesh({V:ST.base.V,F:[]},ST.dims).V,ST.base.P,ST.base.S);}
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
  CUR.PC=R.parts.filter(p=>CUR.blankOf[p.id]<0).map(p=>({id:p.id,no:p.no,pts:CUR.C[p.id].pts,bad:CUR.C[p.id].bad,parts:[p.id],key:p.no}))
    .concat(CUR.BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts,parts:b.parts,key:R.parts[b.parts[0]].no,B:b}))).sort((a,b)=>a.key-b.key);
  // раскладка тяжёлая (секунды) — считаем только когда нужна (Итого, Раскрой, Чертежи, DXF) и в фоне; одинаковые контуры — из кэша
  NEST.items=CUR.PC.filter(o=>!o.bad).map(o=>({id:o.id,no:o.no,pts:o.pts}));
  // уголки-шаблоны (галочка) — в раскрой вместе с деталями: под углы швов и сгибов (гнутые стыки — не швы)
  CUR.TPL=ST.tpl?weldTemplates(R,ST.t,ST.minW,ST.bend?(p,q)=>CUR.bentKey.has(bendKey(p,q)):null,CUR.BL.flatMap(b=>b.lines.map(l=>l.ang))):null;if(CUR.TPL)NEST.items.push(...CUR.TPL.map(o=>({id:'t'+o.a,no:tplNo(o.a),pts:o.pts})));
  // с гибкой — тоже внутренней стороной вверх: V и m на гравировке — «на себя» и «от себя»
  NEST.args=[W,H,ST.ngap,10,2.5,2,ST.engrave||ST.bend];
  NEST.want=JSON.stringify([NEST.args,NEST.items.map(o=>[o.no,o.pts.map(q=>q.map(v=>Math.round(v*10)))])]);CUR.N=NEST.key===NEST.want?NEST.N:null;
  CUR.cutLen=CUR.PC.reduce((a,o)=>a+perim(o.pts),0);CUR.degen=CUR.PC.filter(o=>o.bad).length;SHEETS_OLD=true;}
function compute(){compute0();prodCalc();}
const NEST={key:'',want:'',N:null,run:null,wait:[]};
// раскладка по кусочкам, чтобы страница не замирала; cb — когда готово
const nestWait=on=>{document.querySelectorAll('.nestwait:not(#cdWait)').forEach(e=>e.hidden=!on);if(!on)nestCnt('');};
const nestCnt=t=>document.querySelectorAll('.nestCnt').forEach(e=>{e.textContent=t;});
function ensureNest(cb){if(CUR&&CUR.N){cb&&cb();return;}if(cb)NEST.wait.push(cb);if(NEST.run&&NEST.run.key===NEST.want)return;
  nestWait(true);const key=NEST.want,g=nestGen(NEST.items,...NEST.args),run={key};NEST.run=run;
  const step=()=>{if(NEST.run!==run)return;const t0=performance.now();let v;do{v=g.next();}while(!v.done&&performance.now()-t0<60);
    if(!v.done){const m=$('nestMsg');if(m)m.textContent=`Раскладываю детали по форме… ${v.value.done} из ${v.value.of}`;nestCnt(`· ${v.value.done} из ${v.value.of}`);setTimeout(step,0);return;}
    nestWait(false);NEST.key=key;NEST.N=v.value;NEST.run=null;if(CUR&&NEST.want===key)CUR.N=v.value;const w=NEST.wait;NEST.wait=[];w.forEach(f=>f());if(!$('tab-sum').hidden)sumTable();};
  setTimeout(step,0);}
function compute0(){const b=ST.base;let S=b;
  if(isPoly()){const M3={V:b.V,F:b.F,T:b.T,S:b.S},R=buildParts(M3,1.5,1.5),wl=FIGURES[ST.fig]?.noBack?0:addBacking(R,M3,FIGURES[ST.fig]?.backIf),_p=pairNumbers(R,M3.V),T=totals(R,{t:ST.t,mat:ST.mat,sheet:sheetWL()});T.weld+=wl;T.open=Math.max(0,T.open-wl);
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

function renderAll(fit){if(!CUR)return;if(pierceOn()&&!CUR.pierce)CUR.pierce=pierceOf(ST.base);const ed=ST.edit&&isPoly(),T=ST.base.T,tri=set=>{const o=new Set();if(T)T.forEach((pi,fi)=>{if(set.has(pi))o.add(fi);});return o;};
  build3D(CUR.M3,CUR.R,{sel:ST.sel,bent:CUR.bentKey&&CUR.bentKey.size?e=>e.p.length===2&&CUR.bentKey.has(bendKey(e.p[0],e.p[1])):null,grp:selBlank()>=0?new Set(CUR.BL[selBlank()].parts):null,small:ST.small?CUR.small:null,nums:ST.nums&&!ed,mat:ST.mat,verts:ed,sv:ST.sv,hi:ed&&ST.sp>=0?tri(new Set([ST.sp,ST.sp2])):null,warn:isPoly()?tri(CUR.bad):null,blue:ed&&CUR.selfx?tri(CUR.selfx):null,pierce:pierceOn()&&CUR.pierce?tri(CUR.pierce):null,mark:ed&&ST.seam?ST.seam:null,tex:traceTex(),diff:ed&&traceOn()?TRC.diff:null,backs:CUR.R.parts.filter(p=>p.back).map(p=>p.full.map(i=>V3.sub(CUR.M3.V[i],V3.mul(p.n,BACK_DEPTH))))});edUI();traceUI();if(fit)fitBox(meshBox(CUR.M3.V),fit==='instant');
  stats();sizeUI();facesUI();selUI();partsTable();sumTable();sheetsUI();$('ttl').textContent=ST.name||'Фигура';label3D();}
// 3D-окно для читалок экрана: название, детали, габарит — меняется вместе с фигурой и названием
function label3D(){if(!ok||!CUR)return;const n=CUR.R.parts.length,b=meshBox(CUR.M3.V).size,pc=CUR.BL&&CUR.BL.length?CUR.PC.length:0;
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
  let s=`<svg class="${big?'flat':'mini'}" viewBox="${-pad} ${-pad} ${w} ${h}" ${big?'':'width="64" height="40"'}${ra}>${tt}<polygon points="${P.map(q=>q[0].toFixed(1)+','+(p.W-q[1]).toFixed(1)).join(' ')}" class="pf" vector-effect="non-scaling-stroke"/>`;
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
  let s=`<svg class="${big?'flat':'mini'}" viewBox="${-pad} ${-pad} ${t.L+2*pad} ${t.W+2*pad}" ${big?'':'width="64" height="40"'}${ra}>${tt}<polygon points="${b.pts.map(q=>T(q).map(f).join(',')).join(' ')}" class="pf" vector-effect="non-scaling-stroke"/>`;
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
    <p class="note">Вид изнутри (со стороны гравировки). Габарит ${Math.round(b.L)} × ${Math.round(b.W)} мм · ${fmt(a/100,1)} см² · ${fmt(a*1e-9*ST.t*dens,3)} кг · рез ${Math.round(b.cut??perim(b.pts))} мм</p>
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
      if(o.B){const b=o.B,bi=+o.id.slice(1);return `<tr data-b="${bi}" class="${bi===sb?'on':''}"><td>Г${b.no}</td><td>${blankSVG(b)}</td><td>${Math.round(b.L)} × ${Math.round(b.W)}</td><td>${fmt(a/100,1)}</td><td>${fmt(a*1e-9*ST.t*dens,3)}</td><td>${Math.round(b.cut??perim(o.pts))}</td>
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
  $('sum').innerHTML='<tbody>'+rows.map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')+'</tbody>';}

/* ---------- загрузка фигур и файлов ---------- */
function setBase(m,o={}){ST.base=m;SIMP={key:'',m:null};ST.sel=-1;ST.selB=-1;ST.name=o.name||ST.name;$('mName').value=ST.name;
  ST.faces=o.faces||(isDense()?250:m.F.length);if(o.dims)ST.dims=o.dims;else dimsFromH(o.H||600);ST.sv=ST.sp=-1;UNDO.length=REDO.length=0;ST.edit=false;$('cEdit').checked=false;if(m.P)setPolyDims();}
// Доберманам 4–6 сначала нужен models.js (figureReady); выбрали другую фигуру, пока грузился, — его onload ничего не строит
let FIG_WANT='';
function loadFigure(id){FIG_WANT=id;if(!figureReady(id,()=>{if(FIG_WANT===id)loadFigure(id);},()=>{if(FIG_WANT===id){loading(false);$('figSel').value=ST.fig||'';msg('Фигура не загрузилась — проверьте интернет и выберите её ещё раз');}})){loading(true,'Загружаю фигуру…');return;}
  later(()=>{const f=FIGURES[id];ST.fig=id;ST.refId=f.ref||'';ST.frame=f.frame?{min:f.frame[0],max:f.frame[1]}:null;setBase(figureMesh(id,12),{name:f.name,faces:f.faces,H:f.H});const hn=/faces=(\d+)/.exec(location.hash),hd=/diss=(\d+)/.exec(location.hash);if(hn)ST.faces=+hn[1];if(hd)ST.diss=+hd[1];if(/edit/.test(location.hash)){ST.edit=true;$('cEdit').checked=true;}if(/trace/.test(location.hash)&&ST.refId){ST.trace=true;traceLoadFor(ST.refId);}compute();renderAll('instant');store('art-fig',id);msg('');const hv=/v=([a-z]+)/.exec(location.hash);if(hv)viewDir(hv[1],meshBox(CUR.M3.V),/og/.test(location.hash));},'Строю фигуру…');}
function openFile(file){const ext=file.name.split('.').pop().toLowerCase(),name=file.name.replace(/\.[^.]+$/,'');
  file.arrayBuffer().then(buf=>later(()=>{let m,o={name};
    if(ext==='obj')m=parseOBJ(new TextDecoder().decode(buf));else if(ext==='stl')m=parseSTL(buf);else if(ext==='glb')m=parseGLB(buf);
    else if(ext==='json'){const j=JSON.parse(new TextDecoder().decode(buf));if(j.type!=='md-art')throw new Error('это не файл фигуры');ST.weld='mig';/* старые файлы без weld — полуавтомат, зазор из файла */m=j.P?polyBase(j.V,j.P,j.S):{V:j.V,F:j.F};o={name:j.name||name,dims:j.dims,faces:j.F.length,ref:j.ref,frame:j.frame};
      ['t','mat','sheet','sw','sl','cut','minW','weld','gap','useT','ngap','engrave','tpl','bend','perf','perfL','perfStep','perfEdge','diss'].forEach(k=>{if(j[k]!==undefined)ST[k]=j[k];});ST.ngapOwn=ST.ngap!==nestGap(ST.cut);metalUI();}
    else throw new Error('нужен файл OBJ, STL, GLB или JSON');
    if(!m.F.length)throw new Error('в файле нет граней');ST.refId=o.ref&&typeof MODELS_POLY!=='undefined'&&MODELS_POLY[o.ref]?o.ref:'';ST.frame=o.frame?{min:o.frame[0],max:o.frame[1]}:null;ST.fig='';$('figSel').value='';setBase(m,o);compute();renderAll('instant');
    msg(`Открыто: ${m.F.length} ${plural(m.F.length,'треугольник','треугольника','треугольников')}${isDense()?' — упрощаю до '+ST.faces:''}`);},'Читаю модель…'));}
function save(){const j={type:'md-art',v:1,name:ST.name,dims:ST.dims,t:ST.t,mat:ST.mat,sheet:ST.sheet,sw:ST.sw,sl:ST.sl,cut:ST.cut,minW:ST.minW,weld:ST.weld,gap:ST.gap,useT:ST.useT,ngap:ST.ngap,engrave:ST.engrave,tpl:ST.tpl,bend:ST.bend,perf:ST.perf,perfL:ST.perfL,perfStep:ST.perfStep,perfEdge:ST.perfEdge,diss:0,
    V:CUR.M3.V.map(p=>p.map(x=>Math.round(x*100)/100)),F:CUR.M3.F};if(isPoly()){j.P=ST.base.P;j.S=ST.base.S||[];}if(ST.refId){j.ref=ST.refId;const fb=traceFrame();j.frame=[fb.min,fb.max].map(p=>p.map(x=>Math.round(x*100)/100));}
  saveBlob((ST.name||'figura')+'.json',new Blob([JSON.stringify(j)],{type:'application/json'}));}
// скачать файл. Ссылку-blob держим минуту: Safari на iPad начинает загрузку не сразу, и через 2 с файл иногда уже «не найден»
const BLOB_TTL=60000;
function saveBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),BLOB_TTL);}
function metalUI(){$('sNGap').value=ST.ngap;$('cEngrave').checked=ST.engrave;$('cTpl').checked=!!ST.tpl;$('cBend').checked=!!ST.bend;$('sWeld').value=weldOf();$('sGap').value=ST.gap;$('cUseT').checked=ST.useT;$('sT').value=ST.t;$('sMat').value=ST.mat;$('sSheet').value=ST.sheet;$('sCut').value=ST.cut;$('sW').value=ST.sw;$('sL').value=ST.sl;$('ownSheet').hidden=ST.sheet!=='own';perfUI();}
// перфорация линий сгиба: только лазер и только с гибкой
function perfUI(){$('cPerf').checked=!!ST.perf;$('pL').value=ST.perfL;$('pStep').value=ST.perfStep;$('pEdge').value=ST.perfEdge;const pl=ST.cut==='plasma',nb=!ST.bend;$('cPerf').disabled=pl||nb;
  ['pL','pStep','pEdge'].forEach(k=>$(k).disabled=pl||nb||!ST.perf);
  $('perfNote').innerHTML=pl?'Плазмой такие прорези не прорезать — только лазер':nb?'Прорези — на линиях сгиба: включите «Гнуть» в разделе «Металл»':'Сквозные прорези по линиям V и m — видны и снаружи. В DXF — слой PERF; в метраже — отдельной строкой';}

/* ---------- события ---------- */
let RT=0;const recalc=(fit,heavy)=>{clearTimeout(RT);RT=setTimeout(()=>heavy?later(()=>{compute();renderAll(fit);}):(compute(),renderAll(fit)),heavy?150:60);};
$('figSel').addEventListener('change',e=>{if(e.target.value)loadFigure(e.target.value);});
$('bOpen').addEventListener('click',()=>$('fileIn').click());
$('fileIn').addEventListener('change',e=>{const f=e.target.files[0];if(f)openFile(f);e.target.value='';});
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
  const RV=ST.base.V.map(([x,y,z])=>ax==='x'?[x,-z,y]:ax==='y'?[z,y,-x]:[-y,x,z]);if(isPoly()){pushUndo();ST.base=polyBase(RV,ST.base.P,ST.base.S);syncDims();setPolyDims();}else{ST.base={V:RV,F:ST.base.F};SIMP={key:'',m:null};dimsFromH(H);}later(()=>{compute();renderAll(true);});}));
$('sT').addEventListener('change',e=>{const t=+e.target.value;ST.gap=gapAfterT(ST.gap,weldOf(),ST.t,t);ST.t=t;$('sGap').value=ST.gap;recalc();});
$('sWeld').addEventListener('change',e=>{ST.weld=e.target.value;ST.gap=weldGap(ST.weld,ST.t);$('sGap').value=ST.gap;recalc();});
$('sMat').addEventListener('change',e=>{ST.mat=e.target.value;recalc();});
$('sSheet').addEventListener('change',e=>{ST.sheet=e.target.value;$('ownSheet').hidden=ST.sheet!=='own';recalc();});
['sW','sL'].forEach(k=>$(k).addEventListener('change',e=>{ST[k==='sW'?'sw':'sl']=Math.max(100,+e.target.value||0);recalc();}));
$('sCut').addEventListener('change',e=>{ST.cut=e.target.value;ST.minW=ST.cut==='laser'?15:30;ST.ngap=ngapAfterCut(ST.ngap,ST.ngapOwn,ST.cut);$('sNGap').value=ST.ngap;perfUI();recalc();});
$('cPerf').addEventListener('change',e=>{ST.perf=e.target.checked;perfUI();recalc();});
// пределы: прорезь 1–10 мм, шаг не меньше прорези + 3, от края не меньше 3
const perfFix=()=>{ST.perfL=Math.min(10,Math.max(1,ST.perfL||2));ST.perfStep=Math.max(ST.perfL+3,ST.perfStep||20);ST.perfEdge=Math.max(3,ST.perfEdge||10);perfUI();recalc();};
[['pL','perfL'],['pStep','perfStep'],['pEdge','perfEdge']].forEach(([id,k])=>$(id).addEventListener('change',e=>{ST[k]=+e.target.value;perfFix();}));
// клик по модели: строку таблицы — в видимую часть её собственной прокрутки (если она есть); страницу не трогаем
function revealRow(tr){for(let el=tr&&tr.parentElement;el&&el!==document.body;el=el.parentElement){const oy=getComputedStyle(el).overflowY;if((oy!=='auto'&&oy!=='scroll')||el.scrollHeight<=el.clientHeight)continue;
  const r=tr.getBoundingClientRect(),b=el.getBoundingClientRect();if(r.top<b.top)el.scrollTop+=r.top-b.top;else if(r.bottom>b.bottom)el.scrollTop+=r.bottom-b.bottom;return;}}
// клик по строке таблицы: открыть «Вид» и плавно показать эскиз детали; на телефоне — в шторке
function showSel(){const pn=$('controls'),sb=$('selBox'),bh=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';pn.querySelector('[data-g="view"]').classList.remove('shut');
  if(getComputedStyle($('drawerBtn')).display==='none'){sb.scrollIntoView({behavior:bh,block:'nearest'});return;}
  drawer(true);pn.scrollTo({top:pn.scrollTop+sb.getBoundingClientRect().top-pn.getBoundingClientRect().top-(pn.querySelector('.drawerhead')?.offsetHeight||0)-8,behavior:bh});}
$('parts').addEventListener('click',e=>{const tb=e.target.closest('tr[data-b]'),tr=e.target.closest('tr[data-p]');if(!tb&&!tr)return;
  // заготовка: подсветить целиком, камера — на неё (средняя точка и нормаль по площади)
  if(tb){const b=CUR.BL[+tb.dataset.b];ST.selB=+tb.dataset.b;ST.sel=-1;renderAll();const ps=b.parts.map(i=>CUR.R.parts[i]),A=ps.reduce((s,p)=>s+p.area,0);
    focusPart({c:V3.mul(ps.reduce((s,p)=>V3.add(s,V3.mul(p.c,p.area)),[0,0,0]),1/A),n:V3.norm(ps.reduce((s,p)=>V3.add(s,V3.mul(p.n,p.area)),[0,0,0])),L:b.L,W:b.W},meshBox(CUR.M3.V));}
  else{ST.sel=+tr.dataset.p;ST.selB=-1;renderAll();focusPart(CUR.R.parts[ST.sel],meshBox(CUR.M3.V));showSel();return;}
  $('controls').querySelector('[data-g="view"]').classList.remove('shut');});
$('partsVw').addEventListener('click',e=>{const b=e.target.closest('[data-vw]');if(!b)return;ST.allParts=b.dataset.vw==='parts';partsTable();});
document.querySelectorAll('.vbar [data-v]').forEach(b=>b.addEventListener('click',()=>CUR&&viewDir(b.dataset.v,meshBox(CUR.M3.V))));
$('bFit').addEventListener('click',()=>CUR&&fitBox(meshBox(CUR.M3.V)));
// вкладки и группы панели
const TABS=[...document.querySelectorAll('.tabbar button')];
function showTab(k){TABS.forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));$('tab-'+b.dataset.tab).hidden=!on;});store('art-tab',k);if(k==='sheets'||k==='nest'||k==='cards')sheetsUI(true);if(k==='sum'&&CUR)sumTable();}
TABS.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));showTab(['sum','nest','sheets','cards'].includes(store('art-tab'))?store('art-tab'):'parts');
document.querySelectorAll('.controls .grp').forEach(g=>g.querySelector('.gt').addEventListener('click',()=>g.classList.toggle('shut')));
function drawer(o){const bt=$('drawerBtn');$('controls').classList.toggle('open',o);bt.setAttribute('aria-expanded',String(o));bt.textContent=o?'Готово':'Панель';}
$('drawerBtn').addEventListener('click',()=>drawer(!$('controls').classList.contains('open')));$('drawerClose').addEventListener('click',()=>drawer(false));
/* ---------- раскрой, чертежи, карты: строим только открытую вкладку, через 0,5 с после правки; картам раскладка не нужна ---------- */
let CARDS_RUN=null;
function sheetsUI(now){clearTimeout(SHEETS_T);const vis=!$('tab-sheets').hidden||!$('tab-nest').hidden||!$('tab-cards').hidden;if(!vis||!CUR)return;
  if(!now){SHEETS_T=setTimeout(()=>sheetsUI(true),500);return;}
  if(!$('tab-cards').hidden){const run=CARDS_RUN={},g=buildCardsGen();$('cdWait').hidden=false;
    const step=()=>{if(CARDS_RUN!==run)return;if($('tab-cards').hidden){$('cdWait').hidden=true;CARDS_RUN=null;return;}const t0=performance.now();let v;do{v=g.next();}while(!v.done&&performance.now()-t0<60);
      if(!v.done){$('cdCnt').textContent=`· ${v.value.what} ${v.value.done} из ${v.value.of}`;setTimeout(step,0);return;}
      const cd=v.value;$('cards').innerHTML=cd.map((s,i)=>`<figure class="sheet" id="card${i+1}"><figcaption>Лист ${i+1} из ${cd.length} · ${esc(s.title)}</figcaption>${s.svg}</figure>`).join('');
      $('cdGo').innerHTML=cd.map((s,i)=>`<option value="card${i+1}">Карта ${i+1} · ${esc(s.title)}</option>`).join('');$('cdMsg').textContent=cd.length?`Карт: ${cd.length} · позиций на резку: ${CUR.PC.length}`:'';$('cdWait').hidden=true;$('cdCnt').textContent='';CARDS_RUN=null;};
    setTimeout(step,50);return;}
  if(!CUR.N){ensureNest(()=>sheetsUI(true));return;}SHEETS_OLD=false;
  if(!$('tab-nest').hidden){const L=sheetsNest(),d=new Date(),date=d.toLocaleDateString('ru-RU');$('nestBox').innerHTML=L.map((b,i)=>`<figure class="sheet"><figcaption>Раскрой ${i+1} из ${L.length}</figcaption>${wrapSheet(b,{n:i+1,N:L.length,date})}</figure>`).join('');
    const s0=CUR.N.sheets[0];$('nestMsg').textContent=`Листов: ${CUR.N.sheets.length} · ${itemsTxt(CUR.N.sheets.flatMap(s=>s.items))} · зазор ${ST.ngap} мм${s0?` · плотность ${Math.round(s0.dense*100)}% в полосе с деталями ${sheetWL()[1]} × ${Math.round(s0.len)} мм, остальное свободно`:''} · ${cutTxt(cutStats(CUR.N.sheets.flatMap(s=>s.items)))}${CUR.degen?' · выродились: '+CUR.degen:''}`;}
  if(!$('tab-sheets').hidden){const sh=buildSheets();$('sheets').innerHTML=sh.map((s,i)=>`<figure class="sheet" id="sheet${i+1}"><figcaption>Лист ${i+1} из ${sh.length} · ${esc(s.title)}</figcaption>${s.svg}</figure>`).join('');
    $('shGo').innerHTML=sh.map((s,i)=>`<option value="sheet${i+1}">Лист ${i+1} · ${esc(s.title)}</option>`).join('');}}
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
['shGo','cdGo'].forEach(id=>$(id).addEventListener('change',e=>{const el=$(e.target.value);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}));
// печать листов: А3 альбомная или А4 книжная — размер страницы задаём на время печати (один PDF с А3 и А4 вперемешку браузеры печатают ненадёжно)
function printSvgs(L,what,a4){const pb=$('printBox'),pg=document.createElement('style');pb.innerHTML=L.join('');pb.classList.toggle('a4',!!a4);pg.textContent=`@media print{@page{size:${a4?'A4 portrait':'A3 landscape'};margin:0}}`;document.head.appendChild(pg);
  const t=document.title;document.title=(ST.name||'Фигура')+' — '+what;const done=()=>{document.title=t;pb.innerHTML='';pg.remove();removeEventListener('afterprint',done);};addEventListener('afterprint',done);window.print();}
$('shPdf').addEventListener('click',()=>{if(!CUR||!CUR.N){msg('Подождите — раскладываю детали');ensureNest();return;}const sh=buildSheets();if(sh.length)printSvgs(sh.map(s=>s.svg),'чертежи');});
$('shCards').addEventListener('click',()=>{const cd=CUR?buildCards():[];if(cd.length)printSvgs(cd.map(s=>s.svg),'карты деталей',true);});
function dl(name,text){saveBlob(name,new Blob([text],{type:'application/dxf'}));}
const fname=()=>(ST.name||'figura').replace(/[\/:*?"<>|]+/g,'').trim()+`_${MATN[ST.mat]||ST.mat}_${ST.t}mm`;   // «Доберман 9_сталь_2mm_raskroy.dxf» — цех сразу видит материал и толщину
$('bDxfNest').addEventListener('click',()=>CUR&&ensureNest(()=>dl(fname()+(weldOf()==='tig'?'_N2':'')+'_raskroy.dxf',dxfNest())));
$('bDxfParts').addEventListener('click',()=>CUR&&dl(fname()+(weldOf()==='tig'?'_N2':'')+'_detali.dxf',dxfParts()));
$('sGap').addEventListener('change',e=>{ST.gap=Math.max(0,+e.target.value||0);recalc();});
$('cUseT').addEventListener('change',e=>{ST.useT=e.target.checked;recalc();});
$('sNGap').addEventListener('change',e=>{ST.ngap=Math.max(1,+e.target.value||nestGap(ST.cut));ST.ngapOwn=true;recalc();});   // поменяли руками — смена резки его больше не трогает
$('cEngrave').addEventListener('change',e=>{ST.engrave=e.target.checked;recalc();});
$('cTpl').addEventListener('change',e=>{ST.tpl=e.target.checked;recalc();});
$('cBend').addEventListener('change',e=>{ST.bend=e.target.checked;ST.allParts=false;ST.selB=-1;perfUI();recalc();});

/* ---------- редактор ---------- */
const UNDO=[],REDO=[];
function snapE(){return JSON.stringify({V:ST.base.V,P:ST.base.P,S:ST.base.S||[]});}
function pushUndo(){if(!isPoly())return;UNDO.push(snapE());if(UNDO.length>60)UNDO.shift();REDO.length=0;}
function applyE(e,keepSel){ST.base=polyBase(e.V,e.P,e.S);syncDims();if(!keepSel){ST.sp=-1;ST.sp2=-1;ST.sv=-1;ST.sel=-1;ST.seam=null;}compute();renderAll();}
function undo(){if(!UNDO.length)return;REDO.push(snapE());applyE(JSON.parse(UNDO.pop()));}
function redo(){if(!REDO.length)return;UNDO.push(snapE());applyE(JSON.parse(REDO.pop()));}
// перейти в редактор: любая модель становится набором граней-деталей в мм
function toPoly(){if(isPoly())return;const R=CUR.R,V=CUR.M3.V.map(p=>p.slice());ST.base=polyBase(V,R.parts.map(p=>p.full.slice()));ST.fig='';$('figSel').value='';syncDims();
  msg('Модель переведена в грани — теперь правится вручную');}
function edUI(){const on=ST.edit&&isPoly();$('hint').textContent=on?(ST.seam?'Провести шов: кликните 2 угла выбранной грани или место на её ребре (там встанет новая точка) · Esc — отмена':'Точку — тянуть мышкой · клик по грани — выбрать, Shift+клик — вторая грань · Delete — удалить грань · Ctrl+Z — отменить'):'Клик по грани — деталь · колесо — масштаб · правая кнопка — сдвиг';$('edBox').hidden=!ST.edit;stage.classList.toggle('editing',on);if(!ST.edit)return;
  const B=ST.base;let h='<p class="note">Кликните точку или грань на модели</p>';
  if(ST.sv>=0&&B.V[ST.sv]){const p=B.V[ST.sv];h=`<b>Точка</b> — тяните мышкой или введите координаты, мм<div class="xyz3"><label>X<input class="inp" id="vX" type="number" value="${Math.round(p[0])}"></label><label>Y<input class="inp" id="vY" type="number" value="${Math.round(p[1])}"></label><label>Z<input class="inp" id="vZ" type="number" value="${Math.round(p[2])}"></label></div>`;}
  else if(ST.sp>=0&&ST.sp2>=0&&B.P[ST.sp2])h=polysAdjacent(B,ST.sp,ST.sp2)?'<b>Две грани</b> — «Убрать шов» сольёт их в одну':'<b>Две грани</b> — они не соседние, слить нельзя';
  else if(ST.sp>=0&&B.P[ST.sp]){const Q=B.P[ST.sp],dev=polyDev(B.V,Q);h=`<b>Грань</b> — ${Q.length} ${plural(Q.length,'угол','угла','углов')}${Q.length>4?' (многоугольник)':''}${dev>1.5?', <span class="bad">неплоская на '+Math.round(dev)+' мм</span>':''}${CUR&&CUR.pierce&&CUR.pierce.has(ST.sp)?', <span class="prc">протыкает другую грань</span>':''}`;}
  if(ST.seam)h=`<b>Провести шов</b> — выбрано точек: ${ST.seam.length} из 2`;$('edSel').innerHTML=h;$('edOps').querySelectorAll('button').forEach(b=>b.classList.toggle('off',ST.sp<0));
  $('edOps').querySelector('[data-op=merge]').classList.toggle('off',!(ST.sp>=0&&ST.sp2>=0&&polysAdjacent(B,ST.sp,ST.sp2)));$('edOps').querySelector('[data-op=cut]').classList.toggle('on',!!ST.seam);
  const n=CUR&&CUR.bad?CUR.bad.size:0,nx=CUR&&CUR.selfx?CUR.selfx.size:0,nw=CUR&&CUR.small?CUR.small.size:0,np=CUR&&CUR.pierce?CUR.pierce.size:0;$('edPlan').className='note'+(n||nx||nw||np?' warn':'');$('edPlan').textContent=(np?`${np} ${plural(np,'грань протыкает','грани протыкают','граней протыкают')} другие — фиолетовые: детали прошли бы друг сквозь друга, отодвиньте точки. `:'')+(nx?`Самопересекающихся граней: ${nx} — синие, разрежьте их «Провести шов». `:'')+(nw?`Узких деталей: ${nw} — красные. `:'')+(n?`Неплоских граней: ${n} — подсвечены жёлтым. Плоский лист так не согнёшь: выровняйте (точки сдвинутся на миллиметры) или разбейте на треугольники`:'Все грани плоские — каждая режется одним куском');
  ['bFlat','bTri'].forEach(id=>$(id).classList.toggle('off',!n));$('bUndo').classList.toggle('off',!UNDO.length);$('bRedo').classList.toggle('off',!REDO.length);}
$('cEdit').addEventListener('change',e=>{ST.edit=e.target.checked;if(ST.edit&&CUR){toPoly();compute();}renderAll();});
$('cSym').addEventListener('change',e=>{ST.sym=e.target.checked;});
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
  const m=polyBase(b.V,b.P),s=meshBox(m.V).size;setBase(m,{name:k==='box'?'Заготовка — куб':'Заготовка — шар',dims:{W:Math.round(s[0]),H:Math.round(s[1]),D:Math.round(s[2])}});
  ST.edit=true;$('cEdit').checked=true;compute();renderAll('instant');});
addEventListener('keydown',e=>{if(!ST.edit||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&(k==='z'||k==='я')&&!e.shiftKey){e.preventDefault();undo();}else if((e.ctrlKey||e.metaKey)&&(k==='y'||k==='н'||k==='z'&&e.shiftKey)){e.preventDefault();redo();}
  else if(k==='delete'&&ST.sp>=0){pushUndo();applyE(delPoly(E(),ST.sp,ST.sym));}
  else if(k==='escape'&&ST.seam){ST.seam=null;renderAll();}});
// провести шов: точка выбрана; две — режем грань
function addCut(v){if(!ST.seam||ST.sp<0)return;if(!ST.seam.includes(v))ST.seam.push(v);
  if(ST.seam.length===2){const r=cutPoly(E(),ST.sp,ST.seam[0],ST.seam[1],ST.sym);if(r){pushUndo();applyE(r);msg('Шов проведён');return;}msg('Между этими точками уже есть край грани — выберите несоседние');ST.seam=[];}renderAll();}
// калька: облако эталона (js/trace-<id>.js, грузится по галочке) → атлас на наши грани; пересчёт, только когда меняется форма
const TRC={id:'',t:null,b0:null,key:'',at:null,loading:false};
function traceOn(){return !!(ST.trace&&ST.refId&&TRC.id===ST.refId&&TRC.t&&CUR&&isPoly());}
// рамка кальки: габарит эталона в координатах фигуры (у правленой копии — её исходный габарит, ST.frame), иначе — габарит самой фигуры
function traceFrame(){const pb=meshBox(CUR.M3.V);if(!ST.frame)return pb;const rb=meshBox(ST.base.V),m=p=>p.map((x,k)=>(x-rb.min[k])*pb.size[k]/(rb.size[k]||1)+pb.min[k]),min=m(ST.frame.min),max=m(ST.frame.max);return {min,max,size:max.map((x,k)=>x-min[k])};}
function traceMapNow(){return traceMap(TRC.b0,traceFrame());}
function traceTex(){if(!traceOn())return null;const {V,P}=ST.base;let h=V.length*31+P.length;V.forEach((p,i)=>{h+=(p[0]*1.3+p[1]*2.7+p[2]*3.1)*((i%7)+1);});P.forEach(Q=>{h+=Q.length*17+Q[0];});(ST.base.S||[]).forEach(e=>{h+=e[0]*.7+e[1]*1.9;});const key=h.toFixed(3);
  // пока тянут точку — старый рисунок (те же треугольники), пересчёт после отпускания
  if(TRC.key!==key&&ST.drag&&TRC.at&&TRC.at.uv.length===ST.base.F.length*6)return TRC.at;
  if(TRC.key!==key){const t0=performance.now();const mp=traceMapNow();TRC.at=traceAtlas(V,P,ST.base.F,ST.base.T,mp,TRC.t);TRC.diff=traceDiff(CUR.R.edges,V,ST.base.F,mp,TRC.t);TRC.key=key;if(!TRC.logged){TRC.logged=1;console.log('калька: атлас',TRC.at.W+'×'+TRC.at.H,Math.round(performance.now()-t0)+' мс');}}return TRC.at;}
function traceUI(){$('traceRow').hidden=!ST.refId;$('cTrace').checked=ST.trace;const d=ST.edit&&traceOn()?TRC.diff:null,el=$('edTrace');el.hidden=!d;if(!d)return;
  el.innerHTML=`Сверка с калькой: на шве эталона ${Math.round(d.on*100)}% длины наших швов, рядом (до ${TR_FAR} мм) — ${Math.round(d.near*100)}%. `+(d.red.length?`<b style="color:#d01f1f">Красные линии</b> — ${d.red.length} ${plural(d.red.length,'шов, которого','шва, которых','швов, которых')} у эталона нет: «Убрать шов». `:'')+(d.parts?`<b style="color:#c08a00">Жёлтые точки</b> — ${d.parts} ${plural(d.parts,'участок','участка','участков')} швов эталона, ${plural(d.parts,'которого','которых','которых')} нет у нас: «Провести шов».`:'')+(!d.red.length&&!d.parts?'Лишних и недостающих швов нет.':'');}
function traceLoadFor(rid){if(TRC.id===rid&&TRC.t||TRC.loading)return;const done=()=>{TRC.loading=false;if(!(window.TRACE&&TRACE[rid])){msg('Калька не загрузилась');return;}
    TRC.t=traceLoad(TRACE[rid]);TRC.id=rid;TRC.b0=meshBox(modelPoly(rid).V);TRC.key='';msg('');renderAll();};
  if(window.TRACE&&TRACE[rid]){done();return;}TRC.loading=true;const s=document.createElement('script');s.src='js/trace-'+rid+'.js?v=0.27.1';s.onload=done;s.onerror=()=>{TRC.loading=false;msg('Калька не загрузилась');};document.head.appendChild(s);msg('Загружаю кальку…');}
$('cTrace').addEventListener('change',e=>{ST.trace=e.target.checked;if(ST.trace&&ST.refId)traceLoadFor(ST.refId);renderAll();});

// клик по грани — выбрать деталь; в редакторе — точку или грань, точку можно тянуть
(()=>{if(!ok)return;const cv=renderer.domElement,tag=$('hovTag');let down=null,drag=null,raf=0;
  cv.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};if(e.button!==0||!ST.edit||!isPoly()||!CUR)return;
    const v=pickVert(e,ST.base.V);if(v<0)return;if(ST.seam){if(ST.sp>=0&&ST.base.P[ST.sp].includes(v)){down=null;addCut(v);}return;}ST.sv=v;ST.sp=-1;ST.sel=-1;drag={v,snap:snapE(),moved:false};ST.drag=true;controls.enabled=false;cv.setPointerCapture(e.pointerId);renderAll();});
  cv.addEventListener('pointermove',e=>{if(drag){const p=dragPoint(e,ST.base.V[drag.v]);if(!p)return;drag.moved=true;tag.hidden=true;if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;if(!drag)return;const e2={V:ST.base.V.map(q=>q.slice()),P:ST.base.P,S:ST.base.S||[]};moveVert(e2,drag.v,dragPoint(e,ST.base.V[drag.v])||p,ST.sym);applyE(e2,true);});return;}
    if(!CUR||e.buttons){tag.hidden=true;return;}const t=pickTri(e);if(t<0){tag.hidden=true;return;}const p=CUR.R.parts[CUR.R.partOf[t]],r=stage.getBoundingClientRect();
    tag.textContent=`№ ${p.no} · ${Math.round(p.L)} × ${Math.round(p.W)} мм`;tag.style.left=(e.clientX-r.left)+'px';tag.style.top=(e.clientY-r.top)+'px';tag.hidden=false;});
  cv.addEventListener('pointerup',e=>{if(drag){const d=drag;drag=null;ST.drag=false;controls.enabled=true;if(d.moved){UNDO.push(d.snap);REDO.length=0;renderAll();}down=null;return;}
    if(!down||!CUR)return;const mv=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(mv>5||e.button!==0)return;
    const t=pickTri(e),pi=t>=0?CUR.R.partOf[t]:-1;
    if(ST.edit&&isPoly()){const fp=t>=0?ST.base.T[t]:-1;
      if(ST.seam){if(fp!==ST.sp||ST.sp<0)return;const h=pickHit(e);if(!h)return;const B=ST.base,Q=B.P[ST.sp];let be=null,bd=15;   // ближайшее ребро выбранной грани
        Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],ab=V3.sub(B.V[b],B.V[a]),L=V3.len(ab),u=Math.max(0,Math.min(1,V3.dot(V3.sub(h,B.V[a]),ab)/(L*L||1))),q=V3.add(B.V[a],V3.mul(ab,u)),d=V3.len(V3.sub(h,q));if(d<bd&&u*L>8&&(1-u)*L>8){bd=d;be={a,b,q};}});
        if(!be){msg('Кликните ближе к ребру выбранной грани или по её углу');return;}
        // магнит: с калькой точка встаёт туда, где ребро пересекает шов эталона
        const mg=traceOn()?seamOnEdge(B.V[be.a],B.V[be.b],h,traceMapNow(),TRC.t):null;if(mg)be.q=mg;
        pushUndo();const r=addEdgePoint(E(),be.a,be.b,be.q,ST.sym);applyE(r.E,true);addCut(r.m);if(mg&&ST.seam&&ST.seam.length===1)msg('Точка — на шве эталона');return;}
      if(e.shiftKey&&ST.sp>=0&&fp>=0&&fp!==ST.sp){ST.sp2=fp;ST.sv=-1;renderAll();return;}
      ST.sv=-1;ST.sp=fp;ST.sp2=-1;ST.sel=pi;renderAll();return;}
    ST.sel=pi===ST.sel?-1:pi;ST.selB=-1;renderAll();
    if(pi>=0){$('controls').querySelector('[data-g="view"]').classList.remove('shut');revealRow($('parts').querySelector(`tr[data-p="${pi}"]`));}});
  cv.addEventListener('pointerleave',()=>tag.hidden=true);})();

// старт
if(/og/.test(location.hash)){document.body.classList.add('og');ST.nums=false;ST.small=false;$('cNums').checked=false;}
metalUI();
if(typeof THREE==='undefined'){loading(true,'Не загрузилась 3D-библиотека — проверьте интернет');}
else{const hf=/f=([a-z0-9]+)/.exec(location.hash),f=hf&&FIGURES[hf[1]]?hf[1]:FIGURES[store('art-fig')]?store('art-fig'):'lynx14';$('figSel').value=f;loadFigure(f);}
