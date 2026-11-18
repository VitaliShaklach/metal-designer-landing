// собирает примеры: навес 3×2 по текстовому описанию; пишет examples/*.json и js/examples.js. node tools/make-examples.js
const fs=require('fs'),vm=require('vm'),path=require('path');const P=path.join(__dirname,'..');
const c={console,Math,JSON,Set,Map,Object,Array,Number,String};vm.createContext(c);
vm.runInContext(['profiles','model'].map(f=>fs.readFileSync(P+'/js/'+f+'.js','utf8')).join('\n;\n'),c);
vm.runInContext(`M=emptyModel();M.meta.name='Навес 3×2 м';
M.meta.note='навес 3×2 м, столбы 60×60, высота 2100 спереди и 2394 сзади, фермы из 40×40, стыки под 45°, 2 одинаковые фермы, крыша — профнастил';
M.groups=[{id:'g1',name:'Ферма',qty:1,mirror:false},{id:'g2',name:'Обвязка и прогоны',qty:1,mirror:false}];
const W=3000,D=2000,HF=2100,HB=2394;
[30,W-30].forEach(x=>{const b0=addNode(x,0,30),b1=addNode(x,HB-20,30),f0=addNode(x,0,D-30),f1=addNode(x,HF-20,D-30);
  addMember(b0.id,b1.id,'60x60x2','g1');addMember(f0.id,f1.id,'60x60x2','g1');addMember(b1.id,f1.id,'40x40x1.5','g1');});
const top=z=>{const t=(z-30)/(D-60);return HB-20+(HF-HB)*t;};
// обвязка поверху между столбами (сзади и спереди)
[[30,HB-20],[D-30,HF-20]].forEach(([z,y])=>addMember(addNode(30,y,z).id,addNode(W-30,y,z).id,'40x40x1.5','g2'));
// прогоны на стропилах: 3 шт, лежат сверху, во всю ширину
[120,D/2,D-120].forEach(z=>{const y=Math.round(top(z)+40);addMember(addNode(0,y,z).id,addNode(W,y,z).id,'40x40x1.5','g2');});`,c);
const naves=JSON.parse(vm.runInContext('JSON.stringify(M)',c));
fs.writeFileSync(P+'/examples/naves-3x2.json',JSON.stringify(naves));
// МК-16: целиком и по сборкам — их собирает tools/make-mk16.js
const keys=['mk16','mk16-1','mk16-2','mk16-3','mk16-4-1','mk16-4-2','mk16-4-3','mk16-4-4','mk16-4-5','mk16-4-6','mk16-5'];
const ex={};keys.forEach(k=>ex[k]=JSON.parse(fs.readFileSync(P+'/examples/'+k+'.json','utf8')));ex['naves-3x2']=naves;
fs.writeFileSync(P+'/js/examples.js','/* примеры моделей (собраны tools/make-examples.js из examples/*.json) */\nconst EXAMPLES='+JSON.stringify(ex)+';\n');
vm.runInContext('console.log(positions().map(p=>`${p.no} ${p.prof} L${p.L} ${p.ang.join("/")}° ×${p.total}`).join(" | "))',c);
