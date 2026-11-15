// Проверка для панели мастерской (studio/js/review.js): node --test studio/tests/review.test.js
const test=require('node:test'),assert=require('node:assert');
const {run,box,faceWhere,TOP,sampleCube,SAMPLE_SCALE}=require('./helpers.js');
const copy=E=>({V:E.V.map(p=>p.slice()),P:E.P.map(Q=>Q.slice()),S:(E.S||[]).map(s=>s.slice())});
const opts=(E,o={})=>Object.assign({scale:SAMPLE_SCALE,kind:'stand',slots:[],base:copy(E)},o);
const check=(E,o)=>run('reviewCheck')(E,o),fix=(E,i,o)=>run('reviewFix')(E,i,o),counts=iss=>run('ruleCounts')(iss);
const row=(iss,n)=>iss.find(i=>i.rule===n&&!i.info);
const used=E=>new Set(E.P.flat()).size;

test('образец: правила 1, 2, 6, 10 и сведение «Эталона нет»; правила 12 в Проверке панели нет', () => {
  const E=sampleCube(),iss=check(E,opts(E));
  assert.deepEqual(counts(iss),{1:1,2:6,6:2,10:1});
  assert.match(row(iss,1).text,/неплоская на 1,5 мм/);assert.match(row(iss,2).text,/ребро 4 мм/);
  assert.deepEqual(iss.filter(i=>i.info).map(i=>i.text),['Эталона нет: похожесть меряю от открытой фигуры']);
  // правило 12 выключено, даже если его не просили пропускать; свои skip складываются
  assert.equal(check(E,opts(E,{skip:[2]})).some(i=>i.rule===2||i.rule===12),false);
});
test('«Исправить» правило 1: фигура новая, без лишних точек, строки нет, другие правила не хуже; исходная не тронута', () => {
  const E=sampleCube(),s=JSON.stringify(E),o=opts(E),iss=check(E,o),r=fix(E,row(iss,1),Object.assign({issues:iss},o));
  assert.equal(r.why,null);assert.equal(JSON.stringify(E),s);
  assert.ok(Math.abs(r.moved-1.5)<.01,'сдвиг '+r.moved);assert.ok(r.dev<=2);assert.deepEqual(r.worse,[]);
  assert.equal(used(r.E),r.E.V.length);assert.equal(row(check(r.E,o),1),undefined);
});
test('«Исправить» правило 2: точек стало меньше, точек без граней нет (как после ручной правки)', () => {
  const E=sampleCube(),o=opts(E),iss=check(E,o),r=fix(E,row(iss,2),o);   // без o.issues — «до» считается само
  assert.equal(r.why,null);assert.ok(r.E.V.length<E.V.length);assert.equal(used(r.E),r.E.V.length);
  assert.ok(check(r.E,o).filter(i=>i.rule===2).length<6);
});
test('правка, от которой растут другие правила (Q28): не откатывается, worse называет правила', () => {
  const E=sampleCube(),o=opts(E),iss=check(E,o),r=fix(E,row(iss,6),Object.assign({issues:iss},o));
  assert.equal(r.why,null);assert.ok(r.E);
  assert.deepEqual(r.worse.map(w=>w.rule).filter(n=>n===3||n===5),[3,5]);
  const w3=r.worse[0];assert.equal(w3.title,'Нет близких точек без ребра между ними (ступенька)');assert.equal(w3.was,0);assert.ok(w3.now>0);
  assert.deepEqual(counts(check(r.E,o))[3],w3.now);
});
test('правка, которую автоматика сделать не может: причина словами, фигуры нет', () => {
  const E=sampleCube(),o=opts(E),iss=check(E,o),r=fix(E,row(iss,10),Object.assign({issues:iss},o));
  assert.equal(r.E,null);assert.match(r.why,/уведёт форму от открытой фигуры на 3 мм \(допуск 2 мм\)/);assert.deepEqual(r.worse,[]);
  assert.match(fix(E,iss.find(i=>i.info),o).why,/не чинит/);
});
test('швы на всех рёбрах: разрез неплоской грани получает шов; швов нет — и новых нет', () => {
  const E0=sampleCube(),o=opts(E0,{th:{ref:1}}),cut=E=>{const iss=check(E,o);return fix(E,row(iss,1),o);};
  const a=cut(E0);assert.equal(a.why,null);assert.equal(a.E.P.length,E0.P.length+1);assert.deepEqual(a.E.S,[]);
  const E1=run('addAllSeams')(E0),b=cut(E1);
  assert.equal(b.why,null);assert.equal(b.E.S.length,E1.S.length+1);assert.equal(run('addAllSeams')(b.E).S.length,b.E.S.length);
});
test('прорези по местам: перенумерация и сдвиг точки прорезь не теряют; залатали — прорези нет', () => {
  const E=box(),top=faceWhere(E,TOP),loop=E.P[top].slice();E.P.splice(top,1);   // куб без крышки: край — прорезь
  const pts=[loop.map(v=>E.V[v].slice())];   // одна прорезь: её точки
  const r0=run('reviewSlots')(E,pts,1);assert.equal(r0.slots.length,1);assert.deepEqual([...r0.slots[0]].sort(),[...loop].sort());
  assert.equal(check(E,{scale:1,kind:'stand',slots:r0.slots}).some(i=>i.rule===8),false);assert.equal(check(E,{scale:1,kind:'stand',slots:[]}).some(i=>i.rule===8),true);
  // точки перенумерованы задом наперёд, одна точка края сдвинута на 30 мм
  const n=E.V.length,R={V:E.V.slice().reverse().map(p=>p.slice()),P:E.P.map(Q=>Q.map(v=>n-1-v))};R.V[n-1-loop[0]][1]+=30;
  const r1=run('reviewSlots')(R,pts,1);assert.equal(r1.slots.length,1);assert.deepEqual([...r1.slots[0]].sort(),loop.map(v=>n-1-v).sort());
  assert.deepEqual(r1.pts[0].length,4);assert.ok(r1.pts[0].some(p=>p[1]===430),'места прорези обновились');
  assert.equal(check(R,{scale:1,kind:'stand',slots:r1.slots}).some(i=>i.rule===8),false);
  // крышку вернули — контура нет; прорезей не было — и нет
  const gone=run('reviewSlots')(box(),pts,1);assert.deepEqual(gone.slots,[]);assert.deepEqual(gone.pts,pts);   // прежние точки остались: «Отменить» вернёт дыру — и она снова прорезь
  assert.equal(run('reviewSlots')(E,gone.pts,1).slots.length,1);assert.deepEqual(run('reviewSlots')(E,[],1),{slots:[],pts:[],idx:[]});assert.deepEqual(gone.idx,[null]);assert.deepEqual(r0.idx,r0.slots);
  // все точки сдвинулись разом (страница поменяла размер, повернула фигуру): по местам прорезь не найти, по прежним номерам — та же
  const S2={V:E.V.map(p=>[p[0]*1.5,p[1]*1.5,p[2]]),P:E.P};
  assert.equal(run('reviewSlots')(S2,pts,1).slots.length,0);const r2=run('reviewSlots')(S2,pts,1,r0.idx);
  assert.deepEqual(r2.slots,r0.slots);assert.ok(r2.pts[0].some(p=>p[1]===600),'места прорези обновились');
  // прежние номера уже не контур (крышку вернули) — прорези нет
  assert.deepEqual(run('reviewSlots')(box(),pts,1,r0.idx).idx,[null]);
  // допуск — в мм сайта: при scale 2 сдвиг трёх точек из четырёх на 0,7 мм модели (1,4 мм сайта) — уже не та прорезь
  const M=copy(E);loop.slice(0,3).forEach(v=>{M.V[v][1]+=.7;});
  assert.equal(run('reviewSlots')(M,pts,1).slots.length,1);assert.equal(run('reviewSlots')(M,pts,2).slots.length,0);
});
