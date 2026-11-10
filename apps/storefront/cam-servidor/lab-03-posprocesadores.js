'use strict';
/* =========================================================
   POSPROCESADORES
   Este archivo NO se sirve al navegador: corre en el servidor
   (src/app/api/cam/post/route.ts), que es quien revisa el plan
   antes de entregar el programa. Usa lo que define
   public/cam-lab/lab-01-motor.js.
   ========================================================= */
function postProcess(){
  const moves=S.moves;if(!moves||!moves.length)return{text:'',lines:[]};
  let tl=toolById(moves[0].tid),fd=feedsCalc(tl);const used=[...new Set(moves.map(q=>q.tid))].map(toolById); // fresas del trabajo, en el orden en que entran
  const m=S.machine,ctrl=CTRL[S.post.ctrl],c={...S.post,ctrl:dialOf(S.post.ctrl)};const axes=KIN_AXES[m.kin];const tcp=useTCP(); // c.ctrl es el dialecto; ctrl, el perfil elegido con sus excepciones
  const dec=clamp(c.dec|0,1,5);const heid=ctrl.style==='heid';
  const fmt=v=>{let s=(Math.abs(v)<0.5*10**-dec?0:v).toFixed(dec);if(heid&&!s.startsWith('-'))s='+'+s;return s;};
  const cm=s=>ctrl.noComments?null:ctrl.comment==='paren'?`(${String(s).replace(/[()]/g,'')})`:`; ${s}`;
  const L=[];let N=10;
  const out=(s,num=true)=>{if(s===null||s==='')return;if(heid){L.push(`${L.length} ${s}`);return;}if(c.lines&&num&&!/^[(%;]/.test(s)){s=`N${N} ${s}`;N+=10;}L.push(s);};
  const inv=c.inv&&axes.length>0&&!tcp&&c.ctrl!=='heidenhain';
  const dirs=[m.inv[0]?-1:1,m.inv[1]?-1:1];
  const name=(S.partName||'PIEZA').replace(/\.[^.]+$/,'').toUpperCase().replace(/[^A-Z0-9_-]/g,'_').slice(0,20)||'PIEZA';
  const dt=new Date().toISOString().slice(0,10);
  let tn=tl.num|0||1;const cool=c.cool==='none'||ctrl.noCool?null:c.cool;
  const z0=zeroOff();const zs=S.stock;const stk=zs.type==='box'?{type:'box',min:V.sub(zs.min,z0),max:V.sub(zs.max,z0)}:{type:'cyl',x0:zs.x0-z0[0],x1:zs.x1-z0[0],r:zs.r};
  const extra=t=>String(t||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(x=>out(x,!heid));
  // encabezado
  if(heid){
    out(`BEGIN PGM ${name} MM`);out(`; HETNA CAM LAB ${dt} - ${KIN_NAME[m.kin]}`);used.forEach(u=>out(`; T${u.num|0||1} ${u.name}`));out('; CERO DE PIEZA: '+ZERO_NAME[zeroKey()]);out('; VERIFICAR EN VACIO ANTES DE CORTAR');
    if(stk.type==='box'){out(`BLK FORM 0.1 Z X${fmt(stk.min[0])} Y${fmt(stk.min[1])} Z${fmt(stk.min[2])}`);out(`BLK FORM 0.2 X${fmt(stk.max[0])} Y${fmt(stk.max[1])} Z${fmt(stk.max[2])}`);}
    else{out(`BLK FORM 0.1 X X${fmt(stk.x0)} Y${fmt(-stk.r)} Z${fmt(-stk.r)}`);out(`BLK FORM 0.2 X${fmt(stk.x1)} Y${fmt(stk.r)} Z${fmt(stk.r)}`);}
    out(`TOOL CALL ${tn} Z S${fd.rpm}`);if(tcp&&axes.length)out('M128');
  }else{
    if(['linuxcnc','fanuc','haas'].includes(c.ctrl))L.push('%');
    if(c.ctrl==='fanuc'||c.ctrl==='haas')L.push(`O${String(c.prog|0).padStart(4,'0')} ${cm(name)||''}`.trim());
    out(cm(`HETNA CAM LAB - ${name} - ${dt}`),false);
    out(cm(`MAQUINA ${KIN_NAME[m.kin]} - CONTROL ${ctrl.name}${tcp?' - TCP ACTIVO':' - SIN TCP (COORD. MAQUINA CALCULADAS)'}`),false);
    used.forEach(u=>{out(cm(`T${u.num|0||1} ${u.name} D${u.D} VOLADIZO ${u.stickout}`),false);
      if(!tcp&&isHeadKin(m.kin))out(cm(`PIVOTE T${u.num|0||1} ${m.pivot}+${u.stickout}+${u.holderLen} = ${m.pivot+u.stickout+u.holderLen} MM`),false);});
    if(used.length>1)out(cm(`${used.length} HERRAMIENTAS: MIDE EL LARGO DE CADA UNA ANTES DE CORRER`),false);
    if(tcp&&axes.length&&c.ctrl==='linuxcnc')out(cm('TCP: ACTIVA LA CINEMATICA TCP DE TU CONFIGURACION LINUXCNC ANTES DE EJECUTAR'),false);
    out(cm('CERO DE PIEZA: '+ZERO_NAME[zeroKey()]),false);
    out(cm('VERIFICAR EN VACIO CON AVANCE REDUCIDO ANTES DE CORTAR'),false);
    if(c.ctrl==='siemens'){out('G17 G90 G71 G94');out('G54');out(`T${tn} D1`);out('M6');}
    else if(c.ctrl==='grbl'||ctrl.manualTC){out(ctrl.header||(c.ctrl==='grbl'?'G21 G90 G94 G17':'G21 G90 G94 G17 G40 G49 G80'));if(!ctrl.noG54)out('G54');out(cm(`CAMBIO MANUAL DE HERRAMIENTA T${tn}`),false);}
    else{out('G21 G90 G94 G17 G40 G49 G80');out('G54');out(`T${tn} M6`);}
    if(c.ctrl==='linuxcnc')out('G64 P0.02');
    out(`S${fd.rpm} M3`);if(cool)out(cool);
    if(tcp&&axes.length){if(c.ctrl==='siemens')out('TRAORI');}
  }
  extra(c.pre);
  const lineOf=new Int32Array(moves.length);let last={};let lastG=null,lastF=null,g93=false,needM3=true,split=false;
  // Cambio de fresa a media corrida: para el husillo, llama la herramienta, compensa su largo y vuelve a
  // escribir todas las coordenadas. La trayectoria ya dejó la fresa anterior retirada a la altura segura.
  const toolChange=nt=>{
    tl=nt;fd=feedsCalc(tl);tn=tl.num|0||1;
    if(heid){if(tcp&&axes.length)out('M129');out('M5');out(`; CAMBIO A T${tn} ${tl.name}`);out(`TOOL CALL ${tn} Z S${fd.rpm}`);if(tcp&&axes.length)out('M128');needM3=true;return;}
    if(g93){out('G94');g93=false;}
    if(tcp&&axes.length&&c.ctrl==='siemens')out('TRAFOOF');
    if(cool)out('M9');out('M5');
    out(cm(`CAMBIO A T${tn} ${tl.name} D${tl.D} VOLADIZO ${tl.stickout}`),false);
    if(c.ctrl==='siemens'){out(`T${tn} D1`);out('M6');}
    else if(c.ctrl==='grbl'||ctrl.manualTC){out(cm(`CAMBIO MANUAL: MONTA T${tn}, VUELVE A MEDIR EL CERO EN Z Y CONTINUA`),false);out('M0');}
    else{if(!ctrl.noG43)out('G49');out(`T${tn} M6`);}
    out(`S${fd.rpm} M3`);if(cool)out(cool);
    if(tcp&&axes.length){if(c.ctrl==='siemens')out('TRAORI');else if(c.ctrl==='fanuc')out('G43.4 H'+tn);else if(c.ctrl==='haas')out('G234 H'+tn);else if(c.ctrl==='linuxcnc')out('G43 H'+tn);}
    else if(c.ctrl!=='siemens'&&c.ctrl!=='grbl'&&!ctrl.noG43&&!ctrl.manualTC)out('G43 H'+tn);
    last={};lastG=null;lastF=null;split=true;
  };
  // Sin TCP el control interpola los ejes lineales y los rotativos cada uno por su lado, así que en un
  // bloque con giro la punta se sale de la recta. Se parte el bloque hasta que el desvío sea menor a 0.01 mm.
  const subdiv=(pv,mv)=>{
    if(Math.max(...axes.map((a,q)=>Math.abs(mv.ang[q]-pv.ang[q])))<0.05)return null;
    const at=u=>{const ang=axes.map((a,q)=>pv.ang[q]+(mv.ang[q]-pv.ang[q])*u);const k=kinMats(m.kin,ang);return{ang,pm:linearOut({p:V.lerp(pv.p,mv.p,u),R:k.R,ha:k.ha},m,tl,false)};};
    let n=1;
    for(;n<512;n*=2){let worst=0;for(let q=0;q<n&&worst<=0.01;q++){const d=V.dist(at((q+0.5)/n).pm,V.lerp(at(q/n).pm,at((q+1)/n).pm,0.5));if(d>worst)worst=d;}if(worst<=0.01)break;}
    if(n===1)return null;
    const st=[];for(let q=1;q<n;q++)st.push(at(q/n));st.push({pm:mv.pm,ang:mv.ang});return st;
  };
  const block=(i,mv,sp,pv,len)=>{
    const pm=sp.pm;const words=[];const W={X:pm[0],Y:pm[1],Z:pm[2]};axes.forEach((a,q)=>W[a]=sp.ang[q]*dirs[q]);
    const rapid=mv.t==='R';
    if(heid){
      const parts=['X','Y','Z',...axes].map(k=>`${k}${fmt(W[k])}`);const f=rapid?'FMAX':`F${mv.t==='P'?fd.plunge:fd.feed}`;
      let extra='';if(needM3){needM3=false;extra=' M3'+(cool?(cool==='M8'?' M8':' M7'):'');}
      out(`L ${parts.join(' ')} R0 ${f}${extra}`);return;
    }
    for(const k of ['X','Y','Z',...axes]){const s=fmt(W[k]);if(last[k]!==s){words.push(k+s);last[k]=s;}}
    const g=rapid?'G0':'G1';
    // tras un cambio de fresa: primero se coloca en XY (y giros) y luego baja a la altura segura
    if(split){split=false;const zw=words.filter(w=>w[0]==='Z'),ow=words.filter(w=>w[0]!=='Z');if(rapid&&zw.length&&ow.length){out('G0 '+ow.join(' '));out('G0 '+zw.join(' '));lastG='G0';return;}}
    let pre='';
    if(i===0){let g43='';if(tcp&&axes.length){if(c.ctrl==='fanuc')g43='G43.4 H'+tn;else if(c.ctrl==='haas')g43='G234 H'+tn;else if(c.ctrl==='linuxcnc')g43='G43 H'+tn;}else if(c.ctrl!=='grbl'&&!ctrl.noG43)g43='G43 H'+tn;
      if(c.ctrl!=='siemens'&&g43)out(g43);}
    let feedWord='';
    if(!rapid){
      const f=mv.t==='P'?fd.plunge:fd.feed;
      const dAng=pv?Math.hypot(...axes.map((a,q)=>sp.ang[q]-pv.ang[q])):0;const multi=pv&&dAng>1e-4;
      if(multi&&inv){const Fi=Math.min(f/Math.max(len,1e-3),99999);if(!g93){pre+='G93 ';g93=true;}feedWord=' F'+Fi.toFixed(3);lastF=null;}
      else if(multi){
        // G94 con eje rotativo: Mach3/Mach4/GRBL miden el bloque como hipot(mm, grados).
        // Para que dure lo que dura el corte real (len / f), la F del bloque es esa
        // "distancia" entre ese tiempo. Es lo mismo que hacen los posts "wrap" de Vectric.
        if(g93){pre+='G94 ';g93=false;}
        const dLin=Math.hypot(pm[0]-pv.pm[0],pm[1]-pv.pm[1],pm[2]-pv.pm[2]);const t=Math.max(len,1e-3)/f;
        const Fe=Math.round(Math.min(99999,Math.max(1,Math.hypot(dLin,dAng)/t)));
        if(lastF!==Fe){feedWord=' F'+Fe;lastF=Fe;}
      }
      else{if(g93){pre+='G94 ';g93=false;lastF=null;}if(lastF!==f){feedWord=' F'+f;lastF=f;}}
    }
    if(!words.length&&!feedWord&&!pre)return;
    const gw=(g!==lastG||pre)?g+' ':'';lastG=g;
    out(`${pre}${gw}${words.join(' ')}${feedWord}`.trim());
  };
  const linearize=axes.length>0&&!tcp;
  for(let i=0;i<moves.length;i++){
    const mv=moves[i];let pv=i>0?moves[i-1]:null;
    if(pv&&mv.tid!==pv.tid)toolChange(toolById(mv.tid));
    const steps=(linearize&&pv&&mv.t!=='R'&&!mv.kfail&&!pv.kfail&&subdiv(pv,mv))||[mv];
    const len=mv.len/steps.length;
    for(const sp of steps){block(i,mv,sp,pv,len);pv=sp;}
    lineOf[i]=L.length-1;
  }
  // pie
  extra(c.end);
  if(heid){if(tcp&&axes.length)out('M129');out('M5');if(cool)out('M9');out('M30');out(`END PGM ${name} MM`);}
  else{
    if(g93)out('G94');
    if(tcp&&axes.length){if(c.ctrl==='siemens')out('TRAFOOF');else out('G49');}
    if(cool)out('M9');out('M5');
    if(c.ctrl==='fanuc'||c.ctrl==='haas'){out('G91 G28 Z0.');out('G90');}
    out(ctrl.end!==undefined?ctrl.end:c.ctrl==='linuxcnc'?'M2':'M30');
    if(['linuxcnc','fanuc','haas'].includes(c.ctrl))L.push('%');
  }
  return{text:L.join('\n')+'\n',lines:L,lineOf};
}
function genCPS(){
  const m=S.machine,ctrl=CTRL[S.post.ctrl],c={...S.post,ctrl:dialOf(S.post.ctrl)},axes=KIN_AXES[m.kin],tcp=useTCP();
  const ax=(letter,q)=>{const L=m.rot[q];const cyc=L[1]-L[0]>=720;const vec={A:[1,0,0],B:[0,1,0],C:[0,0,1]}[letter].map(v=>m.inv[q]&&v?-v:v);const coord={A:0,B:1,C:2}[letter];
    const table=!(m.kin==='bc_head'||(m.kin==='ab_mixed'&&letter==='B'));
    return `  var ${letter.toLowerCase()}Axis = createAxis({coordinate:${coord}, table:${table}, axis:[${vec.join(', ')}], offset:[${m.rc.join(', ')}], ${cyc?'cyclic:true':`range:[${L[0]}, ${L[1]}]`}, preference:0});`;};
  let mc='';
  if(axes.length){mc=axes.map((a,q)=>ax(a,q)).join('\n')+`\n  machineConfiguration = new MachineConfiguration(${axes.map(a=>a.toLowerCase()+'Axis').join(', ')});\n  setMachineConfiguration(machineConfiguration);\n  optimizeMachineAngles2(${tcp?0:1}); // 0 = TCP en el control, 1 = mapear punta a coordenadas de máquina`;}
  const tcpOn=tcp?({fanuc:'"G43.4", "H" + toolFormat.format(tool.lengthOffset)',haas:'"G234", "H" + toolFormat.format(tool.lengthOffset)',linuxcnc:'"G43", "H" + toolFormat.format(tool.lengthOffset)',siemens:'"TRAORI"',heidenhain:'"M128"'}[c.ctrl]||null):null;
  const ext=extOf(S.post.ctrl);
  return `/**
  Postprocesador Fusion 360 generado por HETNA CAM LAB (hetnacnc.com)
  Controlador: ${ctrl.name} · Cinemática: ${KIN_NAME[m.kin]} · TCP: ${tcp?'sí':'no'}
  ${isHeadKin(m.kin)&&!tcp?'Cabezal sin TCP: define la longitud de pivote ('+m.pivot+' mm) en la configuración de máquina de Fusion.':''}
  IMPORTANTE: plantilla inicial. Valídala en el simulador de máquina de Fusion y corre
  el primer programa en vacío con avance reducido. Arcos desactivados (todo se linealiza).
*/
description = "Hetna - ${ctrl.name} - ${KIN_NAME[m.kin]}";
vendor = "Hetna CNC";
vendorUrl = "https://hetnacnc.com";
legal = "Generado por Hetna CAM Lab";
certificationLevel = 2;
minimumRevision = 45702;
longDescription = "Post ${KIN_NAME[m.kin]} para ${ctrl.name} generado por Hetna CAM Lab.";
extension = "${ext}";
setCodePage("ascii");
capabilities = CAPABILITY_MILLING;
tolerance = spatial(0.002, MM);
minimumChordLength = spatial(0.25, MM);
minimumCircularRadius = spatial(0.01, MM);
maximumCircularRadius = spatial(1000, MM);
minimumCircularSweep = toRad(0.01);
maximumCircularSweep = toRad(180);
allowHelicalMoves = false;
allowedCircularPlanes = 0;

properties = {
  showSequenceNumbers: {title:"Numerar líneas", description:"Agrega N a cada bloque", type:"boolean", value:${c.lines}, scope:"post"},
  sequenceNumberStart: {title:"Inicio de numeración", type:"integer", value:10, scope:"post"},
  sequenceNumberIncrement: {title:"Incremento", type:"integer", value:10, scope:"post"},
  useInverseTime: {title:"Tiempo inverso (G93) en multieje", type:"boolean", value:${c.inv&&!tcp}, scope:"post"},
  useCoolant: {title:"Refrigerante", type:"boolean", value:${c.cool!=='none'}, scope:"post"}
};

var gFormat = createFormat({prefix:"G", decimals:0});
var mFormat = createFormat({prefix:"M", decimals:0});
var xyzFormat = createFormat({decimals:${c.dec}, forceDecimal:true});
var abcFormat = createFormat({decimals:${c.dec}, forceDecimal:true, scale:DEG});
var feedFormat = createFormat({decimals:1, forceDecimal:true});
var inverseTimeFormat = createFormat({decimals:3, forceDecimal:true});
var rpmFormat = createFormat({decimals:0});
var toolFormat = createFormat({decimals:0});

var xOutput = createVariable({prefix:"X"}, xyzFormat);
var yOutput = createVariable({prefix:"Y"}, xyzFormat);
var zOutput = createVariable({prefix:"Z"}, xyzFormat);
var aOutput = createVariable({prefix:"A"}, abcFormat);
var bOutput = createVariable({prefix:"B"}, abcFormat);
var cOutput = createVariable({prefix:"C"}, abcFormat);
var feedOutput = createVariable({prefix:"F"}, feedFormat);
var inverseTimeOutput = createVariable({prefix:"F", force:true}, inverseTimeFormat);
var sOutput = createVariable({prefix:"S", force:true}, rpmFormat);
var gMotionModal = createModal({}, gFormat);
var gFeedModeModal = createModal({}, gFormat);
var sequenceNumber = 10;
var USE_TCP = ${tcp};

function writeBlock() {
  var text = formatWords(arguments);
  if (!text) { return; }
  if (getProperty("showSequenceNumbers")) {
    writeln("N" + sequenceNumber + " " + text);
    sequenceNumber += getProperty("sequenceNumberIncrement");
  } else {
    writeln(text);
  }
}
function writeComment(text) { writeln("(" + String(text).replace(/[()]/g, "") + ")"); }

function onOpen() {
${mc||'  // Máquina de 3 ejes: sin ejes rotativos'}
  if (!machineConfiguration.isMachineCoordinate(0)) { aOutput.disable(); }
  if (!machineConfiguration.isMachineCoordinate(1)) { bOutput.disable(); }
  if (!machineConfiguration.isMachineCoordinate(2)) { cOutput.disable(); }
  sequenceNumber = getProperty("sequenceNumberStart");
${['linuxcnc','fanuc','haas'].includes(c.ctrl)?'  writeln("%");\n':''}${c.ctrl==='fanuc'||c.ctrl==='haas'?`  writeln("O${String(c.prog).padStart(4,'0')}");\n`:''}  if (programName) { writeComment(programName); }
  writeComment("Hetna CAM Lab - verificar en vacio antes de cortar");
${c.ctrl==='siemens'?'  writeBlock(gFormat.format(17), gFormat.format(90), gFormat.format(71), gFormat.format(94));':c.ctrl==='grbl'?'  writeBlock(gFormat.format(21), gFormat.format(90), gFormat.format(94), gFormat.format(17));':'  writeBlock(gFormat.format(21), gFormat.format(90), gFormat.format(94), gFormat.format(17), gFormat.format(40), gFormat.format(49), gFormat.format(80));'}
${c.ctrl==='linuxcnc'?'  writeBlock("G64 P0.02");\n':''}}

function onSection() {
  var insertToolCall = isFirstSection() || (tool.number != getPreviousSection().getTool().number);
  if (insertToolCall) {
    if (!isFirstSection()) { writeBlock(mFormat.format(5)); }
${c.ctrl==='grbl'?'    writeComment("Cambio manual T" + toolFormat.format(tool.number));':c.ctrl==='siemens'?'    writeBlock("T" + toolFormat.format(tool.number), "D1");\n    writeBlock(mFormat.format(6));':'    writeBlock("T" + toolFormat.format(tool.number), mFormat.format(6));'}
    if (tool.comment) { writeComment(tool.comment); }
  }
  writeBlock(gFormat.format(54));
  if (machineConfiguration.isMultiAxisConfiguration()) {
    if (currentSection.isMultiAxis()) {
      cancelTransformation();
    } else {
      var abc = machineConfiguration.getABC(currentSection.workPlane);
      gMotionModal.reset();
      writeBlock(gMotionModal.format(0), conditional(machineConfiguration.isMachineCoordinate(0), "A" + abcFormat.format(abc.x)), conditional(machineConfiguration.isMachineCoordinate(1), "B" + abcFormat.format(abc.y)), conditional(machineConfiguration.isMachineCoordinate(2), "C" + abcFormat.format(abc.z)));
      setCurrentABC(abc);
      setRotation(machineConfiguration.getRemainingOrientation(abc, currentSection.workPlane));
    }
  } else {
    if (!isSameDirection(currentSection.workPlane.forward, new Vector(0, 0, 1))) { error("Plano de trabajo inclinado no soportado en 3 ejes."); return; }
    setRotation(currentSection.workPlane);
  }
  writeBlock(sOutput.format(spindleSpeed), mFormat.format(tool.clockwise ? 3 : 4));
  if (getProperty("useCoolant")) { writeBlock(mFormat.format(${c.cool==='M7'?7:8})); }
  var initialPosition = getFramePosition(currentSection.getInitialPosition());
  gMotionModal.reset();
  writeBlock(gMotionModal.format(0), xOutput.format(initialPosition.x), yOutput.format(initialPosition.y));
${tcpOn?`  if (currentSection.isMultiAxis()) { writeBlock(${tcpOn}); }\n  else { writeBlock(gFormat.format(43), "H" + toolFormat.format(tool.lengthOffset), zOutput.format(initialPosition.z)); }`:c.ctrl==='grbl'?'  writeBlock(gMotionModal.format(0), zOutput.format(initialPosition.z));':'  writeBlock(gFormat.format(43), "H" + toolFormat.format(tool.lengthOffset), zOutput.format(initialPosition.z));'}
}

function onDwell(seconds) { writeBlock(gFormat.format(4), "P" + xyzFormat.format(seconds)); }
function onSpindleSpeed(spindleSpeed) { writeBlock(sOutput.format(spindleSpeed)); }
function onCommand(command) {}
function onCircular(clockwise, cx, cy, cz, x, y, z, feed) { linearize(tolerance); }

function onRapid(_x, _y, _z) {
  var x = xOutput.format(_x), y = yOutput.format(_y), z = zOutput.format(_z);
  if (x || y || z) { writeBlock(gMotionModal.format(0), x, y, z); feedOutput.reset(); }
}
function onLinear(_x, _y, _z, feed) {
  var x = xOutput.format(_x), y = yOutput.format(_y), z = zOutput.format(_z), f = feedOutput.format(feed);
  if (x || y || z) { writeBlock(gFeedModeModal.format(94), gMotionModal.format(1), x, y, z, f); }
  else if (f) { writeBlock(gFeedModeModal.format(94), f); }
}
function onRapid5D(_x, _y, _z, _a, _b, _c) {
  writeBlock(gMotionModal.format(0), xOutput.format(_x), yOutput.format(_y), zOutput.format(_z), aOutput.format(_a), bOutput.format(_b), cOutput.format(_c));
  feedOutput.reset();
}
function onLinear5D(_x, _y, _z, _a, _b, _c, feed) {
  var start = getCurrentPosition();
  var len = Vector.diff(start, new Vector(_x, _y, _z)).length; // aproximación lineal: valida en tu máquina
  var words = [xOutput.format(_x), yOutput.format(_y), zOutput.format(_z), aOutput.format(_a), bOutput.format(_b), cOutput.format(_c)];
  if (getProperty("useInverseTime") && !USE_TCP && len > 0.001) {
    writeBlock(gFeedModeModal.format(93), gMotionModal.format(1), words[0], words[1], words[2], words[3], words[4], words[5], inverseTimeOutput.format(Math.min(feed / len, 99999)));
    feedOutput.reset();
  } else {
    writeBlock(gFeedModeModal.format(94), gMotionModal.format(1), words[0], words[1], words[2], words[3], words[4], words[5], feedOutput.format(feed));
  }
}
function onSectionEnd() { forceAny(); }
function forceAny() { xOutput.reset(); yOutput.reset(); zOutput.reset(); aOutput.reset(); bOutput.reset(); cOutput.reset(); feedOutput.reset(); }

function onClose() {
  writeBlock(gFeedModeModal.format(94));
${tcp?(c.ctrl==='siemens'?'  writeBlock("TRAFOOF");':c.ctrl==='heidenhain'?'  writeBlock("M129");':'  writeBlock(gFormat.format(49));'):''}
  if (getProperty("useCoolant")) { writeBlock(mFormat.format(9)); }
  writeBlock(mFormat.format(5));
${c.ctrl==='fanuc'||c.ctrl==='haas'?'  writeBlock(gFormat.format(91), gFormat.format(28), "Z0.");\n  writeBlock(gFormat.format(90));\n':''}  writeBlock(mFormat.format(${c.ctrl==='linuxcnc'?2:30}));
${['linuxcnc','fanuc','haas'].includes(c.ctrl)?'  writeln("%");\n':''}}
`;
}
function genPP(){
  const ctrl=CTRL[S.post.ctrl],c={...S.post,ctrl:dialOf(S.post.ctrl)},m=S.machine;const grbl=c.ctrl==='grbl';
  const iso=['mach3','mach4','linuxcnc','grbl'].includes(c.ctrl);
  const tc=grbl?['"( CAMBIO MANUAL T[T] )"']:['"T[T] M6"','"G43 H[T]"'];
  const cool=c.cool==='none'?[]:[`"${c.cool}"`];
  return `+================================================
+ Postprocesador Vectric (Aspire / VCarve) generado por
+ HETNA CAM LAB - hetnacnc.com
+ Controlador: ${ctrl.name} - Unidades: mm - 3 ejes
+ Plantilla inicial: pruébala en vacío antes de producción.
${iso?'':'+ AVISO: este formato se probó con controles tipo Mach3/LinuxCNC.\n+ Para '+ctrl.name+' revisa encabezado y pie con tu manual.\n'}${m.kin!=='xyz'?'+ Para 4 ejes envolventes usa como base el post oficial\n+ "Wrap" de Vectric para tu controlador.\n':''}+================================================

POST_NAME = "Hetna ${ctrl.name} (mm) (*.${c.ctrl==='linuxcnc'?'ngc':'tap'})"
FILE_EXTENSION = "${c.ctrl==='linuxcnc'?'ngc':'tap'}"
UNITS = "MM"

+------------------------------------------------
+ Numeración de líneas
+------------------------------------------------
LINE_NUMBER_START     = 10
LINE_NUMBER_INCREMENT = 10
LINE_NUMBER_MAXIMUM   = 999999

+------------------------------------------------
+ Formato de variables
+------------------------------------------------
VAR LINE_NUMBER = [N|A|N|1.0]
VAR SPINDLE_SPEED = [S|A|S|1.0]
VAR FEED_RATE = [F|C|F|1.1]
VAR X_POSITION = [X|C|X|1.${c.dec}]
VAR Y_POSITION = [Y|C|Y|1.${c.dec}]
VAR Z_POSITION = [Z|C|Z|1.${c.dec}]
VAR X_HOME_POSITION = [XH|A|X|1.${c.dec}]
VAR Y_HOME_POSITION = [YH|A|Y|1.${c.dec}]
VAR Z_HOME_POSITION = [ZH|A|Z|1.${c.dec}]

+------------------------------------------------
+ Bloques
+------------------------------------------------
begin HEADER
"( [TP_FILENAME] )"
"( Herramienta: [TOOLNAME] )"
"( Generado con post Hetna - verificar en vacio )"
${c.ctrl==='linuxcnc'?'"%"\n':''}"G21 G90 G94 G17${grbl?'':' G40 G49 G80'}"
"G54"
${tc.join('\n')}
"G0 [ZH]"
"G0 [XH] [YH]"
"[S] M3"
${cool.join('\n')}

begin RAPID_MOVE
"G0 [X] [Y] [Z]"

begin FIRST_FEED_MOVE
"G1 [X] [Y] [Z] [F]"

begin FEED_MOVE
"G1 [X] [Y] [Z]"

begin NEW_SEGMENT
"[S] M3"

begin TOOLCHANGE
"M5"
${tc.join('\n')}
"[S] M3"

begin FOOTER
"G0 [ZH]"
${c.cool==='none'?'':'"M9"\n'}"M5"
"G0 [XH] [YH]"
"${c.ctrl==='linuxcnc'?'M2':'M30'}"
${c.ctrl==='linuxcnc'?'"%"\n':''}`;
}
