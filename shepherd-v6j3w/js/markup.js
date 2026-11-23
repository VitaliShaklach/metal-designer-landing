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
// штрихи → отрезки на поверхности фигуры: прямая между точками штриха — по поверхности (через 2 мм на ближайшую грань, подъём 0,6 мм), как линии кальки
function mkDrape(list,V,P,FT){if(!list.length)return new Float32Array(0);const pts=[],S=[];list.forEach(s=>{S.push(pts.length/3);const q=s.closed?[...s.pts,s.pts[0]]:s.pts;(q.length===1?[q[0],q[0]]:q).forEach(p=>pts.push(...p));});S.push(pts.length/3);
  const ID=p=>p;ID.inv=p=>p;return tlinesOnFigure({n:list.length,S:Uint32Array.from(S),P:Float32Array.from(pts)},ID,V,P,40,FT);}
