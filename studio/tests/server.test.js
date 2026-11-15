// сервер мастерской (studio/server.js): node --test studio/tests/server.test.js
const test=require('node:test'),assert=require('node:assert'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path');
const {writeOBJ,run}=require('./helpers.js');
const ROOT=path.join(__dirname,'..','..');

// запрос с любыми заголовками (fetch не даёт подменить Host)
function req(S,{method='GET',url='/',headers={},body=null,host,origin,token}={}){
  return new Promise((resolve,reject)=>{const h=Object.assign({Host:host||'127.0.0.1:'+S.port},headers);
    if(origin!==null)h.Origin=origin||'http://127.0.0.1:'+S.port;if(token!==null&&method==='POST')h['X-Studio-Token']=token||S.token;
    const data=body===null?null:Buffer.from(JSON.stringify(body));if(data){h['Content-Type']='application/json';h['Content-Length']=data.length;}
    const r=http.request({host:'127.0.0.1',port:S.port,path:url,method,headers:h},res=>{const c=[];res.on('data',x=>c.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(c).toString('utf8')}));});
    r.on('error',reject);if(data)r.write(data);r.end();});}
const api=(S,cmd,body={},o={})=>req(S,Object.assign({method:'POST',url:'/api/'+cmd,body},o));
const j=r=>JSON.parse(r.text);
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'studio-work-'));
async function start(work,o={}){const {createStudio}=require('../server.js'),S=await createStudio(Object.assign({work,port:0,open:false},o));return S;}

test('слушает только 127.0.0.1', async () => {
  const S=await start(tmp());try{assert.equal(S.server.address().address,'127.0.0.1');}finally{await S.close();}
});
test('без токена, с чужим Origin и с чужим Host — 403 (ревью, п. 4)', async () => {
  const S=await start(tmp());try{
    assert.equal((await api(S,'list',{})).status,200);
    assert.equal((await api(S,'list',{},{token:'x'.repeat(64)})).status,403);
    assert.equal((await req(S,{method:'POST',url:'/api/list',body:{},token:null})).status,403);
    assert.equal((await api(S,'list',{},{origin:'http://evil.example'})).status,403);
    assert.equal((await api(S,'list',{},{origin:null})).status,403);
    assert.equal((await api(S,'list',{},{host:'evil.example:'+S.port})).status,403);
    assert.equal((await req(S,{url:'/editor/lynx/',host:'evil.example'})).status,403);   // DNS-rebinding: и страницу чужому имени не отдаём
    assert.equal((await req(S,{url:'/api/list'})).status,403);   // GET в API — нет
  }finally{await S.close();}
});
test('страница мастерской: токен и panel.js есть, файл на диске прежний', async () => {
  const S=await start(tmp()),disk=fs.readFileSync(path.join(ROOT,'editor/lynx/index.html'),'utf8');
  try{for(const u of ['/editor/lynx/','/editor/lynx/index.html']){const r=await req(S,{url:u});assert.equal(r.status,200);
      assert.ok(r.text.includes(S.token),u);assert.ok(r.text.includes('/studio/ui/panel.js'));assert.ok(r.text.includes('/studio/js/rules.js'));assert.ok(r.text.indexOf('panel.js')>r.text.indexOf('js/ui.js'));
      assert.ok(r.text.includes(`port:${S.port}`));}
    assert.equal(fs.readFileSync(path.join(ROOT,'editor/lynx/index.html'),'utf8'),disk);assert.ok(!disk.includes('panel.js'));
    assert.equal((await req(S,{url:'/editor/lynx/js/ui.js'})).status,200);   // обычный файл — без вставок
    assert.ok(!(await req(S,{url:'/editor/lynx/js/ui.js'})).text.includes(S.token));
  }finally{await S.close();}
});
test('закрытые пути — 404', async () => {
  const work=tmp(),S=await start(work);fs.mkdirSync(path.join(work,'a'));fs.writeFileSync(path.join(work,'a','figure.json'),'{}');
  try{for(const u of ['/studio/work/x/figure.json','/.git/config','/%2e%2e/package.json','/..%2f..%2fpackage.json','/studio/.wt/x','/editor/lynx/%2e%2e/%2e%2e/%2e%2e/package.json','/node_modules/x','/studio/tests/.work/x'])
      assert.equal((await req(S,{url:u})).status,404,u);
    assert.equal((await req(S,{url:'/package.json'})).status,200);
  }finally{await S.close();}
});
test('копия рыси: slug rys-2, имя «Рысь 2», точки и грани как у рыси 14; с STUDIO_LYNX_REF — эталон', async () => {
  const work=tmp(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-ref-')),obj=path.join(dir,'lynx.obj');
  // эталон — простая гранёная модель: куб 10 × 20 × 10 (высота 20 → рамка конвейера)
  const V=[[-5,0,0],[5,0,0],[5,20,0],[-5,20,0],[-5,0,10],[5,0,10],[5,20,10],[-5,20,10]],F=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[1,2,6],[1,6,5],[0,4,7],[0,7,3]];
  fs.writeFileSync(obj,V.map(p=>'v '+p.join(' ')).concat(F.map(f=>'f '+f.map(i=>i+1).join(' '))).join('\n'));
  const keep=process.env.STUDIO_LYNX_REF;process.env.STUDIO_LYNX_REF=obj;
  for(const k of Object.keys(require.cache))if(/studio[\\/](server|lib[\\/]sources)\.js$/.test(k))delete require.cache[k];
  const S=await start(work);
  try{const r=await api(S,'copy',{id:'lynx14'});assert.equal(r.status,200);const {slug}=j(r);assert.equal(slug,'rys-2');
    const o=j(await api(S,'open',{slug})),m=run('modelPoly')('lynx14');
    assert.equal(o.figure.name,'Рысь 2');assert.equal(o.figure.kind,'stand');assert.equal(o.figure.V.length,m.V.length);assert.equal(o.figure.P.length,m.P.length);
    assert.deepEqual(o.figure.V[0],m.V[0]);assert.equal(o.figure.H,1000);assert.ok(Array.isArray(o.figure.slots)&&o.figure.slots.length>0,'прорези — открытые контуры');
    assert.ok(o.ref&&o.ref.V.length&&o.ref.F.length,'эталон на месте');assert.ok(fs.existsSync(path.join(work,'rys-2','ref','ref.json')));assert.ok(fs.existsSync(path.join(work,'rys-2','ref','src','lynx.obj')));
    const r2=j(await api(S,'copy',{id:'lynx14'}));assert.equal(r2.slug,'rys-3');   // «Рысь 2» занята
    assert.equal((await api(S,'copy',{id:'../x'})).status,500);
  }finally{await S.close();if(keep===undefined)delete process.env.STUDIO_LYNX_REF;else process.env.STUDIO_LYNX_REF=keep;
    for(const k of Object.keys(require.cache))if(/studio[\\/](server|lib[\\/]sources)\.js$/.test(k))delete require.cache[k];}
});
test('закрыл и открыл: фигура, история и «последняя» те же', async () => {
  const work=tmp();let S=await start(work);
  const fig={type:'md-studio',v:1,name:'Тест',kind:'stand',localOnly:false,H:1000,V:[[0,0,0],[1,0,0],[1,1,0]],P:[[0,1,2]],S:[],keep:[{rule:1,at:[0,0,0]}],slots:[],refHalf:'left'};
  try{assert.equal((await api(S,'save',{slug:'test',figure:fig,undo:['a','b'],redo:['c'],k:1.7})).status,200);}finally{await S.close();}
  S=await start(work);
  try{const l=j(await api(S,'list'));assert.equal(l.last,'test');assert.equal(l.figures[0].slug,'test');assert.equal(l.published[0].id,'lynx14');
    const o=j(await api(S,'open',{slug:'test'}));assert.deepEqual(o.figure,fig);assert.deepEqual(o.undo,['a','b']);assert.deepEqual(o.redo,['c']);assert.equal(o.k,1.7);assert.equal(o.ref,null);
    assert.equal((await api(S,'save',{slug:'../evil',figure:fig})).status,500);assert.equal((await api(S,'save',{slug:'t2',figure:{type:'x'}})).status,500);
    assert.equal((await api(S,'nosuch',{})).status,404);assert.equal(j(await api(S,'job',{job:'нет'})).done,true);
  }finally{await S.close();}
});
test('настройки: set / reset', async () => {
  const S=await start(tmp());try{
    assert.equal(j(await api(S,'settings',{})).th.planar,.1);
    assert.equal(j(await api(S,'settings',{set:{planar:.3}})).th.planar,.3);assert.equal(j(await api(S,'settings',{})).th.planar,.3);
    assert.equal((await api(S,'settings',{set:{evil:1}})).status,500);
    assert.equal(j(await api(S,'settings',{reset:true})).th.planar,.1);
  }finally{await S.close();}
});
