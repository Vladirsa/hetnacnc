// Nodo Code "Filas nuevas" del agente Monitor de precios: una fila por material medido.
const body = $('Recibir precios').first().json.body || {};
const fecha = body.fecha || $now.setZone('America/Mexico_City').toISODate();
return (body.materiales || []).filter((m) => m.mediana).map((m) => ({ json: {
  fecha,
  clave: m.clave,
  nombre: m.nombre,
  mediana: m.mediana,
  minimo: m.minimo,
  maximo: m.maximo,
  n: m.n,
  fuentes: (m.fuentes || []).map((f) => f.tienda + ' ' + f.precio).join(' | ').slice(0, 900),
} }));
