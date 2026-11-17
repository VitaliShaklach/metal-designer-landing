/* ---------- объёмные картинки деталей «Подготовить отдельно» (#117) ----------
   Как фото проката в магазине металла: глянул — и понятно, что это. Сечение вытянуто на длину в косоугольной проекции, грани — серый металл
   (свет по нормали грани: верх светлее, бок темнее, торец светлый), тонкий контур. Всё рисует код по размерам строки: без WebGL и файлов-картинок.
   Сцена — набор призм: сечение (многоугольник, можно с дырками) в плоскости поперёк оси, вытянутое от A до B, мм.
   Оси: x вправо, y вверх, z вглубь — на рисунке уходит вправо-вверх под 30°, с сокращением 0,7. Невидимые грани отброшены,
   призмы рисуются от дальней к ближней, в призме — стенки дырок, потом бока, потом торец.
   Вход — строка prepRows() ({n, s, q, ang}): picKind выбирает картинку по названию, prepPic рисует её с подписью размера. cutRows() не трогаем. */
const PIC_W=110,PIC_H=70,PIC_PAD=3;
const PK_X=Math.cos(Math.PI/6)*.7,PK_Y=Math.sin(Math.PI/6)*.7;
const PK_RAY=[-PK_X,-PK_Y,1];   // взгляд: от зрителя вглубь; грань видна, если её нормаль смотрит против взгляда
const PK_LIGHT=(()=>{const v=[-.2,.75,-.65],l=Math.hypot(...v);return v.map(x=>x/l);})();   // свет сверху-спереди-слева
const PK_DARK=[70,76,84],PK_LITE=[236,238,241],PK_EDGE='rgb(44,48,54)',PK_HOLE='rgb(52,56,62)';
const pkAdd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],pkSub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],pkMul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const pkDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],pkCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const pkNorm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return pkMul(a,1/l);};
const pkProj=p=>[p[0]+p[2]*PK_X,-(p[1]+p[2]*PK_Y)];   // на рисунок: y вниз
const pkDepth=p=>pkDot(p,PK_RAY);   // больше — дальше от зрителя
const pkArea=P=>{let a=0;P.forEach((p,i)=>{const q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];});return a/2;};
const pkOrient=(P,ccw)=>(pkArea(P)>0)===ccw?P:P.slice().reverse();
const pkShade=(n,k=1)=>{const b=(.3+.7*Math.max(0,pkDot(n,PK_LIGHT)))*k;return 'rgb('+PK_DARK.map((d,i)=>Math.round(d+(PK_LITE[i]-d)*b)).join(',')+')';};

/* ---------- сечения: многоугольники по центру (0, 0), мм ---------- */
const picRect=(w,h)=>({o:[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],h:[]});
const picCircle=(r,n=24)=>Array.from({length:n},(_,i)=>[r*Math.cos(2*Math.PI*i/n),r*Math.sin(2*Math.PI*i/n)]);
// круглые сечения — гладкие (smooth): грани боков без тёмного контура, иначе труба на 110 px выходит рифлёной
const picRound=(r,n=24)=>({o:picCircle(r,n),h:[],smooth:true});
const picTube=(r,t)=>({o:picCircle(r,24),h:[picCircle(Math.max(r*.3,r-t),24)],smooth:true});
const picSqTube=(a,t)=>({o:picRect(a,a).o,h:[picRect(a-2*t,a-2*t).o]});
// уголок: стенка слева (к боковине), полка вправо — сверху (Γ) или снизу (L), как стоит на изделии
function picAngle(a,t,flange){const P=flange==='top'?[[0,0],[t,0],[t,a-t],[a,a-t],[a,a],[0,a]]:[[0,0],[a,0],[a,t],[t,t],[t,a],[0,a]];
  return {o:P.map(([x,y])=>[x-a/2,y-a/2]),h:[]};}
// профлист: трапециевидная волна поперёк листа (высота волны преувеличена, иначе на 110 px её не видно)
function picWave(w,amp,th,n=6){const p=w/n,top=[];for(let i=0;i<n;i++){const x=i*p-w/2;top.push([x,0],[x+p*.15,amp],[x+p*.5,amp],[x+p*.65,0]);}top.push([w/2,0]);
  return {o:[...top,...top.slice().reverse().map(([x,y])=>[x,y-th])],h:[]};}

/* ---------- призма: сечение sec, ось A → B ---------- */
function picPrism(sec,A,B){const w=pkNorm(pkSub(B,A)),up=Math.abs(w[1])>.9?[0,0,-1]:[0,1,0],V=pkNorm(pkSub(up,pkMul(w,pkDot(up,w)))),U=pkCross(V,w);
  const at=(q,base)=>pkAdd(base,pkAdd(pkMul(U,q[0]),pkMul(V,q[1])));
  const O=pkOrient(sec.o,true),H=(sec.h||[]).map(h=>pkOrient(h,false)),faces=[];
  [O,...H].forEach((L,li)=>L.forEach((p,i)=>{const q=L[(i+1)%L.length],du=q[0]-p[0],dv=q[1]-p[1];
    faces.push({P:[at(p,A),at(q,A),at(q,B),at(p,B)],n:pkNorm(pkSub(pkMul(U,dv),pkMul(V,du))),hole:li>0});}));
  const caps=[[A,pkMul(w,-1)],[B,w]].map(([C,n])=>({loops:[O,...H].map(L=>L.map(q=>at(q,C))),n}));
  return {faces,caps,mid:pkMul(pkAdd(A,B),.5),decals:[],smooth:!!sec.smooth};}

/* ---------- рисунок сцены ---------- */
const pkVis=n=>pkDot(n,PK_RAY)<-1e-9;
const pkFaceDepth=P=>pkDepth(pkMul(P.reduce((a,p)=>pkAdd(a,p),[0,0,0]),1/P.length));
// сцена → полигоны в координатах рисунка 110 × 70 (вписаны с полями)
function picRender(prisms){const out=[];
  prisms.slice().sort((a,b)=>pkDepth(b.mid)-pkDepth(a.mid)).forEach(pr=>{
    const vis=pr.faces.filter(f=>pkVis(f.n)).sort((a,b)=>pkFaceDepth(b.P)-pkFaceDepth(a.P));
    vis.filter(f=>f.hole).forEach(f=>out.push({loops:[f.P],fill:pkShade(f.n,.6),soft:pr.smooth}));
    vis.filter(f=>!f.hole).forEach(f=>out.push({loops:[f.P],fill:pkShade(f.n),soft:pr.smooth}));
    pr.caps.filter(c=>pkVis(c.n)).forEach(c=>out.push({loops:c.loops,fill:pkShade(c.n)}));
    pr.decals.forEach(d=>out.push(d));});
  const pts=out.flatMap(o=>o.loops.flat().map(pkProj)),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const x0=Math.min(...xs),y0=Math.min(...ys),bw=Math.max(...xs)-x0||1,bh=Math.max(...ys)-y0||1;
  const k=Math.min((PIC_W-2*PIC_PAD)/bw,(PIC_H-2*PIC_PAD)/bh),ox=(PIC_W-bw*k)/2,oy=(PIC_H-bh*k)/2;
  const T=p=>{const q=pkProj(p);return ((q[0]-x0)*k+ox).toFixed(1)+','+((q[1]-y0)*k+oy).toFixed(1);};
  return out.map(o=>o.line?`<polyline points="${o.loops[0].map(T).join(' ')}" fill="none" stroke="${PK_EDGE}" stroke-width=".7"/>`:
    o.loops.length>1?`<path d="${o.loops.map(L=>'M'+L.map(T).join('L')+'Z').join('')}" fill-rule="evenodd" fill="${o.fill}"/>`:
    `<polygon points="${o.loops[0].map(T).join(' ')}" fill="${o.fill}"${o.soft?` stroke="${o.fill}"`:''}/>`).join('');}

/* ---------- детали: сцена из призм. Длинное — укороченно, с разрывом (между кусками виден срез) ---------- */
const PIC_LONG=6;   // длиннее 6 размеров сечения — с разрывом
// прокат вдоль оси ax ('z' — вглубь, 'y' — вверх): sec, длина L, размер сечения D → {prisms, brk}
function picStock(sec,L,D,ax='z'){const e=ax==='y'?[0,1,0]:[0,0,1],P=t=>pkMul(e,t);
  if(!(L>0))L=D*3;
  if(L<=PIC_LONG*D*1.15)return {prisms:[picPrism(sec,P(0),P(L))],brk:false};
  const Ls=PIC_LONG*D,g=.35*D,m=Ls*.5;
  return {prisms:[picPrism(sec,P(0),P(m)),picPrism(sec,P(m+g),P(Ls+g))],brk:true};}
// размеры из строки раскроя: число «2,5» → 2.5; все числа размера; длина «L 780»; «Ø25×2» → [25, 2]; профиль «60×60×2» → [60, 60, 2]
const picN=v=>+String(v).replace(',','.');
const picNums=s=>(String(s||'').match(/\d+(?:[.,]\d+)?/g)||[]).map(picN);
const picLen=s=>{const m=/L\s*(\d+(?:[.,]\d+)?)/.exec(String(s||''));return m?picN(m[1]):0;};
const picDia=(n,d)=>{const m=/Ø(\d+(?:[.,]\d+)?)(?:×(\d+(?:[.,]\d+)?))?/.exec(n);return m?[picN(m[1]),m[2]?picN(m[2]):0]:[d,0];};
const picABT=(n,d)=>{const m=/(\d+)×(\d+)×(\d+(?:[.,]\d+)?)/.exec(n);return m?[picN(m[1]),picN(m[2]),picN(m[3])]:d;};
// П из трубы или прутка — стоймя, как буква: хват сверху, кронштейны вниз (короткие кронштейны вытянуты до трети хвата, иначе не читается)
function picU(R,G,l){const c=picRound(R),ls=Math.max(l,G*.3,3*R);
  return [picPrism(c,[-R,ls,0],[G+R,ls,0]),picPrism(c,[0,0,0],[0,ls,0]),picPrism(c,[G,0,0],[G,ls,0])];}
// сцена без разрыва
const picOne=(...prisms)=>({prisms,brk:false});
// колено трубы печи: горизонтальный и вертикальный куски профтрубы, стык на 45° — линия на лицевой грани
function picElbow(a,t,Ls){const Lh=Math.min(Ls[0]||3*a,3*a),Lv=Math.min(Ls[1]||4.5*a,4.5*a),sec=picSqTube(a,t);
  const hz=picPrism(sec,[0,0,0],[Lh,0,0]),vt=picPrism(sec,[Lh,-a/2,0],[Lh,Lv,0]);
  vt.decals.push({line:true,loops:[[[Lh-a/2,a/2,-a/2],[Lh+a/2,-a/2,-a/2]]]});
  return picOne(hz,vt);}
// перфолист и пластина: лежит плашмя, сечение a × th вытянуто на b; у перфолиста на верхней грани — отверстия
function picPlate(a,b,th,perf){const pr=picPrism(picRect(a,th),[0,0,0],[0,0,b]);
  if(perf){const n=7,m=6,r=Math.min(a,b)*.028,y=th/2;
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const x=-a/2+a*(i+.5)/n,z=b*(j+.5)/m;
      pr.decals.push({loops:[picCircle(r,8).map(([u,v])=>[x+u,y,z+v])],fill:PK_HOLE});}}
  return pr;}

/* что рисовать — по названию строки раскроя (#117, п. 4): [название, вид, сцена]; первое совпадение. Не нашлось — null (тест ловит строку без картинки).
   Сцена получает строку и её разобранные размеры {n — название, s — размер, N — все числа размера, L — длина «L …»} → {prisms, brk, label};
   label дописывается к aria-label (сторона полки уголка) */
const PIC_TYPES=[
  [/^уголок/,'angle',({r,n,L})=>{const [a,,t]=picABT(n,[30,30,3]),g=r.ang||{a,t,flange:'bottom'};
    return {...picStock(picAngle(g.a,Math.max(g.t,g.a*.12),g.flange),L,g.a),label:g.flange==='top'?'полка сверху':'полка снизу'};}],
  [/^труба — профтруба/,'chimney',({n,s})=>{const [a,,t]=picABT(n,[60,60,2]);return picElbow(a,Math.max(t,a*.08),[...s.matchAll(/L\s*(\d+)/g)].map(x=>+x[1]));}],
  [/профтруба/,'ptube',({n,L})=>{const [a,,t]=picABT(n,[60,60,2]);return picStock(picSqTube(a,Math.max(t,a*.08)),L,a);}],
  [/квадрат/,'square',({n,L})=>{const m=/(\d+)×(\d+)/.exec(n),a=m?picN(m[1]):6;return picStock(picRect(a,a),L,a);}],
  [/полоса/,'strip',({n,L})=>{const m=/(\d+)\s*×\s*(\d+(?:[.,]\d+)?)/.exec(n),w=m?picN(m[1]):20,t=m?picN(m[2]):3;return picStock(picRect(w,t),L,w);}],
  [/профлист/,'profsheet',({N})=>{const a=N[0]||1000,b=N[1]||800;return picOne(picPrism(picWave(a,a*.05,a*.012),[0,0,0],[0,0,b]));}],
  [/перфолист/,'perfo',({N})=>{const a=N[0]||380;return picOne(picPlate(a,N[1]||390,a*.03,true));}],
  [/^ножка/,'leg',({n,L})=>{const [D,t]=picDia(n,40),R=D/2;return picStock(picTube(R,Math.max(t||3,R*.15)),L,D,'y');}],
  [/^ручка дверцы/,'staple',({n,N})=>{const [D]=picDia(n,12);return picOne(...picU(D/2,N[0]||140,N[2]||22));}],
  [/^ручка/,'handle',({n,N})=>{const [D]=picDia(n,25);return picOne(...picU(D/2,N[2]||500,N[1]||50));}],
  [/проушина/,'ring',({n,s})=>{const [d]=picDia(n,6),m=/кольцо Ø(\d+)/.exec(s),Ro=(m?+m[1]:14)/2+d/2;   // «под крючок» — раньше крючка
    return picOne(picPrism({o:picCircle(Ro),h:[picCircle(Math.max(Ro-d,Ro*.35))],smooth:true},[0,0,0],[0,0,d]));}],
  [/крючок/,'hook',({n,L})=>{const [D]=picDia(n,6),c=picRound(D/2),Lt=L||70,h=Lt*.7;return picOne(picPrism(c,[0,0,0],[0,h,0]),picPrism(c,[0,h,0],[Lt-h,h,0]));}],
  [/заглушка/,'cap',({n,N})=>{const [D]=picDia(n,40),m=/М(\d+)×(\d+)/.exec(n),dm=m?+m[1]:16,ls=m?+m[2]:40,th=N[1]||4;
    return picOne(picPrism(picRound(D/2),[0,0,0],[0,th,0]),picPrism(picRound(dm/2,12),[0,th,0],[0,th+ls,0]));}],
  [/заслонка/,'damper',({N})=>{const a=N[0]||55,b=N[1]||55,t=Math.max(N[2]||3,a*.05),o=((N[4]||150)-a)/2,c=picRound((N[3]||8)/2,12);
    return picOne(picPrism(picRect(a,b),[a/2,0,0],[a/2,0,t]),picPrism(c,[-o,0,t/2],[0,0,t/2]),picPrism(c,[a,0,t/2],[a+o,0,t/2]));}],
  [/обечайка/,'shell',({N})=>{const R=(N[0]||900)/(2*Math.PI);return picOne(picPrism(picTube(R,Math.max(N[2]||3,R*.05)),[0,0,0],[0,N[1]||100,0]));}],
  [/пятка/,'plate',({N})=>{const a=N[0]||80;return picOne(picPlate(a,N[1]||a,Math.max(N[2]||5,a*.06),false));}],
  [/трубка|патрубок|труба/,'tube',({n,L})=>{const [D,t]=picDia(n,26),R=D/2;return picStock(picTube(R,Math.max(t||R*.15,R*.15)),L||D,D);}],
  [/арматура|пруток/,'rod',({n,L})=>{const [D]=picDia(n,16);return picStock(picRound(D/2),L,D);}]];
const picType=r=>{const n=String(r&&r.n||'').toLowerCase();return PIC_TYPES.find(([re])=>re.test(n))||null;};
const picKind=r=>{const e=picType(r);return e?e[1]:null;};
function picScene(r){const e=picType(r);if(!e)return null;const n=String(r.n||''),s=String(r.s||'');
  return e[2]({r,n,s,N:picNums(s),L:picLen(s)});}

// подпись под картинкой: сечение из названия и размер строки — «30×30×4 · L 780»; размер уже с сечением — только он
function picCap(r){const n=String(r.n||''),s=String(r.s||''),m=/(\d+×\d+×\d+(?:[.,]\d+)?|Ø\d+(?:×\d+)?|\d+×\d+|\d+ × \d+)/.exec(n),sec=m?m[1]:'',
  ns=v=>v.replace(/\s/g,'');
  return sec&&!ns(s).includes(ns(sec))?`${sec} · ${s}`:s;}
const picEsc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// картинка строки «Подготовить отдельно»: SVG 110 × 70 и подпись размера; строки без картинки — '' (тест ловит)
function prepPic(r){const sc=r&&picScene(r);if(!sc)return '';
  const lbl=picEsc(r.n+(sc.label?', '+sc.label:'')+(sc.brk?', показан укороченно':''));
  return `<svg class="pic" viewBox="0 0 ${PIC_W} ${PIC_H}" width="${PIC_W}" height="${PIC_H}" role="img" aria-label="${lbl}"${sc.brk?' data-break="1"':''}>`+
    `<g stroke="${PK_EDGE}" stroke-width=".5" stroke-linejoin="round">${picRender(sc.prisms)}</g></svg><small class="piccap">${picEsc(picCap(r))}</small>`;}
