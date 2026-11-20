// растеризатор: треугольники с цветом → PNG; view: front | side | iso | left | bottom
const {writePNG}=require('./png.js');
function render(out,V,F,colorFn,view,opt={}){const S=opt.S||800,zb=new Float32Array(S*S).fill(-1e9),px=Buffer.alloc(S*S*3,40),id=new Int32Array(S*S).fill(-1);const ca=Math.cos(.6),sa=Math.sin(.6);
  const pr=p=>view==='front'?[p[0],p[1],p[2]]:view==='side'?[p[2],p[1],-p[0]]:view==='left'?[-p[2],p[1],p[0]]:view==='bottom'?[p[0],p[2],-p[1]]:[ca*p[0]+sa*p[2],p[1],-sa*p[0]+ca*p[2]];const P=V.map(pr);
  let mn=[1e9,1e9],mx=[-1e9,-1e9];P.forEach(p=>{for(let i=0;i<2;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}});
  const k=S*.9/Math.max(mx[0]-mn[0],mx[1]-mn[1]),cx=(mn[0]+mx[0])/2,cy=(mn[1]+mx[1])/2,sp=p=>[S/2+(p[0]-cx)*k,S/2-(p[1]-cy)*k,p[2]];
  F.forEach((f,fi)=>{const a=sp(P[f[0]]),b=sp(P[f[1]]),cc=sp(P[f[2]]);let cl=colorFn(fi);if(opt.shade){const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[cc[0]-a[0],cc[1]-a[1],cc[2]-a[2]];const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];const l=Math.hypot(...n)||1;
      const L=[.35,.5,-1],ll=Math.hypot(...L),d=(n[0]*L[0]+n[1]*L[1]+n[2]*L[2])/l/ll;const sh=.3+.7*Math.abs(d);cl=cl.map(x=>x*sh);}
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],cc[0]))),x1=Math.min(S-1,Math.ceil(Math.max(a[0],b[0],cc[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],cc[1]))),y1=Math.min(S-1,Math.ceil(Math.max(a[1],b[1],cc[1])));
    const d=(b[0]-a[0])*(cc[1]-a[1])-(b[1]-a[1])*(cc[0]-a[0]);if(!d)return;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const w1=((x+.5-a[0])*(cc[1]-a[1])-(y+.5-a[1])*(cc[0]-a[0]))/d,w2=((b[0]-a[0])*(y+.5-a[1])-(b[1]-a[1])*(x+.5-a[0]))/d,w0=1-w1-w2;if(w0<0||w1<0||w2<0)continue;
      const z=w0*a[2]+w1*b[2]+w2*cc[2],o=y*S+x;if(z<=zb[o])continue;zb[o]=z;id[o]=opt.group?opt.group(fi):-1;px[o*3]=cl[0];px[o*3+1]=cl[1];px[o*3+2]=cl[2];}});
  if(opt.group)for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){const o=y*S+x;if(id[o]<0)continue;if(id[o+1]>=0&&id[o+1]!==id[o]||id[o+S]>=0&&id[o+S]!==id[o]){px[o*3]=240;px[o*3+1]=230;px[o*3+2]=215;}}
  writePNG(out,S,S,px);}
module.exports={render};
