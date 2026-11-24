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
