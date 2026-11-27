// Nodo Code "Correo perfil en Google" (n8n, Run Once for All Items), justo
// después de "Preparar correos del día" en «Prospectos HETNA - Campaña de correo CNC».
//
// Datos reales de Search Console (tabla seo_paginas de n8n; la llena el flujo
// «SEO - Search Console semanal» y el nodo «Impresiones de perfiles» la lee).
// A los talleres y proveedores con perfil no reclamado que ya van en el correo 4
// o más, en lugar de la novedad del mes les toca éste: cuántas veces salió su
// perfil en Google y cómo reclamarlo. Una vez cada 90 días como máximo y sólo
// con MIN_IMPRESIONES o más. A los demás correos del día no los toca.
// (Sin backticks ni barras invertidas, como los otros nodos de esta carpeta.)

const MIN_IMPRESIONES = 10;
const DIAS_ENTRE_GOOGLE = 90;
const MARCA_GOOGLE = 'Correo perfil en Google el ';
const SITIO = 'https://www.hetnacnc.com';
const BAJA = 'https://n8n.hetnacnc.com/webhook/hetna-prospectos-baja';
const OPINION = 'https://n8n.hetnacnc.com/webhook/hetna-prospectos-opinion';
const DOMICILIO = 'HETNA CNC · Col. Centro, Apizaco, Tlaxcala, México';

const hoy = $now.setZone('America/Mexico_City').startOf('day');
const HOY = hoy.toISODate();
const masDias = (n) => hoy.plus({ days: n }).toISODate();
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MARCAS_ACENTO = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
// Misma regla que el directorio (directorio/comun.js y slug-directorio.ts del sitio)
function slugDe(id) {
  return String(id == null ? '' : id).normalize('NFD').replace(MARCAS_ACENTO, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/, '');
}
function segmento(tipo) {
  if (tipo === 'Instructor/Capacitación') return 'instructor';
  if (tipo === 'Cliente comprador' || tipo === 'Servicios CNC') return 'comprador';
  return 'vendedor';
}
function liga(ruta, paso) {
  return SITIO + ruta + (ruta.includes('?') ? '&' : '?') + 'utm_source=correo&utm_medium=prospeccion&utm_campaign=vendedor_p' + paso + 'g';
}
function boton(url, texto) {
  return '<p style="margin:24px 0"><a href="' + url + '" style="background:#f97316;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">' + texto + '</a></p>';
}
const MOTIVOS = [
  ['ya_vendo', 'Ya vendo en otro lado'],
  ['sin_tiempo', 'Ahorita no tengo tiempo'],
  ['no_entiendo', 'No entiendo cómo funciona'],
  ['comision', 'La comisión'],
  ['no_confio', 'No conozco la plataforma'],
  ['no_aplica', 'No es para mi negocio'],
  ['baja', 'No me interesa'],
];
function encuesta(r) {
  const base = OPINION + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '') + '&r=';
  return '<div style="margin:20px 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:13px">' +
    '<b>¿No es para ustedes?</b> Cuéntennos por qué en un clic; nos ayuda a mejorar:<br>' +
    MOTIVOS.map((m) => '<a href="' + base + m[0] + '" style="color:#c2410c">' + m[1] + '</a>').join(' · ') + '</div>';
}
function googleReciente(notas) {
  const partes = String(notas || '').split(MARCA_GOOGLE);
  if (partes.length < 2) return false;
  return partes[partes.length - 1].slice(0, 10) > masDias(-DIAS_ENTRE_GOOGLE);
}
function periodoTexto(v) {
  const d = Number(v.dias) || 28;
  return d >= 60 ? 'En los últimos ' + Math.round(d / 30) + ' meses' : 'En los últimos ' + d + ' días';
}

// Impresiones por perfil y filas de la hoja
const VISTAS = {};
try {
  for (const it of $('Impresiones de perfiles').all()) {
    const v = it.json || {};
    const s = String(v.slug_directorio || '');
    if (s && Number(v.impresiones) >= MIN_IMPRESIONES) VISTAS[s] = v;
  }
} catch (e) {
  // Sin datos de Search Console: los correos salen como los armó el nodo anterior
}
const FILAS = {};
try {
  for (const it of $('Leer prospectos').all()) if (it.json && it.json.id) FILAS[String(it.json.id)] = it.json;
} catch (e) {
  // sin hoja no hay nada que cambiar
}

return $input.all().map((it) => {
  const c = it.json;
  const r = FILAS[String(c.id)];
  const paso = Number(c.paso) || 0;
  if (!r || paso < 4) return it;
  if ((r.idioma && r.idioma !== 'es') || segmento(r.tipo) !== 'vendedor') return it;
  if (String(r.publicar || '').trim().toUpperCase() === 'NO') return it;
  const slug = slugDe(r.id);
  const v = VISTAS[slug];
  if (!v || googleReciente(r.notas)) return it;

  const empresa = String(r.empresa || '').trim() || r.dominio;
  const n = Number(v.impresiones) || 0;
  const clics = Number(v.clics) || 0;
  const consulta = String(v.consulta_top || '').slice(0, 60);
  const perfil = SITIO + '/mx/talleres/directorio/' + slug;
  const asunto = empresa + ': su perfil apareció ' + n + ' veces en Google';
  const cuerpo = '<p>' + periodoTexto(v) + ', el perfil de <b>' + esc(empresa) + '</b> en el directorio de HETNA CNC apareció <b>' + n + ' veces</b> en los resultados de Google' +
    (consulta ? ', por ejemplo cuando alguien buscó «' + esc(consulta) + '»' : '') + '.</p>' +
    (clics > 0 ? '<p>' + clics + (clics === 1 ? ' persona entró' : ' personas entraron') + ' a verlo desde Google.</p>' : '') +
    '<p>Hoy es un <b>perfil no reclamado</b>: lo armamos con la información pública de su sitio web, y cuando un cliente pide cotización desde ahí, la solicitud también la reciben los talleres registrados.</p>' +
    '<p>Si lo reclaman (es gratis y toma unos minutos):</p>' +
    '<ul><li>Las solicitudes de cotización les llegan directo a ustedes.</li>' +
    '<li>Ponen sus máquinas, materiales, fotos de trabajos y su zona de entrega.</li>' +
    '<li>Sólo pagan comisión cuando venden.</li></ul>' +
    boton(liga('/talleres/unete?perfil=' + encodeURIComponent(slug), paso), 'Reclamar mi perfil gratis') +
    '<p style="font-size:13px;color:#6b7280">Así se ve hoy: <a href="' + perfil + '">su perfil en HETNA</a>. Si prefieren no aparecer, ahí mismo pueden pedir que lo quitemos.</p>' +
    encuesta(r);
  const urlBaja = BAJA + '?id=' + encodeURIComponent(r.id) + '&t=' + encodeURIComponent(r.token || '');
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:600px">' +
    '<p>Hola, equipo de ' + esc(empresa) + ':</p>' + cuerpo +
    '<p>Saludos,<br>Equipo HETNA CNC<br><a href="' + SITIO + '">hetnacnc.com</a> · WhatsApp +52 221 707 6014</p>' +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">' +
    'Te escribimos porque tu empresa publica este correo como contacto comercial. Si no quieres recibir más mensajes, <a href="' + urlBaja + '">date de baja aquí</a> y no volveremos a escribirte. No compartimos ni vendemos tus datos.' +
    '<br>' + DOMICILIO + '</p></div>';
  return {
    json: {
      ...c,
      asunto,
      html,
      notas: [String(c.notas || ''), MARCA_GOOGLE + HOY + ' (' + n + ' impresiones)'].filter(Boolean).join(' | '),
    },
  };
});
