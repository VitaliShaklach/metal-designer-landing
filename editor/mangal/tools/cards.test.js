// «Карты деталей» мангала (#68): карта А4 на каждую листовую деталь и каждый прокат из «Раскрой и масса» — рез, швы, гибка.
// Швы считаются по телам настоящей 3D-модели (three.js из vendor/), поэтому без WebGL (ok = false) они есть
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

const open=(flags={mode:'grill'})=>{const c=loadMangal(flags,{real:true});page(c);return c;};
const data=c=>run(c,'cardData()');
const cards=c=>run(c,'buildCards()');
const text=svg=>[...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join('\n');
const seams=(u,to)=>u.joins.find(j=>j.to===to).seams;
const kgTxt=v=>v.toFixed(2).replace('.',',');

// по порядку сборки; с колёсами на ножках — площадки под колёса
const IDS=['gBot','side0','side1','gEnd','gEnd0','gAng','cgrAng','legs','pads','hook','air','handle','cgr','gGrate','g2','div'];

test('count: карта на каждую деталь цеха, по порядку сборки; покупных нет',()=>{
  const c=open();
  assert.deepEqual(data(c).map(u=>u.id).sort(),[...IDS].sort());
  const st=data(c).map(u=>u.step);
  assert.ok(st.every((s,i)=>s>=0&&(!i||s>=st[i-1])),'шаги сборки по возрастанию: '+st.join(','));
  assert.deepEqual(cards(c).map(s=>s.id),data(c).map(u=>u.id));
  // без отмеченных стрелок «ножка откручивается» и колёс карт столько же: это пометки и покупное
  assert.equal(data(open({mode:'grill',legTw:false,wheels:false})).length,IDS.length);
});

test('cover: каждая строка «Раскрой и масса» — на карте, лишних карт нет',()=>{
  for(const flags of [{mode:'grill'},{mode:'grill',wheels:false},{mode:'grill',logo:true},{mode:'grill',cgr:false},{mode:'grill',div:false}]){
    const c=open(flags),rows=run(c,'massRows().rows.map(r=>r.n)'),used=data(c).flatMap(u=>u.rows);
    for(const n of rows)assert.ok(used.includes(n),JSON.stringify(flags)+': строка без карты: '+n);
    for(const n of used)assert.ok(rows.includes(n),JSON.stringify(flags)+': карта на строку, которой нет в таблице: '+n);
    // одна строка на двух картах — только боковины (в таблице они одной строкой)
    const dup=used.filter((n,i)=>used.indexOf(n)!==i);
    assert.deepEqual([...new Set(dup)].filter(n=>!/^Боковина жаровни/.test(n)),[],'строка на двух картах');
  }
});

test('mass: масса карт × количество = итог таблицы; масса карты = масса её строк',()=>{
  for(const flags of [{mode:'grill'},{mode:'grill',wheels:false},{mode:'grill',cgr:false}]){
    const c=open(flags),tot=run(c,'massRows().tot'),sum=data(c).reduce((a,u)=>a+u.kg*u.q,0);
    assert.ok(Math.abs(sum-tot)<1e-6,`${JSON.stringify(flags)}: карты ${sum} кг, таблица ${tot} кг`);
  }
  const c=open(),rows=run(c,'massRows().rows');
  const d=Object.fromEntries(data(c).map(u=>[u.id,u]));
  // деталь в строке одна: масса карты — масса штуки из таблицы
  const one=(id,re)=>{const r=rows.find(r=>re.test(r.n));assert.ok(Math.abs(d[id].kg-r.m)<1e-9,id);};
  one('gBot',/^Дно/);one('side0',/^Боковина/);one('side1',/^Боковина/);one('air',/^Задвижка/);one('div',/^Перегородка/);
  // ножка — сумма четырёх строк на одну штуку
  const leg=rows.filter(r=>/^(Ножка|Площадка под ножку|Патрубок|Заглушка)/.test(r.n)).reduce((a,r)=>a+r.m,0);
  assert.ok(Math.abs(d.legs.kg-leg)<1e-9);
  // и она же — на самой карте и в штампе
  const t=Object.fromEntries(cards(c).map(s=>[s.id,text(s.svg)]));
  assert.ok(t.gBot.includes('масса '+kgTxt(d.gBot.kg)+' кг/шт'));
  assert.ok(t.gBot.includes('≈ '+kgTxt(d.gBot.kg)+' кг'),'масса в штампе');
  assert.ok(t.legs.includes(kgTxt(d.legs.kg)));
});

test('stamp: каждая карта — А4 со штампом мангала, номер и число листов',()=>{
  const c=open(),L=cards(c);
  assert.equal(L.length,IDS.length);
  L.forEach((s,i)=>{
    assert.match(s.svg,/viewBox="0 0 210 297"/);assert.match(s.svg,/width="210mm" height="297mm"/);
    const t=text(s.svg);
    assert.ok(t.includes('Мангал 800 × 420 × 970, 5 мм'),s.title);
    assert.ok(t.includes(`${i+1}. ${s.title}`),'шапка: '+s.title);
    assert.ok(t.split('\n').includes(String(i+1))&&t.split('\n').includes(String(L.length)),'лист '+(i+1));
  });
});

test('welds: у каждой детали с соседом по сварке швы есть и с длиной',()=>{
  const c=open();
  for(const u of data(c))for(const j of u.joins.filter(j=>j.kind==='weld'))
    assert.ok(j.other||j.seams.length>0&&j.seams.every(s=>s.len>=5),`${u.id} → ${j.to}: нет шва`);
  const d=Object.fromEntries(data(c).map(u=>[u.id,u]));
  // дно варится к боковинам по длине, к площадкам ножек по контуру 80 × 80
  assert.deepEqual(seams(d.gBot,'side0'),[{kind:'line',len:800}]);
  assert.deepEqual(seams(d.gBot,'side1'),[{kind:'line',len:800}]);
  assert.deepEqual(seams(d.gBot,'legs'),Array(4).fill({kind:'contour',len:320}));
  // труба ножки к площадке колеса — по кругу Ø 40
  assert.deepEqual(seams(d.legs,'pads'),[{kind:'ring',len:126}]);
  // на карте — строка шва
  const s=text(cards(c).find(x=>x.id==='gBot').svg);
  assert.ok(s.includes('к № 2 Боковина жаровни задняя · шов 800 мм · угол 90°'),s);
  assert.ok(/к № \d+ Ножка · 4 шва по 320 мм по контуру/.test(s));
});

test('lay и in: колосник, решётки, перегородка не варятся',()=>{
  const c=open(),d=Object.fromEntries(data(c).map(u=>[u.id,u]));
  for(const id of ['cgr','gGrate','g2','div']){
    assert.ok(d[id].joins.length&&d[id].joins.every(j=>j.kind!=='weld'&&j.mine),id);
    const s=text(cards(c).find(x=>x.id===id).svg);
    assert.ok(/(кладётся на|вставляется в) № /.test(s)&&s.includes('не варить'),id);
    assert.ok(!/· шов \d/.test(s),id);
  }
  assert.ok(text(cards(c).find(x=>x.id==='cgrAng').svg).includes('сверху кладётся № '),'опора знает о колоснике');
});

test('mirror: опора колосника — к задней боковине, зеркальная — к передней',()=>{
  const c=open(),u=data(c).find(u=>u.id==='cgrAng');
  assert.equal(u.q,2);
  assert.ok(seams(u,'side0').length&&seams(u,'side1').length);
  assert.ok(text(cards(c).find(x=>x.id==='cgrAng').svg).includes('Передняя опора — зеркально'));
});

test('bends: гибы — у задвижки поддува (два отгиба 90°), у остальных нет',()=>{
  const c=open();
  for(const s of cards(c))assert.equal(s.svg.includes('Гибка — по порядку'),s.id==='air',s.title);
  const air=cards(c).find(x=>x.id==='air').svg;
  assert.ok(air.includes('1. 90°')&&air.includes('2. 90°')&&!air.includes('3. 90°'));
  assert.ok(air.includes('отгиб 30 мм'));
});

test('laser: у листовых деталей — файл DXF, лист, рез; у проката — нет',()=>{
  const c=open(),L=Object.fromEntries(cards(c).map(s=>[s.id,text(s.svg)]));
  assert.ok(L.gBot.includes('grill_bottom_5mm_x1.dxf')&&L.gBot.includes('лист 5 мм')&&L.gBot.includes('рез 2,44 м'));
  assert.ok(L.side0.includes('17 отв. Ø 15'));
  // перегородка: галочка снята, а строка в таблице есть — карта с развёрткой всё равно
  assert.ok(L.div.includes('grill_divider_5mm_x1.dxf')&&L.div.includes('Как режут'));
  assert.ok(!L.handle.includes('.dxf')&&!L.gAng.includes('.dxf'));
  assert.ok(L.handle.includes('Ручка — труба Ø25×2'));
});

test('noWebGL: без 3D вместо видов надпись, а заготовка, швы и сборка на месте',()=>{
  const c=open(),s=text(cards(c).find(x=>x.id==='side0').svg);
  assert.ok(s.includes('Виды недоступны без 3D'));
  assert.ok(s.includes('Как режут')&&s.includes('Сварка — к чему варить'));
  assert.ok(/Сборка: шаг 1 из \d — Дно и боковины/.test(s));
});

test('режимы печи и «оба»: карт нет (задача 13), в мангале — есть',()=>{
  for(const mode of ['stove','both'])assert.equal(run(open({mode}),'cardsReady()'),false,mode);
  assert.equal(run(open(),'cardsReady()'),true);
});

test('ключ задания: размеры на модели его не меняют, детали меняют',()=>{
  const c=open(),k=()=>run(c,'cardsKey()'),k0=k();
  run(c,'S.dims.add("zzz")');
  assert.equal(k(),k0);
  run(c,'S.wheels=false');
  assert.notEqual(k(),k0);
});
