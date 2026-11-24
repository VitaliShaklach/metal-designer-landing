// проверка ядра дровокола в Node: node drovokol-q7m4z/tools/smoke.js
// Файлы js/ склеиваются и исполняются в области одной функции (не в vm, как у коня: в vm каждое обращение к глобальной функции
// идёт через перехватчик контекста, раскладка там в ~17 раз медленнее, чем в браузере). run(s) — прямой eval в этой области
const fs=require('fs'),P=__dirname+'/../js/';
const FILES=['geom','engrave','nest','dxf','order','calc-run','view'].filter(f=>fs.existsSync(P+f+'.js'));
const run=new Function(FILES.map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n')+'\n;return s=>eval(s);')();
const c=new Proxy({},{get:(_,k)=>run(String(k))});let bad=0;
const ok=(b,t)=>{console.log((b?'ok  ':'FAIL')+' '+t);if(!b)bad++;};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
// контур замкнут (≥ 3 точек, без нулевых сторон) и без самопересечений
const simple=P=>{const n=P.length;if(n<3)return false;for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6)return false;}
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(c.segX(P[i],P[(i+1)%n],P[j],P[(j+1)%n]))return false;}return true;};
// отверстие внутри металла: центр внутри контура, до кромки не ближе m мм; отверстия не ближе m друг к другу
const holesIn=(p,m=3)=>{const d=c.polyDist(p.pts);return p.holes.every(h=>c.inPoly([h[0],h[1]],p.pts)&&d([h[0],h[1]])-h[2]/2>=m-1e-9)
  &&p.holes.every((h,i)=>p.holes.every((g,j)=>j<=i||Math.hypot(h[0]-g[0],h[1]-g[1])-(h[2]+g[2])/2>=m));};
const bbox=P=>{const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};

// детали не внахлёст (зазор ≥ gap) и не за краем с отступом
const layoutOK=(res,o)=>{const [W,H]=run(`sheetWH(${JSON.stringify(o)})`);let good=true;
  res.sheets.forEach(s=>{s.items.forEach((a,i)=>{const [x0,y0,x1,y1]=bbox(a.pts);if(x0<o.margin-.01||y0<o.margin-.01||x1>W-o.margin+.01||y1>H-o.margin+.01)good=false;
    s.items.forEach((b,j)=>{if(j>i&&c.polyGap(a.pts,b.pts)<o.gap-.01)good=false;});
    if(!a.holes.every(h=>c.inPoly([h[0],h[1]],a.pts)))good=false;});});return good;};
/* ---------- пластина ---------- */
{const p=run('platePart()'),[x0,y0,x1,y1]=bbox(p.pts);
  ok(near(x0,0)&&near(y0,0)&&near(x1,100)&&near(y1,420),`пластина: габарит 100 × 420 (${x1-x0} × ${y1-y0})`);
  const want=[[21,399,13],[60,400,10.5],[82,258,10.5],[82,133,10.5],[60,16,10.5]];
  ok(p.holes.length===5&&want.every((w,i)=>near(p.holes[i][0],w[0])&&near(p.holes[i][1],w[1])&&near(p.holes[i][2],w[2])),'пластина: ось Ø13 в (21, 399), Ø10.5 в (60, 400), (82, 258), (82, 133), (60, 16)');
  ok(simple(p.pts),'пластина: контур замкнут, без самопересечений');
  ok(run('areaS(plateOutline())')>0,'пластина: контур против часовой');
  ok(holesIn(p,3),'пластина: отверстия внутри металла, до края ≥ 3 мм');
  // голова R21: точки дуги на расстоянии 21 от оси; шейка 42 от правого края со скруглением R5; 5 зубьев на высотах полок
  const arc=p.pts.filter(q=>q[0]<21+1e-6&&q[1]>378-1e-6);ok(arc.length>=19&&arc.every(q=>near(Math.hypot(q[0]-21,q[1]-399),21,1e-6)),'пластина: голова скруглена R21 вокруг оси');
  const fil=p.pts.filter(q=>q[0]>=53-1e-6&&q[0]<=58+1e-6&&q[1]>=373-1e-6&&q[1]<=378+1e-6);ok(fil.length>=10&&fil.every(q=>near(Math.hypot(q[0]-53,q[1]-373),5,1e-6)),'пластина: шейка 42, внутренний угол R5');
  const tips=[[285,38],[225,35],[175,32],[125,29],[75,26]];ok(tips.every(([y,x])=>p.pts.some(q=>near(q[0],x)&&near(q[1],y))),'пластина: 5 зубьев, кончики 62/65/68/71/74 от стены на полках 285/225/175/125/75');
  ok(p.pts.some(q=>near(q[0],30)&&near(q[1],0)),'пластина: низ — 70 от стены');}

/* ---------- ручки: 30 вариантов ---------- */
{const V=[];for(const t of ['A','B'])for(const p of [1,2,3,4,5])for(const l of [60,70,80])V.push([t,p,l]);
  const H=V.map(([t,p,l])=>run(`handlePart('${t}',${p},${l})`)),PR=run('HANDLE_PROFILES');
  ok(H.length===30&&new Set(H.map(h=>h.name)).size===30&&H[0].name==='A1-60'&&H[29].name==='B5-80','ручки: 30 вариантов, имена A1-60 … B5-80');
  const errs=[];
  H.forEach(h=>{const pf=PR[h.prof],[a0,P1,P2]=h.axis,L1=Math.hypot(P1[0],P1[1]),L2=Math.hypot(P2[0]-P1[0],P2[1]-P1[1]),tang=h.len*10-20-340-pf.stub;
    const ang=180-Math.abs(Math.atan2(P2[1]-P1[1],P2[0]-P1[0]))*180/Math.PI,d2=[(P2[0]-P1[0])/L2,(P2[1]-P1[1])/L2];
    const end=h.pts.filter(q=>near((q[0]-P2[0])*d2[0]+(q[1]-P2[1])*d2[1],0,1e-6)),endW=end.length===2?Math.hypot(end[0][0]-end[1][0],end[0][1]-end[1][1]):-1;
    const at=k=>[P2[0]-d2[0]*k,P2[1]-d2[1]*k],th=h.holes.slice(1),pv=h.holes[0],[x0,,,y1]=bbox(h.pts),e=[];
    if(!near(20+L1+L2,h.len*10,1e-6))e.push('длина по оси');
    if(!near(L1,340,1e-9)||!near(-a0[0],20))e.push('участок с лезвием');
    if(!near(h.tangLen,tang)||!near(L2,pf.stub+tang,1e-6))e.push('хвостовик длина');
    if(!near(endW,22,1e-6))e.push('хвостовик ширина '+endW);
    if(!near(ang,pf.angle,0.1))e.push('угол '+ang);
    if(!(pv[0]===0&&pv[1]===0&&pv[2]===13&&near(x0,-20,1e-9)&&near(Math.max(...h.pts.filter(q=>q[0]<=0).map(q=>q[1])),20,1e-9)))e.push('ось Ø13 в конце R20');
    if(!(th.length===3&&th.every(q=>q[2]===6.5)&&[25,tang/2,tang-25].every((k,i)=>near(th[i][0],at(k)[0],1e-6)&&near(th[i][1],at(k)[1],1e-6))))e.push('отверстия хвостовика');
    if(!simple(h.pts))e.push('самопересечение');
    if(!(run(`areaS(handlePart('${h.type}',${h.prof},${h.len}).pts)`)>0))e.push('обход');
    if(!holesIn(h,3))e.push('отверстия внутри ≥ 3');
    if(e.length)errs.push(h.name+': '+e.join(', '));});
  ok(!errs.length,'ручки: длина по оси 600/700/800, лезвие 340, хвостовик 22 × (len·10 − 360 − переход), угол ±0.1°, ось Ø13 в R20, 3 отв. Ø6.5 (25 от конца, 25 от плеча, посередине), без самопересечений, отверстия ≥ 3 мм'+(errs.length?' — '+errs.join('; '):''));
  ok([1,2,3,4,5].every(p=>[60,70,80].every(l=>{const a=run(`handlePart('A',${p},${l})`),b=run(`handlePart('B',${p},${l})`);
    const k=(P,m)=>P.map(q=>(Math.round(q[0]*1e5)/1e5+0)+','+(Math.round(m*q[1]*1e5)/1e5+0)).sort().join(';');return a.pts.length===b.pts.length&&k(a.pts,-1)===k(b.pts,1)&&k(a.holes,-1)===k(b.holes,1);})),'ручки: B — зеркало A по оси участка с лезвием (те же точки и отверстия с y → −y)');
  ok([[1,60,200],[2,60,210],[3,60,220],[4,60,230],[5,60,230],[1,70,300],[3,80,420],[5,80,430]].every(([p,l,t])=>run(`tangLen(${p},${l})`)===t),'ручки: хвостовик 60 см — 200/210/220/230/230, 70 — 300…330, 80 — 400…430');
  /* гравировка «ЛЕЗВИЕ» */
  ok(['Л','Е','З','В','И','>'].every(ch=>run(`GLYPHS['${ch}']`)),'гравировка: шрифт знает Л, Е, З, В, И, >');
  const eg=[];H.forEach(h=>{const d=c.polyDist(h.pts);
    if(!h.engr.length)eg.push(h.name+': пусто');
    h.engr.forEach(z=>{const a=[z[0],z[1]],b=[z[2],z[3]];
      if(!c.inPoly(a,h.pts)||!c.inPoly(b,h.pts)||d(a)<2||d(b)<2)eg.push(h.name+': вне металла');
      if(h.pts.some((p,i)=>c.segX(a,b,p,h.pts[(i+1)%h.pts.length])))eg.push(h.name+': пересекает кромку');
      h.holes.forEach(q=>{if(c.ptSegD([q[0],q[1]],a,b)-q[2]/2<2)eg.push(h.name+': ближе 2 мм к отверстию');});});
    const top=Math.max(...h.engr.map(z=>Math.max(z[1],z[3])));if(!(top>h.bladeEdge[0][1]-8))eg.push(h.name+': стрелка не у кромки лезвия');});
  ok(!eg.length,'гравировка: на всех 30 ручках целиком внутри металла (≥ 2 мм от кромки), не ближе 2 мм к отверстиям, стрелка доходит к кромке лезвия'+(eg.length?' — '+[...new Set(eg)].slice(0,5).join('; '):''));
  const big=run("runOrder({...ORDER_DEFAULT,plates:0,handles:['A','B'].flatMap(t=>[1,2,3,4,5].flatMap(p=>[60,70,80].map(l=>({type:t,prof:p,len:l,n:1}))))})");
  const its=big.sheets.flatMap(s=>s.items);
  ok(its.length===30&&!big.too.length&&layoutOK(big,run('ORDER_DEFAULT')),`раскладка 30 вариантов ручек: все на ${big.sheets.length} лист., не внахлёст, не за краем`);
  ok(its.every(it=>!it.tr.f&&run(`areaS(${JSON.stringify(it.pts)})`)>0),'раскладка: ручки только поворачиваются, не зеркалятся (A осталась A: обход контура тот же)');
  ok(its.every(it=>it.engr.length&&it.engr.every(z=>c.inPoly([z[0],z[1]],it.pts)&&c.inPoly([z[2],z[3]],it.pts))),'раскладка: гравировка едет вместе с ручкой, внутри контура на листе');}

/* ---------- заказ ---------- */
ok(run("(o=>o.plates===0&&o.ears===0)(normOrder({...ORDER_DEFAULT,plates:-3,ears:''}))"),'заказ: отрицательное и пустое количество → 0');
ok(run("(o=>o.sw===1250&&o.sl===2500)(normOrder({...ORDER_DEFAULT,sheet:'own',sw:'',sl:'abc'}))"),'заказ: свой лист с пустой шириной → прошлое значение, не NaN');
ok(run("(o=>o.handles.length===1&&o.handles[0].n===5)(normOrder({...ORDER_DEFAULT,handles:[{type:'A',prof:3,len:70,n:2},{type:'A',prof:3,len:70,n:3}]}))"),'заказ: две строки A3-70 × 2 и × 3 → одна × 5');
ok(run("(P=>P.length===3&&P[0].part.name==='П'&&P[0].n===4&&P[1].part.name==='A1-60'&&P[2].part.name==='B1-60'&&!P[1].flip&&!P[2].flip&&P[0].flip)(orderParts(ORDER_DEFAULT))"),'заказ по умолчанию: П × 4, A1-60 × 1, B1-60 × 1; ручки flip:false');
ok(run("orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,handles:[{type:'A',prof:1,len:60,n:2},{type:'B',prof:1,len:60,n:1}]})"),'заказ: ключ меняется от числа ручек');
ok(run("orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,plates:5})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,t:4})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,gap:6})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,margin:12})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,sheet:'1500x3000'})"),'заказ: ключ меняется от количества, металла, зазора, отступа, листа');

/* ---------- раскладка ---------- */
{const o=run('ORDER_DEFAULT'),res=run('R0=runOrder(ORDER_DEFAULT)');
  ok(res.sheets.length===1&&res.sheets[0].items.length===6&&!res.too.length,'раскладка по умолчанию: 4 пластины + A1-60 + B1-60 на одном листе');
  ok(layoutOK(res,o),'раскладка по умолчанию: детали не внахлёст и не за краем с отступом');
  ok(res.stats.byKind['П']===4&&res.stats.byKind['A1-60']===1&&res.stats.byKind['B1-60']===1&&res.stats.pierces===4*6+2*5&&res.stats.mass>0&&res.stats.cutLen>0,`цифры: П × 4, A1-60 × 1, B1-60 × 1, врезок 34, масса ${res.stats.mass.toFixed(2)} кг, рез ${(res.stats.cutLen/1000).toFixed(2)} м`);
  const m1=run("(4*partArea(platePart())+partArea(handlePart('A',1,60))+partArea(handlePart('B',1,60)))*5*1e-9*7850");ok(near(res.stats.mass,m1,1e-9),'цифры: масса = площадь металла × 5 мм × 7850');}
{const o=run("O40={...ORDER_DEFAULT,plates:40,handles:[]}"),res=run('runOrder(O40)');
  ok(res.sheets.reduce((a,s)=>a+s.items.length,0)===40&&!res.too.length&&layoutOK(res,o),`раскладка 40 пластин: все на ${res.sheets.length} лист., не внахлёст, не за краем`);
  ok(res.sheets.some(s=>s.items.some(it=>it.tr.f)),'раскладка: пластину можно зеркалить (хотя бы одна зеркальная)');}
ok(run("(r=>r.empty&&r.sheets.length===0)(runOrder({...ORDER_DEFAULT,plates:0,handles:[]}))"),'пустой заказ: листов 0, «Нечего резать»');
ok(run("(r=>r.too.length===1&&r.too[0]==='П'&&r.sheets.length===0)(runOrder({...ORDER_DEFAULT,sheet:'own',sw:300,sl:300,plates:1,handles:[]}))"),'деталь больше листа: в too, остальное не падает');

/* ---------- DXF ---------- */
{const d=run('D0=orderDxf(R0,ORDER_DEFAULT)');
  ok(d.startsWith('0\r\nSECTION'),'DXF: начинается с 0 / SECTION');
  ok(/\r\n2\r\nSHEET\r\n/.test(d)&&/\r\n2\r\nCUT\r\n/.test(d)&&/\r\n2\r\nENGRAVE\r\n/.test(d),'DXF: слои SHEET, CUT и ENGRAVE объявлены');
  ok(!/\r\n0\r\nTEXT\r\n/.test(d)&&!/MARK/.test(d),'DXF: подписей деталей нет (ни TEXT, ни слоя MARK)');
  ok((d.split('ENTITIES')[1].match(/LINE\r\n8\r\nENGRAVE/g)||[]).length===2*run("handlePart('A',1,60).engr.length"),'DXF: гравировка обеих ручек — LINE на слое ENGRAVE');
  ok(!/NaN|undefined|Infinity/.test(d),'DXF: без NaN');
  const ents=d.split('ENTITIES')[1],cutPoly=(ents.match(/POLYLINE\r\n8\r\nCUT/g)||[]).length,circ=(ents.match(/CIRCLE\r\n8\r\nCUT/g)||[]).length,sheet=(ents.match(/POLYLINE\r\n8\r\nSHEET/g)||[]).length;
  ok(cutPoly===6&&circ===28&&sheet===1,`DXF: контуров CUT = деталям (${cutPoly}), CIRCLE = отверстиям (${circ}), лист 1`);
  ok(d.trim().endsWith('EOF'),'DXF: кончается EOF');
  ok(run("dxfName({t:5},new Date(2026,10,25))")==='drovokol-5mm-2026-11-25.dxf','DXF: имя drovokol-5mm-<дата>.dxf');}

/* ---------- ухо к стене ---------- */
{const e=run('earPart()'),[x0,y0,x1,y1]=bbox(e.pts);
  ok(near(x1-x0,120,1e-9)&&near(y1-y0,40,1e-9),`ухо: габарит 120 × 40 (${x1-x0} × ${y1-y0})`);
  ok(e.holes.length===2&&e.holes.every(h=>h[2]===10.5&&near(h[1],20))&&near(e.holes[0][0],20)&&near(e.holes[1][0],100)&&near(e.holes[1][0]-e.holes[0][0],80),'ухо: два отв. Ø10.5 в центрах полукругов, между ними 80');
  const arcL=e.pts.filter(q=>q[0]<20-1e-6),arcR=e.pts.filter(q=>q[0]>100+1e-6);
  ok(arcL.length>=30&&arcR.length>=30&&arcL.every(q=>near(Math.hypot(q[0]-20,q[1]-20),20,1e-9))&&arcR.every(q=>near(Math.hypot(q[0]-100,q[1]-20),20,1e-9)),'ухо: концы — полукруги R20');
  ok(simple(e.pts)&&run('areaS(earPart().pts)')>0&&holesIn(e,3),'ухо: контур замкнут, без самопересечений, отверстия внутри ≥ 3 мм (плоское, без гиба — одна деталь)');
  ok(run("(P=>P.length===4&&P[3].part.name==='У'&&P[3].n===4&&P[3].flip===true)(orderParts({...ORDER_DEFAULT,ears:4}))"),'заказ: уши в деталях, раскладка может их зеркалить (flip:true), пластины тоже');
  const o=run("OE={...ORDER_DEFAULT,ears:20}"),res=run('RE=runOrder(OE)');
  ok(res.stats.byKind['У']===20&&!res.too.length&&layoutOK(res,o),`раскладка с 20 ушами: все на листах (${res.sheets.length} л.), не внахлёст, не за краем`);
  const d=run('orderDxf(RE,OE)'),ents=d.split('ENTITIES')[1];
  ok((ents.match(/POLYLINE\r\n8\r\nCUT/g)||[]).length===26&&(ents.match(/CIRCLE\r\n8\r\nCUT/g)||[]).length===28+40,'DXF с ушами: контуров 26, отверстий 68');}

/* ---------- «Что купить» ---------- */
{const L=run('buyList(ORDER_DEFAULT)'),f=re=>L.filter(r=>re.test(r.name)),n=re=>f(re).reduce((a,r)=>a+r.n,0);
  ok(f(/Труба/).length===1&&f(/Труба/)[0].size==='200 мм'&&f(/Труба/)[0].n===2,'«Что купить» по умолчанию: труба 200 × 2');
  ok(n(/M12/)===2&&n(/M6/)===6&&n(/Болт M10/)===4&&n(/Анкер/)===0,'«Что купить» по умолчанию: M12 × 2, M6 × 6, M10 × 4, анкеров 0');
  const B=run("buyList({...ORDER_DEFAULT,plates:5,ears:3,handles:[{type:'A',prof:3,len:70,n:2},{type:'B',prof:4,len:70,n:1},{type:'B',prof:1,len:80,n:1}]})"),g=re=>B.filter(r=>re.test(r.name));
  ok(g(/Труба/).map(r=>r.size+'×'+r.n).join()==='320 мм×2,330 мм×1,400 мм×1','«Что купить»: трубы по длинам хвостовиков (A3-70 ×2 → 320, B4-70 → 330, B1-80 → 400)');
  ok(g(/Болт M10/)[0].n===8&&g(/M12/)[0].n===4&&g(/M6/)[0].n===12&&g(/Анкер/)[0].n===6,'«Что купить»: 5 пластин → M10 × 8 (вверх до 4), 4 ручки → M12 × 4, M6 × 12, 3 уха → анкеров 6');
  ok(run("buyList({...ORDER_DEFAULT,plates:0,ears:0,handles:[]}).length")===0,'«Что купить»: пустой заказ — пусто');
  ok(!/Труба|Болт|Анкер/.test(run('orderDxf(R0,ORDER_DEFAULT)')),'DXF: покупного нет');}

console.log(bad?`\n${bad} FAIL`:'\nвсё ok');process.exit(bad?1:0);
