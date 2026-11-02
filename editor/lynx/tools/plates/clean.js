// чистка многогранника: короткие рёбра → одна точка; лишние швы (малый излом, у эталона пусто) → список
// как модуль: const C=require('./clean.js')(g)  — g: имя → значение из vm-контекста с mesh.js и edit.js
//   C.solve(E,pins,o)            — выравнивание с минимальной правкой (точки pins на месте, плиты плоские, прочие — как можно ближе к прежним)
//   C.collapseShort(E,o)         — {E, log, I}; o: maxLen=13, sym=true, tol=.5 мм неплоскости, minW=15; o.keep — без compact; I — номер исходной грани у каждой грани
//   C.mergeSeam(E,f1,f2,o)       — {E, moved, why} плиты f1 и f2 (и зеркальные) — одна, выравнивание; why — почему нельзя; o.keep — без compact (нумерация точек та же)
//   C.extraSeams(E,o)            — [{f1,f2,L,dih,at,edges,mid}] швы с изломом ≤ o.ang (15°) без линии и излома эталона; o.samples и o.surfD из creases.js, o.map — в координаты эталона
module.exports=function(g){const V3=g('V3'),polyNorm=g('polyNorm'),polyC=g('polyC'),polyDev=g('polyDev'),mirrorMap=g('mirrorMap'),openVerts=g('openVerts'),selfXPolys=g('selfXPolys'),compact=g('compact');
  const solve3=(M,r)=>{const d=(a,b,c)=>a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);const c0=[M[0][0],M[1][0],M[2][0]],c1=[M[0][1],M[1][1],M[2][1]],c2=[M[0][2],M[1][2],M[2][2]],D=d(c0,c1,c2);if(Math.abs(D)<1e-12)return null;return [d(r,c1,c2)/D,d(c0,r,c2)/D,d(c0,c1,r)/D];};
  function solve(E,pins,o){o=o||{};const LAM0=o.lam??.05,IT=o.it||400,DEC=o.dec??.985,PIN=50,sym=o.sym!==false;
    const mm=sym?mirrorMap(E.V):null,open=openVerts(E),VP=E.V.map(()=>[]);E.P.forEach((Q,fi)=>Q.forEach(i=>VP[i].push(fi)));
    const tgt=new Map();pins.forEach((q,i)=>{tgt.set(i,q);if(mm&&mm[i]>=0&&!pins.has(mm[i]))tgt.set(mm[i],[-q[0],q[1],q[2]]);});
    let V=E.V.map(p=>p.slice());tgt.forEach((q,i)=>V[i]=q.slice());const V0=o.anchor||E.V;
    for(let it=0;it<IT;it++){const LAM=Math.max(o.lmin??1e-5,LAM0*Math.pow(DEC,it)),PL=E.P.map((Q,f)=>{if(o.fix&&o.fix.has(f)){const n=o.fix.get(f).n;return {n,d:V3.dot(n,polyC(V,Q))};}const n=polyNorm(V,Q);return {n,d:V3.dot(n,polyC(V,Q))};});
      V=V.map((p,i)=>{const M=[[LAM,0,0],[0,LAM,0],[0,0,LAM]],r=V3.mul(V0[i],LAM),add=(n,d,w=1)=>{for(let x=0;x<3;x++){for(let y=0;y<3;y++)M[x][y]+=w*n[x]*n[y];r[x]+=w*n[x]*d;}};
        VP[i].forEach(f=>{if(E.P[f].length>3)add(PL[f].n,PL[f].d);});
        if(mm&&mm[i]===-2)add([1,0,0],0,10);if(open.has(i)&&Math.abs(E.V[i][2])<.5)add([0,0,1],0,10);
        if(tgt.has(i)){const q=tgt.get(i);for(let x=0;x<3;x++){M[x][x]+=PIN;r[x]+=PIN*q[x];}}
        return solve3(M,r)||p;});}
    if(mm)V=V.map((p,i)=>mm[i]===-2?[0,p[1],p[2]]:mm[i]>=0&&i>mm[i]?[-V[mm[i]][0],V[mm[i]][1],V[mm[i]][2]]:p);
    return {V,P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())};}
  const ekey=(a,b)=>a<b?a+'_'+b:b+'_'+a;
  const edgeFaces=E=>{const EF=new Map();E.P.forEach((Q,fi)=>Q.forEach((a,k)=>{const kk=ekey(a,Q[(k+1)%Q.length]);if(!EF.has(kk))EF.set(kk,[]);EF.get(kk).push(fi);}));return EF;};
  // самая узкая плита, мм: минимум по сторонам «ширины» многоугольника в его плоскости
  const width=(V,Q)=>{const n=polyNorm(V,Q),o=V[Q[0]];let u=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];u=V3.norm(V3.sub(u,V3.mul(n,V3.dot(u,n))));const w=V3.cross(n,u),P=Q.map(i=>{const d=V3.sub(V[i],o);return [V3.dot(d,u),V3.dot(d,w)];});
    let best=1e9;P.forEach((a,k)=>{const b=P[(k+1)%P.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<1e-6)return;const nx=-dy/l,ny=dx/l;let lo=1e9,hi=-1e9;P.forEach(p=>{const s=(p[0]-a[0])*nx+(p[1]-a[1])*ny;lo=Math.min(lo,s);hi=Math.max(hi,s);});best=Math.min(best,hi-lo);});return best;};
  const stats=E=>({dev:Math.max(0,...E.P.map(Q=>polyDev(E.V,Q))),sx:selfXPolys(E).length,nar:E.P.filter(Q=>width(E.V,Q)<15).length});
  // короткие рёбра двух плит → одна точка (с зеркальным); после каждого места выравнивание и проверка, иначе откат
  // точку не закрепляем: из середины ребра она сама встаёт на пересечение плоскостей своих плит (закреплённая середина или проекция на эталон уводили соседей дальше от эталона)
  function collapseShort(E,o){o=o||{};const MAX=o.maxLen??13,sym=o.sym!==false,TOL=o.tol??.5,MINW=o.minW??15,log=[];
    E={V:E.V.map(p=>p.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())};const skip=new Set();let I=E.P.map((_,i)=>i);
    for(let guard=0;guard<200;guard++){const mm=sym?mirrorMap(E.V):null,open=openVerts(E),EF=edgeFaces(E),st0=stats(E);
      let best=null;EF.forEach((fs,kk)=>{if(fs.length!==2||skip.has(kk))return;const [a,b]=kk.split('_').map(Number),L=V3.len(V3.sub(E.V[b],E.V[a]));if(L>=MAX||best&&L>=best.L)return;best={a,b,L,kk};});
      if(!best)break;const {a,b,L,kk}=best,at=E.V[a].map(Math.round).join(','),no=why=>{skip.add(kk);if(mm&&mm[a]>=0&&mm[b]>=0)skip.add(ekey(mm[a],mm[b]));log.push({at,a,b,L,done:false,why});};
      if(open.has(a)||open.has(b)){no('край (глаз или стена)');continue;}
      if(mm&&(mm[a]===-2)!==(mm[b]===-2)&&mm[a]!==b){no('один конец на середине');continue;}
      const p=V3.mul(V3.add(E.V[a],E.V[b]),.5);if(mm&&(mm[a]===-2||mm[a]===b))p[0]=0;
      // b → a у всех плит (и зеркальная пара); плиты-двуугольники уходят
      const pairs=[[b,a]];if(mm&&mm[a]>=0&&mm[b]>=0&&mm[a]!==b)pairs.push([mm[b],mm[a]]);
      const T={V:E.V.map(v=>v.slice()),P:E.P.map(Q=>Q.slice()),S:E.S.map(s=>s.slice())};
      T.V[a]=p;if(pairs[1])T.V[pairs[1][1]]=[-p[0],p[1],p[2]];
      let pinch=false;pairs.forEach(([x,y])=>{T.P=T.P.map(Q=>Q.map(i=>i===x?y:i).filter((v,k,A)=>v!==A[(k+1)%A.length]));T.S=T.S.map(s=>s.map(i=>i===x?y:i)).filter(s=>s[0]!==s[1]);});
      const TI=I.filter((_,k)=>T.P[k].length>=3);T.P=T.P.filter(Q=>Q.length>=3);T.P.forEach(Q=>{if(new Set(Q).size!==Q.length)pinch=true;});if(pinch){no('плита перехлестнулась');continue;}
      const own=new Set(pairs.flat()),R=solve(T,new Map(),{it:o.it||600,sym,anchor:T.V.map((v,i)=>own.has(i)?v:E.V[i])}),st=stats(R);
      const mv=Math.max(0,...R.V.map((v,i)=>own.has(i)?0:V3.len(V3.sub(v,E.V[i]))));
      if(st.dev>Math.max(TOL,st0.dev+.05)){no('неплоско '+st.dev.toFixed(2)+' мм');continue;}
      if(st.sx>st0.sx){no('самопересечение');continue;}
      if(R.P.filter(Q=>width(R.V,Q)<MINW).length>st0.nar){no('узкая плита');continue;}
      log.push({at,a,b,L,done:true,moved:mv,pair:!!pairs[1]});E=R;I=TI;}
    return {E:o.keep?E:compact(E),log,I};}
  // лишние швы: две плиты с изломом ≤ ang°, у эталона в 3 мм ни линии, ни излома; плиты в одной плоскости (≤ flat°) — и так одна деталь, пропускаем
  function extraSeams(E,o){o=o||{};const ANG=o.ang??15,FLAT=o.flat??1.5,MINL=o.minL??25,map=o.map||(p=>p),mm=mirrorMap(E.V),EF=edgeFaces(E),r=[];
    // плиты по швам: соседние ребра одной пары плит — один шов
    const pairs=new Map();EF.forEach((fs,kk)=>{if(fs.length!==2)return;const k=fs[0]<fs[1]?fs.join('_'):fs[1]+'_'+fs[0];if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(kk.split('_').map(Number));});
    const S=new Set((E.S||[]).map(([a,b])=>ekey(a,b)));
    pairs.forEach((es,k)=>{const [f1,f2]=k.split('_').map(Number),n1=polyNorm(E.V,E.P[f1]),n2=polyNorm(E.V,E.P[f2]),dih=Math.acos(Math.max(-1,Math.min(1,V3.dot(n1,n2))))*180/Math.PI;if(dih>ANG||dih<=FLAT)return;
      if(es.some(([a,b])=>S.has(ekey(a,b))))return;   // шов проведён руками — не трогаем
      const L=es.reduce((s,[a,b])=>s+V3.len(V3.sub(E.V[b],E.V[a])),0);if(L<MINL)return;
      const sm=[];es.forEach(([a,b])=>{const u=V3.norm(V3.sub(E.V[b],E.V[a]));[.25,.5,.75].forEach(t=>sm.push({m:map(V3.add(E.V[a],V3.mul(V3.sub(E.V[b],E.V[a]),t))),u,n1,n2}));});
      if(o.surfD&&sm.filter(x=>o.surfD(x.m)<3).length<sm.length/2)return;   // эталона рядом нет (у стены) — судить не по чему
      const s=o.samples(sm),hasLine=s.nl&&s.line3>0,hasCrease=s.nc&&s.in3>0;if(hasLine||hasCrease)return;
      const c=V3.mul(es.reduce((q,[a,b])=>V3.add(q,V3.add(E.V[a],E.V[b])),[0,0,0]),.5/es.length);r.push({f1,f2,L,dih,at:c.map(Math.round),edges:es,mid:es.every(([a,b])=>mm[a]===-2&&mm[b]===-2)});});
    return r.sort((x,y)=>y.L-x.L);}
  function mergeSeam(E,f1,f2,o){o=o||{};const sym=o.sym!==false,mm=sym?mirrorMap(E.V):null,T={V:E.V.map(v=>v.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())},st0=stats(E);
    const jobs=[[E.P[f1],E.P[f2]]];if(mm){const m1=g('mirrorPoly')(E,f1,mm),m2=g('mirrorPoly')(E,f2,mm);if(m1>=0&&m2>=0&&!(m1===f1&&m2===f2)&&!(m1===f2&&m2===f1))jobs.push([E.P[m1],E.P[m2]]);}
    const same=(Q,R)=>Q.length===R.length&&Q.every((v,k)=>v===R[k]);
    for(const [A,B] of jobs){const i=T.P.findIndex(Q=>same(Q,A)),j=T.P.findIndex(Q=>same(Q,B));if(i<0||j<0)return {why:'плиты не найдены'};const L=g('mergeTwo')(T.P,i,j);if(!L)return {why:'не сливаются (дыра)'};
      T.P.splice(Math.max(i,j),1);T.P.splice(Math.min(i,j),1);T.P.push(L);}
    // точки на бывшем шве, оставшиеся с двумя соседями по контуру на одной прямой, остаются — compact их не трогает; выравниваем
    const R=solve(T,new Map(),{it:o.it||600,sym}),st=stats(R),moved=Math.max(0,...R.V.map((v,i)=>V3.len(V3.sub(v,E.V[i]))));
    const why=st.dev>Math.max(o.tol??.5,st0.dev+.05)?'неплоско '+st.dev.toFixed(2)+' мм':st.sx>st0.sx?'самопересечение':st.nar>st0.nar?'узкая плита':null;
    return {E:o.keep?R:compact(R),moved,why,n:jobs.length};}
  return {solve,collapseShort,mergeSeam,extraSeams,width,stats};};
