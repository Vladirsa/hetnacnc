// Nodo Code "Empresas con correo" del agente Cazador (Run Once for All Items).
// Las solicitudes de EMPRESAS que publicaron su correo pasan a la hoja de
// prospectos como "Cliente comprador", segmento "solicitud" (el webhook
// hetna-prospectos-importar quita duplicados). La campaña les manda la
// invitación que habla de lo que pidieron. A personas no se les escribe.
const body = $('Recibir solicitudes').first().json.body || {};
const hoy = $now.setZone('America/Mexico_City').toISODate();
const prospectos = (body.solicitudes || []).filter((d) => d.correo_de_empresa && d.email).map((d) => {
  const dominio = String(d.email).split('@')[1].toLowerCase();
  const necesidad = [d.pieza || d.resumen, d.material, d.medidas, d.cantidad ? 'cantidad ' + d.cantidad : ''].filter(Boolean).join(', ');
  return {
    id: dominio,
    empresa: d.empresa || dominio,
    tipo: 'Cliente comprador',
    segmento: 'solicitud',
    pais: 'México',
    ciudad: d.ciudad || '',
    web: '',
    dominio,
    email: String(d.email).toLowerCase(),
    productos_servicios: necesidad.slice(0, 300),
    idioma: 'es',
    fuente_url: d.url,
    notas: 'Solicitud vista ' + hoy + ' (' + (d.servicio || 'CNC') + '): ' + String(d.resumen || '').slice(0, 200),
  };
});
return prospectos.length ? [{ json: { prospectos } }] : [];
