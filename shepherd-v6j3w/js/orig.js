/* ---------- Оригинал (вид) (#146): модель Meshy как есть, только смотреть ---------- */
// данные — js/orig-<id>.js (ORIG[id]: V, T, F в base64) + текстура img/orig-<id>.png; грузятся по выбору (FIGURES[...].need), выгружаются origDispose()
function origDecode(r){const u8=s=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;};
  const V=new Float32Array(u8(r.V).buffer),T=new Float32Array(u8(r.T).buffer),F=new Uint32Array(u8(r.F).buffer);return {V,T,F};}
// гладкие нормали по точкам, а не по вершинам страницы: на стыке кусков текстуры одна точка — две вершины (разные uv), нормаль должна быть общей
function origNormals(V,F){const N=new Float32Array(V.length),key=new Map(),idx=new Int32Array(V.length/3);
  for(let i=0;i<V.length;i+=3){const k=V[i]+','+V[i+1]+','+V[i+2];let j=key.get(k);if(j===undefined){j=key.size;key.set(k,j);}idx[i/3]=j;}
  const A=new Float32Array(key.size*3);
  for(let t=0;t<F.length;t+=3){const a=F[t]*3,b=F[t+1]*3,c=F[t+2]*3,ux=V[b]-V[a],uy=V[b+1]-V[a+1],uz=V[b+2]-V[a+2],wx=V[c]-V[a],wy=V[c+1]-V[a+1],wz=V[c+2]-V[a+2],
      nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;[a,b,c].forEach(v=>{const j=idx[v/3]*3;A[j]+=nx;A[j+1]+=ny;A[j+2]+=nz;});}
  for(let i=0;i<V.length;i+=3){const j=idx[i/3]*3,l=Math.hypot(A[j],A[j+1],A[j+2])||1;N[i]=A[j]/l;N[i+1]=A[j+1]/l;N[i+2]=A[j+2]/l;}return N;}
let ORIGV=null;   // что сейчас на сцене: {mesh, geo, grey, basic, tex}
function origDispose(){if(!ORIGV)return;const o=ORIGV;ORIGV=null;if(typeof root!=='undefined'&&root)root.remove(o.mesh);o.geo.dispose();o.grey.dispose();o.basic.dispose();if(o.tex)o.tex.dispose();}
// tex: true — с текстурой (белые швы, без освещения), false — серый с освещением
function origShow(id,tex){if(!ok)return;origDispose();const r=ORIG[id],D=origDecode(r);
  while(root.children.length){const c=root.children.pop();c.geometry&&c.geometry.dispose();if(c.element)c.element.remove();}   // фигуру со сцены (как build3D)
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(D.V,3));g.setAttribute('uv',new THREE.BufferAttribute(D.T,2));g.setAttribute('normal',new THREE.BufferAttribute(origNormals(D.V,D.F),3));g.setIndex(new THREE.BufferAttribute(D.F,1));
  const grey=new THREE.MeshLambertMaterial({color:0x80878d,side:THREE.DoubleSide}),basic=new THREE.MeshBasicMaterial({color:0x80878d,side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,grey);
  const o=ORIGV={mesh,geo:g,grey,basic,tex:null};root.add(mesh);
  // текстура грузится картинкой: пока её нет — серый; пришла — показываем (если оригинал ещё на сцене)
  const t=new THREE.TextureLoader().load(r.tex+(typeof LAZY_V!=='undefined'?LAZY_V:''),()=>{if(ORIGV!==o)return;basic.map=t;basic.color.set(0xffffff);basic.needsUpdate=true;req3D();},undefined,()=>{});
  t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());o.tex=t;origTex(tex);req3D();}
function origTex(on){if(!ORIGV)return;ORIGV.mesh.material=on?ORIGV.basic:ORIGV.grey;req3D();}
// ракурс: направление и цель камеры в долях высоты габарита — при переключении «оригинал ↔ рабочая фигура» (кадр один) камера та же
function camKeep(box){const H=box.size[1]||1,t=controls.target,p=camera.position,c=[0,1,2].map(i=>box.min[i]+box.size[i]/2);
  return {d:[(p.x-t.x)/H,(p.y-t.y)/H,(p.z-t.z)/H],t:[(t.x-c[0])/H,(t.y-c[1])/H,(t.z-c[2])/H]};}
function camRestore(k,box){if(!ok||!k)return;camAnim=null;const H=box.size[1]||1,c=[0,1,2].map(i=>box.min[i]+box.size[i]/2),t=[0,1,2].map(i=>c[i]+k.t[i]*H);
  controls.target.set(t[0],t[1],t[2]);camera.position.set(t[0]+k.d[0]*H,t[1]+k.d[1]*H,t[2]+k.d[2]*H);controls.update();req3D();}
// после потери и восстановления контекста WebGL (бывает на слабых видеокартах) кадр сам не перерисуется — просим
if(typeof renderer!=='undefined'&&renderer)renderer.domElement.addEventListener('webglcontextrestored',()=>{req3D();setTimeout(req3D,300);});
