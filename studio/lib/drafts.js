// «Сохранить версию» (задача 7): versions/NNN.json на диске и копия фигуры в ветку drafts — облако на случай поломки компа.
// Ветка drafts живёт в отдельной копии <repo>/studio/.wt/drafts (git worktree): рабочая папка Виталия, её ветка, master и git status не трогаются.
// Сайт собирается только из master — drafts он не видит. Фигуры «только на этом компе» (localOnly) в облако не уходят никогда.
//   saveVersion(repo, work, slug) → Promise<{n, pushed, local?, msg, why?}>; local — фигура «только на этом компе»
//   ensureWorktree(repo, branch, dir, {orphan, remote}) — копия ветки в dir: уже есть — берётся; ветка есть здесь или в remote — от неё; нет нигде — сирота
const fs=require('fs'),path=require('path'),W=require('./workdir.js'),{git}=require('./git.js');

const NET=90000;   // push, fetch, ls-remote: без сети git отвечает быстро, но не дольше этого
const OFFLINE='Отправлю в облако при следующем сохранении',LOCAL='Только на этом компе: в облако не отправляю';
const pad=n=>String(n).padStart(3,'0');
// один и тот же путь? (Windows: регистр и косые не важны; ссылки и короткие имена раскрываются)
const real=p=>{p=path.resolve(p);try{p=fs.realpathSync.native(p);}catch(e){}return process.platform==='win32'?p.toLowerCase():p;};
const same=(a,b)=>real(a)===real(b);
const fail=(msg,o)=>Object.assign(new Error(msg),o||{});
const first=s=>(String(s||'').split('\n').map(x=>x.trim()).find(Boolean)||'');

// копии веток репозитория: [{path, branch}] (branch — refs/heads/…, у отцепленных '')
async function worktrees(repo){const r=await git(['worktree','list','--porcelain'],{cwd:repo});if(r.code)throw fail('git worktree list: '+first(r.err));
  return r.out.split(/\r?\n\r?\n/).map(b=>{const w={path:'',branch:''};b.split(/\r?\n/).forEach(l=>{if(l.startsWith('worktree '))w.path=l.slice(9);else if(l.startsWith('branch '))w.branch=l.slice(7);});return w;}).filter(w=>w.path);}
const hasRef=async(cwd,ref)=>(await git(['rev-parse','--verify','--quiet',ref],{cwd})).code===0;

async function ensureWorktree(repo,branch,dir,o={}){const ref='refs/heads/'+branch;
  await git(['worktree','prune'],{cwd:repo});   // папку копии удалили руками — запись о ней снимается
  const list=await worktrees(repo),here=list.find(w=>same(w.path,dir));
  if(here){if(here.branch!==ref)throw fail(`в ${dir} открыта не ветка ${branch}`);return {dir,created:false};}
  if(fs.existsSync(dir)&&fs.readdirSync(dir).length)throw fail(`папка ${dir} занята: это не копия ветки ${branch}. Уберите её`);
  const other=list.find(w=>w.branch===ref);if(other)throw fail(`ветка ${branch} уже открыта в ${other.path}`);
  fs.mkdirSync(path.dirname(dir),{recursive:true});
  const add=async a=>{const r=await git(['worktree','add','-q',...a],{cwd:repo});if(r.code)throw fail('git worktree add: '+first(r.err));return {dir,created:true};};
  if(await hasRef(repo,ref))return add([dir,branch]);
  if(o.remote){   // новый комп: ветка уже есть в облаке — копия от неё (сирота потом не запушится поверх)
    const ls=await git(['ls-remote','--heads',o.remote,branch],{cwd:repo,timeout:NET});if(ls.code)throw fail(first(ls.err),{offline:true});
    if(ls.out.trim()){const rr=`refs/remotes/${o.remote}/${branch}`,f=await git(['fetch','-q',o.remote,`+${ref}:${rr}`],{cwd:repo,timeout:NET});
      if(f.code)throw fail(first(f.err),{offline:true});return add(['-b',branch,dir,rr]);}}
  if(!o.orphan)throw fail(`ветки ${branch} нет`);
  const r=await git(['worktree','add','-q','--orphan','-b',branch,dir],{cwd:repo});
  if(r.code)throw fail('git worktree add --orphan (нужен git 2.42 или новее): '+first(r.err));
  return {dir,created:true};}

// следующий номер версии: 001, 002…; занятые номера не переиспользуются
function nextN(vd){let m=0;if(fs.existsSync(vd))for(const f of fs.readdirSync(vd)){const x=/^(\d+)\.json$/.exec(f);if(x)m=Math.max(m,+x[1]);}return m+1;}

// копия фигуры в drafts:figures/<slug>/ — figure.json (= снимок этой версии, а не живой файл: автосохранение могло уйти дальше), все versions/*.json
// и исходник (src/, у копий опубликованных — ref/src/); пути как в рабочей папке
async function sendDraft(repo,d,slug,message,snap){
  const top=await git(['rev-parse','--show-toplevel'],{cwd:repo});
  if(top.code)throw fail('не git-репозиторий: '+repo);if(!same(top.out.trim(),repo))throw fail('не корень репозитория: '+repo);
  const wt=path.join(repo,'studio','.wt','drafts');await ensureWorktree(repo,'drafts',wt,{orphan:true,remote:'origin'});
  const run=async(a,o)=>{const r=await git(a,Object.assign({cwd:wt},o));if(r.code)throw fail('git '+a[0]+': '+first(r.err));return r;};
  // прошлый раз оборвался посреди — в копии ничего лишнего
  await git(['rebase','--abort'],{cwd:wt});   // брошенная перестановка (её нет — git просто откажет)
  if(await hasRef(wt,'HEAD'))await run(['reset','-q','--hard']);else await run(['read-tree','--empty']);
  await run(['clean','-fdq']);
  const dest=path.join(wt,'figures',slug);fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(path.join(dest,'versions'),{recursive:true});
  fs.writeFileSync(path.join(dest,'figure.json'),snap);
  for(const f of fs.readdirSync(path.join(d,'versions')))if(/^\d+\.json$/.test(f))fs.copyFileSync(path.join(d,'versions',f),path.join(dest,'versions',f));
  for(const s of ['src',path.join('ref','src')])if(fs.existsSync(path.join(d,s))){fs.cpSync(path.join(d,s),path.join(dest,s),{recursive:true});break;}
  await run(['add','-A','--','figures/'+slug]);
  if((await git(['diff','--cached','--quiet'],{cwd:wt})).code===1)await run(['commit','-q','-m',message]);
  // и все прошлые черновики, что не ушли без сети
  const push=()=>git(['push','-q','origin','drafts'],{cwd:wt,timeout:NET}),offline=r=>fail(first(r.err),{offline:true});
  let p=await push();if(!p.code)return;
  if(!/rejected|non-fast-forward|fetch first/i.test(p.err))throw offline(p);
  // в облаке drafts ушла вперёд (версии с другого компа): наши черновики переставляются поверх и уходят.
  // Правки одной фигуры не сходятся — отказ, перестановка снята, черновики ждут в копии
  const f=await git(['fetch','-q','origin','+refs/heads/drafts:refs/remotes/origin/drafts'],{cwd:wt,timeout:NET});if(f.code)throw offline(f);
  const rb=await git(['rebase','-q','origin/drafts'],{cwd:wt});
  if(rb.code){await git(['rebase','--abort'],{cwd:wt});throw fail('в облаке ветка drafts новее, чем на этом компе, и правки не сходятся',{why:first(rb.err||rb.out)});}
  p=await push();if(p.code)throw offline(p);}

async function saveVersion(repo,work,slug){
  const {figure}=W.readFigure(work,slug),d=path.join(work,slug),vd=path.join(d,'versions'),n=nextN(vd),snap=JSON.stringify(figure);
  W.writeAtomic(path.join(vd,pad(n)+'.json'),snap);
  if(figure.localOnly)return {n,pushed:false,local:true,msg:`Версия ${n} на диске. ${LOCAL}`};
  try{await sendDraft(repo,d,slug,`Черновик: ${figure.name} v${n}`,snap);return {n,pushed:true,msg:`Версия ${n} сохранена и отправлена в облако`};}
  // без сети — и причина от git: если это не сеть (пароль, нет origin), Виталий увидит, что само не пройдёт
  catch(e){return {n,pushed:false,msg:`Версия ${n} на диске. `+(e.offline?OFFLINE+(e.message?' (git: '+e.message+')':''):'В облако не ушла: '+e.message),why:e.why||e.message};}}

module.exports={saveVersion,ensureWorktree};
