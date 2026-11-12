// эталон (studio/js/ref.js, studio/lib/refbuild.js): похожесть, зеркало, линии текстуры, «эталона нет»: node --test studio/tests/ref.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs');
const {run,box,faceWhere,edgePoint,vi,makePNG,writeOBJ}=require('./helpers.js');
const {buildRef}=require('../lib/refbuild.js');
const check=(E,o={})=>run('checkFigure')(E,Object.assign({scale:1,kind:'stand',skip:[12]},o));
const only=(iss,n)=>iss.filter(i=>i.rule===n&&!i.info);

// икосаэдр радиуса R; sub — сколько раз делить каждый треугольник на четыре (точки — на сферу)
function icosphere(R,sub){const t=(1+Math.sqrt(5))/2,nr=p=>{const l=Math.hypot(...p);return p.map(x=>x*R/l);};
  const V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(nr);
  let F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for(let s=0;s<sub;s++){const M=new Map(),mid=(a,b)=>{const k=a<b?a+'_'+b:b+'_'+a;if(!M.has(k)){M.set(k,V.length);V.push(nr(V[a].map((x,i)=>(x+V[b][i])/2)));}return M.get(k);};
    F=F.flatMap(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]];});}
  return {V,F};}

test('сфера: икосаэдр в сфере R 100 — отклонение грани равно стрелке сегмента', () => {
  const S=icosphere(100,5),I=icosphere(100,0),E={V:I.V,P:I.F,S:[]},R=run('refIndex')({V:S.V,F:S.F});
  const sag=100-Math.hypot(...[0,1,2].map(k=>(I.V[I.F[0][0]][k]+I.V[I.F[0][1]][k]+I.V[I.F[0][2]][k])/3));   // 20,53 мм
  const D=run('faceDev')(E,R,1);
  assert.equal(D.length,20);
  D.forEach((d,i)=>assert.ok(Math.abs(d-sag)<.05,`грань ${i}: ${d} при стрелке ${sag}`));
  assert.ok(run('refDist')(R,[0,0,100])<.05&&Math.abs(run('refDist')(R,[0,0,130])-30)<.05);
  // масштаб: мм сайта = мм модели × scale
  assert.ok(Math.abs(run('faceDev')(E,R,2)[0]-2*sag)<.1);
});

// куб 300 × 600 × 260 (рамка эталона — сама собой: высота 600, x по центру, y и z от 0): перед — сетка через 25 мм, справа (x = 75) — бугор 10 мм
function bumpBox(){const V=[],F=[],x=150,H=600,D=260,at=p=>V.push(p)-1;
  const q=(a,b,c,d)=>F.push([a,b,c],[a,c,d]);
  const c=[[-x,0,0],[x,0,0],[x,H,0],[-x,H,0],[-x,0,D],[x,0,D],[x,H,D],[-x,H,D]].map(at);
  q(c[0],c[3],c[2],c[1]);q(c[0],c[1],c[5],c[4]);q(c[3],c[7],c[6],c[2]);q(c[0],c[4],c[7],c[3]);q(c[1],c[2],c[6],c[5]);
  const G=[];for(let j=0;j<=24;j++){G.push([]);for(let i=0;i<=12;i++){const px=-x+i*25,py=j*25;G[j].push(at([px,py,px===75&&py===300?D+10:D]));}}
  for(let j=0;j<24;j++)for(let i=0;i<12;i++)q(G[j][i],G[j][i+1],G[j+1][i+1],G[j+1][i]);
  return {V,F};}
test('зеркало: бугор справа, эталон по левой половине — бугра нет, расстояние симметрично по x', () => {
  const B=bumpBox(),f=writeOBJ('bump.obj',B.V,B.F,null);
  const L=run('refIndex')(buildRef(f,null,{half:'left',frame:'meshy'})),Rt=run('refIndex')(buildRef(f,null,{half:'right',frame:'meshy'})),d=p=>run('refDist')(L,p);
  assert.ok(Math.abs(d([75,300,270])-10)<1e-6,'вершина бугра — в 10 мм от эталона: '+d([75,300,270]));
  assert.ok(Math.abs(d([-75,300,270])-10)<1e-6);
  assert.ok(run('refDist')(Rt,[75,300,270])<1e-6&&run('refDist')(Rt,[-75,300,270])<1e-6,'правая половина — бугор с обеих сторон');
  for(let k=0;k<200;k++){const p=[Math.sin(k*1.7)*170,300+Math.cos(k*.9)*320,130+Math.sin(k*2.3)*150];assert.ok(Math.abs(d(p)-d([-p[0],p[1],p[2]]))<1e-9,'точка '+p);}
});

// куб 300 × 600 × 260 с текстурой: верх — вся картинка (u — по x, v — по z), светлая полоса поперёк верха на z = 130; остальные грани — фон
function stripeRef(){const x=150,H=600,D=260,V=[[-x,0,0],[x,0,0],[x,H,0],[-x,H,0],[-x,0,D],[x,0,D],[x,H,D],[-x,H,D]],F=[],UV=[];
  const bg=[.005,.995],uvTop=v=>[(V[v][0]+x)/300,1-V[v][2]/D];
  const q=(a,b,c,d,top)=>[[a,b,c],[a,c,d]].forEach(t=>{F.push(t);UV.push(t.map(v=>top?uvTop(v):bg));});
  q(0,3,2,1);q(4,5,6,7);q(0,1,5,4);q(3,7,6,2,true);q(0,4,7,3);q(1,2,6,5);
  const obj=writeOBJ('stripe.obj',V,F,UV),png=obj.replace(/\.obj$/,'.png');
  fs.writeFileSync(png,makePNG(300,260,(px,py)=>py>=128&&py<132?[230,230,230]:[100,100,100]));
  return run('refIndex')(buildRef(obj,png,{half:'left',frame:'meshy'}));}
// верх куба 300 × 600 × 260 разрезан поперёк на z = c: шов без излома
function cutTop(c){const E=box(300,600,260),top=faceWhere(E,p=>p[1]===600);
  const a=edgePoint(E,vi(E,[-150,600,0]),vi(E,[-150,600,260]),[-150,600,c]),b=edgePoint(E,vi(E,[150,600,0]),vi(E,[150,600,260]),[150,600,c]);
  return run('cutPoly')(E,top,a,b,false);}
test('линии: шов по светлой полосе текстуры не лишний, шов в 60 мм от неё — лишний', () => {
  const R=stripeRef();
  assert.ok(R.T&&R.T.seams>0,'на кальке есть точки линии');
  assert.equal(only(check(cutTop(130),{ref:R}),7).length,0,'шов по полосе');
  const r7=only(check(cutTop(70),{ref:R}),7);
  assert.equal(r7.length,1,'шов в 60 мм');assert.match(r7[0].text,/лишний шов/);
  assert.equal(only(check(cutTop(130)),7).length,1,'без эталона шов по полосе — лишний');
});

test('излом на эталоне: шов без излома там, где у эталона ребро, — не лишний', () => {
  // эталон — двускатная крыша: верх куба поднят к коньку на z = 130 на 30 мм (излом ≈ 26°); фигура — плоский верх, разрезанный по коньку
  const x=150,D=260,V=[[-x,0,0],[x,0,0],[x,600,0],[-x,600,0],[-x,0,D],[x,0,D],[x,600,D],[-x,600,D],[-x,630,130],[x,630,130]];
  const F=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,8,9],[3,9,2],[8,7,6],[8,6,9],[0,4,7],[0,7,8],[0,8,3],[1,2,9],[1,9,6],[1,6,5]];
  const R=run('refIndex')({V,F});
  assert.equal(only(check(cutTop(130),{ref:R}),7).length,0,'по коньку');
  assert.equal(only(check(cutTop(40),{ref:R}),7).length,1,'в 90 мм от конька');
});

test('без эталона: фигура сдвинута на 3 мм от открытой — строки правила 11 и строка-сведение', () => {
  const base=box(),E=box();E.V=E.V.map(p=>[p[0],p[1],p[2]+3]);
  const iss=check(E,{base}),r11=only(iss,11),info=iss.filter(i=>i.info&&i.rule===11);
  assert.ok(r11.length>0);assert.ok(r11.every(i=>i.val>2.9&&i.val<3.1&&/ушла от эталона на 3 мм/.test(i.text)),r11.map(i=>i.text).join('; '));
  assert.equal(info.length,1);assert.equal(info[0].text,'Эталона нет: похожесть меряю от открытой фигуры');
  assert.deepEqual(check(box(),{base:box()}).map(i=>i.text),['Эталона нет: похожесть меряю от открытой фигуры']);
  assert.deepEqual(check(box()),[],'ни эталона, ни открытой фигуры — правила 11 нет');
  assert.deepEqual({...run('ruleCounts')(iss)},{11:r11.length});
});

test('путь к эталону рыси переопределяется STUDIO_LYNX_REF', () => {
  const key=require.resolve('../lib/sources.js'),old=process.env.STUDIO_LYNX_REF;
  try{delete require.cache[key];process.env.STUDIO_LYNX_REF='D:/x/lynx.obj';assert.equal(require('../lib/sources.js').LYNX_REF,'D:/x/lynx.obj');
    delete require.cache[key];delete process.env.STUDIO_LYNX_REF;assert.equal(require('../lib/sources.js').LYNX_REF,'C:/dev/metal-designer/art/private/src5/lynx.obj');}
  finally{delete require.cache[key];if(old===undefined)delete process.env.STUDIO_LYNX_REF;else process.env.STUDIO_LYNX_REF=old;}
});

const {LYNX_REF}=require('../lib/sources.js'),LYNX_PNG=LYNX_REF.replace(/\.obj$/i,'.png');
test('рысь 14 против src5: медиана точек ≤ 0,06 мм, граней левой половины дальше 2 мм — 28 ± 3 из 558',
  {skip:fs.existsSync(LYNX_REF)?false:'нет эталона '+LYNX_REF+' (STUDIO_LYNX_REF)'}, () => {
  const ref=buildRef(LYNX_REF,fs.existsSync(LYNX_PNG)?LYNX_PNG:null,{half:'left',frame:'lynx14'}),R=run('refIndex')(ref);
  const E=run("modelPoly('lynx14')"),sc=1000/run('meshBox')(E.V).size[1];
  const pts=E.V.filter(p=>p[0]<=0).map(p=>run('refDist')(R,p)*sc).sort((a,b)=>a-b),med=pts[pts.length>>1];
  assert.ok(med<=.06,'медиана '+med);
  // левая половина — из каждой зеркальной пары левая грань, плюс грани поперёк середины: 557 (в замере спеки 558, одна пара несимметрична)
  const D=run('faceDev')(E,R,sc),left=run('refHalf')(E,'left');
  assert.ok(Math.abs(left.length-558)<=1,'граней в левой половине: '+left.length);
  const far=left.filter(i=>D[i]>2).length;
  assert.ok(Math.abs(far-28)<=3,'граней дальше 2 мм: '+far);
  const r11=only(check(E,{scale:sc,ref:R}),11);
  assert.equal(r11.length,E.P.map((_,i)=>i).filter(i=>D[i]>2).length,'строки правила 11 — грани с отклонением больше 2 мм');
  assert.ok(ref.trace&&R.T.seams>0,'калька с линиями');
});
