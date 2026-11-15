// сайт для нескольких фигур (studio/lib/site.js, studio/tools/figure-files.js): node --test studio/tests/site.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const site=require('../lib/site.js'),{loadFigureEngine}=require('../lib/engine.js'),{buildFiles}=require('../tools/figure-files.js'),W=require('../lib/workdir.js');
const ROOT=path.join(__dirname,'..','..');

// копия страниц редактора, которые трогает публикация
function copyEditor(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'studio-site-'));
  fs.cpSync(path.join(ROOT,'editor','lynx','js'),path.join(d,'editor','lynx','js'),{recursive:true});
  fs.copyFileSync(path.join(ROOT,'editor','lynx','index.html'),path.join(d,'editor','lynx','index.html'));fs.copyFileSync(path.join(ROOT,'editor','index.html'),path.join(d,'editor','index.html'));return d;}
const read=(d,f)=>fs.readFileSync(path.join(d,f),'utf8');
const snap=d=>({lynx:read(d,'editor/lynx/index.html'),home:read(d,'editor/index.html'),files:fs.readdirSync(path.join(d,'editor','lynx','js')).sort()});
// «Рысь 2» — копия рыси 14
function lynxCopy(name){const E=loadFigureEngine({studio:false}),m=E.run("modelPoly('lynx14')");
  return {id:'fig1',name,H:1000,kind:'stand',V:m.V,P:m.P,S:m.S,keep:[{rule:4,at:[1,2,3]}],th:{planar:.3},slots:W.openLoops(m.P)};}

test('публикация в файлы: строка последняя, тег после plates-lynx14, фигура читается движком, рысь 14 побайтно прежняя, карточка «Фигуры»', () => {
  const d=copyEditor(),fig=lynxCopy('Рысь 2'),before=read(d,'editor/lynx/js/plates-lynx14.js');
  const ch=site.writeFigure(d,fig,{stamp:'2026-11-15-0300'});
  assert.deepEqual(ch.sort(),['editor/index.html','editor/lynx/index.html','editor/lynx/js/plates-fig1.js']);
  assert.deepEqual(site.listPublished(d),[{id:'lynx14',name:'Рысь'},{id:'fig1',name:'Рысь 2'}]);
  const h=read(d,'editor/lynx/index.html');assert.ok(h.indexOf('plates-fig1.js?v=2026-11-15-0300')>h.indexOf('plates-lynx14.js'));assert.ok(h.indexOf('plates-fig1.js')<h.indexOf('js/edit.js'));
  assert.equal(read(d,'editor/lynx/js/plates-lynx14.js'),before);
  assert.match(read(d,'editor/index.html'),/<h2>Фигуры<\/h2>/);
  const E=loadFigureEngine({studio:false,root:d}),m=E.run("modelPoly('fig1')"),m0=E.run("modelPoly('lynx14')");
  assert.equal(m.V.length,m0.V.length);assert.equal(m.P.length,m0.P.length);
  m.V.forEach((p,i)=>p.forEach((x,k)=>assert.ok(Math.abs(x-fig.V[i][k])<.01,'точка '+i)));
  assert.deepEqual(E.run('FIGURES.fig1.keep'),fig.keep);assert.deepEqual(E.run('FIGURES.fig1.th'),{planar:.3});assert.equal(E.run('FIGURES.fig1.kind'),'stand');assert.equal(E.run('FIGURES.fig1.studio'),true);
  assert.equal(E.run('FIGURES.fig1.build().P.length'),fig.P.length);
  assert.throws(()=>site.writeFigure(d,fig),/уже есть/);
});

test('название (ревью, п. 5): кавычки, скобки, </script> — экранированы; пустое и занятое — отказ', () => {
  for(const name of ['Рысь "Лапа" <b>','</script><script>alert(1)</script>',"Рысь & 'Ко'"]){
    const d=copyEditor();site.writeFigure(d,lynxCopy(name),{stamp:'x'});
    const h=read(d,'editor/lynx/index.html'),opt=/<option value="fig1">([^<]*)<\/option>/.exec(h);assert.ok(opt,name);
    assert.ok(!/<b>|<script>alert/.test(opt[1]));
    assert.ok(!name.includes('"')||opt[1].includes('&quot;'));assert.ok(!name.includes('<')||opt[1].includes('&lt;'));
    assert.deepEqual(site.listPublished(d).pop(),{id:'fig1',name});
    const js=read(d,'editor/lynx/js/plates-fig1.js');assert.ok(!/<\/script/i.test(js),'в .js нет </script');
    assert.equal(loadFigureEngine({studio:false,root:d}).run('FIGURES.fig1.name'),name);
    assert.equal(read(d,'editor/index.html').match(/card-lynx[\s\S]*?<h2>([^<]*)<\/h2>/)[1],'Фигуры');}
  const d=copyEditor();
  assert.throws(()=>site.writeFigure(d,lynxCopy('Рысь')),/уже есть на сайте/);assert.throws(()=>site.writeFigure(d,lynxCopy('  рысь ')),/уже есть на сайте/);
  assert.throws(()=>site.writeFigure(d,lynxCopy('')),/пустым/);assert.throws(()=>site.writeFigure(d,lynxCopy('   ')),/пустым/);
  assert.throws(()=>site.checkName('x'.repeat(61),[]),/длиннее/);assert.equal(site.checkName('  Рысь   2 ',[{name:'Рысь'}]),'Рысь 2');
  assert.throws(()=>site.writeFigure(d,Object.assign(lynxCopy('Х'),{id:'../x'})),/id/);
  assert.deepEqual(snap(d),snap(copyEditor()),'после отказов ничего не записано');
});

test('подложки за прорезями: у фигуры мастерской те же, что у рыси 14 (backIf по центрам прорезей)', {timeout:120000}, () => {
  const d=copyEditor(),fig=lynxCopy('Рысь 2'),ys=V=>V.map(p=>p[1]),y0=Math.min(...ys(fig.V)),y1=Math.max(...ys(fig.V));
  // подложки нужны только у глаз (у рыси 14 их выбирает backIf по высоте .70–.85); остальные открытые контуры (уши, низ) — просто прорези
  fig.slots=fig.slots.filter(L=>{const y=(L.reduce((t,i)=>t+fig.V[i][1],0)/L.length-y0)/(y1-y0);return y>.7&&y<.85;});assert.equal(fig.slots.length,2);
  site.writeFigure(d,fig,{stamp:'x'});
  const E=loadFigureEngine({studio:false,root:d}),wl=id=>E.run(`(()=>{const m=modelPoly(${JSON.stringify(id)}),R=buildParts(polyBase(m.V,m.P,m.S),1.5,1.5),M3=polyBase(m.V,m.P,m.S);return addBacking(R,{V:M3.V,F:M3.F},FIGURES[${JSON.stringify(id)}].backIf);})()`);
  const a=wl('lynx14'),b=wl('fig1');assert.ok(a>0,'у рыси 14 подложки есть');assert.equal(b,a);
});

test('id не зависит от названия', () => {
  assert.equal(site.newId(['lynx14']),'fig1');assert.equal(site.newId(['lynx14','fig1']),'fig2');assert.equal(site.newId(['fig2','fig1']),'fig3');
});

test('снять: файлы как до публикации, карточка «Рысь»; последнюю фигуру не снять', () => {
  const d=copyEditor(),s0=snap(d);site.writeFigure(d,lynxCopy('Рысь 2'),{stamp:'x'});
  const ch=site.removeFigure(d,'fig1');assert.ok(ch.includes('editor/lynx/js/plates-fig1.js'));
  assert.deepEqual(snap(d),s0);assert.match(read(d,'editor/index.html'),/card-lynx[\s\S]*?<h2>Рысь<\/h2>/);
  assert.throws(()=>site.removeFigure(d,'lynx14'),/Последнюю фигуру с сайта не снять/);assert.throws(()=>site.removeFigure(d,'nosuch'),/нет фигуры/);
  // рысь 14 тоже можно снять, когда есть другая: остаётся одна, карточка называется по ней
  site.writeFigure(d,lynxCopy('Рысь 2'),{stamp:'x'});site.removeFigure(d,'lynx14');
  assert.deepEqual(site.listPublished(d),[{id:'fig1',name:'Рысь 2'}]);assert.match(read(d,'editor/index.html'),/card-lynx[\s\S]*?<h2>Рысь 2<\/h2>/);
});

test('figure-files на верхе рыси 14: DXF детали и раскрой строятся, листы и карты — без исключений; dxf_check.py — код 0', {timeout:600000}, t => {
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'studio-dxf-')),r=buildFiles(ROOT,'lynx14',out,{top:500});
  assert.ok(r.parts>50&&r.cards>10&&r.sheets>=1);assert.ok(fs.statSync(path.join(out,'parts.dxf')).size>1e4&&fs.statSync(path.join(out,'nest.dxf')).size>1e4);
  const py=process.env.STUDIO_PYTHON||'python';
  if(cp.spawnSync(py,['-c','import ezdxf'],{encoding:'utf8'}).status!==0){t.skip('нет ezdxf: python -m pip install -r studio/py/requirements.txt');return;}
  const c=cp.spawnSync(py,['-I',path.join(ROOT,'studio','py','dxf_check.py'),out],{encoding:'utf8'});
  assert.equal(c.status,0,c.stdout+c.stderr);
});
