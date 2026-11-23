/* ---------- разметка на фигуре (#150): «Линия», «Зачеркнуть» (и «Карандаш», #151) — штрихи поверх граней, фигура от них не меняется до «Нарезать» ----------
   штрих {k:'line'|'pen'|'cross', pts:[[x,y,z],…] (кадр фигуры, мм), closed?:true}; хранится в браузере по фигуре (mkKey) */
const MK_KINDS=['line','pen','cross'],MK_SNAP=5,MK_AXIS=1;   // магнит к линии кальки, мм; штрих в MK_AXIS мм от x = 0 целиком — на оси симметрии, не зеркалится
const mkKey=fig=>'shepherd-mk-'+fig;
// → [] при пустом/битом; лишнее отбрасывается: штрих — известный вид и ≥ 1 точки из трёх конечных чисел
function mkLoad(raw){let a;try{a=JSON.parse(raw);}catch(e){return [];}if(!Array.isArray(a))return [];
  return a.filter(s=>s&&MK_KINDS.includes(s.k)&&Array.isArray(s.pts)&&s.pts.length&&s.pts.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))
    .map(s=>{const o={k:s.k,pts:s.pts.map(p=>p.slice())};if(s.closed===true)o.closed=true;return o;});}
function mkSave(mk){return JSON.stringify(mk.map(s=>{const o={k:s.k,pts:s.pts.map(p=>p.map(x=>Math.round(x*100)/100))};if(s.closed)o.closed=true;return o;}));}
// зеркальная копия (x → −x); штрих на оси симметрии — null (не двоится)
function mkMirror(s){if(s.pts.every(p=>Math.abs(p[0])<=MK_AXIS))return null;const o={k:s.k,pts:s.pts.map(p=>[-p[0],p[1],p[2]])};if(s.closed)o.closed=true;return o;}
// замкнут ли (концы ближе 6 мм, и сам штрих заметно длиннее этого)
function mkClosed(pts,eps=6){if(pts.length<3)return false;const a=pts[0],b=pts[pts.length-1];let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);
  return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<eps&&L>eps*4;}
// магнит: ближайшая точка нарисованных линий кальки (отрезки seg — пары точек, как из tlinesOnFigure) к p в радиусе r; нет — p как есть
function mkSnap(p,seg,on=true,r=MK_SNAP){if(!on||!seg||!seg.length)return p;
  if(!seg._g){const n=seg.length/6,items=[];for(let k=0;k<n;k++)items.push(k);seg._g=tlGrid(items,k=>[[0,1,2].map(i=>Math.min(seg[k*6+i],seg[k*6+3+i])),[0,1,2].map(i=>Math.max(seg[k*6+i],seg[k*6+3+i]))],8,0);}
  const G=seg._g,cs=G.cs,R=Math.ceil(r/cs),seen=new Set();let best=null,bd=r;
  for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++)for(const k of G.get((Math.floor(p[0]/cs)+dx)+','+(Math.floor(p[1]/cs)+dy)+','+(Math.floor(p[2]/cs)+dz))||[]){if(seen.has(k))continue;seen.add(k);
    const o=k*6,ab=[seg[o+3]-seg[o],seg[o+4]-seg[o+1],seg[o+5]-seg[o+2]],l2=ab[0]**2+ab[1]**2+ab[2]**2,t=l2?Math.max(0,Math.min(1,((p[0]-seg[o])*ab[0]+(p[1]-seg[o+1])*ab[1]+(p[2]-seg[o+2])*ab[2])/l2)):0,
      c=[seg[o]+ab[0]*t,seg[o+1]+ab[1]*t,seg[o+2]+ab[2]*t],d=Math.hypot(c[0]-p[0],c[1]-p[1],c[2]-p[2]);if(d<=bd){bd=d;best=c;}}
  return best||p;}
/* «Карандаш» (#151) без настроек: стабилизатор (точка тянется за курсором на нитке r мм — дрожь руки меньше r не доходит) → Дуглас — Пекер 0,7 мм → Чайкин ×2 (углы скругляются);
   концы — первая и последняя точки руки; замкнутая (концы ближе 6 мм) — кольцо без повтора первой точки, сглаживание по кругу */
function mkSmooth(pts,r=4){if(pts.length<3)return pts.map(p=>p.slice());const closed=mkClosed(pts),D=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  let c=pts[0].slice();const st=[c.slice()];for(let i=1;i<pts.length;i++){const p=pts[i],d=D(p,c);if(d<=r)continue;c=c.map((x,k)=>x+(p[k]-x)*(d-r)/d);if(D(c,st[st.length-1])>=.5)st.push(c.slice());}
  if(closed){st.push(st[0].slice());}else st.push(pts[pts.length-1].slice());
  let q=mkDP(st,.7);
  const ch=(a,ring)=>{const o=ring?[]:[a[0]],n=a.length-1;for(let i=0;i<n;i++){const A=a[i],B=a[i+1];o.push(A.map((x,k)=>x*.75+B[k]*.25),A.map((x,k)=>x*.25+B[k]*.75));}if(ring)o.push(o[0].slice());else o.push(a[n]);return o;};
  for(let k=0;k<2;k++)q=ch(q,closed);return closed?q.slice(0,-1):q;}
function mkDP(l,eps){if(l.length<3)return l;const keep=new Uint8Array(l.length);keep[0]=keep[l.length-1]=1;const st=[[0,l.length-1]];
  while(st.length){const [a,b]=st.pop(),A=l[a],B=l[b],ab=[0,1,2].map(k=>B[k]-A[k]),L2=ab[0]**2+ab[1]**2+ab[2]**2;let bi=-1,bd=eps*eps;
    for(let i=a+1;i<b;i++){const ap=[0,1,2].map(k=>l[i][k]-A[k]),t=L2?Math.max(0,Math.min(1,(ap[0]*ab[0]+ap[1]*ab[1]+ap[2]*ab[2])/L2)):0,d=(ap[0]-ab[0]*t)**2+(ap[1]-ab[1]*t)**2+(ap[2]-ab[2]*t)**2;if(d>bd){bd=d;bi=i;}}
    if(bi>=0){keep[bi]=1;st.push([a,bi],[bi,b]);}}
  return l.filter((_,i)=>keep[i]);}
// штрих карандаша из точек руки: сгладить → магнит по каждой точке → замкнутость
function mkPen(raw,seg,magnet){const closed=mkClosed(raw),p=mkSmooth(raw).map(q=>mkSnap(q,seg,magnet)),o={k:'pen',pts:p};if(closed)o.closed=true;return o;}
// штрихи → отрезки на поверхности фигуры: прямая между точками штриха — по поверхности (через 2 мм на ближайшую грань, подъём 0,6 мм), как линии кальки
function mkDrape(list,V,P,FT){if(!list.length)return new Float32Array(0);const pts=[],S=[];list.forEach(s=>{S.push(pts.length/3);const q=s.closed?[...s.pts,s.pts[0]]:s.pts;(q.length===1?[q[0],q[0]]:q).forEach(p=>pts.push(...p));});S.push(pts.length/3);
  const ID=p=>p;ID.inv=p=>p;return tlinesOnFigure({n:list.length,S:Uint32Array.from(S),P:Float32Array.from(pts)},ID,V,P,40,FT);}
