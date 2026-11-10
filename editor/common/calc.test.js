// кнопка «Рассчитать» (calc.js) без браузера: элементы страницы — простые заглушки, изделие — ключ задания и расчёт, которые задаёт тест
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),vm=require('vm'),path=require('path');

const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'calc.js'),'utf8'),ctx,{filename:'calc.js'});
const makeCalc=ctx.makeCalc;

// элемент страницы: свойства, которые трогает модуль, и клик как у кнопки (неактивная не нажимается)
function el(){const on={};return {disabled:false,hidden:false,textContent:'',innerHTML:'',
  addEventListener(t,f){(on[t]=on[t]||[]).push(f);},
  click(){if(!this.disabled)(on.click||[]).forEach(f=>f());}};}

// изделие: ключ задания меняет тест; расчёт не заканчивается сам — тест завершает его через finish(html)
function setup(){const page={btn:el(),box:el(),save:el(),wait:el()},job={key:'A',runs:0,pending:null};
  const calc=makeCalc({...page,key:()=>job.key,run:(done,live)=>{job.runs++;job.pending={done,live};}});
  const finish=html=>job.pending.done(html);
  return {page,job,calc,finish};}

test('до «Рассчитать» результата нет, кнопка активна, скачивать нечего', ()=>{
  const {page,job,calc}=setup();
  assert.equal(page.box.innerHTML,'');
  assert.equal(page.btn.disabled,false);
  assert.equal(page.btn.textContent,'Рассчитать');
  assert.equal(page.save.disabled,true);
  assert.equal(page.wait.hidden,true);
  assert.equal(job.runs,0);
  assert.equal(calc.ready(),false);
});

test('клик — идёт расчёт: кнопка неактивна, «Считаю…», индикатор виден', ()=>{
  const {page,job}=setup();
  page.btn.click();
  assert.equal(job.runs,1);
  assert.equal(page.btn.disabled,true);
  assert.equal(page.btn.textContent,'Считаю…');
  assert.equal(page.wait.hidden,false);
});

test('расчёт закончен — результат на месте, индикатор скрыт, скачивание активно, кнопка неактивна', ()=>{
  const {page,calc,finish}=setup();
  page.btn.click();finish('<svg>лист</svg>');
  assert.equal(page.box.innerHTML,'<svg>лист</svg>');
  assert.equal(page.wait.hidden,true);
  assert.equal(page.save.disabled,false);
  assert.equal(page.btn.disabled,true);
  assert.equal(page.btn.textContent,'Рассчитать');
  assert.equal(calc.ready(),true);
});

test('ключ задания поменялся — результат убран, кнопка снова активна, скачивать нечего', ()=>{
  const {page,job,calc,finish}=setup();
  page.btn.click();finish('<svg>лист</svg>');
  job.key='B';calc.check();
  assert.equal(page.box.innerHTML,'');
  assert.equal(page.btn.disabled,false);
  assert.equal(page.btn.textContent,'Рассчитать');
  assert.equal(page.save.disabled,true);
  assert.equal(calc.ready(),false);
  page.btn.click();
  assert.equal(job.runs,2);
});

test('ключ тот же (вращение, галочки вида) — результат остаётся, кнопка неактивна', ()=>{
  const {page,calc,finish}=setup();
  page.btn.click();finish('<svg>лист</svg>');
  calc.check();
  assert.equal(page.box.innerHTML,'<svg>лист</svg>');
  assert.equal(page.btn.disabled,true);
  assert.equal(calc.ready(),true);
});

test('ключ можно передать готовым: изделие уже посчитало задание', ()=>{
  const {page,calc,finish}=setup();
  page.btn.click();finish('<svg>лист</svg>');
  calc.check('A');
  assert.equal(calc.ready(),true);
  calc.check('B');
  assert.equal(calc.ready(),false);
  assert.equal(page.box.innerHTML,'');
});

test('результата нет — сравнивать нечего: ключ задания не считается', ()=>{
  const {page,job,calc}=setup();
  let asked=0;const k0=Object.getOwnPropertyDescriptor(job,'key');
  Object.defineProperty(job,'key',{get(){asked++;return k0.value;}});
  calc.check();
  assert.equal(asked,0);
  assert.equal(calc.held(),false);
  assert.equal(page.btn.disabled,false);
});

test('детали поменяли во время счёта — расчёт брошен, его результат не показывается, кнопка активна', ()=>{
  const {page,job,calc,finish}=setup();
  page.btn.click();
  assert.equal(calc.held(),true);
  assert.equal(job.pending.live(),true);
  job.key='B';calc.check();
  assert.equal(job.pending.live(),false);
  assert.equal(page.btn.disabled,false);
  assert.equal(page.wait.hidden,true);
  finish('<svg>старый лист</svg>');
  assert.equal(page.box.innerHTML,'');
  assert.equal(page.btn.disabled,false);
  assert.equal(page.save.disabled,true);
  assert.equal(calc.ready(),false);
});

test('детали поменяли под конец счёта, сравнить не успели — устаревший результат всё равно не показывается', ()=>{
  const {page,job,calc,finish}=setup();
  page.btn.click();job.key='B';
  finish('<svg>старый лист</svg>');
  assert.equal(page.box.innerHTML,'');
  assert.equal(page.btn.disabled,false);
  assert.equal(page.wait.hidden,true);
  assert.equal(calc.ready(),false);
});

test('во время счёта ключ тот же — счёт продолжается', ()=>{
  const {page,job,calc,finish}=setup();
  page.btn.click();calc.check();
  assert.equal(job.pending.live(),true);
  assert.equal(page.btn.textContent,'Считаю…');
  assert.equal(calc.ready(),false);
  finish('<svg>лист</svg>');
  assert.equal(calc.ready(),true);
});

test('расчёт упал — кнопка снова активна, индикатор скрыт', ()=>{
  const page={btn:el(),box:el(),save:el(),wait:el()};
  makeCalc({...page,key:()=>'A',run:()=>{throw new Error('сломалось');}});
  assert.throws(()=>page.btn.click(),/сломалось/);
  assert.equal(page.btn.disabled,false);
  assert.equal(page.btn.textContent,'Рассчитать');
  assert.equal(page.wait.hidden,true);
});

test('кнопок скачивания может быть несколько или ни одной, индикатора может не быть', ()=>{
  const btn=el(),box=el(),a=el(),b=el();
  let fin;makeCalc({btn,box,save:[a,b],key:()=>'A',run:d=>{fin=d;}});
  assert.deepEqual([a.disabled,b.disabled],[true,true]);
  btn.click();fin('x');
  assert.deepEqual([a.disabled,b.disabled],[false,false]);
  const c=makeCalc({btn:el(),box:el(),key:()=>'A',run:d=>d('y')});
  assert.equal(c.ready(),false);
});

test('пока результат свежий, повторный клик ничего не считает', ()=>{
  const {page,job,finish}=setup();
  page.btn.click();page.btn.click();
  assert.equal(job.runs,1);
  finish('<svg>лист</svg>');
  page.btn.disabled=false;page.btn.click();   // даже если кнопку как-то нажали
  assert.equal(job.runs,1);
  assert.equal(page.box.innerHTML,'<svg>лист</svg>');
});

test('done говорит, принят ли результат: изделие запоминает только принятый', ()=>{
  const {page,job}=setup();
  page.btn.click();job.key='B';
  assert.equal(job.pending.done('<svg>старый</svg>'),false);
  page.btn.click();
  assert.equal(job.pending.done('<svg>лист</svg>'),true);
});

test('stale() напрямую: результат убран, кнопка активна, скачивать нечего', ()=>{
  const {page,calc,finish}=setup();
  page.btn.click();finish('<svg>лист</svg>');
  calc.stale();
  assert.equal(page.box.innerHTML,'');
  assert.equal(page.btn.disabled,false);
  assert.equal(page.save.disabled,true);
});
