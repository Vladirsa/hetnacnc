// Nodo Code "Armar avisos" del agente Cazador de solicitudes (Run Once for All Items).
// Entrada: webhook { solicitudes: [...] } de scripts/prospectos/cazar_solicitudes.py.
// Sale un item por mensaje de Telegram (hasta 4 solicitudes por mensaje).
// Sin barras invertidas ni backticks.
const NL = String.fromCharCode(10);
const body = $('Recibir solicitudes').first().json.body || {};
const lista = (body.solicitudes || []).slice().sort((a, b) => (b.calificacion || 0) - (a.calificacion || 0));
const esc = (s) => String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').split('').filter((c) => c.charCodeAt(0) < 128).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const liga = (d) => {
  const q = [
    ['desde', 'cazador'],
    ['pieza', d.pieza || d.resumen || 'Pieza a la medida'],
    ['medidas', [d.medidas, d.cantidad ? 'Cantidad: ' + d.cantidad : ''].filter(Boolean).join('. ')],
    ['material', d.material],
    ['proceso', d.servicio],
    ['utm_source', 'cazador'],
    ['utm_medium', 'respuesta'],
    ['utm_campaign', slug(d.servicio) || 'cnc'],
  ].filter((p) => p[1]).map((p) => p[0] + '=' + encodeURIComponent(String(p[1]).slice(0, 200)));
  return 'https://hetnacnc.com/mx/cotizar?' + q.join('&');
};
if (!lista.length) {
  return [{ json: { texto: '🎯 <b>Cazador de solicitudes</b>' + NL + 'Hoy no encontré solicitudes nuevas de clientes. Mañana vuelvo a buscar.' } }];
}
const empresas = lista.filter((d) => d.correo_de_empresa).length;
const bloques = lista.map((d, i) => {
  const l = liga(d);
  const respuesta = String(d.respuesta || '').split('{liga}').join(l);
  return [
    '<b>' + (i + 1) + '. ' + '⭐'.repeat(Math.max(1, Math.min(5, d.calificacion || 3))) + ' ' + esc(d.resumen || d.titulo) + '</b>',
    [d.quien ? esc(d.quien) : '', d.empresa ? esc(d.empresa) : '', d.ciudad ? '📍 ' + esc(d.ciudad) : '', d.fecha ? esc(d.fecha) : ''].filter(Boolean).join(' · '),
    '🔗 <a href="' + esc(d.url) + '">Ver publicación</a> · <a href="' + esc(l) + '">Liga a cotizar ya llena</a>',
    d.correo_de_empresa ? '✉️ Empresa con correo público: le llega invitación por correo (campaña).' : '✍️ Contéstale tú donde publicó:',
    d.correo_de_empresa ? '' : '<code>' + esc(respuesta) + '</code>',
  ].filter(Boolean).join(NL);
});
const salida = [];
for (let i = 0; i < bloques.length; i += 4) {
  const cabeza = i === 0 ? '🎯 <b>Cazador de solicitudes · ' + lista.length + ' nueva(s)</b>' + (empresas ? ' · ' + empresas + ' empresa(s) a la campaña' : '') + NL + NL : '';
  salida.push({ json: { texto: (cabeza + bloques.slice(i, i + 4).join(NL + NL)).slice(0, 4000) } });
}
return salida;
