// режим «оригинал для обводки» (#175, план docs/superpowers/plans/2026-11-25-shepherd7-workshop.md): node --test shepherd-v6j3w/tools/ow-core.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,Math,Float32Array,Uint32Array,Int32Array};vm.createContext(c);['tlines','markup','ow-core'].forEach(f=>vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),c));   // #176: tlClosest (tlines), mkPen (markup) — как на странице
const run=s=>vm.runInContext(s,c);

// перебор всех треугольников — эталон для луча по сетке (двусторонний, ближайший при t > 0)
function brute(V,F,o,d){let best=null;for(let t=0;t<F.length;t+=3){const a=F[t]*3,b=F[t+1]*3,q=F[t+2]*3,
    e1=[V[b]-V[a],V[b+1]-V[a+1],V[b+2]-V[a+2]],e2=[V[q]-V[a],V[q+1]-V[a+1],V[q+2]-V[a+2]],
    p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)continue;
    const s=[o[0]-V[a],o[1]-V[a+1],o[2]-V[a+2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])/det;if(u<0||u>1)continue;
    const qq=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*qq[0]+d[1]*qq[1]+d[2]*qq[2])/det;if(v<0||u+v>1)continue;
    const tt=(e2[0]*qq[0]+e2[1]*qq[1]+e2[2]*qq[2])/det;if(tt>1e-9&&(!best||tt<best.t))best={t:tt,tri:t/3};}return best;}

test('owRay: две параллельные плиты — сверху попадает в верхнюю, снизу — в нижнюю, мимо — null',()=>{
  c.V=new Float32Array([0,0,0, 100,0,0, 0,100,0,  0,0,50, 100,0,50, 0,100,50]);c.F=new Uint32Array([0,1,2,3,4,5]);run('G=owGrid(V,F)');
  const top=run('owRay(G,[20,20,100],[0,0,-1])'),bot=run('owRay(G,[20,20,-100],[0,0,1])');
  assert.strictEqual(top.tri,1);assert.ok(Math.abs(top.t-50)<1e-6);assert.strictEqual(bot.tri,0);assert.ok(Math.abs(bot.t-100)<1e-6);
  assert.strictEqual(run('owRay(G,[90,90,100],[0,0,-1])'),null,'за гипотенузой — мимо');assert.strictEqual(run('owRay(G,[20,20,100],[0,0,1])'),null,'смотрит от плит — мимо');});

test('owRay совпадает с перебором всех треугольников: 3000 случайных треугольников, 300 лучей (снаружи и изнутри габарита)',()=>{
  let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,N=3000,V=new Float32Array(N*9),F=new Uint32Array(N*3);
  for(let i=0;i<N;i++){const cx=rnd()*800-400,cy=rnd()*1000,cz=rnd()*600-300;for(let k=0;k<3;k++){V[i*9+k*3]=cx+rnd()*40-20;V[i*9+k*3+1]=cy+rnd()*40-20;V[i*9+k*3+2]=cz+rnd()*40-20;F[i*3+k]=i*3+k;}}
  c.V=V;c.F=F;run('G=owGrid(V,F)');let hits=0;
  for(let r=0;r<300;r++){const inside=r%3===0,o=inside?[rnd()*600-300,rnd()*800+100,rnd()*400-200]:[rnd()*3000-1500,rnd()*3000-1000,2000+rnd()*500],
      tg=[rnd()*800-400,rnd()*1000,rnd()*600-300],d0=[tg[0]-o[0],tg[1]-o[1],tg[2]-o[2]],l=Math.hypot(...d0),d=d0.map(x=>x/l);
    c.o=o;c.d=d;const g=run('owRay(G,o,d)'),b=brute(V,F,o,d);
    if(!b){assert.strictEqual(g,null,'луч '+r);continue;}hits++;assert.ok(g,'луч '+r+': перебор попал, сетка — нет');assert.ok(Math.abs(g.t-b.t)<1e-3,`луч ${r}: t ${g.t} ≠ ${b.t}`);}
  assert.ok(hits>100,'попаданий достаточно для проверки: '+hits);});

// #176: перо соскочило за край силуэта — скачок между соседними точками больше 20 мм рвёт штрих на два (а не тянет хорду через воздух)
test('owSplit: скачок 35 мм посередине — 2 куска; без скачков — 1; точки ровно через 20 мм — 1',()=>{
  c.A=[[0,0,0],[1,0,0],[2,0,0],[37,0,0],[38,0,0],[39,0,0]];const a=JSON.parse(JSON.stringify(run('owSplit(A)')));
  assert.deepStrictEqual(a,[[[0,0,0],[1,0,0],[2,0,0]],[[37,0,0],[38,0,0],[39,0,0]]]);
  assert.strictEqual(run('owSplit([[0,0,0],[5,0,0],[10,3,0],[15,3,4]])').length,1);
  assert.strictEqual(run('owSplit([[0,0,0],[20,0,0],[40,0,0],[40,20,0]])').length,1,'ровно 20 мм — не скачок');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(run('owSplit([])'))),[]);});

// #176: свободные концы — концы линий, ни к чему не прицепленные (дальше 6 мм от другой линии и от дальней части своей) — красные точки
const ends=mk=>{c.MK=mk;return JSON.parse(JSON.stringify(run('owFreeEnds(MK)')));};
test('owFreeEnds: две параллельные линии без перемычек → 4 конца',()=>{
  const e=ends([{k:'line',pts:[[0,0,0],[100,0,0]]},{k:'pen',pts:[[0,30,0],[50,31,0],[100,30,0]]}]);
  assert.strictEqual(e.length,4);assert.deepStrictEqual(e.map(p=>p.join()).sort(),['0,0,0','0,30,0','100,0,0','100,30,0']);});
test('owFreeEnds: прямоугольник из 4 отдельных линий со щелями 3 мм → 0',()=>{
  assert.deepStrictEqual(ends([{k:'line',pts:[[0,0,0],[97,0,0]]},{k:'line',pts:[[100,3,0],[100,57,0]]},{k:'line',pts:[[97,60,0],[3,60,0]]},{k:'line',pts:[[0,57,0],[0,3,0]]}]),[]);});
test('owFreeEnds: замкнутая — без концов; зачёркивание концов не даёт и линию не цепляет',()=>{
  assert.deepStrictEqual(ends([{k:'pen',pts:[[0,0,0],[50,0,0],[50,50,0],[0,50,0]],closed:true}]),[]);
  assert.deepStrictEqual(ends([{k:'line',pts:[[0,0,0],[100,0,0]]},{k:'cross',pts:[[-2,-10,0],[-2,10,0]]}]).length,2,'зачёркивание у конца линию не прицепляет');
  assert.deepStrictEqual(ends([{k:'cross',pts:[[0,0,0],[10,10,0]]}]),[]);});
test('owFreeEnds: конец в 8 мм от другой линии — свободный; в 5 мм от середины другой (буква Т) — прицеплен',()=>{
  const e=ends([{k:'line',pts:[[0,0,0],[100,0,0]]},{k:'line',pts:[[50,8,0],[50,80,0]]}]);
  assert.ok(e.some(p=>p.join()==='50,8,0'),'8 мм — свободный');
  const t=ends([{k:'line',pts:[[0,0,0],[100,0,0]]},{k:'line',pts:[[50,5,0],[50,80,0]]}]);
  assert.ok(!t.some(p=>p.join()==='50,5,0'),'5 мм от середины длинного отрезка — прицеплен');assert.strictEqual(t.length,3);});
test('owFreeEnds: свои соседние точки конец не прицепляют, а петля к своему телу — прицепляет',()=>{
  assert.strictEqual(ends([{k:'pen',pts:Array.from({length:50},(_,i)=>[i,0,0])}]).length,2,'прямая из частых точек — оба конца свободны');
  // «6»: хвост заходит к началу петли, но концы дальше 6 мм (не closed) — конец у тела своей линии
  const six=[[0,100,0],[0,60,0],[0,20,0],[0,0,0],[30,0,0],[30,30,0],[3,30,0]];
  const e=ends([{k:'pen',pts:six}]);assert.deepStrictEqual(e.map(p=>p.join()),['0,100,0'],'хвост «6» прицеплен к своему телу');});
// скорость — не в песочнице vm (там каждое Math.* идёт через перехват глобального объекта, ×20), а обычной функцией, как в браузере
test('owFreeEnds: 1000 штрихов по 500 точек — быстро (≤ 150 мс; в браузере ~60)',()=>{const M={};new Function('M',fs.readFileSync(__dirname+'/../js/ow-core.js','utf8')+';M.f=owFreeEnds;')(M);
  const mk=[];for(let s=0;s<1000;s++){const y=s*10,pts=[];for(let i=0;i<500;i++)pts.push([i*.8,y+Math.sin(i/9)*2,(s%7)*3]);mk.push({k:'pen',pts});}
  M.f(mk);const t=Date.now(),n=M.f(mk).length,ms=Date.now()-t;assert.strictEqual(n,2000);assert.ok(ms<150,ms+' мс');});

// #176: точки разметки — на поверхности модели. Сетки для проверок: квадрат на z = 0; куб 0…100 и шар R = 100 — треугольники наружу (как у модели Meshy: замкнута, обход согласован)
function mesh(tris){const V=new Float32Array(tris.length*9),F=new Uint32Array(tris.length*3);tris.forEach((t,i)=>t.forEach((p,k)=>{V.set(p,i*9+k*3);F[i*3+k]=i*3+k;}));return {V,F};}
const outward=(t,o)=>{const e1=t[1].map((x,k)=>x-t[0][k]),e2=t[2].map((x,k)=>x-t[0][k]),n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],c=t[0].map((x,k)=>x-o[k]);return n[0]*c[0]+n[1]*c[1]+n[2]*c[2]<0?[t[0],t[2],t[1]]:t;};
const PLANE=mesh([[[0,0,0],[100,0,0],[100,100,0]],[[0,0,0],[100,100,0],[0,100,0]]]);
const CUBE=mesh((()=>{const q=[[[0,100,0],[0,100,100],[100,100,100],[100,100,0]],[[0,0,0],[100,0,0],[100,0,100],[0,0,100]],[[0,0,100],[100,0,100],[100,100,100],[0,100,100]],[[0,0,0],[0,100,0],[100,100,0],[100,0,0]],[[100,0,0],[100,100,0],[100,100,100],[100,0,100]],[[0,0,0],[0,0,100],[0,100,100],[0,100,0]]];
  const T=[];q.forEach(Q=>{for(let i=0;i<4;i++)for(let j=0;j<4;j++){const L=(a,b,u,v)=>a.map((x,k)=>x+(b[k]-x)*u),P=(u,v)=>L(L(Q[0],Q[1],u),L(Q[3],Q[2],u),v);   // каждая грань — 4×4 клетки
      const a=P(i/4,j/4),b=P((i+1)/4,j/4),c2=P((i+1)/4,(j+1)/4),d=P(i/4,(j+1)/4);T.push(outward([a,b,c2],[50,50,50]),outward([a,c2,d],[50,50,50]));}});return T;})());
const SPHERE=mesh((()=>{const T=[],N=96,M=48,P=(i,j)=>{const th=j/M*Math.PI,ph=i/N*2*Math.PI;return [100*Math.sin(th)*Math.cos(ph),100*Math.cos(th),100*Math.sin(th)*Math.sin(ph)];};
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=P(i,j),b=P(i+1,j),q=P(i+1,j+1),d=P(i,j+1);if(j)T.push(outward([a,b,q],[0,0,0]));if(j<M-1)T.push(outward([a,q,d],[0,0,0]));}return T;})());
const grid=m=>{c.V=m.V;c.F=m.F;run('G=owGrid(V,F)');};
test('owNear: ближайшая точка модели в радиусе r, нормаль грани наружу; дальше r — null',()=>{grid(PLANE);
  const h=J(run('owNear(G,[30,40,5],8)'));assert.deepStrictEqual(h.p.map(x=>+x.toFixed(6)),[30,40,0]);assert.ok(Math.abs(h.d-5)<1e-9);assert.deepStrictEqual(h.n.map(x=>+x.toFixed(6)),[0,0,1]);
  assert.strictEqual(run('owNear(G,[30,40,9],8)'),null);assert.deepStrictEqual(J(run('owNear(G,[-3,50,0],8)')).p.map(x=>+x.toFixed(6)),[0,50,0],'за краем — на край');
  assert.strictEqual(run('owNear(G,[500,500,500],8)'),null,'далеко за габаритом');
  grid(SPHERE);const s=J(run('owNear(G,[0,0,112],15)'));assert.ok(Math.abs(Math.hypot(...s.p)-100)<.2&&s.n[2]>.99,'шар: точка на сфере, нормаль наружу');});
const J=x=>JSON.parse(JSON.stringify(x));
test('owStrokes: путь пера — скачок рвёт, сглаженные точки лежат на поверхности (≤ 1 мм от шара), куски короче 3 точек отброшены',()=>{grid(SPHERE);
  // по экватору шара с дрожью ±1,5 мм поперёк, шаг 1 мм; посередине перо соскочило: две точки на 40 мм в стороне (за краем силуэта), потом дальше по экватору
  const eq=(a,w)=>{const r=100+w;return [r*Math.cos(a),w*.3,r*Math.sin(a)];},raw=[];for(let i=0;i<=60;i++)raw.push(eq(i/100,i%2?1.5:-1.5));raw.push([150,40,0],[151,41,0]);for(let i=61;i<=120;i++)raw.push(eq(i/100,i%2?1.5:-1.5));
  c.RAW=raw;const S=J(run('owStrokes(RAW,G,null,true)'));assert.strictEqual(S.length,2,'два куска экватора; две точки «в воздухе» — не штрих');
  S.forEach(s=>{assert.strictEqual(s.k,'pen');s.pts.forEach(p=>assert.ok(Math.abs(Math.hypot(...p)-100)<=1,'от шара '+(Math.hypot(...p)-100).toFixed(3)));});});
test('owStrokes: магнит тянет конец к своей линии (было 4 мм — стало < 0,5), без магнита — как вёл',()=>{grid(PLANE);
  run('SEG=new Float32Array([10,50,0, 90,50,0])');c.RAW=Array.from({length:41},(_,i)=>[50,10+i,0]).map(p=>p[1]>46?[50,46,0]:p);   // ведут вверх к линии y = 50 и останавливаются в 4 мм
  const end=s=>s.pts[s.pts.length-1][1];assert.ok(50-end(J(run('owStrokes(RAW,G,SEG,true)'))[0])<.5);assert.ok(50-end(J(run('owStrokes(RAW,G,SEG,false)'))[0])>3.5);});
test('owDrape: прямая между точками на соседних гранях куба — по поверхности (поднята на 0,6 мм наружу), не через угол внутрь; нормали — к каждой точке',()=>{grid(CUBE);
  const S=run("owDrape(G,[{k:'line',pts:[[50,100,80],[50,80,100]]}])");assert.ok(S.length>=12&&S.nrm.length===S.length);
  for(let i=0;i<S.length;i+=3){const top=Math.abs(S[i+1]-100.6)<1e-3,front=Math.abs(S[i+2]-100.6)<1e-3;assert.ok(top||front,S[i+1]+','+S[i+2]);
    const n=[S.nrm[i],S.nrm[i+1],S.nrm[i+2]];assert.ok(top?n[1]>.99:n[2]>.99,'нормаль наружу');}
  assert.strictEqual(run("owDrape(G,[{k:'line',pts:[[50,300,50],[60,300,50]]}])").length,0,'в воздухе (дальше 40 мм) — не рисуем');
  const R=run("owDrape(G,[{k:'pen',pts:[[20,100,20],[80,100,20],[80,100,80],[20,100,80]],closed:true}])");let back=0;for(let i=0;i<R.length;i+=3){if(Math.abs(R[i]-20)<1e-3&&R[i+2]<80&&R[i+2]>20)back++;}
  assert.ok(back>0,'замкнутая — со стороной от последней точки к первой');});
test('owDrape: хорда «Линии» над щелью между двумя пластинами — точки ложатся на разные пластины, но отрезка через воздух между ними нет',()=>{
  // две пластины: y 0…45 на z = 0 и y 55…100 на z = 20; линия по кликам — с нижней на верхнюю
  grid(mesh([[[0,0,0],[100,0,0],[100,45,0]],[[0,0,0],[100,45,0],[0,45,0]],[[0,55,20],[100,55,20],[100,100,20]],[[0,55,20],[100,100,20],[0,100,20]]]));
  const S=run("owDrape(G,[{k:'line',pts:[[50,10,0],[50,90,20]]}])");let longest=0;for(let i=0;i<S.length;i+=6)longest=Math.max(longest,Math.hypot(S[i+3]-S[i],S[i+4]-S[i+1],S[i+5]-S[i+2]));
  assert.ok(S.length>0,'по пластинам — рисует');assert.ok(longest<=8,'самый длинный отрезок '+longest.toFixed(1)+' мм');});

// #177: облако швов для магнита — точки поверхности под светлыми пикселями текстуры (швы сваренной модели Meshy — белые). Картинка — как getImageData: RGBA, строка 0 — верх.
// uv — как у текстуры three.js (flipY): v = 1 — верхняя строка картинки. Треугольник (0,0,10)-(100,0,10)-(0,100,30), uv = (x, y) / 100: точка uv (u, v) — (100u, 100v, 10 + 20v)
const img=(W,H,lit)=>{const d=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const g=lit(x,y),o=(y*W+x)*4;d[o]=d[o+1]=d[o+2]=g;d[o+3]=255;}return {W,H,data:d};};
const TRI={V:new Float32Array([0,0,10, 100,0,10, 0,100,30]),T:new Float32Array([0,0, 1,0, 0,1]),F:new Uint32Array([0,1,2])};
const cloud=(px,...a)=>{c.TV=TRI.V;c.TT=TRI.T;c.TF=TRI.F;c.PX=px;c.A=a;const r=run('owSeamCloud(TV,TT,TF,PX,...A)');assert.ok(r instanceof c.Float32Array&&r.length%3===0,'Float32Array по 3 числа');
  const P=[];for(let i=0;i<r.length;i+=3)P.push([r[i],r[i+1],r[i+2]].map(x=>+x.toFixed(4)));return P;};
test('owSeamCloud: белый столбец x = 5 картинки 10×10 — точки только с x 50…60 мм и только внутри треугольника (5 пикселей из 10, диагональ — внутри)',()=>{
  const P=cloud(img(10,10,x=>x===5?255:60));assert.strictEqual(P.length,5,'в треугольнике (u + v ≤ 1) — нижние 5 пикселей столбца');
  P.forEach(p=>{assert.ok(p[0]>=50&&p[0]<=60,'x '+p[0]);assert.ok(p[1]>=0&&p[0]+p[1]<=100,'внутри треугольника: '+p);assert.ok(Math.abs(p[2]-(10+p[1]*.2))<1e-3,'на плоскости треугольника: '+p);});
  assert.deepStrictEqual(P.map(p=>p[1]).sort((a,b)=>a-b),[5,15,25,35,45]);});
test('owSeamCloud: верхняя строка картинки — v ≈ 1 (как текстура three.js): пиксель (0, 1) → точка (5, 85, 27)',()=>{
  assert.deepStrictEqual(cloud(img(10,10,(x,y)=>x===0&&y===1?255:0)),[[5,85,27]]);});
test('owSeamCloud: чёрная картинка — пусто; порог по max(r, g, b): 0,70 — не шов, 0,81 — шов; шаг 2 — каждый второй пиксель по обеим осям',()=>{
  assert.deepStrictEqual(cloud(img(10,10,()=>0)),[]);assert.deepStrictEqual(cloud(img(10,10,()=>179)),[],'серый 0,70 — не шов');
  const all=cloud(img(10,10,()=>207));assert.strictEqual(all.length,55,'серый 0,81 — шов: все 55 пикселей в треугольнике (u + v ≤ 1, диагональ — внутри)');
  const red=img(10,10,()=>0);for(let i=0;i<red.data.length;i+=4){red.data[i]=230;red.data[i+3]=255;}assert.strictEqual(cloud(red).length,55,'яркость — max(r, g, b)');
  assert.strictEqual(cloud(img(10,10,()=>207),.9).length,0,'порог 0,9');assert.strictEqual(cloud(img(10,10,()=>255),.8,2).length,15,'шаг 2: пиксели 0, 2, 4, 6, 8 по обеим осям, в треугольнике — 15');});
// #177: магнит к шву и к своим линиям сразу — облако швов (~190 тыс. точек) с готовой сеткой + свои штрихи; после каждого штриха сетку облака не пересобирать.
// owSnapJoin(A, B) магнитит так же, как одна общая пара отрезков (mkSnap строит сетку сам), и не портит сетки A и B
test('owSnapJoin: mkSnap по склейке = mkSnap по простому склеенному массиву; сетка облака не тронута',()=>{let s=11;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const A=[],B=[];for(let i=0;i<2000;i++){const p=[rnd()*200,rnd()*200,rnd()*20];A.push(...p,...p);}for(let i=0;i<60;i++){const p=[rnd()*200,rnd()*200,rnd()*20];B.push(...p,p[0]+rnd()*30-15,p[1]+rnd()*30-15,p[2]);}
  c.SA=new Float32Array(A);c.SB=new Float32Array(B);c.SP=new Float32Array([...A,...B]);run('JA=owSnapJoin(SA,SB)');assert.strictEqual(run('JA.length'),A.length+B.length);
  for(let i=0;i<400;i++){c.p=[rnd()*210-5,rnd()*210-5,rnd()*24-2];const a=J(run('mkSnap(p,JA,true)')),b=J(run('mkSnap(p,SP,true)'));assert.deepStrictEqual(a,b,'точка '+i);
    const only=J(run('mkSnap(p,SA,true)')),fresh=J(run('mkSnap(p,new Float32Array(SA),true)'));assert.deepStrictEqual(only,fresh,'облако без своих линий — как было');}
  assert.strictEqual(run('owSnapJoin(SA,new Float32Array(0))').length,A.length,'своих линий нет — только облако');});
// #177: калька «Текстура» издалека — швы не должны пропадать: маска швов (светлота → 0…255 по порогу) и уровни уменьшения по максимуму 2×2, а не среднему (среднее гасит тонкий шов ниже порога).
// Строки уровней — снизу вверх, как ждёт WebGL у текстуры из массива (у картинки строка 0 — верх)
test('owSeamMips: белый пиксель — 255, серый посередине порога — ~половина; строки снизу вверх; уровни — максимум 2×2 до 1×1',()=>{
  const px=img(4,4,(x,y)=>x===1&&y===0?255:x===2&&y===3?185:40);c.PX=px;const L=J(run('owSeamMips(PX,[0.65,0.80]).map(l=>({W:l.W,H:l.H,d:Array.from(l.data)}))'));
  assert.deepStrictEqual(L.map(l=>[l.W,l.H]),[[4,4],[2,2],[1,1]]);
  const at=(l,x,yTop)=>l.d[(l.H-1-yTop)*l.W+x];assert.strictEqual(at(L[0],1,0),255,'белый (1, 0) — верхняя строка картинки = последняя строка уровня');
  assert.ok(Math.abs(at(L[0],2,3)-129)<=1,'серый 0,725 — '+at(L[0],2,3));assert.strictEqual(L[0].d.filter(v=>v).length,2,'остальное — 0 (гипс)');
  assert.deepStrictEqual(L[1].d,[0,at(L[0],2,3),255,0],'уровень 2×2: низ-лево 0, низ-право — серый, верх-лево — белый');assert.deepStrictEqual(L[2].d,[255]);
  c.PX=img(4,2,()=>0);assert.deepStrictEqual(J(run('owSeamMips(PX,[0.65,0.80]).map(l=>[l.W,l.H])')),[[4,2],[2,1],[1,1]],'не квадрат — до 1×1');});
// #177: облако швов → отрезки нулевой длины для магнита (одна функция и на странице, и в smoke) с готовой сеткой: магнит по ним = mkSnap по тем же отрезкам без готовой сетки
test('owSeamSeg: точка облака — отрезок нулевой длины; сетка готова и магнитит как mkSnap без неё',()=>{
  c.CL=new Float32Array([1,2,3, 10,20,30, -5,0,7]);const s=run('SS=owSeamSeg(CL)');assert.deepStrictEqual(Array.from(s),[1,2,3,1,2,3, 10,20,30,10,20,30, -5,0,7,-5,0,7]);assert.ok(run('!!SS._g'),'сетка уже построена');
  for(const p of [[2,2,3],[9,18,31],[-4,1,5],[50,50,50]]){c.p=p;assert.deepStrictEqual(J(run('mkSnap(p,SS,true)')),J(run('mkSnap(p,new Float32Array(SS),true)')),'точка '+p);}
  assert.strictEqual(run('owSeamSeg(new Float32Array(0)).length'),0);});
/* ---------- #178 фото-кальки: точка модели (кадр фигуры, мм) → пиксель фото; сторона, отвёрнутая от камеры фото, — гипс ---------- */
// матрица «вид спереди, 1000 мм на всю картинку, центр в (0, 500)»: u = x/1000 + 0,5; v = 1 − y/1000 (v вниз, 0 — верх картинки); z не влияет
const FRONT=[0.001,0,0,0.5, 0,-0.001,0,1];
test('owPhotoUV: вид спереди — (0,500,0) → середина, (500,1000,0) → правый верх, z не меняет uv',()=>{c.M=FRONT;
  const uv=p=>{c.p=p;return run('owPhotoUV(M,p)');},near=(a,b)=>assert.ok(Math.abs(a[0]-b[0])<1e-12&&Math.abs(a[1]-b[1])<1e-12,a+' ≠ '+b);
  near(uv([0,500,0]),[0.5,0.5]);near(uv([500,1000,0]),[1,0]);near(uv([-500,0,0]),[0,1]);near(uv([120,340,-777]),uv([120,340,555]));});
// фото спереди: камера смотрит по −Z (стоит спереди, морда на +Z). Точка с нормалью к камере — фото; от камеры (нормаль · dir ≥ 0) — гипс; uv вне картинки — гипс
test('owPhotoPick: нормаль к камере — uv фото; отвёрнута или вбок (нормаль · dir ≥ 0) — null; вне картинки — null',()=>{
  c.PH={m:FRONT,dir:[0,0,-1],mirror:false};const pick=(p,n)=>{c.p=p;c.n=n;return run('owPhotoPick(PH,p,n)');};
  const a=pick([0,500,300],[0,0,1]);assert.ok(a&&Math.abs(a.uv[0]-.5)<1e-12&&Math.abs(a.uv[1]-.5)<1e-12&&a.mir===false,JSON.stringify(a));
  assert.strictEqual(pick([0,500,-300],[0,0,-1]),null,'спина при фото спереди — гипс');assert.strictEqual(pick([0,500,0],[1,0,0]),null,'бок (нормаль поперёк) — гипс');
  assert.strictEqual(pick([800,500,300],[0,0,1]),null,'за краем картинки — гипс');});
// фото сбоку: камера слева (x = −3 м) смотрит по +X, mirror — та же картинка зеркально на правый бок (x → −x); берётся сторона, что смотрит на камеру
const SIDE=[0,0,-0.001,0.5, 0,-0.001,0,1];   // u — по −z (морда +Z слева на картинке), v — вниз
test('owPhotoPick: бок с зеркалом — левый бок по себе, правый — зеркально, тот же пиксель; без зеркала правый — гипс; спереди-сзади — гипс',()=>{
  c.PH={m:SIDE,dir:[1,0,0],mirror:true};const pick=(p,n)=>{c.p=p;c.n=n;return run('owPhotoPick(PH,p,n)');};
  const L=pick([-150,400,100],[-1,0,0]),R=pick([150,400,100],[1,0,0]);
  assert.ok(L&&L.mir===false&&R&&R.mir===true,JSON.stringify([L,R]));assert.ok(Math.abs(L.uv[0]-R.uv[0])<1e-12&&Math.abs(L.uv[1]-R.uv[1])<1e-12,'зеркальные точки — один пиксель фото');
  assert.ok(Math.abs(L.uv[0]-.4)<1e-12&&Math.abs(L.uv[1]-.6)<1e-12,'uv '+L.uv);
  // наискось вперёд-вправо: прямо — от камеры, зеркально — к камере
  const D=pick([150,400,100],[0.6,0,0.8]);assert.ok(D&&D.mir===true,'наискось вправо — зеркально');assert.strictEqual(pick([0,400,500],[0,0,1]),null,'грудь (нормаль по Z) — гипс');
  c.PH={m:SIDE,dir:[1,0,0],mirror:false};assert.strictEqual(pick([150,400,100],[1,0,0]),null,'без зеркала правый бок — гипс');});
// #178 голова: у фото может быть второй слой — снимок головы крупно со своей матрицей (как виды head-* в project.js: общий подгон кладёт глаза фото ~25 мм ниже глаз модели);
// он светит только на точки в коробке головы (y ≥ y0 и z ≥ z0, кадр фигуры) — у бока для зеркальной стороны по зеркальной точке
test('owPhotoPick: слой головы — uv головы только в коробке головы; у зеркальной стороны — по зеркальной точке; без слоя — head = null',()=>{
  const HEAD={m:[0,0,-0.002,0.9, 0,-0.002,0,1.6],y0:600,z0:200};c.PH={m:SIDE,dir:[1,0,0],mirror:true,head:HEAD};const pick=(p,n)=>{c.p=p;c.n=n;return run('owPhotoPick(PH,p,n)');};
  const L=pick([-60,700,300],[-1,0,0]),R=pick([60,700,300],[1,0,0]),body=pick([-60,500,300],[-1,0,0]),back=pick([-60,700,100],[-1,0,0]);
  assert.ok(L.head&&Math.abs(L.head[0]-0.3)<1e-12&&Math.abs(L.head[1]-0.2)<1e-12,'голова (0,3; 0,2): '+JSON.stringify(L));
  assert.ok(R.mir&&R.head&&Math.abs(R.head[0]-L.head[0])<1e-12&&Math.abs(R.head[1]-L.head[1])<1e-12,'правая сторона — зеркально, тот же пиксель головы');
  assert.strictEqual(body.head,null,'ниже коробки — только общее фото');assert.strictEqual(back.head,null,'позади коробки (z < z0) — только общее фото');
  c.PH={m:SIDE,dir:[1,0,0],mirror:true};assert.strictEqual(pick([-60,700,300],[-1,0,0]).head,null,'без слоя головы');
  c.PH={m:SIDE,dir:[1,0,0],mirror:true,head:{...HEAD,m:[0,0,-0.002,2, 0,-0.002,0,1.6]}};assert.strictEqual(pick([-60,700,300],[-1,0,0]).head,null,'uv головы вне картинки — null');});
