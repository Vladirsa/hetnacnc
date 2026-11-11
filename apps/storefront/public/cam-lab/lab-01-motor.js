'use strict';
/* ---- Conexión con la tienda (Medusa) ---- */
const QS=new URLSearchParams(location.search);
const HETNA={backend:(QS.get('backend')||'').replace(/\/$/,''),key:QS.get('key')||'',embedded:window.parent!==window};
const HETNA_ON=!!(HETNA.backend&&HETNA.key);
/* =========================================================
   HETNA CAM LAB — motor CAM en navegador
   Módulos: geometría · herramientas · cinemática · estrategias
            anticolisión · enlaces · posprocesadores · simulación
   ========================================================= */
const DEG=Math.PI/180, RAD=180/Math.PI;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const tick=()=>new Promise(r=>setTimeout(r,0));
const now=()=>performance.now();
const V={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  madd:(a,b,s)=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]},
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),
};
const angBetween=(a,b)=>Math.acos(clamp(V.dot(a,b),-1,1));
function perpOf(a){const t=Math.abs(a[0])<0.9?[1,0,0]:[0,1,0];return V.norm(V.cross(a,t));}
function slerpDir(a,b,t){const w=angBetween(a,b);if(w<1e-6)return a.slice();if(w>Math.PI-1e-3){const p=perpOf(a);const m=w*t;return V.norm(V.add(V.mul(a,Math.cos(m)),V.mul(p,Math.sin(m))));}const s=Math.sin(w);return V.norm(V.add(V.mul(a,Math.sin((1-t)*w)/s),V.mul(b,Math.sin(t*w)/s)));}
function cssVar(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#888';}
function fmtTime(min){if(!Number.isFinite(min))return '—';const s=Math.round(min*60);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${m}:${String(ss).padStart(2,'0')}`;}
const nf=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200);}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

/* ---------------- Datos de referencia ---------------- */
const MATERIALS={
  mdf:{name:'MDF',vc:[300,600],fz6:[0.10,0.25]},
  pino:{name:'Pino / madera blanda',vc:[300,600],fz6:[0.10,0.25]},
  dura:{name:'Parota, cedro, caoba',vc:[250,500],fz6:[0.08,0.20]},
  acrilico:{name:'Acrílico (PMMA)',vc:[150,300],fz6:[0.05,0.12]},
  hdpe:{name:'HDPE / PVC',vc:[200,400],fz6:[0.08,0.18]},
  aluminio:{name:'Aluminio 6061',vc:[150,300],fz6:[0.03,0.06]},
  laton:{name:'Latón',vc:[100,200],fz6:[0.03,0.06]},
  acero:{name:'Acero 1018 / 1045',vc:[80,150],fz6:[0.02,0.05]},
  cera:{name:'Cera / espuma de modelado',vc:[300,600],fz6:[0.10,0.30]},
};
const CTRL={
  mach3:{name:'Mach3',tcp:false,maxAxes:6,style:'iso',comment:'paren'},
  mach4:{name:'Mach4',tcp:false,maxAxes:6,style:'iso',comment:'paren'},
  linuxcnc:{name:'LinuxCNC',tcp:true,maxAxes:9,style:'iso',comment:'paren'},
  grbl:{name:'GRBL (3 ejes)',tcp:false,maxAxes:3,style:'iso',comment:'paren'},
  fanuc:{name:'Fanuc (G43.4)',tcp:true,maxAxes:9,style:'iso',comment:'paren'},
  haas:{name:'Haas (G234)',tcp:true,maxAxes:9,style:'iso',comment:'paren'},
  siemens:{name:'Siemens 840D (TRAORI)',tcp:true,maxAxes:9,style:'iso',comment:'semi'},
  heidenhain:{name:'Heidenhain TNC (M128)',tcp:true,maxAxes:9,style:'heid',comment:'semi'},
  // Perfiles que parten de uno de los dialectos de arriba (base) y cambian lo que su control no acepta.
  // Son puntos de partida: cada uno se confirma en máquina con el registro de "programas probados".
  uccnc:{name:'UCCNC',base:'mach3',ext:'nc',tcp:false,maxAxes:6,style:'iso',comment:'paren'},
  planetcnc:{name:'PlanetCNC',base:'mach3',ext:'nc',tcp:false,maxAxes:6,style:'iso',comment:'paren'},
  eding:{name:'EdingCNC',base:'mach3',ext:'nc',tcp:false,maxAxes:6,style:'iso',comment:'paren'},
  masso:{name:'MASSO G3',base:'mach3',ext:'nc',tcp:false,maxAxes:5,style:'iso',comment:'paren'},
  acorn:{name:'Centroid Acorn / CNC12',base:'mach3',ext:'nc',tcp:false,maxAxes:4,style:'iso',comment:'paren'},
  ddcs:{name:'DDCS V3 / V4 / Expert (autónomo)',base:'mach3',ext:'nc',tcp:false,maxAxes:5,style:'iso',comment:'paren',noG43:true},
  ncstudio:{name:'Weihong NcStudio',base:'mach3',ext:'nc',tcp:false,maxAxes:4,style:'iso',comment:'paren',noG43:true,manualTC:true},
  dsp:{name:'DSP de mano: RichAuto A11 / B11 / A18, Weihong NK105',base:'grbl',ext:'nc',tcp:false,maxAxes:4,style:'iso',comment:'paren',noComments:true,noCool:true,header:'G21 G90 G17',noG54:true,
    note:'Formato mínimo: sin comentarios, sin cambio de herramienta, sin G43 ni refrigerante. Estos controles fijan la velocidad de los rápidos en el mando, y algunos ignoran la F del programa: revisa el avance en el mando.'},
  fluidnc:{name:'FluidNC / grblHAL (4 ejes o más)',base:'grbl',ext:'nc',tcp:false,maxAxes:6,style:'iso',comment:'paren'},
  marlin:{name:'Marlin (MPCNC, LowRider, impresora convertida)',base:'grbl',ext:'gcode',tcp:false,maxAxes:3,style:'iso',comment:'semi',noCool:true,header:'G21 G90',noG54:true,end:'',
    note:'Marlin no conoce M6 ni M30: el programa termina apagando el husillo. Si tu husillo no se controla desde la tarjeta, enciéndelo a mano.'},
  rrf:{name:'Duet / RepRapFirmware (modo CNC)',base:'grbl',ext:'gcode',tcp:false,maxAxes:4,style:'iso',comment:'semi',header:'G21 G90 G17',end:'',
    note:'Requiere el modo CNC (M453) en la configuración de la tarjeta.'},
  syntec:{name:'Syntec',base:'fanuc',ext:'nc',tcp:true,maxAxes:9,style:'iso',comment:'paren'},
  mitsubishi:{name:'Mitsubishi M70 / M80',base:'fanuc',ext:'nc',tcp:true,maxAxes:9,style:'iso',comment:'paren'},
  mazak:{name:'Mazak (modo EIA / ISO)',base:'fanuc',ext:'eia',tcp:true,maxAxes:9,style:'iso',comment:'paren'},
  gsk:{name:'GSK 980 / 218 / 25i',base:'fanuc',ext:'nc',tcp:false,maxAxes:5,style:'iso',comment:'paren'},
};
const CTRL_EXT={mach3:'tap',mach4:'tap',linuxcnc:'ngc',grbl:'nc',fanuc:'nc',haas:'nc',siemens:'mpf',heidenhain:'h'};
const dialOf=k=>(CTRL[k]&&CTRL[k].base)||k;           // dialecto del que parte un perfil
const extOf=k=>(CTRL[k]&&CTRL[k].ext)||CTRL_EXT[dialOf(k)]||'nc';
const g94Rot=k=>['mach3','mach4','grbl'].includes(dialOf(k)); // miden el bloque con eje rotativo como hipot(mm, grados)
const INF=100000;
const MACHINES={
  r3:{name:'Router 3 ejes',kin:'xyz',ctrl:'mach3',lim:{x:[-400,400],y:[-300,300],z:[-150,60]},rot:[[-INF,INF],[-INF,INF]],inv:[false,false],pivot:0,tcp:false,rc:[0,0,0],maxRPM:24000,maxFeed:10000,rapid:8000},
  r4:{name:'Router 4 ejes con eje A',kin:'xyza',ctrl:'mach3',lim:{x:[-400,400],y:[-150,150],z:[-40,160]},rot:[[-INF,INF],[-INF,INF]],inv:[false,false],pivot:0,tcp:false,rc:[0,0,0],maxRPM:24000,maxFeed:8000,rapid:6000},
  ab:{name:'5 ejes: rotativo A + cabezal B',kin:'ab_mixed',ctrl:'mach3',lim:{x:[-300,300],y:[-150,150],z:[-60,200]},rot:[[-INF,INF],[-95,95]],inv:[false,false],pivot:95,tcp:false,rc:[0,0,0],maxRPM:24000,maxFeed:6000,rapid:6000},
  ac:{name:'5 ejes: mesa basculante AC',kin:'ac_table',ctrl:'linuxcnc',lim:{x:[-250,250],y:[-200,200],z:[-150,150]},rot:[[-30,120],[-INF,INF]],inv:[false,false],pivot:0,tcp:true,rc:[0,0,0],maxRPM:24000,maxFeed:6000,rapid:8000},
  bc:{name:'5 ejes: mesa basculante BC',kin:'bc_table',ctrl:'fanuc',lim:{x:[-250,250],y:[-200,200],z:[-150,150]},rot:[[-110,110],[-INF,INF]],inv:[false,false],pivot:0,tcp:true,rc:[0,0,0],maxRPM:18000,maxFeed:8000,rapid:15000},
  r3g:{name:'Router 3 ejes de escritorio (GRBL)',kin:'xyz',ctrl:'grbl',lim:{x:[-150,150],y:[-150,150],z:[-60,40]},rot:[[-INF,INF],[-INF,INF]],inv:[false,false],pivot:0,tcp:false,rc:[0,0,0],maxRPM:12000,maxFeed:2500,rapid:3000},
  r3l:{name:'Router 3 ejes 1300×2500 (LinuxCNC)',kin:'xyz',ctrl:'linuxcnc',lim:{x:[-1250,1250],y:[-650,650],z:[-200,80]},rot:[[-INF,INF],[-INF,INF]],inv:[false,false],pivot:0,tcp:false,rc:[0,0,0],maxRPM:24000,maxFeed:15000,rapid:20000},
  vmc:{name:'Centro de maquinado 3 ejes (Fanuc)',kin:'xyz',ctrl:'fanuc',lim:{x:[-380,380],y:[-200,200],z:[-400,100]},rot:[[-INF,INF],[-INF,INF]],inv:[false,false],pivot:0,tcp:false,rc:[0,0,0],maxRPM:10000,maxFeed:10000,rapid:24000},
  vmc4:{name:'Centro de maquinado con 4º eje A (Haas)',kin:'xyza',ctrl:'haas',lim:{x:[-380,380],y:[-200,200],z:[-150,300]},rot:[[-INF,INF],[-INF,INF]],inv:[false,false],pivot:0,tcp:false,rc:[0,0,0],maxRPM:8000,maxFeed:10000,rapid:20000},
  hh:{name:'5 ejes: cabezal horquilla BC',kin:'bc_head',ctrl:'siemens',lim:{x:[-1000,1000],y:[-600,600],z:[-200,400]},rot:[[-100,100],[-INF,INF]],inv:[false,false],pivot:120,tcp:true,rc:[0,0,0],maxRPM:24000,maxFeed:12000,rapid:20000},
};
const KIN_AXES={xyz:[],xyza:['A'],ab_mixed:['A','B'],ac_table:['A','C'],bc_table:['B','C'],bc_head:['B','C']};
const KIN_NAME={xyz:'3 ejes XYZ',xyza:'4 ejes A',ab_mixed:'5 ejes A+B',ac_table:'5 ejes mesa AC',bc_table:'5 ejes mesa BC',bc_head:'5 ejes cabezal BC'};
const DEFAULT_TOOLS=[
  {id:1,num:1,name:'Bola 6 mm 2F carburo',type:'ball',D:6,r:3,angle:90,tipD:1,taper:3,flutes:2,fluteLen:22,stickout:40,shankD:6,holderD:30,holderLen:36},
  {id:2,num:2,name:'Plana 6 mm 3F',type:'flat',D:6,r:0,angle:90,tipD:1,taper:3,flutes:3,fluteLen:20,stickout:35,shankD:6,holderD:30,holderLen:36},
  {id:3,num:3,name:'Toroidal 10 mm R1',type:'bull',D:10,r:1,angle:90,tipD:1,taper:3,flutes:4,fluteLen:25,stickout:45,shankD:10,holderD:34,holderLen:40},
  {id:4,num:4,name:'Cónica de bola R0.8 · 3.6°',type:'taperball',D:6.35,r:0.8,angle:90,tipD:1.6,taper:3.6,flutes:2,fluteLen:25,stickout:38,shankD:6.35,holderD:30,holderLen:36},
  {id:5,num:5,name:'V 90° · 12 mm',type:'vbit',D:12,r:0,angle:90,tipD:0,taper:3,flutes:2,fluteLen:8,stickout:30,shankD:6.35,holderD:30,holderLen:36},
  {id:6,num:6,name:'Broca 5 mm 118°',type:'drill',D:5,r:0,angle:118,tipD:0,taper:3,flutes:2,fluteLen:40,stickout:55,shankD:5,holderD:30,holderLen:36},
  {id:7,num:7,name:'Bola 3 mm cuello largo',type:'ball',D:3,r:1.5,angle:90,tipD:1,taper:3,flutes:2,fluteLen:9,stickout:32,shankD:3,holderD:22,holderLen:30},
  {id:8,num:8,name:'Plana 3.175 mm (1/8") 2F',type:'flat',D:3.175,r:0,angle:90,tipD:1,taper:3,flutes:2,fluteLen:12,stickout:22,shankD:3.175,holderD:22,holderLen:30},
  {id:9,num:9,name:'Plana 12 mm 3F desbaste',type:'flat',D:12,r:0,angle:90,tipD:1,taper:3,flutes:3,fluteLen:30,stickout:50,shankD:12,holderD:40,holderLen:42},
  {id:10,num:10,name:'Bola 10 mm 2F',type:'ball',D:10,r:5,angle:90,tipD:1,taper:3,flutes:2,fluteLen:30,stickout:50,shankD:10,holderD:34,holderLen:40},
  {id:11,num:11,name:'Bola 1.5 mm detalle',type:'ball',D:1.5,r:0.75,angle:90,tipD:1,taper:3,flutes:2,fluteLen:5,stickout:20,shankD:3.175,holderD:22,holderLen:30},
  {id:12,num:12,name:'Cónica de bola R0.5 · 5°',type:'taperball',D:6,r:0.5,angle:90,tipD:1,taper:5,flutes:2,fluteLen:20,stickout:35,shankD:6,holderD:30,holderLen:36},
  {id:13,num:13,name:'V 60° · 6 mm',type:'vbit',D:6,r:0,angle:60,tipD:0,taper:3,flutes:2,fluteLen:5,stickout:25,shankD:6,holderD:30,holderLen:36},
];

/* ---------------- Estado ---------------- */
const S={
  rawPos:null, partName:'', units:1, scale:1, rotSeq:[],
  M:null, frame:null, stock:null, cloudF:null, cloudC:null, fixtures:[],
  machine:JSON.parse(JSON.stringify(MACHINES.ab)), presetKey:'ab',
  tools:JSON.parse(JSON.stringify(DEFAULT_TOOLS)), toolId:1,
  feeds:{mat:'mdf',vc:450,fz:0.15,deff:false,plungePct:30},
  scl:[1,1,1], stk:null, sup:null, zero:{top:'tc',rot:'c'},
  strat:{kind:'rot5',pattern:'spiral',dir:'x',stepover:1.0,step:0.8,allow:0,lead:8,tilt:0,maxTilt:70,avoid:true,smooth:true,skip:true,clear:2,rough:false,rsd:3,rso:3,rallow:0.4,safe:8,
    pat3:'par',ang:0,cutdir:'zig',rpat:'same',rrot:'spiral',roughTool:0,faces:4,posCaras:4,posTilt:45,area:{on:false,x0:-50,x1:50,y0:-50,y1:50}},
  post:{ctrl:'mach3',cool:'M8',dec:3,prog:1000,lines:false,inv:false,out:'gcode',pre:'',end:''},
  job:null, moves:null, gcode:null, gcodeLines:null, stale:true, busy:false,
};
const tool=()=>S.tools.find(t=>t.id===S.toolId)||S.tools[0];
const STK_DEF=()=>({mode:'auto',sx:0,sy:0,sz:0,sd:0,sl:0,bar:'round',ox:0,oy:0,oz:0});
const SUP_DEF=()=>({l:{on:false,len:20,d:12},r:{on:false,len:20,d:12},tabs:{on:false,w:8,t:3}});
S.stk=STK_DEF();S.sup=SUP_DEF();
const ZERO_NAME={tc:'CENTRO ARRIBA DEL MATERIAL',tfl:'ESQUINA FRONTAL IZQUIERDA ARRIBA',bc:'CENTRO SOBRE LA MESA',bfl:'ESQUINA FRONTAL IZQUIERDA SOBRE LA MESA',c:'EJE DE GIRO AL CENTRO DE LA PIEZA',l:'EJE DE GIRO EN EL EXTREMO DEL PLATO',r:'EJE DE GIRO EN EL EXTREMO DEL CONTRAPUNTO'};
const zeroKey=()=>S.stock&&S.stock.type==='cyl'?S.zero.rot:S.zero.top;
// punto de la pieza que el operador pone como cero de trabajo (G54); las coordenadas del programa se miden desde ahí
function zeroOff(){
  const st=S.stock;if(!st)return[0,0,0];
  if(st.type==='cyl'){const k=S.zero.rot;return[k==='l'?st.x0:k==='r'?st.x1:0,0,0];}
  const k=S.zero.top,cor=k[1]==='f';
  return[cor?st.min[0]:(st.min[0]+st.max[0])/2,cor?st.min[1]:(st.min[1]+st.max[1])/2,k[0]==='b'?st.min[2]:st.max[2]];
}

/* =========================================================
   GEOMETRÍA: malla, rejilla de rayos, nube de puntos
   ========================================================= */
function buildMesh(pos){
  const nT=pos.length/9|0;
  const bmin=[Infinity,Infinity,Infinity],bmax=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<nT*9;i+=3){for(let c=0;c<3;c++){const v=pos[i+c];if(v<bmin[c])bmin[c]=v;if(v>bmax[c])bmax[c]=v;}}
  const diag=Math.hypot(bmax[0]-bmin[0],bmax[1]-bmin[1],bmax[2]-bmin[2])||1;
  const fn=new Float32Array(nT*3),area=new Float32Array(nT);
  const q=diag*2e-6+1e-9;const map=new Map();const vid=new Int32Array(nT*3);let nv=0;const acc=[];
  let vol=0,totalArea=0;
  for(let t=0;t<nT;t++){
    const o=t*9;
    const ax=pos[o],ay=pos[o+1],az=pos[o+2],bx=pos[o+3],by=pos[o+4],bz=pos[o+5],cx=pos[o+6],cy=pos[o+7],cz=pos[o+8];
    const ux=bx-ax,uy=by-ay,uz=bz-az,wx=cx-ax,wy=cy-ay,wz=cz-az;
    const nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;const l=Math.hypot(nx,ny,nz);
    area[t]=l/2;totalArea+=l/2;
    if(l>0){fn[t*3]=nx/l;fn[t*3+1]=ny/l;fn[t*3+2]=nz/l;}
    vol+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6;
    for(let k=0;k<3;k++){
      const x=pos[o+k*3],y=pos[o+k*3+1],z=pos[o+k*3+2];
      const key=Math.round(x/q)+'|'+Math.round(y/q)+'|'+Math.round(z/q);
      let id=map.get(key);if(id===undefined){id=nv++;map.set(key,id);acc.push(0,0,0);}
      vid[t*3+k]=id;acc[id*3]+=nx;acc[id*3+1]+=ny;acc[id*3+2]+=nz;
    }
  }
  // cierre de malla (aristas compartidas por 2 caras)
  const edges=new Map();
  for(let t=0;t<nT;t++){for(let k=0;k<3;k++){let a=vid[t*3+k],b=vid[t*3+(k+1)%3];if(a===b)continue;if(a>b){const s=a;a=b;b=s;}const key=a*nv+b;edges.set(key,(edges.get(key)||0)+1);}}
  let open=0,nonman=0;for(const c of edges.values()){if(c===1)open++;else if(c>2)nonman++;}
  // normales suaves por esquina
  const cn=new Float32Array(nT*9);const cosLim=Math.cos(40*DEG);
  for(let t=0;t<nT;t++){for(let k=0;k<3;k++){const id=vid[t*3+k];let sx=acc[id*3],sy=acc[id*3+1],sz=acc[id*3+2];const l=Math.hypot(sx,sy,sz)||1;sx/=l;sy/=l;sz/=l;
    const fx=fn[t*3],fy=fn[t*3+1],fz=fn[t*3+2];
    if(sx*fx+sy*fy+sz*fz>cosLim){cn[t*9+k*3]=sx;cn[t*9+k*3+1]=sy;cn[t*9+k*3+2]=sz;}else{cn[t*9+k*3]=fx;cn[t*9+k*3+1]=fy;cn[t*9+k*3+2]=fz;}}}
  const M={pos,nT,fn,cn,area,bmin,bmax,diag,closed:open===0&&nonman===0,open,nonman,vol:Math.abs(vol),totalArea,nv};
  buildTriGrid(M);
  return M;
}
/* Reparación de malla: suelda vértices, quita triángulos degenerados y repetidos,
   deja todas las caras mirando hacia afuera y tapa los huecos. Devuelve la malla
   nueva y qué se hizo; lo que no se pudo cerrar se dice. */
function repairMesh(pos){
  const nT=pos.length/9|0;const rep={welded:0,degenerate:0,duplicate:0,flipped:0,holes:0,holeTris:0,skipped:0};let par=null; // par[t]=1 si la cara t quedó al revés de como venía
  let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<nT*9;i+=3)for(let c=0;c<3;c++){const v=pos[i+c];if(v<mn[c])mn[c]=v;if(v>mx[c])mx[c]=v;}
  const diag=Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1;const q=Math.max(diag*2e-5,1e-6);
  // 1) soldar vértices casi iguales
  const map=new Map();const V3=[];const idOf=(x,y,z)=>{const k=Math.round(x/q)+'|'+Math.round(y/q)+'|'+Math.round(z/q);let id=map.get(k);if(id===undefined){id=V3.length/3;map.set(k,id);V3.push(x,y,z);}return id;};
  let tris=[];const seen=new Set();
  for(let t=0;t<nT;t++){const o=t*9;const a=idOf(pos[o],pos[o+1],pos[o+2]),b=idOf(pos[o+3],pos[o+4],pos[o+5]),c=idOf(pos[o+6],pos[o+7],pos[o+8]);
    if(a===b||b===c||a===c){rep.degenerate++;continue;}
    const ux=V3[b*3]-V3[a*3],uy=V3[b*3+1]-V3[a*3+1],uz=V3[b*3+2]-V3[a*3+2],wx=V3[c*3]-V3[a*3],wy=V3[c*3+1]-V3[a*3+1],wz=V3[c*3+2]-V3[a*3+2];
    if(Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx)<q*q*1e-3){rep.degenerate++;continue;}
    const key=[a,b,c].sort((x,y)=>x-y).join('|');if(seen.has(key)){rep.duplicate++;continue;}seen.add(key);tris.push(a,b,c);}
  rep.welded=nT*3-V3.length/3;
  const nV=()=>V3.length/3;
  const edgeKey=(a,b)=>a<b?a*4294967296+b:b*4294967296+a;
  // 2) orientación coherente: dos caras vecinas recorren su arista común en sentidos opuestos
  const orient=()=>{const n=tris.length/3;const adj=new Map();
    for(let t=0;t<n;t++)for(let k=0;k<3;k++){const key=edgeKey(tris[t*3+k],tris[t*3+(k+1)%3]);let l=adj.get(key);if(!l)adj.set(key,l=[]);l.push(t);}
    const done=new Uint8Array(n);const has=(t,a,b)=>{for(let k=0;k<3;k++)if(tris[t*3+k]===a&&tris[t*3+(k+1)%3]===b)return true;return false;};
    for(let s=0;s<n;s++){if(done[s])continue;const comp=[s];done[s]=1;
      for(let h=0;h<comp.length;h++){const t=comp[h];for(let k=0;k<3;k++){const a=tris[t*3+k],b=tris[t*3+(k+1)%3];const l=adj.get(edgeKey(a,b));if(l.length!==2)continue;const u=l[0]===t?l[1]:l[0];if(done[u])continue;
          if(has(u,a,b)){const x=tris[u*3+1];tris[u*3+1]=tris[u*3+2];tris[u*3+2]=x;if(par)par[u]^=1;}done[u]=1;comp.push(u);}}
      // la pieza entera hacia afuera: volumen con signo positivo
      let vol=0;for(const t of comp){const a=tris[t*3]*3,b=tris[t*3+1]*3,c=tris[t*3+2]*3;vol+=V3[a]*(V3[b+1]*V3[c+2]-V3[b+2]*V3[c+1])-V3[a+1]*(V3[b]*V3[c+2]-V3[b+2]*V3[c])+V3[a+2]*(V3[b]*V3[c+1]-V3[b+1]*V3[c]);}
      if(vol<0){for(const t of comp){const x=tris[t*3+1];tris[t*3+1]=tris[t*3+2];tris[t*3+2]=x;if(par)par[t]^=1;}}}
    return adj;};
  par=new Uint8Array(tris.length/3);let adj=orient();for(let i=0;i<par.length;i++)rep.flipped+=par[i];par=null;
  // 3) tapar huecos: cada hueco es un lazo de aristas con una sola cara
  const next=new Map();for(const [key,l] of adj){if(l.length!==1)continue;const t=l[0];for(let k=0;k<3;k++){const a=tris[t*3+k],b=tris[t*3+(k+1)%3];if(edgeKey(a,b)===key){let m=next.get(b);if(!m)next.set(b,m=[]);m.push(a);}}} // el tapón recorre la arista al revés: b→a
  const used=new Set();const loops=[];
  for(const [start,outs] of next){for(const first of outs){if(used.has(start+'>'+first))continue;let loop=[start],cur=first,ok=true;used.add(start+'>'+first);
      for(let guard=0;cur!==start;guard++){
        const k=loop.indexOf(cur);if(k>0)loops.push(loop.splice(k)); // el hueco se toca a sí mismo en este vértice: son dos huecos
        loop.push(cur);const o=next.get(cur);const nx=o&&o.find(v=>!used.has(cur+'>'+v));if(nx===undefined||guard>20000){ok=false;break;}used.add(cur+'>'+nx);cur=nx;}
      if(ok)loops.push(loop);else rep.skipped++;}}
  for(const loop of loops){{
      if(loop.length<3){rep.skipped++;continue;}
      rep.holes++;
      // se cierra cortando "orejas": el vértice de ángulo más cerrado se une con sus dos vecinos, sin vértices nuevos
      const P3=v=>[V3[v*3],V3[v*3+1],V3[v*3+2]];let N=[0,0,0];
      for(let i=0;i<loop.length;i++){const A=P3(loop[i]),B=P3(loop[(i+1)%loop.length]);N[0]+=(A[1]-B[1])*(A[2]+B[2]);N[1]+=(A[2]-B[2])*(A[0]+B[0]);N[2]+=(A[0]-B[0])*(A[1]+B[1]);}
      const L=loop.slice();
      while(L.length>3){let best=-1,bs=Infinity;const m=L.length;
        for(let i=0;i<m;i++){const A=P3(L[(i+m-1)%m]),B=P3(L[i]),C=P3(L[(i+1)%m]);const u=V.sub(A,B),w=V.sub(C,B);const lu=V.len(u),lw=V.len(w);if(lu<1e-12||lw<1e-12){best=i;break;}
          let sc=Math.acos(clamp(V.dot(u,w)/(lu*lw),-1,1));
          if(V.dot(V.cross(V.sub(B,A),V.sub(C,B)),N)<=0)sc+=10;         // oreja hacia adentro del hueco: solo si no hay otra
          if(adj.has(edgeKey(L[(i+m-1)%m],L[(i+1)%m])))sc+=100;           // esa arista ya existe: se evitaría una cara encimada
          if(sc<bs){bs=sc;best=i;}}
        const a0=L[(best+m-1)%m],b0=L[best],c0=L[(best+1)%m];tris.push(a0,b0,c0);rep.holeTris++;adj.set(edgeKey(a0,c0),[]);L.splice(best,1);}
      tris.push(L[0],L[1],L[2]);rep.holeTris++;}}
  if(rep.holes)adj=orient();
  let open=0;for(const l of adj.values())if(l.length===1)open++;rep.open=open;
  const out=new Float32Array(tris.length*3);for(let i=0;i<tris.length;i++){const v=tris[i]*3;out[i*3]=V3[v];out[i*3+1]=V3[v+1];out[i*3+2]=V3[v+2];}
  rep.changed=rep.degenerate+rep.duplicate+rep.flipped+rep.holes>0;rep.tris=tris.length/3;
  return{pos:out,rep};
}
function buildTriGrid(M){
  const pad=M.diag*1e-3+1e-3;
  const min=[M.bmin[0]-pad,M.bmin[1]-pad,M.bmin[2]-pad];
  const ext=[M.bmax[0]-M.bmin[0]+2*pad,M.bmax[1]-M.bmin[1]+2*pad,M.bmax[2]-M.bmin[2]+2*pad];
  const target=clamp(M.nT*1.2,1000,260000);
  let cs=Math.cbrt(ext[0]*ext[1]*ext[2]/target);
  const dims=ext.map(e=>clamp(Math.ceil(e/cs),1,160));
  cs=Math.max(ext[0]/dims[0],ext[1]/dims[1],ext[2]/dims[2]);
  const [nx,ny,nz]=[Math.ceil(ext[0]/cs),Math.ceil(ext[1]/cs),Math.ceil(ext[2]/cs)];
  const nC=nx*ny*nz;const cnt=new Int32Array(nC+1);const P=M.pos;
  const rng=(t)=>{const o=t*9;let x0=Math.min(P[o],P[o+3],P[o+6]),x1=Math.max(P[o],P[o+3],P[o+6]),y0=Math.min(P[o+1],P[o+4],P[o+7]),y1=Math.max(P[o+1],P[o+4],P[o+7]),z0=Math.min(P[o+2],P[o+5],P[o+8]),z1=Math.max(P[o+2],P[o+5],P[o+8]);
    return [clamp(Math.floor((x0-min[0])/cs),0,nx-1),clamp(Math.floor((x1-min[0])/cs),0,nx-1),clamp(Math.floor((y0-min[1])/cs),0,ny-1),clamp(Math.floor((y1-min[1])/cs),0,ny-1),clamp(Math.floor((z0-min[2])/cs),0,nz-1),clamp(Math.floor((z1-min[2])/cs),0,nz-1)];};
  const R=new Int32Array(M.nT*6);
  for(let t=0;t<M.nT;t++){const r=rng(t);R.set(r,t*6);for(let k=r[4];k<=r[5];k++)for(let j=r[2];j<=r[3];j++)for(let i=r[0];i<=r[1];i++)cnt[i+nx*(j+ny*k)+1]++;}
  for(let i=0;i<nC;i++)cnt[i+1]+=cnt[i];
  const items=new Int32Array(cnt[nC]);const fill=cnt.slice(0,nC);
  for(let t=0;t<M.nT;t++){const o=t*6;for(let k=R[o+4];k<=R[o+5];k++)for(let j=R[o+2];j<=R[o+3];j++)for(let i=R[o];i<=R[o+1];i++){items[fill[i+nx*(j+ny*k)]++]=t;}}
  M.grid={min,cs,nx,ny,nz,start:cnt,items,max:[min[0]+nx*cs,min[1]+ny*cs,min[2]+nz*cs]};
  M.mark=new Uint32Array(M.nT);M.stamp=1;
}
const HIT={t:0,tri:-1,u:0,v:0};
function raycast(M,ox,oy,oz,dx,dy,dz,tmax){
  const g=M.grid;let t0=0,t1=tmax;
  const o=[ox,oy,oz],d=[dx,dy,dz];
  for(let c=0;c<3;c++){
    if(Math.abs(d[c])<1e-12){if(o[c]<g.min[c]||o[c]>g.max[c])return false;}
    else{let ta=(g.min[c]-o[c])/d[c],tb=(g.max[c]-o[c])/d[c];if(ta>tb){const s=ta;ta=tb;tb=s;}if(ta>t0)t0=ta;if(tb<t1)t1=tb;if(t0>t1)return false;}
  }
  const cs=g.cs;
  let ix=clamp(Math.floor((ox+dx*t0-g.min[0])/cs),0,g.nx-1),iy=clamp(Math.floor((oy+dy*t0-g.min[1])/cs),0,g.ny-1),iz=clamp(Math.floor((oz+dz*t0-g.min[2])/cs),0,g.nz-1);
  const sx=dx>0?1:-1,sy=dy>0?1:-1,sz=dz>0?1:-1;
  const tdx=dx!==0?cs/Math.abs(dx):Infinity,tdy=dy!==0?cs/Math.abs(dy):Infinity,tdz=dz!==0?cs/Math.abs(dz):Infinity;
  let tmx=dx!==0?((g.min[0]+(ix+(dx>0?1:0))*cs)-ox)/dx:Infinity;
  let tmy=dy!==0?((g.min[1]+(iy+(dy>0?1:0))*cs)-oy)/dy:Infinity;
  let tmz=dz!==0?((g.min[2]+(iz+(dz>0?1:0))*cs)-oz)/dz:Infinity;
  if(++M.stamp>4e9){M.mark.fill(0);M.stamp=1;}
  const st=M.stamp,P=M.pos,mark=M.mark;let best=Infinity;
  for(let guard=0;guard<10000;guard++){
    const cell=ix+g.nx*(iy+g.ny*iz);
    for(let q=g.start[cell],e=g.start[cell+1];q<e;q++){
      const t=g.items[q];if(mark[t]===st)continue;mark[t]=st;
      const b=t*9;const ax=P[b],ay=P[b+1],az=P[b+2];
      const e1x=P[b+3]-ax,e1y=P[b+4]-ay,e1z=P[b+5]-az,e2x=P[b+6]-ax,e2y=P[b+7]-ay,e2z=P[b+8]-az;
      const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x;
      const det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-14)continue;
      const inv=1/det;const tx=ox-ax,ty=oy-ay,tz=oz-az;
      const u=(tx*px+ty*py+tz*pz)*inv;if(u<-1e-7||u>1+1e-7)continue;
      const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x;
      const v=(dx*qx+dy*qy+dz*qz)*inv;if(v<-1e-7||u+v>1+1e-7)continue;
      const tt=(e2x*qx+e2y*qy+e2z*qz)*inv;
      if(tt>=0&&tt<best&&tt<=tmax){best=tt;HIT.tri=t;HIT.u=u;HIT.v=v;}
    }
    const tExit=Math.min(tmx,tmy,tmz);
    if(best<=tExit||tExit>t1)break;
    if(tmx<=tmy&&tmx<=tmz){ix+=sx;if(ix<0||ix>=g.nx)break;tmx+=tdx;}
    else if(tmy<=tmz){iy+=sy;if(iy<0||iy>=g.ny)break;tmy+=tdy;}
    else{iz+=sz;if(iz<0||iz>=g.nz)break;tmz+=tdz;}
  }
  if(best===Infinity)return false;HIT.t=best;return true;
}
function hitNormal(M,dx,dy,dz){
  const t=HIT.tri,u=HIT.u,v=HIT.v,w=1-u-v,c=M.cn,b=t*9;
  let nx=c[b]*w+c[b+3]*u+c[b+6]*v,ny=c[b+1]*w+c[b+4]*u+c[b+7]*v,nz=c[b+2]*w+c[b+5]*u+c[b+8]*v;
  const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
  if(nx*dx+ny*dy+nz*dz>0){nx=-nx;ny=-ny;nz=-nz;}
  return [nx,ny,nz];
}
function surfacePoints(M,maxPts=260000){
  let s=clamp(M.diag/240,0.15,2.5);
  if(M.totalArea/(s*s)>maxPts)s=Math.sqrt(M.totalArea/maxPts);
  const rnd=mulberry(7);const out=[];const P=M.pos;const s2=s*s;
  for(let t=0;t<M.nT;t++){
    const n=Math.floor(M.area[t]/s2+rnd());const o=t*9;
    for(let k=0;k<n;k++){let a=rnd(),b=rnd();if(a+b>1){a=1-a;b=1-b;}const c=1-a-b;
      out.push(P[o]*c+P[o+3]*a+P[o+6]*b,P[o+1]*c+P[o+4]*a+P[o+7]*b,P[o+2]*c+P[o+5]*a+P[o+8]*b);}
    if(t%3===0)out.push((P[o]+P[o+3]+P[o+6])/3,(P[o+1]+P[o+4]+P[o+7])/3,(P[o+2]+P[o+5]+P[o+8])/3);
  }
  for(let i=0;i<P.length;i+=9)out.push(P[i],P[i+1],P[i+2]);
  return {pts:out,spacing:s};
}
function buildPointGrid(arr,cc){
  const n=arr.length/3|0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<n;i++)for(let c=0;c<3;c++){const v=arr[i*3+c];if(v<min[c])min[c]=v;if(v>max[c])max[c]=v;}
  for(let c=0;c<3;c++){min[c]-=1e-3;max[c]+=1e-3;}
  const dims=[0,1,2].map(c=>clamp(Math.ceil((max[c]-min[c])/cc),1,96));
  const cs=[0,1,2].map(c=>(max[c]-min[c])/dims[c]);
  const [nx,ny,nz]=dims;const nC=nx*ny*nz;const cnt=new Int32Array(nC+1);const cellOf=new Int32Array(n);
  for(let i=0;i<n;i++){const ix=Math.min(nx-1,Math.floor((arr[i*3]-min[0])/cs[0])),iy=Math.min(ny-1,Math.floor((arr[i*3+1]-min[1])/cs[1])),iz=Math.min(nz-1,Math.floor((arr[i*3+2]-min[2])/cs[2]));const c=ix+nx*(iy+ny*iz);cellOf[i]=c;cnt[c+1]++;}
  for(let i=0;i<nC;i++)cnt[i+1]+=cnt[i];
  const P=new Float32Array(n*3);const fill=cnt.slice(0,nC);
  for(let i=0;i<n;i++){const d=fill[cellOf[i]]++;P[d*3]=arr[i*3];P[d*3+1]=arr[i*3+1];P[d*3+2]=arr[i*3+2];}
  return {P,start:cnt,min,max,cs,nx,ny,nz,n};
}
function cellRange(G,lo,hi){
  return [clamp(Math.floor((lo[0]-G.min[0])/G.cs[0]),0,G.nx-1),clamp(Math.floor((hi[0]-G.min[0])/G.cs[0]),0,G.nx-1),
          clamp(Math.floor((lo[1]-G.min[1])/G.cs[1]),0,G.ny-1),clamp(Math.floor((hi[1]-G.min[1])/G.cs[1]),0,G.ny-1),
          clamp(Math.floor((lo[2]-G.min[2])/G.cs[2]),0,G.nz-1),clamp(Math.floor((hi[2]-G.min[2])/G.cs[2]),0,G.nz-1)];
}
function sphereHit(G,cx,cy,cz,r){
  if(r<=0)return false;
  if(cx+r<G.min[0]||cx-r>G.max[0]||cy+r<G.min[1]||cy-r>G.max[1]||cz+r<G.min[2]||cz-r>G.max[2])return false;
  const R=cellRange(G,[cx-r,cy-r,cz-r],[cx+r,cy+r,cz+r]);const r2=r*r,P=G.P;
  for(let k=R[4];k<=R[5];k++)for(let j=R[2];j<=R[3];j++){const base=G.nx*(j+G.ny*k);
    for(let q=G.start[base+R[0]],e=G.start[base+R[1]+1];q<e;q++){const dx=P[q*3]-cx,dy=P[q*3+1]-cy,dz=P[q*3+2]-cz;if(dx*dx+dy*dy+dz*dz<r2)return true;}}
  return false;
}
function cylHit(G,A,d,h0,h1,r){
  if(r<=0||h1<=h0)return false;
  const p0=V.madd(A,d,h0),p1=V.madd(A,d,h1);
  const lo=[Math.min(p0[0],p1[0])-r,Math.min(p0[1],p1[1])-r,Math.min(p0[2],p1[2])-r],hi=[Math.max(p0[0],p1[0])+r,Math.max(p0[1],p1[1])+r,Math.max(p0[2],p1[2])+r];
  if(hi[0]<G.min[0]||lo[0]>G.max[0]||hi[1]<G.min[1]||lo[1]>G.max[1]||hi[2]<G.min[2]||lo[2]>G.max[2])return false;
  const R=cellRange(G,lo,hi);const r2=r*r,P=G.P,ax=A[0],ay=A[1],az=A[2],dx=d[0],dy=d[1],dz=d[2];
  for(let k=R[4];k<=R[5];k++)for(let j=R[2];j<=R[3];j++){const base=G.nx*(j+G.ny*k);
    for(let q=G.start[base+R[0]],e=G.start[base+R[1]+1];q<e;q++){
      const wx=P[q*3]-ax,wy=P[q*3+1]-ay,wz=P[q*3+2]-az;const s=wx*dx+wy*dy+wz*dz;if(s<h0||s>h1)continue;
      if(wx*wx+wy*wy+wz*wz-s*s<r2)return true;}}
  return false;
}

/* =========================================================
   HERRAMIENTAS: perfil y radios efectivos
   ========================================================= */
function toolH(tl,d){ // altura del filo sobre la punta a distancia radial d (herramienta vertical)
  const R=tl.D/2;if(d>R+1e-9)return Infinity;let h;
  switch(tl.type){
    case 'ball':h=R-Math.sqrt(Math.max(0,R*R-d*d));break;
    case 'flat':h=0;break;
    case 'bull':{const r=Math.min(tl.r,R),e=R-r;if(d<=e)h=0;else{const q=d-e;h=r-Math.sqrt(Math.max(0,r*r-q*q));}break;}
    case 'vbit':case 'drill':h=d/Math.tan(clamp(tl.angle,1,179)/2*DEG);break;
    case 'taperball':{const rt=Math.min(tl.tipD/2,R),a=clamp(tl.taper,0.1,45)*DEG,d0=rt*Math.cos(a);if(d<=d0)h=rt-Math.sqrt(Math.max(0,rt*rt-d*d));else h=rt-rt*Math.sin(a)+(d-d0)/Math.tan(a);break;}
    default:h=0;
  }
  return Math.min(h,tl.fluteLen);
}
function toolRadiusAt(tl,h){let lo=0,hi=tl.D/2;if(toolH(tl,hi)<=h)return hi;for(let i=0;i<28;i++){const m=(lo+hi)/2;if(toolH(tl,m)<=h)lo=m;else hi=m;}return lo;}
function cutterRadii(tl){
  switch(tl.type){case 'ball':return{R:tl.D/2,r:tl.D/2};case 'flat':return{R:tl.D/2,r:0};case 'bull':return{R:tl.D/2,r:Math.min(tl.r,tl.D/2)};case 'taperball':return{R:tl.tipD/2,r:tl.tipD/2};default:return{R:0,r:0};}
}
function tipFromContact(P,n,a,tl){
  const {R,r}=cutterRadii(tl);let u=V.sub(n,V.mul(a,V.dot(n,a)));const ul=V.len(u);u=ul>1e-6?V.mul(u,1/ul):[0,0,0];
  return [P[0]+n[0]*r-a[0]*r+u[0]*(R-r),P[1]+n[1]*r-a[1]*r+u[1]*(R-r),P[2]+n[2]*r-a[2]*r+u[2]*(R-r)];
}
const toolById=id=>S.tools.find(t=>t.id===id)||tool();
// Con otra fresa (la de desbaste) se conserva la velocidad de corte y la carga de viruta
// se escala con el diámetro: una fresa más gruesa admite más avance por filo.
function feedsCalc(tl=tool()){
  const m=S.machine,main=tool(),fzK=tl.id===main.id?1:clamp(tl.D/Math.max(main.D,0.1),0.3,3),f={...S.feeds,fz:S.feeds.fz*fzK};
  let D=tl.D;if(tl.type==='taperball')D=tl.tipD;
  let Dc=D, note='';
  const {R}=cutterRadii(tl);
  const ap=Math.max(0.05,S.strat.stepover*0.5);
  let deffInfo=null;
  if((tl.type==='ball'||tl.type==='taperball')&&R>0){
    const Db=2*R;const apc=Math.min(ap,Db/2);const base=Math.acos(clamp(1-2*apc/Db,-1,1));
    const d0=Db*Math.sin(base);const beta=(S.strat.kind==='top5'||S.strat.kind==='rot5')?Math.abs(S.strat.lead)*DEG:0;const d1=Db*Math.sin(clamp(base+beta,0,Math.PI/2));
    deffInfo={d0,d1,beta:beta*RAD};if(f.deff)Dc=Math.max(d1,0.05);
  }
  let rpm=f.vc*1000/(Math.PI*Dc);let clampedRPM=false;if(rpm>m.maxRPM){rpm=m.maxRPM;clampedRPM=true;}
  let feed=rpm*tl.flutes*f.fz;let clampedFeed=false;if(feed>m.maxFeed){feed=m.maxFeed;clampedFeed=true;}
  const plunge=feed*clamp(f.plungePct||30,5,100)/100;
  return {rpm:Math.round(rpm),feed:Math.round(feed),plunge:Math.round(plunge),clampedRPM,clampedFeed,deffInfo,vcReal:Math.PI*Dc*rpm/1000};
}

/* =========================================================
   CINEMÁTICA
   ========================================================= */
const I3=[1,0,0,0,1,0,0,0,1];
const Rx=t=>{const c=Math.cos(t),s=Math.sin(t);return[1,0,0,0,c,-s,0,s,c];};
const Ry=t=>{const c=Math.cos(t),s=Math.sin(t);return[c,0,s,0,1,0,-s,0,c];};
const Rz=t=>{const c=Math.cos(t),s=Math.sin(t);return[c,-s,0,s,c,0,0,0,1];};
function m3(a,b){const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return r;}
const m3v=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
function kinMats(kin,ang){
  switch(kin){
    case 'xyza':return{R:Rx(ang[0]*DEG),ha:[0,0,1]};
    case 'ab_mixed':{const b=ang[1]*DEG;return{R:Rx(ang[0]*DEG),ha:[Math.sin(b),0,Math.cos(b)]};}
    case 'ac_table':return{R:m3(Rx(ang[0]*DEG),Rz(ang[1]*DEG)),ha:[0,0,1]};
    case 'bc_table':return{R:m3(Ry(ang[0]*DEG),Rz(ang[1]*DEG)),ha:[0,0,1]};
    case 'bc_head':{const b=ang[0]*DEG,c=ang[1]*DEG;return{R:I3,ha:[Math.sin(b)*Math.cos(c),Math.sin(b)*Math.sin(c),Math.cos(b)]};}
    default:return{R:I3,ha:[0,0,1]};
  }
}
function kinSolve(m,a,prev){
  const [i,j,k]=a;const kin=m.kin;let cands;const at=Math.atan2;
  if(kin==='xyz'){if(k<0.99995)return null;return{ang:[],R:I3,ha:[0,0,1]};}
  if(kin==='xyza'){if(Math.abs(i)>2e-3)return null;const rho=Math.hypot(j,k);cands=[[rho<1e-9&&prev?prev[0]:at(j,k)*RAD]];}
  else if(kin==='ab_mixed'){const rho=Math.hypot(j,k);const A=rho<1e-6?(prev?prev[0]:0):at(j,k)*RAD;cands=[[A,at(i,rho)*RAD],[A+180,at(i,-rho)*RAD]];}
  else{const rho=Math.hypot(i,j);
    if(kin==='ac_table'){const A=at(rho,k)*RAD,C=rho<1e-6?(prev?prev[1]:0):at(i,j)*RAD;cands=[[A,C],[-A,C+180]];}
    else if(kin==='bc_table'){const B=at(-rho,k)*RAD,C=rho<1e-6?(prev?prev[1]:0):at(-j,i)*RAD;cands=[[B,C],[-B,C+180]];}
    else{const B=at(rho,k)*RAD,C=rho<1e-6?(prev?prev[1]:0):at(j,i)*RAD;cands=[[B,C],[-B,C+180]];}
  }
  let best=null,bestD=Infinity;
  for(const c of cands){
    const v=c.slice();let ok=true;
    for(let q=0;q<v.length;q++){
      const L=m.rot[q];
      if(L[1]-L[0]>=720){if(prev&&prev.length>q)v[q]=v[q]+360*Math.round((prev[q]-v[q])/360);}
      else{let bv=null,bd=Infinity;for(const s of[-360,0,360]){const w=v[q]+s;if(w>=L[0]-1e-6&&w<=L[1]+1e-6){const d=prev&&prev.length>q?Math.abs(w-prev[q]):Math.abs(w);if(d<bd){bd=d;bv=w;}}}if(bv===null){ok=false;break;}v[q]=bv;}
    }
    if(!ok)continue;
    const d=v.reduce((s,x,q)=>s+Math.abs(x-(prev&&prev.length>q?prev[q]:0)),0);
    if(d<bestD){bestD=d;best=v;}
  }
  if(!best)return null;
  const mm=kinMats(kin,best);return{ang:best,R:mm.R,ha:mm.ha};
}
const isHeadKin=k=>k==='ab_mixed'||k==='bc_head';
function useTCP(){const m=S.machine;return m.kin!=='xyz'&&m.tcp&&CTRL[S.post.ctrl].tcp;}
function linearOut(mv,m,tl,tcp){
  const z=zeroOff();
  if(tcp||m.kin==='xyz')return V.sub(mv.p,z);
  const c=m.rc;let q=V.add(m3v(mv.R,V.sub(mv.p,c)),c);
  if(isHeadKin(m.kin)){const Lp=m.pivot+tl.stickout+tl.holderLen;q=[q[0]+(mv.ha[0])*Lp,q[1]+(mv.ha[1])*Lp,q[2]+(mv.ha[2]-1)*Lp];}
  return V.sub(q,z);
}

/* =========================================================
   PIEZAS DE MUESTRA
   ========================================================= */
function ringsToTris(rings,capA=true,capB=true){
  const out=[];const n=rings[0].length;
  const push=(a,b,c)=>out.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
  for(let s=0;s<rings.length-1;s++){const A=rings[s],B=rings[s+1];for(let i=0;i<n;i++){const i2=(i+1)%n;push(A[i],B[i2],B[i]);push(A[i],A[i2],B[i2]);}}
  const cap=(ring,flip)=>{const c=[0,0,0];ring.forEach(p=>{c[0]+=p[0]/n;c[1]+=p[1]/n;c[2]+=p[2]/n;});for(let i=0;i<n;i++){const i2=(i+1)%n;flip?push(c,ring[i],ring[i2]):push(c,ring[i2],ring[i]);}};
  if(capA)cap(rings[0],false);if(capB)cap(rings[rings.length-1],true);
  // caras hacia afuera sin importar en qué sentido venían los anillos
  let vol=0;for(let i=0;i<out.length;i+=9)vol+=out[i]*(out[i+4]*out[i+8]-out[i+5]*out[i+7])-out[i+1]*(out[i+3]*out[i+8]-out[i+5]*out[i+6])+out[i+2]*(out[i+3]*out[i+7]-out[i+4]*out[i+6]);
  if(vol<0)for(let i=0;i<out.length;i+=9)for(let c=0;c<3;c++){const x=out[i+3+c];out[i+3+c]=out[i+6+c];out[i+6+c]=x;}
  return new Float32Array(out);
}
function cylTris(x0,x1,r,n=40){return ringsToTris([x0,x1].map(x=>Array.from({length:n},(_,k)=>{const t=2*Math.PI*k/n;return[x,r*Math.sin(t),r*Math.cos(t)];})));}
function boxTris(a,b){
  const v=[[a[0],a[1],a[2]],[b[0],a[1],a[2]],[b[0],b[1],a[2]],[a[0],b[1],a[2]],[a[0],a[1],b[2]],[b[0],a[1],b[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]];
  const f=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];const o=[];for(const i of f)o.push(...v[i]);return new Float32Array(o);
}
function sampleBlade(){
  const N=46,st=44,rings=[];const m=0.03,p=0.4;
  for(let s=0;s<=st;s++){
    const u=s/st,x=-42+84*u,c=36-10*u,t=0.16-0.06*u,phi=(-28+50*u)*DEG;
    const up=[],lo=[];
    for(let k=0;k<N;k++){const xi=(1-Math.cos(Math.PI*k/(N-1)))/2;
      const yt=5*t*(0.2969*Math.sqrt(xi)-0.1260*xi-0.3516*xi*xi+0.2843*xi**3-0.1036*xi**4);
      const yc=xi<p?m/(p*p)*(2*p*xi-xi*xi):m/((1-p)**2)*((1-2*p)+2*p*xi-xi*xi);
      const dy=xi<p?2*m/(p*p)*(p-xi):2*m/((1-p)**2)*(p-xi);const th=Math.atan(dy);
      up.push([xi-yt*Math.sin(th),yc+yt*Math.cos(th)]);lo.push([xi+yt*Math.sin(th),yc-yt*Math.cos(th)]);}
    const ring=[];
    for(let k=N-1;k>=0;k--)ring.push(up[k]);for(let k=1;k<N-1;k++)ring.push(lo[k]);
    rings.push(ring.map(([a,b])=>{const uu=(a-0.4)*c,vv=b*c;return[x,uu*Math.cos(phi)-vv*Math.sin(phi),uu*Math.sin(phi)+vv*Math.cos(phi)];}));
  }
  return ringsToTris(rings);
}
function sampleColumn(){
  const M=128,st=150,rings=[];
  for(let s=0;s<=st;s++){const x=-48+96*s/st;const ring=[];
    for(let k=0;k<M;k++){const th=2*Math.PI*k/M;const ax=Math.abs(x);
      let r;if(ax>40)r=15.5;else if(ax>36)r=15.5-1.2*Math.sin((40-ax)/4*Math.PI/2);else{const env=Math.min(1,(36-ax)/5);r=14.3-2.4*env+2.6*env*Math.cos(3*th-0.13*x);}
      ring.push([x,r*Math.sin(th),r*Math.cos(th)]);}
    rings.push(ring);}
  return ringsToTris(rings);
}
function sampleRelief(){
  const W=110,H=76,nx=132,ny=92,base=12,out=[];
  const f=(x,y)=>7.5*Math.exp(-((x+8)**2+(y-3)**2)/420)+3.2*Math.exp(-((x-30)**2+(y+14)**2)/120)+1.2*Math.sin(x/5.5)*Math.cos(y/6.5)*Math.exp(-(x*x+y*y)/2600)+1.4;
  const P=(i,j)=>{const x=-W/2+W*i/nx,y=-H/2+H*j/ny;return[x,y,f(x,y)];};
  const push=(a,b,c)=>out.push(...a,...b,...c);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1);push(a,b,c);push(a,c,d);}
  const bz=-base;
  for(let i=0;i<nx;i++){let a=P(i,0),b=P(i+1,0);push([a[0],a[1],bz],[b[0],b[1],bz],b);push([a[0],a[1],bz],b,a);a=P(i,ny);b=P(i+1,ny);push([b[0],b[1],bz],[a[0],a[1],bz],a);push([b[0],b[1],bz],a,b);}
  for(let j=0;j<ny;j++){let a=P(0,j),b=P(0,j+1);push([b[0],b[1],bz],[a[0],a[1],bz],a);push([b[0],b[1],bz],a,b);a=P(nx,j);b=P(nx,j+1);push([a[0],a[1],bz],[b[0],b[1],bz],b);push([a[0],a[1],bz],b,a);}
  const B=(i,j)=>[-W/2+W*i/nx,-H/2+H*j/ny,bz];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){push(B(i,j),B(i+1,j+1),B(i+1,j));push(B(i,j),B(i,j+1),B(i+1,j+1));}
  return new Float32Array(out);
}
const SAMPLES={
  blade:{name:'Álabe de turbina (muestra)',fn:sampleBlade,preset:'ab',tool:1,strat:{kind:'rot5',pattern:'spiral',stepover:1.0,step:0.8,lead:8,tilt:0,maxTilt:70,rough:false}},
  column:{name:'Columna salomónica (muestra)',fn:sampleColumn,preset:'r4',tool:1,strat:{kind:'rot4',pattern:'spiral',stepover:0.9,step:0.6,rough:true,rsd:2.5,rso:3}},
  relief:{name:'Relieve decorativo (muestra)',fn:sampleRelief,preset:'r3',tool:4,margin:0,strat:{kind:'top3',dir:'x',stepover:0.5,step:0.4,rough:true,rsd:3,rso:3}},
};
