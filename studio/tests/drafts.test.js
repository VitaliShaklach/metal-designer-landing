// «Сохранить версию» и ветка drafts (studio/lib/git.js, drafts.js): node --test studio/tests/drafts.test.js
// Всё — на своём временном репозитории: git init с одним коммитом, origin — git init --bare в соседней временной папке.
// Настоящий репозиторий и сеть тесты не трогают: перед каждым saveVersion проверяем, что origin — временная папка.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const W=require('../lib/workdir.js'),{git}=require('../lib/git.js'),{saveVersion,ensureWorktree}=require('../lib/drafts.js');
const ROOT=path.join(__dirname,'..','..');
const ENV=Object.assign({},process.env,{GIT_TERMINAL_PROMPT:'0'});for(const k of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR'])delete ENV[k];
const sh=(cwd,...a)=>execFileSync('git',a,{cwd,env:ENV,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const og=(R,...a)=>sh(R.base,'--git-dir='+R.origin,...a);   // в bare-origin — только явно (safe.bareRepository=explicit)
const fig=(name,o)=>Object.assign({type:'md-studio',v:1,name,kind:'stand',localOnly:false,H:1000,V:[[0,0,0],[1,0,0],[1,1,0]],P:[[0,1,2]],S:[],keep:[],slots:[],refHalf:'left'},o||{});
const same=(a,b)=>{const n=p=>path.resolve(p).toLowerCase();return n(a)===n(b);};

// временный «репозиторий Виталия»: master с одним коммитом, текущая ветка figure-studio, незакоммиченная правка и новый файл; origin — bare рядом
const TMP=[];
function mkRepo(){const base=fs.mkdtempSync(path.join(os.tmpdir(),'studio-drafts-'));TMP.push(base);
  const repo=path.join(base,'repo'),origin=path.join(base,'origin.git'),work=path.join(base,'work');fs.mkdirSync(repo);fs.mkdirSync(work);
  sh(repo,'init','-q','-b','master');sh(repo,'config','user.name','Тест');sh(repo,'config','user.email','test@example.invalid');sh(repo,'config','core.autocrlf','false');
  fs.writeFileSync(path.join(repo,'.gitignore'),'studio/work/\nstudio/.wt/\n');fs.writeFileSync(path.join(repo,'README.md'),'сайт\n');
  sh(repo,'add','-A');sh(repo,'commit','-q','-m','начало');
  sh(base,'init','-q','--bare','origin.git');sh(repo,'remote','add','origin',origin);sh(repo,'push','-q','origin','master');
  sh(repo,'checkout','-q','-b','figure-studio');
  fs.writeFileSync(path.join(repo,'README.md'),'сайт, правка Виталия\n');fs.writeFileSync(path.join(repo,'wip.txt'),'не закоммичено\n');
  return {base,repo,origin,work};}
test.after(()=>{for(const d of TMP)fs.rmSync(d,{recursive:true,force:true});});
// что в рабочей папке и ветках до и после: не должно меняться
const snap=R=>({master:sh(R.repo,'rev-parse','master'),originMaster:og(R,'rev-parse','master'),branch:sh(R.repo,'rev-parse','--abbrev-ref','HEAD'),head:sh(R.repo,'rev-parse','HEAD'),status:sh(R.repo,'status','--porcelain')});
// предохранитель: origin временного репозитория — во временной папке, а сам он — не настоящий репозиторий
function safe(R){const url=sh(R.repo,'remote','get-url','origin');assert.ok(url===R.origin||!fs.existsSync(url)&&url.startsWith(R.base),'origin — временная папка: '+url);
  assert.ok(!same(sh(R.repo,'rev-parse','--show-toplevel'),ROOT),'не настоящий репозиторий');}
const save=(R,slug)=>{safe(R);return saveVersion(R.repo,R.work,slug);};
const files=(R,ref='drafts')=>og(R,'ls-tree','-r','--name-only',ref).split('\n').filter(Boolean);
const remoteDrafts=R=>sh(R.repo,'ls-remote','--heads','origin','drafts');
// фигура-копия опубликованной: эталон лежит в ref/src/
function rys(R){W.saveFigure(R.work,'rys-2',fig('Рысь 2'),{});const s=path.join(R.work,'rys-2','ref','src');fs.mkdirSync(s,{recursive:true});
  fs.writeFileSync(path.join(s,'lynx.obj'),'v 0 0 0\nv 1 0 0\nv 1 1 0\nf 1 2 3\n');W.writeAtomic(path.join(R.work,'rys-2','ref','ref.json'),'{}');}

test('git: код, вывод и ошибка; в чужой папке и по таймауту не виснет', async () => {
  const R=mkRepo();
  const v=await git(['rev-parse','--abbrev-ref','HEAD'],{cwd:R.repo});assert.equal(v.code,0);assert.equal(v.out.trim(),'figure-studio');
  const bad=await git(['rev-parse','--verify','нет-такой'],{cwd:R.repo});assert.notEqual(bad.code,0);assert.ok(bad.err.length>0);
  const none=await git(['status'],{cwd:path.join(R.base,'нет-такой-папки')});assert.notEqual(none.code,0);   // папки нет — ошибка, а не исключение
  const t0=Date.now(),slow=await git(['-c','alias.zz=!sleep 5','zz'],{cwd:R.repo,timeout:300});
  assert.notEqual(slow.code,0);assert.ok(slow.timedOut);assert.ok(Date.now()-t0<3000,'таймаут сработал: '+(Date.now()-t0)+' мс');
});

test('первая версия: в origin появилась drafts, в ней только figures/rys-2/…; master, текущая ветка и git status прежние', async () => {
  const R=mkRepo();rys(R);const before=snap(R);assert.equal(remoteDrafts(R),'');
  const r=await save(R,'rys-2');
  assert.equal(r.n,1);assert.equal(r.pushed,true,r.msg);assert.match(r.msg,/отправлена в облако/);
  assert.ok(fs.existsSync(path.join(R.work,'rys-2','versions','001.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(R.work,'rys-2','versions','001.json'),'utf8')).name,'Рысь 2');
  assert.notEqual(remoteDrafts(R),'');
  const F=files(R);assert.ok(F.length>0&&F.every(f=>f.startsWith('figures/rys-2/')),F.join(', '));
  assert.deepEqual(F.sort(),['figures/rys-2/figure.json','figures/rys-2/ref/src/lynx.obj','figures/rys-2/versions/001.json']);   // undo.json и ref.json — только на диске
  assert.equal(og(R,'log','-1','--format=%s','drafts'),'Черновик: Рысь 2 v1');
  assert.equal(og(R,'show','drafts:figures/rys-2/figure.json'),fs.readFileSync(path.join(R.work,'rys-2','versions','001.json'),'utf8'));   // figure.json в облаке — снимок этой версии
  assert.equal(og(R,'rev-list','--count','drafts'),'1');assert.throws(()=>og(R,'merge-base','master','drafts'));   // сирота: общей истории с master нет
  assert.deepEqual(snap(R),before);
  assert.ok(!fs.existsSync(path.join(R.repo,'studio','.wt','drafts','README.md')),'в копии drafts файлов master нет');
});

test('только на этом компе: в drafts ничего, версия на диске, сообщение', async () => {
  const R=mkRepo();W.saveFigure(R.work,'doberman',fig('Доберман',{localOnly:true,kind:'wall'}),{});fs.mkdirSync(path.join(R.work,'doberman','src'));fs.writeFileSync(path.join(R.work,'doberman','src','doberman.obj'),'v 0 0 0\n');
  const before=snap(R),r=await save(R,'doberman');
  assert.equal(r.n,1);assert.equal(r.pushed,false);assert.equal(r.local,true);assert.match(r.msg,/Только на этом компе: в облако не отправляю/);
  assert.ok(fs.existsSync(path.join(R.work,'doberman','versions','001.json')));
  assert.equal(remoteDrafts(R),'');assert.equal(sh(R.repo,'branch','--list','drafts'),'');assert.equal(sh(R.repo,'worktree','list').split('\n').length,1);   // и ветку не завели
  assert.deepEqual(snap(R),before);
  // рядом с обычной фигурой: drafts есть, добермана в ней нет
  rys(R);assert.equal((await save(R,'rys-2')).pushed,true);assert.equal((await save(R,'doberman')).n,2);
  assert.ok(files(R).every(f=>f.startsWith('figures/rys-2/')));
});

test('нет сети: pushed:false и сообщение; origin починили — следующая версия уносит обе', async () => {
  const R=mkRepo();rys(R);sh(R.repo,'remote','set-url','origin',path.join(R.base,'нет-такого-origin.git'));
  const r1=await save(R,'rys-2');
  assert.equal(r1.n,1);assert.equal(r1.pushed,false);assert.match(r1.msg,/Версия 1 на диске\. Отправлю в облако при следующем сохранении \(git: .+\)/);assert.ok(!r1.local);
  assert.ok(fs.existsSync(path.join(R.work,'rys-2','versions','001.json')));
  sh(R.repo,'remote','set-url','origin',R.origin);assert.equal(remoteDrafts(R),'');
  const r2=await save(R,'rys-2');assert.equal(r2.n,2);assert.equal(r2.pushed,true,r2.msg);
  const F=files(R);assert.ok(F.includes('figures/rys-2/versions/001.json')&&F.includes('figures/rys-2/versions/002.json'),F.join(', '));
});

test('нет сети после первой отправки: черновик ждёт в копии drafts и уходит со следующим', async () => {
  const R=mkRepo();rys(R);assert.equal((await save(R,'rys-2')).pushed,true);
  sh(R.repo,'remote','set-url','origin',path.join(R.base,'нет-такого-origin.git'));
  const r2=await save(R,'rys-2');assert.equal(r2.pushed,false);assert.match(r2.msg,/Отправлю в облако при следующем сохранении/);
  sh(R.repo,'remote','set-url','origin',R.origin);
  assert.equal((await save(R,'rys-2')).pushed,true);
  assert.deepEqual(files(R).filter(f=>f.includes('/versions/')),['figures/rys-2/versions/001.json','figures/rys-2/versions/002.json','figures/rys-2/versions/003.json']);
  assert.equal(og(R,'log','--format=%s','drafts'),'Черновик: Рысь 2 v3\nЧерновик: Рысь 2 v2\nЧерновик: Рысь 2 v1');
});

test('название не меняется после трёх версий; копия drafts одна', async () => {
  const R=mkRepo();rys(R);
  for(let i=1;i<=3;i++){const r=await save(R,'rys-2');assert.equal(r.n,i);assert.equal(r.pushed,true,r.msg);}
  assert.equal(W.readFigure(R.work,'rys-2').figure.name,'Рысь 2');
  for(const v of ['001','002','003'])assert.equal(JSON.parse(fs.readFileSync(path.join(R.work,'rys-2','versions',v+'.json'),'utf8')).name,'Рысь 2');
  assert.equal(JSON.parse(og(R,'show','drafts:figures/rys-2/figure.json')).name,'Рысь 2');
  assert.equal(sh(R.repo,'worktree','list').split('\n').length,2);   // рабочая папка + studio/.wt/drafts
});

test('новый комп: drafts есть только в origin — копия берётся оттуда, не сиротой', async () => {
  const R=mkRepo();rys(R);assert.equal((await save(R,'rys-2')).pushed,true);
  sh(R.repo,'worktree','remove','--force',path.join(R.repo,'studio','.wt','drafts'));sh(R.repo,'branch','-D','drafts');
  const r=await save(R,'rys-2');assert.equal(r.pushed,true,r.msg);
  assert.equal(og(R,'rev-list','--count','drafts'),'2');
});

test('в облаке drafts новее (другой комп): своё переставляется поверх и уходит; правки той же фигуры не сходятся — понятный отказ', async () => {
  const R=mkRepo();rys(R);assert.equal((await save(R,'rys-2')).pushed,true);
  const other=path.join(R.base,'other');sh(R.base,'clone','-q','-c','core.autocrlf=false','-b','drafts',R.origin,'other');sh(other,'config','user.name','Т');sh(other,'config','user.email','t@example.invalid');sh(other,'config','core.autocrlf','false');
  const push=(file,text)=>{sh(other,'pull','-q','--rebase');fs.mkdirSync(path.dirname(path.join(other,file)),{recursive:true});fs.writeFileSync(path.join(other,file),text);sh(other,'add','-A');sh(other,'commit','-q','-m','с другого компа');sh(other,'push','-q','origin','drafts');};
  push('figures/byk/figure.json','{}');   // другая фигура — сходится
  const r=await save(R,'rys-2');assert.equal(r.pushed,true,r.msg);
  const F=files(R);assert.ok(F.includes('figures/byk/figure.json')&&F.includes('figures/rys-2/versions/002.json'),F.join(', '));
  push('figures/rys-2/figure.json','{"с другого":1}');   // та же фигура, и здесь её тоже правили — не сходится
  W.saveFigure(R.work,'rys-2',fig('Рысь 2',{V:[[0,0,0],[2,0,0],[2,2,0]]}),{});
  const r3=await save(R,'rys-2');assert.equal(r3.pushed,false);assert.match(r3.msg,/Версия 3 на диске\. В облако не ушла: .*новее.*не сходятся/);
  const wt=path.join(R.repo,'studio','.wt','drafts'),gd=path.resolve(wt,sh(wt,'rev-parse','--git-dir'));
  assert.ok(!fs.existsSync(path.join(gd,'rebase-merge'))&&!fs.existsSync(path.join(gd,'rebase-apply')),'перестановка снята');
  assert.equal(sh(wt,'status','--porcelain'),'');
  const r4=await save(R,'rys-2');assert.equal(r4.n,4);assert.equal(r4.pushed,false);   // и дальше ничего не ломается
});

test('ensureWorktree: чужая папка на месте копии — отказ, ничего не удалено', async () => {
  const R=mkRepo(),dir=path.join(R.repo,'studio','.wt','drafts');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'моё.txt'),'x');
  await assert.rejects(ensureWorktree(R.repo,'drafts',dir,{orphan:true,remote:'origin'}),/занята/);
  assert.ok(fs.existsSync(path.join(dir,'моё.txt')));
  // не корень репозитория (папка внутри него) — в облако не идём
  rys(R);const r=await saveVersion(path.join(R.repo,'studio'),R.work,'rys-2');assert.equal(r.pushed,false);assert.match(r.msg,/не корень/);
  // репозитория нет (так запущен сервер e2e, --repo на несуществующую папку) — версия на диске, git дальше не идёт
  const r2=await saveVersion(path.join(R.base,'нет-такой-папки'),R.work,'rys-2');assert.equal(r2.n,2);assert.equal(r2.pushed,false);assert.match(r2.msg,/Версия 2 на диске\. В облако не ушла: не git-репозиторий/);
  assert.equal(sh(R.repo,'branch','--list','drafts'),'');
});

test('сервер: /api/version пишет версию и отправляет в drafts временного репозитория', async () => {
  const R=mkRepo();rys(R);safe(R);
  const {createStudio}=require('../server.js'),S=await createStudio({work:R.work,repo:R.repo,port:0,open:false});
  const post=(cmd,body)=>fetch(S.url.replace('/editor/lynx/','/api/'+cmd),{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:'+S.port,'X-Studio-Token':S.token},body:JSON.stringify(body)});
  try{const r=await post('version',{slug:'rys-2'});assert.equal(r.status,200);const j=await r.json();assert.equal(j.n,1);assert.equal(j.pushed,true,j.msg);
    assert.ok(files(R).includes('figures/rys-2/versions/001.json'));
    // две версии подряд — по очереди, без драки за git
    const [a,b]=await Promise.all([post('version',{slug:'rys-2'}),post('version',{slug:'rys-2'})].map(p=>p.then(x=>x.json())));
    assert.deepEqual([a.n,b.n].sort(),[2,3]);assert.ok(a.pushed&&b.pushed,a.msg+' / '+b.msg);
    assert.equal((await post('version',{slug:'../x'})).status,500);assert.equal((await post('version',{slug:'net-takoy'})).status,500);
  }finally{await S.close();}
});
