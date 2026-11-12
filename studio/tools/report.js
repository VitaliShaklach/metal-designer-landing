// отчёт Проверки по фигуре: node studio/tools/report.js <lynx14 | файл.json> [--ref <obj>] [--half left|right]
//   lynx14 — фигура сайта (MODELS_POLY); файл — «Сохранить» редактора (md-art) или figure.json мастерской (md-studio)
//   печатает таблицу «Правило | Сколько | Худшее» и строки замера спеки (раздел «Зачем»), всё в мм сайта
const fs=require('fs'),{loadFigureEngine}=require('../lib/engine.js');

function loadFigure(run,arg){
  if(/\.json$/i.test(arg)){const j=JSON.parse(fs.readFileSync(arg,'utf8'));if(!j.V||!j.P)throw new Error('в файле нет V и P: это не фигура из граней');
    return {name:j.name||arg,E:{V:j.V,P:j.P,S:j.S||[]},H:j.H||j.dims&&j.dims.H||1000,kind:j.kind||'stand',slots:j.slots,keep:j.keep,th:j.th};}
  if(!run(`typeof MODELS_POLY[${JSON.stringify(arg)}]!=='undefined'`))throw new Error('нет такой фигуры: '+arg+' (есть: '+run('Object.keys(MODELS_POLY).join(", ")')+')');
  const f=run(`FIGURES[${JSON.stringify(arg)}]||{}`);
  return {name:f.name||arg,E:run(`modelPoly(${JSON.stringify(arg)})`),H:f.H||1000,kind:f.kind||'stand',slots:f.slots,keep:f.keep,th:f.th};}

// замер спеки: те же величины, что в таблице «Зачем» (пары точек — все, и с ребром между ними; углы — без исключений правил)
function measure(run,E,sc){const V3=run('V3'),polyDev=run('polyDev'),V=E.V,P=E.P,dev=P.map(Q=>polyDev(V,Q)*sc);
  const ED=new Map();P.forEach(Q=>Q.forEach((a,k)=>{const b=Q[(k+1)%Q.length],key=a<b?a+'_'+b:b+'_'+a;ED.set(key,(ED.get(key)||0)+1);}));
  const len=[...ED.keys()].map(k=>{const [a,b]=k.split('_').map(Number);return V3.len(V3.sub(V[b],V[a]))*sc;});
  // углы — между сторонами грани в 3D, без знака (как в замере спеки: 67 / 149, углов больше 172° — 345)
  const ang=[];P.forEach(Q=>Q.forEach((v,k)=>{const a=V3.sub(V[Q[(k+Q.length-1)%Q.length]],V[v]),b=V3.sub(V[Q[(k+1)%Q.length]],V[v]);ang.push(Math.acos(Math.max(-1,Math.min(1,V3.dot(a,b)/(V3.len(a)*V3.len(b)||1))))*180/Math.PI);}));
  // пары ближе 8 мм — по сетке с ячейкой 8 мм, соседние ячейки
  let near=0;const R=8/sc,G=new Map(),key=p=>p.map(x=>Math.floor(x/R));V.forEach((p,i)=>{const k=key(p).join();(G.get(k)||G.set(k,[]).get(k)).push(i);});
  V.forEach((p,i)=>{const [x,y,z]=key(p);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)(G.get([x+dx,y+dy,z+dz].join())||[]).forEach(j=>{if(j>i&&V3.len(V3.sub(V[j],p))<R)near++;});});
  return {faces:P.length,verts:V.length,np017:dev.filter(d=>d>.17).length,np084:dev.filter(d=>d>.84).length,npMax:Math.max(0,...dev),
    e5:len.filter(l=>l<5).length,e17:len.filter(l=>l<17).length,a5:ang.filter(a=>a<5).length,a12:ang.filter(a=>a<12).length,
    straight:ang.filter(a=>a>172).length,near,open:[...ED.values()].filter(n=>n===1).length};}

const fmt=(x,d=2)=>String(+x.toFixed(d)).replace('.',',');
function report(arg,opt={}){const {run}=loadFigureEngine(),F=loadFigure(run,arg),sc=F.H/run('meshBox')(F.E.V).size[1];
  const t0=Date.now(),iss=run('checkFigure')(F.E,{scale:sc,kind:F.kind,slots:F.slots,keep:F.keep,th:F.th}),dt=Date.now()-t0;
  const RULES=run('RULES'),LOW=run('RULE_LOW'),lines=[];
  lines.push(`Фигура «${F.name}»: высота на сайте ${F.H} мм, scale ${fmt(sc,4)}, ${F.kind==='wall'?'настенная':'стоящая'}; Проверка — ${dt} мс`);
  if(opt.ref)lines.push(`Эталон ${opt.ref}${opt.half?' ('+opt.half+')':''}: похожесть (правило 11) и эталон в правиле 7 подключит задача 2 — пока без эталона`);
  lines.push('','Правило | Сколько | Худшее','---|---|---');
  RULES.forEach(r=>{const own=iss.filter(i=>i.rule===r.n&&!i.info),info=iss.filter(i=>i.rule===r.n&&i.info);
    if(r.n===11){lines.push(`${r.n}. ${r.title} | — | эталон — задача 2`);return;}
    if(r.n===17){lines.push(`${r.n}. ${r.title} | — | при публикации`);return;}
    const w=own.length?own.reduce((a,b)=>LOW.has(r.n)?(b.val<a.val?b:a):(b.val>a.val?b:a)).text:'';
    lines.push(`${r.n}. ${r.title} | ${own.length}${info.length?' (+ сведений '+info.length+')':''} | ${w}`);});
  const m=measure(run,F.E,sc);
  lines.push('','Замер (как в спеке, мм сайта):',
    `Граней / точек: ${m.faces} / ${m.verts}`,
    `Неплоские грани: больше 0,17 мм / больше 0,84 мм / худшая: ${m.np017} / ${m.np084} / ${fmt(m.npMax)} мм`,
    `Рёбра короче 5 мм / короче 17 мм: ${m.e5} / ${m.e17}`,
    `Углы граней меньше 5° / меньше 12°: ${m.a5} / ${m.a12}`,
    `Точки почти на прямой (углов граней больше 172°): ${m.straight}`,
    `Пары точек ближе 8 мм: ${m.near}`,
    `Открытые рёбра: ${m.open}`);
  return {text:lines.join('\n'),issues:iss,measure:m};}

if(require.main===module){const a=process.argv.slice(2),opt={},pos=[];
  for(let i=0;i<a.length;i++){if(a[i]==='--ref')opt.ref=a[++i];else if(a[i]==='--half')opt.half=a[++i];else pos.push(a[i]);}
  if(!pos[0]){console.error('как: node studio/tools/report.js <lynx14 | файл.json> [--ref <obj>] [--half left|right]');process.exit(2);}
  try{console.log(report(pos[0],opt).text);}catch(e){console.error(e.message);process.exit(1);}}
module.exports={report,measure};
