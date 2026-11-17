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
// решёток (в жаровне и сверху) нет: только показ на 3D, их не делаем и не покупаем (#117)
const IDS=['gBot','side0','side1','gEnd','gEnd0','gAng','cgrAng','legs','pads','hook','air','handle','cgr','div'];

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

test('lay и in: колосник и перегородка не варятся',()=>{
  const c=open(),d=Object.fromEntries(data(c).map(u=>[u.id,u]));
  for(const id of ['cgr','div']){
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
  // #117: колосник мангала — перфолист с металлобазы: карта есть (виды, сборка), но без развёртки и DXF — как у проката (ручка, уголки):
  // под «Как режут» только таблица строк раскроя
  assert.ok(L.cgr,'нет карты «Колосник»');
  assert.ok(!L.cgr.includes('.dxf')&&!/лист \d+ мм · .*пунктир — гиб/.test(L.cgr),'у колосника мангала развёртка или DXF');
  assert.ok(L.cgr.includes('Колосник 1 и Колосник 2 — перфолист'));
  assert.equal(data(c).find(u=>u.id==='cgr').laser,null);
});

test('noWebGL: без 3D вместо видов надпись, а заготовка, швы и сборка на месте',()=>{
  const c=open(),s=text(cards(c).find(x=>x.id==='side0').svg);
  assert.ok(s.includes('Виды недоступны без 3D'));
  assert.ok(s.includes('Как режут')&&s.includes('Сварка — к чему варить'));
  assert.ok(/Сборка: шаг 1 из \d — Дно и боковины/.test(s));
});

// детали печи по порядку сборки (колёса на ножках — площадки под колёса)
const STOVE=['sK0','sK1','sBot','wall','tie','chim','chimX','damper','fb','lintel','angles','guides','door','grate','shib','legs','pads'];
const BOTH=IDS.filter(i=>i!=='gEnd0').concat(STOVE.filter(i=>!['legs','pads'].includes(i)));

test('печь и «оба» (#69): карта на каждую деталь, карт печи «пока не готовы» нет; в мангале — как было',()=>{
  assert.deepEqual(data(open({mode:'stove'})).map(u=>u.id).sort(),[...STOVE].sort());
  assert.deepEqual(data(open({mode:'both'})).map(u=>u.id).sort(),[...BOTH].sort());
  for(const mode of ['grill','stove','both']){
    const c=open({mode}),D=data(c);
    assert.equal(run(c,'typeof cardsReady'),'undefined','карты печи готовы: проверки готовности нет');
    // карты идут по порядку сборки, номера — подряд
    assert.ok(D.every((u,i)=>u.step>=0&&(!i||u.step>=D[i-1].step)),mode+': шаги по возрастанию: '+D.map(u=>u.step));
    assert.deepEqual(D.map(u=>u.no),D.map((u,i)=>i+1));
    for(const s of cards(c))assert.ok(!text(s.svg).includes('пока не готов'),mode+' '+s.id);
  }
  // шаги печи: тело, труба и отсекатель, глухой верх с уголками, дверца, колосник и шибер
  const d=Object.fromEntries(data(open({mode:'stove'})).map(u=>[u.id,u]));
  assert.ok(d.sBot.step<d.chim.step&&d.chim.step<d.lintel.step&&d.lintel.step<d.door.step&&d.door.step<d.grate.step);
});

test('логотип в глухом верхе: карта верха топки — в шаге печи, а не в «Торцах»',()=>{
  for(const mode of ['stove','both']){
    const d=Object.fromEntries(data(open({mode,logo:true})).map(u=>[u.id,u]));
    assert.ok(d.lintel.step>d.sBot.step&&d.lintel.step===d.tie.step,mode);
  }
});

test('печь и «оба»: каждая строка «Раскрой и масса» — на карте, лишних карт нет, масса карт = итогу таблицы',()=>{
  for(const flags of [{mode:'stove'},{mode:'both'},{mode:'stove',grType:'rod'},{mode:'stove',obe:true},{mode:'stove',wheels:false},{mode:'stove',draft:false,door:false},{mode:'both',logo:true}]){
    const c=open(flags),rows=run(c,'massRows().rows.map(r=>r.n)'),used=data(c).flatMap(u=>u.rows);
    for(const n of rows)assert.ok(used.includes(n),JSON.stringify(flags)+': строка без карты: '+n);
    for(const n of used)assert.ok(rows.includes(n),JSON.stringify(flags)+': карта на строку, которой нет в таблице: '+n);
    const dup=used.filter((n,i)=>used.indexOf(n)!==i);
    assert.deepEqual([...new Set(dup)].filter(n=>!/^Боковина (жаровни|печи)/.test(n)),[],'строка на двух картах');
    const tot=run(c,'massRows().tot'),sum=data(c).reduce((a,u)=>a+u.kg*u.q,0);
    assert.ok(Math.abs(sum-tot)<1e-6,`${JSON.stringify(flags)}: карты ${sum} кг, таблица ${tot} кг`);
  }
});

test('печь: швы — у каждой детали с соседом по сварке они есть; дверца, колосник, шибер, труба',()=>{
  const c=open({mode:'stove'}),d=Object.fromEntries(data(c).map(u=>[u.id,u]));
  for(const u of Object.values(d))for(const j of u.joins.filter(j=>j.kind==='weld'))
    assert.ok(j.other||j.seams.length>0&&j.seams.every(s=>s.len>=5),`${u.id} → ${j.to}: нет шва`);
  // дверца — петлями к задней боковине; колосник кладётся на уголки; шибер — на направляющие; заслонка — внутри трубы
  assert.ok(d.door.joins.some(j=>j.to==='sK0'&&j.kind==='hinge'&&j.mine),'дверца навешивается на заднюю боковину');
  assert.ok(d.grate.joins.some(j=>j.to==='angles'&&j.kind==='lay'&&j.mine));
  assert.ok(d.shib.joins.some(j=>j.to==='guides'&&j.kind==='lay'&&j.mine));
  assert.ok(d.damper.joins.some(j=>j.to==='chim'&&j.kind==='in'&&j.mine));
  assert.ok(seams(d.sBot,'sK0').length&&seams(d.sBot,'sK1').length&&seams(d.sBot,'wall').length,'дно — к боковинам и перегородке');
  assert.deepEqual(seams(d.sBot,'legs'),Array(4).fill({kind:'contour',len:320}));
  assert.ok(seams(d.chim,'sK0').length,'труба вварена в боковину');
  assert.ok(seams(d.fb,'sK0').length,'отсекатель — к задней боковине');
  // на картах: строки швов и «не варить»
  const L=Object.fromEntries(cards(c).map(s=>[s.id,text(s.svg)]));
  assert.ok(/навешивается на № \d+ Боковина печи задняя/.test(L.door)&&L.door.includes('дверца должна свободно открываться')&&!/· шов/.test(L.door),L.door);
  assert.ok(/кладётся на № \d+ Уголок колосника/.test(L.grate)&&L.grate.includes('не варить'));
  assert.ok(L.shib.includes('край у торца отогнуть вниз на 25 мм'),'гиб шибера — в указаниях');
});

test('печь: развёртки — файл DXF, лист, рез; у проката нет; колосник 15 мм',()=>{
  const c=open({mode:'stove'}),L=Object.fromEntries(cards(c).map(s=>[s.id,text(s.svg)]));
  assert.ok(L.door.includes('stove_door_3mm_x1.dxf')&&L.door.includes('лист 3 мм'));
  assert.ok(L.grate.includes('stove_grate_15mm_x1.dxf')&&L.grate.includes('лист 15 мм'));
  assert.ok(L.shib.includes('stove_shiber_3mm_x1.dxf'));
  assert.ok(!L.chim.includes('.dxf')&&!L.angles.includes('.dxf')&&!L.guides.includes('.dxf'));
  assert.ok(L.door.includes('Ручка дверцы, пруток Ø12')&&L.door.includes('Проушина под крючок'),'строки дверцы на карте');
  assert.ok(L.guides.includes('Направляющая шибера — проставка')&&L.guides.includes('Направляющая шибера — полоса 20 × 3'));
});

test('«оба»: перегородка = торец жаровни, ножки двух высот на одной карте, жаровня варится к перегородке',()=>{
  const c=open({mode:'both'}),d=Object.fromEntries(data(c).map(u=>[u.id,u])),L=Object.fromEntries(cards(c).map(s=>[s.id,text(s.svg)]));
  assert.equal(d.legs.q,4);
  assert.ok(d.legs.rows.includes('Ножка жаровни, труба Ø40×3')&&d.legs.rows.includes('Ножка печи, труба Ø40×3'));
  assert.ok(L.legs.includes('2 из 4'),'ножки двух высот — «2 из 4», а не 0,5');
  assert.ok(L.wall.includes('Перегородка (задняя стенка печи) = левый торец жаровни'));
  assert.ok(seams(d.gBot,'wall').length&&seams(d.wall,'sBot').length);
  assert.ok(seams(d.legs,'gBot').length&&seams(d.legs,'sBot').length);
});

test('ключ задания: размеры на модели его не меняют, детали меняют',()=>{
  const c=open(),k=()=>run(c,'cardsKey()'),k0=k();
  run(c,'S.dims.add("zzz")');
  assert.equal(k(),k0);
  run(c,'S.wheels=false');
  assert.notEqual(k(),k0);
});

// #102: карта колосника — строка пластин ручки; масса карты = строки таблицы
test('карта колосника: строки — перфолисты и пластины ручки; масса = сумма строк', ()=>{
  const c=open(),u=data(c).find(u=>u.id==='cgr'),rows=run(c,'massRows().rows');
  assert.ok(u.rows.some(n=>/^Пластины ручки колосника/.test(n)),'нет строки пластин');
  assert.ok(!u.rows.some(n=>/^Ручка колосника/.test(n)));
  const sum=u.rows.reduce((a,n)=>{const r=rows.find(r=>r.n===n);return a+r.m*r.q/u.q;},0);
  assert.ok(Math.abs(u.kg-sum)<1e-6,`карта ${u.kg}, строки ${sum}`);
});

// гравировка номера видна на карте, в блоке «Как режут» (#104)
test('карта боковины: штрихи гравировки в «Как режут»; галочка снята — штрихов нет',()=>{
  const c=open();
  const side=cards(c).find(x=>x.id==='side0');
  assert.match(side.svg,/class="engr"/);
  assert.match(side.svg,/\.engr\{/,'стиль штрихов в таблице стилей карты');
  const c2=open();
  run(c2,'__els.nEngrave={checked:false}');
  assert.ok(!/class="engr"/.test(cards(c2).find(x=>x.id==='side0').svg));
});

// разметка на дне (#123): на карте дна в «Как режут» — те же штрихи, что в DXF: номер, «низ» и квадраты под площадки ножек
test('карта дна жаровни: штрихи гравировки с квадратами под ножки — как ty.eng детали',()=>{
  for(const [mode,n] of [['grill',4],['both',2]]){
    const c=open({mode}),bot=cards(c).find(x=>x.id==='gBot');
    const d=[...bot.svg.matchAll(/<path class="engr" d="([^"]*)"/g)].map(m=>m[1]).join('');
    const eng=run(c,`nestJob().groups.flatMap(G=>G.types).find(t=>t.p.pt==='gBot').eng`);
    assert.equal((d.match(/M/g)||[]).length,eng.length,mode+': на карте все отрезки гравировки дна');
    assert.equal(eng.filter(z=>Math.abs(Math.hypot(z[2]-z[0],z[3]-z[1])-80)<.01).length,4*n,mode+': квадратов '+n);}
});
