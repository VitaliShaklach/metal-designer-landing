/* ---------- DXF (R12, ASCII): копия dxfDoc, dxfPoly, dxfSegs, DXF_COL из horse-r4t9p/js/prod.js + свой dxfCircle ----------
   Слои: SHEET — контур листа, CUT — контуры деталей (POLYLINE) и отверстия (CIRCLE), ENGRAVE — гравировка линиями (LINE).
   Подписей деталей и покупного в DXF нет (решения грилинга 2 и 3). */
// слои объявлены в таблице LAYER (с цветом, линия сплошная): без таблицы CAD создаёт их сам, но программа станка может не показать список слоев
const DXF_LAY={CUT:7,SHEET:8};
const DXF_COL={ENGRAVE:1};   // красный
function dxfDoc(ents){const L=['0'];for(let i=0;i<ents.length;i+=2)if(ents[i]==='8'&&!L.includes(ents[i+1]))L.push(ents[i+1]);
  const tab=['0','SECTION','2','TABLES','0','TABLE','2','LTYPE','70',1,'0','LTYPE','2','CONTINUOUS','70',0,'3','Solid line','72',65,'73',0,'40',0,'0','ENDTAB',
    '0','TABLE','2','LAYER','70',L.length,...L.flatMap(n=>['0','LAYER','2',n,'70',0,'62',DXF_COL[n]||DXF_LAY[n]||7,'6','CONTINUOUS']),'0','ENDTAB','0','ENDSEC'];
  return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70',4,'0','ENDSEC',...tab,'0','SECTION','2','ENTITIES',...ents,'0','ENDSEC','0','EOF'].join('\r\n')+'\r\n';}
const dn=v=>Math.round(v*100)/100;
// контур — одна замкнутая полилиния (R12 POLYLINE, флаг 70 = 1): цеха просят контур целиком, а не россыпь отрезков
function dxfPoly(e,P,lay,ox=0,oy=0){e.push('0','POLYLINE','8',lay,...(DXF_COL[lay]?['62',DXF_COL[lay]]:[]),'66',1,'10',0,'20',0,'30',0,'70',1);P.forEach(a=>{e.push('0','VERTEX','8',lay,'10',dn(a[0]+ox),'20',dn(a[1]+oy),'30',0);});e.push('0','SEQEND','8',lay);}
function dxfSegs(e,S,lay,ox=0,oy=0){S.forEach(s=>e.push('0','LINE','8',lay,'62',DXF_COL[lay]||7,'10',dn(s[0]+ox),'20',dn(s[1]+oy),'30',0,'11',dn(s[2]+ox),'21',dn(s[3]+oy),'31',0));}
// отверстие — окружность (центр, диаметр d)
function dxfCircle(e,x,y,d,lay,ox=0,oy=0){e.push('0','CIRCLE','8',lay,'10',dn(x+ox),'20',dn(y+oy),'30',0,'40',dn(d/2));}
