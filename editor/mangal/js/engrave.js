/* ---------- гравировка номеров деталей изнутри (#61) ----------
   Порт из рыси (editor/lynx/js/prod.js: DIGITS, innerPoint, engraveSegs): цифры из линий, лазер проходит их на малой мощности, слой ENGRAVE.
   Номер гравируется на внутренней стороне детали — снаружи собранного мангала красиво. Значит, деталь в DXF и на листе лежит внутренней
   стороной вверх: контур, нарисованный с наружной стороны (как в 3D), зеркалится по X в partMM. Здесь — какие детали и с какой стороны. */

// pt деталей, которые кладутся в DXF и на лист зеркально: partMM зеркалит контур по X, вверх смотрит сторона, нужная для гравировки (лазер гравирует только верх листа).
// Боковины и стенки — внутренняя сторона (номер читается изнутри): передняя боковина жаровни и печи (z = W−t, внутренняя грань смотрит в −z, вид изнутри — зеркало модели),
// левый торец жаровни и глухой верх топки (стенки у левого края, логотип рисуется с наружной стороны −x).
// Дно жаровни и печи — наружная сторона (низ, #121): к ней привариваются площадки ножек, разметка под них и номер — снизу; контур дна нарисован видом сверху.
// Задние боковины (side0, sK0), торцы, перегородки — прямоугольники или внутренняя грань уже смотрит в +z: контур как есть
// (вырез под ручку задней боковины — 220–280 мм от левого торца при виде изнутри).
const ENGR_MIRROR=new Set(['side1','sK1','gEnd0','lintel','gBot','sBot']);
// сторона гравировки у деталей без явной внутренней стороны — та, которую не видно на собранном мангале (выбор исполнителя, список показывается в таблице «С листа»):
// top/bottom — верх или низ детали в том положении, как она стоит на мангале. Контур у них не зеркалится (почти симметричны), кроме дна (gBot, sBot — в ENGR_MIRROR:
// отверстия поддувала несимметричны). Сторона нужна цеху: куда класть деталь гравировкой вверх.
const ENGR_HIDDEN={
  legs:'top',      // площадка под ножку: верхней гранью приварена к дну, нижнюю закрывает ножка
  pads:'top',      // площадка под колесо: верх приварен к дну, низ под колесом
  cgrH:'bottom',   // пластина ручки колосника: грань, что не торчит наружу
  grate:'bottom',  // колосник печи 15 мм: так же
  hook:'bottom',   // скоба задвижки: грань, что приваривается к боковине (ставится ребром)
  air:'bottom',    // задвижка поддува: нижняя — к дну, не видна
  shib:'bottom',   // шибер поддувала: нижняя грань
  div:'top',       // перегородка жаровни: обе стороны внутри, верх у ручки — выбрана сторона к задней боковине
  gBot:'bottom',   // дно жаровни: низ — к нему привариваются площадки ножек, снизу его не видно (#121)
  sBot:'bottom'};  // дно печи: так же

// цифра — клетка 1×2 (y вверх, как в DXF), между цифрами 0,5. «9» без нижней палочки — перевёрнутая она не похожа на «6»
const DIGITS={0:[[[0,0],[1,0],[1,2],[0,2],[0,0]]],1:[[[.5,0],[.5,2],[.2,1.7]],[[.2,0],[.8,0]]],2:[[[0,2],[1,2],[1,1],[0,1],[0,0],[1,0]]],3:[[[0,2],[1,2],[1,0],[0,0]],[[0,1],[1,1]]],
  4:[[[0,2],[0,1],[1,1]],[[1,2],[1,0]]],5:[[[1,2],[0,2],[0,1],[1,1],[1,0],[0,0]]],6:[[[1,2],[0,2],[0,0],[1,0],[1,1],[0,1]]],7:[[[0,2],[1,2],[1,0]]],
  8:[[[0,0],[1,0],[1,2],[0,2],[0,0]],[[0,1],[1,1]]],9:[[[1,1],[0,1],[0,2],[1,2],[1,0]]]};
// буквы для слова «низ» на дне (#119): та же клетка 1×2, ломаные. «з» — со скосами в углах, у «3» углы прямые: не спутать
const LETTERS={н:[[[0,0],[0,2]],[[1,0],[1,2]],[[0,1],[1,1]]],и:[[[0,2],[0,0],[1,2],[1,0]]],
  з:[[[0,1.75],[.25,2],[.75,2],[1,1.75],[1,1.25],[.75,1],[.25,1]],[[.75,1],[1,.75],[1,.25],[.75,0],[.25,0],[0,.25]]]};
const GLYPHS={...DIGITS,...LETTERS};
// отрезки строки t: клетка символа u × 2u мм, левый нижний угол (ox, oy), шаг 1,5 клетки. Неизвестный символ — ошибка, не пропуск
function glyphSegs(t,ox,oy,u){const seg=[];
  [...t].forEach((ch,i)=>{const G=GLYPHS[ch];if(!G)throw new Error(`гравировка: нет символа «${ch}»`);
    G.forEach(L=>{for(let k=0;k+1<L.length;k++)seg.push([ox+(i*1.5+L[k][0])*u,oy+L[k][1]*u,ox+(i*1.5+L[k+1][0])*u,oy+L[k+1][1]*u]);});});
  return seg;}
// строка str по центру в (x, y), высота символа h мм → отрезки [x1,y1,x2,y2]
function textSegs(str,x,y,h){const t=String(str),u=h/2,uw=t.length*1.5-.5;return glyphSegs(t,x-uw*u/2,y-h/2,u);}
// самое просторное место внутри детали P: точка, дальше всего от кромок (перебор по сетке + уточнение).
// o.holes — внутренние контуры, o.circ — окружности [x, y, r]: место не в отверстии и дальше всего от их краёв
function innerPoint(P,o={}){const dP=polyDist(P),H=(o.holes||[]).map(l=>[l,polyDist(l)]),C=o.circ||[],
    ok=p=>inPoly(p,P)&&!H.some(([l])=>inPoly(p,l))&&!C.some(([x,y,r])=>Math.hypot(p[0]-x,p[1]-y)<r),
    d=p=>{let v=dP(p);H.forEach(([,f])=>{v=Math.min(v,f(p));});C.forEach(([x,y,r])=>{v=Math.min(v,Math.hypot(p[0]-x,p[1]-y)-r);});return v;},
    xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  let best=null,bd=-1,step=Math.max(x1-x0,y1-y0)/24;
  for(let x=x0+step/2;x<x1;x+=step)for(let y=y0+step/2;y<y1;y+=step){const p=[x,y];if(!ok(p))continue;const v=d(p);if(v>bd){bd=v;best=p;}}
  if(!best)return null;
  for(let k=0;k<3;k++){step/=3;const c=best;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const p=[c[0]+i*step,c[1]+j*step];if(!ok(p))continue;const v=d(p);if(v>bd){bd=v;best=p;}}}
  return {p:best,r:bd};}
// отрезки гравировки номера no внутри детали P (мм, y вверх); null — деталь слишком узкая (меньше 3 мм высоты цифр).
// Сначала обходим отверстия (o.holes, o.circ); если между ними не поместилось — гравируем поверх них (лазеру там резать нечего)
function engraveSegs(no,P,o={}){
  const at=(ip,tight)=>{if(!ip)return null;const t=String(no),n=t.length,uw=n*1.5-.5,uh=2,clear=tight?1.5:(o.clear??2),
      u=Math.min((o.maxH||20)/2,(ip.r-clear)/Math.hypot(uw/2,uh/2));if(2*u<(o.minH||3))return null;
    const ox=ip.p[0]-uw*u/2,oy=ip.p[1]-uh*u/2;
    return glyphSegs(t,ox,oy,u);};
  const withHoles=(o.holes&&o.holes.length)||(o.circ&&o.circ.length);
  const ip=innerPoint(P);   // узкая деталь (скоба 12 мм): двузначный номер не влезает с отступом 2 мм — второй заход с 1,5 мм, высота цифр всё равно не меньше minH
  return (withHoles&&at(innerPoint(P,o)))||at(ip)||at(ip,true);}
// ---------- разметка на дне жаровни и печи (#123): квадраты под площадки ножек и «низ» ----------
// Дно лежит низом вверх (ENGR_MIRROR, #121): лазер гравирует наружную сторону, к ней сварщик ставит площадки 80 × 80 (шов по краю закроет контур).
// bottomMarks(p) — квадраты (замкнутые контуры, мм детали) с центрами в ножках legsList(), что стоят на этом дне
// (в «оба» у жаровни LEGS_M, у печи LEGS_K); без ножек (S.legs снята) — пусто. Не дно — null
function bottomMarks(p){const B=BOT_BOX[p.pt];if(!B)return null;const [x0,x1,z0,z1]=B(),T=partXY(p),a=LEG_PL*10/2;
  const squares=(S.legs?legsList():[]).filter(([x,z])=>x>x0&&x<x1&&z>z0&&z<z1).map(([x,z])=>{const [cx,cy]=T.xy(botXY([x,z]));
    return [[cx-a,cy-a],[cx+a,cy-a],[cx+a,cy+a],[cx-a,cy+a],[cx-a,cy-a]];});
  return {squares};}
const BOT_WORD='низ';
// гравировка дна: num — номер (квадраты обходит, как отверстия), word — «низ» той же высоты под номером с зазором 0,5 высоты
// (не влез — над номером; и там нет — в самом просторном месте мимо номера), sq — стороны квадратов. o — отверстия детали ({holes, circ}, как у engraveSegs)
function bottomEngr(no,P,o,mk){const holes=[...(o.holes||[]),...mk.squares.map(nestLoop).filter(Boolean)],circ=o.circ||[],clear=2;
  const sq=mk.squares.flatMap(L=>L.slice(0,-1).map((a,i)=>[a[0],a[1],L[i+1][0],L[i+1][1]])),num=engraveSegs(no,P,{holes,circ});
  const box=G=>{const xs=G.flatMap(z=>[z[0],z[2]]),ys=G.flatMap(z=>[z[1],z[3]]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
  // прямоугольник [x0,y0,x1,y1] внутри детали не ближе clear к кромке и не ближе clear к отверстиям и квадратам
  const dP=polyDist(P),free=([a,b,c,d])=>{const R=[[a,b],[c,b],[c,d],[a,d]];
    if(!R.every(q=>inPoly(q,P)&&dP(q)>=clear))return false;
    if(R.some((q,i)=>P.some((e,j)=>segX(q,R[(i+1)%4],e,P[(j+1)%P.length]))))return false;
    if(holes.some(l=>{const [hx0,hy0,hx1,hy1]=box(l.map((q,i)=>[...q,...l[(i+1)%l.length]]));return hx0<c+clear&&hx1>a-clear&&hy0<d+clear&&hy1>b-clear;}))return false;
    return !circ.some(([x,y,r])=>Math.hypot(Math.max(a-x,0,x-c),Math.max(b-y,0,y-d))<r+clear);};
  let word=null;
  if(num){const [nx0,ny0,nx1,ny1]=box(num),h=ny1-ny0,cx=(nx0+nx1)/2,ww=(BOT_WORD.length*1.5-.5)*h/2;
    for(const cy of [ny0-h,ny1+h])if(free([cx-ww/2,cy-h/2,cx+ww/2,cy+h/2])){word=textSegs(BOT_WORD,cx,cy,h);break;}
    if(!word){const g=clear;word=engraveSegs(BOT_WORD,P,{holes:[...holes,[[nx0-g,ny0-g],[nx1+g,ny0-g],[nx1+g,ny1+g],[nx0-g,ny1+g]]],circ});}}
  else word=engraveSegs(BOT_WORD,P,{holes,circ});
  return {num:num||[],word:word||[],sq};}
// длина отрезков, мм
const segsLen=S=>S?S.reduce((a,z)=>a+Math.hypot(z[2]-z[0],z[3]-z[1]),0):0;
