// слои мастерской (#145): node --test shepherd-v6j3w/tools/layers.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/../js/layers.js','utf8'),c);
const run=s=>vm.runInContext(s,c),J=x=>JSON.parse(JSON.stringify(x));
const DEF={edges:true,verts:false,trace:false,diff:false};
test('LAYER_DEF как в спеке: линии вкл., остальное выкл.',()=>assert.deepStrictEqual(J(run('LAYER_DEF')),DEF));
test('layersLoad(null) = по умолчанию',()=>assert.deepStrictEqual(J(run('layersLoad(null)')),DEF));
test('layersLoad("") и undefined = по умолчанию',()=>{assert.deepStrictEqual(J(run('layersLoad("")')),DEF);assert.deepStrictEqual(J(run('layersLoad(undefined)')),DEF);});
test('частичное сохранение: verts:true, остальное по умолчанию',()=>assert.deepStrictEqual(J(run('layersLoad(\'{"verts":true}\')')),{...DEF,verts:true}));
test('битый текст = по умолчанию',()=>assert.deepStrictEqual(J(run('layersLoad("мусор")')),DEF));
test('не объект (число, массив, null) = по умолчанию',()=>['5','[1,2]','null','"x"','true'].forEach(s=>assert.deepStrictEqual(J(run(`layersLoad(${JSON.stringify(s)})`)),DEF,s)));
test('не булево значение игнорируется (берётся умолчание)',()=>assert.deepStrictEqual(J(run('layersLoad(\'{"edges":"нет","trace":1,"diff":true}\')')),{...DEF,diff:true}));
test('круг: layersLoad(layersSave(L)) = L',()=>{const L={edges:false,verts:true,trace:true,diff:true};assert.deepStrictEqual(J(run(`layersLoad(layersSave(${JSON.stringify(L)}))`)),L);});
test('layersLoad возвращает новый объект: правка не портит LAYER_DEF',()=>{run('layersLoad(null).verts=true');assert.deepStrictEqual(J(run('LAYER_DEF')),DEF);});
