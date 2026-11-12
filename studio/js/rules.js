/* ---------- Проверка: правила чистой фигуры (спека docs/superpowers/specs/2026-11-09-figure-studio-design.md, «Чистая фигура») ----------
   Обычный скрипт: в браузере — рядом с движком editor/lynx/js, в Node — в одном vm-контексте с ним (studio/lib/engine.js).
   Геометрия E={V,P,S} — в мм модели. Пороги th и val строк — в мм сайта (мм модели × scale, scale = H / высота модели) или в градусах.
   checkFigure(E,o) → Issue[]: {rule, at, faces, verts, val, text, fix, info}; at — мм модели (туда летит камера).
   o: {th, scale, kind:'stand'|'wall', slots: контуры прорезей (номера точек), keep: [{rule, at}], t: толщина листа (мм),
       region: {c: точка в мм модели, r: радиус в мм сайта} — «Здесь криво»: только этот шар и пороги вдвое строже,
       skip: номера правил, которые не считать (12 — долгое: детали и гибка; 15 считается вместе с ним),
       ref: эталон — refIndex(…) из studio/js/ref.js (или сам {V, F, trace}); base: фигура {V, P}, какой её открыли}.
   Правило 11 — грани дальше th.ref от эталона; эталона нет — от base, и в списке строка-сведение; ни того ни другого — правила 11 нет.
   Правило 7 с эталоном: шов лишний, только если на эталоне рядом нет ни излома, ни линии (studio/js/ref.js refSeam).
   Правило 17 — DXF при публикации (задача 8). */
const TH_DEFAULT={planar:.1,edge:5,near:8,ang:5,lineLo:172,lineHi:179.5,width:15,seam:5,ref:2,sym:.1,H:1000};   // sym — допуск зеркальной точки (правило 10)
const RULES=[
  {n:1,title:'Грань плоская',color:'#e0a020'},
  {n:2,title:'Нет коротких рёбер',color:'#e07020'},
  {n:3,title:'Нет близких точек без ребра между ними (ступенька)',color:'#c0409a'},
  {n:4,title:'Нет острых углов в грани (иглы)',color:'#e04870'},
  {n:5,title:'Нет точек почти на прямой',color:'#20a0a0'},
  {n:6,title:'Нет узких деталей',color:'#d01f1f'},
  {n:7,title:'Нет лишних швов',color:'#7a8a20'},
  {n:8,title:'Нет дыр',color:'#202020'},
  {n:9,title:'Нет самопересечений и протыканий',color:'#3a6fe0'},
  {n:10,title:'Симметрия',color:'#2a9a50'},
  {n:11,title:'Похожесть',color:'#9b3fd6'},
  {n:12,title:'Производство',color:'#806040'},
  {n:13,title:'Грани смотрят наружу',color:'#4060a0'},
  {n:14,title:'Нет вырожденных граней',color:'#a02020'},
  {n:15,title:'Развёртка детали не налезает сама на себя',color:'#608080'},
  {n:16,title:'Прорезь не уже толщины листа',color:'#a06000'},
  {n:17,title:'DXF чистый',color:'#505050'}];
// какие правила автоматика умеет чинить (studio/js/fix.js, задача 3)
const RULE_FIX=new Set([1,2,3,4,5,6,7,8,10,13,14,16]);
// у каких правил хуже — меньше (пороги «не меньше»); у остальных хуже — больше
const RULE_LOW=new Set([2,3,4,6,7,14,16]);
const fmtN=(x,d=2)=>String(+x.toFixed(d)).replace('.',',');
// «Здесь криво»: пороги вдвое строже — «не больше» делим на 2, «не меньше» умножаем на 2
function thStrict(th){return Object.assign({},th,{planar:th.planar/2,ref:th.ref/2,sym:th.sym/2,edge:th.edge*2,near:th.near*2,width:th.width*2,ang:th.ang*2,seam:th.seam*2,lineLo:180-(180-th.lineLo)*2});}
function keepMatch(issue,keep,scale){return issue.rule===keep.rule&&V3.len(V3.sub(issue.at,keep.at))*scale<5;}
function ruleCounts(issues){const r={};issues.forEach(i=>{if(!i.info)r[i.rule]=(r[i.rule]||0)+1;});return r;}

// clean.js (makeClean) — один на все вызовы; g — имена движка, которые он берёт
let RULES_CLEAN=null;
const rulesClean=()=>RULES_CLEAN||(RULES_CLEAN=makeClean(n=>({V3,polyNorm,polyC,polyDev,mirrorMap,openVerts,selfXPolys,compact,mirrorPoly,mergeTwo})[n]));

// индекс эталона или открытой фигуры — один на объект (Проверка пересчитывается после каждой правки, эталон тот же)
// o.base — фигура, какой её открыли: её не правят на месте (правки движка — копии, ecopy), иначе индекс устареет
const REF_CACHE=new WeakMap();
function refOf(x){if(x.isRef)return x;let R=REF_CACHE.get(x);if(!R)REF_CACHE.set(x,R=refIndex(x));return R;}

function checkFigure(E,o){o=o||{};const sc=o.scale||1,base=Object.assign({},TH_DEFAULT,o.th||{}),th=o.region?thStrict(base):base,skip=new Set(o.skip||[]);
  const V=E.V,P=E.P,out=[],REF=o.ref?refOf(o.ref):null;
  const add=(rule,at,faces,verts,val,text,info=false)=>out.push({rule,at:at.slice(),faces,verts,val,text,fix:!info&&RULE_FIX.has(rule),info});
  // рёбра: ключ → {a, b, f: грани, d: обход ребра в грани (a→b — 1, b→a — −1)}; грани у точки. Повтор точки в грани (a = b) — не ребро, это правило 14
  const ek=(a,b)=>a<b?a+'_'+b:b+'_'+a,ED=new Map(),VF=V.map(()=>[]);
  P.forEach((Q,fi)=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=ek(a,b);if(!VF[a].includes(fi))VF[a].push(fi);if(a===b)return;let e=ED.get(key);if(!e)ED.set(key,e={a:Math.min(a,b),b:Math.max(a,b),f:[],d:[]});e.f.push(fi);e.d.push(a<b?1:-1);}));
  const mid=(a,b)=>V3.mul(V3.add(V[a],V[b]),.5);
  // вырожденные грани (правило 14): меньше трёх разных точек, нулевая площадь или нулевая сторона; правила граней (1, 4–7, 9, 10, 12, 13) их не смотрят
  const NV=P.map(Q=>{let n=[0,0,0];Q.forEach((a,k)=>{const p=V[a],q=V[Q[(k+1)%Q.length]];n[0]+=(p[1]-q[1])*(p[2]+q[2]);n[1]+=(p[2]-q[2])*(p[0]+q[0]);n[2]+=(p[0]-q[0])*(p[1]+q[1]);});return n;});
  const DEG=P.map((Q,fi)=>new Set(Q).size<3||V3.len(NV[fi])/2*sc*sc<.01||Q.some((a,k)=>V3.len(V3.sub(V[Q[(k+1)%Q.length]],V[a]))*sc<.01));
  // углы граней: внутренний угол в плоскости грани, 0…360°
  const ANG=P.map((Q,fi)=>{if(DEG[fi])return null;const n=V3.norm(NV[fi]);return Q.map((v,k)=>{const a=V3.sub(V[Q[(k+Q.length-1)%Q.length]],V[v]),b=V3.sub(V[Q[(k+1)%Q.length]],V[v]);
    let t=Math.atan2(V3.dot(V3.cross(b,a),n),V3.dot(b,a))*180/Math.PI;return t<0?t+360:t;});});
  // 1. грань плоская
  if(!skip.has(1))P.forEach((Q,fi)=>{if(DEG[fi])return;const d=polyDev(V,Q)*sc;if(d>th.planar)add(1,polyC(V,Q),[fi],Q.slice(),d,`грань неплоская на ${fmtN(d)} мм`);});
  // 2. нет коротких рёбер
  if(!skip.has(2))ED.forEach(e=>{const L=V3.len(V3.sub(V[e.b],V[e.a]))*sc;if(L<th.edge)add(2,mid(e.a,e.b),e.f.slice(),[e.a,e.b],L,`ребро ${fmtN(L,1)} мм`);});
  // 3. нет близких точек без ребра между ними: сетка с ячейкой в порог, соседние ячейки
  if(!skip.has(3)){const cell=th.near/sc,G=new Map(),key=p=>p.map(x=>Math.floor(x/cell));
    V.forEach((p,i)=>{const k=key(p).join();(G.get(k)||G.set(k,[]).get(k)).push(i);});
    V.forEach((p,i)=>{const [x,y,z]=key(p);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)(G.get([x+dx,y+dy,z+dz].join())||[]).forEach(j=>{
      if(j<=i||ED.has(ek(i,j))||!VF[i].length||!VF[j].length)return;const d=V3.len(V3.sub(V[j],p))*sc;
      if(d<th.near)add(3,mid(i,j),[...new Set(VF[i].concat(VF[j]))],[i,j],d,`точки в ${fmtN(d,1)} мм без ребра между ними`);});});}
  // 4. нет острых углов в грани: угол меньше порога (или узкая щель внутрь — больше 360° − порог)
  if(!skip.has(4))P.forEach((Q,fi)=>{if(!ANG[fi])return;ANG[fi].forEach((t,k)=>{const a=Math.min(t,360-t);if(a<th.ang)add(4,V[Q[k]],[fi],[Q[k]],a,`игла: угол ${fmtN(a,1)}°`);});});
  // 5. нет точек почти на прямой: отход от прямой в какой-нибудь грани точки в (180 − lineHi; 180 − lineLo]; на прямой во всех гранях — лишняя точка
  if(!skip.has(5)){const ok=180-th.lineHi,lo=180-th.lineLo;V.forEach((p,v)=>{const fs=VF[v].filter(fi=>ANG[fi]);if(!fs.length)return;
    const dev=fs.map(fi=>Math.abs(180-ANG[fi][P[fi].indexOf(v)]));
    if(dev.every(d=>d<=ok)){add(5,p,fs,[v],180-Math.max(...dev),'лишняя точка: на прямой во всех гранях');return;}
    const hit=fs.filter((_,k)=>dev[k]>ok&&dev[k]<=lo);if(hit.length){const d=Math.min(...dev.filter(d=>d>ok&&d<=lo));add(5,p,hit,[v],180-d,`точка почти на прямой: ${fmtN(180-d,1)}°`);}});}
  // 6. нет узких деталей: детали как на сайте (buildParts 1,5° / 1,5 мм в мм сайта), ширина как у красной подсветки (minW < порог − 0,5)
  const Vs=V.map(p=>V3.mul(p,sc)),OK=P.map((_,fi)=>fi).filter(fi=>!DEG[fi]);let PM=null;
  const parts=()=>{if(!PM){const M=polyBase(Vs,OK.map(fi=>P[fi]),E.S||[]);PM={M,R:buildParts(M,1.5,1.5)};}return PM;},facesOf=p=>[...new Set(p.tris.map(t=>OK[PM.M.T[t]]))];
  if(!skip.has(6))try{parts();}catch(e){PM={err:e};}
  if(!skip.has(6)&&!PM.err)PM.R.parts.forEach(p=>{if(p.minW<th.width-.5)add(6,V3.mul(p.c,1/sc),facesOf(p),p.loop.slice(),p.minW,`узкая деталь: ${fmtN(p.minW,1)} мм`);});
  // 7. нет лишних швов: излом между соседними гранями меньше порога (одна строка на пару граней).
  //    Швы S (проведённые руками) не исключаем: у рыси 14 они на всех рёбрах, и конвейер (шаг 8 спеки) ставит их на все рёбра — иначе правило не сработало бы никогда
  if(!skip.has(7)){const PR=new Map();ED.forEach(e=>{if(e.f.length!==2||e.f[0]===e.f[1]||DEG[e.f[0]]||DEG[e.f[1]])return;const k=Math.min(...e.f)+'_'+Math.max(...e.f);(PR.get(k)||PR.set(k,[]).get(k)).push(e);});
    PR.forEach((es,k)=>{const [f1,f2]=k.split('_').map(Number),n1=V3.norm(NV[f1]),n2=V3.norm(NV[f2]),dih=Math.acos(Math.max(-1,Math.min(1,V3.dot(n1,n2))))*180/Math.PI;if(dih>=th.seam)return;
      // эталон: излом рядом или нарисованная линия — шов нужен
      if(REF){const w=refSeam(REF,V,es,n1,n2,sc,th.seam);if(w.crease||w.line)return;}
      const vs=[...new Set(es.flatMap(e=>[e.a,e.b]))];add(7,V3.mul(vs.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/vs.length),[f1,f2],vs,dih,`лишний шов: излом ${fmtN(dih,1)}°`+(REF?', на эталоне ни излома, ни линии':''));});}
  // 8. нет дыр: открытые рёбра, кроме контуров прорезей и стены настенной (z = 0); одна строка на связный кусок края
  if(!skip.has(8)){const SL=new Set();(o.slots||[]).forEach(L=>L.forEach((a,k)=>SL.add(ek(a,L[(k+1)%L.length]))));
    const wall=e=>o.kind==='wall'&&Math.abs(V[e.a][2])<.5&&Math.abs(V[e.b][2])<.5;
    const open=[...ED.entries()].filter(([k,e])=>e.f.length===1&&!SL.has(k)&&!wall(e)).map(([,e])=>e),up=new Map(),root=x=>{while(up.has(x)&&up.get(x)!==x)x=up.get(x);return x;};
    open.forEach(e=>{const a=root(e.a),b=root(e.b);up.set(a,a);if(a!==b)up.set(b,a);});const G=new Map();open.forEach(e=>{const r=root(e.a);(G.get(r)||G.set(r,[]).get(r)).push(e);});
    G.forEach(es=>{const vs=[...new Set(es.flatMap(e=>[e.a,e.b]))],L=es.reduce((s,e)=>s+V3.len(V3.sub(V[e.b],V[e.a])),0)*sc;
      add(8,V3.mul(vs.reduce((s,i)=>V3.add(s,V[i]),[0,0,0]),1/vs.length),[...new Set(es.flatMap(e=>e.f))],vs,L,`дыра: открытый край ${fmtN(L,0)} мм`);});}
  // 9. нет самопересечений (грань-«бантик») и протыканий
  if(!skip.has(9)){selfXPolys(E).filter(fi=>!DEG[fi]).forEach(fi=>add(9,polyC(V,P[fi]),[fi],P[fi].slice(),0,'грань перекручена: контур пересекает сам себя'));
    piercePolys({V,P:OK.map(fi=>P[fi])}).map(k=>OK[k]).forEach(fi=>add(9,polyC(V,P[fi]),[fi],P[fi].slice(),0,'грань протыкает другую'));}
  // 10. симметрия x ↔ −x: у точки есть зеркальная не дальше sym (точка у середины — сама себе зеркальная, если |x| ≤ sym/2); у грани — зеркальная грань
  if(!skip.has(10)){const R=10/sc,G=new Map(),key=p=>p.map(x=>Math.floor(x/R)),MM=new Int32Array(V.length).fill(-1),pairs=new Set();
    V.forEach((p,i)=>{if(!VF[i].length)return;const k=key(p).join();(G.get(k)||G.set(k,[]).get(k)).push(i);});
    V.forEach((p,i)=>{if(!VF[i].length)return;const q=[-p[0],p[1],p[2]],[x,y,z]=key(q);let bj=-1,bd=R;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)(G.get([x+dx,y+dy,z+dz].join())||[]).forEach(j=>{const d=V3.len(V3.sub(V[j],q));if(d<bd){bd=d;bj=j;}});
      const d=bd*sc;if(bj>=0&&d<=th.sym){MM[i]=bj;return;}const k=bj<0?'n'+i:ek(i,bj);if(pairs.has(k))return;pairs.add(k);
      if(bj<0)add(10,p,VF[i].slice(),[i],10,'нет зеркальной точки ближе 10 мм');
      else add(10,V3.mul(V3.add(p,[-V[bj][0],V[bj][1],V[bj][2]]),.5),[...new Set(VF[i].concat(VF[bj]))],bj===i?[i]:[i,bj],bj===i?d/2:d,bj===i?`точка у середины не на середине: ${fmtN(d/2)} мм`:`точки не зеркальны на ${fmtN(d)} мм`);});
    const FK=new Map(P.map((Q,fi)=>[[...Q].sort((a,b)=>a-b).join(),fi]));
    P.forEach((Q,fi)=>{if(DEG[fi]||Q.some(i=>MM[i]<0))return;if(!FK.has(Q.map(i=>MM[i]).sort((a,b)=>a-b).join()))add(10,polyC(V,Q),[fi],Q.slice(),0,'у грани нет зеркальной');});}
  // 11. похожесть: грань дальше th.ref от эталона (точки грани и сетка внутри через 10 мм сайта); эталона нет — от открытой фигуры
  const R11=!skip.has(11)&&(REF||o.base&&refOf(o.base));
  if(R11&&R11.n){const R=R11,D=faceDev(E,R,sc);
    if(!REF){const b=meshBox(V);add(11,V3.mul(V3.add(b.min,b.max),.5),[],[],0,'Эталона нет: похожесть меряю от открытой фигуры',true);}
    P.forEach((Q,fi)=>{if(!DEG[fi]&&D[fi]>th.ref)add(11,D.pos[fi],[fi],Q.slice(),D[fi],`грань ушла от эталона на ${fmtN(D[fi])} мм`);});}
  // 12. производство: детали, контуры реза, гибка — без исключений и без bad (долго: skip:[12]); 15 — гибка отказалась гнуть, потому что развёртка налезает (информационная строка)
  if(!skip.has(12)){const t=o.t||2,c0=meshBox(V),cc=V3.mul(V3.add(c0.min,c0.max),.5),err=(what,e,at=cc,fs=[])=>add(12,at,fs,[],0,what+': '+e.message);
    let R=null,B=null;try{R=parts().R;}catch(e){err('детали не строятся',e);}
    if(R){R.parts.forEach(p=>{try{if(cutContour(p,t,.5,true).bad)add(12,V3.mul(p.c,1/sc),facesOf(p),p.loop.slice(),0,'контур реза детали не строится');}catch(e){err('контур реза детали не строится',e,V3.mul(p.c,1/sc),facesOf(p));}});
      try{B=bendPlan(R,Vs,{sheet:[1250,2500]});}catch(e){err('гибка не считается',e);}}
    if(B){B.blanks.filter(b=>b.parts.length>1).forEach(b=>{const fs=b.parts.flatMap(pi=>facesOf(R.parts[pi])),at=polyC(V,P[fs[0]]);
        try{if(bendBlank(b,R,Vs,B,{t,gap:.5,useT:true}).bad)add(12,at,fs,[],0,'заготовка с гибкой не строится');}catch(e){err('заготовка с гибкой не строится',e,at,fs);}});
      if(!skip.has(15))B.J.forEach(j=>{if(/налезает/.test(B.why.get(j.id)||''))add(15,mid(j.A,j.B),[...facesOf(R.parts[j.p]),...facesOf(R.parts[j.q])],[j.A,j.B],0,'гибка не гнёт этот стык: развёртка налезла бы сама на себя',true);});}}
  // 13. грани смотрят наружу: у грани больше рёбер, обойдённых в ту же сторону, что у соседа, чем в обратную
  if(!skip.has(13)){const bad=P.map(()=>0),good=P.map(()=>0);ED.forEach(e=>{if(e.f.length!==2||e.f[0]===e.f[1])return;const s=e.d[0]===e.d[1]?bad:good;s[e.f[0]]++;s[e.f[1]]++;});
    P.forEach((Q,fi)=>{if(!DEG[fi]&&bad[fi]>good[fi])add(13,polyC(V,Q),[fi],Q.slice(),bad[fi],'грань смотрит внутрь (против соседей)');});
    // вся фигура вывернута: Σ (площадь·нормаль)·(центр грани − центр фигуры) < 0 — у замкнутой это 6 объёмов со знаком
    const c=V3.mul(V.reduce((s,p)=>V3.add(s,p),[0,0,0]),1/(V.length||1)),vol=OK.reduce((s,fi)=>s+V3.dot(NV[fi],V3.sub(polyC(V,P[fi]),c)),0);
    if(vol<0)add(13,c,OK.slice(),[],0,'фигура вывернута: все грани смотрят внутрь');}
  // 14. нет вырожденных граней
  if(!skip.has(14))P.forEach((Q,fi)=>{if(DEG[fi]){const a=V3.len(NV[fi])/2*sc*sc;add(14,polyC(V,Q),[fi],Q.slice(),a,`вырожденная грань: площадь ${fmtN(a)} мм²`);}});
  // 16. прорезь не уже толщины листа
  if(!skip.has(16)&&o.slots){const t=o.t||2,W=rulesClean().width;
    o.slots.forEach(L=>{if(L.length<3)return;const w=W(V,L)*sc;if(w<t)add(16,polyC(V,L),[...new Set(L.flatMap(i=>VF[i]))],L.slice(),w,`прорезь ${fmtN(w,1)} мм — уже листа ${fmtN(t,1)} мм`);});}
  let r=out;
  if(o.region){const c=o.region.c,R=o.region.r/sc,near=p=>V3.len(V3.sub(p,c))<=R;r=r.filter(i=>near(i.at)||i.verts.some(v=>near(V[v])));}
  if(o.keep&&o.keep.length)r=r.filter(i=>!o.keep.some(k=>keepMatch(i,k,sc)));
  return r.sort((a,b)=>a.rule-b.rule||(RULE_LOW.has(a.rule)?a.val-b.val:b.val-a.val));}
