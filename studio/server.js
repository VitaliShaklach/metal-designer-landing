// сервер мастерской: node studio/server.js [--port N] [--work DIR] [--no-open]  (npm run studio)
// Только 127.0.0.1. Отдаёт файлы репозитория (кроме рабочих папок и .git) и вкладывает в страницу рыси панель мастерской;
// команды /api/* принимает только от своей страницы: Origin и Host — наши, токен X-Studio-Token — случайный на каждый запуск.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const {STUDIO_JS,loadFigureEngine}=require('./lib/engine.js');
const names=require('./lib/names.js'),W=require('./lib/workdir.js'),{LYNX_REF}=require('./lib/sources.js');

const ROOT=path.join(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const MAX_BODY=64*1024*1024;
const inside=(abs,dir)=>{const r=path.relative(dir,abs);return r===''||(!r.startsWith('..')&&!path.isAbsolute(r));};

function createStudio({root=ROOT,work,port=8765,open=true}={}){
  root=path.resolve(root);work=path.resolve(work||path.join(root,'studio','work'));fs.mkdirSync(work,{recursive:true});
  const token=crypto.randomBytes(32).toString('hex'),hidden=[work,path.join(root,'studio','.wt'),path.join(root,'studio','work'),path.join(root,'studio','tests','.work')];
  let ENG=null;const eng=()=>ENG||(ENG=loadFigureEngine({studio:true}));
  const jobs=new Map();   // долгие операции (задачи 9, 10, 12): job → {stage, pct, done, error, result}
  let myPort=port;const hostOk=()=>'127.0.0.1:'+myPort,originOk=()=>'http://127.0.0.1:'+myPort;

  // опубликованные фигуры — <option> выпадашки «Фигура» на странице рыси
  function published(){const h=fs.readFileSync(path.join(root,'editor','lynx','index.html'),'utf8'),m=/<select id="figSel">([\s\S]*?)<\/select>/.exec(h);
    return m?[...m[1].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g)].map(x=>({id:x[1],name:x[2].replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')})):[];}
  const takenNames=()=>[...published().map(p=>p.name),...W.listFigures(work).map(f=>f.name)];

  // копия опубликованной фигуры под следующим свободным именем; у рыси 14 — с эталоном из LYNX_REF (если файл есть)
  function copyPublished(id){const pub=published().find(p=>p.id===id);if(!pub)throw new Error('нет такой опубликованной фигуры: '+id);
    const fig=eng().run(`(()=>{const f=FIGURES[${JSON.stringify(id)}],m=modelPoly(${JSON.stringify(id)});return {V:m.V,P:m.P,S:m.S||[],H:f.H||1000,kind:f.kind||'stand',slots:f.slots||null,keep:f.keep||[],th:f.th||null};})()`);
    const name=names.nextName(pub.name,takenNames()),slug=names.freeSlug(name,fs.readdirSync(work));   // занято всё, что лежит в папке, даже битое
    const figure={type:'md-studio',v:1,name,kind:fig.kind,localOnly:false,H:fig.H,V:fig.V,P:fig.P,S:fig.S,keep:fig.keep,slots:fig.slots||W.openLoops(fig.P),refHalf:'left'};
    if(fig.th)figure.th=fig.th;
    const d=path.join(work,slug);let ref=null,png=null;
    // эталон собираем до записи фигуры: не вышло — папки-сироты не остаётся
    if(id==='lynx14'&&fs.existsSync(LYNX_REF)){const {buildRef}=require('./lib/refbuild.js');png=LYNX_REF.replace(/\.obj$/i,'.png');if(!fs.existsSync(png))png=null;
      ref=buildRef(LYNX_REF,png,{half:'left',frame:'lynx14'});}
    W.saveFigure(work,slug,figure,{});
    if(ref){const hasPng=!!png;W.writeAtomic(path.join(d,'ref','ref.json'),JSON.stringify(ref));
      fs.mkdirSync(path.join(d,'ref','src'),{recursive:true});fs.copyFileSync(LYNX_REF,path.join(d,'ref','src',path.basename(LYNX_REF)));if(hasPng)fs.copyFileSync(png,path.join(d,'ref','src',path.basename(png)));}
    W.setLast(work,slug);return {slug};}

  const API={
    list:()=>({figures:W.listFigures(work),published:published(),last:W.getLast(work)}),
    open:b=>{const r=W.readFigure(work,b.slug),h=W.readUndo(work,b.slug),rf=path.join(work,b.slug,'ref','ref.json');W.setLast(work,b.slug);
      return {figure:r.figure,undo:h.undo,redo:h.redo,k:h.k,ref:fs.existsSync(rf)?W.readJSON(rf):null,warning:r.warning};},
    copy:b=>copyPublished(String(b.id)),
    save:b=>{if(!W.SLUG.test(String(b.slug)))throw new Error('плохое имя папки фигуры');W.saveFigure(work,b.slug,b.figure,{undo:b.undo,redo:b.redo,k:b.k});W.setLast(work,b.slug);return {ok:true};},
    settings:b=>({th:W.settings(work,b,eng().run('TH_DEFAULT'))}),
    job:b=>jobs.get(String(b.job))||{stage:'',pct:0,done:true,error:'нет такого задания',result:null}};

  function send(res,code,type,body){const b=Buffer.from(typeof body==='string'?body:JSON.stringify(body));res.writeHead(code,{'Content-Type':type,'Content-Length':b.length,'Cache-Control':'no-store'});res.end(b);}
  const json=(res,code,o)=>send(res,code,'application/json; charset=utf-8',o);
  const nope=res=>send(res,404,'text/plain; charset=utf-8','нет такого файла');

  function staticFile(req,res,url){let rel;try{rel=decodeURIComponent(url.pathname);}catch(e){return nope(res);}
    if(rel.includes('\0')||rel.includes('\\')||rel.split('/').includes('..'))return nope(res);
    let abs=path.resolve(root,'.'+path.posix.normalize('/'+rel));
    if(!inside(abs,root)||hidden.some(h=>inside(abs,h))||abs.split(path.sep).some(s=>s==='.git'||s==='node_modules'))return nope(res);
    let st;try{st=fs.statSync(abs);}catch(e){return nope(res);}
    if(st.isDirectory()){if(!url.pathname.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'});return res.end();}abs=path.join(abs,'index.html');try{st=fs.statSync(abs);}catch(e){return nope(res);}}
    const type=MIME[path.extname(abs).toLowerCase()]||'application/octet-stream';
    if(abs.toLowerCase()===path.join(root,'editor','lynx','index.html').toLowerCase()){let h=fs.readFileSync(abs,'utf8');
      const tags=`<script>STUDIO={token:${JSON.stringify(token)},port:${myPort}}</script>\n<link rel="stylesheet" href="/studio/ui/panel.css">\n`+STUDIO_JS.filter(f=>fs.existsSync(path.join(root,'studio','js',f+'.js'))).map(f=>`<script src="/studio/js/${f}.js"></script>`).join('\n')+'\n<script src="/studio/ui/panel.js"></script>\n';
      const i=h.lastIndexOf('</body>');h=i<0?h+tags:h.slice(0,i)+tags+h.slice(i);return send(res,200,type,h);}
    res.writeHead(200,{'Content-Type':type,'Content-Length':st.size,'Cache-Control':'no-store'});
    if(req.method==='HEAD')return res.end();fs.createReadStream(abs).pipe(res);}

  const server=http.createServer((req,res)=>{
    try{
      // DNS-rebinding: чужое имя в Host — на любой запрос 403
      if(req.headers.host!==hostOk())return json(res,403,{error:'чужой Host'});
      // URL() молча схлопывает /%2e%2e/ в корень; нам нужен отказ: «..» в любой записи пути — 404
      let raw;try{raw=decodeURIComponent(req.url.split('?')[0]);}catch(e){return nope(res);}
      if(raw.split(/[\\/]/).includes('..'))return nope(res);
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname.startsWith('/api/')){
        if(req.method!=='POST')return json(res,403,{error:'только POST'});
        if(req.headers.origin!==originOk())return json(res,403,{error:'чужой Origin'});
        const t=Buffer.from(String(req.headers['x-studio-token']||'')),T=Buffer.from(token);
        if(t.length!==T.length||!crypto.timingSafeEqual(t,T))return json(res,403,{error:'нет токена'});
        const fn=API[url.pathname.slice(5)];if(!fn)return json(res,404,{error:'нет такой команды'});
        const chunks=[];let n=0;
        req.on('data',c=>{n+=c.length;if(n>MAX_BODY){json(res,413,{error:'слишком большой запрос'});req.destroy();}else chunks.push(c);});
        req.on('end',()=>{if(res.writableEnded)return;let b={};try{const s=Buffer.concat(chunks).toString('utf8');b=s?JSON.parse(s):{};}catch(e){return json(res,400,{error:'не JSON'});}
          try{json(res,200,fn(b||{}));}catch(e){json(res,500,{error:e.message});}});
        return;}
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'только GET'});
      staticFile(req,res,url);
    }catch(e){try{json(res,500,{error:e.message});}catch(x){}}});

  return new Promise((resolve,reject)=>{server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{myPort=server.address().port;const url=`http://127.0.0.1:${myPort}/editor/lynx/`;
      if(open)openBrowser(url);
      resolve({url,token,port:myPort,server,jobs,close:()=>new Promise(r=>{if(server.closeAllConnections)server.closeAllConnections();server.close(()=>r());})});});});}

function openBrowser(url){try{const c=process.platform==='win32'?spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'});c.on('error',()=>{});c.unref();}catch(e){}}

if(require.main===module){const a=process.argv.slice(2),arg=(k,d)=>{const i=a.indexOf(k);return i>=0&&a[i+1]?a[i+1]:d;};
  createStudio({port:+arg('--port',8765),work:arg('--work',null)||undefined,open:!a.includes('--no-open')}).then(s=>console.log('Мастерская: '+s.url),e=>{console.error('Не запустилась: '+(e.code==='EADDRINUSE'?'порт занят (другой экземпляр мастерской?)':e.message));process.exit(1);});}
module.exports={createStudio};
