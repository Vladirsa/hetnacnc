'use strict';
/* =========================================================
   INTERFAZ
   ========================================================= */
function fillSelect(sel,obj,val){sel.innerHTML=Object.entries(obj).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');if(val)sel.value=val;}
function bindNum(id,get,set,onChange){const el=$('#'+id);el.value=get();el.addEventListener('change',()=>{const v=parseFloat(el.value);if(!Number.isFinite(v)){el.value=get();return;}set(v);onChange&&onChange();});return el;}
function bindChk(id,get,set,onChange){const el=$('#'+id);el.checked=get();el.addEventListener('change',()=>{set(el.checked);onChange&&onChange();});return el;}
function syncMachineUI(){
  const m=S.machine;$('#m_kin').value=m.kin;$('#m_ctrl').value=S.post.ctrl;
  ['x','y','z'].forEach(a=>{$(`#m_${a}min`).value=m.lim[a][0];$(`#m_${a}max`).value=m.lim[a][1];});
  const ax=KIN_AXES[m.kin];$('#rotGroup').hidden=!ax.length;
  $('#r1lbl').textContent=$('#r1lbl2').textContent=ax[0]||'A';$('#r2lbl').textContent=$('#r2lbl2').textContent=ax[1]||'B';
  ['#r2a','#r2b','#r2c'].forEach(s=>$(s).hidden=ax.length<2);
  $('#m_r1min').value=m.rot[0][0];$('#m_r1max').value=m.rot[0][1];$('#m_r2min').value=m.rot[1][0];$('#m_r2max').value=m.rot[1][1];
  $('#m_r1inv').checked=m.inv[0];$('#m_r2inv').checked=m.inv[1];$('#m_pivot').value=m.pivot;$('#pivotWrap').hidden=!isHeadKin(m.kin);$('#m_tcp').checked=m.tcp;
  $('#m_cx').value=m.rc[0];$('#m_cy').value=m.rc[1];$('#m_cz').value=m.rc[2];
  $('#m_rpm').value=m.maxRPM;$('#m_feed').value=m.maxFeed;$('#m_rapid').value=m.rapid;$('#p_ctrl').value=S.post.ctrl;
}
function initMachineUI(){
  fillSelect($('#m_preset'),MACHINES,S.presetKey);fillSelect($('#m_ctrl'),CTRL,S.post.ctrl);fillSelect($('#p_ctrl'),CTRL,S.post.ctrl);
  $('#m_preset').addEventListener('change',e=>{applyPreset(e.target.value);markStale();refreshPostIfAny();});
  $('#m_kin').addEventListener('change',e=>{S.machine.kin=e.target.value;syncMachineUI();markStale();refreshPostIfAny();});
  const ctrlChange=v=>{S.post.ctrl=v;if(['mach3','mach4','grbl'].includes(v))S.post.inv=false;syncMachineUI();refreshPostIfAny();syncPostUI();};
  $('#m_ctrl').addEventListener('change',e=>ctrlChange(e.target.value));$('#p_ctrl').addEventListener('change',e=>ctrlChange(e.target.value));
  const m=()=>S.machine;
  ['x','y','z'].forEach(a=>{[0,1].forEach(q=>{const el=$(`#m_${a}${q?'max':'min'}`);el.addEventListener('change',()=>{const v=parseFloat(el.value);if(Number.isFinite(v)){m().lim[a][q]=v;refreshPostIfAny();}});});});
  [['m_r1min',0,0],['m_r1max',0,1],['m_r2min',1,0],['m_r2max',1,1]].forEach(([id,a,q])=>{const el=$('#'+id);el.addEventListener('change',()=>{const v=parseFloat(el.value);if(Number.isFinite(v)){m().rot[a][q]=v;markStale();}});});
  $('#m_r1inv').addEventListener('change',e=>{m().inv[0]=e.target.checked;refreshPostIfAny();});$('#m_r2inv').addEventListener('change',e=>{m().inv[1]=e.target.checked;refreshPostIfAny();});
  $('#m_pivot').addEventListener('change',e=>{m().pivot=+e.target.value||0;refreshPostIfAny();});$('#m_tcp').addEventListener('change',e=>{m().tcp=e.target.checked;refreshPostIfAny();syncPostUI();});
  ['cx','cy','cz'].forEach((k,q)=>$('#m_'+k).addEventListener('change',e=>{m().rc[q]=+e.target.value||0;refreshPostIfAny();}));
  $('#m_rpm').addEventListener('change',e=>{m().maxRPM=+e.target.value||24000;updateFeedsUI();refreshPostIfAny();});
  $('#m_feed').addEventListener('change',e=>{m().maxFeed=+e.target.value||5000;updateFeedsUI();refreshPostIfAny();});
  $('#m_rapid').addEventListener('change',e=>{m().rapid=+e.target.value||5000;refreshPostIfAny();});
  syncMachineUI();
}
function applyPreset(k){S.presetKey=k;S.machine=JSON.parse(JSON.stringify(MACHINES[k]));S.post.ctrl=MACHINES[k].ctrl;S.post.inv=KIN_AXES[S.machine.kin].length>0&&!['mach3','mach4','grbl'].includes(S.post.ctrl);$('#m_preset').value=k;syncMachineUI();syncPostUI();updateFeedsUI();}
function refreshPostIfAny(){if(S.moves&&!S.busy){refreshPost();}}
/* herramientas */
function renderToolList(){
  $('#toolList').innerHTML=S.tools.map(t=>`<button data-id="${t.id}" class="${t.id===S.toolId?'on':''}"><span class="t">T${t.num}</span><span>${t.name}</span><span class="d">Ø${t.D}</span></button>`).join('');
}
function syncToolForm(){
  const t=tool();$('#t_name').value=t.name;$('#t_type').value=t.type;$('#t_num').value=t.num;$('#t_D').value=t.D;$('#t_r').value=t.r;$('#t_angle').value=t.angle;$('#t_tipD').value=t.tipD;$('#t_taper').value=t.taper;
  $('#t_flutes').value=t.flutes;$('#t_fl').value=t.fluteLen;$('#t_so').value=t.stickout;$('#t_shank').value=t.shankD;$('#t_hd').value=t.holderD;$('#t_hl').value=t.holderLen;
  $('#w_r').hidden=t.type!=='bull';$('#w_ang').hidden=!(t.type==='vbit'||t.type==='drill');$('#w_tip').hidden=$('#w_taper').hidden=t.type!=='taperball';
  drawToolSvg();updateFeedsUI();
}
function drawToolSvg(){
  const t=tool();const svg=$('#toolSvg');const hlv=t.holderLen*0.5;const total=t.stickout+hlv;const Rmax=Math.max(t.D,t.shankD,t.holderD)/2;
  const sc=Math.min(148/total,58/Rmax);const cx=96,by=160;const X=d=>+(cx+d*sc).toFixed(1),Y=h=>+(by-h*sc).toFixed(1);
  const prof=[];const n=30;for(let i=-n;i<=n;i++){const d=t.D/2*i/n;prof.push(`${X(d)},${Y(toolH(t,Math.abs(d)))}`);}
  const fl=t.fluteLen,R=t.D/2,sh=t.shankD/2,so=Math.max(t.stickout,fl),hd=t.holderD/2;
  const cutter=`M${X(-R)},${Y(fl)} L${prof.join(' L')} L${X(R)},${Y(fl)} Z`;
  const shank=`M${X(-sh)},${Y(fl)} L${X(-sh)},${Y(so)} L${X(sh)},${Y(so)} L${X(sh)},${Y(fl)} Z`;
  const holder=`M${X(-hd*0.72)},${Y(so)} L${X(-hd)},${Y(so+hlv)} L${X(hd)},${Y(so+hlv)} L${X(hd*0.72)},${Y(so)} Z`;
  const tx=(x,y,s,a='start')=>`<text x="${x}" y="${y}" text-anchor="${a}" style="font:10px 'JetBrains Mono',monospace;fill:var(--ink-2)">${s}</text>`;
  const ln=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--ink-3);stroke-width:.8"/>`;
  const xr=X(Rmax)+8;
  svg.innerHTML=`<path d="${holder}" style="fill:var(--ink-3);opacity:.4"/>
  <path d="${shank}" style="fill:var(--line);stroke:var(--ink-3);stroke-width:1"/>
  <path d="${cutter}" style="fill:var(--accent-2);stroke:var(--accent);stroke-width:1.3"/>
  <line x1="${cx}" y1="6" x2="${cx}" y2="${by+4}" style="stroke:var(--accent);stroke-dasharray:3 3;stroke-width:.7;opacity:.6"/>
  ${ln(X(-R),by+8,X(R),by+8)}${tx(cx,by+22,'Ø'+t.D,'middle')}
  ${ln(xr,Y(0),xr,Y(fl))}${ln(xr+12,Y(0),xr+12,Y(so))}
  ${tx(xr+18,Y(fl/2)+3,'corte '+fl)}${tx(xr+18,Y(so)+8,'voladizo '+t.stickout)}
  ${tx(xr+18,Y(so+hlv*0.6),'porta Ø'+t.holderD)}`;
}
function initToolUI(){
  renderToolList();syncToolForm();
  $('#toolList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.toolId=+b.dataset.id;renderToolList();syncToolForm();buildToolMesh();markStale();});
  const t=()=>tool();
  const map=[['t_D','D'],['t_r','r'],['t_angle','angle'],['t_tipD','tipD'],['t_taper','taper'],['t_flutes','flutes'],['t_fl','fluteLen'],['t_so','stickout'],['t_shank','shankD'],['t_hd','holderD'],['t_hl','holderLen'],['t_num','num']];
  map.forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{const v=parseFloat(e.target.value);if(!Number.isFinite(v)||v<0){e.target.value=t()[k];return;}t()[k]=v;if(k==='D'&&t().type==='ball')t().r=v/2;renderToolList();syncToolForm();buildToolMesh();markStale();}));
  $('#t_name').addEventListener('change',e=>{t().name=e.target.value||'Herramienta';renderToolList();});
  $('#t_type').addEventListener('change',e=>{t().type=e.target.value;if(t().type==='ball')t().r=t().D/2;syncToolForm();buildToolMesh();markStale();});
  $('#t_add').addEventListener('click',()=>{const id=Math.max(...S.tools.map(x=>x.id))+1;S.tools.push({...DEFAULT_TOOLS[0],id,num:id,name:'Nueva herramienta'});S.toolId=id;renderToolList();syncToolForm();buildToolMesh();markStale();});
  $('#t_dup').addEventListener('click',()=>{const id=Math.max(...S.tools.map(x=>x.id))+1;S.tools.push({...tool(),id,num:id,name:tool().name+' (copia)'});S.toolId=id;renderToolList();syncToolForm();});
  $('#t_del').addEventListener('click',()=>{if(S.tools.length<2){toast('Debe quedar al menos una herramienta');return;}S.tools=S.tools.filter(x=>x.id!==S.toolId);S.toolId=S.tools[0].id;renderToolList();syncToolForm();buildToolMesh();markStale();});
  fillSelect($('#f_mat'),MATERIALS,S.feeds.mat);
  $('#f_mat').addEventListener('change',e=>{S.feeds.mat=e.target.value;const M=MATERIALS[e.target.value];S.feeds.vc=Math.round((M.vc[0]+M.vc[1])/2);S.feeds.fz=+(((M.fz6[0]+M.fz6[1])/2)*clamp(tool().D/6,0.3,2)).toFixed(3);updateFeedsUI();refreshPostIfAny();});
  $('#f_vc').addEventListener('change',e=>{S.feeds.vc=+e.target.value||S.feeds.vc;updateFeedsUI();refreshPostIfAny();});
  $('#f_fz').addEventListener('change',e=>{S.feeds.fz=+e.target.value||S.feeds.fz;updateFeedsUI();refreshPostIfAny();});
  $('#f_deff').addEventListener('change',e=>{S.feeds.deff=e.target.checked;updateFeedsUI();refreshPostIfAny();});
}
function updateFeedsUI(){
  const f=S.feeds,M=MATERIALS[f.mat],fd=feedsCalc(),t=tool();$('#f_vc').value=f.vc;$('#f_fz').value=f.fz;$('#f_mat').value=f.mat;$('#f_deff').checked=f.deff;
  $('#o_rpm').textContent=fd.rpm.toLocaleString('es-MX');$('#o_feed').textContent=fd.feed.toLocaleString('es-MX');$('#o_plunge').textContent=fd.plunge.toLocaleString('es-MX');
  const s=clamp(t.D/6,0.3,2);
  $('#o_matnote').textContent=`Referencia orientativa para ${M.name} con carburo: Vc ${M.vc[0]}–${M.vc[1]} m/min, fz ${(M.fz6[0]*s).toFixed(3)}–${(M.fz6[1]*s).toFixed(3)} mm para Ø${t.D}. Confirma con el fabricante de tu herramienta.${fd.clampedRPM?` RPM limitadas por el husillo (${S.machine.maxRPM}).`:''}`;
  const di=fd.deffInfo;$('#o_deff').textContent=di?`Diámetro efectivo en el contacto: ${nf(di.d0,2)} mm sin inclinación${di.beta>0?` → ${nf(di.d1,2)} mm con ${nf(di.beta,0)}° de avance`:''}. Con bola, la punta gira casi a velocidad cero: inclinarla mejora el acabado.`:'';
  updateScallop();
}
function updateScallop(){
  const t=tool(),s=S.strat.stepover;const {R}=cutterRadii(t);let txt='';
  if((t.type==='ball'||t.type==='taperball')&&R>0&&s<2*R){const h=R-Math.sqrt(R*R-(s/2)**2);txt=`Altura de cresta teórica: ${(h*1000).toFixed(1)} µm (${nf(h,4)} mm) en superficie plana.`;}
  else if(t.type==='flat'||t.type==='bull')txt=`Paso lateral ${Math.round(s/t.D*100)} % del diámetro.`;
  $('#o_scallop').textContent=txt;
}
/* estrategia */
function syncStratUI(){
  const st=S.strat;$$('#stratCards .card').forEach(c=>c.classList.toggle('on',c.dataset.kind===st.kind));
  const rot=frameOf(st.kind)==='rot',five=st.kind==='top5'||st.kind==='rot5';
  $('#w_pattern').hidden=!rot;$('#w_dir').hidden=rot;$('#w_5ax').hidden=!five;$('#w_rough').hidden=five;
  $$('#s_pattern button').forEach(b=>b.classList.toggle('on',b.dataset.v===st.pattern));$$('#s_dir button').forEach(b=>b.classList.toggle('on',b.dataset.v===st.dir));
  const ids={s_stepover:'stepover',s_step:'step',s_allow:'allow',s_lead:'lead',s_tilt:'tilt',s_maxtilt:'maxTilt',s_clear:'clear',s_rsd:'rsd',s_rso:'rso',s_rallow:'rallow',s_safe:'safe'};
  for(const [id,k] of Object.entries(ids))$('#'+id).value=st[k];
  $('#s_avoid').checked=st.avoid;$('#s_smooth').checked=st.smooth;$('#s_skip').checked=st.skip;$('#s_rough').checked=st.rough;
  updateScallop();
}
function initStratUI(){
  $('#stratCards').addEventListener('click',e=>{const c=e.target.closest('.card');if(!c)return;const prevF=frameOf(S.strat.kind);S.strat.kind=c.dataset.kind;if(frameOf(S.strat.kind)!==prevF)S.partDirty=true;
    const kin=S.machine.kin;
    if(S.strat.kind==='rot4'&&!['xyza','ab_mixed'].includes(kin))applyPreset('r4');
    if((S.strat.kind==='rot5')&&!['ab_mixed','bc_head'].includes(kin))applyPreset('ab');
    if(S.strat.kind==='top5'&&(kin==='xyz'||kin==='xyza'))applyPreset('ac');
    syncStratUI();markStale();updateFeedsUI();});
  $('#s_pattern').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.strat.pattern=b.dataset.v;syncStratUI();markStale();});
  $('#s_dir').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.strat.dir=b.dataset.v;syncStratUI();markStale();});
  const ids={s_stepover:'stepover',s_step:'step',s_allow:'allow',s_lead:'lead',s_tilt:'tilt',s_maxtilt:'maxTilt',s_clear:'clear',s_rsd:'rsd',s_rso:'rso',s_rallow:'rallow',s_safe:'safe'};
  const mins={stepover:0.05,step:0.05,rsd:0.1,rso:0.1,safe:1,maxTilt:0,clear:0};
  for(const [id,k] of Object.entries(ids))$('#'+id).addEventListener('change',e=>{let v=parseFloat(e.target.value);if(!Number.isFinite(v)){e.target.value=S.strat[k];return;}if(k in mins)v=Math.max(mins[k],v);S.strat[k]=v;e.target.value=v;markStale();updateFeedsUI();});
  [['s_avoid','avoid'],['s_smooth','smooth'],['s_skip','skip'],['s_rough','rough']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{S.strat[k]=e.target.checked;markStale();}));
  syncStratUI();
}
/* post */
const OUT_DESC={gcode:'Programa listo para tu controlador con la trayectoria calculada.',cps:'Posprocesador para Autodesk Fusion con tu cinemática. Cópialo a la biblioteca de posts de Fusion.',pp:'Posprocesador para Vectric Aspire / VCarve (3 ejes). Guárdalo en la carpeta PostP de Vectric.',json:'Definición completa de máquina, herramienta y post para el motor Hetna en el servidor.'};
function currentOut(){switch(S.post.out){case 'cps':return{text:genCPS(),ext:'cps'};case 'pp':return{text:genPP(),ext:'pp'};case 'json':return{text:genJSON(),ext:'json'};default:{const ext={mach3:'tap',mach4:'tap',linuxcnc:'ngc',grbl:'nc',fanuc:'nc',haas:'nc',siemens:'mpf',heidenhain:'h'}[S.post.ctrl];return{text:S.gcode?.text||'(Calcula una trayectoria para generar el G-code)',ext};}}}
function refreshOutputs(){
  const o=currentOut();const ta=$('#outText');const MAXV=400000;ta.value=o.text.length>MAXV?o.text.slice(0,MAXV)+'\n… (vista recortada; Copiar y Descargar incluyen el archivo completo)':o.text;
  $('#outSize').textContent=`${(o.text.length/1024).toFixed(1)} KB · ${o.text.split('\n').length.toLocaleString('es-MX')} líneas`;$('#outDesc').textContent=OUT_DESC[S.post.out];
  $$('#outTabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.post.out));
}
function syncPostUI(){
  const c=S.post,m=S.machine,ctrl=CTRL[c.ctrl];$('#p_cool').value=c.cool;$('#p_dec').value=c.dec;$('#p_prog').value=c.prog;$('#p_lines').checked=c.lines;$('#p_inv').checked=c.inv;
  const axes=KIN_AXES[m.kin];let note='';
  if(!axes.length)note='Trabajo de 3 ejes: salida XYZ estándar.';
  else if(useTCP())note=`${ctrl.name} con TCP: el programa lleva coordenadas de pieza y el control compensa la rotación (${{fanuc:'G43.4',haas:'G234',siemens:'TRAORI',heidenhain:'M128',linuxcnc:'cinemática TCP de LinuxCNC, p. ej. xyzac-trt-kins'}[c.ctrl]||'TCP'}).`;
  else note=`${ctrl.name} sin TCP: el post calcula las coordenadas de máquina con ${isHeadKin(m.kin)?'la longitud de pivote':'el centro de giro'}. El G-code vale solo para esta herramienta y voladizo.`;
  if(axes.length>ctrl.maxAxes-3)note+=' Este controlador no maneja ese número de ejes en su versión estándar.';
  $('#postNote').textContent=note;$('#postNote').className='note'+(axes.length>ctrl.maxAxes-3?' warn':'');
}
function initPostUI(){
  syncPostUI();
  if(/claude/i.test(location.hostname))$('#btnDl').hidden=true; // en el visor de Claude las descargas están bloqueadas; en el servidor sí funcionan
  $('#p_cool').addEventListener('change',e=>{S.post.cool=e.target.value;refreshPostIfAny();refreshOutputs();});
  $('#p_dec').addEventListener('change',e=>{S.post.dec=clamp(parseInt(e.target.value)||3,1,5);e.target.value=S.post.dec;refreshPostIfAny();refreshOutputs();});
  $('#p_prog').addEventListener('change',e=>{S.post.prog=parseInt(e.target.value)||1000;refreshPostIfAny();refreshOutputs();});
  $('#p_lines').addEventListener('change',e=>{S.post.lines=e.target.checked;refreshPostIfAny();refreshOutputs();});
  $('#p_inv').addEventListener('change',e=>{S.post.inv=e.target.checked;refreshPostIfAny();refreshOutputs();});
  $('#outTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.post.out=b.dataset.v;refreshOutputs();});
  $('#btnCopy').addEventListener('click',async()=>{const t=currentOut().text;try{await navigator.clipboard.writeText(t);toast('Copiado al portapapeles');}catch(err){const ta=$('#outText');ta.focus();ta.select();toast('Selecciona y copia con Ctrl+C');}});
  $('#btnDl').addEventListener('click',()=>{const o=currentOut();const name=(S.partName||'hetna').replace(/\.[^.]+$/,'')+'.'+o.ext;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([o.text],{type:'text/plain'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);toast('Si la descarga no inicia, usa Copiar');});
}
/* pestañas y vista */
function showTab(k){$$('.steps button').forEach(b=>b.classList.toggle('on',b.dataset.tab===k));$$('.pane').forEach(p=>p.hidden=p.dataset.pane!==k);if(k==='post')refreshOutputs();}
function initChrome(){
  $$('.steps button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  $('#btnGoPost').addEventListener('click',()=>{showTab('post');S.post.out='gcode';refreshOutputs();});
  $('#btnCompute').addEventListener('click',compute);$('#btnCompute2').addEventListener('click',compute);
  $('#viewToggles').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.v;VIS[k]=!VIS[k];b.classList.toggle('on',VIS[k]);applyVisibility();});
  $$('[data-cam]').forEach(b=>b.addEventListener('click',()=>fitView(b.dataset.cam)));
  $('#simPlay').addEventListener('click',()=>{if(!S.moves)return;if(SIM.t>=simTotal())SIM.t=0,resetStockCut();setPlaying(!SIM.playing);});
  $('#simReset').addEventListener('click',()=>{setPlaying(false);SIM.t=0;resetStockCut();});
  $('#simEnd').addEventListener('click',async()=>{if(!S.moves)return;setPlaying(false);stockSolid(true);SIM.t=simTotal();setBusy('Simulando remoción de material…',0);const pose=poseAt(SIM.t);let guard=0;while(!advanceCut(pose.i,pose.f,20000)&&guard++<5000){setBusy('Simulando remoción de material…',SIM.cutIdx/S.moves.length);await tick();}setBusy(null);});
  const sc=$('#simScrub');sc.addEventListener('pointerdown',()=>SIM.scrubbing=true);sc.addEventListener('pointerup',()=>SIM.scrubbing=false);
  sc.addEventListener('input',()=>{if(!S.moves)return;const t=sc.value/1000*simTotal();if(t<SIM.t-1e-9){resetStockCut();}SIM.t=t;stockSolid(true);});
  $('#simSpeed').addEventListener('change',e=>SIM.mult=+e.target.value);
  // archivos
  const fi=$('#fileIn'),drop=$('#drop');fi.addEventListener('change',()=>{if(fi.files[0])loadFile(fi.files[0]);fi.value='';});
  const view=$('.view');
  [drop,view].forEach(el=>{el.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});el.addEventListener('dragleave',()=>drop.classList.remove('over'));el.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');const f=e.dataTransfer.files[0];if(f)loadFile(f);});});
  $('#samples').addEventListener('click',e=>{const b=e.target.closest('[data-sample]');if(b)loadSample(b.dataset.sample);});
  $$('[data-rot]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.rot==='reset')S.rotSeq=[];else S.rotSeq.push(b.dataset.rot);S.partDirty=true;reprep();}));
  $('#p_units').addEventListener('change',e=>{S.units=+e.target.value;S.partDirty=true;reprep();});
  $('#p_scale').addEventListener('change',e=>{S.scale=Math.max(0.01,+e.target.value||1);S.partDirty=true;reprep();});
  ['stk_margin','stk_top'].forEach(id=>$('#'+id).addEventListener('change',()=>{S.partDirty=true;reprep();}));
}
async function reprep(){if(S.busy)return;S.busy=true;try{await preparePart();S.partDirty=false;S.moves=null;S.gcode=null;buildPathObjects();markStale();$('#kpis').innerHTML='';renderIssues([{sev:'info',title:'Pieza actualizada',cause:'Pulsa Calcular trayectoria para generar el programa.',fix:''}]);}finally{setBusy(null);S.busy=false;}}

/* ---------------- Carga de archivos ---------------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('No se pudo cargar '+src));document.head.appendChild(s);});}
async function convertOnServer(file){
  const fd=new FormData();fd.append('file',file,file.name);
  const r=await fetch(HETNA.backend+'/store/cam/convert',{method:'POST',headers:{'x-publishable-api-key':HETNA.key},body:fd});
  const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.message||('Error '+r.status+' al convertir'));
  const bin=atob(b.positions);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
}
async function parseSTEP(buf,ext='step'){
  const base='https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';
  if(!window.occtimportjs)await loadScript(base+'occt-import-js.js');
  const occt=await Promise.race([occtimportjs({locateFile:f=>base+f}),new Promise((_,r)=>setTimeout(()=>r(new Error('tiempo agotado')),25000))]);
  const res=(ext==='iges'||ext==='igs')?occt.ReadIgesFile(new Uint8Array(buf),null):occt.ReadStepFile(new Uint8Array(buf),null);if(!res||!res.success||!res.meshes?.length)throw new Error('El STEP no contiene sólidos legibles');
  const out=[];for(const mesh of res.meshes){const p=mesh.attributes.position.array,ix=mesh.index.array;for(let i=0;i<ix.length;i++){out.push(p[ix[i]*3],p[ix[i]*3+1],p[ix[i]*3+2]);}}
  return new Float32Array(out);
}
async function loadFile(file){
  if(S.busy)return;const ext=file.name.split('.').pop().toLowerCase();
  setBusy(`Leyendo ${file.name}…`,0.02);
  try{
    let pos;
    if(ext==='stl'){const buf=await file.arrayBuffer();const g=new THREE.STLLoader().parse(buf);pos=new Float32Array((g.index?g.toNonIndexed():g).attributes.position.array);}
    else if(ext==='obj'){const txt=await file.text();const grp=new THREE.OBJLoader().parse(txt);grp.updateMatrixWorld(true);const parts=[];let n=0;grp.traverse(o=>{if(o.isMesh){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const a=g.attributes.position.array;parts.push(a);n+=a.length;}});pos=new Float32Array(n);let off=0;for(const a of parts){pos.set(a,off);off+=a.length;}}
    else if(['step','stp','iges','igs'].includes(ext)){setBusy('Convirtiendo '+ext.toUpperCase()+' a malla (OpenCascade)…',0.05);
      try{pos=await parseSTEP(await file.arrayBuffer(),ext);}
      catch(e){
        if(!HETNA_ON)throw new Error('No se pudo convertir el archivo en este navegador ('+e.message+'). Exporta la pieza como STL.');
        setBusy('Convirtiendo en el servidor…',0.1);pos=await convertOnServer(file);}
    }
    else throw new Error('Formato no soportado. Usa STL, OBJ o STEP.');
    if(!pos||pos.length<9)throw new Error('El archivo no contiene triángulos.');
    S.rawPos=pos;S.rawFile=file;S.partName=file.name;S.rotSeq=[];S.scale=1;$('#p_scale').value=1;$('#jobName').textContent=file.name;
    const sz=[0,1,2].map(c=>{let a=Infinity,b=-Infinity;for(let i=c;i<pos.length;i+=3){if(pos[i]<a)a=pos[i];if(pos[i]>b)b=pos[i];}return b-a;});
    if(Math.max(...sz)<12){S.units=25.4;$('#p_units').value='25.4';toast('La pieza es muy pequeña: se interpretó en pulgadas');}else{S.units=1;$('#p_units').value='1';}
    S.busy=true;await preparePart();S.busy=false;S.partDirty=false;S.moves=null;S.gcode=null;buildPathObjects();
    setBusy(null);await compute();
  }catch(e){console.error(e);setBusy(null);S.busy=false;renderIssues([{sev:'err',title:'No se pudo abrir el archivo',cause:e.message,fix:''}]);toast('No se pudo abrir el archivo');}
}
async function loadSample(k){
  if(S.busy)return;const sm=SAMPLES[k];S.rawPos=sm.fn();S.rawFile=null;S.partName=sm.name;S.rotSeq=[];S.units=1;S.scale=1;$('#p_units').value='1';$('#p_scale').value=1;$('#jobName').textContent=sm.name;
  $('#stk_margin').value=sm.margin??3;
  applyPreset(sm.preset);S.toolId=sm.tool;Object.assign(S.strat,sm.strat);renderToolList();syncToolForm();syncStratUI();buildToolMesh();
  $$('#samples .chip').forEach(c=>c.classList.toggle('on',c.dataset.sample===k));
  S.M=null;await compute();
}

/* ---------------- Pedido a la tienda ---------------- */
const ORDER={service:'cam',busy:false};
function stlFromPositions(pos){
  const n=pos.length/9|0;const buf=new ArrayBuffer(84+50*n);const dv=new DataView(buf);
  dv.setUint32(80,n,true);let o=84;
  for(let t=0;t<n;t++){o+=12;for(let k=0;k<9;k++){dv.setFloat32(o,pos[t*9+k],true);o+=4;}o+=2;}
  return buf;
}
function orderStatus(text,tone){const el=$('#o_status');if(!text){el.hidden=true;return;}el.hidden=false;el.className='note'+(tone==='warn'?' warn':'');el.textContent=text;}
async function sendOrder(){
  if(ORDER.busy||!S.rawPos)return;
  const service=ORDER.service;
  if(service==='cam'&&(!S.moves||S.stale)){orderStatus('Calcula la trayectoria con los parámetros actuales antes de pedir el programa.','warn');return;}
  const email=$('#o_email').value.trim();
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){orderStatus('Revisa el correo: parece incompleto.','warn');return;}
  ORDER.busy=true;$('#btnOrderSend').disabled=true;orderStatus('Enviando tu pieza…');
  try{
    const base=(S.partName||'pieza').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\.[^.]+$/,'').replace(/[^\w\-]+/g,'_').slice(0,60)||'pieza';
    const modelBlob=S.rawFile||new Blob([stlFromPositions(S.rawPos)],{type:'model/stl'});
    const modelName=S.rawFile?S.rawFile.name:base+'.stl';
    const fd=new FormData();fd.append('model',modelBlob,modelName);
    if(service==='cam'&&S.gcode?.text){const ext=currentOutExt();fd.append('gcode',new Blob([S.gcode.text],{type:'text/plain'}),base+'.'+ext);}
    const res=S.job?.res,s5=res?.stats5;
    const coll=s5?s5.coll:(res?res.passes.reduce((a,p)=>a+p.pts.filter(q=>q.st>=2).length,0):0);
    const stats={minutes:+(S.jobStats?.total||0).toFixed(2),points:S.moves?S.moves.filter(m=>m.t==='F').length:0,triangles:S.M?.nT||0,
      collisions:coll|0,adjusted:(s5?s5.adjusted:0)|0,cut_length_m:+((S.jobStats?.lenCut||0)/1000).toFixed(3),gcode_lines:S.gcode?.lines?.length||0};
    const payload={service,review:$('#o_review').checked,email:email||null,notes:$('#o_notes').value.trim()||null,model_name:modelName,
      controller:S.post.ctrl,kinematics:S.machine.kin,strategy_kind:S.strat.kind,config:JSON.parse(genJSON()),stats};
    fd.append('payload',JSON.stringify(payload));
    const r=await fetch(HETNA.backend+'/store/cam/jobs',{method:'POST',headers:{'x-publishable-api-key':HETNA.key},body:fd});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.message||('Error '+r.status));
    const job=body.job;
    if(HETNA.embedded){window.parent.postMessage({type:'hetna-cam:job-created',job_id:job.id,access_token:job.access_token,review:payload.review},location.origin);orderStatus('Pieza recibida. Agregando al carrito…');}
    else{orderStatus('Pieza recibida. Folio '+job.id+'. Guarda este número para dar seguimiento.');ORDER.busy=false;$('#btnOrderSend').disabled=false;}
  }catch(e){orderStatus('No se pudo enviar: '+e.message,'warn');ORDER.busy=false;$('#btnOrderSend').disabled=false;}
}
function currentOutExt(){return {mach3:'tap',mach4:'tap',linuxcnc:'ngc',grbl:'nc',fanuc:'nc',haas:'nc',siemens:'mpf',heidenhain:'h'}[S.post.ctrl]||'nc';}
function initOrderUI(){
  if(!HETNA_ON)return;
  $('#orderBox').hidden=false;$('#btnOrder').hidden=false;
  $('#btnOrder').addEventListener('click',()=>{showTab('post');$('#orderBox').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#o_service').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;ORDER.service=b.dataset.v;$$('#o_service button').forEach(x=>x.classList.toggle('on',x===b));});
  $('#btnOrderSend').addEventListener('click',sendOrder);
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin)return;const d=e.data||{};if(d.type!=='hetna-cam:cart-result')return;
    ORDER.busy=false;$('#btnOrderSend').disabled=false;
    if(d.ok)orderStatus('Listo: el servicio está en tu carrito.');else orderStatus('No se pudo agregar al carrito: '+(d.error||'error desconocido'),'warn');
  });
}

/* ---------------- Arranque ---------------- */
function boot(){
  if(!window.THREE||!THREE.OrbitControls){document.body.insertAdjacentHTML('afterbegin','<p style="padding:16px">No se pudo cargar el motor 3D. Revisa tu conexión.</p>');return;}
  init3D();initChrome();initMachineUI();initToolUI();initStratUI();initPostUI();initOrderUI();buildToolMesh();
  loadSample('blade');
}
boot();
