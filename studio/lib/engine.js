// стенд мастерской для Node: движок рыси (editor/lynx/js) и скрипты мастерской (studio/js) в одном vm-контексте, как в editor/lynx/tools/smoke.js
//   loadFigureEngine({studio=true}) → {ctx, run(expr)}; run — выражение в контексте (глобальные имена движка видны как есть)
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..'),LYNX=path.join(ROOT,'editor','lynx'),STUDIO=path.join(ROOT,'studio','js');
// порядок скриптов мастерской — один на Node и на страницу мастерской; файлов, которых ещё нет, пропускаем
const STUDIO_JS=['clean','ref','rules','fix','faces','auto'];
// фигуры сайта — все plates-*.js в том порядке, в каком их грузит страница
const platesOf=html=>[...html.matchAll(/<script[^>]+src="js\/(plates-[^"?]+)\.js/g)].map(m=>m[1]);
function loadFigureEngine({studio=true}={}){
  const html=fs.readFileSync(path.join(LYNX,'index.html'),'utf8'),ctx={console,TextDecoder,Math,atob};ctx.window=ctx;vm.createContext(ctx);
  const files=[...['mesh','edit','models-poly','figures',...platesOf(html),'prod','sheets','bend','bend3d','trace'].map(f=>path.join(LYNX,'js',f+'.js')),
    ...(studio?STUDIO_JS.map(f=>path.join(STUDIO,f+'.js')).filter(f=>fs.existsSync(f)):[])];
  files.forEach(f=>vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f}));
  return {ctx,run:s=>vm.runInContext(s,ctx)};}
module.exports={STUDIO_JS,loadFigureEngine,platesOf};
