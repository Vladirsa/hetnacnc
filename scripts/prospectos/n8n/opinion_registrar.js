// Nodo Code "Registrar opinión" (Run Once for All Items). Siempre 1 item.
// POST del formulario de la encuesta: valida id + token de la fila, anota la
// opinión en la hoja y arma el aviso de Telegram y la página de gracias.
//  - "No me interesa"  -> BAJA (ya no se le escribe)
//  - "Ahorita no tengo tiempo" -> el siguiente correo en 60 días
//  - "No entiendo cómo funciona" / "No conozco la plataforma" -> aviso para que le escribas tú
const NL = String.fromCharCode(10);
const b = $('Enviar opinión').first().json.body || {};
const filas = $input.all().map((i) => i.json);
const r = filas.find((f) => String(f.id || '') === String(b.id || ''));
const ETIQUETAS = {
  ya_vendo: 'Ya vende en otro lado',
  sin_tiempo: 'Ahorita no tiene tiempo',
  no_entiendo: 'No entiende cómo funciona',
  comision: 'No le convence la comisión',
  no_confio: 'No conoce la plataforma / no le da confianza',
  no_aplica: 'No es para su negocio',
  baja: 'No le interesa (baja)',
};
const motivo = String(b.r || '');
const ok = !!r && String(r.token || '') === String(b.t || '') && !!ETIQUETAS[motivo];
const hoy = $now.setZone('America/Mexico_City');
const comentario = String(b.comentario || '').split(NL).join(' ').split(String.fromCharCode(13)).join(' ').split(String.fromCharCode(9)).join(' ').trim().slice(0, 800);
const esc = (v) => String(v || '').split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const pagina = (titulo, texto) => '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + titulo + ' · HETNA CNC</title>' +
  '<body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#111827"><h1 style="color:#c2410c">' + titulo + '</h1>' + texto +
  '<p><a href="https://www.hetnacnc.com">hetnacnc.com</a></p></body></html>';
if (!ok) return [{ json: { ok: false, html: pagina('Enlace no válido', '<p>No pudimos registrar tu respuesta. Si quieres, escríbenos a contacto@hetnacnc.com.</p>') } }];
const previo = String(r.estatus || '').toUpperCase();
const estatus = motivo === 'baja' ? 'BAJA' : previo;
const proximo = motivo === 'baja' ? '' : motivo === 'sin_tiempo' ? hoy.plus({ days: 60 }).toISODate() : String(r.proximo_contacto || '');
const nota = 'Opinión ' + hoy.toISODate() + ': ' + ETIQUETAS[motivo] + (comentario ? ' — "' + comentario + '"' : '');
const caliente = motivo === 'no_entiendo' || motivo === 'no_confio';
const contacto = [r.telefono ? 'Tel. ' + r.telefono : '', r.whatsapp ? 'WhatsApp ' + r.whatsapp : '', r.email ? r.email : ''].filter(Boolean).join(' · ');
const aviso = [
  (caliente ? '🔥 ' : '🗳️ ') + 'Opinión de ' + (r.empresa || r.id) + ' (' + [r.tipo, r.ciudad, r.pais].filter(Boolean).join(', ') + ')',
  'Motivo: ' + ETIQUETAS[motivo],
  comentario ? 'Comentario: "' + comentario + '"' : '',
  contacto,
  caliente ? 'Tiene dudas: buen momento para escribirle y explicarle en 2 minutos.' : '',
].filter(Boolean).join(NL);
const gracias = {
  ya_vendo: '<p>¡Gracias! HETNA no te cobra nada por tener tu tienda también aquí: sólo pagas 6% cuando vendes, y llegan clientes que buscan talleres de tu zona.</p>',
  sin_tiempo: '<p>¡Gracias! Te escribimos en un par de meses. Registrarte toma 3 minutos cuando quieras: <a href="https://www.hetnacnc.com/mx/talleres/unete">hetnacnc.com/talleres/unete</a>.</p>',
  no_entiendo: '<p>¡Gracias! En resumen: los clientes publican lo que necesitan fabricar, te llega a ti si estás en su zona, cotizas lo que te conviene y cobras protegido. Te escribimos para resolver tus dudas, o mándanos WhatsApp al +52 221 707 6014.</p>',
  comision: '<p>¡Gracias por decirnos! Publicar es gratis y sólo se cobra 6% (5% en máquinas) cuando vendes, sin mensualidades. Tomamos en cuenta tu opinión.</p>',
  no_confio: '<p>¡Gracias! Es normal. Cada taller cobra con Mercado Pago dentro de la plataforma y factura directo a su cliente. Si quieres, te explicamos por WhatsApp al +52 221 707 6014.</p>',
  no_aplica: '<p>¡Gracias por avisarnos! Tomamos nota.</p>',
  baja: '<p>Listo, ya no te escribiremos. ¡Gracias por tu tiempo!</p>',
};
return [{ json: {
  ok: true,
  id: r.id,
  estatus,
  proximo_contacto: proximo,
  notas: (r.notas ? r.notas + ' | ' : '') + nota,
  aviso,
  html: pagina('¡Gracias!', gracias[motivo]),
} }];
