// Nodo Code "Preparar retiro de perfil" (Run Once for All Items). Siempre 1 item.
// Alguien pidió quitar un perfil del directorio. Para que nadie quite el perfil de
// otra empresa, le mandamos al correo de la propia empresa su enlace de baja (el
// mismo de la campaña: página con botón "Confirmar baja"). Si no tiene correo,
// te avisa por Telegram para que lo retires a mano (publicar = NO).
const b = $('Quitar perfil').first().json.body || {};
const slug = String(b.slug || '').trim().toLowerCase();
const filas = $input.all().map((i) => i.json);
const r = filas.find((f) => slugDe(f.id) === slug);
const hoy = $now.setZone('America/Mexico_City').toISODate();
const MARCA = 'Pidió quitar su perfil el ';
if (!r || String(r.estatus || '').toUpperCase() === 'BAJA') return [{ json: { anotar: false, enviar: false, aviso: '' } }];
const notas = String(r.notas || '');
if (notas.indexOf(MARCA + hoy) >= 0) return [{ json: { anotar: false, enviar: false, aviso: '' } }];

const enviar = !!r.email && String(r.estatus || '').toUpperCase() !== 'REBOTE';
const urlBaja = BAJA + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '');
const asunto = 'Confirma: quitar el perfil de ' + limpiar(r.empresa, 60) + ' del directorio HETNA';
const cuerpo =
  '<p>Hola, equipo de ' + esc(r.empresa) + ':</p>' +
  '<p>Recibimos una solicitud para quitar el perfil de su empresa del directorio de talleres de HETNA CNC. Para confirmarlo, presionen este botón y luego «Confirmar baja»:</p>' +
  boton(urlBaja, 'Quitar mi perfil') +
  '<p>Al confirmarlo, el perfil deja de mostrarse y no volveremos a escribirles. Si ustedes no lo pidieron, ignoren este correo y todo queda igual.</p>' +
  '<p style="font-size:14px">Si prefieren quedarse y recibir solicitudes de clientes, pueden <a href="' + SITIO + '/mx/talleres/unete?perfil=' + encodeURIComponent(slug) + '">reclamar su perfil gratis</a>.</p>';
const html = envolver(asunto, cuerpo, urlBaja, 'Te escribimos porque alguien pidió retirar el perfil de tu empresa de hetnacnc.com.');
const aviso = enviar
  ? '🗑️ Piden quitar el perfil de ' + r.empresa + '. Se mandó el enlace de baja a ' + r.email + ' para que lo confirme.'
  : '🗑️ Piden quitar el perfil de ' + r.empresa + ' y no tiene correo: revísalo y pon NO en la columna publicar (o estatus BAJA).';
return [{ json: {
  anotar: true,
  enviar,
  id: r.id,
  email: r.email || '',
  asunto,
  html,
  texto: aTexto(html),
  notas: (notas ? notas + ' | ' : '') + MARCA + hoy,
  aviso,
} }];
