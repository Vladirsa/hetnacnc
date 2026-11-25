// Nodo Code "Armar directorio público" (Run Once for All Items).
// Sólo datos públicos de empresa (nombre, tipo, ciudad, servicios). Nunca correo,
// teléfono, token ni notas. Fuera: BAJA, REGISTRADO (ya tienen su perfil real),
// compradores, descartados y las filas con publicar = NO.
// (No usa comun.js: sólo necesita estas dos funciones.)
// Slug del perfil (/talleres/directorio/<slug>): minúsculas, sin acentos, sólo a-z,
// 0-9 y guiones. Misma regla que apps/storefront/src/lib/hetna/slug-directorio.ts
// (una prueba revisa que coincidan). Antes sólo cambiaba puntos por guiones y las
// ligas de Facebook dejaban diagonales: esos perfiles daban 404.
// (Sin barras invertidas: generar_flujo.py no las deja pasar; las marcas de acento
// U+0300 a U+036F se arman con fromCharCode.)
const MARCAS_ACENTO = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
function slugDe(id) {
  return String(id == null ? '' : id).normalize('NFD').replace(MARCAS_ACENTO, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/, '');
}
function limpiar(s, max) {
  let t = String(s || '').trim();
  while (t.endsWith('.')) t = t.slice(0, -1);
  t = t.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}
function tipoPublico(t) {
  const s = String(t || '').toLowerCase();
  if (s.indexOf('taller') >= 0 || s.indexOf('servicio') >= 0) return 'taller';
  if (s.indexOf('proveedor') >= 0) return 'proveedor';
  if (s.indexOf('instructor') >= 0 || s.indexOf('capacit') >= 0) return 'instructor';
  return '';
}
// País por el contacto: perfiles de Instagram/Facebook que trajo una búsqueda de
// una ciudad de México pero son de Chile (+56), República Dominicana (809)...
const LADAS = [['+593', 'Ecuador'], ['+598', 'Uruguay'], ['+595', 'Paraguay'], ['+591', 'Bolivia'], ['+502', 'Guatemala'],
  ['+503', 'El Salvador'], ['+504', 'Honduras'], ['+505', 'Nicaragua'], ['+506', 'Costa Rica'], ['+507', 'Panamá'],
  ['+52', 'México'], ['+56', 'Chile'], ['+57', 'Colombia'], ['+51', 'Perú'], ['+54', 'Argentina'], ['+55', 'Brasil'],
  ['+58', 'Venezuela'], ['+53', 'Cuba'], ['+34', 'España'], ['+351', 'Portugal'], ['+886', 'Taiwán'], ['+86', 'China'],
  ['+90', 'Turquía'], ['+39', 'Italia'], ['+49', 'Alemania'], ['+91', 'India'], ['+82', 'Corea']];
const DOMINIOS_PAIS = [['.com.mx', 'México'], ['.mx', 'México'], ['.cl', 'Chile'], ['.com.co', 'Colombia'], ['.com.pe', 'Perú'],
  ['.pe', 'Perú'], ['.com.ar', 'Argentina'], ['.ar', 'Argentina'], ['.com.ec', 'Ecuador'], ['.ec', 'Ecuador'], ['.gt', 'Guatemala'],
  ['.cr', 'Costa Rica'], ['.com.sv', 'El Salvador'], ['.hn', 'Honduras'], ['.com.pa', 'Panamá'], ['.do', 'República Dominicana'],
  ['.br', 'Brasil'], ['.uy', 'Uruguay'], ['.py', 'Paraguay'], ['.bo', 'Bolivia'], ['.ve', 'Venezuela'], ['.es', 'España']];
function paisPorContacto(r, soloMx) {
  for (const tel of [r.telefono, r.whatsapp]) {
    let t = String(tel || '').replace(/[^0-9+]/g, '');
    if (t.startsWith('00')) t = '+' + t.slice(2);
    // Google Sheets guarda +56 9 6965 9986 como 56969659986: más de 10 dígitos ya trae lada
    // (no si empieza con 1: un celular chino sin lada también tiene 11 dígitos y empieza con 1)
    if (!t.startsWith('+') && !t.startsWith('1') && t.length >= 11 && t.length <= 13) t = '+' + t;
    if (t.startsWith('+1')) {
      const a = t.slice(2, 5);
      if (a === '809' || a === '829' || a === '849') return 'República Dominicana';
      return 'Estados Unidos';
    }
    if (t.startsWith('+')) for (const [l, p] of LADAS) if (t.startsWith(l)) return p;
    if (t.length === 10 && ['809', '829', '849'].includes(t.slice(0, 3))) return 'República Dominicana';
  }
  for (const d of [String(r.email || '').split('@').pop().toLowerCase(), String(r.dominio || '').toLowerCase()]) {
    if (!d || d.startsWith('ig-') || d.startsWith('fb-')) continue;
    // Un proveedor extranjero puede tener sitio .es o .com.br para vender allá: sólo .mx cambia su país
    for (const [fin, p] of DOMINIOS_PAIS) if (d.endsWith(fin) && (!soloMx || p === 'México')) return p;
  }
  return '';
}
const empresas = [];
const vistos = {};
for (const it of $input.all()) {
  const r = it.json;
  const tipo = tipoPublico(r.tipo);
  const slug = slugDe(r.id);
  const est = String(r.estatus || '').toUpperCase();
  if (!slug || !r.empresa || !tipo || vistos[slug]) continue;
  if (est === 'BAJA' || est === 'REGISTRADO') continue;
  if (String(r.publicar || '').trim().toUpperCase() === 'NO') continue;
  if (String(r.notas || '').toLowerCase().indexOf('descartado') >= 0) continue;
  // Portales, directorios y tiendas en línea que el buscador confundió con talleres
  const texto = (String(r.empresa || '') + ' ' + String(r.productos_servicios || '') + ' ' + String(r.dominio || '')).toLowerCase();
  if (['marketplace', ' b2b', 'directorio de', 'encuentra los mejores', 'proveedores para la industria', 'ecommerce', 'e-commerce', 'miles de referencias', 'publica tus productos', 'tallerium', 'constru-mexico', 'marketb2b', 'tradekey', 'exporthub', 'tradeindia', 'tradewheel'].some((p) => texto.indexOf(p) >= 0)) continue;
  vistos[slug] = true;
  // Si el teléfono o el dominio dicen otro país, manda eso (también en proveedores extranjeros:
  // un «.mx» que salió en una búsqueda de China es mexicano)
  const real = paisPorContacto(r, String(r.tipo || '').indexOf('extranjero') >= 0);
  const pais = real || r.pais;
  const otroPais = real && real !== r.pais;
  empresas.push({
    slug,
    empresa: limpiar(r.empresa, 90),
    tipo,
    tamano: limpiar(r.tamano, 20),
    pais: limpiar(pais, 40),
    region: otroPais ? '' : limpiar(r.region, 60),
    ciudad: otroPais ? '' : limpiar(r.ciudad, 60),
    servicios: limpiar(r.productos_servicios, 240),
    segmento: limpiar(r.segmento, 120),
  });
}
return [{ json: { generado: $now.toISO(), total: empresas.length, empresas } }];
