// Nodo Code "Preparar aviso de clic" (Run Once for All Items). Siempre 1 item.
// Un prospecto abrió una liga de su correo (las ligas llevan &e=<id de la fila>).
// Te avisa por Telegram para que le llames mientras tiene la página abierta y lo
// anota en la hoja. Sólo un aviso por empresa al día.
const NL = String.fromCharCode(10);
const b = $('Clic en correo').first().json.body || {};
const id = String(b.e || '').trim().toLowerCase();
const filas = $input.all().map((i) => i.json);
const r = filas.find((f) => String(f.id || '').toLowerCase() === id);
const hoy = $now.setZone('America/Mexico_City').toISODate();
const MARCA = 'Abrió una liga del correo el ';
if (!r) return [{ json: { anotar: false } }];
const est = String(r.estatus || '').toUpperCase();
const notas = String(r.notas || '');
if (est === 'BAJA' || notas.indexOf(MARCA + hoy) >= 0) return [{ json: { anotar: false } }];
const ruta = String(b.ruta || '/').slice(0, 120);
const campana = String(b.campana || '').slice(0, 40);
const contacto = [r.telefono ? '📞 ' + r.telefono : '', r.whatsapp && r.whatsapp !== r.telefono ? 'WhatsApp ' + r.whatsapp : '', r.email ? '✉️ ' + r.email : ''].filter(Boolean).join(' · ');
const aviso = [
  '👀 ' + r.empresa + ' abrió tu correo y está viendo la página ahora',
  [r.ciudad, r.region, r.pais].filter(Boolean).join(', '),
  'Página: hetnacnc.com' + ruta + (campana ? ' · correo ' + campana : ''),
  contacto,
  est === 'REGISTRADO' ? 'Ya está registrado en HETNA.' : 'Buen momento para llamarle o escribirle: todavía tiene la página abierta.',
].filter(Boolean).join(NL);
return [{ json: {
  anotar: true,
  id: r.id,
  notas: (notas ? notas + ' | ' : '') + MARCA + hoy + ' (' + ruta + ')',
  aviso,
} }];
