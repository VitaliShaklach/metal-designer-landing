/* ---------- прорези по линиям сгиба (v0.28.0) — геометрия без DOM ----------
   Фигура с дугами — {pts:[[x,y]…], b:[bulge…]}: b[i] — дуга на ребре pts[i]→pts[i+1] (последнее — к pts[0]), как код 42 в DXF:
   0 — прямая, ±1 — полуокружность (плюс — против часовой), |b| > 1 — дуга больше 180°. bulge = tan(θ/4) = 2·стрелка/хорда.
   Вдоль линии сгиба: край | крайняя прорезь (до края) | перемычка eb | средняя | перемычка br | … | средняя | перемычка eb | крайняя | край.
   Средние — замкнутые «таблетки» шириной w (концы — полуокружности), слой PERF; крайние прорези — часть контура CUT (тикет #136).
   Нет крайней с этой стороны — линия начинается с перемычки eb («Перемычка у кромки»). */
const SLOT_DEF={w:2,len:40,br:3,eb:3,el:5,notch:true,D:3};
/* раскладка вдоль линии длиной L → [[t0,t1],…] в мм от начала линии (вместе с закруглениями) или null — прорезей нет.
   openA/openB — с этой стороны крайняя прорезь до края; o = {w, len, br, eb, el} */
function slotPlan(L,openA,openB,o){const {w,len,br,eb,el}=o;let a=openA?el:0,b=openB?el:0;
  if(openA&&openB&&L<2*el+eb)a=b=(L-eb)/2;else if(openA&&!openB&&L<el+eb)a=L-eb;else if(openB&&!openA&&L<el+eb)b=L-eb;
  if(openA&&a<w||openB&&b<w)return null;   // крайняя вышла уже ширины — линия слишком короткая
  const s=a?a+eb:eb,e=L-(b?b+eb:eb),M=e-s,out=[];if(a)out.push([0,a]);
  if(M>=w){let n=1;while((M-(n-1)*br)/n>len+1e-9)n++;const c=(M-(n-1)*br)/n;for(let i=0;i<n;i++)out.push([s+i*(c+br),s+i*(c+br)+c]);}
  if(b)out.push([L-b,L]);return out.length?out:null;}
// дуга через точку m (середину дуги) от s до e: bulge со знаком (m справа от хорды s→e — дуга против часовой)
function bulgeVia(s,e,m){const c=Math.hypot(e[0]-s[0],e[1]-s[1])||1e-12,cr=(e[0]-s[0])*(m[1]-s[1])-(e[1]-s[1])*(m[0]-s[0]),h=Math.abs(cr)/c;return (cr<0?1:-1)*2*h/c;}
// «таблетка» на прямой a + u·t от t0 до t1 (длина вместе с закруглениями), ширина w: 4 точки, две полуокружности — середины дуг на t0 и t1
function slotShape(a,u,t0,t1,w){const r=w/2,n=[-u[1],u[0]],P=(t,k)=>[a[0]+u[0]*t+n[0]*k,a[1]+u[1]*t+n[1]*k],x0=t0+r,x1=Math.max(x0,t1-r);
  const pts=[P(x0,r),P(x1,r),P(x1,-r),P(x0,-r)];return {pts,b:[0,bulgeVia(pts[1],pts[2],P(t1,0)),0,bulgeVia(pts[3],pts[0],P(t0,0))]};}
// длина ребра с дугой: хорда c, θ = 4·atan(b) → c·θ / (2·sin(θ/2))
const arcLen=(p,q,b)=>{const c=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!b)return c;const th=Math.abs(4*Math.atan(b));return c*th/(2*Math.sin(th/2));};
const shapeLen=S=>S.pts.reduce((a,p,i)=>a+arcLen(p,S.pts[(i+1)%S.pts.length],S.b[i]||0),0);
// точки дуги p→q (без p, с q): k отрезков на полуокружность
function arcPts(p,q,b,k=8){if(!b)return [q];const th=4*Math.atan(b),c=Math.hypot(q[0]-p[0],q[1]-p[1]),m=[(p[0]+q[0])/2,(p[1]+q[1])/2],nl=[-(q[1]-p[1])/c,(q[0]-p[0])/c],d=c/2/Math.tan(th/2),
    o=[m[0]+nl[0]*d,m[1]+nl[1]*d],n=Math.max(2,Math.ceil(k*Math.abs(th)/Math.PI)),out=[];
  for(let i=1;i<=n;i++){const a=th*i/n,cs=Math.cos(a),sn=Math.sin(a),x=p[0]-o[0],y=p[1]-o[1];out.push(i===n?q:[o[0]+x*cs-y*sn,o[1]+x*sn+y*cs]);}return out;}
// дуги — ломаной (для SVG и проверок)
const shapeFlat=(S,k=8)=>{const out=[];S.pts.forEach((p,i)=>{const q=S.pts[(i+1)%S.pts.length];if(S.b[i])out.push(...arcPts(p,q,S.b[i],k).slice(0,-1));out.push(q);});out.unshift(out.pop());return out;};
// перенос фигуры (поворот, сдвиг, зеркало): зеркало меняет направление обхода — знаки дуг тоже
function shapeTr(S,T){const o=T([0,0]),x=T([1,0]),y=T([0,1]),mir=(x[0]-o[0])*(y[1]-o[1])-(x[1]-o[1])*(y[0]-o[0])<0;return {pts:S.pts.map(T),b:S.b.map(v=>mir&&v?-v:v)};}
// контур без дуг → фигура
const plainShape=P=>({pts:P,b:P.map(()=>0)});
/* сдвиг от концов линии a→a+u·L внутрь, чтобы до контура C (любой его кромки) от средней прорези осталось не меньше перемычки eb:
   линия подходит к кромке под острым углом — у отступа eb вдоль линии металла сбоку почти нет (у Д11 было 0,03 мм). Ближе всего к кромке — закругление
   первой прорези: круг Ø w с центром на eb + s + w/2. → [sA, sB] — сколько добавить к отступу у начала и у конца (шаг 0,25 мм); не вышло — null */
function slotTrim(a,u,L,C,o){const dC=polyDist(C),at=t=>[a[0]+u[0]*t,a[1]+u[1]*t],r=o.w/2,ok=t=>dC(at(t))-r>=o.eb-1e-6;
  const find=(t0,dir)=>{for(let s=0;s<=L;s+=.25)if(ok(t0+dir*(o.eb+s+r)))return s;return null;},sA=find(0,1),sB=find(L,-1);return sA==null||sB==null?null:[sA,sB];}
