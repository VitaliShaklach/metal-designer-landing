/* ---------- размеры на 3D ---------- */
const DIMC=0xd0561f;
function lab(text,pos,cls='d3'){const el=document.createElement('div');el.className=cls;el.textContent=text;const o=new THREE.CSS2DObject(el);o.userData.dim=1;o.position.copy(pos);group.add(o);return o;}
// размер как на чертеже: 2 выносные линии (если есть отступ off) и размерная линия со стрелками на концах.
// Маленький размер — стрелки снаружи, смотрят внутрь. text '' — просто линия-отметка без стрелок
function dim3(a,b,off,text,lp=.5){   // lp — где подпись на линии (0…1)
  const V=THREE.Vector3,A=new V(...a),Bp=new V(...b),O=new V(...off),A2=A.clone().add(O),B2=Bp.clone().add(O);
  const has=O.lengthSq()>0,on=has?O.clone().normalize():null,L=A2.distanceTo(B2),d=B2.clone().sub(A2).normalize();
  const P=[A2,B2];
  if(has)P.push(A.clone().add(on.clone().multiplyScalar(.3)),A2.clone().add(on.clone().multiplyScalar(.6)),Bp.clone().add(on.clone().multiplyScalar(.3)),B2.clone().add(on.clone().multiplyScalar(.6)));   // выносные: от детали с зазором, за размерную на 6 мм
  if(text!==''){
    const ar=Math.min(1,Math.max(.35,L*.22)),out=L<2.5*ar;   // стрелка ~10 мм, у мелких — короче; не влезает — снаружи
    let pp=on||new V().crossVectors(d,new V(0,1,0));if(pp.lengthSq()<1e-6)pp=new V().crossVectors(d,new V(1,0,0));pp.normalize();
    const w=pp.multiplyScalar(ar*.28),arrow=(tip,dir)=>{const base=tip.clone().add(dir.clone().multiplyScalar(ar));P.push(tip,base.clone().add(w),tip,base.clone().sub(w));};
    if(out){arrow(A2,d.clone().negate());arrow(B2,d.clone());P.push(A2,A2.clone().sub(d.clone().multiplyScalar(ar*2)),B2,B2.clone().add(d.clone().multiplyScalar(ar*2)));}   // полки за стрелками
    else{arrow(A2,d.clone());arrow(B2,d.clone().negate());}}
  let lp3=null;
  if(text){lp3=A2.clone().lerp(B2,lp);
    if(L<2.5){const m=lp3.clone();lp3.add((on||new V(0,1,0)).clone().multiplyScalar(3.2));P.push(m,lp3.clone());}}   // маленький размер: подпись сбоку на полочке, чтобы не закрывала линию
  const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P),new THREE.LineBasicMaterial({color:DIMC,depthTest:false,transparent:true}));
  ls.renderOrder=10;ls.userData.dim=1;group.add(ls);
  if(lp3)lab(text,lp3);
}
function dimDefs(){
  const f=W,hs=holes(),V=THREE.Vector3,xl=tubes[0][0],xr=tubes[2][0],gap=Math.round(slopeY(W/2)-kzTop()),zB=gOn()?0:ZK0,zF=gOn()?W:ZK1;
  // ножки по концам блока (передняя у каждого конца), первая с колесом и первая на пятке
  const LG=Object.values(legsList().reduce((m,l)=>{if(!m[l[0]]||l[1]>m[l[0]][1])m[l[0]]=l;return m;},{})).sort((a,b)=>b[0]-a[0]),LW=LG.find(l=>l[3]),LF=LG.find(l=>!l[3]);
  return [
  ['@all'],
  ['len','Общая длина',XR()+HX-XL(),()=>dim3([XL(),T,zF],[XR()+HX,T,zF],[0,0,22],`${u(XR()+HX-XL())} общая длина`)],
  ['len0','Длина без ручки',XR()-XL(),()=>dim3([XL(),T,zB],[XR(),T,zB],[0,0,-12],`${u(XR()-XL())} без ручки`)],
  ['w39',`Ширина ${gOn()?'жаровни':'печи'}`,WD(),()=>dim3([XR(),T,zB],[XR(),T,zB+WD()],[0,9,0],`${gOn()?'жаровня':'печь'} ${u(WD())}`)],
  ['top','Высота верха от земли',T,()=>dim3([XR(),0,zB],[XR(),T,zB],[0,0,-10],`верх ${u(T)}`)],
  ['@grill'],
  ['#Боковины жаровни','side0,side1'],
  ['l80','Длина жаровни',L1,()=>dim3([0,T,f],[L1,T,f],[0,0,12],u(L1))],
  ['h12','Глубина жаровни',u(H1),()=>dim3([L1,B,f],[L1,T,f],[0,0,6],u(H1))],
  ['holeB','Отверстия: от низа боковины до центра',`${fmt((HOLE_Y-t)*10)} мм`,()=>{const x=holes()[2];dim3([x,B+t,W],[x,B+HOLE_Y,W],[0,0,3],`до центра ${fmt((HOLE_Y-t)*10)} мм`);}],
  ['holeD','Отверстия поддува: диаметр',`Ø${fmt(HOLE*10)} мм`,()=>{const x=holes()[4],y=B+HOLE_Y,z=W+.05;dim3([x-HOLE/2,y,z],[x+HOLE/2,y,z],[0,-(HOLE/2+1.5),0],`Ø${fmt(HOLE*10)} мм`);}],
  ['holeGap','Отверстия поддува: между краями',u(S.pitch-HOLE),()=>{const h=holes(),y=B+HOLE_Y,z=W+.05;dim3([h[6]+HOLE/2,y,z],[h[7]-HOLE/2,y,z],[0,HOLE/2+1.5,0],`между краями ${u(S.pitch-HOLE)}`);}],
  ['hole1','Первое отверстие от края',u(hs[0]),()=>dim3([0,B+HOLE_Y,f],[hs[0],B+HOLE_Y,f],[0,-5,0],u(hs[0]))],
  ['nHoles','Отверстия: кол-во и шаг',`${hs.length} × Ø15 мм`,()=>lab(`${hs.length} отв. Ø15 мм · шаг ${u(S.pitch)} · центр ${u(HOLE_Y)} от низа`,new V(40,B+HOLE_Y,W+.4),'n3')],
  ['nSlots','Прорези под шампуры: описание',`${slots().length} шт`,()=>{const ss=slots().filter(x=>x>30&&x<50),k=Math.floor(ss.length/2)-1,z=W+.05;
    const p=new V(ss[k+1],T-4.5,z),P=[];[0,1,2].forEach(i=>{P.push(p.clone().add(new V(0,.6,0)),new V(ss[k+i],T-SLOT_D,z));});   // от надписи 3 линии к прорезям
    const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P),new THREE.LineBasicMaterial({color:DIMC,depthTest:false}));ls.renderOrder=10;group.add(ls);
    lab(`прорези ${SLOT_W*10} × ${SLOT_D*10} мм · шаг ${SLOT*10} · ${slots().length} шт на каждой боковине`,p,'d3');}],
  ['slotW','Прорези: ширина',`${SLOT_W*10} мм`,()=>{const x=slots().filter(x=>x>30)[0];dim3([x-SLOT_W/2,T,W],[x+SLOT_W/2,T,W],[0,3,2],`${SLOT_W*10} мм`);}],
  ['slotD','Прорези: глубина',SLOT_D,()=>{const x=slots().filter(x=>x>34)[0];dim3([x,T-SLOT_D,W],[x,T,W],[0,0,4],`глубина ${u(SLOT_D)}`);}],
  ['slotP','Прорези: шаг',SLOT,()=>{const ss=slots().filter(x=>x>40);dim3([ss[0],T,W],[ss[1],T,W],[0,5,2],`шаг ${u(SLOT)}`);}],
  ['#Прорези под перегородку (в обеих боковинах)','side0,side1'],
  ['sdDivP','Прорези под перегородку: от правого торца',DIV_POS.map(v=>u(v)).join(' / '),()=>{const y=T+1,z=W;DIV_POS.forEach((p,i)=>dim3([L1-p,y,z],[L1,y,z],[0,2+i*3,2],`${u(p)}`));}],
  ['sdDivS','Прорезь под перегородку: ширина × глубина',`${DIV_SW*10} × ${DIV_SD*10} мм`,()=>{const x=L1-DIV_POS[2];dim3([x-DIV_SW/2,T,W],[x+DIV_SW/2,T,W],[0,2,2],`${DIV_SW*10} мм`);dim3([x+DIV_SW/2,T-DIV_SD,W],[x+DIV_SW/2,T,W],[2,0,2],`${DIV_SD*10} мм`);}],
  ['#Глубокие прорези','side0,side1'],
  ['deepD','Глубина прорези',DEEP_D,()=>dim3([DEEP_X[0],T-DEEP_D,W],[DEEP_X[0],T,W],[0,0,6],`глубина ${u(DEEP_D)}`)],
  ['deepS','Прорезь в дне глубокой прорези',`${DEEP_SW*10} × ${DEEP_SD*10} мм`,()=>{const x=DEEP_X[1],y=T-DEEP_D;dim3([x,y-DEEP_SD,W],[x,y,W],[3,0,3],'5 мм');dim3([x-DEEP_SW/2,y-DEEP_SD,W],[x+DEEP_SW/2,y-DEEP_SD,W],[0,-1.2,2],`${DEEP_SW*10} мм`);}],
  ['deepW','Ширина прорези',`${DEEP_W*10} мм`,()=>dim3([DEEP_X[1]-DEEP_W/2,T,W],[DEEP_X[1]+DEEP_W/2,T,W],[0,4,2],`${DEEP_W*10} мм`)],
  ['deepP','Шаг прорезей',DEEP_X[1]-DEEP_X[0],()=>dim3([DEEP_X[2],T,W],[DEEP_X[3],T,W],[0,8,3],`шаг ${u(DEEP_X[1]-DEEP_X[0])}`)],
  ['deepE','От правого торца до последней',L1-DEEP_X[DEEP_X.length-1],()=>dim3([DEEP_X[DEEP_X.length-1],T,W],[L1,T,W],[0,8,3],u(L1-DEEP_X[DEEP_X.length-1]))],
  ['deepN','Глубокие прорези: кол-во',`${DEEP_X.length} шт`,()=>lab(`${DEEP_X.length} шт · ${DEEP_W*10} мм · дно прямое, в дне прорезь ${DEEP_SW*10} × ${DEEP_SD*10} мм · обе боковины`,new V(62,T-DEEP_D-2,W+2),'n3')],
  ['#Вырез под решётку (задняя боковина)','side0'],
  ['gnW','Вырез под решётку: ширина',GN_W,()=>dim3([GN_X-GN_W/2,T,0],[GN_X+GN_W/2,T,0],[0,4,-3],`вырез ${u(GN_W)}`)],
  ['gnD','Вырез под решётку: глубина',GN_D,()=>dim3([GN_X+GN_W/2,T-GN_D,0],[GN_X+GN_W/2,T,0],[2,0,-4],`глубина ${u(GN_D)}`)],
  ['gnE','Вырез: от левого края до выреза',GN_X-GN_W/2,()=>dim3([0,T,0],[GN_X-GN_W/2,T,0],[0,9,-3],u(GN_X-GN_W/2))],
  ['#Дно жаровни','gBot'],
  ['gbS','Дно жаровни: размер',`${u(L1)} × ${u(W)}`,()=>{dim3([0,B,W],[L1,B,W],[0,-4,4],`дно ${u(L1)}`);dim3([L1,B,0],[L1,B,W],[5,-4,0],`дно ${u(W)}`);}],
  ['gbT','Дно жаровни: толщина','5 мм',()=>dim3([L1,B,W],[L1,B+t,W],[4,0,4],'5 мм')],
  ['#Торец правый','gEnd'],
  ['geW','Торец: ширина (между боковинами)',W-2*t,()=>dim3([L1,T,t],[L1,T,W-t],[6,3,0],`торец ${u(W-2*t)}`)],
  ['geH','Торец: высота',u(H1-t),()=>dim3([L1,B+t,W/2],[L1,T,W/2],[5,0,0],`торец ${u(H1-t)}`)],
  ['#Торец левый (задняя стенка)','gEnd0'],
  ['ge0W','Левый торец: ширина (между боковинами)',W-2*t,()=>dim3([0,T,t],[0,T,W-t],[-6,3,0],`торец ${u(W-2*t)}`)],
  ['ge0H','Левый торец: высота',u(H1-t),()=>dim3([0,B+t,W/2],[0,T,W/2],[-5,0,0],`торец ${u(H1-t)}`)],
  ['#Логотип Claude Code (вырез в левом торце)','logo',null,'grill'],
  ['logoS','Логотип: размер выреза',`${fmt(16*LOGO_U*10,0)} × ${fmt(10*LOGO_U*10,0)} мм`,()=>{const st=logoSite();if(!S.logo||!st)return;const X=st.x,[za,ya]=logoZY(0,.5),[zb,yb]=logoZY(16,10.5);dim3([X,ya,za],[X,ya,zb],[-2,2,0],`${fmt(16*LOGO_U*10,0)} мм`);dim3([X,yb,zb],[X,ya,zb],[-2,0,-2],`${fmt(10*LOGO_U*10,0)} мм`);}],
  ['logoP','Логотип: от верха / по центру',`по центру`,()=>{const st=logoSite();if(!S.logo||!st)return;const X=st.x,[z,y]=logoZY(14,.5);dim3([X,y,z],[X,T,z],[-2,0,0],`от верха ${u(T-y)}`);}],
  ['logoC','Логотип: клетка сетки',`${fmt(LOGO_U*10)} мм`,()=>{const st=logoSite();if(!S.logo||!st)return;const [z0,y]=logoZY(0,4.5),[z1]=logoZY(2,4.5);dim3([st.x,y,z0],[st.x,y,z1],[-2,1.5,0],`2 клетки ${fmt(2*LOGO_U*10)} мм`);}],
  ['logoN','Логотип: как резать','лазер, перемычки',()=>{const st=logoSite();S.logo&&st&&lab(`вырез 16 × 10 клеток по ${fmt(LOGO_U*10)} мм · глаза держатся на перемычках ${LOGO_BR*10} мм к верху выреза · резать лазером`,new V(st.x-2,st.top-8,W/2),'n3');}],
  ['#Задвижки поддува','air'],
  ['airL','Задвижка: длина',AIR_L,()=>{if(!S.airSl)return;const x=AIR_X0+airOff(),z=W+AIR_GAP+AIR_T;dim3([x,B+HOLE_Y+AIR_H/2,z],[x+AIR_L,B+HOLE_Y+AIR_H/2,z],[0,3,1],`задвижка ${u(AIR_L)}`);}],
  ['airH','Задвижка: высота и толщина','30 × 3 мм',()=>{if(!S.airSl)return;const x=AIR_X0+airOff()+AIR_L,z=W+AIR_GAP+AIR_T;dim3([x,B+HOLE_Y-AIR_H/2,z],[x,B+HOLE_Y+AIR_H/2,z],[3,0,1],'30 мм');}],
  ['airS','Задвижка: ход до «закрыто»',`${fmt(Math.ceil(S.pitch*5))} мм`,()=>{if(!S.airSl)return;const x=holes()[5],y=B+HOLE_Y-AIR_H/2-.8,z=W+AIR_GAP+AIR_T;dim3([x,y,z],[x+Math.ceil(S.pitch*5)/10,y,z],[0,-2,1],`ход ${fmt(Math.ceil(S.pitch*5))} мм`);}],
  ['airT','Задвижка: загнутые концы (ручки)',`${AIR_TH*10} мм`,()=>{if(!S.airSl)return;const x=AIR_X0+airOff()+AIR_L,z=W+AIR_GAP+AIR_T,y=B+HOLE_Y+AIR_H/2;dim3([x,y,z],[x,y,z+AIR_TH],[1,2,0],`загиб ${u(AIR_TH)}`);}],
  ['airN','Задвижка: описание',`Ø15 · шаг ${S.pitch*10}`,()=>S.airSl&&lab(`задвижка — полоса 3 мм с ${holes().length} отв. Ø15 шаг ${S.pitch*10}, как в стенке · 2 шт, снаружи обеих боковин, ходит в 2 скобах · открыто / наполовину / закрыто — сдвиг на ${fmt(Math.ceil(S.pitch*5))} мм`,new V(40,B-4,W+3),'n3')],
  ['#Скобы задвижек','hook'],
  ['hkX','Скобы: от левого края (центр)',AIR_HOOK.map(v=>u(v)).join(' и '),()=>{if(!S.hook)return;const y=B+HOLE_Y-AIR_H/2-BR_T-BR_LEG-.3,z=W+.7;AIR_HOOK.forEach((x,i)=>dim3([0,y,z],[x,y,z],[0,-3-i*3,1],`${u(x)}`));}],
  ['hkW','Скоба: ширина полосы',`${BR_W*10} мм`,()=>{if(!S.hook)return;const x=AIR_HOOK[1],z=W+BR_IN+BR_T,y=B+HOLE_Y-AIR_H/2+BR_UP;dim3([x-BR_W/2,y,z],[x+BR_W/2,y,z],[0,2,1],`${BR_W*10} мм`);}],
  ['hkT','Скоба: толщина металла',`${fmt(BR_T*10)} мм`,()=>{if(!S.hook)return;   // толщина уха: под скобой, выносные вниз от его граней (зазор — сверху, не пересекаются)
    const x=AIR_HOOK[1]+BR_W/2,y=B+HOLE_Y-AIR_H/2-BR_T;dim3([x,y,W+BR_IN],[x,y,W+BR_IN+BR_T],[0,-(BR_LEG+1.2),0],`толщина ${fmt(BR_T*10)} мм`);}],
  ['hkH','Скоба: загиб вверх',`${BR_UP*10} мм`,()=>{if(!S.hook)return;const x=AIR_HOOK[1]+BR_W/2,z=W+BR_IN+BR_T,y=B+HOLE_Y-AIR_H/2;dim3([x,y,z],[x,y+BR_UP,z],[2,0,1],`загиб ${BR_UP*10} мм`);}],
  ['hkG',`Скоба: зазор от стенки до уха — под планку 3 мм + ${Math.round((BR_IN-AIR_T)*10)} мм запас`,`${Math.round(BR_IN*10)} мм`,()=>{if(!S.hook)return;   
    const x=AIR_HOOK[1]+BR_W/2,y=B+HOLE_Y-AIR_H/2;dim3([x,y,W],[x,y,W+BR_IN],[0,BR_UP+1.2,0],`зазор ${Math.round(BR_IN*10)} мм (планка 3 + запас ${Math.round((BR_IN-AIR_T)*10)})`);}],   // над скобой: выносные вверх по щели — от стенки и от внутренней грани уха, размерная — над ухом
  ['hkL','Скоба: лапка к стенке',`${BR_LEG*10} мм`,()=>{if(!S.hook)return;const x=AIR_HOOK[1]-BR_W/2,y=B+HOLE_Y-AIR_H/2-BR_T;dim3([x,y-BR_LEG,W],[x,y,W],[-2,0,1],`лапка ${BR_LEG*10} мм`);}],
  ['#Перегородка жаровни','div'],
  ['divP','Перегородка: прорези от торца (со стороны ручки)',DIV_POS.map(v=>u(v)).join(' / '),()=>{const y=T+1,z=W;DIV_POS.forEach((p,i)=>dim3([L1-p,y,z],[L1,y,z],[0,2+i*3,2],`${u(p)}`));}],
  ['divS','Перегородка: прорезь в боковине',`${DIV_SW*10} × ${DIV_SD*10} мм`,()=>{const x=L1-DIV_POS[2];dim3([x-DIV_SW/2,T,W],[x+DIV_SW/2,T,W],[0,2,2],`${DIV_SW*10} мм`);dim3([x+DIV_SW/2,T-DIV_SD,W],[x+DIV_SW/2,T,W],[2,0,2],`${DIV_SD*10} мм`);}],
  ['divR','Перегородка: ручка',`${DIV_HL*10} × ${DIV_HH*10} мм`,()=>{if(!S.div)return;const x=divX();dim3([x,T-DIV_SD+DIV_HH,0],[x,T-DIV_SD+DIV_HH,-DIV_HL],[0,2,0],`ручка ${u(DIV_HL)}`);dim3([x,T-DIV_SD,-DIV_HL],[x,T-DIV_SD+DIV_HH,-DIV_HL],[0,0,-2],`${u(DIV_HH)}`);}],
  ['divH','Перегородка: размер',`${u(W+DIV_EAR)} × ${u(divHt())} (тело ${u(W-2*DIV_IN)})`,()=>{if(!S.div)return;const x=divX();dim3([x,T+.5,0],[x,T+.5,W+DIV_EAR],[3,3,0],`с ушком ${u(W+DIV_EAR)}`);dim3([x,T,W],[x,T,W+DIV_EAR],[0,2,2],`ушко ${u(DIV_EAR)}`);dim3([x,T-3,.6],[x,T-3,W-.6],[3,0,0],`тело ${u(W-2*DIV_IN)}`);dim3([x,divY0(),W/2+10],[x,T,W/2+10],[2,0,0],`высота ${u(divHt())}`);}],
  ['divN','Перегородка: описание','лист 5 мм',()=>S.div&&lab(`перегородка — лист 5 мм · висит «ушками» 6 × 20 мм в прорезях боковин · ручка — прямоугольный выступ того же листа наружу через прорезь задней боковины · переставляется: ${DIV_POS.map(v=>u(v)).join(' / ')} ${UN()} от торца`,new V(divX(),T+10,W/2),'n3')],
  ['#Колосниковая решётка (Колосник 1 и Колосник 2)','cgr,cgr1,cgr2'],
  ['cgS','Колосник: размер половины',`${fmt(CG_L*10)} × ${fmt(CG_W*10)} мм`,()=>{if(!S.cgr)return;const x0=cgX()[1],y=cgTop()+.2,z0=W/2-CG_W/2;dim3([x0,y,W],[x0+CG_L,y,W],[0,2,3],`половина ${u(CG_L)}`);dim3([x0+CG_L,y,z0],[x0+CG_L,y,z0+CG_W],[3,2,0],`${u(CG_W)}`);}],
  ['cgT','Колосник: толщина листа','5–10 мм (в модели 5)',()=>{if(!S.cgr)return;const x=cgX()[1]+CG_L,y=cgTop(),z=W/2+CG_W/2-1;dim3([x,y-CG_T,z],[x,y,z],[2,0,2],`${CG_T*10} мм`);}],
  ['cgY','Колосник: верх решётки от дна жаровни (снаружи)',u(cgTop()-B),()=>{if(!S.cgr)return;const x=cgX()[0]+3;dim3([x,B,W],[x,cgTop(),W],[0,0,4],`верх решётки ${u(cgTop()-B)}`);}],
  ['cgUp','Колосник: от решётки до верха бортов',u(T-cgTop()),()=>{if(!S.cgr)return;const x=L1-5,z=7;   // внутри жаровни у задней стенки (решётку там видно сверху): засечки на решётке и на уровне верха бортов
    dim3([x,cgTop(),z],[x,T,z],[0,0,0],`от решётки до верха ${u(T-cgTop())}`);dim3([x-3,cgTop()+.05,z],[x+3,cgTop()+.05,z],[0,0,0],'');dim3([x-3,T,z],[x+3,T,z],[0,0,0],'');}],
  ['cgClr','Колосник: зазор до стены',`${fmt((W-2*t-CG_W)/2*10)} мм с каждой стороны`,()=>{if(!S.cgr)return;const x=cgX()[0]+5,y=cgTop()+.3;dim3([x,y,t],[x,y,W/2-CG_W/2],[0,2,0],`${fmt((W-2*t-CG_W)/2*10)} мм`);}],
  ['cg1X','Колосник 1: от левого торца до края',`${u(cgX()[0]-t)} (внутри)`,()=>{if(!S.cgr)return;const y=cgTop()+.2,z=W-t-.5;dim3([t,y,z],[cgX()[0],y,z],[0,1.5,0],`${u(cgX()[0]-t)}`);},'cgr,cgr1'],
  ['cg2X','Колосник 2: от правого торца до края',`${u(L1-t-cgX()[1]-CG_L)} (внутри)`,()=>{if(!S.cgr)return;const y=cgTop()+.2,z=W-t-.5;dim3([cgX()[1]+CG_L,y,z],[L1-t,y,z],[0,1.5,0],`${u(L1-t-cgX()[1]-CG_L)}`);},'cgr,cgr2'],
  ['cgGap','Зазор между Колосником 1 и Колосником 2',`${fmt(CG_GAP*10)} мм`,()=>{if(!S.cgr)return;const y=cgTop()+.2,z=W/2;dim3([cgX()[0]+CG_L,y,z],[cgX()[1],y,z],[0,1.5,0],`${fmt(CG_GAP*10)} мм`);},'cgr,cgr1,cgr2'],
  ['cgHdL','Ручки колосника: длина (поперёк жаровни)',`${CG_HL*10} мм`,()=>{if(!S.cgr)return;const x=cgHX()[1]-CG_HA/2,y=cgTop()+CG_HA;dim3([x,y,W/2-CG_HL/2],[x,y,W/2+CG_HL/2],[0,2,0],`ручка ${CG_HL*10} мм`);}],
  ['cgHdW','Ручки колосника: уголок 30×30×3 — высота и полка сверху','30 × 30 мм',()=>{if(!S.cgr)return;const x0=cgHX()[1]-CG_HA/2,yt=cgTop(),z=W/2+CG_HL/2;dim3([x0,yt,z],[x0,yt+CG_HA,z],[-1.5,0,1],'30 мм');dim3([x0,yt+CG_HA,z],[x0+CG_HA,yt+CG_HA,z],[0,1.5,1],'полка 30');}],
  ['cgHdP','Ручки колосника: положение на правой половине',`от перегородки ${u(cgHX()[1]-CG_HA/2-(L1-DIV_POS[0]))} · до торца ${u(L1-cgHX()[1]-CG_HA/2)}`,()=>{if(!S.cgr)return;const yt=cgTop(),x0=cgHX()[1]-CG_HA/2,z=W/2-CG_HL/2-1;dim3([L1-DIV_POS[0],yt,z],[x0,yt,z],[0,0,0],`от перегородки ${u(x0-(L1-DIV_POS[0]))}`);dim3([x0+CG_HA,yt,z],[L1,yt,z],[0,0,0],`до торца ${u(L1-x0-CG_HA)}`);},'cgr,cgr2'],
  ['cgHdP0','Ручки колосника: положение на левой половине',`по центру половины, ${u(cgHX()[0])} от левого края`,()=>{if(!S.cgr)return;const yt=cgTop(),x1=cgHX()[0],z=W/2-CG_HL/2-1;dim3([0,yt,z],[x1,yt,z],[0,0,0],`${u(x1)}`);},'cgr,cgr1'],
  ['cgHdN','Ручки колосника: описание','уголок на кромке',()=>S.cgr&&lab('ручка — уголок 30×30×3 L 80: одна полка стоит на решётке и приварена нижней кромкой, вторая сверху торчит вбок — под неё подцепить пальцами или кочергой · поперёк жаровни, по центру ширины',new V(cgHX()[1],cgTop()+6,W/2),'n3')],
  ['#Уголки под колосник 30×30×4','cgrAng'],
  ['caL','Уголки под колосник: длина',u(CA_L),()=>{if(!S.cgr)return;const y=B+CA_Y+CA_A;dim3([CA_X0,y,W-t],[CA_X0+CA_L,y,W-t],[0,2,2],`уголок ${u(CA_L)}`);}],
  ['caE','Уголки: от наружных торцов жаровни',`${fmt(CA_X0*10)} мм`,()=>{if(!S.cgr)return;const y=B+CA_Y+CA_A;dim3([0,y,W-t],[CA_X0,y,W-t],[0,2,3],`${fmt(CA_X0*10)} мм`);dim3([CA_X0+CA_L,y,W-t],[L1,y,W-t],[0,2,3],`${fmt(CA_X0*10)} мм`);}],
  ['caY','Уголки: от низа жаровни до низа уголка / до верха полки',`${u(CA_Y)} / ${u(CA_TOP)}`,()=>{if(!S.cgr)return;const x=L1-6;dim3([x,B,W],[x,B+CA_Y,W],[0,0,3],`${u(CA_Y)} до уголка`);dim3([x,B,W],[x,B+CA_TOP,W],[0,0,6],`${u(CA_TOP)} до верха полки`);}],
  ['caHole','Уголки: от центра отверстий поддува до низа уголка',`${fmt(CA_GH*10)} мм`,()=>{if(!S.cgr)return;const x=holes()[3];dim3([x,B+HOLE_Y,W+.2],[x,B+CA_Y,W+.2],[0,0,2],`${fmt(CA_GH*10)} мм`);}],
  ['caN','Уголки: профиль и установка','30×30×4 · 2 шт',()=>S.cgr&&lab('уголок 30×30×4 · 2 шт · одна полка вниз — плотно к боковине, приварить по всей длине, низ — в 10 мм над центром отверстий поддува, выше их края (нижний край не варить — шов закроет отверстия); вторая сверху внутрь — на неё ложится решётка',new V(40,B+CA_Y-3,W+3),'n3')],
  ['#Уголки 30×30','gAng'],
  ['gaH','Уголки: от верха жаровни',GA_TOP,()=>dim3([GA_X0,B+t+GA_H,W],[GA_X0,T,W],[0,0,5],`от верха ${u(GA_TOP)}`)],
  ['gaHb','Уголки: от дна жаровни (внутри)',u(GA_H),()=>dim3([GA_X0+GA_L,B+t,W],[GA_X0+GA_L,B+t+GA_H,W],[0,0,5],`от дна ${u(GA_H)}`)],
  ['gaE','Уголки: от левого края',GA_X0,()=>dim3([0,T,W],[GA_X0,T,W],[0,4,3],u(GA_X0))],
  ['gaL','Уголки: длина',GA_L,()=>dim3([GA_XS[0],T,W],[GA_XS[0]+GA_L,T,W],[0,4,3],u(GA_L))],
  ['gaG','Уголки: промежуток между ними',GA_XS[1]-GA_XS[0]-GA_L,()=>dim3([GA_XS[0]+GA_L,T,W],[GA_XS[1],T,W],[0,4,3],u(GA_XS[1]-GA_XS[0]-GA_L))],
  ['gaP','Уголки: шаг (начало — начало)',GA_XS[1]-GA_XS[0],()=>dim3([GA_XS[0],T,W],[GA_XS[1],T,W],[0,9,3],`шаг ${u(GA_XS[1]-GA_XS[0])}`)],
  ['gaN','Уголки: профиль 30×30×3',`30×30×3 · 2 шт`,()=>{const x=GA_XS[0],y=B+t+GA_H,z=GA_Z;   // на левом торце уголка: полка (поперёк) и стенка (к боковине)
    dim3([x,y,z-GA_A],[x,y,z],[0,2.5,0],'полка 30');dim3([x,y-GA_A,z],[x,y,z],[-3,0,0],'стенка 30');
    const p=new V((GA_XS[0]+GA_XS[1]+GA_L)/2,T+5,z-GA_A/2),P=[];   // от подписи — линии к обоим уголкам
    GA_XS.forEach(x0=>P.push(p.clone(),new V(x0+GA_L/2,y,z-GA_A/2)));
    const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P),new THREE.LineBasicMaterial({color:DIMC,depthTest:false}));ls.renderOrder=10;group.add(ls);
    lab('уголок 30×30×3 (толщина 3 мм) · L 100 · 2 шт · стенкой к боковине, полкой внутрь',p,'d3');}],
  ['#Решётка в жаровне','gGrate'],
  ['grlL','Решётка в жаровне: длина (вдоль)',GRL_L,()=>dim3([GRL_X0,B+t+GA_H+1,t+.5],[GRL_X0+GRL_L,B+t+GA_H+1,t+.5],[0,0,-6],`решётка ${u(GRL_L)}`)],
  ['grlW','Решётка в жаровне: ширина (поперёк)',GRL_W,()=>dim3([GRL_X0,B+t+GA_H+1,t+.5],[GRL_X0,B+t+GA_H+1,t+.5+GRL_W],[-4,0,0],`решётка ${u(GRL_W)}`)],
  ['grlE','Решётка: от левого края',GRL_X0,()=>dim3([0,B+t+GA_H+1,t+.5],[GRL_X0,B+t+GA_H+1,t+.5],[0,0,-11],u(GRL_X0))],
  ['#Решётки сверху','g2'],
  ['g2L','2 решётки сверху: длина каждой (вдоль)',G2_L,()=>{dim3([0,T+1,W/2-G2_W/2],[G2_L,T+1,W/2-G2_W/2],[0,0,-6],`решётка ${u(G2_L)}`);dim3([G2_L,T+1,W/2-G2_W/2],[2*G2_L,T+1,W/2-G2_W/2],[0,0,-6],`решётка ${u(G2_L)}`);}],
  ['g2W','2 решётки сверху: ширина (поперёк)',G2_W,()=>dim3([2*G2_L,T+1,W/2-G2_W/2],[2*G2_L,T+1,W/2+G2_W/2],[5,0,0],`решётка ${u(G2_W)}`)],
  ['g2H','2 решётки: высота от земли',T,()=>dim3([2*G2_L,0,W/2+G2_W/2],[2*G2_L,T,W/2+G2_W/2],[0,0,8],`${u(T)} от земли`)],
  ['#Шампуры','skew'],
  ['skN','Шампуры: как лежат','в прорезях',()=>lab('шампур лежит в прорезях обеих боковин · 7 шт в обычных, 4 — в глубоких',new V(32,T+4,W+6),'n3')],
  ['#Ручка','handle'],
  ['hx','Вылет ручки',HX,()=>dim3([L1,HY,W/2+HG/2],[L1+HX,HY,W/2+HG/2],[0,0,6],u(HX))],
  ['hg','Ширина хвата',HG,()=>dim3([L1+HX,HY,W/2-HG/2],[L1+HX,HY,W/2+HG/2],[9,0,0],`хват ${u(HG)}`)],
  ['hy','Высота ручки от земли',HY,()=>dim3([L1+HX,0,W/2+HG/2],[L1+HX,HY,W/2+HG/2],[0,0,8],`ручка ${u(HY)}`)],
  ['@stove'],
  ['#Боковины печи','sK0,sK1'],
  ['wk','Ширина печи (снаружи)',WK,()=>dim3([-L2,KB,ZK0],[-L2,KB,ZK1],[-8,0,0],`печь ${u(WK)}`)],
  ['l50','Длина казанницы',L2,()=>dim3([-L2,T,ZK1],[0,T,ZK1],[0,0,12.5],u(L2))],
  ['h2','Глубина топки',H2,()=>dim3([-L2,KB,ZK1],[-L2,T,ZK1],[-7,0,0],`топка ${u(H2)}`)],
  ['#Перегородка','wall'],
  ['stStep','Жаровня уже печи: ступенька с каждой стороны',`${fmt((WK-W)/2*10)} мм`,()=>{dim3([0,T,ZK0],[0,T,0],[3,4,0],`${fmt((WK-W)/2*10)} мм`);dim3([0,T,W],[0,T,ZK1],[3,4,0],`${fmt((WK-W)/2*10)} мм`);},null,'both'],
  ['stBackL','Задняя стенка печи (к жаровне): ширина',WK-2*t,()=>dim3([0,T,ZK0+t],[0,T,ZK1-t],[0,4,0],`задняя стенка ${u(WK-2*t)}`)],
  ['stBackH','Задняя стенка печи (к жаровне): высота',u(H2-t),()=>dim3([0,KB+t,ZK1-t],[0,T,ZK1-t],[0,0,6],`задняя стенка ${u(H2-t)}`)],
  ['stBackC','Задняя стенка печи: заготовка','мм',()=>lab(`задняя стенка (перегородка к жаровне) — лист 5 мм, ${(WK-2*t)*10} × ${(H2-t)*10} мм`,new V(-3,T-8,W/2),'n3')],
  ['#Ручка печи','sHandle'],
  ['shX','Ручка печи: вылет',HX,()=>dim3([0,HY,W/2+HG/2],[HX,HY,W/2+HG/2],[0,0,6],u(HX))],
  ['shG','Ручка печи: ширина хвата',HG,()=>dim3([HX,HY,W/2-HG/2],[HX,HY,W/2+HG/2],[9,0,0],`хват ${u(HG)}`)],
  ['shY','Ручка печи: высота от земли',HY,()=>dim3([HX,0,W/2+HG/2],[HX,HY,W/2+HG/2],[0,0,8],`ручка ${u(HY)}`)],
  ['shZ','Ручка печи: кронштейны','Ø25 · в 40 от боковин',()=>lab('ручка — труба Ø25×2, кронштейны приварить к перегородке в 40 мм от боковин · за неё поднимать и катить на колёсах',new V(HX/2,HY+5,W/2),'n3')],
  ['#Полоса у дверцы','tie'],
  ['tieW','Полоса у дверцы: ширина',TIE_W,()=>S.tie&&dim3([-L2,T,ZK1],[-L2+TIE_W,T,ZK1],[0,3,4],`полоса ${u(TIE_W)}`)],
  ['tieGap','Зазор полоса — плита','5 мм',()=>dim3([-L2+TIE_W,T+.3,ZK0],[-L2+TIE_W+PL_GAP,T+.3,ZK0],[0,3,-4],'зазор 5 мм')],
  ['tieL','Полоса у дверцы: длина',WK-2*t,()=>S.tie&&dim3([-L2+TIE_W/2,T,ZK0+t],[-L2+TIE_W/2,T,ZK1-t],[-6,3,0],`полоса ${u(WK-2*t)}`)],
  ['#Плита с кольцами','plate'],
  ['plate','Плита (вдоль)',PLX,()=>dim3([PCX-PLX/2,T+.5,W/2-PLZ/2],[PCX+PLX/2,T+.5,W/2-PLZ/2],[0,0,-9],`плита ${u(PLX)}`)],
  ['plateW','Плита (поперёк)',PLZ,()=>dim3([PCX+PLX/2,T+.5,W/2-PLZ/2],[PCX+PLX/2,T+.5,W/2+PLZ/2],[0,4,0],`плита ${u(PLZ)}`)],
  ['plateOff','Плита от открытого торца',u(STR),()=>dim3([-L2,T+.5,ZK0],[-L2+STR,T+.5,ZK0],[0,0,-9],u(STR))],
  ['strip','Плита у жаровни','вплотную',()=>lab('плита лежит краем на перегородке — щели нет',new V(0,PTOP()+3,ZK0-2),'n3')],
  ['nPlate','Плита: описание','450×450',()=>lab('плита 450×450×5 мм с кольцами — покупная, проём Ø390 · кольца Ø300 / Ø210 / Ø120',new V(PCX,T+2,ZK0-4),'n3')],
  ['plT','Плита: толщина','5 мм',()=>{if(!S.plate)return;const x=PCX-PLX/2,z=W/2+PLZ/2;dim3([x,PTOP()-t,z],[x,PTOP(),z],[-3,0,3],'5 мм');}],
  ['plOver','Плита: свес за стенки печи',`${u((PLZ-WK)/2)} ${UN()}`,()=>{if(!S.plate)return;const x=PCX,o=(PLZ-WK)/2;dim3([x,PTOP(),ZK1],[x,PTOP(),ZK1+o],[0,3,0],`свес ${u(o)}`);dim3([x,PTOP(),ZK0-o],[x,PTOP(),ZK0],[0,3,0],`свес ${u(o)}`);}],
  ['plRib','Плита: рёбра жёсткости по краю','15 мм',()=>{if(!S.plate)return;const x=PCX+PLX/2,z=W/2+PLZ/2;dim3([x,PTOP()-RIB_H,z],[x,PTOP(),z],[3,0,3],'ребро 15 мм');lab('рёбра 15 мм вниз по 4 краям; плита стоит на печи — короткие рёбра лежат поперёк на верхе стенок',new V(PCX,T+4,z+4),'n3');}],
  ['rgD','Кольца: проёмы',`Ø${u(RINGS[0]*2)} / ${u(RINGS[1]*2)} / ${u(RINGS[2]*2)} / ${u(RINGS[3]*2)}`,()=>{const y=PTOP()+.3;RINGS.forEach((r,i)=>dim3([PCX-r,y,W/2],[PCX+r,y,W/2],[0,0,RINGS[0]+4+i*4],`Ø${u(r*2)}`));}],
  ['#Казан','kazan'],
  ['nKazan','Казан',`${KZ.v} л`,()=>lab(`казан ${KZ.v} л Ø${u(KZ.r*2)} в проёме Ø${u(KZ.open*2)} — в топке ${u(KZ.sink)} из ${u(KZ.d)} ${UN()}`,new V(PCX,kzTop()+3,W/2+14),'n3')],
  ['gap','Зазор казан — крыша',gap,()=>S.rain&&S.kazan&&!S.lift&&dim3([PCX,kzTop(),W/2],[PCX,slopeY(W/2),W/2],[0,0,0],`зазор ${u(gap)}`)],
  ['#Труба','chim'],
  ['chHole','Труба: отверстие в стенке','60 × 60',()=>{if(!S.chim)return;const y=chY0();dim3([CH_X-CH/2,y,ZK0],[CH_X+CH/2,y,ZK0],[0,-3,0],`отв. ${u(CH)}`);dim3([CH_X+CH/2,y,ZK0],[CH_X+CH/2,y+CH,ZK0],[3,0,-2],`отв. ${u(CH)}`);},'chim,sK0'],
  ['chPos','Труба: положение отверстия',`${u(-CH_X)} от перегородки`,()=>{if(!S.chim)return;const y=chY0();dim3([0,y+CH/2,ZK0],[CH_X,y+CH/2,ZK0],[0,0,-3],`до центра ${u(-CH_X)}`);dim3([CH_X-CH/2-2,y+CH,ZK0],[CH_X-CH/2-2,T,ZK0],[-3,0,-2],`от верха ${u(CH_TOP)}`);},'chim,sK0'],
  ['chLen','Труба: горизонтальный участок',CH_H,()=>{if(!S.chim)return;const y=chY0();dim3([CH_X-CH/2,y,ZK0],[CH_X-CH/2,y,ZK0-CH_H],[-4,-2,0],`гориз. ${u(CH_H)}`);}],
  ['chUp','Труба: вертикальный участок',CH_V,()=>{if(!S.chim)return;const y=chY0();dim3([CH_X+CH/2,y+CH,ZK0-CH_H],[CH_X+CH/2,y+CH+CH_V,ZK0-CH_H],[3,0,-2],`вверх ${u(CH_V)}`);}],
  ['#Отсекатель пламени (наклонный)','fb'],
  ['fbL','Отсекатель: длина вдоль стенки',FB_L,()=>S.fb&&dim3([FB_X0,fbY1(),ZK0+t+FB_Z],[FB_X0+FB_L,fbY1(),ZK0+t+FB_Z],[0,3,0],`отсекатель ${u(FB_L)}`)],
  ['fbZ','Отсекатель: вылет от стенки',FB_Z,()=>S.fb&&dim3([FB_X0,fbY0(),ZK0+t],[FB_X0,fbY0(),ZK0+t+FB_Z],[-3,-3,0],`вылет ${u(FB_Z)}`)],
  ['fbY','Отсекатель: высоты от верха печи',`низ ${u(T-fbY0())} · верх ${u(T-fbY1())}`,()=>{if(!S.fb)return;dim3([FB_X0,fbY0(),ZK0+t],[FB_X0,T,ZK0+t],[-6,0,0],`низ ${u(T-fbY0())} от верха`);dim3([FB_X0,fbY1(),ZK0+t+FB_Z],[FB_X0,T,ZK0+t+FB_Z],[-3,0,0],`верх ${u(T-fbY1())}`);}],
  ['fbN','Отсекатель: заготовка и угол',`${FB_L*10} × ${Math.round(fbW()*10)} × 5`,()=>S.fb&&lab(`отсекатель — лист 5 мм ${FB_L*10} × ${Math.round(fbW()*10)} · наклон ${Math.round(fbA()*180/Math.PI)}° вверх к центру · низом приварить к задней стенке под отверстием трубы`,new V(FB_X0/2,fbY0()-4,ZK0+t+FB_Z),'n3')],
  ['#Обечайка вокруг казана','obe'],
  ['obeD','Обечайка: диаметр',OBE_R*2,()=>S.obe&&dim3([PCX-OBE_R,T-OBE_H,W/2],[PCX+OBE_R,T-OBE_H,W/2],[0,-3,0],`обечайка Ø${u(OBE_R*2)}`)],
  ['obeH','Обечайка: высота',OBE_H,()=>S.obe&&dim3([PCX+OBE_R,T-OBE_H,W/2],[PCX+OBE_R,T,W/2],[3,0,0],`высота ${u(OBE_H)}`)],
  ['obeG','Обечайка: зазор к казану',`${u(OBE_R-RINGS[0])} ${UN()}`,()=>S.obe&&lab(`обечайка — кольцо Ø${u(OBE_R*2)} × ${u(OBE_H)} из листа 3 мм под плитой · зазор ${u(OBE_R-RINGS[0])} ${UN()} к проёму Ø${u(RINGS[0]*2)} · газы идут вверх вдоль боков казана`,new V(PCX,T-OBE_H-4,W/2+OBE_R),'n3')],
  ['#Заслонка в трубе','damper'],
  ['dmpY','Заслонка: высота оси над коленом',DMP_Y,()=>{if(!S.chim||!S.damper)return;const y0=chY0()+CH,z=ZK0-CH_H;dim3([CH_X+CH/2,y0,z],[CH_X+CH/2,y0+DMP_Y,z],[3,0,-2],`ось ${u(DMP_Y)}`);}],
  ['dmpN','Заслонка: описание','55 × 55 × 3',()=>S.chim&&S.damper&&lab('заслонка — пластина 55 × 55 × 3 на оси (пруток Ø8), ручка снаружи · повернуть поперёк — тяга меньше',new V(CH_X+12,chY0()+CH+DMP_Y+3,ZK0-CH_H),'n3')],
  ['#Удлинитель трубы','chimX'],
  ['chX','Удлинитель: длина',CH_X_L,()=>{if(!S.chim||!S.chimX)return;const y=chY0()+CH+CH_V+.3;dim3([CH_X+CH/2,y,ZK0-CH_H],[CH_X+CH/2,y+CH_X_L,ZK0-CH_H],[4,0,-2],`удлинитель ${u(CH_X_L)}`);}],
  ['chXN','Удлинитель: описание','60×60×2',()=>S.chim&&S.chimX&&lab('удлинитель 1 м · профтруба 60×60×2 · отдельный кусок — приварить на месте',new V(CH_X,chY0()+CH+CH_V+CH_X_L*.8,ZK0-CH_H-4),'n3')],
  ['chN','Труба: профиль','60×60×2',()=>S.chim&&lab('профтруба 60×60×2 · колено 90° · дальше модули — на месте',new V(CH_X,chY0()+CH+CH_V+4,ZK0-CH_H-2),'n3')],
  ['#Дно печи','sBot'],
  ['sbS','Дно печи: размер',`${u(L2)} × ${u(WK)}`,()=>{dim3([-L2,KB,ZK1],[0,KB,ZK1],[0,-4,4],`дно ${u(L2)}`);dim3([0,KB,ZK0],[0,KB,ZK1],[5,-4,0],`дно ${u(WK)}`);}],
  ['#Дрова','wood'],
  ['woodN','Дрова','для наглядности',()=>lab('дрова кладутся на колосник через открытый торец, длина до ~35 см',new V(-L2+15,grTop()+14,W/2),'n3')],
  ['#Глухой верх топки','lintel'],
  ['flH','Глухой верх топки: высота',FL_H,()=>S.lintel&&dim3([-L2,T-FL_H,ZK1],[-L2,T,ZK1],[-3,0,4],`глухой верх ${u(FL_H)}`)],
  ['flN','Глухой верх: описание','лист 5 мм',()=>S.lintel&&lab(`глухой верх — лист 5 мм ${(WK-2*t)*10} × ${(FL_H-t)*10}, приварен · ${(FL_H-CH_TOP-CH>=0?`низ на ${u(FL_H-CH_TOP-CH)} ${UN()} ниже отверстия трубы`:`низ на ${u(CH_TOP+CH-FL_H)} ${UN()} выше низа отверстия трубы`)}`,new V(-L2-1,T-FL_H/2,W/2),'n3')],
  ['flOpen','Над колосником до глухого верха',u(T-FL_H-grTop()),()=>dim3([-L2+1,grTop(),ZK0+3],[-L2+1,T-FL_H,ZK0+3],[-2,0,0],`${u(T-FL_H-grTop())} над колосником`)],
  ['#Логотип Claude Code (вырез в глухом верхе топки)','logo',null,'both,stove'],
  ['logoS2','Логотип: размер выреза',`${fmt(16*LOGO_U*10,0)} × ${fmt(10*LOGO_U*10,0)} мм`,()=>{const st=logoSite();if(!S.logo||!st)return;const X=st.x,[za,ya]=logoZY(0,.5),[zb,yb]=logoZY(16,10.5);dim3([X,ya,za],[X,ya,zb],[-2,2,0],`${fmt(16*LOGO_U*10,0)} мм`);dim3([X,yb,zb],[X,ya,zb],[-2,0,-2],`${fmt(10*LOGO_U*10,0)} мм`);}],
  ['logoP2','Логотип: от верха / по центру',`по центру`,()=>{const st=logoSite();if(!S.logo||!st)return;const X=st.x,[z,y]=logoZY(14,.5);dim3([X,y,z],[X,T,z],[-2,0,0],`от верха ${u(T-y)}`);}],
  ['logoC2','Логотип: клетка сетки',`${fmt(LOGO_U*10)} мм`,()=>{const st=logoSite();if(!S.logo||!st)return;const [z0,y]=logoZY(0,4.5),[z1]=logoZY(2,4.5);dim3([st.x,y,z0],[st.x,y,z1],[-2,1.5,0],`2 клетки ${fmt(2*LOGO_U*10)} мм`);}],
  ['logoN2','Логотип: как резать','лазер, перемычки',()=>{const st=logoSite();S.logo&&st&&lab(`вырез 16 × 10 клеток по ${fmt(LOGO_U*10)} мм · глаза держатся на перемычках ${LOGO_BR*10} мм к верху выреза · резать лазером`,new V(st.x-2,st.top-8,W/2),'n3');}],
  ['#Дверца','door'],
  ['nFire','Проём под дверцей',`${u(WK-2*t)} × ${u(DH()-t)}`,()=>lab(`проём ${u(WK-2*t)} × ${u(DH()-t)} · над колосником ~${u(T-FL_H-grTop())}`,new V(-L2-.5,KB+DH()/2,W/2),'n3')],
  ['dDoor','Дверца: размеры',`${u(WK)} × ${u(DH())}`,()=>{const x=-L2-DOOR_T,a=S.doorOpen?1.75:0,fx=x-WK*Math.sin(a),fz=ZK0+WK*Math.cos(a);
    const yt=KB+DH();dim3([x,yt,ZK0],[fx,yt,fz],[0,4,0],`дверца ${u(WK)}`);dim3([fx,KB,fz],[fx,yt,fz],[-4,0,0],`дверца ${u(DH())}`);
    lab('лист 3 мм · 2 петли сбоку (у задней стенки) · крючок на передней стенке',new V(x-6,T+8,W/2),'n3');}],
  ['dHook','Крючок дверцы: высота',hkY(),()=>{if(S.doorOpen)return;dim3([-L2-DOOR_T,KB,ZK1+1],[-L2-DOOR_T,KB+hkY(),ZK1+1],[-3,0,3],`крючок ${u(hkY())}`);lab('крючок Ø6 на дверце + проушина на стенке',new V(-L2-2,KB+hkY()+3,ZK1+4),'n3');}],
  ['#Уголки колосника','angles'],
  ['dAng','Уголки: длина и профиль',`40×40×4 · L ${u(ANG_LEN)}`,()=>{dim3([ANG_X0,KB+t+GR_H,ZK1-t],[ANG_X0+ANG_LEN,KB+t+GR_H,ZK1-t],[0,3,0],`уголок ${u(ANG_LEN)}`);lab('уголок 40×40×4 · 2 шт · полкой внутрь',new V(ANG_X0+ANG_LEN/2,KB+t+GR_H-2,ZK1+3),'n3');}],
  ['angIn','Уголки: от дна внутри',GR_H,()=>dim3([ANG_X0,KB+t,ZK1-t-2],[ANG_X0,KB+t+GR_H,ZK1-t-2],[-5,0,0],`от дна ${u(GR_H)}`)],
  ['angOut','Уголки: от низа печи',u(GR_H+t),()=>dim3([ANG_X0,KB,ZK1],[ANG_X0,KB+t+GR_H,ZK1],[-5,0,3],`от низа печи ${u(GR_H+t)}`)],
  ['#Колосник','grate'],
  ['dGrate','Колосник: габариты',`${u(GR_LEN)} × ${u(GR_W)} × ${u(2*GR_BAR)}`,()=>{if(S.grType==='plate')return;const y=grTop();
    dim3([GR_X0,y,ZK0],[GR_X0+GR_LEN,y,ZK0],[0,0,-6],`колосник ${u(GR_LEN)}`);
    dim3([GR_X0,y,W/2-GR_W/2],[GR_X0,y,W/2+GR_W/2],[-6,0,0],`колосник ${u(GR_W)}`);
    dim3([GR_X0,y-2*GR_BAR,ZK1-t-1],[GR_X0,y,ZK1-t-1],[-3,0,3],`h ${u(2*GR_BAR)}`);}],
  ['gpS','Колосник-лист: размер',`${u(GR_LEN)} × ${u(GP_W)} × ${u(GP_T)}`,()=>{if(S.grType!=='plate')return;const y=grTop();dim3([GR_X0,y,ZK0],[GR_X0+GR_LEN,y,ZK0],[0,0,-6],`лист ${u(GR_LEN)}`);dim3([GR_X0,y,W/2-GP_W/2],[GR_X0,y,W/2+GP_W/2],[-6,0,0],`лист ${u(GP_W)}`);}],
  ['gpT','Колосник-лист: толщина',`${GP_T*10} мм`,()=>{if(S.grType!=='plate')return;const y=grTop();dim3([GR_X0,y-GP_T,ZK1-t-1],[GR_X0,y,ZK1-t-1],[-3,0,3],`${GP_T*10} мм`);}],
  ['gpH','Колосник-лист: отверстия и шаг',`Ø20 · шаг 40`,()=>{if(S.grType!=='plate')return;const y=grTop()+.2,xs=gpX(),zs=gpZ();dim3([xs[0],y,zs[8]],[xs[1],y,zs[8]],[0,0,3],`шаг ${u(GP_P)}`);dim3([xs[0],y,zs[0]],[xs[0],y,zs[1]],[-3,0,0],`шаг ${u(GP_P)}`);lab(`${xs.length*zs.length} отв. Ø20 · ${xs.length} × ${zs.length}`,new V(xs[Math.floor(xs.length/2)],y+2,ZK1+2),'n3');}],
  ['gpE','Колосник-лист: от края до отверстия',u(gpX()[0]-GR_X0),()=>{if(S.grType!=='plate')return;const y=grTop()+.2,z=gpZ()[0];dim3([GR_X0,y,z],[gpX()[0],y,z],[0,0,-3],u(gpX()[0]-GR_X0));}],
  ['nGrate','Колосник: прутки','Ø20',()=>S.grType!=='plate'&&lab(`Ø20 · шаг 35`,new V(GR_X0+GR_LEN/2,grTop()+2,ZK0-3),'n3')],
  ['grGap','От колосника до дна казана',`${u(PTOP()-KZ.sink-grTop())} (казан ${KZ.v} л)`,()=>dim3([PCX,grTop(),W/2],[PCX,PTOP()-KZ.sink,W/2],[0,0,0],`до казана ${u(PTOP()-KZ.sink-grTop())}`)],
  ['grPlate','От колосника до верха плиты с кольцами',u(PTOP()-grTop()),()=>dim3([PCX+PLX/2-4,grTop(),ZK1-t-2],[PCX+PLX/2-4,PTOP(),ZK1-t-2],[0,0,0],`до верха плиты ${u(PTOP()-grTop())}`)],
  ['#Шибер и отверстия в дне','shib,sBot'],
  ['dSh','Шибер: размер',`${SH_L*10} × ${SH_W*10} × 3 мм`,()=>{const so=shOff()??-(SH_L+6),y=KB-SH_GAP,x0=SH_X0+so;
    dim3([x0,y,W/2+SH_W/2],[x0+SH_L,y,W/2+SH_W/2],[0,-4,0],`шибер ${u(SH_L)}`);dim3([x0+SH_L,y,W/2-SH_W/2],[x0+SH_L,y,W/2+SH_W/2],[5,-4,0],`шибер ${u(SH_W)}`);
    lab('лист 3 мм, сплошной · край отогнут вниз на 25 — ручка',new V(x0+SH_L/2,y-6,W/2-SH_W/2-3),'n3');}],
  ['dHoles','Отверстия в дне: размер и шаг',`${DR_X.length*DR_Z.length} × Ø20`,()=>{const y=KB;
    dim3([-L2,y,DR_Z[0]],[DR_X[0],y,DR_Z[0]],[0,-3,0],u(DR_X[0]+L2));
    dim3([DR_X[0],y,DR_Z[0]],[DR_X[1],y,DR_Z[0]],[0,-3,0],u(4.5));
    dim3([DR_X[8],y,DR_Z[0]],[DR_X[8],y,DR_Z[1]],[3,-3,0],u(4.5));
    dim3([DR_X[8],y,ZK0],[DR_X[8],y,DR_Z[0]],[3,-3,0],u(DR_Z[0]-ZK0));
    lab(`${DR_X.length*DR_Z.length} отв. Ø20 · 4 ряда × ${DR_X.length} · шаг 45 × 45 мм`,new V(-26,y-4,ZK0-3),'n3');}],
  ['#Направляющие шибера','guides'],
  ['gProf','Направляющие: зазор под шибер',`${SH_GAP*10} мм`,()=>{const x=SH_X0+SH_L,z=SH_ZR-SH_SP/2;dim3([x,KB-SH_GAP,z],[x,KB,z],[3,0,0],`зазор ${SH_GAP*10} мм`);
    lab(`направляющая — квадрат ${SH_SP*10}×${SH_SP*10} к дну + полоса 20×3 снизу, заходит под шибер на ${Math.round((SH_GW-SH_SP-SH_CL)*10)} мм · 2 шт`,new V(x+6,KB-9,z+4),'n3');}],
  ['gStrip','Направляющие: полоса под шибером',`${SH_GW*10} мм, под шибер ${Math.round((SH_GW-SH_SP-SH_CL)*10)} мм`,()=>{const x=SH_X0+SH_L,y=KB-SH_GAP-.3;dim3([x,y,SH_ZR-SH_GW],[x,y,SH_ZR],[2,-2,0],`полоса ${SH_GW*10} мм`);dim3([x,y,SH_ZR-SH_GW],[x,y,W/2+SH_W/2],[2,-4,0],`под шибер ${Math.round((SH_GW-SH_SP-SH_CL)*10)} мм`);}],
  ['gLen','Направляющие: длина',SH_L,()=>dim3([SH_X0,KB-SH_GAP,SH_ZR],[SH_X0+SH_L,KB-SH_GAP,SH_ZR],[0,-4,0],`длина ${u(SH_L)}`)],
  ['gBetween','Между проставками',u(SH_ZR-SH_ZL-2*SH_SP),()=>dim3([SH_X0+SH_L/2,KB-SH_GAP,SH_ZL+SH_SP],[SH_X0+SH_L/2,KB-SH_GAP,SH_ZR-SH_SP],[0,-4,0],`между ${u(SH_ZR-SH_ZL-2*SH_SP)}`)],
  ['gWall','От стенки печи до проставки',u(SH_ZL-ZK0),()=>{const x=SH_X0+SH_L-3,y=KB-SH_GAP;
    dim3([x,y,ZK0],[x,y,SH_ZL],[0,-4,0],u(SH_ZL-ZK0));dim3([x,y,SH_ZR],[x,y,ZK1],[0,-4,0],u(ZK1-SH_ZR));}],
  ['gOff','От открытого торца',u(SH_X0+L2),()=>dim3([-L2,KB-SH_GAP,SH_ZL],[SH_X0,KB-SH_GAP,SH_ZL],[0,-4,0],u(SH_X0+L2))],
  ['@legs'],
  ['#Ножки','legs'],
  ['legH','Ножки: от земли до дна',LG.map(l=>`${u(l[2])} ${l[3]?'с колесом':'на пятке'}`).join(' / '),()=>LG.forEach(([x,z,top,wh])=>dim3([x,0,z],[x,top,z],[0,0,16],`${u(top)} ${wh?'с колесом':'на пятке'}`,wh?.5:.3))],
  ['legN','Ножки: без колеса (от площадки колеса до дна)',LG.map(l=>u(l[2]-(l[3]?WH:FT))).join(' / '),()=>LG.forEach(([x,z,top,wh])=>{const y=wh?WH:FT;dim3([x,y,z],[x,top,z],[0,0,9],`ножка ${u(top-y)}`);})],
  ['topNo','От верха до низа ножки (для сварщика)',u(T-(LG[0][3]?WH:0)),()=>{const y=LG[0][3]?WH:0;dim3([XR(),y,zF],[XR(),T,zF],[0,0,24],`верх — низ ножки ${u(T-y)}`);}],
  ['legPos','Центр ножки от краёв',`${u(LX)} / ${u(LZ)}`,()=>{const [x,z,top]=LG[0],xe=x>0?(x>L1/2?L1:0):(x<-L2/2?-L2:0),ze=x>=0?W:ZK1;dim3([xe,top,ze],[x,top,ze],[0,-8,6],u(LX));dim3([xe,top,ze],[xe,top,z],[0,-3,0],u(LZ));}],
  ['#Ножки откручиваются','legTw'],
  ['legThr','Ножки: как откручиваются','шпилька М16 → гайка М16',()=>{const l=LG[0];if(!l)return;const [x,z,top]=l;lab('ножка откручивается по стыку: к площадке под дном приварен патрубок Ø40 L 30 с гайкой М16 внутри, нижняя часть ножки со шпилькой М16 вкручивается в него — для перевозки ножки снимаются',new V(x+4,top-8,z+6),'n3');}],
  ['legNut','Ножки: стык (где откручивается) — от дна',`${JNT*10} мм`,()=>{const l=LG[0];if(!l)return;const [x,z,top]=l;dim3([x+2,top-t-JNT,z],[x+2,top,z],[3,0,2],`стык ${JNT*10} мм от дна`);}],
  ['#Площадки под колёса','pads'],
  ['padSize','Пластина под ножкой: размер',`${PADX*10} × ${PADZ*10} × ${PADT*10} мм`,()=>{if(!LW)return;const [x,z]=LW,y=WH+PADT;dim3([x-PADX/2,y,z+PADZ/2],[x+PADX/2,y,z+PADZ/2],[0,0,5],`${u(PADX)}`);dim3([x+PADX/2,y,z-PADZ/2],[x+PADX/2,y,z+PADZ/2],[6,0,0],`${u(PADZ)}`);}],
  ['nPad','Площадка: отверстия под колесо','по факту',()=>lab('4 отверстия сверлить по факту при наличии колёс',new V(LW?LW[0]:0,WH+2,-4),'n3')],
  ['#Колёса','wheels'],
  ['wheel','Колесо: высота',u(WH),()=>LW&&dim3([LW[0],0,LW[1]],[LW[0],WH,LW[1]],[7,0,0],`колесо ${u(WH)}`)],
  ['nWheel','Колёса','Ø100 × 4',()=>LW&&lab(S.mode==='both'?'TOR Ø100 поворотные · h 126 · под печью 2 с тормозом':'TOR Ø100 поворотные · h 126 · 4 шт, 2 у ручки — с тормозом',new V(LW[0],WH+2,zB-4),'n3')],
  ['@env'],
  ['#Человек 184 см','man'],
  ['manH','Человек: рост',MAN_H,()=>{if(!S.man)return;const x=(gOn()?40:PCX)+26;dim3([x,0,MAN_Z],[x,MAN_H,MAN_Z],[0,0,0],`рост ${u(MAN_H)}`);}],
  ['manRoof','Человек: крыша спереди над землёй / над макушкой',`${u(BAR_TOP_F)} · ${BAR_TOP_F-MAN_H>=0?'+':''}${u(BAR_TOP_F-MAN_H)}`,()=>{if(!S.man||!S.rain)return;const x=(gOn()?40:PCX)-26,z=SHEET.z1;dim3([x,0,z],[x,slopeY(z)+SHEET_UP,z],[0,0,0],`край крыши ${u(slopeY(z)+SHEET_UP)}`);
    dim3([x,slopeY(z)+SHEET_UP,MAN_Z],[x,MAN_H,MAN_Z],[0,0,0],`${MAN_H-slopeY(z)-SHEET_UP>0?'макушка выше на':'до макушки'} ${u(Math.abs(MAN_H-slopeY(z)-SHEET_UP))}`);}],
  ['manDist','Человек: от края крыши до лица',u(MAN_Z-11-SHEET.z1),()=>{if(!S.man||!S.rain)return;const y=slopeY(SHEET.z1)+SHEET_UP;dim3([(gOn()?40:PCX),y,SHEET.z1],[(gOn()?40:PCX),y,MAN_Z-11],[0,2,0],`${u(MAN_Z-11-SHEET.z1)} до лица`);}],
  ['@roof'],
  ['#Трубки под стойки','tubes'],
  ['tube','Трубка под стойку: высота',TUBE_H,()=>dim3([tubes[3][0],T-TUBE_H,tubes[3][1]],[tubes[3][0],T,tubes[3][1]],[5,0,0],u(TUBE_H))],
  ['nTube','Трубка: диаметр','Ø26×3',()=>lab('трубка Ø26×3, внутр. Ø20',new V(tubes[3][0]+2,T+1.5,tubes[3][1]+2),'n3')],
  ['barIn','Арматура: сидит в трубке',TUBE_H,()=>S.rain&&dim3([tubes[3][0],T-TUBE_H,tubes[3][1]],[tubes[3][0],T,tubes[3][1]],[4,0,4],`в трубке ${u(TUBE_H)}`)],
  ['#Стойки','bars'],
  ['barF','Передняя стойка: длина',BAR_F,()=>S.rain&&dim3([tubes[1][0],T-TUBE_H,tubes[1][1]],[tubes[1][0],BAR_TOP_F,tubes[1][1]],[-9,0,0],`стойка ${u(BAR_F)}`)],
  ['barB','Задняя стойка: длина',BAR_B,()=>S.rain&&dim3([tubes[0][0],T-TUBE_H,tubes[0][1]],[tubes[0][0],BAR_TOP_B,tubes[0][1]],[-9,0,0],`стойка ${u(BAR_B)}`)],
  ['barD','Арматура: диаметр','Ø16',()=>{if(!S.rain)return;const [x,z]=tubes[3],y=T+45,r=BAR_R,a=.9;
    const P=[new V(x-r-7,y,z),new V(x-r,y,z),new V(x-r,y,z),new V(x-r-a,y+a*.6,z),new V(x-r,y,z),new V(x-r-a,y-a*.6,z),   // стрелка слева → к краю прутка
             new V(x+r+9,y,z),new V(x+r,y,z),new V(x+r,y,z),new V(x+r+a,y+a*.6,z),new V(x+r,y,z),new V(x+r+a,y-a*.6,z),  // стрелка справа ← к краю
             new V(x-r,y-2.5,z),new V(x-r,y+2.5,z),new V(x+r,y-2.5,z),new V(x+r,y+2.5,z)];                              // края прутка
    const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P),new THREE.LineBasicMaterial({color:DIMC,depthTest:false}));ls.renderOrder=10;group.add(ls);
    const rg=new THREE.Mesh(new THREE.TorusGeometry(r+.15,.12,6,24),new THREE.MeshBasicMaterial({color:DIMC}));rg.rotation.x=Math.PI/2;rg.position.set(x,y,z);group.add(rg);
    lab('Ø16 мм',new V(x+r+5,y+1.4,z),'d3');}],
  ['barUpF','Арматура спереди: над верхом мангала',BAR_F-TUBE_H,()=>S.rain&&dim3([tubes[3][0],T,tubes[3][1]],[tubes[3][0],BAR_TOP_F,tubes[3][1]],[5,0,0],`над верхом ${u(BAR_F-TUBE_H)}`)],
  ['barUpB','Арматура сзади: над верхом мангала',BAR_B-TUBE_H,()=>S.rain&&dim3([tubes[2][0],T,tubes[2][1]],[tubes[2][0],BAR_TOP_B,tubes[2][1]],[5,0,0],`над верхом ${u(BAR_B-TUBE_H)}`)],
  ['roofF','Крыша спереди от земли',BAR_TOP_F,()=>S.rain&&dim3([xr,0,RZ1],[xr,BAR_TOP_F,RZ1],[13,0,0],`${u(BAR_TOP_F)} от земли`)],
  ['roofB','Крыша сзади от земли',BAR_TOP_B,()=>S.rain&&dim3([xr,0,RZ0],[xr,BAR_TOP_B,RZ0],[13,0,0],`${u(BAR_TOP_B)} от земли`)],
  ['#Болты М8×40 (приварены к стойкам)','bolts'],
  ['barStud','Крепление листа: болт М8×40 + барашек (фото)','фото',()=>{if(!S.rain)return;
    // рядом со стойкой справа спереди — фото покупных деталей, болт стоит вертикально, головкой вниз, как приварен
    const [x,z]=tubes[3],y=BAR_TOP_F+.5,el=document.createElement('div');el.className='ph3';
    el.innerHTML='<figure><div class="phb"><i></i></div><figcaption>Болт М8×40<br>головкой к торцу стойки</figcaption></figure><figure><img src="img/wing-nut-m8.png" alt=""><figcaption>Гайка-барашек М8<br>затянуть рукой</figcaption></figure>';
    const o=new THREE.CSS2DObject(el),p=new V(x+30,y+12,z+18);o.userData.dim=1;o.position.copy(p);group.add(o);
    const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new V(x,y+2,z),p]),new THREE.LineBasicMaterial({color:DIMC,depthTest:false}));ls.renderOrder=10;group.add(ls);},'bolts,nuts,wsh1,wsh2'],
  ['boltL','Болт: длина стержня с резьбой','40 мм',()=>{if(!S.rain||!S.bolt)return;const [x,z]=tubes[3],y0=BAR_TOP_F+.5+BOLT_HD;dim3([x,y0,z],[x,y0+4,z],[-3,0,0],'М8 × 40');}],
  ['boltN','Болт: как крепится','головкой к торцу',()=>S.rain&&S.bolt&&lab('болт М8×40 — головкой к торцу арматуры Ø16, по центру и строго вертикально; с головки счистить цинк',new V(tubes[3][0]-6,BAR_TOP_F-4,tubes[3][1]+3),'n3')],
  ['#Шайбы Ø24 (под листом и над листом)','wsh1,wsh2'],
  ['wshD','Шайба: диаметр','Ø24',()=>{if(!S.rain||!(S.wsh1||S.wsh2))return;const [x,z]=tubes[3],y=BAR_TOP_F+.5+(S.wsh1?BOLT_HD+WSH_T:BOLT_Y.wsh2+WSH_T/2);dim3([x-WSH_R,y,z],[x+WSH_R,y,z],[0,0,-3],'Ø24');}],
  ['wshN','Шайбы: где стоят','под листом и над листом',()=>S.rain&&lab('шайба Ø24 под листом — лежит на головке болта; лист; шайба Ø24 над листом — под барашек',new V(tubes[3][0]-6,BAR_TOP_F+5,tubes[3][1]+3),'n3')],
  ['#Барашки','nuts'],
  ['nutN','Барашек: описание','М8',()=>S.rain&&S.nut&&lab('гайка-барашек М8 — на шайбу над листом, затянуть рукой: лист снимается без ключа',new V(tubes[3][0]+4,BAR_TOP_F+6,tubes[3][1]-4),'n3')],
  ['#Лист','sheet'],
  ['sheetL','Лист крыши: длина',u(SHEET.x1-SHEET.x0),()=>S.rain&&dim3([SHEET.x0,slopeY(SHEET.z1)+SHEET_UP+.5,SHEET.z1],[SHEET.x1,slopeY(SHEET.z1)+SHEET_UP+.5,SHEET.z1],[0,4,0],`лист ${u(SHEET.x1-SHEET.x0)}`)],
  ['sheetW','Лист крыши: ширина',u(SHEET.z1-SHEET.z0),()=>S.rain&&dim3([SHEET.x1,slopeY(SHEET.z0)+1,SHEET.z0],[SHEET.x1,slopeY(SHEET.z1)+SHEET_UP+.5,SHEET.z1],[0,4,0],`лист ${u(SHEET.z1-SHEET.z0)}`)],
  ['sheetBack','Лист: свес сзади (сток воды)',u(tubes[2][1]-SHEET.z0),()=>S.rain&&dim3([SHEET.x1,slopeY(SHEET.z0)+3,SHEET.z0],[SHEET.x1,slopeY(tubes[2][1])+3,tubes[2][1]],[0,4,0],`свес ${u(tubes[2][1]-SHEET.z0)}`)],
  ['shHx','Лист: отверстие — отверстие вдоль',u(tubes[2][0]-tubes[0][0]),()=>{if(!S.rain)return;const z=tubes[1][1],y=slopeY(z)+1;dim3([tubes[0][0],y,z],[tubes[2][0],y,z],[0,1,6],`отв.–отв. ${u(tubes[2][0]-tubes[0][0])}`);}],
  ['shHz',S.mode==='both'?'Лист: отверстие — отверстие поперёк (печь / жаровня)':'Лист: отверстие — отверстие поперёк',S.mode==='both'?`${u(tubes[1][1]-tubes[0][1])} / ${u(tubes[3][1]-tubes[2][1])}`:u(tubes[1][1]-tubes[0][1]),()=>{if(!S.rain)return;[[0,1,-6],[2,3,6]].forEach(([i,j,o])=>{const x=tubes[i][0];dim3([x,slopeY(tubes[i][1])+1,tubes[i][1]],[x,slopeY(tubes[j][1])+1,tubes[j][1]],[o,1,0],`отв.–отв. ${u(tubes[j][1]-tubes[i][1])}`);});}],
  ['shHe','Лист: от края до отверстия',u(5),()=>{if(!S.rain)return;const z=tubes[0][1];dim3([SHEET.x0,slopeY(z)+1,z],[tubes[0][0],slopeY(z)+1,z],[0,1,-4],u(5));}],
  ];
}
// строки размеров с элементом и деталями: {id,name,val,fn,el,pts} или заголовки {h3}/{h4}
function dimRows(){let el=null,pts=null,mo=null;const r=[];
  dimDefs().forEach(d=>{const h=d[0];
    if(d.length===1&&h[0]==='@'){el=h.slice(1);pts=null;mo=null;r.push({h3:el==='all'?'Габариты':elOf(el).name,el});}
    else if(h[0]==='#'){pts=d[1]?d[1].split(','):null;mo=d[3]||d[2]||null;r.push({h4:h.slice(1),el,pts,mo});}
    else r.push({id:h,name:d[1],val:d[2],fn:d[3],el,pts:d[4]?d[4].split(','):pts,mo:d[5]||mo});});
  return r;}
// размер есть в текущем режиме: элемент в проекте, хотя бы одна его деталь есть, режим строки подходит
const modeOk=r=>elOk(r.el)&&(!r.mo||r.mo.split(',').includes(S.mode))&&(!r.pts||r.pts.some(partOk));
const dimVisible=()=>dimRows().filter(r=>r.id&&modeOk(r)&&inSel(r.el,r.pts));
// размеры боковин рисуются на передней стенке; если выбрана задняя боковина — зеркалим их на неё (z → W − z)
const backSel=()=>['side0','side0A'].includes(S.sel.part);
function dims3D(){dimVisible().forEach(r=>{if(!S.dims.has(r.id))return;const n0=group.children.length;r.fn();
  if(!backSel()||!(r.pts||[]).some(p=>p==='side1'||p.startsWith('cgrAng')))return;
  for(let i=n0;i<group.children.length;i++){const o=group.children[i];
    if(o.isCSS2DObject)o.position.z=W-o.position.z;
    else if(o.geometry&&o.geometry.attributes.position){const a=o.geometry.attributes.position;for(let k=0;k<a.count;k++)a.setZ(k,W-a.getZ(k));a.needsUpdate=true;}}});}
// свёрнутые группы списка размеров (по элементу) — помним в браузере
// по умолчанию раскрыта только главная группа (жаровня; в режиме «Печь» — печь), остальные свёрнуты; что человек раскрыл/свернул — помним
const mainGrp=()=>S.mode==='stove'?'stove':'grill';
const dimFold=(()=>{try{return JSON.parse(localStorage.getItem('md-dims')||'{}')||{};}catch(e){return {};}})();
const dimIsShut=k=>k in dimFold?dimFold[k]:k!==mainGrp();
function dimList(){
  const rows=dimRows(),out=[];let h3=null,h4=null,cur=null;
  const close=()=>{if(cur){out.push('</div>');cur=null;}};
  rows.forEach(r=>{if(r.h3){h3=r;h4=null;return;}if(r.h4){h4=r;return;}
    if(!modeOk(r)||!inSel(r.el,r.pts))return;
    if(h3){close();cur=h3.el;
      const n=dimVisible().filter(x=>x.el===cur&&S.dims.has(x.id)).length;
      out.push(`<div class="dg${dimIsShut(cur)?' shut':''}" data-el="${cur}"><h3><button type="button" aria-expanded="${!dimIsShut(cur)}">${h3.h3}<small>${n?'показано '+n:''}</small></button></h3>`);h3=null;}
    if(h4){out.push(`<h4>${h4.h4}</h4>`);h4=null;}
    out.push(`<label class="chk"><input type="checkbox" id="dm_${r.id}" data-id="${r.id}"${S.dims.has(r.id)?' checked':''}><span>${r.name}<b>${typeof r.val==='number'?u(r.val):r.val}</b></span></label>`);});
  close();
  document.getElementById('dimList').innerHTML=out.join('');
}
