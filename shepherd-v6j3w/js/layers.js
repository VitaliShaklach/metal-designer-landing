/* ---------- Слои мастерской (#145): что показывать при «Править фигуру» ---------- */
// edges — наши швы; verts — синие точки углов; trace — калька; diff — подсказки сверки (жёлтое/красное, только при кальке)
const LAYER_DEF={edges:true,verts:false,trace:false,diff:false};
// сохранённое → слои; пусто, битое, не объект → по умолчанию; значение не true/false → по умолчанию для этого слоя
function layersLoad(raw){const L={...LAYER_DEF};let o=null;try{o=JSON.parse(raw);}catch(e){}
  if(o&&typeof o==='object'&&!Array.isArray(o))Object.keys(LAYER_DEF).forEach(k=>{if(typeof o[k]==='boolean')L[k]=o[k];});return L;}
function layersSave(L){const o={};Object.keys(LAYER_DEF).forEach(k=>{o[k]=typeof L[k]==='boolean'?L[k]:LAYER_DEF[k];});return JSON.stringify(o);}
