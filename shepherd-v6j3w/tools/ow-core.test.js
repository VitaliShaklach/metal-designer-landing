// режим «оригинал для обводки» (#175, план docs/superpowers/plans/2026-11-25-shepherd7-workshop.md): node --test shepherd-v6j3w/tools/ow-core.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,Math,Float32Array,Uint32Array,Int32Array};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/../js/ow-core.js','utf8'),c);
const run=s=>vm.runInContext(s,c);

// перебор всех треугольников — эталон для луча по сетке (двусторонний, ближайший при t > 0)
function brute(V,F,o,d){let best=null;for(let t=0;t<F.length;t+=3){const a=F[t]*3,b=F[t+1]*3,q=F[t+2]*3,
    e1=[V[b]-V[a],V[b+1]-V[a+1],V[b+2]-V[a+2]],e2=[V[q]-V[a],V[q+1]-V[a+1],V[q+2]-V[a+2]],
    p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)continue;
    const s=[o[0]-V[a],o[1]-V[a+1],o[2]-V[a+2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])/det;if(u<0||u>1)continue;
    const qq=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*qq[0]+d[1]*qq[1]+d[2]*qq[2])/det;if(v<0||u+v>1)continue;
    const tt=(e2[0]*qq[0]+e2[1]*qq[1]+e2[2]*qq[2])/det;if(tt>1e-9&&(!best||tt<best.t))best={t:tt,tri:t/3};}return best;}

test('owRay: две параллельные плиты — сверху попадает в верхнюю, снизу — в нижнюю, мимо — null',()=>{
  c.V=new Float32Array([0,0,0, 100,0,0, 0,100,0,  0,0,50, 100,0,50, 0,100,50]);c.F=new Uint32Array([0,1,2,3,4,5]);run('G=owGrid(V,F)');
  const top=run('owRay(G,[20,20,100],[0,0,-1])'),bot=run('owRay(G,[20,20,-100],[0,0,1])');
  assert.strictEqual(top.tri,1);assert.ok(Math.abs(top.t-50)<1e-6);assert.strictEqual(bot.tri,0);assert.ok(Math.abs(bot.t-100)<1e-6);
  assert.strictEqual(run('owRay(G,[90,90,100],[0,0,-1])'),null,'за гипотенузой — мимо');assert.strictEqual(run('owRay(G,[20,20,100],[0,0,1])'),null,'смотрит от плит — мимо');});

test('owRay совпадает с перебором всех треугольников: 3000 случайных треугольников, 300 лучей (снаружи и изнутри габарита)',()=>{
  let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,N=3000,V=new Float32Array(N*9),F=new Uint32Array(N*3);
  for(let i=0;i<N;i++){const cx=rnd()*800-400,cy=rnd()*1000,cz=rnd()*600-300;for(let k=0;k<3;k++){V[i*9+k*3]=cx+rnd()*40-20;V[i*9+k*3+1]=cy+rnd()*40-20;V[i*9+k*3+2]=cz+rnd()*40-20;F[i*3+k]=i*3+k;}}
  c.V=V;c.F=F;run('G=owGrid(V,F)');let hits=0;
  for(let r=0;r<300;r++){const inside=r%3===0,o=inside?[rnd()*600-300,rnd()*800+100,rnd()*400-200]:[rnd()*3000-1500,rnd()*3000-1000,2000+rnd()*500],
      tg=[rnd()*800-400,rnd()*1000,rnd()*600-300],d0=[tg[0]-o[0],tg[1]-o[1],tg[2]-o[2]],l=Math.hypot(...d0),d=d0.map(x=>x/l);
    c.o=o;c.d=d;const g=run('owRay(G,o,d)'),b=brute(V,F,o,d);
    if(!b){assert.strictEqual(g,null,'луч '+r);continue;}hits++;assert.ok(g,'луч '+r+': перебор попал, сетка — нет');assert.ok(Math.abs(g.t-b.t)<1e-3,`луч ${r}: t ${g.t} ≠ ${b.t}`);}
  assert.ok(hits>100,'попаданий достаточно для проверки: '+hits);});
