// фигуры для тестов мастерской: всё из куба-заготовки blankBox(300,400,260) (мм, scale 1), строится в контексте движка
const fs=require('fs'),os=require('os'),path=require('path'),zlib=require('zlib');
const {loadFigureEngine}=require('../lib/engine.js');
let ENG=null;
const engine=()=>ENG||(ENG=loadFigureEngine());
const run=s=>engine().run(s);
const g=n=>run(n);
const box=(W=300,H=400,D=260)=>run(`blankBox(${W},${H},${D})`);
// номер грани, у которой все точки удовлетворяют условию
const faceWhere=(E,fn)=>E.P.findIndex(Q=>Q.every(i=>fn(E.V[i])));
const TOP=p=>p[1]===400;
// точка на ребре a–b у всех граней с этим ребром; номер новой точки
function edgePoint(E,a,b,p){E.V.push(p);const m=E.V.length-1;run('insertOnEdge')(E,a,b,m);return m;}
const vi=(E,p)=>E.V.findIndex(q=>q[0]===p[0]&&q[1]===p[1]&&q[2]===p[2]);
// PNG 8 бит RGB: fn(x, y) → [r, g, b]; y — сверху вниз
function makePNG(w,h,fn){const raw=Buffer.alloc(h*(w*3+1));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=fn(x,y),o=y*(w*3+1)+1+x*3;raw[o]=c[0];raw[o+1]=c[1];raw[o+2]=c[2];}
  const ch=(t,d)=>{const l=Buffer.alloc(4),c=Buffer.alloc(4),td=Buffer.concat([Buffer.from(t,'ascii'),d]);l.writeUInt32BE(d.length);c.writeUInt32BE(zlib.crc32(td));return Buffer.concat([l,td,c]);};
  const hd=Buffer.alloc(13);hd.writeUInt32BE(w,0);hd.writeUInt32BE(h,4);hd[8]=8;hd[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',hd),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]);}
// OBJ во временной папке: V — точки, F — треугольники (номера с 0), UV — [u, v] на угол каждого треугольника (F.length × 3) или null
function writeOBJ(name,V,F,UV){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-ref-')),f=path.join(dir,name);
  const L=V.map(p=>'v '+p.join(' '));
  if(UV){UV.flat().forEach(t=>L.push('vt '+t.join(' ')));F.forEach((t,i)=>L.push('f '+t.map((v,k)=>(v+1)+'/'+(i*3+k+1)).join(' ')));}
  else F.forEach(t=>L.push('f '+t.map(v=>v+1).join(' ')));
  fs.writeFileSync(f,L.join('\n')+'\n');return f;}
// куб 300 × 600 × 260 с текстурой: верх — вся картинка (u — по x, v — по z), светлая полоса поперёк верха на z = 130; остальные грани — фон
function stripeRef(){const x=150,H=600,D=260,V=[[-x,0,0],[x,0,0],[x,H,0],[-x,H,0],[-x,0,D],[x,0,D],[x,H,D],[-x,H,D]],F=[],UV=[];
  const bg=[.005,.995],uvTop=v=>[(V[v][0]+x)/300,1-V[v][2]/D];
  const q=(a,b,c,d,top)=>[[a,b,c],[a,c,d]].forEach(t=>{F.push(t);UV.push(t.map(v=>top?uvTop(v):bg));});
  q(0,3,2,1);q(4,5,6,7);q(0,1,5,4);q(3,7,6,2,true);q(0,4,7,3);q(1,2,6,5);
  const obj=writeOBJ('stripe.obj',V,F,UV),png=obj.replace(/\.obj$/,'.png');
  fs.writeFileSync(png,makePNG(300,260,(px,py)=>py>=128&&py<132?[230,230,230]:[100,100,100]));
  return run('refIndex')(require('../lib/refbuild.js').buildRef(obj,png,{half:'left',frame:'meshy'}));}
// верх куба 300 × 600 × 260 разрезан поперёк на z = c: шов без излома
function cutTop(c){const E=box(300,600,260),top=faceWhere(E,p=>p[1]===600);
  const a=edgePoint(E,vi(E,[-150,600,0]),vi(E,[-150,600,260]),[-150,600,c]),b=edgePoint(E,vi(E,[150,600,0]),vi(E,[150,600,260]),[150,600,c]);
  return run('cutPoly')(E,top,a,b,false);}
// у куба срезаны два зеркальных верхних угла треугольником с рёбрами L (как CB в editor/lynx/tools/smoke.js)
function cutCorners(L,E){E=E||box();const d=L/Math.SQRT2;[[6,1],[7,-1]].forEach(([v,s])=>{const p=E.V[v],n=E.V.length;E.V.push([p[0]-s*d,p[1],p[2]],[p[0],p[1]-d,p[2]],[p[0],p[1],p[2]-d]);
  E.P=E.P.map(Q=>{const k=Q.indexOf(v);if(k<0)return Q;const nb=[Q[(k+Q.length-1)%Q.length],Q[(k+1)%Q.length]],pick=w=>{const q=E.V[w];return Math.abs(q[0]-p[0])>1?n:Math.abs(q[1]-p[1])>1?n+1:n+2;};
    const r=Q.slice();r.splice(k,1,pick(nb[0]),pick(nb[1]));return r;});const tri=[n,n+1,n+2];E.P.push(s>0?tri:tri.reverse());});return E;}
// фигура-образец для панели Проверки, мм модели; на сайте она вдвое больше (SAMPLE_SCALE): куб 300 × 400 × 260 мм сайта,
// два верхних угла срезаны треугольниками с рёбрами 4 мм, нижний угол (150, 0, 260) опущен на 6 мм. В Проверке (эталон — она сама):
//   правило 1 — 1 строка (низ неплоский на 1,5 мм; чинится), правило 2 — 6 (рёбра 4 мм; чинятся),
//   правило 6 — 2 (срезы — узкие детали; починка даёт новые строки правил 3, 5, 10), правило 10 — 1 (починить нельзя: форма уйдёт на 3 мм), сведение «Эталона нет»
const SAMPLE_SCALE=2;
function sampleCube(){const E=cutCorners(2,box(150,200,130));E.V[5]=[75,-3,130];E.S=[];return E;}
const sampleFigure=(name='Образец',E=sampleCube())=>({type:'md-studio',v:1,name,kind:'stand',localOnly:false,H:406,V:E.V,P:E.P,S:[],keep:[],slots:[],refHalf:'left'});
// образец, у которого задняя грань (z = 0) разрезана пополам: ещё строка правила 7 (шов без излома); убрать шов — выросло бы правило 5 (лишние точки)
function sampleSplit(){const E=sampleCube(),R=run('splitPoly')(E,faceWhere(E,p=>p[2]===0),true);R.S=[];return R;}
module.exports={engine,run,g,box,faceWhere,TOP,edgePoint,vi,makePNG,writeOBJ,stripeRef,cutTop,cutCorners,sampleCube,sampleSplit,sampleFigure,SAMPLE_SCALE};
