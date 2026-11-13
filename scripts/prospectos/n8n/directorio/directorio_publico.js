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
  empresas.push({
    slug,
    empresa: limpiar(r.empresa, 90),
    tipo,
    tamano: limpiar(r.tamano, 20),
    pais: limpiar(r.pais, 40),
    region: limpiar(r.region, 60),
    ciudad: limpiar(r.ciudad, 60),
    servicios: limpiar(r.productos_servicios, 240),
    segmento: limpiar(r.segmento, 120),
  });
}
return [{ json: { generado: $now.toISO(), total: empresas.length, empresas } }];
