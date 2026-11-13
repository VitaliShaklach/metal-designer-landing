// «Раскрой и масса» (#63): только металл, который делает цех; описание строки — одна короткая строка,
// сборочные подробности — в «Заметках»; итог таблицы = сумма строк = цифра в шапке
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// режимы и галочки, при которых меняется состав таблицы
const CASES=[{mode:'grill'},{mode:'stove'},{mode:'both'},
  {mode:'grill',rain:true,logo:true,cgr:false},{mode:'stove',rain:true,logo:true,obe:true,grType:'rebar'},{mode:'both',rain:true,obe:true}];
const name=f=>JSON.stringify(f);

// drawCut с поддельным document: что легло в таблицу #cut, шапку #stats и блок «Металл» #metal
const draw=c=>run(c,`(()=>{const D0=document,box={};document=new Proxy({},{get:(t,k)=>k==='getElementById'?(id=>box[id]=box[id]||{innerHTML:''}):D0[k]});
  try{drawCut();}finally{document=D0;}return {cut:box.cut.innerHTML,stats:box.stats.innerHTML,metal:box.metal.innerHTML};})()`);
const kg=s=>+s.replace(',','.');

for(const f of CASES){
  test('нет колёс, болтов, покупного без массы и плиты печи: '+name(f), ()=>{
    const c=loadMangal(f),R=run(c,'massRows()');
    assert.ok(R.rows.length>5,'строк '+R.rows.length);
    R.rows.forEach(r=>{
      assert.doesNotMatch(r.n,/^(колесо|болт|шайба|гайка|петля|плита)|покупн/i,'покупное: '+r.n);   // «Ножка с колесом», «Площадка под колесо» — металл, остаются
      assert.ok(r.m>0,'без массы: '+r.n);
      assert.ok(![].concat(r.pt).some(p=>['wheels','bolts','wsh1','wsh2','nuts','plate','rings','logo'].includes(p)),'покупное по pt: '+r.n);});
  });

  test('ножки, площадки, патрубок, заглушка и решётки на месте: '+name(f), ()=>{
    const c=loadMangal(f),n=run(c,'massRows().rows.map(r=>r.n)').join('\n');
    for(const re of [/^Ножка .*труба Ø40/m,/^Площадка под ножку/m,/^Патрубок ножки/m,/^Заглушка ножки/m,/^Площадка под колесо/m])assert.match(n,re);
    if(f.mode!=='stove')for(const re of [/^Решётка в жаровне/m,/^Решётка сверху/m])assert.match(n,re);
    if(f.rain)assert.match(n,/^Лист от дождя — профлист С8, оцинк\., 0,5 мм/m);
  });

  test('итог = сумма строк, в шапке та же цифра: '+name(f), ()=>{
    const c=loadMangal(f),R=run(c,'massRows()'),h=draw(c);
    const sum=R.rows.reduce((a,r)=>a+r.m*r.q,0);
    assert.ok(Math.abs(sum-R.tot)<1e-9,`сумма ${sum} против итога ${R.tot}`);
    const tab=kg(h.cut.match(/Итого металла[^<]*<\/td><td class="n r">([\d,]+)</)[1]),head=kg(h.stats.match(/≈ ([\d,]+) кг/)[1]);
    assert.equal(tab,Math.round(R.tot*10)/10);
    assert.equal(head,tab,'шапка '+head+' против таблицы '+tab);
    // в таблице ровно строки massRows, у каждой строки — короткое описание без раскрытия
    assert.equal((h.cut.match(/<tr><td>/g)||[]).length,R.rows.length);
  });

  test('описание каждой строки не длиннее 80 символов: '+name(f), ()=>{
    const c=loadMangal(f);
    run(c,'massRows()').rows.forEach(r=>{if(r.note)assert.ok(r.note.length<=80,`${r.n}: ${r.note.length} — ${r.note}`);});
  });

  test('сборочные подробности строк — в «Заметках»: '+name(f), ()=>{
    const c=loadMangal(f),R=run(c,'massRows()'),html=run(c,'notesHtml()');
    const asm=R.rows.filter(r=>r.asm);
    assert.ok(asm.length>3,'строк с подробностями '+asm.length);
    asm.forEach(r=>assert.ok(html.includes(r.asm),'нет в «Заметках»: '+r.n));
  });
}

test('по умолчанию: мангал 62,9 кг, печь около 87,3 кг (без плиты)', ()=>{
  assert.equal(Math.round(run(loadMangal({mode:'grill'}),'massRows().tot')*10)/10,62.9);
  const st=run(loadMangal({mode:'stove'}),'massRows().tot');
  assert.ok(Math.abs(st-87.3)<=.1,'печь '+st);
});

test('убранные покупные строки не потеряли сведений о сборке', ()=>{
  const html=run(loadMangal({mode:'stove',rain:true,logo:true}),'notesHtml()');
  for(const s of ['70 кг на колесо','М8×20','по 4 на колесо','Не приваривать','головкой к торцу','барашек','приварить вертикально к краю дверцы','плазмой'])
    assert.ok(html.includes(s),'нет в «Заметках»: '+s);
  const g=run(loadMangal({mode:'grill',logo:true}),'notesHtml()');
  assert.ok(g.includes('плазмой'),'мангал: нет логотипа в «Заметках»');
});

test('блок «Металл» — без плиты печи', ()=>{
  const m=draw(loadMangal({mode:'stove'})).metal;
  assert.ok(m.length>50);
  assert.doesNotMatch(m,/плит/i);
});
