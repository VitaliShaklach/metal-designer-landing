// расчёт гибки из сайта (art/js/bend.js) для командной строки: цифры и картинка заготовок
// node art/tools/plates/bend.js [id=doberman9|file.json] [ang=135] [face=20] [max=300] [min=20] [bends=7] [sheet=1250x2500] [trace=1] [convex=1] [t=1.5] [gap=1] [png=bend_x]
//   ang — наименьший угол между гранями после гибки; face — грань у сгиба не уже; max/min — длина линии сгиба; bends — сгибов на заготовку
//   trace=1 — при выборе сначала гнуть там, где у эталона нет нарисованного шва (сварка — где шов нарисован); convex=1 — только выпуклые (V)
// как модуль: require('./bend.js')(g).plan({V,P,S},o) → bendPlan сайта ({blanks, J, st, …}); в контексте g должны быть mesh, edit, prod, bend
module.exports=function(g){const parts=E=>g('buildParts')(g('polyBase')(E.V,E.P,E.S),1.5,1.5);
  return {parts,plan:(E,o)=>{const R=parts(E),r=g('bendPlan')(R,E.V,o);r.R=R;return r;},overlap:(P,Q,eps)=>g('bendOverlap')(P,Q,eps)};};

if(require.main===module){const fs=require('fs'),path=require('path'),vm=require('vm'),JS=path.join(__dirname,'../../js/'),{writePNG}=require('./png.js');
  const c={Math};vm.createContext(c);['mesh','edit','models-poly','figures','prod','bend'].forEach(f=>vm.runInContext(fs.readFileSync(JS+f+'.js','utf8'),c));const g=n=>vm.runInContext(n,c),V3=g('V3');
  const args=process.argv.slice(2),id=args.find(a=>!a.includes('='))||'doberman9',A=Object.fromEntries(args.filter(a=>a.includes('=')).map(a=>a.split('=')));
  let E,f=null;if(/\.json$/i.test(id)){const j=JSON.parse(fs.readFileSync(id,'utf8'));E={V:j.V,P:j.P,S:j.S||[]};f={ref:j.ref,frame:j.frame};}else{E=g(`modelPoly('${id}')`);f=g('FIGURES')[id]||{};}
  const B0=g('BEND'),o={ang:+(A.ang||B0.ang),face:+(A.face||B0.face),max:+(A.max||B0.max),min:+(A.min||B0.min),bends:+(A.bends||B0.bends),sheet:(A.sheet||'1250x2500').split('x').map(Number),convex:A.convex==='1'};
  const B=module.exports(g),R=B.parts(E);
  // калька: шов нарисован у эталона — линия в 3 мм хотя бы в двух пробах из трёх
  const rid=f.ref||id;if(A.trace==='1'){const K=require('./creases.js')(rid);let map=p=>p;if(f.frame){const rb=g('meshBox')(g('modelPoly')(rid).V),F0=f.frame[0],F1=f.frame[1];map=p=>p.map((x,i)=>(x-F0[i])*rb.size[i]/(F1[i]-F0[i])+rb.min[i]);}
    o.line=j=>{const n1=R.parts[j.p].n,n2=R.parts[j.q].n,a=E.V[j.A],b=E.V[j.B],u=V3.norm(V3.sub(b,a));return [.25,.5,.75].filter(t=>{const r=K.profile(map(V3.add(a,V3.mul(V3.sub(b,a),t))),u,n1,n2);return r.line!==null&&Math.abs(r.line)<3;}).length>=2;};}
  const r=g('bendPlan')(R,E.V,o),s=r.st;
  if(o.line){const lb=r.J.filter(j=>o.line(j));console.log('стыков с нарисованным швом у эталона:',lb.length,'из них гнутых',lb.filter(j=>r.bent.has(j.id)).length);}
  const T={t:+(A.t||1.5),gap:+(A.gap||1),useT:A.t!=='0'},BL=r.blanks.filter(b=>b.parts.length>1).map(b=>({b,x:g('bendBlank')(b,R,E.V,r,T)}));
  console.log(`деталей ${s.parts} → кусков ${s.blanks}: заготовок со сгибами ${s.multi}, отдельных ${s.single}; сгибов V ${s.V}, m ${s.m} (${(s.bendLen/1000).toFixed(2)} м); сварных швов ${s.weld} из ${s.joints}, ${(s.weldLen/1000).toFixed(2)} м; сгибов на заготовку до ${s.maxBends}`);
  console.log(`контуры (t=${T.t}, зазор ${T.gap}): плохих ${BL.filter(z=>z.x.bad).length}; самая длинная заготовка ${Math.round(Math.max(0,...BL.map(z=>z.x.L)))} мм`);
  console.log('почему варим:',Object.entries(s.why).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(', '));
  // картинка: контур реза — чёрным, сгибы V — красным пунктиром, m — синим
  if(A.png){const S=+(A.size||1600),pad=12,bl=BL.filter(z=>!z.x.bad).sort((a,b)=>b.x.L-a.x.L);let x=pad,y=pad,row=0;const items=[];
    const sc=Math.min(1.2,(S-2*pad)/Math.max(...bl.map(z=>z.x.L+pad),1));bl.forEach(z=>{const P=z.x.pts,h=g('convexHull')(P);let ba=0,bw=1e9;h.forEach((p,i)=>{const q=h[(i+1)%h.length],a=Math.atan2(q[1]-p[1],q[0]-p[0]),cc=Math.cos(a),ss=Math.sin(a);let y0=1e9,y1=-1e9;h.forEach(t=>{const yy=-ss*t[0]+cc*t[1];y0=Math.min(y0,yy);y1=Math.max(y1,yy);});if(y1-y0<bw){bw=y1-y0;ba=a;}});
      const cc=Math.cos(-ba),ss=Math.sin(-ba),rot=p=>[cc*p[0]-ss*p[1],ss*p[0]+cc*p[1]],R2=P.map(rot),x0=Math.min(...R2.map(p=>p[0])),y0=Math.min(...R2.map(p=>p[1])),w=(Math.max(...R2.map(p=>p[0]))-x0)*sc,hh=(Math.max(...R2.map(p=>p[1]))-y0)*sc;
      if(x+w>S-pad){x=pad;y+=row+pad;row=0;}const X=x,Y=y;items.push({z,tr:p=>{const q=rot(p);return [X+(q[0]-x0)*sc,Y+(q[1]-y0)*sc];}});x+=w+pad;row=Math.max(row,hh);});
    const H=Math.ceil(y+row+pad),px=Buffer.alloc(S*H*3,255),dot=(X,Y,cl)=>{X=Math.round(X);Y=Math.round(Y);for(let d=0;d<2;d++){if(X+d<0||X+d>=S||Y<0||Y>=H)continue;const i=(Y*S+X+d)*3;px[i]=cl[0];px[i+1]=cl[1];px[i+2]=cl[2];}};
    const line=(a,b,cl,dash)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));for(let k=0;k<=n;k++){if(dash&&(k%8)>4)continue;dot(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,cl);}};
    items.forEach(({z,tr})=>{const P=z.x.pts;P.forEach((p,k)=>line(tr(p),tr(P[(k+1)%P.length]),[0,0,0]));z.x.lines.forEach(l=>l.segs.forEach(q=>line(tr([q[0],q[1]]),tr([q[2],q[3]]),l.kind==='V'?[220,40,30]:[30,80,220],true)));});
    const out=path.join(__dirname,'out',A.png+'.png');writePNG(out,S,H,px);console.log('картинка',path.relative(process.cwd(),out),'—',bl.length,'заготовок со сгибами');}}
