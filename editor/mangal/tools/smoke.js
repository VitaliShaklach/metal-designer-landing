// дымовой тест: весь код модели в Node, Three.js и DOM — пустышки. Ловит ReferenceError/TypeError в сборке, размерах, раскрое
const fs=require('fs'),vm=require('vm'),path=require('path');
const P=path.join(__dirname,'..');
const dimIds=[...fs.readFileSync(P+'/js/dims.js','utf8').matchAll(/^\s*\['([A-Za-z]\w*)',/gm)].map(m=>m[1]);
const mk=()=>{const U=new Proxy(function(){},{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>0;if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;return U;},apply:()=>U,construct:()=>U,set:()=>true});return U;};
let fails=0,airMM=null,hookMM=null;   // габариты развёртки задвижки и скобы из partMM — для раскладки на прямоугольниках
// {rain:false} — без крыши от дождя (галочка снята): ни крыши, ни трубок, ни строк крыши в размерах, «Массе», «Что купить», «Заметках»
for(const mode of ['both','grill','stove'])for(const extra of [{},{cgr:true,div:true,gAng:false},{man:true,cgr:true,div:true,obe:true,grType:'rebar',skew:true,skewD:true,grates2:true,grillGrate:true},{rain:false,man:true}]){
  const U=mk(),errs=[];
  const flags=JSON.stringify(Object.assign({rain:true,mode},extra));
  const ctx={THREE:U,__U:U,document:U,window:{addEventListener:()=>{}},location:{hash:'',href:'http://x/',search:'?view=1,1,1,0,0,0&dims='+dimIds.join(',')+'&flags='+encodeURIComponent(flags)},
    addEventListener:()=>{},requestAnimationFrame:()=>{},ResizeObserver:U,MutationObserver:U,devicePixelRatio:1,performance:{now:()=>0},navigator:U,URLSearchParams,console,Math,JSON,Set,Object,Array,Number,String,Symbol,setTimeout,clearTimeout};
  vm.createContext(ctx);
  // классические скрипты делят одну лексическую область — склеиваем
  const src=[P+'/../common/calc.js',...['params','parts','model','dims','cut','dxf','nest','ui'].map(f=>P+'/js/'+f+'.js')].map(f=>fs.readFileSync(f,'utf8')).join('\n;\n');
  try{vm.runInContext(src,ctx,{filename:'all.js'});
      vm.runInContext("dimVisible().forEach(r=>{try{r.fn()}catch(e){throw new Error('dim '+r.id+': '+e.message)}});drawCut();",ctx);
      // крыша от дождя: тексты шапки, «Общего», «Массы», проката и «Заметок» — с крышей есть, без неё ни слова; элемент «Крыша», её детали и размеры — только с крышей
      vm.runInContext(`{const box={},E=()=>{const st={};return new Proxy(function(){},{get:(t,k)=>k in st?st[k]:k===Symbol.toPrimitive?()=>0:k==='then'?undefined:__U,set:(t,k,v)=>{st[k]=v;return true;},apply:()=>__U});};
        const D0=document;document=new Proxy({},{get:(t,k)=>k==='getElementById'?(id=>box[id]||(box[id]=E())):D0[k]});
        try{updUI();drawCut();}finally{document=D0;}
        const tx=k=>String(box[k]&&box[k].innerHTML||''),all=['lede','fit','stats','cut','metal','notesBox'].map(tx).join('\\n'),roofRx=/[Кк]рыш(?!к)|стоек|Арматура Ø16|Ø26/;
        const roofEl=PARTS.some(e=>e.id==='roof'&&elOk(e.id)),roofPt=PARTS.find(e=>e.id==='roof').d.some(([id])=>partOk(id)),roofDim=dimVisible().filter(r=>r.el==='roof'||RAIN_DIMS.has(r.id)).map(r=>r.id);
        if(S.rain){if(!roofEl||!roofPt||!roofDim.length)throw new Error('крыша включена, а элемента/деталей/размеров крыши нет');
          [['cut',/Крыша — защита от дождя/],['metal',/Арматура Ø16/],['metal',/Труба Ø26×3/],['notesBox',/Крыша от дождя/],['lede',/Крыша от дождя/],['fit',/Крыша спереди/],['stats',/верх стоек/]].forEach(([k,rx])=>{if(!rx.test(tx(k)))throw new Error('крыша включена, а в '+k+' нет '+rx);});}
        else{if(roofEl||roofPt)throw new Error('крыша выключена, а элемент «Крыша» есть в списке');if(roofDim.length)throw new Error('крыша выключена, а размеры остались: '+roofDim.join(', '));
          const m=all.match(roofRx);if(m)throw new Error('крыша выключена, а в тексте «'+m[0]+'»: '+all.slice(Math.max(0,m.index-60),m.index+40).replace(/<[^>]+>/g,''));}}`,ctx);
      // раскрой листа: детали для раскладки (у боковин в Node контур пустой — пропускаются), раскладка и рисунок
      vm.runInContext("{const N=nestJob(),res=N.groups.map(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return v.value;});nestDraw(N,res);nestUI();nestUI(true);}",ctx);
      // колосник мангала: на листе 5 мм, когда он есть на модели; галочка «на листе» снята — нет; у половины 18 × 19 отверстий Ø10
      vm.runInContext(`{const has=N=>N.groups.some(G=>G.types.some(t=>NEST_CGR(t.p))),a=nestJob(),b=nestJob({cgr:false}),want=gOn()&&S.cgr;
        if(has(a)!==want||a.hasCgr!==want)throw new Error('колосник мангала: на листе '+has(a)+', ждали '+want);if(has(b))throw new Error('колосник мангала остался при снятой галочке');
        if(want){const ty=a.groups.flatMap(G=>G.types).filter(t=>NEST_CGR(t.p));if(ty.length!==2||ty.some(t=>t.p.mm!==5||t.m.circles.length!==342||t.m.circles.some(c=>c[2]!==5)))throw new Error('колосник мангала: не те половины/отверстия');}}`,ctx);
      // площадка под колесо — 5 мм, на основном листе; листа 6 мм нет
      vm.runInContext(`{const N=nestJob(),ps=laserParts().filter(p=>p.pt==='pads');if(ps.some(p=>p.mm!==5))throw new Error('площадка под колесо не 5 мм');if(N.groups.some(G=>G.mm===6))throw new Error('остался лист 6 мм');
        if(S.legs&&ps.length&&!N.groups.some(G=>G.mm===5&&G.types.some(t=>t.p.pt==='pads')))throw new Error('площадки под колесо нет на листе 5 мм');}`,ctx);
      // задвижки поддува и скобы задвижек — лист 5 мм, на листе 5 мм, когда есть на модели; скоб 4, контур 12 × 30; в режиме «мангал» листа 3 мм нет
      const ah=vm.runInContext(`(()=>{const N=nestJob(),lp=laserParts(),on5=pt=>N.groups.some(G=>G.mm===5&&G.types.some(t=>t.p.pt===pt)),r={};
        [['air',gOn()&&S.airSl,2],['hook',gOn()&&S.hook,4]].forEach(([pt,want,q])=>{const ps=lp.filter(p=>p.pt===pt);
          if(ps.length!==(want?1:0))throw new Error(pt+': деталей '+ps.length+', ждали '+(want?1:0));if(!want)return;const p=ps[0],m=partMM(p);
          if(p.mm!==5)throw new Error(pt+': толщина '+p.mm+', ждали 5');if(p.q!==q)throw new Error(pt+': '+p.q+' шт, ждали '+q);
          if(!on5(pt))throw new Error(pt+': нет на листе 5 мм');if(N.groups.some(G=>G.mm!==5&&G.types.some(t=>t.p.pt===pt)))throw new Error(pt+': лежит не на листе 5 мм');r[pt]=[m.w,m.h];});
        if(r.hook){const m=partMM(lp.find(p=>p.pt==='hook')),P=m.loops[0];
          if(m.w!==12||m.h!==30)throw new Error('скоба: габарит '+m.w+' × '+m.h+', ждали 12 × 30');
          if(m.loops.length!==1||m.circles.length||m.bends.length)throw new Error('скоба: лишние контуры, отверстия или гибы');
          if(JSON.stringify(P)!==JSON.stringify([[0,0],[12,0],[12,30],[7,30],[7,8],[0,8],[0,0]]))throw new Error('скоба: контур '+JSON.stringify(P));
          if(Math.abs(Math.abs(area2(P.slice(0,-1)))-206)>1e-6)throw new Error('скоба: площадь не 206 мм²');}
        if(r.air){const m=partMM(lp.find(p=>p.pt==='air'));if(m.w!==Math.round((AIR_L+2*AIR_TH)*10)||m.h!==30||m.bends.some(b=>Math.abs(b[0][0]-30)>1e-6&&Math.abs(b[0][0]-(m.w-30))>1e-6))throw new Error('задвижка: развёртка '+m.w+' × '+m.h+', гибы '+JSON.stringify(m.bends));}
        // скоба держит задвижку: полка — на уровне низа задвижки, вырез шире планки, ухо выше середины задвижки
        if(AH_Y0+AH_HEEL!==HOLE_Y-AIR_H/2||AH_GAP<=AIR_T||AH_Y0+AH_H<=HOLE_Y)throw new Error('скоба не держит задвижку');
        if(S.mode==='grill'&&N.groups.some(G=>G.mm===3))throw new Error('мангал: остался лист 3 мм');
        // целые мм: габариты листовых деталей, строки задвижки и скобы в «Массе», подписи их размеров
        lp.forEach(p=>{const m=partMM(p);if(!Number.isFinite(m.w))return;   // боковины — из THREE.Shape, в Node контура нет
          if(!Number.isInteger(m.w)||!Number.isInteger(m.h))throw new Error('не целые мм: '+p.name+' '+m.w+' × '+m.h);});
        const txt=[];cutRows().filter(c=>c.pt==='air'||c.pt==='hook').forEach(c=>txt.push(c.n,c.s,c.note));lp.filter(p=>p.pt==='air'||p.pt==='hook').forEach(p=>txt.push(p.name,p.note));
        const d0=dim3,l0=lab;dim3=(a,b,o,t)=>txt.push(String(t));lab=t=>txt.push(String(t));
        try{dimRows().filter(d=>d.id&&/^(air|hk)/.test(d.id)).forEach(d=>{txt.push(d.name,String(d.val));d.fn();});}finally{dim3=d0;lab=l0;}
        const bad=txt.find(t=>/[0-9],[0-9]/.test(t));if(bad)throw new Error('дробные мм в подписи: '+bad.slice(0,80));
        return r;})()`,ctx);
      if(ah.air)airMM=ah.air;if(ah.hook)hookMM=ah.hook;
      // DXF всего листа: рамка — 4 отрезка SHEET, все точки CUT/BEND внутри рамки с краем 10 мм, контуры замкнуты (каждый конец CUT — у чётного числа отрезков), окружностей — сколько у деталей
      const dx=vm.runInContext(`(()=>{const N=nestJob(),out=[];N.groups.forEach(G=>{const g=nestGen(G.items,N.W,N.H,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);
        v.value.sheets.forEach(sh=>out.push({mm:G.mm,W:N.W,H:N.H,txt:nestDxf(N,G,sh),circ:sh.items.reduce((a,it)=>a+G.items[it.id].ty.m.circles.length,0)}));});return out;})()`,ctx);
      if(!dx.length)throw new Error('DXF листа: нет листов');
      dx.forEach(d=>{const t=d.txt.split(/\r?\n/),E=[];for(let i=0;i<t.length-1;i+=2)if(t[i]==='0'&&(t[i+1]==='LINE'||t[i+1]==='CIRCLE')){const e={k:t[i+1]};let j=i+2;while(j<t.length-1&&t[j]!=='0'){e[t[j]]=t[j+1];j+=2;}E.push(e);}
        const sheet=E.filter(e=>e['8']==='SHEET'),cut=E.filter(e=>e['8']==='CUT'&&e.k==='LINE'),circ=E.filter(e=>e.k==='CIRCLE'),deg={};
        if(sheet.length!==4)throw new Error(`DXF листа ${d.mm} мм: рамка ${sheet.length} отрезков`);
        if(circ.length!==d.circ)throw new Error(`DXF листа ${d.mm} мм: окружностей ${circ.length}, ждали ${d.circ}`);
        E.filter(e=>e['8']!=='SHEET').forEach(e=>{const pts=e.k==='LINE'?[[+e['10'],+e['20']],[+e['11'],+e['21']]]:[[+e['10']-+e['40'],+e['20']-+e['40']],[+e['10']+ +e['40'],+e['20']+ +e['40']]];
          pts.forEach(([x,y])=>{if(!(x>=10-.02&&y>=10-.02&&x<=d.W-10+.02&&y<=d.H-10+.02))throw new Error(`DXF листа ${d.mm} мм: точка ${x},${y} вне листа`);});});
        cut.forEach(e=>[e['10']+','+e['20'],e['11']+','+e['21']].forEach(k=>deg[k]=(deg[k]||0)+1));
        const odd=Object.keys(deg).filter(k=>deg[k]%2);if(odd.length)throw new Error(`DXF листа ${d.mm} мм: незамкнутый контур у ${odd[0]}`);});
      // заготовки с гильотины (галочка): на лазерной раскладке только детали «лазер» ('list'); рисунок, таблица «На гильотину», CSV, DXF куска листа; размеры — целые мм
      vm.runInContext(`{const N=nestJob({gil:true}),N0=nestJob();
        N.groups.forEach(G=>G.items.forEach(i=>{if(i.ty.kind!=='list')throw new Error('gil: на листе под лазер деталь '+i.ty.kind+' — '+i.ty.p.name);}));
        if(N0.groups.reduce((a,G)=>a+G.items.length,0)!==N0.groups.reduce((a,G)=>a+G.types.reduce((b,t)=>b+t.q,0),0))throw new Error('без галочки на листе не все детали');
        const res=N.groups.map(G=>{const g=nestGen(G.items,N.LW,N.LH,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);return v.value;});nestDraw(N,res);
        N.groups.forEach((G,gi)=>{const R=res[gi],rows=gilRows(N,G,R),csv=gilCsv(N,G,R),lab=[];
          if(R.sheets.length!==(G.items.length?R.sheets.length||1:0))throw new Error('gil: лист без деталей');
          R.sheets.forEach((sh,si)=>{const [w,h]=nestPiece(N,sh);if(w%10&&w!==N.LW||h%10&&h!==N.LH||w>N.LW||h>N.LH)throw new Error('gil: кусок листа '+w+' × '+h);lab.push('Кусок листа под лазер '+w+' × '+h,nestFile(N,G,R,si));
            const t=nestDxf(N,G,sh).split(/\\r?\\n/);for(let i=0;i<t.length-1;i+=2){if(t[i]==='10'&&+t[i+1]>w+.01||t[i]==='20'&&+t[i+1]>h+.01)throw new Error('gil: DXF куска — точка вне куска '+w+' × '+h);}});
          rows.forEach(o=>{if(!Number.isInteger(o.w)||!Number.isInteger(o.h))throw new Error('gil: заготовка не в целых мм — '+o.name+' '+o.w+' × '+o.h);lab.push(fmt(o.w,0)+' × '+fmt(o.h,0));});
          if(rows.filter(o=>o.kind!=='piece').length!==G.types.filter(t=>t.kind!=='list').length||rows.filter(o=>o.kind==='piece').length!==R.sheets.length)throw new Error('gil: строки «На гильотину»');
          if(csv.charCodeAt(0)!==0xFEFF||csv.split('\\r\\n')[0]!=='\uFEFFдеталь;заготовка, мм;шт;вид'||csv.trim().split('\\r\\n').length!==rows.length+1)throw new Error('gil: CSV '+JSON.stringify(csv.slice(0,60)));
          csv.trim().split('\\r\\n').slice(1).forEach(l=>{lab.push(l.split(';')[1]);if(l.split(';').length!==4)throw new Error('gil: CSV строка '+l);});
          G.types.forEach(ty=>{const o=partOut(N,ty),o0=partOut(N0,ty);if(o0[0]!==dxfName(ty.p))throw new Error('без галочки не тот DXF детали');
            if(ty.kind==='gil'?o:ty.kind==='zag'?!o||!/_zag\\.dxf$/.test(o[0])||!/\\nBLANK\\r/.test(o[1]):o[0]!==dxfName(ty.p))throw new Error('gil: DXF детали '+ty.kind+' '+(o&&o[0]));});
          const bad=lab.find(t=>/[0-9],[0-9]/.test(t));if(bad)throw new Error('gil: дробные мм в подписи: '+bad);});
        if(nestJob({gil:true}).key===N0.key&&N0.groups.some(G=>G.types.some(t=>t.kind!=='list')))throw new Error('gil: ключ раскладки не меняется от галочки');}`,ctx);}
  catch(e){errs.push(e.message+' '+(e.stack.split('\n')[1]||''));}
  console.log(mode,JSON.stringify(extra).slice(0,30),errs.length?'FAIL '+errs.join(' | '):'ok');fails+=errs.length;}

// по умолчанию (ссылка без flags) крыши нет: S.rain===false; старая ссылка «Поделиться видом» с flags {"rain":true} — крыша есть
for(const [search,want] of [['',false],['?view=1,1,1,0,0,0',false],['?view=1,1,1,0,0,0&flags='+encodeURIComponent('{"rain":true}'),true]]){
  const U=mk(),errs=[],ctx={THREE:U,document:U,window:{addEventListener:()=>{}},location:{hash:'',href:'http://x/',search},
    addEventListener:()=>{},requestAnimationFrame:()=>{},ResizeObserver:U,MutationObserver:U,devicePixelRatio:1,performance:{now:()=>0},navigator:U,URLSearchParams,console,Math,JSON,Set,Object,Array,Number,String,Symbol,setTimeout,clearTimeout};
  vm.createContext(ctx);
  const src=[P+'/../common/calc.js',...['params','parts','model','dims','cut','dxf','nest','ui'].map(f=>P+'/js/'+f+'.js')].map(f=>fs.readFileSync(f,'utf8')).join('\n;\n');
  try{vm.runInContext(src,ctx,{filename:'all.js'});const r=vm.runInContext('S.rain',ctx);if(r!==want)throw new Error('S.rain='+r+', ждали '+want);}
  catch(e){errs.push(e.message+' '+((e.stack||'').split('\n')[1]||''));}
  console.log('крыша по ссылке',JSON.stringify(search.slice(0,40)),errs.length?'FAIL '+errs.join(' | '):'ok');fails+=errs.length;}

// виды деталей на настоящих контурах: THREE.Shape/Path — простые заглушки (как в tools/dxf_side.js), остальное THREE — пустышка.
// Переключатель «гильотина | лазер»: по умолчанию задвижки и скобы (уже 50 мм) — лазер, остальные — гильотина; gil — прямоугольник без всего (дно жаровни),
// zag — всё остальное с «гильотиной» (задняя боковина жаровни: рез меньше; в _zag.dxf BLANK — 4 отрезка, у CUT концы нечётной степени — на стороне заготовки;
// перегородка жаровни с ушками и ручкой — тоже zag). Схема гильотины: все заготовки и куски на листе, внутри листа с подрезкой, не пересекаются,
// режутся только сквозными резами (gilCuts), DXF схемы — SHEET 4, BLANK по 4 на заготовку, CUT 0; переключение меняет схему
class SPath{constructor(){this.pts=[];this.curves=[];this.holes=[];}moveTo(x,y){this.pts.push({x,y});}lineTo(x,y){const l=this.pts[this.pts.length-1];if(!l||l.x!==x||l.y!==y)this.pts.push({x,y});}
  absarc(x,y,r){this.curves=[{isEllipseCurve:true,aX:x,aY:y,xRadius:r}];}getPoints(){return this.pts;}}
const mkReal=(flags,search)=>{const U=mk(),TH=new Proxy({Shape:SPath,Path:SPath},{get:(t,k)=>k in t?t[k]:U});
  const ctx={THREE:TH,__U:U,document:U,window:{addEventListener:()=>{}},location:{hash:'',href:'http://x/',search:search||'?view=1,1,1,0,0,0&flags='+encodeURIComponent(JSON.stringify(flags))},
    addEventListener:()=>{},requestAnimationFrame:()=>{},ResizeObserver:U,MutationObserver:U,devicePixelRatio:1,performance:{now:()=>0},navigator:U,URLSearchParams,console,Math,JSON,Set,Object,Array,Number,String,Symbol,setTimeout,clearTimeout};
  vm.createContext(ctx);vm.runInContext([P+'/../common/calc.js',...['params','parts','model','dims','cut','dxf','nest','ui'].map(f=>P+'/js/'+f+'.js')].map(f=>fs.readFileSync(f,'utf8')).join('\n;\n'),ctx,{filename:'all.js'});return ctx;};
const GILCHK=`(N,lbl)=>{const out=[];N.groups.forEach(G=>{const g=nestGen(G.items,N.LW,N.LH,N.gap,NEST_EDGE);let v;do{v=g.next();}while(!v.done);const R=v.value,P=gilScheme(N,G,R),E=N.edge,e=1e-6;
    if(R.too.length)throw new Error(lbl+': кусок под лазер — не поместилось '+R.too.length);if(P.too.length)throw new Error(lbl+': на схеме не поместилось '+P.too.length);
    const want={},got={},k=r=>r.kind==='piece'?'piece'+r.si:r.kind+r.no;
    G.types.forEach(ty=>{if(ty.kind!=='list')want[ty.kind+ty.no]=ty.q;});R.sheets.forEach((sh,si)=>want['piece'+si]=1);
    P.sheets.forEach(sh=>sh.items.forEach(it=>{got[k(it.r)]=(got[k(it.r)]||0)+1;const [a,b]=[it.w,it.h].sort((p,q)=>p-q),[c,d]=[it.r.w,it.r.h].sort((p,q)=>p-q);
      if(Math.abs(a-c)>e||Math.abs(b-d)>e)throw new Error(lbl+': размер заготовки на схеме '+it.w+' × '+it.h+' вместо '+it.r.w+' × '+it.r.h);}));
    if(JSON.stringify(Object.entries(want).sort())!==JSON.stringify(Object.entries(got).sort()))throw new Error(lbl+': на схеме не те заготовки '+JSON.stringify(got)+', ждали '+JSON.stringify(want));
    P.sheets.forEach((sh,si)=>{const A=sh.items;
      A.forEach(r=>{if(r.x<E-e||r.y<E-e||r.x+r.w>N.W-E+e||r.y+r.h>N.H-E+e)throw new Error(lbl+': заготовка '+r.r.no+' вне листа с подрезкой '+E);});
      for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const p=A[i],q=A[j];if(p.x<q.x+q.w-e&&q.x<p.x+p.w-e&&p.y<q.y+q.h-e&&q.y<p.y+p.h-e)throw new Error(lbl+': заготовки пересекаются');}
      // сквозные резы: рекурсивно — в каждом куске с заготовками есть рез от края до края, не через заготовку (свой обход, не gilCuts)
      const thr=(B,x0,y0,x1,y1)=>{const In=B.filter(r=>r.x<x1-e&&r.x+r.w>x0+e&&r.y<y1-e&&r.y+r.h>y0+e);if(!In.length)return;
        if(In.length===1&&Math.abs(In[0].x-x0)<e&&Math.abs(In[0].y-y0)<e&&Math.abs(In[0].x+In[0].w-x1)<e&&Math.abs(In[0].y+In[0].h-y1)<e)return;
        for(const c of In.flatMap(r=>[r.x,r.x+r.w]))if(c>x0+e&&c<x1-e&&!In.some(r=>r.x<c-e&&r.x+r.w>c+e)){thr(In,x0,y0,c,y1);thr(In,c,y0,x1,y1);return;}
        for(const c of In.flatMap(r=>[r.y,r.y+r.h]))if(c>y0+e&&c<y1-e&&!In.some(r=>r.y<c-e&&r.y+r.h>c+e)){thr(In,x0,y0,x1,c);thr(In,x0,c,x1,y1);return;}
        throw new Error(lbl+': кусок '+[x0,y0,x1,y1].join(',')+' не режется сквозным резом');};
      thr(A,0,0,N.W,N.H);if(!sh.ok||!(sh.cuts>0))throw new Error(lbl+': gilCuts '+JSON.stringify([sh.ok,sh.cuts]));
      const t=gilDxf(N,G,sh).split(/\\r?\\n/),L={};let tx=0;for(let i=0;i<t.length-1;i+=2)if(t[i]==='0'&&(t[i+1]==='LINE'||t[i+1]==='TEXT')){if(t[i+1]==='TEXT')tx++;else L[t[i+3]]=(L[t[i+3]]||0)+1;}
      if(L.SHEET!==4||L.BLANK!==4*A.length||L.CUT||tx!==A.length)throw new Error(lbl+': DXF схемы '+JSON.stringify(L)+', TEXT '+tx);
      const svg=gilSvg(N,G,sh,()=>false,true);if((svg.match(/<rect x=/g)||[]).length!==A.length||/<path|<line|<circle/.test(svg))throw new Error(lbl+': рисунок схемы');
      if(/[0-9],[0-9]/.test(svg.replace(/<[^>]*>/g,' ')))throw new Error(lbl+': дробные мм на схеме');});
    out.push({mm:G.mm,n:P.sheets.length,used:P.sheets.map(s=>Math.round(s.used*100)),cuts:P.sheets.map(s=>s.cuts),pc:R.sheets.map(sh=>nestPiece(N,sh).join('×')),sig:JSON.stringify(P.sheets.map(s=>s.items.map(i=>[i.x,i.y,i.w,i.h])))});});return out;}`;
const gilRep=o=>o.filter(g=>g.mm===5).map(g=>`${g.n} л, занято ${g.used.join('+')} %, резов ${g.cuts.join('+')}${g.pc.length?', кусок '+g.pc.join(', '):''}`).join('')||'—';
for(const mode of ['both','grill','stove'])for(const extra of [{},{cgr:true,div:true,gAng:false},{man:true,cgr:true,div:true,obe:true,grType:'rebar',skew:true,skewD:true,grates2:true,grillGrate:true}]){
  const errs=[];let st='';
  try{const ctx=mkReal(Object.assign({rain:true,mode},extra));
    st=vm.runInContext(`(()=>{const lp=laserParts(),c={gil:0,zag:0,list:0},CHK=${GILCHK};let cl=0,cz=0;
      const N=nestJob({gil:true,edge:10,sel:{}}),T=N.groups.flatMap(G=>G.types),K=pt=>{const t=T.find(t=>t.p.pt===pt);return t&&t.kind;};
      if(T.length!==lp.filter(p=>N.cgr||!NEST_CGR(p)).length)throw new Error('не все детали в таблице');
      T.forEach(ty=>{const m=ty.m,want=ty.p.pt==='air'||ty.p.pt==='hook'?'laser':'gil';if(!(m.w>0))throw new Error('нет контура: '+ty.p.name);
        if(ty.sel!==want)throw new Error('умолчание: '+ty.p.name+' '+m.w+' × '+m.h+' — '+ty.sel+', ждали '+want);
        const plain=!blankMM(ty.p,m).open&&m.loops.length===1&&!m.circles.length,k=want==='laser'?'list':plain?'gil':'zag';if(ty.kind!==k)throw new Error('вид '+ty.p.name+': '+ty.kind+', ждали '+k);
        c[ty.kind]++;if(ty.p.mm===5){cl+=m.cut*ty.q;if(ty.kind==='zag')cz+=ty.b.cut*ty.q;else if(ty.kind==='list')cz+=m.cut*ty.q;}});
      if(gOn()){if(K('gBot')!=='gil')throw new Error('дно жаровни: '+K('gBot')+', ждали gil');
        const ty=T.find(t=>t.p.pt==='side0'),m=ty.m,b=ty.b;if(ty.kind!=='zag')throw new Error('задняя боковина жаровни: '+ty.kind+', ждали zag');
        if(!(b.cut<m.cut))throw new Error('боковина: рез по заготовке '+b.cut+' не меньше, чем из листа '+m.cut);
        const t=dxfText(b).split(/\\r?\\n/),E=[];for(let i=0;i<t.length-1;i+=2)if(t[i]==='0'&&t[i+1]==='LINE'){const e={};let j=i+2;while(j<t.length-1&&t[j]!=='0'){e[t[j]]=t[j+1];j+=2;}E.push(e);}
        const bl=E.filter(e=>e['8']==='BLANK'),cu=E.filter(e=>e['8']==='CUT'),deg={};if(bl.length!==4)throw new Error('боковина _zag: BLANK '+bl.length+' отрезков');
        cu.forEach(e=>[[e['10'],e['20']],[e['11'],e['21']]].forEach(q=>{const k=q.join(',');deg[k]=(deg[k]||0)+1;}));
        const side=k=>{const [x,y]=k.split(',').map(Number),z=v=>Math.abs(v)<.02;return z(x)||z(x-b.w)||z(y)||z(y-b.h);},odd=Object.keys(deg).filter(k=>deg[k]%2);
        if(!odd.length||odd.some(k=>!side(k)))throw new Error('боковина _zag: конец паза не на кромке — '+odd.find(k=>!side(k)));
        if(odd.length!==2*b.open)throw new Error('боковина _zag: концов '+odd.length+', ломаных '+b.open);
        if(S.div&&K('div')!=='zag')throw new Error('перегородка жаровни: '+K('div')+', ждали zag');}
      N.groups.forEach(G=>G.items.forEach(i=>{if(i.ty.kind!=='list')throw new Error('gil: на лазерной раскладке '+i.ty.kind);}));
      const a=CHK(N,'подрезка 10'),z=CHK(nestJob({gil:true,edge:0,sel:{}}),'подрезка 0');
      // переключение: дно (или дно печи) — на лазер, задвижка (если есть) — на гильотину; схема меняется, вид деталей — по переключателю
      const f1=(T.find(t=>t.p.pt==='gBot')||T.find(t=>t.p.pt==='sBot')).p.file,f2=(T.find(t=>t.p.pt==='air')||{p:{}}).p.file,sel={[f1]:'laser'};if(f2)sel[f2]='gil';
      const N2=nestJob({gil:true,edge:10,sel}),T2=N2.groups.flatMap(G=>G.types),sw=CHK(N2,'переключено');
      if(T2.find(t=>t.p.file===f1).kind!=='list'||f2&&T2.find(t=>t.p.file===f2).kind!=='zag')throw new Error('переключатель не меняет вид детали');
      if(N2.key===N.key||sw[0].sig===a[0].sig)throw new Error('переключатель не меняет схему');
      const N0=nestJob({sel}),N00=nestJob();if(N0.key!==N00.key)throw new Error('без галочки выбор «гильотина | лазер» меняет раскладку');
      return \`gil \${c.gil} / zag \${c.zag} / list \${c.list}; 5 мм: из листа \${(cl/1000).toFixed(2)} м → по заготовкам \${(cz/1000).toFixed(2)} м; схема: \${(${gilRep})(a)}; без подрезки: \${(${gilRep})(z)}; переключено: \${(${gilRep})(sw)}\`;})()`,ctx);}
  catch(e){errs.push(e.message+' '+((e.stack||'').split('\n')[1]||''));}
  console.log('виды',mode,JSON.stringify(extra).slice(0,30),st,errs.length?'FAIL '+errs.join(' | '):'ok');fails+=errs.length;}

// раскладка на прямоугольниках: 5-мм детали «печь + мангал» — все на одном листе 1250 × 2500; зазор между деталями и край листа — точно (polyGap)
{const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(P+'/js/nest.js','utf8'),ctx,{filename:'nest.js'});
  if(!airMM||!hookMM){console.log('раскладка: нет размеров задвижки/скобы из partMM FAIL');fails++;}
  const R=(w,h)=>[[0,0],[w,0],[w,h],[0,h]],set=[[800,195,2],[800,420,1],[410,195,1],[600,495,2],[600,440,1],[430,495,1],[150,430,1],[430,145,1],[300,160,1],[80,80,4],[150,150,4],[...(airMM||[800,30]),2],[...(hookMM||[12,30]),4]];   // [150,150,4] — площадки под колесо (с v1.2 — 5 мм); задвижки поддува и их скобы (с v1.3 — 5 мм), размеры — из partMM
  const mkItems=S=>{const I=[];S.forEach(([w,h,q],k)=>{for(let j=0;j<q;j++)I.push({id:I.length,no:k+1,pts:R(w,h)});});return I;};
  // и с колосником мангала (2 половины 382 × 390 — тоже лист 5 мм)
  for(const [gap,items,one,cg] of [[5,mkItems(set),1,0],[20,mkItems(set),0,0],[5,mkItems([...set,[382,390,2]]),1,1]]){const errs=[];let N;
    try{const g=ctx.nestGen(items,2500,1250,gap,10);let v;do{v=g.next();}while(!v.done);N=v.value;}catch(e){errs.push(e.message);}
    if(N){const all=N.sheets.flatMap(s=>s.items);
      if(N.too.length)errs.push('не поместилось '+N.too.length);if(all.length!==items.length)errs.push('на листах '+all.length+' из '+items.length);
      if(one&&N.sheets.length!==1)errs.push('листов '+N.sheets.length+', ждали 1');
      N.sheets.forEach(s=>{const A=s.items;
        A.forEach(o=>{const xs=o.pts.map(p=>p[0]),ys=o.pts.map(p=>p[1]);if(Math.min(...xs)<10-1e-6||Math.min(...ys)<10-1e-6||Math.max(...xs)>2490+1e-6||Math.max(...ys)>1240+1e-6)errs.push('деталь '+o.no+' ближе 10 мм к краю');});
        for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const d=ctx.polyGap(A[i].pts,A[j].pts);if(d<gap-1e-6)errs.push(`зазор ${A[i].no}–${A[j].no} ${d.toFixed(2)} < ${gap}`);}});}
    console.log(`раскладка, зазор ${gap}${cg?', с колосником мангала':''}:`,N?`${N.sheets.length} лист, ${N.sheets.reduce((a,s)=>a+s.items.length,0)} деталей, занято ${Math.round(N.used*100)} %`:'',errs.length?'FAIL '+errs.slice(0,5).join(' | '):'ok');fails+=errs.length;}}
// схема гильотины на прямоугольниках: 5-мм детали «печь + мангал» + 3 случайных набора — внутри листа с подрезкой, без пересечений, сквозные резы
{const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(P+'/js/nest.js','utf8'),ctx,{filename:'nest.js'});
  let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const sets=[[[800,195,2],[800,420,1],[410,195,1],[600,495,2],[600,440,1],[430,495,1],[150,430,1],[430,145,1],[300,160,1],[80,80,4],[150,150,4],[820,90,1]],
    ...[0,1,2].map(()=>Array.from({length:14},()=>[10*Math.round(5+rnd()*80),10*Math.round(5+rnd()*50),1+Math.floor(rnd()*3)]))];
  sets.forEach((set,si)=>{const errs=[],rs=[];set.forEach(([w,h,q])=>{for(let j=0;j<q;j++)rs.push({w,h,kind:'gil',no:rs.length+1});});
    const Pk=ctx.gilPack(rs,2500,1250,10),A=Pk.sheets.flatMap(s=>s.items);
    if(A.length+Pk.too.length!==rs.length)errs.push('потеряно '+(rs.length-A.length-Pk.too.length));
    Pk.sheets.forEach(s=>{const I=s.items;if(!s.ok)errs.push('не гильотинная схема');
      I.forEach(r=>{if(r.x<10-1e-6||r.y<10-1e-6||r.x+r.w>2490+1e-6||r.y+r.h>1240+1e-6)errs.push('вне листа');});
      for(let i=0;i<I.length;i++)for(let j=i+1;j<I.length;j++){const p=I[i],q=I[j];if(p.x<q.x+q.w-1e-6&&q.x<p.x+p.w-1e-6&&p.y<q.y+q.h-1e-6&&q.y<p.y+p.h-1e-6)errs.push('пересечение');}});
    console.log(`схема гильотины, набор ${si+1} (${rs.length} шт):`,`${Pk.sheets.length} лист, занято ${Pk.sheets.map(s=>Math.round(s.used*100)).join('+')} %, резов ${Pk.sheets.map(s=>s.cuts).join('+')}`,errs.length?'FAIL '+[...new Set(errs)].join(' | '):'ok');fails+=errs.length;});}
process.exit(fails?1:0);
