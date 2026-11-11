'use strict';
/* =====================================================================
   Proyectos del laboratorio en la cuenta del cliente: guarda la pieza con
   su material, máquina, herramientas y estrategia para retomarla después
   o pasarla con una liga (?proyecto=ID abre una COPIA).
   Usa el mismo servicio que el CAM 2D y el torno: /api/cam/proyectos.
   ===================================================================== */
const PROY={list:null,current:null,session:true,busy:false};
const PROY_MAX=1250000; // caracteres de la malla ya comprimida; el servicio acepta ~1.5 MB por proyecto

/* ---- malla <-> texto: vértices sin repetir + índices, comprimido ---- */
async function gzB64(bytes){
  const buf=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let s='';for(let i=0;i<buf.length;i+=0x8000)s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));return btoa(s);
}
async function b64Gunzip(t){
  const bin=atob(t),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
async function meshPack(pos){
  const n=pos.length/3,map=new Map(),idx=new Uint32Array(n),vs=[];
  for(let i=0;i<n;i++){const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],k=x+','+y+','+z;let j=map.get(k);if(j===undefined){j=vs.length/3;map.set(k,j);vs.push(x,y,z);}idx[i]=j;}
  const nv=vs.length/3,ib=nv<65536?new Uint16Array(idx):idx;
  const pack=async(vb,q)=>{const head=new Float32Array(8);head[0]=nv;head[1]=n;head[2]=q?1:0;if(q)head.set(q,3);
    return gzB64(new Uint8Array(await new Blob([head,vb,ib]).arrayBuffer()));};
  let t=await pack(new Float32Array(vs),null);
  if(t.length<=PROY_MAX)return{t,exact:true};
  // muy pesada: vértices a 16 bits dentro de la caja de la pieza (error menor a 1/65000 del tamaño)
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vs.length;i++){const c=i%3;if(vs[i]<lo[c])lo[c]=vs[i];if(vs[i]>hi[c])hi[c]=vs[i];}
  const sz=Math.max(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2],1e-6),q16=new Uint16Array(vs.length+(vs.length&1));
  for(let i=0;i<vs.length;i++)q16[i]=Math.round((vs[i]-lo[i%3])/sz*65535);
  t=await pack(q16,[lo[0],lo[1],lo[2],sz]);
  return t.length<=PROY_MAX?{t,exact:false}:null;
}
async function meshUnpack(t){
  if(typeof t!=='string'||t.length>PROY_MAX*1.2)throw new Error('malla');
  const u=await b64Gunzip(t),head=new Float32Array(u.buffer.slice(0,32)),nv=head[0]|0,n=head[1]|0,q=head[2]===1;
  if(!(nv>2&&n>=3&&n%3===0&&nv<=n&&n<=6e6))throw new Error('malla');
  let o=32,vs;
  if(q){const len=nv*3+((nv*3)&1),q16=new Uint16Array(u.buffer.slice(o,o+len*2));o+=len*2;vs=new Float32Array(nv*3);for(let i=0;i<nv*3;i++)vs[i]=head[3+i%3]+q16[i]/65535*head[6];}
  else{vs=new Float32Array(u.buffer.slice(o,o+nv*12));o+=nv*12;}
  const ib=nv<65536?new Uint16Array(u.buffer.slice(o,o+n*2)):new Uint32Array(u.buffer.slice(o,o+n*4));
  if(ib.length!==n||vs.length!==nv*3)throw new Error('malla');
  const pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){const j=ib[i];if(j>=nv)throw new Error('malla');pos[i*3]=vs[j*3];pos[i*3+1]=vs[j*3+1];pos[i*3+2]=vs[j*3+2];}
  for(let i=0;i<pos.length;i++)if(!Number.isFinite(pos[i]))throw new Error('malla');
  return pos;
}

/* ---- estado <-> proyecto ---- */
async function projGet(){
  if(!S.rawPos)return'Sube una pieza o elige una de muestra antes de guardar.';
  if(S.busy)return'Espera a que termine el cálculo para guardar.';
  let mesh=null,exact=true;
  if(!S.sampleKey){const m=await meshPack(S.rawPos);if(!m)return`La pieza es demasiado pesada para guardarla en la cuenta (${(S.rawPos.length/9|0).toLocaleString('es-MX')} triángulos). Simplifica la malla en tu programa de diseño y vuelve a subirla.`;mesh=m.t;exact=m.exact;}
  const rt=S.strat.roughTool?S.tools.find(t=>t.id===S.strat.roughTool):null;
  return{version:1,partName:S.partName,sample:S.sampleKey||null,mesh,exact,units:S.units,scale:S.scale,scl:S.scl,rotSeq:S.rotSeq,margin:+$('#stk_margin').value||0,top:+$('#stk_top').value||0,
    stk:S.stk,sup:S.sup,zero:S.zero,presetKey:S.presetKey,machine:S.machine,tool:tool(),roughTool:rt||null,feeds:S.feeds,strat:S.strat,post:S.post};
}
// copia de `src` solo lo que tiene el mismo tipo que en `def` (los textos, cortos y sin símbolos)
function projMerge(def,src){
  if(!src||typeof src!=='object')return def;
  for(const k of Object.keys(def)){const a=def[k],b=src[k];
    if(a&&typeof a==='object'&&!Array.isArray(a))projMerge(a,b);
    else if(typeof a==='number'){if(typeof b==='number'&&Number.isFinite(b))def[k]=clamp(b,-1e5,1e5);}
    else if(typeof a==='boolean'){if(typeof b==='boolean')def[k]=b;}
    else if(typeof a==='string'){if(typeof b==='string'&&/^[\w.-]{1,24}$/.test(b))def[k]=b;}}
  return def;
}
// la fresa del proyecto: la misma de la biblioteca si ya está, o se agrega
function projTool(t){
  const c=cleanTool(t,0);if(!c)return null;
  const f=x=>[x.type,x.D,x.r,x.flutes,x.fluteLen,x.stickout,x.angle,x.tipD,x.taper].join('|');
  const have=S.tools.find(x=>f(x)===f(c));if(have)return have.id;
  c.id=Math.max(0,...S.tools.map(x=>x.id))+1;if(S.tools.some(x=>x.num===c.num))c.num=Math.max(0,...S.tools.map(x=>x.num))+1;
  S.tools.push(c);return c.id;
}
async function projApply(d){
  if(!d||typeof d!=='object'||d.version!==1)return false;
  let pos;
  if(d.sample&&SAMPLES[d.sample])pos=SAMPLES[d.sample].fn();
  else{try{pos=await meshUnpack(d.mesh);}catch(e){return false;}}
  const mach=cleanMachine(d.machine),post=cleanPost(d.post);if(!mach||!post)return false;
  const KINDS=['top3','rot4','idx4','top5','rot5'];if(!d.strat||!KINDS.includes(d.strat.kind))return false;
  S.rawPos=pos;S.rawFile=null;S.sampleKey=d.sample&&SAMPLES[d.sample]?d.sample:null;S.partName=txt(d.partName,'Pieza',80).replace(/[<>]/g,'');
  S.units=d.units===25.4?25.4:1;S.scale=num(d.scale,1,0.001,1000);S.scl=[0,1,2].map(q=>num(d.scl?.[q],1,0.001,1000));
  S.rotSeq=Array.isArray(d.rotSeq)?d.rotSeq.filter(r=>r==='x'||r==='y'||r==='z').slice(0,40):[];
  S.stk=projMerge(STK_DEF(),d.stk);S.sup=projMerge(SUP_DEF(),d.sup);projMerge(S.zero,d.zero);
  delete mach.user;S.machine=mach;if(MACHINES[d.presetKey])S.presetKey=d.presetKey;
  Object.assign(S.post,post,{out:'gcode'});
  const main=projTool(d.tool);if(main)S.toolId=main;
  if(d.feeds&&MATERIALS[d.feeds.mat])S.feeds.mat=d.feeds.mat;projMerge(S.feeds,{...d.feeds,mat:S.feeds.mat});
  projMerge(S.strat,d.strat);S.strat.kind=d.strat.kind;
  S.strat.roughTool=d.roughTool?(projTool(d.roughTool)||0):0;if(S.strat.roughTool===S.toolId)S.strat.roughTool=0;
  $('#p_units').value=String(S.units);$('#p_scale').value=S.scale;$('#jobName').textContent=S.partName;
  $('#stk_margin').value=num(d.margin,3,0,500);$('#stk_top').value=num(d.top,0,0,500);
  $('#m_preset').value=S.presetKey;$$('#samples .chip').forEach(c=>c.classList.toggle('on',c.dataset.sample===S.sampleKey));
  syncMachineUI();syncPostUI();syncPostExtras();renderToolList();syncToolForm();updateFeedsUI();syncStratUI();syncExtrasUI();buildToolMesh();libSave();
  S.M=null;S.moves=null;S.gcode=null;await compute();
  return true;
}

/* ---- la lista, guardar, abrir, compartir ---- */
const projApi=async(q,opt)=>{try{return await(await fetch('/api/cam/proyectos'+q,{cache:'no-store',...opt})).json();}catch(e){return null;}};
const projMsg=t=>{$('#pj_status').textContent=t||'';};
function projRender(){
  $('#pj_login').hidden=PROY.session;$('#pj_body').hidden=!PROY.session;
  $('#pj_save').textContent=PROY.current?'Guardar cambios':'Guardar en mi cuenta';$('#pj_saveNew').hidden=!PROY.current;
  const fecha=iso=>new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
  $('#pj_list').innerHTML=(PROY.list||[]).map(p=>`<div class="pjrow" data-id="${esc(p.id)}"><button class="pjopen" data-act="open" title="Abrir">${esc(p.nombre)} <span>· ${esc(fecha(p.actualizado))}${p.compartido?' · compartido':''}</span></button><button data-act="share">Copiar liga</button>${p.compartido?'<button data-act="unshare">Quitar liga</button>':''}<button data-act="del" aria-label="Borrar ${esc(p.nombre)}">✕</button></div>`).join('');
}
async function projLoadList(){
  const r=await projApi('?herramienta=3d');
  if(r&&r.ok)PROY.list=r.proyectos;else if(r&&r.codigo==='sesion')PROY.session=false;
  projRender();
}
const projIdle=async()=>{for(let i=0;i<600&&S.busy;i++)await new Promise(r=>setTimeout(r,200));};
async function projOpen(id,fromLink){
  if(PROY.busy)return;PROY.busy=true;projMsg('Abriendo…');
  const r=await projApi('?id='+encodeURIComponent(id));
  if(!r||!r.ok||!r.proyecto||r.proyecto.herramienta!=='3d'){PROY.busy=false;projMsg((r&&r.mensaje)||'No se pudo abrir ese proyecto.');return;}
  await projIdle();
  let ok=false;try{ok=await projApply(r.proyecto.datos);}catch(e){console.error(e);}
  PROY.busy=false;
  if(!ok){projMsg('Ese proyecto no se pudo leer.');return;}
  $('#pj_name').value=r.proyecto.nombre;PROY.current=r.proyecto.propio?r.proyecto.id:null;projRender();
  projMsg(r.proyecto.propio?`Abriste "${r.proyecto.nombre}".`:fromLink?`Abriste una copia de "${r.proyecto.nombre}". Guárdala para tenerla en tu cuenta.`:'');
}
async function projSave(asNew){
  if(PROY.busy)return;PROY.busy=true;projMsg('Guardando…');
  let datos;try{datos=await projGet();}catch(e){console.error(e);datos='No se pudo preparar la pieza para guardarla.';}
  if(typeof datos==='string'){PROY.busy=false;projMsg(datos);return;}
  const r=await projApi('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:asNew?null:PROY.current,herramienta:'3d',nombre:$('#pj_name').value.trim()||S.partName||'Proyecto sin nombre',datos})});
  PROY.busy=false;
  if(!r||!r.ok){if(r&&r.codigo==='sesion'){PROY.session=false;projRender();}projMsg((r&&r.mensaje)||'No se pudo guardar.');return;}
  PROY.current=r.proyecto.id;projMsg(datos.exact?'Guardado en tu cuenta.':'Guardado en tu cuenta. La malla era pesada y se guardó con un redondeo de milésimas.');projLoadList();
}
function projLink(id){let path='/mx/cam/lab';try{if(window.parent!==window)path=window.parent.location.pathname;}catch(e){/* otro origen: se usa la ruta normal */}return location.origin+path+'?proyecto='+encodeURIComponent(id);}
async function projAct(id,act){
  const p=(PROY.list||[]).find(x=>x.id===id);if(!p)return;
  if(act==='open')return projOpen(id,false);
  if(act==='share'){
    const r=await projApi('?id='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({compartido:true})});
    if(!r||!r.ok){projMsg((r&&r.mensaje)||'No se pudo compartir.');return;}
    const liga=projLink(id);try{await navigator.clipboard.writeText(liga);projMsg('Liga copiada: quien la abra recibe una copia de tu proyecto.');}catch(e){projMsg('Comparte esta liga: '+liga);}
  }else if(act==='unshare'){
    await projApi('?id='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({compartido:false})});projMsg('La liga de ese proyecto ya no funciona.');
  }else if(act==='del'){
    if(!confirm(`¿Borrar "${p.nombre}"?`))return;
    await projApi('?id='+encodeURIComponent(id),{method:'DELETE'});if(PROY.current===id)PROY.current=null;
  }
  projLoadList();
}
(function projInit(){
  if(!$('#pj_list'))return;
  let volver='/mx/cam/lab';try{if(window.parent!==window)volver=window.parent.location.pathname;}catch(e){/* se queda la ruta normal */}
  $('#pj_loginLink').href='/mx/login?volver='+encodeURIComponent(volver);$('#pj_loginLink').target='_top';
  $('#pj_save').addEventListener('click',()=>projSave(false));$('#pj_saveNew').addEventListener('click',()=>projSave(true));
  $('#pj_list').addEventListener('click',e=>{const b=e.target.closest('[data-act]'),row=e.target.closest('.pjrow');if(b&&row)projAct(row.dataset.id,b.dataset.act);});
  projLoadList();
  let id=null;try{id=new URLSearchParams(window.parent.location.search).get('proyecto');}catch(e){/* otro origen */}
  id=id||new URLSearchParams(location.search).get('proyecto');
  if(id)projOpen(id,true);
})();
