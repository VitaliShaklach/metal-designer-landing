// рабочая папка мастерской (studio/work): фигуры, история, настройки, «последняя открытая»
//   work/<slug>/figure.json — {type:'md-studio', v:1, name, kind, localOnly, H, V, P, S, keep, slots, refHalf}
//   work/<slug>/undo.json   — {undo: string[], redo: string[], k} (до 60 шагов; k — масштаб страницы при записи)
//   work/<slug>/ref/ref.json, ref/src/ — эталон; versions/NNN.json — сохранённые версии (задача 7)
//   work/settings.json = {th}, work/state.json = {last}
const fs=require('fs'),path=require('path');

const SLUG=/^[a-z0-9][a-z0-9-]*$/;
const dirOf=(work,slug)=>{if(!SLUG.test(slug))throw new Error('плохое имя папки фигуры');return path.join(work,slug);};
// запись в .tmp, потом rename: оборвалась посреди — на месте остаётся прежний целый файл
function writeAtomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,data);fs.renameSync(tmp,file);}
const readJSON=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){return null;}};
const okFigure=j=>j&&j.type==='md-studio'&&Array.isArray(j.V)&&Array.isArray(j.P);

// фигура из последнего целого состояния: figure.json → целый figure.json.tmp (свет выключился между записью и rename) → новейшая версия.
// Битый figure.json не пропадает: переименовывается в figure.broken-<время>.json, в ответе предупреждение
function readFigure(work,slug,quiet){const d=dirOf(work,slug),f=path.join(d,'figure.json');
  if(!fs.existsSync(f)&&!fs.existsSync(f+'.tmp'))throw new Error('нет такой фигуры: '+slug);
  let j=readJSON(f);if(okFigure(j))return {figure:j,warning:null};
  let warning=null,from=null;
  if(!quiet&&fs.existsSync(f)){const b=path.join(d,'figure.broken-'+Date.now()+'.json');fs.renameSync(f,b);warning='Файл фигуры был повреждён (сохранён как '+path.basename(b)+').';}
  j=readJSON(f+'.tmp');if(okFigure(j))from='последняя запись';
  else{j=null;const vd=path.join(d,'versions'),vs=fs.existsSync(vd)?fs.readdirSync(vd).filter(x=>/^\d+\.json$/.test(x)).sort().reverse():[];
    for(const v of vs){const x=readJSON(path.join(vd,v));if(okFigure(x)){j=x;from='версия '+v.replace('.json','');break;}}}
  if(!j)throw new Error('фигура повреждена, целой копии нет: '+slug);
  if(!quiet)writeAtomic(f,JSON.stringify(j));   // целая копия встаёт на место: в следующий раз файл читается без предупреждений
  return {figure:j,warning:(warning||'Файл фигуры не читался.')+' Открыта '+from+'.'};}
function readUndo(work,slug){const j=readJSON(path.join(dirOf(work,slug),'undo.json'));
  return {undo:Array.isArray(j&&j.undo)?j.undo:[],redo:Array.isArray(j&&j.redo)?j.redo:[],k:j&&+j.k||0};}
function saveFigure(work,slug,figure,hist){const d=dirOf(work,slug);if(!okFigure(figure))throw new Error('это не фигура мастерской');
  writeAtomic(path.join(d,'figure.json'),JSON.stringify(figure));
  hist=hist||{};writeAtomic(path.join(d,'undo.json'),JSON.stringify({undo:(hist.undo||[]).slice(-60),redo:(hist.redo||[]).slice(-60),k:hist.k||0}));}
function listFigures(work){if(!fs.existsSync(work))return [];
  return fs.readdirSync(work,{withFileTypes:true}).filter(e=>e.isDirectory()&&SLUG.test(e.name)).map(e=>{const f=path.join(work,e.name,'figure.json');let j=readJSON(f),m=null;
    try{m=fs.statSync(f).mtimeMs;}catch(x){}
    if(!okFigure(j)){try{j=readFigure(work,e.name,true).figure;}catch(x){return null;}}
    return {slug:e.name,name:j.name,kind:j.kind,localOnly:!!j.localOnly,mtime:m||0};}).filter(Boolean).sort((a,b)=>b.mtime-a.mtime);}
const stateFile=work=>path.join(work,'state.json'),settingsFile=work=>path.join(work,'settings.json');
const getLast=work=>(readJSON(stateFile(work))||{}).last||null;
const setLast=(work,slug)=>writeAtomic(stateFile(work),JSON.stringify({last:slug}));
// настройки порогов: set — поменять часть, reset — вернуть TH_DEFAULT; значения только числа и только известные ключи
function settings(work,o,TH_DEFAULT){o=o||{};let th=Object.assign({},TH_DEFAULT,(readJSON(settingsFile(work))||{}).th||{});
  if(o.reset)th=Object.assign({},TH_DEFAULT);
  else if(o.set){for(const k of Object.keys(o.set)){if(!(k in TH_DEFAULT)||typeof o.set[k]!=='number'||!isFinite(o.set[k]))throw new Error('плохая настройка: '+k);th[k]=o.set[k];}}
  if(o.reset||o.set)writeAtomic(settingsFile(work),JSON.stringify({th}));return th;}
// контуры открытых рёбер (глаза и т. п.) — номера точек по кругу; у рыси 14 это её прорези
function openLoops(P){const cnt=new Map();P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=a<b?a+'_'+b:b+'_'+a;(cnt.get(key)||cnt.set(key,[]).get(key)).push([a,b]);}));
  const nx=new Map();cnt.forEach(es=>{if(es.length===1)nx.set(es[0][1],es[0][0]);});   // против обхода грани
  const seen=new Set(),L=[];nx.forEach((_,s)=>{if(seen.has(s))return;const c=[];let v=s;while(v!==undefined&&!seen.has(v)){seen.add(v);c.push(v);v=nx.get(v);}if(c.length>=3&&v===s)L.push(c);});return L;}
module.exports={SLUG,writeAtomic,readFigure,readUndo,saveFigure,listFigures,getLast,setLast,settings,openLoops,okFigure,readJSON};
