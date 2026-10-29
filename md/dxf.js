/* ---------- файлы для лазера: DXF каждой листовой детали из той же геометрии, что 3D ----------
   Деталь: {loops:[[[x,y]…]…], circles:[[x,y,r]…], bends:[[[x,y],[x,y]]…]} в см; в файл — мм, начало в левом нижнем углу.
   Контуры и отверстия — слой CUT, линии гиба — слой BEND (не резать). */
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
// колосник печи: лист 15 мм с отверстиями Ø20
function stoveGrateGeo(){const z0=W/2-GP_W/2;return {loops:[rect(GR_LEN,GP_W)],circles:gpX().flatMap(x=>gpZ().map(z=>[x-GR_X0,z-z0,GP_D/2])),bends:[]};}
const geoR=(w,h)=>({loops:[rect(w,h)],circles:[],bends:[]});

// список листовых деталей текущего проекта (режим и галочки — как на модели)
function laserParts(){const g=gOn(),k=sOn(),LL=legsList(),r=[];
  const add=(file,name,mm,q,pt,geo,note='')=>r.push({file,name,mm,q,pt,geo,note});
  if(g){add('grill_side_back','Боковина жаровни задняя',5,1,'side0',()=>shapeGeo(grillWallShape(true)),'с вырезом под ручку решётки');
    add('grill_side_front','Боковина жаровни передняя',5,1,'side1',()=>shapeGeo(grillWallShape(false)));
    add('grill_bottom','Дно жаровни',5,1,'gBot',()=>geoR(L1,W));
    add('grill_end_right','Торец жаровни правый',5,1,'gEnd',()=>geoR(W-2*t,H1-t));
    if(S.mode==='grill')add('grill_end_left','Торец жаровни левый',5,1,'gEnd0',()=>logoWallGeo(t,W-2*t,B+t,H1-t),S.logo?'с логотипом':'');
    if(S.div)add('grill_divider','Перегородка жаровни',5,1,'div',dividerGeo,'тело, ушки и ручка — одна деталь');
    if(S.airSl)add('grill_air_slider','Задвижка поддува',3,2,'air',airGeo,'отгибы по концам 20 мм — слой BEND');}
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
    const nW=LL.filter(l=>l[3]).length;if(nW)add('wheel_pad','Площадка под колесо',6,nW,'pads',()=>geoR(PADX,PADZ),'4 отверстия под колесо — сверлить по факту');}
  return r;}

// деталь → мм, сдвиг в (0,0), длина реза и врезки
function partMM(p){const G=p.geo(),xs=[],ys=[];G.loops.forEach(l=>l.forEach(([x,y])=>{xs.push(x);ys.push(y);}));
  const mx=Math.min(...xs),my=Math.min(...ys),f=v=>Math.round(v*1000)/100,P=([x,y])=>[f(x-mx),f(y-my)];
  const loops=G.loops.map(l=>l.map(P)),circles=G.circles.map(([x,y,r])=>[...P([x,y]),f(r)]),bends=G.bends.map(b=>b.map(P));
  let cut=0;loops.forEach(l=>{for(let i=0;i<l.length-1;i++)cut+=Math.hypot(l[i+1][0]-l[i][0],l[i+1][1]-l[i][1]);});circles.forEach(c=>cut+=2*Math.PI*c[2]);
  return {loops,circles,bends,w:f(Math.max(...xs)-mx),h:f(Math.max(...ys)-my),cut,pierce:loops.length+circles.length};}
function dxfText(m){const e=[],L=(a,b,lay)=>e.push('0','LINE','8',lay,'10',a[0],'20',a[1],'30',0,'11',b[0],'21',b[1],'31',0);
  m.loops.forEach(l=>{for(let i=0;i<l.length-1;i++)if(l[i][0]!==l[i+1][0]||l[i][1]!==l[i+1][1])L(l[i],l[i+1],'CUT');});
  m.circles.forEach(([x,y,r])=>e.push('0','CIRCLE','8','CUT','10',x,'20',y,'30',0,'40',r));
  m.bends.forEach(([a,b])=>L(a,b,'BEND'));
  return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70',4,'0','ENDSEC','0','SECTION','2','ENTITIES',...e,'0','ENDSEC','0','EOF'].join('\r\n')+'\r\n';}
const dxfName=p=>`${p.file}_${p.mm}mm_x${p.q}.dxf`;

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
async function saveOut(name,data){const dl=await dlP,msg=document.getElementById('dxfMsg');
  if(dl){try{await dl.save({filename:name,data});msg.textContent='Сохранено: '+name;}catch(e){msg.textContent=e&&e.code==='declined'?'Сохранение отменено':'Не удалось сохранить: '+(e&&e.message||e);}return;}
  const a=document.createElement('a');a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);msg.textContent='Скачано: '+name;}
async function savePart(p){const m=partMM(p),dl=await dlP;
  if(dl)saveOut(dxfName(p).replace(/\.dxf$/,'.zip'),zipFiles([[dxfName(p),dxfText(m)]]));else saveOut(dxfName(p),dxfText(m));}
function saveAll(){const ps=laserParts().filter(p=>inSel(PDF_ELEM(p.pt),p.pt));
  const mode=({both:'mangal_s_pechyu',grill:'mangal',stove:'pech'})[S.mode];
  saveOut(`${mode}_dxf_${ps.length}_detaley.zip`,zipFiles(ps.map(p=>[dxfName(p),dxfText(partMM(p))])));}
const PDF_ELEM=pt=>{for(const e of PARTS)if(e.d.some(d=>d[0]===pt))return e.id;return null;};

// эскиз детали — из той же геометрии, что уходит в DXF
function dxfSketch(m){const k=Math.min(230/m.w,64/m.h),w=Math.max(8,m.w*k),h=Math.max(8,m.h*k),H=m.h;
  let g='';m.loops.forEach(l=>g+=`<polyline points="${l.map(([x,y])=>`${x},${H-y}`).join(' ')}"/>`);
  m.circles.forEach(([x,y,r])=>g+=`<circle cx="${x}" cy="${H-y}" r="${r}"/>`);
  m.bends.forEach(([a,b])=>g+=`<line class="bd" x1="${a[0]}" y1="${H-a[1]}" x2="${b[0]}" y2="${H-b[1]}"/>`);
  return `<svg class="dxfsk" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="-2 -2 ${m.w+4} ${m.h+4}" aria-hidden="true">${g}</svg>`;}
// таблица под раскроем
function drawDxf(){const tb=document.getElementById('dxfTbl');if(!tb)return;
  const ps=laserParts().filter(p=>inSel(PDF_ELEM(p.pt),p.pt));let tc=0,tp=0;
  let h='<thead><tr><th>Деталь</th><th>Эскиз</th><th class="r">Лист</th><th class="r">Кол-во</th><th>Габарит, мм</th><th class="r">Рез, м</th><th class="r">Врезок</th><th></th></tr></thead><tbody>';
  ps.forEach((p,i)=>{const m=partMM(p);tc+=m.cut*p.q;tp+=m.pierce*p.q;
    h+=`<tr><td>${p.name}${p.note?`<small>${p.note}</small>`:''}<small class="fn">${dxfName(p)}</small></td><td>${dxfSketch(m)}</td><td class="n r">${p.mm} мм</td><td class="n r">${p.q}</td><td class="n">${fmt(m.w,1)} × ${fmt(m.h,1)}</td><td class="n r">${fmt(m.cut/1000,2)}</td><td class="n r">${m.pierce}</td><td class="r"><button class="dxfbtn" data-i="${i}">DXF</button></td></tr>`;});
  h+=`<tr class="tot"><td colspan="5">Всего ${ps.length} деталей${S.sel.el?' (выбранное)':''}, с учётом количества</td><td class="n r">${fmt(tc/1000,2)}</td><td class="n r">${tp}</td><td></td></tr></tbody>`;
  tb.innerHTML=h;tb.querySelectorAll('.dxfbtn').forEach(b=>b.addEventListener('click',()=>savePart(ps[+b.dataset.i])));}
document.getElementById('dxfAll')&&document.getElementById('dxfAll').addEventListener('click',saveAll);
