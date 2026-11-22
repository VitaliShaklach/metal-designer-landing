// проверка правил чистки: node horse-r4t9p/tools/check.test.js — на чистом коробе списки пусты, каждая порча ловится своим правилом
const fs=require('fs'),vm=require('vm'),P=__dirname+'/../js/';const c={console,Math};vm.createContext(c);
vm.runInContext(['mesh','edit'].map(f=>fs.readFileSync(P+f+'.js','utf8')).join('\n;\n'),c);
const run=s=>vm.runInContext(s,c),{checkFigure,broken}=require('./check.js')(run);let bad=0;
const ok=(b,t)=>{console.log((b?'ok  ':'FAIL')+' '+t);if(!b)bad++;};
const blankBox=run('blankBox'),addEdgePoint=run('addEdgePoint');
const copy=E=>({V:E.V.map(p=>p.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())});
const box=()=>{const b=blankBox(300,400,260);return {V:b.V,P:b.P,S:[]};};
// чистый короб
const R0=checkFigure(box(),{sym:true,ref:box()});
ok(broken(R0).length===0&&R0.extra.length===0&&R0.parts===6,'чистый короб 300×400×260: все правила выполнены, деталей 6'+(broken(R0).length?' — нарушено '+broken(R0):''));
// 1. точка на 0,5 мм из плоскости
{const E=box();E.V[6][2]+=.5;const R=checkFigure(E);ok(R.planar.length===1&&R.planar[0]===1,'1. угол короба на 0,5 мм вперёд (по Z) → planar: передняя грань ['+R.planar+']');}
// 2. ребро 3 мм: точка на ребре в 3 мм от угла
{let E=box();E=addEdgePoint(E,2,6,[150,400,3],false).E;const R=checkFigure(E);ok(R.short.length>0,'2. ребро 3 мм → short '+JSON.stringify(R.short));}
// 3. ступенька: две точки в 5 мм от угла по двум рёбрам, между ними 7,1 мм и нет ребра
{let E=box();E=addEdgePoint(E,6,2,[150,400,255],false).E;E=addEdgePoint(E,6,7,[145,400,260],false).E;const R=checkFigure(E);ok(R.step.length>0&&R.short.length===0,'3. две точки ближе 8 мм без ребра → step '+JSON.stringify(R.step));}
// 4. игла: треугольник с углом 3°
{const t=Math.tan(3*Math.PI/180)*100,R=checkFigure({V:[[0,0,0],[100,0,0],[100,t,0]],P:[[0,1,2]]});ok(R.needle.length===1,'4. угол 3° → needle');}
{const t=Math.tan(6*Math.PI/180)*100,R=checkFigure({V:[[0,0,0],[100,0,0],[100,t,0]],P:[[0,1,2]]});ok(R.needle.length===0,'4. угол 6° — не игла');}
// 6. узкая деталь: короб толщиной 10 мм
{const b=blankBox(300,400,10),R=checkFigure({V:b.V,P:b.P});ok(R.narrow.length===4,'6. короб глубиной 10 мм → 4 узкие грани ['+R.narrow+']');}
// 9. самопересечение: «бабочка»
{const R=checkFigure({V:[[0,0,0],[100,100,0],[100,0,0],[0,60,0]],P:[[0,1,2,3]]});ok(R.selfX.length===1,'9. грань-«бабочка» → selfX');}
// 9. протыкание: две грани крест-накрест без общих точек
{const R=checkFigure({V:[[0,0,0],[100,0,0],[50,100,0],[50,50,-50],[50,50,50],[50,-50,0]],P:[[0,1,2],[3,4,5]]});ok(R.pierce.length===2,'9. грань протыкает другую → pierce ['+R.pierce+']');}
// 10. симметрия: точка сдвинута по X на 1 мм
{const E=box();E.V[5][0]+=1;const R=checkFigure(E,{sym:true});ok(R.sym.length>0,'10. точка сдвинута по X на 1 мм → sym ['+R.sym+']');}
// 13. грань развёрнута; вся фигура наизнанку
{const E=box();E.P[1].reverse();const R=checkFigure(E);ok(R.flipped.length===1&&R.flipped[0]===1,'13. грань развёрнута → flipped ['+R.flipped+']');}
{const E=box();E.P.forEach(Q=>Q.reverse());const R=checkFigure(E);ok(R.flipped.length===6,'13. вся фигура наизнанку → flipped все 6');}
// 14. вырожденная: три точки на прямой; повтор точки
{const R=checkFigure({V:[[0,0,0],[50,0,0],[100,0,0]],P:[[0,1,2]]});ok(R.degenerate.length===1,'14. грань нулевой площади → degenerate');}
// открытое ребро: короб без грани
{const E=box();E.P.pop();const R=checkFigure(E);ok(R.open.length===4,'короб без грани → open: 4 ребра');}
// 11. похожесть: эталон сдвинут на 3 мм, и на 1 мм — в допуске
{const E=box(),F=box();F.V.forEach(p=>p[1]+=3);const R=checkFigure(E,{ref:F});ok(R.far.length>0,'11. эталон в 3 мм → far ['+R.far+']');
 const G=box();G.V.forEach(p=>p[1]+=1);ok(checkFigure(E,{ref:G}).far.length===0,'11. эталон в 1 мм — в допуске');}
// 7. лишний шов: две половины квадрата с изломом 3° — список; с изломом 0,5° — одна деталь, шва нет
{const fold=a=>{const r=a*Math.PI/180,x=100*Math.cos(r),z=100*Math.sin(r);return checkFigure({V:[[-100,0,0],[0,0,0],[0,100,0],[-100,100,0],[x,0,z],[x,100,z]],P:[[0,1,2,3],[1,4,5,2]]});};
 const A=fold(3),B=fold(.5);ok(A.extra.length===1&&Math.abs(A.extra[0].dih-3)<.01&&A.parts===2,'7. излом 3° → extra (лишний шов, только список)');ok(B.extra.length===0&&B.parts===1,'7. излом 0,5° — одна деталь, лишнего шва нет');}
console.log(bad?'ОШИБОК: '+bad:'всё ок');process.exit(bad?1:0);
