// Nodo Code "Fechas" del flujo «SEO - Search Console semanal».
// Search Console tarda ~3 días en tener los datos completos: el periodo son los
// 28 días que terminan hace 3 días; para comparar, se piden 56 días por día.
// SITIO_GSC es la propiedad tal como aparece en Search Console (prefijo de URL).
const SITIO_GSC = 'https://hetnacnc.com/';
const hoy = $now.setZone('America/Mexico_City').startOf('day');
const fin = hoy.minus({ days: 3 });
const inicio = fin.minus({ days: 27 });
const inicioComparar = fin.minus({ days: 55 });
return [{
  json: {
    api: 'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(SITIO_GSC) + '/searchAnalytics/query',
    inicio: inicio.toISODate(),
    fin: fin.toISODate(),
    inicioComparar: inicioComparar.toISODate(),
  },
}];
