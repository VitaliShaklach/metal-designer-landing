// мини-PNG: чтение RGB/RGBA 8 бит и запись RGB
const fs=require('fs'),zlib=require('zlib');
function readPNG(f){const b=fs.readFileSync(f);let o=8,W,H,ct,idat=[];while(o<b.length){const len=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8),d=b.subarray(o+8,o+8+len);
  if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')idat.push(d);o+=12+len;}
  const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),st=W*bpp,px=Buffer.alloc(W*H*3),prev=Buffer.alloc(st),cur=Buffer.alloc(st);
  for(let y=0;y<H;y++){const ft=raw[y*(st+1)],line=raw.subarray(y*(st+1)+1,(y+1)*(st+1));
    for(let i=0;i<st;i++){const a=i>=bpp?cur[i-bpp]:0,bb=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=line[i];
      if(ft===1)v+=a;else if(ft===2)v+=bb;else if(ft===3)v+=(a+bb)>>1;else if(ft===4){const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?bb:c;}cur[i]=v&255;}
    for(let x=0;x<W;x++){px[(y*W+x)*3]=cur[x*bpp];px[(y*W+x)*3+1]=cur[x*bpp+1];px[(y*W+x)*3+2]=cur[x*bpp+2];}cur.copy(prev);}
  return {W,H,px};}
function crc(buf){let c,t=crc.t;if(!t){t=crc.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}}c=0xffffffff;for(const x of buf)c=t[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function writePNG(f,W,H,px){const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const h=Buffer.alloc(13);h.writeUInt32BE(W,0);h.writeUInt32BE(H,4);h[8]=8;h[9]=2;const raw=Buffer.alloc(H*(W*3+1));for(let y=0;y<H;y++)px.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3);
  fs.writeFileSync(f,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',h),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));}
module.exports={readPNG,writePNG};
if(require.main===module){const [src,dst,sz,x0,y0,w0]=process.argv.slice(2);const I=readPNG(src),S=+sz||1024,X=+x0||0,Y=+y0||0,Wc=+w0||I.W,k=Wc/S,o=Buffer.alloc(S*S*3);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const s=((Math.floor(Y+y*k))*I.W+Math.floor(X+x*k))*3;o[(y*S+x)*3]=I.px[s];o[(y*S+x)*3+1]=I.px[s+1];o[(y*S+x)*3+2]=I.px[s+2];}writePNG(dst,S,S,o);console.log(I.W,I.H);}
// склеить картинки одной высоты в ряд
function hcat(out,files){const {readPNG:rp}=module.exports;const I=files.map(f=>rp(f)),H=Math.max(...I.map(i=>i.H)),W=I.reduce((a,i)=>a+i.W,0),px=Buffer.alloc(W*H*3,40);let x0=0;
  I.forEach(im=>{for(let y=0;y<im.H;y++)im.px.copy(px,(y*W+x0)*3,y*im.W*3,(y+1)*im.W*3);x0+=im.W;});writePNG(out,W,H,px);}
module.exports.hcat=hcat;
