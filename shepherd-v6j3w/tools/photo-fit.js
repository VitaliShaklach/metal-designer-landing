/* Фото-кальки «Фото спереди» / «Фото сбоку» (#178, план docs/superpowers/plans/2026-11-25-shepherd7-workshop.md, задача 4) — у Claude, на сайт не влияет.
   Фото Meshy → одна аффинная матрица «точка кадра фигуры (мм) → пиксель фото» = кадр фигуры → кадр OBJ (обратное к fitMesh + xf, как orig.js) ∘ орто-камера ракурса из cams.json
   (camera() в from-dev/art/tools/plates/project.js) ∘ подгон фото к снимку модели по силуэту (fitGen там же: масштаб, сдвиг, перекос).
   Пишет js/photos-<id>.js (PHOTOS.<id> — {key, name, img, m, dir, mirror, iou}) и img/photo-<id>-<вид>.png (фон белый, связанный с краем, → прозрачный; цвет под фоном — от соседней собаки).
   В лог — совпадение силуэта по каждому виду: подгона (как project.js, ≈ 0,8) и сквозное — силуэт модели через готовую матрицу против силуэта фото (check= — данные страницы js/orig-*.js).
   Сквозное сильно ниже подгона — матрица сведена неверно: файлы не пишутся.

   node shepherd-v6j3w/tools/photo-fit.js <obj> <cams.json> <xf.json> <id> front=<фото.png>,<снимок.png>[,<камера>] side=<фото.png>,<снимок.png>[,<камера>]
     [front-head=<фото головы.png>,<снимок головы.png>[,<камера>]] [front-head-pins=<gx,gy:x,y;…>] [side-head=…] [side-head-pins=…] [heady=0.5 headz=0.2] [check=<js/orig-*.js>]
   камера по умолчанию: front → cams.front, side → cams.profile, голова — cams.head-front / cams.head-profile; side светит и зеркально (собака симметрична).
   <вид>-head — слой головы крупно со своей матрицей для точек в коробке головы (heady, headz — пороги в долях кадра OBJ; умолчания 0,5 и 0,2 — как в запуске project.js из proj/README.txt, не как умолчания самого project.js);
   <вид>-head-pins — подгон головы по точкам (пиксель фото : пиксель снимка) вместо силуэта.
   PNG — from-dev/art/tools/plates/png.js (чтение RGB); с прозрачностью — writePNGA и readAlpha здесь: png.js пишет только RGB и при чтении альфу выбрасывает.

   Запуск для Овчарки 7 (#178; повторён 26.11 — файлы те же байт в байт). Голова спереди — по трём точкам (два глаза и нос): по силуэту глаза фото уходят на ~25 мм ниже глаз модели (уши фото длиннее)
     D=from-dev/art/tools/plates/src/shepherd5/proj; M=from-dev/art/tools/plates/src/shepherd5/model/Meshy_AI_welded_adult_shepherd_final_20261122_image-to-3d-texture
     node --max-old-space-size=8000 shepherd-v6j3w/tools/photo-fit.js $M.obj $D/cams.json from-dev/art/tools/plates/out/shepherd5/xf.json shepherd7 front=$D/g-front.png,$D/view-front.png
       front-head=$D/g-head-front.png,$D/view-head-front.png "front-head-pins=402,552:790,980;642,552:1255,980;520,772:1020,1285" side=$D/g-profile.png,$D/view-profile.png
       side-head=$D/g-head-profile.png,$D/view-head-profile.png heady=0.5 headz=0.2 check=shepherd-v6j3w/js/orig-shepherd5.js */
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');
const PNG_JS=path.resolve(__dirname,'../../from-dev/art/tools/plates/png.js');
const VIEWS={front:{name:'Фото спереди',cam:'front',mirror:false},side:{name:'Фото сбоку',cam:'profile',mirror:true}};

// --- камера: точка OBJ → пиксель снимка (непрерывно, пиксель i — [i, i+1)) и глубина; копия camera() из from-dev/art/tools/plates/project.js (from-dev только читаем, в git не идёт) ---
function camera(c){const d=c.dir,pos=c.position,tg=c.target,z=[-d[0],-d[1],-d[2]];
  let x=[c.up[1]*z[2]-c.up[2]*z[1],c.up[2]*z[0]-c.up[0]*z[2],c.up[0]*z[1]-c.up[1]*z[0]];const lx=Math.hypot(...x);x=x.map(q=>q/lx);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]],P=c.px,h=c.half;
  return {d,P,proj:(px,py,pz,o)=>{const qx=px-tg[0],qy=py-tg[1],qz=pz-tg[2];
    o[0]=((qx*x[0]+qy*x[1]+qz*x[2])/h+1)/2*P;o[1]=(1-((qx*y[0]+qy*y[1]+qz*y[2])/h+1)/2)*P;o[2]=(px-pos[0])*d[0]+(py-pos[1])*d[1]+(pz-pos[2])*d[2];}};}

// --- подгон фото к снимку: индекс пикселя снимка (x, y) → индекс пикселя фото (p0·x + p4·y + p1, p5·x + p2·y + p3); копия fitGen() из project.js ---
function fitGen(R,G){const W=R.W,H=R.H,mask=I=>{const m=new Uint8Array(I.W*I.H);for(let i=0;i<I.W*I.H;i++)m[i]=Math.min(I.px[3*i],I.px[3*i+1],I.px[3*i+2])<235;return m;};
  const MR=mask(R),MG=mask(G),box=(m,w,h)=>{let x0=1e9,x1=0,y0=1e9,y1=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(m[y*w+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return {x0,x1,y0,y1};};
  const ba=box(MR,W,H),bg=box(MG,G.W,G.H);let p=[(bg.x1-bg.x0)/(ba.x1-ba.x0),0,(bg.y1-bg.y0)/(ba.y1-ba.y0),0,0,0];p[1]=bg.x0-ba.x0*p[0];p[3]=bg.y0-ba.y0*p[2];
  const X0=Math.max(0,ba.x0-40),X1=Math.min(W-1,ba.x1+40),Y0=Math.max(0,ba.y0-40),Y1=Math.min(H-1,ba.y1+40);
  const iou=(p,st)=>{let i=0,u=0;for(let y=Y0;y<=Y1;y+=st)for(let x=X0;x<=X1;x+=st){const a=MR[y*W+x],gx=Math.round(p[0]*x+p[4]*y+p[1]),gy=Math.round(p[5]*x+p[2]*y+p[3]),b=gx>=0&&gy>=0&&gx<G.W&&gy<G.H&&MG[gy*G.W+gx];if(a&&b)i++;if(a||b)u++;}return i/u;};
  for(const st of [6,3,2]){let best=iou(p,st);const steps=[0.004,4,0.004,4,0.004,0.004];for(let it=0;it<60;it++){let imp=false;
    for(let k=0;k<6;k++)for(const s of [1,-1]){const q=p.slice();q[k]+=s*steps[k];if(k===0)q[1]-=s*steps[0]*(ba.x0+ba.x1)/2;if(k===2)q[3]-=s*steps[2]*(ba.y0+ba.y1)/2;if(k===4)q[1]-=s*steps[4]*(ba.y0+ba.y1)/2;if(k===5)q[3]-=s*steps[5]*(ba.x0+ba.x1)/2;const v=iou(q,st);if(v>best){best=v;p=q;imp=true;}}if(!imp)break;}}
  return {p,iou:iou(p,1),MR};}

/* --- подгон по точкам: pins = [[[gx, gy] — пиксель фото, [x, y] — пиксель снимка], …] (≥ 3, не на одной прямой) → тот же подгон p, что у fitGen, по наименьшим квадратам.
   Для головы спереди: силуэт головы на фото и у модели разный (уши фото длиннее, глаза и нос ниже) — по силуэту глаза уходят на ~25 мм, по глазам и носу — на месте --- */
function fitPins(pins){if(pins.length<3)throw new Error('подгон по точкам: нужно три точки и больше');const A=[[0,0,0],[0,0,0],[0,0,0]],bx=[0,0,0],by=[0,0,0];
  for(const [[gx,gy],[x,y]] of pins){const r=[x,y,1];for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]+=r[i]*r[j];bx[i]+=r[i]*gx;by[i]+=r[i]*gy;}}
  const det=M=>M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]),D=det(A);
  if(Math.abs(D)<1e-9*Math.max(1,det([[A[0][0],0,0],[0,A[1][1],0],[0,0,A[2][2]]])))throw new Error('подгон по точкам: точки на одной прямой — нужно три не на одной прямой');
  const solve=b=>[0,1,2].map(k=>det(A.map((row,i)=>row.map((v,j)=>j===k?b[i]:v)))/D),a=solve(bx),c=solve(by);return [a[0],a[2],c[1],c[2],a[1],c[0]];}

// --- кадр фигуры, как orig.js: fitMesh (высота → 600 мм, центр по X, низ Y и зад Z → 0, масштаб один на все оси) → p·s + d из xf.json ---
function frameOf(V0,xf){const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];V0.forEach(p=>{for(let k=0;k<3;k++){if(p[k]<mn[k])mn[k]=p[k];if(p[k]>mx[k])mx[k]=p[k];}});
  return {K:600/((mx[1]-mn[1])||1),c:[(mn[0]+mx[0])/2,mn[1],mn[2]],s:xf.s.slice(),d:xf.d.slice()};}
/* точка кадра фигуры (мм) → [u, v] фото (0…1, v вниз): кадр фигуры → OBJ → снимок (непрерывно) → индекс пикселя снимка (− 0,5) → подгон → индекс пикселя фото → доля (+ 0,5)/размер.
   Весь путь аффинный — матрица снимается по началу координат и трём ортам (точно). → [a0,a1,a2,a3, b0,b1,b2,b3]: u = a·p + a3, v = b·p + b3 — как owPhotoUV (ow-core.js) */
function photoMatrix(cam,fit,fr,GW,GH){const C=camera(cam),o=[0,0,0],uv=p=>{const q=p.map((x,k)=>(x-fr.d[k])/(fr.s[k]*fr.K)+fr.c[k]);C.proj(q[0],q[1],q[2],o);
    const ix=o[0]-.5,iy=o[1]-.5;return [(fit[0]*ix+fit[4]*iy+fit[1]+.5)/GW,(fit[5]*ix+fit[2]*iy+fit[3]+.5)/GH];};
  const z=uv([0,0,0]),e=[[1,0,0],[0,1,0],[0,0,1]].map(uv);return [e[0][0]-z[0],e[1][0]-z[0],e[2][0]-z[0],z[0],e[0][1]-z[1],e[1][1]-z[1],e[2][1]-z[1],z[1]];}
// коробка головы для слоя головы: пороги heady, headz в кадре OBJ (как в project.js) → кадр фигуры {y0, z0}
function headBox(fr,heady,headz){return {y0:(heady-fr.c[1])*fr.K*fr.s[1]+fr.d[1],z0:(headz-fr.c[2])*fr.K*fr.s[2]+fr.d[2]};}
// направление взгляда камеры в кадре фигуры (вектор OBJ × s·K), единичное: знак нормаль · dir при переводе кадра не меняется (нормаль — обратным масштабом)
function dirOf(cam,fr){const d=cam.dir.map((x,k)=>x*fr.s[k]*fr.K),l=Math.hypot(...d)||1;return d.map(x=>x/l);}

// --- сквозная проверка: силуэт модели (V, F — кадр фигуры) через матрицу m в пикселях фото W × H против маски фото fg (1 — собака) → совпадение (пересечение / объединение) ---
function silIoU(V,F,m,fg,W,H){const M=new Uint8Array(W*H),X=new Float64Array(V.length/3),Y=new Float64Array(V.length/3);
  for(let i=0;i<X.length;i++){const x=V[i*3],y=V[i*3+1],z=V[i*3+2];X[i]=(m[0]*x+m[1]*y+m[2]*z+m[3])*W;Y[i]=(m[4]*x+m[5]*y+m[6]*z+m[7])*H;}
  for(let t=0;t<F.length;t+=3){const a=F[t],b=F[t+1],c=F[t+2],x0=X[a],y0=Y[a],x1=X[b],y1=Y[b],x2=X[c],y2=Y[c],den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2);if(Math.abs(den)<1e-12)continue;
    const mnx=Math.max(0,Math.floor(Math.min(x0,x1,x2))),mxx=Math.min(W-1,Math.ceil(Math.max(x0,x1,x2))),mny=Math.max(0,Math.floor(Math.min(y0,y1,y2))),mxy=Math.min(H-1,Math.ceil(Math.max(y0,y1,y2)));
    for(let y=mny;y<=mxy;y++)for(let x=mnx;x<=mxx;x++){const px=x+.5,py=y+.5,wa=((y1-y2)*(px-x2)+(x2-x1)*(py-y2))/den,wb=((y2-y0)*(px-x2)+(x0-x2)*(py-y2))/den;if(wa>=-1e-9&&wb>=-1e-9&&wa+wb<=1+1e-9)M[y*W+x]=1;}}
  let i=0,u=0;for(let k=0;k<W*H;k++){if(M[k]&&fg[k])i++;if(M[k]||fg[k])u++;}return u?i/u:0;}

// --- фон фото: светлое (мин. канал ≥ 235), связанное с краем (как bgMask в project.js); белый шов внутри собаки — не фон. G — {W, H, px: RGB} ---
function bgMask(G){const W=G.W,H=G.H,m=new Uint8Array(W*H),st=[];for(let x=0;x<W;x++)st.push(x,(H-1)*W+x);for(let y=0;y<H;y++)st.push(y*W,y*W+W-1);
  while(st.length){const k=st.pop();if(m[k]||Math.min(G.px[3*k],G.px[3*k+1],G.px[3*k+2])<235)continue;m[k]=1;const x=k%W;if(x>0)st.push(k-1);if(x<W-1)st.push(k+1);if(k>=W)st.push(k-W);if(k<W*(H-1))st.push(k+W);}return m;}
// RGBA: собака — как есть, фон — прозрачный; цвет под фоном — от ближайшей собаки на n px (иначе на краю силуэта сглаживание текстуры подмешивает белое)
function rgbaOf(G,bg,n=8){const W=G.W,H=G.H,a=Buffer.alloc(W*H*4),src=new Int32Array(W*H).fill(-1);let fr=[];
  for(let k=0;k<W*H;k++){a[k*4]=G.px[k*3];a[k*4+1]=G.px[k*3+1];a[k*4+2]=G.px[k*3+2];a[k*4+3]=bg[k]?0:255;if(!bg[k]){src[k]=k;fr.push(k);}}
  for(let s=0;s<n&&fr.length;s++){const nx=[];for(const k of fr){const x=k%W,nb=[x>0?k-1:-1,x<W-1?k+1:-1,k>=W?k-W:-1,k<W*(H-1)?k+W:-1];
      for(const q of nb)if(q>=0&&src[q]<0){src[q]=src[k];a[q*4]=a[k*4];a[q*4+1]=a[k*4+1];a[q*4+2]=a[k*4+2];nx.push(q);}}fr=nx;}
  return a;}
// PNG RGBA 8 бит; фильтр строки — с наименьшей суммой |байт| (как обычно делают кодировщики), сжатие 9
function writePNGA(f,W,H,rgba){const crcT=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c>>>0;}
  const crc=b=>{let c=0xffffffff;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;},
    ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const st=W*4,raw=Buffer.alloc(H*(st+1)),cand=[0,1,2,3,4].map(()=>Buffer.alloc(st)),zero=Buffer.alloc(st);
  for(let y=0;y<H;y++){const cur=rgba.subarray(y*st,(y+1)*st),prev=y?rgba.subarray((y-1)*st,y*st):zero;let best=0,bs=Infinity;
    for(let ft=0;ft<5;ft++){const o=cand[ft];let s=0;for(let i=0;i<st;i++){const a=i>=4?cur[i-4]:0,b=prev[i],c=i>=4?prev[i-4]:0;
        let p=ft===0?0:ft===1?a:ft===2?b:ft===3?(a+b)>>1:(()=>{const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;})();
        const v=(cur[i]-p)&255;o[i]=v;s+=v<128?v:256-v;}if(s<bs){bs=s;best=ft;}}
    raw[y*(st+1)]=best;cand[best].copy(raw,y*(st+1)+1);}
  const h=Buffer.alloc(13);h.writeUInt32BE(W,0);h.writeUInt32BE(H,4);h[8]=8;h[9]=6;
  fs.writeFileSync(f,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',h),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]));}
// альфа PNG RGBA (для проверки записанного): → Uint8Array W·H
function readAlpha(f){const b=fs.readFileSync(f);let o=8,W,H,ct;const id=[];while(o<b.length){const n=b.readUInt32BE(o),t=b.toString('latin1',o+4,o+8),d=b.subarray(o+8,o+8+n);
    if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);o+=12+n;}
  if(ct!==6)throw new Error(f+': не RGBA');const raw=zlib.inflateSync(Buffer.concat(id)),st=W*4,cur=Buffer.alloc(st),prev=Buffer.alloc(st),A=new Uint8Array(W*H);
  for(let y=0;y<H;y++){const ft=raw[y*(st+1)],r=raw.subarray(y*(st+1)+1,(y+1)*(st+1));for(let i=0;i<st;i++){const a=i>=4?cur[i-4]:0,u=prev[i],c=i>=4?prev[i-4]:0;let p=r[i];
      if(ft===1)p+=a;else if(ft===2)p+=u;else if(ft===3)p+=(a+u)>>1;else if(ft===4){const q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);p+=pa<=pb&&pa<=pc?a:pb<=pc?u:c;}cur[i]=p&255;}
    for(let x=0;x<W;x++)A[y*W+x]=cur[x*4+3];cur.copy(prev);}return A;}

module.exports={camera,fitGen,fitPins,frameOf,headBox,photoMatrix,dirOf,silIoU,bgMask,rgbaOf,writePNGA,readAlpha,PNG_JS,VIEWS};

if(require.main===module){const AV=process.argv.slice(2),POS=AV.filter(a=>!/^[a-z-]+=/.test(a)),NA=Object.fromEntries(AV.filter(a=>/^[a-z-]+=/.test(a)).map(a=>[a.slice(0,a.indexOf('=')),a.slice(a.indexOf('=')+1)]));
  const [objF,camF,xfF,id]=POS,keys=Object.keys(VIEWS).filter(k=>NA[k]);
  if(!objF||!camF||!xfF||!id||!keys.length){console.error('node photo-fit.js <obj> <cams.json> <xf.json> <id> front=<фото.png>,<снимок.png>[,<камера>] [front-head=…] [front-head-pins=<gx,gy:x,y;…>] side=… [side-head=…] [heady=0.5 headz=0.2] [check=<js/orig-*.js>]');process.exit(1);}
  const {readPNG}=require(PNG_JS),SITE=path.resolve(__dirname,'..'),CAMS=JSON.parse(fs.readFileSync(camF,'utf8')),XF=JSON.parse(fs.readFileSync(xfF,'utf8'));
  const V0=[];for(const l of fs.readFileSync(objF,'utf8').split(/\r?\n/))if(l.startsWith('v ')){const s=l.split(/\s+/);V0.push([+s[1],+s[2],+s[3]]);}
  const fr=frameOf(V0,XF),HB=headBox(fr,NA.heady!==undefined?+NA.heady:.5,NA.headz!==undefined?+NA.headz:.2);
  console.log('модель',V0.length,'точек; кадр: K',fr.K.toFixed(4),'| начало',fr.c.map(x=>x.toFixed(6)).join(', '),'| s',fr.s.map(x=>x.toFixed(5)).join(', '),'| d',fr.d.map(x=>x.toFixed(3)).join(', '),'| коробка головы: y ≥',HB.y0.toFixed(1),'z ≥',HB.z0.toFixed(1),'мм');
  // модель для сквозной проверки — как на странице (js/orig-*.js); без check= сквозной нет
  let CV=null,CF=null;if(NA.check){const cx={window:{}};vm.createContext(cx);vm.runInContext(fs.readFileSync(NA.check,'utf8'),cx);const r=Object.values(cx.window.ORIG)[0],u8=s=>new Uint8Array(Buffer.from(s,'base64'));
    CV=new Float32Array(u8(r.V).buffer);CF=new Uint32Array(u8(r.F).buffer);console.log('проверка по',path.basename(NA.check),':',CF.length/3,'треугольников');}
  let bad=false;const imgs=[];
  // один слой: фото + снимок + камера → матрица, картинка, совпадение силуэта (подгон и сквозное). pins — «gx,gy:x,y;…» (пиксель фото : пиксель снимка) — подгон по точкам вместо силуэта
  const layer=(tag,arg,camDef,img,pins)=>{const [gF,rF,camK]=arg.split(','),cam=CAMS[camK||camDef];if(!cam)throw new Error('нет камеры '+(camK||camDef)+' в '+camF);
    const R=readPNG(rF),G=readPNG(gF);if(R.W!==cam.px||R.H!==cam.px)throw new Error('снимок '+rF+' не '+cam.px+' px');
    const PN=pins?pins.split(';').map(s=>s.split(':').map(q=>q.split(',').map(Number))):null,fit=PN?{p:fitPins(PN),iou:null}:fitGen(R,G);
    const m=photoMatrix(cam,fit.p,fr,G.W,G.H),bg=bgMask(G),fg=bg.map(x=>1-x),iou=CV?silIoU(CV,CF,m,fg,G.W,G.H):null;
    console.log(tag,'(камера '+(camK||camDef)+') | совпадение силуэта:',PN?'подгон по '+PN.length+' точкам':'подгон '+fit.iou.toFixed(3),iou===null?'':'| сквозное по матрице '+iou.toFixed(3),
      '| масштаб',(fit.p[0]*cam.px/G.W).toFixed(3),(fit.p[2]*cam.px/G.H).toFixed(3),'| перекос',fit.p[4].toFixed(4),fit.p[5].toFixed(4));
    if(PN){const mm=2*cam.half*fr.K*fr.s[1]/cam.px;PN.forEach(([[gx,gy],[x,y]],i)=>{const ex=fit.p[0]*x+fit.p[4]*y+fit.p[1]-gx,ey=fit.p[5]*x+fit.p[2]*y+fit.p[3]-gy;
        console.log('  точка',i+1,'фото',gx+','+gy,'↔ снимок',x+','+y,'| невязка',Math.hypot(ex,ey).toFixed(2),'px фото');});console.log('  1 px снимка =',mm.toFixed(3),'мм');}
    if(iou!==null&&!PN&&(iou<.6||iou<fit.iou-.08)){console.error(tag+': сквозное совпадение '+iou.toFixed(3)+' сильно ниже подгона '+fit.iou.toFixed(3)+' — матрица сведена неверно, файлы не пишу');bad=true;}
    imgs.push({img,G,bg});return {cam,m,iou:+(iou===null?fit.iou:iou).toFixed(3),pins:!!PN};};
  const out=keys.map(key=>{const vw=VIEWS[key],img='img/photo-'+id+'-'+key+'.png',L=layer(key+' ('+vw.name+')',NA[key],vw.cam,img),o={key,name:vw.name,img,m:L.m,dir:dirOf(L.cam,fr),mirror:vw.mirror,iou:L.iou};
    if(NA[key+'-head']){const hi='img/photo-'+id+'-'+key+'-head.png',H=layer(key+'-head (голова)',NA[key+'-head'],'head-'+vw.cam,hi,NA[key+'-head-pins']);
      if(H.cam.dir.some((x,k)=>Math.abs(x-L.cam.dir[k])>1e-9)){console.error(key+'-head: камера головы смотрит не туда, куда общая — сторона выбирается по общей');bad=true;}
      o.head={img:hi,m:H.m,y0:+HB.y0.toFixed(3),z0:+HB.z0.toFixed(3),iou:H.iou,pins:H.pins};}
    return o;});
  if(bad)process.exit(2);
  for(const o of imgs){const f=path.join(SITE,o.img);writePNGA(f,o.G.W,o.G.H,rgbaOf(o.G,o.bg));const sz=fs.statSync(f).size;console.log(o.img,(sz/1048576).toFixed(2),'МБ',sz>1048576?'— БОЛЬШЕ 1 МБ':'');if(sz>1048576)bad=true;}
  const num=a=>'['+a.map(x=>+x.toPrecision(12)).join(',')+']',js=path.join(SITE,'js/photos-'+id+'.js');
  const L=out.map(o=>`{key:'${o.key}',name:'${o.name}',img:'${o.img}',m:${num(o.m)},dir:${num(o.dir)},mirror:${o.mirror},iou:${o.iou}`+(o.head?`,
  head:{img:'${o.head.img}',m:${num(o.head.m)},y0:${o.head.y0},z0:${o.head.z0},iou:${o.head.iou},pins:${o.head.pins}}`:'')+'}');
  fs.writeFileSync(js,`/* фото-кальки (#178; сгенерировано shepherd-v6j3w/tools/photo-fit.js): m — точка кадра фигуры (мм) → [u, v] фото (owPhotoUV в ow-core.js), dir — взгляд камеры фото,
   mirror — светить ещё и зеркально по X, iou — совпадение силуэта модели через m с силуэтом фото; head — снимок головы крупно для точек y ≥ y0, z ≥ z0 (главнее общего).
   Грузится, когда открыта фигура с photos:'${id}' (FIGURES), картинки — по выбору кальки */
var PHOTOS=window.PHOTOS||{};window.PHOTOS=PHOTOS;PHOTOS.${id}=[
${L.join(',\n')}];
`);
  console.log('записано',path.relative(SITE,js));if(bad)process.exit(2);}
