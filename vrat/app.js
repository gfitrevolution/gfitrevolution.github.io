(function(){
function runTest(CFG, IMG){

/* ===== POSTAVKE ===== */
const GORAN_WA=(CFG.wa||'').replace(/[^0-9]/g,'');                 // npr. '38765123456'
const GORAN_IG=CFG.ig||'gfitrevolution';

/* ---------- anatomija (SVG, pogled s leđa) ---------- */
async function fetchModel(url){
  const res=await fetch(url); if(!res.ok) throw new Error('load '+res.status);
  let buf;
  if(true){ const s=atob((await res.text()).trim()); const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); buf=u.buffer; }
  else buf=await res.arrayBuffer();
  const b0=new Uint8Array(buf,0,2);
  if(b0[0]===0x1f&&b0[1]===0x8b){ const ds=new DecompressionStream('gzip'); buf=await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer(); }
  const dv=new DataView(buf); const hl=dv.getUint32(0,true);
  const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl)));
  let off=4+hl; const lo=head.box[0], hi=head.box[1];
  const pad=x=>(x+3)&~3;
  const layers=head.layers.map(L=>{
    const qp=new Uint16Array(buf,off,L.nv*3); off=pad(off+L.nv*6);
    const qx=new Int8Array(buf,off,L.nv*4); off=pad(off+L.nv*4);
    const d=new Int32Array(buf,off,L.nt*3); off=pad(off+L.nt*12);
    const pos=new Float32Array(L.nv*3); for(let i=0;i<L.nv;i++){ for(let k=0;k<3;k++) pos[i*3+k]=lo[k]+qp[i*3+k]/65535*(hi[k]-lo[k]); }
    const idx=new Uint32Array(L.nt*3); let acc=0; for(let i=0;i<d.length;i++){ acc+=d[i]; idx[i]=acc; }
    const nrm=new Float32Array(L.nv*3);
    for(let i=0;i<idx.length;i+=3){ const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
      const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      nrm[a]+=nx;nrm[a+1]+=ny;nrm[a+2]+=nz;nrm[b]+=nx;nrm[b+1]+=ny;nrm[b+2]+=nz;nrm[c]+=nx;nrm[c+1]+=ny;nrm[c+2]+=nz; }
    const ax=new Float32Array(L.nv*3); for(let i=0;i<L.nv;i++){ ax[i*3]=qx[i*4]/127; ax[i*3+1]=qx[i*4+1]/127; ax[i*3+2]=qx[i*4+2]/127; }
    return {L,pos,nrm,ax,idx};
  });
  return {box:head.box,layers};
}

let SKINP=null; function loadSkin(){ return SKINP||(SKINP=fetchModel(CFG.skin)); }
async function skinShape(bmi,whtr,sex,ex){ ex=ex||{};
  const mdl=await loadSkin(); const L=mdl.layers[0]; const src=L.pos, idx=L.idx, nv=src.length/3;
  const f=Math.max(-0.25,Math.min(1.4,(bmi-22.5)/12)), wf=Math.max(0,Math.min(1.3,(whtr-0.48)/0.2)), Z=sex!=='m';
  const Gm=(y,c,w)=>Math.exp(-(((y-c)/w)**2)), ss=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
  const lerpT=(y,tab)=>{ if(y<=tab[0][0]) return tab[0][1]; for(let k=1;k<tab.length;k++) if(y<=tab[k][0]){ const [y0,v0]=tab[k-1],[y1,v1]=tab[k]; return v0+(v1-v0)*(y-y0)/(y1-y0);} return tab[tab.length-1][1]; };
  const XT=[[0.72,0.165],[0.85,0.17],[0.95,0.165],[1.05,0.148],[1.15,0.155],[1.25,0.17],[1.35,0.18],[1.45,0.14]];
  const XA=[[0.7,0.27],[0.85,0.265],[1.0,0.233],[1.2,0.215],[1.4,0.19],[1.5,0.17]];
  const sxT=y=>{ let v=1+f*(0.32*Gm(y,1.03,.11)+0.26*Gm(y,0.90,.07)+0.14*Gm(y,1.25,.08)+0.12*Gm(y,1.47,.04))+wf*0.2*Gm(y,1.06,.09);
    if(Z) v*=1-0.10*Gm(y,1.38,.045)-0.09*Gm(y,1.08,.05)+0.13*Gm(y,0.90,.06); v*=1+(ex.hip||0)*Gm(y,0.90,.07)+(ex.chest||0)*Gm(y,1.28,.07); return Math.max(0.78,v); };
  const P=new Float32Array(src.length); const cls=new Int8Array(nv);
  for(let i=0;i<nv;i++){ const x0=src[i*3],y=src[i*3+1],z0=src[i*3+2], ax=Math.abs(x0), s=x0>=0?1:-1;
    const xt=lerpT(y,XT), sx=sxT(y), front=z0>0;
    let sz=front?1+f*(0.44*Gm(y,1.03,.10)+0.18*Gm(y,1.25,.06)+0.12*Gm(y,1.47,.04))+wf*0.62*Gm(y,1.04,.09)+(ex.belly||0)*1.4*Gm(y,1.03,.09):1+f*(0.32*Gm(y,0.90,.07)+0.14*Gm(y,1.1,.12))+(Z?0.09*Gm(y,0.9,.06):0);
    sz=Math.max(0.78,sz);
    let tx=x0*sx, tz=z0*sz;
    if(Z&&front) tz+=0.026*Gm(y,1.24,.035)*Math.exp(-(((ax-0.085)/0.05)**2));
    const wa=ss(xt-0.012,xt+0.03,ax)*ss(0.66,0.74,y)*(1-ss(1.36,1.46,y));
    let ox=tx, oz=tz;
    if(wa>0){ const xa=lerpT(y,XA), za=-0.005; let ra=1+f*(0.45*Gm(y,1.25,.1)+0.25*Gm(y,1.0,.09)); if(Z) ra*=0.93; ra=Math.max(0.82,ra);
      const shift=s*xt*(sx-1)+s*f*0.012;
      const axx=s*xa+(x0-s*xa)*ra+shift, azz=za+(z0-za)*ra; ox=tx*(1-wa)+axx*wa; oz=tz*(1-wa)+azz*wa; }
    const wl=1-ss(0.70,0.84,y);
    if(wl>0&&wa<0.5){ const xl=Math.max(0.06,lerpT(y,[[0.05,0.07],[0.45,0.075],[0.7,0.085],[0.84,0.09]])); let rl=1+f*(0.42*Gm(y,0.66,.1)+0.2*Gm(y,0.35,.07))+(Z?0.07*Gm(y,0.68,.08):0)+(ex.thigh||0)*Gm(y,0.66,.09); rl=Math.max(0.82,rl);
      const hipShift=s*0.09*(sxT(0.88)-1)*ss(0.3,0.75,y);
      const lx=s*xl+(x0-s*xl)*rl+hipShift, lz=-0.02+(z0+0.02)*rl; ox=ox*(1-wl)+lx*wl; oz=oz*(1-wl)+lz*wl; }
    cls[i]=wa>0.5?1:(y<0.78?2:0);
    P[i*3]=ox;P[i*3+1]=y;P[i*3+2]=oz; }
  return {P,Nn:meshNormals(P,idx),idx,cls,nv};
}
function meshNormals(P,idx){ const Nn=new Float32Array(P.length);
  for(let i=0;i<idx.length;i+=3){ const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx; for(const o of [a,b,c]){Nn[o]+=nx;Nn[o+1]+=ny;Nn[o+2]+=nz;} }
  for(let i=0;i<Nn.length;i+=3){ const l=Math.hypot(Nn[i],Nn[i+1],Nn[i+2])||1; Nn[i]/=l;Nn[i+1]/=l;Nn[i+2]/=l; } return Nn; }
// tačke na površini (indeks verteksa, da prate morph)
function skinPick(S,hy,fn){ const P=S.P; let best=-1,bv=-1e9; for(let i=0;i<S.nv;i++){ const y=P[i*3+1]; if(Math.abs(y-hy)>0.015) continue; const v=fn(P[i*3],P[i*3+2],S.cls[i]); if(v>bv){bv=v;best=i;} } return best<0?null:best; }
// ---------- 3D tijelo djevojke (boja mišića) + tačke za označavanje ----------
const BODY={S:null,ready:null};
function bodyReady(){ return BODY.ready||(BODY.ready=skinShape(21.5,0.43,'z').then(S=>{ BODY.S=S; return S; })); }
const ZONES={
 pain:[['glava_pot',1.64,0],['potiljak',1.565,0],['vrat_gore',1.515,0],['vrat_dole',1.455,0],['vrat',1.49,0.052],['trapez',1.43,0.12],['rame',1.405,0.192],['lopatica',1.27,0.09],['izmedju',1.34,0]],
 spread:[['s_glava',1.64,0],['s_izmedju',1.31,0],['s_rame',1.40,0.19],['s_nad',1.20,'arm'],['s_pod',0.98,'arm'],['s_saka',0.80,'arm']]
};
const CAM={pain:{cy:1.43,dz:1.0,fov:0.62},spread:{cy:1.20,dz:2.05,fov:0.62},hero:{cy:1.27,dz:1.75,fov:0.62},res:{cy:1.20,dz:2.05,fov:0.62}};
function zonePoints(S,mode){
  const P=S.P,n=S.nv, out=[];
  const backPick=(y,x,dx)=>{ let best=-1,bv=1e9; for(let i=0;i<n;i++){ const py=P[i*3+1]; if(Math.abs(py-y)>0.012) continue; const px=P[i*3]; if(Math.abs(px-x)>dx) continue; const v=P[i*3+2]+Math.abs(px-x)*0.6; if(v<bv){bv=v;best=i;} } return best<0?null:[P[best*3],P[best*3+1],P[best*3+2]]; };
  const armX=(y,sg)=>{ let sx=0,c=0; for(let i=0;i<n;i++){ const py=P[i*3+1], px=P[i*3]; if(Math.abs(py-y)>0.01||px*sg<0.16) continue; sx+=px; c++; } return c?sx/c:null; };
  (ZONES[mode==='res'?'spread':mode]||[]).concat(mode==='res'?ZONES.pain:[]).forEach(([id,y,x])=>{
    const sides=x===0?[0]:[1,-1];
    sides.forEach(sg=>{ let p=null;
      if(x==='arm'){ const ax=armX(y,sg); if(ax!=null) p=backPick(y,ax,0.03); }
      else p=backPick(y,x*sg,x?0.02:0.012);
      if(p) out.push({id,sg,p}); });
  });
  return out;
}
function drawBody(cv,S,cam){
  const gl=cv.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true}); if(!gl) return null;
  const u32=gl.getExtension('OES_element_index_uint'), ext=gl.getExtension('OES_standard_derivatives');
  const big=S.P.length/3>65535; if(big&&!u32) return null;
  const vs=`attribute vec3 p;attribute vec3 n;attribute float m;uniform mat4 Pm;uniform float cy;uniform float dz;varying vec3 wn;varying vec3 vq;varying float vm;varying float vy;
  void main(){ vec3 q=vec3(-p.x,p.y-cy,-p.z); wn=vec3(-n.x,n.y,-n.z); vq=q; vm=m; vy=p.y; gl_Position=Pm*vec4(q.x,q.y,q.z-dz,1.0);}`;
  const fs=(ext?'#extension GL_OES_standard_derivatives : enable\n':'')+`precision highp float;varying vec3 wn;varying vec3 vq;varying float vm;varying float vy;
  void main(){ vec3 N=normalize(wn); ${ext?'vec3 F=normalize(cross(dFdx(vq),dFdy(vq))); if(F.z<0.0) F=-F; if(dot(N,F)<0.2) N=normalize(mix(N,F,0.8));':''} if(N.z<0.0) N=-N;
    vec3 V=vec3(0.0,0.0,1.0); vec3 L=normalize(vec3(-0.45,0.65,0.62)); float d=max(dot(N,L),0.0); float f=max(dot(N,normalize(vec3(0.7,0.2,0.4))),0.0);
    float rim=pow(1.0-max(N.z,0.0),2.4); vec3 H=normalize(L+V); float sp=pow(max(dot(N,H),0.0),36.0);
    vec3 base=vec3(0.86,0.42,0.48);
    vec3 c=base*(0.30+0.78*d)+vec3(0.98,0.70,0.72)*f*0.16+vec3(1.0,0.88,0.88)*sp*0.32+vec3(1.0,0.82,0.85)*rim*0.42+vec3(0.9,0.5,0.55)*pow(d,0.5)*0.08;
    vec3 cloth=vec3(0.34,0.13,0.20)*(0.45+0.8*d)+vec3(1.0,0.85,0.9)*sp*0.10+vec3(1.0,0.8,0.85)*rim*0.25;
    c=mix(c,cloth,smoothstep(0.4,0.6,vm));
    float fade=smoothstep(0.68,0.80,vy); gl_FragColor=vec4(c,fade); }`;
  const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x};
  const pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) return null; gl.useProgram(pr);
  const buf=(arr,name,k)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);const l=gl.getAttribLocation(pr,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,k,gl.FLOAT,false,0,0)};
  buf(S.P,'p',3); buf(S.Nn,'n',3);
  if(!S.M){ const M=new Float32Array(S.nv), ss=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}; for(let i=0;i<S.nv;i++){ if(S.cls[i]===1) continue; const y=S.P[i*3+1]; M[i]=Math.max(ss(0.70,0.72,y)*(1-ss(0.965,0.985,y)),ss(1.20,1.22,y)*(1-ss(1.33,1.35,y))); } S.M=M; }
  buf(S.M,'m',1);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,big?new Uint32Array(S.idx):new Uint16Array(S.idx),gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  const dpr=Math.min(devicePixelRatio||1,2.5), w=cv.clientWidth||300, h=cv.clientHeight||400; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  const asp=w/h, ft=1/Math.tan(cam.fov/2), nn=0.05, fa=20; const Pm=[ft/asp,0,0,0, 0,ft,0,0, 0,0,(fa+nn)/(nn-fa),-1, 0,0,2*fa*nn/(nn-fa),0];
  gl.viewport(0,0,cv.width,cv.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(gl.getUniformLocation(pr,'Pm'),false,new Float32Array(Pm)); gl.uniform1f(gl.getUniformLocation(pr,'cy'),cam.cy); gl.uniform1f(gl.getUniformLocation(pr,'dz'),cam.dz);
  gl.drawElements(gl.TRIANGLES,S.idx.length,big?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);
  return p=>{ const x=-p[0], y=p[1]-cam.cy, z=-p[2]-cam.dz; return [((x*ft/asp)/(-z)*0.5+0.5)*w, (0.5-(y*ft)/(-z)*0.5)*h]; };
}
// mapa: kontejner sa canvasom i tačkama
async function bodyMap(box,mode,opts={}){
  box.innerHTML=`<div class="b3w ${mode}"><canvas></canvas><div class="mk"></div><div class="b3load">Učitavam tijelo…</div></div>`;
  let S; try{ S=await bodyReady(); }catch(_){ box.querySelector('.b3load').textContent='Tijelo se ne može učitati. Osvježi stranicu.'; return; }
  if(!box.isConnected) return;
  const cv=box.querySelector('canvas'); const proj=drawBody(cv,S,CAM[mode]); box.querySelector('.b3load').remove(); if(!proj) return;
  if(mode==='hero'){ opts.onImage&&opts.onImage(cv.toDataURL('image/png')); return; }
  const pts=zonePoints(S,mode), mk=box.querySelector('.mk'); const W=cv.clientWidth;
  mk.innerHTML=pts.map(z=>{ const [sx,sy]=proj(z.p); const side=z.sg===0?'':(sx<W/2?'_l':'_d'); const id=z.id+side; const sp=id.startsWith('s_');
    return `<button type="button" class="dot ${sp?'sp':''}" data-r="${id}" style="left:${sx.toFixed(1)}px;top:${sy.toFixed(1)}px" aria-label="${esc(RL[id]||id)}"><i></i></button>`; }).join('')
   +(mode!=='hero'?`<span class="side l">LIJEVO</span><span class="side d">DESNO</span>`:'');
  if(opts.onReady) opts.onReady(mk);
}

const RL={potiljak:'Potiljak (baza lobanje)',glava_pot:'Zadnji dio glave',vrat_gore:'Gornji vrat, sredina',vrat_dole:'Donji vrat (C6–C7)',vrat_l:'Vrat lijevo bočno',vrat_d:'Vrat desno bočno',trapez_l:'Trapez lijevo',trapez_d:'Trapez desno',lopatica_l:'Uz lijevu lopaticu',lopatica_d:'Uz desnu lopaticu',izmedju:'Između lopatica',rame_l:'Lijevo rame',rame_d:'Desno rame',
  s_glava:'Glava (tjeme, potiljak)',s_izmedju:'Između lopatica',s_rame_l:'Lijevo rame',s_rame_d:'Desno rame',s_nad_l:'Lijeva nadlaktica',s_nad_d:'Desna nadlaktica',s_pod_l:'Lijeva podlaktica',s_pod_d:'Desna podlaktica',s_saka_l:'Lijeva šaka',s_saka_d:'Desna šaka'};
const FINGERS=[['palac','Palac'],['kaz','Kažiprst'],['srednji','Srednji prst'],['prst','Prstenjak'],['mali','Mali prst']];
function nmOf(k){ if(RL[k]) return RL[k]; const h=HEADF.find(x=>x[0]===k); if(h) return h[1]; const f=FINGERS.find(x=>k.startsWith('f_'+x[0]+'_')); return f?f[1]+(k.endsWith('_l')?' L':' D'):k; }
const HEADF=[['h_oko','Iza oka'],['h_slj','Sljepoočnica'],['h_celo','Čelo'],['h_vilica','Vilica / uho']];

/* ---------- pitanja ---------- */
const Q=[
 {id:'pol',ey:'Osnovno',t:'Za koga radimo test?',type:'one',two:1,o:['Žensko','Muško']},
 {id:'god',ey:'Osnovno',t:'Koliko imaš godina?',type:'one',two:1,o:['Ispod 25','25–34','35–44','45–54','55–64','65 i više']},
 {id:'bol',ey:'Mapa bola',t:'Gdje te boli?',h:'Klikni na dijelove tijela. Može više.',type:'map',mode:'pain'},
 {id:'siri',ey:'Širenje',t:'Da li se bol širi?',h:'Klikni gdje ide. Ako se ne širi, samo idi dalje.',type:'map',mode:'spread',opt:1},
 {id:'kar',img:'back',ey:'Karakter bola',t:'Kakav je osjećaj?',h:'Označi sve što važi.',type:'multi',o:[['tup','Tup, stežući, kao "kamen"'],['ostar','Oštar, probada pri pokretu'],['struja','Kao struja niz ruku'],['zari','Žari, peče'],['puls','Pulsira, lupa']]},
 {id:'sad',ey:'Jačina',t:'Koliko boli sada?',type:'scale'},
 {id:'max',ey:'Jačina',t:'A najgore u zadnjih 7 dana?',type:'scale'},
 {id:'dugo',img:'34',ey:'Trajanje',t:'Koliko dugo traje?',type:'one',o:[['akut','Manje od 6 sedmica'],['subakut','6 do 12 sedmica'],['hron','Duže od 3 mjeseca'],['vraca','Dolazi i prolazi već godinama']]},
 {id:'pocetak',ey:'Početak',t:'Kako je počelo?',type:'one',o:[['postepeno','Postepeno, bez razloga'],['jutro','Probudio/la sam se ukočen/a'],['trening','Poslije treninga ili napora'],['udarac','Poslije udarca, pada ili saobraćajne nezgode']]},
 {id:'pokret',img:'side',ey:'Biomehanika',t:'Koji pokret pojačava bol?',h:'Probaj polako svaki pokret pa označi.',type:'multi',o:[['rot_l','Okret glave lijevo'],['rot_d','Okret glave desno'],['ext','Pogled gore (zabacivanje)'],['flex','Pogled dole (brada na grudi)'],['nagib','Uho prema ramenu'],['ruke','Ruke iznad glave'],['nosenje','Nošenje torbe ili tereta'],['sjedenje','Dugo sjedenje ili vožnja'],['nista','Nijedan posebno']]},
 {id:'olaksa',ey:'Šta pomaže',t:'Šta olakšava bol?',type:'multi',o:[['mir','Mirovanje'],['toplo','Toplota, tuš'],['pokret','Lagano kretanje'],['ruka','Ruka podignuta na glavu'],['nista','Ništa ne pomaže']]},
 {id:'neuro',img:'spine',ey:'Živci',t:'Imaš li nešto od ovoga u rukama?',type:'multi',o:[['trnci','Trnci ili mravinjanje'],['utrnulo','Utrnulost, slabiji osjećaj'],['stisak','Slabiji stisak šake'],['ispada','Ispadaju mi stvari iz ruke'],['nespretno','Nespretne ruke (dugmad, pisanje)'],['ne','Ništa od ovoga']]},
 {id:'glava',img:'side',ey:'Glavobolja',t:'Imaš li glavobolje?',type:'one',o:[['ne','Nemam'],['vrat','Da, počinje u vratu i ide naprijed'],['jedna','Da, uvijek na istoj strani'],['ostalo','Da, ali ne mislim da je od vrata']]},
 {id:'zastave',ey:'Sigurnost',t:'Da li se dešava nešto od ovoga?',h:'Važno: ovo mi pomaže da plan bude siguran za tebe.',type:'multi',o:[['vrtoglavica','Vrtoglavica, dvoslike ili zamagljen vid'],['govor','Otežan govor ili gutanje'],['hod','Nesiguran hod, gubim ravnotežu'],['noc','Jak bol noću koji ne prestaje ni u mirovanju'],['groznica','Temperatura ili gubitak kilograma bez razloga'],['karcinom','Imao/la sam karcinom'],['ne','Ništa od ovoga']]},
 {id:'ekran',ey:'Svakodnevica',t:'Koliko sati dnevno gledaš u ekran?',h:'Kompjuter, telefon, TV zajedno.',type:'one',two:1,o:['Manje od 3','3 do 6','6 do 9','Više od 9']},
 {id:'zid',img:'side',ey:'Test držanja · 20 sekundi',t:'Stani petama, guzom i leđima uz zid.',h:'Da li potiljak dodiruje zid, a da ne podižeš bradu?',type:'one',o:[['da','Da, lako dodiruje'],['jedva','Jedva, moram malo podići bradu'],['ne','Ne, glava je daleko od zida']]},
 {id:'san',ey:'Spavanje',t:'Kako spavaš?',type:'one',o:[['ledja','Na leđima'],['bok','Na boku'],['stomak','Na stomaku, glava okrenuta'],['razno','Mijenjam']]},
 {id:'stres',ey:'Napetost',t:'Koliko si pod stresom zadnjih mjesec dana?',type:'scale'},
 {id:'uticaj',ey:'Uticaj na život',t:'Šta ti bol otežava?',type:'multi',o:[['posao','Posao za kompjuterom'],['voznja','Vožnju (okretanje glave)'],['citanje','Čitanje i telefon'],['spavanje','Spavanje'],['trening','Trening'],['dijete','Nošenje djeteta ili tereta'],['nista','Ništa posebno']]},
 {id:'cilj',ey:'Cilj',t:'Šta želiš da postigneš?',type:'one',o:['Da me prestane boljeti','Da okrećem glavu bez straha','Da se uspravim i bolje držim','Da treniram bez bola u vratu']},
];

let A={}, step=-1;
const $=s=>document.querySelector(s);
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function hdr(n,tot){ const pc=tot?Math.round(n/tot*100):0; return `<div class="top"><div class="logo">G FIT<small>REVOLUTION</small></div>${tot?`<div class="prog" aria-label="Pitanje ${n} od ${tot}"><div class="tr"><i style="width:${pc}%"></i><b style="left:${Math.min(88,Math.max(12,pc))}%">${n}/${tot}</b></div></div>`:''}</div>`; }
function render(){
  const app=$('#app');
  if(step<0){
    app.innerHTML=`${hdr()}<div class="hx fade">
      <span class="tag"><i></i>Test za bol u vratu · 4 min</span>
      <h1>Bol u vratu?<br><span>Pronađi uzrok.</span></h1>
      <p class="lead">20 ciljanih pitanja iz anatomije i biomehanike, 3D mapa bola i 3 vježbe sa slikama prije i poslije.</p>
      <div class="visual"><div class="ring"></div><img src="${IMG.i34}" alt="Mišići vrata i ramena, pogled s leđa">
        <span class="pin" style="left:8%;top:30%"><i></i>Gornji trapez</span><span class="pin" style="right:6%;top:46%"><i></i>Podizač lopatice</span><span class="pin" style="left:14%;top:62%"><i></i>Korijen C6</span></div>
      <div class="stats"><div><b>3D</b><span>mapa bola</span></div><div><b>3</b><span>vježbe sa slikama prije/poslije</span></div><div class="free"><b>0 KM</b><span>BESPLATNO</span></div></div>
    </div>
    <div class="nav"><button class="btn" id="go" type="button">Započni test →</button></div>`;
    $('#go').onclick=()=>{ step=0; render(); window.scrollTo(0,0); }; return; }
  if(step>=Q.length) return result();
  const q=Q[step], v=A[q.id]; let body='';
  if(q.type==='scale'){ body=`<div class="scale" role="group" aria-label="${esc(q.t)}">${[...Array(11)].map((_,i)=>`<button type="button" data-v="${i}" aria-pressed="${v===i}">${i}</button>`).join('')}</div><div class="scl"><span>${q.id==='stres'?'bez stresa':'ne boli'}</span><span>${q.id==='stres'?'ogroman':'najgore'}</span></div>`; }
  else if(q.type==='photo'){ body=photoStepHTML(); }
  else if(q.type==='map'){ body=`<div class="mapbox" id="mapb"></div><div class="sel" id="sel"></div>`;
    if(q.mode==='spread') body+=`<div class="sub">Prsti (gdje trne ili boli)</div><div class="chips">${['l','d'].map(sd=>FINGERS.map(([k,l])=>`<button type="button" class="chip sp" data-c="f_${k}_${sd}" aria-pressed="${(v||[]).includes('f_'+k+'_'+sd)}">${l} ${sd==='l'?'L':'D'}</button>`).join('')).join('')}</div>
      <div class="sub">Glava sprijeda</div><div class="chips">${HEADF.map(([k,l])=>`<button type="button" class="chip sp" data-c="${k}" aria-pressed="${(v||[]).includes(k)}">${l}</button>`).join('')}</div>`; }
  else { const multi=q.type==='multi'; body=`<div class="opts ${q.two?'two':''}" role="group" aria-label="${esc(q.t)}">${q.o.map(o=>{ const [k,l]=Array.isArray(o)?o:[o,o]; const on=multi?(v||[]).includes(k):v===k; return `<button type="button" class="opt ${multi?'':'single'}" data-v="${esc(k)}" aria-pressed="${on}"><span class="ck">✓</span><span>${esc(l)}</span></button>`; }).join('')}</div>`; }
  const ok=q.opt||(q.type==='multi'||q.type==='map'?(v||[]).length>0:v!==undefined);
  app.innerHTML=hdr(step+1,Q.length)+`<div class="q qc glass fade">${q.img?`<div class="qimg"><img src="${IMG[q.img==="34"?"i34":q.img]}" alt=""><span>Anatomija</span></div>`:''}<span class="ey">${esc(q.ey)}</span><h2>${esc(q.t)}</h2>${q.h?`<p class="hint">${esc(q.h)}</p>`:''}${body}</div>
   <div class="nav"><button class="btn ghost" id="back" type="button" aria-label="Nazad">←</button><button class="btn" id="next" type="button" ${ok?'':'disabled'}>${step===Q.length-1?'Pogledaj rezultat':(q.type==='map'&&q.opt&&!(v||[]).length?'Ne širi se':q.type==='photo'&&!Object.keys(PRO.photos).length?'Preskoči':'Dalje')}</button></div>`;
  if(q.type==='photo') bindPhotoStep();
  if(q.type==='map'){ const upd=()=>{ const a=A[q.id]||[]; document.querySelectorAll('.dot').forEach(el=>{ const on=a.includes(el.dataset.r); el.classList.toggle('on',on); el.setAttribute('aria-pressed',on); el.querySelector('i').textContent=on?(a.filter(x=>!x.startsWith('f_')&&!x.startsWith('h_')).indexOf(el.dataset.r)+1):''; }); document.querySelectorAll('[data-c]').forEach(el=>el.setAttribute('aria-pressed',a.includes(el.dataset.c)));
      const names=a.map(nmOf).filter(Boolean); const sl=$('#sel'); if(sl) sl.innerHTML=names.length?`Označeno: <b>${esc(names.join(', '))}</b>`:'Dodirni bijele tačke na tijelu';
      const n=$('#next'); n.disabled=!(q.opt||a.length); n.textContent=q.opt&&!a.length?'Ne širi se':'Dalje'; };
    const tog=k=>{ const a=A[q.id]||[]; A[q.id]=a.includes(k)?a.filter(x=>x!==k):[...a,k]; upd(); };
    document.querySelectorAll('[data-c]').forEach(el=>el.onclick=()=>tog(el.dataset.c)); upd();
    bodyMap($('#mapb'),q.mode,{onReady:mk=>{ mk.querySelectorAll('.dot').forEach(el=>el.onclick=()=>tog(el.dataset.r)); upd(); }}); }
  else app.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ const k=b.dataset.v;
    if(q.type==='scale'){ A[q.id]=+k; render(); return; }
    if(q.type==='multi'){ let a=A[q.id]||[]; if(k==='ne'||k==='nista') a=a.includes(k)?[]:[k]; else { a=a.filter(x=>x!=='ne'&&x!=='nista'); a=a.includes(k)?a.filter(x=>x!==k):[...a,k]; } A[q.id]=a; render(); return; }
    A[q.id]=k; render(); setTimeout(()=>{ if(A[q.id]===k&&Q[step]===q){ step++; render(); window.scrollTo(0,0); } },240); });
  $('#back').onclick=()=>{ step--; render(); window.scrollTo(0,0); };
  $('#next').onclick=()=>{ step++; render(); window.scrollTo(0,0); };
}
// ================= NAPREDNO: fotke + AI, kičma, termini, prijave =================
const PRO={photos:{},ai:null,report:'',slot:null,saved:false,db:null,user:null,owner:false};

function shrinkImg(file,max=1024,q=.8){ return new Promise((res,rej)=>{ const im=new Image(), u=URL.createObjectURL(file); im.onload=()=>{ const s=Math.min(1,max/Math.max(im.width,im.height)); const c=document.createElement('canvas'); c.width=Math.round(im.width*s); c.height=Math.round(im.height*s); c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(u); c.toBlob(b=>b?res(b):rej(),'image/jpeg',q); }; im.onerror=()=>rej(); im.src=u; }); }
const PH=[['bok','Sa strane','Stani bočno uz zid ili vrata, opušteno, ruke uz tijelo. Neka se vidi cijela glava, vrat i ramena.'],['naprijed','Sprijeda','Stani licem prema kameri, opušteno, ramena vidljiva.']];
function photoStepHTML(){ return `<div class="phgrid">${PH.map(([k,l,h])=>`<label class="phs"><div class="php ${PRO.photos[k]?'has':''}">${PRO.photos[k]?`<img src="${PRO.photos[k].url}" alt="">`:`<span class="phi">📷</span>`}<b>${l}</b></div><input type="file" accept="image/*" capture="environment" data-ph="${k}" aria-label="Fotka ${l}"></label>`).join('')}</div>
  <ul class="phtips"><li>Neka te neko slika ili koristi tajmer, telefon u visini ramena, 1,5–2 m daleko.</li><li>Uska majica ili top, kosa skupljena da se vidi vrat.</li><li>Lice ne mora biti u kadru. Fotke se ne čuvaju, samo nalaz.</li></ul>
  <div id="phAi" class="aibox"></div>`; }
async function bindPhotoStep(){
  document.querySelectorAll('[data-ph]').forEach(inp=>inp.addEventListener('change',async()=>{ const f=inp.files[0]; if(!f) return; try{ const b=await shrinkImg(f); PRO.photos[inp.dataset.ph]={blob:b,url:URL.createObjectURL(b)}; PRO.ai=null; render(); }catch(_){ } }));
  const box=$('#phAi'); if(!box) return; const keys=Object.keys(PRO.photos);
  if(!keys.length){ box.innerHTML=''; return; }
  if(PRO.ai){ box.innerHTML=aiCard(PRO.ai); return; }
  let s=null, lim=null; try{ s=await claude.use('sample'); lim=s&&await s.limits(); }catch(_){}
  if(!s||!lim||!lim.images){ box.innerHTML=`<p class="small">AI analiza fotki nije dostupna u ovom pregledu. Fotke ostaju samo kod tebe.</p>`; return; }
  box.innerHTML=`<button class="btn" type="button" id="aiGo">Analiziraj moje držanje</button><p class="small">AI procjenjuje položaj glave i ramena. Nije dijagnoza.</p>`;
  $('#aiGo').onclick=async()=>{ box.innerHTML=`<div class="aiload"><i></i>Analiziram držanje…</div>`;
    try{ const imgs=keys.map(k=>PRO.photos[k].blob);
      const prompt=`Ti si kineziolog. Dobijaš fotografije iste osobe: ${keys.map(k=>k==='bok'?'pogled sa strane':'pogled sprijeda').join(', ')}. Procijeni držanje glave, vrata i ramena SAMO iz onoga što se jasno vidi. Ne postavljaj dijagnoze.
Vrati isključivo JSON:
{"glava_naprijed_stepeni":broj ili null,"glava_naprijed":"nema|blago|izrazeno|ne_vidi_se","ramena_naprijed":"nema|blago|izrazeno|ne_vidi_se","grudna_kifoza":"normalna|povecana|ne_vidi_se","nagib_glave":"nema|lijevo|desno|ne_vidi_se","visina_ramena":"jednaka|lijevo_vise|desno_vise|ne_vidi_se","nalazi":["do 4 kratke rečenice na bosanskom, šta se vidi"],"sigurnost":"niska|srednja|visoka"}
"glava_naprijed_stepeni" je procjena ugla između vertikale i linije od ramena (akromion) do uha (tragus) na fotografiji sa strane; null ako nema fotografije sa strane.`;
      const j=await s.json(prompt,{images:imgs,modelTier:'default'}); PRO.ai=j&&typeof j==='object'?j:null;
      box.innerHTML=PRO.ai?aiCard(PRO.ai):`<p class="small">Analiza nije uspjela. Probaj jasniju fotku.</p>`;
    }catch(e){ box.innerHTML=`<p class="small">${e&&e.code==='not_granted'?'Analiza nije dozvoljena.':'Analiza nije uspjela. Probaj ponovo.'}</p>`; } };
}
function aiCard(a){ const L={nema:'nema',blago:'blago',izrazeno:'izraženo',ne_vidi_se:'ne vidi se',normalna:'normalna',povecana:'povećana',lijevo:'lijevo',desno:'desno',jednaka:'jednaka',lijevo_vise:'lijevo više',desno_vise:'desno više'};
  const row=(k,v)=>v&&v!=='ne_vidi_se'?`<div class="air"><span>${k}</span><b class="${['izrazeno','povecana'].includes(v)?'r':['blago','lijevo','desno','lijevo_vise','desno_vise'].includes(v)?'a':'g'}">${L[v]||v}</b></div>`:'';
  return `<div class="aires"><span class="ey">AI nalaz držanja · sigurnost ${esc(a.sigurnost||'?')}</span>
   ${a.glava_naprijed_stepeni!=null?`<div class="air"><span>Glava ispred ramena</span><b class="${a.glava_naprijed_stepeni>=30?'r':a.glava_naprijed_stepeni>=15?'a':'g'}">≈ ${Math.round(a.glava_naprijed_stepeni)}°</b></div>`:''}
   ${row('Glava naprijed',a.glava_naprijed)}${row('Ramena naprijed',a.ramena_naprijed)}${row('Grudni dio (kifoza)',a.grudna_kifoza)}${row('Nagib glave',a.nagib_glave)}${row('Visina ramena',a.visina_ramena)}
   ${(a.nalazi||[]).slice(0,4).map(t=>`<p class="small">• ${esc(t)}</p>`).join('')}</div>`; }
// ---------- vratna kičma (SVG) sa nivoom ----------
function spineSVG(levels){ // levels: ['C5','C6',...] = korijeni → disk iznad: C5→C4/5, C6→C5/6, C7→C6/7, C8→C7/T1
  const V=['C2','C3','C4','C5','C6','C7','T1'], disc={C5:'C4',C6:'C5',C7:'C6',C8:'C7'}; const hot=new Set(levels.map(l=>disc[l]).filter(Boolean));
  let y=18, s='';
  V.forEach((v,i)=>{ const w=58+i*3.5, h=i===0?26:20, x=100-w/2;
    s+=`<g><path d="M${x} ${y+4} Q${x} ${y} ${x+6} ${y} L${x+w-6} ${y} Q${x+w} ${y} ${x+w} ${y+4} L${x+w-4} ${y+h-3} Q${x+w-6} ${y+h} ${x+w-12} ${y+h} L${x+12} ${y+h} Q${x+6} ${y+h} ${x+4} ${y+h-3}Z" fill="url(#vb)" stroke="rgba(120,80,60,.35)" stroke-width=".6"/>
      <path d="M${x-14} ${y+h*0.45} Q${x-4} ${y+h*0.3} ${x} ${y+h*0.5}" stroke="#e9dccb" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M${x+w+14} ${y+h*0.45} Q${x+w+4} ${y+h*0.3} ${x+w} ${y+h*0.5}" stroke="#e9dccb" stroke-width="5" stroke-linecap="round" fill="none"/>
      <text x="100" y="${y+h/2+4}" text-anchor="middle" font-size="10" font-weight="700" fill="#6b4a3c">${v}</text></g>`;
    if(i<V.length-1){ const dy=y+h, on=hot.has(v); s+=`<rect x="${x+4}" y="${dy+1}" width="${w-8}" height="6" rx="3" fill="${on?'#ffb48a':'#f3c9c9'}" ${on?'filter="url(#glow)"':''}/>`;
      const nv=['C3','C4','C5','C6','C7','C8'][i]; const nOn=levels.includes(nv);
      s+=`<path d="M${x+2} ${dy+4} Q${x-22} ${dy+10} ${x-40} ${dy+24}" stroke="${nOn?'#ffd36a':'rgba(255,240,200,.7)'}" stroke-width="${nOn?2.6:1.4}" fill="none" ${nOn?'filter="url(#glow)"':''}/><path d="M${x+w-2} ${dy+4} Q${x+w+22} ${dy+10} ${x+w+40} ${dy+24}" stroke="${nOn?'#ffd36a':'rgba(255,240,200,.7)'}" stroke-width="${nOn?2.6:1.4}" fill="none" ${nOn?'filter="url(#glow)"':''}/>`;
      if(on) s+=`<text x="${x+w+46}" y="${dy+8}" font-size="9" font-weight="700" fill="#fff">${v}/${V[i+1]} disk</text>`;
      y=dy+8; } else y+=h; });
  return `<svg viewBox="-10 0 250 ${y+20}" class="spine" role="img" aria-label="Vratna kičma s označenim nivoom"><defs><linearGradient id="vb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf3e8"/><stop offset="1" stop-color="#e4d2bd"/></linearGradient><filter id="glow" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
   <rect x="90" y="10" width="20" height="${y}" rx="8" fill="rgba(255,230,210,.35)"/>${s}</svg>`; }
// ---------- termini ----------
const SLOT_DAYS=10, HOURS=[8,9,10,11,16,17,18,19];
const DAN=['Ned','Pon','Uto','Sri','Čet','Pet','Sub'];
function slotList(){ const out=[], d0=new Date(); d0.setHours(0,0,0,0);
  for(let i=1;i<=SLOT_DAYS;i++){ const d=new Date(d0); d.setDate(d0.getDate()+i); if(d.getDay()===0) continue; const ds=d.toISOString().slice(0,10);
    out.push({ds,lbl:`${DAN[d.getDay()]} ${d.getDate()}.${d.getMonth()+1}.`,hours:(d.getDay()===6?[9,10,11,12]:HOURS)}); } return out; }
async function bookingHTML(box){ const days=slotList(); let taken=new Set();
  if(PRO.db){ try{ const q=await PRO.db.collection('termini').where('ds','>=',days[0].ds).get(); q.docs.forEach(d=>taken.add(d.id)); }catch(_){} }
  PRO.dayIdx=PRO.dayIdx||0; const d=days[PRO.dayIdx];
  box.innerHTML=`<div class="days">${days.map((x,i)=>`<button type="button" class="chip" data-day="${i}" aria-pressed="${i===PRO.dayIdx}">${x.lbl}</button>`).join('')}</div>
   <div class="hours">${d.hours.map(h=>{ const id=`${d.ds}_${String(h).padStart(2,'0')}`; const t=taken.has(id); return `<button type="button" class="chip" data-slot="${id}" ${t?'disabled':''} aria-pressed="${PRO.slot===id}">${String(h).padStart(2,'0')}:00${t?' · zauzeto':''}</button>`; }).join('')}</div>
   <p class="small">${PRO.slot?`Izabrano: <b style="color:#fff">${slotLabel(PRO.slot)}</b>`:'Besplatne konsultacije, 30 minuta, G Fit Modriča.'}</p>`;
  box.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{ PRO.dayIdx=+b.dataset.day; bookingHTML(box); });
  box.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{ PRO.slot=PRO.slot===b.dataset.slot?null:b.dataset.slot; bookingHTML(box); }); }
function slotLabel(id){ if(!id) return ''; const [ds,h]=id.split('_'); const d=new Date(ds+'T12:00'); return `${DAN[d.getDay()]} ${d.getDate()}.${d.getMonth()+1}. u ${h}:00`; }
// ---------- AI lični izvještaj ----------
async function aiReport(box){ let s=null; try{ s=await claude.use('sample'); }catch(_){}
  if(!s){ box.innerHTML=''; const c=box.closest('.card'); if(c) c.hidden=true; return; }
  box.innerHTML=`<button class="btn ghost" type="button" id="repGo" style="width:100%">✨ Napiši moj lični izvještaj</button>`;
  $('#repGo').onclick=async()=>{ const r=analyze(); box.innerHTML=`<div class="rep" id="repT"><span class="aiload"><i></i>Pišem izvještaj…</span></div>`;
    const data={odgovori:A,obrasci:r.pats.map(p=>p.t),crvene_zastave:r.red,strukture:r.st,nivo_korijena:r.lv,ai_drzanje:PRO.ai};
    const prompt=`Ti si iskusan kineziolog i personalni trener Goran iz G Fit Revolution (Modriča). Napiši lični izvještaj za osobu koja je uradila test za bol u vratu. Piši na bosanskom (ijekavica), prirodno, toplo i stručno, bez dijagnoza i bez obećanja izlječenja. 130–180 riječi, 3 kratka pasusa:
1) šta njeni odgovori pokazuju (obrazac, uključene strukture, šta pojačava bol),
2) zašto se to dešava biomehanički (položaj glave, opterećenje, mišićni disbalans),
3) šta je prvi korak i zašto vrijedi raditi s trenerom.
Podaci (JSON): ${JSON.stringify(data)}`;
    try{ const out=await s(prompt,{modelTier:'default',onText:({text})=>{ const t=$('#repT'); if(t) t.textContent=text; }}); PRO.report=out.text; const t=$('#repT'); if(t) t.textContent=out.text; }
    catch(e){ box.innerHTML=`<p class="small">${e&&e.code==='not_granted'?'Izvještaj nije dozvoljen.':'Izvještaj trenutno nije dostupan.'}</p>`; } };
}
// ---------- slanje prijave ----------
async function submitLead(){ const nm=$('#nm').value.trim(), ph=$('#ph').value.trim(), ct=$('#ct').value.trim();
  if(!nm||!ph){ $('#sendMsg').textContent='Upiši ime i broj telefona.'; return; } if(!$('#ok').checked){ $('#sendMsg').textContent='Označi saglasnost da Goran vidi tvoje odgovore.'; return; }
  const r=analyze(), b=$('#sendBtn'); b.disabled=true; b.textContent='Šaljem…';
  try{ await CFG.submit({ime:nm,telefon:ph,grad:ct,termin:PRO.slot?slotLabel(PRO.slot):'',obrazac:r.pats.map(p=>p.t).join('; '),bol:`sada ${A.sad??'-'}/10, najgore ${A.max??'-'}/10`,ozbiljni_znakovi:r.red.join('; ')||'nema',rezultat:message(nm,ct),saglasnost:true});
    PRO.saved=true; $('#sendBox').innerHTML=`<div class="okbox"><b>Prijava je poslana ✓</b><span>${PRO.slot?`Termin: ${slotLabel(PRO.slot)}. `:''}Javiću ti se na ${esc(ph)}.</span></div>`;
  }catch(e){ $('#sendMsg').textContent='Slanje nije uspjelo. Probaj ponovo ili mi napiši poruku.'; b.disabled=false; b.textContent='Pošalji prijavu'; } }
// ---------- Goranove prijave (samo vlasnik) ----------
function showInboxBtn(){ if($('#inboxBtn')) return; const b=document.createElement('button'); b.id='inboxBtn'; b.type='button'; b.className='inb'; b.textContent='Prijave'; b.onclick=openInbox; document.body.appendChild(b); }
async function openInbox(){ let ov=$('#inbox'); if(!ov){ ov=document.createElement('div'); ov.id='inbox'; document.body.appendChild(ov); }
  ov.hidden=false; ov.innerHTML=`<div class="inbin glass"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Prijave s testa</h3><button class="btn ghost" type="button" id="inX">✕</button></div><div id="inL"><p class="small">Učitavam…</p></div></div>`;
  $('#inX').onclick=()=>{ ov.hidden=true; };
  try{ const q=await PRO.db.collection('prijave').get(); const rows=[]; q.docs.forEach(d=>(d.data().list||[]).forEach(x=>rows.push(x))); rows.sort((a,b)=>b.ts-a.ts);
    $('#inL').innerHTML=rows.length?rows.map(x=>`<div class="inr"><div class="row" style="justify-content:space-between"><b>${esc(x.ime)}</b><span class="small">${new Date(x.ts).toLocaleString('bs')}</span></div>
      <div class="small">${esc(x.grad||'')} · <a href="https://wa.me/${esc(String(x.tel).replace(/[^0-9]/g,'').replace(/^0/,'387'))}" target="_blank" rel="noopener">${esc(x.tel)}</a>${x.termin?` · 📅 ${esc(slotLabel(x.termin))}`:''}</div>
      ${(x.crvene||[]).length?`<div class="small" style="color:#ffd0d6">⚠ ${esc(x.crvene.join('; '))}</div>`:''}
      <div class="small">${(x.obrasci||[]).map(p=>esc(p.t)).join(' · ')}</div>
      ${x.ai?`<div class="small">AI: glava ${x.ai.glava_naprijed_stepeni!=null?Math.round(x.ai.glava_naprijed_stepeni)+'°':esc(x.ai.glava_naprijed||'')}, ramena ${esc(x.ai.ramena_naprijed||'')}</div>`:''}
      ${x.izvjestaj?`<details><summary class="small">Izvještaj</summary><p class="small">${esc(x.izvjestaj)}</p></details>`:''}</div>`).join(''):'<p class="small">Još nema prijava.</p>';
  }catch(_){ $('#inL').innerHTML='<p class="small">Prijave se ne mogu učitati.</p>'; } }

/* ---------- analiza ---------- */
function analyze(){
  const b=A.bol||[], s=A.siri||[], k=A.kar||[], p=A.pokret||[], o=A.olaksa||[], n=(A.neuro||[]).filter(x=>x!=='ne'), z=(A.zastave||[]).filter(x=>x!=='ne');
  const has=(arr,...x)=>x.some(y=>arr.includes(y));
  const fingers=s.filter(x=>x.startsWith('f_'));
  const below=has(s,'s_pod_l','s_pod_d','s_saka_l','s_saka_d')||fingers.length>0;
  const side=['l','d'].map(sd=>({sd,arm:s.filter(x=>x.endsWith('_'+sd)).length}));
  // nivo korijena prema prstima / zoni
  const lv=new Set();
  if(fingers.some(f=>f.includes('palac')||f.includes('kaz'))) lv.add('C6');
  if(fingers.some(f=>f.includes('srednji'))) lv.add('C7');
  if(fingers.some(f=>f.includes('prst_')||f.includes('mali'))) lv.add('C8');
  if(has(s,'s_nad_l','s_nad_d')&&!below) lv.add('C5');
  // crvene zastave
  const red=[]; if(A.pocetak==='udarac') red.push('Bol je počeo poslije udarca ili nezgode');
  if(has(z,'vrtoglavica','govor')) red.push('Vrtoglavica, smetnje vida, govora ili gutanja');
  if(has(z,'hod')||has(n,'nespretno')) red.push('Nespretne ruke ili nesiguran hod (pritisak na kičmenu moždinu treba isključiti)');
  if(has(z,'noc','groznica','karcinom')) red.push('Noćni bol, temperatura, gubitak kilograma ili karcinom u anamnezi');
  if(has(n,'stisak','ispada')) red.push('Slabost šake');
  const pats=[];
  const radScore=(below?2:0)+(has(k,'struja','zari')?1:0)+(has(n,'trnci','utrnulo')?1:0)+(has(o,'ruka')?1:0)+(lv.size?1:0);
  if(radScore>=3) pats.push({c:'r',t:'Obrazac iritacije korijena živca'+(lv.size?` (najvjerovatnije ${[...lv].join('/')})`:''),d:`Bol ili trnci idu niz ruku${below?' ispod lakta':''}${has(o,'ruka')?', a ruka na glavi olakšava, što je tipičan znak rasterećenja korijena':''}. Treba kontrolisano opterećenje i praćenje snage i osjeta.`});
  else if(radScore>=1&&below) pats.push({c:'a',t:'Moguće nadraživanje živca',d:'Postoje znaci koji ponekad dolaze od živca u vratu. Pratimo da li se trnci šire ili smanjuju.'});
  const trap=has(b,'trapez_l','trapez_d','lopatica_l','lopatica_d','rame_l','rame_d');
  if(trap&&(has(k,'tup')||(A.stres||0)>=6||has(p,'nosenje','sjedenje'))) pats.push({c:'a',t:'Mišićno-fascijalni obrazac (gornji trapez, podizač lopatice)',d:`Tup, stežući bol u trapezu i uz lopaticu${(A.stres||0)>=6?', pojačan stresom':''}. Mišići koji podižu rame rade previše, a donji trapez i duboki stabilizatori premalo.`});
  const fhp=A.zid==='ne'?2:A.zid==='jedva'?1:0; const scr=['6 do 9','Više od 9'].includes(A.ekran);
  if(fhp||scr||has(p,'flex','sjedenje')) pats.push({c:fhp===2?'a':'g',t:'Posturalni obrazac: glava ispred tijela',d:`${fhp===2?'Potiljak ne dolazi do zida, pa glava stoji ispred linije tijela. ':fhp===1?'Glava je blago ispred tijela. ':''}${scr?'Puno sati pred ekranom drži vrat u fleksiji. ':''}Duboki pregibači vrata slabe, a mišići potiljka se skraćuju.`});
  if(has(s,'s_glava','h_oko','h_slj','h_celo')||A.glava==='vrat'||A.glava==='jedna') if(has(b,'potiljak','vrat_gore','glava_pot')||A.glava==='vrat') pats.push({c:'a',t:'Obrazac cervikogene glavobolje',d:'Glavobolja kreće iz gornjeg vrata (C1–C3) i suboksipitalnih mišića, pa se širi prema oku i čelu.'});
  const ext=has(p,'ext'), rot=has(p,'rot_l','rot_d');
  if(ext&&rot&&has(b,'vrat_l','vrat_d','vrat_dole')) pats.push({c:'a',t:'Obrazac malih zglobova vrata (fasetni)',d:'Bol na jednoj strani vrata pri zabacivanju i okretu glave. Odgovara opterećenju malih zglobova između pršljenova.'});
  if(!pats.length) pats.push({c:'g',t:'Blagi mehanički bol vrata',d:'Nema znakova živca ni crvenih zastava. Ovakav bol najbolje reaguje na redovno kretanje i jačanje.'});
  // strukture
  const st=new Set();
  if(has(b,'potiljak','glava_pot','vrat_gore')) ['Suboksipitalni mišići','Gornji vratni zglobovi C1–C3'].forEach(x=>st.add(x));
  if(has(b,'trapez_l','trapez_d')) st.add('Gornji trapez');
  if(has(b,'lopatica_l','lopatica_d')) st.add('Podizač lopatice (levator scapulae)');
  if(has(b,'izmedju')) ['Romboidni mišići','Grudni dio kičme T1–T6'].forEach(x=>st.add(x));
  if(has(b,'vrat_l','vrat_d')) ['Skalenski mišići','Sternokleidomastoideus'].forEach(x=>st.add(x));
  if(has(b,'vrat_dole')) st.add('Donji vratni segmenti C5–C7');
  if(fhp||scr) st.add('Duboki pregibači vrata (slabi)');
  lv.forEach(l=>st.add('Korijen živca '+l));
  // opterećenje (Hansraj 2014: 0°≈5 kg, 15°≈12 kg, 30°≈18 kg, 45°≈22 kg, 60°≈27 kg)
  const deg=fhp===2?(scr?45:30):fhp===1?(scr?30:15):(scr?15:0);
  let degF=deg, src='zid'; if(PRO.ai&&PRO.ai.glava_naprijed_stepeni!=null){ const a=+PRO.ai.glava_naprijed_stepeni; degF=[0,15,30,45,60].reduce((b,x)=>Math.abs(x-a)<Math.abs(b-a)?x:b,0); src='foto'; }
  const kg={0:5,15:12,30:18,45:22,60:27}[degF];
  // vježbe
  const ex=[];
  ex.push(['Uvlačenje brade (chin tuck)','Leđima uz zid, uvuci bradu ravno nazad kao da praviš dvostruku bradu. 10 × 5 s, 3 puta dnevno. Budi duboke pregibače vrata.']);
  if(has(b,'izmedju')||fhp) ex.push(['Ekstenzija grudnog dijela na stolici','Ruke iza glave, lagano se zabaci preko naslona stolice. 10 polaganih ponavljanja. Gornja leđa se otvaraju, pa vrat ima manje posla.']);
  if(trap) ex.push(['Istezanje podizača lopatice','Pogled prema pazuhu, ruka na potiljku, blago povuci. 3 × 30 s po strani, bez bola.']);
  if(radScore>=3) ex.push(['Klizanje živca (nerve glide), vrlo nježno','Ruka u stranu, dlan prema plafonu, pa lagano spusti i podigni šaku dok vrat ide suprotno. 5–10 puta, bez pojačanja trnaca. Ako se trnci pojačaju, prekini.']);
  else ex.push(['Stiskanje lopatica nazad i dole','Ramena dole i nazad, kao da ih staviš u zadnje džepove. 12 × 3 s. Budi donji trapez.']);
  const avoid=[]; if(radScore>=3) avoid.push('Izbjegavaj zabacivanje glave i nošenje teških torbi na bolnoj strani dok se trnci ne smire.');
  if(A.san==='stomak') avoid.push('Spavanje na stomaku drži vrat satima okrenut u krajnjem položaju. Probaj na boku, s jastukom visine ramena.');
  if(has(p,'ruke')) avoid.push('Vježbe iznad glave (potisak, vojnički) privremeno zamijeni varijantama ispod visine ramena.');
  return {pats,red,st:[...st],deg:degF,kg,ex,avoid,lv:[...lv],src};
}
function message(name,city){
  const r=analyze(), nm=nmOf;
  return `Zdravo Goran, uradio/la sam test za bol u vratu.
Ime: ${name}${city?', '+city:''} · ${A.pol||''} · ${A.god||''}
Boli: ${(A.bol||[]).map(nm).join(', ')||'-'}
Širi se: ${(A.siri||[]).map(nm).join(', ')||'ne širi se'}
Jačina: sada ${A.sad??'-'}/10, najgore ${A.max??'-'}/10 · traje: ${({akut:'<6 sedmica',subakut:'6–12 sedmica',hron:'>3 mjeseca',vraca:'vraća se godinama'})[A.dugo]||'-'}
Trnci/slabost: ${(A.neuro||[]).filter(x=>x!=='ne').join(', ')||'ne'}
Obrazac: ${r.pats.map(p=>p.t).join('; ')}
${r.red.length?'CRVENE ZASTAVE: '+r.red.join('; ')+'\n':''}Cilj: ${A.cilj||'-'}

Želim da riješim ovo. Kako da počnemo?`;
}

// ---------- Goranov stav, rješenja, vježbe sa slikama ----------
function solOf(t){
  if(/korijena živca/.test(t)) return 'Ovo se smiruje kad skinemo pritisak sa živca: glava nazad u liniju, nježno pokretanje živca i postepeno jačanje. Dok se trnci ne povuku, ne zabacuj glavu.';
  if(/nadraživanje/.test(t)) return 'Pratimo trnce dvije sedmice uz vježbe. Kad se počnu povlačiti, znaš da smo na pravom putu.';
  if(/Mišićno/.test(t)) return 'Ovo je bol s kojim se najlakše radi. Kad probudimo donji dio leđa i spustimo ramena, trapez prestane sve držati sam i bol popusti.';
  if(/Posturalni/.test(t)) return 'Ne treba ti savršeno držanje. Treba ti jači duboki vrat i pokretnija gornja leđa, 5 minuta dnevno.';
  if(/glavobolje/.test(t)) return 'Kad opustimo potiljak i ojačamo duboke mišiće vrata, glavobolje se prorijede. To ljudi obično prvo primijete.';
  if(/fasetni/.test(t)) return 'Male zglobove smiruje kretanje, ne mirovanje. Vratimo im pokret bez bola i bol se gasi.';
  return 'Ovo se rješava redovnim kretanjem i jačanjem. Nema razloga za strah.';
}
function myView(r){
  const t=r.pats[0].t, out=[];
  if(/korijena živca|nadraživanje/.test(t)) out.push('Kod tebe bol ne dolazi samo iz mišića, nego i od nadraženog živca koji ide u ruku.');
  else if(/Mišićno/.test(t)) out.push('Najveći dio bola ti drže trapez i mišić uz lopaticu. Rade posao umjesto leđa.');
  else if(/Posturalni/.test(t)) out.push('Glava ti stoji ispred tijela, pa vrat cijeli dan nosi više nego što treba.');
  else if(/glavobolje/.test(t)) out.push('Glavobolja ti najvjerovatnije kreće iz potiljka, ne iz same glave.');
  else if(/fasetni/.test(t)) out.push('Bol ti dolazi iz malih zglobova vrata kad zabaciš i okreneš glavu.');
  else out.push('U odgovorima nemaš ništa ozbiljno. Vrat ti je preopterećen i ukočen, to je sve.');
  if(r.deg) out.push(`Kad glava ode naprijed, vrat nosi oko ${r.kg} kg umjesto 5.`);
  if((A.stres||0)>=6) out.push('Stres ti dodatno steže ramena.');
  out.push(r.red.length?'Par tvojih odgovora želim prvo da pogledam uživo, prije nego kreneš s vježbama.':'Ovo viđam svaki dan i rješava se kad se radi pravim redom: prvo smirimo bol, pa vratimo pokret, pa ojačamo.');
  return out.join(' ');
}
const EXF={
 chin:{t:'Uvlačenje brade',d:'Stani leđima uz zid. Uvuci bradu ravno nazad, kao da praviš dvostruku bradu. Zadrži 5 sekundi.',n:'10 ponavljanja',
  bg:'<line x1="40" y1="10" x2="40" y2="138" class="pr"/>',
  a:{L:[[[52,132],[54,74]],[[54,78],[57,104],[61,127]],[[54,74],[64,58]]],H:[70,46],F:1},
  b:{L:[[[52,132],[54,74]],[[54,78],[57,104],[61,127]],[[54,74],[55,57]]],H:[55,44],F:1},ar:'M76 30 L62 30'},
 tor:{t:'Otvaranje gornjih leđa na stolici',d:'Sjedni, ruke iza glave. Polako se zabaci preko naslona dok ne osjetiš istezanje između lopatica. Vrati se.',n:'10 polaganih ponavljanja',
  bg:'<path d="M42 76 V118 H82 M46 118 V140 M78 118 V140" class="pr"/>',
  a:{L:[[[50,114],[84,114],[86,140]],[[50,114],[53,76]],[[53,80],[68,64],[52,58]]],H:[55,62],F:1,Ti:1},
  b:{L:[[[50,114],[84,114],[86,140]],[[50,114],[46,90],[38,76]],[[38,78],[52,58],[34,52]]],H:[31,64],F:1,Ti:1},ar:'M62 40 Q48 30 38 40'},
 lev:{t:'Istezanje mišića uz lopaticu',d:'Okreni pogled prema pazuhu. Ruku stavi na potiljak i samo pusti težinu ruke da vuče. Bez bola.',n:'3 × 30 s po strani',
  bg:'',
  a:{L:[[[60,82],[60,124]],[[42,78],[78,78]],[[42,80],[37,104],[39,128]],[[78,80],[83,104],[81,128]],[[60,78],[60,64]]],H:[60,51],T:1},
  b:{L:[[[60,82],[60,124]],[[42,78],[78,78]],[[42,80],[37,104],[39,128]],[[78,80],[84,56],[60,42]],[[60,78],[55,66]]],H:[50,56],T:1},ar:'M70 30 Q56 30 48 40'},
 sq:{t:'Lopatice nazad i dole',d:'Spusti ramena i povuci lopatice nazad, kao da ih staviš u zadnje džepove. Zadrži 3 sekunde.',n:'12 ponavljanja',
  bg:'',
  a:{L:[[[60,82],[60,124]],[[42,78],[78,78]],[[42,80],[37,104],[39,128]],[[78,80],[83,104],[81,128]],[[60,78],[60,64]]],H:[60,51],T:1,S:[48,72]},
  b:{L:[[[60,84],[60,124]],[[43,80],[77,80]],[[43,82],[34,100],[42,114]],[[77,82],[86,100],[78,114]],[[60,80],[60,64]]],H:[60,51],T:1,S:[54,66]},ar:'M40 94 L50 94 M80 94 L70 94'}
};
function figSVG(P,ghost,bg,ar){
  const pl=(L,ti)=>L.map((l,i)=>`<polyline class="${i===(ti||0)?'tr':''}" points="${l.map(p=>p.join(',')).join(' ')}"/>`).join('');
  const body=(Q,cls)=>`<g class="${cls}">${pl(Q.L,Q.Ti)}<circle cx="${Q.H[0]}" cy="${Q.H[1]}" r="11"/>${Q.F?`<circle class="eye" cx="${Q.H[0]+6}" cy="${Q.H[1]-2}" r="1.6"/>`:''}${Q.S?`<ellipse class="sc" cx="${Q.S[0]}" cy="94" rx="6" ry="10"/><ellipse class="sc" cx="${Q.S[1]}" cy="94" rx="6" ry="10"/>`:''}</g>`;
  return `<svg viewBox="0 0 120 144" aria-hidden="true"><defs><linearGradient id="fg" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="100" y2="140"><stop offset="0" stop-color="#ff9a7a"/><stop offset=".5" stop-color="#ff5d8f"/><stop offset="1" stop-color="#8b6cff"/></linearGradient><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#fff"/></marker></defs>${bg||''}${ghost?body(ghost,'gh'):''}${body(P,'fb')}${ar?`<path d="${ar}" class="ar" marker-end="url(#ah)"/>`:''}</svg>`;
}
function exPick(r){ const b=A.bol||[]; const trap=['trapez_l','trapez_d','lopatica_l','lopatica_d','rame_l','rame_d'].some(x=>b.includes(x));
  const rad=r.pats.some(p=>/korijena živca/.test(p.t)); return ['chin','tor',(!rad&&trap)?'lev':'sq']; }
function exCards(r){ return exPick(r).map((k,i)=>{ const e=EXF[k]; return `<div class="exv"><div class="exh"><i>${i+1}</i><div><b>${e.t}</b><span>${e.n}</span></div></div>
  <div class="exp"><figure>${figSVG(e.a,null,e.bg)}<figcaption>Prije</figcaption></figure><figure>${figSVG(e.b,e.a,e.bg,e.ar)}<figcaption>Poslije</figcaption></figure></div><p>${e.d}</p></div>`; }).join(''); }

function result(){
  const r=analyze(), app=$('#app');
  const hl=(A.bol||[]).concat(A.siri||[]);
  const LV={C5:[42.5,'C4/C5'],C6:[49.5,'C5/C6'],C7:[56.5,'C6/C7'],C8:[64,'C7/T1']};
  const lab=[['C2',23],['C3',32],['C4',39],['C5',46],['C6',53],['C7',60],['T1',68]];
  const sev=r.pats[0].c==='r'?'Pažljiv plan':r.pats.some(p=>p.c==='a')?'Traži pažnju':'Blago';
  app.innerHTML=hdr()+`<div class="res fade">
    <div class="card glass hero2 wide"><img src="${IMG.back}" alt=""><span class="ey">Tvoj rezultat</span><h1>${r.pats[0].c==='r'?'Vrat traži <em>pažljiv</em> plan':'Tvoj vrat se <em>može</em> riješiti'}</h1><p class="small">${esc(r.pats[0].t)}</p></div>
    <div class="bento">
      <div class="card glass kpi"><span class="ey">Opterećenje</span><b class="g">${r.kg}<small> kg</small></b><span class="small">glava ${r.deg?`≈${r.deg}° naprijed`:'neutralno'}${r.src==='foto'?' · iz fotke':''}</span></div>
      <div class="card glass kpi"><span class="ey">Bol</span><b>${A.sad??'–'}<small>/10</small></b><span class="small">najgore ${A.max??'–'}/10 · ${esc(sev)}</span></div>
      <div class="card glass wide"><span class="ey">Tvoja mapa</span><div class="mapbox" id="rmap"></div><p class="small"><span style="color:var(--pink2)">●</span> boli &nbsp; <span style="color:var(--amber)">●</span> širi se</p></div>
      <div class="card glass wide"><span class="ey">Vratna kičma</span><div class="spimg"><img src="${IMG.spine}" alt="Vratna kičma, pogled s leđa">${lab.map(([t,y])=>`<span class="lt" style="top:calc(${y}% - 10px);left:8px;right:auto">${t}</span>`).join('')}${r.lv.map(l=>LV[l]?`<span class="lv" style="top:calc(${LV[l][0]}% - 2.5%)"></span><span class="lt" style="top:calc(${LV[l][0]}% - 10px)">${LV[l][1]} · ${l}</span>`:'').join('')}</div>
        <p class="small">${r.lv.length?`Svijetli nivo diska iznad korijena ${r.lv.join('/')}, prema prstima i širenju bola. Obrazac, ne nalaz snimka.`:'Nema znakova da je u igri određeni korijen živca.'}</p></div>
      <div class="card glass wide"><span class="ey">Šta se dešava i kako se rješava</span><div class="pat">${r.pats.map(p=>`<div><i class="${p.c}"></i><div><b>${esc(p.t)}</b><span>${esc(p.d)}</span><em class="sol">${esc(solOf(p.t))}</em></div></div>`).join('')}</div><p class="small">Ovo je obrazac iz tvojih odgovora, ne dijagnoza.</p></div>
      ${r.st.length?`<div class="card glass wide"><span class="ey">Uključene strukture</span><div class="str">${r.st.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
      <div class="card glass wide"><span class="ey">Opterećenje po uglu glave</span><div class="loadbar">${[[0,5],[15,12],[30,18],[45,22],[60,27]].map(([d,k])=>`<div class="${d===r.deg?'on':''}">${d}°<br>${k} kg</div>`).join('')}</div><p class="small">Hansraj, 2014.</p></div>
      <div class="card glass wide mine"><span class="ey">Moj stav</span><p>${esc(myView(r))}</p><span class="sig">Goran · G Fit Revolution</span></div>
    </div>
    <div class="card glass calm"><h2>Nije toliko strašno.</h2><p>Mogu ti pomoći s ovim problemom.${r.red.length?'':' Kreni odmah sa ove 3 vježbe, treba ti 5 minuta.'}</p></div>
    ${r.red.length?`<div class="card glass"><p class="small" style="color:var(--ink)">Vježbe ti dam kad te pogledam uživo. Tako je najsigurnije za tebe.</p></div>`:`<div class="exl">${exCards(r)}</div>${r.avoid.map(a=>`<div class="avoid">${esc(a)}</div>`).join('')}<p class="small">Radi polako i bez pojačanja bola. Ako bol ili trnci rastu, stani.</p>`}
    <div class="card glass cta"><span class="ey">Sljedeći korak</span><h3>Ako želiš da te ovo što prije prođe</h3>
      <p class="small" style="color:var(--ink)">Zakaži svoj termin ili mi napiši poruku. Pogledam tvoj rezultat i složimo plan za tvoj vrat.</p>
      <a class="btn ghost" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-bottom:12px" href="https://ig.me/m/${GORAN_IG}" target="_blank" rel="noopener">Napiši mi poruku</a>
      <div id="book"></div>
      <div id="sendBox" class="stack2">
      <label class="f" for="nm">Ime<input type="text" id="nm" autocomplete="given-name" placeholder="npr. Ana"></label>
      <label class="f" for="ph">Telefon (WhatsApp/Viber)<input type="text" id="ph" inputmode="tel" autocomplete="tel" placeholder="npr. 065 123 456"></label>
      <label class="f" for="ct">Grad (nije obavezno)<input type="text" id="ct" autocomplete="address-level2" placeholder="npr. Modriča"></label>
      <label class="okl"><input type="checkbox" id="ok"> Slažem se da Goran vidi moje odgovore i kontaktira me.</label>
      <button class="btn" type="button" id="sendBtn">Pošalji prijavu</button><p class="small" id="sendMsg" role="status"></p></div>
      <details class="alt"><summary class="small">Radije pošalji sam</summary><div id="send"></div></details></div>
    <p class="small">Test je edukativan i nije dijagnoza.</p><p class="credit">Anatomske slike: BodyParts3D © DBCLS, CC BY-SA 2.1 JP</p>
    <div class="row"><button class="btn ghost" id="again" type="button" style="flex:1">Uradi ponovo</button></div></div>`;
  bodyMap($('#rmap'),'res',{onReady:mk=>{ const sel=new Set([...(A.bol||[]),...(A.siri||[])]); mk.querySelectorAll('.dot').forEach(el=>{ if(!sel.has(el.dataset.r)){ el.remove(); return; } el.classList.add('on'); el.tabIndex=-1; el.style.pointerEvents='none'; }); }});
  const msgUpd=()=>{ const nm=$('#nm').value.trim(), ct=$('#ct').value.trim(); const m=message(nm||'(ime)',ct); $('#msg').textContent=m; const a=document.querySelector('a.btn.wa'); if(a) a.href=`https://wa.me/${GORAN_WA}?text=${encodeURIComponent(message(nm,ct))}`; };
  $('#send').innerHTML=`<div class="row">${GORAN_WA?`<a class="btn wa" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#" target="_blank" rel="noopener">Pošalji na WhatsApp</a>`:''}<button class="btn ${GORAN_WA?'ghost':''}" id="cp" type="button">Kopiraj rezultat</button></div>
    <a class="btn ghost" style="display:flex;align-items:center;justify-content:center;text-decoration:none;letter-spacing:.06em" href="https://ig.me/m/${GORAN_IG}" target="_blank" rel="noopener">Otvori Instagram poruku</a>
    <p class="small">${GORAN_WA?'WhatsApp otvara poruku sa tvojim rezultatom. Samo pritisni pošalji.':'Kopiraj rezultat i zalijepi ga u poruku Goranu na Instagramu.'}</p><div class="msg" id="msg"></div>`;
  ['#nm','#ct'].forEach(q=>$(q).addEventListener('input',msgUpd)); msgUpd();
  $('#cp').onclick=async()=>{ const t=message($('#nm').value.trim(),$('#ct').value.trim()); try{ await navigator.clipboard.writeText(t); $('#cp').textContent='Kopirano ✓'; }catch(_){ const sl=getSelection(), rg=document.createRange(); rg.selectNodeContents($('#msg')); sl.removeAllRanges(); sl.addRange(rg); $('#cp').textContent='Označeno, kopiraj'; } };
  $('#again').onclick=()=>{ A={}; PRO.photos={}; PRO.ai=null; PRO.report=''; PRO.slot=null; step=-1; render(); window.scrollTo(0,0); };
  bookingHTML($('#book')); $('#sendBtn').onclick=submitLead;
}
render();

}

window.GFitVrat=runTest;
})();
