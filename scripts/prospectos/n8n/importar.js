// Nodo Code "Quitar duplicados" (Run Once for All Items).
// Entrada: filas actuales de la hoja. Body del webhook: { prospectos: [...] }
// (mismas columnas que la hoja). Sólo deja pasar los que no existen ni por
// id/dominio ni por correo, para que nunca haya duplicados.
const body = $('Importar prospectos').first().json.body || {};
const lista = Array.isArray(body) ? body : body.prospectos || [];
const ids = new Set();
const mails = new Set();
for (const i of $input.all()) {
  if (i.json.id) ids.add(String(i.json.id).toLowerCase());
  if (i.json.email) mails.add(String(i.json.email).toLowerCase().trim());
}
const hoy = $now.setZone('America/Mexico_City').toISODate();
const token = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const out = [];
for (const p of lista) {
  let id = String(p.id || p.dominio || '').toLowerCase().trim();
  for (const pre of ['https://', 'http://', 'www.']) if (id.startsWith(pre)) id = id.slice(pre.length);
  while (id.endsWith('/')) id = id.slice(0, -1);
  const em = String(p.email || '').toLowerCase().trim();
  if (!id || !p.empresa || ids.has(id) || (em && mails.has(em))) continue;
  ids.add(id);
  if (em) mails.add(em);
  out.push({ json: {
    ...p,
    id,
    dominio: p.dominio || id,
    email: em,
    fecha_alta: p.fecha_alta || hoy,
    estatus: em ? 'NUEVO' : 'SIN_EMAIL',
    paso: '0',
    ultimo_contacto: '',
    proximo_contacto: '',
    token: p.token || token(),
    notas: p.notas || '',
  } });
}
return out;
