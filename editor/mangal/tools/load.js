// стенд для тестов редактора мангала: все скрипты страницы в vm, Three.js и DOM — пустышки.
// THREE.Shape/Path — простые заглушки с точками (как mkReal в smoke.js), чтобы контуры деталей были настоящими.
const fs=require('fs'),vm=require('vm'),path=require('path');
const P=path.join(__dirname,'..');
const FILES=['params','parts','model','dims','cut','dxf','nest','ui'];
const mk=()=>{const U=new Proxy(function(){},{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>0;if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;return U;},apply:()=>U,construct:()=>U,set:()=>true});return U;};
class SPath{constructor(){this.pts=[];this.curves=[];this.holes=[];}moveTo(x,y){this.pts.push({x,y});}lineTo(x,y){const l=this.pts[this.pts.length-1];if(!l||l.x!==x||l.y!==y)this.pts.push({x,y});}
  absarc(x,y,r){this.curves=[{isEllipseCurve:true,aX:x,aY:y,xRadius:r}];}getPoints(){return this.pts;}}

// flags — галочки страницы (как ?flags= в ссылке), например {mode:'grill',skew:true}
function loadMangal(flags={}){
  const U=mk(),TH=new Proxy({Shape:SPath,Path:SPath},{get:(t,k)=>k in t?t[k]:U});
  const ctx={THREE:TH,__U:U,document:U,window:{addEventListener:()=>{}},
    location:{hash:'',href:'http://x/',search:'?view=1,1,1,0,0,0&flags='+encodeURIComponent(JSON.stringify(flags))},
    addEventListener:()=>{},requestAnimationFrame:()=>{},ResizeObserver:U,MutationObserver:U,devicePixelRatio:1,performance:{now:()=>0},navigator:U,
    URLSearchParams,console,Math,JSON,Set,Map,Object,Array,Number,String,Symbol,setTimeout,clearTimeout};
  vm.createContext(ctx);
  // классические скрипты делят одну лексическую область — склеиваем
  vm.runInContext(FILES.map(f=>fs.readFileSync(P+'/js/'+f+'.js','utf8')).join('\n;\n'),ctx,{filename:'mangal.js'});
  return ctx;}

// выражение в области скриптов мангала; результат — копия через JSON, чтобы assert.deepEqual сравнивал обычные объекты
function run(ctx,expr){const v=vm.runInContext(expr,ctx);return v===undefined?v:JSON.parse(JSON.stringify(v));}

module.exports={loadMangal,run};
