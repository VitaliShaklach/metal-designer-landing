/* ---------- «Рассчитать»: раскладка заказа по листам, цифры, DXF ---------- */
const STEEL=7850;   // кг/м³
// самое просторное место внутри детали (для подписи на картинке листа): точка, дальше всего от кромок и отверстий
function labelPt(p){const d=polyDist(p.pts),xs=p.pts.map(q=>q[0]),ys=p.pts.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const v=q=>{if(!inPoly(q,p.pts))return -1;let m=d(q);p.holes.forEach(h=>{m=Math.min(m,Math.hypot(q[0]-h[0],q[1]-h[1])-h[2]/2);});return m;};
  let best=[(x0+x1)/2,(y0+y1)/2],bv=-1;const st=Math.max(x1-x0,y1-y0)/40;
  for(let x=x0+st/2;x<x1;x+=st)for(let y=y0+st/2;y<y1;y+=st){const q=[x,y],w=v(q);if(w>bv){bv=w;best=q;}}
  return best;}
// раскладка заказа o по шагам: yield {done, of} — сколько деталей уже разложено; в конце — результат
// {sheets:[{items:[{id, name, pts, holes, engr, lab, tr}], used, len}], too:[name], W, H, stats:{sheets, fill, cutLen, pierces, mass, byKind}, empty}
function* runOrderGen(o){const [W,H]=sheetWH(o),parts=orderParts(o),items=[],byId=[];
  parts.forEach(({part,n,flip})=>{const lab=labelPt(part);for(let i=0;i<n;i++){const id=items.length;byId.push({part,lab});items.push({id,no:part.name,pts:part.pts,flip,shape:part.name});}});
  const empty=!items.length;
  const N=empty?{sheets:[],too:[]}:yield* nestGen(items,W,H,o.gap,o.margin);
  const sheets=N.sheets.map(s=>({used:s.used,len:s.len,items:s.items.map(it=>{const {part,lab}=byId[it.id],T=q=>trPt(it.tr,q);
    return {id:it.id,name:part.name,pts:it.pts,holes:part.holes.map(h=>[...T(h),h[2]]),engr:(part.engr||[]).map(z=>[...T([z[0],z[1]]),...T([z[2],z[3]])]),lab:T(lab),tr:it.tr};})}));
  const placed=sheets.flatMap(s=>s.items.map(it=>byId[it.id].part)),byKind={};
  placed.forEach(p=>{byKind[p.name]=(byKind[p.name]||0)+1;});
  const stats={sheets:sheets.length,fill:sheets.length?sheets.reduce((a,s)=>a+s.used,0)/sheets.length:0,
    cutLen:placed.reduce((a,p)=>a+partCut(p),0),pierces:placed.reduce((a,p)=>a+1+p.holes.length,0),
    mass:placed.reduce((a,p)=>a+partArea(p),0)*o.t*1e-9*STEEL,byKind};
  return {sheets,too:N.too.map(t=>byId[t.id].part.name),W,H,stats,empty};}
function runOrder(o){const g=runOrderGen(o);let v;do{v=g.next();}while(!v.done);return v.value;}
// DXF всего заказа: листы рядом по X через 100 мм; SHEET — контур листа, CUT — контуры (POLYLINE) и отверстия (CIRCLE), ENGRAVE — гравировка (LINE)
const SHEET_STEP=100;
function orderDxf(res){const e=[];
  res.sheets.forEach((s,i)=>{const ox=i*(res.W+SHEET_STEP);
    dxfPoly(e,[[0,0],[res.W,0],[res.W,res.H],[0,res.H]],'SHEET',ox,0);
    s.items.forEach(it=>{dxfPoly(e,it.pts,'CUT',ox,0);it.holes.forEach(h=>dxfCircle(e,h[0],h[1],h[2],'CUT',ox,0));if(it.engr.length)dxfSegs(e,it.engr,'ENGRAVE',ox,0);});});
  return dxfDoc(e);}
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dxfName=(o,d=new Date())=>`drovokol-${o.t}mm-${ymd(d)}.dxf`;
