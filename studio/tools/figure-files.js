// файлы фигуры для проверки правила 17: те же функции, что кнопки «DXF детали» и «DXF раскрой» страницы рыси
//   node studio/tools/figure-files.js <dir> <id> <out> [--top Y]
//   dir — корень репозитория (или копия), id — фигура из editor/lynx, out — папка: parts.dxf и nest.dxf.
//   Заодно строятся листы А3 и карты А4 (buildCards) — если что-то бросит исключение, код выхода 1.
//   --top Y — только верх фигуры (грани, чей центр выше Y мм модели): целиком рысь раскладывается минутами.
//   Дальше: python studio/py/dxf_check.py <out>
const fs=require('fs'),path=require('path');
const {loadFigureEngine}=require('../lib/engine.js');

// настройки страницы по умолчанию (editor/lynx/js/ui.js, ST) и расчёт производства (ui.js prodCalc) — копия для Node
const SETUP=`
ST={t:2,mat:'steel',sheet:'1250x2500',sw:1250,sl:2500,cut:'laser',minW:15,weld:'tig',gap:.5,useT:true,ngap:5,ngapOwn:false,engrave:true,tpl:false,bend:true,perf:true,perfL:2,perfStep:20,perfEdge:10,name:FIG_NAME,pairs:true,diss:0,fig:FIG_ID};
sheetWL=()=>{const [a,b]=ST.sheet.split('x').map(Number);return [b,a];};
fmt=(x,d=0)=>Number(x).toFixed(d).replace('.',',');angT=d=>d>180.5?Math.round(360-d)+'° внутрь':Math.round(d)+'°';
MATN=typeof MATN==='undefined'?{steel:'сталь'}:MATN;
function figureBuild(top){
  let M=modelPoly(FIG_ID);
  if(top!==null){const keep=M.P.filter(Q=>Q.reduce((s,i)=>s+M.V[i][1],0)/Q.length>top),map=new Map(),V=[];const P=keep.map(Q=>Q.map(i=>{if(!map.has(i)){map.set(i,V.length);V.push(M.V[i]);}return map.get(i);}));M=polyBase(V,P);}
  const H=FIGURES[FIG_ID].H||1000,s=meshBox(M.V).size,dims={H,W:Math.round(s[0]*H/s[1]),D:Math.round(s[2]*H/s[1])};
  const b=polyBase(fitMesh({V:M.V,F:[]},dims).V,M.P,M.S),M3={V:b.V,F:b.F,T:b.T,S:b.S},R=buildParts(M3,1.5,1.5),wl=addBacking(R,M3,FIGURES[FIG_ID].backIf);pairNumbers(R,M3.V);
  const T=totals(R,{t:ST.t,mat:ST.mat,sheet:sheetWL()});T.weld+=wl;T.open=Math.max(0,T.open-wl);CUR={M3,R,T};
  const [W,Hs]=sheetWL();CUR.C=R.parts.map(p=>cutContour(p,ST.t,ST.gap,ST.useT));CUR.BL=[];CUR.BP=null;
  const ban=new Set();for(let k=0;k<4;k++){const P=bendPlan(R,M3.V,{sheet:[Hs,W],ban}),BL=P.blanks.filter(x=>x.parts.length>1).map(x=>Object.assign(x,bendBlank(x,R,M3.V,P,{t:ST.t,gap:ST.gap,useT:ST.useT})));
    CUR.BP=P;CUR.BL=BL.filter(x=>!x.bad);if(CUR.BL.length===BL.length)break;BL.filter(x=>x.bad).forEach(x=>x.bends.forEach(id=>ban.add(id)));}
  blankNumbers(CUR.BL,R);blankTwins(CUR.BL,R,CUR.BP.J);
  const BJ=CUR.BL.flatMap(x=>x.bends.map(id=>CUR.BP.J[id]));CUR.bentKey=new Set(BJ.map(j=>bendKey(j.p,j.q)));CUR.blankOf=new Int32Array(R.parts.length).fill(-1);CUR.BL.forEach((x,i)=>x.parts.forEach(pi=>CUR.blankOf[pi]=i));
  CUR.PC=R.parts.filter(p=>CUR.blankOf[p.id]<0).map(p=>({id:p.id,no:p.no,pts:CUR.C[p.id].pts,bad:CUR.C[p.id].bad,parts:[p.id],key:p.no}))
    .concat(CUR.BL.map((x,i)=>({id:'b'+i,no:'Г'+x.no,pts:x.pts,parts:x.parts,key:R.parts[x.parts[0]].no,B:x}))).sort((a,b)=>a.key-b.key);
  const items=CUR.PC.filter(o=>!o.bad).map(o=>({id:o.id,no:o.no,pts:o.pts}));
  CUR.TPL=null;const g=nestGen(items,W,Hs,ST.ngap,10,2.5,2,true);let v;do{v=g.next();}while(!v.done);CUR.N=v.value;
  CUR.cutLen=CUR.PC.reduce((a,o)=>a+perim(o.pts),0);return {parts:R.parts.length,pieces:CUR.PC.length,sheets:CUR.N.sheets.length};}
`;

function buildFiles(dir,id,out,{top=null}={}){
  const E=loadFigureEngine({studio:false,root:dir});
  if(!E.run(`typeof FIGURES[${JSON.stringify(id)}]!=='undefined'`))throw new Error('нет такой фигуры: '+id);
  E.ctx.FIG_ID=id;E.ctx.FIG_NAME=E.run(`FIGURES[${JSON.stringify(id)}].name`);
  E.run(SETUP);const info=E.run(`figureBuild(${top===null?'null':+top})`);
  fs.mkdirSync(out,{recursive:true});
  const parts=E.run('dxfParts()'),nest=E.run('dxfNest()');
  fs.writeFileSync(path.join(out,'parts.dxf'),parts);fs.writeFileSync(path.join(out,'nest.dxf'),nest);
  // карты А4 и листы А3 — без исключений
  const cards=E.run('buildCards().length');
  return Object.assign(info,{cards,files:['parts.dxf','nest.dxf']});}

if(require.main===module){const a=process.argv.slice(2),ti=a.indexOf('--top'),top=ti>=0?+a[ti+1]:null,pos=a.filter((x,i)=>x!=='--top'&&(ti<0||i!==ti+1));
  if(pos.length<3){console.error('node studio/tools/figure-files.js <dir> <id> <out> [--top Y]');process.exit(2);}
  try{const r=buildFiles(path.resolve(pos[0]),pos[1],path.resolve(pos[2]),{top});console.log(`деталей ${r.parts}, кусков ${r.pieces}, листов ${r.sheets}, карт ${r.cards}: ${r.files.join(', ')}`);}
  catch(e){console.error('Файлы фигуры не построились: '+e.message);process.exit(1);}}
module.exports={buildFiles};
