// фигуры для тестов мастерской: всё из куба-заготовки blankBox(300,400,260) (мм, scale 1), строится в контексте движка
const {loadFigureEngine}=require('../lib/engine.js');
let ENG=null;
const engine=()=>ENG||(ENG=loadFigureEngine());
const run=s=>engine().run(s);
const g=n=>run(n);
const box=(W=300,H=400,D=260)=>run(`blankBox(${W},${H},${D})`);
// номер грани, у которой все точки удовлетворяют условию
const faceWhere=(E,fn)=>E.P.findIndex(Q=>Q.every(i=>fn(E.V[i])));
const TOP=p=>p[1]===400;
// точка на ребре a–b у всех граней с этим ребром; номер новой точки
function edgePoint(E,a,b,p){E.V.push(p);const m=E.V.length-1;run('insertOnEdge')(E,a,b,m);return m;}
const vi=(E,p)=>E.V.findIndex(q=>q[0]===p[0]&&q[1]===p[1]&&q[2]===p[2]);
module.exports={engine,run,g,box,faceWhere,TOP,edgePoint,vi};
