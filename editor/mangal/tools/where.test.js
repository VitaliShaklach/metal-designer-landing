// «Где стоит» (#118): у каждой строки «Подготовить отдельно» и «Не рубится» на модели есть деталь — она и красится оранжевым
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

const open=flags=>{const c=loadMangal(flags,{real:true});page(c);return c;};
// по каждой строке обоих блоков: сколько верхних объектов модели подсвечено и сколько их всего в изделии
const info=c=>run(c,`(()=>{const N=nestJob(),offs=N.groups.flatMap(G=>offRows(N,G).map(o=>whereKeyOff(o.ty)));
  const keys=[...prepRows().map(whereKeyRow),...offs];
  const cm=openCardModel(WHERE_FLAGS);
  try{return {keys,offs,all:cm.g.children.filter(o=>!o.userData.dim).length,hl:keys.map(k=>[k,cm.run(g=>whereObjs(g,k)).length])};}
  finally{cm.close();}})()`);

const CASES=[
  {mode:'grill'},{mode:'stove'},{mode:'both'},
  {mode:'grill',rain:true},{mode:'both',rain:true,sheet:false},
  {mode:'grill',cgr:false},{mode:'both',grType:'plate'},{mode:'stove',grType:'bars'},{mode:'both',grType:'bars'},
  {mode:'stove',grate:false},{mode:'both',wheels:false},{mode:'grill',div:false},
];
for(const f of CASES){
  test('каждая строка обоих блоков находит деталь на модели, и это не всё изделие: '+JSON.stringify(f),()=>{
    const r=info(open(f));
    assert.ok(r.keys.length>=4,'строк '+r.keys.length);
    r.hl.forEach(([k,n])=>{assert.ok(n>0,'на модели нет детали: '+k);assert.ok(n<r.all,'подсвечено всё изделие: '+k);});
  });
}

test('крыша: передние и задние стойки — разные объекты, метка одна; профлист и трубки — свои',()=>{
  const c=open({mode:'grill',rain:true});
  const n=run(c,`(()=>{const cm=openCardModel(WHERE_FLAGS);try{
    const q=re=>cm.run(g=>whereObjs(g,whereKeyRow(prepRows().find(r=>re.test(r.n))))).length;
    return {front:q(/передние стойки/),back:q(/задние стойки/),tubes:q(/^Трубка/),sheet:q(/^Лист от дождя/)};}finally{cm.close();}})()`);
  assert.deepEqual(n,{front:2,back:2,tubes:8,sheet:1});   // у трубки два объекта: сама и донышко
});

test('крыша на модели есть и без галочки «Крыша от дождя»: строки блока — всегда',()=>{
  const c=open({mode:'grill',rain:false});
  assert.ok(info(c).hl.every(([,n])=>n>0));
});

test('«Не рубится»: есть что проверять в режимах с листом 15 мм и узкими деталями',()=>{
  const r=info(open({mode:'both',grType:'plate'}));
  assert.ok(r.offs.length>0,'«Не рубится» пусто — проверять нечего');
});

test('ножка: труба, патрубок и заглушка — разные детали, площадка и пятка не красятся с ними',()=>{
  const c=open({mode:'grill'});
  const r=run(c,`(()=>{const cm=openCardModel(WHERE_FLAGS);try{
    const q=re=>cm.run(g=>whereObjs(g,whereKeyRow(prepRows().find(r=>re.test(r.n))))).map(o=>[o.userData.leg||o.userData.part,o.geometry.type]);
    return {tube:q(/^Ножка /),sleeve:q(/^Патрубок/),plug:q(/^Заглушка/)};}finally{cm.close();}})()`);
  assert.equal(r.tube.length,4);
  assert.ok(r.tube.every(([p,t])=>p==='legs'&&t==='CylinderGeometry'),'ножка — только труба');
  assert.deepEqual(r.sleeve.map(x=>x[0]),Array(4).fill('sleeve'));
  assert.deepEqual(r.plug.map(x=>x[0]),Array(4).fill('plug'));
});
