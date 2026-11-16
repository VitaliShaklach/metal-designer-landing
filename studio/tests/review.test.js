// Проверка для панели мастерской (studio/js/review.js): node --test studio/tests/review.test.js
const test=require('node:test'),assert=require('node:assert');
const {run,box,faceWhere,TOP,sampleCube,sampleSplit,SAMPLE_SCALE}=require('./helpers.js');
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
test('«Следующая» (Q31): ближайшая на модели строка того же правила, которой ещё не было; все были — null', () => {
  const at=x=>[x,0,0],I=(rule,x,info)=>({rule,at:at(x),text:'т'+rule+'@'+x,info:!!info});
  const iss=[I(2,30),I(2,0),I(3,1),I(2,10),I(2,31),I(11,2,true)];
  const next=(a,seen,sc=1)=>{const r=run('reviewNext')(iss,2,at(a),seen.map(at),sc);return r&&r.at[0];};
  assert.equal(next(0,[0]),10);              // не строка правила 3 (она ближе) и не сведение
  assert.equal(next(10,[0,10]),30);          // от текущей, а не от первой
  assert.equal(next(30,[0,10,30]),31);
  assert.equal(next(31,[0,10,30,31]),null);  // последняя — дальше некуда
  assert.equal(next(0,[]),0);                // сама строка ещё не была — она и ближайшая
  // «та же строка» — ближе 1 мм сайта: при scale 2 строка в 0,4 мм модели уже была, в 0,6 мм — нет
  assert.equal(next(0,[0,9.6],2),30);assert.equal(next(0,[0,9.4],2),10);assert.equal(next(0,[0,9.4],1),30);
  assert.equal(run('reviewNext')(null,2,at(0),[],1),null);
  // строка на прежнем месте (для «Предыдущая»): то же правило, ближе 1 мм сайта; нет — null
  const find=(a,sc=1,rule=2)=>{const r=run('reviewFind')(iss,rule,at(a),sc);return r&&r.at[0];};
  assert.equal(find(10.4),10);assert.equal(find(10.4,3),null);assert.equal(find(1,1,2),null);assert.equal(find(1,1,3),1);assert.equal(find(2,1,11),null);
});

// ---- пачка (решения Q24, Q28, Q29): reviewBatch — генератор: шаг за шагом, next(true) — «Стоп» ----
const batch=(E,o,stopAt)=>{const g=run('reviewBatch')(E,o),steps=[];let r=g.next(),n=0;
  while(!r.done){steps.push(r.value);r=g.next(stopAt!==undefined&&n++>=stopAt);}return Object.assign({steps},r.value);};
const judge=(a,b)=>run('judgeAll')(a,b);
test('пачка по правилу 2: все 6 строк починены, прогресс «k из 6», другие правила не хуже, исходная не тронута', () => {
  const E=sampleCube(),s=JSON.stringify(E),o=opts(E),r=batch(E,Object.assign({rules:[2]},o));
  assert.equal(JSON.stringify(E),s);
  assert.deepEqual({...r.steps[0]},{...r.steps[0],k:0,of:6,round:0});assert.ok(r.steps.length>=2);
  assert.ok(r.steps.every(p=>p.of===6||p.round>0));
  assert.equal(r.stopped,false);assert.equal(r.of,6);assert.equal(r.fixed,6);assert.equal(r.left,0);
  assert.ok(r.moved>0&&r.moved<=4,'сдвиг '+r.moved);assert.deepEqual(r.reasons,[]);
  assert.equal(used(r.E),r.E.V.length,'без лишних точек, как после ручной правки');
  const a=check(r.E,o);assert.equal(row(a,2),undefined);assert.ok(judge(check(E,o),a).ok);
});
test('пачка: правка, от которой растёт другое правило, не попадает; причина названа (Q28)', () => {
  const E=sampleSplit(),o=opts(E);assert.deepEqual(counts(check(E,o)),{1:1,2:6,6:2,7:1,10:1});
  const r=batch(E,Object.assign({rules:[7]},o));
  assert.equal(r.E,null);assert.equal(r.fixed,0);assert.equal(r.of,1);assert.equal(r.left,1);
  assert.deepEqual(r.reasons,[{why:'правка откатана: стало хуже правило 5 (было 0, стало 2)',n:1}]);
  // а одиночное «Исправить» ту же правку даёт сделать (с предупреждением)
  const iss=check(E,o),one=fix(E,row(iss,7),Object.assign({issues:iss},o));assert.equal(one.why,null);assert.deepEqual(one.worse.map(w=>w.rule),[5]);
});
test('«Стоп» после первой пробы: посчитанная часть применима, остальное — «расчёт остановлен»', () => {
  const E=sampleCube(),o=opts(E),full=batch(E,Object.assign({rules:[2]},o)),r=batch(E,Object.assign({rules:[2]},o),1);
  assert.equal(r.stopped,true);assert.equal(r.steps.length,2);assert.equal(r.steps[1].k,1);
  assert.ok(r.E,'есть что применить');assert.ok(r.fixed>0&&r.fixed<full.fixed,'починено '+r.fixed);assert.equal(r.left,6-r.fixed);
  assert.ok(judge(check(E,o),check(r.E,o)).ok);
  assert.ok(r.reasons.some(x=>/расчёт остановлен/.test(x.why)),JSON.stringify(r.reasons));
  // «Стоп» до первой пробы — применять нечего
  const z=batch(E,Object.assign({rules:[2]},o),0);assert.equal(z.stopped,true);assert.equal(z.E,null);assert.equal(z.fixed,0);
});
test('«Исправить всё безопасное»: чинит всё, что можно; остальное — с причинами; ничего не стало хуже', () => {
  const E=sampleCube(),o=opts(E),r=batch(E,o);
  assert.equal(r.of,10);assert.equal(r.fixed,9);assert.equal(r.left,1);assert.equal(r.stopped,false);
  const a=check(r.E,o);assert.deepEqual(counts(a),{10:1});assert.ok(judge(check(E,o),a).ok);
  assert.deepEqual(r.reasons,[{why:'правка уведёт форму от открытой фигуры на 3 мм (допуск 2 мм)',n:1}]);
  // с разрезанной гранью: шов не убран — от этого выросло бы правило 5
  const S=sampleSplit(),os=opts(S),b=batch(S,os);
  assert.equal(b.of,11);assert.equal(b.fixed,9);assert.equal(b.left,2);assert.deepEqual(counts(check(b.E,os)),{7:1,10:1});
  assert.ok(b.reasons.some(x=>/стало хуже правило 5/.test(x.why)),JSON.stringify(b.reasons));
});
test('причины пачки: одинаковые, кроме мм, — одной строкой с разбросом; номера правил не склеиваются', () => {
  const by=new Map(),W=run('reviewWhy');['грань станет неплоской на 1,48 мм','грань станет неплоской на 1,05 мм','грань станет неплоской на 1,2 мм',
    'правка откатана: стало хуже правило 3 (было 0, стало 2)','правка откатана: стало хуже правило 5 (было 0, стало 2)'].forEach(w=>W(by,w));
  const out=[...by.values()].map(x=>x.tpl.split('#').map((s,k)=>k?run('reviewSpan')(x.mm[k-1])+s:s).join('')+' · '+x.n);
  assert.deepEqual(out,['грань станет неплоской на 1,05–1,48 мм · 3','правка откатана: стало хуже правило 3 (было 0, стало 2) · 1','правка откатана: стало хуже правило 5 (было 0, стало 2) · 1']);
});

// ---------- рысь 14: пачка по правилу 2 целиком (около 25 с). С эталоном src5, если он есть; нет — похожесть от открытой фигуры, как в панели ----------
test('рысь 14: пачка по правилу 2 доходит до конца, ни одно правило не стало хуже', () => {
  const fs=require('fs'),W=require('../lib/workdir.js'),{buildRef}=require('../lib/refbuild.js'),{LYNX_REF}=require('../lib/sources.js');
  const E=run("modelPoly('lynx14')"),sc=1000/run('meshBox')(E.V).size[1],png=LYNX_REF.replace(/\.obj$/i,'.png');
  const R=fs.existsSync(LYNX_REF)?run('refIndex')(buildRef(LYNX_REF,fs.existsSync(png)?png:null,{half:'left',frame:'lynx14'})):null;
  const slots=W.openLoops(E.P),o={scale:sc,kind:'stand',slots,ref:R,base:R?null:copy(E)};
  const r=batch(E,Object.assign({rules:[2]},o));
  assert.equal(r.stopped,false);assert.equal(r.of,178);assert.ok(r.fixed>0&&r.E,'починено '+r.fixed);
  assert.ok(r.steps.length>r.of/2,'прогресс шёл по шагам: '+r.steps.length);
  // до и после — Проверка панели заново (прорези — по местам: compact перенумеровал точки)
  const before=counts(check(E,o)),T=r.E,after=counts(check(T,Object.assign({},o,{slots:run('reviewSlots')(T,slots.map(L=>L.map(v=>E.V[v])),sc).slots})));
  const j=judge(before,after);assert.ok(j.ok,'стало хуже: '+JSON.stringify(j.worse));
  assert.equal(after[2],r.left);assert.equal(before[2]-after[2],r.fixed);
  assert.ok(r.reasons.length&&r.reasons.reduce((s,x)=>s+x.n,0)===r.left,'у каждой оставшейся строки — причина');
});

// ---- «Здесь криво» и «Карта отклонений» (#114) ----
test('«Здесь криво» (Q20): шар 60 мм сайта, пороги вдвое строже — грань 0,7 мм есть, чистое место пусто, сведений нет', () => {
  const {sampleTwist,TWIST_FACE}=require('./helpers.js'),E=sampleTwist(),o=opts(E),here=(c)=>run('reviewHere')(E,c,o);
  assert.equal(run('REVIEW_HERE_R'),60);
  assert.deepEqual(check(E,o).filter(i=>!i.info),[],'в обычной Проверке ошибок нет');
  const f=faceWhere(E,TWIST_FACE),r=here(run('polyC')(E.V,E.P[f]));
  assert.deepEqual(r.map(i=>i.rule+' '+i.text),['1 грань неплоская на 0,7 мм']);assert.deepEqual(r[0].faces,[f]);
  assert.deepEqual(here([0,100,130]),[],'середина передней грани — чисто');
  // «Оставить так» действует и здесь
  assert.deepEqual(run('reviewHere')(E,r[0].at,Object.assign({},o,{keep:[{rule:1,at:r[0].at}]})),[]);
});
test('«Карта отклонений»: отклонение каждой грани от эталона (или от открытой фигуры), цвет от «совпадает» до «2 мм и дальше»', () => {
  const {sampleTwist,twistRef}=require('./helpers.js'),E=sampleTwist(),dev=(R)=>run('reviewDev')(E,R,SAMPLE_SCALE);
  const m=dev(twistRef());assert.equal(m.dev.length,E.P.length);assert.ok(Array.isArray(m.dev));
  const top=faceWhere(E,p=>p[1]===200),bottom=faceWhere(E,p=>p[1]===0);
  assert.ok(Math.abs(m.dev[top]-3)<.01,'верх '+m.dev[top]);assert.ok(m.dev[bottom]<.01);assert.ok(Math.abs(m.max-3)<.01);
  // эталона нет — сравнение с фигурой, какой её открыли: всё совпадает
  const b=dev(copy(E));assert.ok(b.max<.01);
  const hex=d=>run('reviewMapHex')(d);
  assert.equal(run('REVIEW_MAP_MAX'),2);
  assert.equal(hex(0),'#2e9e4f');assert.equal(hex(2),'#d01f1f');assert.equal(hex(5),'#d01f1f');assert.equal(hex(1),'#e8c62a');
  assert.notEqual(hex(.5),hex(0));assert.notEqual(hex(1.5),hex(2));
});
