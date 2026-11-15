/* модели из плит-многоугольников (сгенерировано art/tools/plates/export.js и fromjson.js): V — мм×k (k в модели, по умолчанию 10; у фигур мастерской 100), P — углы граней, -1 — конец грани, S — швы, проведённые руками (пары точек) */
const MODELS_POLY={};
function modelPoly(id){const m=MODELS_POLY[id],k=m.k||10,V=[],P=[],S=[];let Q=[];for(let i=0;i<m.V.length;i+=3)V.push([m.V[i]/k,m.V[i+1]/k,m.V[i+2]/k]);m.P.forEach(x=>{if(x<0){P.push(Q);Q=[];}else Q.push(x);});
  if(m.S)for(let i=0;i<m.S.length;i+=2)S.push([m.S[i],m.S[i+1]]);return polyBase(V,P,S);}
