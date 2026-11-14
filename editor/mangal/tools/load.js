// стенд для тестов редактора мангала: все скрипты страницы (и общий calc.js) в vm, Three.js и DOM — пустышки.
// THREE.Shape/Path — простые заглушки с точками (как mkReal в smoke.js), чтобы контуры деталей были настоящими.
const fs=require('fs'),vm=require('vm'),path=require('path');
const P=path.join(__dirname,'..');
const FILES=['params','parts','model','dims','cut','dxf','engrave','nest','sheet-kit','views','sheets','cards','ui'];
const mk=()=>{const U=new Proxy(function(){},{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>0;if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;return U;},apply:()=>U,construct:()=>U,set:()=>true});return U;};
class SPath{constructor(){this.pts=[];this.curves=[];this.holes=[];}moveTo(x,y){this.pts.push({x,y});}lineTo(x,y){const l=this.pts[this.pts.length-1];if(!l||l.x!==x||l.y!==y)this.pts.push({x,y});}
  absarc(x,y,r){this.curves=[{isEllipseCurve:true,aX:x,aY:y,xRadius:r}];}getPoints(){return this.pts;}}

// flags — галочки страницы (как ?flags= в ссылке), например {mode:'grill',skew:true}
// real — настоящий three.js из vendor/ (карты деталей считают швы по телам модели); WebGL в Node нет, поэтому ok = false, как на телефоне без 3D
function loadMangal(flags={},{real=false}={}){
  const U=mk(),TH=real?null:new Proxy({Shape:SPath,Path:SPath},{get:(t,k)=>k in t?t[k]:U});
  const ctx={__U:U,document:U,window:{addEventListener:()=>{}},
    location:{hash:'',href:'http://x/',search:'?view=1,1,1,0,0,0&flags='+encodeURIComponent(JSON.stringify(flags))},
    addEventListener:()=>{},requestAnimationFrame:()=>{},ResizeObserver:U,MutationObserver:U,devicePixelRatio:1,performance:{now:()=>0},navigator:U,
    ...(real?{}:{THREE:TH}),URLSearchParams,console,Math,JSON,Set,Map,Object,Array,Number,String,Symbol,setTimeout,clearTimeout};
  vm.createContext(ctx);
  if(real){vm.runInContext(fs.readFileSync(path.join(P,'../../vendor/three/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
    vm.runInContext('THREE.WebGLRenderer=function(){throw new Error("no webgl");};',ctx);}
  // классические скрипты делят одну лексическую область — склеиваем
  vm.runInContext([P+'/../common/calc.js',...FILES.map(f=>P+'/js/'+f+'.js')].map(f=>fs.readFileSync(f,'utf8')).join('\n;\n'),ctx,{filename:'mangal.js'});
  // без WebGL ui.js флаги ссылки не применяет (они нужны только модели на экране) — ставим сами
  if(real){ctx.__flags=flags;vm.runInContext('Object.assign(S,__flags);recompute();',ctx);}
  return ctx;}

// поля «Лазер · DXF» как на странице (колосник на листе снят, подрезка 10, полосы гильотины слева) и память браузера ls — {ключ: значение}
function page(ctx,ls={}){const mem=Object.fromEntries(Object.entries(ls).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
  ctx.__mem=mem;ctx.__els={nGap:{value:'5'},nSheet:{value:'1250x2500'},nCgr:{checked:false},nEdge:{value:'10'},nCorner:{value:'lb'}};
  run(ctx,`(()=>{const on=new Map(),D0=document,el=id=>{const e=__els[id];if(!e)return D0.getElementById(id);e.addEventListener=e.addEventListener||((t,f)=>on.set(id+':'+t,f));return e;};
    localStorage={getItem:k=>k in __mem?__mem[k]:null,setItem:(k,v)=>{__mem[k]=String(v);}};
    document=new Proxy({},{get:(t,k)=>k==='getElementById'?el:D0[k]});
    NST.init=false;nestInit();})()`);}

// выражение в области скриптов мангала; результат — копия через JSON, чтобы assert.deepEqual сравнивал обычные объекты
function run(ctx,expr){const v=vm.runInContext(expr,ctx);return v===undefined?v:JSON.parse(JSON.stringify(v));}

module.exports={loadMangal,run,page};
