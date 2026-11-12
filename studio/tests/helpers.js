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
module.exports={engine,run,g,box,faceWhere,TOP,edgePoint,vi,makePNG,writeOBJ};
