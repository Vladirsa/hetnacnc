// Nodo Code "Validar baja" (Run Once for All Items). Siempre devuelve 1 item.
const q = $('Enlace de baja').first().json.query || {};
const fila = $input.all().map((i) => i.json).find((r) => String(r.id) === String(q.id || ''));
const ok = !!fila && String(fila.token || '') === String(q.t || '');
const hoy = $now.setZone('America/Mexico_City').toISODate();
return [{ json: {
  ok,
  id: fila ? fila.id : '',
  estatus: 'BAJA',
  proximo_contacto: '',
  notas: fila ? (fila.notas ? fila.notas + ' | ' : '') + 'Pidió su baja el ' + hoy : '',
} }];
