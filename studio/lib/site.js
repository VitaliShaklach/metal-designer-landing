// сайт для нескольких фигур: запись фигуры мастерской в файлы страницы рыси и снятие обратно
//   listPublished(dir) → {id, name}[]            порядок — как <option> в выпадашке «Фигура»
//   newId(ids) → 'fig1' | 'fig2' …                id не зависит от названия
//   checkName(name, published) → название          пустое или занятое — понятный отказ (исключение)
//   writeFigure(dir, fig, {stamp}) → string[]     изменённые файлы (пути от dir); фигура — последняя строка выпадашки
//   removeFigure(dir, id) → string[]              последнюю фигуру с сайта не снять
// dir — корень репозитория (или его копия): editor/lynx/index.html, editor/lynx/js/plates-<id>.js, editor/index.html
const fs=require('fs'),path=require('path');

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const unesc=s=>String(s).replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
// строка в тексте .js: JSON, но без «</» (закрыло бы <script> в любом разборе) и без U+2028/2029
const jsStr=s=>JSON.stringify(String(s)).replace(/<\//g,'<\\/').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const norm=s=>String(s).trim().replace(/\s+/g,' ').toLowerCase().replace(/ё/g,'е');
const ID=/^[a-z][a-z0-9]*$/;

const lynxIndex=dir=>path.join(dir,'editor','lynx','index.html'),homeIndex=dir=>path.join(dir,'editor','index.html'),platesFile=(dir,id)=>path.join(dir,'editor','lynx','js','plates-'+id+'.js');
const SELECT=/(<select id="figSel">)([\s\S]*?)(<\/select>)/;
const eolOf=t=>t.includes('\r\n')?'\r\n':'\n';

function listPublished(dir){const m=SELECT.exec(fs.readFileSync(lynxIndex(dir),'utf8'));if(!m)throw new Error('в editor/lynx/index.html нет выпадашки «Фигура»');
  return [...m[2].matchAll(/<option value="([^"]+)"[^>]*>([^<]*)<\/option>/g)].map(x=>({id:x[1],name:unesc(x[2])}));}
function newId(ids){const t=new Set(ids);for(let n=1;;n++)if(!t.has('fig'+n))return 'fig'+n;}
function checkName(name,published){const n=String(name==null?'':name).trim().replace(/\s+/g,' ');
  if(!n)throw new Error('Название не может быть пустым');
  if(n.length>60)throw new Error('Название длиннее 60 знаков');
  if(/[\u0000-\u001f\u2028\u2029]/.test(n))throw new Error('В названии есть служебные символы');
  const taken=(published||[]).map(p=>typeof p==='string'?p:p.name);
  if(taken.some(t=>norm(t)===norm(n)))throw new Error('Фигура «'+n+'» уже есть на сайте — выберите другое название');
  return n;}

// карточка главной редактора: при двух фигурах и больше — «Фигуры», при одной — её название
function setCard(dir,list){const f=homeIndex(dir),t=fs.readFileSync(f,'utf8'),re=/(<a class="card card-lynx"[^>]*>[\s\S]*?<h2>)([^<]*)(<\/h2>)/;
  if(!re.test(t))return false;const h=list.length>=2?'Фигуры':esc(list[0].name),r=t.replace(re,(_,a,x,c)=>a+h+c);if(r===t)return false;fs.writeFileSync(f,r);return true;}

// центры прорезей в долях габарита: на этих местах нужны подложки (решение 13 спеки), на остальных открытых контурах — нет
function slotCenters(V,slots){const mn=[1e18,1e18,1e18],mx=[-1e18,-1e18,-1e18];V.forEach(p=>p.forEach((x,k)=>{if(x<mn[k])mn[k]=x;if(x>mx[k])mx[k]=x;}));
  return (slots||[]).filter(L=>L.length).map(L=>{const c=[0,0,0];L.forEach(i=>V[i].forEach((x,k)=>c[k]+=x/L.length));return c.map((x,k)=>Math.round((x-mn[k])/((mx[k]-mn[k])||1)*1e6)/1e6);});}

function writeFigure(dir,fig,o){o=o||{};const id=fig.id;if(!ID.test(id||''))throw new Error('Плохой id фигуры: '+id);
  const pub=listPublished(dir);if(pub.some(p=>p.id===id)||fs.existsSync(platesFile(dir,id)))throw new Error('Фигура с id '+id+' уже есть');
  const name=checkName(fig.name,pub);
  const V=fig.V,P=fig.P,S=fig.S||[],K=100,flat=[];
  V.forEach(p=>p.forEach(x=>flat.push(Math.round(x*K))));
  const pl=[];P.forEach(Q=>{Q.forEach(i=>pl.push(i));pl.push(-1);});
  const sl=[];S.forEach(([a,b])=>sl.push(a,b));
  const pts=slotCenters(V,fig.slots),back=pts.length?`c=>${JSON.stringify(pts)}.some(q=>Math.hypot(c[0]-q[0],c[1]-q[1],c[2]-q[2])<.05)`:'c=>false';
  const js=`/* фигура мастерской (studio/lib/site.js): V — мм×100, P — углы граней, -1 — конец грани, S — швы */\n`
    +`MODELS_POLY.${id}={k:${K},V:${JSON.stringify(flat)},P:${JSON.stringify(pl)},S:${JSON.stringify(sl)}};\n`
    +`FIGURES.${id}={name:${jsStr(name)},H:${+fig.H||1000},poly:true,studio:true,kind:${jsStr(fig.kind||'stand')},slots:${JSON.stringify(fig.slots||[])},keep:${JSON.stringify(fig.keep||[])},th:${JSON.stringify(fig.th||null)},backIf:${back},build:()=>modelPoly(${jsStr(id)})};\n`;
  const changed=[],rel=f=>path.relative(dir,f).split(path.sep).join('/');
  // страница: сначала собираем новый текст (не вышло — ничего не записано), потом пишем файлы: тег после последнего plates-*.js, строка — последняя в выпадашке
  const f=lynxIndex(dir);let t=fs.readFileSync(f,'utf8');const eol=eolOf(t),d=new Date(),p2=n=>String(n).padStart(2,'0'),stamp=o.stamp||`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
  const tags=[...t.matchAll(/^[ \t]*<script src="js\/plates-[^"]+"><\/script>\r?\n/gm)];if(!tags.length)throw new Error('в editor/lynx/index.html нет тегов plates-*.js');
  const last=tags[tags.length-1],at=last.index+last[0].length;
  t=t.slice(0,at)+`<script src="js/plates-${id}.js?v=${stamp}"></script>`+eol+t.slice(at);
  t=t.replace(SELECT,(_,a,b,c)=>a+b+`<option value="${id}">${esc(name)}</option>`+c);
  fs.writeFileSync(platesFile(dir,id),js);changed.push(rel(platesFile(dir,id)));
  fs.writeFileSync(f,t);changed.push(rel(f));
  if(setCard(dir,listPublished(dir)))changed.push(rel(homeIndex(dir)));
  return changed;}

function removeFigure(dir,id){const pub=listPublished(dir);if(!pub.some(p=>p.id===id))throw new Error('На сайте нет фигуры '+id);
  if(pub.length<=1)throw new Error('Последнюю фигуру с сайта не снять');
  const changed=[],rel=f=>path.relative(dir,f).split(path.sep).join('/'),f=lynxIndex(dir);let t=fs.readFileSync(f,'utf8');
  const tag=new RegExp('^[ \\t]*<script src="js/plates-'+id+'\\.js[^"]*"></script>\\r?\\n','m');if(!tag.test(t))throw new Error('в editor/lynx/index.html нет тега plates-'+id+'.js');
  t=t.replace(tag,'').replace(SELECT,(_,a,b,c)=>a+b.replace(new RegExp('<option value="'+id+'">[^<]*</option>'),'')+c);
  fs.writeFileSync(f,t);changed.push(rel(f));
  if(fs.existsSync(platesFile(dir,id))){fs.unlinkSync(platesFile(dir,id));changed.push(rel(platesFile(dir,id)));}
  if(setCard(dir,listPublished(dir)))changed.push(rel(homeIndex(dir)));
  return changed;}

module.exports={listPublished,newId,checkName,writeFigure,removeFigure,esc};
