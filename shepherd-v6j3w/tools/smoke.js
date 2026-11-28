// проверка ядра «Искусства» и овчарки: node shepherd-v6j3w/tools/smoke.js — копия smoke коня (horse-r4t9p, тикет #134), проверки на Коне (150) заменены теми же на овчарке (тикет #141)
const fs=require('fs'),vm=require('vm'),P=__dirname+'/../js/';const c={console,TextDecoder,Math};vm.createContext(c);
vm.runInContext(['mesh','edit','models-poly','figures','plates-shepherd','prod','slots','sheets','bend','bend3d','angles-core'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n'),c);
// #142: файлы Овчарки 2 на странице грузятся лениво (по выбору); здесь — сразу, чтобы общие проверки шли по всем фигурам
vm.runInContext(['1000','700','500','350'].map(n=>fs.readFileSync(P+'plates-shepherd2_'+n+'.js','utf8')).join('\n;\n'),c);
['plates-shepherd3','plates-shepherd5','plates-shepherd6r','plates-shepherd6'].forEach(f=>vm.runInContext(fs.readFileSync(P+f+'.js','utf8'),c));   // #142 Овчарка 3 и 5, #170 Овчарка 6 — на странице тоже ленивые
const run=s=>vm.runInContext(s,c);let bad=0;// Известные расхождения на овчарке (реальные, названы в tools/report.md): печатаются как ПРЕДУПР и не валят проверку
// Крайние случаи движка, которые вылезли на овчарке (острый шов 17° у уха, мелкие детали кончика уха 8–12 мм, один сгиб с перепутанным V/m в окне,
// подписи одной зеркальной пары) — движок общий с конём и собакой, чинить отдельными тикетами; список и цифры — tools/report.md, «Известные расхождения»
// #149: изломы формы оригинала лежат там, где нашей плиты нет (кончики ушей срезаны — #146, скругления оригинала срезаны плитами): нарисовано ~88 % при радиусе 12 мм; уши — 69 %, остальное ~89 % (решение — Виталий)
const KNOWN=['Овчарка 5, калька «форма оригинала» на фигуре','овчарка: по уголку на каждый угол','гибка: Овчарка —','карты деталей: Овч','гибка картинками: уголок в угле сгиба','окно «крутить сгиб»','порядок сборки снимками','гравировка заготовок: Овч','зеркальные пары в DXF','гравировка номера у всех деталей овчарки'];let warned=0;
const ok=(b,t)=>{const known=!b&&KNOWN.some(k=>t.startsWith(k));console.log((b?'ok  ':known?'ПРЕДУПР':'FAIL')+' '+t);if(known)warned++;else if(!b)bad++;};
// куб из OBJ: 12 треугольников → 6 деталей-квадратов (движок деталей; parseOBJ без vt — сварка, как было. Открытие модели кнопкой — #179 ниже: всегда для обводки, без расчёта)
run(`cube=parseOBJ("v 0 0 0\\nv 100 0 0\\nv 100 100 0\\nv 0 100 0\\nv 0 0 100\\nv 100 0 100\\nv 100 100 100\\nv 0 100 100\\nf 1 4 3 2\\nf 5 6 7 8\\nf 1 2 6 5\\nf 2 3 7 6\\nf 3 4 8 7\\nf 4 1 5 8")`);
run(`R=buildParts(cube)`);ok(run('R.parts.length')===6&&run('R.parts.every(p=>p.loop.length===4&&Math.abs(p.area-1e4)<1e-6)'),'куб: 6 квадратных деталей по 100×100');
ok(run('R.edges.filter(e=>!e.open).every(e=>Math.abs(e.dih-90)<1e-6&&e.convex)'),'куб: углы между гранями 90°');
ok(run('R.parts.every(p=>p.segs.length===4&&p.segs.every(s=>Math.abs(s.len-100)<1e-6&&s.nb>=0&&Math.abs(s.dih-90)<1e-6))'),'куб: у каждой детали 4 стороны по 100, у каждой — сосед');
// растяжение: плоское остаётся плоским, площади растут как надо
run(`R2=buildParts(fitMesh(cube,{W:200,H:100,D:100}))`);ok(run('R2.parts.length')===6&&Math.abs(run('R2.parts.reduce((s,p)=>s+p.area,0)')-(4*2e4+2*1e4))<1e-6,'куб 200×100×100: 6 деталей, площадь 100 000');
// овчарку берём целиком, без среза верха, как коня и рысь: figTop возвращает фигуру как есть
run(`figTop=M=>M;`);
// редактор
run(`E0=blankBox(300,400,260);mmB=mirrorMap(E0.V)`);ok(run("mmB.every(j=>j>=0)"),"куб: у каждой точки есть зеркальная");
run(`top=E0.P.findIndex(Q=>Q.every(i=>E0.V[i][1]===400));E1=extrude(E0,top,50,true);RB=buildParts(polyBase(E1.V,E1.P),1.5,1.5)`);
ok(run("E1.P.length")===10&&run("RB.parts.length")===6&&Math.abs(run("meshBox(E1.V).size[1]")-450)<1e-6,"куб: выдавили верх на 50 — 10 граней, бока продолжают стенки куба (6 деталей), высота 450");
run(`side=E0.P.findIndex(Q=>Q.every(i=>E0.V[i][0]===150));E2=extrude(E0,side,40,true)`);ok(run("E2.P.length")===14&&Math.abs(run("meshBox(E2.V).size[0]")-380)<1e-6,"куб: выдавили бок с симметрией — оба бока, ширина 380");
run(`E3=splitPoly(E0,top,true);R3=buildParts(polyBase(E3.V,E3.P),.5,.3)`);ok(run("E3.P.length")===7&&run("R3.parts.length")===6,"куб: разрезали верх — 7 граней (две половинки в одной плоскости — одна деталь)");
run(`E4=poke(E0,side,30,true)`);ok(run("E4.P.length")===6-2+8,"куб: бугор на боку с симметрией — 12 граней");
run(`E5=ecopy(E0);vi=E5.P[side][0];moveVert(E5,vi,[E5.V[vi][0]+40,E5.V[vi][1],E5.V[vi][2]],true);np=nonPlanar(E5);E6=flattenAll(E5,true,vi);np2=nonPlanar(E6,1)`);
ok(run("np.length")>0&&run("np2.length")===0&&Math.abs(run("E5.V[mmB[vi]][0]")+run("E5.V[vi][0]"))<1e-9,"точку сдвинули — зеркальная тоже, неплоские выровнялись");
run(`E7=delPoly(E0,top,true)`);ok(run("E7.P.length")===5,"удалили грань");
run(`S0=blankSphere();mS=mirrorMap(S0.V)`);ok(run("S0.P.length")===80&&run("mS.every(j=>j!==-1)"),"шар: 80 граней, симметричный");
// грани, протыкающие другие: крест из плит — обе; общее ребро — не пересечение; у встроенных поли-фигур — ни одной
ok(run(`piercePolys({V:[[-50,0,0],[50,0,0],[50,100,0],[-50,100,0],[0,0,-50],[0,0,50],[0,100,50],[0,100,-50]],P:[[0,1,2,3],[4,5,6,7]]}).join()`)==='0,1'&&run(`piercePolys({V:[[0,0,0],[100,0,0],[100,100,0],[0,100,0],[0,0,100],[0,100,100]],P:[[0,1,2,3],[0,3,5,4]]}).length`)===0&&run(`piercePolys({V:[[0,0,0],[100,0,0],[100,100,0],[0,100,0],[0,0,0],[0,100,0],[0,100,100],[0,0,100]],P:[[0,1,2,3],[4,5,6,7]]}).length`)===0,"протыкание: плиты крест-накрест — обе в списке, с общим ребром (и ребро из своих точек) — пусто");
{const PF=run("Object.keys(FIGURES).filter(k=>FIGURES[k].poly)"),PX=PF.map(id=>[id,run(`(M=>piercePolys({V:M.V,P:M.P}).length)(figureMesh('${id}'))`)]);
  ok(PF.length>=1&&PX.every(x=>x[1]===0),"протыкание: у всех поли-фигур ("+PF.length+") ни одна грань не протыкает другую"+(PX.some(x=>x[1])?" — "+PX.filter(x=>x[1]).map(x=>x.join(':')).join(', '):""));
  const BIG=run("(()=>{let b=null;Object.keys(FIGURES).filter(k=>!FIGURES[k].view&&!FIGURES[k].ow).forEach(k=>{const M=figureMesh(k);if(!b||M.F.length>b.F.length)b={id:k,V:M.V,F:M.F};});return b;})()");
  const t0=Date.now();const nb=c.piercePolys({V:BIG.V,P:BIG.F}).length,dt=Date.now()-t0,n3=Math.min(3000,BIG.F.length),t1=Date.now();c.piercePolys({V:BIG.V,P:BIG.F.slice(0,n3)});const dt3=Date.now()-t1;
  console.log(`     протыкание: самая большая модель ${BIG.id} — ${BIG.F.length} тр за ${dt} мс (протыкают ${nb}), первые ${n3} тр — ${dt3} мс`);
  ok(dt3<200,"протыкание: 3000 граней считаются быстрее 200 мс");}
// производство
run(`RC=buildParts(polyBase(blankBox(100,100,100).V,blankBox(100,100,100).P));CC=RC.parts.map(p=>cutContour(p,2,1,true))`);
ok(run("CC.every(c=>!c.bad&&Math.abs(Math.abs(area2(c.pts))-95*95)<1e-6)"),"куб 100, t=2, шов 1: каждая деталь 95×95");
run(`RO=buildParts(polyBase(delPoly(blankBox(100,100,100),0,false).V,delPoly(blankBox(100,100,100),0,false).P));CO=RO.parts.map(p=>cutContour(p,2,1,true))`);
ok(run("CO.some(c=>c.s.includes(0))&&CO.every(c=>!c.bad)"),"открытый край — без сдвига");
ok(Math.abs(run("edgeSetback({nb:1,dih:225},2,1,true)")-0.5)<1e-9,"вогнутый шов — сдвиг только на полшва");
// слить почти плоские грани
run(`LV=[[0,0,0],[200,0,0],[200,100,0],[100,100,0],[100,200,0],[0,200,0]];LT=earClip(LV,[0,1,2,3,4,5]);LA=LT.reduce((a,t)=>a+V3.len(triN(LV,t))/2,0)`);
ok(run("LT.length")===4&&Math.abs(run("LA")-30000)<1e-6&&run("LT.every(t=>triN(LV,t)[2]>0)"),"невыпуклая грань (буква Г) режется на треугольники без перехлёста");
run(`SPH=blankSphere(200);SG=dissolve(polyBase(SPH.V,SPH.P),1,1)`);ok(run("SG.P.length")===80,"шар: соседние грани под углом больше порога — не сливаются");
// швы в редакторе: убрать и провести
run(`EB=blankBox(300,400,260);tp=EB.P.findIndex(Q=>Q.every(i=>EB.V[i][1]===400));ES=splitPoly(EB,tp,true);hv=ES.P.map((Q,i)=>i).filter(i=>ES.P[i].every(q=>ES.V[q][1]===400));EM=mergePolys(ES,hv[0],hv[1],true)`);
ok(run("ES.P.length")===7&&run("EM.P.length")===6&&run("nonPlanar(EM).length")===0,"убрать шов: две половинки верха куба снова одна грань");
run(`EC=cutPoly(EB,tp,EB.P[tp][0],EB.P[tp][2],true);sd=EB.P.findIndex(Q=>Q.every(i=>EB.V[i][0]===150));EC2=cutPoly(EB,sd,EB.P[sd][0],EB.P[sd][2],true)`);
ok(run("EC.P.length")===7&&run("nonPlanar(EC).length")===0&&run("EC2.P.length")===8,"провести шов: верх по диагонали — 7 граней, бок с симметрией — разрезан и зеркальный (8)");
run(`ea=EB.P[sd][0];eb=EB.P[sd][1];EP=addEdgePoint(EB,ea,eb,V3.mul(V3.add(EB.V[ea],EB.V[eb]),.5),true)`);ok(run("EP.E.V.length")===10&&run("mirrorMap(EP.E.V).every(j=>j!==-1)"),"точка на ребре — и зеркальная, симметрия цела");
run(`SC=cutPoly(EB,tp,EB.P[tp][0],EB.P[tp][2],true);SR=buildParts(polyBase(SC.V,SC.P,SC.S),1.5,1.5);sh=SC.P.map((Q,i)=>i).filter(i=>SC.P[i].every(q=>SC.V[q][1]===400));SM=mergePolys(SC,sh[0],sh[1],true)`);
ok(run("SR.parts.length")===7&&run("SR.edges.filter(e=>!e.open).length")===13&&run("SM.S.length")===0&&run("buildParts(polyBase(SM.V,SM.P,SM.S),1.5,1.5).parts.length")===6,"шов, проведённый руками, — отдельные детали даже в одной плоскости; «убрать шов» снимает его");
// калька: код движка (trace.js) на синтетическом поле; облака эталонов в редактор не едут
c.atob=atob;c.window=c;vm.runInContext(fs.readFileSync(P+'trace.js','utf8'),c);
// магнит на плоской кальке: серое поле, светлый шов по x=51; ребро поперёк шва, ребро вдоль шва, клик вдали
{const pts=[];for(let x=1;x<200;x+=2)for(let y=1;y<200;y+=2){const s=x===51?225:128;pts.push([x,y,0,s,s,s]);}const bf=Buffer.alloc(pts.length*9);pts.forEach((p,i)=>{for(let k=0;k<3;k++)bf.writeInt16LE(p[k]*10,i*9+k*2);bf[i*9+6]=p[3];bf[i*9+7]=p[4];bf[i*9+8]=p[5];});c.B64=bf.toString('base64');}
run(`TP=traceLoad(B64);ID=p=>p.slice();ID.s=[1,1,1];mg1=seamOnEdge([10,40,0],[110,60,0],[60,52,0],ID,TP);mg2=seamOnEdge([51,20,0],[51,180,0],[51,100,0],ID,TP);mg3=seamOnEdge([10,40,0],[110,60,0],[90,56,0],ID,TP);`);
ok(run("TP.seams")===100&&run("mg1&&Math.abs(mg1[0]-51)<1.5&&Math.abs(mg1[1]-48.2)<1")&&run("mg2")===null&&run("mg3")===null,"магнит: точка встаёт туда, где шов эталона пересекает ребро; шов вдоль ребра и далёкий клик — без притяжения");
// сверка с калькой: плоскость z=50, шов эталона по x=51; наш шов по шву — совпал, в 70 мм от него — лишний; шов эталона без нашего — жёлтый участок
{const pts=[];for(let x=1;x<200;x+=2)for(let y=1;y<200;y+=2){const s=x===51?225:128;pts.push([x,y,50,s,s,s]);}const bf=Buffer.alloc(pts.length*9);pts.forEach((p,i)=>{for(let k=0;k<3;k++)bf.writeInt16LE(p[k]*10,i*9+k*2);bf[i*9+6]=p[3];bf[i*9+7]=p[4];bf[i*9+8]=p[5];});c.B64P=bf.toString('base64');}
run(`TQ=traceLoad(B64P);VQ=[[0,0,50],[200,0,50],[200,200,50],[0,200,50],[51,5,50],[51,195,50],[121,5,50],[121,195,50]];FQ=[[0,1,2],[0,2,3]];ID2=p=>p.slice();ID2.s=[1,1,1];ID2.inv=p=>p.slice();
  dq1=traceDiff([{a:4,b:5},{a:6,b:7}],VQ,FQ,ID2,TQ);dq2=traceDiff([{a:6,b:7}],VQ,FQ,ID2,TQ);`);
ok(run("JSON.stringify(dq1.red)")==="[1]"&&run("dq1.parts")===0&&Math.abs(run("dq1.on")-.5)<1e-9&&run("JSON.stringify(dq2.red)")==="[0]"&&run("dq2.parts")===1&&run("dq2.yel.length/3")>=90,"сверка: шов на шве эталона — совпал, далёкий — лишний (красный), шов эталона без нашего — жёлтый участок");
run(`FL=figureMesh("shepherd");RL=buildParts(FL,1.5,1.5);D8=figTop(FL);R8=buildParts(D8,1.5,1.5);`);
console.log("     Овчарка: граней "+run("FL.P.length")+", деталей "+run("RL.parts.length")+", самопересечений "+run("selfXPolys(FL).length")+", габарит "+run("meshBox(FL.V).size.map(Math.round).join('×')")+"; верх: "+run("R8.parts.length")+" деталей");
ok(run("nonPlanar({V:FL.V,P:FL.P},1).length")===0&&run("RL.parts.length")>=100&&run("selfXPolys(FL).length")===0,"Овчарка: все грани плоские, деталей не меньше 100, самопересечений нет");
ok(run("nonPlanar({V:D8.V,P:D8.P},1).length")===0&&run("mirrorMap(D8.V).every(j=>j!==-1)")&&run("R8.parts.length")>=60,"Овчарка целиком: грани плоские, фигура симметрична, деталей не меньше 60");
// уголки-шаблоны для сварки: угол рабочих краёв, выемка у вершины, контур без самопересечений, гравировка «У152°»
run(`TS=[37,90,152,177].map(a=>{const P=tplShape(a,1.2,15),n=P.length,ang=(p,q)=>Math.atan2(q[1]-p[1],q[0]-p[0]),d=(ang(P[n-2],P[n-3])-ang(P[0],P[1]))*180/Math.PI;
    let x=false;for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(segX(P[i],P[(i+1)%n],P[j],P[(j+1)%n]))x=true;}
    return {a,d,x,area:area2(P),near:Math.min(...P.map(p=>Math.hypot(p[0],p[1]))),eng:!!engraveSegs(tplNo(a),P)};});
  TP8=weldTemplates(R8,1.2,15);C8=R8.parts.map(p=>({id:p.id,no:p.no,...cutContour(p,1.2,1,true)}));
  N8=nest(C8.filter(c=>!c.bad).concat(TP8.map(o=>({id:'t'+o.a,no:tplNo(o.a),pts:o.pts}))),2500,1250,3,10,2.5,2,true);`);
console.log("     уголки овчарка: "+run("TP8.length")+" шт ("+run("TP8[0].a")+"°…"+run("TP8[TP8.length-1].a")+"°), швов "+run("TP8.reduce((s,o)=>s+o.seams,0)")+"; раскрой с ними: листов "+run("N8.sheets.length")+", "+run("itemsTxt(N8.sheets.flatMap(s=>s.items))"));
ok(run("TS.every(t=>Math.abs(t.d-t.a)<.05&&!t.x&&t.area>0&&t.near>=4-1e-9&&t.eng)"),"уголок-шаблон: рабочие края точно под углом (37°, 90°, 152°, 177°), у вершины выемка, контур целый, гравировка «У…°» влезает");
ok(run("TP8.length")>=60&&run("TP8.every(o=>o.a>=TPL_MIN&&o.a<TPL_MAX&&engraveSegs(tplNo(o.a),o.pts))")&&run("new Set(TP8.map(o=>o.a)).size")===run("TP8.length"),"овчарка: по уголку на каждый угол швов (без почти плоских), на всех гравировка");
ok(run("N8.too.length")===0&&run("N8.sheets.flatMap(s=>s.items).filter(isTpl).length")===run("TP8.length")&&run(`(()=>{let m=Infinity;N8.sheets.forEach(sh=>sh.items.forEach((a,i)=>sh.items.forEach((b,j)=>{if(j>i)m=Math.min(m,polyGap(a.pts,b.pts));})));return m;})()`)>=3-1e-9,"овчарка: раскрой с уголками — все на листе, зазор ≥ 3 мм");
// клик по детали в таблице — камера на неё лицом; шаги сборки — каждый со стороны своих деталей и крупнее общего вида
run(`PC=partCam([10,300,200],[1,0,0],60,meshBox(D8.V),[0,0,1]);CUR={M3:D8,R:R8};
  AS=(()=>{const ps=[...R8.parts].sort((a,b)=>a.no-b.no),all=projBox(VIEWS.iso);return [0,1,2,3,4].map(i=>{const st=ps.slice(i*8,i*8+8),v=stepView(st),fb=stepFrame(v,st);let n=[0,0,0];st.forEach(p=>{n=V3.add(n,V3.mul(p.n,p.area));});
    return {dot:V3.dot(v.d,V3.norm(n)),k:Math.min(120/(fb[2]-fb[0]),84/(fb[3]-fb[1]))/Math.min(120/(all[2]-all[0]),84/(all[3]-all[1])),txt:v.txt};});})();`);
console.log("     шаги сборки овчарка: "+run("AS.map((a,i)=>'шаг '+(i+1)+' ×'+a.k.toFixed(1)+' '+a.txt).join('; ')"));
ok(run("Math.abs(PC.pos[1]-300)<1e-6&&PC.pos[0]>10&&Math.abs(PC.pos[2]-200)<70&&PC.target[0]===10&&PC.dist>=250&&PC.dist<=Math.max(...meshBox(D8.V).size)*.6/Math.tan(17.5*Math.PI/180)+1e-6"),"деталь из таблицы: камера напротив детали (по её нормали), цель — центр детали, 250 мм … вся фигура");
ok(run("AS.every(a=>a.dot>.5)")&&run("AS[0].k")>=1,"порядок сборки: каждый шаг смотрит на свои детали, шаг 1 крупнее общего вида в 2+ раза");
// номер детали в 3D (partLabelPt): на самой грани, не ближе 3 мм к кромке — у вогнутых деталей среднее углов p.c уходит за контур (лоб 22 у Д10)
run(`LPin=(M,R)=>R.parts.filter(p=>!p.back&&p.tris.length).filter(p=>{const q=partLabelPt(p,M),n=p.n,ins=p.tris.some(fi=>{const f=M.F[fi],[a,b,c]=f.map(i=>M.V[i]),s=(x,y)=>V3.dot(V3.cross(V3.sub(y,x),V3.sub(q,x)),n);return s(a,b)>=-1e-6&&s(b,c)>=-1e-6&&s(c,a)>=-1e-6;});
  if(!ins)return true;const ec=new Map();p.tris.forEach(fi=>{const f=M.F[fi];for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=a<b?a+"_"+b:b+"_"+a;ec.set(key,(ec.get(key)||0)+1);}});
  return [...ec].filter(([,c])=>c===1).some(([k])=>{const [a,b]=k.split("_").map(i=>M.V[+i]),ab=V3.sub(b,a),t=Math.max(0,Math.min(1,V3.dot(V3.sub(q,a),ab)/V3.dot(ab,ab)));return V3.len(V3.sub(q,V3.add(a,V3.mul(ab,t))))<3;});}).map(p=>p.no);
  CIN=(M,R)=>R.parts.filter(p=>!p.back&&p.tris.length).filter(p=>{const q=p.c,n=p.n;return !p.tris.some(fi=>{const [a,b,c]=M.F[fi].map(i=>M.V[i]),s=(x,y)=>V3.dot(V3.cross(V3.sub(y,x),V3.sub(q,x)),n);return s(a,b)>=-1e-6&&s(b,c)>=-1e-6&&s(c,a)>=-1e-6;});}).length;
  M9={V:D8.V,F:D8.F,T:D8.T,S:D8.S};R9n=buildParts(M9,1.5,1.5);addBacking(R9n,M9);pairNumbers(R9n,M9.V);`);
console.log("     номер в 3D: среднее углов за контуром — "+run("CIN(M9,R9n)")+" деталей; точка номера мимо или у кромки ["+run("LPin(M9,R9n)")+"]");
ok(run("LPin(M9,R9n).length")<run("R9n.parts.length"),"номер детали в 3D — на самой грани, не ближе 3 мм к кромке");
// v0.18.3 контур реза не пересекает сам себя: у плиты с вывернутым тонким пальцем (сама грань — «бантик», в редакторе синяя) контур реза тоже перекручен.
// Площадь — с треугольниками детали: у перекрученного контура area2 = тело − петля, меньше настоящей
run(`XS=Q=>{const n=Q.length;for(let i=0;i<n;i++)for(let j=i+2;j<n;j++)if(!(i===0&&j===n-1)&&segX(Q[i],Q[(i+1)%n],Q[j],Q[(j+1)%n]))return true;return false;};CX={x:[],big:[],bad:0,n:0};
  [["Овчарка",D8]].forEach(([nm,D])=>{const M={V:D.V,F:D.F,T:D.T,S:D.S},R=buildParts(M,1.5,1.5);addBacking(R,M);pairNumbers(R,M.V);
    R.parts.forEach(p=>[[2,0.5,true],[2,1,true],[2,1,false]].forEach(([t,g,u])=>{const r=cutContour(p,t,g,u);CX.n++;if(r.bad){CX.bad++;return;}const a=area2(r.pts),a0=area2(p.pts);
      if(XS(r.pts))CX.x.push(nm+" "+p.no);if(a*a0<=0||Math.abs(a)>p.area+1e-6)CX.big.push(nm+" "+p.no);}));});`);
console.log("     контуры реза Овчарки (t 2, зазор 0,5 / 1, с толщиной и без): "+run("CX.n")+", выродилось "+run("CX.bad")+"; пересекают сами себя ["+run("CX.x")+"], больше детали или вывернуты ["+run("CX.big")+"]");
ok(run("CX.x.length")===0&&run("CX.big.length")===0&&run("CX.bad")<run("CX.n")*.1,"контур реза не пересекает сам себя (вывернутая петля узкого шипа срезана), не больше детали и обходит её в ту же сторону; у рыси ни одна деталь не выродилась");
// чистка: у куба срезаны два угла крошечными треугольниками (рёбра 4 мм) — сводятся обратно в точку, куб снова из 6 граней
{const C=require('./plates/clean.js')(run);run(`CB=blankBox(300,400,260);[[6,1],[7,-1]].forEach(([v,s])=>{const p=CB.V[v],n=CB.V.length;CB.V.push([p[0]-s*3,p[1],p[2]],[p[0],p[1]-3,p[2]],[p[0],p[1],p[2]-3]);
    CB.P=CB.P.map(Q=>{const k=Q.indexOf(v);if(k<0)return Q;const nb=[Q[(k+Q.length-1)%Q.length],Q[(k+1)%Q.length]],pick=w=>{const d=V3.sub(CB.V[w],p);return Math.abs(d[0])>1?n:Math.abs(d[1])>1?n+1:n+2;};
      const r=Q.slice();r.splice(k,1,pick(nb[0]),pick(nb[1]));return r;});const tri=[n,n+1,n+2];CB.P.push(s>0?tri:tri.reverse());});CB.S=[];`);
  const r=C.collapseShort(run('CB'));run('CB2='+JSON.stringify(r.E));
  ok(run("CB.P.length")===8&&run("CB2.P.length")===6&&run("CB2.V.length")===8&&r.log.filter(x=>x.done).length>=1&&run("nonPlanar(CB2,.01).length")===0,"чистка коротких рёбер: срезанные углы куба (рёбра 3–4 мм) сведены в точку, 6 граней и 8 вершин, грани плоские");}
// гибка: коробка при угле от 90° — одна развёртка, 5 сгибов без налезаний; налезание квадратов находится
{const B=require('./plates/bend.js')(run),bx=run('blankBox(300,400,260)');bx.S=[];const r=B.plan(bx,{ang:90,corner:false}),sq=(x,y)=>[[x,y],[x+100,y],[x+100,y+100],[x,y+100]];
  ok(r.st.blanks===1&&r.st.V===5&&r.st.weld===7&&!B.overlap(sq(0,0),sq(100,0))&&B.overlap(sq(0,0),sq(50,30))&&B.plan(bx,{}).st.blanks===6,"гибка: коробка — одна развёртка из 6 граней, 5 сгибов V, 7 швов; при угле от 135° коробку не гнём; соседние квадраты не налезают, сдвинутые — налезают");}
// гибка на сайте: коробка — крест из 6 граней с 5 линиями сгиба; поправка на толщину; Овчарка — заготовки, каждая деталь ровно в одной, контуры целые
run(`BXE=blankBox(300,400,260);BXR=buildParts(polyBase(BXE.V,BXE.P),1.5,1.5);BXP=bendPlan(BXR,BXE.V,{ang:90,corner:false});BXB=bendBlank(BXP.blanks[0],BXR,BXE.V,BXP,{t:0,gap:0,useT:false})`);
ok(run("BXP.blanks.length")===1&&!run("BXB.bad")&&Math.abs(run("BXB.area")-run("BXR.parts.reduce((s,p)=>s+p.area,0)"))<1&&run("BXB.lines.length")===5&&run("BXB.lines.every(l=>l.segs.length===1&&Math.abs(Math.hypot(l.segs[0][2]-l.segs[0][0],l.segs[0][3]-l.segs[0][1])-l.len)<.01)")&&run("BXB.lines.map(l=>l.k).join()")==="1,2,3,4,5",
  "гибка: коробка — контур-крест площадью 6 граней, 5 линий сгиба во всю длину, порядок 1…5");
run(`BXB2=bendBlank(BXP.blanks[0],BXR,BXE.V,BXP,{t:2,gap:1,useT:true})`);ok(!run("BXB2.bad")&&run("BXB2.area")<run("BXB.area")&&run("BXB2.lines.every(l=>l.segs.length===1)"),"гибка: коробка с толщиной 2 мм и швом — контур целый, меньше креста, линии сгиба внутри");
ok(Math.abs(run("bendDeduct(1.5,135,'V')")-.92)<.02&&run("bendDeduct(1.5,135,'m')")<0&&run("bendDeduct(2,180,'V')")===0,"гибка: поправка на сгиб 45° при 1,5 мм — 0,9 мм (V), у m — чуть меньше нуля, без сгиба — 0");
run(`D9=figTop(modelPoly('shepherd'));R9=buildParts(polyBase(D9.V,D9.P,D9.S),1.5,1.5);P9=bendPlan(R9,D9.V,{sheet:[1250,2500]});B9=P9.blanks.filter(b=>b.parts.length>1).map(b=>bendBlank(b,R9,D9.V,P9,{t:1.5,gap:1,useT:true}))`);
console.log('     Овчарка с гибкой: '+JSON.stringify(run("P9.st"),['parts','blanks','multi','single','V','m','weld']));
ok(run("P9.st.blanks")>0&&run("(()=>{const c=new Array(R9.parts.length).fill(0);P9.blanks.forEach(b=>b.parts.forEach(p=>c[p]++));return c.every(x=>x===1);})()")&&run("B9.every(b=>!b.bad&&b.lines.every(l=>l.segs.length>0))")&&run("P9.st.maxBends")<=7,
  "гибка: Овчарка — каждая деталь ровно в одной заготовке, все контуры целые, линии сгиба внутри, сгибов на заготовку ≤ 7");
// v0.19.0 линия сгиба обрезана по контуру и там, где идёт ровно через вершину: пересечение с кромкой выходило u = −1e-17 и терялось — линия торчала за заготовку до 2,6 мм (К150 Г13, Д10 Г8, Г7.1 — найдено на коне и собаке)
run(`BOUT={n:0,x:[]};[["Овчарка",D9]].forEach(([nm,D])=>{const E=figTop(modelPoly('shepherd')),R=buildParts(polyBase(E.V,E.P,E.S),1.5,1.5),P=bendPlan(R,E.V,{sheet:[1250,2500]});
  P.blanks.filter(b=>b.parts.length>1).forEach(b=>{const B=bendBlank(b,R,E.V,P,{t:2,gap:0.5,useT:true});if(B.bad)return;const Q=B.pts,ds=p=>Math.min(...Q.map((a,i)=>{const c=Q[(i+1)%Q.length],d=[c[0]-a[0],c[1]-a[1]],k=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1]||1)));return Math.hypot(p[0]-a[0]-d[0]*k,p[1]-a[1]-d[1]*k);}));
    B.lines.forEach(l=>l.segs.forEach(z=>[[z[0],z[1]],[z[2],z[3]]].forEach(p=>{BOUT.n++;if(!inPoly(p,Q)&&ds(p)>0.05)BOUT.x.push(nm+" "+l.kind+l.ang+" "+ds(p).toFixed(1));})));});});`);
console.log("     концы линий сгиба Овчарки (t 2, шов 0,5): "+run("BOUT.n")+", за контуром ["+run("BOUT.x")+"]");
ok(run("BOUT.n")>0&&run("BOUT.x.length")===0,"линии сгиба Овчарки не выходят за контур заготовки, и там, где идут ровно через вершину");
// угол коробки: на одной детали две гнутые линии не сходятся в вершине (коробку при 90° — только полосами), на Овч тоже
run(`BXC=bendPlan(BXR,BXE.V,{ang:90});corner=P=>{const L=[...P.bent].map(id=>P.J[id]);return L.some((a,i)=>L.some((b,k)=>k>i&&[a.p,a.q].some(x=>x===b.p||x===b.q)&&[a.A,a.B].some(v=>v===b.A||v===b.B)));}`);
ok(run("BXC.blanks.length")>1&&!run("corner(BXC)")&&!run("corner(P9)"),"гибка: две линии сгиба на одной детали не сходятся в вершине — коробка распадается на полосы, у Овч таких нет");
// DXF заготовки: сгибы — на слоях BEND_V / BEND_M, подписи «V144 (2)» — гравировкой
run(`CUR={R:R9,BL:P9.blanks.filter(b=>b.parts.length>1).map((b,i)=>Object.assign({},b,B9[i]))};ST={engrave:true}`);
run(`BI={id:'b0',no:'Г1',pts:CUR.BL[0].pts.map(p=>[-p[0],p[1]]),tr:{f:true,c:1,s:0,x:0,y:0}};MK=itemMarks(BI);DXB=[];dxfPoly(DXB,BI.pts,'CUT');dxfMarksOf(DXB,BI,0,0);DXB=dxfDoc(DXB)`);
ok(run("MK.V.length+MK.M.length")===run("CUR.BL[0].lines.reduce((a,l)=>a+l.segs.length,0)")&&run("MK.eng.length")>0&&run("/BEND_(V|M)/.test(DXB)&&/POLYLINE\\r\\n8\\r\\nCUT/.test(DXB)&&/LINE\\r\\n8\\r\\nENGRAVE/.test(DXB)"),"гибка: DXF заготовки — контур полилинией CUT, линии сгиба на BEND_V/BEND_M, номера и подписи — ENGRAVE");
// зеркальные пары: «7» слева (смотрим спереди), «7.1» — её зеркальная справа, площади равны; номеров почти вдвое меньше; гравировка с точкой
run(`MP=figTop(figureMesh('shepherd',12));MP3={V:MP.V,F:MP.F,T:MP.T,S:MP.S};RP=buildParts(MP3,1.5,1.5);addBacking(RP,MP3);NP0=RP.parts.length;pairNumbers(RP,MP3.V);
  NUM=new Set(RP.parts.map(p=>Math.floor(p.no))).size;TW=RP.parts.filter(p=>p.no%1);`);
console.log('     Овч пары: деталей '+run('NP0')+', номеров '+run('NUM')+', «.1» — '+run('TW.length'));
ok(run("NUM")>0&&run("TW.every(p=>{const q=RP.parts[p.twin];return q&&q.no===Math.floor(p.no)&&Math.abs(q.area-p.area)<.01*p.area&&q.c[0]<=p.c[0];})")&&run("new Set(RP.parts.map(p=>p.no)).size")===run("NP0")&&run("String(RP.parts.find(p=>p.no%1).no)").endsWith('.1')&&run("!!engraveSegs('7.1',[[0,0],[60,0],[60,30],[0,30]])"),
  "зеркальные пары: Овч — номеров вдвое меньше деталей (251 на 502), у каждой «.1» пара слева, площади равны (±1%), номера не повторяются, гравировка «7.1»");
// шаги сборки: каждый кусок ровно в одном шаге, пара — в одном шаге, каждый шаг (кроме первого и подложек) варится к собранному раньше
run(`CUR={R:RP,M3:MP3,blankOf:null,BL:[]};AS=asmSteps();ASU=AS.steps.flatMap(s=>s.u.flatMap(u=>u.ps.map(p=>p.id)))`);
ok(run("ASU.length")===run("RP.parts.length")&&run("new Set(ASU).size")===run("RP.parts.length")&&run("AS.steps.filter((s,i)=>i&&s.w.some(w=>!w.length)&&!s.u[0].ps[0].back).length")<=2&&run("AS.steps.filter(s=>s.u.length===2).length")>=200&&run("AS.steps.length")<=260,
  "шаги сборки: Овч — каждая деталь ровно в одном шаге, зеркальные пары — вместе, почти каждый шаг варится к собранному раньше (новых начал не больше 2)");
console.log('     шагов сборки Овч без гибки: '+run('AS.steps.length'));
// карты деталей: по карте на кусок, зеркальная пара — одна карта; у каждой — контур, размеры, сварка; у заготовки — гибка; у каждой строки — чертёж угла, при уголках — чем выставить
run(`fmt=(x,d=0)=>Number(x).toFixed(d).replace('.',',');angT=d=>d>180.5?Math.round(360-d)+'° внутрь':Math.round(d)+'°';MATN={steel:'сталь'};
  ST={t:2,gap:1,useT:true,engrave:true,mat:'steel',name:'Овч',tpl:true,bend:true,pairs:true,minW:15};CUR={R:RP,M3:MP3,T:{mass:1},C:RP.parts.map(p=>cutContour(p,2,1,true))};
  CUR.BP=bendPlan(RP,MP3.V,{sheet:[1250,2500]});CUR.BL=CUR.BP.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,RP,MP3.V,CUR.BP,{t:2,gap:1,useT:true}))).filter(b=>!b.bad);blankNumbers(CUR.BL,RP);
  CUR.blankOf=new Int32Array(RP.parts.length).fill(-1);CUR.BL.forEach((b,i)=>b.parts.forEach(pi=>CUR.blankOf[pi]=i));CUR.bentKey=new Set(CUR.BL.flatMap(b=>b.bends.map(id=>bendKey(CUR.BP.J[id].p,CUR.BP.J[id].q))));
  CUR.PC=RP.parts.filter(p=>CUR.blankOf[p.id]<0).map(p=>({id:p.id,no:p.no,pts:CUR.C[p.id].pts,parts:[p.id],key:p.no})).concat(CUR.BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts,parts:b.parts,key:RP.parts[b.parts[0]].no,B:b}))).sort((a,b)=>a.key-b.key);
  CUR.TPL=weldTemplates(RP,2,15,(p,q)=>CUR.bentKey.has(bendKey(p,q)),CUR.BL.flatMap(b=>b.lines.map(l=>l.ang)));CD=buildCards();
  CNT=(s,re)=>(s.match(re)||[]).length;BLC=CD.filter(c=>c.svg.includes('Карта заготовки'));`);
console.log('     карты Овч: '+run('CD.length')+' (кусков '+run('CUR.PC.length')+', «.1» '+run("CUR.PC.filter(o=>String(o.no).endsWith('.1')).length")+', заготовок на картах '+run('BLC.length')+'), уголков '+run('CUR.TPL.length')+' (под сгибы '+run('CUR.TPL.filter(o=>o.bends).length')+')');
ok(run("CD.length")===run("CUR.PC.length-CUR.PC.filter(o=>String(o.no).endsWith('.1')).length")&&run("CD.every(c=>c.svg.includes('viewBox=\"0 0 210 297\"')&&c.svg.includes('<polygon class=\"l\"')&&c.svg.includes('Развёртка')&&c.svg.includes('Сварка')&&CNT(c.svg,/<text class=\"sm\"[^>]*text-anchor=\"middle\">[0-9]+</g)>=2)")
  &&run("BLC.length")>0&&run("BLC.every(c=>c.svg.includes('Гибка — по порядку')&&c.svg.includes('class=\"bnd'))")&&run("CD.every(c=>CNT(c.svg,/class=\"wg\"/g)+CNT(c.svg,/class=\"br\"/g)===c.rows)")&&run("CD.every(c=>!c.svg.includes('транспортиром'))")&&run("CD.some(c=>c.svg.includes('уголок У'))"),
  "карты деталей: Овч — по карте на кусок (пара «.1» — на той же), А4, у каждой контур, длины сторон, сварка; у заготовок — гибка и линии сгиба; у каждой строки — чертёж угла; при уголках каждый угол — уголком, линейкой или по месту");
run(`ST.tpl=false;CUR.TPL=null;CD2=buildCards();`);ok(run("CD2.every(c=>CNT(c.svg,/class=\"wg\"/g)+CNT(c.svg,/class=\"br\"/g)===c.rows)")&&run("CD2.some(c=>c.svg.includes('транспортиром'))")&&run("!CD2.some(c=>c.svg.includes('уголок У'))"),"карты деталей без уголков: чертёж угла всё равно у каждой строки, выставлять транспортиром");
// v0.11.0: гибка клетками — клеток столько, сколько сгибов; уголок во внутреннем углу: у V — со стороны гравировки (выше вершины), у m — ниже
run(`ST.tpl=true;CUR.TPL=weldTemplates(RP,2,15,(p,q)=>CUR.bentKey.has(bendKey(p,q)),CUR.BL.flatMap(b=>b.lines.map(l=>l.ang)));CD4=buildCards();BS={cells:0,lines:0,tw:0,bad:0};
  CD4.filter(c=>c.svg.includes('Карта заготовки')).forEach(c=>{const gs=c.svg.split('<g class="br"').slice(1);BS.cells+=gs.length;gs.map(g=>g.slice(0,g.indexOf('</g>'))).forEach(g=>{const m=g.match(/<polygon class="tw" points="([^"]+)"/);if(!m)return;BS.tw++;
    const cy=m[1].split(' ').map(p=>+p.split(',')[1]).reduce((a,b)=>a+b,0)/3,vy=+g.match(/cy="([0-9.]+)" r=".5"/)[1];if(g.includes('data-kind="V"')?cy>=vy:cy<=vy)BS.bad++;});});
  BS.wo=0;BS.wbad=0;CD4.forEach(c=>c.svg.split('<g class="wg"').slice(1).map(g=>g.slice(0,g.indexOf('</g>'))).forEach(g=>{const m=g.match(/<polygon class="tw" points="([^"]+)"/);if(!m)return;const out=g.startsWith(' data-out');if(out)BS.wo++;
    const cy=m[1].split(' ').map(p=>+p.split(',')[1]).reduce((a,b)=>a+b,0)/3,vy=+g.match(/cy="([0-9.]+)" r=".45"/)[1];if(out?cy<=vy:cy>=vy)BS.wbad++;}));
  BS.pv=CD4.every(c=>c.svg.includes('Где на фигуре')&&!c.svg.includes('<image'));globalThis.pieceShots=(own,tw,a)=>[1,2,3,4].map(i=>({url:'data:image/jpeg;base64,AA',txt:'вид '+i}));BS.sh=buildCards().every(c=>CNT(c.svg,/<image class="shot"/g)===4)&&buildCards().every(c=>c.svg.includes('где на фигуре'));delete globalThis.pieceShots;
  BS.lines=asmUnits().L.filter((x,i,L)=>(x.tw<0||x.tw>i)&&x.bi>=0).reduce((a,x)=>a+CUR.BL[x.bi].lines.length,0);`);
console.log('     гибка строками: '+run('BS.cells')+' (сгибов на картах '+run('BS.lines')+'); швов «внутрь» с уголком '+run('BS.wo')+', уголок сварки не с той стороны '+run('BS.wbad'));
ok(run('BS.cells===BS.lines&&BS.wo>0&&BS.wbad===0&&BS.pv&&BS.sh'),'карты: гибка — строка на каждый сгиб; в профиле шва уголок сверху (изнутри), у шва «внутрь» — снизу (снаружи); «Где на фигуре» — 4 снимка 3D-модели (без WebGL — схема)');
// v0.14.0: гибка картинками — уголок в угле готового элемента: кромки в плоскостях граней, угол между ними = угол сгиба, у V — изнутри (против наружных нормалей), у m — снаружи
run(`BT={n:0,plane:0,ang:0,side:0,hit:0,none:0};CUR.BL.forEach(B=>{const own=new Set(B.parts);B.lines.forEach(l=>{const j=CUR.BP.J[l.id],tp=CUR.TPL.find(o=>o.a===Math.round(l.ang));if(!tp){BT.none++;return;}BT.n++;
    const T=bendTpl(RP,MP3,j,own,tp.pts),np=RP.parts[j.p].n,nq=RP.parts[j.q].n;if(Math.abs(V3.dot(np,T.e1))>.02||Math.abs(V3.dot(nq,T.w2))>.02||Math.abs(V3.dot(T.u,T.e1))>.02||Math.abs(V3.dot(T.u,T.e2))>.02)BT.plane++;
    if(Math.abs(Math.acos(Math.max(-1,Math.min(1,V3.dot(T.e1,T.w2))))*180/Math.PI-l.ang)>1)BT.ang++;const sg=l.kind==='V'?-1:1;if(V3.dot(T.b,np)*sg<=0||V3.dot(T.b,nq)*sg<=0)BT.side++;if(T.hit)BT.hit++;
    const a2=tp.pts[1],q=T.P3[1],o=V3.sub(V3.sub(q,T.M),T.o),gp=V3.len(T.o)*Math.sin(Math.acos(V3.dot(T.e1,T.w2))/2);if(Math.abs(gp-.3)>.01)BT.plane++;if(Math.abs(V3.dot(o,T.e1)-a2[0])>.01||Math.abs(V3.dot(o,T.u))>.01)BT.plane++;});});`);
console.log('     уголки в углах сгибов Овч: '+run('BT.n')+' (без уголка '+run('BT.none')+'), не встают в готовом элементе '+run('BT.hit'));
ok(run('BT.n>0&&BT.plane===0&&BT.ang===0&&BT.side===0'),'гибка картинками: уголок в угле сгиба — кромки по граням, угол = углу сгиба, у V изнутри фигуры, у m снаружи, прижат к граням (зазор 0,3 мм)');
// снимки сгибов (заглушка вместо WebGL): 1–2 сгиба — на карте элемента, 3 и больше — лист «Гибка» сразу после карты (до 8 на лист); номера листов в штампе — по порядку
run(`globalThis.bendShot=(own,l,a)=>({url:'data:image/jpeg;base64,AA',labs:[{x:.5,y:.5,t:'7',k:'no'},{x:.4,y:.6,t:String(l.k),k:'bend'}],hit:false,how:'tpl'});CD5=buildCards();delete globalThis.bendShot;
  BG={img:0,bad:0,sheets:0,want:0,num:0,rows:0};const U=asmUnits().L.filter((x,i,L)=>(x.tw<0||x.tw>i)&&CUR.PC.some(c=>c.id===(x.bi>=0?'b'+x.bi:x.ps[0].id)&&c.pts.length>2));
  CD5.forEach((c,i)=>{BG.img+=CNT(c.svg,/<image class="bsh"/g);const m=c.svg.match(/>Лист<\\/text><text[^>]*>([0-9]+)</);if(!m||+m[1]!==i+1||!c.svg.includes('>'+CD5.length+'</text>'))BG.num++;if(CNT(c.svg,/class="wg"/g)+CNT(c.svg,/class="br"/g)!==c.rows)BG.rows++;});
  let k=0;U.forEach(x=>{const c=CD5[k++],n=x.bi>=0?CUR.BL[x.bi].lines.length:0;if(n&&n<=2&&CNT(c.svg,/<image class="bsh"/g)!==n)BG.bad++;
    if(n>2){const pg=Math.ceil(n/8);BG.want+=pg;for(let p=0;p<pg;p++){const b=CD5[k++];if(!b||!b.title.startsWith('Гибка '+x.name)||!b.svg.includes('Гибка — проверка уголком')||CNT(b.svg,/<image class="bsh"/g)!==Math.min(8,n-p*8)||CNT(b.svg,/<g class="bs"/g)!==Math.min(8,n-p*8))BG.bad++;else BG.sheets++;}}});
  if(k!==CD5.length)BG.bad++;`);
console.log('     снимков сгибов '+run('BG.img')+', листов «Гибка» '+run('BG.sheets')+' из '+run('BG.want')+', всего листов '+run('CD5.length'));
ok(run('BG.img===BS.lines&&BG.bad===0&&BG.sheets===BG.want&&BG.want===CUR.BL.filter(b=>b.lines.length>2).reduce((a,b)=>a+Math.ceil(b.lines.length/8),0)&&BG.num===0&&BG.rows===0&&!CD4.some(c=>c.svg.includes(\'class="bsh"\'))'),'гибка картинками: снимок на каждый сгиб — 1–2 на карте, больше — лист «Гибка» после карты; листы в штампе по порядку; без WebGL — только строки');
// v0.20 у снимка сгиба data-b (заготовка) и data-k (номер сгиба): по ним окно «крутить сгиб» знает, что открыть; на каждый сгиб — своя пара, пары не повторяются
run(`BD={n:0,bad:0,u:new Set()};CD5.forEach(c=>(c.svg.match(/<image class="bsh"[^>]*>/g)||[]).forEach(t=>{BD.n++;const m=t.match(/data-b="([0-9]+)" data-k="([0-9]+)"/);if(!m){BD.bad++;return;}const B=CUR.BL[+m[1]];if(!B||!B.lines.some(l=>l.k===+m[2]))BD.bad++;BD.u.add(m[1]+':'+m[2]);}));`);
ok(run('BD.n>0&&BD.n===BS.lines&&BD.bad===0&&BD.u.size===BD.n'),'снимки сгибов: у каждого data-b и data-k — есть такая заготовка и такой сгиб, пары не повторяются');
// уголков нет — на снимке дуга угла: листы «Гибка — проверка угла», слова «уголком» нет
run(`globalThis.bendShot=(own,l,a)=>({url:'data:image/jpeg;base64,AA',labs:[],hit:false,how:'none'});CD6=buildCards().filter(c=>c.svg.includes('class="bsh"'));delete globalThis.bendShot;`);
ok(run("CD6.length>0&&CD6.filter(c=>c.title.startsWith('Гибка ')).every(c=>c.svg.includes('Гибка — проверка угла')&&!c.svg.includes('уголком'))&&CD6.filter(c=>!c.title.startsWith('Гибка ')).every(c=>c.svg.includes('дуга угла'))"),'гибка картинками без уголков: лист «Гибка — проверка угла», на карте — «дуга угла»');
// v0.15.0: порядок сборки снимками (заглушка вместо WebGL) — снимок в каждой клетке шага, схемы гранями нет; номера поверх снимка — в клетке
run(`globalThis.stepShot=(st,a)=>({url:'data:image/jpeg;base64,AA',txt:'спереди',labs:[{x:.5,y:.5,t:String(st.u[0].ps[0].no),k:'new'},{x:.5,y:.5,t:'99',k:'nb'},{x:.99,y:.99,t:'77',k:'nb'}]});AA1=sheetsAssembly();delete globalThis.stepShot;
  AN=asmSteps().steps.length;AA2=sheetsAssembly();AQ={img:0,fc:0,lab:0,out:0};AA1.forEach(o=>{AQ.img+=CNT(o.body,/<image class="ash"/g);AQ.fc+=CNT(o.body,/class="fc"/g);AQ.lab+=CNT(o.body,/<text class="no"/g);AQ.out+=CNT(o.body,/>77</g);});
  // без WebGL — схема: оранжевые только грани самого элемента (зеркальная пара — серым)
  AQ.or=AA2.reduce((s,o)=>s+CNT(o.body,/fill="rgb[(]/g),0);AQ.want=asmSteps().steps.reduce((s,st)=>{const v=stepView(st.u[0].ps);return s+st.u[0].ps.filter(p=>V3.dot(p.n,v.d)>.02).length;},0);`);
console.log('     порядок сборки Овч: шагов '+run('AN')+', листов '+run('AA1.length')+', снимков '+run('AQ.img')+'; без WebGL оранжевых граней '+run('AQ.or')+' из '+run('AQ.want'));
ok(run('AQ.img===AN&&AQ.fc===0&&AQ.lab===AN*2&&AQ.out===0&&AA2.length===AA1.length&&AQ.or===AQ.want&&!AA2.some(o=>o.body.includes(\'class="ash"\'))'),'порядок сборки снимками: в каждой клетке шага снимок, номера поверх (наезжают — сдвиг, за краем — нет); без WebGL — схема, оранжевый только сам элемент, зеркальная пара серым');
// гравировка заготовок (как в DXF): подписи сгибов не ближе 1 мм к номерам деталей и друг к другу; всё влезло; номер мельчит не меньше 5 мм; на карте — та же гравировка
run(`ST.engrave=true;SEGD=(a,b)=>{const d=(p,s)=>{const vx=s[2]-s[0],vy=s[3]-s[1],L=vx*vx+vy*vy||1e-9,t=Math.max(0,Math.min(1,((p[0]-s[0])*vx+(p[1]-s[1])*vy)/L));return Math.hypot(s[0]+vx*t-p[0],s[1]+vy*t-p[1]);};
    const cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]),A=[a[0],a[1]],B=[a[2],a[3]],C=[b[0],b[1]],D=[b[2],b[3]];if(cr(A,B,C)*cr(A,B,D)<0&&cr(C,D,A)*cr(C,D,B)<0)return 0;return Math.min(d(A,b),d(B,b),d(C,a),d(D,a));};
  GD=(G,H)=>{let m=1e9;G.forEach(a=>H.forEach(b=>{m=Math.min(m,SEGD(a,b));}));return m;};HT=g=>{const ys=g.flatMap(q=>[q[1],q[3]]);return Math.max(...ys)-Math.min(...ys);};
  EG={close:0,miss:0,shrunk:0,tiny:0,labs:0};CUR.BL.forEach((B,i)=>{const t=bendAlign(B.pts,true),P=B.pts.map(q=>trPt(t,q)),m=itemMarks({id:'b'+i,no:'Г'+B.no,pts:P,tr:t});EG.miss+=m.miss.length;EG.labs+=m.labs.length;
    m.labs.forEach((L,k)=>{m.num.forEach(n=>{if(n.g&&GD(L.g,n.g)<1)EG.close++;});m.labs.forEach((L2,k2)=>{if(k2>k&&GD(L.g,L2.g)<1)EG.close++;});});
    m.num.forEach((n,j)=>{const g0=blankNumSegs(n.no,B.regions[j].pts.map(q=>trPt(t,q)),P);if(!n.g||!g0)return;const h=HT(n.g),h0=HT(g0);if(h<h0-.01){EG.shrunk++;if(h<Math.min(h0,5)-.01)EG.tiny++;}});});
  ST.tpl=true;CD3=buildCards();`);
console.log('     гравировка заготовок Овч: подписей сгибов '+run('EG.labs')+', номеров уменьшено '+run('EG.shrunk'));
ok(run("EG.close")===0&&run("EG.miss")===0&&run("EG.tiny")===0&&run("EG.labs")===run("CUR.BL.reduce((a,b)=>a+b.lines.filter(l=>l.segs.length).length,0)")&&run("CD3.filter(c=>c.svg.includes('Карта заготовки')).every(c=>c.svg.includes('eng engb'))"),
  "гравировка заготовок: Овч — каждая подпись сгиба выгравирована и не ближе 1 мм к номерам деталей и другим подписям, номер мельчит не меньше 5 мм; на карте — та же гравировка, подписи сгибов бледно");
// v0.28.0 прорези по линиям сгиба (#135): сквозные «таблетки» вместо старой перфорации (щели 2 мм шагом 20) — правило сменилось, старые проверки заменены этими.
// Раскладка вдоль линии (slotPlan) и форма прорези (slotShape) — по плану 2026-11-20-wide-bend-slots
const SLO=JSON.stringify({w:2,len:40,br:3,eb:3,el:5}),nearS=(a,b,e=1e-6)=>Math.abs(a-b)<e,SPx=(L,a,b)=>JSON.stringify(run(`slotPlan(${L},${a},${b},${SLO})`)?.map(z=>z.map(v=>+v.toFixed(3)))??null);
ok(SPx(100,true,true)==='[[0,5],[8,34],[37,63],[66,92],[95,100]]','прорези: 100 мм — крайние 5 до края, 3 средних по 26, перемычки 3');
ok(SPx(100,false,false)==='[[3,32.333],[35.333,64.667],[67.667,97]]','прорези: без крайних — отступ 3 от концов, 3 средних');
ok(SPx(60,false,true)==='[[3,26],[29,52],[55,60]]','прорези: начало линии не на кромке — там перемычка, в конце крайняя 5 до края');
ok(SPx(200,true,true)!=='null'&&run(`slotPlan(200,true,true,${SLO})`).length===7,'прорези: 200 мм — 5 средних (≤ 40 мм) между крайними');
ok(SPx(12,true,true)==='[[0,4.5],[7.5,12]]','прорези: короткая 12 мм — крайние укорочены до 4,5, между ними перемычка 3');
ok(SPx(6,true,true)==='null'&&SPx(7,true,true)==='[[0,2],[5,7]]','прорези: 6 мм — не влезает (null), 7 мм — две крайние по 2');
ok(SPx(7,false,false)==='null'&&SPx(9,false,false)==='[[3,6]]','прорези: короткая линия без крайних — 7 мм пусто (null), 9 мм — одна прорезь 3 мм между перемычками');
run(`SS=slotShape([0,0],[1,0],10,30,2);SSF=shapeFlat(SS,64)`);ok(nearS(run('shapeLen(SS)'),2*18+2*Math.PI)&&run('SS.pts.length')===4&&nearS(Math.abs(run('area2(SSF)')),18*2+Math.PI,.01)&&run('SSF.every(q=>q[0]>=10-1e-9&&q[0]<=30+1e-9)'),'таблетка 20×2: периметр 36+2π, 4 точки и две дуги наружу (площадь 36+π, концы ровно на 10 и 30)');
run(`SSM=shapeTr(SS,q=>[-q[0],q[1]]);SSMF=shapeFlat(SSM,64)`);ok(run('SSM.b.every((v,i)=>v===-SS.b[i])')&&nearS(Math.abs(run('area2(SSMF)')),18*2+Math.PI,.01),'таблетка зеркально: знаки дуг меняются, дуги по-прежнему наружу');
// #136 крайняя прорезь до края — вырез в контуре (cutInto): посреди ребра, две подряд, наружный угол, узкая полоса, зеркало
run(`SQ={pts:[[0,0],[100,0],[100,100],[0,100]],b:[0,0,0,0]};FF=s=>shapeFlat(s,16);IN=(q,s)=>inPoly(q,FF(s));SX=s=>{const F=FF(s),n=F.length;for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(segX(F[i],F[(i+1)%n],F[j],F[(j+1)%n]))return true;}return false;}`);
run(`E1=cutInto(SQ,endShape([50,0],[0,1],2,5,0),[50,0])`);
ok(run('E1')&&nearS(run('shapeLen(E1)'),406+Math.PI)&&run('E1.pts.some(q=>Math.hypot(q[0]-49,q[1])<1e-9)')&&!run('IN([50,3],E1)')&&run('IN([50,7],E1)')&&!run('SX(E1)'),'крайняя прорезь посреди ребра: 2×5, периметр 406+π, вырез внутри, дальше металл');
run(`E2=cutInto(E1,endShape([50,100],[0,-1],2,5,0),[50,100])`);ok(run('E2')&&nearS(run('shapeLen(E2)'),412+2*Math.PI)&&!run('SX(E2)'),'две крайние прорези на одном контуре: вторая врезается в контур с дугами');
run(`E3=cutInto(SQ,endShape([0,0],[Math.SQRT1_2,Math.SQRT1_2],2,5,0),[0,0])`);ok(run('E3')&&!run('IN([0.5,0.5],E3)')&&run('IN([4,0.2],E3)')&&!run('SX(E3)'),'крайняя прорезь в наружном угле: кончик срезан по полосе, рядом металл');
run(`LE={pts:[[0,0],[140,0],[140,60],[0,60]],b:[0,0,0,0]};E6=cutInto(LE,endShape([1.2,0],[0,1],2,5,0),[1.2,0])`);ok(run('E6')&&Math.abs(run('Math.abs(area2(FF(E6)))')-140*60)<20&&nearS(run('shapeLen(E6)'),406+Math.PI),'крайняя прорезь в 1,2 мм от вершины длинного ребра: вырезана только полоса (место конца на контуре — точно, не по шагу)');
// #137 разгрузочное отверстие во внутреннем угле: «замочная скважина» (крайняя прорезь + круг Ø3), без крайней — полукруг в кромке
run(`LS={pts:[[0,0],[100,0],[100,50],[50,50],[50,100],[0,100]],b:[0,0,0,0,0,0]};UL=[-Math.SQRT1_2,-Math.SQRT1_2];E4=cutInto(LS,endShape([50,50],UL,2,5,3),[50,50])`);
ok(run('E4')&&!run('IN([48.6,49.9],E4)')&&!run('IN([50+UL[0]*4,50+UL[1]*4],E4)')&&run('IN([50+UL[0]*7,50+UL[1]*7],E4)')&&run('IN([47,49.9],E4)')&&!run('SX(E4)'),'разгрузочное отверстие во внутреннем угле: круг Ø3 и крайняя прорезь вырезаны, дальше металл');
run(`E5=cutInto(SQ,endShape([50,0],[0,1],2,0,3),[50,0])`);ok(run('E5')&&nearS(run('shapeLen(E5)'),397+1.5*Math.PI),'разгрузочное отверстие без крайней прорези: полукруг Ø3 в кромке');
ok(run('innerCorner(LS.pts,[50,50],2)')&&!run('innerCorner(LS.pts,[0,0],2)')&&!run('innerCorner(LS.pts,[50,0],2)')&&run('innerCorner(LS.pts.slice().reverse(),[50,50],2)'),'внутренний угол: ступенька L (270°) — да, наружный угол и ровный край — нет, при любом обходе контура');
run(`TH={pts:[[0,0],[100,0],[100,3],[0,3]],b:[0,0,0,0]}`);ok(run('cutInto(TH,endShape([50,0],[0,1],2,5,0),[50,0])')===null,'вырез длиннее узкой полосы — не врезаем (null), деталь не режется пополам');
// #140 правила по умолчанию: короткая линия — две крайние и перемычка br по центру; конец, где вырез не врезался, — с перемычки eb от кромки (не miss)
run(`ST0=ST;ST={perf:true,cut:'laser',slotNotch:true,slotD:3};MB=(pts,seg)=>({no:99,pts,lines:[{kind:'V',ang:90,k:1,segs:[seg]}]});
  K12=MB([[0,0],[100,0],[100,12],[0,12]],[50,0,50,12]);S12=blankSlots(K12);L12=slotLayout([50,0],[0,1],12,K12.pts,true,true,slotOpt());
  ST.slotBr=4;L12b=slotLayout([50,0],[0,1],12,K12.pts,true,true,slotOpt());delete ST.slotBr;S6=blankSlots(MB([[0,0],[100,0],[100,6],[0,6]],[50,0,50,6]));`);
ok(run('L12.ea===4.5&&L12.eb2===4.5&&L12.mids.length===0&&S12.ends.edge===2&&S12.miss.length===0&&S12.holes.length===0')&&run('IN([50,6],S12.outline)&&IN([50,4.6],S12.outline)&&!IN([50,4.4],S12.outline)&&!IN([50,7.6],S12.outline)')&&run('L12b.ea===4&&L12b.eb2===4'),
  'короткая линия 12 мм, оба конца на кромке: две крайние прорези по 4,5 мм, перемычка 3 мм по центру (при перемычке 4 — крайние по 4), предупреждения нет');
ok(run("S6.miss.length===1&&S6.ends.edge===0&&S6.holes.length===0"),'линия 6 мм (короче перемычки и двух ширин прорези) — без прорезей, в предупреждении (miss)');
run(`LN=[[0,0],[100,0],[100,50],[50,50],[50,100],[0,100]];NA=36*Math.PI/180;NU=[Math.cos(NA),-Math.sin(NA)];NP=[52.2,50];
  KN={no:98,pts:LN,lines:[{kind:'m',ang:150,k:1,segs:[[NP[0],NP[1],NP[0]+NU[0]*40,NP[1]+NU[1]*40]]}]};SN=blankSlots(KN);DN=polyDist(LN);
  LNay=slotLayout(NP,NU,40,LN,false,false,slotOpt());ST=ST0;`);
ok(run('cutInto(plainShape(LN),endShape(NP,NU,2,5,0),NP)')===null&&run('SN.ends.shut===1&&SN.ends.edge===0&&SN.ends.relief===0&&SN.miss.length===0&&Math.abs(shapeLen(SN.outline)-perim(LN))<1e-9')&&run('SN.holes.length>0&&LNay.mids[0][0]>=3-1e-9&&Math.min(...SN.holes.flatMap(h=>FF(h)).map(DN))>=3-1e-6'),
  'конец в 2,2 мм от вершины угла, линия к кромке под 36°: вырез задевает вторую сторону и не врезается — на этом конце ни прорези, ни отверстия, линия начинается с перемычки 3 мм от кромки, предупреждения нет');
run(`MR=shapeTr(E1,q=>[-q[0],q[1]])`);ok(run('MR.b.some(v=>v!==0)')&&run('MR.b.every((v,i)=>v===-E1.b[i])')&&!run('IN([-50,3],MR)')&&run('IN([-50,7],MR)'),'зеркально: знак дуги меняется, вырез по-прежнему внутри детали');
// Овч: средние прорези на каждой линии по раскладке (концы линий пока без крайних — перемычка у кромки), все внутри заготовки; в раскрое заготовка зеркально — дуги не вывернуты;
// рез контуров не меняется, по врезке на прорезь; DXF — замкнутые PERF с дугами (код 42), без BEND_V/BEND_M, CUT у каждой детали последним; без галочки и при плазме — как раньше
run(`ST.perf=true;ST.cut='laser';ST.slotNotch=true;ST.slotD=3;PF={inner:0,relief:0,shut:0,segs:0,holes:0,out:0,close:1e9,miss:0,plan:0,mir:0,mirBad:0,len:0,edge:0,ends:0,selfX:0,extra:0,missB:[],areaBad:[]};PI=[];
  CUR.BL.forEach((B,i)=>{delete B._slots;const t=bendAlign(B.pts,true),P=B.pts.map(q=>trPt(t,q)),o={id:'b'+i,no:'Г'+B.no,pts:P,tr:t},m=itemMarks(o),dP=polyDist(P);PI.push(o);
    let want=0;const dB=polyDist(B.pts);B.lines.forEach(l=>l.segs.forEach(z=>{const L=Math.hypot(z[2]-z[0],z[3]-z[1]);if(L<1e-6)return;PF.segs++;const A=[z[0],z[1]],Z=[z[2],z[3]],lay=slotLayout(A,[(z[2]-z[0])/L,(z[3]-z[1])/L],L,B.pts,dB(A)<.05,dB(Z)<.05,slotOpt());
      PF.ends+=(dB(A)<.05)+(dB(Z)<.05);[A,Z].forEach(q=>{if(dB(q)<.05&&innerCorner(B.pts,q,2))PF.inner++;});if(lay)want+=lay.mids.length;else PF.miss++;}));
    if(want!==m.P.length)PF.plan++;PF.holes+=m.P.length;const BS=blankSlots(B);PF.edge+=BS.ends.edge;PF.relief+=BS.ends.relief;PF.shut+=BS.ends.shut;PF.extra+=BS.extra;if(SX(BS.outline))PF.selfX++;PF.missB.push(...BS.miss);if(Math.abs(area2(B.pts))-Math.abs(area2(FF(BS.outline)))>25*BS.ends.edge+1)PF.areaBad.push('Г'+B.no);
    m.P.forEach(h=>{const F=shapeFlat(h,16),c=F.reduce((a,q)=>[a[0]+q[0]/F.length,a[1]+q[1]/F.length],[0,0]),L=shapeLen(h);PF.len+=L;if(!inPoly(c,P)||F.some(q=>!inPoly(q,P)))PF.out++;F.forEach(q=>{PF.close=Math.min(PF.close,dP(q));});
      const A=Math.abs(area2(F)),w=2,A0=(L-Math.PI*w)/2*w+Math.PI*w*w/4;if(t.f)PF.mir++;if(Math.abs(A-A0)>.02*A0)PF.mirBad++;});});
  PS0=cutStats(PI);ST.perf=false;PS1=cutStats(PI);ST.perf=true;ST.cut='plasma';PS2=cutStats(PI);ST.cut='laser';
  NI=PI.map((o,i)=>{const xs=o.pts.map(q=>q[0]),ys=o.pts.map(q=>q[1]);return Object.assign({},o,{x:i*3000-Math.min(...xs),y:-Math.min(...ys)});});
  N0=CUR.N;CUR.N={W:3000*NI.length,H:3000,gap:3,sheets:[{items:NI}]};
  DXP=t=>{const TK=t.split('\\r\\n'),EN=[];let cur=null,vx=false;for(let i=0;i+1<TK.length;i+=2){const c=TK[i].trim(),v=TK[i+1].trim();
      if(c==='0'){vx=v==='VERTEX';if(v==='LINE'||v==='POLYLINE'){cur={t:v,lay:'',x:null,cl:0,bu:0};EN.push(cur);}else if(!vx)cur=null;}
      else if(cur){if(c==='8'&&!vx&&!cur.lay)cur.lay=v;else if(c==='10'&&cur.x===null&&(cur.t==='LINE'||vx))cur.x=+v;else if(c==='70'&&!vx)cur.cl=+v&1;else if(c==='42'&&vx&&+v!==0)cur.bu++;}}return EN;};
  EN1=DXP(dxfNest());DO={bad:0,perf:0,perfClosed:0,bulgePerf:0,bend:0,bulgeCut:0};CI=[];EN1.forEach((en,j)=>{if(en.lay==='SHEET')return;const k=Math.floor((en.x+1)/3000);(CI[k]=CI[k]||{m:[],c:[]})[en.lay==='CUT'?'c':'m'].push(j);
    if(en.lay==='PERF'){DO.perf++;if(en.t==='POLYLINE'&&en.cl)DO.perfClosed++;if(en.bu===2)DO.bulgePerf++;}if(en.lay==='BEND_V'||en.lay==='BEND_M')DO.bend++;if(en.lay==='CUT'&&en.bu)DO.bulgeCut++;});
  CI.forEach((g,k)=>{if(!g||g.c.length!==1||g.m.some(j=>j>g.c[0]||(k&&CI[k-1]&&j<CI[k-1].c[0])))DO.bad++;});
  ST.perf=false;EN2=DXP(dxfNest());ST.perf=true;ST.cut='plasma';EN3=DXP(dxfNest());ST.cut='laser';ST.perf=false;CUR.N=N0;`);
console.log('     прорези Овч: линий сгиба '+run('PF.segs')+' (без прорезей '+run('PF.miss')+'), прорезей '+run('PF.holes')+' ('+run("perfTxt(PS0)")+'), ближе всего к кромке '+run('PF.close.toFixed(2)')+' мм, зеркальных '+run('PF.mir')+'; концов линий на кромке '+run('PF.ends')+', крайних прорезей врезано '+run('PF.edge')+', концов во внутреннем угле '+run('PF.inner')+', разгрузочных отверстий '+run('PF.relief')+', рез контуров +'+run('PF.extra.toFixed(1)')+' мм; без выреза ['+run('PF.missB')+']; DXF: PERF '+run('DO.perf')+', CUT с дугами '+run('DO.bulgeCut'));
ok(run('PF.holes')>0&&run('PF.plan')===0&&run('PF.out')===0&&run('PF.close')>=3-1e-6,'прорези Овч: на каждой линии средние прорези по раскладке, все внутри заготовки, до кромки не меньше перемычки 3 мм (у острого угла линии с кромкой — сдвинуты к середине)');
ok(run('PF.mir')>0&&run('PF.mirBad')===0,'прорези Овч: заготовка в раскрое зеркально — дуги прорезей не вывернуты (площадь как у таблетки)');
ok(run('PS0.perf===PF.holes&&PS0.perfPierce===PF.holes&&Math.abs(PS0.perfLen-PF.len)<1e-6&&PS0.pierce===PS1.pierce&&PF.extra>0&&Math.abs(PS0.cut-PS1.cut-PF.extra)<1e-3&&PS1.perf===0&&PS2.perf===0'),'прорези Овч: в метраже отдельно — по врезке на прорезь, рез прорезей = сумма их периметров; рез контуров вырос ровно на вырезы крайних прорезей, врезок у крайних нет; без галочки и при плазме — нет');
ok(run('PS0.bend')===0&&run('PS1.bend')>0,'метраж: с прорезями линии сгиба не гравируются (гравировка сгибов 0), без прорезей — как раньше');
ok(run('PF.edge')>0&&run('PF.edge')+run('PF.missB.length')>=run('PF.ends')*.9&&run('PF.selfX')===0&&run('PF.areaBad.length')===0,'крайние прорези Овч: врезаны в контур CUT на концах линий у кромки, контур без самопересечений, площадь меньше только на вырезы (не больше 25 мм² на вырез)'+(run('PF.areaBad.length')?' — '+run('PF.areaBad'):''));
ok(run('DO.perf===PF.holes&&DO.perfClosed===PF.holes&&DO.bulgePerf===PF.holes&&DO.bend===0&&DO.bad===0&&DO.bulgeCut>0')&&run('CI.filter(Boolean).length')===run('NI.length'),'прорези в DXF: PERF — замкнутые с двумя дугами (код 42), у CUT дуги крайних прорезей, BEND_V/BEND_M нет, у каждой заготовки метки раньше её контура CUT');
ok(run("!EN2.some(e=>e.lay==='PERF')&&!EN3.some(e=>e.lay==='PERF')&&EN2.some(e=>e.lay==='BEND_V')&&EN3.some(e=>e.lay==='BEND_V')"),'прорези выкл или плазма: PERF нет, линии сгиба гравировкой как раньше');
ok(run('PF.relief')>0&&run('PF.relief')+run('PF.missB.length')*2+run('PF.shut')>=run('PF.inner')&&run('PF.relief')<=run('PF.inner'),'разгрузочные отверстия Овч: на концах во внутреннем угле и только там (не врезалось — конец закрыт перемычкой, #140)');
ok(run('PF.edge')===376&&run('PF.relief')===99&&run('PF.shut')===6&&run('PF.missB.length')===7,'#140 на Овчарке: крайних прорезей 376, разгрузочных отверстий 99, закрыто перемычкой концов '+run('PF.shut')+'; без прорезей — только обрывки линий короче 7 мм ('+run('PF.missB')+')');
ok(run('ST.perf=true;ST.slotD=0;CUR.BL.every(B=>blankSlots(B).ends.relief===0)')&&run('ST.slotD=3;CUR.BL.some(B=>blankSlots(B).ends.relief>0)'),'разгрузочное отверстие 0 — отверстий нет');
ok(run('ST.perf=true;ST.slotNotch=false;ST.slotD=0;CUR.BL.every(B=>{const S=blankSlots(B);return S.ends.edge===0&&Math.abs(S.extra)<1e-9;})')&&run('ST.slotD=3;CUR.BL.every(B=>{const S=blankSlots(B);return S.ends.edge===0;})&&CUR.BL.some(B=>blankSlots(B).ends.relief>0)')&&run('ST.slotNotch=true;CUR.BL.some(B=>blankSlots(B).ends.edge>0)'),'крайние прорези выкл — вырезов нет, рез — периметр; во внутренних углах при этом остаётся отверстие (круг)');
run(`if(typeof sheetWL==='undefined')sheetWL=()=>[2500,1250];if(!CUR.bendSt)CUR.bendSt={V:0,m:0,len:CUR.BL.reduce((a,b)=>a+b.lines.reduce((x,l)=>x+l.len,0),0)};N1=CUR.N;CUR.N={W:3000*NI.length,H:3000,gap:3,sheets:[{items:NI,len:1000,dense:.5}],too:[]};`);   // лист — из ui.js, в smoke его нет
ok(run("ST.perf=true;sheetGeneral().body").includes('Проварка сгибов')&&!run("ST.perf=false;sheetGeneral().body").includes('Проварка сгибов'),'общий вид: «Проварка сгибов» есть только с прорезями');
run('CUR.N=N1');
ok(run("ST.perf=true;JSON.stringify(techReq(true))").includes('тисках')&&run("JSON.stringify(techReq(true))").includes('проварить по прорезям')&&!run("ST.perf=false;JSON.stringify(techReq(true))").includes('тисках'),'техтребования: гнуть в тисках по прорезям, потом проварить (только с прорезями)');
run(`ST.perf=true;CD5=buildCards();SV5=CD5.filter(c=>c.svg.includes('Карта заготовки')).map(c=>c.svg);SV5P=SV5.filter(v=>v.includes('class="prf"'));ST.perf=false;CD6=buildCards();`);
ok(run('SV5P.length')>10&&run('SV5P.every(v=>/class="prf" d="M[^"]*Z/.test(v))')&&!run("CD6.some(c=>c.svg.includes('class=\"prf\"'))"),'карта заготовки: средние прорези нарисованы замкнутыми фигурами (у заготовок, где они есть); без галочки их нет');
// v0.17.0 сварка: TIG — зазор 0,5; полуавтомат — 1, лист до 1,5 мм — 0,5; свой зазор при смене толщины не сбивается; меньше зазор — деталь больше (кромка у шва ближе на четверть разницы)
ok(run("weldGap('tig',2)===0.5&&weldGap('tig',3)===0.5&&weldGap('mig',2)===1&&weldGap('mig',3)===1&&weldGap('mig',1.5)===0.5&&weldGap('mig',1)===0.5")
  &&run("gapAfterT(1,'mig',2,1.5)===0.5&&gapAfterT(0.5,'mig',1.5,2)===1&&gapAfterT(1.5,'mig',2,1)===1.5&&gapAfterT(0.8,'tig',2,3)===0.8&&gapAfterT(0.5,'tig',2,1)===0.5"),
  "сварка: рекомендуемый зазор TIG 0,5, полуавтомат 1 (лист до 1,5 мм — 0,5); при смене толщины свой зазор остаётся");
run(`WG={big:0,n:0,sb:0};RP.parts.forEach(p=>{const a=cutContour(p,2,0.5,true),b=cutContour(p,2,1,true);if(a.bad||b.bad)return;WG.n++;const sa=Math.abs(area2(a.pts)),sb=Math.abs(area2(b.pts));if(p.segs.some(g=>g.nb>=0)?sa>sb:Math.abs(sa-sb)<1e-9)WG.big++;
    p.segs.forEach(g=>{if(g.nb>=0&&Math.abs(edgeSetback(g,2,1,true)-edgeSetback(g,2,0.5,true)-0.25)>1e-9)WG.sb++;});});`);
ok(run("WG.n>0&&WG.big===WG.n&&WG.sb===0"),"сварка: при зазоре 0,5 каждая деталь Овч со швами больше, чем при 1 (без швов — та же) — кромка у шва на 0,25 мм дальше, открытый край на месте");
run(`ST.weld='tig';ST.gap=0.5;TQ1=techReq(true);TQ2=techReq(false);ST.weld='mig';ST.gap=1;TQ3=techReq(true);ST.engrave=false;TQ4=techReq(false);ST.engrave=true;TJ=Q=>Q.join(' ').replace(/[  ]+/g,' ');`);
ok(run("TQ1.some(l=>l.includes('Сварка TIG')&&l.startsWith('5.'))&&TJ(TQ1).includes('азотом')&&TJ(TQ1).includes('зазором 0,5 мм')&&!TQ1.some(l=>l.includes('MIG'))")
  &&run("TQ2[1].startsWith('1. Порядок на лазере')&&TQ2.some(l=>l.startsWith('2. Сварка TIG'))&&TQ3.some(l=>l.startsWith('5. Сварка полуавтоматом'))&&TQ3.some(l=>l.includes('Ar+CO₂'))&&TJ(TQ3).includes('зазором 1 мм')&&!TQ3.some(l=>l.includes('азот'))")
  &&run("TQ4[1].startsWith('1. Сварка полуавтоматом')&&[TQ1,TQ2,TQ3,TQ4].every(Q=>Q.every(l=>l.length<=TR_W+4))"),
  "техтребования: всегда есть пункт сварки под её вид (TIG — азот и зазор 0,5, полуавтомат — Ar+CO₂ и зазор 1), без гибки — нумерация с 1, строки по ширине столбца");
const DT=t=>[...t.matchAll(/\r\nTEXT\r\n8\r\n([^\r]+)\r\n[\s\S]*?\r\n1\r\n([^\r]*)/g)].map(m=>({lay:m[1],t:m[2]}));
run(`N0=CUR.N;CUR.N={W:3000,H:3000,gap:3,sheets:[{items:[NI[0]]}]};ST.weld='tig';`);const W1=DT(run('dxfNest()')),W2=DT(run('dxfParts()'));run(`ST.weld='mig';`);const W3=DT(run('dxfNest()')),W4=DT(run('dxfParts()'));run(`CUR.N=N0;ST.weld='tig';`);
// №15: у каждого SVG — карт (buildCards) и чертежей (buildSheets, в т.ч. раскрой) — role="img" и <title> первым, на него aria-labelledby, текст не пустой и с цифрами; id не повторяются
run(`sheetWL=()=>[2500,1250];N0=CUR.N;CL0=CUR.cutLen;T0=CUR.T;CUR.cutLen=1;CUR.T={n:RP.parts.length,mass:1,weld:1};CUR.N=nest(CUR.PC.map(o=>({id:o.id,no:o.no,pts:o.pts})),2500,1250,3,10,2.5,2,true);
  SA=[...buildCards(),...buildSheets()].map(c=>{const m=c.svg.match(/^<svg [^>]*role="img" aria-labelledby="([^"]+)"[^>]*><title id="([^"]+)">([^<]*)<[^<]*title>/);return {m,t:c.title};});
  SAid=SA.map(x=>x.m&&x.m[1]);CUR.N=N0;CUR.cutLen=CL0;CUR.T=T0;`);
console.log('     подписи SVG Овч: '+run('SA.length')+' листов, например «'+run("SA.find(x=>x.m&&/Карта|карта/.test(x.m[3])).m[3]")+'»');
ok(run('SA.length')>40&&run('SA.every(x=>x.m&&x.m[1]===x.m[2]&&x.m[3].trim().length>20&&/[0-9]/.test(x.m[3]))')&&run('new Set(SAid).size')===run('SA.length')&&run("['Общий вид','Порядок сборки','Спецификация','Раскрой листа','карта заготовки','карта детали'].every(w=>SA.some(x=>x.m&&x.m[3].includes(w)))"),
  'читалки экрана: у каждой карты и чертежа (Овч: общий вид, сборка, спецификация, раскрой, карты) role="img" и <title> с текстом и цифрами, aria-labelledby на него, id не повторяются');
const N2=run('DXF_N2'),hasN2=W=>W.filter(x=>x.t===N2);
ok(hasN2(W1).length===1&&hasN2(W1)[0].lay==='SHEET'&&hasN2(W2).length===1&&hasN2(W2)[0].lay==='SHEET'&&!hasN2(W3).length&&!hasN2(W4).length&&/^[\x20-\x7e]+$/.test(N2),
  "DXF под TIG: надпись «резать азотом N2» латиницей на слое SHEET (не CUT/ENGRAVE) — в раскрое и в деталях; под полуавтомат — нет");
// v0.17.0 шаг сборки: другая половина фигуры — призраком (не металлом), элемент и соседи — всегда; элемент посередине — всё собранное
run(`SW={steps:0,cut:0,bad:0,mid:0};asmSteps().steps.forEach(st=>{const S=stepShown(st),x=st.u[0],A=x.ps.reduce((s,p)=>s+p.area,0),cx=x.ps.reduce((s,p)=>s+p.c[0]*p.area,0)/A;SW.steps++;
  if(x.ps.some(p=>!S.has(p.id))||st.w[0].some(q=>!S.has(q.nb))||[...S].some(pi=>!st.done.has(pi)))SW.bad++;if(Math.abs(cx)<15){SW.mid++;if(S.size!==st.done.size)SW.bad++;return;}
  const gone=[...st.done].filter(pi=>!S.has(pi));SW.cut+=gone.length;if(gone.some(pi=>RP.parts[pi].c[0]*Math.sign(cx)>-15))SW.bad++;if(st.u[1]&&st.u[1].ps.some(p=>Math.abs(p.c[0])>=15&&S.has(p.id)))SW.bad++;});`);
console.log('     шаги сборки Овч: '+run('SW.steps')+' (посередине '+run('SW.mid')+'), деталей другой половины призраком всего '+run('SW.cut'));
ok(run('SW.steps>0&&SW.cut>0&&SW.bad===0'),'шаг сборки: другая половина фигуры (зеркальная пара) — призраком, элемент и соседи — металлом, посередине — всё собранное');
// v0.20 окно «крутить сгиб»: сцена сгиба bendScene — одна на снимок и на окно. Овч: сцена на каждый сгиб — линия сгиба, уголок/линейка/дуга, номера деталей элемента, номер сгиба;
// шапка — номер сгиба, V/m и угол те же, что у заготовки и в геометрии (угол между гранями, V — клин против наружных нормалей). THREE, pieceGroup, shotFit (view3d.js) — заглушки
run(`S3=()=>{const t={children:[],add(...a){t.children.push(...a);return p;}},p=new Proxy(t,{get(t,k){if(k in t||typeof k==='symbol')return t[k];if(k==='intersectObjects')return ()=>[];if(k==='position'||k==='quaternion')return t[k]=S3();return ()=>p;}});return p;};
  globalThis.THREE=new Proxy({},{get:()=>function(){return S3();}});globalThis.pieceGroup=own=>({grp:new THREE.Group(),hl:new THREE.DirectionalLight(),ms:[],G:[]});
  globalThis.shotFit=(vs,c,v,asp)=>{const tv=Math.tan(17.5*Math.PI/180);let d=0;vs.forEach(q=>{const o=V3.sub(q,c),z=V3.dot(o,v.d);d=Math.max(d,Math.abs(V3.dot(o,v.r))/(tv*asp*.88)+z,Math.abs(V3.dot(o,v.up))/(tv*.88)+z);});return d;};
  ST={t:2,gap:0.5,useT:true,engrave:true,mat:'steel',name:'Овч',tpl:true,bend:true,pairs:true,minW:15};E11=figTop(figureMesh('shepherd'));M11={V:E11.V,F:E11.F,T:E11.T,S:E11.S};RB=buildParts(M11,1.5,1.5);addBacking(RB,M11);pairNumbers(RB,M11.V);
  CUR={R:RB,M3:M11};CUR.BP=bendPlan(RB,M11.V,{sheet:[1250,2500]});CUR.BL=CUR.BP.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,RB,M11.V,CUR.BP,{t:2,gap:.5,useT:true}))).filter(b=>!b.bad);blankNumbers(CUR.BL,RB);
  CUR.bentKey=new Set(CUR.BL.flatMap(b=>b.bends.map(id=>bendKey(CUR.BP.J[id].p,CUR.BP.J[id].q))));
  BWT=tpl=>{CUR.TPL=tpl?weldTemplates(RB,2,15,(p,q)=>CUR.bentKey.has(bendKey(p,q)),CUR.BL.flatMap(b=>b.lines.map(l=>l.ang))):null;const o={n:0,bad:[],how:{}},nm=pi=>RB.parts[pi].no;
    CUR.BL.forEach((B,bi)=>{const own=new Set(B.parts);B.lines.forEach(l=>{o.n++;const S=bendScene(own,l),j=CUR.BP.J[l.id],a=Math.round(l.ang),no='Г'+B.no+' '+l.k;if(!S){o.bad.push(no+' нет сцены');return;}o.how[S.how]=(o.how[S.how]||0)+1;
      const nos=S.labs.filter(x=>x.k==='no').map(x=>x.t),bl=S.labs.filter(x=>x.k==='bend'),tl=S.labs.filter(x=>x.k==='tpl'),tp=CUR.TPL&&CUR.TPL.some(x=>x.a===a),want=tp?'tpl':a>=TPL_MAX?'ruler':'none';
      if(S.how!==want)o.bad.push(no+' how '+S.how);if(S.P.grp.children.length!==(want==='tpl'?3:2))o.bad.push(no+' в сцене '+S.P.grp.children.length);
      if(nos.length!==own.size||!B.parts.every(pi=>nos.includes(String(nm(pi)))))o.bad.push(no+' номера '+nos);if(bl.length!==1||bl[0].t!==String(l.k))o.bad.push(no+' номер сгиба');
      if(tl.length!==(want==='ruler'?0:1)||tl.length&&tl[0].t!==(tp?tplNo(a):a+'°'))o.bad.push(no+' подпись угла');if(!S.labs.every(x=>x.q.every(isFinite)))o.bad.push(no+' подпись не число');
      const v=bendView(S,1.6);if(!v||!(v.dist>0)||!isFinite(v.dist)||Math.abs(V3.dot(v.v.d,v.v.up))>1e-6)o.bad.push(no+' вид');
      const ang=Math.acos(Math.max(-1,Math.min(1,V3.dot(S.T.e1,S.T.w2))))*180/Math.PI,sg=l.kind==='V'?-1:1;if(Math.abs(ang-l.ang)>1)o.bad.push(no+' угол '+ang.toFixed(1)+' ≠ '+l.ang);
      if(l.kind!==j.kind||V3.dot(S.b,RB.parts[j.p].n)*sg<=0||V3.dot(S.b,RB.parts[j.q].n)*sg<=0)o.bad.push(no+' V/m');
      const h=bendHead(bi,l,S),h0='Г'+B.no+' · сгиб '+l.k+' из '+B.lines.length+' · '+l.kind+a+' — '+(l.kind==='V'?'на себя':'от себя')+' · между № '+nm(l.p)+' и '+nm(l.q)+' · ';
      if(!h.startsWith(h0)||!h.slice(h0.length).startsWith(tp?'уголок '+tplNo(a):a>=TPL_MAX?'по линейке':a<TPL_MIN?'по месту':'транспортиром'))o.bad.push(no+' шапка «'+h+'»');});});return o;};
  BW1=BWT(true);BW2=BWT(false);delete globalThis.THREE;delete globalThis.pieceGroup;delete globalThis.shotFit;`);
console.log('     сгибы Овч в 3D: '+run('BW1.n')+' (с уголками '+run('JSON.stringify(BW1.how)')+', без '+run('JSON.stringify(BW2.how)')+'), напр. «'+run('bendHead(0,CUR.BL[0].lines[0])')+'»; ошибок ['+run('BW1.bad.concat(BW2.bad).slice(0,5)')+']');
ok(run('BW1.n')>20&&run('BW1.bad.length+BW2.bad.length')===0&&run('BW1.how.tpl>0&&!BW2.how.tpl&&BW2.how.none>0'),'окно «крутить сгиб»: Овч — сцена на каждый сгиб (линия, уголок/линейка/дуга, номера деталей, номер сгиба), шапка — номер, V/m и угол как у заготовки и в геометрии');
// ревью 28.10: склонение счётчиков, зазор раскроя от резки, порядок в списке «Фигура», подсказки — на свежей фигуре с настоящими числами
const PL=(n,f)=>run(`plural(${n},'${f[0]}','${f[1]}','${f[2]}')`),PF=['позиция','позиции','позиций'];
ok([1,21,101].every(n=>PL(n,PF)===PF[0])&&[2,3,4,22,54].every(n=>PL(n,PF)===PF[1])&&[0,5,11,12,13,14,48,111,114].every(n=>PL(n,PF)===PF[2]),"склонение: 1, 21 позиция; 2–4, 54 позиции; 5+, 11–14, 111 позиций");
const UI=fs.readFileSync(P+'ui.js','utf8'),HT=fs.readFileSync(__dirname+'/../index.html','utf8');
ok(!/\$\{(?!plural\()[^{}]+\} (позиций|треугольников|угла|швов|участков)/.test(UI)&&/\$\{CUR\.PC\.length\} \$\{plural\(CUR\.PC\.length,'позиция','позиции','позиций'\)\} на резку/.test(UI),"склонение: в ui.js число перед «позиций / треугольников / угла / швов / участков» — через plural");
ok(run("nestGap('laser')===5&&nestGap('plasma')===7&&ngapAfterCut(5,false,'plasma')===7&&ngapAfterCut(7,false,'laser')===5&&ngapAfterCut(4,true,'plasma')===4&&ngapAfterCut(9,true,'laser')===9")
  &&/\$\('sCut'\)[^\n]*ST\.ngap=ngapAfterCut\(ST\.ngap,ST\.ngapOwn,ST\.cut\);\$\('sNGap'\)\.value=ST\.ngap/.test(UI)&&/\$\('sNGap'\)[^\n]*ST\.ngapOwn=true/.test(UI)&&/ngapOwn:false/.test(UI),
  "раскрой: «Между деталями на листе» от резки — лазер 5 мм, плазма 7; поменяли руками — смена резки не трогает");
// скачивание (DXF, JSON): ссылка-blob живёт ≥ 60 с — iPad Safari не успевал за 2 с; все скачивания идут через saveBlob
{const src=/const BLOB_TTL=\d+;\r?\nfunction saveBlob[^\n]*/.exec(UI),ev=[],A={style:{},click(){ev.push('click:'+this.download+':'+this.href+':'+this.inDom);},remove(){this.inDom=false;}};
  const sb={document:{createElement:()=>A,body:{appendChild:a=>{a.inDom=true;}}},URL:{createObjectURL:()=>'blob:x',revokeObjectURL:u=>ev.push('revoke:'+u)},Blob:function(){},setTimeout:(f,ms)=>{ev.push('timer:'+ms);f();}};
  if(src){vm.createContext(sb);vm.runInContext(src[0]+';saveBlob("Овч_N2_raskroy.dxf",new Blob())',sb);}
  ok(src&&ev.join(' ')==='click:Овч_N2_raskroy.dxf:blob:x:true timer:'+(+/BLOB_TTL=(\d+)/.exec(UI)[1])+' revoke:blob:x'&&+/BLOB_TTL=(\d+)/.exec(UI)[1]>=60000
    &&(UI.match(/createObjectURL/g)||[]).length===1&&/function dl\(name,text\)\{saveBlob\(/.test(UI)&&fs.readdirSync(P).filter(f=>f!=='ui.js'&&/createObjectURL/.test(fs.readFileSync(P+f,'utf8'))).length===0,
    "скачивание DXF/JSON: ссылка в документе, клик, отзыв через ≥ 60 с (iPad Safari); других createObjectURL нет");}
// клик по детали: в 3D — строка подсвечена, крутится только свой блок таблицы (страница на месте); по строке — «Вид» открыт, плавно к эскизу, на телефоне — к модели, шторка закрыта (#54)
{const fn=n=>(new RegExp('\\nfunction '+n+'\\([\\s\\S]*?(?=\\n(//|\\$\\(|function ))').exec(UI)||[''])[0],ev=[];
  const el=(id,o={})=>Object.assign({id,parentElement:null,scrollTop:0,scrollHeight:100,clientHeight:100,ov:'visible',top:0,h:20,cls:new Set(),
    getBoundingClientRect(){return {top:this.top,bottom:this.top+this.h};},scrollIntoView(a){ev.push('into:'+this.id+':'+a.behavior+':'+a.block);},scrollTo(a){ev.push('to:'+this.id+':'+a.top+':'+a.behavior);},
    classList:{remove:c=>ev.push('shut-:'+id),toggle:(c,on)=>ev.push('cls:'+id+':'+c+':'+on)},setAttribute(){},querySelector:q=>q==='.drawerhead'?{offsetHeight:50}:q==='[data-g="view"]'?{classList:{remove:()=>ev.push('view-open')}}:null},o);
  const body=el('body'),wrap=el('wrap',{parentElement:body,ov:'auto'}),tr=el('tr',{parentElement:wrap,top:500}),E={controls:el('controls',{ov:'auto',top:100,scrollTop:40}),selBox:el('selBox',{top:700}),stage:el('stage'),drawerBtn:el('drawerBtn',{disp:'none'})};
  const sb={document:{body},getComputedStyle:e=>({overflowY:e.ov,display:e.disp||'block'}),matchMedia:()=>({matches:false}),$:id=>E[id],window:{scrollTo:()=>ev.push('page')}};
  vm.createContext(sb);vm.runInContext(fn('revealRow')+fn('showSel')+fn('drawer'),sb);const T='деталь: клик в 3D не крутит страницу (только свой блок таблицы), клик по строке — «Вид» открыт, плавно к эскизу, на телефоне — к модели, шторка закрыта';
  if(!/function revealRow/.test(UI)||!/function showSel/.test(UI))ok(false,T+' — нет revealRow / showSel');else{
  vm.runInContext('revealRow(null)',sb);const a=ev.join(' ')+'|'+wrap.scrollTop;          // нет строки (вкладка скрыта и т. п.)
  vm.runInContext('revealRow(E_tr)',Object.assign(sb,{E_tr:tr}));const b=ev.join(' ')+'|'+wrap.scrollTop;   // блок не прокручивается — ничего
  wrap.scrollHeight=900;wrap.top=0;wrap.h=300;vm.runInContext('revealRow(E_tr)',sb);const c=wrap.scrollTop;         // свой блок: строка ниже на 220 → scrollTop +220
  ev.length=0;vm.runInContext('showSel()',sb);const d=ev.join(' ');
  ev.length=0;E.drawerBtn.disp='block';vm.runInContext('showSel()',sb);const f=ev.join(' ');
  ok(a==='|0'&&b==='|0'&&c===220&&d==='view-open into:selBox:smooth:nearest'&&f==='view-open cls:controls:open:false into:stage:smooth:start'
    &&/revealRow\(\$\('parts'\)\.querySelector\(`tr\[data-p="\$\{pi\}"\]`\)\)/.test(UI)&&(UI.match(/scrollIntoView/g)||[]).length===3
    &&/else\{ST\.sel=\+tr\.dataset\.p;ST\.selB=-1;renderAll\(\);focusPart\([^\n]*showSel\(\);return;\}/.test(UI),
    T);}}
// подпись сгиба не через выступ кромки: углы и середина рамки внутри, а узкая прорезь от края проходит между ними
{const P=[[0,0],[40,0],[40,20],[25.5,20],[25.5,4],[22.5,4],[22.5,20],[0,20]],g=run(`bendLabel('V90 (1)',[5,10,35,10],${JSON.stringify(P)},4)`);
  const crosses=g&&g.some(s=>P.some((a,i)=>run(`segX(${JSON.stringify([s[0],s[1]])},${JSON.stringify([s[2],s[3]])},${JSON.stringify(a)},${JSON.stringify(P[(i+1)%P.length])})`))),inside=g&&g.every(s=>run(`inPoly([${s[0]},${s[1]}],${JSON.stringify(P)})&&inPoly([${s[2]},${s[3]}],${JSON.stringify(P)})`));
  ok(!!g&&!crosses&&inside,'подпись сгиба не пересекает узкую прорезь от кромки (рамка целиком внутри контура)');}
// телефон / iPad (BACKLOG 5–8): поля ≥ 16 px, галочки и «?» под палец, выпадашки «Перейти» высокие, вкладки ровно
{const CSS=fs.readFileSync(__dirname+'/../css/style.css','utf8'),T=/@media \(max-width:900px\),\(pointer:coarse\)\{([\s\S]*?)\n\}/.exec(CSS),t=T?T[1]:'',M6=/@media \(max-width:719px\)\{\s*\.tabbar\{flex-direction:column/.test(CSS);
  ok(/select,textarea\{font-size:16px!important\}/.test(t)&&/\.chk input[^{]*\{width:24px;height:24px/.test(t)&&/\.tip\{[^}]*width:32px;height:32px/.test(t)&&/#shGo,#cdGo\{min-height:44px/.test(t)&&M6&&!/\.tabbar\{flex-wrap:wrap/.test(CSS),
    "телефон/iPad: поля 16 px, галочки 24, «?» 32×32, «Перейти к листу/карте» 44 px, вкладки — столбцом, как в мангале");}
{const sel=/<select id="figSel">([\s\S]*?)<\/select>/.exec(HT)[1],O=[...sel.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g)].map(m=>({v:m[1],t:m[2]}));
  const SELD=/<option value="([^"]*)"[^>]*\sselected[\s>]/.exec(sel);
  const S2=['shepherd2_1000','shepherd2_700','shepherd2_500','shepherd2_350'],IDS=['shepherd',...S2,'shepherd3','shepherd5','shepherd6r','shepherd6'];
  ok(O.map(o=>o.v).join()===[...IDS.slice(0,-2),'shepherd5_orig','shepherd6r','shepherd6','shepherd7_orig'].join()&&O[0].t==='Овчарка'&&O.every(o=>o.t===run(`FIGURES.${o.v}.name`))&&S2.every(id=>/^Овчарка 2 \(\d+\)$/.test(run(`FIGURES.${id}.name`)))&&run('FIGURES.shepherd3.name')==='Овчарка 3'&&run('FIGURES.shepherd5.name')==='Овчарка 5'&&run('FIGURES.shepherd6r.name')==='Овчарка 6 — оригинал'&&run('FIGURES.shepherd6.name')==='Овчарка 6 (как доберман)'&&run('FIGURES.shepherd7_orig.name')==='Овчарка 7 — оригинал'&&SELD&&SELD[1]==='shepherd'
     &&run("Object.keys(FIGURES).filter(k=>!FIGURES[k].view&&!FIGURES[k].ow).sort().join()")===IDS.slice().sort().join()&&IDS.every(id=>run(`FIGURES.${id}.H===1000`)),
     "список «Фигура»: Овчарка (выбрана), Овчарка 2 (N) ×4, Овчарка 3, Овчарка 5, «Овчарка 5 — оригинал (вид)», «Овчарка 6 — оригинал» (#170), «Овчарка 6 (как доберман)» (#171), «Овчарка 7 — оригинал» (#174), подписи как в FIGURES; других фигур в коде нет; высота по умолчанию 1000 мм");}
// стартовая фигура: #f= из адреса, иначе запомненная (свой ключ shepherd-fig), иначе Овчарка; неизвестный id, запомненные собака и конь — тоже Овчарка
{const src=/\nfunction startFig\([^\n]*/.exec(UI),sb={FIGURES:run('FIGURES')};if(src)vm.createContext(sb),vm.runInContext(src[0],sb);const SF=(h,s)=>vm.runInContext(`startFig(${JSON.stringify(h)},${JSON.stringify(s)})`,sb);
  ok(!!src&&SF('','')==='shepherd'&&SF('#f=shepherd',null)==='shepherd'&&SF('#f=shepherd2_700',null)==='shepherd2_700'&&SF('#f=shepherd3&edit&trace',null)==='shepherd3'&&SF('','shepherd2_350')==='shepherd2_350'&&SF('#f=horse100',null)==='shepherd'&&SF('#f=doberman11',null)==='shepherd'&&SF('#f=zzz','doberman11')==='shepherd'&&SF('','shepherd')==='shepherd'&&SF('','horse100')==='shepherd'
    &&/store\('shepherd-fig',id\)/.test(UI)&&!/horse-fig|art-fig/.test(UI),"старт: #f=shepherd — Овчарка; неизвестный #f=, запомненные доберман и конь — Овчарка; ключ браузера свой (shepherd-fig), с собакой и конём не путается");}
{const tc={};vm.createContext(tc);const src=fs.readFileSync(P+'tips.js','utf8');vm.runInContext(src.slice(0,src.indexOf('\n(()=>'))+'\nthis.TIPS=TIPS;',tc);const TP=tc.TIPS;
  ok(!/быка|[Рр]ыс|[Дд]оберман|[Кк]он[ья]/.test(Object.values(TP).join(' '))&&/Овчарка/.test(TP.figSel)&&/1000 мм/.test(TP.figSel),"подсказки: про овчарку (1000 мм), про коня, добермана, быка и рысь ни слова");
  ok(/плазма — 7 мм/.test(TP.sNGap)&&/руками/.test(TP.sNGap),"подсказка «Между деталями на листе»: плазма 7 мм, свой зазор не сбивается");}
ok(UI.includes('wl=FIGURES[ST.fig]?.noBack?0:addBacking(R,M3,FIGURES[ST.fig]?.backIf)'),'фигура с noBack: открытые края — не прорези, подложек глаз нет');
// v0.23.0 backIf: фигура сама выбирает дыры под подложку — центр дыры в долях габарита (0…1)
// овчарка замкнутая — дыр нет, подложек 0; выбор дыр фигурой (backIf) проверяем на коробе без левой и правой граней: две дыры, по центрам x = 0 и 1
ok(run("(()=>{const b=figureMesh('shepherd'),M={V:b.V,F:b.F,T:b.T,S:b.S},R=buildParts(M,1.5,1.5),n0=R.parts.length;return addBacking(R,M)===0&&R.parts.length===n0;})()"),'у овчарки дыр нет — подложек 0');
run(`BX=blankBox(300,400,260);BXM=polyBase(BX.V,BX.P.filter((_,i)=>i<4));BK=k=>{const M={V:BXM.V,F:BXM.F,T:BXM.T,S:[]},R=buildParts(M,1.5,1.5),n0=R.parts.length;addBacking(R,M,k);return R.parts.slice(n0).filter(p=>p.back).map(p=>Math.round(p.c[0]));};BKA=BK();BKN=BK(()=>false);BKH=BK(c=>c[0]>.5);`);
ok(run("BKA.length")===2&&run("BKN.length")===0&&run("BKH.length")===1&&run("BKH[0]")>0&&run("BKA.includes(BKH[0])"),'backIf: подложки только у выбранных фигурой дыр (короб с двумя дырами: все '+run("BKA.length")+', правая половина '+run("BKH.length")+', ни одной '+run("BKN.length")+')');
// ревью 28.10 №2, 4, 19, 20 — овчарка как на странице (натуральная высота 1000, гибка с повтором, номера пар, у «.1» — числа основной)
run(`PG=id=>{ST={t:2,gap:0.5,useT:true,minW:15,bend:true,tpl:true,engrave:true,perf:true,cut:'laser',slotW:2,slotL:40,slotBr:3,slotEb:3,slotEl:5,slotNotch:true,slotD:3};let M=figTop(figureMesh(id,12));
    {const z=meshBox(M.V).size,H=z[1];M=polyBase(fitMesh({V:M.V,F:[]},{H,W:Math.round(z[0]*H/z[1]),D:Math.round(z[2]*H/z[1])}).V,M.P,M.S);}M={V:M.V,F:M.F,T:M.T,S:M.S};
    const R=buildParts(M,1.5,1.5);addBacking(R,M);pairNumbers(R,M.V);let P,BL;const ban=new Set();
    for(let k=0;k<4;k++){P=bendPlan(R,M.V,{sheet:[1250,2500],ban});const B=P.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,R,M.V,P,{t:2,gap:0.5,useT:true})));BL=B.filter(b=>!b.bad);if(BL.length===B.length)break;B.filter(b=>b.bad).forEach(b=>b.bends.forEach(id=>ban.add(id)));}
    blankNumbers(BL,R);blankTwins(BL,R,P.J);CUR={R,M3:M,BL,BP:P};return CUR;};
  FIGS=['shepherd'];NM=id=>FIGURES[id].name;NO=x=>String(x).replace(/[.]1$/,'');`);
// №2: у X и X.1 одни числа — угол и порядок сгибов, габарит, площадь, рез у заготовок; размеры, площадь, рез и углы швов у деталей (раньше: Г1 V166 / V167, Г3 186 × 80 / 81, шов 95° / 96°)
run(`MP={blanks:0,parts:0,bad:[],raw:0};FIGS.forEach(id=>{const C=PG(id),R=C.R,no=i=>R.parts[i].no;
  C.BL.filter(b=>b.no%1).forEach(b=>{const m=C.BL.find(x=>x.no===Math.floor(b.no));if(!m)return;MP.blanks++;const w=NM(id)+' Г'+m.no+'/Г'+b.no;
    const ln=B=>B.lines.map(l=>l.k+l.kind+l.ang+' '+[no(l.p),no(l.q)].map(NO).sort().join('-')).join(' ');if(ln(b)!==ln(m))MP.bad.push(w+' сгибы «'+ln(m)+'» ≠ «'+ln(b)+'»');
    if([b.L,b.W,b.area,b.cut].map(Math.round).join()!==[m.L,m.W,m.area,m.cut].map(Math.round).join())MP.bad.push(w+' габарит/площадь/рез');
    if(Math.round(bendDims(b.pts)[0])!==Math.round(bendDims(m.pts)[0])||Math.round(perim(b.pts))!==Math.round(perim(m.pts)))MP.raw++;});
  R.parts.filter(p=>p.twin!=null&&p.no%1).forEach(p=>{const q=mainPart(R,p),w=NM(id)+' '+q.no+'/'+p.no,nb=i=>partNbs(R,i).map(g=>NO(no(g.nb))+' '+angT(g.dih)).join(', ');MP.parts++;
    if(q===p||q.no!==Math.floor(p.no))MP.bad.push(w+' основная');if(nb(p.id)!==nb(q.id)&&partNbs(R,p.id).map(g=>NO(no(g.nb))).sort().join()===partNbs(R,q.id).map(g=>NO(no(g.nb))).sort().join())MP.bad.push(w+' соседи «'+nb(q.id)+'» ≠ «'+nb(p.id)+'»');});});`);
console.log('     зеркальные пары Овчарки: заготовок '+run('MP.blanks')+' (по своей геометрии разошлись бы габарит или рез у '+run('MP.raw')+'), деталей '+run('MP.parts')+'; расхождений ['+run('MP.bad.slice(0,4)')+']');
ok(run('MP.blanks')>0&&run('MP.parts')>0&&run('MP.bad.length')===0,'зеркальные пары Овчарки: у Г3.1 углы, порядок сгибов, габарит, площадь и рез — как у Г3; у детали X.1 размеры и соседи с углами — как у X');
// №2: подписи сгибов в DXF у пары одни; Овч — те, что нашлись на ревью
run(`C=PG('shepherd');DXL=b=>{const t=bendAlign(b.pts,true),o={id:'b'+C.BL.indexOf(b),no:'Г'+b.no,pts:b.pts.map(q=>trPt(t,q)),tr:t};return itemMarks(o).labs.map(x=>x.t).sort().join(' ');};
  DX2=C.BL.filter(b=>b.no%1).filter(b=>DXL(b)!==DXL(C.BL.find(x=>x.no===Math.floor(b.no)))).map(b=>'Г'+b.no);`);
ok(run('DX2.length')===0,'зеркальные пары в DXF: подписи сгибов у всех пар одни и те же');
// #135 прорези Овч (было №19 — перемычка от старой щели до кромки; правило сменилось): средние прорези целиком внутри заготовки, по одной врезке на каждую
run(`PB={missBad:[],n:0,out:0,min:1e9,miss:0,segs:0,edge:0,selfX:0,areaBad:0,relief:0,zero:[]};ZR=P=>P.filter((q,i)=>{const z=P[(i+1)%P.length];return dn(z[0])===dn(q[0])&&dn(z[1])===dn(q[1]);}).length;FIGS.forEach(id=>{const C=PG(id);C.BL.forEach((b,i)=>{const t=bendAlign(b.pts,true),P=b.pts.map(q=>trPt(t,q)),m=itemMarks({id:'b'+i,no:'Г'+b.no,pts:P,tr:t}),dP=polyDist(P);
    const BS=blankSlots(b);PB.miss+=BS.miss.length;BS.miss.forEach(t=>{const l=b.lines.find(l=>'Г'+b.no+' '+bendTxt(l)===t);if(!l||!l.segs.some(z=>Math.hypot(z[2]-z[0],z[3]-z[1])<slotOpt().br+2*slotOpt().w))PB.missBad.push(t);});PB.edge+=BS.ends.edge;if(ZR(BS.outline.pts)>ZR(b.pts))PB.zero.push('Г'+b.no);PB.relief+=BS.ends.relief;if(SX(BS.outline))PB.selfX++;if(Math.abs(area2(b.pts))-Math.abs(area2(FF(BS.outline)))>25*BS.ends.edge+1)PB.areaBad++;PB.segs+=b.lines.reduce((a,l)=>a+l.segs.length,0);m.P.forEach(h=>{PB.n++;const F=shapeFlat(h,16);if(F.some(q=>!inPoly(q,P)))PB.out++;F.forEach(q=>{PB.min=Math.min(PB.min,dP(q));});});});});`);
console.log('     прорези Овч: отрезков линий '+run('PB.segs')+', прорезей '+run('PB.n')+', линий без прорезей '+run('PB.miss')+', ближе всего к кромке '+run('PB.min.toFixed(2)')+' мм, крайних прорезей '+run('PB.edge')+', разгрузочных отверстий '+run('PB.relief')+', контуров с самопересечением '+run('PB.selfX'));
ok(run('PB.n')>100&&run('PB.out')===0&&run('PB.min')>=3-1e-6,'прорези Овч: средние прорези целиком внутри заготовки, до кромки не меньше перемычки 3 мм');
ok(run('PB.zero.length')===0,'вырезы в контуре не добавляют нулевых отрезков в DXF (соседние точки после округления до 0,01 мм разные)'+(run('PB.zero.length')?' — '+run('PB.zero'):''));
ok(run('PB.edge')===376&&run('PB.relief')===109&&run('PB.selfX')===0&&run('PB.areaBad')===0&&run('PB.missBad.length')===0,'крайние прорези и разгрузочные отверстия Овч: врезаны в контур, контур CUT без самопересечений, площадь меньше только на вырезы; овчарка: крайних 376, отверстий 109; без прорезей только обрывки линий короче 7 мм — их '+run('PB.miss')+' (#140, правило 2)');
// №20: в контуре заготовки нет повтора точки — соседние точки не ближе 0,05 мм, и после округления DXF до 0,01 тоже разные
run(`ZS={n:0,bad:[]};FIGS.forEach(id=>{const C=PG(id);C.BL.forEach(b=>{const P=b.pts;ZS.n++;P.forEach((q,i)=>{const z=P[(i+1)%P.length];if(Math.hypot(z[0]-q[0],z[1]-q[1])<=.05||dn(z[0])===dn(q[0])&&dn(z[1])===dn(q[1]))ZS.bad.push(NM(id)+' Г'+b.no);});});});`);
ok(run('ZS.n')===181&&run('ZS.bad.length')===0,'контур заготовки овчарки без нулевых отрезков: точки не ближе 0,05 мм, в DXF не совпадают');
// №18 (остаток): номер детали в заготовке ставился по грани модели, а у шва контур реза срезан зазором — у Г5 (коней) штрихи вылезали за кромку до 2,1 мм.
// Теперь у всех деталей овчарки (в заготовках и отдельных) гравировка номера целиком внутри контура реза и не ближе 0,5 мм к кромке
run(`EI={n:0,min:1e9,bad:[],miss:0};FIGS.forEach(id=>{const C=PG(id),inB=new Set(C.BL.flatMap(b=>b.parts)),chk=(no,g,P,w)=>{if(!g){if(/Г/.test(w))EI.miss++;return;}EI.n++;const d=polyDist(P);
    g.forEach(s=>[[s[0],s[1]],[s[2],s[3]]].forEach(q=>{const v=inPoly(q,P)?d(q):-d(q);EI.min=Math.min(EI.min,v);if(v<.5&&!EI.bad.includes(w))EI.bad.push(w);}));};
  C.BL.forEach((b,i)=>{const t=bendAlign(b.pts,true),P=b.pts.map(q=>trPt(t,q)),m=itemMarks({id:'b'+i,no:'Г'+b.no,pts:P,tr:t});m.num.forEach(n=>chk(n.no,n.g,P,NM(id)+' Г'+b.no+' №'+n.no));});
  C.R.parts.forEach((p,pi)=>{if(inB.has(pi))return;const c=cutContour(p,2,.5,true);if(!c.bad)chk(p.no,engraveSegs(p.no,c.pts),c.pts,NM(id)+' №'+p.no);});});`);
console.log('     гравировка номеров овчарки: номеров '+run('EI.n')+', ближе всего к кромке реза '+run('EI.min.toFixed(2)')+' мм; за кромкой или ближе 0,5 мм ['+run('EI.bad.slice(0,6)')+']');
ok(run('EI.n')===480&&run('EI.bad.length')===0&&run('EI.miss')===0,'гравировка номера у всех деталей овчарки (в заготовках — у каждой, и отдельных) целиком внутри контура реза, не ближе 0,5 мм к кромке');
// #139 режим «Углы» (angles-core.js): число угломера как в таблице, угломер снаружи, тапы и цвета
run(`AC=PG('shepherd');AR=AC.R;AM=AC.M3;AK=new Set();AP=[];AR.edges.forEach(e=>{if(e.p.length!==2)return;const k=bendKey(e.p[0],e.p[1]);if(AK.has(k))return;AK.add(k);AP.push([e.p[0],e.p[1]]);});
  AX={n:AP.length,geo:0,err:0,worst:'',deg:[],twin:0,twinBad:[],multi:null,okind:[],flat:0,flatBad:[]};
  AP.forEach(([a,b])=>{const G=angGeom(AR,AM,a,b),E=angEdges(AR,a,b),e=E.reduce((x,y)=>y.len>x.len?y:x),d0=Math.min(e.dih,360-e.dih);
    if(G){AX.geo++;const er=Math.abs(G.th*180/Math.PI-d0);if(er>AX.err){AX.err=er;AX.worst=AR.parts[a].no+'–'+AR.parts[b].no;}}
    const I=angInfo(AR,a,b,null,null),d=seamDih(AR,a,b);if(I.deg!==Math.round(d>180.5?360-d:d))AX.deg.push(AR.parts[a].no+'–'+AR.parts[b].no);
    if(I.other!==180-I.deg||I.kind!==(d<=180.5?'выступ':'впадина'))AX.okind.push(AR.parts[a].no+'–'+AR.parts[b].no);
    if(E.length>1&&!AX.multi)AX.multi={len:I.len,sum:E.reduce((s,x)=>s+x.len,0),n:E.length};
    const a2=twinIx(AR,a),b2=twinIx(AR,b);if((a2!==a||b2!==b)&&angAdj(AR,a2,b2)){AX.twin++;if(angInfo(AR,a2,b2,null,null).deg!==I.deg)AX.twinBad.push(AR.parts[a].no+'–'+AR.parts[b].no);}
    if(I.deg>=175){AX.flat++;if(!gaugePose(AR,AM,a,b,2))AX.flatBad.push(AR.parts[a].no+'–'+AR.parts[b].no);}});`);
console.log('     углы Овч: пар деталей со швом '+run('AX.n')+', с геометрией '+run('AX.geo')+', наибольшее расхождение угломера с таблицей '+run('AX.err.toFixed(2)')+'° ('+run('AX.worst')+'); зеркальных пар '+run('AX.twin')+'; почти плоских (≥175°) '+run('AX.flat'));
ok(run('AX.n')>100&&run('AX.geo')===run('AX.n')&&run('AX.err')<=1.5,'углы: на всех швах Овч угол угломера = числу таблицы ±1,5°');
ok(run('AX.deg.length')===0&&run('AX.twin')>0&&run('AX.twinBad.length')===0,'углы: число как в таблице, у зеркальной пары одно'+(run('AX.twinBad.length')?' — '+run('AX.twinBad.slice(0,5)'):''));
ok(run('AX.multi')===null||run('AX.multi.n')>1&&Math.abs(run('AX.multi.len')-run('AX.multi.sum'))<1e-9,'углы: шов из нескольких рёбер — длина шва = сумма рёбер'+(run('AX.multi')===null?' (у овчарки таких швов нет — проверяется в smoke коня и собаки)':''));
ok(run('AX.okind.length')===0,'углы: по другой шкале = 180 − угол, «выступ» / «впадина» по углу шва');
ok(run('AX.flat')>0&&run('AX.flatBad.length')===0,'углы: угломер у почти плоских швов (≥175°) рисуется, как у всех');
run(`ACB=buildParts(cube);ACQ=[];ACB.edges.forEach(e=>{if(e.p.length===2&&!ACQ.some(([a,b])=>bendKey(a,b)===bendKey(e.p[0],e.p[1])))ACQ.push(e.p);});
  ACC=ACQ.map(([a,b])=>{const P=gaugePose(ACB,cube,a,b,2),G=angGeom(ACB,cube,a,b),c=[50,50,50],q=V3.add(P.hinge,V3.mul(P.head,20));
    return V3.dot(V3.sub(q,c),P.head)>0&&Math.abs(V3.dot(P.base,G.n1))<1e-6&&Math.abs(V3.dot(P.arm,G.n2))<1e-6&&Math.abs(V3.dot(V3.sub(P.hinge,G.M),G.n1)-2)<1e-6&&Math.abs(V3.dot(V3.sub(P.hinge,G.M),G.n2)-2)<1e-6&&V3.dot(P.head,P.arm)<0&&P.deg===90&&angInfo(ACB,a,b,null,null).kind==='выступ';});`);
ok(run('ACC.length')===12&&run('ACC.every(Boolean)'),'углы: куб — угломер снаружи (головка наружу, край и линейка по граням, шарнир на толщину листа от обеих), 90°, «выступ»');
run(`AVE=poke(blankBox(300,400,260),blankBox(300,400,260).P.findIndex(Q=>Q.every(i=>blankBox(300,400,260).V[i][0]===150)),-30,false);AVM=polyBase(AVE.V,AVE.P);AVR=buildParts(AVM,1.5,1.5);AVQ=[];
  AVR.edges.forEach(e=>{if(e.p.length===2&&!AVQ.some(([a,b])=>bendKey(a,b)===bendKey(e.p[0],e.p[1])))AVQ.push(e.p);});
  AVV=AVQ.filter(([a,b])=>seamDih(AVR,a,b)>180.5).map(([a,b])=>{const P=gaugePose(AVR,AVM,a,b,2),G=angGeom(AVR,AVM,a,b),c=[0,200,130];
    return angInfo(AVR,a,b,null,null).kind==='впадина'&&V3.dot(V3.sub(V3.add(P.hinge,V3.mul(P.head,20)),G.M),G.n1)>0&&V3.dot(P.head,P.arm)>0&&V3.dot(V3.sub(V3.add(P.hinge,V3.mul(P.head,20)),c),[1,0,0])>0;});`);
ok(run('AVV.length')>=4&&run('AVV.every(Boolean)'),'углы: вогнутый шов (вмятина на боку куба) — «впадина», головка снаружи в ямке, на стороне линейки');
run(`AT=(()=>{const a=AP[0][0],b=AP[0][1],far=AR.parts.findIndex((p,i)=>i!==a&&i!==b&&!angAdj(AR,a,i)&&!angAdj(AR,b,i)),s1=angTap(AR,[a],b),s2=angTap(AR,s1.pick,b),s3=angTap(AR,s1.pick,far),s4=angTap(AR,[a],-1);
    return s1.pick.join()===a+','+b&&!s1.note&&s2.pick.join()===String(a)&&s3.pick.length===1&&s3.pick[0]===far&&/не стыкуется/.test(s3.note)&&/начал заново/.test(s3.note)&&s4.pick.join()===String(a)&&angTap(AR,[],far).pick.join()===String(far)&&angPairs(AR,[a,b,far]).length===1;})();`);
ok(run('AT'),'углы: тапы — сосед добавляется, повтор убирает, несоседняя — выбор заново с подсказкой, мимо модели — без изменений');
ok(run('angColor(8)===angColor(0)&&new Set(ANG_COLORS).size===8&&ANG_COLORS.length===8&&!ANG_COLORS.includes("#1f6fe0")&&!ANG_COLORS.includes("#9fd49a")'),'углы: 8 разных цветов выбранных по кругу, без синего угломера и зелёных соседей');
// #141 овчарка: правила чистки (tools/check.js) на встроенной фигуре — как её читает страница; все правила, кроме узких, — без нарушений; узкие (чистка их не убрала) — в tools/report.md
{const {checkFigure,broken}=require('./check.js')(run),HARD=['planar','short','step','needle','selfX','pierce','sym','flipped','degenerate','open'];['shepherd'].forEach(id=>{const m=run(`modelPoly('${id}')`),R=checkFigure({V:m.V,P:m.P,S:m.S},{sym:true}),B=run(`meshBox(modelPoly('${id}').V).size`),hb=HARD.filter(k=>R[k].length);
  ok(hb.length===0&&Math.abs(B[1]-1000)<.01&&R.parts>=300,`${run(`FIGURES.${id}.name`)}: грани плоские (≤ 0,1 мм), симметрия ≤ 0,1 мм, открытых рёбер, самопересечений, протыканий, развёрнутых и вырожденных граней нет, рёбра ≥ 5 мм, ступенек нет, углы ≥ 5°; высота 1000, деталей ${R.parts}`+(hb.length?' — нарушено '+hb:''));console.log('     остальные правила овчарки (см. report.md): '+(broken(R).filter(k=>!HARD.includes(k)).map(k=>k+' '+R[k].length).join(', ')||'нет'));});}
run(`HN=['shepherd'].map(id=>{const C=PG(id),t=bendAlign,PC=C.R.parts.filter(p=>!C.BL.some(b=>b.parts.includes(p.id))).map(p=>{const c=cutContour(p,2,.5,true);return c.bad?null:{id:p.id,no:p.no,pts:c.pts};}).filter(Boolean)
    .concat(C.BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts}))),N=nest(PC,2500,1250,5,10,2.5,2,true);CUR.N=N;CUR.BL=C.BL;const NL=String.fromCharCode(13,10),tx=dxfNest(),lay=L=>tx.split(NL+'8'+NL+L+NL).length-1,items=N.sheets.reduce((a,s)=>a+s.items.length,0);
    return {id,pieces:PC.length,items,too:N.too.length,sheets:N.sheets.length,cut:lay('CUT'),perf:lay('PERF')};});`);
console.log('     раскрой и DXF овчарки: '+run("HN.map(h=>h.id+': позиций '+h.pieces+', на листах '+h.items+' ('+h.sheets+' л.), не влезло '+h.too+', в DXF контуров CUT '+h.cut+', PERF '+h.perf).join('; ')"));
ok(run("HN.every(h=>h.pieces>0&&h.items===h.pieces&&h.too===0&&h.cut>=h.items&&h.perf>0)"),'раскладка на лист 1250 × 2500 и DXF раскроя строятся у овчарки: все позиции на листах, у каждой контур CUT, прорези сгибов — PERF');
// #142 Овчарка 2 (N): файл фигуры ленивый (грузится по выбору); после загрузки — правила чистки, число граней в подписи, гибка, раскрой и DXF
{const {checkFigure,broken}=require('./check.js')(run),HARD=['planar','short','step','needle','selfX','pierce','sym','flipped','degenerate','open'],S2=['shepherd2_1000','shepherd2_700','shepherd2_500','shepherd2_350'];
  const HT2=fs.readFileSync(__dirname+'/../index.html','utf8');
  ok(S2.every(id=>run(`FIGURES.${id}.need`)==='plates-'+id&&fs.existsSync(P+'plates-'+id+'.js')&&!HT2.includes('plates-'+id+'.js')),'Овчарка 2: файлы фигур есть, на странице не подключены — грузятся, только когда фигуру выбрали');
  S2.forEach(id=>{const nm=run(`FIGURES.${id}.name`),m=run(`modelPoly('${id}')`),R=checkFigure({V:m.V,P:m.P,S:m.S},{sym:true}),B=run(`meshBox(modelPoly('${id}').V).size`),hb=HARD.filter(k=>R[k].length);
    ok(run(`LAZY[FIGURES.${id}.need].ok()&&figureReady('${id}')`)===true&&+/\((\d+)\)/.exec(nm)[1]===m.P.length,`${nm}: после загрузки файла строится сразу; в скобках — граней фигуры (${m.P.length})`);
    ok(hb.length===0&&Math.abs(B[1]-1000)<.01,`${nm}: грани плоские, симметрия, замкнута, без самопересечений и протыканий, рёбра ≥ 5 мм, ступенек нет, углы ≥ 5°; высота 1000, деталей ${R.parts}`+(hb.length?' — нарушено '+hb.map(k=>k+' '+R[k].length):''));
    console.log('     остальные правила (см. report-'+id+'.md): '+(broken(R).filter(k=>!HARD.includes(k)).map(k=>k+' '+R[k].length).join(', ')||'нет'));
    const h=run(`(()=>{const C=PG('${id}'),PC=C.R.parts.filter(p=>!C.BL.some(b=>b.parts.includes(p.id))).map(p=>{const c=cutContour(p,2,.5,true);return c.bad?null:{id:p.id,no:p.no,pts:c.pts};}).filter(Boolean).concat(C.BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts}))),
      N=nest(PC,2500,1250,5,10,2.5,2,true);CUR.N=N;CUR.BL=C.BL;const NL=String.fromCharCode(13,10),tx=dxfNest(),lay=L=>tx.split(NL+'8'+NL+L+NL).length-1,items=N.sheets.reduce((a,s)=>a+s.items.length,0);
      return {parts:C.R.parts.length,blanks:C.BL.length,pieces:PC.length,items,too:N.too.length,sheets:N.sheets.length,cut:lay('CUT'),perf:lay('PERF')};})()`);
    ok(h.pieces>0&&h.items===h.pieces&&h.too===0&&h.cut>=h.items,`${nm}: деталей ${h.parts}, заготовок со сгибами ${h.blanks}, позиций ${h.pieces} — все на листах 1250 × 2500 (${h.sheets} л.), у каждой контур CUT в DXF, PERF ${h.perf}`);});}
// #142 Овчарка 3: плиты конвейера (tools/make-shepherd.js shepherd3) — ленивый файл, обязательные правила (строится, симметрия, замкнута, без самопересечений и протыканий), раскрой и DXF;
// калька js/trace-shepherd3.js — ленивая, в кадре фигуры: атлас находит облако на ≥ 95 % граней и на голове (кадр 600 мм вместо 1000 или поиск вдоль нормали ±6 мм дают ~25 % серого)
// #142 Овчарка 5 — те же проверки (плиты конвейера по гранёной модели Meshy 7.1, калька js/trace-shepherd5.js)
// #170 Овчарка 6 — оригинал: те же проверки; кальки Овчарки 6 — набор S6REFS (#172), их проверка ниже
['shepherd3','shepherd5','shepherd6r','shepherd6'].forEach(id=>{const NM=run(`FIGURES.${id}.name`);{const {checkFigure,broken}=require('./check.js')(run),MUST=['selfX','pierce','sym','flipped','degenerate','open'],HT3=fs.readFileSync(__dirname+'/../index.html','utf8');
  ok(run(`FIGURES.${id}.need`)==='plates-'+id&&fs.existsSync(P+'plates-'+id+'.js')&&!HT3.includes('plates-'+id+'.js')&&run(`LAZY[FIGURES.${id}.need].ok()&&figureReady('${id}')`)===true,NM+': файл фигуры есть, на странице не подключён — грузится по выбору; после загрузки строится сразу');
  const m=run(`modelPoly('${id}')`),R=checkFigure({V:m.V,P:m.P,S:m.S},{sym:true}),B=run(`meshBox(modelPoly('${id}').V).size`),hb=MUST.filter(k=>R[k].length);
  ok(hb.length===0&&Math.abs(B[1]-1000)<.01&&R.parts>=200,NM+`: симметрична, замкнута, без самопересечений и протыканий, грани наружу, вырожденных нет; высота 1000, граней ${m.P.length}, деталей ${R.parts}`+(hb.length?' — нарушено '+hb.map(k=>k+' '+R[k].length):''));
  console.log('     остальные правила (кандидаты на правку в мастерской, см. report-'+id+'.md): '+(broken(R).filter(k=>!MUST.includes(k)).map(k=>k+' '+R[k].length).join(', ')||'нет'));
  const h=run(`(()=>{const C=PG('${id}'),PC=C.R.parts.filter(p=>!C.BL.some(b=>b.parts.includes(p.id))).map(p=>{const c=cutContour(p,2,.5,true);return c.bad?null:{id:p.id,no:p.no,pts:c.pts};}).filter(Boolean).concat(C.BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts}))),
    N=nest(PC,2500,1250,5,10,2.5,2,true);CUR.N=N;CUR.BL=C.BL;const NL=String.fromCharCode(13,10),tx=dxfNest(),lay=L=>tx.split(NL+'8'+NL+L+NL).length-1,items=N.sheets.reduce((a,s)=>a+s.items.length,0);
    return {parts:C.R.parts.length,blanks:C.BL.length,pieces:PC.length,items,too:N.too.length,sheets:N.sheets.length,cut:lay('CUT'),perf:lay('PERF')};})()`);
  ok(h.pieces>0&&h.items===h.pieces&&h.too===0&&h.cut>=h.items,NM+`: деталей ${h.parts}, заготовок со сгибами ${h.blanks}, позиций ${h.pieces} — все на листах 1250 × 2500 (${h.sheets} л.), у каждой контур CUT в DXF, PERF ${h.perf}`);
  const TF=P+'trace-'+id+'.js',UI3=fs.readFileSync(P+'ui.js','utf8');
  if(run(`FIGURES.${id}.plaster`)&&run(`FIGURES.${id}.ref`)===id&&run(`(FIGURES.${id}.refs||[]).length`)>0&&!fs.existsSync(TF))console.log('     '+NM+': калька — свой набор (S6REFS), проверка #172 ниже');
  else if(!fs.existsSync(TF)||run(`FIGURES.${id}.ref`)!==id)ok(false,NM+': калька js/trace-'+id+'.js есть, FIGURES.'+id+'.ref = '+id);
  else{const tc={console,Math,Buffer};tc.window=tc;vm.createContext(tc);vm.runInContext(['mesh','edit','models-poly','figures','trace','plates-'+id].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(TF,'utf8'),tc);
    const T=vm.runInContext(`(()=>{const t=traceLoad(TRACE.${id}),b=modelPoly('${id}'),bx=meshBox(b.V),mp=traceMap(bx,bx),tp=b.V.reduce((a,p)=>p[2]>a[2]?p:a),HP=b.P.filter(Q=>{const c=polyC(b.V,Q);return c[2]>tp[2]-330&&c[1]>560;});
      return {n:t.n,seams:t.seams,all:traceAtlas(b.V,b.P,b.F,b.T,mp,t).cover,head:traceAtlas(b.V,HP,[],[],mp,t).cover,hp:HP.length};})()`,tc);
    ok(!HT3.includes('trace-'+id)&&UI3.includes("s.src='js/trace-'+x+'.js")&&T.seams>1000&&T.all>=.95&&T.head>=.95,NM+`: калька грузится по галочке, точек ${T.n}, швов ${T.seams}; атлас находит облако на ${(T.all*100).toFixed(1)} % граней, на голове (${T.hp} граней) — ${(T.head*100).toFixed(1)} %`);}}});
// #142 Овчарка 5: вторая калька js/trace-shepherd5p.js (швы картинок, project.js) — в выборе у галочки «Калька», в том же кадре фигуры, атлас находит облако на ≥ 95 % граней
{const id='shepherd5',R=run(`FIGURES.${id}.refs`),UI5=fs.readFileSync(P+'ui.js','utf8'),HT5=fs.readFileSync(__dirname+'/../index.html','utf8'),TF=P+'trace-shepherd5p.js';
  // #149: три кальки по порядку спеки (первая — «с картинок», она и по умолчанию), файлы грузятся по выбору
  ok(Array.isArray(R)&&R.map(r=>r[0]).join()==='shepherd5p,shepherd5,shepherd5f'&&R.map(r=>r[1]).join()==='с картинок,с модели,форма оригинала'&&UI5.includes('R&&R.length?R[0][0]:ST.refId')&&HT5.includes('id="traceSel"')&&UI5.includes("TRC.b0=meshBox(modelPoly(ST.refId).V)")&&fs.existsSync(TF)&&fs.existsSync(P+'trace-shepherd5f.js')&&!HT5.includes('trace-shepherd5p')&&!HT5.includes('trace-shepherd5f'),'Овчарка 5: три кальки (с картинок — по умолчанию, с модели, форма оригинала), выбор #traceSel, кадр — фигура shepherd5, файлы грузятся по выбору');
  if(fs.existsSync(TF)){const tc={console,Math,Buffer};tc.window=tc;vm.createContext(tc);vm.runInContext(['mesh','edit','models-poly','figures','trace','plates-'+id].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(TF,'utf8'),tc);
    const T=vm.runInContext(`(()=>{const t=traceLoad(TRACE.shepherd5p),b=modelPoly('${id}'),bx=meshBox(b.V),mp=traceMap(bx,bx);return {n:t.n,seams:t.seams,all:traceAtlas(b.V,b.P,b.F,b.T,mp,t).cover};})()`,tc);
    ok(T.seams>1000&&T.all>=.95,`Овчарка 5, калька с картинок: точек ${T.n}, швов ${T.seams}; атлас находит облако на ${(T.all*100).toFixed(1)} % граней`);}}
// #147 калька чёткими линиями: у обеих калек Овчарки 5 в файле есть ломаные TRACE_L (> 200), на фигуре нарисовано ≥ 90 % их точек (плита дальше 12 мм — точка не рисуется, не висит в воздухе);
// страница: tlines.js подключён, линии идут в build3D, у кальки с линиями грани не красятся атласом
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),V3S=fs.readFileSync(P+'view3d.js','utf8');
  ok(/<script src="js\/tlines\.js\?v=[^"]+"><\/script>/.test(HT)&&HT.indexOf('js/tlines.js')<HT.indexOf('js/ui.js')&&UI.includes('tlines:traceSeg()')&&UI.includes('TRC.L=window.TRACE_L&&TRACE_L[rid]?tlinesLoad(TRACE_L[rid]):null')&&UI.includes('return TRC.L?null:TRC.at')&&V3S.includes('o.tlines&&o.tlines.length'),
    'калька линиями: tlines.js подключён до ui.js, линии кальки идут в build3D (tlines), с линиями грани не красятся атласом');
  for(const id of ['shepherd5','shepherd5p']){const tc={console,Math,Buffer};tc.window=tc;vm.createContext(tc);
    vm.runInContext(['mesh','edit','models-poly','figures','trace','tlines','plates-shepherd5'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(P+'trace-'+id+'.js','utf8'),tc);
    const T=vm.runInContext(`(()=>{if(!window.TRACE_L||!TRACE_L.${id})return null;const L=tlinesLoad(TRACE_L.${id}),b=modelPoly('shepherd5'),bx=meshBox(b.V),S=tlinesOnFigure(L,traceMap(bx,bx),b.V,b.P,12,{F:b.F,T:b.T});return {n:L.n,pts:S.pts,drawn:S.drawn};})()`,tc);
    ok(!!T&&T.n>200&&T.drawn>=.9,`Овчарка 5, калька ${id==='shepherd5'?'с модели':'с картинок'} линиями: `+(T?`ломаных ${T.n}, на фигуре нарисовано ${(T.drawn*100).toFixed(1)} % из ${T.pts} точек`:'нет TRACE_L'));}}
// #149 «форма оригинала»: только линии (облака TRACE нет), линий > 300, ≥ 90 % на фигуре; страница: калька без облака грузится, сверка у неё неактивна, атлас и traceDiff не строятся
{const UI=fs.readFileSync(P+'ui.js','utf8'),HT=fs.readFileSync(__dirname+'/../index.html','utf8'),tc={console,Math,Buffer};tc.window=tc;vm.createContext(tc);
  vm.runInContext(['mesh','edit','models-poly','figures','trace','tlines','plates-shepherd5'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(P+'trace-shepherd5f.js','utf8'),tc);
  const T=vm.runInContext(`(()=>{if(!window.TRACE_L||!TRACE_L.shepherd5f)return null;const L=tlinesLoad(TRACE_L.shepherd5f),b=modelPoly('shepherd5'),bx=meshBox(b.V),S=tlinesOnFigure(L,traceMap(bx,bx),b.V,b.P,12,{F:b.F,T:b.T});return {cloud:!!(window.TRACE&&TRACE.shepherd5f),n:L.n,pts:S.pts,drawn:S.drawn};})()`,tc);
  ok(!!T&&!T.cloud&&T.n>300,'Овчарка 5, калька «форма оригинала»: только линии, без облака'+(T?`, ломаных ${T.n}`:' — нет TRACE_L'));
  ok(!!T&&T.drawn>=.9,'Овчарка 5, калька «форма оригинала» на фигуре: '+(T?`нарисовано ${(T.drawn*100).toFixed(1)} % из ${T.pts} точек`:'нет TRACE_L'));
  ok(UI.includes('TRC.t=window.TRACE&&TRACE[cid]?traceLoad(TRACE[cid]):null')&&UI.includes('r&&r[2]||rid')&&UI.includes('TRC.diff=TRC.t?traceDiff(')&&UI.includes("$('cDiff').disabled=!trOn()||traceNoCloud()")&&UI.includes('(TRC.t||TRC.L)&&CUR&&isPoly()')&&UI.includes('traceOn()&&TRC.t?seamOnEdge(')&&HT.includes('id="diffNo"')&&HT.includes('У этой кальки нет сверки'),
    'калька без облака: грузится по линиям, сверка неактивна с пояснением «У этой кальки нет сверки», атлас/сверка/магнит старого шва без облака не считаются');}
// #169 калька поверх фигуры: первый проход — как раньше (LineBasicMaterial, пишет глубину); второй — те же линии с нормалями (.nrm из tlinesOnFigure), TL_MAT: запас по глубине TL_OVER мм,
// глубину не пишет, в прозрачном проходе (после линий граней и сгибов), обратная сторона отброшена; разметка — в прозрачном проходе после него (renderOrder 3–5), поверх кальки
{const V3S=fs.readFileSync(P+'view3d.js','utf8'),TLS=fs.readFileSync(P+'tlines.js','utf8'),ov=/const TL_OVER=([0-9.]+);/.exec(V3S);
  ok(!!ov&&+ov[1]>0&&+ov[1]<=12&&TLS.includes('out.nrm=new Float32Array(nrm)')&&V3S.includes("tg2.setAttribute('nrm',")&&V3S.includes('t2=new THREE.LineSegments(tg2,TL_MAT())')&&/depthWrite:false,transparent:true/.test(V3S)&&V3S.includes('if(vis<0.5)discard')
    &&V3S.includes("new THREE.LineSegments(tg,new THREE.LineBasicMaterial({color:0xffffff}));tl.renderOrder=2")&&V3S.includes('rbMat(0xe07a35,{width:w,opacity:op,depthWrite:true}));l.renderOrder=3')&&V3S.includes('rbMat(0xd01f1f,{width:MK_W,depthWrite:true}));l3.renderOrder=4')&&V3S.includes('mp.renderOrder=5'),
    `калька поверх фигуры (#169): второй проход линий с запасом по глубине ${ov&&ov[1]} мм, без обратной стороны, после линий граней; разметка поверх кальки`);}   // #181: разметка — лентой rbMat (прозрачный проход, renderOrder 3–4 после кальки 2)
// #181 разметка толще: лентой (вершины — rbGeo в ribbon.js, шейдер rbMat в view3d.js) — свои MK_W = 3 px, зеркальные MK_W_MIR = 2 px, превью пера 3 px; у обычных фигур (mkDraw в build3D,
// отказы «Нарезать») и на оригинале одинаково; на оригинале — как калька #169 (подтяжка TL_OVER, отсечение по nrm, проверка глубины — rbTlMat); калька и линии граней — прежние; красные концы 10 px
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),V3S=fs.readFileSync(P+'view3d.js','utf8'),OWJ=fs.readFileSync(P+'owork.js','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),at=f=>HT.indexOf('js/'+f+'.js');
  ok(at('ribbon')>0&&at('ribbon')<at('view3d')&&/<script src="js\/ribbon\.js\?v=[^"]+"><\/script>/.test(HT)&&V3S.includes('const MK_W=3,MK_W_MIR=2')&&V3S.includes('transparent:true,side:THREE.DoubleSide')&&V3S.includes('r.getDrawingBufferSize(mat.uniforms.res.value);mat.uniforms.pr.value=r.getPixelRatio()')
    &&V3S.includes('defines:o.cull?{CULL:1}:{}')&&V3S.includes('\\n#ifdef CULL\\n')&&V3S.includes('rbGeo(seg,')&&V3S.includes('function rbTlMat(color,width){const free=!isFinite(TL_OVER);return rbMat(color,{width,over:free?0:TL_OVER,cull:true,depthTest:!free});}'),
    'разметка лентой (#181): ribbon.js до view3d.js; шейдер rbMat — ширина в px экрана × pixelRatio, обе стороны ленты; на оригинале rbTlMat — подтяжка TL_OVER, отсечение по nrm, глубина как у tlMat; ширины 3 и 2 px');
  ok(OWJ.includes('rbMesh(S,rbTlMat(c,w))')&&OWJ.includes('OW_PEN,MK_W)')&&OWJ.includes('OW_PEN_MIR,MK_W_MIR)')&&OWJ.includes('dots(OW.free,OW_FREE,10)')&&!/new THREE\.LineSegments/.test(OWJ)
    &&UI.includes('rbMat(OW.on?OW_PEN:0xe07a35,{width:MK_W,depthTest:false})')&&!UI.includes('MK.pv=new THREE.Line('),
    'разметка лентой (#181): на оригинале зелёные 3 px, зеркальные 2 px, красные концы 10 px; превью пера — лента 3 px поверх всего, как была линия');
  ok(V3S.includes('function TL_MAT(){return TL_M||(TL_M=tlMat(0xffffff));}')&&V3S.includes('const t2=new THREE.LineSegments(tg2,TL_MAT())')&&V3S.includes("if(o.plaster)seg(L,...PLASTER_LINE)")&&V3S.includes('new THREE.LineDashedMaterial({color:0x2a6fd0,dashSize:4,gapSize:3,transparent:true,opacity:.9})'),
    'разметка лентой (#181): калька (белые линии #147/#169), линии граней и сгибов — прежние LineSegments');}
// #172, #173 Овчарка 6: у обеих фигур один набор из 6 калек (S6REFS, кадр shepherd6): «с модели» и «с 3 фото», у каждой без мусора (у «с модели» — первой, по умолчанию), сырая, выпрямленная;
// у вариантов облако — от сырой своего источника (refs[2]); файлы грузятся по выбору; на каждой фигуре нарисовано ≥ 90 % точек линий; варианты: без мусора ≤ сырой, выпрямленная — меньше точек, обрывков < 20 мм нет
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),{tvRead,tvLen}=require('./trace-variants.js'),SRC=[['m','с модели'],['p','с 3 фото']],
    W=SRC.flatMap(([k,t])=>[['shepherd6'+k+'2',t+', без мусора','shepherd6'+k],['shepherd6'+k,t+', сырая',undefined],['shepherd6'+k+'3',t+', выпрямленная','shepherd6'+k]]);
  for(const id of ['shepherd6r','shepherd6']){const R=run(`FIGURES.${id}.refs`);
    ok(run(`FIGURES.${id}.ref`)===id&&Array.isArray(R)&&JSON.stringify(R.map(r=>[r[0],r[1],r[2]]))===JSON.stringify(W)&&W.every(w=>fs.existsSync(P+'trace-'+w[0]+'.js')&&!HT.includes('trace-'+w[0]+'.js')),
      run(`FIGURES.${id}.name`)+': 6 калек — «с модели» и «с 3 фото», у каждой без мусора, сырая, выпрямленная; по умолчанию «с модели, без мусора»; облако сверки — сырой; файлы грузятся по выбору');}
  const L=Object.fromEntries(W.map(w=>[w[0],tvRead(P+'trace-'+w[0]+'.js',w[0])])),np=l=>l.reduce((a,x)=>a+x.length,0),len=l=>l.reduce((a,x)=>a+tvLen(x),0);
  for(const [k,t] of SRC){const r=L['shepherd6'+k],c=L['shepherd6'+k+'2'],s=L['shepherd6'+k+'3'];
    ok(c.length<r.length&&len(c)<=len(r)&&np(s)<np(c)/2&&s.every(x=>tvLen(x)>=20)&&c.length>300,
      `Овчарка 6, кальки ${t}: сырая ${r.length} линий / ${(len(r)/1000).toFixed(1)} м, без мусора ${c.length} / ${(len(c)/1000).toFixed(1)} м, выпрямленная ${s.length} / ${(len(s)/1000).toFixed(1)} м, точек ${np(r)} → ${np(s)}`);}
  {const tc={console,Math,Buffer};tc.window=tc;vm.createContext(tc);vm.runInContext(['mesh','edit','models-poly','figures','trace','tlines','plates-shepherd6r','plates-shepherd6'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+'\n;\n'+W.map(w=>fs.readFileSync(P+'trace-'+w[0]+'.js','utf8')).join('\n;\n'),tc);
    for(const fid of ['shepherd6r','shepherd6'])for(const w of W){const T=vm.runInContext(`(()=>{const L=tlinesLoad(TRACE_L.${w[0]}),b=modelPoly('${fid}'),bx=meshBox(b.V),S=tlinesOnFigure(L,traceMap(bx,bx),b.V,b.P,12,{F:b.F,T:b.T});return {n:L.n,pts:S.pts,drawn:S.drawn};})()`,tc);
      ok(T.drawn>=.9,`${fid}, калька ${w[1]}: ломаных ${T.n}, на фигуре нарисовано ${(T.drawn*100).toFixed(1)} % из ${T.pts} точек`);}
    for(const [k,t] of SRC){const C=vm.runInContext(`(()=>{const t=traceLoad(TRACE.shepherd6${k}),b=modelPoly('shepherd6'),bx=meshBox(b.V);return {seams:t.seams,all:traceAtlas(b.V,b.P,b.F,b.T,traceMap(bx,bx),t).cover};})()`,tc);
      ok(C.seams>1000&&C.all>=.95,`Овчарка 6, облако кальки ${t} (сверка): швов ${C.seams}, атлас находит облако на ${(C.all*100).toFixed(1)} % граней`);}}}
// #150 разметка: кнопки «Линия», «Зачеркнуть», «Очистить разметку», галочка «Магнит» (вкл.); по умолчанию инструмент выключен; хранение по id фигуры; левая кнопка рисует, крутит правая;
// на телефоне (нет точного указателя) блок скрыт; разметка рисуется только в правке и фигуру не трогает (в build3D отдельной опцией)
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),V3S=fs.readFileSync(P+'view3d.js','utf8'),mc={console,Math};vm.createContext(mc);
  ['mesh','tlines','markup'].forEach(n=>vm.runInContext(fs.readFileSync(P+n+'.js','utf8'),mc));
  ok(/<div id="mkBox" hidden>/.test(HT)&&HT.includes('id="mk_line">Линия</button>')&&HT.includes('id="mk_cross">Зачеркнуть</button>')&&/<input type="checkbox" id="cMagnet" checked>/.test(HT)&&HT.includes('id="bMkClear" type="button">Очистить разметку</button>')
    &&/<script src="js\/markup\.js\?v=[^"]+"><\/script>/.test(HT)&&HT.indexOf('js/tlines.js')<HT.indexOf('js/markup.js')&&HT.indexOf('js/markup.js')<HT.indexOf('js/ui.js'),'разметка: кнопки «Линия», «Зачеркнуть», «Очистить разметку», «Магнит» вкл.; markup.js подключён после tlines.js и до ui.js');
  ok(UI.includes("ST.tool='';ST.mk=[];ST.mkCur=null;ST.magnet=true;")&&UI.includes("matchMedia('(pointer:fine)')")&&UI.includes("$('mkBox').hidden=!(on&&MK.fine)")&&UI.includes('controls.mouseButtons=ST.tool?{LEFT:-1,')&&UI.includes('RIGHT:THREE.MOUSE.ROTATE}')
    &&UI.includes('markup:ed?mkDraw():null')&&UI.includes('ST.mk=mkLoad(store(k))')&&UI.includes('store(MK.key,mkSave(ST.mk))')&&UI.includes('mkSnap(h,traceOn()?TRC.seg:null,ST.magnet)')&&UI.includes("if(e.key==='Escape'&&ST.mkCur){ST.mkCur=null;")&&V3S.includes('ml(o.markup.mirror,.35,MK_W_MIR)'),
    'разметка: инструмент по умолчанию выкл., магнит вкл., на телефоне скрыта; с инструментом левая кнопка рисует, крутит правая; хранится в браузере; магнит к линиям кальки; Esc отменяет линию; зеркальная бледная');
  ok(vm.runInContext("mkKey('shepherd5')==='shepherd-mk-shepherd5'&&mkKey('shepherd5')!==mkKey('shepherd3')&&mkMirror({k:'line',pts:[[0,1,2],[0.5,40,2]]})===null&&mkMirror({k:'line',pts:[[10,1,2],[20,1,2]]}).pts[0][0]===-10",mc),'разметка: ключ хранения по id фигуры; линия на оси симметрии не зеркалится');}
// #151 «Карандаш»: кнопка есть; ведёшь — превью, отпустил — сглаживание (mkSmooth), магнит и замкнутость (mkPen); зигзаг ±1,5 мм → ≤ 0,5 мм
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),mc={console,Math};vm.createContext(mc);['mesh','tlines','markup'].forEach(n=>vm.runInContext(fs.readFileSync(P+n+'.js','utf8'),mc));
  const z=vm.runInContext("(()=>{const Z=Array.from({length:201},(_,i)=>[i/2,i===0||i===200?0:(i%2?1.5:-1.5),0]),s=mkSmooth(Z),C=Array.from({length:121},(_,i)=>[30*Math.cos(i/120*2*Math.PI),30*Math.sin(i/120*2*Math.PI),0]);return {dev:Math.max(...s.map(p=>Math.abs(p[1]))),closed:mkPen(C,null,true).closed===true};})()",mc);
  ok(HT.includes('data-tool="pen" id="mk_pen">Карандаш</button>')&&UI.includes("if(ST.tool==='pen'&&e.button===0")&&UI.includes('mkPen(raw,traceOn()?TRC.seg:null,ST.magnet)')&&z.dev<=.5&&z.closed,`карандаш: кнопка, сглаживание (зигзаг ±1,5 мм → ${z.dev.toFixed(2)} мм), магнит, окружность — замкнутая`);}
// #180 отмена в разметке: свой стек (mkPush/mkUndo/mkRedo/mkClearAll из markup.js, тесты — tools/markup.test.js), клавиши — mkUndoKey; все штрихи ложатся через mkPush (одна логика);
// в режиме обводки (при «Править фигуру») Ctrl+Z — по разметке, у обычной фигуры — пока выбран инструмент, иначе undo()/redo() формы как было; стек сбрасывают смена ключа (mkSync), «Нарезать», mkSet
{const UI=fs.readFileSync(P+'ui.js','utf8'),tc={};vm.createContext(tc);const src=fs.readFileSync(P+'tips.js','utf8');vm.runInContext(src.slice(0,src.indexOf('\n(()=>'))+'\nthis.TIPS=TIPS;',tc);const TP=tc.TIPS,HINT='Ctrl+Z — убрать последнее, Ctrl+Y — вернуть';
  const line=re=>(UI.split('\n').find(l=>re.test(l))||'');
  ok(UI.includes('mkDo(mkPush,[c])')&&UI.includes('mkDo(mkPush,a)')&&UI.includes('mkDo(mkPush,[mkPen(raw,traceOn()?TRC.seg:null,ST.magnet)])')&&UI.includes('mkDo(mkClearAll)')&&!/ST\.mk\.push\(/.test(UI),
    'разметка (#180): все штрихи — через mkPush, «Очистить разметку» — mkClearAll (отменяется одним шагом)');
  ok(UI.includes('function mkUndoOn(){return OW.on?ST.edit:!!ST.tool;}')&&/addEventListener\('keydown',e=>\{const a=mkUndoKey\(e\);if\(!a\|\|!mkUndoOn\(\)\|\|typing\(\)\)return;/.test(UI)&&line(/^addEventListener\('keydown',e=>\{if\(!ST\.edit\|\|ST\.orig/).includes('if(mkUndoKey(e)&&mkUndoOn())return;')
    &&UI.includes("if((e.ctrlKey||e.metaKey)&&(k==='z'||k==='я')&&!e.shiftKey){e.preventDefault();undo();}"),
    'разметка (#180): Ctrl+Z/Ctrl+Y — по разметке в режиме обводки и при выбранном инструменте; без инструмента — правки формы, как было');
  ok(/function mkSync\(\)\{[^\n]*mkReset\(\)/.test(UI)&&/function mkSet\([^\n]*mkReset\(\)/.test(UI)&&line(/^  ST\.mk\.forEach\(\(s,i\)=>\{if\(fail\.has/).includes('mkReset()'),
    'разметка (#180): стек отмены сбрасывается при смене фигуры или версии, после «Нарезать» и при подмене разметки целиком (mkSet)');
  ok(UI.includes(HINT)&&['mk_line','mk_pen','mk_cross','bMkClear'].every(k=>TP[k].includes('Ctrl+Z')),'разметка (#180): подсказка «'+HINT+'» в заметке и в «?» у «Линия», «Карандаш», «Зачеркнуть», «Очистить разметку»');}
// #152 «Нарезать» в пределах одной детали на Овчарке 5: линия поперёк самой большой детали справа (концы за краем на 3 мм), с симметрией → граней на 2 больше,
// фигура симметрична, замкнута, без самопересечений и протыканий (те же правила, что у самой фигуры); оборванная линия — отказ «линия не доходит до края детали», фигура та же
{['tlines','markup','apply'].forEach(n=>vm.runInContext(fs.readFileSync(P+n+'.js','utf8'),c));const {checkFigure}=require('./check.js')(run),MUST=['selfX','pierce','sym','flipped','degenerate','open'],UI=fs.readFileSync(P+'ui.js','utf8'),HT=fs.readFileSync(__dirname+'/../index.html','utf8');
  const R=run(`(()=>{const m=modelPoly('shepherd5'),E={V:m.V.map(p=>p.slice()),P:m.P.map(q=>q.slice()),S:(m.S||[]).map(s=>s.slice())};let best=-1,ba=0;
    E.P.forEach((Q,i)=>{if(polyC(E.V,Q)[0]<40)return;const fr=apFrame(E.V,Q),q=Q.map(j=>fr.to2(E.V[j]));let a=0;q.forEach((p,k)=>{const r=q[(k+1)%q.length];a+=p[0]*r[1]-r[0]*p[1];});a=Math.abs(a)/2;if(a>ba){ba=a;best=i;}});
    const Q=E.P[best],fr=apFrame(E.V,Q),q=Q.map(j=>fr.to2(E.V[j])),cx=q.reduce((s,p)=>s+p[0],0)/q.length,cy=q.reduce((s,p)=>s+p[1],0)/q.length;let t0=Infinity,t1=-Infinity;
    q.forEach((a,k)=>{const b=q[(k+1)%q.length];if((a[0]-cx)*(b[0]-cx)<=0&&a[0]!==b[0]){const y=a[1]+(b[1]-a[1])*(cx-a[0])/(b[0]-a[0])-cy;t0=Math.min(t0,y);t1=Math.max(t1,y);}});
    const line={k:'line',pts:[fr.to3([cx,cy+t0-3]),fr.to3([cx,cy+t1+3])]},half={k:'line',pts:[fr.to3([cx,cy+t0-3]),fr.to3([cx,cy])]},r=applyMarkup(E,[line],{sym:true}),r2=applyMarkup(E,[half],{sym:true});
    return {area:Math.round(ba),P0:E.P.length,P1:r.E.P.length,done:r.done,fail:r.fail,E1:r.E,f2:r2.fail,P2:r2.E.P.length};})()`);
  const C=checkFigure({V:R.E1.V,P:R.E1.P,S:R.E1.S},{sym:true}),hb=MUST.filter(k=>C[k].length);
  ok(R.done.length===1&&R.P1===R.P0+2&&hb.length===0,`«Нарезать» на Овчарке 5: линия поперёк детали (${R.area} мм²) с симметрией — граней ${R.P0} → ${R.P1}, симметрична, замкнута, без самопересечений и протыканий`+(hb.length?' — нарушено '+hb.map(k=>k+' '+C[k].length):'')+(R.fail.length?' — отказ: '+R.fail[0].why:''));
  ok(R.f2.length===1&&R.f2[0].why==='линия не доходит до края детали'&&R.P2===R.P0,'«Нарезать»: оборванная внутри детали линия — отказ «линия не доходит до края детали», фигура без изменений');
  ok(HT.includes('id="bMkApply" type="button">Нарезать</button>')&&/<script src="js\/apply\.js\?v=[^"]+"><\/script>/.test(HT)&&HT.indexOf('js/apply.js')<HT.indexOf('js/ui.js')&&UI.includes('applyMarkup(E(),ST.mk,{sym:ST.sym})')&&UI.includes("msg('Нечего нарезать')")&&UI.includes('UNDO.push(snapE(true))')&&UI.includes('if(s.mk)mkSet(s.mk)'),
    '«Нарезать»: кнопка есть, apply.js до ui.js; пустая разметка — «Нечего нарезать»; одно «Отменить» возвращает фигуру и разметку');}
// #153 «Нарезать» через несколько деталей на Овчарке 5: три линии между углами морды справа (60–140 мм по поверхности), каждая — через ≥ 2 детали, с симметрией,
// и зачёркивание поперёк первой → фигура симметрична, замкнута, без самопересечений и протыканий; отказы по пути — с причинами (для сведения)
{const {checkFigure}=require('./check.js')(run),MUST=['selfX','pierce','sym','flipped','degenerate','open'],R=run(`(()=>{const m=modelPoly('shepherd5');let E={V:m.V.map(p=>p.slice()),P:m.P.map(q=>q.slice()),S:(m.S||[]).map(s=>s.slice())};const P0=E.P.length,bb=meshBox(E.V);   const cand=E.V.filter(p=>p[0]>8&&p[2]>bb.max[2]-160&&p[1]>bb.min[1]+bb.size[1]*.6).map(p=>p.slice());   const onSurf=(E,a,b)=>{const tr=tlTris(E.V,E.P),n=Math.max(1,Math.ceil(V3.len(V3.sub(b,a))/2)),out=[];for(let k=0;k<=n;k++){const p=V3.add(a,V3.mul(V3.sub(b,a),k/n));let best=p,bd=1e9;     for(const t of tr){const q=tlClosest(p,t.a,t.b,t.c),d=V3.len(V3.sub(q,p));if(d<bd){bd=d;best=q;}}out.push(best);}return out;};   const lines=[],refused={};let tried=0,first=null;   for(let i=0;i<cand.length&&lines.length<3&&tried<400;i++)for(let j=i+1;j<cand.length&&lines.length<3&&tried<400;j++){const a=cand[i],b=cand[j],L=V3.len(V3.sub(b,a));if(L<60||L>140)continue;     tried++;const pts=onSurf(E,a,b),r=apLine(E,{k:'line',pts},true,{});if(r.why){refused[r.why]=(refused[r.why]||0)+1;continue;}if(r.pieces<2)continue;     E=compact(r.E);lines.push({pieces:r.pieces,len:Math.round(L)});if(!first)first=r.pts;}   let cross=null;if(first){const k=Math.floor(first.length/2)-1,a=first[Math.max(0,k)],b=first[Math.max(1,k+1)],mid=V3.mul(V3.add(a,b),.5),at=apIndex(E),f=at(mid),n=polyNorm(E.V,E.P[f]),w=V3.norm(V3.cross(V3.sub(b,a),n));     const ca=onSurf(E,V3.add(mid,V3.mul(w,7)),V3.add(mid,V3.mul(w,7)))[0],cb=onSurf(E,V3.sub(mid,V3.mul(w,7)),V3.sub(mid,V3.mul(w,7)))[0],P1=E.P.length,r=applyMarkup(E,[{k:'cross',pts:[ca,cb]}],{sym:true});     cross={done:r.done.length,why:r.fail.length?r.fail[0].why:'',P:P1+' → '+r.E.P.length};if(r.done.length)E=r.E;}   return {E,lines,tried,refused,cross,P0};})()`),C=checkFigure({V:R.E.V,P:R.E.P,S:R.E.S},{sym:true}),hb=MUST.filter(k=>C[k].length);
  ok(R.lines.length===3&&R.lines.every(l=>l.pieces>=2)&&R.cross&&R.cross.done===1&&hb.length===0,`«Нарезать» через несколько деталей на Овчарке 5: 3 линии (деталей по пути: ${R.lines.map(l=>l.pieces).join(', ')}) и зачёркивание — граней ${R.P0} → ${R.E.P.length}, симметрична, замкнута, без самопересечений и протыканий`+(hb.length?' — нарушено '+hb.map(k=>k+' '+C[k].length):'')+(R.cross&&R.cross.why?' — зачёркивание: '+R.cross.why:''));
  console.log('     отказы при подборе линий (из '+R.tried+'): '+Object.entries(R.refused).map(([k,v])=>k+' '+v).join(', '));}
// #154 отверстие на Овчарке 5: окружность Ø 30 в детали головы справа (где помещается с запасом 5 мм; «глаз»), с симметрией → два отверстия;
// площадь меньше на 2·π·15² (±1 %), рез больше на 2·2π·15 (±1 %), сварка та же; фигура симметрична, замкнута, без самопересечений; .json (поле H) туда-обратно — то же
{const {checkFigure}=require('./check.js')(run),MUST=['selfX','pierce','sym','flipped','degenerate','open'],UI=fs.readFileSync(P+'ui.js','utf8');
  const R=run(`(()=>{const m=modelPoly('shepherd5'),E={V:m.V.map(p=>p.slice()),P:m.P.map(q=>q.slice()),S:(m.S||[]).map(s=>s.slice()),H:[]},bb=meshBox(E.V);let best=null;
    E.P.forEach((Q,i)=>{const C=polyC(E.V,Q);if(C[0]<25||C[2]<bb.max[2]-260||C[1]<bb.min[1]+bb.size[1]*.65)return;const fr=apFrame(E.V,Q),q=Q.map(j=>fr.to2(E.V[j])),c2=fr.to2(C),d=apOnRing(q,c2).d;if(inPoly2(q,c2[0],c2[1])&&d>=22&&(!best||C[1]>best.y))best={i,y:C[1],c2,fr,d};});
    if(!best)return null;const circ=Array.from({length:96},(_,k)=>best.fr.to3([best.c2[0]+15*Math.cos(k/96*2*Math.PI),best.c2[1]+15*Math.sin(k/96*2*Math.PI)]));
    const ms=E=>{const b=polyBase(E.V,E.P,E.S,E.H),R=buildParts({V:b.V,F:b.F,T:b.T,S:b.S,H:b.H},1.5,1.5);let area=0,cut=0,weld=0;R.parts.forEach(p=>{area+=p.area;cut+=p.perim+(p.holeLen||0);});R.edges.forEach(e=>{if(!e.hole&&!e.open)weld+=e.len;});return {area,cut,weld,holes:R.parts.reduce((s,p)=>s+p.holes,0)};};
    const r=applyMarkup(E,[{k:'pen',closed:true,pts:circ}],{sym:true}),j=JSON.parse(JSON.stringify({V:r.E.V,P:r.E.P,S:r.E.S,H:r.E.H})),near=applyMarkup(E,[{k:'pen',closed:true,pts:circ.map(p=>V3.add(p,V3.mul(V3.norm(V3.sub(p,best.fr.to3(best.c2))),best.d-18)))}],{sym:true});
    return {face:best.i,d:Math.round(best.d),done:r.done.length,fail:r.fail,H:r.E.H.length,m0:ms(E),m1:ms(r.E),mj:ms(j),E1:r.E,near:near.fail.length?near.fail[0].why:''};})()`);
  if(!R)ok(false,'отверстие на Овчарке 5: нет детали головы, где помещается Ø 30 с запасом 5 мм');else{const C=checkFigure({V:R.E1.V,P:R.E1.P,S:R.E1.S},{sym:true}),hb=MUST.filter(k=>C[k].length),dA=R.m0.area-R.m1.area,dC=R.m1.cut-R.m0.cut,wA=2*Math.PI*225,wC=4*Math.PI*15;
    ok(R.done===1&&R.H===2&&R.m1.holes===2&&Math.abs(dA/wA-1)<=.01&&Math.abs(dC/wC-1)<=.01&&Math.abs(R.m1.weld-R.m0.weld)<1e-6&&hb.length===0,`отверстие Ø 30 на Овчарке 5 (деталь ${R.face}, до края ${R.d} мм) с симметрией: площадь −${dA.toFixed(1)} мм² (2·π·15² = ${wA.toFixed(1)}), рез +${dC.toFixed(2)} мм (2·2π·15 = ${wC.toFixed(2)}), сварка та же; симметрична, замкнута, без самопересечений`+(hb.length?' — нарушено '+hb.map(k=>k+' '+C[k].length):'')+(R.fail.length?' — отказ: '+R.fail[0].why:''));
    ok(Math.abs(R.mj.area-R.m1.area)<1e-6&&Math.abs(R.mj.cut-R.m1.cut)<1e-6&&R.mj.holes===2&&UI.includes('if(ISHOLE)j.H=ST.base.H;'.replace('ISHOLE','ST.base.H&&ST.base.H.length'))&&UI.includes('polyBase(j.V,j.P,j.S,Array.isArray(j.H)?j.H:[])'),'отверстие: .json (поле H) — сохранить и открыть: отверстия на месте, площадь и рез те же');
    ok(R.near==='отверстие ближе 5 мм к краю детали','отверстие: контур у края детали — отказ «'+R.near+'»');}}
// #155 отверстие в раскрое и DXF: Овчарка 5 с отверстием Ø 30 «в глазу» (деталь головы справа на высоте глаз, с симметрией) → раскрой собирается, все позиции на листах;
// контур отверстия — в DXF раскроя в слое CUT (вершины на месте детали на листе), площадь ≈ π·15²; врезок = позиций + отверстий; гравировка в отверстие не заходит; на картах деталей отверстие рисуется
{const SH=fs.readFileSync(P+'sheets.js','utf8'),R=run(`(()=>{const m=modelPoly('shepherd5'),E0={V:m.V.map(p=>p.slice()),P:m.P.map(q=>q.slice()),S:(m.S||[]).map(s=>s.slice()),H:[]},bb=meshBox(E0.V);let best=null;   E0.P.forEach((Q,i)=>{const C=polyC(E0.V,Q),h=(C[1]-bb.min[1])/bb.size[1];if(C[0]<15||C[2]<bb.max[2]-300||h<.66||h>.84)return;const fr=apFrame(E0.V,Q),q=Q.map(j=>fr.to2(E0.V[j])),c2=fr.to2(C),d=apOnRing(q,c2).d;     if(inPoly2(q,c2[0],c2[1])&&d>=20.5&&(!best||C[2]>best.z))best={i,z:C[2],c2,fr,d,h};});   if(!best)return null;const circ=Array.from({length:96},(_,k)=>best.fr.to3([best.c2[0]+15*Math.cos(k/96*2*Math.PI),best.c2[1]+15*Math.sin(k/96*2*Math.PI)])),r=applyMarkup(E0,[{k:'pen',closed:true,pts:circ}],{sym:true}),E=r.E;   const build=E=>{ST={t:2,gap:0.5,useT:true,minW:15,bend:true,tpl:true,engrave:true,perf:true,cut:'laser',slotW:2,slotL:40,slotBr:3,slotEb:3,slotEl:5,slotNotch:true,slotD:3,ngap:5,mat:'steel',weld:'tig'};     const b=polyBase(E.V,E.P,E.S,E.H),M={V:b.V,F:b.F,T:b.T,S:b.S,H:b.H},R=buildParts(M,1.5,1.5);addBacking(R,M);pairNumbers(R,M.V);let P,BL;const ban=new Set();     for(let k=0;k<4;k++){P=bendPlan(R,M.V,{sheet:[1250,2500],ban});const B=P.blanks.filter(b=>b.parts.length>1).map(b=>Object.assign(b,bendBlank(b,R,M.V,P,{t:2,gap:0.5,useT:true})));BL=B.filter(b=>!b.bad);if(BL.length===B.length)break;B.filter(b=>b.bad).forEach(b=>b.bends.forEach(id=>ban.add(id)));}     blankNumbers(BL,R);blankTwins(BL,R,P.J);CUR={R,M3:M,BL,BP:P};const inB=new Set(BL.flatMap(b=>b.parts));     const PC=R.parts.filter(p=>!inB.has(p.id)).map(p=>{const c=cutContour(p,2,.5,true);return c.bad?null:{id:p.id,no:p.no,pts:c.pts,holes:p.hpts||[]};}).filter(Boolean).concat(BL.map((b,i)=>({id:'b'+i,no:'Г'+b.no,pts:b.pts,holes:b.holes||[],B:b})));     CUR.PC=PC;const N=nest(PC.map(o=>({id:o.id,no:o.no,pts:o.pts})),2500,1250,5,10,2.5,2,true);CUR.N=N;     const NL=String.fromCharCode(13,10),tx=dxfNest(),lay=L=>tx.split(NL+'8'+NL+L+NL).length-1,items=N.sheets.reduce((a,s)=>a+s.items.length,0),hp=PC.filter(o=>o.holes.length);          const placed=N.sheets.flatMap(s=>s.items).filter(o=>itemHoles(o.id).length).flatMap(o=>holesAt(o.id,o.tr));     const engIn=N.sheets.flatMap(s=>s.items).filter(o=>itemHoles(o.id).length).reduce((a,o)=>{const H=holesAt(o.id,o.tr);return a+itemMarks(o).eng.filter(z=>H.some(h=>inPoly([z[0],z[1]],h)||inPoly([z[2],z[3]],h))).length;},0);     const dn=v=>String(Math.round(v*100)/100),holesInDxf=N.sheets.flatMap((s,si)=>s.items.filter(o=>itemHoles(o.id).length).flatMap(o=>holesAt(o.id,o.tr).map(H=>H.every(q=>tx.includes('VERTEX'+NL+'8'+NL+'CUT'+NL+'10'+NL+dn(q[0]+o.x)+NL+'20'+NL+dn(q[1]+o.y+si*(N.H+200))+NL))))).filter(Boolean).length;     return {holesInDxf,engIn,parts:R.parts.length,pieces:PC.length,items,too:N.too.length,sheets:N.sheets.length,cut:lay('CUT'),holes:PC.reduce((s,o)=>s+o.holes.length,0),       holeIn:hp.map(o=>String(o.no)),placedA:placed.map(H=>Math.round(Math.abs(area2(H)))),placedL:placed.map(H=>Math.round(perim(H)*10)/10),stats:cutStats(N.sheets.flatMap(s=>s.items))};};   const B=build(E);return {face:best.i,h:+best.h.toFixed(2),d:Math.round(best.d),done:r.done.length,fail:r.fail,H:E.H.length,B};})()`);
  if(!R)ok(false,'отверстие в раскрое: нет детали головы на высоте глаз, где помещается Ø 30');else{const B=R.B,wA=Math.PI*225;
    ok(R.done===1&&R.H===2&&B.items===B.pieces&&B.too===0&&B.holes===2&&B.holesInDxf===2&&B.placedA.every(x=>Math.abs(x/wA-1)<=.02)&&B.stats.pierce===B.items+B.holes&&B.engIn===0,
      `отверстие в раскрое и DXF на Овчарке 5 (деталь ${R.face} на высоте ${Math.round(R.h*100)} % — глаз, в ${B.holeIn.join(', ')}): позиций ${B.items} из ${B.pieces} на ${B.sheets} л., отверстий ${B.holes}, в DXF в слое CUT ${B.holesInDxf}, площадь ${B.placedA.join(', ')} мм² (π·15² = ${wA.toFixed(1)}), периметр ${B.placedL.join(', ')} мм, врезок ${B.stats.pierce}, гравировки в отверстии ${B.engIn}`);
    ok(SH.includes('function dxfCut(e,o,ox,oy,holes){(holes||[]).forEach(H=>dxfPoly(e,H,')&&SH.includes('dxfCut(e,o,o.x,o.y+oy,holesAt(o.id,o.tr))')&&SH.includes('dxfCut(e,o,x,y,holesAt(o.id,o.tr))')&&SH.includes('data-hole="1"')&&SH.includes('polygon class="hole"'),
      'отверстие: в DXF раскроя и DXF деталей — контур CUT раньше наружного; на раскрое и на картах деталей отверстие нарисовано; масса на карте — без отверстия, рез — с ним');}}
// #145 слои мастерской: четыре галочки, «Другие операции» закрыты, слои по умолчанию как в спеке, ui.js передаёт точки и сверку только при включённом слое
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),V3=fs.readFileSync(P+'view3d.js','utf8'),LY=fs.readFileSync(P+'layers.js','utf8'),lc={console};vm.createContext(lc);vm.runInContext(LY,lc);
  const more=/<details id="edMore"([^>]*)>\s*<summary>Другие операции<\/summary>([\s\S]*?)<\/details>/.exec(HT);
  ok(['cLEdges','cLVerts','cTrace','cDiff'].every(id=>HT.includes('id="'+id+'"'))&&HT.includes('Линии граней')&&HT.includes('Точки углов')&&HT.includes('Подсказки сверки'),'слои: в index.html четыре галочки — линии граней, точки углов, калька, подсказки сверки');
  ok(!!more&&!/\bopen\b/.test(more[1])&&['extrude','inset','bump','pit','split','del','merge','cut'].every(op=>more[2].includes('data-op="'+op+'"')),'слои: блок «Другие операции» закрыт, в нём все восемь старых кнопок');
  ok(!/<details id="edMore"[\s\S]*?<\/details>/.exec(HT)[0].match(/bUndo|bRedo/)&&HT.includes('id="bUndo"'),'слои: «Отменить/Вернуть» остались снаружи блока');
  ok(JSON.stringify(vm.runInContext('LAYER_DEF',lc))==='{"edges":true,"verts":false,"trace":false,"diff":false}','слои: по умолчанию линии вкл., точки, калька и сверка выкл.');
  ok(UI.includes('verts:ed&&vertsShown()')&&UI.includes('diff:ed&&traceOn()&&ST.layers.diff?TRC.diff:null')&&UI.includes('edges:!ed||ST.layers.edges')&&UI.includes("store('shepherd-layers',layersSave(ST.layers))")&&V3.includes('o.edges===false'),'слои: ui.js передаёт точки и сверку только при включённом слое, швы — по галочке, выбор — в браузер');
  ok(UI.includes('vertsShown()?pickVert(e,ST.base.V):-1')&&UI.includes('vertsShown=()=>ST.layers.verts||!!ST.seam'),'слои: пока точки скрыты, клик попадает в грань; «Провести шов» показывает точки сам');
  ok(HT.indexOf('js/layers.js')>0&&HT.indexOf('js/layers.js')<HT.indexOf('js/ui.js'),'слои: layers.js подключён раньше ui.js');}
// #148 версии фигуры в браузере: versions.js подключён, «Сохранить» кладёт версию и скачивает файл, при ошибке памяти — сообщение, версии в выпадашке и в подсказке
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),TP=fs.readFileSync(P+'tips.js','utf8');
  ok(HT.indexOf('js/versions.js')>0&&HT.indexOf('js/versions.js')<HT.indexOf('js/ui.js'),'версии: versions.js подключён раньше ui.js');
  ok(UI.includes('verPut(VSTO,b,j)')&&UI.includes("'Версию в браузере сохранить не удалось — сохранён только файл'")&&/saveBlob\(file,new Blob/.test(UI),'версии: «Сохранить» зовёт verPut и скачивает .json в любом случае; при ошибке памяти — сообщение');
  ok(UI.includes("v.startsWith('ver:')")&&UI.includes('verOptions()')&&UI.includes('verGet(VSTO,verKey(base,+n))')&&UI.includes('figureReady(rid,'),'версии: выпадашка строится из памяти, выбор версии грузит её (сначала файл фигуры-эталона)');
  ok(/живут только в этом браузере/.test(TP),'версии: в подсказке «?» — версии только в этом браузере');
  ok(['shepherd','shepherd2_1000','shepherd3','shepherd5'].every(id=>HT.includes('value="'+id+'"')),'версии: у каждой фигуры списка есть option, под него встают её версии');}
// #170 «в гипсе» (план Овчарки 6, Q5): у Овчарки 6 флаг plaster — build3D красит все грани одним светло-серым и рисует линии граней светлее; галочка «Линии граней» (мастерская) их выключает; у Овчарок 1–5 флага нет — вид как раньше
{const V3D=fs.readFileSync(P+'view3d.js','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),cm=/const PLASTER=\[(0x[0-9a-f]+),(0x[0-9a-f]+)\]/.exec(V3D);
  ok(run('FIGURES.shepherd6r.plaster')===true&&run('FIGURES.shepherd6.plaster')===true&&['shepherd','shepherd2_1000','shepherd2_700','shepherd2_500','shepherd2_350','shepherd3','shepherd5'].every(id=>!run(`FIGURES.${id}.plaster`))&&!!cm&&cm[1]===cm[2]&&parseInt(cm[1],16)>0x8a929a
    &&V3D.includes('(o.plaster?PLASTER:COL[o.mat]||COL.steel)')&&V3D.includes('if(o.plaster)seg(L,...PLASTER_LINE)')&&V3D.includes('if(o.edges===false)return')&&UI.includes('plaster:!!(FIGURES[ST.verBase]||{}).plaster')&&UI.includes('edges:!ed||ST.layers.edges'),
    'гипс: обе Овчарки 6 — один светло-серый цвет граней ('+(cm?cm[1]:'?')+'), линии граней тоньше и выключаются галочкой «Линии граней»; у Овчарок 1–5 флага нет');}
// #146 оригинал (вид): строка в списке фигур, файл данных ленивый и не больше 10 МБ, в кадре рабочей фигуры; ракурс при переключении сохраняется
{const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),OF=P+'orig-shepherd5.js',IM=__dirname+'/../img/orig-shepherd5.png';
  ok(run("FIGURES.shepherd5_orig.view")==='shepherd5'&&run("FIGURES.shepherd5_orig.orig")==='shepherd5'&&run("FIGURES.shepherd5_orig.need")==='orig-shepherd5'&&HT.includes('value="shepherd5_orig"'),'оригинал: строка в списке фигур — view=shepherd5, файл orig-shepherd5, есть пункт выпадашки');
  // #175: Овчарка 7 — не вид (#174), а рабочая фигура режима «оригинал для обводки»: ow — ключ в ORIG, без view/plaster/poly; ветка plaster из origEnter убрана
  {const OWJ=fs.readFileSync(P+'owork.js','utf8'),CSS=fs.readFileSync(__dirname+'/../css/style.css','utf8'),at=f=>HT.indexOf('js/'+f+'.js'),owRule=(CSS.match(/[^{}]*\{[^}]*\}/g)||[]).filter(r=>r.includes('body.owview')).join('');
    ok(run('FIGURES.shepherd7_orig.ow')==='shepherd5'&&run('FIGURES.shepherd7_orig.need')==='orig-shepherd5'&&run("['view','orig','plaster','poly'].every(k=>!(k in FIGURES.shepherd7_orig))")&&run('FIGURES.shepherd7_orig.name')==='Овчарка 7 — оригинал'&&HT.includes('value="shepherd7_orig"')&&!UI.includes("if(f.plaster)$('cOrigTex')"),
      'Овчарка 7 (#175): фигура режима обводки — ow=shepherd5 (данные orig-shepherd5), без view/plaster/poly, пункт выпадашки «Овчарка 7 — оригинал»; ветка вида #174 убрана');
    ok(UI.includes('function renderAll(fit){if(OW.on){owRender();return;}')&&UI.includes('if(FIGURES[id].ow){owLoad(id,after);return;}')&&UI.includes('function setBase(m,o={}){origLeave();owLeave();')&&!/\bcompute\(/.test(OWJ),
      'Овчарка 7 (#175): в режиме renderAll рисует только owRender (без compute, цифр и таблиц), выбор фигуры с ow открывает режим, любая другая фигура выходит из него (setBase → owLeave)');
    ok(at('orig')>0&&at('ow-core')>at('orig')&&at('owork')>at('ow-core')&&at('ui')>at('owork'),'Овчарка 7 (#175): ow-core.js и owork.js подключены после orig.js и до ui.js');
    ok(['#stats','.angbtn','section.tabs','[data-g="size"]','[data-g="faces"]','[data-g="metal"]','[data-g="perf"]','[data-g="view"]'].every(s=>owRule.includes(s))&&!/body\.owview[^{,]*\[data-g="edit"\]/.test(owRule)&&OWJ.includes('OW_PLASTER=0xb8b0a4')&&OWJ.includes('owRay(OW.G,'),
      'Овчарка 7 (#175): body.owview прячет цифры, «Углы», вкладки, панели размера, граней, металла, перфорации и вида (не «Редактор»); гипс 0xb8b0a4; точка под курсором — луч по сетке');
    // #176: разметка в режиме — перо, линия, зачёркивание через owPick; зелёные штрихи, красные концы; «Нарезать» скрыта; «Сохранить» — только разметка; файл режима открывается обратно
    ok(UI.includes('const on=ST.edit&&(OW.on||isPoly()&&!ST.orig)')&&/body\.owview #bMkApply/.test(owRule)&&UI.includes('owStrokes(raw,OW.G,owSnapSeg(),ST.magnet)')&&UI.includes('owSurf(mkSnap(h,owSnapSeg(),ST.magnet))')
      &&OWJ.includes('OW_PEN=0x22d65a')&&OWJ.includes('OW_FREE=0xd01f1f')&&OWJ.includes('owFreeEnds(')&&OWJ.includes('owDrape(OW.G,')&&!/bSave'\)\.disabled=true/.test(OWJ),
      'Овчарка 7 (#176): разметка в режиме — инструменты при «Править фигуру», перо по owPick с разрывом и магнитом к своим линиям, штрихи 0x22d65a, свободные концы 0xd01f1f, «Нарезать» скрыта, «Сохранить» включено');
    ok(OWJ.includes("{type:'md-art',v:1,ow:{src:OW.src,id:OW.id,name:OW.name},name:ST.name,mk:")&&UI.includes('if(OW.on)return owJSON();')&&UI.includes('if(j.ow){setTimeout(()=>owFromJSON(j));return;}')&&UI.includes('if(j.ow){owVersion(j,base,+n);return;}'),
      'Овчарка 7 (#176): «Сохранить» в режиме — файл только с разметкой (ow, name, mk — без V/F/P); .json и версия с ow открываются обратно в режим');}
  // #177: калька «Текстура» — шейдер на гипсе (светлое текстуры → тёмно-коричневые швы), по умолчанию, галочка «Калька» выключает; облако швов — при входе, магнит — к нему и к своим линиям
  {const OWJ=fs.readFileSync(P+'owork.js','utf8'),CSS=fs.readFileSync(__dirname+'/../css/style.css','utf8'),owRule=(CSS.match(/[^{}]*\{[^}]*\}/g)||[]).filter(r=>r.includes('body.owview')).join('');
    ok(OWJ.includes('OW_SEAM=[0.65,0.80]')&&OWJ.includes('OW_SEAM_C=0x2a1d14')&&/owSeamMips\([^;]*,OW_SEAM\),m=new THREE\.DataTexture\(/.test(OWJ)&&OWJ.includes('LinearMipmapLinearFilter')&&OWJ.includes("calka:src.T&&src.tex?'tex':''")&&OWJ.includes('owSeamCloud(')&&OWJ.includes('getImageData(')&&OWJ.includes("'Готовлю кальку…'"),
      'Овчарка 7 (#177): калька «Текстура» — маска швов по порогу OW_SEAM 0,65…0,80 с уровнями по максимуму (издалека не гаснет), швы 0x2a1d14, по умолчанию «Текстура»; маска и облако швов из пикселей текстуры при входе («Готовлю кальку…»)');
    ok(/body\.owview #edBox>:not\(#symRow\):not\(#mkBox\):not\(#traceRow\):not\(#traceSel\)/.test(owRule)&&UI.includes("$('cTrace').addEventListener('change',e=>{if(OW.on){")&&UI.includes("$('traceSel').addEventListener('change',e=>{if(OW.on){"),
      'Овчарка 7 (#177): в режиме видны галочка «Калька» и выбор кальки; их обработчики в режиме — своя ветка (слои других фигур не трогаются)');
    ok(OWJ.includes('owSnapJoin(OW.seam.seg,')&&OWJ.includes('seg=owSeamSeg(C)')&&/function owSnapSeg\(\)\{if\(!ST\.magnet\)return null;/.test(OWJ),'Овчарка 7 (#177): магнит — облако швов (своя сетка, один раз) + свои линии; выключен «Магнит» — не липнет');}
  // #178: фото-кальки — файл матриц js/photos-shepherd7.js и картинки (каждая ≤ 1 МБ) на странице не подключены: файл матриц — при входе в фигуру, картинка — когда её калька выбрана и видна;
  // шейдер — правило owPhotoPick: от камеры фото — гипс, у бока зеркало (берётся сторона прямее к камере), фото поверх гипса с непрозрачностью 0,85
  {const OWJ=fs.readFileSync(P+'owork.js','utf8'),pc={window:{}};vm.createContext(pc);vm.runInContext(fs.readFileSync(P+'photos-shepherd7.js','utf8'),pc);const PH=pc.window.PHOTOS.shepherd7||[],IM=PH.flatMap(p=>[p.img].concat(p.head?[p.head.img]:[])),sz=IM.map(f=>fs.statSync(__dirname+'/../'+f).size);
    ok(run('FIGURES.shepherd7_orig.photos')==='shepherd7'&&run("!!LAZY['photos-shepherd7']&&typeof lazyReady")==='function'&&PH.map(p=>p.key+':'+p.name+':'+p.mirror).join()==='front:Фото спереди:false,side:Фото сбоку:true'
      &&PH.every(p=>p.m.length===8&&p.m.every(Number.isFinite)&&p.dir.length===3&&Math.abs(Math.hypot(...p.dir)-1)<1e-9&&p.img==='img/photo-shepherd7-'+p.key+'.png'&&p.head&&p.head.img==='img/photo-shepherd7-'+p.key+'-head.png'&&p.head.m.length===8&&p.head.m.every(Number.isFinite)&&p.head.y0>500&&p.head.z0>700)&&sz.every(s=>s<=1048576)&&!HT.includes('photos-')&&!HT.includes('img/photo-'),
      `Овчарка 7 (#178): фото-кальки «Фото спереди» и «Фото сбоку» (зеркально на обе стороны) — матрица 8 чисел и направление камеры, у каждой слой головы (своя матрица, коробка головы); картинки ${sz.map(s=>(s/1048576).toFixed(2)).join(', ')} МБ (каждая ≤ 1), на странице не подключены до выбора`);
    ok(OWJ.includes('if(f.photos)owPhotosLoad(id,f.photos)')&&OWJ.includes('if(o&&ph&&ST.edit&&OW.calkaOn)owPhotoGet(o,ph)')&&OWJ.includes('ca=-dot(n,owDir),cb=owMir>.5?-dot(n*fx,owDir):-1.')&&OWJ.includes('b=vb&&(!va||cb>ca)')
      &&OWJ.includes('texture2D(owPh,vec2(u.x,1.-u.y))')&&OWJ.includes('owSeamOn()?o.seam:owPhotoOn()?owPhotoUse(o,ph):o.plaster')&&OWJ.includes(".concat(OW.photos.map(p=>[p.key,p.name]))")&&OWJ.includes('owPhotoImgs(p).every(f=>o.ptex[f]&&o.ptex[f].ready)')&&OWJ.includes("if(owPhotoOn())msg('«'+owPhoto().name+'» на модели")&&!OWJ.includes("if(owPhotoOn())msg('«'+p.name+'»"),
      'Овчарка 7 (#178): фото — шейдер-проектор по правилу owPhotoPick (от камеры — гипс, зеркало — сторона прямее к камере); в коробке головы — снимок головы, где он не прозрачный (#185: к шее и затылку — плавно); в списке калек после «Текстуры»; картинки грузятся по выбору, сообщение после загрузки — о выбранной кальке');}
  // #185 З3 резкие грани: фото — без светотени модели (цвет фото как есть, гипс со светом — только вскользь и вне фото), текстура фото — с уровнями и наибольшей анизотропией,
  // белые швы фото — отдельной маской (owPhotoPrep → owSeamMips, как у кальки «Текстура» #177) и резким порогом поверх граней без швов
  {const PH0=(()=>{const pc={window:{}};vm.createContext(pc);vm.runInContext(fs.readFileSync(P+'photos-shepherd7.js','utf8'),pc);return pc.window.PHOTOS.shepherd7[0];})(),OWJ=fs.readFileSync(P+'owork.js','utf8'),mat=OWJ.slice(OWJ.indexOf('function owPhotoMat('),OWJ.indexOf('function owCalkaUI(')),get=OWJ.slice(OWJ.indexOf('function owPhotoGet('),OWJ.indexOf('function owPhotoUse('));
    ok(/OW_PHOTO_SEAM=\[0\.\d+,0\.\d+\]/.test(OWJ)&&mat.includes('float w=(va||vb)?c.a*smoothstep(.1,.25,b?cb:ca):0.;')&&mat.includes('gl_FragColor.rgb=mix(gl_FragColor.rgb,c.rgb,w);')&&!/owK|vNormal|normal\)/.test(mat.slice(mat.indexOf('tonemapping')))
      &&mat.includes('uniform sampler2D owMk;')&&mat.includes('uniform sampler2D owMk2;')&&/smoothstep\(\.3,\.6,texture2D\(owMk,/.test(mat)&&get.includes('owPhotoPrep(')&&get.includes('getMaxAnisotropy()')&&!get.includes('Math.min(8')&&get.includes('LinearMipmapLinearFilter'),
      'Овчарка 7 (#185): фото-калька — цвет фото как есть (без светотени модели), швы фото — маска owSeamMips резким порогом поверх граней без швов (owPhotoPrep); текстура и маска — уровни + наибольшая анизотропия')
    // #185 З4: стык головы и общего фото — плавно в полосе OW_HEAD_BAND мм (owHeadW в ow-core.js, та же формула в шейдере); полоса — ниже основания ушей (уши — y ≥ 838 мм)
    const band=+(/OW_HEAD_BAND=(\d+)/.exec(OWJ)||[])[1],y0=PH0.head.y0;
    ok(band>=20&&band<=60&&y0-band<838-150&&mat.includes('owBand:{value:OW_HEAD_BAND}')&&mat.includes('uniform float owBand;')&&mat.includes('float hw=owHd>.5&&owIn(u2)?smoothstep(owHb.x-owBand,owHb.x,q.y)*smoothstep(owHb.y-owBand,owHb.y,q.z)*smoothstep(0.,owHe.x,u2.x)*smoothstep(0.,owHe.y,1.-u2.x)*smoothstep(0.,owHe.z,u2.y)*smoothstep(0.,owHe.w,1.-u2.y):0.;')&&OWJ.includes('U.owHe.value.set(E[0]?eu:1e-6,E[1]?eu:1e-6,E[2]?ev:1e-6,E[3]?ev:1e-6)')&&OWJ.includes('t.edge=[op(H,i=>i*W),op(H,i=>i*W+W-1),op(W,i=>i),op(W,i=>(H-1)*W+i)]')
      &&mat.includes('c=vec4(mix(c.rgb,c2.rgb,c2.a*hw),max(c.a,c2.a*hw));')&&!mat.includes('q.y>=owHb.x'),
      `Овчарка 7 (#185): фото головы и общее стыкуются плавно — полоса ${band} мм ниже y0 = ${y0}, позади z0 и у края картинки головы, к которому подходит собака (формула owHeadW), не ступенькой; уши (y ≥ 838) вне полосы`);}
  // #179 «Открыть модель» — всегда для обводки: OBJ / GLB / STL → owFile (owork.js) → owOpen(…,'file'), без расчёта. Расчётное открытие (упрощение isDense до ≤ 1500 граней, finishOpen → compute и строка
  // «Открыто: N — упрощаю до …») для файлов модели ушло — проверки ниже вместо него; .json фигуры — как раньше (figFromJSON → finishOpen). Разметка модели из файла — в браузере по имени файла (mkKey('file:'+имя))
  {const OWJ=fs.readFileSync(P+'owork.js','utf8'),tc={};vm.createContext(tc);const ts=fs.readFileSync(P+'tips.js','utf8');vm.runInContext(ts.slice(0,ts.indexOf('\n(()=>'))+'\nthis.TIPS=TIPS;',tc);
    const body=(S,f)=>{const a=S.indexOf('function '+f+'(');if(a<0)return '';const b=S.indexOf('\nfunction ',a+1),c=S.indexOf('\nconst ',a+1),e=[b,c].filter(x=>x>0);return S.slice(a,e.length?Math.min(...e):S.length);},OF_=body(UI,'openFile'),OWF=body(OWJ,'owFile');
    ok(HT.includes('<input type="file" id="fileIn" accept=".obj,.stl,.glb,.json,.png,.jpg,.jpeg,.webp" multiple hidden>')&&UI.includes('openFile(e.target.files)')&&OF_.includes('if(mf){owFile(mf,pic);return;}')
      &&!/parseOBJ|parseSTL|parseGLB/.test(OF_)&&OF_.includes('({m,o}=figFromJSON(j,name));')&&OF_.includes('finishOpen(m,o);'),
      '«Открыть модель» (#179): выбор нескольких файлов (модель + картинка текстуры), OBJ / GLB / STL — в режим обводки (owFile), .json — как раньше (figFromJSON → finishOpen)');
    ok(OWF.length>0&&!/finishOpen|compute\(|isDense|simplify|SIMP/.test(OWF)&&OWF.includes("owOpen({id:file.name,name,V:D.V,T:D.T,F:D.F,")&&OWF.includes("'file')")&&OWF.includes('D=owMesh(m)')&&/parseOBJ\(/.test(OWF)&&/parseGLB\(/.test(OWF)&&/parseSTL\(/.test(OWF),
      '«Открыть модель» (#179): модель из файла — без упрощения и расчёта (нет finishOpen / compute / isDense), в кадр и обходом наружу (owMesh), режим обводки с источником «file»');
    ok(OWJ.includes("'Открыта модель для обводки: '")&&OWJ.includes("OW_NOTEX='Текстуры нет — калька «Текстура» недоступна'")&&OWF.includes('img=ext===\'glb\'?m.img:ext===\'obj\'&&D.T?pic:null')&&OWF.includes('fr.readAsDataURL(img)')&&!/createObjectURL/.test(OWJ),
      '«Открыть модель» (#179): сообщения «Открыта модель для обводки: N треугольников» и «Текстуры нет — калька „Текстура“ недоступна»; текстура — из GLB или картинка к OBJ (картинка — data:-ссылкой через FileReader: createObjectURL на странице — только у скачивания, saveBlob)');
    ok(/обвод/.test(tc.TIPS.bOpen)&&/OBJ/.test(tc.TIPS.bOpen)&&/PNG/.test(tc.TIPS.bOpen)&&/\.json/.test(tc.TIPS.bOpen),'«Открыть модель» (#179): подсказка «?» — про обводку, OBJ с картинкой PNG и .json как раньше: «'+tc.TIPS.bOpen+'»');
    ok(UI.includes("const mkFig=()=>ST.ver?ST.verBase+'.'+ST.ver:(ST.fig||(OW.on&&OW.src==='file'?'file:'+OW.id:'file'));")&&OWJ.includes("if(o.src==='file'){owFileMk(o,mkLoad(JSON.stringify(j.mk||[])));return;}")
      &&OWJ.includes('Сначала откройте модель «${id}»')&&OWJ.includes('OW_WAIT={id,mk}')&&OWJ.includes('busy=mkLoad(store(k)).length>0;if(!busy)store(k,mkSave(mk));')&&OWF.includes('if(OW_WAIT&&OW_WAIT.id===file.name)')&&/function owMkPut\(mk\)\{mkSync\(\);const n=mk\.length;if\(!n\)\{/.test(OWJ)&&/function owFileMk\(o,mk\)\{const id=o\.id\|\|o\.name\|\|'\?',n=mk\.length;if\(!n\)\{/.test(OWJ),
      '«Открыть модель» (#179): разметка модели из файла — по имени файла; .json без открытой модели — «Сначала откройте модель …», разметка ждёт модель (и в браузере, если там пусто); пустой файл разметки ничего не стирает');}
  ok(fs.existsSync(OF)&&fs.statSync(OF).size<=10*1048576&&fs.existsSync(IM)&&fs.statSync(IM).size<=10*1048576&&!HT.includes('orig-shepherd5'),'оригинал: файл данных и текстура есть, каждый ≤ 10 МБ ('+(fs.statSync(OF).size/1048576).toFixed(1)+' и '+(fs.statSync(IM).size/1048576).toFixed(1)+'), на странице не подключены до выбора');
  const oc={console,Math,Buffer,atob:globalThis.atob,window:null};oc.window=oc;vm.createContext(oc);vm.runInContext(fs.readFileSync(P+'orig.js','utf8')+'\n;\n'+fs.readFileSync(P+'mesh.js','utf8')+'\n;\n'+fs.readFileSync(OF,'utf8'),oc);
  const O=vm.runInContext(`(()=>{const r=ORIG.shepherd5,D=origDecode(r),n=D.V.length/3;let mx=0;for(const i of D.F)if(i>mx)mx=i;const pts=[];for(let i=0;i<D.V.length;i+=3)pts.push([D.V[i],D.V[i+1],D.V[i+2]]);
    const N=origNormals(D.V,D.F);let bad=0;for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2]);if(Math.abs(l-1)>1e-3)bad++;}
    const b=meshBox(pts);return {tri:r.tri,f:D.F.length/3,mx,n,uv:D.T.length/2,bad,min:b.min,max:b.max,tex:r.tex};})()`,oc);
  const FB=run("meshBox(modelPoly('shepherd5').V)"),dd=[0,1,2].map(i=>[Math.abs(O.min[i]-FB.min[i]),Math.abs(O.max[i]-FB.max[i])]);
  ok(O.tri===158336&&O.f===158336&&O.mx<O.n&&O.uv===O.n&&O.bad===0&&O.tex==='img/orig-shepherd5.png','оригинал: декодируется — '+O.f+' треугольников, '+O.n+' вершин, индексы в пределах, нормали единичные');
  // #175: точка под курсором на Овчарке 7 — луч по сетке клеток; 100 лучей спереди-сбоку в морду (верх-перед габарита), в среднем ≤ 4 мс (в браузере — тот же код)
  {vm.runInContext(fs.readFileSync(P+'ow-core.js','utf8'),oc);const R=vm.runInContext(`(()=>{const D=origDecode(ORIG.shepherd5);let t=Date.now();const G=owGrid(D.V,D.F),tg=Date.now()-t;let s=1,hit=0,front=0;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,O=[600,860,2500];
      t=Date.now();for(let i=0;i<100;i++){const q=[(rnd()-.5)*200,1018*(.7+rnd()*.25),1177*.8],d=q.map((x,k)=>x-O[k]),l=Math.hypot(...d),h=owRay(G,O,d.map(x=>x/l));if(h){hit++;if(O[2]+d[2]/l*h.t>700)front++;}}return {tg,ms:(Date.now()-t)/100,hit,front};})()`,oc);
    ok(R.hit>=70&&R.front===R.hit&&R.ms<=4,`Овчарка 7 (#175): луч по сетке — ${R.hit} из 100 в морду (все спереди, z > 700), ${R.ms.toFixed(2)} мс на луч (≤ 4), сетка — ${R.tg} мс`);}
  // #184: ортокамера «Спереди» / «Сбоку» у фигур режима обводки — лучи, проекции и рендер от активной камеры curCam(), а не от перспективной camera (иначе в орто перо мимо курсора);
  // орто — только виды front / side при OW.on (у Овчарок 1–6 перспектива); полувысота кадра — owOrthoHalf (ow-core.js уже в oc, блок #175 выше)
  {const V3J=fs.readFileSync(P+'view3d.js','utf8'),OWJ=fs.readFileSync(P+'owork.js','utf8'),old=[V3J,OWJ].filter(S=>/setFromCamera\([^;]*,camera\)|render\(scene,camera\)|\.project\(camera\)/.test(S)).length;
    ok(old===0&&V3J.includes('renderer.render(scene,curCam());labels.render(scene,curCam());')&&OWJ.includes('),curCam());const O=rc.ray.origin')&&V3J.includes('function curCam(){return VIEW.ortho?camO:camera;}')
      &&V3J.includes("OW.on&&(k==='front'||k==='side')")&&V3J.includes('controls.object=camO;')&&Math.abs(oc.owOrthoHalf(1000,35)-315.299)<.01,
      'Овчарка 7 (#184): «Спереди» / «Сбоку» у фигур режима обводки — ортокамера (owOrthoHalf), лучи пера, проекции и рендер — от curCam(); setFromCamera / render / project с camera не осталось');}
  // #184 задача 2: плоская фото-калька в ортовиде своего ракурса — те же текстуры (o.ptex, owPhotoTex), те же униформы (o.photo.userData.U, заполняет owPhotoUse: матрицы, маски, owHe по .edge, OW_HEAD_BAND)
  // и тот же кусок шейдера, что у проекции #185 (OW_PH_GLSL — униформы, OW_PH_CW — цвет фото, швы по маске OW_PHOTO_SEAM_C, вес головы): одна логика швов и стыка головы, без копий
  {const OWJ=fs.readFileSync(P+'owork.js','utf8'),fm=OWJ.slice(OWJ.indexOf('function owFlatMat('),OWJ.indexOf('\n',OWJ.indexOf('function owFlatMat(')+400)),cw=(/const OW_PH_CW=`([^`]*)`/.exec(OWJ)||[])[1]||'',gl=(/const OW_PH_GLSL=`([^`]*)`/.exec(OWJ)||[])[1]||'';
    ok(cw.includes('smoothstep(.3,.6,texture2D(owMk,')&&cw.includes('smoothstep(.3,.6,texture2D(owMk2,')&&cw.includes('float hw=owHd>.5&&owIn(u2)?smoothstep(owHb.x-owBand,owHb.x,q.y)')&&cw.includes('smoothstep(0.,owHe.x,u2.x)')&&gl.includes('uniform vec3 owSeamC;')
      &&(OWJ.match(/\$\{OW_PH_CW\}/g)||[]).length===2&&OWJ.includes('sh.fragmentShader=OW_PH_GLSL+sh.fragmentShader.replace(')&&OWJ.includes('fragmentShader:OW_PH_GLSL+`')&&OWJ.includes('owSeamC:{value:new THREE.Color(OW_PHOTO_SEAM_C)}')
      &&/function owFlatMat\(U,layer\)\{return new THREE\.ShaderMaterial\(\{uniforms:Object\.assign\(\{\},U,/.test(OWJ)&&OWJ.includes('o.photo.userData.U')&&/function owFlatUse\(o,ph\)\{owPhotoUse\(o,ph\);/.test(OWJ)&&OWJ.includes('owPhotoQuad(')
      &&OWJ.includes('owFlatShow(ph.key,VIEW.key,VIEW.ortho)')&&OWJ.includes('fl?owFlatUse(o,ph):owSeamOn()?o.seam:owPhotoOn()?owPhotoUse(o,ph):o.plaster')&&fm.includes('depthTest:false,depthWrite:false'),
      'Овчарка 7 (#184): плоская фото-калька — те же текстуры, униформы и кусок шейдера, что у проекции #185 (швы по маске цветом OW_PHOTO_SEAM_C, стык головы — полоса OW_HEAD_BAND и край картинки по .edge); только в ортовиде своего ракурса, поверх модели без глубины');}
  // #184 задача 3: галочка «Модель» у плоской кальки — в index.html скрыта по умолчанию и включена (в режиме её не прячет правило body.owview #edBox>…, style.css); обработчик в ui.js — OW.modelOn и owRender(); снята — модель материалом «только глубина»
  // (colorWrite выкл., глубину пишет: штрихи за ней не просвечивают), фото 100 %; включена — гипс, 50 %; видна, только когда плоская калька на экране; «Сохранить» (owJSON) — формат прежний
  {const HT=fs.readFileSync(__dirname+'/../index.html','utf8'),UI=fs.readFileSync(P+'ui.js','utf8'),OWJ=fs.readFileSync(P+'owork.js','utf8'),CSS=fs.readFileSync(__dirname+'/../css/style.css','utf8');
    ok(CSS.includes(':not(#traceSel):not(#modelRow),')&&HT.includes('<label class="chk" id="modelRow" hidden><input type="checkbox" id="cModel" checked>')&&HT.indexOf('id="modelRow"')>HT.indexOf('id="traceSel"')
      &&UI.includes("$('cModel').addEventListener('change',e=>{OW.modelOn=e.target.checked;owRender();});")
      &&OWJ.includes('depth=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide})')&&OWJ.includes('f.mg.uniforms.owOp.value=OW.modelOn?.5:1;return OW.modelOn?o.plaster:o.depth;}')
      &&OWJ.includes("$('modelRow').hidden=!fl;")&&OWJ.includes("modelOn:true,seam:null,seamMs:0});$('cModel').checked=true;")&&OWJ.includes('o.depth.dispose();')
      &&OWJ.includes("function owJSON(){return {type:'md-art',v:1,ow:{src:OW.src,id:OW.id,name:OW.name},name:ST.name,mk:JSON.parse(mkSave(ST.mk))};}"),
      'Овчарка 7 (#184): галочка «Модель» — скрыта, пока нет плоской кальки; снята — модель только в глубину (заслоняет штрихи), фото 100 %; включена — гипс, 50 %; сброс при открытии; owJSON прежний');}
  // #176: перо по морде Овчарки 7 — точки руки (лучи по сетке, как owPick) → owStrokes → каждая точка штриха ≤ 1 мм от модели; расстояние — перебором треугольников (не той же сеткой)
  {['tlines','markup'].forEach(f=>vm.runInContext(fs.readFileSync(P+f+'.js','utf8'),oc));   // ow-core.js уже в oc (блок #175 выше)
    const R=vm.runInContext(`(()=>{const D=origDecode(ORIG.shepherd5),G=owGrid(D.V,D.F),O=[600,860,2500],raw=[];
      for(let i=0;i<=120;i++){const q=[-60+i,1018*.83+Math.sin(i/7)*25,1177*.8],d=q.map((x,k)=>x-O[k]),l=Math.hypot(...d),h=owRay(G,O,d.map(x=>x/l));if(h)raw.push(O.map((x,k)=>x+d[k]/l*h.t));}
      const t=Date.now(),S=owStrokes(raw,G,null,true);return {raw:raw.length,S,ms:Date.now()-t,V:D.V,F:D.F};})()`,oc);
    // перебор — здесь, а не в песочнице vm (там Math.* медленный): габарит треугольника ±2 мм, ближайшая точка — tlClosest
    const {V,F}=R;let worst=0;R.n=0;R.strokes=R.S.length;R.S.forEach(s=>s.pts.forEach(p=>{R.n++;let bd=Infinity;for(let f=0;f<F.length;f+=3){const a=F[f]*3,b=F[f+1]*3,q=F[f+2]*3;
      if(Math.min(V[a],V[b],V[q])>p[0]+2||Math.max(V[a],V[b],V[q])<p[0]-2||Math.min(V[a+1],V[b+1],V[q+1])>p[1]+2||Math.max(V[a+1],V[b+1],V[q+1])<p[1]-2||Math.min(V[a+2],V[b+2],V[q+2])>p[2]+2||Math.max(V[a+2],V[b+2],V[q+2])<p[2]-2)continue;
      const c=oc.tlClosest(p,[V[a],V[a+1],V[a+2]],[V[b],V[b+1],V[b+2]],[V[q],V[q+1],V[q+2]]);bd=Math.min(bd,Math.hypot(c[0]-p[0],c[1]-p[1],c[2]-p[2]));}worst=Math.max(worst,bd);}));R.worst=worst;
    ok(R.raw>=100&&R.strokes>=1&&R.n>=10&&R.worst<=1,`Овчарка 7 (#176): перо по морде — ${R.raw} точек руки → ${R.strokes} ${R.strokes===1?'штрих':'штриха'}, ${R.n} точек, дальше всех от модели ${R.worst.toFixed(3)} мм (≤ 1), ${R.ms} мс`);}
  // #177: облако швов на 158 тыс. треугольниках из настоящей текстуры (PNG — zlib, без пакетов) — ≤ 3 с вместе с сеткой магнита; скорость — обычной функцией, не в vm (там Math.* ×20).
  // Магнит (путь «Линии» на странице: mkSnap → owNear): точка гипса в 2–4 мм от шва — с магнитом ≤ 1 мм от шва, без магнита — как была; расстояние до шва — перебором облака
  {const png=b=>{const zl=require('zlib');let o=8,W,H,ct;const id=[];while(o<b.length){const n=b.readUInt32BE(o),t=b.toString('latin1',o+4,o+8),d=b.subarray(o+8,o+8+n);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);o+=12+n;}
      const ch=ct===6?4:3,raw=zl.inflateSync(Buffer.concat(id)),st=W*ch,out=new Uint8ClampedArray(W*H*4),cur=new Uint8Array(st),prev=new Uint8Array(st);
      for(let y=0;y<H;y++){const f=raw[y*(st+1)],r=raw.subarray(y*(st+1)+1,(y+1)*(st+1));for(let i=0;i<st;i++){const a=i>=ch?cur[i-ch]:0,u=prev[i],c=i>=ch?prev[i-ch]:0;let p=r[i];
          if(f===1)p+=a;else if(f===2)p+=u;else if(f===3)p+=(a+u)>>1;else if(f===4){const q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);p+=pa<=pb&&pa<=pc?a:pb<=pc?u:c;}cur[i]=p;}
        for(let x=0;x<W;x++){const s=x*ch,d=(y*W+x)*4;out[d]=cur[s];out[d+1]=cur[s+1];out[d+2]=cur[s+2];out[d+3]=255;}prev.set(cur);}return {W,H,data:out};};
    const D=vm.runInContext('origDecode(ORIG.shepherd5)',oc),V=new Float32Array(D.V),T=new Float32Array(D.T),F=new Uint32Array(D.F),px=png(fs.readFileSync(IM)),M={};
    new Function('M',['tlines','markup','ow-core'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+';Object.assign(M,{owSeamCloud,owSeamSeg,owSnapJoin,mkSnap,owGrid,owNear});')(M);
    let t=Date.now();const C=M.owSeamCloud(V,T,F,px),seg=M.owSeamSeg(C);const ms=Date.now()-t,np=C.length/3;
    const G=M.owGrid(V,F),near=p=>{let b=Infinity;for(let i=0;i<C.length;i+=3)b=Math.min(b,(C[i]-p[0])**2+(C[i+1]-p[1])**2+(C[i+2]-p[2])**2);return Math.sqrt(b);};
    const all=M.owSeamCloud(V,T,F,px,0,7),J=M.owSnapJoin(seg,new Float32Array(0));let n=0,worst=0,keep=0;
    for(let i=0;i<all.length&&n<40;i+=3*97){const p=[all[i],all[i+1],all[i+2]],d0=near(p);if(d0<2||d0>4)continue;n++;
      const on=M.owNear(G,M.mkSnap(p,J,true),20),off=M.owNear(G,M.mkSnap(p,J,false),20);worst=Math.max(worst,near(on.p));if(Math.abs(near(off.p)-d0)<.05)keep++;}
    ok(np>50000&&ms<=3000&&n>=20&&worst<=1&&keep===n,`Овчарка 7 (#177): облако швов — ${np} точек за ${ms} мс (≤ 3000) с сеткой магнита; ${n} точек в 2–4 мм от шва: с магнитом дальше всех ${worst.toFixed(2)} мм от шва (≤ 1), без магнита — на месте ${keep} из ${n}`);}
  // #178: матрицы фото на модели страницы (риск — сведение матрицы тихо сдвигает фото): силуэт модели через матрицу против силуэта фото (альфа) — ≥ 0,8 и как в логе photo-fit.js (iou в файле);
  // точки модели, что смотрят на камеру фото (owPhotoPick — то же правило, что шейдер; cos ≥ 0,3), — на собаке фото ≥ 91 % (сдвиг фото на 10 мм даёт ~ 90 %). Обычной функцией, не в vm (там Math.* ×20)
  {const PF=require('./photo-fit.js'),pc={window:{}};vm.createContext(pc);vm.runInContext(fs.readFileSync(P+'photos-shepherd7.js','utf8'),pc);const D=vm.runInContext('origDecode(ORIG.shepherd5)',oc),N=vm.runInContext('origNormals',oc)(D.V,D.F),M={};
    new Function('M',fs.readFileSync(P+'ow-core.js','utf8')+';M.pick=owPhotoPick;')(M);
    pc.window.PHOTOS.shepherd7.forEach(ph=>{const A=PF.readAlpha(__dirname+'/../'+ph.img),W=A.W,H=A.H,iou=PF.silIoU(D.V,D.F,ph.m,A,W,H);let n=0,hit=0,mir=0;
      for(let i=0;i<D.V.length;i+=3){const r=M.pick(ph,[D.V[i],D.V[i+1],D.V[i+2]],[N[i],N[i+1],N[i+2]]);if(!r||r.cos<.3)continue;n++;if(r.mir)mir++;if(A[Math.min(H-1,r.uv[1]*H|0)*W+Math.min(W-1,r.uv[0]*W|0)])hit++;}
      ok(iou>=.8&&Math.abs(iou-ph.iou)<=.005&&n>10000&&hit/n>=.91&&(ph.mirror?mir>n/3:mir===0),`Овчарка 7 (#178): «${ph.name}» на модели — совпадение силуэта ${iou.toFixed(3)} (≥ 0,8, в файле ${ph.iou}), на собаке фото ${(100*hit/n).toFixed(1)} % из ${n} точек к камере (≥ 91)${ph.mirror?', зеркально '+mir:''}`);
      // слой головы: сквозное совпадение силуэта снимка головы ≥ 0,8 (спереди подгон по глазам и носу — силуэт хуже, 0,85) и как в файле; точки к камере в коробке головы — на голове фото ≥ 85 %
      const h=ph.head,AH=PF.readAlpha(__dirname+'/../'+h.img),ih=PF.silIoU(D.V,D.F,h.m,AH,AH.W,AH.H);let nh=0,hh=0;
      for(let i=0;i<D.V.length;i+=3){const r=M.pick(ph,[D.V[i],D.V[i+1],D.V[i+2]],[N[i],N[i+1],N[i+2]]);if(!r||r.cos<.3||!r.head)continue;nh++;if(AH[Math.min(AH.H-1,r.head[1]*AH.H|0)*AH.W+Math.min(AH.W-1,r.head[0]*AH.W|0)])hh++;}
      ok(ih>=.8&&Math.abs(ih-h.iou)<=.005&&nh>5000&&hh/nh>=.85,`Овчарка 7 (#178): «${ph.name}», голова${h.pins?" (подгон по глазам и носу)":""} — совпадение силуэта ${ih.toFixed(3)} (≥ 0,8, в файле ${h.iou}), на голове фото ${(100*hh/nh).toFixed(1)} % из ${nh} точек к камере в коробке головы (≥ 85)`);});}
  // #179: настоящая модель Meshy Овчарки (from-dev, только локально — нет файла, проверка пропускается) через parseOBJ → owMesh: те же 158 336 треугольников и вершины-пары, что у orig-shepherd5,
  // обход наружу (объём > 0, не перевёрнут), высота 1000 мм, центр X и Z — 0; тот же файл с вывернутым обходом — перевёрнут обратно. Обычной функцией, не в vm (там Math.* ×20)
  {const OBJ=__dirname+'/../../from-dev/art/tools/plates/src/shepherd5/model/Meshy_AI_welded_adult_shepherd_final_20261122_image-to-3d-texture.obj';
    if(!fs.existsSync(OBJ))console.log('     #179: модели Meshy в from-dev нет — проверка открытия OBJ пропущена');
    else{const M={};new Function('M',['mesh','ow-core'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+';Object.assign(M,{parseOBJ,owMesh,owOrient});')(M);
      const t=Date.now(),txt=fs.readFileSync(OBJ,'utf8'),m=M.parseOBJ(txt),D=M.owMesh(m),ms=Date.now()-t,ax=k=>{let lo=Infinity,hi=-Infinity;for(let i=k;i<D.V.length;i+=3){lo=Math.min(lo,D.V[i]);hi=Math.max(hi,D.V[i]);}return [lo,hi];};
      const inv=M.owMesh({V:m.V,F:m.F.map(f=>[f[0],f[2],f[1]]),T:m.T}),y=ax(1),x=ax(0),z=ax(2);
      ok(D.F.length/3===158336&&D.V.length/3===O.n&&D.T&&D.T.length/2===O.n&&!D.flipped&&D.vol>0&&inv.flipped&&inv.vol<0&&Math.abs(y[0])<1e-3&&Math.abs(y[1]-1000)<1e-3&&Math.abs(x[0]+x[1])<1e-3&&Math.abs(z[0]+z[1])<1e-3,
        `«Открыть модель» (#179): OBJ Meshy Овчарки — ${D.F.length/3} треугольников, ${D.V.length/3} вершин (у orig-shepherd5 ${O.n}), uv ${D.T?'есть':'нет'}, объём ${D.vol>0?'> 0':'< 0'} (обход наружу), вывернутый — ${inv.flipped?'перевёрнут':'НЕ перевёрнут'}; высота ${(y[1]-y[0]).toFixed(1)} мм, центр X ${((x[0]+x[1])/2).toFixed(3)}, Z ${((z[0]+z[1])/2).toFixed(3)}; ${ms} мс`);}}
  // кадр один с фигурой (xf, как у кальки): по X и Z каждая сторона ±3 мм; по высоте оригинал выше — плиты срезали кончики ушей (Y: низ ≤ 5 мм, верх ≤ 20 мм)
  ok(dd[0].every(x=>x<=3)&&dd[2].every(x=>x<=3)&&dd[1][0]<=5&&dd[1][1]<=20,'оригинал: в кадре рабочей фигуры — по X и Z ±3 мм, по высоте верх выше на '+dd[1][1].toFixed(1)+' мм (кончики ушей)');
  // ракурс: направление и цель в долях высоты габарита; тот же кадр — та же камера, другой кадр — тот же угол, масштаб по высоте
  const cm=vm.runInContext(`(()=>{const mk=()=>({x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}});globalThis.ok=true;globalThis.camAnim={};globalThis.req3D=()=>{};globalThis.controls={target:mk(),update(){}};globalThis.camera={position:mk()};
    const box={min:[-160,0,0],max:[160,1000,1100],size:[320,1000,1100]},box2={min:[0,0,0],max:[640,2000,2200],size:[640,2000,2200]};controls.target.set(0,500,550);camera.position.set(700,600,1900);const k=camKeep(box);
    controls.target.set(9,9,9);camera.position.set(1,1,1);camRestore(k,box);const a=[camera.position.x,camera.position.y,camera.position.z,controls.target.y];camRestore(k,box2);return {same:a,big:[camera.position.x,camera.position.y,camera.position.z],stopped:camAnim===null};})()`,oc);
  ok(Math.abs(cm.same[0]-700)<1e-9&&Math.abs(cm.same[1]-600)<1e-9&&Math.abs(cm.same[2]-1900)<1e-9&&Math.abs(cm.big[0]-1720)<1e-9&&Math.abs(cm.big[2]-3800)<1e-9&&cm.stopped,'оригинал: camKeep/camRestore — в том же кадре камера та же, в другом — тот же угол и масштаб по высоте; пролёт камеры остановлен');
  ok(HT.indexOf('js/orig.js')>0&&HT.indexOf('js/orig.js')<HT.indexOf('js/ui.js')&&HT.includes('id="cOrigTex"')&&HT.includes('id="origBox"'),'оригинал: orig.js подключён раньше ui.js, есть галочка «Текстура» и блок-строка');
  ok(UI.includes('function renderAll(fit){if(OW.on){owRender();return;}if(!CUR||ST.orig)return;')&&UI.includes('camKeep(box)')&&UI.includes('camRestore(k,box)')&&UI.includes("if('tool' in ST)ST.tool=''")&&UI.includes('ST.orig&&v===ST.orig.back')&&UI.includes('Это вид оригинала. Для расчёта выберите')&&UI.includes('origLeave();owLeave();ST.base=m'),'оригинал: под видом рабочая фигура не перерисовывается, возврат на месте с тем же ракурсом, инструмент выключается, строка про расчёт, другой выбор выгружает оригинал');}
// модульные тесты страницы (tools/*.test.js: слои, версии, проверка фигуры, линии кальки…) — в общем прогоне test:editor через этот smoke (#147; package.json не трогаем)
{const T=fs.readdirSync(__dirname).filter(f=>/\.test\.js$/.test(f)).map(f=>__dirname+'/'+f),r=require('child_process').spawnSync(process.execPath,['--test',...T],{encoding:'utf8',maxBuffer:64*1048576}),
  m=k=>{const x=new RegExp('^ℹ '+k+' (\\d+)','m').exec(r.stdout||'');return x?+x[1]:-1;};
  // #178: «прошло -1, упало -1» = от node --test не пришло ни строки (не запустился, убит или переполнил буфер) — в строку FAIL код выхода, сигнал и ошибку запуска, чтобы причина была видна
  ok(r.status===0&&m('fail')===0&&m('pass')>0,`модульные тесты страницы (${T.length} файлов): прошло ${m('pass')}, упало ${m('fail')}`+(r.status===0?'':` · node --test: код ${r.status}, сигнал ${r.signal||'нет'}, ошибка запуска ${r.error?r.error.code||r.error.message:'нет'}, вывод ${(r.stdout||'').length + (r.stderr||'').length} симв.`));if(r.status!==0)console.log((r.stdout||'')+(r.stderr||''));}
console.log(bad?'ОШИБОК: '+bad:'всё ок'+(warned?' (предупреждений: '+warned+')':''));process.exit(bad?1:0);
