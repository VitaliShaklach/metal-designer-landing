/* ---------- справочник: элементы мангала и их детали ----------
   Один источник для 3D (что показывать при выборе), списков выбора, размеров и раскроя.
   f   — галочки S, которые включаются, когда деталь выбрана отдельно (иначе её не видно)
   m   — в каких режимах деталь есть (иначе — во всех): 'grill' мангал, 'stove' печь, 'both' вместе
   pdf — старое деление на части для скриптов PDF (?parts=grill,stove,legs,wheels,roof) */
const PARTS=[
  {id:'grill',name:'Жаровня',d:[
    ['side0','Боковина задняя'],
    ['side1','Боковина передняя'],
    ['gBot','Дно жаровни'],
    ['gEnd','Торец правый'],
    ['gEnd0','Торец левый (задняя стенка)',null,'grill'],
    ['logo','Логотип Claude Code (вырез в левом торце)',{logo:true},'grill'],
    ['air','Задвижки поддува (2 шт)',{airSl:true}],
    ['hook','Скобы задвижек (4 шт)',{hook:true}],
    ['div','Перегородка жаровни',{div:true}],
    ['cgr','Колосниковая решётка (обе половины)',{cgr:true,cgrPlate1:true,cgrPlate2:true}],
    ['cgr1','Колосник 1 — левая половина',{cgr:true,cgrPlate1:true}],
    ['cgr2','Колосник 2 — правая половина (у ручки)',{cgr:true,cgrPlate2:true}],
    ['cgrAng','Уголки под колосник 30×30×4',{cgr:true,cgrAng:true}],
    ['side0A','Боковина задняя с уголком колосника',{cgr:true,cgrAng:true}],
    ['gAng','Уголки 30×30',{gAng:true}],
    ['handle','Ручка']]},
  {id:'stove',name:'Печь',d:[
    ['sK0','Боковина задняя (с трубой)'],
    ['sK1','Боковина передняя'],
    ['wall','Перегородка (задняя стенка печи)'],
    ['sHandle','Ручка печи',null,'stove'],
    ['sBot','Дно печи с отверстиями'],
    ['tie','Полоса у дверцы',{tie:true}],
    ['plate','Плита с кольцами',{plate:true,lift:false,kazan:false}],
    ['kazan','Казан',{kazan:true,plate:true,lift:false}],
    ['fb','Отсекатель пламени (наклонный)',{fb:true}],
    ['damper','Заслонка в трубе',{chim:true,damper:true}],
    ['obe','Обечайка вокруг казана',{obe:true}],
    ['chim','Труба',{chim:true}],
    ['chimX','Удлинитель трубы 1 м',{chim:true,chimX:true}],
    ['lintel','Глухой верх топки',{lintel:true}],
    ['logo','Логотип Claude Code (вырез в глухом верхе топки)',{logo:true,lintel:true}],
    ['door','Дверца',{door:true}],
    ['angles','Уголки колосника',{angles:true}],
    ['grate','Колосник',{grate:true}],
    ['shib','Шибер (зольник)',{draft:true}],
    ['guides','Направляющие шибера',{draft:true}],
    ['wood','Дрова',{wood:true}]]},
  {id:'legs',name:'Ножки и колёса',d:[
    ['legs','Ножки',{legs:true}],
    ['legTw','Ножки откручиваются (гайка М16) — пометка',{legs:true,legTw:true}],
    ['pads','Площадки под колёса',{legs:true}],
    ['wheels','Колёса',{legs:true,wheels:true}]]},
  {id:'env',name:'Человек для масштаба',d:[
    ['man','Человек 184 см',{man:true}]]},
  {id:'roof',name:'Крыша',d:[
    ['tubes','Трубки под стойки'],
    ['bars','Стойки',{rain:true}],
    ['bolts','Болты М8×40 (приварены к стойкам)',{rain:true,bolt:true}],
    ['wsh1','Шайбы под листом',{rain:true,wsh1:true}],
    ['wsh2','Шайбы над листом',{rain:true,wsh2:true}],
    ['nuts','Барашки',{rain:true,nut:true}],
    ['sheet','Лист',{rain:true,sheet:true}]]},
];
const PDF_PART={coal:'grill',side0:'grill',side1:'grill',gBot:'grill',gEnd:'grill',logo:'grill',gEnd0:'grill',air:'grill',hook:'grill',div:'grill',gAng:'grill',cgr:'grill',cgr1:'grill',cgr2:'grill',cgrAng:'grill',cgrAngB:'grill',cgrAngF:'grill',gGrate:'grill',g2:'grill',skew:'grill',handle:'grill',
  sK0:'stove',sK1:'stove',wall:'stove',sHandle:'stove',sBot:'stove',tie:'stove',plate:'stove',rings:'stove',kazan:'stove',fb:'stove',damper:'stove',obe:'stove',chim:'stove',chimX:'stove',
  lintel:'stove',door:'stove',angles:'stove',grate:'stove',shib:'stove',guides:'stove',wood:'stove',
  man:'env',legs:'legs',legTw:'legs',pads:'legs',feet:'legs',wheels:'wheels',tubes:'roof',bars:'roof',bolts:'roof',wsh1:'roof',wsh2:'roof',nuts:'roof',sheet:'roof'};
const elOf=id=>PARTS.find(e=>e.id===id);
// режим: элемент и деталь есть в текущем проекте?
const elOk=el=>!(el==='grill'&&!gOn())&&!(el==='stove'&&!sOn());
const partOk=id=>{let seen=false;for(const e of PARTS){const d=e.d.find(x=>x[0]===id);if(!d)continue;seen=true;if(elOk(e.id)&&(!d[3]||d[3].split(',').includes(S.mode)))return true;}return !seen;};
const partName=id=>{for(const e of PARTS){const d=e.d.find(x=>x[0]===id);if(d)return d[1];}return id;};
// выбранные детали: null — показывать всё
// составные детали: что входит (теги на 3D, детали в размерах и раскрое)
const PART_SET={cgr:['cgr','cgr1','cgr2'],cgrAng:['cgrAng','cgrAngB','cgrAngF'],side0A:['side0A','side0','cgrAngB','cgrAng']};
const expand=id=>PART_SET[id]||[id];
function selParts(){if(!S.sel.el)return null;const e=elOf(S.sel.el);return new Set(S.sel.part?expand(S.sel.part):e.d.flatMap(x=>expand(x[0])));}
// попадает ли размер/строка раскроя в выбор: el — элемент (или список), pt — деталь (или список)
function inSel(el,pt){if(!S.sel.el)return true;
  if(S.sel.part){const sp=expand(S.sel.part);return [].concat(pt||[]).some(p=>sp.includes(p));}
  return [].concat(el||[]).includes(S.sel.el);}
