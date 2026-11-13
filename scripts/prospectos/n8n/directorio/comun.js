// ── Piezas comunes (se pegan al inicio de cada nodo Code del flujo del directorio) ──
const SITIO = 'https://www.hetnacnc.com';
const BAJA = 'https://n8n.hetnacnc.com/webhook/hetna-prospectos-baja';
const DOMICILIO = 'HETNA CNC · Col. Centro, Apizaco, Tlaxcala, México';
const NL = String.fromCharCode(10);
function slugDe(id) { return String(id || '').trim().toLowerCase().split('.').join('-'); }
function esc(s) {
  return String(s || '').split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&#39;');
}
function limpiar(s, max) {
  let t = String(s || '').trim();
  while (t.endsWith('.')) t = t.slice(0, -1);
  t = t.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}
function boton(url, texto) {
  return '<p style="margin:22px 0"><a href="' + url + '" style="background:#C2560A;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">' + texto + '</a></p>';
}
function envolver(asunto, cuerpo, urlBaja, motivo) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(asunto) + '</title></head>' +
    '<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:600px;margin:0 auto;padding:16px">' + cuerpo +
    '<p>Saludos,<br>Equipo HETNA CNC<br><a href="' + SITIO + '">hetnacnc.com</a> · WhatsApp +52 221 707 6014</p>' +
    '<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">' +
    '<p style="font-size:12px;color:#6b7280">' + motivo + ' Si no quieres aparecer en el directorio ni recibir más mensajes, <a href="' + urlBaja + '">quita tu perfil aquí</a> y lo retiramos. No compartimos ni vendemos tus datos.<br>' + DOMICILIO + '</p>' +
    '</body></html>';
}
function aTexto(html) {
  let t = String(html || '');
  const cuerpo = t.indexOf('<body');
  if (cuerpo >= 0) t = t.slice(cuerpo);
  // Cada enlace queda como "texto (dirección)"
  const partes = t.split('<a href="');
  t = partes[0] + partes.slice(1).map((p) => {
    const url = p.slice(0, p.indexOf('"'));
    return p.slice(p.indexOf('>') + 1).replace('</a>', ' (' + url + ')');
  }).join('');
  t = t.split('<br>').join(NL).split('</p>').join(NL + NL).split('</li>').join(NL);
  let out = '';
  let dentro = false;
  for (const c of t) {
    if (c === '<') dentro = true;
    else if (c === '>') dentro = false;
    else if (!dentro) out += c;
  }
  return out.split('&amp;').join('&').split('&lt;').join('<').split('&gt;').join('>').split('&quot;').join('"').split('&#39;').join("'").trim();
}
