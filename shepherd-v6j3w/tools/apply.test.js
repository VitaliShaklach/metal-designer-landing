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
test('замкнутая линия — пока отказ с причиной; остальное применяется',()=>{const r=ap([{k:'pen',closed:true,pts:[[0,200,80],[20,200,100],[0,200,120],[-20,200,100]]},{k:'line',pts:[[50,200,0],[50,200,200]]}]);
  assert.deepStrictEqual(r.done,[1]);assert.strictEqual(r.fail[0].i,0);assert.match(r.fail[0].why,/отверстие/);assert.strictEqual(r.E.P.length,7);});
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
