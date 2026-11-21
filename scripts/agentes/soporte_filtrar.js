// Nodo Code "¿Es de soporte?" del agente de Soporte (Run Once for All Items).
// Entrada: filas de la hoja de prospectos. Correo: el del disparador IMAP.
// Deja pasar sólo correos de personas (clientes o talleres) que NO son
// prospectos de la campaña: fuera rebotes, respuestas automáticas, boletines,
// avisos de sistemas y lo que llegó hace más de 2 días (al encender el flujo
// no se contestan correos viejos). Máximo 2 respuestas automáticas por persona
// (las lleva la memoria del flujo). Sin barras invertidas ni backticks.
const m = $('Correo nuevo').first().json;
const NL = String.fromCharCode(10);
const deRaw = String(m.from || '');
const ab = deRaw.lastIndexOf('<');
const de = (ab >= 0 ? deRaw.slice(ab + 1, deRaw.indexOf('>', ab)) : deRaw).trim().toLowerCase();
const nombre = (ab > 0 ? deRaw.slice(0, ab) : '').replace(/"/g, '').trim();
const deDom = de.split('@')[1] || '';
const asunto = String(m.subject || '').trim();
const texto = String(m.textPlain || m.text || '').trim();
if (!de || !deDom || !texto) return [];

const fecha = m.date ? Date.parse(m.date) : Date.now();
if (Number.isFinite(fecha) && Date.now() - fecha > 2 * 86400000) return [];

const SISTEMAS = ['hetnacnc.com', 'facebookmail.com', 'google.com', 'accounts.google.com', 'linkedin.com', 'hostinger.com', 'github.com', 'stripe.com',
  'mercadopago.com', 'mercadolibre.com', 'paypal.com', 'resend.com', 'cloudflare.com', 'canva.com', 'n8n.io', 'medusajs.com', 'skydropx.com', 'fal.ai',
  'anthropic.com', 'openai.com', 'meta.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'microsoft.com', 'apple.com', 'amazon.com', 'sat.gob.mx'];
if (SISTEMAS.some((d) => deDom === d || deDom.endsWith('.' + d))) return [];
const usuario = de.split('@')[0];
if (/^(no-?reply|noreply|mailer-daemon|postmaster|bounce|notifications?|newsletter|news|alerts?|marketing|promo|info-?noreply|donotreply)/.test(usuario)) return [];

const CORTES = ['-----original', '________________', 'escribió:', 'wrote:', 'escreveu:', 'de: hetna', 'from: hetna', 'enviado desde'];
const nuevas = [];
for (const l of texto.split(NL)) {
  const t = l.trim().toLowerCase();
  if (t.startsWith('>') || CORTES.some((c) => t.includes(c))) break;
  nuevas.push(l);
}
const nuevo = nuevas.join(NL).trim() || texto;
const min = (asunto + ' ' + nuevo).toLowerCase();
const AUTOMATICA = ['auto-reply', 'autoreply', 'automatic reply', 'respuesta automática', 'respuesta automatica', 'fuera de la oficina', 'out of office',
  'unsubscribe', 'darse de baja', 'cancelar suscripción', 'cancelar suscripcion', 'ver en el navegador', 'view in browser', 'hemos recibido su solicitud', 'ticket #'];
if (AUTOMATICA.some((k) => min.includes(k))) return [];

// Los prospectos de la campaña los atiende el flujo «Respuestas del correo»
const LIBRES = ['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.com.mx', 'yahoo.com', 'yahoo.com.mx', 'icloud.com', 'msn.com', 'prodigy.net.mx', 'proton.me', 'protonmail.com'];
for (const i of $input.all()) {
  const r = i.json;
  const re = String(r.email || '').toLowerCase().trim();
  const rd = String(r.dominio || '').toLowerCase();
  if (re && (re === de || (!LIBRES.includes(deDom) && (re.split('@')[1] === deDom || rd === deDom)))) return [];
}

const memoria = $getWorkflowStaticData('global');
memoria.respondidos = memoria.respondidos || {};
return [{ json: { de, nombre, asunto, texto: nuevo.slice(0, 6000), anteriores: Number(memoria.respondidos[de] || 0) } }];
