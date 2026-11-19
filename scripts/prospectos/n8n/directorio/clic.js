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
// Liga para escribirle por WhatsApp con un mensaje ya escrito (lo mandas tú desde tu celular)
const digitos = (v) => String(v || '').split('').filter((c) => c >= '0' && c <= '9').join('');
let num = digitos(r.whatsapp) || digitos(r.telefono);
if (num.length === 10 && (r.pais === 'México' || r.pais === 'Mexico')) num = '52' + num;
if (num.length === 13 && num.startsWith('521')) num = '52' + num.slice(3);
const textoWa = 'Hola, soy Vladimir de HETNA CNC. Vi que revisaron la información que les mandamos por correo. ¿Les ayudo a registrar su taller? Toma 5 minutos y como taller fundador tienen 6 meses del plan Pro gratis.';
const ligaWa = num.length >= 11 && num.length <= 13 ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(textoWa) : '';
const aviso = [
  '👀 ' + r.empresa + ' abrió tu correo y está viendo la página ahora',
  [r.ciudad, r.region, r.pais].filter(Boolean).join(', '),
  'Página: hetnacnc.com' + ruta + (campana ? ' · correo ' + campana : ''),
  contacto,
  est === 'REGISTRADO' ? 'Ya está registrado en HETNA.' : (ligaWa ? 'Buen momento para escribirle por WhatsApp (mensaje listo): ' + ligaWa : 'Buen momento para escribirle: todavía tiene la página abierta.'),
].filter(Boolean).join(NL);
return [{ json: {
  anotar: true,
  id: r.id,
  // La versión del correo (vendedor_p1b…) queda anotada para medir qué plantilla funciona
  notas: (notas ? notas + ' | ' : '') + MARCA + hoy + ' (' + ruta + (campana ? ', ' + campana : '') + ')',
  aviso,
} }];
