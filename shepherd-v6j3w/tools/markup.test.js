// разметка (#150): node --test shepherd-v6j3w/tools/markup.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,Math,Buffer};vm.createContext(c);['mesh','tlines','markup'].forEach(f=>vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),c));
const run=s=>vm.runInContext(s,c),J=x=>JSON.parse(JSON.stringify(x));
c.CV=[[0,0,0],[100,0,0],[100,100,0],[0,100,0],[0,0,100],[100,0,100],[100,100,100],[0,100,100]];c.CP=[[3,7,6,2],[0,1,5,4],[4,5,6,7],[0,3,2,1],[1,2,6,5],[0,4,7,3]];
test('mkKey — по id фигуры',()=>{assert.strictEqual(run("mkKey('shepherd5')"),'shepherd-mk-shepherd5');assert.notStrictEqual(run("mkKey('shepherd5')"),run("mkKey('shepherd3')"));});
test('mkMirror переворачивает x, остальное как было',()=>assert.deepStrictEqual(J(run("mkMirror({k:'line',pts:[[10,5,3],[40,6,7]]})")),{k:'line',pts:[[-10,5,3],[-40,6,7]]}));
test('mkMirror: штрих на оси симметрии (|x| ≤ 1 мм) не зеркалится — не двоится',()=>{assert.strictEqual(run("mkMirror({k:'line',pts:[[0,5,3],[0.6,50,7],[-0.8,90,9]]})"),null);
  assert.ok(run("mkMirror({k:'line',pts:[[0,5,3],[30,50,7]]})"),'штрих, уходящий с оси, зеркалится');});
test('mkMirror сохраняет вид и замкнутость',()=>assert.deepStrictEqual(J(run("mkMirror({k:'pen',pts:[[10,0,0],[20,0,0],[10,1,0]],closed:true})")),{k:'pen',pts:[[-10,0,0],[-20,0,0],[-10,1,0]],closed:true}));
test('mkClosed: окружность — да, дуга 270° — нет, короткая черта — нет',()=>{c.circ=n=>Array.from({length:n+1},(_,i)=>[30*Math.cos(i/n*2*Math.PI),30*Math.sin(i/n*2*Math.PI),0]);
  assert.strictEqual(run('mkClosed(circ(40))'),true);assert.strictEqual(run('mkClosed(circ(40).slice(0,31))'),false);assert.strictEqual(run('mkClosed([[0,0,0],[2,0,0],[1,1,0]])'),false);});
test('mkLoad(mkSave(mk)) = mk; мусор → []',()=>{const mk=[{k:'line',pts:[[1.25,2,3],[4,5,6.5]]},{k:'cross',pts:[[0,0,0],[1,1,1]]},{k:'pen',pts:[[0,0,0],[5,0,0],[0,5,0]],closed:true}];c.MK=mk;
  assert.deepStrictEqual(J(run('mkLoad(mkSave(MK))')),mk);['мусор','null','{}','[1,2]','[{"k":"zzz","pts":[[1,2,3]]}]','[{"k":"line","pts":[[1,2]]}]','[{"k":"line","pts":[]}]'].forEach(s=>assert.deepStrictEqual(J(run(`mkLoad(${JSON.stringify(s)})`)),[],s));
  assert.deepStrictEqual(J(run('mkLoad(null)')),[]);});
test('mkSnap: точка ближе 5 мм к линии кальки ложится на неё; дальше или без магнита — как есть',()=>{run('SG=new Float32Array([0,100.6,50, 100,100.6,50])');
  assert.deepStrictEqual(J(run('mkSnap([30,100,53],SG,true)')).map(x=>+x.toFixed(4)),[30,100.6,50]);
  assert.deepStrictEqual(J(run('mkSnap([30,100,57],SG,true)')),[30,100,57]);assert.deepStrictEqual(J(run('mkSnap([30,100,53],SG,false)')),[30,100,53]);
  assert.deepStrictEqual(J(run('mkSnap([30,100,53],null,true)')),[30,100,53]);});
test('mkDrape: прямая между двумя точками на соседних гранях куба идёт по поверхности, не внутрь',()=>{const S=run("mkDrape([{k:'line',pts:[[50,100,80],[50,80,100]]}],CV,CP)");
  assert.ok(S.length>=12);for(let i=0;i<S.length;i+=3){const onTop=Math.abs(S[i+1]-100.6)<1e-4,onFront=Math.abs(S[i+2]-100.6)<1e-4;assert.ok(onTop||onFront,S[i+1]+','+S[i+2]);}});
// «Карандаш» (#151): сглаживание и замкнутость
const dev=pts=>Math.max(...pts.map(p=>Math.abs(p[1])));   // отклонение от прямой y = 0
const turn=(pts,ring)=>{let m=0;const n=pts.length;for(let i=ring?0:1;i<(ring?n:n-1);i++){const a=pts[(i-1+n)%n],b=pts[i],c=pts[(i+1)%n],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-b[0],c[1]-b[1],c[2]-b[2]],
  cs=(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(Math.hypot(...u)*Math.hypot(...v)||1);m=Math.max(m,Math.acos(Math.max(-1,Math.min(1,cs)))*180/Math.PI);}return m;};
test('mkSmooth: дрожащая рука (зигзаг ±1,5 мм вдоль прямой 100 мм) → отклонение ≤ 0,5 мм',()=>{c.ZZ=Array.from({length:201},(_,i)=>[i/2,i===0||i===200?0:(i%2?1.5:-1.5),0]);
  const s=run('mkSmooth(ZZ)');assert.ok(dev(s)<=.5,'отклонение '+dev(s).toFixed(3));assert.ok(Math.abs(s[0][0])<1e-9&&Math.abs(s[s.length-1][0]-100)<1e-9,'концы на месте');assert.ok(s.length<40,'точек немного: '+s.length);});
test('mkSmooth: зигзаг с шагом 0,3 мм (мышь чаще) — тоже ≤ 0,5 мм',()=>{c.ZZ2=Array.from({length:334},(_,i)=>[i*.3,i===0||i===333?0:Math.sin(i*1.7)*1.5,0]);assert.ok(dev(run('mkSmooth(ZZ2)'))<=.5);});
test('mkSmooth: дуга с дрожью — гладкая (излом между отрезками ≤ 25°), не дальше 1,5 мм от дуги',()=>{c.ARC=Array.from({length:181},(_,i)=>{const a=i/180*Math.PI,r=50+(i%2?1:-1);return [r*Math.cos(a),r*Math.sin(a),0];});
  const s=run('mkSmooth(ARC)');assert.ok(turn(s,false)<=25,'излом '+turn(s,false).toFixed(1));s.forEach(p=>assert.ok(Math.abs(Math.hypot(p[0],p[1])-50)<=1.5+1e-9,Math.hypot(p[0],p[1])));});
test('mkSmooth: окружность с дрожью — замкнутое гладкое кольцо',()=>{c.CIR=Array.from({length:241},(_,i)=>{const a=i/240*2*Math.PI,r=30+(i%2?1:-1)*(i%240?1:0);return [r*Math.cos(a),r*Math.sin(a),5];});
  assert.strictEqual(run('mkClosed(CIR)'),true);const s=run('mkSmooth(CIR)');assert.ok(turn(s,true)<=30,'излом '+turn(s,true).toFixed(1));s.forEach(p=>assert.ok(Math.abs(Math.hypot(p[0],p[1])-30)<=2.5,Math.hypot(p[0],p[1])));
  const e=Math.hypot(s[0][0]-s[s.length-1][0],s[0][1]-s[s.length-1][1]);assert.ok(e>0.1&&e<8,'кольцо без повтора первой точки, шаг '+e.toFixed(2));});
test('mkPen: замкнутая — closed, дуга 270° — нет; магнит кладёт точки на линию кальки',()=>{const p=run('mkPen(CIR,null,true)');assert.strictEqual(p.k,'pen');assert.strictEqual(p.closed,true);
  c.A270=Array.from({length:91},(_,i)=>{const a=i/90*1.5*Math.PI;return [30*Math.cos(a),30*Math.sin(a),0];});assert.strictEqual(run('mkPen(A270,null,true)').closed,undefined);
  run('SG2=new Float32Array([0,2,0, 100,2,0])');const q=run('mkPen(ZZ,SG2,true)');q.pts.forEach(p=>assert.ok(Math.abs(p[1]-2)<1e-4,'на линии: '+p[1]));
  assert.ok(run('mkPen(ZZ,SG2,false)').pts.some(p=>Math.abs(p[1]-2)>.5),'без магнита — как вёл');});
