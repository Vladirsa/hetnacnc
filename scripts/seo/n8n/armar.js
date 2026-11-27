// Nodo Code "Armar datos" del flujo «SEO - Search Console semanal».
// Junta las 4 consultas a Search Console en filas para las tablas de n8n
// (seo_paginas, seo_consultas, seo_semanal) y arma el reporte para Telegram.
// Si Search Console falló (credencial vencida, sin permiso...), regresa ok=false
// y el flujo sólo avisa: nunca borra las tablas sin datos nuevos.

const f = $('Fechas').first().json;
const leer = (n) => {
  try {
    return $(n).first().json || {};
  } catch (e) {
    return {};
  }
};
const P = leer('GSC páginas');
const Q = leer('GSC consultas');
const PQ = leer('GSC página y consulta');
const D = leer('GSC por día');
const conError = [P, Q, PQ, D].find((x) => x.error);
if (conError || !Array.isArray(P.rows)) {
  const e = conError ? conError.error : null;
  const msg = e ? (e.message || e.description || JSON.stringify(e)) : 'Search Console no regresó filas';
  return [{ json: { ok: false, error: String(msg).slice(0, 400) } }];
}

const r1 = (x) => Math.round(Number(x || 0) * 10) / 10;
const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;
const periodo = f.inicio + '..' + f.fin;
// Las versiones por país (/sv/, /do/, /hn/...) apuntan a /mx como la principal:
// en el reporte se muestran y se revisan como /mx. Sin parámetros (?formato=...).
const principal = (u) => String(u || '').split('?')[0].replace(/^https:[/][/](www[.])?hetnacnc[.]com[/][a-z][a-z][/]/, 'https://hetnacnc.com/mx/');
const corta = (u) => principal(u).replace('https://hetnacnc.com', '').replace('https://www.hetnacnc.com', '') || '/';
const slugDir = (u) => {
  const m = String(u || '').split('?')[0].match(/[/]talleres[/]directorio[/]([a-z0-9-]+)[/]?$/);
  return m ? m[1] : '';
};

// Consulta principal de cada página y página principal de cada consulta
const topDePagina = {};
const topDeConsulta = {};
for (const r of PQ.rows || []) {
  const [url, q] = r.keys || [];
  if (!topDePagina[url] || r.impressions > topDePagina[url].impressions) topDePagina[url] = { q, impressions: r.impressions };
  if (!topDeConsulta[q] || r.impressions > topDeConsulta[q].impressions) topDeConsulta[q] = { url, impressions: r.impressions };
}

const paginas = (P.rows || []).map((r) => {
  const url = (r.keys || [])[0];
  return {
    url,
    slug_directorio: slugDir(url),
    clics: r.clicks,
    impresiones: r.impressions,
    ctr: r2(r.ctr * 100),
    posicion: r1(r.position),
    consulta_top: topDePagina[url] ? topDePagina[url].q : '',
    periodo,
    dias: 28,
    fuente: 'api',
  };
});
const consultas = (Q.rows || []).map((r) => {
  const q = (r.keys || [])[0];
  return {
    consulta: q,
    clics: r.clicks,
    impresiones: r.impressions,
    ctr: r2(r.ctr * 100),
    posicion: r1(r.position),
    url_top: topDeConsulta[q] ? topDeConsulta[q].url : '',
    periodo,
    dias: 28,
    fuente: 'api',
  };
});

// Por semana (lunes) y comparación de los 28 días contra los 28 anteriores
const semanas = {};
let act = { c: 0, i: 0, p: 0 };
let ant = { c: 0, i: 0, p: 0 };
for (const r of D.rows || []) {
  const dia = DateTime.fromISO((r.keys || [])[0]);
  const lunes = dia.minus({ days: dia.weekday - 1 }).toISODate();
  const s = semanas[lunes] || (semanas[lunes] = { c: 0, i: 0, p: 0 });
  s.c += r.clicks;
  s.i += r.impressions;
  s.p += r.position * r.impressions;
  const t = dia.toISODate() >= f.inicio ? act : ant;
  t.c += r.clicks;
  t.i += r.impressions;
  t.p += r.position * r.impressions;
}
const filasSemanas = Object.keys(semanas).sort().map((k) => {
  const s = semanas[k];
  return { semana: k, clics: s.c, impresiones: s.i, ctr: s.i ? r2((s.c / s.i) * 100) : 0, posicion: s.i ? r1(s.p / s.i) : 0, fuente: 'api' };
});

// ── Reporte ──
const NL = String.fromCharCode(10);
const cambio = (a, b) => (b ? (a >= b ? '▲ ' : '▼ ') + Math.round(Math.abs((a - b) / b) * 100) + '%' : 'nuevo');
const esMarcaAjena = (c) => String(c.url_top || '').indexOf('/talleres/directorio/') >= 0;
// Sin página conocida no se sabe si es el nombre de otra empresa: fuera
const propia = (c) => !!c.url_top && String(c.url_top).indexOf('?') < 0 && !esMarcaAjena(c) && !/^site:|hetna/i.test(c.consulta);
const oportunidades = consultas.filter((c) => propia(c) && c.posicion >= 4 && c.posicion <= 20 && c.impresiones >= 5)
  .sort((a, b) => b.impresiones - a.impresiones).slice(0, 8);
const lejos = consultas.filter((c) => !esMarcaAjena(c) && !/^site:|hetna/i.test(c.consulta) && c.posicion > 30 && c.impresiones >= 10)
  .sort((a, b) => b.impresiones - a.impresiones).slice(0, 5);
const perfiles = paginas.filter((p) => p.slug_directorio).sort((a, b) => b.impresiones - a.impresiones);
const mejores = paginas.filter((p) => !p.slug_directorio && p.clics > 0).sort((a, b) => b.clics - a.clics).slice(0, 5);

const lineas = [
  '📈 SEO semanal HETNA (' + f.inicio + ' a ' + f.fin + ', 28 días)',
  'Clics: ' + act.c + ' (' + cambio(act.c, ant.c) + ') · Impresiones: ' + act.i + ' (' + cambio(act.i, ant.i) + ')',
  'CTR: ' + (act.i ? r2((act.c / act.i) * 100) : 0) + '% · Posición media: ' + (act.i ? r1(act.p / act.i) : '-'),
  '',
  '🎯 Búsquedas a punto de subir a la página 1 (posición 4 a 20):',
  ...(oportunidades.length ? oportunidades.map((c) => '• «' + c.consulta + '» pos ' + c.posicion + ', ' + c.impresiones + ' imp → ' + corta(c.url_top)) : ['• (ninguna esta semana)']),
  '',
  '🆕 Temas con búsquedas pero lejos (posición > 30): idea para guía, página o campaña',
  ...(lejos.length ? lejos.map((c) => '• «' + c.consulta + '» pos ' + c.posicion + ', ' + c.impresiones + ' imp') : ['• (ninguno)']),
  '',
  '⭐ Páginas que más clics trajeron:',
  ...(mejores.length ? mejores.map((p) => '• ' + corta(p.url) + ': ' + p.clics + ' clics, pos ' + p.posicion) : ['• (sin clics)']),
  '',
  '🏷️ Perfiles del directorio: ' + perfiles.length + ' con impresiones (' + perfiles.filter((p) => p.impresiones >= 10).length + ' con 10 o más reciben el correo «su perfil apareció en Google»). Más vistos:',
  ...perfiles.slice(0, 5).map((p) => '• ' + p.slug_directorio + ': ' + p.impresiones + ' imp'),
];

return [{
  json: {
    ok: true,
    paginas,
    consultas,
    semanas: filasSemanas,
    primeraSemana: filasSemanas.length ? filasSemanas[0].semana : f.inicioComparar,
    revisar: oportunidades.filter((c) => c.url_top).slice(0, 6).map((c) => ({ url: principal(c.url_top), consulta: c.consulta, posicion: c.posicion, impresiones: c.impresiones })),
    reporte: lineas.join(NL),
  },
}];
