/* ---------- режим «Углы»: расчёты без DOM и THREE (проверяются в tools/smoke.js) ----------
   R — результат buildParts (R.edges, R.parts, R.partOf), M3 — сетка {V, F}. Число угла — только из seamDih (как в таблице «Сварка с (угол)»),
   сам режим ничего не пересчитывает. Угломер (полукруглая головка + поворотная линейка) лежит СНАРУЖИ фигуры: прямой край головки —
   по наружной грани первой детали, линейка — по наружной грани второй, шарнир на шве, отодвинут от обеих граней на толщину листа. */
// цвета выбранных деталей по порядку тапов (дальше по кругу); без синего угломера #1f6fe0 и бледно-зелёных соседей #9fd49a
const ANG_COLORS=['#d0561f','#8e44ad','#e0b020','#c2185b','#1fa2a8','#8b5a2b','#f06292','#808000'];
const angColor=i=>ANG_COLORS[((i%8)+8)%8];
// общие рёбра деталей a и b; стыкуются ли они
const angEdges=(R,a,b)=>R.edges.filter(e=>e.p.length===2&&e.p.includes(a)&&e.p.includes(b));
const angAdj=(R,a,b)=>a!==b&&R.edges.some(e=>e.p.length===2&&e.p.includes(a)&&e.p.includes(b));
// пары выбранных с общим швом — в порядке выбора: [a, b], b выбрана позже
function angPairs(R,pick){const out=[];pick.forEach((b,i)=>pick.slice(0,i).forEach(a=>{if(angAdj(R,a,b))out.push([a,b]);}));return out;}
/* геометрия шва a–b: M — середина самого длинного ребра шва, u — вдоль шва, e1/e2 — от шва в грань a/b (по треугольнику детали у ребра:
   центр неровной детали может лежать по другую сторону), th — угол между e1 и e2 (рад), n1/n2 — НАРУЖНЫЕ нормали граней a и b:
   у выпуклого шва грань b уходит от наружной нормали a (dot(n1, e2) < 0), у вогнутого — к ней */
function angGeom(R,M3,a,b){const {V,F}=M3,E=angEdges(R,a,b);if(!E.length)return null;
  const e=E.reduce((x,y)=>y.len>x.len?y:x),A=V[e.a],B=V[e.b],M=V3.mul(V3.add(A,B),.5),u=V3.norm(V3.sub(B,A));
  const dirIn=pi=>{const p=R.parts[pi];let d=V3.norm(V3.cross(p.n,u));const fi=F.findIndex((f,i)=>R.partOf[i]===pi&&f.includes(e.a)&&f.includes(e.b)),
      w=fi>=0?F[fi].find(v=>v!==e.a&&v!==e.b):-1,q=w>=0?V[w]:p.c;if(V3.dot(V3.sub(q,M),d)<0)d=V3.mul(d,-1);return d;};
  const e1=dirIn(a),e2=dirIn(b),th=Math.acos(Math.max(-1,Math.min(1,V3.dot(e1,e2)))),conv=e.dih<=180;
  const out=(n,o)=>{const s=V3.dot(n,o);return Math.abs(s)>1e-9&&(conv?s>0:s<0)?V3.mul(n,-1):n;};
  return {E,M,u,e1,e2,th,n1:out(R.parts[a].n,e2),n2:out(R.parts[b].n,e1),conv};}
// числа для карточки: deg — как в таблице, other — по другой шкале угломера, kind — выступ/впадина, len — шов целиком, tpl — уголок-шаблон, bent — стык гнём
function angInfo(R,a,b,TPL,bentKey){const d=seamDih(R,a,b),deg=Math.round(d>180.5?360-d:d),len=angEdges(R,a,b).reduce((s,e)=>s+e.len,0);
  return {d,deg,other:180-deg,kind:d<=180.5?'выступ':'впадина',len,tpl:TPL&&TPL.find(o=>o.a===deg)||null,bent:!!(bentKey&&bentKey.has(bendKey(a,b)))};}
/* угломер на шве a–b, t — толщина листа: шарнир на шве, отодвинут по биссектрисе наружных нормалей ровно на t от обеих граней
   (у острого шва сдвиг больше — не дальше 4t); base — прямой край головки вдоль грани a, arm — линейка вдоль грани b, head — куда смотрит полукруг (наружу от a).
   У выпуклого шва линейка уходит от головки (её хвост через шарнир ложится на шкалу), у вогнутого головка стоит в «ямке» — на стороне линейки */
function gaugePose(R,M3,a,b,t){const G=angGeom(R,M3,a,b);if(!G)return null;const s=V3.add(G.n1,G.n2),sl=V3.len(s),half=sl/2;
  const bis=sl>1e-6?V3.mul(s,1/sl):G.n1,off=t/Math.max(half,.25),d=seamDih(R,a,b);
  return {hinge:V3.add(G.M,V3.mul(bis,off)),base:G.e1,arm:G.e2,head:G.n1,u:G.u,th:G.th,deg:Math.round(d>180.5?360-d:d)};}
// тап по детали pi (pi < 0 — мимо модели): повтор убирает, сосед выбранных добавляет, несоседняя — выбор заново с неё
function angTap(R,pick,pi){if(pi<0)return {pick:pick.slice(),note:''};if(pick.includes(pi))return {pick:pick.filter(x=>x!==pi),note:''};
  if(!pick.length||pick.some(a=>angAdj(R,a,pi)))return {pick:[...pick,pi],note:''};
  return {pick:[pi],note:`№ ${R.parts[pi].no} не стыкуется с выбранными — начал заново`};}
