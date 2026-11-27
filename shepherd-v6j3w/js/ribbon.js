/* #181 разметка лентой: WebGL рисует линии в 1 px (linewidth не действует), Line2 в vendor/ нет — каждый отрезок рисуем лентой из двух треугольников, которую шейдер
   (rbMat в view3d.js) расширяет поперёк отрезка в пикселях экрана. Чистая функция без three.js: тест — node --test shepherd-v6j3w/tools/ribbon.test.js.
   seg — Float32Array отрезков парами точек (как у LineSegments: mkDrape, owDrape), nrm — нормали под каждой точкой (тот же порядок) или null.
   Отрезок → 4 вершины: по две на конец (сторона +1 и −1). У вершины — сама точка (pos), предыдущая точка ломаной (pa) и следующая (pb): соседний отрезок стыкуется,
   если его начало совпадает с концом этого (точно — так их выдают mkDrape/owDrape); нет соседа — вместо него сама точка. На стыке вершины обоих отрезков видят
   одну тройку pa, pos, pb — шейдер кладёт их край в одну точку (поворот «митрой»), лента без щелей и без нахлёста (нахлёст у бледной зеркальной — тёмные пятна).
   Ломаная из ≥ 3 отрезков, конец которой пришёл в её начало, — замкнутый контур: стык и там. → {pos, pa, pb, side, nrm|null, idx} */
function rbGeo(seg,nrm){const n=seg.length/6|0,pos=new Float32Array(n*12),pa=new Float32Array(n*12),pb=new Float32Array(n*12),side=new Float32Array(n*4),idx=new Uint32Array(n*6),
    N=nrm&&nrm.length===seg.length?new Float32Array(n*12):null,
    same=(i,j)=>seg[i]===seg[j]&&seg[i+1]===seg[j+1]&&seg[i+2]===seg[j+2],   // точки по смещению в seg
    prev=new Int32Array(n).fill(-1),next=new Int32Array(n).fill(-1);   // смещение соседней точки в seg или −1
  for(let i=0,c0=0;i<n;i++){if(i&&same(i*6,i*6-3)){prev[i]=i*6-6;next[i-1]=i*6+3;}else c0=i;
    if((i+1===n||!same(i*6+6,i*6+3))&&i-c0>=2&&same(i*6+3,c0*6)){prev[c0]=i*6;next[i]=c0*6+3;}}   // ломаная c0…i кончилась — замкнута ли
  const put=(A,v,o)=>{A[v*3]=seg[o];A[v*3+1]=seg[o+1];A[v*3+2]=seg[o+2];};
  for(let i=0;i<n;i++){const a=i*6,b=a+3;
    for(let k=0;k<4;k++){const v=i*4+k,end=k>>1,p=end?b:a;put(pos,v,p);put(pa,v,end?a:prev[i]<0?a:prev[i]);put(pb,v,end?next[i]<0?b:next[i]:b);side[v]=k&1?-1:1;
      if(N){N[v*3]=nrm[p];N[v*3+1]=nrm[p+1];N[v*3+2]=nrm[p+2];}}
    const q=i*4;idx.set([q,q+1,q+2,q+1,q+3,q+2],i*6);}
  return {pos,pa,pb,side,nrm:N,idx};}
