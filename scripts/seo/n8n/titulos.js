// Nodo Code "Sugerir títulos" del flujo «SEO - Search Console semanal».
// Para cada búsqueda con oportunidad, mira el <title> actual de la página que
// sale en Google y revisa si trae las palabras que la gente busca. Si faltan,
// dice cuáles. No cambia nada en el sitio: es una sugerencia para revisar.

const NL = String.fromCharCode(10);
const base = $('Armar datos').first().json;
const pedidas = $('Páginas a revisar').all().map((i) => i.json);
const bajadas = $input.all().map((i) => i.json);
const MARCAS_ACENTO = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const simple = (s) => String(s || '').normalize('NFD').replace(MARCAS_ACENTO, '').toLowerCase();
const VACIAS = ['de', 'del', 'la', 'el', 'en', 'y', 'para', 'con', 'los', 'las', 'por', 'un', 'una', 'mi', 'cerca'];

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
  // Un título armado por reglas se lee mal («Puebla de taller de…»): se dice qué
  // búsqueda falta y la redacción la decide una persona (o Claude, si se le pide).
  sugerencias.push('• ' + p.url.replace('https://hetnacnc.com', '') + NL + '  Hoy: «' + titulo + '»' + NL + '  Le falta: ' + faltan.join(', ') + ' (búsqueda «' + p.consulta + '», posición ' + p.posicion + ', ' + p.impresiones + ' imp)' + NL + '  Idea: que el título incluya «' + p.consulta + '» sin pasar de 60 caracteres.');
});

const texto = base.reporte + NL + NL + '✍️ Títulos SEO a revisar:' + NL + (sugerencias.length ? sugerencias.join(NL) : '• Los títulos ya traen las palabras que se buscan.') +
  NL + NL + 'Datos en n8n: tablas seo_paginas, seo_consultas y seo_semanal.';
// Telegram en modo HTML: sólo hay que escapar &, < y >
const html = texto.slice(0, 3900).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
return [{ json: { texto: html } }];
