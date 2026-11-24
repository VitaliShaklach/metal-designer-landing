/* ---------- Дровокол: геометрия деталей под лазер, мм ----------
   Числа — из спеки docs/superpowers/specs/2026-11-24-drovokol-design.md и черновика c:\Work\drovokol\plate.py (согласованы с Виталием на картинках 24.11).
   Деталь — {name, pts, holes}: pts — замкнутый контур против часовой (последняя точка не повторяет первую), holes — [[x, y, d]] отверстия.
   Дуги — ломаной с шагом ARC_STEP градусов. */
const ARC_STEP=5;
const deg=a=>a*Math.PI/180;
// точки дуги окружности (cx, cy, r) от a0 до a1 градусов включительно с шагом ARC_STEP (a1 < a0 — по часовой)
function arcPts(cx,cy,r,a0,a1){const n=Math.max(1,Math.round(Math.abs(a1-a0)/ARC_STEP)),out=[];
  for(let i=0;i<=n;i++){const a=deg(a0+(a1-a0)*i/n);out.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return out;}

/* ---------- пластина ×4 на комплект ----------
   Плоская, правый край прямой (к стене). X — от левого края габарита, Y — от низа */
const PLATE={H:420,W:100,HEAD_H:42,NECK:42,FILLET:5,PIVOT_D:13,HOLE_D:10.5,NOTCH:20,BOTTOM:70,
  TEETH:[[285,62],[225,65],[175,68],[125,71],[75,74]],   // [высота полки от низа, кончик от правого края]
  HOLES:[[40,400],[18,258],[18,133],[40,16]]};            // [от правого края, от низа] — болты M10
const plateX=r=>PLATE.W-r;   // «от правого края» → X
const PLATE_PIVOT=[plateX(PLATE.W-PLATE.HEAD_H/2),PLATE.H-PLATE.HEAD_H/2];   // ось ручки: центр скругления головы
const PLATE_HOLES=[[...PLATE_PIVOT,PLATE.PIVOT_D],...PLATE.HOLES.map(([r,y])=>[plateX(r),y,PLATE.HOLE_D])];
function plateOutline(){const P=PLATE,R=P.HEAD_H/2,pts=[[plateX(0),0],[plateX(0),P.H]];
  pts.push(...arcPts(PLATE_PIVOT[0],PLATE_PIVOT[1],R,90,270));                        // голова: левый конец скруглён R21
  pts.push(...arcPts(plateX(P.NECK)-P.FILLET,P.H-P.HEAD_H-P.FILLET,P.FILLET,90,0));   // внутренний угол под головой R5
  pts.push([plateX(P.NECK),P.TEETH[0][0]]);
  P.TEETH.forEach(([y,tip],i)=>{pts.push([plateX(tip),y]);                             // кончик зуба: полка горизонтальная
    pts.push(i+1<P.TEETH.length?[plateX(tip-P.NOTCH),P.TEETH[i+1][0]]:[plateX(P.BOTTOM),0]);});   // скос вниз-внутрь к впадине; от последнего — к низу
  return dedupe(pts);}
function plateHoles(){return PLATE_HOLES.map(h=>h.slice());}
function platePart(){return {name:'П',kind:'plate',pts:plateOutline(),holes:plateHoles(),flip:true};}

// соседние совпадающие точки (стык дуг и отрезков) — убрать: в DXF и в проверке самопересечений нулевые стороны не нужны
function dedupe(P){const out=[];P.forEach(p=>{const q=out[out.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6)out.push(p);});
  while(out.length>1&&Math.hypot(out[0][0]-out[out.length-1][0],out[0][1]-out[out.length-1][1])<1e-6)out.pop();return out;}
// площадь со знаком (против часовой — плюс)
function areaS(P){let a=0;P.forEach((p,i)=>{const q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];});return a/2;}
// площадь металла детали: контур минус отверстия, мм²
const partArea=p=>Math.abs(areaS(p.pts))-p.holes.reduce((s,h)=>s+Math.PI*h[2]*h[2]/4,0);
const perim=P=>P.reduce((s,p,i)=>{const q=P[(i+1)%P.length];return s+Math.hypot(q[0]-p[0],q[1]-p[1]);},0);
// длина реза детали: контур + окружности отверстий, мм
const partCut=p=>perim(p.pts)+p.holes.reduce((s,h)=>s+Math.PI*h[2],0);

/* ---------- ручка: 10 профилей (A/B × 1–5) × 3 длины = 30 вариантов ----------
   Построение — как handle_local в plate.py: ось в (0, 0), участок с лезвием вдоль +X, кромка лезвия со стороны +Y.
   A — излом к лезвию, B — от лезвия: контур B — зеркало A по оси участка с лезвием (y → −y), лезвие у обеих со стороны +Y.
   Миттер на изломе, фаска 45° на плече хвостовика, вокруг оси — полукруг R20 */
const HANDLE={W:40,BLADE:340,CAP:20,TANG_W:22,PIVOT_D:13,TANG_HOLE_D:6.5,TANG_HOLE_IN:25,BLADE_FROM:40,BLADE_END:10};
const HANDLE_PROFILES={1:{angle:160,stub:40},2:{angle:165,stub:30},3:{angle:170,stub:20},4:{angle:175,stub:10},5:{angle:178,stub:10}};
const HANDLE_LENS=[60,70,80];
const handleName=(type,prof,len)=>`${type}${prof}-${len}`;
// хвостовик: длина ручки по оси (len см) минус полукруг за осью, участок с лезвием и переход
const tangLen=(prof,len)=>len*10-HANDLE.CAP-HANDLE.BLADE-HANDLE_PROFILES[prof].stub;
function handlePart(type,prof,len){const H=HANDLE,pf=HANDLE_PROFILES[prof],s=type==='A'?1:-1,b=deg(180-pf.angle)*s,stub=pf.stub,tang=tangLen(prof,len),L2=stub+tang;
  const d2=[Math.cos(b),Math.sin(b)],n1=[0,1],n2=[-Math.sin(b),Math.cos(b)],add=(p,v,k)=>[p[0]+v[0]*k,p[1]+v[1]*k];
  const P1=[H.BLADE,0],P2=add(P1,d2,L2),Q=add(P1,d2,stub),h=H.W/2,ht=H.TANG_W/2,dot=n1[0]*n2[0]+n1[1]*n2[1];
  const side=[1,-1].map(sg=>{const m=[(n1[0]+n2[0])*sg*h/(1+dot),(n1[1]+n2[1])*sg*h/(1+dot)];
    return [add([0,0],n1,sg*h),[P1[0]+m[0],P1[1]+m[1]],add(Q,n2,sg*h),add(add(Q,d2,h-ht),n2,sg*ht),add(P2,n2,sg*ht)];});
  const [left,right]=side,cap=arcPts(0,0,H.CAP,90,270);
  const pts=dedupe([...right,...left.slice().reverse(),...cap.slice(1,-1)]);
  // отверстия хвостовика Ø6.5: 25 от конца, 25 от плеча (начала хвостовика) и посередине
  const holes=[[0,0,H.PIVOT_D],...[H.TANG_HOLE_IN,tang/2,tang-H.TANG_HOLE_IN].map(k=>[...add(P2,d2,-k),H.TANG_HOLE_D])];
  const part={name:handleName(type,prof,len),kind:'handle',type,prof,len,pts,holes,flip:false,tangLen:tang,
    bladeEdge:[[H.BLADE_FROM,h],[H.BLADE-H.BLADE_END,h]],axis:[[-H.CAP,0],P1,P2]};
  part.engr=bladeMark(part);return part;}
