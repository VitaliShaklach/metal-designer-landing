// фото-кальки (#178): сведение матрицы фото в tools/photo-fit.js — node --test shepherd-v6j3w/tools/photo-fit.test.js
// Рискованное место: ошибка в сведении (камера ∘ подгон ∘ кадр) тихо сдвигает фото. Ожидания — посчитанные руками примеры, а не тот же расчёт.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path'),zlib=require('zlib');
const PF=require('./photo-fit.js');
const near=(a,b,e=1e-9,s='')=>assert.ok(Math.abs(a-b)<=e,s+' '+a+' ≠ '+b);

// кадр фигуры — как fitMesh + xf (orig.js): высота модели → 600, центр по X, низ Y и зад Z → 0; потом p·s + d
test('frameOf: габарит x −1…3, y 2…6, z −5…−1 → K = 600/4 = 150, начало (1, 2, −5); s и d — из xf',()=>{
  const fr=PF.frameOf([[-1,2,-5],[3,6,-1],[0,4,-3]],{s:[2,3,4],d:[10,20,30]});
  near(fr.K,150);assert.deepStrictEqual(fr.c,[1,2,-5]);assert.deepStrictEqual(fr.s,[2,3,4]);assert.deepStrictEqual(fr.d,[10,20,30]);});

// камера «спереди» (смотрит по −Z), полуширина кадра 0,5, цель (0, 0,4, 0), снимок 2048; фото 1024 ровно вдвое (подгон по центрам пикселей: gx = ix/2 − 0,25);
// кадр K = 750, s = 2, начало (0, 0, −0,4), d = 0: точка фигуры (x, y, z) → OBJ (x/1500, y/1500, z/1500 − 0,4) → u = x/1500 + 0,5, v = 0,9 − y/1500
const CAM_F={px:2048,half:.5,target:[0,.4,0],position:[0,.4,3],up:[0,1,0],dir:[0,0,-1]},FIT_HALF=[.5,-.25,.5,-.25,0,0],FR={K:750,c:[0,0,-.4],s:[2,2,2],d:[0,0,0]};
test('photoMatrix: вид спереди, фото вдвое меньше снимка — (150, 600, 333) → (0,6; 0,5), (0, 0, 0) → (0,5; 0,9); z не влияет',()=>{
  const m=PF.photoMatrix(CAM_F,FIT_HALF,FR,1024,1024);assert.strictEqual(m.length,8);
  const uv=p=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7]];
  let a=uv([150,600,333]);near(a[0],.6,1e-9,'u');near(a[1],.5,1e-9,'v');a=uv([0,0,0]);near(a[0],.5,1e-9,'u0');near(a[1],.9,1e-9,'v0');near(m[2],0,1e-12,'u от z');near(m[6],0,1e-12,'v от z');});
// камера «сбоку» (стоит слева, смотрит по +X): ось кадра вправо — +Z (как three.js lookAt c up = y) — морда (+Z) справа на снимке; x не влияет
test('photoMatrix: вид сбоку — u растёт по +Z, v вниз по Y, от X не зависит; подгон со сдвигом на 100 px фото сдвигает u на 100/1024',()=>{
  const cam={...CAM_F,position:[-3,.4,0],dir:[1,0,0]},m=PF.photoMatrix(cam,FIT_HALF,FR,1024,1024),m2=PF.photoMatrix(cam,[.5,99.75,.5,-.25,0,0],FR,1024,1024);
  near(m[0],0,1e-12,'u от x');near(m[4],0,1e-12,'v от x');near(m[2],1/1500,1e-12,'u по z');near(m[5],-1/1500,1e-12,'v по y');
  near(m[2]*300+m[3],.5+(300/1500-.4)+0,1e-9,'u в z = 300');near(m2[3]-m[3],100/1024,1e-12,'сдвиг подгона');});
// перекос подгона (p[4], p[5]) и неравные s по осям: матрица = поэтапный путь (точка → OBJ → снимок → фото) в любых точках
test('photoMatrix: с перекосом и разными s по осям совпадает с поэтапным путём (камера → подгон) в 200 точках',()=>{
  const cam={px:2048,half:.51,target:[-.0002,.4,-.0001],position:[-.0002,.4,3],up:[0,1,0],dir:[0,0,-1]},fit=[.48,12.3,.51,-7.1,.013,-.008],fr={K:741.3,c:[-.0003,0,-.46],s:[1.69,1.6909,1.6911],d:[0,3.9,.52]};
  const m=PF.photoMatrix(cam,fit,fr,1024,900),C=PF.camera(cam),o=[0,0,0];let s=3;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<200;i++){const p=[(rnd()-.5)*400,rnd()*1000,rnd()*1200],q=p.map((x,k)=>(x-fr.d[k])/(fr.s[k]*fr.K)+fr.c[k]);C.proj(q[0],q[1],q[2],o);
    const ix=o[0]-.5,iy=o[1]-.5,gx=fit[0]*ix+fit[4]*iy+fit[1],gy=fit[5]*ix+fit[2]*iy+fit[3];
    near(m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],(gx+.5)/1024,1e-9,'u');near(m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],(gy+.5)/900,1e-9,'v');}});
test('dirOf: направление камеры в кадре фигуры — единичное; при равных s — то же, что в OBJ',()=>{
  const d=PF.dirOf({dir:[1,0,0]},FR),e=PF.dirOf({dir:[0,-.6,.8]},{...FR,s:[1,2,1]});assert.deepStrictEqual(d.map(x=>+x.toFixed(12)),[1,0,0]);
  near(Math.hypot(...e),1,1e-12);assert.ok(Math.abs(e[1])>.6,'растянутое по Y направление ближе к Y');});

// сквозная проверка сведения: силуэт модели через матрицу против силуэта фото (то, что видно на странице)
test('silIoU: квадрат uv 0,25…0,75 против такого же — 1; против сдвинутого на четверть — 1/3',()=>{
  const V=new Float32Array([250,250,0, 750,250,0, 750,750,0, 250,750,0]),F=new Uint32Array([0,1,2,0,2,3]),m=[.001,0,0,0, 0,.001,0,0],W=100,H=100,sq=(x0,y0)=>{const f=new Uint8Array(W*H);
    for(let y=y0;y<y0+50;y++)for(let x=x0;x<x0+50;x++)f[y*W+x]=1;return f;};
  near(PF.silIoU(V,F,m,sq(25,25),W,H),1,.02,'то же');near(PF.silIoU(V,F,m,sq(50,25),W,H),1/3,.02,'сдвиг');});
// фон фото — белое (мин. канал ≥ 235), связанное с краем; белый шов внутри собаки — не фон
test('bgMask: белая рамка — фон, белая точка внутри тёмного — не фон',()=>{const W=5,H=5,px=Buffer.alloc(W*H*3,255);
  for(let y=1;y<4;y++)for(let x=1;x<4;x++)px.fill(60,(y*W+x)*3,(y*W+x)*3+3);px.fill(250,(2*W+2)*3,(2*W+2)*3+3);
  const m=PF.bgMask({W,H,px});assert.strictEqual(m[0],1);assert.strictEqual(m[2*W+2],0,'шов внутри');assert.strictEqual(m[W+1],0);});
// PNG с прозрачностью (png.js пишет только RGB): цвет читается обратно png.js, альфа — та же
// png.js — из from-dev (локальная кухня, в git не идёт): на клоне без from-dev тест пропускается, а не падает (smoke гоняет все *.test.js в test:editor)
test('writePNGA: RGB читается обратно png.js, альфа на месте',{skip:!fs.existsSync(PF.PNG_JS)&&'нет from-dev/art/tools/plates/png.js'},()=>{const W=7,H=3,a=Buffer.alloc(W*H*4);for(let i=0;i<W*H;i++){a[i*4]=i*9;a[i*4+1]=255-i;a[i*4+2]=i*3;a[i*4+3]=i%2?255:0;}
  const f=path.join(os.tmpdir(),'photo-fit-test.png');PF.writePNGA(f,W,H,a);const {readPNG}=require(PF.PNG_JS),r=readPNG(f);assert.strictEqual(r.W,W);assert.strictEqual(r.H,H);
  for(let i=0;i<W*H;i++)for(let k=0;k<3;k++)assert.strictEqual(r.px[i*3+k],a[i*4+k]);
  assert.deepStrictEqual(Array.from(PF.readAlpha(f)),Array.from({length:W*H},(_,i)=>i%2?255:0));fs.unlinkSync(f);});
// коробка головы — пороги в кадре OBJ (как headz/heady в project.js) → кадр фигуры: y0 = (heady − c1)·K·s1 + d1, z0 = (headz − c2)·K·s2 + d2
test('headBox: heady 0,5, headz 0,2 при K = 750, s = 2, начале (0, 0, −0,4), d = (0, 5, 7) → y0 = 755, z0 = 907',()=>{
  const b=PF.headBox({...FR,d:[0,5,7]},.5,.2);near(b.y0,755,1e-9,'y0');near(b.z0,907,1e-9,'z0');});
// подгон по точкам (пины «фото ↔ снимок»: глаза, нос): силуэт головы на фото и у модели разный (уши фото длиннее, морда ниже) — подгон по силуэту кладёт глаза ~25 мм мимо
test('fitPins: три пары точек из известного подгона — тот же подгон (масштаб, сдвиг, перекос); четыре — по наименьшим квадратам',()=>{
  const p=[.52,9.2,.71,-140.5,-.013,.021],G=([x,y])=>[p[0]*x+p[4]*y+p[1],p[5]*x+p[2]*y+p[3]],R=[[790,980],[1255,980],[1020,1285]],q=PF.fitPins(R.map(r=>[G(r),r]));
  q.forEach((x,k)=>near(x,p[k],1e-6,'p'+k));const q4=PF.fitPins([[790,980],[1255,980],[1020,1285],[1000,600]].map(r=>[G(r),r]));q4.forEach((x,k)=>near(x,p[k],1e-6,'4: p'+k));
  assert.throws(()=>PF.fitPins([[[0,0],[1,1]],[[1,1],[2,2]]]),/три/);});

/* #185 З1 «трое ушей»: чёрная обводка силуэта фото (≈ 7 px у головы спереди) ложится внутрь уха модели. Полоса у прозрачного фона (тёмные и белые пиксели цепочкой от фона
   не дальше maxPx) перекрашивается цветом ближайшего пикселя за ней; силуэт (альфа) тот же — подгон по силуэту и совпадение не меняются. Тёмная грань глубже — остаётся (Review Focus 1) */
test('stripOutline: чёрная рамка 2 px у прозрачного фона — цветом серого за ней, альфа та же; тёмная полоса в 6 px от края и серое — нетронуты',()=>{
  const W=40,H=40,a=new Uint8Array(W*H*4),set=(x,y,v,al)=>{const k=(y*W+x)*4;a[k]=a[k+1]=a[k+2]=v;a[k+3]=al;};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.min(x,y,W-1-x,H-1-y);set(x,y,d<5?255:d<7?0:d>=13&&d<15?20:128,d<5?0:255);}   // фон 0…4, рамка 5…6, серое 7…12, тёмная полоса 13…14, серое дальше
  const r=PF.stripOutline(a,W,H,4),c=(x,y)=>Array.from(r.subarray((y*W+x)*4,(y*W+x)*4+4));
  assert.deepStrictEqual(c(5,20),[128,128,128,255],'рамка снаружи');assert.deepStrictEqual(c(6,20),[128,128,128,255],'рамка внутри');assert.deepStrictEqual(c(20,6),[128,128,128,255],'рамка сверху');
  assert.deepStrictEqual(c(2,20),[255,255,255,0],'фон');assert.deepStrictEqual(c(7,20),[128,128,128,255],'серое у рамки');assert.deepStrictEqual(c(13,20),[20,20,20,255],'тёмная полоса');
  assert.notStrictEqual(r,a,'новый массив');assert.strictEqual(a[(20*W+5)*4],0,'исходный не тронут');});
test('stripOutline: тёмная грань вплотную к рамке перекрашивается не глубже maxPx от фона',()=>{
  const W=30,H=30,a=new Uint8Array(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4,d=Math.min(x,y,W-1-x,H-1-y);a[k]=a[k+1]=a[k+2]=d<12?(x===7?60:10):128;a[k+3]=d<3?0:255;}   // столбец x = 7 — метка 60 в тёмной грани
  const r=PF.stripOutline(a,W,H,4),c=x=>r[(15*W+x)*4];[3,4,5,6].forEach(x=>assert.strictEqual(c(x),60,'x '+x+' — цветом ближайшего за полосой (метка x = 7)'));[7,8,11].forEach(x=>assert.strictEqual(c(x),x===7?60:10,'x '+x));});

/* #185 З2 уши «чуть дотянуть»: фото головы деформируется кусочно-аффинно по пинам [gx, gy, tx, ty] (пиксель фото → куда переезжает) + 4 угла картинки на месте.
   Рискованное место (Review Focus 2): глаза и нос (пины подгона) не должны сдвинуться */
const PIC=(W,H,f)=>{const a=new Uint8Array(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4,v=f(x,y);a[k]=v;a[k+1]=(x*7+y*3)&255;a[k+2]=200;a[k+3]=255;}return a;};
test('warpByPins: пины на месте (g = t) — картинка байт в байт та же',()=>{const W=50,H=40,a=PIC(W,H,(x,y)=>(x*13+y*29)&255);
  const r=PF.warpByPins(a,W,H,[[10,10,10,10],[35,12,35,12],[22,30,22,30]]);assert.deepStrictEqual(Buffer.from(r),Buffer.from(a));});
test('warpByPins: пин (20, 20) → (25, 20) — метка у пина переехала на 5 px, углы на месте',()=>{const W=60,H=60,a=PIC(W,H,(x,y)=>x===20&&y===20?250:x===0&&y===0?77:x===59&&y===59?99:10);
  const r=PF.warpByPins(a,W,H,[[20,20,25,20]]),R=(x,y)=>r[(y*W+x)*4];
  assert.strictEqual(R(25,20),250,'метка на новом месте');assert.ok(R(20,20)<100,'на старом месте метки нет');assert.strictEqual(R(0,0),77,'угол');assert.strictEqual(R(59,59),99,'угол');});
test('warpByPins: глаза и нос на месте (g = t), уши сдвинуты вверх на 8 px — пиксели глаз и носа те же, ухо переехало',()=>{const W=100,H=100,P=[[30,50],[70,50],[50,75]],E=[[25,15],[75,15]];
  const a=PIC(W,H,(x,y)=>P.some(p=>p[0]===x&&p[1]===y)?240:E.some(p=>p[0]===x&&p[1]===y)?180:20);
  const r=PF.warpByPins(a,W,H,P.map(p=>[p[0],p[1],p[0],p[1]]).concat(E.map(p=>[p[0],p[1],p[0],p[1]-8]))),R=(x,y)=>r[(y*W+x)*4];
  P.forEach(p=>assert.strictEqual(R(p[0],p[1]),240,'глаз/нос '+p));E.forEach(p=>assert.strictEqual(R(p[0],p[1]-8),180,'ухо '+p));});
test('warpByPins: складка (пин перескочил через соседний) — ошибка, а не тихо вывернутая картинка',()=>{const W=50,H=50,a=PIC(W,H,()=>9);
  assert.throws(()=>PF.warpByPins(a,W,H,[[20,25,35,25],[30,25,30,25],[25,10,25,10],[25,40,25,40]]),/складк/);});
// точки ушей по силуэту (для пинов деформации): кончик — верх силуэта в своей половине, вырез — где верхний край от кончика к середине впервые опустился до лба, основание — самая внешняя точка выше глаз
test('earPoints: голова-прямоугольник с двумя ушами-треугольниками — кончики, вырезы у лба, внешние основания',()=>{const W=100,H=100,fg=new Uint8Array(W*H),inT=(x,y,a,b,c)=>{const s=(p,q,r)=>(p[0]-r[0])*(q[1]-r[1])-(q[0]-r[0])*(p[1]-r[1]),d1=s([x,y],a,b),d2=s([x,y],b,c),d3=s([x,y],c,a);return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)fg[y*W+x]=(x>=30&&x<=70&&y>=40&&y<=90)||inT(x,y,[18,40],[42,40],[30,5])||inT(x,y,[58,40],[82,40],[70,5])?1:0;
  const e=PF.earPoints(fg,W,H,50,60),cl=(p,q,s)=>assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])<=2.5,s+': '+p+' ≠ '+q);
  cl(e.tipL,[30,5],'кончик слева');cl(e.tipR,[70,5],'кончик справа');cl(e.notchL,[42,40],'вырез слева');cl(e.notchR,[58,40],'вырез справа');cl(e.baseL,[18,40],'основание слева');cl(e.baseR,[82,40],'основание справа');});
