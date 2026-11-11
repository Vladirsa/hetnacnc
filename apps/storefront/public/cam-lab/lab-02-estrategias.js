'use strict';
/* =========================================================
   PREPARACIÓN DE PIEZA, BRUTO Y SUJECIÓN
   ========================================================= */
const frameOf=k=>(k==='rot4'||k==='rot5'||k==='idx4')?'rot':'top';
const esCincoEjes=k=>k==='top5'||k==='rot5'||k==='pos5';
function orientedPositions(){
  const src=S.rawPos;const out=new Float32Array(src.length);const sc=S.units*S.scale;
  for(let i=0;i<src.length;i+=3){let x=src[i]*sc,y=src[i+1]*sc,z=src[i+2]*sc;
    for(const r of S.rotSeq){if(r==='x'){const t=y;y=-z;z=t;}else if(r==='y'){const t=z;z=-x;x=t;}else{const t=x;x=-y;y=t;}}
    out[i]=x*S.scl[0];out[i+1]=y*S.scl[1];out[i+2]=z*S.scl[2];}
  return out;
}
async function preparePart(){
  if(!S.rawPos)return;
  setBusy('Analizando la malla…',0.05);await tick();
  const frame=frameOf(S.strat.kind);
  let pos=orientedPositions();
  let bmin=[Infinity,Infinity,Infinity],bmax=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.length;i+=3)for(let c=0;c<3;c++){const v=pos[i+c];if(v<bmin[c])bmin[c]=v;if(v>bmax[c])bmax[c]=v;}
  const mg=+$('#stk_margin').value||0,tm=+$('#stk_top').value||0;
  const k=S.stk,man=k.mode==='manual',sup=S.sup;S.stockWarn=null;
  let off;
  if(frame==='top')off=[-(bmin[0]+bmax[0])/2+k.ox,-(bmin[1]+bmax[1])/2+k.oy,-bmax[2]-tm];
  else{ // eje de giro por el centroide de superficie (queda dentro de la pieza en piezas torcidas)
    let cy=0,cz=0,aw=0;for(let i=0;i<pos.length;i+=9){const ux=pos[i+3]-pos[i],uy=pos[i+4]-pos[i+1],uz=pos[i+5]-pos[i+2],wx=pos[i+6]-pos[i],wy=pos[i+7]-pos[i+1],wz=pos[i+8]-pos[i+2];
      const ar=Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx);cy+=ar*(pos[i+1]+pos[i+4]+pos[i+7])/3;cz+=ar*(pos[i+2]+pos[i+5]+pos[i+8])/3;aw+=ar;}
    off=[-(bmin[0]+bmax[0])/2+k.ox,-(aw?cy/aw:(bmin[1]+bmax[1])/2)+k.oy,-(aw?cz/aw:(bmin[2]+bmax[2])/2)+k.oz];}
  for(let i=0;i<pos.length;i+=3){pos[i]+=off[0];pos[i+1]+=off[1];pos[i+2]+=off[2];}
  const pb0=bmin.map((v,c)=>v+off[c]),pb1=bmax.map((v,c)=>v+off[c]); // caja de la pieza ya colocada
  let rPart=0;if(frame==='rot')for(let i=0;i<pos.length;i+=3){const r=Math.hypot(pos[i+1],pos[i+2]);if(r>rPart)rPart=r;}
  // bruto
  let stock;
  if(frame==='top'){
    const hx=man&&k.sx>0?k.sx/2:null,hy=man&&k.sy>0?k.sy/2:null;
    stock={type:'box',min:[hx?-hx:pb0[0]-mg,hy?-hy:pb0[1]-mg,Math.min(pb0[2],man&&k.sz>0?-k.sz:pb0[2])],max:[hx?hx:pb1[0]+mg,hy?hy:pb1[1]+mg,0]};
    if(pb0[0]<stock.min[0]-0.01||pb1[0]>stock.max[0]+0.01||pb0[1]<stock.min[1]-0.01||pb1[1]>stock.max[1]+0.01||(man&&k.sz>0&&pb1[2]-pb0[2]+tm>k.sz+0.01))S.stockWarn='La pieza no cabe en el material: revisa las medidas del bloque o mueve la pieza.';
  }else{
    const need=rPart+tm+0.5;let r=man&&k.sd>0?k.sd/2:need;const sq=k.bar==='square';
    if(r<rPart-0.01)S.stockWarn=`La pieza no cabe en la barra: necesita al menos ${sq?'un lado':'un diámetro'} de ${nf(rPart*2,1)} mm sobre el eje de giro elegido.`;
    stock={type:'cyl',r:sq?r*Math.SQRT2:r,sq:sq?r:0,rPart};
  }
  // soportes: se suman a la pieza para que la trayectoria los respete
  const extra=[];
  if(frame==='rot'){
    if(sup.l.on&&sup.l.len>0&&sup.l.d>0)extra.push(cylTris(pb0[0]-sup.l.len,pb0[0]+0.5,sup.l.d/2));
    if(sup.r.on&&sup.r.len>0&&sup.r.d>0)extra.push(cylTris(pb1[0]-0.5,pb1[0]+sup.r.len,sup.r.d/2));
  }else if(sup.tabs.on&&sup.tabs.w>0&&sup.tabs.t>0){
    const w=sup.tabs.w/2,z0=pb0[2],z1=Math.min(pb0[2]+sup.tabs.t,pb1[2]),cx=(pb0[0]+pb1[0])/2,cy=(pb0[1]+pb1[1])/2;
    if(pb0[0]-stock.min[0]>0.5)extra.push(boxTris([stock.min[0],cy-w,z0],[pb0[0]+0.5,cy+w,z1]));
    if(stock.max[0]-pb1[0]>0.5)extra.push(boxTris([pb1[0]-0.5,cy-w,z0],[stock.max[0],cy+w,z1]));
    if(pb0[1]-stock.min[1]>0.5)extra.push(boxTris([cx-w,stock.min[1],z0],[cx+w,pb0[1]+0.5,z1]));
    if(stock.max[1]-pb1[1]>0.5)extra.push(boxTris([cx-w,pb1[1]-0.5,z0],[cx+w,stock.max[1],z1]));
  }
  S.supportN=extra.length;
  let all=pos;if(extra.length){const n=extra.reduce((a,e)=>a+e.length,pos.length);all=new Float32Array(n);all.set(pos);let o=pos.length;for(const e of extra){all.set(e,o);o+=e.length;}}
  const M=buildMesh(all);S.M=M;S.frame=frame;
  if(frame==='rot'){const hl=man&&k.sl>0?k.sl/2:null;stock.x0=hl?-hl:M.bmin[0]-mg;stock.x1=hl?hl:M.bmax[0]+mg;
    if(M.bmin[0]<stock.x0-0.01||M.bmax[0]>stock.x1+0.01)S.stockWarn='La pieza (con sus soportes) es más larga que el material.';}
  S.stock=stock;
  setBusy('Preparando detección de colisiones…',0.3);await tick();
  // nube de puntos de colisión: pieza + sujeción
  const sp=surfacePoints(M);const pts=sp.pts;S.fixtures=[];pos=all;
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
    ['Bruto',S.stock.type==='box'?`${nf(S.stock.max[0]-S.stock.min[0])} × ${nf(S.stock.max[1]-S.stock.min[1])} × ${nf(S.stock.max[2]-S.stock.min[2])} mm`:S.stock.sq?`Barra cuadrada ${nf(S.stock.sq*2)} × ${nf(S.stock.x1-S.stock.x0)} mm`:`Ø${nf(S.stock.r*2)} × ${nf(S.stock.x1-S.stock.x0)} mm`]];
  if(S.supportN)rows.push(['Soportes',`${S.supportN} agregados a la pieza`]);
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

// ---- patrones en planta (XY) recortados a un rectángulo [x0,x1,y0,y1]
function clipSeg(c,d,rc){let t0=-1e9,t1=1e9;
  for(let k=0;k<2;k++){const lo=rc[k*2],hi=rc[k*2+1];if(Math.abs(d[k])<1e-12){if(c[k]<lo-1e-9||c[k]>hi+1e-9)return null;}
    else{let a=(lo-c[k])/d[k],b=(hi-c[k])/d[k];if(a>b){const s=a;a=b;b=s;}if(a>t0)t0=a;if(b<t1)t1=b;}}
  return t1-t0>1e-6?[t0,t1]:null;}
function rasterXY(rc,so,angDeg,res){
  const th=angDeg*DEG,d=[Math.cos(th),Math.sin(th)],n=[-d[1],d[0]];
  const cs=[[rc[0],rc[2]],[rc[1],rc[2]],[rc[0],rc[3]],[rc[1],rc[3]]].map(p=>p[0]*n[0]+p[1]*n[1]);const b0=Math.min(...cs),b1=Math.max(...cs);
  const nL=Math.max(1,Math.ceil((b1-b0)/so-1e-9));const out=[];
  for(let l=0;l<=nL;l++){const b=Math.min(b0+l*so,b1),c=[n[0]*b,n[1]*b];const t=clipSeg(c,d,rc);if(!t)continue;
    const m=Math.max(2,Math.ceil((t[1]-t[0])/res));const pl=[];for(let q=0;q<=m;q++){const u=t[0]+(t[1]-t[0])*q/m;pl.push([c[0]+d[0]*u,c[1]+d[1]*u]);}out.push(pl);}
  return out;}
function circXY(rc,so,res){
  const cx=(rc[0]+rc[1])/2,cy=(rc[2]+rc[3])/2,Rm=Math.hypot(rc[1]-cx,rc[3]-cy);const out=[];
  for(let r=so/2;r<Rm+so;r+=so){const m=Math.max(12,Math.ceil(2*Math.PI*r/res));let pl=[];
    for(let q=0;q<=m;q++){const a=2*Math.PI*q/m,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);
      if(x<rc[0]-1e-9||x>rc[1]+1e-9||y<rc[2]-1e-9||y>rc[3]+1e-9){if(pl.length>1)out.push(pl);pl=[];}else pl.push([x,y]);}
    if(pl.length>1)out.push(pl);}
  return out;}
function radXY(rc,so,res){
  const cx=(rc[0]+rc[1])/2,cy=(rc[2]+rc[3])/2,Rm=Math.hypot(rc[1]-cx,rc[3]-cy);const n=Math.max(8,Math.ceil(2*Math.PI*Rm/so));const out=[];
  for(let l=0;l<n;l++){const a=2*Math.PI*l/n,d=[Math.cos(a),Math.sin(a)];const t=clipSeg([cx,cy],d,rc);if(!t||t[1]<=0)continue;
    const m=Math.max(2,Math.ceil(t[1]/res));const pl=[];for(let q=0;q<=m;q++)pl.push([cx+d[0]*t[1]*q/m,cy+d[1]*t[1]*q/m]);out.push(pl);}
  return out;}
function workRect(st){const k=S.stock;let rc=[k.min[0],k.max[0],k.min[1],k.max[1]];const a=st.area;
  if(a&&a.on){rc=[Math.max(rc[0],a.x0),Math.min(rc[1],a.x1),Math.max(rc[2],a.y0),Math.min(rc[3],a.y1)];if(rc[1]-rc[0]<0.1||rc[3]-rc[2]<0.1)throw new Error('El área de trabajo no toca el material. Revisa sus límites en Estrategia.');}
  return rc;}
function workX(st,x0,x1){const a=st.area;if(a&&a.on){x0=Math.max(x0,a.x0);x1=Math.min(x1,a.x1);if(x1-x0<0.1)throw new Error('El área de trabajo no toca la pieza. Revisa sus límites en Estrategia.');}return[x0,x1];}
// ---- 3 ejes: mapa de alturas + dilatación con el perfil de la herramienta
async function genTop3(tl,st,opt={}){
  const M=S.M,stock=S.stock,R=tl.D/2;const x0=stock.min[0],x1=stock.max[0],y0=stock.min[1],y1=stock.max[1];
  let res=clamp(Math.min(st.step,st.stepover/2,tl.D/8),0.08,3);
  let nx,ny,kr;
  for(let it=0;it<60;it++){nx=Math.ceil((x1-x0+2*R)/res)+1;ny=Math.ceil((y1-y0+2*R)/res)+1;kr=Math.ceil(R/res);if(nx*ny<=420000&&nx*ny*Math.PI*kr*kr<=6e7)break;res*=1.12;}
  const gx0=x0-R,gy0=y0-R;const H=new Float32Array(nx*ny);const zTop=M.bmax[2]+5,floor=Math.max(stock.min[2],M.bmin[2]); // nunca por debajo de la pieza: un bloque más grueso no se corta hasta la mesa
  const ps={t:now()};
  for(let j=0;j<ny;j++){const y=gy0+j*res;for(let i=0;i<nx;i++){const x=gx0+i*res;H[j*nx+i]=raycast(M,x,y,zTop,0,0,-1,1e6)?zTop-HIT.t:floor;}
    await progressYield(ps,0.05+0.35*j/ny,'Leyendo la superficie…');}
  const ker=[];for(let dj=-kr;dj<=kr;dj++)for(let di=-kr;di<=kr;di++){const d=Math.hypot(di,dj)*res;if(d<=R+1e-9)ker.push(di,dj,toolH(tl,d));}
  const T=new Float32Array(nx*ny);let unreached=0,cells=0;
  for(let j=0;j<ny;j++){for(let i=0;i<nx;i++){let best=-1e9;for(let k=0;k<ker.length;k+=3){const ii=i+ker[k],jj=j+ker[k+1];if(ii<0||jj<0||ii>=nx||jj>=ny)continue;const v=H[jj*nx+ii]-ker[k+2];if(v>best)best=v;}
      const v=Math.max(best+st.allow,floor);T[j*nx+i]=v;}
    await progressYield(ps,0.4+0.3*j/ny,'Calculando contacto de la herramienta…');}
  // una celda se alcanza si el filo la toca desde ALGUNA posición vecina, no solo con la punta encima
  for(let j=0;j<ny;j++){for(let i=0;i<nx;i++){const hx=H[j*nx+i];if(hx<=floor+0.01)continue;cells++;const lim=hx+st.allow+0.05;if(T[j*nx+i]<=lim)continue;let hit=false;
      for(let k=0;k<ker.length;k+=3){const ii=i+ker[k],jj=j+ker[k+1];if(ii<0||jj<0||ii>=nx||jj>=ny)continue;if(T[jj*nx+ii]+ker[k+2]<=lim){hit=true;break;}}
      if(!hit)unreached++;}
    await progressYield(ps,0.7+0.1*j/ny,'Revisando zonas sin alcanzar…');}
  const Tat=(x,y)=>{const fx=clamp((x-gx0)/res,0,nx-1.001),fy=clamp((y-gy0)/res,0,ny-1.001);const i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
    return T[j*nx+i]*(1-u)*(1-v)+T[j*nx+i+1]*u*(1-v)+T[(j+1)*nx+i]*(1-u)*v+T[(j+1)*nx+i+1]*u*v;};
  const chk=checker(tl,st);const passes=[];const rc=workRect(st);
  const lineSet=(paths,zfn,rough)=>{let rev=st.cutdir==='rev';
    for(const pl of paths){const parts=[];let pts=[];
      for(const [x,y] of pl){const z=zfn(x,y);if(z===null){if(pts.length>1)parts.push(pts);pts=[];continue;}pts.push({p:[x,y,z],a:[0,0,1],st:0});}
      if(pts.length>1)parts.push(pts);
      if(rev){parts.reverse();parts.forEach(q=>q.reverse());}
      for(const q of parts)passes.push({pts:q,rough});
      if(st.cutdir==='zig')rev=!rev;}
  };
  let minTall=Infinity;for(let i=0;i<T.length;i++)if(T[i]<minTall)minTall=T[i];
  if(st.rough){const minT=minTall;const dA=st.rallow-st.allow;let prev=stock.max[2],lvN=0;
    for(let L=stock.max[2]-st.rsd;L>minT+dA-st.rsd;L-=st.rsd){const lv=Math.max(L,minT+dA);const pv=prev;
      lineSet(rasterXY(rc,st.rso,st.ang+(st.rpat==='alt'&&lvN%2?90:0),res),(x,y)=>{const z=Math.max(lv,Tat(x,y)+dA);return z<pv-0.01?z:null;},true);prev=lv;lvN++;if(lv<=minT+dA)break;}}
  if(!opt.roughOnly){const fin=(x,y)=>Tat(x,y);
    if(st.pat3==='circ')lineSet(circXY(rc,st.stepover,res),fin,false);
    else if(st.pat3==='rad')lineSet(radXY(rc,st.stepover,res),fin,false);
    else{lineSet(rasterXY(rc,st.stepover,st.ang,res),fin,false);if(st.pat3==='cross')lineSet(rasterXY(rc,st.stepover,st.ang+90,res),fin,false);}}
  if(!passes.length)throw new Error(opt.roughOnly?'El desbaste no generó pasadas.':'No hay nada que maquinar con estos parámetros.');
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
async function genRot4(tl,st,opt={}){
  const M=S.M,stock=S.stock,R=tl.D/2;const [px0,px1]=workX(st,M.bmin[0],M.bmax[0]);
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
      Tm[ix*nt+it]=best+st.allow;}
    await progressYield(ps,0.4+0.3*ix/nx,'Calculando contacto en 4 ejes…');}
  for(let ix=0;ix<nx;ix++){for(let it=0;it<nt;it++){const r0=Rm[ix*nt+it];if(r0<=0)continue;cells++;const lim=r0+st.allow+0.05;if(Tm[ix*nt+it]<=lim)continue;let hit=false;
      for(let dx=-krx;dx<=krx&&!hit;dx++){const jx=ix+dx;if(jx<0||jx>=nx)continue;const dxm=dx*resx;if(Math.abs(dxm)>R)continue;const row=jx*nt;
        for(let dt=-w;dt<=w;dt++){let jt=it-dt;if(jt<0)jt+=nt;else if(jt>=nt)jt-=nt;const y=r0*sinT[dt+w];if(y>R||y<-R)continue;const d=Math.hypot(dxm,y);if(d>R)continue;
          if(Tm[row+jt]-st.allow+hOf(d)<=r0*cosT[dt+w]+0.05){hit=true;break;}}}
      if(!hit)unreached++;}
    await progressYield(ps,0.7+0.1*ix/nx,'Revisando zonas sin alcanzar…');}
  const Tat=(x,th)=>{let fx=clamp((x-gx0)/resx,0,nx-1.001);th=((th%(2*Math.PI))+2*Math.PI)%(2*Math.PI);const ft=th/dT;const i=Math.floor(fx),j=Math.floor(ft)%nt,j2=(j+1)%nt,u=fx-i,v=ft-Math.floor(ft);
    return Tm[i*nt+j]*(1-u)*(1-v)+Tm[i*nt+j2]*(1-u)*v+Tm[(i+1)*nt+j]*u*(1-v)+Tm[(i+1)*nt+j2]*u*v;};
  const pt=(x,th,r)=>{const s=Math.sin(th),c=Math.cos(th);return{p:[x,r*s,r*c],a:[0,s,c],st:0};};
  const passes=[];const rT=Math.max(stock.rPart,1);
  const spiral=(so,step,rfn,rough)=>{const turns=(px1-px0)/so;const dth=step/rT;const n=Math.min(400000,Math.ceil(turns*2*Math.PI/dth));const pts=[];
    for(let k=0;k<=n;k++){const th=k*dth;const x=px0+th/(2*Math.PI)*so;if(x>px1)break;pts.push(pt(x,th,rfn(x,th)));}passes.push({pts,rough});};
  const lines=(so,rfn,rough)=>{const nL=Math.max(8,Math.round(2*Math.PI*rT/so));let rev=st.cutdir==='rev';const n=Math.ceil((px1-px0)/resx);
    for(let l=0;l<nL;l++){const th=2*Math.PI*l/nL;const pts=[];for(let k=0;k<=n;k++){const x=px0+(px1-px0)*k/n;pts.push(pt(x,th,rfn(x,th)));}if(rev)pts.reverse();if(st.cutdir==='zig')rev=!rev;passes.push({pts,rough});}};
  if(st.rough){let minT=Infinity;for(let i=0;i<Tm.length;i+=5)if(Tm[i]<minT)minT=Tm[i];const dA=st.rallow-st.allow;
    for(let L=stock.r-st.rsd;;L-=st.rsd){const lv=Math.max(L,minT+dA);const rf=(x,th)=>Math.max(lv,Tat(x,th)+dA);if(st.rrot==='lines')lines(st.rso,rf,true);else spiral(st.rso,Math.max(resx*3,1.2),rf,true);if(lv<=minT+dA)break;}}
  if(!opt.roughOnly){if(st.pattern==='lines')lines(st.stepover,Tat,false);else spiral(st.stepover,Math.max(resx,0.2),Tat,false);}
  if(!passes.length)throw new Error('El desbaste no generó pasadas.');
  const chk=checker(tl,st);let n=0;const tot=passes.reduce((s,p)=>s+p.pts.length,0);
  for(const p2 of passes){for(let i=0;i<p2.pts.length;i+=3){const q=p2.pts[i];if(chk(q.p,q.a,true)){for(let k=Math.max(0,i-2);k<=Math.min(p2.pts.length-1,i+2);k++)p2.pts[k].st=2;}}
    n+=p2.pts.length;await progressYield(ps,0.8+0.2*n/tot,'Verificando zanco, porta y sujeción…');}
  passes.forEach(p=>p.pts=simplify(p.pts));
  let minT=Infinity;for(let i=0;i<Tm.length;i+=3)if(Tm[i]<minT)minT=Tm[i];
  return {passes,unreachedPct:cells?unreached/cells*100:0,maxDepth:stock.r-minT};
}
// ---- 4º eje indexado: la pieza gira a un ángulo fijo por cara y cada cara se maquina en 3 ejes ----
// En cada cara la herramienta apunta al eje de giro (dirección d) y barre líneas a lo largo de X,
// corriéndose de lado (dirección e). Cada cara baja hasta el plano del eje; entre todas liberan la pieza.
async function genIdx4(tl,st,opt={}){
  const M=S.M,stock=S.stock,R=tl.D/2;const [px0,px1]=workX(st,M.bmin[0],M.bmax[0]);
  const N=clamp(Math.round(st.faces)||4,1,12),Rf=stock.r+5,floor=0;
  const half=(N<=2?stock.r:stock.r*Math.sin(Math.PI/N))+R+Math.max(st.stepover,0.2);
  let res=clamp(Math.min(st.step,st.stepover/2,tl.D/8),0.1,3),nx,nv,ker;
  const build=()=>{nx=Math.ceil((px1-px0+2*R)/res)+1;nv=Math.ceil(2*half/res)+1;
    ker=[];const k=Math.ceil(R/res);for(let i=-k;i<=k;i++)for(let j=-k;j<=k;j++){const dd=Math.hypot(i,j)*res;if(dd<=R)ker.push(i,j,toolH(tl,dd));}};
  build();for(let it=0;it<40&&(nx*nv*N>400000||nx*nv*N*(ker.length/3)>2.4e8);it++){res*=1.12;build();}
  const gx0=px0-R,nk=ker.length/3,ps={t:now()},passes=[];let unreached=0,cells=0,minZ=Infinity;
  const dA=st.rallow-st.allow;
  for(let f=0;f<N;f++){
    const th=2*Math.PI*f/N,s=Math.sin(th),c=Math.cos(th),frac=q=>(f+q)/N;
    // alturas vistas desde esta cara
    const H=new Float32Array(nx*nv),sub=res/3;
    for(let ix=0;ix<nx;ix++){const x=gx0+ix*res;
      // 9 rayos por celda y se guarda el más alto: una pared que cae entre dos celdas cuenta en las dos y la fresa no la muerde
      for(let iv=0;iv<nv;iv++){const v0=-half+iv*res;let h=-1e9;
        for(let a=-1;a<=1;a++)for(let b2=-1;b2<=1;b2++){const xx=x+a*sub,v=v0+b2*sub;if(raycast(M,xx,v*c+Rf*s,-v*s+Rf*c,0,-s,-c,2*Rf)){const t=Rf-HIT.t;if(t>h)h=t;}}
        H[ix*nv+iv]=h;}
      await progressYield(ps,0.02+0.9*frac(0.35*ix/nx),`Leyendo la cara ${f+1} de ${N}…`);}
    // hasta dónde baja la punta sin morder la pieza
    const Z=new Float32Array(nx*nv);
    for(let ix=0;ix<nx;ix++){for(let iv=0;iv<nv;iv++){let best=floor;
        for(let q=0;q<ker.length;q+=3){const jx=ix+ker[q],jv=iv+ker[q+1];if(jx<0||jx>=nx||jv<0||jv>=nv)continue;const z=H[jx*nv+jv]-ker[q+2];if(z>best)best=z;}
        const z=best+st.allow;Z[ix*nv+iv]=z;if(z<minZ)minZ=z;}
      await progressYield(ps,0.02+0.9*frac(0.35+0.4*ix/nx),`Calculando contacto en la cara ${f+1} de ${N}…`);}
    // superficie que ve esta cara y que la fresa no alcanza a tocar
    for(let ix=0;ix<nx;ix+=2){for(let iv=0;iv<nv;iv+=2){const h0=H[ix*nv+iv];if(h0<floor)continue;cells++;if(Z[ix*nv+iv]-st.allow<=h0+0.05)continue;let hit=false;
        for(let q=0;q<ker.length&&!hit;q+=3){const jx=ix-ker[q],jv=iv-ker[q+1];if(jx<0||jx>=nx||jv<0||jv>=nv)continue;if(Z[jx*nv+jv]-st.allow+ker[q+2]<=h0+0.05)hit=true;}
        if(!hit)unreached++;}
      await progressYield(ps,0.02+0.9*frac(0.75+0.2*ix/nx),`Revisando la cara ${f+1} de ${N}…`);}
    const Zat=(x,v)=>{const fx=clamp((x-gx0)/res,0,nx-1.001),fv=clamp((v+half)/res,0,nv-1.001),i=Math.floor(fx),j=Math.floor(fv),u=fx-i,w=fv-j;
      return Z[i*nv+j]*(1-u)*(1-w)+Z[i*nv+j+1]*(1-u)*w+Z[(i+1)*nv+j]*u*(1-w)+Z[(i+1)*nv+j+1]*u*w;};
    const pt=(x,v,z)=>({p:[x,v*c+z*s,-v*s+z*c],a:[0,s,c],st:0});
    // enlace directo entre líneas vecinas de la misma cara: vale si el tramo no baja de lo permitido
    const lk=(A,B,rough)=>{for(let q=1;q<6;q++){const p=V.lerp(A,B,q/6),v=p[1]*c-p[2]*s,z=p[1]*s+p[2]*c;if(z<Zat(p[0],v)+(rough?dA:0)-0.02)return false;}return true;};
    const top=v=>Math.abs(v)<stock.r?Math.sqrt(stock.r*stock.r-v*v):-1e9; // superficie del material a esa distancia del centro
    const n=Math.max(2,Math.ceil((px1-px0)/res));let rev=st.cutdir==='rev';
    const lines=(so,zfn,rough)=>{const nL=Math.max(1,Math.ceil(2*half/so));
      for(let l=0;l<=nL;l++){const v=-half+2*half*l/nL;if(Math.abs(v)>stock.r+R)continue; // fuera del material
        const pts=[];let cuts=false;const lim=Math.max(top(Math.max(0,Math.abs(v)-R)),floor);
        for(let k=0;k<=n;k++){const x=px0+(px1-px0)*k/n,z=zfn(x,v);if(z<lim-0.01)cuts=true;pts.push(pt(x,v,z));}
        if(!cuts)continue; // toda la línea va por el aire
        if(rev)pts.reverse();if(st.cutdir==='zig')rev=!rev;passes.push({pts,rough,lk});}};
    if(st.rough){let zmin=Infinity;for(let i=0;i<Z.length;i+=3)if(Z[i]<zmin)zmin=Z[i];
      for(let L=stock.r-st.rsd;;L-=st.rsd){const lv=Math.max(L,zmin+dA);lines(st.rso,(x,v)=>Math.max(lv,Zat(x,v)+dA),true);if(lv<=zmin+dA)break;}}
    if(!opt.roughOnly)lines(st.stepover,Zat,false);
  }
  if(!passes.length)throw new Error('No hay nada que cortar: revisa el tamaño del material y el número de caras.');
  const chk=checker(tl,st);let done=0;const tot=passes.reduce((a,p)=>a+p.pts.length,0);
  for(const p2 of passes){for(let i=0;i<p2.pts.length;i+=3){const q=p2.pts[i];if(chk(q.p,q.a,true)){for(let k=Math.max(0,i-2);k<=Math.min(p2.pts.length-1,i+2);k++)p2.pts[k].st=2;}}
    done+=p2.pts.length;await progressYield(ps,0.92+0.08*done/tot,'Verificando zanco, porta y sujeción…');}
  passes.forEach(p=>p.pts=simplify(p.pts));
  return {passes,unreachedPct:cells?unreached/cells*100:0,maxDepth:stock.r-minZ};
}
// ---- 5 ejes posicional (3+2): los ejes giratorios se fijan en una orientación por cara y cada cara se corta en 3 ejes ----
// Cada orientación es una dirección fija de la herramienta (a). En el plano que la cruza se barren líneas; la
// altura a lo largo de a sale de un mapa de alturas visto desde esa dirección (9 rayos por celda, como el indexado)
// y el piso es la mesa: la punta nunca baja de la base del material.
function orientacionesPos5(st){
  const n=Math.round(st.posCaras)||0,t=clamp(+st.posTilt||45,10,80)*DEG,out=[{a:[0,0,1],nombre:'arriba'}];
  for(let k=0;k<n;k++){const f=2*Math.PI*k/n;out.push({a:V.norm([Math.sin(t)*Math.cos(f),Math.sin(t)*Math.sin(f),Math.cos(t)]),nombre:`lado ${k+1} (${Math.round(st.posTilt)}°, giro ${Math.round(f*RAD)}°)`});}
  return out;
}
async function genPos5(tl,st,opt={}){
  const M=S.M,stock=S.stock,m=S.machine,R=tl.D/2,dirs=orientacionesPos5(st);
  // primero se revisa que la máquina llegue a cada orientación: si no, se dice cuál y por qué
  for(const d of dirs)if(!kinSolve(m,d.a,null))throw new Error(`La orientación ${d.nombre} queda fuera del recorrido de los ejes giratorios de tu máquina (${KIN_NAME[m.kin]}). Baja la inclinación o elige menos lados.`);
  const bmin=stock.min,bmax=stock.max,c=V.mul(V.add(bmin,bmax),0.5),far=V.dist(bmin,bmax)+20,floorZ=Math.max(bmin[2],M.bmin[2]);
  const dA=st.rallow-st.allow,ps={t:now()},passes=[];let unreached=0,cells=0,minZ=Infinity,maxDepth=0;
  // dónde entra un rayo a la caja del material (método de losas); -1e9 si no la toca
  const entradaCaja=(o,d)=>{let t0=-1e9,t1=1e9;for(let q=0;q<3;q++){if(Math.abs(d[q])<1e-12){if(o[q]<bmin[q]||o[q]>bmax[q])return null;continue;}let a=(bmin[q]-o[q])/d[q],b=(bmax[q]-o[q])/d[q];if(a>b){const x=a;a=b;b=x;}t0=Math.max(t0,a);t1=Math.min(t1,b);}return t1>=t0&&t1>0?Math.max(t0,0):null;};
  for(let f=0;f<dirs.length;f++){
    const a=dirs[f].a,ref=Math.abs(a[0])<0.9?[1,0,0]:[0,1,0],U=V.norm(V.cross(ref,a)),W=V.cross(a,U),frac=q=>(f+q)/dirs.length;
    // extensión del material proyectada en el plano de la cara
    let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
    for(let q=0;q<8;q++){const p=[q&1?bmax[0]:bmin[0],q&2?bmax[1]:bmin[1],q&4?bmax[2]:bmin[2]],r=V.sub(p,c),u=V.dot(r,U),v=V.dot(r,W);u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);}
    u0-=R;u1+=R;v0-=R;v1+=R;
    let res=clamp(Math.min(st.step,st.stepover/2,tl.D/8),0.1,3),nu,nv,ker;
    const build=()=>{nu=Math.ceil((u1-u0)/res)+1;nv=Math.ceil((v1-v0)/res)+1;ker=[];const k=Math.ceil(R/res);for(let i=-k;i<=k;i++)for(let j=-k;j<=k;j++){const dd=Math.hypot(i,j)*res;if(dd<=R)ker.push(i,j,toolH(tl,dd));}};
    build();for(let it=0;it<40&&(nu*nv*dirs.length>400000||nu*nv*dirs.length*(ker.length/3)>2.4e8);it++){res*=1.12;build();}
    const base=(u,v)=>V.add(c,V.add(V.mul(U,u),V.mul(W,v))),neg=V.mul(a,-1),sub=res/3;
    // Inclinada, la fresa baja más que su punta (el costado de la bola o el canto de la plana):
    // el piso se sube eso para que ninguna parte del cortador pase de la mesa.
    const cr=cutterRadii(tl),baja=cr.r*(1-a[2])+(cr.R-cr.r)*Math.sqrt(Math.max(0,1-a[2]*a[2]));
    const H=new Float32Array(nu*nv),Fl=new Float32Array(nu*nv),Top=new Float32Array(nu*nv);
    for(let iu=0;iu<nu;iu++){const u=u0+iu*res;
      for(let iv=0;iv<nv;iv++){const v=v0+iv*res;let h=-1e9;
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){const o=V.madd(base(u+x*sub,v+y*sub),a,far);if(raycast(M,o[0],o[1],o[2],neg[0],neg[1],neg[2],2*far)){const t=far-HIT.t;if(t>h)h=t;}}
        const b=base(u,v),ent=entradaCaja(V.madd(b,a,far),neg);
        H[iu*nv+iv]=h;Fl[iu*nv+iv]=(floorZ+baja-b[2])/a[2];Top[iu*nv+iv]=ent===null?-1e9:far-ent;}
      await progressYield(ps,0.02+0.9*frac(0.35*iu/nu),`Leyendo la cara ${f+1} de ${dirs.length}…`);}
    // En las orillas y en las paredes casi paralelas a la herramienta la altura brinca entre una celda y la
    // siguiente: cada celda toma la más alta de sus vecinas para que el costado de la fresa no muerda el borde.
    {const H0=H.slice();for(let iu=0;iu<nu;iu++)for(let iv=0;iv<nv;iv++){let h=H0[iu*nv+iv];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){const ju=iu+x,jv=iv+y;if(ju>=0&&ju<nu&&jv>=0&&jv<nv&&H0[ju*nv+jv]>h)h=H0[ju*nv+jv];}H[iu*nv+iv]=h;}}
    // hasta dónde baja la punta sin morder la pieza ni bajar de la mesa
    const Z=new Float32Array(nu*nv);
    for(let iu=0;iu<nu;iu++){for(let iv=0;iv<nv;iv++){let best=Fl[iu*nv+iv];
        for(let q=0;q<ker.length;q+=3){const ju=iu+ker[q],jv=iv+ker[q+1];if(ju<0||ju>=nu||jv<0||jv>=nv)continue;const z=H[ju*nv+jv]-ker[q+2];if(z>best)best=z;}
        const z=best+st.allow;Z[iu*nv+iv]=z;if(z<minZ)minZ=z;}
      await progressYield(ps,0.02+0.9*frac(0.35+0.4*iu/nu),`Calculando contacto en la cara ${f+1} de ${dirs.length}…`);}
    for(let iu=0;iu<nu;iu+=2){for(let iv=0;iv<nv;iv+=2){const h0=H[iu*nv+iv];if(h0<Fl[iu*nv+iv]+0.01)continue;cells++;if(Z[iu*nv+iv]-st.allow<=h0+0.05)continue;let hit=false;
        for(let q=0;q<ker.length&&!hit;q+=3){const ju=iu-ker[q],jv=iv-ker[q+1];if(ju<0||ju>=nu||jv<0||jv>=nv)continue;if(Z[ju*nv+jv]-st.allow+ker[q+2]<=h0+0.05)hit=true;}
        if(!hit)unreached++;}
      await progressYield(ps,0.02+0.9*frac(0.75+0.2*iu/nu),`Revisando la cara ${f+1} de ${dirs.length}…`);}
    const at=(A,u,v)=>{const fu=clamp((u-u0)/res,0,nu-1.001),fv=clamp((v-v0)/res,0,nv-1.001),i=Math.floor(fu),j=Math.floor(fv),x=fu-i,y=fv-j;return A[i*nv+j]*(1-x)*(1-y)+A[i*nv+j+1]*(1-x)*y+A[(i+1)*nv+j]*x*(1-y)+A[(i+1)*nv+j+1]*x*y;};
    const Zat=(u,v)=>at(Z,u,v);
    const pt=(u,v,h)=>({p:V.madd(base(u,v),a,h),a:a.slice(),st:0});
    const loc=p=>{const r=V.sub(p,c);return[V.dot(r,U),V.dot(r,W),V.dot(r,a)];};
    const lk=(A,B,rough)=>{for(let q=1;q<6;q++){const [u,v,h]=loc(V.lerp(A,B,q/6));if(h<Zat(u,v)+(rough?dA:0)-0.02)return false;}return true;};
    let topMax=-1e9;for(let i=0;i<Top.length;i++)if(Top[i]>topMax)topMax=Top[i];
    const n=Math.max(2,Math.ceil((u1-u0)/res));let rev=st.cutdir==='rev';
    const lines=(so,zfn,rough)=>{const nL=Math.max(1,Math.ceil((v1-v0)/so));
      for(let l=0;l<=nL;l++){const v=v0+(v1-v0)*l/nL;const pts=[];let cuts=false;
        for(let k=0;k<=n;k++){const u=u0+(u1-u0)*k/n,h=zfn(u,v);if(h<at(Top,u,v)-0.01)cuts=true;pts.push(pt(u,v,h));}
        if(!cuts)continue; // la línea va toda por el aire
        if(rev)pts.reverse();if(st.cutdir==='zig')rev=!rev;passes.push({pts,rough,lk});}};
    let zmin=Infinity;for(let i=0;i<Z.length;i+=3)if(Z[i]<zmin)zmin=Z[i];
    maxDepth=Math.max(maxDepth,topMax-zmin);
    if(st.rough){for(let L=topMax-st.rsd;;L-=st.rsd){const lv=Math.max(L,zmin+dA);lines(st.rso,(u,v)=>Math.max(lv,Zat(u,v)+dA),true);if(lv<=zmin+dA)break;}}
    if(!opt.roughOnly)lines(st.stepover,Zat,false);
  }
  if(!passes.length)throw new Error('No hay nada que cortar: revisa el material y las orientaciones.');
  const chk=checker(tl,st);let done=0;const tot=passes.reduce((s,p)=>s+p.pts.length,0);
  for(const p2 of passes){for(let i=0;i<p2.pts.length;i+=3){const q=p2.pts[i];if(chk(q.p,q.a,true)){for(let k=Math.max(0,i-2);k<=Math.min(p2.pts.length-1,i+2);k++)p2.pts[k].st=2;}}
    done+=p2.pts.length;await progressYield(ps,0.92+0.08*done/tot,'Verificando zanco, porta y sujeción…');}
  passes.forEach(p=>p.pts=simplify(p.pts));
  return {passes,unreachedPct:cells?unreached/cells*100:0,maxDepth,salidaEje:true};
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
  let roughRes=null;if(st.rough){const rt=S.rtool||tl;roughRes=await(S.frame==='top'?genTop3:genRot4)(rt,st,{roughOnly:true});roughRes.passes.forEach(p=>{p.tid=rt.id;p.lk=p.lk||roughRes.linkOK;});}
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
    const zTop=M.bmax[2]+5;const rc=workRect(st);let rev=st.cutdir==='rev';
    const sets=[rasterXY(rc,st.stepover,st.ang,st.step)];if(st.pat3==='cross')sets.push(rasterXY(rc,st.stepover,st.ang+90,st.step));
    const nAll=sets.reduce((a,q)=>a+q.length,0);let done=0;
    for(const set of sets)for(const pl0 of set){const pl=rev?pl0.slice().reverse():pl0;const A=pl[0],B=pl[pl.length-1];const f=V.norm([B[0]-A[0],B[1]-A[1],0]);
      runPass(pl.map(([x,y])=>({o:[x,y,zTop],d:[0,0,-1],f,ref:[0,0,1]})),false);if(st.cutdir==='zig')rev=!rev;
      await progressYield(ps,0.05+0.8*(++done)/nAll,'5 ejes: orientando la herramienta y evitando colisiones…');}
  }else{
    const eR=cutterRadii(tl).R*0.9;const Rf=stock.r+5;const [px0,px1]=workX(st,M.bmin[0]+eR,M.bmax[0]-eR);const rT=Math.max(stock.rPart,1);
    if(st.pattern==='lines'){const nL=Math.max(8,Math.round(2*Math.PI*rT/st.stepover));let rev=st.cutdir==='rev';const n=Math.ceil((px1-px0)/st.step);
      for(let l=0;l<nL;l++){const th=2*Math.PI*l/nL,s=Math.sin(th),c=Math.cos(th);const sm=[];
        for(let k=0;k<=n;k++){const x=px0+(px1-px0)*(rev?n-k:k)/n;sm.push({o:[x,Rf*s,Rf*c],d:[0,-s,-c],f:[rev?-1:1,0,0],ref:[0,s,c]});}
        runPass(sm,false);if(st.cutdir==='zig')rev=!rev;await progressYield(ps,0.05+0.8*l/nL,'5 ejes: orientando la herramienta y evitando colisiones…');}
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
        for(let k=1;k<n;k++){const u=k/n;const a=slerpDir(A.a,B.a,u);const nk=slerpDir(A.n,B.n,u);if(V.dot(a,nk)<minDotN)continue;
          // el centro de la bola va de un lado al otro de la arista; si roza, se separa por la normal hasta librar
          let C=V.lerp(V.madd(A.P,A.n,reB+st.allow),V.madd(B.P,B.n,reB+st.allow),u),T=V.madd(C,a,-reB),bad=chk(T,a,false);
          const ds=Math.max(0.04,reB*0.04),eMax=Math.ceil((V.dist(A.P,B.P)+2*reB)/ds);
          for(let e=0;bad==='cutter'&&e<eMax;e++){C=V.madd(C,nk,ds);T=V.madd(C,a,-reB);bad=chk(T,a,false);}
          if(bad)continue;out.push({p:T,a,st:(A.st||B.st)?1:0});}}
      out.push(B);}
    p.pts=out;}
  for(const p of passes)for(const q of p.pts){if(q.st===1)stats.adjusted++;else if(q.st===2)stats.coll++;else if(q.st===3)stats.lim++;delete q.P;delete q.n;delete q.ref;}
  if(!passes.length)throw new Error('No hay nada que maquinar con estos parámetros.');
  if(roughRes){for(const p of roughRes.passes)for(const q of p.pts)if(q.st>=2){stats.coll++;stats.why.rough=(stats.why.rough||0)+1;}return {passes:roughRes.passes.concat(passes),stats5:stats,unreachedPct:0,maxDepth:roughRes.maxDepth};}
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
  const moves=[];const frame=S.frame,stock=S.stock;let tid=tool().id; // cada movimiento lleva la herramienta con la que se hace
  const push=(p,a,t,s=0,rough=false)=>moves.push({p,a,t,st:s,rough,tid});
  const safeTop=stock.type==='box'?stock.max[2]+st.safe:0;const safeR=stock.type==='cyl'?Math.max(stock.r+st.safe,(S.fixtures[0]?.r||0)+4):0;
  const clr=Math.max(1,Math.min(st.safe,4));
  // separar tramos en colisión si se pide omitir
  let passes=[];for(const p of res.passes){if(!st.skip){passes.push(p);continue;}let cur=[];for(const q of p.pts){if(q.st>=2){if(cur.length>1)passes.push({...p,pts:cur});cur=[];}else cur.push(q);}if(cur.length>1)passes.push({...p,pts:cur});}
  // Con la herramienta inclinada fija (3+2) primero se sale a lo largo de su eje hasta librar el material y
  // luego se sube: subir en vertical desde la pieza haría pasar el zanco por dentro del bloque.
  const salidaEje=(p,a)=>{let t=0;const bmin=stock.min,bmax=stock.max;for(let q=0;q<3;q++){if(Math.abs(a[q])<1e-9)continue;const tq=((a[q]>0?bmax[q]:bmin[q])-p[q])/a[q];if(tq>t)t=tq;}return V.madd(p,a,t+st.safe);};
  const toSafe=(p,a)=>{ // punto de retracción seguro
    if(frame==='top'&&res.salidaEje&&a[2]<0.999){const l=V.madd(p,a,clr),s=salidaEje(p,a);return[l,[s[0],s[1],Math.max(safeTop,s[2])],s];}
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
  tid=passes[0].tid||tid;
  const home=frame==='top'?[s0[0],s0[1],safeTop]:s0;push(home,f0.a,'R');
  let last=null;
  for(let pi=0;pi<passes.length;pi++){
    const pts=passes[pi].pts,rough=passes[pi].rough;const first=pts[0];const ptid=passes[pi].tid||tool().id,lk=passes[pi].lk||res.linkOK;
    // el enlace directo solo vale dentro de la misma herramienta: su mapa de alturas es el que dice si el tramo libra
    const direct=last&&ptid===tid&&lk&&V.dist(last.p,first.p)<=(rough?st.rso:st.stepover)*1.6&&lk(last.p,first.p,rough);
    if(direct){push(first.p,first.a,'F',first.st,rough);}
    else{
      if(last){const [l1,l2,m1]=toSafe(last.p,last.a);push(l1,last.a,'P',0,rough);if(m1)push(m1,last.a,'R');push(l2,last.a,'R');tid=ptid; // el cambio de herramienta ocurre ya retirado, en la zona segura
        const [a1,a2,m2]=toSafe(first.p,first.a);travel(l2,last.a,a2,first.a);if(m2)push(m2,first.a,'R');push(a1,first.a,'R');}
      else{const [a1,a2,m2]=toSafe(first.p,first.a);travel(home,f0.a,a2,first.a);if(m2)push(m2,first.a,'R');push(a1,first.a,'R');}
      push(first.p,first.a,'P',first.st,rough);
    }
    for(let i=1;i<pts.length;i++)push(pts[i].p,pts[i].a,'F',pts[i].st,rough);
    last=pts[pts.length-1];
  }
  const [l1,l2,m1]=toSafe(last.p,last.a);push(l1,last.a,'P');if(m1)push(m1,last.a,'R');push(l2,last.a,'R');
  return moves;
}
function annotateMoves(moves){
  const m=S.machine;let prev=null,jumps=0,cum=0,lenCut=0,limFail=0,changes=0;const tcp=useTCP();
  const fds={};const fdOf=id=>fds[id]||(fds[id]=feedsCalc(toolById(id)));const TOOL_CHANGE_MIN=0.5;
  const rot=KIN_AXES[m.kin].length;const rng=[[Infinity,-Infinity],[Infinity,-Infinity]];const lin=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];
  for(let i=0;i<moves.length;i++){
    const mv=moves[i];let k=kinSolve(m,mv.a,prev);
    if(!k){k={ang:prev?prev.slice():new Array(rot).fill(0),...kinMats(m.kin,prev||new Array(rot).fill(0))};mv.kfail=true;if(mv.t!=='R')limFail++;}
    mv.ang=k.ang;mv.R=k.R;mv.ha=k.ha;
    if(prev&&mv.t==='F'&&rot){for(let q=0;q<rot;q++)if(Math.abs(mv.ang[q]-prev[q])>30){jumps++;mv.jump=true;break;}}
    prev=k.ang;
    for(let q=0;q<rot;q++){rng[q][0]=Math.min(rng[q][0],mv.ang[q]);rng[q][1]=Math.max(rng[q][1],mv.ang[q]);}
    const tl=toolById(mv.tid),fd=fdOf(tl.id);
    mv.pm=linearOut(mv,m,tl,tcp);for(let c=0;c<3;c++){lin[c][0]=Math.min(lin[c][0],mv.pm[c]);lin[c][1]=Math.max(lin[c][1],mv.pm[c]);}
    let dur=0;if(i>0){const pv=moves[i-1];const d=V.dist(pv.p,mv.p);mv.len=d;
      const dAng=rot?Math.max(...mv.ang.map((v,q)=>Math.abs(v-pv.ang[q]))):0;
      if(pv.tid!==mv.tid){changes++;dur=TOOL_CHANGE_MIN;} // el cambio de fresa también es tiempo de máquina
      else if(mv.t==='R')dur=Math.max(V.dist(pv.pm,mv.pm)/m.rapid,dAng/5400);
      else{const f=mv.t==='P'?fd.plunge:fd.feed;dur=Math.max(d/f,dAng/5400);if(mv.t==='F')lenCut+=d;}}
    else mv.len=0;
    cum+=dur;mv.cum=cum;
  }
  return {jumps,total:cum,lenCut,limFail,rng,lin,rot,changes};
}
