'use strict';
/* =========================================================
   ESCENA 3D
   ========================================================= */
let renderer,scene,camera,controls,workGroup,partMesh,stockMesh,pathGroup,needleObj,toolGroup,cutterMesh,holderMesh,fixtureGroup,gridHelper,axesHelper;
const MAT={};
function init3D(){
  const host=$('#viewport');
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(38,1,0.5,6000);camera.up.set(0,0,1);camera.position.set(170,-210,150);
  controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.12;
  scene.add(new THREE.HemisphereLight(0xffffff,0x445566,0.75));
  const d1=new THREE.DirectionalLight(0xffffff,0.75);d1.position.set(120,-160,260);scene.add(d1);
  const d2=new THREE.DirectionalLight(0xffffff,0.35);d2.position.set(-200,140,80);scene.add(d2);
  workGroup=new THREE.Group();workGroup.matrixAutoUpdate=false;scene.add(workGroup);
  pathGroup=new THREE.Group();workGroup.add(pathGroup);
  fixtureGroup=new THREE.Group();workGroup.add(fixtureGroup);
  toolGroup=new THREE.Group();scene.add(toolGroup);
  MAT.part=new THREE.MeshStandardMaterial({color:0x888888,metalness:0.15,roughness:0.55,side:THREE.DoubleSide});
  MAT.stock=new THREE.MeshStandardMaterial({color:0xaa8855,metalness:0,roughness:0.85,flatShading:true,side:THREE.DoubleSide,transparent:true,opacity:0.22,depthWrite:false});
  MAT.cutter=new THREE.MeshStandardMaterial({color:0xd4d9de,metalness:0.8,roughness:0.28});
  MAT.shank=new THREE.MeshStandardMaterial({color:0xb9c0c7,metalness:0.7,roughness:0.35});
  MAT.holder=new THREE.MeshStandardMaterial({color:0x4a525b,metalness:0.6,roughness:0.4,transparent:true,opacity:1});
  MAT.fixture=new THREE.MeshStandardMaterial({color:0x5b6570,metalness:0.5,roughness:0.5});
  MAT.hot=new THREE.MeshStandardMaterial({color:0xff4444,metalness:0.3,roughness:0.4,emissive:0x440000});
  new ResizeObserver(resize).observe(host);resize();
  applyThemeColors();
  const mq=matchMedia('(prefers-color-scheme: dark)');mq.addEventListener?.('change',applyThemeColors);
  new MutationObserver(applyThemeColors).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  renderer.setAnimationLoop(frame);
}
function resize(){const host=$('#viewport');const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function applyThemeColors(){
  scene.background=new THREE.Color(cssVar('--vp'));
  MAT.part.color.set(cssVar('--part'));MAT.stock.color.set(cssVar('--stock'));
  if(S.M)buildGrid();if(S.moves)buildPathObjects();
}
function buildGrid(){
  if(gridHelper){scene.remove(gridHelper);gridHelper.geometry.dispose();}
  const size=Math.ceil((S.M?.diag||200)*2.2/10)*10;const g=new THREE.GridHelper(size,Math.round(size/10),new THREE.Color(cssVar('--vp-grid')),new THREE.Color(cssVar('--vp-grid')));
  g.rotation.x=Math.PI/2;g.material.transparent=true;g.material.opacity=0.55;
  const z=S.stock?(S.stock.type==='box'?S.stock.min[2]-0.2:-S.stock.r-25):0;g.position.z=z;gridHelper=g;scene.add(g);
  if(axesHelper)scene.remove(axesHelper);axesHelper=new THREE.AxesHelper(Math.max(12,(S.M?.diag||100)*0.12));scene.add(axesHelper);
}
function buildPartScene(){
  const M=S.M;
  if(partMesh){workGroup.remove(partMesh);partMesh.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(M.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(M.cn,3));
  partMesh=new THREE.Mesh(g,MAT.part);workGroup.add(partMesh);
  while(fixtureGroup.children.length){const c=fixtureGroup.children.pop();c.geometry.dispose();}
  for(const f of S.fixtures){let geo;
    if(f.type==='chuck'){geo=new THREE.CylinderGeometry(f.r,f.r,f.x1-f.x0,48);}else{geo=new THREE.CylinderGeometry(f.r+1,1,f.x1-f.x0,32);}
    const mesh=new THREE.Mesh(geo,MAT.fixture);mesh.rotation.z=f.type==='chuck'?-Math.PI/2:Math.PI/2;mesh.position.x=(f.x0+f.x1)/2;fixtureGroup.add(mesh);}
  buildStock();buildGrid();applyVisibility();fitView('iso');
}

/* ---- bruto con remoción de material ---- */
function buildStock(){
  if(stockMesh){workGroup.remove(stockMesh);stockMesh.geometry.dispose();}
  const st=S.stock;const sg={};S.sg=sg;
  if(st.type==='box'){
    const W=st.max[0]-st.min[0],Hh=st.max[1]-st.min[1];const res=Math.max(Math.max(W,Hh)/230,0.2);
    const nx=Math.ceil(W/res)+1,ny=Math.ceil(Hh/res)+1;Object.assign(sg,{type:'top',nx,ny,x0:st.min[0],y0:st.min[1],rx:W/(nx-1),ry:Hh/(ny-1),z0:st.max[2],zb:st.min[2]});
    sg.H=new Float32Array(nx*ny).fill(st.max[2]);
    const ring=[];for(let i=0;i<nx;i++)ring.push(i);for(let j=1;j<ny;j++)ring.push(j*nx+nx-1);for(let i=nx-2;i>=0;i--)ring.push((ny-1)*nx+i);for(let j=ny-2;j>0;j--)ring.push(j*nx);
    const nTop=nx*ny,nR=ring.length;const pos=new Float32Array((nTop+nR)*3);
    const idx=[];for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i;idx.push(a,a+1,a+nx+1,a,a+nx+1,a+nx);}
    for(let k=0;k<nR;k++){const a=ring[k],b=ring[(k+1)%nR],A=nTop+k,B=nTop+(k+1)%nR;idx.push(a,A,B,a,B,b);}
    for(let k=1;k<nR-1;k++)idx.push(nTop,nTop+k+1,nTop+k);
    sg.ring=ring;sg.nTop=nTop;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setIndex(nTop+nR>65535?new THREE.Uint32BufferAttribute(idx,1):new THREE.Uint16BufferAttribute(idx,1));sg.geo=geo;
  }else{
    const L=st.x1-st.x0;const res=Math.max(L/260,0.25);const nx=Math.ceil(L/res)+1,nt=clamp(Math.round(2*Math.PI*st.r/res),96,420);
    Object.assign(sg,{type:'rot',nx,nt,x0:st.x0,rx:L/(nx-1),dT:2*Math.PI/nt});sg.Rg=new Float32Array(nx*nt).fill(st.r);
    const pos=new Float32Array((nx*nt+2)*3);const idx=[];
    for(let i=0;i<nx-1;i++)for(let j=0;j<nt;j++){const a=i*nt+j,b=i*nt+(j+1)%nt,c=(i+1)*nt+(j+1)%nt,d=(i+1)*nt+j;idx.push(a,d,c,a,c,b);}
    const cA=nx*nt,cB=nx*nt+1;for(let j=0;j<nt;j++){idx.push(cA,(j+1)%nt,j);idx.push(cB,(nx-1)*nt+j,(nx-1)*nt+(j+1)%nt);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setIndex(new THREE.Uint32BufferAttribute(idx,1));sg.geo=geo;
  }
  syncStockGeo(true);
  stockMesh=new THREE.Mesh(sg.geo,MAT.stock);stockMesh.renderOrder=2;workGroup.add(stockMesh);
}
function syncStockGeo(full){
  const sg=S.sg;const pos=sg.geo.attributes.position.array;
  if(sg.type==='top'){const {nx,ny}=sg;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;pos[k*3]=sg.x0+i*sg.rx;pos[k*3+1]=sg.y0+j*sg.ry;pos[k*3+2]=sg.H[k];}
    if(full){sg.ring.forEach((a,k)=>{const q=(sg.nTop+k)*3;pos[q]=pos[a*3];pos[q+1]=pos[a*3+1];pos[q+2]=sg.zb;});}}
  else{const {nx,nt}=sg;for(let i=0;i<nx;i++){const x=sg.x0+i*sg.rx;for(let j=0;j<nt;j++){const k=i*nt+j,r=sg.Rg[k],th=j*sg.dT;pos[k*3]=x;pos[k*3+1]=r*Math.sin(th);pos[k*3+2]=r*Math.cos(th);}}
    const cA=nx*nt;pos[cA*3]=sg.x0;pos[cA*3+1]=0;pos[cA*3+2]=0;pos[cA*3+3]=sg.x0+(nx-1)*sg.rx;pos[cA*3+4]=0;pos[cA*3+5]=0;}
  sg.geo.attributes.position.needsUpdate=true;if(full)sg.geo.computeBoundingSphere();
}
function cutAt(T,a){
  const sg=S.sg,tl=tool();const R=tl.D/2;const {R:Re}=cutterRadii(tl);let dirty=false;
  if(sg.type==='top'){
    if(a[2]>0.9995){const i0=Math.max(0,Math.floor((T[0]-R-sg.x0)/sg.rx)),i1=Math.min(sg.nx-1,Math.ceil((T[0]+R-sg.x0)/sg.rx)),j0=Math.max(0,Math.floor((T[1]-R-sg.y0)/sg.ry)),j1=Math.min(sg.ny-1,Math.ceil((T[1]+R-sg.y0)/sg.ry));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=sg.x0+i*sg.rx,y=sg.y0+j*sg.ry;const d=Math.hypot(x-T[0],y-T[1]);if(d>R)continue;const z=T[2]+toolH(tl,d);const k=j*sg.nx+i;if(z<sg.H[k]){sg.H[k]=Math.max(z,sg.zb);dirty=true;}}}
    else{const re=Math.max(Re,R*0.5);const nk=Math.max(1,Math.min(10,Math.ceil(Math.max(0,sg.z0-T[2])/re)+1));
      for(let s=0;s<nk;s++){const C=V.madd(T,a,re*(1+s));const i0=Math.max(0,Math.floor((C[0]-re-sg.x0)/sg.rx)),i1=Math.min(sg.nx-1,Math.ceil((C[0]+re-sg.x0)/sg.rx)),j0=Math.max(0,Math.floor((C[1]-re-sg.y0)/sg.ry)),j1=Math.min(sg.ny-1,Math.ceil((C[1]+re-sg.y0)/sg.ry));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=sg.x0+i*sg.rx,y=sg.y0+j*sg.ry;const d2=(x-C[0])**2+(y-C[1])**2;if(d2>re*re)continue;const z=C[2]-Math.sqrt(re*re-d2);const k=j*sg.nx+i;if(z<sg.H[k]){sg.H[k]=Math.max(z,sg.zb);dirty=true;}}}}
  }else{
    const rt=Math.hypot(T[1],T[2]),tht=Math.atan2(T[1],T[2]);const u=[0,Math.sin(tht),Math.cos(tht)];
    if(Math.abs(a[0])<0.02&&V.dot(a,u)>0.999){
      const i0=Math.max(0,Math.floor((T[0]-R-sg.x0)/sg.rx)),i1=Math.min(sg.nx-1,Math.ceil((T[0]+R-sg.x0)/sg.rx));const w=Math.ceil(Math.asin(Math.min(1,R/Math.max(rt,R)))/sg.dT)+1;const jc=Math.round(((tht%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/sg.dT);
      for(let i=i0;i<=i1;i++){const dx=sg.x0+i*sg.rx-T[0];for(let dj=-w;dj<=w;dj++){const j=((jc+dj)%sg.nt+sg.nt)%sg.nt;const k=i*sg.nt+j;const th=j*sg.dT;let D=th-tht;D=Math.atan2(Math.sin(D),Math.cos(D));const cD=Math.cos(D);if(cD<0.05)continue;const r0=sg.Rg[k];const y=r0*Math.sin(D);const d=Math.hypot(dx,y);if(d>R)continue;const rn=(rt+toolH(tl,d))/cD;if(rn<r0){sg.Rg[k]=Math.max(rn,0);dirty=true;}}}
    }else{
      const re=Math.max(Re,R*0.5);const rStock=S.stock.r;const nk=Math.max(1,Math.min(12,Math.ceil(Math.max(0,rStock-rt)/re)+1));
      for(let sI=0;sI<nk;sI++){const C=V.madd(T,a,re*(1+sI));const rc=Math.hypot(C[1],C[2]),thc=Math.atan2(C[1],C[2]);
      const i0=Math.max(0,Math.floor((C[0]-re-sg.x0)/sg.rx)),i1=Math.min(sg.nx-1,Math.ceil((C[0]+re-sg.x0)/sg.rx));const w=Math.ceil(Math.asin(Math.min(1,re/Math.max(rc,re)))/sg.dT)+1;const jc=Math.round(((thc%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/sg.dT);
      for(let i=i0;i<=i1;i++){const x=sg.x0+i*sg.rx;for(let dj=-w;dj<=w;dj++){const j=((jc+dj)%sg.nt+sg.nt)%sg.nt;const k=i*sg.nt+j;const th=j*sg.dT,s=Math.sin(th),c=Math.cos(th);
        const b=-(C[1]*s+C[2]*c);const w0=(x-C[0])**2+C[1]**2+C[2]**2-re*re;const disc=b*b-w0;if(disc<0)continue;const sq=Math.sqrt(disc);const rin=-b-sq;const r0=sg.Rg[k];if(rin<r0&&(a[1]*s+a[2]*c)>0.2){sg.Rg[k]=Math.max(rin,0);dirty=true;}}}}
    }
  }
  return dirty;
}

/* ---- trayectoria visual ---- */
function buildPathObjects(){
  while(pathGroup.children.length){const c=pathGroup.children.pop();c.geometry.dispose();c.material.dispose();}
  const mv=S.moves;if(!mv||!mv.length)return;
  const cPath=new THREE.Color(cssVar('--path')),cRough=new THREE.Color(cssVar('--rough')),cWarn=new THREE.Color(cssVar('--warn')),cBad=new THREE.Color(cssVar('--bad')),cRapid=new THREE.Color(cssVar('--rapid'));
  const fp=[],fc=[],rp=[];
  for(let i=1;i<mv.length;i++){const a=mv[i-1].p,b=mv[i].p;
    if(mv[i].t==='R'){rp.push(...a,...b);continue;}
    const s=mv[i].st;const col=mv[i].kfail||s>=2?cBad:s===1?cWarn:mv[i].rough?cRough:cPath;fp.push(...a,...b);fc.push(col.r,col.g,col.b,col.r,col.g,col.b);}
  const g1=new THREE.BufferGeometry();g1.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));g1.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));
  pathGroup.add(new THREE.LineSegments(g1,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9})));
  const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));
  const rl=new THREE.LineSegments(g2,new THREE.LineDashedMaterial({color:cRapid,dashSize:1.5,gapSize:1.5,transparent:true,opacity:0.55}));rl.computeLineDistances();pathGroup.add(rl);
  // agujas de eje
  if(needleObj){workGroup.remove(needleObj);needleObj.geometry.dispose();}
  const feedIdx=[];for(let i=0;i<mv.length;i++)if(mv[i].t==='F')feedIdx.push(i);
  const every=Math.max(1,Math.ceil(feedIdx.length/1400));const np=[],nc=[];const Ln=Math.max(4,(S.M?.diag||100)*0.05);
  for(let q=0;q<feedIdx.length;q+=every){const m=mv[feedIdx[q]];const col=m.st===1?cWarn:m.st>=2?cBad:cPath;np.push(...m.p,...V.madd(m.p,m.a,Ln));nc.push(col.r,col.g,col.b,col.r,col.g,col.b);}
  const g3=new THREE.BufferGeometry();g3.setAttribute('position',new THREE.Float32BufferAttribute(np,3));g3.setAttribute('color',new THREE.Float32BufferAttribute(nc,3));
  needleObj=new THREE.LineSegments(g3,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.7}));workGroup.add(needleObj);
  applyVisibility();
}
function buildToolMesh(){
  while(toolGroup.children.length){const c=toolGroup.children.pop();c.geometry.dispose();}
  const tl=tool();const R=tl.D/2;const pts=[];const n=24;
  for(let i=0;i<=n;i++){const d=R*i/n;const h=toolH(tl,d);pts.push(new THREE.Vector2(Math.max(d,0.001),h));}
  pts.push(new THREE.Vector2(R,tl.fluteLen));pts.push(new THREE.Vector2(0.001,tl.fluteLen));
  const cut=new THREE.Mesh(new THREE.LatheGeometry(pts,40),MAT.cutter);cutterMesh=cut;toolGroup.add(cut);
  const shL=Math.max(0.5,tl.stickout-tl.fluteLen);const sh=new THREE.Mesh(new THREE.CylinderGeometry(tl.shankD/2,tl.shankD/2,shL,32),MAT.shank);sh.position.y=tl.fluteLen+shL/2;toolGroup.add(sh);
  const hg=new THREE.CylinderGeometry(tl.holderD/2,tl.holderD/2*0.72,tl.holderLen,40);holderMesh=new THREE.Mesh(hg,MAT.holder);holderMesh.position.y=tl.stickout+tl.holderLen/2;toolGroup.add(holderMesh);
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(tl.holderD*0.75,tl.holderD*0.75,40,40),MAT.fixture);sp.position.y=tl.stickout+tl.holderLen+20;toolGroup.add(sp);
  toolGroup.userData.holder=[holderMesh,sp];
  applyVisibility();
}
const VIS={part:true,stock:true,path:true,needles:false,holder:true,machine:false};
function applyVisibility(){
  if(partMesh)partMesh.visible=VIS.part;if(stockMesh)stockMesh.visible=VIS.stock;pathGroup.visible=VIS.path;if(needleObj)needleObj.visible=VIS.needles;
  (toolGroup.userData.holder||[]).forEach(o=>o.visible=VIS.holder);
}
function fitView(kind){
  if(!S.M)return;const M=S.M;const c=S.frame==='top'?[0,0,(M.bmin[2])/2]:[0,0,0];const d=M.diag*1.35+40;
  const dirs={iso:[0.62,-0.78,0.55],top:[0,-0.0001,1],front:[0,-1,0.12],side:[1,0,0.12]};const v=V.norm(dirs[kind]||dirs.iso);
  camera.position.set(c[0]+v[0]*d,c[1]+v[1]*d,c[2]+v[2]*d);controls.target.set(...c);controls.update();
}

/* =========================================================
   SIMULACIÓN
   ========================================================= */
const SIM={t:0,playing:false,mult:60,cutIdx:0,cutFrac:0,resetting:false};
function simTotal(){return S.moves&&S.moves.length?S.moves[S.moves.length-1].cum:0;}
function moveAt(t){const mv=S.moves;let lo=1,hi=mv.length-1;if(t<=0)return 0;while(lo<hi){const m=(lo+hi)>>1;if(mv[m].cum<t)lo=m+1;else hi=m;}return lo;}
function poseAt(t){
  const mv=S.moves;const i=moveAt(t);if(i===0)return{p:mv[0].p,a:mv[0].a,ang:mv[0].ang,i:0,f:1};
  const A=mv[i-1],B=mv[i];const dur=B.cum-A.cum;const f=dur>0?clamp((t-A.cum)/dur,0,1):1;
  return{p:V.lerp(A.p,B.p,f),a:V.norm(V.lerp(A.a,B.a,f)),ang:B.ang.map((v,q)=>A.ang[q]+(v-A.ang[q])*f),i,f};
}
function advanceCut(ti,tf,budget){
  // aplica remoción desde (cutIdx,cutFrac) hasta (ti,tf)
  const mv=S.moves,tl=tool();const step=Math.max(cutterRadii(tl).R*0.45,tl.D*0.15,0.2);let used=0,dirty=false;
  while(SIM.cutIdx<ti||(SIM.cutIdx===ti&&SIM.cutFrac<tf-1e-9)){
    const i=SIM.cutIdx;if(i<=0||i>=mv.length){SIM.cutIdx=Math.max(1,i+1);SIM.cutFrac=0;if(i>=mv.length)break;continue;}
    const B=mv[i],A=mv[i-1];const end=i<ti?1:tf;
    if(B.t==='R'){SIM.cutIdx++;SIM.cutFrac=0;continue;}
    const L=Math.max(B.len,V.dist(A.p,B.p));const n=Math.max(1,Math.ceil(L/step));
    let k=Math.floor(SIM.cutFrac*n);const kEnd=Math.ceil(end*n);
    for(;k<=kEnd&&k<=n;k++){const f=k/n;if(cutAt(V.lerp(A.p,B.p,f),V.norm(V.lerp(A.a,B.a,f))))dirty=true;used++;if(used>=budget){SIM.cutFrac=Math.min(1,(k+1)/n);if(dirty)syncStockGeo(false);return false;}}
    if(end>=1){SIM.cutIdx++;SIM.cutFrac=0;}else{SIM.cutFrac=end;break;}
  }
  if(dirty)syncStockGeo(false);return true;
}
function resetStockCut(){S.sg.H?.fill(S.stock.max?.[2]??0);if(S.sg.Rg)S.sg.Rg.fill(S.stock.r);syncStockGeo(false);SIM.cutIdx=1;SIM.cutFrac=0;}
let lastFrame=now();
let lastBusyRender=0;
function frame(){
  const t=now();
  if(S.busy){if(t-lastBusyRender<600)return;lastBusyRender=t;}
  const dt=Math.min(0.1,(t-lastFrame)/1000);lastFrame=t;
  if(S.moves&&S.moves.length>1){
    const tot=simTotal();
    if(SIM.playing){SIM.t=Math.min(tot,SIM.t+dt*SIM.mult/60);if(SIM.t>=tot)setPlaying(false);}
    const pose=poseAt(SIM.t);
    const done=advanceCut(pose.i,pose.f,SIM.playing?2500:6000);
    placeTool(pose);updateDRO(pose);
    if(!SIM.scrubbing)$('#simScrub').value=Math.round(SIM.t/tot*1000)||0;
    $('#simTime').textContent=`${fmtTime(SIM.t)} / ${fmtTime(tot)}`;
  }
  controls.update();renderer.render(scene,camera);
}
function placeTool(pose){
  const m=S.machine;let p=pose.p,a=pose.a;
  if(VIS.machine&&pose.ang&&m.kin!=='xyz'){
    const mm=kinMats(m.kin,pose.ang);const c=m.rc;const R=mm.R;
    const M4=new THREE.Matrix4().set(R[0],R[1],R[2],0,R[3],R[4],R[5],0,R[6],R[7],R[8],0,0,0,0,1);
    const T1=new THREE.Matrix4().makeTranslation(c[0],c[1],c[2]),T2=new THREE.Matrix4().makeTranslation(-c[0],-c[1],-c[2]);
    workGroup.matrix.copy(T1.multiply(M4).multiply(T2));p=V.add(m3v(R,V.sub(p,c)),c);a=mm.ha;
  }else workGroup.matrix.identity();
  workGroup.matrixWorldNeedsUpdate=true;
  toolGroup.position.set(p[0],p[1],p[2]);toolGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(a[0],a[1],a[2]));
  const mv=S.moves[pose.i];const hot=mv&&(mv.st>=2||mv.kfail)&&mv.t!=='R';
  if(cutterMesh)cutterMesh.material=hot?MAT.hot:MAT.cutter;if(holderMesh)holderMesh.material=hot?MAT.hot:MAT.holder;
}
function updateDRO(pose){
  const m=S.machine,tl=tool(),fd=feedsCalc();const axes=KIN_AXES[m.kin];const tcp=useTCP();
  const mm=kinMats(m.kin,pose.ang||[]);const pm=linearOut({p:pose.p,R:mm.R,ha:mm.ha},m,tl,tcp);
  const rows=[['X',pm[0]],['Y',pm[1]],['Z',pm[2]],...axes.map((a,q)=>[a,(pose.ang?.[q]||0)*(m.inv[q]?-1:1)])];
  const mv=S.moves[pose.i];const F=mv?.t==='R'?'RÁPIDO':(mv?.t==='P'?fd.plunge:fd.feed);
  rows.push(['F',F],['S',fd.rpm]);
  $('#droTable').innerHTML=rows.map(([k,v])=>`<tr><td class="ax">${k}</td><td class="v">${typeof v==='number'?(k==='F'||k==='S'?v:v.toFixed(3)):v}</td></tr>`).join('');
  $('#droMode').textContent=`T${tl.num} · ${tcp?'TCP':'MÁQ'}`;
  const ln=S.gcode?.lineOf?S.gcode.lines[S.gcode.lineOf[pose.i]]:null;$('#droLine').textContent=ln||'—';
}
function setPlaying(on){SIM.playing=on;$('#playIco').innerHTML=on?'<path d="M3 2h4v12H3zM9 2h4v12H9z"/>':'<path d="M4 2l10 6-10 6z"/>';
  if(on&&S.stock&&VIS.stock){MAT.stock.opacity=1;MAT.stock.transparent=false;MAT.stock.depthWrite=true;MAT.stock.needsUpdate=true;}}
function stockSolid(on){MAT.stock.opacity=on?1:0.22;MAT.stock.transparent=!on;MAT.stock.depthWrite=on;MAT.stock.needsUpdate=true;}

/* =========================================================
   FLUJO: calcular, verificar, informe
   ========================================================= */
function setBusy(txt,f){const b=$('#busy');if(txt===null){b.hidden=true;return;}b.hidden=false;$('#busyText').textContent=txt;$('#busyBar').style.width=Math.round(clamp(f,0,1)*100)+'%';}
function compatError(){
  const k=S.strat.kind,kin=S.machine.kin;
  if(k==='rot4'&&!['xyza','ab_mixed'].includes(kin))return'La estrategia de 4 ejes necesita un eje rotativo A sobre X. Elige "4 ejes · rotativo A" o "5 ejes · rotativo A + cabezal B" en Máquina.';
  if((k==='top5'||k==='rot5')&&(kin==='xyz'||kin==='xyza'))return'Las estrategias de 5 ejes necesitan una máquina de 5 ejes. Cambia la cinemática en Máquina.';
  if((k==='top5'||k==='rot5')&&(tool().type==='vbit'||tool().type==='drill'))return'Para 5 ejes simultáneos usa una herramienta de bola, plana, toroidal o cónica de bola.';
  return null;
}
async function compute(){
  if(S.busy||!S.rawPos)return;const err=compatError();if(err){renderIssues([{sev:'err',title:'No se puede calcular',cause:err,fix:''}]);toast('Revisa la compatibilidad máquina / estrategia');return;}
  S.busy=true;$$('#btnCompute,#btnCompute2').forEach(b=>b.disabled=true);setPlaying(false);
  try{
    if(!S.M||S.frame!==frameOf(S.strat.kind)||S.partDirty){await preparePart();S.partDirty=false;}
    const tl=tool(),st=S.strat;let res;const t0=now();
    if(st.kind==='top3')res=await genTop3(tl,st);else if(st.kind==='rot4')res=await genRot4(tl,st);else res=await gen5(tl,st);
    setBusy('Enlazando pasadas y resolviendo ejes de máquina…',0.97);await tick();
    const moves=buildMoves(res,st);S.moves=moves;S.job={res,kind:st.kind,ms:now()-t0,toolId:tl.id};
    S.jobStats=annotateMoves(moves);
    S.gcode=postProcess();
    buildPathObjects();buildToolMesh();resetStockCut();stockSolid(false);SIM.t=0;
    S.stale=false;refreshOutputs();renderReport();
  }catch(e){console.error(e);renderIssues([{sev:'err',title:'Error al calcular',cause:String(e.message||e),fix:'Revisa la malla y los parámetros. Si el archivo es muy grande, simplifícalo.'}]);}
  finally{setBusy(null);S.busy=false;$$('#btnCompute,#btnCompute2').forEach(b=>b.disabled=false);updateStale();}
}
function refreshPost(){if(!S.moves)return;S.jobStats=annotateMoves(S.moves);S.gcode=postProcess();refreshOutputs();renderReport();}
function renderReport(){
  const js=S.jobStats,res=S.job?.res,m=S.machine,tl=tool(),fd=feedsCalc(),st=S.strat;if(!js||!res)return;
  const s5=res.stats5;const axes=KIN_AXES[m.kin];const feedPts=S.moves.filter(x=>x.t==='F').length;
  const collPts=S.moves.filter(x=>x.t!=='R'&&x.st>=2).length+ (st.skip&&s5?s5.coll:0);
  const k=[];
  k.push({l:'Tiempo estimado',v:fmtTime(js.total)});
  k.push({l:'Corte',v:`${nf(js.lenCut/1000,1)} m`});
  k.push({l:'Puntos de corte',v:feedPts.toLocaleString('es-MX')});
  k.push({l:'Líneas G-code',v:(S.gcode?.lines.length||0).toLocaleString('es-MX')});
  if(s5){k.push({l:'Reorientados',v:s5.adjusted.toLocaleString('es-MX'),c:s5.adjusted?'warn':'ok'});k.push({l:'Colisión sin resolver',v:(s5.coll).toLocaleString('es-MX'),c:s5.coll?'bad':'ok'});}
  else{const cc=S.job.res.passes.reduce((s,p)=>s+p.pts.filter(q=>q.st>=2).length,0);k.push({l:'Zanco / porta',v:cc?`${cc} pts`:'Libre',c:cc?'bad':'ok'});k.push({l:'Sin alcanzar',v:`${nf(res.unreachedPct,1)} %`,c:res.unreachedPct>2?'warn':'ok'});}
  axes.forEach((a,q)=>{const r=js.rng[q];k.push({l:`Rango ${a}`,v:Number.isFinite(r[0])?`${r[0].toFixed(0)}…${r[1].toFixed(0)}°`:'—'});});
  $('#kpis').innerHTML=k.map(x=>`<div class="kpi ${x.c||''}"><small>${x.l}</small><strong>${x.v}</strong></div>`).join('');
  const I=[];
  if(!S.M.closed)I.push({sev:'warn',title:'La malla tiene bordes abiertos',cause:`${S.M.open} aristas sin cerrar${S.M.nonman?` y ${S.M.nonman} no-manifold`:''}. Los rayos pueden atravesar huecos.`,fix:'Repara la malla o expórtala otra vez como sólido cerrado.'});
  const WHY={cutter:'el cortador (desbaste de la pieza)',flute:'la zona de filos',shank:'el zanco',holder:'el portaherramienta o la sujeción'};
  if(s5&&s5.coll)I.push({sev:'err',title:`${s5.coll} puntos con colisión sin resolver`,cause:`Toca ${Object.entries(s5.why||{}).map(([k,v])=>`${WHY[k]||k} (${v})`).join(', ')} aun inclinando hasta ${st.maxTilt}°.`,fix:`${st.skip?'Se omitieron del G-code. ':''}Aumenta el voladizo, usa un porta más delgado, sube la inclinación máxima o usa herramienta de cuello largo.`});
  if(s5&&s5.adjusted)I.push({sev:'info',title:`${s5.adjusted} puntos reorientados automáticamente`,cause:`Desvío promedio ${nf(s5.devSum/Math.max(1,s5.adjusted),1)}° respecto a la normal para librar la pieza.`,fix:'Revisa la zona en amarillo durante la simulación.'});
  if(s5&&s5.lim)I.push({sev:'err',title:`${s5.lim} puntos fuera de los límites rotativos`,cause:`La orientación requerida excede ${axes.map((a,q)=>`${a} ${m.rot[q][0]}…${m.rot[q][1]}°`).join(', ')}.`,fix:'Reduce la inclinación máxima, cambia la cinemática o reposiciona la pieza.'});
  if(!s5){const cc=res.passes.reduce((s,p)=>s+p.pts.filter(q=>q.st>=2).length,0);if(cc)I.push({sev:'err',title:`Zanco o portaherramienta tocan en ${cc} puntos`,cause:'La herramienta vertical no alcanza la profundidad sin que el zanco o el porta toquen material o sujeción.',fix:'Aumenta el voladizo o usa una herramienta más larga. En 4 ejes revisa la distancia al plato.'});
    if(res.unreachedPct>0.5)I.push({sev:'warn',title:`${nf(res.unreachedPct,1)} % de la superficie no se alcanza`,cause:`El diámetro de ${tl.D} mm no cabe en detalles más finos.`,fix:'Programa un repaso con una herramienta de menor diámetro o cónica de bola.'});}
  if(res.maxDepth>tl.fluteLen+0.1)I.push({sev:'warn',title:`Profundidad de ${nf(res.maxDepth,1)} mm mayor que la longitud de corte (${tl.fluteLen} mm)`,cause:'El zanco puede rozar las paredes en zonas profundas.',fix:'Usa desbaste por niveles y una herramienta con más longitud de corte.'});
  if(js.jumps)I.push({sev:'warn',title:`${js.jumps} saltos de eje rotativo mayores a 30°`,cause:'Paso cerca de una singularidad (herramienta paralela a un eje rotativo) o cambio de solución cinemática.',fix:'Activa el suavizado, agrega inclinación lateral o gira la pieza 90°.'});
  const out=[];['x','y','z'].forEach((a,c)=>{const L=m.lim[a],r=js.lin[c];if(r[0]<L[0]-1e-6||r[1]>L[1]+1e-6)out.push(`${a.toUpperCase()} ${nf(r[0],1)}…${nf(r[1],1)} (límite ${L[0]}…${L[1]})`);});
  if(out.length)I.push({sev:'err',title:'Movimientos fuera de recorrido',cause:out.join(' · '),fix:'Mueve el cero de pieza, revisa el pivote / centro de giro o usa una máquina con más recorrido.'});
  if(js.limFail)I.push({sev:'err',title:`${js.limFail} movimientos sin solución cinemática`,cause:'La orientación pedida no existe en esta máquina.',fix:'Cambia de cinemática o reduce la inclinación.'});
  if(fd.clampedRPM)I.push({sev:'warn',title:`RPM limitadas a ${m.maxRPM}`,cause:`La Vc pedida requiere más velocidad que la del husillo.`,fix:'El avance se recalculó con las RPM reales para mantener la carga por diente.'});
  if(fd.clampedFeed)I.push({sev:'warn',title:`Avance limitado a ${m.maxFeed} mm/min`,cause:'El avance calculado excede el máximo de la máquina.',fix:'La carga por diente real será menor que la indicada.'});
  if(axes.length>=1&&S.post.ctrl==='grbl')I.push({sev:'err',title:'GRBL estándar solo controla 3 ejes',cause:`Este trabajo usa ${axes.join(' y ')}.`,fix:'Usa grblHAL o FluidNC con eje A, o elige Mach3 / LinuxCNC.'});
  if(axes.length&&!useTCP())I.push({sev:'info',title:'Coordenadas de máquina calculadas por el post',cause:`${CTRL[S.post.ctrl].name}${m.tcp?' no ofrece TCP en este post':' sin TCP'}: X, Y, Z ya incluyen ${isHeadKin(m.kin)?`el pivote (${m.pivot+tl.stickout+tl.holderLen} mm)`:'el centro de giro'}.`,fix:'Si cambias de herramienta o voladizo, vuelve a generar el G-code.'});
  if(!I.some(x=>x.sev==='err'||x.sev==='warn'))I.unshift({sev:'ok',title:'Sin problemas detectados',cause:`Calculado en ${nf(S.job.ms/1000,1)} s con ${S.cloudN.toLocaleString('es-MX')} puntos de verificación.`,fix:''});
  renderIssues(I);
  const ok=!I.some(x=>x.sev==='err');$('#jobState').className='pill '+(ok?(I.some(x=>x.sev==='warn')?'warn':'ok'):'bad');$('#jobState').textContent=ok?'Trayectoria lista':'Revisar antes de cortar';
}
function renderIssues(I){$('#issues').innerHTML=I.map(x=>`<li class="${x.sev}"><b>${x.title}</b>${x.cause?`<p><em>Causa</em>${x.cause}</p>`:''}${x.fix?`<p><em>Corrección</em>${x.fix}</p>`:''}</li>`).join('');}
function updateStale(){const b=[$('#btnCompute'),$('#btnCompute2')];b.forEach(x=>x.classList.toggle('stale',S.stale));if(S.stale&&S.moves){$('#jobState').className='pill warn';$('#jobState').textContent='Parámetros cambiados · recalcula';}}
function markStale(){S.stale=true;updateStale();}
