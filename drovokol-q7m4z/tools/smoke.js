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

/* ---------- заказ ---------- */
ok(run("(o=>o.plates===0&&o.ears===0)(normOrder({...ORDER_DEFAULT,plates:-3,ears:''}))"),'заказ: отрицательное и пустое количество → 0');
ok(run("(o=>o.sw===1250&&o.sl===2500)(normOrder({...ORDER_DEFAULT,sheet:'own',sw:'',sl:'abc'}))"),'заказ: свой лист с пустой шириной → прошлое значение, не NaN');
ok(run("orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,plates:5})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,t:4})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,gap:6})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,margin:12})&&orderKey(ORDER_DEFAULT)!==orderKey({...ORDER_DEFAULT,sheet:'1500x3000'})"),'заказ: ключ меняется от количества, металла, зазора, отступа, листа');

/* ---------- раскладка ---------- */
// детали не внахлёст (зазор ≥ gap) и не за краем с отступом
const layoutOK=(res,o)=>{const [W,H]=run(`sheetWH(${JSON.stringify(o)})`);let good=true;
  res.sheets.forEach(s=>{s.items.forEach((a,i)=>{const [x0,y0,x1,y1]=bbox(a.pts);if(x0<o.margin-.01||y0<o.margin-.01||x1>W-o.margin+.01||y1>H-o.margin+.01)good=false;
    s.items.forEach((b,j)=>{if(j>i&&c.polyGap(a.pts,b.pts)<o.gap-.01)good=false;});
    if(!a.holes.every(h=>c.inPoly([h[0],h[1]],a.pts)))good=false;});});return good;};
{const o=run('ORDER_DEFAULT'),res=run('R0=runOrder(ORDER_DEFAULT)');
  ok(res.sheets.length===1&&res.sheets[0].items.length===4&&!res.too.length,'раскладка по умолчанию: 4 пластины на одном листе');
  ok(layoutOK(res,o),'раскладка по умолчанию: детали не внахлёст и не за краем с отступом');
  ok(res.stats.byKind['П']===4&&res.stats.pierces===4*6&&res.stats.mass>0&&res.stats.cutLen>0,`цифры: П × 4, врезок 24, масса ${res.stats.mass.toFixed(2)} кг, рез ${(res.stats.cutLen/1000).toFixed(2)} м`);
  const m1=run('partArea(platePart())')*5*1e-9*7850;ok(near(res.stats.mass,4*m1,1e-9),'цифры: масса = 4 × площадь металла × 5 мм × 7850');}
{const o=run("O40={...ORDER_DEFAULT,plates:40,gap:5,margin:10}"),res=run('runOrder(O40)');
  ok(res.sheets.reduce((a,s)=>a+s.items.length,0)===40&&!res.too.length&&layoutOK(res,o),`раскладка 40 пластин: все на ${res.sheets.length} лист., не внахлёст, не за краем`);
  ok(res.sheets.some(s=>s.items.some(it=>it.tr.f)),'раскладка: пластину можно зеркалить (хотя бы одна зеркальная)');}
ok(run("(r=>r.empty&&r.sheets.length===0)(runOrder({...ORDER_DEFAULT,plates:0}))"),'пустой заказ: листов 0, «Нечего резать»');
ok(run("(r=>r.too.length===1&&r.too[0]==='П'&&r.sheets.length===0)(runOrder({...ORDER_DEFAULT,sheet:'own',sw:300,sl:300,plates:1}))"),'деталь больше листа: в too, остальное не падает');

/* ---------- DXF ---------- */
{const d=run('D0=orderDxf(R0,ORDER_DEFAULT)');
  ok(d.startsWith('0\r\nSECTION'),'DXF: начинается с 0 / SECTION');
  ok(/\r\n2\r\nSHEET\r\n/.test(d)&&/\r\n2\r\nCUT\r\n/.test(d),'DXF: слои SHEET и CUT объявлены');
  ok(!/NaN|undefined|Infinity/.test(d),'DXF: без NaN');
  const ents=d.split('ENTITIES')[1],cutPoly=(ents.match(/POLYLINE\r\n8\r\nCUT/g)||[]).length,circ=(ents.match(/CIRCLE\r\n8\r\nCUT/g)||[]).length,sheet=(ents.match(/POLYLINE\r\n8\r\nSHEET/g)||[]).length;
  ok(cutPoly===4&&circ===20&&sheet===1,`DXF: контуров CUT = деталям (${cutPoly}), CIRCLE = отверстиям (${circ}), лист 1`);
  ok(d.trim().endsWith('EOF'),'DXF: кончается EOF');
  ok(run("dxfName({t:5},new Date(2026,10,25))")==='drovokol-5mm-2026-11-25.dxf','DXF: имя drovokol-5mm-<дата>.dxf');}

console.log(bad?`\n${bad} FAIL`:'\nвсё ok');process.exit(bad?1:0);
