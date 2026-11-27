// #181 разметка лентой (линии толщиной в пикселях экрана): node --test shepherd-v6j3w/tools/ribbon.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,Math,Float32Array,Uint32Array};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/../js/ribbon.js','utf8'),c);
const geo=(seg,nrm)=>{c.S=new Float32Array(seg);c.N=nrm?new Float32Array(nrm):null;return vm.runInContext('rbGeo(S,N)',c);};
const at=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
// вершина i ленты: [предыдущая точка ломаной, сама точка, следующая] — по этой тройке шейдер считает поворот на стыке
const tri=(g,i)=>[at(g.pa,i),at(g.pos,i),at(g.pb,i)];

test('один отрезок: 4 вершины (по две на конец, стороны +1 и −1), 2 треугольника; концы без соседей — «соседом» сама точка',()=>{
  const A=[0,0,0],B=[10,0,0],g=geo([...A,...B]);
  assert.deepStrictEqual([...g.side],[1,-1,1,-1]);assert.strictEqual(g.idx.length,6);assert.ok([...g.idx].every(i=>i>=0&&i<4));
  assert.deepStrictEqual(tri(g,0),[A,A,B]);assert.deepStrictEqual(tri(g,1),[A,A,B]);
  assert.deepStrictEqual(tri(g,2),[A,B,B]);assert.deepStrictEqual(tri(g,3),[A,B,B]);
  assert.strictEqual(g.nrm,null,'без нормалей — нет и атрибута');});

test('ломаная A–B–C: у обоих отрезков вершины на стыке B видят одну тройку A, B, C — края лент сходятся без щели и без нахлёста',()=>{
  const A=[0,0,0],B=[10,0,0],C=[10,10,0],g=geo([...A,...B,...B,...C]);
  assert.strictEqual(g.side.length,8);assert.strictEqual(g.idx.length,12);
  for(const i of [2,3,4,5])assert.deepStrictEqual(tri(g,i),[A,B,C],'вершина '+i);
  assert.deepStrictEqual(tri(g,0),[A,A,B],'начало ломаной — без соседа');assert.deepStrictEqual(tri(g,7),[B,C,C],'конец ломаной — без соседа');});

test('отрезки не стыкуются (конец ≠ начало следующего) — каждый сам по себе',()=>{
  const A=[0,0,0],B=[10,0,0],C=[10,0.5,0],D=[20,0,0],g=geo([...A,...B,...C,...D]);
  assert.deepStrictEqual(tri(g,2),[A,B,B]);assert.deepStrictEqual(tri(g,4),[C,C,D]);});

test('замкнутый контур A–B–C–A: стык и в начальной точке (последний отрезок → первый)',()=>{
  const A=[0,0,0],B=[10,0,0],C=[0,10,0],g=geo([...A,...B,...B,...C,...C,...A]);
  assert.deepStrictEqual(tri(g,0),[C,A,B],'начало первого отрезка видит конец последнего');assert.deepStrictEqual(tri(g,11),[C,A,B],'конец последнего видит начало первого');
  assert.deepStrictEqual(tri(g,6),[B,C,A],"стык в C");});

test('два отрезка туда-обратно (A–B, B–A) — не «замкнутый контур»: у двух отрезков стыка в начале нет',()=>{
  const A=[0,0,0],B=[10,0,0],g=geo([...A,...B,...B,...A]);
  assert.deepStrictEqual(tri(g,0),[A,A,B]);assert.deepStrictEqual(tri(g,7),[B,A,A]);});

test('нормали (для отсечения обратной стороны, как калька #169) — у каждой вершины нормаль своего конца отрезка',()=>{
  const g=geo([0,0,0,10,0,0, 10,0,0,10,10,0],[0,0,1,0,1,0, 0,1,0,1,0,0]);
  assert.deepStrictEqual([0,1,2,3,4,5,6,7].map(i=>at(g.nrm,i)),[[0,0,1],[0,0,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[1,0,0],[1,0,0]]);});

test('пусто → пустая лента; 20 000 отрезков (длинная разметка) — меньше 100 мс (запас под нагрузку: в покое ~20 мс)',()=>{
  const e=geo([]);assert.strictEqual(e.pos.length,0);assert.strictEqual(e.idx.length,0);
  const N=20000,s=new Float32Array(N*6);for(let i=0;i<N;i++){s[i*6]=i;s[i*6+1]=Math.sin(i/9)*20;s[i*6+3]=i+1;s[i*6+4]=Math.sin((i+1)/9)*20;}
  const f=new Function('S',fs.readFileSync(__dirname+'/../js/ribbon.js','utf8')+';return rbGeo(S,null);');   // скорость — не в песочнице vm (там Math.* медленный)
  f(s);const t=Date.now(),g=f(s),ms=Date.now()-t;assert.strictEqual(g.side.length,N*4);assert.ok(ms<100,ms+' мс');});
