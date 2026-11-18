/* ---------- часть 2: листы А3 для производства (как PDF МК-16) ----------
   SVG в мм бумаги (420×297). Лист 1 — общий вид (3 проекции + изометрия), затем лист на каждую сборку
   (вид, изометрия с номерами позиций, спецификация), затем листы деталей — по 3 позиции (заготовка, длина, углы). */
const SH_EMAIL='vashaklach@gmail.com',SCALES=[1,2,2.5,4,5,10,15,20,25,40,50,75,100,150,200,250,400,500];
// виды: r — вправо на листе, up — вверх, d — к зрителю. Вид слева стоит справа от главного, вид сверху — под ним (ГОСТ)
const VIEWS={front:{r:[1,0,0],up:[0,1,0],d:[0,0,1]},left:{r:[0,0,1],up:[0,1,0],d:[-1,0,0]},top:{r:[1,0,0],up:[0,0,-1],d:[0,1,0]}};
(()=>{const d=V3.norm([1,1,1]),r=V3.norm(V3.cross([0,1,0],d));VIEWS.iso={r,up:V3.cross(d,r),d};})();
const prj=(V,p)=>[V3.dot(p,V.r),-V3.dot(p,V.up)];
const r2=x=>Math.round(x*100)/100;
const shEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const pickScale=(need,avail)=>SCALES.find(n=>need.every((v,i)=>v/n<=avail[i]))||SCALES[SCALES.length-1];
const scaleTxt=n=>'1:'+String(n).replace('.',',');
// габарит вида на листе (в мм модели, до масштаба)
function projBox(cuts,V){let b=[1e9,1e9,-1e9,-1e9];cuts.forEach(c=>{const {A,B}=memberCorners(c);[...A,...B].forEach(p=>{const q=prj(V,p);b=[Math.min(b[0],q[0]),Math.min(b[1],q[1]),Math.max(b[2],q[0]),Math.max(b[3],q[1])];});});return b;}
// вид: грани труб, обращённые к зрителю, от дальних к ближним (белая заливка закрывает невидимое).
// Длинные грани режем на куски — так дальняя длинная труба не перекрывает ближнюю короткую
function viewSVG(cuts,V,k,ox,oy){const it=[],P=p=>{const q=prj(V,p);return [r2(ox+q[0]*k),r2(oy+q[1]*k)];},z=p=>V3.dot(p,V.d);
  const avg=a=>V3.mul(a.reduce((s,p)=>V3.add(s,p),[0,0,0]),1/a.length);
  cuts.forEach(c=>{const {A,B}=memberCorners(c),ctr=avg([...A,...B]);
    const nrm=f=>{let n=V3.cross(V3.sub(f[1],f[0]),V3.sub(f[2],f[0]));if(V3.len(n)<1e-9)n=V3.cross(V3.sub(f[2],f[0]),V3.sub(f[3],f[0]));if(V3.dot(n,V3.sub(avg(f),ctr))<0)n=V3.mul(n,-1);return V3.norm(n);};
    for(let i=0;i<4;i++){const j=(i+1)%4,a0=A[i],a1=B[i],b0=A[j],b1=B[j];if(V3.dot(nrm([a0,b0,b1,a1]),V.d)<1e-4)continue;
      const len=Math.max(V3.len(V3.sub(a1,a0)),V3.len(V3.sub(b1,b0))),np=Math.max(1,Math.ceil(len/250)),L=(a,b,t)=>V3.add(a,V3.mul(V3.sub(b,a),t));
      for(let s=0;s<np;s++){const p0=L(a0,a1,s/np),p1=L(a0,a1,(s+1)/np),q0=L(b0,b1,s/np),q1=L(b0,b1,(s+1)/np),ln=[[p0,p1],[q0,q1]];
        if(s===0)ln.push([p0,q0]);if(s===np-1)ln.push([p1,q1]);it.push({z:z(avg([p0,p1,q0,q1])),f:[p0,p1,q1,q0],ln});}}
    [A,B].forEach(cap=>{if(V3.dot(nrm(cap),V.d)<1e-4)return;it.push({z:z(avg(cap)),f:cap,ln:cap.map((p,i)=>[p,cap[(i+1)%4]])});});});
  it.sort((a,b)=>a.z-b.z);
  return it.map(o=>`<path class="w" d="M${o.f.map(P).join('L')}Z"/><path class="l" d="${o.ln.map(([a,b])=>`M${P(a)}L${P(b)}`).join('')}"/>`).join('');}
// стрелка размера: остриё в (x,y), смотрит по (ux,uy)
const arrow=(x,y,ux,uy)=>`<path class="ar" d="M${r2(x)},${r2(y)}L${r2(x-ux*2.5-uy*.6)},${r2(y-uy*2.5+ux*.6)}L${r2(x-ux*2.5+uy*.6)},${r2(y-uy*2.5-ux*.6)}Z"/>`;
// горизонтальный размер между точками (xa,ya) и (xb,yb), размерная линия на высоте yl
function dimH(xa,ya,xb,yb,yl,t){if(xb<xa)[xa,ya,xb,yb]=[xb,yb,xa,ya];const L=xb-xa;if(L<.3)return '';const sa=yl>ya?1:-1,sb=yl>yb?1:-1;
  let s=`<path class="t" d="M${r2(xa)},${r2(ya+sa)}V${r2(yl+sa*2)}M${r2(xb)},${r2(yb+sb)}V${r2(yl+sb*2)}M${r2(xa)},${r2(yl)}H${r2(xb)}`;
  const out=L<7;s+=out?`M${r2(xa-5)},${r2(yl)}H${r2(xa)}M${r2(xb)},${r2(yl)}H${r2(xb+5)}"/>`+arrow(xa,yl,1,0)+arrow(xb,yl,-1,0):'"/>'+arrow(xa,yl,-1,0)+arrow(xb,yl,1,0);
  const tw=String(t).length*1.9;
  return s+(L<tw+2?`<text x="${r2(xb+6)}" y="${r2(yl-1)}">${t}</text>`:`<text x="${r2((xa+xb)/2)}" y="${r2(yl-1)}" text-anchor="middle">${t}</text>`);}
// вертикальный размер, размерная линия на x = xl; текст повёрнут, читается снизу вверх
function dimV(xa,ya,xb,yb,xl,t){if(yb<ya)[xa,ya,xb,yb]=[xb,yb,xa,ya];const L=yb-ya;if(L<.3)return '';const sa=xl>xa?1:-1,sb=xl>xb?1:-1;
  let s=`<path class="t" d="M${r2(xa+sa)},${r2(ya)}H${r2(xl+sa*2)}M${r2(xb+sb)},${r2(yb)}H${r2(xl+sb*2)}M${r2(xl)},${r2(ya)}V${r2(yb)}`;
  const out=L<7;s+=out?`M${r2(xl)},${r2(ya-5)}V${r2(ya)}M${r2(xl)},${r2(yb)}V${r2(yb+5)}"/>`+arrow(xl,ya,0,1)+arrow(xl,yb,0,-1):'"/>'+arrow(xl,ya,0,-1)+arrow(xl,yb,0,1);
  const tw=String(t).length*1.9,cy=L<tw+2?ya-6-tw/2:(ya+yb)/2;
  return s+`<text transform="translate(${r2(xl-1)},${r2(cy)}) rotate(-90)" text-anchor="middle">${t}</text>`;}
// выноски с номерами: подписи столбиками слева и справа от вида, на полке
function balloonsSVG(items,box){const cx=(box[0]+box[2])/2;let s='';
  [[items.filter(i=>i.p[0]<cx),box[0]-6,-1],[items.filter(i=>i.p[0]>=cx),box[2]+6,1]].forEach(([arr,x,dir])=>{arr.sort((a,b)=>a.p[1]-b.p[1]);let y=-1e9;
    const ys=arr.map(it=>(y=Math.max(it.p[1]-6,y+8)));for(let i=ys.length-1,lim=box[3]+12;i>=0;i--){ys[i]=Math.min(ys[i],lim);lim=ys[i]-8;}
    arr.forEach((it,i)=>{const yy=r2(ys[i]),x2=x+dir*13;s+=`<circle class="ar" cx="${r2(it.p[0])}" cy="${r2(it.p[1])}" r=".6"/><path class="t" d="M${r2(it.p[0])},${r2(it.p[1])}L${x},${yy}H${x2}"/><text class="bl" x="${(x+x2)/2}" y="${r2(yy-1)}" text-anchor="middle">${shEsc(it.t)}</text>`;});});
  return s;}
// точка для выноски: середина оси той трубы позиции, что ближе к зрителю
function anchorOf(cuts,ids,V){let best=null,bz=-1e18;cuts.filter(c=>ids.includes(c.m.id)).forEach(c=>{const f=frame(c.m),m=V3.mul(V3.add(f.A,f.B),.5),z=V3.dot(m,V.d);if(z>bz){bz=z;best=m;}});return best;}
// таблица: cols [{t,w,r}] — r: по правому краю
function svgTable(x,y,cols,rows,rh=7){const W=cols.reduce((s,c)=>s+c.w,0),H=rh*(rows.length+1);let s=`<rect class="l" x="${x}" y="${y}" width="${W}" height="${H}"/><path class="t" d="`;
  for(let i=1;i<=rows.length;i++)s+=`M${x},${y+i*rh}H${x+W}`;let xx=x;cols.slice(0,-1).forEach(c=>{xx+=c.w;s+=`M${xx},${y}V${y+H}`;});s+='"/>';
  [cols.map(c=>c.t),...rows].forEach((r,ri)=>{let cx=x;r.forEach((v,i)=>{const c=cols[i],mx=Math.floor(c.w/1.55);let t=String(v);if(t.length>mx)t=t.slice(0,mx-1)+'…';
    s+=`<text class="td" x="${r2(ri===0?cx+c.w/2:c.r?cx+c.w-1.2:cx+1.2)}" y="${y+ri*rh+rh-2.2}"${ri===0?' text-anchor="middle"':c.r?' text-anchor="end"':''}>${shEsc(t)}</text>`;cx+=c.w;});});
  return s;}
// текст с переносом по словам
function textLines(x,y,lines,max=58,lh=5.5,cls=''){let s='',yy=y;lines.forEach(l=>{const w=String(l).split(' ');let cur='';
  const put=t=>{s+=`<text${cls?` class="${cls}"`:''} x="${x}" y="${r2(yy)}">${shEsc(t)}</text>`;yy+=lh;};
  w.forEach(q=>{if((cur+' '+q).trim().length>max){put(cur);cur=q;}else cur=(cur+' '+q).trim();});if(cur)put(cur);});return {s,y:yy};}
const SPEC_COLS=[{t:'Поз.',w:13},{t:'Наименование',w:44},{t:'Материал',w:38},{t:'L, мм',w:16,r:1},{t:'Углы',w:20},{t:'На сб.',w:14,r:1},{t:'Всего',w:14,r:1},{t:'Масса, кг',w:20,r:1}];
const specRow=p=>[p.no,prof(p.prof).name,prof(p.prof).wood?'Лиственница':M.meta.steel||'',p.L,p.ang.map(a=>a+'°').join(' / '),p.qty,p.total,fmt(p.kg,1)];
const fitIn=(b,k,x,y,w,h)=>[x+(w-(b[2]-b[0])*k)/2-b[0]*k,y+(h-(b[3]-b[1])*k)/2-b[1]*k];   // сдвиг, чтобы вид встал по центру области
const asmLabel=a=>a.gid?a.no+'СБ':'';

/* лист 1 — общий вид */
function sheetGeneral(cuts,asm){const bf=projBox(cuts,VIEWS.front),bl=projBox(cuts,VIEWS.left),bt=projBox(cuts,VIEWS.top);
  const W=bf[2]-bf[0],H=bf[3]-bf[1],D=bl[2]-bl[0],n=pickScale([W+D,H+D],[208,192]),k=1/n;
  const fx=45,fy=30,lx=fx+W*k+25,ty=fy+H*k+28;
  const F=[fx-bf[0]*k,fy-bf[1]*k],Lv=[lx-bl[0]*k,fy-bl[1]*k],T=[fx-bt[0]*k,ty-bt[1]*k];
  let s=`<g>${viewSVG(cuts,VIEWS.front,k,...F)}${viewSVG(cuts,VIEWS.left,k,...Lv)}${viewSVG(cuts,VIEWS.top,k,...T)}</g>`;
  const fx1=fx+W*k,fy1=fy+H*k,lx1=lx+D*k,ty1=ty+D*k;
  s+=dimV(fx,fy1,fx,fy,fx-9,Math.round(H))+dimH(fx,ty1,fx1,ty1,ty1+9,Math.round(W))+dimV(fx,ty1,fx,ty,fx-9,Math.round(D))+dimH(lx,fy1,lx1,fy1,fy1+9,Math.round(D));
  // отметки высот: верх каждой горизонтальной трубы от низа каркаса — справа от вида слева
  const ymin=bbox().min[1],lv=new Set([0]);cuts.forEach(c=>{if(Math.abs(frame(c.m).d[1])>.05)return;const {A,B}=memberCorners(c);lv.add(Math.round(Math.max(...[...A,...B].map(p=>p[1]))-ymin));});
  let last=-1e9;[...lv].sort((a,b)=>a-b).forEach(h=>{const y=fy1-h*k;if(Math.abs(y-last)<3.6)return;last=y;s+=`<path class="t" d="M${r2(lx1+2)},${r2(y)}H${r2(lx1+18)}"/><text class="td" x="${r2(lx1+18)}" y="${r2(y-.8)}" text-anchor="end">${h}</text>`;});
  // изометрия; если сборок несколько — выноски «1СБ, 2СБ…»
  const bi=projBox(cuts,VIEWS.iso),groups=asm.filter(a=>a.gid),ni=pickScale([bi[2]-bi[0],bi[3]-bi[1]],groups.length?[72,130]:[100,130]),ki=1/ni;
  const I=fitIn(bi,ki,groups.length?318:305,28,groups.length?72:100,130);s+=viewSVG(cuts,VIEWS.iso,ki,...I);
  if(groups.length){const P=p=>{const q=prj(VIEWS.iso,p);return [I[0]+q[0]*ki,I[1]+q[1]*ki];};
    s+=balloonsSVG(groups.map(a=>({t:asmLabel(a),p:P(anchorOf(a.cuts,a.cuts.map(c=>c.m.id),VIEWS.iso))})),[I[0]+bi[0]*ki,I[1]+bi[1]*ki,I[0]+bi[2]*ki,I[1]+bi[3]*ki]);}
  const notes=[M.meta.name||'Каркас'];
  groups.forEach(a=>notes.push(`${asmLabel(a)} — ${a.name}: ${a.qty} шт${a.mirror&&a.qty>1?`, из них ${Math.floor(a.qty/2)} зеркальн.`:''}`));
  notes.push('Материал: '+(M.meta.steel||'—'));if(M.meta.paint)notes.push('Покраска: '+M.meta.paint);
  notes.push('Размеры в мм. Длина реза — по длинной грани.','Отметки справа от вида слева — верх труб от низа каркаса.');
  if(M.meta.note)notes.push(M.meta.note);
  s+=textLines(300,180,notes,48,5.5).s;
  return {title:'Общий вид',scale:scaleTxt(n),body:s};}

/* лист сборки: спецификация, главный вид с габаритами, изометрия с номерами позиций */
function sheetAsm(a,ps){let s=svgTable(25,22,SPEC_COLS,ps.map(specRow));const ty=22+7*(ps.length+1);
  const v=['front','left','top'].map(k=>{const b=projBox(a.cuts,VIEWS[k]);return {k,b,A:(b[2]-b[0]+1)*(b[3]-b[1]+1)};}).sort((x,y)=>y.A-x.A)[0];
  const bw=v.b[2]-v.b[0],bh=v.b[3]-v.b[1],ah=Math.max(30,250-ty-24),n=pickScale([bw,bh],[150,ah]),k=1/n;
  const O=fitIn(v.b,k,45,ty+14,150,ah),x0=O[0]+v.b[0]*k,y0=O[1]+v.b[1]*k,x1=x0+bw*k,y1=y0+bh*k;
  s+=viewSVG(a.cuts,VIEWS[v.k],k,...O)+dimH(x0,y1,x1,y1,y1+9,Math.round(bw))+dimV(x0,y1,x0,y0,x0-9,Math.round(bh));
  s+=`<text class="td" x="${r2((x0+x1)/2)}" y="${r2(y0-4)}" text-anchor="middle">${({front:'Вид спереди',left:'Вид слева',top:'Вид сверху'})[v.k]} (${scaleTxt(n)})</text>`;
  const bi=projBox(a.cuts,VIEWS.iso),ni=pickScale([bi[2]-bi[0],bi[3]-bi[1]],[130,200]),ki=1/ni,I=fitIn(bi,ki,252,52,130,200);
  s+=viewSVG(a.cuts,VIEWS.iso,ki,...I);
  const P=p=>{const q=prj(VIEWS.iso,p);return [I[0]+q[0]*ki,I[1]+q[1]*ki];};
  s+=balloonsSVG(ps.map(p=>({t:p.no,p:P(anchorOf(a.cuts,p.ids,VIEWS.iso))})),[I[0]+bi[0]*ki,I[1]+bi[1]*ki,I[0]+bi[2]*ki,I[1]+bi[3]*ki]);
  const nt=[`${asmLabel(a)?asmLabel(a)+' — ':''}${a.name}: ${a.qty} шт.`];
  if(a.mirror&&a.qty>1)nt.push(`${Math.ceil(a.qty/2)} шт — как на чертеже, ${Math.floor(a.qty/2)} шт — зеркально.`);
  s+=textLines(215,30,nt,72,6,'h2').s;
  return {title:`Сборка ${asmLabel(a)||a.no} · ${a.name}`,scale:scaleTxt(n),body:s};}

/* заготовка в плоскости (ось трубы, axis): контур — выпуклая оболочка 8 углов; длинная грань снизу; длинные — с разрывом */
function hull2(P){const p=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  p.forEach(q=>{while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=1e-9)lo.pop();lo.push(q);});
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=1e-9)up.pop();up.push(q);}
  return lo.slice(0,-1).concat(up.slice(0,-1));}
function partView(c,axis,x0,y0,w,angs,nf){const f=frame(c.m),{A,B}=memberCorners(c);
  let P=[...A,...B].map(p=>{const q=V3.sub(p,f.A);return [V3.dot(q,f.d),V3.dot(q,axis)];});
  const ext=sg=>{const s=P.filter(q=>q[1]*sg>0).map(q=>q[0]);return s.length?Math.max(...s)-Math.min(...s):0;};if(ext(1)>ext(-1)+.01)P=P.map(q=>[q[0],-q[1]]);
  const H=hull2(P),ss=P.map(q=>q[0]),ts=P.map(q=>q[1]),smin=Math.min(...ss),smax=Math.max(...ss),tmin=Math.min(...ts),tmax=Math.max(...ts),L=smax-smin,T=tmax-tmin;
  let n=nf&&T/nf>=3?nf:SCALES.find(q=>L/q<=w)||SCALES[SCALES.length-1];if(T/n<3){const n2=[...SCALES].reverse().find(q=>T/q>=5)||1;if(n2<n)n=n2;}
  const brk=L/n>w,a=brk?(w/2-6)*n:0,sl=smin+a,sr=smax-a;
  const X=s=>r2(!brk?x0+(w-L/n)/2+(s-smin)/n:s<=sl+1e-6?x0+(s-smin)/n:x0+w-(smax-s)/n),Y=t=>r2(y0+(tmax-t)/n);
  let d='';H.forEach((p,i)=>{const q=H[(i+1)%H.length];
    if(brk&&((p[0]<=sl&&q[0]>=sr)||(q[0]<=sl&&p[0]>=sr))){const at=s=>p[1]+(q[1]-p[1])*(s-p[0])/(q[0]-p[0]),bp=p[0]<q[0]?sl:sr,bq=p[0]<q[0]?sr:sl;
      d+=`M${X(p[0])},${Y(p[1])}L${X(bp)},${Y(at(bp))}M${X(bq)},${Y(at(bq))}L${X(q[0])},${Y(q[1])}`;}
    else d+=`M${X(p[0])},${Y(p[1])}L${X(q[0])},${Y(q[1])}`;});
  let s=`<path class="l" d="${d}"/>`;
  if(brk)[X(sl),X(sr)].forEach(x=>{const ya=Y(tmax)-2,yb=Y(tmin)+2,m=(ya+yb)/2;s+=`<path class="t" d="M${x},${r2(ya)}V${r2(m-1.5)}L${r2(x+1.2)},${r2(m-.5)}L${r2(x-1.2)},${r2(m+.5)}L${x},${r2(m+1.5)}V${r2(yb)}"/>`;});
  // размер — от крайних точек по длине
  const pa=P.find(q=>q[0]===smin),pb=P.find(q=>q[0]===smax),yl=Y(tmin)+8;
  s+=dimH(X(smin),Y(pa[1]),X(smax),Y(pb[1]),yl,c.L);
  // углы, отличные от 45° и 90°, — у своего конца
  if(angs)[[c.angA,smin,'end'],[c.angB,smax,'start']].forEach(([g,sx,an])=>{if(g===45||g===90)return;s+=`<text class="td" x="${r2(X(sx)+(an==='end'?-1.5:1.5))}" y="${r2(Y(tmax)-1)}" text-anchor="${an}">${g}°</text>`;});
  return {s,h:T/n+12,n,brk};}
function sheetParts(ps,cuts){let s=svgTable(25,22,SPEC_COLS,ps.map(specRow));const ty=22+7*(ps.length+1);
  s+=`<text class="h2" x="225" y="30">Углы 45°, если не указано иное</text><text class="td" x="225" y="36">Длина — по длинной грани, мм. Отклонение длины ±1 мм</text>`;
  const top=ty+6,sh=(272-top)/3,nS=SCALES.find(q=>Math.max(...ps.map(p=>p.L))/q<=300)||SCALES[SCALES.length-1];   // один масштаб на лист — длины видны в сравнении
  ps.forEach((p,i)=>{const sy=top+i*sh,c=cuts.find(x=>x.m.id===p.ids[0]),pr=prof(p.prof),f=frame(c.m);
    if(i)s+=`<path class="t" d="M20,${r2(sy)}H415"/>`;
    s+=`<text class="h2" x="25" y="${r2(sy+7)}">Поз. ${p.no}</text><text class="td" x="25" y="${r2(sy+12.5)}">${shEsc(pr.name)} · L ${p.L} · ${p.total} шт${grpQty(p.grp)>1?` (${p.qty} × ${grpQty(p.grp)})`:''}</text>`;
    // главный вид — в плоскости, где скосы; если скосы и в другой плоскости — второй вид ниже
    const cu=Math.abs(V3.dot(c.ea.cut.n,f.u))+Math.abs(V3.dot(c.eb.cut.n,f.u)),cv=Math.abs(V3.dot(c.ea.cut.n,f.v))+Math.abs(V3.dot(c.eb.cut.n,f.v));
    const [a1,a2]=cv>=cu?[f.v,f.u]:[f.u,f.v],v1=partView(c,a1,70,sy+10,300,true,nS);s+=v1.s+`<text class="td" x="410" y="${r2(sy+7)}" text-anchor="end">${scaleTxt(v1.n)}${v1.brk?', с разрывом':''}</text>`;
    if(Math.min(cu,cv)>.05&&v1.h+30<sh){const v2=partView(c,a2,70,sy+10+v1.h+6,300,false,v1.n);s+=`<text class="td" x="25" y="${r2(sy+16+v1.h+6)}">Вид по соседней грани</text>`+v2.s;}});
  return {title:'Детали: '+ps.map(p=>p.no).join(', '),scale:scaleTxt(nS),body:s};}

const SH_STYLE=`<style>.l{fill:none;stroke:#000;stroke-width:.35;stroke-linejoin:round;stroke-linecap:round}.t{fill:none;stroke:#000;stroke-width:.18}.fr{fill:none;stroke:#000;stroke-width:.7}.w{fill:#fff;stroke:none}.ar{fill:#000}text{font-family:"Arial Narrow",Arial,sans-serif;font-style:italic;fill:#000;font-size:3.5px}.hd{font-size:6px}.h2{font-size:4.5px}.sm,.lb{font-size:2.3px}.td{font-size:3px}.bl{font-size:4.5px}</style>`;
// рамка, заголовок, основная надпись (только email — по просьбе автора)
function wrapSheet(b,o){const x=230,y=276,c=[95,30,30,30],cell=(i,row,lab,val)=>{const xx=x+c.slice(0,i).reduce((s,v)=>s+v,0),yy=y+row*8;return `<text class="lb" x="${xx+1}" y="${yy+2.6}">${lab}</text><text class="td" x="${xx+1.2}" y="${yy+6.6}">${shEsc(val)}</text>`;};
  let xs=x,v='';c.slice(0,-1).forEach(w=>{xs+=w;v+=`M${xs},${y}V${y+16}`;});
  const tb=`<rect class="fr" x="${x}" y="${y}" width="185" height="16"/><path class="t" d="M${x},${y+8}H415${v}"/>`+cell(0,0,'Изделие',M.meta.name||'Каркас')+cell(1,0,'Масштаб',b.scale)+cell(2,0,'Масса',`≈ ${fmt(o.mass,1)} кг`)+cell(3,0,'Ревизия',String(M.meta.rev||1))
    +cell(0,1,'email',SH_EMAIL)+cell(1,1,'Дата',o.date)+cell(2,1,'Лист',String(o.n))+cell(3,1,'Листов',String(o.N));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297" width="420mm" height="297mm">${SH_STYLE}<rect width="420" height="297" fill="#fff"/><rect class="fr" x="20" y="5" width="395" height="287"/><path class="l" d="M20,17H415"/>`
    +`<text class="hd" x="25" y="13.5">${shEsc(M.meta.name||'Каркас')}</text><text class="h2" x="410" y="13.5" text-anchor="end">${shEsc(b.title)}</text>${b.body}${tb}<text class="sm" x="415" y="295.6" text-anchor="end">Формат А3</text></svg>`;}
// весь комплект: [{title, svg}]
function buildSheets(){const cuts=memberCuts();if(!cuts.length)return [];
  const pos=positions(),asm=[];
  M.groups.forEach((g,i)=>{const cs=cuts.filter(c=>c.m.grp===g.id&&!c.m.ci);if(cs.length)asm.push({no:String(g.no||i+1),name:g.name,qty:g.qty,mirror:g.mirror,gid:g.id,cuts:cs});});
  const free=cuts.filter(c=>!c.m.grp);if(free.length)asm.push({no:String(M.groups.length+1),name:M.groups.length?'Без сборки':(M.meta.name||'Каркас'),qty:1,mirror:false,gid:'',cuts:free});
  const pages=[()=>sheetGeneral(cuts,asm)];asm.forEach(a=>pages.push(()=>sheetAsm(a,pos.filter(p=>p.grp===a.gid))));
  for(let i=0;i<pos.length;i+=3){const ps=pos.slice(i,i+3);pages.push(()=>sheetParts(ps,cuts));}
  const o={N:pages.length,mass:massTotal(),date:new Date().toLocaleDateString('ru-RU')};
  return pages.map((f,i)=>{const b=f();return {title:b.title,svg:wrapSheet(b,Object.assign({n:i+1},o))};});}
