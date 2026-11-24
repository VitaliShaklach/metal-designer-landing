/* ---------- заказ: что режем, на чём и с каким зазором ----------
   Заказ задаётся в панели «Заказ», в браузере не запоминается (решение грилинга 4). Металл один на весь заказ, геометрию не меняет (решение 1). */
const METALS=[3,4,5,6];
// листы — как у коня: длинная сторона по X раскладки
const SHEETS={'1000x2000':[1000,2000],'1250x2500':[1250,2500],'1500x3000':[1500,3000],'1500x6000':[1500,6000]};
// зазор и отступ — как у коня (лазер: 5 мм между деталями, 10 мм от края листа)
const ORDER_DEFAULT={t:5,sheet:'1250x2500',sw:1250,sl:2500,gap:5,margin:10,plates:4,ears:0,
  handles:[{type:'A',prof:1,len:60,n:1},{type:'B',prof:1,len:60,n:1}]};   // как на двух картинках сборки (решение грилинга 4)
const cnt=v=>{const n=Math.floor(+v);return Number.isFinite(n)&&n>0?n:0;};   // количество: целое ≥ 0, пустое и отрицательное — 0
const num=(v,prev,min)=>{if(v===''||v==null)return prev;const n=+v;return Number.isFinite(n)&&n>=min?n:prev;};   // размер: пустое или ниже min — прошлое значение
// привести заказ к правильному виду; prev — прошлый заказ (откуда брать значения на место пустых)
function normOrder(o,prev=ORDER_DEFAULT){const t=METALS.includes(+o.t)?+o.t:prev.t,sheet=o.sheet==='own'||SHEETS[o.sheet]?o.sheet:prev.sheet;
  const sw=num(o.sw,prev.sw,100),sl=num(o.sl,prev.sl,100),gap=num(o.gap,prev.gap,1),margin=num(o.margin,prev.margin,0);
  return {t,sheet,sw,sl,gap,margin,plates:cnt(o.plates),ears:cnt(o.ears),handles:normHandles(o.handles||[])};}
// строки ручек: одинаковые варианты складываются, порядок — как в панели
function normHandles(L){const out=[];L.forEach(h=>{if(!(h.type==='A'||h.type==='B')||!HANDLE_PROFILES[+h.prof]||!HANDLE_LENS.includes(+h.len))return;const n=cnt(h.n),q=out.find(x=>x.type===h.type&&x.prof===+h.prof&&x.len===+h.len);
  if(q)q.n+=n;else out.push({type:h.type,prof:+h.prof,len:+h.len,n});});return out;}
// размеры листа [длинная, короткая], мм
function sheetWH(o){const s=o.sheet==='own'?[o.sw,o.sl]:SHEETS[o.sheet]||SHEETS['1250x2500'];return [Math.max(...s),Math.min(...s)];}
// ключ задания для «Рассчитать»: всё, от чего раскладка и DXF были бы другими. Выбор миниатюры и вкладка в него не входят
function orderKey(o){const [W,H]=sheetWH(o);return JSON.stringify([o.t,W,H,o.gap,o.margin,o.plates,o.ears,o.handles.filter(h=>h.n>0).map(h=>[h.type,h.prof,h.len,h.n])]);}
// детали заказа: [{part, n, flip}] — flip: можно ли раскладке класть деталь зеркально
// ручки — только поворот: зеркальная A стала бы B (лезвие не у той кромки)
function orderParts(o){const out=[];if(o.plates>0)out.push({part:platePart(),n:o.plates,flip:true});
  o.handles.forEach(h=>{if(h.n>0)out.push({part:handlePart(h.type,h.prof,h.len),n:h.n,flip:false});});return out;}
