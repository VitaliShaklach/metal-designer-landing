/* ---------- Листы А3 для производства фигуры ----------
   SVG в мм бумаги (420×297): общий вид, порядок сборки, детали (развёртки), спецификация, раскрой листа.
   Помощники — по образцу karkas/js/sheets.js. */
const SH_EMAIL='vashaklach@gmail.com',SCALES=[1,2,2.5,4,5,10,15,20,25,40,50,75,100];
const r2=x=>Math.round(x*100)/100;
const shEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
// подпись для читалок экрана: role="img" и <title> первым в svg (в печати и на экране не рисуется, размер листа не трогает); id сквозной — не повторяется на странице и в печати
let SVG_N=0;const svgAlt=t=>{const id='svgt'+(++SVG_N);return [` role="img" aria-labelledby="${id}"`,`<title id="${id}">${shEsc(t)}</title>`];};
const pickScale=(need,avail)=>SCALES.find(n=>need.every((v,i)=>v/n<=avail[i]))||SCALES[SCALES.length-1];
const scaleTxt=n=>'1:'+String(n).replace('.',',');
// виды: r — вправо на листе, up — вверх, d — к зрителю. Вид слева — справа от главного, вид сверху — под ним
const VIEWS={front:{r:[1,0,0],up:[0,1,0],d:[0,0,1]},left:{r:[0,0,1],up:[0,1,0],d:[-1,0,0]},top:{r:[1,0,0],up:[0,0,-1],d:[0,1,0]}};
(()=>{const d=V3.norm([1,.75,1.5]),r=V3.norm(V3.cross([0,1,0],d));VIEWS.iso={r,up:V3.cross(d,r),d};})();
const prjV=(v,p)=>[V3.dot(p,v.r),-V3.dot(p,v.up)];
const arrow=(x,y,ux,uy)=>`<path class="ar" d="M${r2(x)},${r2(y)}L${r2(x-ux*2.5-uy*.6)},${r2(y-uy*2.5+ux*.6)}L${r2(x-ux*2.5+uy*.6)},${r2(y-uy*2.5-ux*.6)}Z"/>`;
function dimH(xa,ya,xb,yb,yl,t){if(xb<xa)[xa,ya,xb,yb]=[xb,yb,xa,ya];const L=xb-xa;if(L<.3)return '';const sa=yl>ya?1:-1,sb=yl>yb?1:-1;
  let s=`<path class="t" d="M${r2(xa)},${r2(ya+sa)}V${r2(yl+sa*2)}M${r2(xb)},${r2(yb+sb)}V${r2(yl+sb*2)}M${r2(xa)},${r2(yl)}H${r2(xb)}`;
  const out=L<7;s+=out?`M${r2(xa-5)},${r2(yl)}H${r2(xa)}M${r2(xb)},${r2(yl)}H${r2(xb+5)}"/>`+arrow(xa,yl,1,0)+arrow(xb,yl,-1,0):'"/>'+arrow(xa,yl,-1,0)+arrow(xb,yl,1,0);
  return s+`<text x="${r2((xa+xb)/2)}" y="${r2(yl-1)}" text-anchor="middle">${t}</text>`;}
function dimV(xa,ya,xb,yb,xl,t){if(yb<ya)[xa,ya,xb,yb]=[xb,yb,xa,ya];const L=yb-ya;if(L<.3)return '';const sa=xl>xa?1:-1,sb=xl>xb?1:-1;
  let s=`<path class="t" d="M${r2(xa+sa)},${r2(ya)}H${r2(xl+sa*2)}M${r2(xb+sb)},${r2(yb)}H${r2(xl+sb*2)}M${r2(xl)},${r2(ya)}V${r2(yb)}"/>`+arrow(xl,ya,0,-1)+arrow(xl,yb,0,1);
  return s+`<text transform="translate(${r2(xl-1)},${r2((ya+yb)/2)}) rotate(-90)" text-anchor="middle">${t}</text>`;}
function svgTable(x,y,cols,rows,rh=7){const W=cols.reduce((s,c)=>s+c.w,0),H=rh*(rows.length+1);let s=`<rect class="l" x="${x}" y="${y}" width="${W}" height="${H}"/><path class="t" d="`;
  for(let i=1;i<=rows.length;i++)s+=`M${x},${y+i*rh}H${x+W}`;let xx=x;cols.slice(0,-1).forEach(c=>{xx+=c.w;s+=`M${xx},${y}V${y+H}`;});s+='"/>';
  [cols.map(c=>c.t),...rows].forEach((r,ri)=>{let cx=x;r.forEach((v,i)=>{const c=cols[i],mx=Math.floor(c.w/1.55);let t=String(v);if(t.length>mx)t=t.slice(0,mx-1)+'…';
    s+=`<text class="td" x="${r2(ri===0?cx+c.w/2:c.r?cx+c.w-1.2:cx+1.2)}" y="${r2(y+ri*rh+rh-2)}"${ri===0?' text-anchor="middle"':c.r?' text-anchor="end"':''}>${shEsc(t)}</text>`;cx+=c.w;});});
  return s;}
// стили листа — только внутри svg.shs: иначе .no, .bv и др. действуют на всю страницу (эскизы в панели и таблице)
const SH_STYLE='<style>'+`.l{fill:none;stroke:#000;stroke-width:.35;stroke-linejoin:round}.t{fill:none;stroke:#000;stroke-width:.18}.dash{fill:none;stroke:#000;stroke-width:.15;stroke-dasharray:1.2 .8}.fr{fill:none;stroke:#000;stroke-width:.7}.eng{fill:none;stroke:#c33;stroke-width:.12}.seam{fill:none;stroke:#d01f1f;stroke-width:.8;stroke-linecap:round}.ag{fill:none;stroke:#000;stroke-width:.3;stroke-linecap:round}.engb{stroke-opacity:.45}.pw{fill:none;stroke-width:.75;stroke-linecap:round;stroke-linejoin:round}.tw{fill:#f3d27a;stroke:#8a6d1a;stroke-width:.15}.bl3{fill:none;stroke:#1f5fd0;stroke-width:.45;stroke-dasharray:1.6 .8}.bnd{fill:none;stroke:#000;stroke-width:.18;stroke-dasharray:4 1 .4 1 .4 1}.bv{stroke:#c33}.bm{stroke:#33c}.small{fill:none;stroke:#c33;stroke-width:.35}.fc{stroke:#000;stroke-width:.15;stroke-linejoin:round}.ar{fill:#000}.prf{fill:none;stroke:#000;stroke-width:.45;stroke-linecap:butt}text{font-family:"Arial Narrow",Arial,sans-serif;font-style:italic;fill:#000;font-size:3.5px}.hd{font-size:6px}.h2{font-size:4.5px}.sm,.lb{font-size:2.3px}.trq{font-size:4px}.trh{font-size:5.4px}.td{font-size:2.8px}.no{font-size:2.6px;font-style:normal;font-weight:bold}.nb{font-size:2.1px;fill:#a33}.big{font-size:5px;font-style:normal;font-weight:bold}`.replace(/([^{}]+)\{/g,(m,sel)=>sel.split(',').map(x=>'svg.shs '+x.trim()).join(',')+'{')+'</style>';
// рамка и основная надпись (только email — по просьбе автора)
// основная надпись 185 × 16, x, y — левый верхний угол; b.mass — масса куска (на карте), иначе всей фигуры
function stamp(x,y,b,o){const c=[95,30,30,30],cell=(i,row,lab,val)=>{const xx=x+c.slice(0,i).reduce((s,v)=>s+v,0),yy=y+row*8;return `<text class="lb" x="${xx+1}" y="${yy+2.6}">${lab}</text><text class="td" x="${xx+1.2}" y="${yy+6.6}">${shEsc(val)}</text>`;};
  let xs=x,v='';c.slice(0,-1).forEach(w=>{xs+=w;v+=`M${xs},${y}V${y+16}`;});const nm=ST.name||'Фигура';
  return `<rect class="fr" x="${x}" y="${y}" width="185" height="16"/><path class="t" d="M${x},${y+8}H${x+185}${v}"/>`+cell(0,0,'Изделие',nm)+cell(1,0,'Масштаб',b.scale||'—')+cell(2,0,'Масса',`≈ ${b.mass||fmt(CUR.T.mass,1)+' кг'}`)+cell(3,0,'Металл',`${ST.t} мм`)
    +cell(0,1,'email',SH_EMAIL)+cell(1,1,'Дата',o.date)+cell(2,1,'Лист',String(o.n))+cell(3,1,'Листов',String(o.N));}
function wrapSheet(b,o){const nm=ST.name||'Фигура',tb=stamp(230,276,b,o),[ra,tt]=svgAlt(`«${nm}», лист ${o.n} из ${o.N} (А3): ${b.alt||b.title}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="shs" viewBox="0 0 420 297" width="420mm" height="297mm"${ra}>${tt}${SH_STYLE}<rect width="420" height="297" fill="#fff"/><rect class="fr" x="20" y="5" width="395" height="287"/><path class="l" d="M20,17H415"/>`
    +`<text class="hd" x="25" y="13.5">${shEsc(nm)}</text><text class="h2" x="410" y="13.5" text-anchor="end">${shEsc(b.title)}</text>${b.body}${tb}<text class="sm" x="415" y="295.6" text-anchor="end">Формат А3</text></svg>`;}

/* ---------- фигура гранями: проекция, тень по нормали, номера ---------- */
function projBox(view){const b=[1e9,1e9,-1e9,-1e9];CUR.M3.V.forEach(p=>{const q=prjV(view,p);b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);});return b;}
const grey=v=>{const c=Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0');return '#'+c+c+c;};
function facesSVG(view,k,ox,oy,o={}){const V=CUR.M3.V,L=V3.norm(V3.add(V3.add(view.d,V3.mul(view.up,.7)),V3.mul(view.r,-.4)));
  const P=(p)=>{const q=prjV(view,p);return [ox+q[0]*k,oy+q[1]*k];};let s='';const lb=[];
  CUR.R.parts.filter(p=>(!o.only||o.only(p))&&V3.dot(p.n,view.d)>.02).sort((a,b)=>V3.dot(a.c,view.d)-V3.dot(b.c,view.d)).forEach(p=>{
    const pts=p.full.map(i=>P(V[i])),sh=.5+.45*Math.max(0,V3.dot(p.n,L));const fill=o.color?o.color(p,sh):grey(.35+.6*sh);
    s+=`<polygon class="fc" fill="${fill}" points="${pts.map(q=>r2(q[0])+','+r2(q[1])).join(' ')}"/>`;
    if(o.label&&o.label(p)){const a=Math.abs(area2(pts));if(a>12)lb.push({t:String(p.no),pts,a});}});
  return s+placeLabels(lb,2.6).map(l=>`<text class="no" x="${r2(l.x)}" y="${r2(l.y+l.h*.35)}" text-anchor="middle"${l.f<1?` style="font-size:${r2(l.h)}px"`:''}>${l.t}</text>`).join('');}
// подписи без наложений (L — {t, pts, a}, fs — высота букв): большие грани — первыми; место — самая просторная точка грани,
// занято — точки вокруг неё внутри грани, потом мельче, потом рядом снаружи; некуда — без номера. cw — ширина буквы к высоте. avoid — уже занятые прямоугольники
function placeLabels(L,fs,cw=.52,avoid=[]){const box=avoid.slice(),out=[],hit=b=>box.some(c=>b[0]<c[2]&&b[2]>c[0]&&b[1]<c[3]&&b[3]>c[1]);
  L.sort((a,b)=>b.a-a.a).forEach(l=>{const ip=innerPoint(l.pts);if(!ip)return;
    for(const f of [1,.8,.65]){const h=fs*f,w=l.t.length*h*cw,st=Math.max(w,h)*.4,cand=[ip.p];for(let r=1;r<=5;r++)for(let a=0;a<8;a++)cand.push([ip.p[0]+Math.cos(a*Math.PI/4)*st*r,ip.p[1]+Math.sin(a*Math.PI/4)*st*r]);
      for(const c of cand){if(!inPoly(c,l.pts))continue;const b=[c[0]-w/2-.2,c[1]-h/2-.1,c[0]+w/2+.2,c[1]+h/2+.1];if(hit(b))continue;box.push(b);out.push({t:l.t,x:c[0],y:c[1],h,f});return;}}
    // грань узкая (видна вскользь) — рядом с ней снаружи, мельче; и там тесно — без номера: лучше, чем номера друг на друге
    const h=fs*.65,w=l.t.length*h*cw;for(let r=1;r<=4;r++)for(let a=0;a<8;a++){const c=[ip.p[0]+Math.cos(a*Math.PI/4)*w*.55*r,ip.p[1]+Math.sin(a*Math.PI/4)*h*.9*r],b=[c[0]-w/2-.2,c[1]-h/2-.1,c[0]+w/2+.2,c[1]+h/2+.1];
      if(!hit(b)){box.push(b);out.push({t:l.t,x:c[0],y:c[1],h,f:.65});return;}}});
  return out;}

/* ---------- 1. общий вид ---------- */
function sheetGeneral(){const T=CUR.T,b=meshBox(CUR.M3.V),[W,H,D]=b.size,bf=projBox(VIEWS.front),bl=projBox(VIEWS.left),bt=projBox(VIEWS.top);
  const n=pickScale([W+D,H+D],[235,215]),k=1/n,x0=48,y0=32,fx=x0-bf[0]*k,fy=y0-bf[1]*k,gap=26;
  const lx=x0+(bf[2]-bf[0])*k+gap-bl[0]*k,ly=fy,tx=fx,ty=y0+(bf[3]-bf[1])*k+gap-bt[1]*k;
  let s=facesSVG(VIEWS.front,k,fx,fy,{label:()=>1})+facesSVG(VIEWS.left,k,lx,ly)+facesSVG(VIEWS.top,k,tx,ty);
  const F=[x0,y0,x0+(bf[2]-bf[0])*k,y0+(bf[3]-bf[1])*k],Lb=[lx+bl[0]*k,ly+bl[1]*k,lx+bl[2]*k,ly+bl[3]*k],Tb=[tx+bt[0]*k,ty+bt[1]*k,tx+bt[2]*k,ty+bt[3]*k];
  s+=dimV(F[0],F[1],F[0],F[3],F[0]-10,Math.round(H))+dimH(Tb[0],Tb[3],Tb[2],Tb[3],Tb[3]+9,Math.round(W))+dimH(Lb[0],Lb[3],Lb[2],Lb[3],Lb[3]+9,Math.round(D));
  s+=`<text class="sm" x="${r2((F[0]+F[2])/2)}" y="${r2(F[1]-3)}" text-anchor="middle">Вид спереди</text><text class="sm" x="${r2((Lb[0]+Lb[2])/2)}" y="${r2(Lb[1]-3)}" text-anchor="middle">Вид слева</text><text class="sm" x="${r2((Tb[0]+Tb[2])/2)}" y="${r2(Tb[1]-3)}" text-anchor="middle">Вид сверху</text>`;
  const [sl,sw]=sheetWL(),BS=CUR.BL&&CUR.BL.length?CUR.bendSt:null,PS=perfOn()&&BS?cutStats(CUR.N.sheets.flatMap(s=>s.items)):null,rows=[['Материал',MATN[ST.mat]],['Толщина листа',ST.t+' мм'],['Деталей',T.n],...(BS?[['Заготовок со сгибами',`${CUR.BL.length} (и отдельных деталей ${CUR.PC.length-CUR.BL.length})`],['Сгибов V / m',`${BS.V} / ${BS.m}`]]:[]),['Площадь металла',fmt(T.area/1e6,2)+' м²'],['Масса',`≈ ${fmt(T.mass,1)} кг`],
    ['Длина реза',fmt(CUR.cutLen/1000,1)+' м'],...(PS&&PS.perf?[['Перфорация (PERF)',perfTxt(PS).replace(' м реза',' м')]]:[]),['Длина швов',fmt((T.weld-(BS?BS.len:0))/1000,1)+' м'],['Сварка, зазор шва',`${WELDN[weldOf()]}, ${mmT(ST.gap)} мм`],[`Листов ${sw}×${sl}`,CUR.N.sheets.length+` (заполнение ${Math.round(CUR.N.used*100)}% от всего листа)`]];
  s+=svgTable(300,22,[{t:'Параметр',w:58},{t:'Значение',w:55}],rows,5.6);
  // техтребования — внизу справа, как можно шире: левее, под видами, если они кончились выше блока; до правой рамки
  const trAt=x=>{const T=techReq(!!BS,411-x),ry=262.4-2-(T.length-1)*TR_P;return {x,T,ry};},trOk=o=>[[F,10],[Lb,15],[Tb,15]].every(([b,m])=>b[2]<o.x-4||o.ry-7>b[3]+m);
  const TB=[F[2],Lb[2],Tb[2]].map(v=>v+8).filter(v=>v<300).sort((a,b)=>a-b).concat(300).map(trAt).find(o=>o.x>=300||trOk(o)),TR=TB.T,ry=TB.ry,bi=projBox(VIEWS.iso),it=Math.max(95,22+(rows.length+1)*5.6+3),ih=ry-7-it,ki=Math.min(110/(bi[2]-bi[0]),(ih-10)/(bi[3]-bi[1]));s+=facesSVG(VIEWS.iso,ki,300+(113-(bi[2]-bi[0])*ki)/2-bi[0]*ki,it+(ih-(bi[3]-bi[1])*ki)/2-bi[1]*ki);   // под таблицей; ниже — технические требования
  s+=wrapTxt('Номера на гранях — номера деталей (вид спереди). Порядок сборки — следующие листы, каждый элемент и деталь — на своей карте (PDF А4).',Math.floor((411-TB.x)/(.43*2.3))).map((t,i,a)=>`<text class="sm" x="${r2(TB.x)}" y="${r2(269-(a.length-1-i)*2.9)}">${shEsc(t)}</text>`).join('');
  s+=TR.map((t,i)=>`<text class="${i?'trq':'trh'}" x="${r2(TB.x)}" y="${r2(ry+i*TR_P+(i?2:0))}">${shEsc(t.replace(/^ +/,m=>' '.repeat(m.length)))}</text>`).join('');
  return {title:'Общий вид',scale:scaleTxt(n),body:s,alt:`чертёж «Общий вид», масштаб ${scaleTxt(n)}: фигура ${Math.round(W)} × ${Math.round(H)} × ${Math.round(D)} мм (Ш × В × Г), деталей ${T.n}${BS?`, позиций на резку ${CUR.PC.length}`:''}, металл ${ST.t} мм, ${MATN[ST.mat]}, рез ${fmt(CUR.cutLen/1000,1)} м, листов ${CUR.N.sheets.length}; виды спереди, слева, сверху и в изометрии, таблица параметров, технические требования`};}
// технические требования: гибка (если гнём), порядок на лазере, сварка — под её вид; крупно, переносы по ширине столбца (113 мм)
const TR_FS=4,TR_P=5.4,trW=w=>Math.floor(w/(.43*TR_FS))-4,TR_W=trW(110);   // шрифт, шаг строк, знаков в строке по ширине w мм (с отступом продолжения)
function techReq(bend,w=110){const Q=[],g=mmT(ST.gap);
  if(bend)Q.push('V — гнуть на себя, m — от себя, глядя на сторону с гравировкой (внутреннюю). Число у линии — угол между гранями после гибки, в скобках — порядок гибки.',
    'Линии сгиба — в DXF гравировкой на слоях BEND_V и BEND_M'+(perfOn()?`, по ним сквозные прорези ${fmt(ST.perfL,1)} мм шагом до ${ST.perfStep} мм, до кромки не ближе ${fmt(perfBridge(),0)} мм — слой PERF.`:'.'),
    'Порядок на лазере: ENGRAVE, BEND_V и BEND_M, PERF, последним — контур CUT (внутреннее раньше наружного, иначе вырезанная деталь упадёт). Мелкие детали — на микроперемычках.',
    'Толстый лист: пропил болгаркой — только по V и только изнутри.');
  else if(ST.engrave)Q.push('Порядок на лазере: гравировка ENGRAVE, последним — контур CUT.');
  Q.push(weldOf()==='tig'?`Сварка TIG (аргон): резать с азотом или зачистить кромки от окалины; встык с зазором ${g} мм, присадка по месту. Прихватки через 30–50 мм, швы короткие вразбивку — меньше поводка.`
    :`Сварка полуавтоматом (MIG/MAG): встык с зазором ${g} мм, проволока 0,6–0,8 мм, газ Ar+CO₂; окалину у шва — щёткой. Прихватки через 30–50 мм, тонкий лист — точками, швы вразбивку. Лицевую сторону — от брызг; швы зачистить лепестковым кругом.`);
  return ['Технические требования',...Q.flatMap((q,i)=>wrapTxt(`${i+1}. ${q}`,trW(w)).map((l,k)=>k?'    '+l:l))];}

/* ---------- 2. порядок сборки ---------- */
// вид на детали шага: с их стороны (средняя нормаль по площади + немного изометрии), откуда смотрим — словами
// металлом на снимке шага: собранное, кроме другой половины фигуры (зеркальная пара и что за ней) — её силуэт ложится на элемент, она — призраком.
// Элемент посередине (|x| < 15 мм) — всё собранное; сам элемент и соседи, к кому варить, — всегда
function stepShown(st){const x=st.u[0],A=x.ps.reduce((s,p)=>s+p.area,0)||1,cx=x.ps.reduce((s,p)=>s+p.c[0]*p.area,0)/A;if(Math.abs(cx)<15)return st.done;
  const keep=new Set([...x.ps.map(p=>p.id),...st.w[0].map(q=>q.nb)]),sg=Math.sign(cx);return new Set([...st.done].filter(pi=>keep.has(pi)||CUR.R.parts[pi].c[0]*sg>-15));}
function stepView(ps){let n=[0,0,0];ps.forEach(p=>{n=V3.add(n,V3.mul(p.n,p.area));});const d=V3.norm(V3.add(V3.norm(n),V3.mul(VIEWS.iso.d,.5)));
  const up0=Math.abs(d[1])>.9?[0,0,d[1]>0?-1:1]:[0,1,0],r=V3.norm(V3.cross(up0,d));
  return {r,up:V3.cross(d,r),d,txt:viewTxt(d)};}
// откуда смотрим (d — от фигуры к глазу)
function viewTxt(d){const w=[];if(d[2]>.35)w.push('спереди');if(d[0]>.35)w.push('справа');if(d[0]<-.35)w.push('слева');if(d[1]>.35)w.push('сверху');if(d[1]<-.35)w.push('снизу');return w.join(', ')||'сзади';}
// тот же вид, повёрнутый вокруг вертикали вида (turn) или наклонённый — взгляд выше (tilt), a — градусы
function viewTurn(v,a){const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180),d=V3.norm(V3.add(V3.mul(v.d,c),V3.mul(v.r,s)));return {d,up:v.up,r:V3.norm(V3.sub(V3.mul(v.r,c),V3.mul(v.d,s))),txt:viewTxt(d)};}
function viewTilt(v,a){const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180),d=V3.norm(V3.add(V3.mul(v.d,c),V3.mul(v.up,s)));return {d,r:v.r,up:V3.norm(V3.sub(V3.mul(v.up,c),V3.mul(v.d,s))),txt:viewTxt(d)};}
// рамка шага в проекции: детали шага + 30% с каждой стороны, не меньше MINW мм по месту, не больше всей фигуры
function stepFrame(view,ps,MINW=150){const b=[1e9,1e9,-1e9,-1e9],add=(B,q)=>{B[0]=Math.min(B[0],q[0]);B[1]=Math.min(B[1],q[1]);B[2]=Math.max(B[2],q[0]);B[3]=Math.max(B[3],q[1]);};
  ps.forEach(p=>p.full.forEach(i=>add(b,prjV(view,CUR.M3.V[i]))));const all=[1e9,1e9,-1e9,-1e9];CUR.M3.V.forEach(p=>add(all,prjV(view,p)));
  const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,hw=Math.max((b[2]-b[0])*.8,MINW/2),hh=Math.max((b[3]-b[1])*.8,MINW/2);
  return [Math.max(all[0],cx-hw),Math.max(all[1],cy-hh),Math.min(all[2],cx+hw),Math.min(all[3],cy+hh)];}
// единицы сборки: отдельная деталь или заготовка (её детали — вместе, уже согнутые), по номеру первой детали
function asmUnits(){const R=CUR.R,u=new Map();[...R.parts].sort((a,b)=>a.no-b.no).forEach(p=>{const bi=CUR.blankOf?CUR.blankOf[p.id]:-1,k=bi>=0?'b'+bi:'p'+p.id;if(!u.has(k))u.set(k,{bi,ps:[]});u.get(k).ps.push(p);});
  const L=[...u.values()],of=new Map();L.forEach((x,i)=>{x.name=x.bi>=0?'Г'+CUR.BL[x.bi].no:'№'+x.ps[0].no;x.ps.forEach(p=>of.set(p.id,i));});
  // tw — зеркальный кусок: его детали — пары деталей этого, и только они; нет — −1
  L.forEach((x,i)=>{const tw=x.ps.map(p=>p.twin),j=tw.every(t=>t!=null)?of.get(tw[0]):undefined;x.tw=j!==undefined&&j!==i&&L[j].ps.length===x.ps.length&&tw.every(t=>of.get(t)===j)?j:-1;});
  return {L,of};}
// шаги сборки: кусок (деталь или заготовка); следующий — с меньшим номером из тех, что касаются собранного (ничего не касается — новое начало).
// Зеркальная пара — один шаг, если и зеркальный кусок есть к чему приварить (или оба — начало). w — к чему варить: [{nb, dih, ed}], done — собрано после шага
function asmSteps(){const {L:U,of}=asmUnits(),R=CUR.R,n=U.length,placed=new Set(),pu=new Set(),steps=[],own=U.map(x=>new Set(x.ps.map(p=>p.id))),UE=U.map(()=>[]);
  R.edges.forEach(e=>{if(e.p.length!==2)return;const a=of.get(e.p[0]),b=of.get(e.p[1]);if(a===b)return;UE[a].push(e);UE[b].push(e);});
  const weldTo=(i,set)=>{const m=new Map();UE[i].forEach(e=>{const a=own[i].has(e.p[0])?e.p[0]:e.p[1],b=a===e.p[0]?e.p[1]:e.p[0];if(!set.has(b))return;if(!m.has(b))m.set(b,{nb:b,dih:seamDih(R,a,b),ed:[]});m.get(b).ed.push([e.a,e.b]);});return [...m.values()].sort((a,b)=>R.parts[a.nb].no-R.parts[b.nb].no);};
  const twinOf=i=>U[i].tw;
  while(pu.size<n){let i=-1;for(let k=0;k<n&&i<0;k++)if(!pu.has(k)&&(!placed.size||U[k].ps[0].back||weldTo(k,placed).length))i=k;
    for(let k=0;k<n&&i<0;k++)if(!pu.has(k))i=k;
    const w=weldTo(i,placed),j=twinOf(i),st={u:[U[i]],ix:[i],w:[w]};pu.add(i);
    if(j>=0&&!pu.has(j)){const w2=weldTo(j,new Set([...placed,...own[i]]));if(w2.length||!w.length){st.u.push(U[j]);st.ix.push(j);st.w.push(w2);pu.add(j);}}
    st.ix.forEach(k=>own[k].forEach(p=>placed.add(p)));st.done=new Set(placed);steps.push(st);}
  return {steps,of};}
// снимок шага в клетке x0, y0, w × h; номера — с белой обводкой, наезжают — сдвигаем рядом или не пишем
function asmImg(x0,y0,w,h,o){const box=[],fs=2.8,hs='paint-order:stroke;stroke:#fff;stroke-linejoin:round;stroke-width:.7';let s=`<image class="ash" href="${o.url}" x="${r2(x0)}" y="${r2(y0)}" width="${r2(w)}" height="${r2(h)}" preserveAspectRatio="none"/>`;
  o.labs.slice().sort((a,b)=>(a.k==='new'?0:1)-(b.k==='new'?0:1)).forEach(l=>{const hw=l.t.length*fs*.28+.3,hh=fs*.6;
    for(const [dx,dy] of [[0,0],[0,-1],[0,1],[-1,0],[1,0],[0,-2],[0,2]]){const x=x0+l.x*w+dx*hw*2,y=y0+l.y*h+dy*hh*1.6,b=[x-hw,y-hh,x+hw,y+hh];
      if(b[0]<x0||b[2]>x0+w||b[1]<y0||b[3]>y0+h||box.some(c=>b[0]<c[2]&&b[2]>c[0]&&b[1]<c[3]&&b[3]>c[1]))continue;box.push(b);
      s+=`<text class="no" x="${r2(x)}" y="${r2(y+fs*.36)}" text-anchor="middle" style="font-size:${fs}px;${hs}${l.k==='new'?';fill:#8a3a0a':''}">${shEsc(l.t)}</text>`;break;}});
  return s+`<rect class="t" style="stroke-width:.12" x="${r2(x0)}" y="${r2(y0)}" width="${r2(w)}" height="${r2(h)}"/>`;}
// перенос строки по словам
const wrapTxt=(t,n)=>{const out=[];let l='';t.split(' ').forEach(w=>{if((l+' '+w).trim().length>n&&l){out.push(l);l=w;}else l=(l+' '+w).trim();});if(l)out.push(l);return out;};
function sheetsAssembly(){const {steps}=asmSteps(),R=CUR.R,V=CUR.M3.V,cw=130,ch=124,out=[];
  const say=(x,w)=>{const bl=x.bi>=0;if(x.ps[0].back)return `${x.name}: подложка за прорезью глаза — приварить изнутри по краю прорези`;return `${x.name}${bl?` (дет. ${x.ps.map(p=>p.no).join(', ')})`:''}: ${bl?`согнуть по карте ${x.name}, `:''}${w.length?'приварить к '+w.map(q=>`№ ${R.parts[q.nb].no} (${angT(q.dih)})`).join(', '):'первый элемент — от него собираем'}`;};
  for(let si=0;si<steps.length;si+=6){let s='';steps.slice(si,si+6).forEach((st,j)=>{const cx=25+(j%3)*cw,cy=22+Math.floor(j/3)*ch,[x,tw]=st.u;
      const W=st.w[0],nbs=new Set(W.map(q=>q.nb)),mine=new Set(x.ps.map(p=>p.id)),sh=typeof stepShot==='function'?stepShot(st,(cw-2)/82):null;
      // крупно и со стороны нового куска; собранное раньше — светло-серым, новый — оранжевым; номера — только у нового и тех, к кому варим
      // есть WebGL — снимок шага (перекрытия считает видеокарта), номера — текстом поверх; нет — схема гранями
      if(sh){s+=`<rect class="t" x="${cx}" y="${cy}" width="${cw}" height="${ch}"/><text class="h2" x="${cx+3}" y="${cy+6}">Шаг ${si+j+1} · ${shEsc(x.name+(tw?` и ${tw.name} (зеркально)`:''))}</text><text class="sm" x="${cx+cw-3}" y="${cy+6}" text-anchor="end">вид ${sh.txt}</text>`+asmImg(cx+1,cy+8,cw-2,82,sh);}
      else{const v=stepView(x.ps),fb=stepFrame(v,x.ps.concat(W.map(q=>R.parts[q.nb]))),   // в рамке — новый кусок и те, к кому его варить
        k=Math.min((cw-10)/(fb[2]-fb[0]),80/(fb[3]-fb[1])),id='asm'+(si+j),ox=cx+(cw-(fb[2]-fb[0])*k)/2-fb[0]*k,oy=cy+9+(80-(fb[3]-fb[1])*k)/2-fb[1]*k;
      s+=`<rect class="t" x="${cx}" y="${cy}" width="${cw}" height="${ch}"/><text class="h2" x="${cx+3}" y="${cy+6}">Шаг ${si+j+1} · ${shEsc(x.name+(tw?` и ${tw.name} (зеркально)`:''))}</text><text class="sm" x="${cx+cw-3}" y="${cy+6}" text-anchor="end">вид ${v.txt}</text>`;
      s+=`<clipPath id="${id}"><rect x="${cx+1}" y="${cy+8}" width="${cw-2}" height="82"/></clipPath><g clip-path="url(#${id})">`+facesSVG(v,k,ox,oy,{only:p=>st.done.has(p.id),
        color:(p,sh)=>mine.has(p.id)?`rgb(${Math.round(200+50*sh)},${Math.round(110+60*sh)},${Math.round(50+40*sh)})`:grey(.7+.28*sh),label:p=>mine.has(p.id)||nbs.has(p.id)});
      // швы этого шага — толстые красные (только на гранях, повёрнутых к нам)
      const Pp=q=>{const z=prjV(v,q);return [ox+z[0]*k,oy+z[1]*k];},vis=pi=>V3.dot(R.parts[pi].n,v.d)>.02;
      s+=`<path class="seam" d="${W.filter(q=>vis(q.nb)||x.ps.some(p=>vis(p.id))).flatMap(q=>q.ed).map(([a,b])=>{const A=Pp(V[a]),B=Pp(V[b]);return `M${r2(A[0])},${r2(A[1])}L${r2(B[0])},${r2(B[1])}`;}).join('')}"/></g>`;}
      // что делать — словами; пара — «то же зеркально справа»
      let ty=cy+95;const line=(t,cl)=>wrapTxt(t,78).forEach(l=>{if(ty<cy+ch-1.5){s+=`<text class="${cl}" x="${cx+3}" y="${r2(ty)}">${shEsc(l)}</text>`;ty+=3.6;}});
      line(say(x,W),'td');if(tw){ty+=.6;line('То же зеркально справа — '+say(tw,st.w[1]),'sm');}});
    s+=`<text class="sm" x="25" y="272">Оранжевое — элемент этого шага, светло-серое — собрано раньше (другая половина фигуры и зеркальная пара — тонкими линиями), красная линия — шов этого шага. Номера — у нового элемента и у деталей, к которым его варить. Угол — между листами по шву.</text>`;
    const sp=steps.slice(si,si+6);out.push({title:'Порядок сборки',scale:'—',body:s,alt:`чертёж «Порядок сборки»: шаги ${si+1}–${si+sp.length} из ${steps.length} — ${sp.map(st=>st.u.map(u=>u.name).join(' и ')).join(', ')}`});}
  return out;}

/* ---------- уголки-шаблоны для сварки (галочка): все уголки 1:2 с надписью, как ставить ---------- */
function sheetsTpl(){const T=CUR.TPL||[],n=2.5,k=1/n,cw=43,ch=33,cols=9,rows=7,out=[];
  for(let i=0;i<T.length;i+=cols*rows){let s='';T.slice(i,i+cols*rows).forEach((o,j)=>{
      // буквой V: биссектриса угла — вверх, выемка у вершины — внизу
      const r=Math.PI/2-o.a*Math.PI/360,c=Math.cos(r),sn=Math.sin(r),R=o.pts.map(q=>[c*q[0]-sn*q[1],sn*q[0]+c*q[1]]),xs=R.map(q=>q[0]),ys=R.map(q=>q[1]),x0=Math.min(...xs),y1=Math.max(...ys),w=(Math.max(...xs)-x0)*k,h=(y1-Math.min(...ys))*k;
      const cx=25+(j%cols)*cw,cy=24+Math.floor(j/cols)*ch,ox=cx+(cw-w)/2,oy=cy+1+(ch-10-h)/2,Q=R.map(q=>[ox+(q[0]-x0)*k,oy+(y1-q[1])*k]);
      s+=`<polygon class="l" points="${Q.map(q=>r2(q[0])+','+r2(q[1])).join(' ')}"/><text class="big" x="${r2(cx+cw/2)}" y="${r2(cy+ch-5)}" text-anchor="middle">${tplNo(o.a)}</text><text class="sm" x="${r2(cx+cw/2)}" y="${r2(cy+ch-1.8)}" text-anchor="middle">${[o.seams?`швов ${o.seams}${o.out?` (${o.out} снаружи)`:''}`:'',o.bends?`сгибов ${o.bends}`:''].filter(Boolean).join(', ')}</text>`;});
    s+=`<text class="sm" x="25" y="263">Уголок вырезан из того же листа, на нём гравировка «У» и угол. В чертежах у шва написан угол: «152°» — выпуклый шов, уголок У152° вставить в стык изнутри фигуры; «152° внутрь» — вогнутый, приложить снаружи.</text><text class="sm" x="25" y="268">Прижать обе детали к рабочим краям уголка (выемка — к шву), прихватить в 2–3 точках, снять уголок и переставить на следующий шов с тем же углом. Швы почти плоские (${TPL_MAX}–180°) — по линейке.</text>`;
    const tp=T.slice(i,i+cols*rows);out.push({title:'Уголки-шаблоны для сварки',scale:scaleTxt(n),body:s,alt:`чертёж «Уголки-шаблоны для сварки», масштаб ${scaleTxt(n)}: уголков ${tp.length} — ${tp.map(o=>tplNo(o.a)).join(', ')}`});}
  return out;}

/* ---------- 4. спецификация ---------- */
function sheetsSpec(){const dens=DENS[ST.mat]||7850,R=CUR.R,cols=[{t:'№',w:15,r:1},{t:'Габарит реза, мм',w:24},{t:'Площ., см²',w:17,r:1},{t:'Масса, кг',w:16,r:1},{t:'Рез, мм',w:15,r:1},{t:'Кол.',w:9,r:1},{t:'Сваривается с (угол)',w:91}];
  // зеркальная пара (две отдельные детали или две заготовки) — одной строкой «7 / 7.1», кол. 2
  const pc=new Map(CUR.PC.map(o=>[String(o.no),o])),twinOf=o=>{const nm=String(o.no);return nm.endsWith('.1')?null:pc.get(nm+'.1')||null;};
  const rows=CUR.PC.filter(o=>!String(o.no).endsWith('.1')||!pc.has(String(o.no).slice(0,-2))).map(o=>{const tw=twinOf(o),xs=o.pts.map(q=>q[0]),ys=o.pts.map(q=>q[1]),a=Math.abs(area2(o.pts)),in_=new Set(o.parts),nb=new Map();
    o.parts.forEach(pi=>partNbs(R,pi).forEach(g=>{if(!in_.has(g.nb))nb.set(R.parts[g.nb].no+' '+angT(g.dih),1);}));
    // заготовка — одной строкой: габарит по развёртке, детали в ней
    const gab=o.B?`${Math.round(o.B.L)} × ${Math.round(o.B.W)}`:`${Math.round(Math.max(...xs)-Math.min(...xs))} × ${Math.round(Math.max(...ys)-Math.min(...ys))}`;
    return [tw?`${o.no} / ${tw.no}`:o.no,gab,fmt(a/100,1),fmt(a*1e-9*ST.t*dens,3),Math.round(perim(o.pts)),tw?2:1,(tw?'зеркально; ':'')+(o.B?`дет. ${o.parts.map(pi=>R.parts[pi].no).join(', ')}; `:'')+[...nb.keys()].join(', ')];});
  const per=38,out=[];for(let i=0;i<rows.length;i+=per*2){let s=svgTable(25,22,cols,rows.slice(i,i+per),6.2);if(rows.length>i+per)s+=svgTable(222,22,cols,rows.slice(i+per,i+per*2),6.2);
    if(CUR.BL&&CUR.BL.length)s+=`<text class="sm" x="25" y="272">Г — заготовка со сгибами: развёртка с размерами, гибка и швы — на её карте (PDF А4), порядок гибки — лист «Гибка — порядок».</text>`;out.push({title:'Спецификация деталей',scale:'—',body:s,alt:`чертёж «Спецификация деталей»: строки ${i+1}–${Math.min(i+per*2,rows.length)} из ${rows.length} (позиций на резку ${CUR.PC.length}), у каждой — габарит реза, площадь, масса, рез, количество и с чем сваривается`});}
  return out;}

/* ---------- гибка: порядок таблицей (развёртки с размерами — на картах деталей А4) ---------- */
function sheetsBend(){const BL=CUR.BL||[];if(!BL.length)return [];const R=CUR.R,out=[];
  const note=`<text class="sm" x="25" y="264">V — гнуть на себя, m — от себя, глядя на сторону с гравировкой (внутреннюю); число — угол между гранями после гибки, в скобках на гравировке — порядок гибки (сначала крайние).</text>`
    +`<text class="sm" x="25" y="268">${ST.useT?`Контур — с поправкой на толщину ${ST.t} мм у сгиба (r = t, K = 0,33) и отступом под шов на свариваемых сторонах. `:''}Развёртка каждой заготовки с размерами, вид после гибки и швы — на картах деталей (PDF А4).</text>`;
  const nm=pi=>R.parts[pi].no,rows=BL.map(b=>['Г'+b.no,b.parts.map(nm).join(', '),`${Math.round(b.L)} × ${Math.round(b.W)}`,b.lines.map(l=>`${l.k}) ${l.kind}${l.ang} ${nm(l.p)}–${nm(l.q)}`).join('   ')]);
  const cols=[{t:'Загот.',w:12},{t:'Детали',w:64},{t:'Габарит, мм',w:22},{t:'Сгибы по порядку: вид, угол между гранями, между деталями',w:292}];
  for(let i=0;i<rows.length;i+=36){const bs=BL.slice(i,i+36),nl=bs.reduce((a,b)=>a+b.lines.length,0);
    out.push({title:'Гибка — порядок',scale:'—',body:svgTable(25,22,cols,rows.slice(i,i+36),6.2)+note,alt:`чертёж «Гибка — порядок»: заготовок ${bs.length} из ${BL.length} (${bs.map(b=>'Г'+b.no).join(', ')}), ${nl} ${plural(nl,'сгиб','сгиба','сгибов')} — вид, угол и порядок у каждой`});}
  return out;}

/* ---------- для цены резки: длина реза, врезки, гравировка ---------- */
const perim=P=>P.reduce((a,q,i)=>{const z=P[(i+1)%P.length];return a+Math.hypot(z[0]-q[0],z[1]-q[1]);},0);
// кусок на листе (o.pts и o.tr — как положил раскрой): гравировка — номер; у заготовки — номера её деталей и подписи сгибов «V144 (2)»;
// V, M — линии сгиба; miss — что не влезло гравировкой. Всё в координатах листа
// перфорация линий сгиба (галочка, только лазер): сквозные прорези длиной d вдоль линии (рез без ширины — ширина = рез лазера), центр первой — в edge от конца отрезка линии,
// дальше равномерно с шагом не больше step; отрезок короче 2·edge — одна посередине. → отрезки [x1, y1, x2, y2]
const perfOn=()=>!!ST.perf&&ST.cut!=='plasma',perfKey=()=>perfOn()?[ST.perfL,ST.perfStep,ST.perfEdge].join('/'):'';
// C — контур куска (те же координаты): перемычка от прорези до кромки не меньше perfBridge. Линия сгиба подходит к кромке под острым углом — крайняя прорезь
// в 10 мм от конца линии оказывалась в 2 мм от края (Г2–Г4 у Д10) и при гибке рвалась; такую сдвигаем к середине линии шагами 0,5 мм (не дальше полшага), не вышло — без неё
const perfBridge=()=>Math.max(3,2*(ST.t||0));   // не тоньше двух толщин (перемычку тянет при гибке), но и не меньше 3 мм — тоньше лазер пережигает
const perfGap=(h,C)=>{const a=[h[0],h[1]],b=[h[2],h[3]];let m=Infinity;C.forEach((p,i)=>{const q=C[(i+1)%C.length];m=Math.min(m,ptSegD(a,p,q),ptSegD(b,p,q),ptSegD(p,a,b));});return m;};
function perfHoles(S,C){const d=ST.perfL,st=ST.perfStep,ed=ST.perfEdge,mb=perfBridge(),out=[];S.forEach(z=>{const L=Math.hypot(z[2]-z[0],z[3]-z[1]);if(L<d+4)return;const P=t=>[z[0]+(z[2]-z[0])*t/L,z[1]+(z[3]-z[1])*t/L],hole=t=>[...P(t-d/2),...P(t+d/2)];
    const T=L<=2*ed?[L/2]:(n=>Array.from({length:n},(_,i)=>ed+(L-2*ed)*i/(n-1)))(Math.ceil((L-2*ed)/st-1e-9)+1),put=[];
    T.forEach((t0,i)=>{const dir=t0<L/2?1:-1;for(let s=0;s<=st/2+1e-9;s+=.5){const t=t0+dir*s;if(t<d/2||t>L-d/2)break;
      if(s>0&&(put.length&&t-put[put.length-1]<d+mb-1e-9||T[i+1]!=null&&T[i+1]-t<d+mb-1e-9))break;   // сдвинутая — не ближе перемычки к соседним прорезям
      if(!C||perfGap(hole(t),C)>=mb-1e-9){put.push(t);break;}}});
    put.forEach(t=>out.push(hole(t)));});return out;}
// номер детали P внутри заготовки C. Деталь — грань модели, а у шва контур реза заготовки срезан зазором под сварку: номер по грани
// вылез за кромку или ближе 0,5 мм к ней (Г5 у Д9–Д11, до 2,1 мм) — ставим заново внутри обоих контуров (сдвиг, при нужде мельче)
function blankNumSegs(no,P,C,maxH=20){const g=engraveSegs(no,P,{maxH});if(!g)return null;const d=polyDist(C);
  return g.every(s=>[[s[0],s[1]],[s[2],s[3]]].every(q=>inPoly(q,C)&&d(q)>=.5))?g:engraveSegs(no,P,{maxH,clip:C});}
function itemMarks(o){const eng=ST.engrave||isTpl(o),pk=perfKey();if(o._mk&&o._mk.bl===CUR.BL&&o._mk.e===eng&&o._mk.pk===pk)return o._mk.r;let r;
  if(!isBlank(o)){const g=eng?engraveSegs(o.no,o.pts):null;r={eng:g||[],miss:eng&&!g?[itemName(o)]:[],V:[],M:[],P:[]};}
  else{const B=CUR.BL[+o.id.slice(1)],T=q=>trPt(o.tr,q);r={eng:[],miss:[],V:[],M:[],P:[],num:[],labs:[]};
    // сначала номера деталей (по ним собирают), потом подписи сгибов — не ближе 1 мм к номерам и друг к другу.
    // Подписи нет места — номера рядом с линией мельче, ступенями до 5 мм (номер остаётся в той же точке, только меньше)
    const N=B.regions.map(z=>({no:CUR.R.parts[z.pi].no,pts:z.pts.map(T),h:20})),put=n=>{n.g=blankNumSegs(n.no,n.pts,o.pts,n.h);n.box=n.g?segBox(n.g,.5):null;};
    if(eng)N.forEach(put);
    B.lines.forEach(l=>{const S=l.segs.map(z=>{const a=T([z[0],z[1]]),b=T([z[2],z[3]]);return [a[0],a[1],b[0],b[1]];});(l.kind==='V'?r.V:r.M).push(...S);if(pk)r.P.push(...perfHoles(S,o.pts));if(!eng||!S.length)return;
      const z=S.reduce((a,b)=>Math.hypot(b[2]-b[0],b[3]-b[1])>Math.hypot(a[2]-a[0],a[3]-a[1])?b:a),L=Math.hypot(z[2]-z[0],z[3]-z[1])||1,ux=(z[2]-z[0])/L,uy=(z[3]-z[1])/L,e=15,
        zone=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[(a<0?z[0]-ux*e:z[2]+ux*e)-uy*e*b,(a<0?z[1]-uy*e:z[3]+uy*e)+ux*e*b]);   // где искать подпись: линия ± 15 мм
      let g=null;for(const h of [20,12,8,5]){N.forEach(n=>{if(n.h>h&&n.box&&quadHit(n.box,zone)){n.h=h;put(n);}});g=bendLabel(bendTxt(l),z,o.pts,4,N.filter(n=>n.box).map(n=>n.box).concat(r.labs.map(x=>x.g.box)));if(g)break;}
      if(g)r.labs.push({t:bendTxt(l),g});else r.miss.push(o.no+' сгиб '+bendTxt(l));});
    N.forEach(n=>{r.num.push({no:n.no,g:n.g});if(n.g)r.eng.push(...n.g);else if(eng)r.miss.push('№'+n.no);});r.labs.forEach(x=>r.eng.push(...x.g));}
  o._mk={bl:CUR.BL,e:eng,pk,r};return r;}
const segLen=S=>S.reduce((a,z)=>a+Math.hypot(z[2]-z[0],z[3]-z[1]),0);
// рез и врезки — только контуры; перфорация отдельно (у неё цена — в основном врезки: каждая прорезь — своя)
function cutStats(items){let cut=0,eng=0,pierce=0,engN=0,bend=0,perf=0,perfLen=0;items.forEach(o=>{cut+=perim(o.pts);pierce++;const m=itemMarks(o);perf+=m.P.length;perfLen+=segLen(m.P);if(m.eng.length){engN++;eng+=segLen(m.eng);}bend+=segLen(m.V)+segLen(m.M);});return {cut,eng,pierce,engN,bend,perf,perfPierce:perf,perfLen};}
const plural=(n,a,b,c)=>{const m=n%100,k=n%10;return m>10&&m<20?c:k===1?a:k>1&&k<5?b:c;};
const perfTxt=c=>`${c.perf} ${plural(c.perf,'прорезь','прорези','прорезей')} · ${c.perfPierce} ${plural(c.perfPierce,'врезка','врезки','врезок')} · ${fmt(c.perfLen/1000,2)} м реза`;
const cutTxt=(c,short)=>`рез ${fmt(c.cut/1000,1)} м · врезок ${c.pierce}${ST.engrave?` · гравировка ${fmt(c.eng/1000,1)} м`:''}${c.bend&&!short?` · линии сгиба ${fmt(c.bend/1000,1)} м`:''}${c.perf?` · перфорация: ${perfTxt(c)}`:''}`;
/* ---------- 5. раскрой листа ---------- */
function sheetsNest(){const N=CUR.N,n=N.sheets.length===1?pickScale([N.W,N.H],[385,235]):pickScale([N.W,N.H],[385,108]),k=1/n,out=[],[sl,sw]=sheetWL();
  for(let i=0;i<N.sheets.length;i+=2){let s='';N.sheets.slice(i,i+2).forEach((sh,j)=>{const ox=25+(385-N.W*k)/2,oy=30+j*125;
      s+=`<text class="h2" x="25" y="${oy-7.5}">Лист металла ${i+j+1} из ${N.sheets.length} · ${sw} × ${sl} · ${ST.t} мм, ${MATN[ST.mat]} · ${itemsTxt(sh.items)} · плотность ${Math.round(sh.dense*100)}% в полосе с деталями ${sw} × ${Math.round(sh.len)} мм, остальное свободно</text><text class="h2" x="25" y="${oy-2.5}">Зазор между деталями ${N.gap} мм · на листе: ${cutTxt(cutStats(sh.items),true)}</text><rect class="l" x="${r2(ox)}" y="${oy}" width="${r2(N.W*k)}" height="${r2(N.H*k)}"/>`;
      const T=(x,y)=>[ox+(x)*k,oy+(N.H-y)*k];   // как в DXF: y вверх
      const small=[],path=(S,c)=>S.length?`<path class="${c}" d="${S.map(z=>{const a=T(z[0],z[1]),b=T(z[2],z[3]);return 'M'+r2(a[0])+','+r2(a[1])+'L'+r2(b[0])+','+r2(b[1]);}).join('')}"/>`:'';
      sh.items.forEach(o=>{const Q=o.pts.map(q=>T(o.x+q[0],o.y+q[1])),m=itemMarks(o);small.push(...m.miss);
        s+=`<polygon class="${m.miss.length&&!isBlank(o)?'small':'t'}" points="${Q.map(q=>r2(q[0])+','+r2(q[1])).join(' ')}"/>`+path(m.V,'bnd bv')+path(m.M,'bnd bm')+path(m.P,'prf');
        if(m.eng.length)s+=path(m.eng,'eng');
        else if(!ST.engrave&&!isTpl(o)){const cx=Q.reduce((a,q)=>a+q[0],0)/Q.length,cy=Q.reduce((a,q)=>a+q[1],0)/Q.length;s+=`<text class="no" x="${r2(cx)}" y="${r2(cy+.9)}" text-anchor="middle">${o.no}</text>`;}});
      if(small.length)s+=`<text class="h2" x="25" y="${r2(oy+N.H*k+5.5)}" fill="#c33">Без гравировки — малы для цифр 3 мм (обведены красным): ${shEsc(small.join(', ').slice(0,300))}</text>`;});
    out.push({title:'Раскрой листа',scale:scaleTxt(n),body:s,alt:`чертёж «Раскрой листа», масштаб ${scaleTxt(n)}: `+N.sheets.slice(i,i+2).map((sh,j)=>`лист металла ${i+j+1} из ${N.sheets.length} — ${sw} × ${sl}, ${ST.t} мм, ${MATN[ST.mat]}, ${itemsTxt(sh.items)}, плотность ${Math.round(sh.dense*100)}%`).join('; ')});}
  if(N.too.length)out.push({title:'Раскрой листа',scale:'—',alt:`чертёж «Раскрой листа»: не влезают в лист ${N.too.map(itemName).join(', ')}`,body:`<text class="h2" x="25" y="40">Не влезают в лист: ${N.too.map(itemName).join(', ')} — выберите лист больше или уменьшите фигуру</text>`});
  return out;}

const shDate=()=>{const d=new Date();return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;};
function buildSheets(){if(!CUR||!CUR.R.parts.length)return [];const L=[sheetGeneral(),...sheetsAssembly(),...sheetsBend(),...sheetsSpec(),...(CUR.TPL&&CUR.TPL.length?sheetsTpl():[]),...sheetsNest()],date=shDate();
  return L.map((b,i)=>({title:b.title,svg:wrapSheet(b,{n:i+1,N:L.length,date})}));}

/* ---------- карты деталей: лист А4 книжный на каждый кусок (деталь или заготовка), зеркальная пара — одна карта ----------
   Глянул на лист — понял, что за кусок, где он на фигуре, как резать, гнуть и к чему варить */
function wrapA4(b,o){const [ra,tt]=svgAlt(`«${ST.name||'Фигура'}», лист ${o.n} из ${o.N} (А4): ${b.alt||b.head+' — '+b.title}`);return `<svg xmlns="http://www.w3.org/2000/svg" class="shs" viewBox="0 0 210 297" width="210mm" height="297mm"${ra}>${tt}${SH_STYLE}<rect width="210" height="297" fill="#fff"/><rect class="fr" x="20" y="5" width="185" height="287"/><path class="l" d="M20,17H205"/>`
  +`<text class="hd" x="24" y="13.5">${shEsc(b.head)}</text><text class="h2" x="201" y="13.5" text-anchor="end">${shEsc(b.title)}</text>${b.body}${stamp(20,276,b,o)}<text class="sm" x="205" y="295.6" text-anchor="end">Формат А4</text></svg>`;}
// швы куска (own — его детали): по каждому соседу снаружи — длина, угол (по самому длинному ребру), рёбра
function pieceWelds(own){const R=CUR.R,V=CUR.M3.V,m=new Map();R.edges.forEach(e=>{if(e.p.length!==2)return;const i=own.has(e.p[0]);if(i===own.has(e.p[1]))return;const nb=i?e.p[1]:e.p[0],l=V3.len(V3.sub(V[e.a],V[e.b]));
    if(!m.has(nb))m.set(nb,{nb,len:0,dih:e.dih,ml:0,ed:[]});const w=m.get(nb);w.len+=l;w.ed.push([e.a,e.b]);if(l>w.ml){w.ml=l;w.dih=seamDih(R,i?e.p[0]:e.p[1],nb);}});   // угол — как у зеркального шва
  return [...m.values()].sort((a,b)=>R.parts[a.nb].no-R.parts[b.nb].no);}
// профиль шва: свой лист (оранжевый) и соседний (серый) под углом a, шов — красная точка; в угол вставлен уголок, нет его — дуга (выставить транспортиром).
// Внутри фигуры — сверху, как гравировка в клетках гибки: обычный шов — сосед вверх, уголок сверху (изнутри); out — шов «внутрь»: сосед вниз, уголок снизу (снаружи). x — левый край, y — низ
function weldGlyph(x,y,a,s,tpl,out){const r=a*Math.PI/180,c=Math.cos(r),sn=(out?-1:1)*Math.sin(r),q=s*.5,vx=x+s*Math.max(0,-c),bi=[(1+c)/2,-sn/2],bl=Math.hypot(bi[0],bi[1])||1,o=[bi[0]/bl*.35,bi[1]/bl*.35];
  if(out)y-=s;
  return `<g class="wg"${out?' data-out="1"':''}>`+(tpl?`<polygon class="tw" points="${r2(vx+o[0]+q*1.15)},${r2(y+o[1])} ${r2(vx+o[0])},${r2(y+o[1])} ${r2(vx+o[0]+q*1.15*c)},${r2(y+o[1]-q*1.15*sn)}"/>`
    :`<path class="ag" d="M${r2(vx+q)},${r2(y)}A${r2(q)},${r2(q)} 0 0 ${out?1:0} ${r2(vx+q*c)},${r2(y-q*sn)}"/>`)
    +`<path class="pw" style="stroke:#e08a3c" d="M${r2(vx+s)},${r2(y)}L${r2(vx)},${r2(y)}"/><path class="pw" style="stroke:#9a9a9a" d="M${r2(vx)},${r2(y)}L${r2(vx+s*c)},${r2(y-s*sn)}"/><circle cx="${r2(vx)}" cy="${r2(y)}" r=".45" fill="#d01f1f"/></g>`;}
// чем выставить угол: уголок из комплекта (галочка «Уголки»), почти плоский — линейкой, совсем острый — по месту, иначе — транспортиром
function tplSay(d,bend){const a=Math.round(d>180.5?360-d:d);if(a>=TPL_MAX)return 'по линейке';if(a<TPL_MIN)return 'по месту';
  return CUR.TPL&&CUR.TPL.some(o=>o.a===a)?`уголок ${tplNo(a)}${bend?'':d>180.5?' снаружи':' изнутри'}`:'транспортиром';}
// x — элемент или деталь (из asmUnits), y — его зеркальный или null
function cardPiece(x,y){const R=CUR.R,V=CUR.M3.V,B=x.bi>=0?CUR.BL[x.bi]:null,o=CUR.PC.find(c=>c.id===(B?'b'+x.bi:x.ps[0].id)),own=new Set(x.ps.map(p=>p.id)),nm=pi=>R.parts[pi].no;
  const t=bendAlign(o.pts,true),P=o.pts.map(q=>trPt(t,q)),a=Math.abs(area2(o.pts)),mass=a*1e-9*ST.t*(DENS[ST.mat]||7850),W=pieceWelds(own),back=x.ps[0].back;
  // строки: гибка по порядку, потом сварка по соседям; у каждой — чертёж угла
  // гибка — снимок на каждый сгиб (элемент готовый, в угле — уголок): 1–2 сгиба — на карте, больше — листом «Гибка» сразу после карты; без WebGL — только строки
  const BIH=44,bsh=B&&typeof bendShot==='function'?(z=>z.every(Boolean)?z:null)(B.lines.map(l=>bendShot(own,l,91.5/(B.lines.length>2?bsGrid(B.lines.length).ih:BIH)))):null,onC=!!bsh&&B.lines.length<=2;
  const rows=[],bc=onC||B&&B.lines.length>4?2:1,BRH=4.6,hb=B?6+(onC?BIH+1:0)+Math.ceil(B.lines.length/bc)*BRH:0;
  rows.push({h:back?'Сварка — подложка за прорезью глаза: приварить изнутри по краю прорези':`Сварка — к чему варить · угол между листами по шву${y?` · ${y.name} — к зеркальным (с «.1»), детали посередине — те же`:''}`});
  W.forEach(w=>rows.push({w:1,o:w.dih>180.5,t:`к № ${nm(w.nb)} · шов ${Math.round(w.len)} мм`,a:Math.round(w.dih>180.5?360-w.dih:w.dih),at:angT(w.dih),tp:tplSay(w.dih)}));
  // строки по ширине листа; соседей много — швы в две колонки
  const wc=W.length>8||hb+(W.length+1)*3.8>124?2:1,ln=[];rows.forEach(r=>{const l=ln[ln.length-1];if(r.w&&l&&l[0].w&&l.length<wc)l.push(r);else ln.push([r]);});
  const maxT=Math.max(30,124-hb),rh=Math.max(3.8,Math.min(B?4.8:5.4,maxT/ln.length)),nl=Math.min(ln.length,Math.floor(maxT/rh)),ty0=274-hb-nl*rh,fy0=y?31:28,SH=typeof pieceShots==='function',mh=SH?[90,80,70,56].find(m=>pickScale([t.L,t.W],[160,ty0-fy0-m-22])<=pickScale([t.L,t.W],[160,ty0-fy0-78]))||56:pickScale([t.L,t.W],[160,ty0-fy0-78])>pickScale([t.L,t.W],[160,ty0-fy0-68])?56:66,my0=ty0-mh;
  // шапка: что внутри, металл, габарит, масса, рез, сколько штук
  let s=`<text class="td" x="23" y="22.5">${shEsc([B?`детали № ${x.ps.map(p=>p.no).join(', ')}`:back?'подложка глаза':'',`${MATN[ST.mat]||ST.mat} ${ST.t} мм`,WELDS[weldOf()],`габарит реза ${Math.round(t.L)} × ${Math.round(t.W)} мм`,`масса ${fmt(mass,2)} кг/шт`,`рез ${Math.round(perim(o.pts))} мм`,`кол. ${y?2:1}`].filter(Boolean).join(' · '))}</text>`;
  if(y)s+=`<text class="sm" x="23" y="26.5">${shEsc(`${y.name} — зеркальная копия: развёртка зеркально (в DXF и раскрое уже так), гнуть и варить так же — на другой стороне фигуры`)}</text>`;
  // 1. развёртка, как режут: контур, линии сгиба с подписью, номера деталей, гравировка, длины сторон и габарит
  const fh=my0-2-fy0,n=pickScale([t.L,t.W],[160,fh-20]),k=1/n,ox=20+(185-t.L*k)/2,oy=fy0+7+(fh-17-t.W*k)/2,T=q=>[ox+q[0]*k,oy+(t.W-q[1])*k],Q=P.map(T),box=[],hit=b=>box.some(c=>b[0]<c[2]&&b[2]>c[0]&&b[1]<c[3]&&b[3]>c[1]);   // box — занятые места
  s+=`<text class="h2" x="23" y="${r2(fy0+3.5)}">Развёртка — как режут</text><text class="sm" x="202" y="${r2(fy0+3.5)}" text-anchor="end">вид со стороны гравировки (изнутри фигуры) · М ${scaleTxt(n)}</text><polygon class="l" points="${Q.map(q=>r2(q[0])+','+r2(q[1])).join(' ')}"/>`;
  const segP=(S,c)=>S.length?`<path class="${c}" d="${S.map(z=>{const A=T([z[0],z[1]]),C=T([z[2],z[3]]);return `M${r2(A[0])},${r2(A[1])}L${r2(C[0])},${r2(C[1])}`;}).join('')}"/>`:'';
  // гравировка — та же, что в DXF и раскрое (itemMarks): номера деталей — красным, подписи сгибов — бледно (читать их удобнее у кружков за контуром)
  const mk=itemMarks({id:o.id,no:o.no,pts:P,tr:t}),lb=[],eng=[],engB=B?mk.labs.flatMap(x=>x.g):[];
  (B?B.regions.map(z=>({no:nm(z.pi),pts:z.pts.map(q=>trPt(t,q))})):[{no:o.no,pts:P}]).forEach(z=>{const g=B?(mk.num.find(x=>x.no===z.no)||{}).g:mk.eng.length?mk.eng:null;if(g){eng.push(...g);const Z=g.flatMap(q=>[T([q[0],q[1]]),T([q[2],q[3]])]);box.push([Math.min(...Z.map(q=>q[0]))-.3,Math.min(...Z.map(q=>q[1]))-.3,Math.max(...Z.map(q=>q[0]))+.3,Math.max(...Z.map(q=>q[1]))+.3]);}
    if(!g)lb.push({t:String(z.no),pts:z.pts.map(T),a:Math.abs(area2(z.pts))*k*k});});   // гравировки нет (выкл. или не влезла) — номер текстом
  if(mk.P.length)s+=`<path class="prf" d="${mk.P.map(z=>{const A=T([z[0],z[1]]),C=T([z[2],z[3]]);return `M${r2(A[0])},${r2(A[1])}L${r2(C[0])},${r2(C[1])}`;}).join('')}"/>`;   // перфорация — прорези на линиях сгиба
  if(B)B.lines.forEach(l=>l.segs.forEach((z,zi)=>{const A=T(trPt(t,[z[0],z[1]])),C=T(trPt(t,[z[2],z[3]]));s+=`<path class="bnd ${l.kind==='V'?'bv':'bm'}" d="M${r2(A[0])},${r2(A[1])}L${r2(C[0])},${r2(C[1])}"/>`;
    // подпись — за контуром, у конца линии: кружок с номером по порядку и «V141» (внутри узких полос налезала бы на гравировку номеров)
    if(zi)return;const col=l.kind==='V'?'#c33':'#33c',tx=l.kind+l.ang;let done=false;
    for(const r of [2.6,4.6])for(const [E,O] of [[C,A],[A,C]]){if(done)break;const d=Math.hypot(E[0]-O[0],E[1]-O[1])||1,u=[(E[0]-O[0])/d,(E[1]-O[1])/d],c=[E[0]+u[0]*r,E[1]+u[1]*r],rt=u[0]>=-.2,w=tx.length*1.15;
      const b=[Math.min(c[0]-1.9,rt?c[0]:c[0]-2.2-w),c[1]-1.9,Math.max(c[0]+1.9,rt?c[0]+2.2+w:c[0]),c[1]+1.9];if(r<4&&hit(b))continue;box.push(b);done=true;
      s+=`<path class="t" style="stroke:${col}" d="M${r2(E[0])},${r2(E[1])}L${r2(c[0]-u[0]*1.7)},${r2(c[1]-u[1]*1.7)}"/><circle cx="${r2(c[0])}" cy="${r2(c[1])}" r="1.7" fill="#fff" stroke="${col}" stroke-width=".25"/><text class="no" x="${r2(c[0])}" y="${r2(c[1]+.9)}" text-anchor="middle" style="font-size:2.4px;fill:${col}">${l.k}</text>`
        +`<text class="nb" x="${r2(rt?c[0]+2.2:c[0]-2.2)}" y="${r2(c[1]+.8)}"${rt?'':' text-anchor="end"'} style="font-size:2.4px;fill:${col}">${tx}</text>`;}}));
  if(B)mk.labs.forEach(x=>{const Z=x.g.flatMap(z=>[T([z[0],z[1]]),T([z[2],z[3]])]);box.push([Math.min(...Z.map(q=>q[0])),Math.min(...Z.map(q=>q[1])),Math.max(...Z.map(q=>q[0])),Math.max(...Z.map(q=>q[1]))]);});   // подписи сгибов заняли место
  s+=segP(eng,'eng')+segP(engB,'eng engb')+placeLabels(lb,4.2,.55,box).map(l=>{box.push([l.x-l.t.length*l.h*.3,l.y-l.h/2,l.x+l.t.length*l.h*.3,l.y+l.h/2]);return `<text class="no" x="${r2(l.x)}" y="${r2(l.y+l.h*.35)}" text-anchor="middle" style="font-size:${r2(l.h)}px">${l.t}</text>`;}).join('');
  Q.forEach((A,i)=>{const C=Q[(i+1)%Q.length],L=Math.hypot(P[(i+1)%P.length][0]-P[i][0],P[(i+1)%P.length][1]-P[i][1]),pl=Math.hypot(C[0]-A[0],C[1]-A[1]);if(L<10||pl<4)return;
    let nx=(C[1]-A[1])/pl,ny=-(C[0]-A[0])/pl;const mx=(A[0]+C[0])/2,my=(A[1]+C[1])/2;if(inPoly([mx+nx*.6,my+ny*.6],Q)){nx=-nx;ny=-ny;}
    const tx=String(Math.round(L)),w=tx.length*1.3,c=[mx+nx*(2+Math.abs(ny)*.4),my+ny*2.4],b=[c[0]-w/2,c[1]-1.3,c[0]+w/2,c[1]+1];if(hit(b))return;box.push(b);s+=`<text class="sm" x="${r2(c[0])}" y="${r2(c[1]+.8)}" text-anchor="middle">${tx}</text>`;});
  s+=dimH(ox,oy+t.W*k,ox+t.L*k,oy+t.W*k,oy+t.W*k+8,Math.round(t.L))+dimV(ox+t.L*k,oy,ox+t.L*k,oy+t.W*k,ox+t.L*k+9,Math.round(t.W));
  // 2. кусок в 3D с 4 сторон (снимки, только сам кусок); без WebGL (тесты, старые браузеры) — где на фигуре, схемой одним видом
  const v=stepView(x.ps),bf=projBox(v),tw=new Set(y?y.ps.map(p=>p.id):[]),kf=Math.min(84/(bf[2]-bf[0]),(mh-14)/(bf[3]-bf[1])),orng=sh=>`rgb(${Math.round(200+50*sh)},${Math.round(110+60*sh)},${Math.round(50+40*sh)})`;
  const SHOTS=SH?pieceShots(own,tw,45/((mh-9)/2)):null;
  s+=`<path class="t" d="M20,${r2(my0)}H205M112,${r2(my0)}V${r2(ty0)}M20,${r2(ty0)}H205"/><text class="h2" x="23" y="${r2(my0+4.5)}">${SHOTS?(B?'Элемент — с 4 сторон':'Деталь — с 4 сторон'):'Где на фигуре'}</text>`;
  if(SHOTS)SHOTS.forEach((o,i)=>{const ch=(mh-9)/2,cx=20.5+(i%2)*45.75,cy=my0+6.5+Math.floor(i/2)*(ch+.6);s+=`<image class="shot" href="${o.url}" x="${r2(cx)}" y="${r2(cy)}" width="45" height="${r2(ch)}" preserveAspectRatio="xMidYMid slice"/><text class="lb" x="${r2(cx+1)}" y="${r2(cy+ch-1)}" style="font-size:2px;fill:#555">${o.txt}</text>`;});
  else s+=`<text class="sm" x="109" y="${r2(my0+4.5)}" text-anchor="end">вид ${v.txt}</text>`+facesSVG(v,kf,20+(92-(bf[2]-bf[0])*kf)/2-bf[0]*kf,my0+7+(mh-12-(bf[3]-bf[1])*kf)/2-bf[1]*kf,{color:(p,sh)=>own.has(p.id)?orng(sh):tw.has(p.id)?`rgb(${Math.round(90+50*sh)},${Math.round(130+50*sh)},${Math.round(200+40*sh)})`:grey(.72+.25*sh)});
  // со снимками — «где на фигуре» маленькой картинкой в правом углу (схема готового элемента сдвигается влево)
  if(SHOTS){const ki=Math.min(27/(bf[2]-bf[0]),(mh-14)/(bf[3]-bf[1]));s+=`<path class="t" style="stroke-width:.1" d="M176,${r2(my0+6)}V${r2(ty0-4)}"/><text class="lb" x="190.5" y="${r2(my0+8.5)}" text-anchor="middle" style="font-size:2.2px">где на фигуре</text>`
    +facesSVG(v,ki,177+(27-(bf[2]-bf[0])*ki)/2-bf[0]*ki,my0+10+(mh-14-(bf[3]-bf[1])*ki)/2-bf[1]*ki,{color:(p,sh)=>own.has(p.id)?orng(sh):tw.has(p.id)?`rgb(${Math.round(90+50*sh)},${Math.round(130+50*sh)},${Math.round(200+40*sh)})`:grey(.72+.25*sh)});}
  // 3. готовый кусок крупно: все грани (изнанка — серо-голубым), номера деталей, сгибы синим пунктиром с номером по порядку, швы красным с номером соседа
  const bx=[1e9,1e9,-1e9,-1e9];x.ps.forEach(p=>p.full.forEach(i=>{const q=prjV(v,V[i]);bx[0]=Math.min(bx[0],q[0]);bx[1]=Math.min(bx[1],q[1]);bx[2]=Math.max(bx[2],q[0]);bx[3]=Math.max(bx[3],q[1]);}));
  const kp=Math.min((SHOTS?52:80)/(bx[2]-bx[0]||1),(mh-22)/(bx[3]-bx[1]||1)),px=112+((SHOTS?62:93)-(bx[2]-bx[0])*kp)/2-bx[0]*kp,py=my0+9+(mh-18-(bx[3]-bx[1])*kp)/2-bx[1]*kp,Pp=i=>{const q=prjV(v,V[i]);return [px+q[0]*kp,py+q[1]*kp];};
  const Lt=V3.norm(V3.add(V3.add(v.d,V3.mul(v.up,.7)),V3.mul(v.r,-.4))),fl=[];
  s+=`<text class="h2" x="115" y="${r2(my0+4.5)}">${B?'Готовый элемент — после гибки':'Деталь — швы и соседи'}</text>`;
  x.ps.slice().sort((a,b)=>V3.dot(a.c,v.d)-V3.dot(b.c,v.d)).forEach(p=>{const pts=p.full.map(Pp),sh=.5+.45*Math.abs(V3.dot(p.n,Lt)),fr=V3.dot(p.n,v.d)>0;
    s+=`<polygon class="fc" fill="${fr?orng(sh):`rgb(${Math.round(170+60*sh)},${Math.round(178+55*sh)},${Math.round(190+50*sh)})`}" points="${pts.map(q=>r2(q[0])+','+r2(q[1])).join(' ')}"/>`;if(Math.abs(area2(pts))>10)fl.push({t:String(p.no),pts,a:Math.abs(area2(pts))});});
  const cen=x.ps.reduce((c,p)=>V3.add(c,V3.mul(p.c,1/x.ps.length)),[0,0,0]),cc=(q=>[px+q[0]*kp,py+q[1]*kp])(prjV(v,cen)),bb=[];
  if(B)B.lines.forEach(l=>{const j=CUR.BP.J[l.id],A=Pp(j.A),C=Pp(j.B),m=[(A[0]+C[0])/2,(A[1]+C[1])/2];bb.push([m[0]-1.8,m[1]-1.8,m[0]+1.8,m[1]+1.8]);
    s+=`<path class="bl3" d="M${r2(A[0])},${r2(A[1])}L${r2(C[0])},${r2(C[1])}"/><circle cx="${r2(m[0])}" cy="${r2(m[1])}" r="1.7" fill="#fff" stroke="#1f5fd0" stroke-width=".25"/><text class="no" x="${r2(m[0])}" y="${r2(m[1]+.9)}" text-anchor="middle" style="font-size:2.4px;fill:#1f5fd0">${l.k}</text>`;});
  W.forEach(w=>{const ln=w.ed.map(([a,b])=>[Pp(a),Pp(b)]);s+=`<path class="seam" style="stroke-width:.55" d="${ln.map(([A,C])=>`M${r2(A[0])},${r2(A[1])}L${r2(C[0])},${r2(C[1])}`).join('')}"/>`;
    const [A,C]=ln.reduce((a,b)=>Math.hypot(b[1][0]-b[0][0],b[1][1]-b[0][1])>Math.hypot(a[1][0]-a[0][0],a[1][1]-a[0][1])?b:a),m=[(A[0]+C[0])/2,(A[1]+C[1])/2],d=Math.hypot(m[0]-cc[0],m[1]-cc[1])||1,tx='→'+nm(w.nb),hw=tx.length*.6;
    for(const r of [3,5,7.5]){const c=[m[0]+(m[0]-cc[0])/d*r,m[1]+(m[1]-cc[1])/d*r],b=[c[0]-hw,c[1]-1.2,c[0]+hw,c[1]+1];if(bb.some(z=>b[0]<z[2]&&b[2]>z[0]&&b[1]<z[3]&&b[3]>z[1]))continue;bb.push(b);s+=`<text class="nb" x="${r2(c[0])}" y="${r2(c[1]+.7)}" text-anchor="middle">${shEsc(tx)}</text>`;break;}});
  s+=placeLabels(fl,3,.52,bb).map(l=>`<text class="no" x="${r2(l.x)}" y="${r2(l.y+l.h*.35)}" text-anchor="middle" style="font-size:${r2(l.h)}px">${l.t}</text>`).join('');
  s+=`<text class="sm" x="115" y="${r2(ty0-2)}">${B?'синий пунктир — сгиб (номер по порядку), ':''}красное — шов, →№ — к какой детали</text>`;
  // 4. гибка — клетками по порядку, сварка — строками с профилем шва и чем выставить угол
  let yy=ty0;if(B){s+=`<text class="h2" x="23" y="${r2(yy+4.3)}" style="font-size:3.2px">Гибка — по порядку · V — на себя, m — от себя (глядя на гравировку)${bsh?'':' · угол между гранями после гибки'}</text>`
    +(bsh?`<text class="sm" x="202" y="${r2(yy+4.3)}" text-anchor="end">${onC?`элемент готовый, в угле — ${bsh.some(o=>o.how==='tpl')?'уголок':'дуга угла'}`:`снимки — лист «Гибка ${x.name}»`}</text>`:'');
    // строкой: номер по порядку, V/m и угол, куда гнуть, между какими деталями, длина линии, чем выставить угол (картинки гибки — потом)
    B.lines.forEach((l,i)=>{const cx=20+(bc>1?(i%2)*92.5:0),cy=yy+6+(onC?BIH+1:0)+Math.floor(i/bc)*BRH,V=l.kind==='V',col=V?'#c33':'#33c';
      if(onC)s+=bendImg(20.5+i*92.5,yy+6,91.5,BIH,l,bsh[i],x.bi);
      s+=`<g class="br"><circle cx="${r2(cx+4.5)}" cy="${r2(cy+2.2)}" r="1.6" fill="#fff" stroke="${col}" stroke-width=".25"/><text class="no" x="${r2(cx+4.5)}" y="${r2(cy+3.05)}" text-anchor="middle" style="font-size:2.3px;fill:${col}">${l.k}</text>`
        +`<text class="td" x="${r2(cx+7.2)}" y="${r2(cy+3.2)}" style="font-size:${bc>1?2.6:2.8}px"><tspan style="fill:${col};font-weight:bold;font-style:normal">${l.kind}${l.ang}</tspan> — ${V?'на себя':'от себя'} · между № ${nm(l.p)} и ${nm(l.q)} · линия ${Math.round(l.len)} мм · ${shEsc(onC?bendHow(l,bsh[i],true):tplSay(l.ang,true))}</text></g>`;});
    yy+=hb;s+=`<path class="t" style="stroke-width:.08" d="M20,${r2(yy)}H205"/>`;}ln.slice(0,nl).forEach((l,i)=>{const by=r2(yy+rh*.78),cw=l[0].w?185/wc:185,X=cw<100?[33,45,64]:[106,122,144];l.forEach((r,j)=>{const x0=20+j*cw;
      if(r.h)s+=`<text class="h2" x="23" y="${by}" style="font-size:3.2px">${shEsc(r.h)}</text>`;
      else s+=`<text class="td" x="${r2(x0+3)}" y="${by}">${shEsc(r.t)}</text>`+weldGlyph(x0+X[0],yy+rh*.85,r.a,rh*.72,r.tp.startsWith('уголок'),r.o)+`<text class="no" x="${r2(x0+X[1])}" y="${by}" style="font-size:3.1px">${shEsc(r.at)}</text><text class="td" x="${r2(x0+X[2])}" y="${by}">${shEsc(r.tp)}</text>`;});
    if(l[0].w&&wc>1)s+=`<path class="t" style="stroke-width:.08" d="M112.5,${r2(yy)}V${r2(yy+rh)}"/>`;yy+=rh;if(i<nl-1)s+=`<path class="t" style="stroke-width:.08" d="M20,${r2(yy)}H205"/>`;});
  if(nl<ln.length)s+=`<text class="sm" x="202" y="${r2(ty0-0.8)}" text-anchor="end">не влезло строк: ${ln.slice(nl).flat().length} — см. спецификацию</text>`;
  const nb=B?B.lines.length:0,alt=`${B?'карта заготовки со сгибами':back?'карта детали (подложка глаза)':'карта детали'} ${x.name}${y?` и зеркальной ${y.name}`:''}: ${B?`детали № ${x.ps.map(p=>p.no).join(', ')}, `:''}габарит реза ${Math.round(t.L)} × ${Math.round(t.W)} мм, ${nb?`${nb} ${plural(nb,'сгиб','сгиба','сгибов')}, `:''}${W.length} ${plural(W.length,'шов','шва','швов')}, металл ${ST.t} мм, ${MATN[ST.mat]||ST.mat}, масса ${fmt(mass,2)} кг/шт, рез ${Math.round(perim(o.pts))} мм, кол. ${y?2:1}`;
  return {alt,head:x.name+(y?` и ${y.name}`:''),title:B?'Карта заготовки со сгибами':'Карта детали',scale:scaleTxt(n),mass:fmt(mass*(y?2:1),2)+' кг',body:s,rows:rows.filter(r=>!r.h).length+(B?B.lines.length:0),bends:bsh&&!onC?{x,y,B,shots:bsh}:null};}
// лист «Гибка»: по 2 в ряд, до 8 на лист; ch — высота клетки, ih — снимка (не выше квадрата)
const bsGrid=n=>{const ch=Math.min(124,245/Math.ceil(Math.min(8,n)/2));return {ch,ih:Math.min(ch-9.5,91.5)};};
// чем проверить угол сгиба по снимку; short — для строки на карте
const bendHow=(l,o,short)=>{const t=tplNo(Math.round(l.ang));return o.how==='tpl'?(o.hit?(short?`уголок ${t} — сразу после сгиба`:`уголок ${t} — сразу после этого сгиба: в готовом элементе мешает соседняя грань`):`уголок ${t}${short?'':' — в угол, прилегает к обеим граням'}`)
  :o.how==='ruler'?'по линейке'+(short?'':' — грани почти в одну плоскость'):tplSay(l.ang,true);};
// снимок сгиба в клетке x0, y0, w × h: поверх — номера деталей, номер сгиба кружком, номер уголка (текстом — чёткие при любом увеличении); bi — заготовка: data-b и data-k — клик открывает сгиб в 3D (bend3d.js)
function bendImg(x0,y0,w,h,l,o,bi){const col=l.kind==='V'?'#c33':'#33c',X=f=>r2(x0+f*w),Y=(f,d=0)=>r2(y0+f*h+d),hs='paint-order:stroke;stroke:#fff;stroke-linejoin:round';
  return `<image class="bsh" data-b="${bi}" data-k="${l.k}" href="${o.url}" x="${r2(x0)}" y="${r2(y0)}" width="${r2(w)}" height="${r2(h)}" preserveAspectRatio="none"/><rect class="t" style="stroke-width:.12" x="${r2(x0)}" y="${r2(y0)}" width="${r2(w)}" height="${r2(h)}"/>`
    +o.labs.map(b=>b.k==='bend'?`<circle cx="${X(b.x)}" cy="${Y(b.y)}" r="2" fill="#fff" stroke="${col}" stroke-width=".3"/><text class="no" x="${X(b.x)}" y="${Y(b.y,1.05)}" text-anchor="middle" style="font-size:2.9px;fill:${col}">${b.t}</text>`
      :b.k==='tpl'?`<text class="no" x="${X(b.x)}" y="${Y(b.y,.9)}" text-anchor="middle" style="font-size:2.6px;fill:#b01818;${hs};stroke-width:.5">${shEsc(b.t)}</text>`
      :`<text class="no" x="${X(b.x)}" y="${Y(b.y,1.1)}" text-anchor="middle" style="font-size:3.2px;${hs};stroke-width:.7">${b.t}</text>`).join('');}
// c — карта элемента с c.bends: листы «Гибка» — снимок на каждый сгиб
function cardBends(c){const {x,y,B,shots}=c.bends,tq=shots.some(o=>o.how==='tpl'),g=bsGrid(B.lines.length),nm=pi=>CUR.R.parts[pi].no,pg=Math.ceil(B.lines.length/8),out=[];
  for(let p0=0;p0<B.lines.length;p0+=8){let s=`<text class="h2" x="23" y="22.5">Гибка — проверка ${tq?'уголком':'угла'} · элемент в готовом виде${pg>1?` · ${p0/8+1} из ${pg}`:''}</text>`
      +`<text class="sm" x="23" y="26.3">${shEsc(tq?'после каждого сгиба уголок — в угол: прилегает без щели — верно; щель к концам уголка — догнуть; не доходит до вершины — перегнут':'после каждого сгиба — угол транспортиром: дуга на снимке показывает, какой угол мерить, цифра — угол между гранями')}</text>`;
    B.lines.slice(p0,p0+8).forEach((l,i)=>{const o=shots[p0+i],cx=20.5+(i%2)*92.5,cy=29+Math.floor(i/2)*g.ch,V=l.kind==='V',col=V?'#c33':'#33c',ty=cy+g.ih+3.6;
      s+=bendImg(cx,cy,91.5,g.ih,l,o,x.bi)+`<g class="bs"><circle cx="${r2(cx+2.2)}" cy="${r2(ty-1)}" r="1.7" fill="#fff" stroke="${col}" stroke-width=".25"/><text class="no" x="${r2(cx+2.2)}" y="${r2(ty-.1)}" text-anchor="middle" style="font-size:2.4px;fill:${col}">${l.k}</text>`
        +`<text class="td" x="${r2(cx+5)}" y="${r2(ty)}" style="font-size:2.7px"><tspan style="fill:${col};font-weight:bold;font-style:normal">${l.kind}${l.ang}</tspan> — ${V?'на себя':'от себя'} · между № ${nm(l.p)} и ${nm(l.q)} · линия ${Math.round(l.len)} мм</text>`
        +`<text class="sm" x="${r2(cx+5)}" y="${r2(ty+3.3)}"${o.hit?' style="fill:#c00"':''}>${shEsc(bendHow(l,o))}</text></g>`;});
    const ls=B.lines.slice(p0,p0+8);out.push({head:'Гибка '+x.name+(y?` и ${y.name}`:''),title:'Гибка — проверка '+(tq?'уголком':'угла'),scale:'—',mass:c.mass,body:s,rows:0,
      alt:`гибка ${x.name}${y?` и ${y.name}`:''} — проверка ${tq?'уголком':'угла'}, снимки элемента: сгибы ${p0+1}–${p0+ls.length} из ${B.lines.length} — ${ls.map(l=>`${l.k}) ${l.kind}${l.ang} между № ${nm(l.p)} и ${nm(l.q)}`).join(', ')}`});}
  return out;}
function buildCards(){if(!CUR||!CUR.PC||!CUR.R.parts.length)return [];const {L}=asmUnits(),C=L.filter((x,i)=>(x.tw<0||x.tw>i)&&CUR.PC.some(c=>c.id===(x.bi>=0?'b'+x.bi:x.ps[0].id)&&c.pts.length>2)).map(x=>cardPiece(x,x.tw>=0?L[x.tw]:null)).flatMap(c=>c.bends?[c,...cardBends(c)]:[c]),date=shDate();
  return C.map((b,i)=>({title:b.head,rows:b.rows,svg:wrapA4(b,{n:i+1,N:C.length,date})}));}

/* ---------- DXF: раскрой (все листы) и детали (сеткой) ---------- */
function segNbOf(p){return p.segs.map(g=>g.nb>=0?CUR.R.parts[g.nb].no:null);}
function dxfNest(){const N=CUR.N,e=[];N.sheets.forEach((sh,i)=>{const oy=i*(N.H+200);dxfPoly(e,[[0,0],[N.W,0],[N.W,N.H],[0,N.H]],'SHEET',0,oy);dxfTxt(e,N.W/2,N.H+60+oy,40,`SHEET ${i+1}`,"SHEET");dxfGas(e,N.W/2,N.H+120+oy);
  sh.items.forEach(o=>{dxfMarksOf(e,o,o.x,o.y+oy);dxfPoly(e,o.pts,"CUT",o.x,o.y+oy);});});return dxfDoc(e);}
// гравировка — ENGRAVE, линии сгиба — BEND_V и BEND_M, прорези перфорации — PERF (сквозной рез отрезками); у каждой детали в файле — раньше её контура CUT
// газ резки в DXF не задаётся (только геометрия) — под TIG надпись на служебном слое SHEET (не CUT/ENGRAVE); латиницей: в DXF R12 кириллица ломается
const DXF_N2='CUT WITH NITROGEN N2 - FOR TIG WELDING';
function dxfGas(e,x,y){if(weldOf()==='tig')dxfTxt(e,x,y,30,DXF_N2,'SHEET');}
function dxfMarksOf(e,o,ox,oy){const m=itemMarks(o);if(m.eng.length)dxfSegs(e,m.eng,'ENGRAVE',ox,oy);if(m.V.length)dxfSegs(e,m.V,'BEND_V',ox,oy);if(m.M.length)dxfSegs(e,m.M,'BEND_M',ox,oy);if(m.P.length)dxfSegs(e,m.P,'PERF',ox,oy);}
function dxfParts(){const ps=CUR.PC.filter(o=>!o.bad),e=[];let x=0,y=0,rowH=0;
  // с гравировкой и с гибкой — зеркально, внутренней стороной вверх; заготовка — длинной стороной по X
  const it=ps.map(o=>{const f=ST.engrave||ST.bend,t=o.B?bendAlign(o.pts,f):{f,c:1,s:0,x:0,y:0},q={id:o.id,no:o.no,pts:o.pts.map(p=>trPt(t,p))};const xs=q.pts.map(p=>p[0]),ys=q.pts.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys);
    q.pts=q.pts.map(p=>[p[0]-x0,p[1]-y0]);q.tr={...t,x:t.x-x0,y:t.y-y0};q.L=Math.max(...xs)-x0;q.W=Math.max(...ys)-y0;return q;}),rowW=Math.max(1500,Math.max(...it.map(o=>o.L))+50);
  it.forEach(o=>{if(x+o.L>rowW){x=0;y+=rowH+30;rowH=0;}dxfMarksOf(e,o,x,y);dxfPoly(e,o.pts,'CUT',x,y);x+=o.L+30;rowH=Math.max(rowH,o.W);});
  // уголки-шаблоны — рядом ниже деталей
  if(CUR.TPL&&CUR.TPL.length){x=0;y+=rowH+60;rowH=0;CUR.TPL.forEach(o=>{const xs=o.pts.map(q=>q[0]),ys=o.pts.map(q=>q[1]),x0=Math.min(...xs),y0=Math.min(...ys),P=o.pts.map(q=>[q[0]-x0,q[1]-y0]),w=Math.max(...xs)-x0;
    if(x+w>rowW){x=0;y+=rowH+30;rowH=0;}{const g=engraveSegs(tplNo(o.a),P);if(g)dxfSegs(e,g,'ENGRAVE',x,y);}dxfPoly(e,P,'CUT',x,y);x+=w+30;rowH=Math.max(rowH,Math.max(...ys)-y0);});}
  dxfGas(e,rowW/2,y+rowH+80);return dxfDoc(e);}
