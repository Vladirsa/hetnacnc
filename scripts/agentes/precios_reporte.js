// Nodo Code "Armar reporte" del agente Monitor de precios (Run Once for All Items).
// Entradas: el webhook (precios de esta semana, de scripts/prospectos/precios_materiales.py)
// y el historial de la tabla precios_materiales. Compara con la medición anterior
// de cada material y avisa cuando sube o baja 5% o más. Sin barras invertidas ni backticks.
const NL = String.fromCharCode(10);
const body = $('Recibir precios').first().json.body || {};
const fecha = body.fecha || $now.setZone('America/Mexico_City').toISODate();
const historial = $input.all().map((i) => i.json).filter((r) => r.clave && r.fecha && r.fecha < fecha);
const anterior = {};
for (const r of historial) if (!anterior[r.clave] || r.fecha > anterior[r.clave].fecha) anterior[r.clave] = r;
const esc = (s) => String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const lineas = [];
const alertas = [];
let conDato = 0;
for (const m of body.materiales || []) {
  if (!m.mediana) { lineas.push('• ' + esc(m.nombre) + ': sin precio esta semana'); continue; }
  conDato++;
  const a = anterior[m.clave];
  let cambio = '';
  if (a && a.mediana) {
    const p = Math.round(((m.mediana - a.mediana) / a.mediana) * 1000) / 10;
    cambio = p === 0 ? ' (=)' : ' (' + (p > 0 ? '▲ ' : '▼ ') + Math.abs(p) + '%)';
    if (Math.abs(p) >= 5) alertas.push((p > 0 ? '🔺 ' : '🔻 ') + esc(m.nombre) + ': ' + pesos(a.mediana) + ' → ' + pesos(m.mediana));
  }
  const barata = (m.fuentes || []).slice().sort((x, y) => x.precio - y.precio)[0];
  lineas.push('• <b>' + esc(m.nombre) + '</b>: ' + pesos(m.mediana) + cambio + NL + '   ' + pesos(m.minimo) + ' a ' + pesos(m.maximo) + ' · ' + m.n + ' tienda(s)' + (barata ? ' · más barato: <a href="' + esc(barata.url) + '">' + esc(barata.tienda) + '</a>' : ''));
}
const texto = [
  '<b>📈 Precios de materiales CNC · ' + fecha + '</b>',
  'Mediana de precios públicos en tiendas y distribuidores de México (precio por hoja o pieza, con IVA según la tienda).',
  '',
  alertas.length ? '<b>Cambios de 5% o más</b>' + NL + alertas.join(NL) + NL : (Object.keys(anterior).length ? 'Sin cambios fuertes contra la medición anterior.' + NL : 'Primera medición: la próxima semana ya se compara.' + NL),
  lineas.join(NL),
  '',
  'Con esto puedes revisar las tarifas del cotizador y publicar el índice mensual.',
].join(NL).slice(0, 4000);
return [{ json: { texto, conDato } }];
