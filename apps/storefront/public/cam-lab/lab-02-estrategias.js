'use strict';
/* =========================================================
   PREPARACIÓN DE PIEZA, BRUTO Y SUJECIÓN
   ========================================================= */
const frameOf=k=>(k==='rot4'||k==='rot5')?'rot':'top';
function orientedPositions(){
  const src=S.rawPos;const out=new Float32Array(src.length);const sc=S.units*S.scale;
  for(let i=0;i<src.length;i+=3){let x=src[i]*sc,y=src[i+1]*sc,z=src[i+2]*sc;
    for(const r of S.rotSeq){if(r==='x'){const t=y;y=-z;z=t;}else if(r==='y'){const t=z;z=-x;x=t;}else{const t=x;x=-y;y=t;}}
    out[i]=x;out[i+1]=y;out[i+2]=z;}
  return out;
}
async function preparePart(){
  if(!S.rawPos)return;
  setBusy('Analizando la malla…',0.05);await tick();
  const frame=frameOf(S.strat.kind);
  const pos=orientedPositions();
  let bmin=[Infinity,Infinity,Infinity],bmax=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.length;i+=3)for(let c=0;c<3;c++){const v=pos[i+c];if(v<bmin[c])bmin[c]=v;if(v>bmax[c])bmax[c]=v;}
  const mg=+$('#stk_margin').value||0,tm=+$('#stk_top').value||0;
  let off;
  if(frame==='top')off=[-(bmin[0]+bmax[0])/2,-(bmin[1]+bmax[1])/2,-bmax[2]-tm];
  else{ // eje de giro por el centroide de superficie (queda dentro de la pieza en piezas torcidas)
    let cy=0,cz=0,aw=0;for(let i=0;i<pos.length;i+=9){const ux=pos[i+3]-pos[i],uy=pos[i+4]-pos[i+1],uz=pos[i+5]-pos[i+2],wx=pos[i+6]-pos[i],wy=pos[i+7]-pos[i+1],wz=pos[i+8]-pos[i+2];
      const ar=Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx);cy+=ar*(pos[i+1]+pos[i+4]+pos[i+7])/3;cz+=ar*(pos[i+2]+pos[i+5]+pos[i+8])/3;aw+=ar;}
    off=[-(bmin[0]+bmax[0])/2,-(aw?cy/aw:(bmin[1]+bmax[1])/2),-(aw?cz/aw:(bmin[2]+bmax[2])/2)];}
  for(let i=0;i<pos.length;i+=3){pos[i]+=off[0];pos[i+1]+=off[1];pos[i+2]+=off[2];}
  const M=buildMesh(pos);S.M=M;S.frame=frame;
  setBusy('Preparando detección de colisiones…',0.3);await tick();
  // bruto
  if(frame==='top'){S.stock={type:'box',min:[M.bmin[0]-mg,M.bmin[1]-mg,M.bmin[2]],max:[M.bmax[0]+mg,M.bmax[1]+mg,0]};}
  else{let rmax=0;for(let i=0;i<pos.length;i+=3){const r=Math.hypot(pos[i+1],pos[i+2]);if(r>rmax)rmax=r;}
    S.stock={type:'cyl',x0:M.bmin[0]-mg,x1:M.bmax[0]+mg,r:rmax+tm+0.5,rPart:rmax};}
  // nube de puntos de colisión: pieza + sujeción
  const sp=surfacePoints(M);const pts=sp.pts;S.fixtures=[];
  if(frame==='rot'){
    const st=S.stock,cr=st.r+12,cx0=st.x0-34,cx1=st.x0-2;S.fixtures.push({type:'chuck',x0:cx0,x1:cx1,r:cr});
    const step=Math.max(1,sp.spacing*2);
    for(let r=0;r<=cr;r+=step){const n=Math.max(1,Math.ceil(2*Math.PI*r/step));for(let k=0;k<n;k++){const th=2*Math.PI*k/n;pts.push(cx1,r*Math.sin(th),r*Math.cos(th));}}
    const nc=Math.ceil(2*Math.PI*cr/step);for(let x=cx0;x<=cx1;x+=step)for(let k=0;k<nc;k++){const th=2*Math.PI*k/nc;pts.push(x,cr*Math.sin(th),cr*Math.cos(th));}
    const tx=st.x1+2,tl=24,tr=Math.min(9,st.r*0.5);S.fixtures.push({type:'tail',x0:tx,x1:tx+tl,r:tr});
    for(let x=tx;x<=tx+tl;x+=step){const r=tr*(x-tx)/tl+1;const n=Math.max(4,Math.ceil(2*Math.PI*r/step));for(let k=0;k<n;k++){const th=2*Math.PI*k/n;pts.push(x,r*Math.sin(th),r*Math.cos(th));}}
  }
  S.cloudSpacing=sp.spacing;
  S.cloudF=buildPointGrid(pts,Math.max(sp.spacing*3,1.2));
  S.cloudC=buildPointGrid(pts,Math.max(6,M.diag/18));
  S.cloudN=pts.length/3|0;
  setBusy('Listo',0.4);
  buildPartScene();updateMeshInfo();
}
function updateMeshInfo(){
  const M=S.M;if(!M){$('#meshInfo').innerHTML='';return;}
  const sz=[0,1,2].map(c=>M.bmax[c]-M.bmin[c]);
  const rows=[['Archivo',S.partName],['Triángulos',M.nT.toLocaleString('es-MX')],['Tamaño X×Y×Z',`${nf(sz[0])} × ${nf(sz[1])} × ${nf(sz[2])} mm`],['Volumen',M.closed?`${nf(M.vol/1000,1)} cm³`:'— (malla abierta)'],
    ['Malla cerrada',M.closed?'Sí':`No · ${M.open} bordes abiertos`],['Puntos de colisión',S.cloudN.toLocaleString('es-MX')],
    ['Bruto',S.stock.type==='box'?`${nf(S.stock.max[0]-S.stock.min[0])} × ${nf(S.stock.max[1]-S.stock.min[1])} × ${nf(S.stock.max[2]-S.stock.min[2])} mm`:`Ø${nf(S.stock.r*2)} × ${nf(S.stock.x1-S.stock.x0)} mm`]];
  $('#meshInfo').innerHTML=rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
}

/* =========================================================
   ESTRATEGIAS
   ========================================================= */
function checker(tl,st){
  const G=S.cloudF,Gc=S.cloudC;const {R:Re,r:re}=cutterRadii(tl);
  const tol=Math.max(0.03,Re*0.012);const fl=tl.fluteLen,so=Math.max(tl.stickout,fl),shR=tl.shankD/2,hR=tl.holderD/2,hL=tl.holderLen,clr=st.clear;
  const slices=[];const hStart=(tl.type==='ball'||tl.type==='taperball')?re:(tl.type==='bull'?re:0);
  const nS=5;for(let s=0;s<nS;s++){const h0=hStart+tol+(fl-hStart-tol)*s/nS,h1=hStart+tol+(fl-hStart-tol)*(s+1)/nS;const r=toolRadiusAt(tl,h0)-tol;if(r>0.05&&h1>h0)slices.push([h0,h1,r]);}
  return function(T,a,vertical){
    if(!vertical){
      if((tl.type==='ball'||tl.type==='taperball')&&sphereHit(G,T[0]+a[0]*re,T[1]+a[1]*re,T[2]+a[2]*re,re-tol))return 'cutter';
      for(const s of slices)if(cylHit(G,T,a,s[0],s[1],s[2]))return 'flute';
    }
    if(so>fl+0.01&&cylHit(G,T,a,fl+0.01,so,shR+clr*0.5))return 'shank';
    if(cylHit(Gc,T,a,so,so+hL,hR+clr))return 'holder';
    return 0;
  };
}
async function progressYield(state,frac,label){if(now()-state.t>40){state.t=now();setBusy(label,frac);await tick();}}

// ---- 3 ejes: mapa de alturas + dilatación con el perfil de la herramienta
async function genTop3(tl,st){
  const M=S.M,stock=S.stock,R=tl.D/2;const x0=stock.min[0],x1=stock.max[0],y0=stock.min[1],y1=stock.max[1];
  let res=clamp(Math.min(st.step,st.stepover/2,tl.D/8),0.08,3);
  let nx,ny,kr;
  for(let it=0;it<60;it++){nx=Math.ceil((x1-x0+2*R)/res)+1;ny=Math.ceil((y1-y0+2*R)/res)+1;kr=Math.ceil(R/res);if(nx*ny<=420000&&nx*ny*Math.PI*kr*kr<=6e7)break;res*=1.12;}
  const gx0=x0-R,gy0=y0-R;const H=new Float32Array(nx*ny);const zTop=M.bmax[2]+5,floor=stock.min[2];
  const ps={t:now()};
  for(let j=0;j<ny;j++){const y=gy0+j*res;for(let i=0;i<nx;i++){const x=gx0+i*res;H[j*nx+i]=raycast(M,x,y,zTop,0,0,-1,1e6)?zTop-HIT.t:floor;}
    await progressYield(ps,0.05+0.35*j/ny,'Leyendo la superficie…');}
  const ker=[];for(let dj=-kr;dj<=kr;dj++)for(let di=-kr;di<=kr;di++){const d=Math.hypot(di,dj)*res;if(d<=R+1e-9)ker.push(di,dj,toolH(tl,d));}
  const T=new Float32Array(nx*ny);let unreached=0,cells=0;
  for(let j=0;j<ny;j++){for(let i=0;i<nx;i++){let best=-1e9;for(let k=0;k<ker.length;k+=3){const ii=i+ker[k],jj=j+ker[k+1];if(ii<0||jj<0||ii>=nx||jj>=ny)continue;const v=H[jj*nx+ii]-ker[k+2];if(v>best)best=v;}
      const v=Math.max(best+st.allow,floor);T[j*nx+i]=v;const hx=H[j*nx+i];if(hx>floor+0.01){cells++;if(v-hx-st.allow>0.05)unreached++;}}
    await progressYield(ps,0.4+0.4*j/ny,'Calculando contacto de la herramienta…');}
  const Tat=(x,y)=>{const fx=clamp((x-gx0)/res,0,nx-1.001),fy=clamp((y-gy0)/res,0,ny-1.001);const i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
    return T[j*nx+i]*(1-u)*(1-v)+T[j*nx+i+1]*u*(1-v)+T[(j+1)*nx+i]*(1-u)*v+T[(j+1)*nx+i+1]*u*v;};
  const chk=checker(tl,st);const passes=[];const alongX=st.dir==='x';
  const lineSet=(so,zfn,rough)=>{
    const [a0,a1,b0,b1]=alongX?[x0,x1,y0,y1]:[y0,y1,x0,x1];const nL=Math.max(1,Math.ceil((b1-b0)/so));let rev=false;
    for(let l=0;l<=nL;l++){const b=Math.min(b0+l*so,b1);const pts=[];const n=Math.max(2,Math.ceil((a1-a0)/res));
      for(let k=0;k<=n;k++){const a=a0+(a1-a0)*k/n;const x=alongX?a:b,y=alongX?b:a;const z=zfn(x,y);if(z===null){if(pts.length>1)passes.push({pts:pts.splice(0),rough});else pts.length=0;continue;}pts.push({p:[x,y,z],a:[0,0,1],st:0});}
      if(pts.length>1){if(rev)pts.reverse();passes.push({pts,rough});}rev=!rev;}
  };
  let minTall=Infinity;for(let i=0;i<T.length;i++)if(T[i]<minTall)minTall=T[i];
  if(st.rough){const minT=minTall;const dA=st.rallow-st.allow;let prev=stock.max[2];
    for(let L=stock.max[2]-st.rsd;L>minT+dA-st.rsd;L-=st.rsd){const lv=Math.max(L,minT+dA);const pv=prev;lineSet(st.rso,(x,y)=>{const z=Math.max(lv,Tat(x,y)+dA);return z<pv-0.01?z:null;},true);prev=lv;if(lv<=minT+dA)break;}}
  lineSet(st.stepover,(x,y)=>Tat(x,y),false);
  // verificación de zanco y porta (herramienta vertical)
  let n=0;const tot=passes.reduce((s,p)=>s+p.pts.length,0);
  for(const ps2 of passes){for(let i=0;i<ps2.pts.length;i+=3){const pt=ps2.pts[i];const c=chk(pt.p,pt.a,true);if(c){for(let k=Math.max(0,i-2);k<=Math.min(ps2.pts.length-1,i+2);k++)ps2.pts[k].st=2;}}
    n+=ps2.pts.length;await progressYield(ps,0.8+0.2*n/tot,'Verificando zanco y portaherramienta…');}
  passes.forEach(p=>p.pts=simplify(p.pts));
  const dAl=st.rallow-st.allow;
  const linkOK=(A,B,rough)=>{for(let s=1;s<12;s++){const u=s/12;const x=A[0]+(B[0]-A[0])*u,y=A[1]+(B[1]-A[1])*u,z=A[2]+(B[2]-A[2])*u;if(z<Tat(x,y)+(rough?dAl:0)-0.01)return false;}return true;};
  return {passes,linkOK,unreachedPct:cells?unreached/cells*100:0,maxDepth:stock.max[2]-minTall};
}
// ---- 4 ejes: mapa radial + dilatación en coordenadas cilíndricas
async function genRot4(tl,st){
  const M=S.M,stock=S.stock,R=tl.D/2;const px0=M.bmin[0],px1=M.bmax[0];
  let resx=clamp(Math.min(st.step,st.stepover/2,tl.D/8),0.1,3);const Rf=stock.r+5;
  let nx,nt,dT,krx,w,rminG;
  const build=async()=>{
    nx=Math.ceil((px1-px0+2*R)/resx)+1;nt=clamp(Math.round(2*Math.PI*stock.r/resx),120,1080);dT=2*Math.PI/nt;
  };
  await build();
  for(let it=0;it<30&&nx*nt>500000;it++){resx*=1.15;await build();}
  const gx0=px0-R;const Rm=new Float32Array(nx*nt);const ps={t:now()};rminG=Infinity;
  for(let ix=0;ix<nx;ix++){const x=gx0+ix*resx;for(let it=0;it<nt;it++){const th=it*dT,s=Math.sin(th),c=Math.cos(th);
      const r=raycast(M,x,Rf*s,Rf*c,0,-s,-c,Rf)?Rf-HIT.t:0;Rm[ix*nt+it]=r;if(r>0&&r<rminG)rminG=r;}
    await progressYield(ps,0.05+0.35*ix/nx,'Leyendo la superficie en giro…');}
  if(!Number.isFinite(rminG))rminG=R;
  let rmin=Math.max(rminG,R);w=Math.ceil(Math.asin(Math.min(1,R/rmin))/dT);krx=Math.ceil(R/resx);
  while(nx*nt*(2*krx+1)*(2*w+1)>9e7&&w>2){w=Math.floor(w*0.8);}
  const sinT=new Float32Array(2*w+1),cosT=new Float32Array(2*w+1);for(let d=-w;d<=w;d++){sinT[d+w]=Math.sin(d*dT);cosT[d+w]=Math.cos(d*dT);}
  const hT=new Float32Array(64);for(let q=0;q<64;q++)hT[q]=toolH(tl,R*q/63);
  const hOf=d=>{const f=d/R*63;const q=Math.floor(f);if(q>=63)return hT[63];return hT[q]+(hT[q+1]-hT[q])*(f-q);};
  const Tm=new Float32Array(nx*nt);let unreached=0,cells=0;
  for(let ix=0;ix<nx;ix++){for(let it=0;it<nt;it++){let best=0;
      for(let dx=-krx;dx<=krx;dx++){const jx=ix+dx;if(jx<0||jx>=nx)continue;const dxm=dx*resx;if(Math.abs(dxm)>R)continue;const row=jx*nt;
        for(let dt=-w;dt<=w;dt++){let jt=it+dt;if(jt<0)jt+=nt;else if(jt>=nt)jt-=nt;const r=Rm[row+jt];if(r<=0)continue;const y=r*sinT[dt+w];if(y>R||y<-R)continue;const d=Math.hypot(dxm,y);if(d>R)continue;const v=r*cosT[dt+w]-hOf(d);if(v>best)best=v;}}
      const v=best+st.allow;Tm[ix*nt+it]=v;const r0=Rm[ix*nt+it];if(r0>0){cells++;if(v-r0-st.allow>0.05)unreached++;}}
    await progressYield(ps,0.4+0.4*ix/nx,'Calculando contacto en 4 ejes…');}
  const Tat=(x,th)=>{let fx=clamp((x-gx0)/resx,0,nx-1.001);th=((th%(2*Math.PI))+2*Math.PI)%(2*Math.PI);const ft=th/dT;const i=Math.floor(fx),j=Math.floor(ft)%nt,j2=(j+1)%nt,u=fx-i,v=ft-Math.floor(ft);
    return Tm[i*nt+j]*(1-u)*(1-v)+Tm[i*nt+j2]*(1-u)*v+Tm[(i+1)*nt+j]*u*(1-v)+Tm[(i+1)*nt+j2]*u*v;};
  const pt=(x,th,r)=>{const s=Math.sin(th),c=Math.cos(th);return{p:[x,r*s,r*c],a:[0,s,c],st:0};};
  const passes=[];const rT=Math.max(stock.rPart,1);
  const spiral=(so,step,rfn,rough)=>{const turns=(px1-px0)/so;const dth=step/rT;const n=Math.min(400000,Math.ceil(turns*2*Math.PI/dth));const pts=[];
    for(let k=0;k<=n;k++){const th=k*dth;const x=px0+th/(2*Math.PI)*so;if(x>px1)break;pts.push(pt(x,th,rfn(x,th)));}passes.push({pts,rough});};
  const lines=(so,rfn,rough)=>{const nL=Math.max(8,Math.round(2*Math.PI*rT/so));let rev=false;const n=Math.ceil((px1-px0)/resx);
    for(let l=0;l<nL;l++){const th=2*Math.PI*l/nL;const pts=[];for(let k=0;k<=n;k++){const x=px0+(px1-px0)*k/n;pts.push(pt(x,th,rfn(x,th)));}if(rev)pts.reverse();rev=!rev;passes.push({pts,rough});}};
  if(st.rough){let minT=Infinity;for(let i=0;i<Tm.length;i+=5)if(Tm[i]<minT)minT=Tm[i];const dA=st.rallow-st.allow;
    for(let L=stock.r-st.rsd;;L-=st.rsd){const lv=Math.max(L,minT+dA);spiral(st.rso,Math.max(resx*3,1.2),(x,th)=>Math.max(lv,Tat(x,th)+dA),true);if(lv<=minT+dA)break;}}
  if(st.pattern==='lines')lines(st.stepover,Tat,false);else spiral(st.stepover,Math.max(resx,0.2),Tat,false);
  const chk=checker(tl,st);let n=0;const tot=passes.reduce((s,p)=>s+p.pts.length,0);
  for(const p2 of passes){for(let i=0;i<p2.pts.length;i+=3){const q=p2.pts[i];if(chk(q.p,q.a,true)){for(let k=Math.max(0,i-2);k<=Math.min(p2.pts.length-1,i+2);k++)p2.pts[k].st=2;}}
    n+=p2.pts.length;await progressYield(ps,0.8+0.2*n/tot,'Verificando zanco, porta y sujeción…');}
  passes.forEach(p=>p.pts=simplify(p.pts));
  let minT=Infinity;for(let i=0;i<Tm.length;i+=3)if(Tm[i]<minT)minT=Tm[i];
  return {passes,unreachedPct:cells?unreached/cells*100:0,maxDepth:stock.r-minT};
}
// ---- 5 ejes simultáneos: normal a superficie + búsqueda anticolisión
function axisFromNormal(n,f,lead,tilt){
  let fp=V.sub(f,V.mul(n,V.dot(f,n)));if(V.len(fp)<1e-6)fp=perpOf(n);fp=V.norm(fp);const side=V.cross(n,fp);
  return V.norm(V.add(V.add(V.mul(n,Math.cos(lead)*Math.cos(tilt)),V.mul(fp,Math.sin(lead))),V.mul(side,Math.sin(tilt))));
}
function clampCone(a,ref,maxA){const w=angBetween(a,ref);if(w<=maxA)return a;return slerpDir(ref,a,maxA/w);}
const DEVS=[5,10,15,20,26,32,40,50].map(d=>d*DEG),AZS=[0,45,-45,90,-90,135,-135,180].map(d=>d*DEG);
async function gen5(tl,st){
  const M=S.M,stock=S.stock,m=S.machine;const chk=checker(tl,st);const lead=st.lead*DEG,tilt=st.tilt*DEG,maxT=st.maxTilt*DEG;
  const minDotN=(tl.type==='flat'||tl.type==='bull')?0.5:0.08;const stats={adjusted:0,coll:0,lim:0,devSum:0,why:{}};
  const passes=[];const ps={t:now()};
  const evalPoint=(P,n,f,ref,prevAng)=>{
    const a0=clampCone(axisFromNormal(n,f,lead,tilt),ref,maxT);
    const tryA=(a)=>{if(V.dot(a,n)<minDotN)return 4;const k=kinSolve(m,a,prevAng);if(!k)return 3;const T=tipFromContact(V.madd(P,n,st.allow),n,a,tl);const c=chk(T,a,false);return c?c:{T,k};};
    let r=tryA(a0);if(typeof r==='object')return{a:a0,T:r.T,ang:r.k.ang,st:0};
    const fail=r;
    if(st.avoid){let e1=V.sub(ref,V.mul(a0,V.dot(ref,a0)));if(V.len(e1)<1e-3)e1=perpOf(a0);e1=V.norm(e1);const e2=V.cross(a0,e1);
      for(const dv of DEVS){const cd=Math.cos(dv),sd=Math.sin(dv);for(const az of AZS){const dir=V.add(V.mul(e1,Math.cos(az)),V.mul(e2,Math.sin(az)));const a=V.norm(V.add(V.mul(a0,cd),V.mul(dir,sd)));
          if(angBetween(a,ref)>maxT+1e-3)continue;r=tryA(a);if(typeof r==='object'){stats.devSum+=dv*RAD;return{a,T:r.T,ang:r.k.ang,st:1};}}}}
    if(typeof fail==='string')stats.why[fail]=(stats.why[fail]||0)+1;
    return{a:a0,T:tipFromContact(V.madd(P,n,st.allow),n,a0,tl),ang:prevAng,st:fail===3||fail===4?3:2,why:fail};
  };
  const runPass=(samples,rough,state)=>{ // samples: [{o,d,f,ref}]; state permite continuar una espiral entre bloques
    const S0=state||{pts:[],prevAng:null};
    for(const s of samples){
      if(!raycast(M,s.o[0],s.o[1],s.o[2],s.d[0],s.d[1],s.d[2],1e6)){if(S0.pts.length>1)passes.push({pts:S0.pts,rough});S0.pts=[];continue;}
      const P=V.madd(s.o,s.d,HIT.t);const n=hitNormal(M,s.d[0],s.d[1],s.d[2]);
      const r=evalPoint(P,n,s.f,s.ref,S0.prevAng);if(r.st!==3&&r.ang)S0.prevAng=r.ang;
      S0.pts.push({p:r.T,a:r.a,st:r.st,P,n,ref:s.ref,why:r.why});
    }
    if(!state&&S0.pts.length>1)passes.push({pts:S0.pts,rough});
  };
  if(S.frame==='top'){
    const zTop=M.bmax[2]+5;const alongX=st.dir==='x';const x0=stock.min[0],x1=stock.max[0],y0=stock.min[1],y1=stock.max[1];
    const [a0,a1,b0,b1]=alongX?[x0,x1,y0,y1]:[y0,y1,x0,x1];const nL=Math.ceil((b1-b0)/st.stepover);let rev=false;
    for(let l=0;l<=nL;l++){const b=Math.min(b0+l*st.stepover,b1);const n=Math.ceil((a1-a0)/st.step);const sm=[];
      for(let k=0;k<=n;k++){const a=a0+(a1-a0)*(rev?n-k:k)/n;const x=alongX?a:b,y=alongX?b:a;const f=alongX?[1,0,0]:[0,1,0];sm.push({o:[x,y,zTop],d:[0,0,-1],f,ref:[0,0,1]});}
      runPass(sm,false);rev=!rev;await progressYield(ps,0.05+0.8*l/nL,'5 ejes: orientando la herramienta y evitando colisiones…');}
  }else{
    const eR=cutterRadii(tl).R*0.9;const Rf=stock.r+5,px0=M.bmin[0]+eR,px1=M.bmax[0]-eR;const rT=Math.max(stock.rPart,1);
    if(st.pattern==='lines'){const nL=Math.max(8,Math.round(2*Math.PI*rT/st.stepover));let rev=false;const n=Math.ceil((px1-px0)/st.step);
      for(let l=0;l<nL;l++){const th=2*Math.PI*l/nL,s=Math.sin(th),c=Math.cos(th);const sm=[];
        for(let k=0;k<=n;k++){const x=px0+(px1-px0)*(rev?n-k:k)/n;sm.push({o:[x,Rf*s,Rf*c],d:[0,-s,-c],f:[rev?-1:1,0,0],ref:[0,s,c]});}
        runPass(sm,false);rev=!rev;await progressYield(ps,0.05+0.8*l/nL,'5 ejes: orientando la herramienta y evitando colisiones…');}
    }else{
      const dth=st.step/rT;const turns=(px1-px0)/st.stepover;const n=Math.ceil(turns*2*Math.PI/dth);const chunk=Math.ceil(2*Math.PI/dth);let sm=[];const spS={pts:[],prevAng:null};
      for(let k=0;k<=n;k++){const th=k*dth,x=px0+th/(2*Math.PI)*st.stepover;if(x>px1)break;const s=Math.sin(th),c=Math.cos(th);
        sm.push({o:[x,Rf*s,Rf*c],d:[0,-s,-c],f:V.norm([st.stepover/(2*Math.PI*rT),c,-s]),ref:[0,s,c]});
        if(sm.length>=chunk){runPass(sm,false,spS);sm=[];await progressYield(ps,0.05+0.8*k/n,'5 ejes: orientando la herramienta y evitando colisiones…');}}
      if(sm.length)runPass(sm,false,spS);
      if(spS.pts.length>1)passes.push({pts:spS.pts,rough:false});
    }
  }
  // suavizado del eje de herramienta
  if(st.smooth){let k=0;for(const p of passes){const pts=p.pts,N=pts.length;const W=[1,2,3,2,1];const newA=new Array(N);
      for(let i=0;i<N;i++){if(pts[i].st>=2){newA[i]=null;continue;}let s=[0,0,0];for(let q=-2;q<=2;q++){const j=i+q;if(j<0||j>=N||pts[j].st>=2)continue;s=V.madd(s,pts[j].a,W[q+2]);}newA[i]=V.norm(s);}
      let prevAng=null;
      for(let i=0;i<N;i++){const q=pts[i];if(!newA[i]||angBetween(newA[i],q.a)<0.2*DEG){if(q.st<2){const kk=kinSolve(m,q.a,prevAng);if(kk)prevAng=kk.ang;}continue;}
        const a=newA[i];if(angBetween(a,q.ref)>maxT+1e-3||V.dot(a,q.n)<minDotN)continue;const kk=kinSolve(m,a,prevAng);if(!kk)continue;const T=tipFromContact(V.madd(q.P,q.n,st.allow),q.n,a,tl);if(chk(T,a,false))continue;q.a=a;q.p=T;prevAng=kk.ang;}
      if(++k%20===0)await progressYield(ps,0.86+0.1*k/passes.length,'Suavizando orientación…');}}
  // limitador de velocidad angular del eje de herramienta (evita giros bruscos en aristas)
  const maxStep=12*DEG;
  const limitPass=(pts,dir)=>{const N=pts.length;let prevAng=null;
    for(let c=0;c<N;c++){const i=dir>0?c:N-1-c,j=i-dir;if(j<0||j>=N)continue;const q=pts[i],pv=pts[j];if(q.st>=2||pv.st>=2)continue;
      const w=angBetween(pv.a,q.a);if(w<=maxStep)continue;const a=slerpDir(pv.a,q.a,maxStep/w);
      if(V.dot(a,q.n)<minDotN||angBetween(a,q.ref)>maxT+1e-3)continue;const kk=kinSolve(m,a,prevAng);if(!kk)continue;
      const T=tipFromContact(V.madd(q.P,q.n,st.allow),q.n,a,tl);if(chk(T,a,false))continue;q.a=a;q.p=T;prevAng=kk.ang;}};
  for(const p of passes){limitPass(p.pts,1);limitPass(p.pts,-1);}
  // giro sobre el centro de la bola en aristas vivas: la herramienta rota sin mover el punto de contacto
  const reB=(tl.type==='ball'||tl.type==='taperball')?cutterRadii(tl).r:0;
  if(reB>0)for(const p of passes){const src=p.pts,out=[src[0]];
    for(let i=1;i<src.length;i++){const A=src[i-1],B=src[i];const w=angBetween(A.a,B.a);
      if(w>maxStep&&A.st<2&&B.st<2&&A.P&&B.P){const n=Math.ceil(w/maxStep);
        for(let k=1;k<n;k++){const u=k/n;const a=slerpDir(A.a,B.a,u);const nk=slerpDir(A.n,B.n,u);const C=V.madd(V.lerp(A.P,B.P,u),nk,reB+st.allow);const T=V.madd(C,a,-reB);
          if(V.dot(a,nk)<minDotN||chk(T,a,false))continue;out.push({p:T,a,st:(A.st||B.st)?1:0});}}
      out.push(B);}
    p.pts=out;}
  for(const p of passes)for(const q of p.pts){if(q.st===1)stats.adjusted++;else if(q.st===2)stats.coll++;else if(q.st===3)stats.lim++;delete q.P;delete q.n;delete q.ref;}
  return {passes,stats5:stats,unreachedPct:0,maxDepth:0};
}
function simplify(pts,tol=0.004){
  if(pts.length<3)return pts;const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){const A=out[out.length-1],B=pts[i],C=pts[i+1];
    if(B.st!==A.st||B.st!==C.st||angBetween(A.a,C.a)>0.05*DEG){out.push(B);continue;}
    const ac=V.sub(C.p,A.p),ab=V.sub(B.p,A.p);const L=V.len(ac);if(L<1e-9){continue;}const cr=V.len(V.cross(ab,ac))/L;
    if(cr>tol||L>40)out.push(B);}
  out.push(pts[pts.length-1]);return out;
}

/* =========================================================
   ENLACES Y DATOS DE MÁQUINA
   ========================================================= */
function buildMoves(res,st){
  const moves=[];const frame=S.frame,stock=S.stock;const push=(p,a,t,s=0,rough=false)=>moves.push({p,a,t,st:s,rough});
  const safeTop=stock.type==='box'?stock.max[2]+st.safe:0;const safeR=stock.type==='cyl'?Math.max(stock.r+st.safe,(S.fixtures[0]?.r||0)+4):0;
  const clr=Math.max(1,Math.min(st.safe,4));
  // separar tramos en colisión si se pide omitir
  let passes=[];for(const p of res.passes){if(!st.skip){passes.push(p);continue;}let cur=[];for(const q of p.pts){if(q.st>=2){if(cur.length>1)passes.push({pts:cur,rough:p.rough});cur=[];}else cur.push(q);}if(cur.length>1)passes.push({pts:cur,rough:p.rough});}
  const toSafe=(p,a)=>{ // punto de retracción seguro
    if(frame==='top'){const l=V.madd(p,a,clr);return[l,[l[0],l[1],Math.max(safeTop,l[2])]];}
    const l=V.madd(p,a,clr);const r=Math.hypot(l[1],l[2])||1;const th=Math.atan2(l[1],l[2]);return[l,[l[0],safeR*Math.sin(th),safeR*Math.cos(th)]];
  };
  const travel=(A,aA,B,aB)=>{ // movimiento en zona segura interpolando orientación
    if(frame==='top'){const ang=angBetween(aA,aB);const n=Math.max(1,Math.ceil(ang/(8*DEG)));for(let i=1;i<=n;i++)push(V.lerp(A,B,i/n),slerpDir(aA,aB,i/n),'R');return;}
    let t0=Math.atan2(A[1],A[2]),t1=Math.atan2(B[1],B[2]);let dt=t1-t0;while(dt>Math.PI)dt-=2*Math.PI;while(dt<-Math.PI)dt+=2*Math.PI;
    const n=Math.max(1,Math.ceil(Math.abs(dt)/(10*DEG)),Math.ceil(angBetween(aA,aB)/(8*DEG)));
    for(let i=1;i<=n;i++){const u=i/n,th=t0+dt*u,x=A[0]+(B[0]-A[0])*u;push([x,safeR*Math.sin(th),safeR*Math.cos(th)],slerpDir(aA,aB,u),'R');}
  };
  const f0=passes[0]?.pts[0];if(!f0)return moves;
  const [,s0]=toSafe(f0.p,f0.a);
  const home=frame==='top'?[s0[0],s0[1],safeTop]:s0;push(home,f0.a,'R');
  let last=null;
  for(let pi=0;pi<passes.length;pi++){
    const pts=passes[pi].pts,rough=passes[pi].rough;const first=pts[0];
    const direct=last&&res.linkOK&&V.dist(last.p,first.p)<=(rough?st.rso:st.stepover)*1.6&&res.linkOK(last.p,first.p,rough);
    if(direct){push(first.p,first.a,'F',first.st,rough);}
    else{
      if(last){const [l1,l2]=toSafe(last.p,last.a);push(l1,last.a,'P',0,rough);push(l2,last.a,'R');const [a1,a2]=toSafe(first.p,first.a);travel(l2,last.a,a2,first.a);push(a1,first.a,'R');}
      else{const [a1,a2]=toSafe(first.p,first.a);travel(home,f0.a,a2,first.a);push(a1,first.a,'R');}
      push(first.p,first.a,'P',first.st,rough);
    }
    for(let i=1;i<pts.length;i++)push(pts[i].p,pts[i].a,'F',pts[i].st,rough);
    last=pts[pts.length-1];
  }
  const [l1,l2]=toSafe(last.p,last.a);push(l1,last.a,'P');push(l2,last.a,'R');
  return moves;
}
function annotateMoves(moves){
  const m=S.machine,tl=tool(),fd=feedsCalc();let prev=null,jumps=0,cum=0,lenCut=0,limFail=0;const tcp=useTCP();
  const rot=KIN_AXES[m.kin].length;const rng=[[Infinity,-Infinity],[Infinity,-Infinity]];const lin=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];
  for(let i=0;i<moves.length;i++){
    const mv=moves[i];let k=kinSolve(m,mv.a,prev);
    if(!k){k={ang:prev?prev.slice():new Array(rot).fill(0),...kinMats(m.kin,prev||new Array(rot).fill(0))};mv.kfail=true;if(mv.t!=='R')limFail++;}
    mv.ang=k.ang;mv.R=k.R;mv.ha=k.ha;
    if(prev&&mv.t==='F'&&rot){for(let q=0;q<rot;q++)if(Math.abs(mv.ang[q]-prev[q])>30){jumps++;mv.jump=true;break;}}
    prev=k.ang;
    for(let q=0;q<rot;q++){rng[q][0]=Math.min(rng[q][0],mv.ang[q]);rng[q][1]=Math.max(rng[q][1],mv.ang[q]);}
    mv.pm=linearOut(mv,m,tl,tcp);for(let c=0;c<3;c++){lin[c][0]=Math.min(lin[c][0],mv.pm[c]);lin[c][1]=Math.max(lin[c][1],mv.pm[c]);}
    let dur=0;if(i>0){const pv=moves[i-1];const d=V.dist(pv.p,mv.p);mv.len=d;
      const dAng=rot?Math.max(...mv.ang.map((v,q)=>Math.abs(v-pv.ang[q]))):0;
      if(mv.t==='R')dur=Math.max(V.dist(pv.pm,mv.pm)/m.rapid,dAng/5400);
      else{const f=mv.t==='P'?fd.plunge:fd.feed;dur=Math.max(d/f,dAng/5400);if(mv.t==='F')lenCut+=d;}}
    else mv.len=0;
    cum+=dur;mv.cum=cum;
  }
  return {jumps,total:cum,lenCut,limFail,rng,lin,rot};
}
