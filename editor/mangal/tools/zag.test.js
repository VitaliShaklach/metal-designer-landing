// «Лазер · DXF → Из заготовок» (#60, пересмотр 14.11): постоянный список — все детали, которым нужен лазер (вид zag), от «Гильотины» не зависит;
// колосник мангала — по «Колосник на листе»; итоги и архив _zag.dxf
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run,page}=require('./load.js');

// результат «Из заготовок» по заданию N (как по кнопке «Рассчитать»)
const RES='(N=>N.groups.map(G=>zagTypes(N,G)))';
const NAMES=`(N=>N.groups.flatMap(G=>zagTypes(N,G).map(t=>t.p.name)))`;

test('список: все детали, которым нужен лазер (вид zag); готовые после гильотины — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>({z:${NAMES}(N),kinds:N.groups.flatMap(G=>zagTypes(N,G).map(t=>t.kind))}))(nestJob())`);
  assert.deepEqual(r.z,['Боковина жаровни задняя','Боковина жаровни передняя','Перегородка жаровни','Задвижка поддува','Скоба задвижки']);
  assert.ok(r.kinds.every(k=>k==='zag'));
  const s=loadMangal({mode:'stove'});page(s);
  assert.deepEqual(run(s,`${NAMES}(nestJob())`),['Боковина печи задняя','Дно печи','Колосник печи']);
});

test('от «Гильотины» не зависит: старая память галочек «рубим» и подрезка список не меняют; колосник — по «Колосник на листе»', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const base=run(c,`${NAMES}(nestJob())`);
  const d=loadMangal({mode:'grill'});page(d,{'md-gilsel2':{grill_side_back:false,grill_air_slider:false}});
  assert.deepEqual(run(d,`${NAMES}(nestJob())`),base);
  assert.deepEqual(run(c,`${NAMES}(nestJob({edge:0}))`),base);
  assert.equal(run(c,`${NAMES}(nestJob({cgr:true}))`).filter(n=>/Колосник мангала/.test(n)).length,2);
});

test('итоги: рез и врезки по заготовкам (с запасом), число заготовок — с учётом кол-ва', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const r=run(c,`(N=>{const res=${RES}(N),T=zagTypes(N,N.groups[0]);return {t:zagTotals(N,res)[0],
    cut:T.reduce((a,t)=>a+t.b.cut*t.q,0),pierce:T.reduce((a,t)=>a+t.b.pierce*t.q,0),q:T.reduce((a,t)=>a+t.q,0),
    side:(t=>({b:t.b.pierce,m:t.m.pierce,bc:t.b.cut,mc:t.m.cut}))(T.find(t=>t.p.file==='grill_side_back'))};})(nestJob())`);
  assert.equal(r.t.mm,5);
  assert.equal(r.t.blanks,r.q);
  assert.equal(r.q,9);   // 2 боковины, перегородка, 2 задвижки, 4 скобы
  assert.ok(Math.abs(r.t.cut-r.cut)<1e-6);
  assert.equal(r.t.pierce,r.pierce);
  // решение грилинга: каждый паз с кромки — врезка, поэтому у боковины врезок больше, чем с листа, а реза меньше (стороны режет гильотина)
  assert.ok(r.side.b>r.side.m,'врезки боковины: по заготовке '+r.side.b+', с листа '+r.side.m);
  assert.ok(r.side.bc<r.side.mc);
});

test('«Из заготовок»: DXF заготовки — grill_side_back_5mm_x1_zag.dxf; архивов нет, листа нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  for(const n of ['zipName','variantFiles','zagFiles','zagHas'])assert.equal(run(c,`typeof ${n}`),'undefined',n);
  const h=run(c,`(N=>zagHtml(N,${RES}(N)))(nestJob())`);
  assert.equal((h.match(/data-act="zag"/g)||[]).length,5);
  assert.equal((h.match(/data-act="sheet"/g)||[]).length,0);
  assert.ok(!/Скачать архив|ZIP/.test(h));
  const want=run(c,`(N=>N.groups.flatMap(G=>zagTypes(N,G).map(t=>dxfNameZ(t.p))))(nestJob())`);
  const got=run(c,`(N=>{const res=${RES}(N);return N.groups.flatMap((G,gi)=>res[gi].map((t,ti)=>zagOne(N,res,{act:'zag',g:String(gi),t:String(ti)})));})(nestJob())`);
  assert.deepEqual(got.map(x=>x[0]),want);
  assert.ok(want.includes('grill_side_back_5mm_x1_zag.dxf'));
  got.forEach(([n,t])=>{assert.match(n,/_zag\.dxf$/);assert.match(t,/\r\nBLANK\r\n/,n+': нет заготовки');assert.match(t,/\r\nCUT\r\n/,n+': нет реза');});
  // печь: 5 мм (боковина, дно) и 15 мм (колосник); 3 мм (дверца, шибер — прямоугольники) — без заготовок
  const s=loadMangal({mode:'stove'});page(s);
  const fs=run(s,`(N=>N.groups.flatMap(G=>zagTypes(N,G).map(t=>dxfNameZ(t.p))))(nestJob())`);
  assert.deepEqual(fs.map(n=>n.replace(/^.*_(\d+mm)_x\d+_zag\.dxf$/,'$1')),['5mm','5mm','15mm']);
});

test('вкладка: итоги и таблица, без «Не на схеме»; нечего резать в толщине — строка', ()=>{
  const c=loadMangal({mode:'stove'});page(c);
  const h=run(c,`(N=>zagHtml(N,${RES}(N)))(nestJob())`);
  for(const t of ['Рез','Врезки','Заготовки'])assert.match(h,new RegExp('<span>'+t+' <b>'));
  assert.doesNotMatch(h,/Не на схеме/);
  assert.equal((h.match(/Заготовок под лазер нет/g)||[]).length,1);   // 3 мм
  assert.match(h,/_zag\.dxf/);
});

test('ключ «Из заготовок» меняется от колосника; от листа, зазора, подрезки — нет', ()=>{
  const c=loadMangal({mode:'grill'});page(c);
  const k=o=>run(c,`zagKey(nestJob(${JSON.stringify(o)}))`),base=k({});
  assert.notEqual(k({cgr:true}),base);
  assert.equal(k({W:3000,H:1500}),base);
  assert.equal(k({gap:8}),base);
  assert.equal(k({edge:0}),base);
});
