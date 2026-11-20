// Проверка правил «чистой фигуры» (спека 2026-11-20-horse-page-design, номера правил — из спеки «Мастерская фигур»).
// const {checkFigure,TH}=require('./check.js')(run) — run: строка → значение из vm-контекста с mesh.js и edit.js.
// checkFigure(E,o): E={V:[[x,y,z]],P:[[i…]],S:[]}, мм; o={sym:true, ref:{V,P}|null}. Каждый список — что нарушает правило (пустой — правило выполнено):
//   planar  [pi]      1. грань не плоская: точка дальше 0,1 мм от плоскости грани
//   short   [[a,b]]   2. ребро короче 5 мм
//   step    [[a,b]]   3. две точки ближе 8 мм без ребра между ними
//   needle  [pi]      4. угол грани меньше 5°
//   narrow  [pi]      6. грань в детали уже 15 мм (деталь — как на сайте: buildParts 1,5° / 1,5 мм)
//   selfX   [pi]      9. грань пересекает сама себя
//   pierce  [pi]      9. грань протыкает другую
//   sym     [i]      10. у точки нет зеркальной (−x, y, z) ближе 0,1 мм
//   flipped [pi]     13. грань развёрнута против соседей (или вся фигура наизнанку)
//   degenerate [pi]  14. нулевая площадь или сторона
//   open    [[a,b]]      ребро не на двух гранях (фигура не замкнута)
//   far     [i]      11. точка дальше 2 мм от поверхности o.ref
//   extra   [{f1,f2,dih}] 7. лишний шов: соседние детали с изломом меньше 5° (только список, не сливаем)
//   parts   Number       деталей по buildParts
module.exports=function(run){const V3=run('V3'),polyNorm=run('polyNorm'),polyC=run('polyC'),polyDev=run('polyDev'),selfXPolys=run('selfXPolys'),piercePolys=run('piercePolys'),
    polyBase=run('polyBase'),buildParts=run('buildParts'),earClip=run('earClip');
  const TH={planar:.1,short:5,step:8,needle:5,narrow:15,sym:.1,far:2,extra:5,degArea:.01,degSide:.01};
  const ek=(a,b)=>a<b?a+'_'+b:b+'_'+a;
  // расстояние от точки до треугольника
  function triDist(p,a,b,c){const ab=V3.sub(b,a),ac=V3.sub(c,a),ap=V3.sub(p,a),d1=V3.dot(ab,ap),d2=V3.dot(ac,ap);if(d1<=0&&d2<=0)return V3.len(ap);
    const bp=V3.sub(p,b),d3=V3.dot(ab,bp),d4=V3.dot(ac,bp);if(d3>=0&&d4<=d3)return V3.len(bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return V3.len(V3.sub(p,V3.add(a,V3.mul(ab,v))));}
    const cp=V3.sub(p,c),d5=V3.dot(ab,cp),d6=V3.dot(ac,cp);if(d6>=0&&d5<=d6)return V3.len(cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return V3.len(V3.sub(p,V3.add(a,V3.mul(ac,w))));}
    const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return V3.len(V3.sub(p,V3.add(b,V3.mul(V3.sub(c,b),w))));}
    const den=1/(va+vb+vc),v=vb*den,w=vc*den;return V3.len(V3.sub(p,V3.add(a,V3.add(V3.mul(ab,v),V3.mul(ac,w)))));}
  // поверхность (многоугольники → треугольники) → функция «расстояние от точки»
  function surfDist(E){const T=[];E.P.forEach(Q=>(Q.length===3?[Q]:earClip(E.V,Q)).forEach(t=>T.push(t.map(i=>E.V[i]))));return p=>{let m=Infinity;T.forEach(t=>{const d=triDist(p,t[0],t[1],t[2]);if(d<m)m=d;});return m;};}
  // площадь многоугольника в пространстве
  const polyArea=(V,Q)=>{let s=[0,0,0];Q.forEach((i,k)=>{s=V3.add(s,V3.cross(V[i],V[Q[(k+1)%Q.length]]));});return V3.len(s)/2;};
  function checkFigure(E,o){o=o||{};const V=E.V,P=E.P,R={planar:[],short:[],step:[],needle:[],narrow:[],selfX:[],pierce:[],sym:[],flipped:[],degenerate:[],open:[],far:[],extra:[],parts:0};
    // рёбра: ключ → [грань, a, b] в порядке обхода грани
    const EF=new Map();P.forEach((Q,pi)=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=ek(a,b);(EF.get(key)||EF.set(key,[]).get(key)).push([pi,a,b]);}));
    P.forEach((Q,pi)=>{if(polyDev(V,Q)>TH.planar)R.planar.push(pi);
      const n=Q.length;let deg=new Set(Q).size!==n||polyArea(V,Q)<TH.degArea;
      Q.forEach((b,k)=>{const a=V[Q[(k+n-1)%n]],c=V[Q[(k+1)%n]],u=V3.sub(a,V[b]),w=V3.sub(c,V[b]),lu=V3.len(u),lw=V3.len(w);if(lw<TH.degSide)deg=true;
        if(lu>1e-9&&lw>1e-9&&Math.acos(Math.max(-1,Math.min(1,V3.dot(u,w)/lu/lw)))*180/Math.PI<TH.needle&&!R.needle.includes(pi))R.needle.push(pi);});
      if(deg)R.degenerate.push(pi);});
    EF.forEach((fs,key)=>{const [a,b]=key.split('_').map(Number);if(V3.len(V3.sub(V[a],V[b]))<TH.short)R.short.push([a,b]);if(fs.length!==2)R.open.push([a,b]);});
    // ступенька: близкие точки без ребра
    for(let i=0;i<V.length;i++)for(let j=i+1;j<V.length;j++)if(V3.len(V3.sub(V[i],V[j]))<TH.step&&!EF.has(ek(i,j)))R.step.push([i,j]);
    R.selfX=selfXPolys(E);R.pierce=piercePolys(E);
    // грани наружу: соседняя грань проходит общее ребро в обратную сторону; против большинства соседей — развёрнута; объём < 0 — наизнанку вся
    let vol=0;P.forEach(Q=>{const c=polyC(V,Q);vol+=V3.dot(c,polyNorm(V,Q))*polyArea(V,Q);});
    P.forEach((Q,pi)=>{let good=0,bad=0;Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length];(EF.get(ek(a,b))||[]).forEach(([pj,x])=>{if(pj===pi)return;if(x===a)bad++;else good++;});});if(bad>good||vol<0&&bad===0)R.flipped.push(pi);});
    if(o.sym)V.forEach((p,i)=>{const q=[-p[0],p[1],p[2]];if(!V.some(r=>V3.len(V3.sub(r,q))<=TH.sym))R.sym.push(i);});
    if(o.ref){const d=surfDist(o.ref);V.forEach((p,i)=>{if(d(p)>TH.far)R.far.push(i);});}
    // детали — как на сайте; узкие и лишние швы
    const M=polyBase(V,P,E.S),B=buildParts(M,1.5,1.5),polyOf=pt=>M.T[B.parts[pt].tris[0]];R.parts=B.parts.length;
    const narrowParts=new Set(B.parts.filter(p=>p.minW<TH.narrow).map(p=>p.id));M.T.forEach((pi,ti)=>{if(narrowParts.has(B.partOf[ti])&&!R.narrow.includes(pi))R.narrow.push(pi);});
    const seen=new Set();B.edges.forEach(e=>{if(e.open||e.p.length!==2)return;const fold=Math.abs(180-e.dih);if(fold>=TH.extra)return;const k=ek(e.p[0],e.p[1]);if(seen.has(k))return;seen.add(k);
      R.extra.push({f1:polyOf(e.p[0]),f2:polyOf(e.p[1]),p1:e.p[0],p2:e.p[1],dih:+fold.toFixed(2)});});
    return R;}
  // нарушено ли правило: списки, кроме parts
  const broken=R=>Object.keys(R).filter(k=>k!=='parts'&&k!=='extra'&&R[k].length);
  return {checkFigure,TH,surfDist,triDist,broken};};
