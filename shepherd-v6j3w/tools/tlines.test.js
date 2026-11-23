// калька линиями (#147): node --test shepherd-v6j3w/tools/tlines.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,Math,Buffer};vm.createContext(c);['mesh','tlines'].forEach(f=>vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),c));
const run=s=>vm.runInContext(s,c);
// формат TRACE_L: uint32 число ломаных, на каждую uint32 n и n×3 int16 (мм×10)
const enc=L=>{const b=Buffer.alloc(L.reduce((a,l)=>a+4+l.length*6,4));let o=b.writeUInt32LE(L.length,0);L.forEach(l=>{o=b.writeUInt32LE(l.length,o);l.forEach(p=>p.forEach(x=>{o=b.writeInt16LE(Math.round(x*10),o);}));});return b.toString('base64');};
// куб 100 мм, грани наружу
c.CV=[[0,0,0],[100,0,0],[100,100,0],[0,100,0],[0,0,100],[100,0,100],[100,100,100],[0,100,100]];c.CP=[[3,7,6,2],[0,1,5,4],[4,5,6,7],[0,3,2,1],[1,2,6,5],[0,4,7,3]];
run('ID=p=>p.slice();ID.inv=p=>p.slice();');
test('tlinesLoad: две ломаные, точки ±0,1 мм',()=>{c.B=enc([[[1.23,-4.5,300],[10,20,30.05]],[[0,0,0],[5,5,5],[-7.7,8.8,-9.9]]]);const L=run('tlinesLoad(B)');
  assert.strictEqual(L.n,2);assert.deepStrictEqual([...L.S],[0,2,5]);const want=[1.23,-4.5,300,10,20,30.05,0,0,0,5,5,5,-7.7,8.8,-9.9];want.forEach((x,i)=>assert.ok(Math.abs(L.P[i]-x)<=.1,i+': '+L.P[i]+' ≠ '+x));});
test('tlinesOnFigure: линия в 1 мм над гранью куба → лежит на 0,6 мм над гранью, нарисовано всё',()=>{c.B=enc([[[20,101,50],[80,101,50]]]);const S=run('S=tlinesOnFigure(tlinesLoad(B),ID,CV,CP)');
  assert.ok(S.length>=6&&S.length%6===0,'отрезки есть: '+S.length);for(let i=0;i<S.length;i+=3){assert.ok(Math.abs(S[i+1]-100.6)<1e-4,'y='+S[i+1]);assert.ok(S[i]>=20-1e-4&&S[i]<=80+1e-4&&Math.abs(S[i+2]-50)<1e-4);}
  assert.strictEqual(run('S.drawn'),1);assert.ok(run('S.pts')>=30,'шаг ≤ 2 мм: точек '+run('S.pts'));});
test('tlinesOnFigure: линия через ребро куба — точки на обеих гранях, подняты по своей нормали',()=>{c.B=enc([[[50,101,80],[50,80,101]]]);const S=run('tlinesOnFigure(tlinesLoad(B),ID,CV,CP)');
  for(let i=0;i<S.length;i+=3){const onTop=Math.abs(S[i+1]-100.6)<1e-4&&S[i+2]<=100+1e-4,onFront=Math.abs(S[i+2]-100.6)<1e-4&&S[i+1]<=100+1e-4;assert.ok(onTop||onFront,S[i+1]+','+S[i+2]);}});
test('tlinesOnFigure: линия в 30 мм от куба пропущена (не висит в воздухе)',()=>{c.B=enc([[[20,130,50],[80,130,50]]]);const S=run('S=tlinesOnFigure(tlinesLoad(B),ID,CV,CP)');assert.strictEqual(S.length,0);assert.strictEqual(run('S.drawn'),0);});
test('tlinesOnFigure: половина линии над гранью, половина далеко → drawn ≈ 0,5',()=>{c.B=enc([[[50,101,50],[50,101,99]],[[50,140,50],[50,140,99]]]);const d=run('tlinesOnFigure(tlinesLoad(B),ID,CV,CP).drawn');assert.ok(d>.4&&d<.6,'drawn '+d);});
test('tlinesNear: ближайшая точка линии в радиусе, дальше r → null',()=>{c.B=enc([[[0,101,50],[100,101,50]]]);run('L1=tlinesLoad(B)');
  const p=run('tlinesNear(L1,ID,[30,100,52])');assert.ok(p&&Math.abs(p[0]-30)<1e-4&&Math.abs(p[1]-101)<1e-4&&Math.abs(p[2]-50)<1e-4,JSON.stringify(p));
  assert.strictEqual(run('tlinesNear(L1,ID,[30,100,58])'),null);assert.ok(run('tlinesNear(L1,ID,[30,100,58],10)'),'r=10 находит');});
test('tlinesNear: с растяжением кадра (map) — точка возвращается в кадр фигуры',()=>{c.B=enc([[[0,202,50],[200,202,50]]]);run('M2=p=>[p[0]*2,p[1]*2,p[2]];M2.inv=p=>[p[0]/2,p[1]/2,p[2]];L2=tlinesLoad(B)');
  const p=run('tlinesNear(L2,M2,[30,100.5,51])');assert.ok(p&&Math.abs(p[0]-30)<1e-4&&Math.abs(p[1]-101)<1e-4&&Math.abs(p[2]-50)<1e-4,JSON.stringify(p));});
