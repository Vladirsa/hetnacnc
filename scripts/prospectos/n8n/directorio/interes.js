// Nodo Code "Preparar aviso de interés" (Run Once for All Items). Siempre 1 item.
// Un cliente pidió cotización desde el perfil no reclamado de una empresa.
// Al taller sólo le decimos QUÉ se pide y DÓNDE (nunca quién ni su contacto) y lo
// invitamos a reclamar su perfil. Máximo 1 aviso por empresa cada 7 días y 25 al día.
const b = $('Interés de un cliente').first().json.body || {};
const slug = String(b.slug || '').trim().toLowerCase();
const filas = $input.all().map((i) => i.json);
const r = filas.find((f) => slugDe(f.id) === slug);
const hoy = $now.setZone('America/Mexico_City').toISODate();
const MARCA = 'Cliente interesado el ';
if (!r) return [{ json: { anotar: false, enviar: false, aviso: '' } }];
const est = String(r.estatus || '').toUpperCase();
if (est === 'BAJA' || est === 'REGISTRADO') return [{ json: { anotar: false, enviar: false, aviso: '' } }];

const notas = String(r.notas || '');
const previas = notas.split(MARCA).slice(1).map((s) => s.slice(0, 10));
const ultima = previas.length ? previas[previas.length - 1] : '';
const dias = ultima ? Math.floor($now.diff(DateTime.fromISO(ultima), 'days').days) : 999;
const hoyTotal = filas.filter((f) => String(f.notas || '').indexOf(MARCA + hoy) >= 0).length;

const trabajo = limpiar(b.servicio || b.necesidad || 'un trabajo de CNC', 80);
const material = limpiar(b.material, 60);
const cantidad = limpiar(b.cantidad, 30);
const lugar = [limpiar(b.ciudad, 60), limpiar(b.estado_mx, 40)].filter(Boolean).join(', ');
const folio = limpiar(b.folio, 30);
const enviar = !!r.email && est !== 'REBOTE' && dias >= 7 && hoyTotal < 25;

const urlUnete = SITIO + '/mx/talleres/unete?perfil=' + encodeURIComponent(slug) + '&utm_source=correo&utm_medium=directorio&utm_campaign=cliente_interesado';
const urlTrabajos = SITIO + '/mx/trabajos?utm_source=correo&utm_medium=directorio&utm_campaign=cliente_interesado';
const urlBaja = BAJA + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '');
const asunto = 'Solicitud de cotización en tu zona: ' + trabajo + (lugar ? ' (' + lugar + ')' : '');
const detalle = [
  '<li><b>Trabajo:</b> ' + esc(trabajo) + '</li>',
  material ? '<li><b>Material:</b> ' + esc(material) + '</li>' : '',
  cantidad ? '<li><b>Cantidad:</b> ' + esc(cantidad) + '</li>' : '',
  lugar ? '<li><b>Ubicación:</b> ' + esc(lugar) + '</li>' : '',
  folio ? '<li><b>Folio:</b> ' + esc(folio) + '</li>' : '',
].join('');
const cuerpo =
  '<p>Hola, equipo de ' + esc(r.empresa) + ':</p>' +
  '<p>Un cliente pidió una cotización en HETNA CNC desde el perfil de su empresa en nuestro directorio de talleres:</p>' +
  '<ul>' + detalle + '</ul>' +
  '<p>Su empresa aparece en el directorio con información pública de su propio sitio web y está marcada como <b>perfil no reclamado</b>. Para ver la solicitud completa y mandar su propuesta, reclamen su perfil (es gratis y toma unos minutos):</p>' +
  boton(urlUnete, 'Reclamar mi perfil y ver la solicitud') +
  '<p style="font-size:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px"><b>Por qué es seguro:</b> la cotización, los mensajes y el pago se hacen dentro de HETNA; el cliente paga en la plataforma antes de que empiecen a producir. Publicar es gratis: sólo hay comisión cuando venden. Nunca les pediremos contraseñas ni códigos por teléfono o WhatsApp.</p>' +
  '<p style="font-size:14px">Mientras tanto, la solicitud también la reciben los talleres registrados para que el cliente no se quede sin respuesta. Pueden ver más trabajos abiertos aquí: <a href="' + urlTrabajos + '">solicitudes de fabricación</a>.</p>';
const html = envolver(asunto, cuerpo, urlBaja, 'Te escribimos porque un cliente pidió cotización desde el perfil de tu empresa en hetnacnc.com.');

const nota = MARCA + hoy + (folio ? ' (folio ' + folio + ')' : '') + (enviar ? ', se le avisó por correo' : '');
const contacto = r.email ? r.email : (r.telefono || r.whatsapp || 'sin datos de contacto');
let porque = '';
if (!enviar) {
  if (!r.email || est === 'REBOTE') porque = 'No tiene correo válido: llámale o escríbele tú (' + contacto + ').';
  else if (dias < 7) porque = 'Ya se le avisó hace ' + dias + ' días; esta vez no se le escribió.';
  else porque = 'Se llegó al máximo de 25 avisos de hoy; no se le escribió.';
}
const aviso = [
  '🔔 Cliente interesado en un perfil no reclamado',
  'Empresa: ' + r.empresa + ' (' + [r.ciudad, r.region].filter(Boolean).join(', ') + ')',
  'Pide: ' + trabajo + (material ? ' en ' + material : '') + (lugar ? ' · ' + lugar : ''),
  folio ? 'Folio: ' + folio : '',
  enviar ? '✉️ Se le mandó correo a ' + r.email + ' para que reclame su perfil.' : porque,
].filter(Boolean).join(NL);

return [{ json: {
  anotar: true,
  enviar,
  id: r.id,
  email: r.email || '',
  asunto,
  html,
  texto: aTexto(html),
  notas: notas ? notas + ' | ' + nota : nota,
  aviso,
} }];
