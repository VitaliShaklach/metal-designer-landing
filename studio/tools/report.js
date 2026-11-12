// отчёт Проверки по фигуре: node studio/tools/report.js <lynx14 | файл.json> [--ref <obj>] [--half left|right] [--frame meshy|lynx14]
//   lynx14 — фигура сайта (MODELS_POLY); файл — «Сохранить» редактора (md-art) или figure.json мастерской (md-studio)
//   печатает таблицу «Правило | Сколько | Худшее» и строки замера спеки (раздел «Зачем»), всё в мм сайта.
//   --ref — эталон (OBJ Meshy; текстура — PNG рядом с тем же именем): правило 11, эталон в правиле 7 и похожесть по половине, как замер 10.11 спеки:
//   точки — медиана, 90 %, дальше 2 мм; грани дальше 0,5 / 1 / 1,5 / 2 мм. Половина по умолчанию левая; рамка — lynx14 у рыси 14, иначе meshy
const fs=require('fs'),{loadFigureEngine}=require('../lib/engine.js'),{buildRef}=require('../lib/refbuild.js');

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
  const half=opt.half||'left',frame=opt.frame||(arg==='lynx14'?'lynx14':'meshy'),png=opt.ref&&/\.obj$/i.test(opt.ref)?opt.ref.replace(/\.obj$/i,'.png'):null;
  const R=opt.ref?run('refIndex')(buildRef(opt.ref,png&&fs.existsSync(png)?png:null,{half,frame})):null;
  const t0=Date.now(),iss=run('checkFigure')(F.E,{scale:sc,kind:F.kind,slots:F.slots,keep:F.keep,th:F.th,ref:R}),dt=Date.now()-t0;
  const RULES=run('RULES'),LOW=run('RULE_LOW'),lines=[];
  lines.push(`Фигура «${F.name}»: высота на сайте ${F.H} мм, scale ${fmt(sc,4)}, ${F.kind==='wall'?'настенная':'стоящая'}; Проверка — ${dt} мс`);
  if(R)lines.push(`Эталон ${opt.ref}: ${half==='left'?'левая':'правая'} половина и её зеркало, рамка ${frame}, ${R.T?'калька из текстуры':'без текстуры (линий нет)'}`);
  lines.push('','Правило | Сколько | Худшее','---|---|---');
  RULES.forEach(r=>{const own=iss.filter(i=>i.rule===r.n&&!i.info),info=iss.filter(i=>i.rule===r.n&&i.info);
    if(r.n===11&&!R){lines.push(`${r.n}. ${r.title} | — | нет эталона (--ref)`);return;}
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
  // похожесть по половине (её точки и грани; refHalf — из зеркальной пары грань этой стороны и грани поперёк середины)
  let sim=null;
  if(R){const s=half==='right'?-1:1,pts=F.E.V.filter(p=>s*p[0]<=0).map(p=>run('refDist')(R,p)*sc).sort((a,b)=>a-b),D=run('faceDev')(F.E,R,sc),hf=run('refHalf')(F.E,half);
    const side=half==='left'?'левой':'правой';
    sim={median:pts[pts.length>>1],p90:pts[Math.min(pts.length-1,Math.floor(pts.length*.9))],far2:pts.filter(d=>d>2).length,points:pts.length,faces:hf.length,far:[.5,1,1.5,2].map(t=>hf.filter(i=>D[i]>t).length)};
    lines.push('','Похожесть на эталон (мм сайта):',
      `Точки ${side} половины: медиана ${fmt(sim.median)} мм, 90 % — до ${fmt(sim.p90)} мм, дальше 2 мм — ${sim.far2} из ${sim.points}`,
      `Грани ${side} половины дальше 0,5 / 1 / 1,5 / 2 мм: ${sim.far.join(' / ')} из ${sim.faces}`);}
  return {text:lines.join('\n'),issues:iss,measure:m,similarity:sim};}

if(require.main===module){const a=process.argv.slice(2),opt={},pos=[];
  for(let i=0;i<a.length;i++){if(a[i]==='--ref')opt.ref=a[++i];else if(a[i]==='--half')opt.half=a[++i];else if(a[i]==='--frame')opt.frame=a[++i];else pos.push(a[i]);}
  if(!pos[0]){console.error('как: node studio/tools/report.js <lynx14 | файл.json> [--ref <obj>] [--half left|right] [--frame meshy|lynx14]');process.exit(2);}
  try{console.log(report(pos[0],opt).text);}catch(e){console.error(e.message);process.exit(1);}}
module.exports={report,measure};
