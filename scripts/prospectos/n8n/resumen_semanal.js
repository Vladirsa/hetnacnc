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
const porDia = 40; // desde el 13 nov 2026 salen 40 correos por día

// ---- Análisis por versión de correo (pruebas A/B/C) ----
// La versión se calcula igual que en preparar_correos.js (hash del id) y los clics
// traen la campaña anotada: "Abrió una liga del correo el AAAA-MM-DD (/ruta, vendedor_p1b)".
const segmento = (t) => (t === 'Instructor/Capacitación' ? 'instructor' : t === 'Cliente comprador' || t === 'Servicios CNC' ? 'comprador' : 'vendedor');
const VERSIONES = { vendedor: 3, comprador: 2 };
const INICIO_PRUEBAS = '2026-11-20';
const variante = (id, n) => {
  let h = 0;
  const x = String(id || '');
  for (let i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) % 100003;
  return 'abc'.charAt(h % n);
};
const conClic = (r) => String(r.notas || '').indexOf('Abrió una liga del correo') >= 0;
const pruebas = {};
for (const r of filas) {
  const seg = segmento(r.tipo);
  const n = VERSIONES[seg];
  if (!n || (r.idioma && r.idioma !== 'es') || Number(r.paso || 0) < 1) continue;
  // Sólo quien recibió su primer correo desde que existen las versiones (20 nov 2026).
  // El primer correo fue en ultimo_contacto menos los días de espera de los pasos que siguieron.
  const paso = Number(r.paso || 0);
  const ult = String(r.ultimo_contacto || '').slice(0, 10);
  const atras = { 1: 0, 2: 4, 3: 10 }[paso];
  if (atras === undefined || !ult) continue;
  const primero = new Date(Date.parse(ult + 'T12:00:00Z') - atras * 86400000).toISOString().slice(0, 10);
  if (primero < INICIO_PRUEBAS) continue;
  const clave = seg + ' ' + variante(r.id, n).toUpperCase();
  const p = pruebas[clave] || (pruebas[clave] = { enviados: 0, clics: 0, registros: 0, respuestas: 0 });
  p.enviados++;
  if (conClic(r)) p.clics++;
  if (String(r.estatus || '').toUpperCase() === 'REGISTRADO') p.registros++;
  if (String(r.estatus || '').toUpperCase() === 'RESPONDIO') p.respuestas++;
}
const pct = (a, b) => (b ? Math.round((a * 1000) / b) / 10 : 0) + '%';
const lineasPrueba = Object.keys(pruebas).sort().map((k) => {
  const p = pruebas[k];
  return '• ' + k + ': ' + p.enviados + ' enviados · ' + p.clics + ' clics (' + pct(p.clics, p.enviados) + ') · ' + p.registros + ' registros · ' + p.respuestas + ' respuestas';
});
const clicsSemana = filas.filter((r) => semana(enNotas(r, 'Abrió una liga del correo el')));

// ---- Encuesta "¿por qué no se registran?" ----
const opiniones = [];
const motivos = {};
for (const r of filas) {
  const n = String(r.notas || '');
  let i = n.indexOf('Opinión ');
  while (i >= 0) {
    const tramo = n.slice(i + 8).split(' | ')[0];
    const fecha = tramo.slice(0, 10);
    const resto = tramo.slice(12);
    const motivo = resto.split(' — ')[0];
    const comentario = resto.indexOf(' — ') >= 0 ? resto.split(' — ').slice(1).join(' — ') : '';
    motivos[motivo] = (motivos[motivo] || 0) + 1;
    if (semana(fecha)) opiniones.push({ empresa: r.empresa || r.id, motivo, comentario });
    i = n.indexOf('Opinión ', i + 8);
  }
}
const lineasMotivos = Object.keys(motivos).sort((a, b) => motivos[b] - motivos[a]).map((m) => '• ' + m + ': ' + motivos[m]);
const lineasComentarios = opiniones.filter((o) => o.comentario).slice(0, 6).map((o) => '• ' + String(o.empresa).replace(/[<>&]/g, '') + ': ' + o.comentario.replace(/[<>&]/g, '').slice(0, 160));

// ---- Quién responde: por giro y ciudad (desde el inicio) ----
const interesados = filas.filter((r) => ['RESPONDIO', 'REGISTRADO'].includes(String(r.estatus || '').toUpperCase()) || conClic(r));
const contar = (arr, campo) => {
  const c = {};
  for (const r of arr) {
    const v = String(r[campo] || 'sin dato');
    c[v] = (c[v] || 0) + 1;
  }
  return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 4).map((k) => k + ' ' + c[k]).join(', ');
};

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
  '',
  '👀 Abrieron una liga esta semana: <b>' + clicsSemana.length + '</b>' + (clicsSemana.length ? NL + lista(clicsSemana) : ''),
  '',
  '<b>🧪 Qué versión de correo funciona (desde el inicio)</b>',
  lineasPrueba.length ? lineasPrueba.join(NL) : 'Todavía sin datos.',
  'Las diferencias cuentan cuando cada versión lleva 100 envíos o más.',
  '',
  '<b>🗳️ ¿Por qué no se registran? (encuesta)</b>',
  lineasMotivos.length ? lineasMotivos.join(NL) : 'Todavía nadie ha contestado.',
  lineasComentarios.length ? 'Comentarios de la semana:' + NL + lineasComentarios.join(NL) : '',
  '',
  '<b>🎯 Quién muestra interés (clic, respuesta o registro)</b>',
  interesados.length ? 'Por giro: ' + contar(interesados, 'tipo') + NL + 'Por ciudad: ' + contar(interesados, 'ciudad') : 'Todavía sin datos.',
].filter((x) => x !== null && x !== undefined);
return [{ json: { texto: partes.join(NL).slice(0, 4000) } }];
