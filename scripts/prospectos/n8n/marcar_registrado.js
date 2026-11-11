// Nodo Code "Buscar al registrado" (Run Once for All Items).
// Entrada: filas de la hoja. Busca al que se registró en HETNA por correo
// exacto o por dominio de empresa (no por dominios gratuitos tipo gmail).
const body = $('Registro en HETNA').first().json.body || {};
const email = String(body.email || '').toLowerCase().trim();
const LIBRES = ['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.com.mx', 'yahoo.com', 'yahoo.com.mx', 'icloud.com', 'msn.com', 'aol.com', 'prodigy.net.mx', 'proton.me', 'protonmail.com', 'uol.com.br', 'bol.com.br', 'terra.com.br'];
const dom = String(body.dominio || email.split('@')[1] || '').toLowerCase();
const dom2 = dom.startsWith('www.') ? dom.slice(4) : dom;
const porDominio = dom2 && !LIBRES.includes(dom2);
const hoy = $now.setZone('America/Mexico_City').toISODate();
const out = [];
for (const i of $input.all()) {
  const r = i.json;
  if (!r.id || String(r.estatus || '').toUpperCase() === 'REGISTRADO') continue;
  const re = String(r.email || '').toLowerCase().trim();
  const rd = String(r.dominio || '').toLowerCase();
  const reDom = re.split('@')[1] || '';
  const coincide = (email && re === email) || (porDominio && (rd === dom2 || rd.endsWith('.' + dom2) || reDom === dom2));
  if (!coincide) continue;
  out.push({ json: {
    id: r.id,
    estatus: 'REGISTRADO',
    proximo_contacto: '',
    notas: (r.notas ? r.notas + ' | ' : '') + 'Registrado en HETNA como ' + (body.tipo || 'usuario') + ' (' + email + ') el ' + hoy,
  } });
}
return out;
