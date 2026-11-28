// варианты кальки (#172): node --test shepherd-v6j3w/tools/trace-variants.test.js
const test=require('node:test'),assert=require('node:assert'),{tvDecode,tvEncode,tvLen,tvClean,tvSimplify,tvStraight}=require('./trace-variants.js');
const line=(a,b,n=10)=>Array.from({length:n+1},(_,i)=>a.map((x,k)=>x+(b[k]-x)*i/n));
test('tvEncode → tvDecode: точки ±0,1 мм',()=>{const L=[[[1.23,-4.5,300],[10,20,30.05]],[[0,0,0],[5,5,5]]],R=tvDecode(tvEncode(L));
  assert.strictEqual(R.length,2);R.flat().forEach((p,i)=>p.forEach((x,k)=>assert.ok(Math.abs(x-L.flat()[i][k])<=.06)));});
test('tvClean: одиночный обрывок 10 мм убран, линия 50 мм осталась',()=>{const R=tvClean([line([0,0,0],[50,0,0]),line([0,100,0],[10,100,0])]);assert.strictEqual(R.length,1);assert.ok(Math.abs(tvLen(R[0])-50)<1e-6);});
test('tvClean: два куска по 12 мм, сшитые концами (≤ 2 мм), — одна линия 24 мм, остаются оба',()=>{const R=tvClean([line([0,0,0],[12,0,0]),line([13,0,0],[25,0,0])]);assert.strictEqual(R.length,2);});
test('tvSimplify: дрожь 0,5 мм на прямой — две точки; излом 10 мм остаётся',()=>{const l=Array.from({length:41},(_,i)=>[i,i%2?.5:0,0]);assert.strictEqual(tvSimplify(l,1.5).length,2);
  const v=[[0,0,0],[20,10,0],[40,0,0]];assert.strictEqual(tvSimplify(v,1.5).length,3);});
test('tvStraight: дубль в 1 мм от линии слит, линия в 10 мм — отдельная',()=>{const R=tvStraight([line([0,0,0],[100,0,0],50),line([0,1,0],[100,1,0],50),line([0,10,0],[100,10,0],50)]);
  assert.strictEqual(R.length,2,JSON.stringify(R.map(l=>l.length)));R.forEach(l=>assert.strictEqual(l.length,2));});
test('tvStraight: частичный дубль — остаётся неперекрытый хвост ≥ 20 мм',()=>{const R=tvStraight([line([0,0,0],[100,0,0],50),line([50,1,0],[150,1,0],50)]);
  assert.strictEqual(R.length,2);const tail=R.find(l=>l[0][0]>99||l[l.length-1][0]>149);assert.ok(tail&&tvLen(tail)>40&&tvLen(tail)<52,tail&&tvLen(tail));});
test('tvStraight: обрывки < 20 мм убраны',()=>{assert.strictEqual(tvStraight([line([0,0,0],[15,0,0])]).length,0);});
