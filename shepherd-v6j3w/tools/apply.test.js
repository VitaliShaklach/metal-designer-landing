// «Нарезать» (#152): node --test shepherd-v6j3w/tools/apply.test.js — куб 200 мм по центру оси x = 0
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,Math,Buffer};vm.createContext(c);['mesh','edit','trace','tlines','markup','apply'].forEach(f=>vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),c));
const run=s=>vm.runInContext(s,c);
const cube=()=>({V:[[-100,0,0],[100,0,0],[100,200,0],[-100,200,0],[-100,0,200],[100,0,200],[100,200,200],[-100,200,200]],P:[[3,7,6,2],[0,1,5,4],[4,5,6,7],[0,3,2,1],[1,2,6,5],[0,4,7,3]],S:[]});
// замкнута (каждое ребро — у двух граней, навстречу), без самопересечений, плоская; симметрия — у каждой точки и грани есть зеркальная
const closed=E=>{const m=new Map();E.P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length];m.set(a+'_'+b,(m.get(a+'_'+b)||0)+1);}));for(const [k,n] of m){const [a,b]=k.split('_');if(n!==1||m.get(b+'_'+a)!==1)return false;}return true;};
const sym=E=>{c.TE=E;return run('(()=>{const mm=mirrorMap(TE.V);if(mm.some(x=>x===-1))return false;return TE.P.every((Q,i)=>mirrorPoly(TE,i,mm)>=0);})()');};
const good=E=>{c.TE=E;return closed(E)&&run('selfXPolys(TE).length===0&&nonPlanar(TE,.01).length===0');};
const dupV=E=>{const s=new Set();for(const p of E.V){const k=p.map(x=>Math.round(x*10)).join();if(s.has(k))return true;s.add(k);}return false;};
const ap=(mk,o)=>{c.E0=cube();c.MK=mk;c.O=o||{};return JSON.parse(JSON.stringify(run('applyMarkup(E0,MK,O)')));};
test('линия поперёк грани от ребра до ребра → граней 7, замкнута, без самопересечений',()=>{const r=ap([{k:'line',pts:[[50,200,0],[50,200,200]]}]);
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.fail.length,0);assert.strictEqual(r.E.P.length,7);assert.ok(good(r.E));assert.strictEqual(r.E.S.length,1,'шов по разрезу');});
test('клик чуть за ребром (выход ≤ 8 мм) — обрезается по ребру',()=>{const r=ap([{k:'line',pts:[[50,200,-5],[50,200,205]]}]);assert.strictEqual(r.E.P.length,7);assert.ok(good(r.E));
  assert.ok(r.E.V.some(p=>p[0]===50&&p[2]===0)&&r.E.V.some(p=>p[0]===50&&p[2]===200),'новые точки ровно на рёбрах');});
test('с симметрией линия на правой половине режется и на зеркальной',()=>{const r=ap([{k:'line',pts:[[100,0,100],[100,200,100]]}],{sym:true});
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.P.length,8);assert.ok(good(r.E));assert.ok(sym(r.E),'симметрична');});
test('Review Focus 1: линия поперёк оси x = 0 с симметрией — режется один раз, без двойных точек, симметрична',()=>{const r=ap([{k:'line',pts:[[-100,200,90],[100,200,110]]}],{sym:true});
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.P.length,7);assert.ok(!dupV(r.E),'нет двойных точек');assert.ok(good(r.E));assert.ok(sym(r.E),'симметрична (кривая линия выровнена по правой половине)');});
test('Review Focus 2: линия, оборванная внутри грани → «линия не доходит до края детали», фигура без изменений',()=>{const r=ap([{k:'line',pts:[[-100,200,100],[0,200,100]]}]);
  assert.deepStrictEqual(r.done,[]);assert.deepStrictEqual(r.fail,[{i:0,why:'линия не доходит до края детали'}]);assert.strictEqual(r.E.P.length,6);assert.strictEqual(r.E.V.length,8);});
test('точка ближе 8 мм к углу встаёт в угол (новой точки нет)',()=>{const r=ap([{k:'line',pts:[[95,200,4],[-50,200,200]]}]);assert.deepStrictEqual(r.done,[0]);
  assert.strictEqual(r.E.V.length,9,'новая точка только у второго конца');assert.ok(good(r.E));});
test('разрез, дающий полосу 10 мм → «выйдет деталь уже 15 мм», фигура без изменений',()=>{const r=ap([{k:'line',pts:[[90,200,0],[90,200,200]]}]);
  assert.deepStrictEqual(r.fail,[{i:0,why:'выйдет деталь уже 15 мм'}]);assert.strictEqual(r.E.P.length,6);});
test('ломаная по грани (3 точки) режет на два многоугольника, точка излома — новая внутри',()=>{const r=ap([{k:'line',pts:[[-100,200,50],[0,200,120],[100,200,50]]}]);
  assert.strictEqual(r.E.P.length,7);assert.ok(good(r.E));assert.strictEqual(r.E.V.length,11);});
test('зачёркивание шва после разреза → граней снова 6',()=>{const r=ap([{k:'line',pts:[[0.5,200,0],[0.5,200,200]]},{k:'cross',pts:[[-20,200,100],[20,200,100]]}]);
  // зачёркивание идёт первым: шва ещё нет — отказ; линия режет
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.fail[0].why,'зачёркивание не пересекает шов между деталями');
  c.E1=r.E;const r2=JSON.parse(JSON.stringify(run("applyMarkup(E1,[{k:'cross',pts:[[-20,200,100],[20,200,100]]}],{})")));assert.deepStrictEqual(r2.done,[0]);assert.strictEqual(r2.E.P.length,6);assert.ok(good(r2.E));});
// #154 отверстие из замкнутой линии (было «пока отказ» — по тикету #154 стало отверстием)
const circ=(cx,cz,r,n=96)=>Array.from({length:n},(_,k)=>[cx+r*Math.cos(k/n*2*Math.PI),200,cz+r*Math.sin(k/n*2*Math.PI)]);
const meas=E=>{c.TE=E;return JSON.parse(JSON.stringify(run('(()=>{const b=polyBase(TE.V,TE.P,TE.S,TE.H),R=buildParts({V:b.V,F:b.F,T:b.T,S:b.S,H:b.H},1.5,1.5);let area=0,cut=0,weld=0,open=0;R.parts.forEach(p=>{area+=p.area;cut+=p.perim+(p.holeLen||0);});R.edges.forEach(e=>{if(e.hole)return;if(e.open)open+=e.len;else weld+=e.len;});return {area,cut,weld,open,parts:R.parts.length,holes:R.parts.reduce((s,p)=>s+p.holes,0)};})()')));};
test('окружность Ø 30 в грани → отверстие: площадь меньше на π·15² (±1 %), рез больше на 2π·15 (±1 %), сварка и открытый край те же',()=>{const r=ap([{k:'pen',closed:true,pts:circ(40,100,15)},{k:'line',pts:[[-50,200,0],[-50,200,200]]}]);
  assert.deepStrictEqual(r.done,[0,1]);assert.strictEqual(r.E.H.length,1);const m0=meas(cube()),m1=meas(r.E),r0=ap([{k:'line',pts:[[-50,200,0],[-50,200,200]]}]),mL=meas(r0.E);
  const dA=mL.area-m1.area,dC=m1.cut-mL.cut;assert.ok(Math.abs(dA/(Math.PI*225)-1)<=.01,'площадь: '+dA.toFixed(1)+' вместо '+(Math.PI*225).toFixed(1));assert.ok(Math.abs(dC/(Math.PI*30)-1)<=.01,'рез: '+dC.toFixed(2)+' вместо '+(Math.PI*30).toFixed(2));
  assert.ok(Math.abs(m1.weld-mL.weld)<1e-6&&Math.abs(m1.open-mL.open)<1e-6,'сварка и открытый край не меняются');assert.strictEqual(m1.holes,1);assert.strictEqual(m1.parts,mL.parts);});
test('контур ближе 5 мм к краю детали → отказ с причиной, фигура та же',()=>{const r=ap([{k:'pen',closed:true,pts:circ(80,100,17)}]);assert.deepStrictEqual(r.fail,[{i:0,why:'отверстие ближе 5 мм к краю детали'}]);assert.strictEqual(r.E.H.length,0);assert.strictEqual(r.E.V.length,8);});
test('отверстие с симметрией — и зеркальное; фигура симметрична; на оси — отказ',()=>{const r=ap([{k:'pen',closed:true,pts:circ(40,100,15,48)}],{sym:true});assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.H.length,2);assert.ok(sym(r.E),'симметрична');
  const r2=ap([{k:'pen',closed:true,pts:circ(3,100,15,48)}],{sym:true});assert.match(r2.fail[0].why,/оси симметрии/);});
test('.json туда-обратно: отверстие на месте (H), площадь та же; после «Нарезать» по детали отверстие держится',()=>{const r=ap([{k:'pen',closed:true,pts:circ(40,100,15)}]);const j=JSON.parse(JSON.stringify({V:r.E.V,P:r.E.P,S:r.E.S,H:r.E.H}));
  assert.ok(Math.abs(meas(j).area-meas(r.E).area)<1e-6);c.E2=r.E;const r3=JSON.parse(JSON.stringify(run("applyMarkup(E2,[{k:'line',pts:[[-50,200,0],[-50,200,200]]}],{})")));assert.strictEqual(r3.E.H.length,1);assert.ok(Math.abs(meas(r3.E).area-meas(r.E).area)<1e-6,'отверстие не потерялось');});
test('второе отверстие внахлёст с первым — отказ',()=>{const r=ap([{k:'pen',closed:true,pts:circ(40,100,15)},{k:'pen',closed:true,pts:circ(50,100,15)}]);assert.deepStrictEqual(r.done,[0]);assert.match(r.fail[0].why,/другое отверстие/);});
test('линия через ребро на соседнюю грань дальше 8 мм — не режет молча, а отказ',()=>{const r=ap([{k:'line',pts:[[50,200,100],[50,200,200],[50,150,200]]}]);assert.strictEqual(r.done.length,0);assert.strictEqual(r.E.P.length,6);});
test('два конца на одном ребре (вырез «скобкой»)',()=>{const r=ap([{k:'line',pts:[[-60,200,0],[-60,200,60],[60,200,60],[60,200,0]]}]);assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.P.length,7);assert.ok(good(r.E));});
// #153: линия через несколько деталей
test('линия через две грани (верх и перед) от ребра до ребра → обе разрезаны, стык — одна точка на общем ребре',()=>{const r=ap([{k:'line',pts:[[50,200,0],[50,200,200],[50,0,200]]}]);
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.P.length,8);assert.ok(good(r.E));assert.ok(!dupV(r.E),'нет двойных точек');assert.strictEqual(r.E.V.length,11,'3 новые точки: два конца и стык');});
test('через две грани с симметрией: правый бок и верх → и зеркальные; симметрична',()=>{const r=ap([{k:'line',pts:[[100,0,100],[100,200,100],[60,200,0]]}],{sym:true});
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.P.length,10);assert.ok(good(r.E));assert.ok(sym(r.E),'симметрична');assert.ok(!dupV(r.E));});
test('через две грани, вторая часть оборвана → вся линия не применяется, фигура та же',()=>{const r=ap([{k:'line',pts:[[50,200,0],[50,200,200],[50,100,200]]}]);
  assert.deepStrictEqual(r.done,[]);assert.strictEqual(r.fail[0].why,'линия не доходит до края детали');assert.strictEqual(r.E.P.length,6);assert.strictEqual(r.E.V.length,8);});
test('несколько линий: удачные применяются, отказ — у своей линии',()=>{const r=ap([{k:'line',pts:[[50,200,0],[50,200,200],[50,0,200]]},{k:'line',pts:[[-50,200,100],[-50,200,150]]},{k:'line',pts:[[-100,100,0],[-100,100,200]]}]);
  assert.deepStrictEqual(r.done,[0,2]);assert.deepStrictEqual(r.fail.map(f=>f.i),[1]);assert.strictEqual(r.E.P.length,9);assert.ok(good(r.E));});
test('линия через три грани (бок, верх, бок) поперёк оси с симметрией — один раз, симметрична',()=>{const r=ap([{k:'line',pts:[[100,0,100],[100,200,100],[-100,200,100],[-100,0,100]]}],{sym:true});
  assert.deepStrictEqual(r.done,[0]);assert.strictEqual(r.E.P.length,9);assert.ok(good(r.E));assert.ok(sym(r.E));assert.ok(!dupV(r.E));});
