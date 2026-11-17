// «Подготовить отдельно» (#107): металл без DXF под таблицами «С листа» и «Гильотина»; покупного нет, крыша — всегда
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

const MODES=[{mode:'grill'},{mode:'stove'},{mode:'both'}];
const nm=f=>JSON.stringify(f);
const names=c=>run(c,'prepRows().map(r=>r.n)');
const ROOF=[/^Трубка Ø26×3/,/^Арматура Ø16, передние стойки/,/^Арматура Ø16, задние стойки/,/^Лист от дождя — профлист/];

for(const f of MODES){
  test('в блоке ровно строки раскроя без лазерной детали, колёс и крепежа нет: '+nm(f),()=>{
    const c=loadMangal(f),R=run(c,'prepRows()'),mass=run(c,'massRows().rows.map(r=>r.n)');
    const laser=run(c,'laserParts().map(l=>l.pt)');
    assert.ok(R.length>=5,'строк '+R.length);
    R.forEach(r=>{assert.ok(r.q>0&&r.s,'пустая строка: '+r.n);
      assert.doesNotMatch(r.n,/^(колесо|болт|шайба|гайка|петля|плита)|покупн/i,'покупное: '+r.n);});
    // всё, что в блоке и в «Раскрое и массе», — одни и те же строки; чего в массе нет — только крыша
    R.forEach(r=>assert.ok(mass.includes(r.n)||ROOF.some(re=>re.test(r.n)),'не из раскроя: '+r.n));
    // листовые детали с DXF в блок не попадают
    const n=names(c).join('\n');
    for(const re of [/^Боковина/,/^Дно/,/^Торец/,/^Перегородка/,/^Задвижка поддува/,/^Скоба/,/^Площадка под/,/^Дверца/,/^Шибер/,/^Отсекатель/,/^Полоса у дверцы/,/^Глухой верх/,/^Колосник — лист/,/^Пластины ручки/])
      assert.doesNotMatch(n,new RegExp(re.source,'m'),'деталь с DXF в блоке: '+re);
    assert.equal(R.length,new Set(R.map(r=>r.n)).size,'дубли');
  });

  test('крыша — те же четыре строки с галочкой «Крыша от дождя» и без неё: '+nm(f),()=>{
    const a=names(loadMangal({...f,rain:true})),b=names(loadMangal({...f,rain:false}));
    for(const re of ROOF){assert.equal(a.filter(n=>re.test(n)).length,1,'с крышей '+re);assert.equal(b.filter(n=>re.test(n)).length,1,'без крыши '+re);}
    assert.deepEqual(a,b,'галочка меняет состав блока');
  });
}

test('мангал: уголки, трубы, ручка и ножки в блоке; печи и решёток в нём нет',()=>{
  const n=names(loadMangal({mode:'grill',grillGrate:true,grates2:true})).join('\n');
  for(const re of [/^Уголок 30×30×3 в жаровне/m,/^Ручка — труба/m,/^Ножка мангала/m])assert.match(n,re);
  assert.doesNotMatch(n,/профтруба|Шибер|Заслонка|Направляющая/);
  assert.doesNotMatch(n,/Решётка/,'решётки — только показ на 3D, их не делаем и не покупаем (#117)');
});
test('печь: профтрубы, заслонка, квадрат и полоса под шибер, уголок 40×40 в блоке; жаровни нет',()=>{
  const n=names(loadMangal({mode:'stove'})).join('\n');
  for(const re of [/^Труба — профтруба/m,/^Удлинитель трубы/m,/^Заслонка в трубе/m,/^Направляющая шибера — проставка/m,/^Направляющая шибера — полоса/m,/^Уголок 40×40×4/m])assert.match(n,re);
  assert.doesNotMatch(n,/Решётка|Уголок 30/);
});
test('печь с арматурой вместо плиты: арматура колосника в блоке, с плитой — нет (плита с DXF)',()=>{
  assert.match(names(loadMangal({mode:'stove',grType:'rebar'})).join('\n'),/^Арматура Ø20 — краевые прутки/m);
  assert.doesNotMatch(names(loadMangal({mode:'stove',grType:'plate'})).join('\n'),/Арматура Ø20|Колосник/);
});

test('колосник мангала (#117): строкой в блоке — перфолист 5–10 мм с металлобазы, без DXF; пластины ручки — лазер, в блок не идут',()=>{
  for(const mode of ['grill','both']){
    const c=loadMangal({mode,cgr:true});page(c);
    const R=run(c,'prepRows()'),g=R.filter(r=>/^Колосник 1 и Колосник 2/.test(r.n));
    assert.equal(g.length,1,mode+': строк колосника '+g.length);
    assert.equal(g[0].q,2);
    assert.match(g[0].note,/перфолист 5–10 мм, с металлобазы, подрезать в размер/);
    assert.ok(!R.some(r=>/^Пластины ручки/.test(r.n)),mode+': пластины ручки — лазер');
    const h=run(c,'prepHtml()');assert.doesNotMatch(h,/data-act|dxfbtn/);
  }
  assert.ok(!run(loadMangal({mode:'grill',cgr:false}),'prepRows()').some(r=>/Колосник 1/.test(r.n)),'без колосниковой решётки строки нет');
  assert.ok(!run(loadMangal({mode:'stove'}),'prepRows()').some(r=>/Колосник 1/.test(r.n)),'в печи колосника мангала нет');
});

test('блок: заголовок, подпись, колонки, строка про «Что купить», кнопок DXF нет; «С листа» и «Гильотина» показывают его под таблицами',()=>{
  const c=loadMangal({mode:'both',rain:false});page(c);
  const h=run(c,'prepHtml()');
  assert.match(h,/<h4>Подготовить отдельно<\/h4>/);
  assert.match(h,/Уголки, трубы, арматура, профлист: на схеме их нет, режутся и готовятся отдельно/);
  assert.match(h,/<th>Деталь<\/th><th>Эскиз<\/th><th class="r">Кол-во<\/th><th>Размер, мм<\/th><th>Как делать<\/th>/);   // #117: «Эскиз», номера и DXF нет
  assert.match(h,/Покупное \(колёса, крепёж\) — во вкладке «Что купить»/);
  assert.doesNotMatch(h,/data-act|dxfbtn|DXF/);
  assert.match(h,/class="ntbl ptbl"/);
  assert.match(h,/приварить снаружи в углах/,'«Как делать» — note строки раскроя');
  const both=run(c,`(N=>({l:nestHtml(N,N.groups.map(G=>({sheets:[],too:[]}))),g:gilHtml(N,N.groups.map(G=>({sheets:[],too:[]})))}))(nestJob())`);
  for(const k of ['l','g']){const s=both[k];assert.equal((s.match(/<h4>Подготовить отдельно<\/h4>/g)||[]).length,1,k);
    assert.ok(s.indexOf('Подготовить отдельно')>s.lastIndexOf('</table></div></section>',s.indexOf('Подготовить отдельно')-1),k);
    assert.ok(s.indexOf('Подготовить отдельно')>s.indexOf('<table class="ntbl'),k+': блок выше таблиц');}
});

test('ключ расчёта «С листа» и «Гильотины» меняется от состава блока (ножки выше — другой размер строки)',()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const k1=run(c,'prepKey()');
  const c2=loadMangal({mode:'both'});page(c2);
  assert.notEqual(k1,run(c2,'prepKey()'));
});

// #117: галочки «Решётка в жаровне», «2 решётки сверху», «Уголки в жаровне» — только показ на 3D: состав, раскрой и блок не меняются.
// Уголки в жаровне в комплекте всегда; решёток нет нигде, кроме модели (как шампуры)
test('галочки показа решёток и уголков в жаровне состав не меняют',()=>{
  // и тексты строк («Как делать», «Заметки»): проём у колосника сужен уголками всегда
  const sig=f=>{const c=loadMangal({mode:'grill',...f});return run(c,'({m:massRows().rows.map(r=>[r.n,r.q,r.s,r.note||"",r.asm||""]),p:prepRows().map(r=>r.n),l:laserParts().map(p=>p.file)})');};
  const on=sig({grillGrate:true,grates2:true,gAng:true});
  assert.deepEqual(sig({grillGrate:false,grates2:false,gAng:false}),on);
  assert.ok(on.p.some(n=>/^Уголок 30×30×3 в жаровне/.test(n)),'уголки в жаровне');
  assert.ok(!on.m.some(([n])=>/Решётка/.test(n)),'решёток нет в раскрое');
});
