// дымовой тест «Каркаса»: геометрия стыков на эталонах МК-16 + сборка всего кода с пустышками THREE/DOM. node tools/smoke.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const P=path.join(__dirname,'..');let fails=0;
const ok=(c,msg)=>{console.log((c?'ok   ':'FAIL ')+msg);if(!c)fails++;};
const core=['profiles','model'].map(f=>fs.readFileSync(P+'/js/'+f+'.js','utf8')).join('\n;\n');
function ctxCore(){const c={console,Math,JSON,Set,Map,Object,Array,Number,String};vm.createContext(c);vm.runInContext(core,c);return c;}
// 1. тумба 1СБ: стойки 790, царга 1 685 (45°/45°), царга 2 520, царга 3 605 (20×20 встык)
{const c=ctxCore();c.M=c.normModel(JSON.parse(fs.readFileSync(P+'/examples/mk16-1sb.json','utf8')));vm.runInContext('M=this.M',c);
 const pos=vm.runInContext('positions()',c),f=(pr,L)=>pos.find(p=>p.prof===pr&&p.L===L);
 const st=f('40x40x1.5',790),c1=f('40x40x1.5',685),c2=f('40x40x1.5',520),c3=f('20x20x1.5',605);
 ok(st&&st.qty===4&&st.total===8&&st.ang.join()==='45,90','стойка 790, скос 45°, 4 шт на тумбу, 8 всего');
 ok(c1&&c1.qty===2&&c1.ang.join()==='45,45','царга 1 685, 45°/45°');
 ok(c2&&c2.qty===2&&c2.ang.join()==='90,90','царга 2 520 встык');
 ok(c3&&c3.qty===6,'царга 3 20×20 — 605 встык, 6 шт');
 console.log('     позиции:',pos.map(p=>`${p.no} ${p.prof} L${p.L} ${p.ang.join('/')}° ×${p.qty}`).join(' | '));}
// 2. рама со стропилом под 8°: одинаковое сечение — скосы 41° / 49°; столбы 60×60 и стропило 40×40 — стропило встык по грани, рез 82°
for(const [post,want,msg] of [['40x40x1.5','41,49','скосы 41° / 49°'],['60x60x2','82,82','встык по грани столба, рез 82° / 82°']]){const c=ctxCore();vm.runInContext(`M=emptyModel();const s=Math.tan(8*Math.PI/180);
  const a=addNode(0,0,0),b=addNode(0,2100,0),d=addNode(2000,0,0),e=addNode(2000,2100+Math.round(2000*s),0);
  addMember(a.id,b.id,'${post}');addMember(d.id,e.id,'${post}');addMember(b.id,e.id,'40x40x1.5');`,c);
 const cut=vm.runInContext('memberCuts().find(x=>x.m.a==="n2")',c),pc=vm.runInContext('memberCuts().find(x=>x.m.a==="n1")',c);
 ok(cut&&[cut.angA,cut.angB].sort().join()===want,`стропило (столбы ${post}): ${msg} — получилось ${[cut.angA,cut.angB]}°, L ${cut.L}, столб L ${pc.L}`);}
// ферма 4.1СБ МК-16 (листы 18–19): пояса 2036 41°/49° ×4, стойки 232 ×4, распорки 150 ×6, столбы 2100 и 2394; стойки фермы лежат на столбах
{const c=ctxCore();c.M=c.normModel(JSON.parse(fs.readFileSync(P+'/examples/mk16-ferma.json','utf8')));vm.runInContext('M=this.M',c);
 const pos=vm.runInContext('positions()',c),g=(L,a)=>pos.find(p=>p.L===L&&p.ang.join()===a);
 ok(g(2036,'41,49')?.total===4&&g(232,'41,49')?.total===4&&g(150,'90,90')?.total===6&&g(2100,'90,90')?.total===2&&g(2394,'90,90')?.total===2,'ферма МК-16: '+pos.map(p=>`${p.L} ${p.ang.join('/')}° ×${p.total}`).join(', '));
 ok(vm.runInContext('contacts().filter(x=>x.type==="rest").length',c)===2,'ферма приваривается к столбам по месту — 2 касания');}
// МК-16 целиком (tools/make-mk16.js): 308 деталей без пересечений; ключевые позиции совпадают со спецификацией PDF
{const c=ctxCore();c.M=c.normModel(JSON.parse(fs.readFileSync(P+'/examples/mk16.json','utf8')));vm.runInContext('M=this.M',c);
 const pos=vm.runInContext('positions()',c),tot=(L,pr)=>pos.filter(p=>p.L===L&&(!pr||p.prof===pr)).reduce((s,p)=>s+p.total,0),cl=vm.runInContext('contacts().filter(x=>x.type==="clash").length',c);
 const want=[[2036,4],[232,4],[2996,5],[1335,24],[946,22],[529,8],[1488,4],[2660,1],[863,2],[214,2],[726,4],[480,24]];
 const bad=want.filter(([L,q])=>tot(L)!==q).map(([L,q])=>`${L}: нужно ${q}, есть ${tot(L)}`);
 ok(c.M.members.length===308&&!cl&&!bad.length,`МК-16 целиком: ${c.M.members.length} деталей, пересечений ${cl}${bad.length?' · '+bad.join('; '):''}`);}
// касания: прогоны навеса лежат на двух стропилах (по 2 касания), пересечений нет
{const c=ctxCore();c.M=c.normModel(JSON.parse(fs.readFileSync(P+'/examples/naves-3x2.json','utf8')));vm.runInContext('M=this.M',c);
 const cs=vm.runInContext('contacts()',c),rest=cs.filter(x=>x.type==='rest'),clash=cs.filter(x=>x.type==='clash');
 ok(rest.length===6&&!clash.length,`навес: прогоны лежат на стропилах — касаний ${rest.length}, пересечений ${clash.length}`);}
// 3. раскрой хлыстов
{const c=ctxCore();c.M=c.normModel(JSON.parse(fs.readFileSync(P+'/examples/mk16-1sb.json','utf8')));vm.runInContext('M=this.M',c);
 const n=vm.runInContext('nesting()',c);ok(n.length===2&&n.every(x=>x.bars.length>0),'раскрой: '+n.map(x=>`${x.prof} — ${x.bars.length} хлыст(а)`).join(', '));}
// 4. весь код страницы с пустышками (ловит ReferenceError)
if(fs.existsSync(P+'/js/ui.js')){const mk=()=>{const U=new Proxy(function(){},{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>0;if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;return U;},apply:()=>U,construct:()=>U,set:()=>true});return U;};
 const U=mk(),c={THREE:U,document:U,window:{addEventListener:()=>{}},location:{hash:'',search:'',href:'http://x/'},addEventListener:()=>{},requestAnimationFrame:()=>{},ResizeObserver:U,MutationObserver:U,devicePixelRatio:1,performance:{now:()=>0},navigator:U,URLSearchParams,TextEncoder,TextDecoder,console,Math,JSON,Set,Map,Object,Array,Number,String,Symbol,setTimeout,clearTimeout,Blob:function(){},URL:U,atob:U,btoa:U,localStorage:{getItem:()=>null,setItem:()=>{}},prompt:()=>{},Response:U,CompressionStream:undefined,fetch:()=>({then:()=>({catch:()=>{}})})};
 vm.createContext(c);const src=['profiles','model','dims','view3d','edit','examples','ui','sheets','help'].filter(f=>fs.existsSync(P+'/js/'+f+'.js')).map(f=>fs.readFileSync(P+'/js/'+f+'.js','utf8')).join('\n;\n');
 try{vm.runInContext(src,c,{filename:'all.js'});vm.runInContext(`M=normModel(${fs.readFileSync(P+'/examples/mk16-1sb.json','utf8')});renderAll();`,c);ok(true,'страница собирается');
   // листы: тумба — общий вид, сборка, 2 листа деталей; на листе деталей длины 790 и 685
   const sh=vm.runInContext('buildSheets()',c);ok(sh.length===4&&sh[2].svg.includes('>790<')&&sh[2].svg.includes('>685<')&&sh.every(x=>x.svg.includes('vashaklach@gmail.com')&&!/NaN|undefined/.test(x.svg)),'чертежи тумбы: '+sh.map(x=>x.title).join(' | '));
   vm.runInContext(`M=normModel(${fs.readFileSync(P+'/examples/naves-3x2.json','utf8')});`,c);const sn=vm.runInContext('buildSheets()',c);
   ok(sn.length===5&&sn.every(x=>!/NaN|undefined|Infinity/.test(x.svg)),'чертежи навеса: '+sn.length+' листов');}catch(e){ok(false,'страница: '+e.message+' '+(e.stack.split('\n')[1]||''));}}
process.exit(fails?1:0);
