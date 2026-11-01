'use strict';
/* =========================================================
   POSPROCESADORES
   ========================================================= */
function postProcess(){
  const moves=S.moves;if(!moves||!moves.length)return{text:'',lines:[]};
  const m=S.machine,tl=tool(),fd=feedsCalc(),c=S.post,ctrl=CTRL[c.ctrl];const axes=KIN_AXES[m.kin];const tcp=useTCP();
  const dec=clamp(c.dec|0,1,5);const heid=ctrl.style==='heid';
  const fmt=v=>{let s=(Math.abs(v)<0.5*10**-dec?0:v).toFixed(dec);if(heid&&!s.startsWith('-'))s='+'+s;return s;};
  const cm=s=>ctrl.comment==='paren'?`(${String(s).replace(/[()]/g,'')})`:`; ${s}`;
  const L=[];let N=10;
  const out=(s,num=true)=>{if(heid){L.push(`${L.length} ${s}`);return;}if(c.lines&&num&&!/^[(%;]/.test(s)){s=`N${N} ${s}`;N+=10;}L.push(s);};
  const inv=c.inv&&axes.length>0&&!tcp&&c.ctrl!=='heidenhain';
  const dirs=[m.inv[0]?-1:1,m.inv[1]?-1:1];
  const name=(S.partName||'PIEZA').replace(/\.[^.]+$/,'').toUpperCase().replace(/[^A-Z0-9_-]/g,'_').slice(0,20)||'PIEZA';
  const dt=new Date().toISOString().slice(0,10);
  const tn=tl.num|0||1;const cool=c.cool==='none'?null:c.cool;
  const stk=S.stock;
  // encabezado
  if(heid){
    out(`BEGIN PGM ${name} MM`);out(`; HETNA CAM LAB ${dt} - ${KIN_NAME[m.kin]}`);out(`; T${tn} ${tl.name}`);out('; VERIFICAR EN VACIO ANTES DE CORTAR');
    if(stk.type==='box'){out(`BLK FORM 0.1 Z X${fmt(stk.min[0])} Y${fmt(stk.min[1])} Z${fmt(stk.min[2])}`);out(`BLK FORM 0.2 X${fmt(stk.max[0])} Y${fmt(stk.max[1])} Z${fmt(stk.max[2])}`);}
    else{out(`BLK FORM 0.1 X X${fmt(stk.x0)} Y${fmt(-stk.r)} Z${fmt(-stk.r)}`);out(`BLK FORM 0.2 X${fmt(stk.x1)} Y${fmt(stk.r)} Z${fmt(stk.r)}`);}
    out(`TOOL CALL ${tn} Z S${fd.rpm}`);if(tcp&&axes.length)out('M128');
  }else{
    if(['linuxcnc','fanuc','haas'].includes(c.ctrl))L.push('%');
    if(c.ctrl==='fanuc'||c.ctrl==='haas')L.push(`O${String(c.prog|0).padStart(4,'0')} ${cm(name)}`);
    out(cm(`HETNA CAM LAB - ${name} - ${dt}`),false);
    out(cm(`MAQUINA ${KIN_NAME[m.kin]} - CONTROL ${ctrl.name}${tcp?' - TCP ACTIVO':' - SIN TCP (COORD. MAQUINA CALCULADAS)'}`),false);
    out(cm(`T${tn} ${tl.name} D${tl.D} VOLADIZO ${tl.stickout}`),false);
    if(!tcp&&isHeadKin(m.kin))out(cm(`PIVOTE ${m.pivot}+${tl.stickout}+${tl.holderLen} = ${m.pivot+tl.stickout+tl.holderLen} MM`),false);
    if(tcp&&axes.length&&c.ctrl==='linuxcnc')out(cm('TCP: ACTIVA LA CINEMATICA TCP DE TU CONFIGURACION LINUXCNC ANTES DE EJECUTAR'),false);
    out(cm('VERIFICAR EN VACIO CON AVANCE REDUCIDO ANTES DE CORTAR'),false);
    if(c.ctrl==='siemens'){out('G17 G90 G71 G94');out('G54');out(`T${tn} D1`);out('M6');}
    else if(c.ctrl==='grbl'){out('G21 G90 G94 G17');out('G54');out(cm(`CAMBIO MANUAL DE HERRAMIENTA T${tn}`),false);}
    else{out('G21 G90 G94 G17 G40 G49 G80');out('G54');out(`T${tn} M6`);}
    if(c.ctrl==='linuxcnc')out('G64 P0.02');
    out(`S${fd.rpm} M3`);if(cool)out(cool);
    if(tcp&&axes.length){if(c.ctrl==='siemens')out('TRAORI');}
  }
  const lineOf=new Int32Array(moves.length);let last={};let lastG=null,lastF=null,g93=false;
  for(let i=0;i<moves.length;i++){
    const mv=moves[i];const pm=mv.pm;const words=[];const W={X:pm[0],Y:pm[1],Z:pm[2]};axes.forEach((a,q)=>W[a]=mv.ang[q]*dirs[q]);
    const rapid=mv.t==='R';
    if(heid){
      const parts=['X','Y','Z',...axes].map(k=>`${k}${fmt(W[k])}`);const f=rapid?'FMAX':`F${mv.t==='P'?fd.plunge:fd.feed}`;
      let extra='';if(i===0)extra=' M3'+(cool?(cool==='M8'?' M8':' M7'):'');
      out(`L ${parts.join(' ')} R0 ${f}${extra}`);lineOf[i]=L.length-1;continue;
    }
    for(const k of ['X','Y','Z',...axes]){const s=fmt(W[k]);if(last[k]!==s){words.push(k+s);last[k]=s;}}
    const g=rapid?'G0':'G1';
    let pre='';
    if(i===0){let g43='';if(tcp&&axes.length){if(c.ctrl==='fanuc')g43='G43.4 H'+tn;else if(c.ctrl==='haas')g43='G234 H'+tn;else if(c.ctrl==='linuxcnc')g43='G43 H'+tn;}else if(c.ctrl!=='grbl')g43='G43 H'+tn;
      if(c.ctrl!=='siemens'&&g43)out(g43);}
    let feedWord='';
    if(!rapid){
      const f=mv.t==='P'?fd.plunge:fd.feed;const pv=i>0?moves[i-1]:null;
      const dAng=pv?Math.hypot(...axes.map((a,q)=>mv.ang[q]-pv.ang[q])):0;const multi=pv&&dAng>1e-4;
      if(multi&&inv){const len=Math.max(mv.len,1e-3);const Fi=Math.min(f/len,99999);if(!g93){pre+='G93 ';g93=true;}feedWord=' F'+Fi.toFixed(3);lastF=null;}
      else if(multi){
        // G94 con eje rotativo: Mach3/Mach4/GRBL miden el bloque como hipot(mm, grados).
        // Para que dure lo que dura el corte real (len / f), la F del bloque es esa
        // "distancia" entre ese tiempo. Es lo mismo que hacen los posts "wrap" de Vectric.
        if(g93){pre+='G94 ';g93=false;}
        const dLin=Math.hypot(mv.pm[0]-pv.pm[0],mv.pm[1]-pv.pm[1],mv.pm[2]-pv.pm[2]);const t=Math.max(mv.len,1e-3)/f;
        const Fe=Math.round(Math.min(99999,Math.max(1,Math.hypot(dLin,dAng)/t)));
        if(lastF!==Fe){feedWord=' F'+Fe;lastF=Fe;}
      }
      else{if(g93){pre+='G94 ';g93=false;lastF=null;}if(lastF!==f){feedWord=' F'+f;lastF=f;}}
    }
    if(!words.length&&!feedWord&&!pre){lineOf[i]=L.length-1;continue;}
    const gw=(g!==lastG||pre)?g+' ':'';lastG=g;
    out(`${pre}${gw}${words.join(' ')}${feedWord}`.trim());lineOf[i]=L.length-1;
  }
  // pie
  if(heid){if(tcp&&axes.length)out('M129');out('M5');if(cool)out('M9');out('M30');out(`END PGM ${name} MM`);}
  else{
    if(g93)out('G94');
    if(tcp&&axes.length){if(c.ctrl==='siemens')out('TRAFOOF');else out('G49');}
    if(cool)out('M9');out('M5');
    if(c.ctrl==='fanuc'||c.ctrl==='haas'){out('G91 G28 Z0.');out('G90');}
    out(c.ctrl==='linuxcnc'?'M2':'M30');
    if(['linuxcnc','fanuc','haas'].includes(c.ctrl))L.push('%');
  }
  return{text:L.join('\n')+'\n',lines:L,lineOf};
}
function genCPS(){
  const m=S.machine,c=S.post,ctrl=CTRL[c.ctrl],axes=KIN_AXES[m.kin],tcp=useTCP();
  const ax=(letter,q)=>{const L=m.rot[q];const cyc=L[1]-L[0]>=720;const vec={A:[1,0,0],B:[0,1,0],C:[0,0,1]}[letter].map(v=>m.inv[q]&&v?-v:v);const coord={A:0,B:1,C:2}[letter];
    const table=!(m.kin==='bc_head'||(m.kin==='ab_mixed'&&letter==='B'));
    return `  var ${letter.toLowerCase()}Axis = createAxis({coordinate:${coord}, table:${table}, axis:[${vec.join(', ')}], offset:[${m.rc.join(', ')}], ${cyc?'cyclic:true':`range:[${L[0]}, ${L[1]}]`}, preference:0});`;};
  let mc='';
  if(axes.length){mc=axes.map((a,q)=>ax(a,q)).join('\n')+`\n  machineConfiguration = new MachineConfiguration(${axes.map(a=>a.toLowerCase()+'Axis').join(', ')});\n  setMachineConfiguration(machineConfiguration);\n  optimizeMachineAngles2(${tcp?0:1}); // 0 = TCP en el control, 1 = mapear punta a coordenadas de máquina`;}
  const tcpOn=tcp?({fanuc:'"G43.4", "H" + toolFormat.format(tool.lengthOffset)',haas:'"G234", "H" + toolFormat.format(tool.lengthOffset)',linuxcnc:'"G43", "H" + toolFormat.format(tool.lengthOffset)',siemens:'"TRAORI"',heidenhain:'"M128"'}[c.ctrl]||null):null;
  const ext={mach3:'tap',mach4:'tap',linuxcnc:'ngc',grbl:'nc',fanuc:'nc',haas:'nc',siemens:'mpf',heidenhain:'h'}[c.ctrl];
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
  const c=S.post,ctrl=CTRL[c.ctrl],m=S.machine;const grbl=c.ctrl==='grbl';
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
function genJSON(){
  const m=S.machine,c=S.post,tl=tool(),fd=feedsCalc();
  return JSON.stringify({generator:'Hetna CAM Lab',version:1,date:new Date().toISOString(),
    controller:{id:c.ctrl,name:CTRL[c.ctrl].name,tcp:useTCP(),inverseTime:c.inv,decimals:c.dec,lineNumbers:c.lines,coolant:c.cool,program:c.prog},
    machine:{kinematics:m.kin,axes:['X','Y','Z',...KIN_AXES[m.kin]],travel:m.lim,rotary:KIN_AXES[m.kin].map((a,q)=>({axis:a,range:m.rot[q],continuous:m.rot[q][1]-m.rot[q][0]>=720,inverted:m.inv[q]})),
      pivotToSpindleNose:m.pivot,rotationCenter:m.rc,maxRPM:m.maxRPM,maxFeed:m.maxFeed,rapid:m.rapid},
    tool:{number:tl.num,name:tl.name,type:tl.type,diameter:tl.D,cornerRadius:tl.r,flutes:tl.flutes,fluteLength:tl.fluteLen,stickout:tl.stickout,shankDiameter:tl.shankD,holder:{diameter:tl.holderD,length:tl.holderLen}},
    cutting:{material:MATERIALS[S.feeds.mat].name,vc:S.feeds.vc,fz:S.feeds.fz,rpm:fd.rpm,feed:fd.feed,plunge:fd.plunge},
    strategy:S.strat},null,2);
}
