// отчёт Проверки: node --test studio/tests/report.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path');
const {report}=require('../tools/report.js');

test('отчёт по рыси 14: таблица правил и замер спеки', () => {
  const r=report('lynx14');
  assert.match(r.text,/Правило \| Сколько \| Худшее/);
  assert.match(r.text,/1\. Грань плоская \| \d+ \| грань неплоская на 1,33 мм/);
  assert.match(r.text,/Граней \/ точек: 1133 \/ 1372/);
  assert.match(r.text,/Открытые рёбра: 108/);
  assert.equal(r.measure.a5,67);assert.equal(r.measure.a12,149);assert.equal(r.measure.straight,345);   // как в замере спеки
});

test('отчёт по файлу «Сохранить» редактора: куб чистый', () => {
  const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'studio-')),'cube.json'),x=150;
  fs.writeFileSync(f,JSON.stringify({type:'md-art',v:1,name:'Куб',dims:{W:300,H:400,D:260},V:[[-x,0,0],[x,0,0],[x,400,0],[-x,400,0],[-x,0,260],[x,0,260],[x,400,260],[-x,400,260]],
    P:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]}));
  const r=report(f);
  assert.equal(r.issues.length,0);assert.match(r.text,/«Куб».*scale 1,/);
});
