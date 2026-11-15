// автоматика по фигуре → черновик: node studio/tools/auto.js <lynx14 | файл.json> [--ref <obj>] [--half left|right] [--frame meshy|lynx14] [--name "Рысь 2"] --out <файл.json>
//   Фигура — как у report.js: фигура сайта (MODELS_POLY) или файл «Сохранить» редактора / figure.json мастерской.
//   Цикл автоматики (studio/js/auto.js autoClean) со швами S на всех рёбрах; прорези — из фигуры, а нет — контуры открытых рёбер (как сервер мастерской).
//   --out — черновик в формате «Сохранить» редактора (md-art): его открывает кнопка «Открыть модель» на странице editor/lynx/.
//   Печатает «было → стало»: строки Проверки по правилам, замер спеки, похожесть на эталон, причины отказов.
const fs=require('fs'),{loadFigureEngine}=require('../lib/engine.js'),{openLoops}=require('../lib/workdir.js');
const {measure,loadFigure,loadRef,refLine,similarity,simLines,fmt}=require('./report.js');

function auto(arg,opt={}){const {run}=loadFigureEngine(),F=loadFigure(run,arg),sc=F.H/run('meshBox')(F.E.V).size[1],name=opt.name||F.name;
  const {R,half,frame}=loadRef(run,arg,opt);
  const E0=run('addAllSeams')({V:F.E.V,P:F.E.P,S:F.E.S||[]});
  const o={scale:sc,kind:F.kind,slots:F.slots||openLoops(E0.P),keep:F.keep,th:F.th,ref:R,seams:true,skip:opt.skip,onStep:opt.onStep};
  const t0=Date.now(),r=run('autoClean')(E0,o),dt=Date.now()-t0,E1=run('compact')(r.E);
  const RULES=run('RULES'),done=r.log.filter(l=>l.done),left=r.log.filter(l=>!l.done),lines=[];
  lines.push(`Фигура «${F.name}» → «${name}»: высота на сайте ${F.H} мм, ${F.kind==='wall'?'настенная':'стоящая'}; автоматика — ${Math.round(dt/1000)} с, проходов ${r.rounds}, починено ${done.length}, осталось ${left.length}`);
  if(R)lines.push(refLine(R,opt.ref,half,frame));
  else lines.push('Эталона нет (--ref): похожесть меряется от исходной фигуры');
  lines.push('','Правило | Было | Стало','---|---|---');
  RULES.forEach(x=>{if(x.n===17)return;lines.push(`${x.n}. ${x.title} | ${r.before[x.n]||0} | ${r.after[x.n]||0}`);});
  const s15=c=>[1,2,3,4,5].reduce((s,n)=>s+(c[n]||0),0),b15=s15(r.before),a15=s15(r.after);
  lines.push(`Правила 1–5 вместе | ${b15} | ${a15}${b15?' ('+fmt(a15/b15*100,0)+' % от исходного)':''}`);
  const m0=measure(run,E0,sc),m1=measure(run,E1,sc),ab=(a,b)=>a===b?String(a):a+' → '+b;
  lines.push('','Замер (как в спеке, мм сайта), было → стало:',
    `Граней / точек: ${m0.faces} / ${m0.verts} → ${m1.faces} / ${m1.verts}`,
    `Неплоские грани: больше 0,17 мм / больше 0,84 мм / худшая: ${m0.np017} / ${m0.np084} / ${fmt(m0.npMax)} мм → ${m1.np017} / ${m1.np084} / ${fmt(m1.npMax)} мм`,
    `Рёбра короче 5 мм / короче 17 мм: ${m0.e5} / ${m0.e17} → ${m1.e5} / ${m1.e17}`,
    `Углы граней меньше 5° / меньше 12°: ${m0.a5} / ${m0.a12} → ${m1.a5} / ${m1.a12}`,
    `Точки почти на прямой (углов граней больше 172°): ${ab(m0.straight,m1.straight)}`,
    `Пары точек ближе 8 мм: ${ab(m0.near,m1.near)}`,
    `Открытые рёбра: ${ab(m0.open,m1.open)}`);
  let sim=null;
  if(R){sim=[similarity(run,E0,R,sc,half),similarity(run,E1,R,sc,half)];
    lines.push('','Похожесть на эталон (мм сайта), было:',...simLines(sim[0],half),'стало:',...simLines(sim[1],half));}
  if(done.length)lines.push('',`Наибольший сдвиг точки при починке: ${fmt(Math.max(...done.map(l=>l.moved)))} мм; наибольший уход изменённой грани от ${R?'эталона':'исходной фигуры'}: ${fmt(Math.max(...done.map(l=>l.dev)))} мм`);
  // причины отказов: по правилу, одинаковые (без чисел) — вместе
  const why=new Map();left.forEach(l=>{const k=l.issue.rule+'|'+l.why.replace(/ \(было \d+, стало \d+\)/g,'').replace(/\d+(,\d+)? (мм|°)/g,'… $2');why.set(k,(why.get(k)||0)+1);});
  if(why.size){lines.push('','Что осталось и почему (правило: мест — причина):');
    [...why.entries()].sort((a,b)=>parseInt(a[0])-parseInt(b[0])||b[1]-a[1]).forEach(([k,n])=>{const [rule,w]=k.split('|');lines.push(`${rule}: ${n} — ${w}`);});}
  if(opt.out){const b=run('meshBox')(E1.V),r2=x=>Math.round(x*100)/100;
    // размеры — как редактор считает их сам по высоте (dimsFromH): ширина и глубина округлены до мм
    // треугольники — как их построит редактор при открытии; вырожденная грань (правило 14 осталось) их ломает — сказать прямо
    let F;try{F=run('polyBase')(E1.V,E1.P,E1.S).F;}catch(e){throw new Error('черновик не записан: в фигуре остались вырожденные грани (правило 14) — '+e.message);}
    const j={type:'md-art',v:1,name,dims:{W:Math.round(b.size[0]*sc),H:r2(b.size[1]*sc),D:Math.round(b.size[2]*sc)},
      V:E1.V.map(p=>p.map(x=>r2(x*sc))),F,P:E1.P,S:E1.S};
    fs.writeFileSync(opt.out,JSON.stringify(j));lines.push('',`Черновик «${name}»: ${opt.out} — открыть кнопкой «Открыть модель» на странице editor/lynx/`);}
  return {text:lines.join('\n'),result:r,E:E1,scale:sc,ms:dt,similarity:sim};}

if(require.main===module){const a=process.argv.slice(2),opt={},pos=[];
  for(let i=0;i<a.length;i++){const k=/^--(ref|half|frame|name|out)$/.exec(a[i]);if(k)opt[k[1]]=a[++i];else pos.push(a[i]);}
  if(!pos[0]||!opt.out){console.error('как: node studio/tools/auto.js <lynx14 | файл.json> [--ref <obj>] [--half left|right] [--frame meshy|lynx14] [--name "Рысь 2"] --out <файл.json>');process.exit(2);}
  let n=0,t=Date.now();opt.onStep=s=>{n++;if(Date.now()-t>5000){t=Date.now();process.stderr.write(`проход ${s.round+1}, правило ${s.rule}: попыток ${n}, починено ${s.fixed}\n`);}};
  try{console.log(auto(pos[0],opt).text);}catch(e){console.error(e.message);process.exit(1);}}
module.exports={auto};
