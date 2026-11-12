// эталон из модели Meshy для Проверки (правила 7 и 11): OBJ (+ PNG текстуры) → {V, F, trace} в рамке модели — выбранная половина и её зеркало
//   buildRef(objPath, pngPath|null, {half: 'left'|'right', frame: 'meshy'|'lynx14'})
//   Эталон симметричный (спека, правило 11): сама модель Meshy несимметрична (у рыси справа прижат хвост), а фигура — зеркальная.
//   trace — калька в формате editor/lynx/js/trace.js (перенос C:\dev\metal-designer\art\tools\plates\tracing.js): base64, на точку 9 байт —
//   x, y, z int16 (мм × 10) и r, g, b; по клетке TR_CELL = 2 мм — одна точка; без PNG — null
const fs=require('fs'),{readPNG}=require('./png.js'),{refFrame}=require('../js/ref.js');

// рамки. meshy — для новых моделей: refFrame по всей модели (высота 600, x по центру, низ y = 0, z от 0).
// lynx14 — как C:\dev\…\private\make-lynx14.js переводил src5 в рамку рыси 14 (строки 16–17): тоже по всей модели, с хвостом и глазами,
// той же формулой. Рысь 14 ниже 600 (595,0) потому, что кисточку Meshy срезали, а не из-за другой рамки; совпадение проверяет тест медианы
const FRAMES={meshy:refFrame,lynx14:refFrame};

// OBJ: точки, точки текстуры, треугольники (многоугольники — веером) и их точки текстуры; номера с 1, отрицательные — с конца
function readOBJ(txt){const V=[],T=[],F=[],FT=[];
  for(const l of txt.split(/\r?\n/)){const s=l.trim().split(/\s+/);
    if(s[0]==='v')V.push([+s[1],+s[2],+s[3]]);else if(s[0]==='vt')T.push([+s[1],+s[2]]);
    else if(s[0]==='f'){const ix=s.slice(1).map(w=>w.split('/').map((x,k)=>{if(x==='')return -1;const i=parseInt(x,10);return i<0?(k?T:V).length+i:i-1;}));
      for(let k=1;k+1<ix.length;k++){F.push([ix[0][0],ix[k][0],ix[k+1][0]]);FT.push([ix[0][1],ix[k][1],ix[k+1][1]]);}}}
  return {V,T,F,FT};}

// половина: треугольники обрезаются плоскостью x = 0 (точки текстуры — тоже), остаётся сторона half; затем зеркало x → −x с обратным обходом
function halfMirror(V,F,UV,half){const s=half==="right"?-1:1,inn=c=>s*c.p[0]<=0,OV=[],OF=[],OU=[];
  const put=(tri)=>{const i=OV.length;tri.forEach(c=>{OV.push(c.p);OU.push(c.u);});OF.push([i,i+1,i+2]);};
  F.forEach((f,fi)=>{const C=f.map((v,k)=>({p:V[v],u:UV?UV[fi][k]:null})),out=[];
    for(let k=0;k<3;k++){const a=C[(k+2)%3],b=C[k];
      if(inn(b)!==inn(a)){const t=a.p[0]/(a.p[0]-b.p[0]),p=a.p.map((x,i)=>x+(b.p[i]-x)*t);p[0]=0;out.push({p,u:a.u&&[a.u[0]+(b.u[0]-a.u[0])*t,a.u[1]+(b.u[1]-a.u[1])*t]});}
      if(inn(b))out.push(b);}
    for(let k=1;k+1<out.length;k++)put([out[0],out[k],out[k+1]]);});
  const n=OF.length;for(let i=0;i<n;i++){const [a,b,c]=OF[i],j=OV.length;[a,c,b].forEach(v=>{OV.push([-OV[v][0],OV[v][1],OV[v][2]]);OU.push(OU[v]);});OF.push([j,j+1,j+2]);}
  return {V:OV,F:OF,UV:OU};}

// калька: поверхность → облако точек с цветом текстуры (как tracing.js): выборки через 0,7 мм, клетка CELL мм; шов — светлый серый или тёмный,
// в клетке шов побеждает, если его выборок ≥ SEAMF (линия тонкая, ~1 мм), — чтобы линии не размывались
// (те же формулы, что в tracing.js; клетка — числовой ключ, суммы — подряд в массиве S по 11 чисел: x, y, z, n, r, g, b шва, r, g, b фона, выборок шва)
function traceOf(M,I,CELL=2,SEAMF=.12){const W=I.W,H=I.H,X=I.px,cells=new Map(),S=[];
  M.F.forEach(f=>{const A=M.V[f[0]],B=M.V[f[1]],C=M.V[f[2]],uv=f.map(v=>M.UV[v]?[M.UV[v][0]*W,(1-M.UV[v][1])*H]:[0,0]);
    const n=Math.max(1,Math.ceil(Math.max(Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]),Math.hypot(B[0]-C[0],B[1]-C[1],B[2]-C[2]),Math.hypot(C[0]-A[0],C[1]-A[1],C[2]-A[2]))/.7));
    for(let i=0;i<=n;i++)for(let j=0;i+j<=n;j++){const a=i/n,b=j/n,w=1-a-b,x=A[0]*w+B[0]*a+C[0]*b,y=A[1]*w+B[1]*a+C[1]*b,z=A[2]*w+B[2]*a+C[2]*b;
      const tx=Math.min(W-1,Math.max(0,(uv[0][0]*w+uv[1][0]*a+uv[2][0]*b)|0)),ty=Math.min(H-1,Math.max(0,(uv[0][1]*w+uv[1][1]*a+uv[2][1]*b)|0)),po=(ty*W+tx)*3,r=X[po],g=X[po+1],bl=X[po+2];
      const l=.3*r+.59*g+.11*bl,sat=Math.max(r,g,bl)-Math.min(r,g,bl),sm=l>185&&sat<70||l<45;   // шов — светлый серый или тёмный
      const key=((Math.floor(x/CELL)+4096)*8192+Math.floor(y/CELL)+4096)*8192+Math.floor(z/CELL)+4096;let e=cells.get(key);if(e===undefined){e=S.length;cells.set(key,e);S.push(0,0,0,0,0,0,0,0,0,0,0);}
      S[e]+=x;S[e+1]+=y;S[e+2]+=z;S[e+3]++;if(sm){S[e+10]++;S[e+4]+=r;S[e+5]+=g;S[e+6]+=bl;}else{S[e+7]+=r;S[e+8]+=g;S[e+9]+=bl;}}});
  const buf=Buffer.alloc(cells.size*9);let o=0;
  cells.forEach(e=>{const n=S[e+3],sn=S[e+10],s=sn>=SEAMF*n,k=s?sn:n-sn,c=s?e+4:e+7;
    for(let i=0;i<3;i++)buf.writeInt16LE(Math.round(S[e+i]/n*10),o+i*2);for(let i=0;i<3;i++)buf[o+6+i]=Math.round(S[c+i]/k);o+=9;});
  return buf.toString('base64');}

function buildRef(objPath,pngPath,{half='left',frame='meshy'}={}){
  if(!FRAMES[frame])throw new Error('нет такой рамки эталона: '+frame+' (есть: '+Object.keys(FRAMES).join(', ')+')');
  if(half!=='left'&&half!=='right')throw new Error('половина эталона — left или right, а не '+half);
  const O=readOBJ(fs.readFileSync(objPath,'utf8'));if(!O.F.length)throw new Error('в модели нет треугольников: '+objPath);
  const I=pngPath?readPNG(pngPath):null,UV=I?O.FT.map(t=>t.map(i=>i>=0&&O.T[i]?O.T[i]:[0,0])):null;
  const M=halfMirror(FRAMES[frame](O.V),O.F,UV,half);if(!M.F.length)throw new Error((half==="left"?"слева":"справа")+" от x = 0 у модели нет треугольников: "+objPath);
  return {V:M.V,F:M.F,trace:I?traceOf(M,I):null,half,frame};}

module.exports={buildRef,readOBJ,FRAMES};
