'use strict';
/* =========================================================
   BIBLIOTECAS (herramientas, máquinas, posprocesadores),
   MATERIAL, SOPORTES, CERO, MOVIMIENTOS Y MODO GUIADO
   ========================================================= */
const LIBKEY='hetna-cam-lab-v1';
const LIB={posts:{},mode:'guided'};
const TOOL_TYPES=['ball','flat','bull','taperball','vbit','drill'];
const TOOL_MATS=['carburo','carburo_rec','hss'];
const POST_KEYS=['ctrl','cool','dec','prog','lines','inv','pre','end'];
const num=(v,d,lo=-1e6,hi=1e6)=>{v=+v;return Number.isFinite(v)?clamp(v,lo,hi):d;};
const txt=(v,d,n=60)=>(typeof v==='string'&&v.trim()?v.trim().slice(0,n):d);

// Todo lo que entra de un archivo o del almacenamiento se reconstruye campo por campo.
function cleanTool(t,id){
  if(!t||typeof t!=='object'||!TOOL_TYPES.includes(t.type))return null;const D=num(t.D,0,0.05,200);if(!D)return null;const b=DEFAULT_TOOLS[0];
  return{id,num:Math.round(num(t.num,id,1,999)),name:txt(t.name,'Herramienta'),type:t.type,D,r:t.type==='ball'?D/2:num(t.r,0,0,D/2),angle:num(t.angle,90,1,179),tipD:num(t.tipD,1,0,D),taper:num(t.taper,3,0.1,45),
    flutes:Math.round(num(t.flutes,2,1,12)),fluteLen:num(t.fluteLen,b.fluteLen,0.5,400),stickout:num(t.stickout,b.stickout,1,600),shankD:num(t.shankD,D,0.5,200),holderD:num(t.holderD,b.holderD,1,400),holderLen:num(t.holderLen,b.holderLen,1,400),
    totalLen:num(t.totalLen,0,0,800),mat:TOOL_MATS.includes(t.mat)?t.mat:'carburo',notes:txt(t.notes,'',120),group:txt(t.group,'',30)};
}
function cleanMachine(m){
  if(!m||typeof m!=='object'||!KIN_AXES[m.kin]||!CTRL[m.ctrl])return null;const b=MACHINES.r3;
  const pair=(v,d,lo,hi)=>Array.isArray(v)&&v.length===2?[num(v[0],d[0],lo,hi),num(v[1],d[1],lo,hi)]:d.slice();
  return{name:txt(m.name,'Mi máquina'),kin:m.kin,ctrl:m.ctrl,user:true,
    lim:{x:pair(m.lim?.x,b.lim.x,-1e5,1e5),y:pair(m.lim?.y,b.lim.y,-1e5,1e5),z:pair(m.lim?.z,b.lim.z,-1e5,1e5)},
    rot:[pair(m.rot?.[0],[-INF,INF],-INF,INF),pair(m.rot?.[1],[-INF,INF],-INF,INF)],inv:[!!m.inv?.[0],!!m.inv?.[1]],
    pivot:num(m.pivot,0,0,2000),tcp:!!m.tcp,rc:[0,1,2].map(q=>num(m.rc?.[q],0,-1e4,1e4)),maxRPM:num(m.maxRPM,24000,100,200000),maxFeed:num(m.maxFeed,5000,10,200000),rapid:num(m.rapid,5000,10,200000)};
}
function cleanPost(p){
  if(!p||typeof p!=='object'||!CTRL[p.ctrl])return null;
  return{ctrl:p.ctrl,cool:['M8','M7','none'].includes(p.cool)?p.cool:'M8',dec:Math.round(num(p.dec,3,1,5)),prog:Math.round(num(p.prog,1000,1,99999)),lines:!!p.lines,inv:!!p.inv,pre:cleanLines(p.pre),end:cleanLines(p.end)};
}
// Los comandos extra van tal cual al programa: solo caracteres de G-code, sin saltos raros.
function cleanLines(t){return String(t||'').split(/\r?\n/).map(l=>l.replace(/[^\x20-\x7E]/g,'').trim().slice(0,80)).filter(Boolean).slice(0,12).join('\n');}
const userMachines=()=>Object.fromEntries(Object.entries(MACHINES).filter(([,m])=>m.user));
function libSave(){basePush();try{localStorage.setItem(LIBKEY,JSON.stringify({tools:S.tools,machines:userMachines(),posts:LIB.posts,mode:LIB.mode}));}catch(e){/* sin almacenamiento: la sesión sigue funcionando */}}
function libMerge(d,replaceTools){
  let n=0;
  if(Array.isArray(d.tools)){const base=replaceTools?[]:S.tools;let id=base.reduce((a,t)=>Math.max(a,t.id),0);
    const add=d.tools.slice(0,200).map(t=>cleanTool(t,++id)).filter(Boolean).filter(t=>replaceTools||!base.some(b=>b.name===t.name&&b.D===t.D&&b.type===t.type));
    if(add.length){S.tools=base.concat(add);n+=add.length;}}
  if(d.machines&&typeof d.machines==='object')for(const m of Object.values(d.machines).slice(0,100)){const c=cleanMachine(m);if(!c)continue;
    const k=Object.keys(MACHINES).find(q=>MACHINES[q].user&&MACHINES[q].name===c.name)||('u'+Date.now().toString(36)+(n++));MACHINES[k]=c;n++;}
  if(d.posts&&typeof d.posts==='object')for(const [k,p] of Object.entries(d.posts).slice(0,100)){const c=cleanPost(p);if(c){LIB.posts[txt(k,'Perfil')]=c;n++;}}
  return n;
}
function libInit(){
  let d={};try{d=JSON.parse(localStorage.getItem(LIBKEY)||'{}')||{};}catch(e){d={};}
  libMerge(d,true);if(!S.tools.length)S.tools=JSON.parse(JSON.stringify(DEFAULT_TOOLS));
  if(HETNA.embedded)S.tools=JSON.parse(JSON.stringify(DEFAULT_TOOLS)); // dentro del sitio manda la base compartida, no la copia local
  S.tools.forEach(toolFill);
  if(d.mode==='adv'||d.mode==='guided')LIB.mode=d.mode;
}
// ficha técnica: lo que no venga capturado se propone a partir de lo demás
function toolFill(t){if(!(t.totalLen>0))t.totalLen=Math.round(t.stickout+Math.max(15,t.shankD*2.5));if(!TOOL_MATS.includes(t.mat))t.mat='carburo';if(typeof t.notes!=='string')t.notes='';return t;}
function toolWarnings(t){
  const a=[];const inside=t.totalLen-t.stickout,need=Math.max(12,t.shankD*2);
  if(t.fluteLen>t.totalLen)a.push('El largo de corte no puede ser mayor que el largo total.');
  if(t.stickout>t.totalLen)a.push('El voladizo no puede ser mayor que el largo total.');
  else if(inside<need)a.push(`Solo quedan ${nf(inside,0)} mm de zanco dentro del collet: lo sano es al menos ${nf(need,0)} mm.`);
  if(t.stickout<t.fluteLen)a.push('El voladizo es menor que el largo de corte: parte del filo quedaría dentro del collet.');
  if(t.stickout>t.D*8)a.push(`Voladizo largo para Ø${t.D} (más de 8 diámetros): la fresa se flexiona y vibra.`);
  return a;
}
function syncToolExtras(){
  const t=toolFill(tool());$('#t_group').value=t.group||'';$('#t_groups').innerHTML=[...new Set(S.tools.map(x=>x.group||'').filter(Boolean))].map(g=>`<option value="${esc(g)}">`).join('');$('#t_total').value=t.totalLen;$('#t_mat').value=t.mat;$('#t_notes').value=t.notes;
  const w=toolWarnings(t);$('#o_toolwarn').hidden=!w.length;$('#o_toolwarn').textContent=w.join(' ');
  // la misma fresa, buscada en la tienda
  const shop={ball:'fresa punta bola',flat:'fresa recta',bull:'fresa toroidal',taperball:'fresa conica bola',vbit:'fresa V',drill:'broca'}[t.type]||'fresa';
  $('#t_shop').href='/mx/categories?query='+encodeURIComponent(shop+' '+(t.type==='vbit'?t.angle+' grados':t.D+' mm'));
}
/* La Calculadora CNC del sitio vive en la página que envuelve al laboratorio: se le pide el cálculo por mensaje. */
const CALC_MAT={mdf:'mdf',pino:'madera_blanda',dura:'madera_dura',acrilico:'acrilico',hdpe:'hdpe',aluminio:'aluminio',laton:'laton',acero:'acero_dulce',cera:'cera'};
const CALC_TIPO={ball:'bola',taperball:'bola',flat:'upcut',bull:'upcut',vbit:'v',drill:'recta'};
let calcId=0;
function askCalc(){
  const t=tool(),m=S.machine,D=t.type==='taperball'?t.tipD:t.D;
  window.parent.postMessage({type:'hetna-cam:calc',id:++calcId,entrada:{maquina:'taller',rpm_max:m.maxRPM,avance_max:m.maxFeed,material:CALC_MAT[S.feeds.mat]||'mdf',diametro:D,filos:t.flutes,tipo_fresa:CALC_TIPO[t.type]||'upcut',material_fresa:t.mat,voladizo:t.stickout,
    operacion:t.type==='vbit'?'grabado_v':'acabado',paso_pct:clamp(S.strat.stepover/D*100,1,100)}},location.origin);
  $('#o_calc').hidden=false;$('#o_calc').className='note';$('#o_calc').textContent='Calculando…';
}
function onCalcResult(d){
  if(d.id!==calcId)return;const el=$('#o_calc');const r=d.datos||{};
  if(!d.ok||!(r.rpm>0)||!(r.avance>0)){el.className='note warn';el.textContent='La calculadora no pudo dar un resultado con estos datos.';return;}
  const t=tool(),D=t.type==='taperball'?t.tipD:t.D;
  S.feeds.deff=false;S.feeds.vc=Math.round(Math.PI*D*r.rpm/1000);S.feeds.fz=+(r.avance/(r.rpm*t.flutes)).toFixed(4);S.feeds.plungePct=clamp(Math.round(r.entrada/r.avance*100),5,100);
  updateFeedsUI();refreshPostIfAny();
  const av=(d.avisos||[]).slice(0,3).map(x=>String(x).slice(0,300));
  el.className='note'+(av.length?' warn':'');el.textContent=`Calculadora CNC: ${r.rpm} RPM, ${r.avance} mm/min, carga de viruta ${r.carga_viruta} mm por filo; la fresa se flexiona ≈ ${r.deflexion_mm} mm con ${t.stickout} mm de voladizo.`+(av.length?' '+av.join(' '):'');
}
/* ---------------- Base de herramientas compartida con el CAM 2D y el torno ----------------
   Dentro del sitio, las herramientas del cliente viven en su cuenta (o en su navegador sin sesión).
   El laboratorio las pide a la página que lo envuelve y le devuelve la lista cada vez que cambia.
   Las de fábrica no se guardan mientras nadie las edite. */
const BASE={ready:false,timer:0};
const T2L={bola:'ball',v:'vbit',toroidal:'bull',conica_bola:'taperball',broca:'drill'},L2T={ball:'bola',vbit:'v',bull:'toroidal',taperball:'conica_bola',drill:'broca'};
const FLAT_2D=['recta','upcut','downcut','compresion','un_filo','planeadora','desbaste'];
const fprint=t=>JSON.stringify([t.name,t.type,t.D,t.r,t.angle,t.tipD,t.taper,t.flutes,t.fluteLen,t.stickout,t.shankD,t.holderD,t.holderLen,t.totalLen,t.mat,t.notes||'',t.group||'',t.num]);
function fromBase(f,id){
  if(!f||typeof f!=='object')return null;const D=+f.diametro,fl=+f.largoCorte||Math.max(10,D*3);
  const t=cleanTool({type:T2L[f.tipo]||'flat',D,name:f.nombre,num:f.numero||id,r:f.radio,angle:f.angulo,tipD:f.puntaD||1,taper:f.conicidad||3,flutes:f.filos||2,fluteLen:fl,stickout:+f.voladizo||fl+10,shankD:+f.zanco||D,
    holderD:+f.portaD||30,holderLen:+f.portaLargo||36,totalLen:f.largoTotal,mat:f.materialFresa,notes:f.notas,group:f.grupo},id);
  if(!t)return null;t.bid=String(f.id||'');t.src=f;return toolFill(t);
}
function toBase(t){
  const src=t.src||{};if(!t.bid)t.bid='l'+t.id+Date.now().toString(36);
  return{...src,id:t.bid,nombre:t.name,tipo:L2T[t.type]||(FLAT_2D.includes(src.tipo)?src.tipo:'upcut'),diametro:t.D,angulo:t.angle,radio:t.type==='bull'?t.r:0,puntaD:t.tipD,conicidad:t.taper,filos:t.flutes,
    largoCorte:t.fluteLen,voladizo:t.stickout,zanco:t.shankD,portaD:t.holderD,portaLargo:t.holderLen,largoTotal:t.totalLen,materialFresa:t.mat,numero:t.num,notas:t.notes||'',grupo:t.group||''};
}
function basePush(){
  if(!BASE.ready)return;clearTimeout(BASE.timer);
  BASE.timer=setTimeout(()=>{const fresas=S.tools.filter(t=>!(t.fab&&t.fab===fprint(t))).map(toBase);const sig=JSON.stringify(fresas);if(sig===BASE.sig)return;BASE.sig=sig;
    window.parent.postMessage({type:'hetna-cam:tools-save',fresas},location.origin);},700);
}
function baseInit(){
  S.tools.forEach(t=>t.fab=fprint(t));
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==window.parent||!e.data)return;const d=e.data;
    if(d.type==='hetna-cam:tools'&&!BASE.ready){
      let id=S.tools.reduce((a,t)=>Math.max(a,t.id),0);const mine=(Array.isArray(d.fresas)?d.fresas:[]).slice(0,80).map(f=>fromBase(f,++id)).filter(Boolean);
      S.tools=S.tools.concat(mine);BASE.sig=JSON.stringify(mine.map(toBase));BASE.ready=true;renderToolList();
      $('#o_toolstore').textContent=d.sesion?'Tu base de herramientas se guarda en tu cuenta y es la misma del CAM 2D y el torno.':'Tu base de herramientas es la misma del CAM 2D y el torno. Sin sesión se guarda en este navegador.';
    }else if(d.type==='hetna-cam:tools-saved'&&d.aviso)$('#o_toolstore').textContent=String(d.aviso).slice(0,160)+' Es la misma base del CAM 2D y el torno.';
  });
  window.parent.postMessage({type:'hetna-cam:tools-get'},location.origin);
}
function libExport(){
  const blob=new Blob([JSON.stringify({hetnaCamLibrary:1,tools:S.tools,machines:userMachines(),posts:LIB.posts},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='biblioteca-hetna-cam.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}
async function libImport(file){
  try{if(file.size>2e6)throw new Error('grande');const d=JSON.parse(await file.text());if(!d||d.hetnaCamLibrary!==1)throw new Error('formato');
    const n=libMerge(d,false);libSave();refreshLibUI();toast(n?`Se agregaron ${n} elementos a tus bibliotecas`:'El archivo no traía nada nuevo');
  }catch(e){toast('Ese archivo no es una biblioteca de Hetna CAM');}
}
function refreshLibUI(){
  fillSelect($('#m_preset'),MACHINES,S.presetKey);renderToolList();
  const names=Object.keys(LIB.posts);$('#p_profile').innerHTML='<option value="">Ajustes actuales (sin perfil)</option>'+names.map(k=>`<option value="${esc(k)}">${esc(k)} · ${esc(CTRL[LIB.posts[k].ctrl].name)}</option>`).join('');
  $('#m_del').disabled=!MACHINES[S.presetKey]?.user;
}

/* ---------------- Material, soportes, cero ---------------- */
function syncExtrasUI(){
  const st=S.strat,k=S.stk,sup=S.sup,rot=frameOf(st.kind)==='rot',five=st.kind==='top5'||st.kind==='rot5',man=k.mode==='manual';
  $$('#stk_mode button').forEach(b=>b.classList.toggle('on',b.dataset.v===k.mode));$$('#stk_bar button').forEach(b=>b.classList.toggle('on',b.dataset.v===k.bar));
  $('#stk_frameNote').textContent=rot?'Con la estrategia rotativa elegida el material es una barra sujeta al plato, con el eje de giro sobre X.':'Con la estrategia elegida el material es un bloque sobre la mesa y la herramienta entra desde arriba.';
  $('#w_stk_box').hidden=rot||!man;$('#w_stk_bar').hidden=!rot;$('#w_stk_barDims').hidden=!man;$('#stk_dlbl').textContent=k.bar==='square'?'Lado':'Diámetro';
  $('#w_stk_oz').hidden=!rot;$('#stk_posHint').textContent=rot?'X recorre la pieza a lo largo de la barra; Y y Z la descentran respecto al eje de giro.':'Con "Mis medidas" el bloque queda fijo y la pieza se mueve dentro de él.';
  for(const [id,v] of Object.entries({stk_sx:k.sx,stk_sy:k.sy,stk_sz:k.sz,stk_sd:k.sd,stk_sl:k.sl,stk_ox:k.ox,stk_oy:k.oy,stk_oz:k.oz,sup_llen:sup.l.len,sup_ld:sup.l.d,sup_rlen:sup.r.len,sup_rd:sup.r.d,sup_tw:sup.tabs.w,sup_tt:sup.tabs.t,p_sx:S.scl[0],p_sy:S.scl[1],p_sz:S.scl[2]}))$('#'+id).value=v;
  $('#sup_l').checked=sup.l.on;$('#sup_r').checked=sup.r.on;$('#sup_tabs').checked=sup.tabs.on;$('#w_sup_rot').hidden=!rot;$('#w_sup_top').hidden=rot;
  $('#w_ztop').hidden=rot;$('#w_zrot').hidden=!rot;$('#z_top').value=S.zero.top;$('#z_rot').value=S.zero.rot;
  // estrategia
  if(five&&(st.pat3==='circ'||st.pat3==='rad'))st.pat3='par';
  $$('#s_pat3 button').forEach(b=>{b.classList.toggle('on',b.dataset.v===st.pat3);b.hidden=five&&(b.dataset.v==='circ'||b.dataset.v==='rad');});
  const lin=st.pat3==='par'||st.pat3==='cross';$('#w_sang').hidden=!lin;$('#s_ang').value=st.ang;$$('#s_angq button').forEach(b=>b.classList.toggle('on',+b.dataset.v===st.ang));
  $('#o_pat3').textContent={par:'Pasadas rectas, una junto a otra.',cross:'Dos juegos de pasadas a 90°: borra las crestas, tarda el doble.',circ:'Círculos concéntricos desde el centro del área: buen acabado en platos y medallones.',rad:'Rayos desde el centro hacia afuera: útil en piezas con forma de domo.'}[st.pat3];
  $$('#s_cutdir button').forEach(b=>b.classList.toggle('on',b.dataset.v===st.cutdir));
  $('#w_rpat').hidden=rot;$('#w_rrot').hidden=!rot;$('#s_rpat').value=st.rpat;$('#s_rrot').value=st.rrot;
  $('#o_rough5').textContent=five?'En 5 ejes el desbaste se hace con la herramienta recta (como en 3 o 4 ejes) y después entra el acabado inclinado.':'';
  const a=st.area;$('#s_area').checked=a.on;$('#w_areay').hidden=rot;['x0','x1','y0','y1'].forEach(q=>{$('#s_a'+q).value=a[q];$('#s_a'+q).disabled=!a.on;});
}
function initExtrasUI(){
  const dirty=()=>{S.partDirty=true;syncExtrasUI();reprep();};
  const seg=(id,fn)=>$('#'+id).addEventListener('click',e=>{const b=e.target.closest('button');if(b)fn(b.dataset.v);});
  const numIn=(id,set,after,lo=-1e5,hi=1e5)=>$('#'+id).addEventListener('change',e=>{const v=parseFloat(e.target.value);if(!Number.isFinite(v)){syncExtrasUI();return;}set(clamp(v,lo,hi));after();});
  const stale=()=>{syncExtrasUI();markStale();};
  seg('stk_mode',v=>{S.stk.mode=v;dirty();});seg('stk_bar',v=>{S.stk.bar=v;dirty();});
  ['stk_margin','stk_top'].forEach(id=>$('#'+id).addEventListener('change',dirty));
  [['stk_sx','sx'],['stk_sy','sy'],['stk_sz','sz'],['stk_sd','sd'],['stk_sl','sl']].forEach(([id,k])=>numIn(id,v=>S.stk[k]=v,dirty,0));
  [['stk_ox','ox'],['stk_oy','oy'],['stk_oz','oz']].forEach(([id,k])=>numIn(id,v=>S.stk[k]=v,dirty));
  [['p_sx',0],['p_sy',1],['p_sz',2]].forEach(([id,q])=>numIn(id,v=>S.scl[q]=v,dirty,0.01,1000));
  [['sup_l','l'],['sup_r','r'],['sup_tabs','tabs']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{S.sup[k].on=e.target.checked;dirty();}));
  [['sup_llen','l','len'],['sup_ld','l','d'],['sup_rlen','r','len'],['sup_rd','r','d'],['sup_tw','tabs','w'],['sup_tt','tabs','t']].forEach(([id,k,f])=>numIn(id,v=>S.sup[k][f]=v,()=>{if(S.sup[k].on)dirty();},0.5,2000));
  const zero=()=>{buildGrid();refreshPostIfAny();};
  $('#z_top').addEventListener('change',e=>{S.zero.top=e.target.value;zero();});$('#z_rot').addEventListener('change',e=>{S.zero.rot=e.target.value;zero();});
  seg('s_pat3',v=>{S.strat.pat3=v;stale();});seg('s_cutdir',v=>{S.strat.cutdir=v;stale();});seg('s_angq',v=>{S.strat.ang=+v;stale();});
  numIn('s_ang',v=>S.strat.ang=v,stale,-180,180);
  $('#s_rpat').addEventListener('change',e=>{S.strat.rpat=e.target.value;stale();});$('#s_rrot').addEventListener('change',e=>{S.strat.rrot=e.target.value;stale();});
  const fit=()=>{const M=S.M;if(!M)return;Object.assign(S.strat.area,{x0:Math.floor(M.bmin[0]),x1:Math.ceil(M.bmax[0]),y0:Math.floor(M.bmin[1]),y1:Math.ceil(M.bmax[1])});};
  $('#s_area').addEventListener('change',e=>{S.strat.area.on=e.target.checked;if(e.target.checked&&!S.strat.area.set){fit();S.strat.area.set=true;}stale();});
  ['x0','x1','y0','y1'].forEach(q=>numIn('s_a'+q,v=>S.strat.area[q]=v,stale));
  $('#s_areaFit').addEventListener('click',()=>{fit();stale();});
  $('#f_plunge').addEventListener('change',e=>{S.feeds.plungePct=clamp(+e.target.value||30,5,100);updateFeedsUI();refreshPostIfAny();});
  // bibliotecas
  const save=fn=>function(){const r=fn.apply(this,arguments);libSave();return r;};
  renderToolList=save(renderToolList);syncToolForm=save(syncToolForm);
  $('#t_reset').addEventListener('click',()=>{const mine=HETNA.embedded?S.tools.filter(t=>!(t.fab&&t.fab===fprint(t))):[];S.tools=JSON.parse(JSON.stringify(DEFAULT_TOOLS)).map(toolFill);if(HETNA.embedded){S.tools.forEach(t=>t.fab=fprint(t));let id=S.tools.length;mine.forEach(t=>{t.id=++id;t.fab=undefined;});S.tools=S.tools.concat(mine);}S.toolId=1;renderToolList();syncToolForm();buildToolMesh();markStale();toast('Herramientas de fábrica restauradas');});
  $('#m_preset').addEventListener('change',()=>{$('#m_del').disabled=!MACHINES[S.presetKey]?.user;});
  $('#m_save').addEventListener('click',()=>{const name=txt($('#m_name').value,'');if(!name){toast('Escribe un nombre para la máquina');return;}
    const c=cleanMachine({...S.machine,name,ctrl:S.post.ctrl});const k=Object.keys(MACHINES).find(q=>MACHINES[q].user&&MACHINES[q].name===name)||('u'+Date.now().toString(36));
    MACHINES[k]=c;S.presetKey=k;libSave();refreshLibUI();$('#m_name').value='';toast('Máquina guardada en tu biblioteca');});
  $('#m_del').addEventListener('click',()=>{const k=S.presetKey;if(!MACHINES[k]?.user)return;delete MACHINES[k];S.presetKey='r3';libSave();refreshLibUI();toast('Máquina eliminada de tu biblioteca');});
  $('#p_save').addEventListener('click',()=>{const name=txt($('#p_name').value,'');if(!name){toast('Escribe un nombre para el perfil');return;}
    LIB.posts[name]=cleanPost(S.post);libSave();refreshLibUI();$('#p_profile').value=name;$('#p_name').value='';toast('Perfil de posprocesador guardado');});
  $('#p_del').addEventListener('click',()=>{const k=$('#p_profile').value;if(!k)return;delete LIB.posts[k];libSave();refreshLibUI();toast('Perfil eliminado');});
  $('#p_profile').addEventListener('change',e=>{const p=LIB.posts[e.target.value];if(!p)return;Object.assign(S.post,p);syncMachineUI();syncPostUI();syncPostExtras();refreshPostIfAny();refreshOutputs();});
  ['pre','end'].forEach(k=>$('#p_'+k).addEventListener('change',e=>{S.post[k]=cleanLines(e.target.value);e.target.value=S.post[k];refreshPostIfAny();refreshOutputs();}));
  $$('[data-lib=export]').forEach(b=>b.addEventListener('click',libExport));$$('[data-lib=import]').forEach(b=>b.addEventListener('click',()=>$('#libIn').click()));
  $('#libIn').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)libImport(f);});
  $('#p_repair').addEventListener('click',repairPart);
  $('#v_open').addEventListener('click',askVerify);$('#v_send').addEventListener('click',sendVerify);
  $('#v_result').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;VERIFY.result=b.dataset.v;$$('#v_result button').forEach(x=>x.classList.toggle('on',x===b));});
  // ficha técnica y calculadora
  syncToolForm=(fn=>function(){const r=fn.apply(this,arguments);syncToolExtras();return r;})(syncToolForm);
  $('#t_total').addEventListener('change',e=>{const v=parseFloat(e.target.value);if(Number.isFinite(v)&&v>0)tool().totalLen=v;syncToolForm();});
  $('#t_mat').addEventListener('change',e=>{tool().mat=e.target.value;syncToolForm();});
  $('#t_group').addEventListener('change',e=>{tool().group=txt(e.target.value,'',30);renderToolList();syncToolForm();});
  $('#t_notes').addEventListener('change',e=>{tool().notes=txt(e.target.value,'',120);syncToolForm();});
  if(HETNA.embedded){$('#w_calc').hidden=false;$('#t_calc').addEventListener('click',askCalc);
    window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data&&e.data.type==='hetna-cam:calc-result')onCalcResult(e.data);});}
  syncToolExtras();
  if(HETNA.embedded)baseInit();
  refreshLibUI();syncPostExtras();initGuide();syncExtrasUI();
}
async function repairPart(){
  if(S.busy||!S.rawPos)return;setBusy('Revisando la malla…',0.2);await tick();
  let r;try{r=repairMesh(S.rawPos);}catch(e){console.error(e);setBusy(null);toast('No se pudo revisar la malla');return;}
  const p=r.rep,did=[];
  if(p.degenerate)did.push(`${p.degenerate.toLocaleString('es-MX')} caras sin área quitadas`);if(p.duplicate)did.push(`${p.duplicate.toLocaleString('es-MX')} caras repetidas quitadas`);
  if(p.flipped)did.push(`${p.flipped.toLocaleString('es-MX')} caras volteadas hacia afuera`);if(p.holes)did.push(`${p.holes} ${p.holes===1?'hueco tapado':'huecos tapados'} con ${p.holeTris.toLocaleString('es-MX')} caras nuevas`);
  if(!p.changed){setBusy(null);renderIssues([{sev:p.open?'warn':'ok',title:p.open?'No encontré nada que pueda reparar solo':'La malla está bien',cause:p.open?`Quedan ${p.open} aristas abiertas que no forman un hueco simple (caras que se cruzan o piezas sueltas).`:'Está cerrada, sin caras repetidas ni volteadas.',fix:p.open?'Repárala en tu programa de diseño y expórtala otra vez como sólido.':''}]);return;}
  S.rawPos=r.pos;S.rawFile=null; // lo que se manda al pedir el servicio es la malla reparada
  S.partDirty=true;setBusy(null);await reprep();
  renderIssues([{sev:p.open?'warn':'ok',title:p.open?'Malla reparada en parte':'Malla reparada',cause:did.join(', ')+'.'+(p.open?` Quedan ${p.open} aristas abiertas que no forman un hueco simple.`:' Quedó cerrada.'),fix:(p.holes?'Los huecos se taparon con una cara plana: revisa en la vista 3D que el tapón sea el que esperabas. ':'')+'Pulsa Calcular trayectoria.'}]);
}
/* ---------------- Programas probados en máquina ---------------- */
let PROVEN=null;const VERIFY={result:''};
async function refreshProven(){
  const el=$('#o_proven');
  if(!PROVEN){try{PROVEN=(await(await fetch('/api/cam/pruebas')).json()).pruebas||[];}catch(e){PROVEN=[];}}
  const c=S.post.ctrl,name=CTRL[c].name,r=PROVEN.find(x=>x.controlador===c&&x.herramienta==='3d');
  if(!r){el.className='note';el.textContent=`Todavía ningún taller ha reportado cómo le fue con ${name}. Si lo pruebas, sé el primero en decirlo: corre siempre en vacío antes de cortar.`;return;}
  const n=r.bien+r.ajustes+r.mal;el.className='note'+(r.mal>r.bien?' warn':'');
  el.textContent=`${name}: ${n} ${n===1?'reporte':'reportes'} de ${r.talleres} ${r.talleres===1?'taller':'talleres'}. ${r.bien} salieron bien, ${r.ajustes} con ajustes y ${r.mal} no sirvieron.`;
}
function askVerify(){$('#verifyBox').hidden=false;$('#verifyOpen').hidden=true;$('#v_status').textContent='';}
async function sendVerify(){
  if(!VERIFY.result){$('#v_status').textContent='Elige cómo te fue.';return;}
  $('#v_send').disabled=true;$('#v_status').textContent='Enviando…';
  const body={herramienta:'3d',controlador:S.post.ctrl,resultado:VERIFY.result,maquina:MACHINES[S.presetKey]?.name,material:MATERIALS[S.feeds.mat]?.name,ejes:3+KIN_AXES[S.machine.kin].length,notas:$('#v_notes').value.trim()||undefined};
  let d;try{d=await(await fetch('/api/cam/pruebas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();}catch(e){d={mensaje:'No se pudo conectar.'};}
  $('#v_send').disabled=false;
  if(d.ok){$('#v_status').textContent='Gracias: tu reporte ya cuenta.';PROVEN=null;refreshProven();$('#v_notes').value='';}
  else $('#v_status').textContent=d.mensaje||'No se pudo guardar tu reporte.';
}
function syncPostExtras(){$('#p_pre').value=S.post.pre;$('#p_end').value=S.post.end;}

/* ---------------- Modo guiado ---------------- */
const GUIDE={
  part:['Paso 1 de 6 · Tu pieza','Sube tu modelo 3D o elige una pieza de muestra. Si aparece acostada o de cabeza, gírala con los botones hasta verla como quedará en la máquina.','stock','Siguiente: material'],
  stock:['Paso 2 de 6 · El material','Dinos de qué bloque o barra vas a cortar. Si no estás seguro, deja "Ajustado a la pieza": el programa calcula el tamaño mínimo. Aquí también eliges dónde pones el cero y si quieres soportes.','machine','Siguiente: máquina'],
  machine:['Paso 3 de 6 · Tu máquina','Elige la que más se parezca a la tuya y el controlador que usa (Mach3, GRBL, LinuxCNC…). De eso depende el formato del G-code.','tool','Siguiente: herramienta'],
  tool:['Paso 4 de 6 · La herramienta','Elige la fresa de la biblioteca y el material que vas a cortar: las revoluciones y el avance se calculan solos.','strat','Siguiente: estrategia'],
  strat:['Paso 5 de 6 · Cómo se corta','Elige el tipo de trabajo según tu máquina. Un paso lateral más chico deja mejor acabado y tarda más. Activa el desbaste si hay mucho material que quitar.','calc','Calcular trayectoria'],
  post:['Paso 6 de 6 · Tu programa','Revisa los avisos de Verificación y mira la simulación. Si todo está bien, descarga el G-code y córrelo primero en vacío con avance reducido.',null,null],
};
function setMode(m){LIB.mode=m;document.body.classList.toggle('guided',m==='guided');$$('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===m));libSave();}
function initGuide(){
  for(const [k,[t,p,next,label]] of Object.entries(GUIDE)){const el=$(`[data-guide=${k}]`);if(!el)continue;
    el.innerHTML=`<b>${t}</b><p>${p}</p>${next?`<button class="btn sm primary">${label} →</button>`:''}`;
    el.querySelector('button')?.addEventListener('click',async()=>{if(next==='calc'){await compute();if(S.moves&&!S.stale)showTab('post');}else showTab(next);});}
  $('#modeSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setMode(b.dataset.v);});
  setMode(LIB.mode);
}
boot();
