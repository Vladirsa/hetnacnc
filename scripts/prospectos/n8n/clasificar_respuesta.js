// Nodo Code "Clasificar respuesta" (Run Once for All Items).
// Entrada: filas de la hoja. Correo: el que trajo el disparador IMAP.
// - Rebote (mailer-daemon / "undeliverable"): marca REBOTE a los correos de la
//   hoja que aparezcan en el mensaje.
// - Respuesta de un prospecto (por correo exacto o dominio de empresa):
//   BAJA si pide no recibir más; si no, RESPONDIO.
// Sólo mira el texto nuevo de la respuesta, no lo citado (que trae el enlace
// de baja de nuestro propio correo). Sin barras invertidas a propósito: este
// código se pega dentro de una plantilla del Workflow SDK.
const m = $('Correo nuevo').first().json;
const NL = String.fromCharCode(10);
const hoy = $now.setZone('America/Mexico_City').toISODate();

const deRaw = String(m.from || '');
const ab = deRaw.lastIndexOf('<');
const de = (ab >= 0 ? deRaw.slice(ab + 1, deRaw.indexOf('>', ab)) : deRaw).trim().toLowerCase();
const deDom = de.split('@')[1] || '';
const asunto = String(m.subject || '').trim();
const texto = String(m.textPlain || m.text || '').trim();

// Corta lo citado: líneas con ">" o encabezados típicos de respuesta.
const CORTES = ['-----original', '________________', 'escribió:', 'wrote:', 'escreveu:', 'de: hetna', 'from: hetna', 'enviado desde'];
const lineas = texto.split(NL);
const nuevas = [];
for (const l of lineas) {
  const t = l.trim().toLowerCase();
  if (t.startsWith('>') || CORTES.some((c) => t.includes(c))) break;
  nuevas.push(l);
}
const nuevo = nuevas.join(NL).trim();
const nuevoMin = (asunto + ' ' + nuevo).toLowerCase();

const PROPIOS = ['hetnacnc.com'];
if (PROPIOS.includes(deDom)) return [];

const esRebote = de.startsWith('mailer-daemon') || de.startsWith('postmaster') ||
  ['undeliver', 'delivery status notification', 'failure notice', 'no se pudo entregar', 'returned mail', 'mail delivery failed']
    .some((k) => asunto.toLowerCase().includes(k));

const BAJA = ['darme de baja', 'dar de baja', 'denme de baja', 'me den de baja', 'no me interesa', 'no nos interesa', 'no estoy interesad', 'no estamos interesad',
  'no me envíen', 'no me envien', 'no enviar más', 'no enviar mas', 'dejen de enviar', 'eliminar mi correo', 'borrar mi correo', 'quitar de su lista',
  'unsubscribe', 'remove me', 'not interested', 'stop sending', 'take me off', 'descadastr', 'não tenho interesse', 'nao tenho interesse', 'parem de enviar'];
const pideBaja = BAJA.some((k) => nuevoMin.includes(k));

const LIBRES = ['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.com.mx', 'yahoo.com', 'yahoo.com.mx', 'icloud.com', 'msn.com',
  'aol.com', 'prodigy.net.mx', 'proton.me', 'protonmail.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'sbcglobal.net'];
const textoMin = texto.toLowerCase();
const filas = $input.all().map((i) => i.json);

const out = [];
for (const r of filas) {
  const re = String(r.email || '').toLowerCase().trim();
  if (!r.id || !re) continue;
  const reDom = re.split('@')[1] || '';
  const rd = String(r.dominio || '').toLowerCase();
  let accion = '';
  if (esRebote) {
    if (textoMin.includes(re)) accion = 'REBOTE';
  } else if (re === de || (deDom && !LIBRES.includes(deDom) && (reDom === deDom || rd === deDom || rd.endsWith('.' + deDom)))) {
    accion = pideBaja ? 'BAJA' : 'RESPONDIO';
  }
  if (!accion) continue;
  const previo = String(r.estatus || '').toUpperCase();
  // Si ya se registró en HETNA, no se degrada: sólo se anota.
  const estatus = previo === 'REGISTRADO' ? 'REGISTRADO' : accion;
  const nota = accion === 'REBOTE' ? 'Rebotó el ' + hoy : (accion === 'BAJA' ? 'Pidió la baja por correo el ' + hoy : 'Respondió el ' + hoy) + ': "' + asunto.slice(0, 80) + '"';
  out.push({ json: {
    id: r.id,
    estatus,
    proximo_contacto: '',
    notas: (r.notas ? r.notas + ' | ' : '') + nota,
    empresa: r.empresa || r.id,
    pais: r.pais || '',
    tipo: r.tipo || '',
    de,
    asunto,
    extracto: nuevo.slice(0, 500),
    accion,
  } });
}
return out;
