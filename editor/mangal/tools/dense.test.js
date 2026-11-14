// «С листа» плотнее (#105, задача 23, пересмотр 14.11 (3), блок Д): занятая длина листа не больше эталона, листов не больше, хотя бы на одном задании меньше;
// контракт раскладки при этом тот же: зазор, отступ от края, DXF равен рисунку, «Угол листа» прижимает к своему углу
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// ЭТАЛОН: снят до правки раскладки — на ae4cf95 (после задач 19–22, нынешний nestGen: один порядок «по большей стороне рамки», одно правило места),
// зазор 5, подрезка 10. Сумма занятой длины листов (мм) по всем толщинам и число листов по всем толщинам.
// Не подгонять под результат: поменялись состав деталей или лист — эталон снимают заново до правки раскладки, отдельным шагом.
const DENSE_BEFORE={
  'grill 1500x3000':{len:855,sheets:1},'grill 1250x2500':{len:1010,sheets:1},'grill 1000x2000':{len:1315,sheets:1},
  'grill+cgr 1500x3000':{len:1087,sheets:1},'grill+cgr 1250x2500':{len:1287,sheets:1},'grill+cgr 1000x2000':{len:1572,sheets:1},
  'stove 1500x3000':{len:1895,sheets:3},'stove 1250x2500':{len:2045,sheets:3},'stove 1000x2000':{len:2765,sheets:3},
  'both+cgr 1500x3000':{len:2812,sheets:3},'both+cgr 1250x2500':{len:3227,sheets:3},'both+cgr 1000x2000':{len:4089,sheets:4}};
// задание: мангал по умолчанию; мангал с «Колосник на листе»; печь; «оба» с колосником
const JOBS=[['grill',false,'grill'],['grill',true,'grill+cgr'],['stove',false,'stove'],['both',true,'both+cgr']];
const SHEETS=['1500x3000','1250x2500','1000x2000'];

const LAY=(sk,cgr,corner)=>`(()=>{const [W,H]=NEST_SHEETS['${sk}'],N=nestJob({cgr:${cgr},W,H,sk:'${sk}',gap:5,corner:'${corner||'lb'}'});
  return {W,H,gap:N.gap,groups:N.groups.map(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
    const R=nestCorner(v.value,N.W,N.H,N.corner);return {mm:G.mm,n:G.items.length,too:R.too.length,sheets:R.sheets.map(s=>({len:s.len,items:s.items.map(o=>({no:o.no,pts:o.pts,bb:o.bb})),dxf:nestDxf(N,G,s)}))};})};})()`;
const totals=L=>({len:L.groups.reduce((a,g)=>a+g.sheets.reduce((b,s)=>b+s.len,0),0),sheets:L.groups.reduce((a,g)=>a+g.sheets.length,0)});
const cache=new Map();
function lay(mode,cgr,sk,corner){const k=[mode,cgr,sk,corner].join();if(!cache.has(k))cache.set(k,run(loadMangal({mode}),LAY(sk,cgr,corner)));return cache.get(k);}

test('плотность: на каждом задании длина и число листов не больше эталона, на одном длина строго меньше', ()=>{
  let less=[];
  for(const [mode,cgr,name] of JOBS)for(const sk of SHEETS){
    const L=lay(mode,cgr,sk),t=totals(L),b=DENSE_BEFORE[name+' '+sk];
    assert.ok(L.groups.every(g=>g.too===0),name+' '+sk+': не поместилось');
    assert.ok(t.len<=b.len+1e-6,`${name} ${sk}: длина ${t.len} > эталона ${b.len}`);
    assert.ok(t.sheets<=b.sheets,`${name} ${sk}: листов ${t.sheets} > эталона ${b.sheets}`);
    if(t.len<b.len-1e-6)less.push(`${name} ${sk}: ${b.len} → ${t.len}`);}
  assert.ok(less.length>0,'ни на одном задании длина не стала меньше эталона');
  console.log('короче эталона:\n  '+less.join('\n  '));
});

// отрезки слоя CUT из текста DXF: после LINE значения идут по месту (слой, 10 x1, 20 y1, 30, 11 x2, 21 y2), а не по поиску кода — иначе координата «20» принимается за код
const cutLines=t=>{const a=t.split(String.fromCharCode(13,10)),out=[];for(let i=0;i<a.length;i++)if(a[i]==='LINE'&&a[i+2]==='CUT')out.push([4,6,10,12].map(k=>Number(a[i+k])));return out;};

test('контракт: зазор, отступ от края 10 мм, DXF равен рисунку — на всех заданиях и листах', ()=>{
  for(const [mode,cgr,name] of JOBS)for(const sk of SHEETS){
    const L=lay(mode,cgr,sk),m=10,gap=L.gap,cx=loadMangal({mode});
    L.groups.forEach(g=>g.sheets.forEach(s=>{
      s.items.forEach(o=>o.pts.forEach(([x,y])=>assert.ok(x>=m-1e-6&&y>=m-1e-6&&x<=L.W-m+1e-6&&y<=L.H-m+1e-6,`${name} ${sk}: деталь ${o.no} ближе края`)));
      const A=s.items;
      for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const a=A[i].bb,b=A[j].bb;
        if(a[0]>b[2]+gap+1||b[0]>a[2]+gap+1||a[1]>b[3]+gap+1||b[1]>a[3]+gap+1)continue;   // рамки дальше зазора — контуры тем более
        const d=run(cx,`polyGap(${JSON.stringify(A[i].pts)},${JSON.stringify(A[j].pts)})`);assert.ok(d>=gap-0.01,`${name} ${sk}: зазор ${A[i].no}–${A[j].no} ${d}`);}
      const Lc=cutLines(s.dxf),near=(p,x,y)=>Math.abs(p[0]-x)<=0.01&&Math.abs(p[1]-y)<=0.01;
      for(const it of A)for(let i=0;i<it.pts.length;i++){const a=it.pts[i],b=it.pts[(i+1)%it.pts.length];
        assert.ok(Lc.some(l=>near(a,l[0],l[1])&&near(b,l[2],l[3])||near(b,l[0],l[1])&&near(a,l[2],l[3])),`${name} ${sk}: деталь ${it.no} не в DXF`);}}));}
});

test('«Угол листа» работает поверх: в каждом из четырёх углов раскладка прижата к своему углу, длина занятой полосы та же', ()=>{
  const sk='1250x2500',base=lay('grill',false,sk,'lb'),[bt]=[totals(base)];
  for(const corner of ['lb','lt','rb','rt']){
    const L=lay('grill',false,sk,corner),t=totals(L);
    assert.ok(Math.abs(t.len-bt.len)<1e-6,corner+': длина полосы поменялась');
    L.groups.forEach(g=>g.sheets.forEach(s=>{const xs=s.items.flatMap(o=>[o.bb[0],o.bb[2]]),ys=s.items.flatMap(o=>[o.bb[1],o.bb[3]]);
      const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      if(corner[0]==='l')assert.ok(x0<=10+1e-6,corner+': слева '+x0);else assert.ok(L.W-x1<=10+1e-6,corner+': справа '+(L.W-x1));
      if(corner[1]==='b')assert.ok(y0<=10+1e-6,corner+': снизу '+y0);else assert.ok(L.H-y1<=10+1e-6,corner+': сверху '+(L.H-y1));}));}
});
