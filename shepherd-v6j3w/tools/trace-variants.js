/* ---------- варианты кальки линиями (#172, план 2026-11-25-shepherd6, Q9): постобработка готовых ломаных TRACE_L.<id> (пишет from-dev/art/tools/plates/tracing.js) ----------
   2 — «без мусора»: убраны обрывки — связки ломаных (концы ближе JOIN мм считаются одной линией) общей длиной < MIN мм;
   3 — «выпрямленная»: 2 + ломаные упрощены (Дуглас — Пекер, допуск TOL мм) + почти совпадающие дубли слиты (участки ломаной, что идут ближе DUP мм от уже взятой линии, выброшены).
   Облако TRACE.<id> не пишется: сверка у вариантов — по облаку исходной кальки (третий элемент в FIGURES.<id>.refs).
   node shepherd-v6j3w/tools/trace-variants.js <файл кальки.js> <id> <id без мусора> <id выпрямленной> [min=20] [tol=1.5] [dup=2]
   → shepherd-v6j3w/js/trace-<id без мусора>.js, trace-<id выпрямленной>.js */
const fs=require('fs'),path=require('path');
// base64: uint32 число ломаных, на каждую uint32 n и n×3 int16 (мм×10) → [[[x,y,z]…]…]
function tvDecode(b64){const b=Buffer.from(b64,'base64');let o=0;const n=b.readUInt32LE(o);o+=4;const L=[];
  for(let i=0;i<n;i++){const m=b.readUInt32LE(o);o+=4;const l=[];for(let j=0;j<m;j++){l.push([b.readInt16LE(o)/10,b.readInt16LE(o+2)/10,b.readInt16LE(o+4)/10]);o+=6;}L.push(l);}return L;}
function tvEncode(L){const b=Buffer.alloc(L.reduce((a,l)=>a+4+l.length*6,4));let o=b.writeUInt32LE(L.length,0);
  L.forEach(l=>{o=b.writeUInt32LE(l.length,o);l.forEach(p=>p.forEach(x=>{o=b.writeInt16LE(Math.round(x*10),o);}));});return b.toString('base64');}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function tvLen(l){let s=0;for(let i=1;i<l.length;i++)s+=dist(l[i-1],l[i]);return s;}
// сетка по клеткам cs мм: ключ → список
function grid(cs){const G=new Map(),k=p=>Math.floor(p[0]/cs)+','+Math.floor(p[1]/cs)+','+Math.floor(p[2]/cs);
  return {add(p,v){const key=k(p);let c=G.get(key);if(!c)G.set(key,c=[]);c.push(v);},near(p,f){const i=p.map(x=>Math.floor(x/cs));
    for(let x=i[0]-1;x<=i[0]+1;x++)for(let y=i[1]-1;y<=i[1]+1;y++)for(let z=i[2]-1;z<=i[2]+1;z++)for(const v of G.get(x+','+y+','+z)||[])f(v);}};}
// «без мусора»: связки по концам ≤ join мм (union-find), связка короче min мм — вон; оставшиеся ломаные — как были
function tvClean(L,min=20,join=2){const par=L.map((_,i)=>i),f=i=>par[i]===i?i:(par[i]=f(par[i])),G=grid(Math.max(join,1));
  L.forEach((l,i)=>{if(!l.length)return;[l[0],l[l.length-1]].forEach(p=>{G.near(p,([j,q])=>{if(j!==i&&dist(p,q)<=join)par[f(i)]=f(j);});G.add(p,[i,p]);});});
  const sum=new Map();L.forEach((l,i)=>{const r=f(i);sum.set(r,(sum.get(r)||0)+tvLen(l));});
  return L.filter((l,i)=>l.length>=2&&sum.get(f(i))>=min);}
// Дуглас — Пекер в 3D: допуск tol мм
function tvSimplify(l,tol){if(l.length<3)return l.slice();const keep=new Uint8Array(l.length);keep[0]=keep[l.length-1]=1;const st=[[0,l.length-1]];
  while(st.length){const [a,b]=st.pop(),A=l[a],B=l[b],ab=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],L2=ab[0]**2+ab[1]**2+ab[2]**2;let dm=-1,im=-1;
    for(let i=a+1;i<b;i++){const P=l[i],t=L2?Math.max(0,Math.min(1,((P[0]-A[0])*ab[0]+(P[1]-A[1])*ab[1]+(P[2]-A[2])*ab[2])/L2)):0,d=dist(P,[A[0]+ab[0]*t,A[1]+ab[1]*t,A[2]+ab[2]*t]);if(d>dm){dm=d;im=i;}}
    if(dm>tol){keep[im]=1;st.push([a,im],[im,b]);}}
  return l.filter((_,i)=>keep[i]);}
// точки ломаной через step мм (концы на месте)
function resample(l,step){const out=[l[0]];for(let i=1;i<l.length;i++){const A=l[i-1],B=l[i],m=Math.max(1,Math.ceil(dist(A,B)/step));for(let s=1;s<=m;s++)out.push([A[0]+(B[0]-A[0])*s/m,A[1]+(B[1]-A[1])*s/m,A[2]+(B[2]-A[2])*s/m]);}return out;}
// «выпрямленная»: без мусора → длинные первыми; участки, которые идут ближе dup мм от уже взятых линий, — дубль, выброшен; оставшиеся куски ≥ min мм упрощены с допуском tol
function tvStraight(L,min=20,tol=1.5,dup=2,join=2){const C=tvClean(L,min,join).map(l=>resample(l,1)).sort((a,b)=>tvLen(b)-tvLen(a)),G=grid(Math.max(dup,1)),out=[];
  for(const l of C){const cov=l.map(p=>{let hit=false;G.near(p,q=>{if(!hit&&dist(p,q)<=dup)hit=true;});return hit;});
    let run=[];const flush=()=>{if(run.length>=2&&tvLen(run)>=min)out.push(run);run=[];};
    l.forEach((p,i)=>{if(cov[i])flush();else run.push(p);});flush();
    // в сетку — после разбора всей ломаной (иначе ломаная «дублирует» сама себя)
    l.forEach(p=>G.add(p,p));}
  return tvClean(out.map(l=>tvSimplify(l,tol)),min,join);}
// файл кальки → TRACE_L.<id> (base64)
function tvRead(file,id){const s=fs.readFileSync(file,'utf8'),m=new RegExp('TRACE_L\\.'+id+"='([^']*)'").exec(s);if(!m)throw new Error('в '+file+' нет TRACE_L.'+id);return tvDecode(m[1]);}
function tvFile(id,L,about){return '/* '+about+' (сгенерировано shepherd-v6j3w/tools/trace-variants.js): только линии, облака нет */\nvar TRACE_L=window.TRACE_L||{};window.TRACE_L=TRACE_L;TRACE_L.'+id+'=\''+tvEncode(L)+'\';\n';}
const stat=L=>`линий ${L.length}, точек ${L.reduce((a,l)=>a+l.length,0)}, длина ${(L.reduce((a,l)=>a+tvLen(l),0)/1000).toFixed(1)} м`;
module.exports={tvDecode,tvEncode,tvLen,tvClean,tvSimplify,tvStraight,tvRead,tvFile};
if(require.main===module){const AV=process.argv.slice(2),POS=AV.filter(a=>!/^[a-z]+=/.test(a)),NA=Object.fromEntries(AV.filter(a=>/^[a-z]+=/.test(a)).map(a=>a.split('=')));
  const [file,id,id2,id3]=POS,min=+(NA.min||20),tol=+(NA.tol||1.5),dup=+(NA.dup||2),JS=path.join(__dirname,'../js/');
  if(!file||!id||!id2||!id3){console.log('node trace-variants.js <файл кальки.js> <id> <id без мусора> <id выпрямленной> [min=20] [tol=1.5] [dup=2]');process.exit(1);}
  const L=tvRead(file,id),L2=tvClean(L,min),L3=tvStraight(L,min,tol,dup);
  fs.writeFileSync(JS+'trace-'+id2+'.js',tvFile(id2,L2,'калька '+id+' без мусора: связки ломаных короче '+min+' мм убраны'));
  fs.writeFileSync(JS+'trace-'+id3+'.js',tvFile(id3,L3,'калька '+id+' выпрямленная: без мусора < '+min+' мм, упрощена с допуском '+tol+' мм, дубли ближе '+dup+' мм слиты'));
  console.log(id+' сырая: '+stat(L));console.log(id2+' без мусора: '+stat(L2));console.log(id3+' выпрямленная: '+stat(L3));}
