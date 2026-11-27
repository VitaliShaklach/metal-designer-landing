// «Открыть модель» — всегда для обводки (#179, план docs/superpowers/plans/2026-11-25-shepherd7-workshop.md, задача 5): парсеры mesh.js отдают uv и картинку текстуры
// node --test shepherd-v6j3w/tools/open-model.test.js
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),vm=require('vm');
const c={console,TextDecoder,Math,Blob};vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/../js/mesh.js','utf8'),c);
const run=s=>vm.runInContext(s,c),J=x=>JSON.parse(JSON.stringify(x));

// куб 0…100 из OBJ: 8 точек, 4 uv (каждая сторона — весь квадрат uv), 6 граней-четырёхугольников v/vt
const CUBE_V='v 0 0 0\nv 100 0 0\nv 100 100 0\nv 0 100 0\nv 0 0 100\nv 100 0 100\nv 100 100 100\nv 0 100 100\n',
  CUBE_VT='vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\n',
  CUBE_FT='f 1/1 4/4 3/3 2/2\nf 5/1 6/2 7/3 8/4\nf 1/1 2/2 6/3 5/4\nf 2/1 3/2 7/3 6/4\nf 3/1 4/2 8/3 7/4\nf 4/1 1/2 5/3 8/4\n';

test('parseOBJ: куб с vt — T той же длины, что V (вершина = пара точка + uv, как orig.js); у каждой вершины треугольника — её uv из файла',()=>{
  c.txt=CUBE_V+CUBE_VT+CUBE_FT;const m=J(run('parseOBJ(txt)'));
  assert.strictEqual(m.F.length,12,'12 треугольников');assert.ok(Array.isArray(m.T)&&m.T.length===m.V.length,'T: '+(m.T&&m.T.length)+', V: '+m.V.length);
  assert.ok(m.V.length>8&&m.V.length<=24,'точки на стыках сторон — по вершине на каждый свой uv: '+m.V.length);
  const key=(p,t)=>p.join()+'|'+t.join(),want=new Set();
  // пары точка|uv из файла: сторона k — 4 точки с uv 1…4 по порядку
  CUBE_FT.trim().split('\n').forEach(l=>l.slice(2).split(' ').forEach(w=>{const [v,t]=w.split('/').map(Number),P=CUBE_V.trim().split('\n')[v-1].slice(2).split(' ').map(Number),U=CUBE_VT.trim().split('\n')[t-1].slice(3).split(' ').map(Number);want.add(key(P,U));}));
  m.F.flat().forEach(i=>assert.ok(want.has(key(m.V[i],m.T[i])),'вершина '+i+': '+key(m.V[i],m.T[i])));});
test('parseOBJ: без vt — как было (точки сварены, T нет); vt не у всех граней — тоже без T',()=>{
  c.txt=CUBE_V+'f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n';const m=J(run('parseOBJ(txt)'));
  assert.strictEqual(m.V.length,8);assert.strictEqual(m.F.length,12);assert.strictEqual(m.T,undefined);
  c.txt=CUBE_V+CUBE_VT+CUBE_FT.replace('f 1/1 4/4 3/3 2/2','f 1 4 3 2');const h=J(run('parseOBJ(txt)'));assert.strictEqual(h.T,undefined,'одна грань без vt — uv нет у всей модели');assert.strictEqual(h.F.length,12);});
test('parseOBJ: f v/vt/vn и отрицательные индексы читаются, vt из трёх чисел — первые два',()=>{
  c.txt='v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0.25 0.5 0\nvt 0.75 0.5 0\nvt 0.5 1 0\nvn 0 0 1\nf -3/-3/1 -2/-2/1 -1/-1/1\n';const m=J(run('parseOBJ(txt)'));
  assert.strictEqual(m.F.length,1);assert.deepStrictEqual(m.F[0].map(i=>m.T[i]),[[0.25,0.5],[0.75,0.5],[0.5,1]]);});

// GLB байтами: json + bin (выравнивание 4), как пишет его Meshy / Blender
function glb(json,bin){const enc=new TextEncoder();let js=enc.encode(JSON.stringify(json));const pj=(4-js.length%4)%4,jb=new Uint8Array(js.length+pj).fill(0x20);jb.set(js);
  const pb=bin?(4-bin.length%4)%4:0,bb=bin?new Uint8Array(bin.length+pb):null;if(bb)bb.set(bin);
  const len=12+8+jb.length+(bb?8+bb.length:0),out=new Uint8Array(len),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,len,true);dv.setUint32(12,jb.length,true);dv.setUint32(16,0x4E4F534A,true);out.set(jb,20);
  if(bb){const o=20+jb.length;dv.setUint32(o,bb.length,true);dv.setUint32(o+4,0x004E4942,true);out.set(bb,o+8);}return out.buffer;}
// байты PNG 2×2 (подпись, IHDR, IDAT, IEND) — здесь картинку не декодируем, сверяем, что в Blob ровно они
const PNG=Buffer.from('89504E470D0A1A0A0000000D49484452000000020000000208060000007278DFA20000001349444154789C63F8CFC0F09F81E13F0303C37F0006FC02FEA7C2C3D80000000049454E44AE426082','hex');
// треугольник: точки (0,0,0) (10,0,0) (0,10,0), uv glTF (0,0) (1,0) (0,1) — у glTF v сверху вниз
function triBin(withImg){const P=new Float32Array([0,0,0, 10,0,0, 0,10,0]),U=new Float32Array([0,0, 1,0, 0,1]),I=new Uint16Array([0,1,2,0]);
  const parts=[Buffer.from(P.buffer),Buffer.from(U.buffer),Buffer.from(I.buffer)].concat(withImg?[PNG]:[]);return new Uint8Array(Buffer.concat(parts));}
const triJSON=img=>({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
  materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}],images:[img],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5126,count:3,type:'VEC2'},{bufferView:2,componentType:5123,count:3,type:'SCALAR'}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:24},{buffer:0,byteOffset:60,byteLength:6}].concat(img.bufferView!==undefined?[{buffer:0,byteOffset:68,byteLength:PNG.length}]:[]),
  buffers:[{byteLength:68+PNG.length}]});

test('parseGLB: треугольник с uv и PNG внутри — T (v перевёрнута в правило OBJ / three.js: 1 — верх) и img — Blob image/png с байтами картинки',async()=>{
  c.buf=glb(triJSON({bufferView:3,mimeType:'image/png'}),triBin(true));const m=run('parseGLB(buf)');
  assert.strictEqual(m.F.length,1);assert.strictEqual(m.V.length,3);assert.ok(m.T&&m.T.length===3);
  const uvOf=p=>m.T[m.V.findIndex(q=>q[0]===p[0]&&q[1]===p[1]&&q[2]===p[2])];
  assert.deepStrictEqual(J([uvOf([0,0,0]),uvOf([10,0,0]),uvOf([0,10,0])]),[[0,1],[1,1],[0,0]]);
  assert.ok(m.img instanceof Blob,'img — Blob');assert.strictEqual(m.img.type,'image/png');assert.deepStrictEqual(Buffer.from(await m.img.arrayBuffer()),PNG);assert.strictEqual(m.why,undefined);});
test('parseGLB: текстура отдельным файлом (uri) — uv есть, картинки нет, why = uri; без материала — why = none; Draco — понятная ошибка',()=>{
  c.buf=glb(triJSON({uri:'shepherd.png'}),triBin(false));const m=run('parseGLB(buf)');assert.ok(m.T&&m.T.length===3);assert.strictEqual(m.img,undefined);assert.strictEqual(m.why,'uri');
  const j=triJSON({uri:'x.png'});delete j.meshes[0].primitives[0].material;delete j.materials;delete j.textures;delete j.images;c.buf=glb(j,triBin(false));const n=run('parseGLB(buf)');
  assert.strictEqual(n.img,undefined);assert.strictEqual(n.why,'none');assert.strictEqual(n.F.length,1);
  const d=triJSON({uri:'x.png'});d.extensionsUsed=['KHR_draco_mesh_compression'];c.buf=glb(d,triBin(false));assert.throws(()=>run('parseGLB(buf)'),/Draco/);});
test('parseGLB: две сетки (два узла, один со сдвигом) — склеены в одну: 2 треугольника, у второго индексы — свои точки, сдвиг узла учтён',()=>{
  const j=triJSON({bufferView:3,mimeType:'image/png'});j.scenes[0].nodes=[0,1];j.nodes.push({mesh:0,translation:[100,0,0]});c.buf=glb(j,triBin(true));const m=J(run('parseGLB(buf)'));
  assert.strictEqual(m.F.length,2);assert.strictEqual(m.V.length,6);assert.strictEqual(m.T.length,6);
  assert.deepStrictEqual(m.F[1].map(i=>m.V[i]),[[100,0,0],[110,0,0],[100,10,0]]);assert.deepStrictEqual(m.F[1].map(i=>m.T[i]),[[0,1],[1,1],[0,0]]);});
test('parseGLB: две сетки с разными картинками — текстуры нет (why = multi): калька по чужой развёртке была бы неверной',()=>{
  const j=triJSON({bufferView:3,mimeType:'image/png'});j.scenes[0].nodes=[0,1];j.nodes.push({mesh:1});j.meshes.push({primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:1}]});
  j.materials.push({pbrMetallicRoughness:{baseColorTexture:{index:1}}});j.textures.push({source:1});j.images.push({bufferView:3,mimeType:'image/png'});c.buf=glb(j,triBin(true));const m=run('parseGLB(buf)');
  assert.strictEqual(m.F.length,2);assert.strictEqual(m.img,undefined);assert.strictEqual(m.T,undefined);assert.strictEqual(m.why,'multi');});
test('parseGLB: сжатые данные (квантование, знаковые 5120 / 5122) — понятная ошибка, а не «Cannot read properties»',()=>{
  const j=triJSON({bufferView:3,mimeType:'image/png'});j.accessors[0].componentType=5122;j.accessors[0].normalized=true;c.buf=glb(j,triBin(true));
  assert.throws(()=>run('parseGLB(buf)'),/сжат.*OBJ/);});
