// Nodo Code "Armar resumen" (Run Once for All Items). Entrada: filas de la hoja.
// Sale un solo item con el texto (HTML de Telegram) del resumen de la campaña.
// Sin barras invertidas ni backticks: se pega dentro de una plantilla del SDK.
const NL = String.fromCharCode(10);
const zona = 'America/Mexico_City';
const hoy = $now.setZone(zona).startOf('day');
const hace7 = hoy.minus({ days: 7 }).toISODate();
const filas = $input.all().map((i) => i.json).filter((r) => r.id && !String(r.id).startsWith('prueba-'));

const cuenta = {};
for (const r of filas) {
  const e = String(r.estatus || 'NUEVO').toUpperCase();
  cuenta[e] = (cuenta[e] || 0) + 1;
}
// Fechas que el flujo anota en "notas" (Respondió el AAAA-MM-DD, Pidió su baja el…, Registrado…, Rebotó el…)
const enNotas = (r, palabra) => {
  const n = String(r.notas || '');
  const i = n.lastIndexOf(palabra);
  if (i < 0) return '';
  const m = n.slice(i).match(/20[0-9]{2}-[0-9]{2}-[0-9]{2}/);
  return m ? m[0] : '';
};
const semana = (f) => f && f >= hace7;
const enviados = filas.filter((r) => semana(String(r.ultimo_contacto || '').slice(0, 10))).length;
const nuevos = filas.filter((r) => semana(String(r.fecha_alta || '').slice(0, 10))).length;
const respondieron = filas.filter((r) => semana(enNotas(r, 'Respondió el')));
const registrados = filas.filter((r) => semana(enNotas(r, 'Registrado en HETNA')));
const bajas = filas.filter((r) => semana(enNotas(r, 'Pidió su baja')) || semana(enNotas(r, 'Pidió la baja')));
const rebotes = filas.filter((r) => semana(enNotas(r, 'Rebotó el')));
const cola = (cuenta.NUEVO || 0);
const porDia = $now.setZone(zona) < DateTime.fromISO('2026-11-26', { zone: zona }) ? 20 : 40;

const lista = (arr) => arr.slice(0, 8).map((r) => '• ' + String(r.empresa || r.id).replace(/[<>&]/g, '') + ' (' + (r.pais || '') + ')').join(NL);
const partes = [
  '<b>📊 Campaña de prospección HETNA · semana al ' + hoy.toFormat('dd/MM') + '</b>',
  '',
  '✉️ Correos enviados: <b>' + enviados + '</b>',
  '🆕 Leads nuevos (búsqueda): <b>' + nuevos + '</b>',
  '📩 Respondieron: <b>' + respondieron.length + '</b>' + (respondieron.length ? NL + lista(respondieron) : ''),
  '✅ Se registraron en HETNA: <b>' + registrados.length + '</b>' + (registrados.length ? NL + lista(registrados) : ''),
  '🚫 Bajas: <b>' + bajas.length + '</b> · ⚠️ Rebotes: <b>' + rebotes.length + '</b>',
  '',
  '<b>Hoja completa (' + filas.length + ' empresas)</b>',
  'Por contactar: ' + cola + ' (≈ ' + Math.ceil(cola / porDia) + ' días hábiles a ' + porDia + '/día)',
  'En secuencia: ' + ((cuenta.CONTACTADO || 0) + (cuenta.PAUSA || 0)) + ' · Respondieron: ' + (cuenta.RESPONDIO || 0) + ' · Registrados: ' + (cuenta.REGISTRADO || 0),
  'Sólo teléfono (lista de llamadas): ' + (cuenta.SIN_EMAIL || 0) + ' · Bajas: ' + (cuenta.BAJA || 0) + ' · Rebotes/errores: ' + ((cuenta.REBOTE || 0) + (cuenta.ERROR || 0)),
];
return [{ json: { texto: partes.join(NL) } }];
