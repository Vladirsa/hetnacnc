// Nodo Code "Validar baja" (Run Once for All Items). Siempre devuelve 1 item.
// La baja llega por POST desde el botón de la página de confirmación (los
// antivirus abren el enlace GET pero no envían el formulario).
const q = $('Confirmar baja').first().json.body || {};
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
