/* ---------- Версии фигуры в браузере (#148): «Овчарка 5.1», «5.2»… ---------- */
// st — обёртка памяти {get(k), set(k, v)}; если памяти нет или она полна, get/set бросают — здесь это ловится, страница работает.
// Ключи: 'shepherd-ver-<base>' — список [{n, at}], 'shepherd-ver-<base>-<n>' — сама версия (тот же JSON, что скачивается).
const verListKey=base=>'shepherd-ver-'+base,verKey=(base,n)=>'shepherd-ver-'+base+'-'+n;
function verList(st,base){let a=null;try{a=JSON.parse(st.get(verListKey(base)));}catch(e){return [];}
  if(!Array.isArray(a))return [];return a.filter(v=>v&&Number.isInteger(v.n)&&v.n>0).map(v=>({n:v.n,at:String(v.at||''),key:verKey(base,v.n)})).sort((x,y)=>x.n-y.n);}
function verGet(st,key){try{const j=JSON.parse(st.get(key));return j&&typeof j==='object'?j:null;}catch(e){return null;}}
// → {n} или {err}; сначала пишем версию, потом список: не вышло — в списке её нет
function verPut(st,base,json){try{const L=verList(st,base),n=(L.length?L[L.length-1].n:0)+1,at=new Date().toISOString();
    st.set(verKey(base,n),JSON.stringify(json));st.set(verListKey(base),JSON.stringify(L.map(v=>({n:v.n,at:v.at})).concat([{n,at}])));return {n};}
  catch(e){return {err:String(e&&e.message||e)};}}
