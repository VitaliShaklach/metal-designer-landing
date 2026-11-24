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
