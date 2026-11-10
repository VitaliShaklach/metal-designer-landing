/* ---------- кнопка «Рассчитать»: общая для всех изделий редактора (мангал, рысь, …), про изделие ничего не знает ----------
   Тяжёлый расчёт (раскрой, чертежи, карты) идёт только по кнопке. Результат держится, пока не поменялся ключ задания:
   изменение, от которого расчёт не поменялся бы (вращение, размеры на модели, галочки вида), результат не трогает.
   btn — кнопка «Рассчитать»; box — куда ставится результат; save — кнопка (или список кнопок) скачивания результата, активна только с ним;
   wait — индикатор, виден, пока идёт расчёт; key() — ключ задания (строка); run(done, live) — расчёт изделия:
   в конце done(html) — true, если результат принят (не устарел); по ходу можно спрашивать live() — false, если расчёт уже не нужен (тогда бросить). */
function makeCalc({btn,box,save,wait,key,run}){
  const saves=[].concat(save||[]);
  let have=null,   // ключ показанного результата; null — результата нет
    job=null;      // идущий расчёт {k}; null — не идёт
  const show=()=>{btn.disabled=!!job||have!==null;btn.textContent=job?'Считаю…':'Рассчитать';if(wait)wait.hidden=!job;saves.forEach(b=>{b.disabled=have===null;});};
  // клик: свежий результат уже есть или расчёт идёт — ничего; иначе считаем. Результат принимается, только если расчёт не брошен
  // и ключ задания за время счёта не поменялся (детали могли поменять до того, как изделие позвало check)
  function start(){if(job)return;const k=key();if(have===k)return;
    const me=job={k};have=null;box.innerHTML='';show();
    const done=html=>{if(job!==me)return false;job=null;if(key()!==k){stale();return false;}have=k;box.innerHTML=html;show();return true;};
    try{run(done,()=>job===me);}catch(e){if(job===me)stale();throw e;}}
  // убрать результат и бросить идущий расчёт: кнопка снова активна, скачивать нечего
  function stale(){have=null;job=null;box.innerHTML='';show();}
  // что-то поменялось: ключ другой — результат (или идущий расчёт) устарел. Нет ни того, ни другого — сравнивать нечего,
  // key() не зовём (он бывает дорогим). k — ключ, если изделие его уже посчитало
  function check(k){const was=job?job.k:have;if(was===null)return;if((k===undefined?key():k)!==was)stale();}
  btn.addEventListener('click',start);
  show();
  return {stale,check,
    ready:()=>have!==null,          // показан свежий результат
    held:()=>have!==null||!!job};}  // есть что сравнивать: результат или идущий расчёт
