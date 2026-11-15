// починка одного места и швы на всех рёбрах (studio/js/fix.js): node --test studio/tests/fix.test.js
const test=require('node:test'),assert=require('node:assert');
const {run,box,faceWhere,TOP,edgePoint,vi}=require('./helpers.js');
const O={scale:1,kind:'stand',skip:[12]};
const check=(E,o={})=>run('checkFigure')(E,Object.assign({},O,o));
const only=(iss,n)=>iss.filter(i=>i.rule===n&&!i.info);
const fix=(E,iss,o={})=>run('fixIssue')(E,iss,Object.assign({},O,o));
// первая строка правила n → починка
function fix1(E,n,o={}){const i=only(check(E,o),n)[0];assert.ok(i,'строки правила '+n+' нет до починки');return {r:fix(E,i,o),i};}
const snap=E=>JSON.stringify(E);

// угол верхней грани поднят по y на d
function raised(d){const E=box(),i=vi(E,[150,400,260]);E.V[i]=[150,400+d,260];return E;}
function cutCorners(L){const E=box(),d=L/Math.SQRT2;[[6,1],[7,-1]].forEach(([v,s])=>{const p=E.V[v],n=E.V.length;E.V.push([p[0]-s*d,p[1],p[2]],[p[0],p[1]-d,p[2]],[p[0],p[1],p[2]-d]);
  E.P=E.P.map(Q=>{const k=Q.indexOf(v);if(k<0)return Q;const nb=[Q[(k+Q.length-1)%Q.length],Q[(k+1)%Q.length]],pick=w=>{const q=E.V[w];return Math.abs(q[0]-p[0])>1?n:Math.abs(q[1]-p[1])>1?n+1:n+2;};
    const r=Q.slice();r.splice(k,1,pick(nb[0]),pick(nb[1]));return r;});const tri=[n,n+1,n+2];E.P.push(s>0?tri:tri.reverse());});return E;}
// чинить по очереди, пока строки правила есть (не больше 12 раз); возвращает {E, moved}
function fixAll(E,n,o={}){let moved=0;for(let k=0;k<12;k++){const i=only(check(E,o),n)[0];if(!i)break;const r=fix(E,i,o);assert.equal(r.why,null,'отказ: '+r.why);E=r.E;moved=Math.max(moved,r.moved);}return {E,moved};}

test('исходная фигура не меняется', () => {
  const E=raised(1.2),s=snap(E),{r}=fix1(E,1);
  assert.equal(r.why,null);assert.equal(snap(E),s);assert.notStrictEqual(r.E,E);
});
test('правило 1: угол поднят на 1,2 мм — грань выровнена, сдвиг не больше подъёма', () => {
  const {r}=fix1(raised(1.2),1);
  assert.equal(r.why,null);assert.equal(only(check(r.E),1).length,0);assert.ok(r.moved<=1.2+1e-6,'сдвиг '+r.moved);assert.ok(r.dev<=2);
});
test('правило 1: угол поднят на 6 мм при th.ref 1 — грань режется по диагонали на две плоские', () => {
  const E=raised(6),n0=E.P.length,o={th:{ref:1}},{r}=fix1(E,1,o);
  assert.equal(r.why,null);assert.equal(r.E.P.length,n0+1);assert.equal(only(check(r.E,o),1).length,0);assert.ok(r.dev<=1+1e-6);
});
test('правило 2: срезанный угол 4 мм — рёбра стянуты, сдвиг не больше ребра, зеркальная пара стянута так же', () => {
  const E0=cutCorners(4),i=only(check(E0),2)[0],r=fix(E0,i);
  assert.equal(r.why,null);assert.equal(only(check(r.E),2).length,2);   // из 6 коротких рёбер: у каждого треугольника стянуто по одному, остальные стали одним ребром
  assert.equal(only(check(r.E),10).length,0,'симметрия сохранена');
  const {E,moved}=fixAll(E0,2);
  assert.equal(only(check(E),2).length,0);assert.ok(moved<=8,'сдвиг '+moved);assert.equal(only(check(E),10).length,0);
});
test('правило 2: ребро по краю дыры не трогается', () => {
  const E0=box(),top=faceWhere(E0,TOP),H=run('delPoly')(E0,top,false);   // верх убран: контур открыт
  const c=vi(H,[150,400,260]),m=edgePoint(H,c,vi(H,[150,400,0]),[150,400,256]);
  const r=fix(H,{rule:2,at:[150,400,258],faces:[],verts:[c,m],val:4,text:'',fix:true,info:false});assert.ok(r.why&&/край/.test(r.why),String(r.why));
});
test('правило 14: средняя точка, нужная соседям, не вырезается из них (дыры не остаётся)', () => {
  const E=box(),a=vi(E,[-150,400,260]),b=vi(E,[150,400,260]),m=edgePoint(E,a,b,[0,400,260]);E.P.push([a,m,b]);
  const r=fix1(E,14).r;assert.equal(only(check(r.E),8).length,0);
});
test('правило 3: две точки у угла в 4 мм — слиты в одну', () => {
  const E=box(),c=vi(E,[150,400,260]);edgePoint(E,c,vi(E,[150,400,0]),[150,400,256]);edgePoint(E,c,vi(E,[-150,400,260]),[146,400,260]);
  const {r}=fix1(E,3);assert.equal(r.why,null);assert.equal(only(check(r.E),3).length,0);assert.ok(r.moved<=8,'сдвиг '+r.moved);
});
test('правило 4: игла 1,9° — стянута короткая сторона без сдвига формы', () => {
  const E=box(),top=faceWhere(E,TOP),m=edgePoint(E,vi(E,[150,400,0]),vi(E,[150,400,260]),[150,400,10]);
  const C=run('cutPoly')(E,top,vi(E,[-150,400,0]),m,false),{r}=fix1(C,4);
  assert.equal(r.why,null);assert.equal(only(check(r.E),4).length,0);assert.ok(r.moved<1e-6,'сдвиг '+r.moved);
});
function edgeMid(dz){const E=box(),m=edgePoint(E,vi(E,[-150,400,260]),vi(E,[150,400,260]),[0,400,260]);E.V[m]=[0,400,260+dz];return E;}
test('правило 5: «почти на прямой» и «лишняя точка» — точки уходят с прямой', () => {
  const a=fix1(edgeMid(150*Math.tan(2*Math.PI/180)),5);
  assert.equal(a.r.why,null);assert.equal(only(check(a.r.E),5).length,0);assert.ok(a.r.moved<=5.3,'сдвиг '+a.r.moved);
  const b=fix1(edgeMid(0),5);
  assert.equal(b.r.why,null);assert.equal(only(check(b.r.E),5).length,0);assert.ok(b.r.moved<1e-6);
});
test('правило 6: узкая полоса в одной плоскости с соседом — сливается', () => {
  const E=box(),top=faceWhere(E,TOP),p1=edgePoint(E,vi(E,[-150,400,0]),vi(E,[150,400,0]),[-140,400,0]),p2=edgePoint(E,vi(E,[-150,400,260]),vi(E,[150,400,260]),[-140,400,260]);
  const C=run('cutPoly')(E,top,p1,p2,false),n6=only(check(C),6).length;assert.ok(n6>=1);
  const {r}=fix1(C,6);assert.equal(r.why,null);assert.equal(only(check(r.E),6).length,n6-1);assert.ok(r.moved<=1e-6,'сдвиг '+r.moved);
});
test('правило 6: узкая боковина плиты 300 × 400 × 10 — отказ с причиной в мм', () => {
  const {r}=fix1(box(300,400,10),6);assert.ok(r.why&&/мм/.test(r.why),String(r.why));assert.equal(r.moved,0);
});
test('правило 7: верх разрезан в одной плоскости — шов убран', () => {
  const E=box(),C=run('splitPoly')(E,faceWhere(E,TOP),true),n=C.P.length,{r}=fix1(C,7);
  assert.equal(r.why,null);assert.equal(only(check(r.E),7).length,0);assert.equal(r.E.P.length,n-1);assert.ok(r.moved<=1e-6);
});
// верх разрезан пополам, середина поднята на h: излом мал (правило 7), но «слить» сплющит ридж
function ridge(h){const E=box(),C=run('splitPoly')(E,faceWhere(E,TOP),false);C.V.forEach((p,i)=>{if(p[1]===400&&Math.abs(p[0])<1e-6)C.V[i]=[0,400+h,p[2]];});return C;}
test('правило 11 держит: слияние уводит форму на 3 мм при ref 2 — не делается', () => {
  const E=ridge(6),o={th:{ref:2}},iss=only(check(E,o),7);assert.ok(iss.length,'нет строки правила 7');
  const r=fix(E,iss[0],o);assert.ok(r.why&&/мм/.test(r.why),String(r.why));assert.strictEqual(r.E,E);assert.equal(r.moved,0);
  const ok=fix(E,iss[0],{th:{ref:10}});assert.equal(ok.why,null);assert.ok(ok.dev>2&&ok.dev<=10,'dev '+ok.dev);
});
test('правило 8: дыра на месте верха закрыта гранью', () => {
  const E=box(),H=run('delPoly')(E,faceWhere(E,TOP),false),n=H.P.length,{r}=fix1(H,8);
  assert.equal(r.why,null);assert.equal(r.E.P.length,n+1);assert.equal(only(check(r.E),8).length,0);assert.equal(r.moved,0);
});
test('правило 8: прорезь не закрывается, а стена настенной не трогается', () => {
  const E=box(),top=faceWhere(E,TOP),H=run('delPoly')(E,top,false),slot=E.P[top].map(i=>vi(H,E.V[i]));
  assert.equal(only(check(H,{slots:[slot]}),8).length,0);
  const W=run('delPoly')(E,faceWhere(E,p=>p[2]===0),false);assert.equal(only(check(W,{kind:'wall'}),8).length,0);
  // две дыры: одна прорезь, одна настоящая — чинится только вторая
  const D=run("delPoly")(H,faceWhere(H,p=>p[1]===0),false),sl=slot.slice();
  const iss=only(check(D,{slots:[sl]}),8);assert.equal(iss.length,1);
  const r=fix(D,iss[0],{slots:[sl]});assert.equal(r.why,null);assert.equal(only(check(r.E,{slots:[sl]}),8).length,0);
  assert.equal(r.E.P.length,D.P.length+1);
});
test('правило 10: точка сдвинута на 0,5 мм — пара подогнана к зеркалу, сдвиг не больше 0,25', () => {
  const E=box(),i=vi(E,[150,400,260]);E.V[i]=[150,400,260.5];
  const {r}=fix1(E,10);assert.equal(r.why,null);assert.equal(only(check(r.E),10).length,0);assert.ok(r.moved<=.25+1e-6,'сдвиг '+r.moved);
});
test('правило 13: грань с обратным обходом развёрнута; вывернутая фигура — вся', () => {
  const E=box(),f=faceWhere(E,TOP);E.P[f].reverse();
  const a=fix1(E,13);assert.equal(a.r.why,null);assert.equal(only(check(a.r.E),13).length,0);assert.equal(a.r.moved,0);
  const F=box();F.P.forEach(Q=>Q.reverse());const b=fix1(F,13);assert.equal(b.r.why,null);assert.equal(only(check(b.r.E),13).length,0);
});
test('правило 14: грань из трёх точек на прямой — убрана вместе со средней точкой', () => {
  const E=box(),a=vi(E,[-150,400,260]),b=vi(E,[150,400,260]),m=edgePoint(E,a,b,[0,400,260]);E.P.push([a,m,b]);
  const {r}=fix1(E,14);assert.equal(r.why,null);assert.equal(only(check(r.E),14).length,0);assert.equal(r.moved,0);
  assert.deepEqual(only(check(r.E),5),[]);
});
test('правило 14: две совпавшие точки в грани — слиты', () => {
  const E=box(),top=faceWhere(E,TOP);E.P[top]=(Q=>[Q[0],Q[1],Q[1],Q[2],Q[3]])(E.P[top]);
  const {r}=fix1(E,14);assert.equal(r.why,null);assert.equal(only(check(r.E),14).length,0);
});
test('правило 16: щель 1 мм при листе 2 мм — расширена до листа', () => {
  // грани вокруг щели собираем вручную: две плиты с вырезом
  const V=[[-50,-50,0],[-.5,-50,0],[-.5,-10,0],[-.5,10,0],[-.5,50,0],[-50,50,0],[.5,-50,0],[.5,-10,0],[.5,10,0],[.5,50,0],[50,50,0],[50,-50,0]];
  const E={V,P:[[0,1,2,3,4,5],[6,11,10,9,8,7],[1,6,7,2],[3,8,9,4]],S:[]},slot=[2,3,8,7];
  const iss=only(check(E,{slots:[slot],t:2}),16);assert.equal(iss.length,1);
  const r=fix(E,iss[0],{slots:[slot],t:2});assert.equal(r.why,null);assert.equal(only(check(r.E,{slots:[slot],t:2}),16).length,0);
  assert.ok(r.moved>0&&r.moved<=.6,'сдвиг '+r.moved);
});
test('правило 16: щель на крутой крыше — расширять нельзя, форма уйдёт (правило 11)', () => {
  const k=5,z=2.5,h=.5,V=[[-50,-50,z+k*49.5],[-h,-50,z],[-h,-10,z],[-h,10,z],[-h,50,z],[-50,50,z+k*49.5],[h,-50,z],[h,-10,z],[h,10,z],[h,50,z],[50,50,z+k*49.5],[50,-50,z+k*49.5]];
  const E={V,P:[[0,1,2,3,4,5],[6,11,10,9,8,7],[1,6,7,2],[3,8,9,4]],S:[]},slot=[2,3,8,7],o={slots:[slot],t:2};
  const iss=only(check(E,o),16);assert.equal(iss.length,1);
  const r=fix(E,iss[0],o);assert.ok(r.why&&/мм/.test(r.why),String(r.why));assert.strictEqual(r.E,E);
});
test('информационные строки и правила без починки — отказ', () => {
  const r=fix(box(),{rule:9,at:[0,0,0],faces:[],verts:[],val:0,text:'x',fix:false,info:false});assert.ok(r.why);
});
test('швы S: после addAllSeams деталей столько же, сколько граней', () => {
  const E=run('splitPoly')(box(),faceWhere(box(),TOP),true),S=run('addAllSeams')(E),parts=X=>{const M=run('polyBase')(X.V,X.P,X.S||[]);return run('buildParts')(M,1.5,1.5).parts.length;};
  assert.equal(parts(S),E.P.length);assert.ok(parts(E)<E.P.length);assert.equal(snap(E).includes('"S":[]'),true);
  assert.equal(run('addAllSeams')(S).S.length,S.S.length);
});
