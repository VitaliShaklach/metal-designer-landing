/* ---------- картинки: плоские SVG (без 3D, решение спеки) ----------
   Координаты деталей — мм, Y вверх; в SVG Y вниз, поэтому y → (верх − y). */
const f1=v=>(Math.round(v*10)/10).toString();
const svgPts=(P,X,Y)=>P.map(p=>f1(X(p[0]))+','+f1(Y(p[1]))).join(' ');
const escH=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// деталь отдельно, с габаритом: картинка во вкладке «Заказ»
function partSVG(p,o={}){const xs=p.pts.map(q=>q[0]),ys=p.pts.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),m=o.m??30;
  const X=x=>x-x0+m,Y=y=>y1-y+m,w=x1-x0+2*m,h=y1-y0+2*m;
  return `<svg class="part" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(w)} ${f1(h)}" role="img" aria-label="${escH(o.title||p.name)}">`
    +`<polygon points="${svgPts(p.pts,X,Y)}" class="metal"/>`+p.holes.map(q=>`<circle cx="${f1(X(q[0]))}" cy="${f1(Y(q[1]))}" r="${f1(q[2]/2)}" class="hole"/>`).join('')
    +(p.engr||[]).map(z=>`<line x1="${f1(X(z[0]))}" y1="${f1(Y(z[1]))}" x2="${f1(X(z[2]))}" y2="${f1(Y(z[3]))}" class="engr"/>`).join('')
    +(o.dims?`<text x="${f1(X((x0+x1)/2))}" y="${f1(Y(y0)+18)}" class="dim" text-anchor="middle">${f1(x1-x0)}</text><text x="${f1(X(x1)+6)}" y="${f1(Y((y0+y1)/2))}" class="dim">${f1(y1-y0)}</text>`:'')
    +`</svg>`;}
// лист раскладки: контур листа, детали с отверстиями и гравировкой, подписи деталей (только на странице, в DXF их нет)
function sheetSVG(s,W,H){const X=x=>x,Y=y=>H-y,fs=Math.max(18,Math.min(40,H/40));
  return `<svg class="nestsvg" xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${W+20} ${H+20}" role="img" aria-label="Лист ${W} × ${H}">`
    +`<rect x="0" y="0" width="${W}" height="${H}" class="sheetbox"/>`
    +s.items.map(it=>`<polygon points="${svgPts(it.pts,X,Y)}" class="metal"/>`
      +it.holes.map(q=>`<circle cx="${f1(q[0])}" cy="${f1(Y(q[1]))}" r="${f1(q[2]/2)}" class="hole"/>`).join('')
      +(it.engr.length?`<path class="engr" d="${it.engr.map(z=>`M${f1(z[0])} ${f1(Y(z[1]))}L${f1(z[2])} ${f1(Y(z[3]))}`).join('')}"/>`:'')
      +`<text x="${f1(it.lab[0])}" y="${f1(Y(it.lab[1]))}" class="lab" font-size="${f1(fs)}" text-anchor="middle" dominant-baseline="middle">${escH(it.name)}</text>`).join('')
    +`</svg>`;}

/* ---------- картинка сборки: пластина у стены, ручка прижата (как draw_assembly в plate.py) ----------
   Ручка — всегда длины 60 (картинки длину не показывают, решение грилинга 5); участок с лезвием на ASM_OPEN° ниже горизонта.
   Подписи: имя профиля (A3), угол, где стена и низ пластины; красная линия — кромка под заточку, тёмная полоса — труба рукояти */
const ASM_OPEN=40,TUBE_D=28;
const rotPt=(p,ang,ox,oy)=>{const c=Math.cos(deg(ang)),s=Math.sin(deg(ang));return [ox+p[0]*c-p[1]*s,oy+p[0]*s+p[1]*c];};
function asmSVG(type,prof){const pl=platePart(),h=handlePart(type,prof,60),ang=180+ASM_OPEN,[px,py]=PLATE_PIVOT,R=p=>rotPt(p,ang,px,py);
  const hp=h.pts.map(R),xs=[...hp,...pl.pts].map(q=>q[0]),ys=[...hp,...pl.pts].map(q=>q[1]);
  const x0=Math.min(...xs)-30,x1=PLATE.W+60,y0=Math.min(...ys,0)-40,y1=PLATE.H+40,X=x=>x-x0,Y=y=>y1-y,w=x1-x0,hh=y1-y0;
  const line=(a,b,cls,extra='')=>`<line x1="${f1(X(a[0]))}" y1="${f1(Y(a[1]))}" x2="${f1(X(b[0]))}" y2="${f1(Y(b[1]))}" class="${cls}"${extra}/>`;
  const tube=[h.axis[1],h.axis[2]].map(R),knee=R(h.axis[1]),blade=h.bladeEdge.map(R);
  // тюбик рукояти — от плеча (переход позади) до конца хвостовика
  const d=[tube[1][0]-tube[0][0],tube[1][1]-tube[0][1]],L=Math.hypot(...d),stub=HANDLE_PROFILES[prof].stub,t0=[tube[0][0]+d[0]/L*stub,tube[0][1]+d[1]/L*stub];
  const name=`${type}${prof}`,label=`${name} · угол ${HANDLE_PROFILES[prof].angle}°`;
  return `<svg class="asm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(w)} ${f1(hh)}" role="img" aria-label="Сборка с ручкой ${name}" data-name="${name}">`
    +line([PLATE.W+3,y0],[PLATE.W+3,y1],'wall')+`<text x="${f1(X(PLATE.W)+10)}" y="${f1(Y(PLATE.H)+4)}" class="wtxt">стена</text>`
    +line([x0,0],[PLATE.W,0],'floor')+`<text x="6" y="${f1(Y(0)-6)}" class="ftxt">низ пластины</text>`
    +`<polygon points="${svgPts(pl.pts,X,Y)}" class="metal"/>`+pl.holes.map(q=>`<circle cx="${f1(X(q[0]))}" cy="${f1(Y(q[1]))}" r="${f1(q[2]/2)}" class="hole"/>`).join('')
    +`<polygon points="${svgPts(hp,X,Y)}" class="metal hdl"/>`+h.holes.map(q=>{const c=R(q);return `<circle cx="${f1(X(c[0]))}" cy="${f1(Y(c[1]))}" r="${f1(q[2]/2)}" class="hole"/>`;}).join('')
    +line(t0,tube[1],'tube',` stroke-width="${TUBE_D}"`)+line(blade[0],blade[1],'blade')
    +`<text x="${f1(X(knee[0]))}" y="${f1(Y(knee[1])-26)}" class="atxt" text-anchor="middle">${f1(HANDLE_PROFILES[prof].angle)}°</text>`
    +`<text x="12" y="28" class="ttl">${escH(label)}</text>`
    +`</svg>`;}
// миниатюра профиля: плоская ручка 60, кромка под заточку — красная
function thumbSVG(type,prof){const h=handlePart(type,prof,60),xs=h.pts.map(q=>q[0]),ys=h.pts.map(q=>q[1]),x0=Math.min(...xs)-6,x1=Math.max(...xs)+6,y0=Math.min(...ys)-6,y1=Math.max(...ys)+6;
  const X=x=>x-x0,Y=y=>y1-y,b=h.bladeEdge;
  return `<svg class="thumb" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(x1-x0)} ${f1(y1-y0)}" aria-hidden="true">`
    +`<polygon points="${svgPts(h.pts,X,Y)}" class="metal"/><line x1="${f1(X(b[0][0]))}" y1="${f1(Y(b[0][1]))}" x2="${f1(X(b[1][0]))}" y2="${f1(Y(b[1][1]))}" class="blade"/></svg>`;}
