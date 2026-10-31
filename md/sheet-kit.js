/* ---------- Помощники листов А3/А4: рамка, штамп, размерные линии, таблица ----------
   Копия из C:\dev\metal-designer\art\js\sheets.js (строки 4–37, 233, 239). Правки: без глобалов фигуры (ST, CUR) —
   название, масса и металл приходят в b (b.name, b.mass, b.metal); ячейка email — «Разработка: Metal Designer для цеха»;
   VIEWS — в views.js (виды рисует 3D-модель, проекция prjV не нужна); в SH_STYLE — только классы, которые есть
   на листах мангала, и .tg — жирная строка; wrapTxt — перенос строк по словам оттуда же. Координаты — мм бумаги. */
const SCALES=[1,2,2.5,4,5,10,15,20,25,40,50,75,100];
const r2=x=>Math.round(x*100)/100;
const shEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const pickScale=(need,avail)=>SCALES.find(n=>need.every((v,i)=>v/n<=avail[i]))||SCALES[SCALES.length-1];
const scaleTxt=n=>'1:'+String(n).replace('.',',');
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
// стили листа — только внутри svg.shs: иначе .l, .t и др. действуют на всю страницу (эскизы в панели и таблице)
const SH_STYLE='<style>'+`.l{fill:none;stroke:#000;stroke-width:.35;stroke-linejoin:round}.t{fill:none;stroke:#000;stroke-width:.18}.dash{fill:none;stroke:#000;stroke-width:.15;stroke-dasharray:1.2 .8}.fr{fill:none;stroke:#000;stroke-width:.7}.ar{fill:#000}text{font-family:"Arial Narrow",Arial,sans-serif;font-style:italic;fill:#000;font-size:3.5px}.hd{font-size:6px}.h2{font-size:4.5px}.sm,.lb{font-size:2.3px}.trq{font-size:4px}.trh{font-size:5.4px}.td{font-size:2.8px}.tg{font-weight:bold;font-style:normal}`.replace(/([^{}]+)\{/g,(m,sel)=>sel.split(',').map(x=>'svg.shs '+x.trim()).join(',')+'{')+'</style>';
// основная надпись 185 × 16, x, y — левый верхний угол; b.name, b.scale, b.mass, b.metal — изделие, масштаб, масса, металл
function stamp(x,y,b,o){const c=[95,30,30,30],cell=(i,row,lab,val)=>{const xx=x+c.slice(0,i).reduce((s,v)=>s+v,0),yy=y+row*8;return `<text class="lb" x="${xx+1}" y="${yy+2.6}">${lab}</text><text class="td" x="${xx+1.2}" y="${yy+6.6}">${shEsc(val)}</text>`;};
  let xs=x,v='';c.slice(0,-1).forEach(w=>{xs+=w;v+=`M${xs},${y}V${y+16}`;});
  return `<rect class="fr" x="${x}" y="${y}" width="185" height="16"/><path class="t" d="M${x},${y+8}H${x+185}${v}"/>`+cell(0,0,'Изделие',b.name)+cell(1,0,'Масштаб',b.scale||'—')+cell(2,0,'Масса',`≈ ${b.mass}`)+cell(3,0,'Металл',b.metal)
    +cell(0,1,'Разработка','Metal Designer для цеха')+cell(1,1,'Дата',o.date)+cell(2,1,'Лист',String(o.n))+cell(3,1,'Листов',String(o.N));}
function wrapSheet(b,o){const tb=stamp(230,276,b,o);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="shs" viewBox="0 0 420 297" width="420mm" height="297mm">${SH_STYLE}<rect width="420" height="297" fill="#fff"/><rect class="fr" x="20" y="5" width="395" height="287"/><path class="l" d="M20,17H415"/>`
    +`<text class="hd" x="25" y="13.5">${shEsc(b.name)}</text><text class="h2" x="410" y="13.5" text-anchor="end">${shEsc(b.title)}</text>${b.body}${tb}<text class="sm" x="415" y="295.6" text-anchor="end">Формат А3</text></svg>`;}
function wrapA4(b,o){return `<svg xmlns="http://www.w3.org/2000/svg" class="shs" viewBox="0 0 210 297" width="210mm" height="297mm">${SH_STYLE}<rect width="210" height="297" fill="#fff"/><rect class="fr" x="20" y="5" width="185" height="287"/><path class="l" d="M20,17H205"/>`
  +`<text class="hd" x="24" y="13.5">${shEsc(b.head)}</text><text class="h2" x="201" y="13.5" text-anchor="end">${shEsc(b.title)}</text>${b.body}${stamp(20,276,b,o)}<text class="sm" x="205" y="295.6" text-anchor="end">Формат А4</text></svg>`;}
const shDate=()=>{const d=new Date();return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;};
// перенос строки по словам: не длиннее n знаков
const wrapTxt=(t,n)=>{const out=[];let l='';t.split(' ').forEach(w=>{if((l+' '+w).trim().length>n&&l){out.push(l);l=w;}else l=(l+' '+w).trim();});if(l)out.push(l);return out;};
