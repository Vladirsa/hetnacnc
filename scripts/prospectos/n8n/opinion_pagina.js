// Nodo Code "Página de la encuesta" (Run Once for All Items). Siempre 1 item.
// GET /webhook/hetna-prospectos-opinion?id=&t=&r=  (ligas del correo 3 en adelante)
// Sólo muestra la pregunta con la respuesta elegida marcada y un espacio para
// comentar; NO anota nada: lo anota el POST del botón "Enviar" (los antivirus
// abren las ligas GET pero no envían formularios). Sin barras invertidas a
// propósito: este código se pega en n8n.
const q = $('Abrir encuesta').first().json.query || {};
const esc = (v) => String(v || '').split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
const MOTIVOS = [
  ['ya_vendo', 'Ya vendo en otro lado (Mercado Libre, mi página, etc.)'],
  ['sin_tiempo', 'Ahorita no tengo tiempo; escríbanme más adelante'],
  ['no_entiendo', 'No entiendo bien cómo funciona'],
  ['comision', 'La comisión no me convence'],
  ['no_confio', 'No conozco la plataforma / no me da confianza todavía'],
  ['no_aplica', 'No es para mi negocio'],
  ['baja', 'No me interesa, ya no me escriban'],
];
const elegido = String(q.r || '');
const opciones = MOTIVOS.map((m) =>
  '<label style="display:block;margin:8px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer">' +
  '<input type="radio" name="r" value="' + m[0] + '"' + (m[0] === elegido ? ' checked' : '') + ' required> ' + esc(m[1]) + '</label>'
).join('');
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Tu opinión · HETNA CNC</title>' +
  '<body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#111827">' +
  '<h1 style="color:#c2410c;font-size:24px">¿Por qué HETNA no es para ti (todavía)?</h1>' +
  '<p>Tu respuesta nos ayuda a mejorar la plataforma para los talleres y clientes de CNC en México. Toma 10 segundos.</p>' +
  '<form method="post" action="https://n8n.hetnacnc.com/webhook/hetna-prospectos-opinion">' +
  '<input type="hidden" name="id" value="' + esc(q.id) + '"><input type="hidden" name="t" value="' + esc(q.t) + '">' +
  opciones +
  '<p style="margin:16px 0 6px"><b>¿Qué mejorarías o qué te gustaría que tuviera HETNA?</b> (opcional)</p>' +
  '<textarea name="comentario" maxlength="800" rows="4" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font:inherit"></textarea>' +
  '<p><button type="submit" style="background:#f97316;color:#fff;border:0;border-radius:8px;padding:12px 22px;font-weight:bold;font-size:15px;cursor:pointer">Enviar</button></p>' +
  '</form><p style="font-size:12px;color:#6b7280">HETNA CNC · Col. Centro, Apizaco, Tlaxcala, México · <a href="https://www.hetnacnc.com">hetnacnc.com</a></p></body></html>';
return [{ json: { html } }];
