// объёмные картинки деталей в «Подготовить отдельно» (#117): pics.js — picKind(строка) выбирает картинку по названию, prepPic(строка) рисует SVG
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

// режимы и галочки, при которых в блоке появляются разные строки: крыша, колосник, арматура вместо плиты, обечайка, ножки без колёс
const CONFIGS=[{mode:'grill'},{mode:'grill',cgr:false},{mode:'grill',wheels:false},{mode:'stove'},{mode:'stove',grType:'rebar',obe:true},
  {mode:'stove',wheels:false},{mode:'both'},{mode:'both',grType:'rebar',obe:true,wheels:false},{mode:'both',rain:true,cgr:false}];
const nm=f=>JSON.stringify(f);

// по названию строки — картинка (вид); список — из задачи #117, п. 4
const KINDS=[
  ['Уголок 30×30×4 — опора колосника','angle'],['Уголок 30×30×3 в жаровне','angle'],['Уголок 40×40×4 — опора колосника','angle'],
  ['Труба — профтруба 60×60×2','chimney'],['Удлинитель трубы — профтруба 60×60×2','ptube'],
  ['Направляющая шибера — проставка, квадрат 6×6','square'],['Направляющая шибера — полоса 20 × 3','strip'],
  ['Лист от дождя — профлист С8, оцинк., 0,5 мм','profsheet'],['Колосник 1 и Колосник 2 — перфолист (одинаковые половины)','perfo'],
  ['Трубка Ø26×3 (внутр. Ø20) с донышком','tube'],['Патрубок ножки — труба Ø40×3 с гайкой М16','tube'],
  ['Арматура Ø16, передние стойки','rod'],['Арматура Ø20 — краевые прутки','rod'],
  ['Ручка — труба Ø25×2','handle'],['Ручка печи — труба Ø25×2','handle'],['Ручка дверцы, пруток Ø12','staple'],
  ['Крючок дверцы, пруток Ø6','hook'],['Проушина под крючок, пруток Ø6','ring'],['Заглушка ножки Ø40 со шпилькой М16×40','cap'],
  ['Заслонка в трубе','damper'],['Обечайка вокруг казана (по желанию)','shell'],
  ['Ножка жаровни с колесом, труба Ø40×3','leg'],['Ножка печи на пятке, труба Ø40×3','leg'],['Пятка ножки без колеса','plate']];

test('picKind: по названию строки — нужная картинка',()=>{
  const c=loadMangal({mode:'both'});
  for(const [n,k] of KINDS)assert.equal(run(c,`picKind({n:${JSON.stringify(n)}})`),k,n);
  assert.equal(run(c,'picKind({n:"Что-то новое"})'),null,'неизвестная строка — без картинки (тест ниже это поймает)');
});

for(const f of CONFIGS){
  test('у каждой строки блока — объёмная картинка с подписью размера: '+nm(f),()=>{
    const c=loadMangal(f);page(c);
    const R=run(c,'prepRows()');
    assert.ok(R.length>0);
    R.forEach((r,i)=>{const k=run(c,`picKind(prepRows()[${i}])`),svg=run(c,`prepPic(prepRows()[${i}])`);
      assert.ok(k,'нет картинки у строки: '+r.n);
      assert.match(svg,/<svg class="pic"[^>]*viewBox="0 0 110 70"/,r.n);
      assert.ok((svg.match(/<polygon /g)||[]).length>=3,'мало граней: '+r.n);
      assert.match(svg,/<small class="piccap">[^<]+<\/small>/,'нет подписи размера: '+r.n);
      assert.doesNotMatch(svg,/NaN|Infinity|undefined/,r.n);});
    const h=run(c,'prepHtml()');
    assert.equal((h.match(/<svg class="pic"/g)||[]).length,R.length,'картинок не по числу строк');
  });
}

test('металл: грани залиты серым, верх светлее бока, торец светлый; тонкий контур; без картинок и WebGL',()=>{
  const c=loadMangal({mode:'grill'});
  const svg=run(c,'prepPic({n:"Уголок 30×30×4 — опора колосника",s:"L 780",q:2,ang:{a:30,t:4,flange:"top"}})');
  const fills=[...svg.matchAll(/fill="rgb\((\d+),(\d+),(\d+)\)"/g)].map(m=>[+m[1],+m[2],+m[3]]);
  assert.ok(fills.length>=3);
  fills.forEach(([r,g,b])=>assert.ok(Math.abs(r-g)<16&&Math.abs(g-b)<16,'не серый: '+[r,g,b]));
  const lum=v=>v[0]+v[1]+v[2],L=fills.map(lum);
  assert.ok(Math.max(...L)-Math.min(...L)>120,'нет света и тени');
  assert.match(svg,/stroke-width/);
  assert.doesNotMatch(svg,/<image|<img|canvas|\.png|\.jpg/);
});

test('уголки — как стоят на изделии: опора колосника мангала — полка сверху, уголок в жаровне и 40×40 печи — снизу; подпись «30×30×4 · L 780»',()=>{
  const g=loadMangal({mode:'grill',cgr:true});
  const a=run(g,'prepRows().filter(r=>/^Уголок/.test(r.n)).map(r=>[r.n,r.ang&&r.ang.flange,prepPic(r)])');
  const top=a.find(x=>/30×30×4/.test(x[0])),bot=a.find(x=>/30×30×3/.test(x[0]));
  assert.ok(top&&bot,'нет уголков мангала');
  assert.equal(top[1],'top');assert.match(top[2],/aria-label="[^"]*полка сверху/);
  assert.equal(bot[1],'bottom');assert.match(bot[2],/aria-label="[^"]*полка снизу/);
  assert.notEqual(top[2].replace(/aria-label="[^"]*"/,''),bot[2].replace(/aria-label="[^"]*"/,''));
  assert.match(top[2],/<small class="piccap">30×30×4 · L \d+<\/small>/);
  const s=run(loadMangal({mode:'stove'}),'prepRows().filter(r=>/^Уголок/.test(r.n)).map(r=>[r.n,r.ang&&r.ang.flange,prepPic(r)])');
  assert.deepEqual(s.map(x=>[x[0],x[1]]),[['Уголок 40×40×4 — опора колосника','bottom']],'в печи — только 40×40');
  assert.match(s[0][2],/полка снизу/);
  assert.ok(!run(g,'prepRows()').some(r=>/40×40/.test(r.n)),'в мангале 40×40 нет');
  // у остального в блоке признака уголка нет
  for(const f of [{mode:'both'},{mode:'stove'}])run(loadMangal(f),'prepRows()').filter(r=>!/^Уголок/.test(r.n)).forEach(r=>assert.ok(!r.ang,r.n));
});

test('длинные детали — укороченно, с разрывом (уголок 780, арматура 550); короткие — целиком',()=>{
  const c=loadMangal({mode:'grill'});
  const pic=(n,s,extra='')=>run(c,`prepPic({n:${JSON.stringify(n)},s:${JSON.stringify(s)},q:1${extra}})`);
  assert.match(pic('Уголок 30×30×4 — опора колосника','L 780',',ang:{a:30,t:4,flange:"top"}'),/data-break="1"/);
  assert.match(pic('Арматура Ø20 — краевые прутки','L 550'),/data-break="1"/);
  assert.doesNotMatch(pic('Патрубок ножки — труба Ø40×3 с гайкой М16','L 30'),/data-break="1"/);
  assert.doesNotMatch(pic('Заглушка ножки Ø40 со шпилькой М16×40','Ø40 × 4'),/data-break="1"/);
});
