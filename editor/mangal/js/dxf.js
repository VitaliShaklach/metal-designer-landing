/* ---------- файлы для лазера: DXF каждой листовой детали из той же геометрии, что 3D ----------
   Деталь: {loops:[[[x,y]…]…], circles:[[x,y,r]…], bends:[[[x,y],[x,y]]…]} в см; в файл — мм, начало в левом нижнем углу.
   Контуры и отверстия — слой CUT, линии гиба — слой BEND (не резать), рамка в DXF всего листа — слой SHEET (не резать),
   прямоугольник заготовки в DXF «по заготовке» (_zag) — слой BLANK (не резать, для базирования). */
const rect=(w,h)=>[[0,0],[w,0],[w,h],[0,h],[0,0]];
// THREE.Shape → деталь: внешний контур + отверстия (окружности — CIRCLE)
function shapeGeo(s){const g={loops:[s.getPoints().map(p=>[p.x,p.y])],circles:[],bends:[]};
  s.holes.forEach(h=>{const c=h.curves[0];if(h.curves.length===1&&c&&c.isEllipseCurve)g.circles.push([c.aX,c.aY,c.xRadius]);else g.loops.push(h.getPoints().map(p=>[p.x,p.y]));});return g;}
// вырез-логотип с «островками» глаз на перемычках: обходим силуэт, у каждой перемычки спускаемся и огибаем глаз
function logoLoop(site){const bw=LOGO_BR/LOGO_U,out=[];
  LOGO_OUT.forEach(([x,v],i)=>{out.push([x,v]);
    if(i===0)LOGO_EYES.forEach(([ex,ev])=>{const c=ex+.5;out.push([c-bw/2,.5],[c-bw/2,ev],[ex,ev],[ex,ev+2],[ex+1,ev+2],[ex+1,ev],[c+bw/2,ev],[c+bw/2,.5]);});});
  out.push(out[0]);return out.map(([x,v])=>logoZY(x,v,site));}
// стенка-прямоугольник z0…z0+w, y0…y0+h с логотипом (если включён)
function logoWallGeo(z0,w,y0,h){const g={loops:[[[z0,y0],[z0+w,y0],[z0+w,y0+h],[z0,y0+h],[z0,y0]]],circles:[],bends:[]};
  if(S.logo&&logoSite())g.loops.push(logoLoop(logoSite()));return g;}
// перегородка жаровни: тело, «ушки» и ручка — одной деталью (в плоскости z–y)
function dividerGeo(){const yb=divY0(),zi=DIV_IN,z1=W,y2=T-DIV_SD;
  return {loops:[[[zi,yb],[z1-zi,yb],[z1-zi,y2],[z1+DIV_EAR,y2],[z1+DIV_EAR,T],[-DIV_HL,T],[-DIV_HL,T-DIV_HH],[0,T-DIV_HH],[0,y2],[zi,y2],[zi,yb]]],circles:[],bends:[]};}
// задвижка поддува: развёртка с отгибами по концам (линии гиба — слой BEND)
function airGeo(){const L=AIR_L+2*AIR_TH,x0=AIR_X0-AIR_TH;
  return {loops:[rect(L,AIR_H)],circles:holes().filter(x=>x-HOLE/2>AIR_X0+.2&&x+HOLE/2<AIR_X0+AIR_L-.2).map(x=>[x-x0,AIR_H/2,HOLE/2]),bends:[[[AIR_TH,0],[AIR_TH,AIR_H]],[[AIR_TH+AIR_L,0],[AIR_TH+AIR_L,AIR_H]]]};}
// скоба задвижки: плоский профиль 12 × 30 из листа 5 мм (без гибки) — тот же контур, что в 3D
const airHookGeo=()=>{const P=ahProfile();return {loops:[[...P,P[0]]],circles:[],bends:[]};};
// колосник печи: лист 15 мм с отверстиями Ø20
function stoveGrateGeo(){const z0=W/2-GP_W/2;return {loops:[rect(GR_LEN,GP_W)],circles:gpX().flatMap(x=>gpZ().map(z=>[x-GR_X0,z-z0,GP_D/2])),bends:[]};}
const geoR=(w,h)=>({loops:[rect(w,h)],circles:[],bends:[]});
// колосник мангала (половина): лист 5 мм, отверстия Ø10 (CG_D) сеткой с шагом 20 (CG_P), по центру; от края до центра крайнего — не меньше 15 мм
const cgGrid=L=>{const n=Math.floor((L-3)/CG_P+1e-9)+1,o=(L-(n-1)*CG_P)/2;return Array.from({length:n},(_,i)=>o+i*CG_P);};
function grillGrateGeo(){return {loops:[rect(CG_L,CG_W)],circles:cgGrid(CG_L).flatMap(x=>cgGrid(CG_W).map(z=>[x,z,CG_D/2])),bends:[]};}

// список листовых деталей текущего проекта (режим и галочки — как на модели)
function laserParts(){const g=gOn(),k=sOn(),LL=legsList(),r=[];
  const add=(file,name,mm,q,pt,geo,note='')=>r.push({file,name,mm,q,pt,geo,note});
  if(g){add('grill_side_back','Боковина жаровни задняя',5,1,'side0',()=>shapeGeo(grillWallShape(true)),'с вырезом под ручку решётки');
    add('grill_side_front','Боковина жаровни передняя',5,1,'side1',()=>shapeGeo(grillWallShape(false)));
    add('grill_bottom','Дно жаровни',5,1,'gBot',()=>geoR(L1,W));
    add('grill_end_right','Торец жаровни правый',5,1,'gEnd',()=>geoR(W-2*t,H1-t));
    if(S.mode==='grill')add('grill_end_left','Торец жаровни левый',5,1,'gEnd0',()=>logoWallGeo(t,W-2*t,B+t,H1-t),S.logo?'с логотипом':'');
    if(S.div)add('grill_divider','Перегородка жаровни',5,1,'div',dividerGeo,'тело, ушки и ручка — одна деталь');
    if(S.cgr){const nh=`${cgGrid(CG_L).length*cgGrid(CG_W).length} отв. Ø${CG_D*10} шагом ${CG_P*10}`;   // половины одинаковые; две строки — чтобы выбирались на модели по отдельности
      add('grill_grate_1','Колосник мангала 1 (левая половина)',5,1,'cgr1',grillGrateGeo,nh);add('grill_grate_2','Колосник мангала 2 (правая, у ручки)',5,1,'cgr2',grillGrateGeo,nh);}
    if(S.airSl)add('grill_air_slider','Задвижка поддува',Math.round(AIR_T*10),2,'air',airGeo,`отгибы по концам ${us(AIR_TH)} — слой BEND`);
    if(S.hook)add('grill_air_hook','Скоба задвижки',Math.round(AH_T*10),4,'hook',airHookGeo,`плоская, ставится ребром, приварить к боковине по ребру ${us(AH_HEEL)}`);}
  if(k){add('stove_side_back','Боковина печи задняя',5,1,'sK0',()=>shapeGeo(stoveWallShape(true)),S.chim?'с отверстием трубы 60 × 60':'');
    add('stove_side_front','Боковина печи передняя',5,1,'sK1',()=>shapeGeo(stoveWallShape(false)));
    add('stove_bottom','Дно печи',5,1,'sBot',()=>S.draft?shapeGeo(holedPlate(-L2,0,ZK0,ZK1)):geoR(L2,WK),S.draft?`${DR_X.length*DR_Z.length} отв. Ø20`:'');
    add('stove_partition','Перегородка печи',5,1,'wall',()=>geoR(WK-2*t,H2-t));
    if(S.tie)add('stove_tie','Полоса у дверцы',5,1,'tie',()=>geoR(TIE_W,WK-2*t));
    if(S.lintel)add('stove_lintel','Глухой верх топки',5,1,'lintel',()=>logoWallGeo(ZK0+t,WK-2*t,T-FL_H,FL_H-t),S.logo?'с логотипом':'');
    if(S.fb)add('stove_deflector','Отсекатель пламени',5,1,'fb',()=>geoR(FB_L,fbW()));
    if(S.door)add('stove_door','Дверца топки',3,1,'door',()=>geoR(WK,DH()));
    if(S.draft)add('stove_shiber','Шибер поддувала',3,1,'shib',()=>geoR(SH_L,SH_W),'край отогнуть вниз на 25 мм — ручка');
    if(S.grate&&S.grType==='plate')add('stove_grate','Колосник печи',15,1,'grate',stoveGrateGeo);}
  if(S.legs){add('leg_mount_plate','Площадка под ножку (на дно)',5,LL.length,'legs',()=>geoR(8,8));
    const nW=LL.filter(l=>l[3]).length;if(nW)add('wheel_pad','Площадка под колесо',5,nW,'pads',()=>geoR(PADX,PADZ),'4 отверстия под колесо — сверлить по факту');}
  return r;}

// деталь → мм, сдвиг в (0,0), длина реза и врезки
function partMM(p){const G=p.geo(),xs=[],ys=[];G.loops.forEach(l=>l.forEach(([x,y])=>{xs.push(x);ys.push(y);}));
  const mx=Math.min(...xs),my=Math.min(...ys),f=v=>Math.round(v*1000)/100,P=([x,y])=>[f(x-mx),f(y-my)];
  const loops=G.loops.map(l=>l.map(P)),circles=G.circles.map(([x,y,r])=>[...P([x,y]),f(r)]),bends=G.bends.map(b=>b.map(P));
  let cut=0;loops.forEach(l=>{for(let i=0;i<l.length-1;i++)cut+=Math.hypot(l[i+1][0]-l[i][0],l[i+1][1]-l[i][1]);});circles.forEach(c=>cut+=2*Math.PI*c[2]);
  return {loops,circles,bends,w:f(Math.max(...xs)-mx),h:f(Math.max(...ys)-my),cut,pierce:loops.length+circles.length};}
/* ---------- заготовки с гильотины: металл режут в размер на гильотине, на лазер везут готовый прямоугольник ----------
   Рубить ли деталь, решает галочка «рубим» во вкладке «Гильотина» (gilOn в nest.js, умолчание — gilDef). Вид детали, если её рубить:
   gil  — готовая деталь: наружный контур — прямоугольник по габариту, внутри ничего — лазер не нужен;
   zag  — заготовка под лазер: гильотина режет габарит, лазер — всё, что не лежит на сторонах габарита
          (отверстия, вырезы, пазы с кромки; у перегородки жаровни с ушками и ручкой — почти весь контур);
   list — не рубится (контура нет): лазер режет деталь целиком из листа. */
const BLANK_EPS=.01;   // допуск «отрезок лежит на стороне габарита», мм
// деталь по заготовке (мм): из наружного контура выкинуты отрезки на сторонах габарита — остаются открытые ломаные (пазы и вырезы с кромки);
// внутренние контуры, окружности и гибы — как есть. blank — прямоугольник заготовки (слой BLANK).
// pierce — с запасом: по одной на каждую открытую ломаную, хотя цех может заходить с кромки без прожига
function blankMM(p,m=partMM(p)){const E=BLANK_EPS,w=m.w,h=m.h,O=m.loops[0]||[],ax=v=>Math.abs(v)<E,
    on=(a,b)=>ax(a[0])&&ax(b[0])||ax(a[0]-w)&&ax(b[0]-w)||ax(a[1])&&ax(b[1])||ax(a[1]-h)&&ax(b[1]-h),seg=[];
  for(let i=0;i<O.length-1;i++){const a=O[i],b=O[i+1];if(a[0]!==b[0]||a[1]!==b[1])seg.push([a,b,on(a,b)]);}
  const k=seg.findIndex(s=>s[2]),open=[];
  if(k<0){if(O.length)open.push(O);}   // контур касается габарита только точками — режем весь
  else{let cur=null;for(let j=1;j<=seg.length;j++){const s=seg[(k+j)%seg.length];   // начинаем после отрезка на стороне — ломаная не рвётся на стыке начала и конца
    if(s[2]){if(cur)open.push(cur);cur=null;}else{if(!cur)cur=[s[0]];cur.push(s[1]);}}}
  const inner=m.loops.slice(1),loops=[...open,...inner],len=l=>{let c=0;for(let i=0;i<l.length-1;i++)c+=Math.hypot(l[i+1][0]-l[i][0],l[i+1][1]-l[i][1]);return c;};
  const cut=loops.reduce((a,l)=>a+len(l),0)+m.circles.reduce((a,c)=>a+2*Math.PI*c[2],0);
  return {w,h,loops,circles:m.circles,bends:m.bends,blank:rect(w,h),open:open.length,cut,pierce:inner.length+m.circles.length+open.length};}
// вид детали по partMM (мм) и переключателю sel ('gil' — гильотина, 'laser' — лазер): 'gil' | 'zag' | 'list'; контура нет (в Node у боковин) — 'list'
function partKind(m,sel='gil'){if(sel==='laser'||!m||!m.loops||!m.loops[0]||!m.loops[0].length||!(m.w>0&&m.h>0))return 'list';
  return !blankMM(null,m).open&&m.loops.length===1&&!m.circles.length?'gil':'zag';}
// m.sheet — рамка листа (замкнутый контур), только у DXF всего листа (nestDxf, gilDxf); m.blank — прямоугольник заготовки (blankMM);
// m.blanks — заготовки на схеме гильотины (gilDxf), слой BLANK; m.texts — [x, y, высота, строка] — надписи R12 TEXT по центру, слой TEXT
function dxfText(m){const e=[],L=(a,b,lay)=>e.push('0','LINE','8',lay,'10',a[0],'20',a[1],'30',0,'11',b[0],'21',b[1],'31',0);
  if(m.sheet)for(let i=0;i<m.sheet.length-1;i++)L(m.sheet[i],m.sheet[i+1],'SHEET');
  [m.blank,...(m.blanks||[])].forEach(b=>{if(b)for(let i=0;i<b.length-1;i++)L(b[i],b[i+1],'BLANK');});
  (m.texts||[]).forEach(([x,y,h,s])=>e.push('0','TEXT','8','TEXT','10',x,'20',y,'30',0,'40',h,'1',s,'72',1,'11',x,'21',y,'31',0,'73',2));
  (m.loops||[]).forEach(l=>{for(let i=0;i<l.length-1;i++)if(l[i][0]!==l[i+1][0]||l[i][1]!==l[i+1][1])L(l[i],l[i+1],'CUT');});
  (m.circles||[]).forEach(([x,y,r])=>e.push('0','CIRCLE','8','CUT','10',x,'20',y,'30',0,'40',r));
  (m.bends||[]).forEach(([a,b])=>L(a,b,'BEND'));
  return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70',4,'0','ENDSEC','0','SECTION','2','ENTITIES',...e,'0','ENDSEC','0','EOF'].join('\r\n')+'\r\n';}
const dxfName=p=>`${p.file}_${p.mm}mm_x${p.q}.dxf`;
const dxfNameZ=p=>`${p.file}_${p.mm}mm_x${p.q}_zag.dxf`;   // по заготовке: CUT — только то, что режет лазер, BLANK — заготовка

// zip без сжатия (stored) — несколько DXF одним файлом
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function zipFiles(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const u16=v=>[v&255,v>>8&255],u32=v=>[v&255,v>>8&255,v>>16&255,v>>>24&255];
  files.forEach(([name,text])=>{const nb=enc.encode(name),db=enc.encode(text);let c=0xFFFFFFFF;for(const b of db)c=CRC[(c^b)&255]^(c>>>8);c=(c^0xFFFFFFFF)>>>0;
    const h=[...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0)];
    parts.push(new Uint8Array(h),nb,db);
    cen.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
    off+=h.length+nb.length+db.length;});
  const cs=cen.reduce((a,b)=>a+b.length,0);
  return new Blob([...parts,...cen,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cs),...u32(off),...u16(0)])]);}

// сохранение: в опубликованной странице — через claude.use("downloads") (только .zip), локально — обычное скачивание
const dlP=(window.claude&&window.claude.use)?window.claude.use('downloads').catch(()=>null):Promise.resolve(null);
async function saveOut(name,data,mid='dxfMsg'){const dl=await dlP,msg=document.getElementById(mid);   // mid — где написать «Скачано»: у каждого варианта своя строка
  if(dl){try{await dl.save({filename:name,data});msg.textContent='Сохранено: '+name;}catch(e){msg.textContent=e&&e.code==='declined'?'Сохранение отменено':'Не удалось сохранить: '+(e&&e.message||e);}return;}
  const a=document.createElement('a');a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);msg.textContent='Скачано: '+name;}
async function saveDxf(name,text,mid){const dl=await dlP;if(dl)saveOut(name.replace(/\.dxf$/,'.zip'),zipFiles([[name,text]]),mid);else saveOut(name,text,mid);}
const savePart=p=>saveDxf(dxfName(p),dxfText(partMM(p)));
const MODE_FILE=()=>({both:'mangal_s_pechyu',grill:'mangal',stove:'pech'})[S.mode];   // начало имён ZIP
const PDF_ELEM=pt=>{for(const e of PARTS)if(e.d.some(d=>d[0]===pt))return e.id;return null;};

// эскиз детали — из той же геометрии, что уходит в DXF. kind (режим гильотины): 'gil' — просто прямоугольник,
// 'zag' — контур заготовки тонким пунктиром, линии лазера (b — blankMM: пазы, вырезы, отверстия) сплошные; иначе — полный контур
function dxfSketch(m,kind,b){const k=Math.min(230/m.w,64/m.h),w=Math.max(8,m.w*k),h=Math.max(8,m.h*k),H=m.h,pl=(l,c)=>`<polyline${c?` class="${c}"`:''} points="${l.map(([x,y])=>`${x},${H-y}`).join(' ')}"/>`;
  let g='';
  if(kind==='gil')g=pl(rect(m.w,m.h));
  else{const d=kind==='zag'&&b?b:m;if(d!==m)g+=pl(rect(m.w,m.h),'bl');
    d.loops.forEach(l=>g+=pl(l));
    d.circles.forEach(([x,y,r])=>g+=`<circle cx="${x}" cy="${H-y}" r="${r}"/>`);
    d.bends.forEach(([a,c])=>g+=`<line class="bd" x1="${a[0]}" y1="${H-a[1]}" x2="${c[0]}" y2="${H-c[1]}"/>`);}
  return `<svg class="dxfsk" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="-2 -2 ${m.w+4} ${m.h+4}" aria-hidden="true">${g}</svg>`;}
