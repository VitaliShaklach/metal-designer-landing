// раскладка деталей на лист (вкладка «Лазер · DXF»): рамки деталей прямоугольниками (MaxRects, как на лендинге), контур — настоящий
const test=require('node:test'),assert=require('node:assert/strict');
const {loadMangal,run}=require('./load.js');

// раскладка всех толщин: over — поля nestJob (зазор, лист, колосник); R — результат nestGen по группе
const NEST=over=>`(()=>{const N=nestJob(${JSON.stringify(over)});
  return N.groups.map(G=>{const g=nestGen(G.items,N.LW,N.LH,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return {mm:G.mm,n:G.items.length,R:v.value};});})()`;
const SHEET={gap:5,sk:'1250x2500',W:2500,H:1250};
const MODES=[['grill',false],['grill',true],['stove',true],['both',true]];

test('мангал без колосника, 1250 × 2500, зазор 5: один лист, полоса не длиннее 880 мм', ()=>{
  const c=loadMangal({mode:'grill'});
  const [g5]=run(c,NEST({...SHEET,cgr:false}));
  assert.equal(g5.mm,5);
  assert.equal(g5.R.too.length,0);
  assert.equal(g5.R.sheets.length,1);
  assert.ok(g5.R.sheets[0].len<=880,'полоса '+g5.R.sheets[0].len);
});

test('мангал с колосником: один лист, полоса не длиннее 1180 мм', ()=>{
  const c=loadMangal({mode:'grill'});
  const [g5]=run(c,NEST({...SHEET,cgr:true}));
  assert.equal(g5.mm,5);
  assert.equal(g5.R.too.length,0);
  assert.equal(g5.R.sheets.length,1);
  assert.ok(g5.R.sheets[0].len<=1180,'полоса '+g5.R.sheets[0].len);
});

test('без наложений, зазор не меньше заданного, все детали внутри листа с краем 10 мм', ()=>{
  for(const [mode,cgr] of MODES)for(const gap of [5,20]){
    const c=loadMangal({mode}),W=2500,H=1250,m=10;
    const errs=run(c,`(()=>{const out=[];${NEST({...SHEET,gap,cgr})}.forEach(({mm,n,R})=>{
      if(R.sheets.reduce((a,s)=>a+s.items.length,0)+R.too.length!==n)out.push(mm+' мм: потеряны детали');
      R.sheets.forEach(s=>{const A=s.items;
        A.forEach(o=>o.pts.forEach(([x,y])=>{if(x<${m}-1e-6||y<${m}-1e-6||x>${W-m}+1e-6||y>${H-m}+1e-6)out.push(mm+' мм: деталь '+o.no+' ближе края');}));
        for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const d=polyGap(A[i].pts,A[j].pts);if(d<${gap}-0.01)out.push(mm+' мм: зазор '+A[i].no+'–'+A[j].no+' '+d.toFixed(2));}});});
      return out;})()`);
    assert.deepEqual(errs,[],`${mode}${cgr?' с колосником':''}, зазор ${gap}`);
  }
});

// отрезки слоя CUT из текста DXF: [[x1,y1,x2,y2], …]
const cutLines=t=>{const a=t.split('\r\n'),out=[];for(let i=0;i<a.length;i++)if(a[i]==='LINE'&&a[i+2]==='CUT'){const v=k=>Number(a[a.indexOf(k,i)+1]);out.push([v('10'),v('20'),v('11'),v('21')]);}return out;};
test('DXF листа совпадает с рисунком, в том числе у повёрнутых деталей', ()=>{
  let rotated=0;
  for(const [mode,cgr] of MODES){
    const c=loadMangal({mode});
    const sheets=run(c,`(()=>{const N=nestJob(${JSON.stringify({...SHEET,cgr})}),out=[];
      N.groups.forEach(G=>{const g=nestGen(G.items,N.LW,N.LH,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
        v.value.sheets.forEach(sh=>out.push({dxf:nestDxf(N,G,sh),items:sh.items.map(it=>({no:it.no,s:it.tr.s,pts:it.pts}))}));});return out;})()`);
    for(const sh of sheets){const L=cutLines(sh.dxf),near=(p,x,y)=>Math.abs(p[0]-x)<=0.01&&Math.abs(p[1]-y)<=0.01;
      for(const it of sh.items){if(it.s===1)rotated++;
        // каждая сторона контура со схемы, включая замыкающую (последняя точка → первая), — отрезок CUT в DXF (в любую сторону)
        for(let i=0;i<it.pts.length;i++){const a=it.pts[i],b=it.pts[(i+1)%it.pts.length];
          assert.ok(L.some(l=>near(a,l[0],l[1])&&near(b,l[2],l[3])||near(b,l[0],l[1])&&near(a,l[2],l[3])),
            `${mode}: деталь ${it.no}${it.s===1?' (повёрнута)':''}, сторона ${a.map(v=>v.toFixed(2))} → ${b.map(v=>v.toFixed(2))} не в DXF`);}}}
  }
  assert.ok(rotated>0,'нет ни одной повёрнутой детали — проверка поворота пустая');
});

test('печь и «оба»: листы 5, 3 и 15 мм раскладываются, всё влезло', ()=>{
  for(const mode of ['stove','both']){
    const c=loadMangal({mode});
    const G=run(c,NEST({...SHEET,cgr:true}));
    assert.deepEqual(G.map(g=>g.mm),[5,3,15],mode);
    G.forEach(g=>{assert.ok(g.R.sheets.length>=1,`${mode} ${g.mm} мм: нет листа`);assert.deepEqual(g.R.too,[],`${mode} ${g.mm} мм: не поместилось`);});
  }
});

test('деталь больше листа — в «Не поместилось», остальные разложены', ()=>{
  const c=loadMangal({mode:'grill'});
  const r=run(c,`(()=>{const N=nestJob(${JSON.stringify({gap:5,sk:'1000x2000',W:2000,H:1000,cgr:false})}),G=N.groups[0],
      items=[...G.items.map(o=>({id:o.id,no:o.no,pts:o.pts})),{id:G.items.length,no:99,pts:[[0,0],[2600,0],[2600,100],[0,100]]}];
    const g=nestGen(items,N.LW,N.LH,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
    return {n:G.items.length,placed:v.value.sheets.reduce((a,s)=>a+s.items.length,0),too:v.value.too};})()`);
  assert.deepEqual(r.too.map(o=>o.no),[99]);
  assert.equal(r.placed,r.n);
});
