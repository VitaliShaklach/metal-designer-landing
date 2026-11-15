// фигуры мастерской на сайте: каждая проходит Проверку, зеркальна, режется и раскладывается: node --test editor/lynx/tools/figures.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const {loadFigureEngine}=require('../../../studio/lib/engine.js');
const E=loadFigureEngine({studio:true}),run=E.run;
const IDS=run('Object.keys(FIGURES)');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('в выпадашке столько строк, сколько фигур в коде, рысь 14 называется «Рысь»', () => {
  const sel=/<select id="figSel">([\s\S]*?)<\/select>/.exec(html)[1],ids=[...sel.matchAll(/<option value="([^"]+)">/g)].map(m=>m[1]);
  assert.deepEqual(ids,IDS);assert.equal(run('FIGURES.lynx14.name'),'Рысь');
});

for(const id of IDS.filter(i=>run(`!!FIGURES[${JSON.stringify(i)}].studio`))){
  const q=JSON.stringify(id);
  test(`фигура мастерской ${id}: Проверка без строк (кроме сведений), зеркальна, контуры реза без bad, раскладка части ≤ 30 с`, {timeout:120000}, () => {
    const F=run(`FIGURES[${q}]`),M=run(`modelPoly(${q})`),h=run(`(()=>{const b=meshBox(modelPoly(${q}).V);return b.max[1]-b.min[1];})()`);
    const iss=run('checkFigure')({V:M.V,P:M.P,S:M.S},{scale:F.H/h,kind:F.kind,slots:F.slots,keep:F.keep,th:F.th||undefined,skip:[12]}).filter(i=>!i.info);
    assert.deepEqual(iss.map(i=>i.rule+': '+i.text),[]);
    const bad=run(`(()=>{const m=modelPoly(${q}),R=buildParts(polyBase(m.V,m.P,m.S),1.5,1.5);return R.parts.filter(p=>cutContour(p,2,.5,true).bad).length;})()`);assert.equal(bad,0);
    const t0=Date.now();
    run(`(()=>{const m=modelPoly(${q}),top=(M,y)=>{const keep=M.P.filter(Q=>Q.reduce((s,i)=>s+M.V[i][1],0)/Q.length>y),map=new Map(),V=[];const P=keep.map(Q=>Q.map(i=>{if(!map.has(i)){map.set(i,V.length);V.push(M.V[i]);}return map.get(i);}));return polyBase(V,P);};
      const T=top(m,meshBox(m.V).max[1]*.8),R=buildParts(T,1.5,1.5),items=R.parts.map(p=>({id:p.id,no:p.no,pts:cutContour(p,2,.5,true).pts})).filter(o=>o.pts&&o.pts.length>2);
      const g=nestGen(items,2500,1250,5,10,2.5,2,true);let v;do{v=g.next();}while(!v.done);return v.value.sheets.length;})()`);
    assert.ok(Date.now()-t0<30000,'раскладка части: '+(Date.now()-t0)+' мс');
  });
}
