/* ---------- раскладка по форме: копия из horse-r4t9p/js/prod.js (ptSegD, inPoly, segX, polyGap, polyDist, nestOrient, nestGen, nest) ----------
   Отличия от коня (дровокол, #165):
   - флипы берутся из item.flip: false — деталь только поворачивается (ручка: зеркальная A стала бы B), true — ещё и зеркально (пластина, ухо);
   - положения одной формы считаются один раз (item.shape — ключ формы): в заказе сотни одинаковых пластин;
   - поиск места продолжает с того, где остановился в прошлый раз для этого положения на этом листе: лист только заполняется,
     место, занятое раньше, свободным не станет — большой заказ (200 пластин + 100 ручек) не сканирует полные листы заново. Результат тот же, что у коня. */
function ptSegD(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function inPoly(p,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function segX(a,b,c,d){const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;}
function polyGap(A,B){let d=Infinity;for(let i=0;i<A.length;i++){const a=A[i],a2=A[(i+1)%A.length];for(let j=0;j<B.length;j++){const b=B[j],b2=B[(j+1)%B.length];if(segX(a,a2,b,b2))return 0;d=Math.min(d,ptSegD(a,b,b2),ptSegD(b,a,a2));}}if(inPoly(A[0],B)||inPoly(B[0],A))return 0;return d;}
function polyDist(P){return p=>{let d=Infinity;P.forEach((a,i)=>{d=Math.min(d,ptSegD(p,a,P[(i+1)%P.length]));});return d;};}
// направления, вдоль которых пробуем класть деталь: стороны контура, сложенные по углу (до 0,5°), — ORIENT_MAX самых длинных по сумме.
// У коня — каждая сторона; у дровокола дуги ломаной по 5° (пластина ~60 сторон) давали сотни положений и минуты счёта, а короткие стороны дуг
// плотной раскладке ничего не дают: деталь прижимается длинными прямыми сторонами
const ORIENT_MAX=6;
function edgeDirs(P){const m=new Map();P.forEach((a,i)=>{const b=P[(i+1)%P.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<1e-6)return;
    let g=Math.atan2(b[1]-a[1],b[0]-a[0]);if(g<0)g+=Math.PI;if(g>=Math.PI-1e-9)g-=Math.PI;const k=Math.round(g*360/Math.PI);const q=m.get(k)||{g,l:0};q.l+=l;m.set(k,q);});
  return [...m.values()].sort((x,y)=>y.l-x.l).slice(0,ORIENT_MAX).map(q=>q.g);}
function nestOrient(P,cell,r,flips=[false,true]){const out=[],seen=new Set();
  flips.forEach(flip=>{const Q0=flip?P.map(p=>[-p[0],p[1]]):P;edgeDirs(Q0).forEach(g=>{[0,Math.PI].forEach(add=>{
    const ang=-g+add,c=Math.cos(ang),s=Math.sin(ang);let Q=Q0.map(p=>[c*p[0]-s*p[1],s*p[0]+c*p[1]]);
    const mx=Math.min(...Q.map(q=>q[0])),my=Math.min(...Q.map(q=>q[1]));Q=Q.map(q=>[q[0]-mx,q[1]-my]);
    const key=Q.map(q=>Math.round(q[0])+','+Math.round(q[1])).sort().join(';');if(seen.has(key))return;seen.add(key);
    // клетки, чьи центры внутри детали, раздутой на ползазора (r — ползазора, мм); точный зазор проверяется отдельно
    const o=Math.ceil(r/cell)+1,w=Math.ceil(Math.max(...Q.map(q=>q[0]))/cell)+2*o+1,h=Math.ceil(Math.max(...Q.map(q=>q[1]))/cell)+2*o+1,core=new Uint8Array(w*h),dist=polyDist(Q);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=[(x-o+.5)*cell,(y-o+.5)*cell];if(inPoly(p,Q)||dist(p)<=r)core[y*w+x]=1;}
    const rows=m=>{const R=[];for(let y=0;y<h;y++){let x=0;const iv=[];while(x<w){if(m[y*w+x]){const s0=x;while(x<w&&m[y*w+x])x++;iv.push([s0,x-1]);}else x++;}R.push(iv);}return R;};
    const cr=rows(core);out.push({Q,w,h,o,core:cr,dil:cr,flip,tr:{f:flip,c,s,x:-mx,y:-my}});});});});
  return out;}
function nest(...a){const g=nestGen(...a);let v;do{v=g.next();}while(!v.done);return v.value;}
// items: [{id, no, pts, flip, shape}]; W — длинная сторона листа (по X), H — короткая; gap — зазор между деталями, margin — отступ от края
function* nestGen(items,W,H,gap,margin,cell=2.5,mode=2){const r=gap/2,GW=Math.floor((W-2*margin)/cell),GH=Math.floor((H-2*margin)/cell);
  const OR=new Map(),orOf=o=>{const k=o.shape||o.id;if(!OR.has(k))OR.set(k,nestOrient(o.pts,cell,r,o.flip?[false,true]:[false]));return OR.get(k);};
  const it=items.map(o=>({id:o.id,no:o.no,area:Math.abs(areaS(o.pts)),or:orOf(o)})).sort((a,b)=>mode===2?Math.max(...b.or.map(o=>o.w))-Math.max(...a.or.map(o=>o.w)):b.area-a.area);
  const sheets=[],too=[];
  const newSheet=()=>{const sh={items:[],occ:new Uint8Array(GW*GH),pre:new Int32Array((GW+1)*GH),len:0,st:new Map()};sheets.push(sh);return sh;};
  const free=(sh,R,x,y)=>{for(let ry=0;ry<R.length;ry++){const iv=R[ry];if(!iv.length)continue;const base=(y+ry)*(GW+1);for(const [a,b] of iv)if(sh.pre[base+x+b+1]-sh.pre[base+x+a])return false;}return true;};
  const gapOK=(sh,o,x,y)=>{const ox=margin+(x+o.o)*cell,oy=margin+(y+o.o)*cell,P=o.Q.map(q=>[q[0]+ox,q[1]+oy]),bx=[Math.min(...P.map(p=>p[0]))-gap,Math.min(...P.map(p=>p[1]))-gap,Math.max(...P.map(p=>p[0]))+gap,Math.max(...P.map(p=>p[1]))+gap];
    if(bx[0]<margin-.01||bx[1]<margin-.01||bx[2]>W-margin+gap+.01||bx[3]>H-margin+gap+.01)return false;
    for(const it of sh.items){const b=it.bb;if(b[0]>bx[2]||b[2]<bx[0]||b[1]>bx[3]||b[3]<bx[1])continue;if(polyGap(P,it.pts)<gap)return false;}return true;};
  // st — с какой клетки (x, y) продолжать поиск этого положения на этом листе: всё, что раньше по порядку обхода, уже занято
  const fit=(sh,o,limit)=>{const s=sh.st.get(o)||[0,0];let y0=s[1];
    for(let x=s[0];x+o.w<=GW;x++,y0=0){if(x+o.w>=limit){sh.st.set(o,[x,0]);return null;}for(let y=y0;y+o.h<=GH;y++)if(free(sh,o.dil,x,y)&&gapOK(sh,o,x,y)){sh.st.set(o,[x,y]);return {x,y};}}
    sh.st.set(o,[GW,0]);return null;};
  const place=(sh,o,x,y)=>{o.core.forEach((iv,ry)=>{const Y=y+ry;if(Y>=GH)return;iv.forEach(([a,b])=>{for(let X=x+a;X<=x+b&&X<GW;X++)sh.occ[Y*GW+X]=1;});
      const base=Y*(GW+1);let acc=0;for(let X=0;X<GW;X++){sh.pre[base+X]=acc;acc+=sh.occ[Y*GW+X];}sh.pre[base+GW]=acc;});};
  for(let pi=0;pi<it.length;pi++){const p=it[pi];let done=false;yield {done:pi,of:it.length};
    for(const sh of sheets.concat([null])){const S=sh||newSheet();let best=null;
      p.or.forEach(o=>{if(o.w>GW||o.h>GH)return;const f=fit(S,o,best?(mode?best.x+1+o.w:best.score):Infinity);if(f){const score=mode?f.x*1e4+f.y:f.x+o.w;if(!best||score<best.score||score===best.score&&f.y<best.y)best={o,...f,score,right:f.x+o.w};}});
      if(best){place(S,best.o,best.x,best.y);const ox=margin+(best.x+best.o.o)*cell,oy=margin+(best.y+best.o.o)*cell;
        const pts=best.o.Q.map(q=>[q[0]+ox,q[1]+oy]);const t=best.o.tr;S.items.push({id:p.id,no:p.no,flip:best.o.flip,tr:{...t,x:t.x+ox,y:t.y+oy},area:p.area,pts,bb:[Math.min(...pts.map(q=>q[0])),Math.min(...pts.map(q=>q[1])),Math.max(...pts.map(q=>q[0])),Math.max(...pts.map(q=>q[1]))]});S.len=Math.max(S.len,margin+best.right*cell);done=true;break;}
      if(!sh){sheets.pop();break;}}
    if(!done)too.push({id:p.id,no:p.no});}
  sheets.forEach(s=>{const a=s.items.reduce((q,o)=>q+o.area,0);s.used=a/(W*H);s.dense=a/((s.len-margin)*(H-2*margin)||1);delete s.occ;delete s.pre;delete s.st;});
  return {sheets,too,W,H,gap,used:sheets.length?sheets.reduce((a,s)=>a+s.used,0)/sheets.length:0};}
// точка детали в координатах листа: зеркало по x (f), поворот, сдвиг — как положила раскладка (из коня)
const trPt=(t,p)=>{const x=t.f?-p[0]:p[0];return [t.c*x-t.s*p[1]+t.x,t.s*x+t.c*p[1]+t.y];};
