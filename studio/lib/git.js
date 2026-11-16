// git для мастерской: git(args, {cwd, timeout}) → Promise<{code, out, err, timedOut}>. Без оболочки, без новых пакетов.
// Никогда не спрашивает пароль в консоли (GIT_TERMINAL_PROMPT=0) и не висит дольше timeout (по умолчанию 60 с): процесс снимается, code = -1.
// GIT_DIR и родня из окружения убраны: команда работает ровно в репозитории папки cwd.
// Папки нет или git не запустился — тоже ответ, а не исключение: code = -1, причина в err.
const {spawn}=require('child_process');
const DROP=['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_NAMESPACE','GIT_PREFIX'];
function git(args,{cwd,timeout=60000}={}){
  const env=Object.assign({},process.env,{GIT_TERMINAL_PROMPT:'0'});for(const k of DROP)delete env[k];
  return new Promise(resolve=>{let out='',err='',done=false,timer=0,ch;
    const end=r=>{if(done)return;done=true;clearTimeout(timer);resolve(r);};
    try{ch=spawn('git',args,{cwd,env,stdio:['ignore','pipe','pipe'],windowsHide:true});}catch(e){return end({code:-1,out:'',err:e.message,timedOut:false});}
    ch.stdout.setEncoding('utf8');ch.stderr.setEncoding('utf8');
    ch.stdout.on('data',s=>{out+=s;});ch.stderr.on('data',s=>{err+=s;});
    ch.on('error',e=>end({code:-1,out,err:err||e.message,timedOut:false}));
    ch.on('close',code=>end({code:code===null?-1:code,out,err,timedOut:false}));
    // по таймауту не ждём close: дочерние процессы git (sh, ssh, git-remote-https) могут держать вывод открытым.
    // На Windows kill снимает только git.exe — снимаем всё дерево, иначе дети держат замки index.lock и веток
    const kill=()=>{try{if(process.platform==='win32'&&ch.pid){const t=spawn('taskkill',['/pid',String(ch.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});t.on('error',()=>{try{ch.kill();}catch(e){}});}else ch.kill();}catch(e){}};
    timer=setTimeout(()=>{kill();end({code:-1,out,err:err+'\ngit не ответил за '+Math.round(timeout/1000)+' с',timedOut:true});},timeout);});}
module.exports={git};
