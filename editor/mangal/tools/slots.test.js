// прорези под шампуры на боковинах жаровни: шаг 30 мм (вдвое реже — отменено Виталием 09.11), шампуры через одну и только в вырезанных прорезях, глубокие прорези на месте
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// вырезы по верхней кромке боковины: [левый край, правый край, глубина] в см, слева направо
const CUTS=`back=>{const s=grillWallShape(back),h=H1-t,p=s.pts,out=[];
  for(let i=0;i<p.length-3;i++)if(Math.abs(p[i].y-h)<1e-9&&p[i+1].y<h-1e-9&&Math.abs(p[i+1].x-p[i].x)<1e-9){   // спуск с кромки — начало выреза (контур идёт справа налево)
    let j=i+1;while(j<p.length&&!(Math.abs(p[j].y-h)<1e-9))j++;
    out.push([p[j].x,p[i].x,h-Math.min(...p.slice(i+1,j).map(q=>q.y))]);}
  return out.sort((a,b)=>a[0]-b[0]);}`;
const r1=x=>Math.round(x*10)/10;

test('прорези под шампуры: шаг 30, 26 на боковине', ()=>{
  const c=loadMangal({mode:'grill'});
  assert.equal(run(c,'SLOT'),3);
  assert.equal(run(c,'slots().length'),26);
  assert.deepEqual(run(c,'slots().slice(0,2).map(x=>Math.round(x*10))'),[25,55]);
});

test('шампуры через одну прорезь и только в вырезанных в обеих боковинах', ()=>{
  for(const mode of ['grill','both']){
    const c=loadMangal({mode,skew:true,skewD:false});
    // шампур — брусок 0,3 × 1,1 × (W+20): ловим его x из box()
    const xs=run(c,`(()=>{const xs=[],b0=box;box=(w,h,d,x,...r)=>{if(w===.3&&h===1.1)xs.push(x+w/2);return b0(w,h,d,x,...r);};build3D();box=b0;return xs;})()`).map(r1);
    const cut=back=>run(c,`(${CUTS})(${back})`).filter(([a,b,d])=>r1(d)===r1(run(c,'SLOT_D'))&&r1(b-a)===r1(run(c,'SLOT_W'))).map(([a,b])=>r1((a+b)/2));
    const front=cut(false),back=cut(true);
    assert.deepEqual(xs,[14.5,20.5,32.5,38.5,44.5],mode+': шампуры');   // 26,5 — над вырезом под ручку в задней, 50,5 — в прорези под перегородку
    xs.forEach(x=>{assert.ok(front.includes(x),mode+': нет прорези в передней на '+x);assert.ok(back.includes(x),mode+': нет прорези в задней на '+x);});
  }
});

test('глубокие прорези 100, 150, 200, 250 мм от правого торца не изменились', ()=>{
  const c=loadMangal({mode:'grill',deep:true});
  assert.deepEqual(run(c,'DEEP_X.map(x=>Math.round((L1-x)*10))'),[250,200,150,100]);
  assert.deepEqual(run(c,'[DEEP_W,DEEP_D,DEEP_SW,DEEP_SD].map(v=>Math.round(v*10))'),[15,60,3,5]);
  for(const back of [false,true]){
    const cuts=run(c,`(${CUTS})(${back})`);
    // глубокая прорезь: 15 мм шириной, глубина 60 + 5 мм прорези в дне
    const deep=cuts.filter(([a,b,d])=>r1(d)===6.5).map(([a,b])=>[r1((a+b)/2),r1(b-a)]);
    assert.deepEqual(deep,[[55,1.5],[60,1.5],[65,1.5],[70,1.5]],(back?'задняя':'передняя')+': глубокие прорези');
    // ни один вырез не налезает на соседний, перемычка не тоньше 4 мм (тоньше всего — у выреза под ручку в задней)
    for(let i=1;i<cuts.length;i++)assert.ok(cuts[i][0]-cuts[i-1][1]>=.4-1e-9,(back?'задняя':'передняя')+': перемычка '+r1((cuts[i][0]-cuts[i-1][1])*10)+' мм у '+r1(cuts[i][0]*10));
  }
});
