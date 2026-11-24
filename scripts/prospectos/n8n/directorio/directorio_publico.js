// Nodo Code "Armar directorio público" (Run Once for All Items).
// Sólo datos públicos de empresa (nombre, tipo, ciudad, servicios). Nunca correo,
// teléfono, token ni notas. Fuera: BAJA, REGISTRADO (ya tienen su perfil real),
// compradores, descartados y las filas con publicar = NO.
// (No usa comun.js: sólo necesita estas dos funciones.)
function slugDe(id) { return String(id || '').trim().toLowerCase().split('.').join('-'); }
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
  ['+58', 'Venezuela'], ['+53', 'Cuba'], ['+34', 'España']];
const DOMINIOS_PAIS = [['.com.mx', 'México'], ['.mx', 'México'], ['.cl', 'Chile'], ['.com.co', 'Colombia'], ['.com.pe', 'Perú'],
  ['.pe', 'Perú'], ['.com.ar', 'Argentina'], ['.ar', 'Argentina'], ['.com.ec', 'Ecuador'], ['.ec', 'Ecuador'], ['.gt', 'Guatemala'],
  ['.cr', 'Costa Rica'], ['.com.sv', 'El Salvador'], ['.hn', 'Honduras'], ['.com.pa', 'Panamá'], ['.do', 'República Dominicana'],
  ['.br', 'Brasil'], ['.uy', 'Uruguay'], ['.py', 'Paraguay'], ['.bo', 'Bolivia'], ['.ve', 'Venezuela'], ['.es', 'España']];
function paisPorContacto(r) {
  for (const tel of [r.telefono, r.whatsapp]) {
    let t = String(tel || '').replace(/[^0-9+]/g, '');
    if (t.startsWith('00')) t = '+' + t.slice(2);
    // Google Sheets guarda +56 9 6965 9986 como 56969659986: más de 10 dígitos ya trae lada
    if (!t.startsWith('+') && t.length >= 11 && t.length <= 13) t = '+' + t;
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
    for (const [fin, p] of DOMINIOS_PAIS) if (d.endsWith(fin)) return p;
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
  vistos[slug] = true;
  // Los proveedores extranjeros ya traen su país; a los demás se les corrige si el contacto dice otro
  const real = String(r.tipo || '').indexOf('extranjero') >= 0 ? '' : paisPorContacto(r);
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
