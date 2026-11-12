// правила Проверки (studio/js/rules.js) на кубе-заготовке и на рыси 14: node --test studio/tests/rules.test.js
const test=require('node:test'),assert=require('node:assert');
const {run,box,faceWhere,TOP,edgePoint,vi}=require('./helpers.js');
const check=(E,o={})=>run('checkFigure')(E,Object.assign({scale:1,kind:'stand'},o));
const only=(iss,n)=>iss.filter(i=>i.rule===n);

test('куб чистый', () => {
  assert.deepEqual(check(box()), []);
});

// угол верхней грани поднят по y: боковые грани (x = 150, z = 260) остаются плоскими, у верхней неплоскость = подъём / 4
function raised(d){const E=box(),i=vi(E,[150,400,260]);E.V[i]=[150,400+d,260];return {E,top:faceWhere(box(),TOP)};}
test('правило 1: неплоская грань 0,3 мм — строка на этой грани; 0,05 мм — строк нет', () => {
  const a=raised(1.2),r1=only(check(a.E),1);
  assert.equal(r1.length,1);assert.deepEqual(r1[0].faces,[a.top]);assert.ok(Math.abs(r1[0].val-.3)<.01);assert.match(r1[0].text,/неплоская на 0,3 мм/);
  assert.equal(only(check(raised(.2).E),1).length,0);
});

// у куба срезаны два зеркальных угла треугольником с рёбрами L (как CB в editor/lynx/tools/smoke.js)
function cutCorners(L){const E=box(),d=L/Math.SQRT2;[[6,1],[7,-1]].forEach(([v,s])=>{const p=E.V[v],n=E.V.length;E.V.push([p[0]-s*d,p[1],p[2]],[p[0],p[1]-d,p[2]],[p[0],p[1],p[2]-d]);
  E.P=E.P.map(Q=>{const k=Q.indexOf(v);if(k<0)return Q;const nb=[Q[(k+Q.length-1)%Q.length],Q[(k+1)%Q.length]],pick=w=>{const q=E.V[w];return Math.abs(q[0]-p[0])>1?n:Math.abs(q[1]-p[1])>1?n+1:n+2;};
    const r=Q.slice();r.splice(k,1,pick(nb[0]),pick(nb[1]));return r;});const tri=[n,n+1,n+2];E.P.push(s>0?tri:tri.reverse());});return E;}
test('правило 2: срезанный угол с рёбрами 4 мм — строки коротких рёбер по 4 мм', () => {
  const r2=only(check(cutCorners(4)),2);
  assert.equal(r2.length,6);assert.ok(r2.every(i=>Math.abs(i.val-4)<1e-6&&i.verts.length===2));assert.match(r2[0].text,/ребро 4 мм/);
});

// на двух рёбрах у угла (150, 400, 260) — точки в 4 мм от угла: между ними 5,7 мм и ребра нет
test('правило 3: две точки у угла без ребра между ними — строка с этими точками', () => {
  const E=box(),c=vi(E,[150,400,260]),a=edgePoint(E,c,vi(E,[150,400,0]),[150,400,256]),b=edgePoint(E,c,vi(E,[-150,400,260]),[146,400,260]);
  const r3=only(check(E),3);
  assert.equal(r3.length,1);assert.deepEqual([...r3[0].verts].sort((x,y)=>x-y),[a,b].sort((x,y)=>x-y));assert.ok(Math.abs(r3[0].val-4*Math.SQRT2)<1e-6);
});

// верх разрезан из угла (−150, 400, 0) в точку в 10 мм от соседнего угла: у угла игла atan(10/300) = 1,91°
test('правило 4: игла 1,9° в грани — строка', () => {
  const E=box(),top=faceWhere(E,TOP),m=edgePoint(E,vi(E,[150,400,0]),vi(E,[150,400,260]),[150,400,10]);
  const C=run('cutPoly')(E,top,vi(E,[-150,400,0]),m,false),r4=only(check(C),4);
  assert.equal(r4.length,1);assert.ok(Math.abs(r4[0].val-Math.atan(10/300)*180/Math.PI)<1e-3);assert.equal(r4[0].verts[0],vi(E,[-150,400,0]));
});

// точка посередине переднего ребра верха (0, 400, 260): сдвинута наружу по z на 150·tg 2° — угол в верхней грани 176°; на ребре — 180° в обеих гранях
function edgeMid(dz){const E=box(),m=edgePoint(E,vi(E,[-150,400,260]),vi(E,[150,400,260]),[0,400,260]);E.V[m]=[0,400,260+dz];return {E,m};}
test('правило 5: угол 176° — «почти на прямой»; точка ровно на ребре — «лишняя точка»', () => {
  const a=edgeMid(150*Math.tan(2*Math.PI/180)),r5=only(check(a.E),5);
  assert.equal(r5.length,1);assert.deepEqual(r5[0].verts,[a.m]);assert.match(r5[0].text,/почти на прямой/);assert.ok(Math.abs(r5[0].val-176)<1e-6);
  const b=edgeMid(0),r5b=only(check(b.E),5);
  assert.equal(r5b.length,1);assert.deepEqual(r5b[0].verts,[b.m]);assert.match(r5b[0].text,/лишняя точка/);
});

test('правило 6: плита 300 × 400 × 10 — четыре узкие детали по 10 мм', () => {
  const r6=only(check(box(300,400,10)),6);
  assert.equal(r6.length,4);assert.ok(r6.every(i=>Math.abs(i.val-10)<1e-6&&i.faces.length===1));
});

test('правило 7: верх разрезан пополам в одной плоскости, эталона нет — лишний шов', () => {
  const E=box(),r7=only(check(run('splitPoly')(E,faceWhere(E,TOP),true)),7);
  assert.equal(r7.length,1);assert.equal(r7[0].faces.length,2);assert.ok(r7[0].val<1e-6);assert.match(r7[0].text,/лишний шов/);
});

test('правило 8: дыра — строка; контур в прорезях — нет; дыра в стене (z = 0) у настенной — нет', () => {
  const E=box(),top=faceWhere(E,TOP),H=run('delPoly')(E,top,false),slot=E.P[top].map(i=>vi(H,E.V[i]));   // delPoly перенумеровывает точки
  const r8=only(check(H),8);assert.equal(r8.length,1);assert.equal(r8[0].verts.length,4);assert.ok(Math.abs(r8[0].val-2*(300+260))<1e-6);
  assert.equal(only(check(H,{slots:[slot]}),8).length,0);
  const W=run('delPoly')(E,faceWhere(E,p=>p[2]===0),false);
  assert.equal(only(check(W,{kind:'wall'}),8).length,0);assert.equal(only(check(W),8).length,1);
});

test('правило 9: две плиты крест-накрест — обе в списке', () => {
  const X={V:[[-50,0,0],[50,0,0],[50,100,0],[-50,100,0],[0,0,-50],[0,0,50],[0,100,50],[0,100,-50]],P:[[0,1,2,3],[4,5,6,7]]};
  const r9=only(check(X),9);assert.deepEqual(r9.map(i=>i.faces[0]).sort(),[0,1]);assert.ok(r9.every(i=>/протыкает/.test(i.text)));
});

test('правило 10: точка правой половины сдвинута на 0,5 мм — одна строка на пару', () => {
  const E=box(),i=vi(E,[150,400,260]),j=vi(E,[-150,400,260]);E.V[i]=[150,400,260.5];
  const r10=only(check(E),10);assert.equal(r10.length,1);assert.ok(Math.abs(r10[0].val-.5)<1e-6);assert.deepEqual([...r10[0].verts].sort((a,b)=>a-b),[i,j].sort((a,b)=>a-b));
});

test('правило 13: у одной грани обратный обход — строка на ней', () => {
  const E=box(),f=faceWhere(E,TOP);E.P[f].reverse();
  const r13=only(check(E),13);assert.equal(r13.length,1);assert.deepEqual(r13[0].faces,[f]);
});

test('правило 14: грань из трёх точек на одной прямой — строка', () => {
  const E=box(),a=vi(E,[-150,400,260]),b=vi(E,[150,400,260]),m=edgePoint(E,a,b,[0,400,260]);E.P.push([a,m,b]);
  const r14=only(check(E),14);assert.equal(r14.length,1);assert.deepEqual(r14[0].faces,[E.P.length-1]);
});

test('правило 14: грань из двух точек и грань с повтором точки — только строки правила 14, Проверка не падает', () => {
  const E=box();E.P.push([0,1]);E.P[faceWhere(E,TOP)]=(Q=>[Q[0],Q[1],Q[1],Q[2],Q[3]])(E.P[faceWhere(E,TOP)]);
  const r=check(E);assert.deepEqual([...new Set(r.map(i=>i.rule))],[14]);assert.equal(r.length,2);
});

test('правило 13: куб вывернут целиком (все грани внутрь) — строка «фигура вывернута»', () => {
  const E=box();E.P.forEach(Q=>Q.reverse());
  const r13=only(check(E),13);assert.equal(r13.length,1);assert.equal(r13[0].faces.length,6);assert.match(r13[0].text,/вывернута/);
});

test('правило 10: точка середины в 0,3 мм от x = 0 — строка «не на середине: 0,3 мм»', () => {
  const E=box(),m=edgePoint(E,vi(E,[-150,400,260]),vi(E,[150,400,260]),[0.3,400,260]);
  const r10=only(check(E),10);assert.equal(r10.length,1);assert.deepEqual(r10[0].verts,[m]);assert.ok(Math.abs(r10[0].val-.3)<1e-9);assert.match(r10[0].text,/не на середине: 0,3 мм/);
});

// верх куба — кольцо из четырёх граней вокруг прорези 100 × 1 мм посередине
function slotBox(w){const E=box(),top=faceWhere(E,TOP),[c3,c7,c6,c2]=E.P[top],z0=130-w/2,z1=130+w/2,n=E.V.length;
  E.V.push([-50,400,z0],[50,400,z0],[50,400,z1],[-50,400,z1]);const [h0,h1,h2,h3]=[n,n+1,n+2,n+3];
  E.P.splice(top,1,[c3,c7,h3,h0],[c7,c6,h2,h3],[c6,c2,h1,h2],[c2,c3,h0,h1]);return {E,slot:[h0,h1,h2,h3]};}
test('правило 16: прорезь 1 мм при листе 2 мм — строка; 3 мм — нет', () => {
  const a=slotBox(1),r16=only(check(a.E,{slots:[a.slot],t:2}),16);
  assert.equal(r16.length,1);assert.ok(Math.abs(r16[0].val-1)<1e-6);assert.equal(only(check(a.E,{slots:[a.slot],t:2}),8).length,0);
  const b=slotBox(3);assert.equal(only(check(b.E,{slots:[b.slot],t:2}),16).length,0);
});

test('оставить так: место правила 1 в keep (± 3 мм) — строки нет; в 8 мм — строка есть', () => {
  const {E}=raised(1.2),at=only(check(E),1)[0].at;
  assert.equal(only(check(E,{keep:[{rule:1,at:[at[0]+3,at[1],at[2]]}]}),1).length,0);
  assert.equal(only(check(E,{keep:[{rule:1,at:[at[0]+8,at[1],at[2]]}]}),1).length,1);
  assert.equal(only(check(E,{keep:[{rule:2,at}]}),1).length,1);
  assert.ok(run('keepMatch')({rule:1,at:[0,0,0]},{rule:1,at:[0,0,4]},1)&&!run('keepMatch')({rule:1,at:[0,0,0]},{rule:1,at:[0,0,4]},2));
});

test('строже в области: неплоскость 0,07 мм — без области строки нет, «Здесь криво» рядом — есть, вдали — нет', () => {
  const {E}=raised(.28),c=[0,400,130];
  assert.equal(only(check(E),1).length,0);
  const r=check(E,{region:{c,r:60}});assert.equal(only(r,1).length,1);assert.ok(Math.abs(only(r,1)[0].val-.07)<.005);
  assert.equal(check(E,{region:{c:[0,0,130],r:60}}).filter(i=>i.rule===1).length,0);
});

test('ruleCounts: информационные строки не считаются', () => {
  assert.deepEqual({...run('ruleCounts')([{rule:1},{rule:1},{rule:6},{rule:15,info:true}])},{1:2,6:1});
});

// рысь 14 с сайта: scale = 1000 / высота модели (595,0)
const L={};const lynx=()=>{if(!L.E){L.E=run("modelPoly('lynx14')");L.sc=1000/run('meshBox')(L.E.V).size[1];L.iss=check(L.E,{scale:L.sc,skip:[12]});}return L;};
test('рысь 14: 1372 точки, 1133 грани, худшая неплоскость 1,33 мм', () => {
  const {E,iss,sc}=lynx();
  assert.equal(E.V.length,1372);assert.equal(E.P.length,1133);assert.ok(Math.abs(sc-1000/595)<1e-9);
  const w=Math.max(...iss.filter(i=>i.rule===1).map(i=>i.val));
  assert.ok(Math.abs(w-1.33)<.05,'худшая неплоскость '+w);
});
test('рысь 14: три скрина Виталия — есть строки правил 1 (веер на лбу), 3 и 4 (ступенька и игла у детали № 176), 6 (красное на шее)', () => {
  const c=run('ruleCounts')(lynx().iss);
  [1,3,4,6].forEach(n=>assert.ok(c[n]>0,'нет строк правила '+n));
});
test('рысь 14: Проверка без эталона и без правила 12 — меньше 2 с', () => {
  const {E,sc}=lynx(),t0=Date.now();check(E,{scale:sc,skip:[12]});const dt=Date.now()-t0;
  assert.ok(dt<2000,'Проверка '+dt+' мс');
});
