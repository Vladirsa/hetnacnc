// Nodo Code "Sugerir títulos" del flujo «SEO - Search Console semanal».
// Para cada búsqueda con oportunidad, mira el <title> actual de la página que
// sale en Google y revisa si trae las palabras que la gente busca. Si faltan,
// sugiere un título que agregue al inicio las palabras que faltan (Google corta en ~60
// caracteres). No cambia nada en el sitio: es una sugerencia para revisar.

const NL = String.fromCharCode(10);
const base = $('Armar datos').first().json;
const pedidas = $('Páginas a revisar').all().map((i) => i.json);
const bajadas = $input.all().map((i) => i.json);
const MARCAS_ACENTO = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const simple = (s) => String(s || '').normalize('NFD').replace(MARCAS_ACENTO, '').toLowerCase();
const VACIAS = ['de', 'del', 'la', 'el', 'en', 'y', 'para', 'con', 'los', 'las', 'por', 'un', 'una', 'mi', 'cerca'];
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const sugerencias = [];
pedidas.forEach((p, i) => {
  if (!p.url) return;
  const html = String((bajadas[i] && (bajadas[i].data || bajadas[i].body)) || '');
  const m = html.match(/<title[^>]*>([^<]*)<[/]title>/i);
  const titulo = m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim() : '';
  if (!titulo) return;
  const palabras = simple(p.consulta).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && VACIAS.indexOf(w) < 0);
  const faltan = palabras.filter((w) => simple(titulo).indexOf(w) < 0);
  if (!faltan.length) return;
  // Las palabras que faltan van al inicio y el resto del título se queda
  // («Maquila de corte láser de MDF en Tlaxcala»); Google muestra ~60 caracteres.
  const resto = titulo.split('|')[0].trim();
  let nuevo = capital(faltan.join(' ')) + ' de ' + resto.charAt(0).toLowerCase() + resto.slice(1);
  if (nuevo.length > 60) nuevo = nuevo.slice(0, 60).replace(/ [^ ]*$/, '');
  if (nuevo.length <= 47) nuevo = nuevo + ' | HETNA CNC';
  sugerencias.push('• ' + p.url.replace('https://hetnacnc.com', '') + NL + '  Hoy: «' + titulo + '»' + NL + '  Falta: ' + faltan.join(', ') + ' (búsqueda «' + p.consulta + '», pos ' + p.posicion + ')' + NL + '  Sugerido (revísalo): «' + nuevo + '»');
});

const texto = base.reporte + NL + NL + '✍️ Títulos SEO a revisar:' + NL + (sugerencias.length ? sugerencias.join(NL) : '• Los títulos ya traen las palabras que se buscan.') +
  NL + NL + 'Datos en n8n: tablas seo_paginas, seo_consultas y seo_semanal.';
return [{ json: { texto: texto.slice(0, 4000) } }];
