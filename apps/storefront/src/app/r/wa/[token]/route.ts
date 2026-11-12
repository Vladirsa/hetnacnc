// Mensajes que llegan al WhatsApp de HETNA (Evolution API → https://hetnacnc.com/r/wa/<token>).
// Evolution no manda encabezados propios, por eso el token interno va en la
// liga. Se saca lo necesario (número, texto, si es foto) y se pasa al backend,
// que contesta la verificación, BAJA/ALTA y las fotos del taller. Si no era
// nada de eso y está configurado N8N_WHATSAPP_WEBHOOK, se reenvía a n8n
// (respondedor de catálogo). Siempre responde 200 para que Evolution no reintente.
import { timingSafeEqual } from "crypto"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const limpio = (v: string) => String(v || "").trim().replace(/^["']|["']$/g, "")
const ok = () => Response.json({ ok: true })

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const esperado = limpio(process.env.N8N_REDES_TOKEN || "")
  if (!esperado || token.length !== esperado.length || !timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) {
    return Response.json({ message: "No autorizado." }, { status: 401 })
  }
  const crudo = await req.text()
  if (crudo.length > 15_000_000) return ok()
  let body: any = {}
  try {
    body = JSON.parse(crudo)
  } catch {
    return ok()
  }
  const data = body?.data || body
  const key = data?.key || {}
  // Rastro mínimo (sin texto ni números completos) para revisar con pm2 logs hetna-web
  console.log(`[wa] evento=${body?.event || "?"} propio=${!!key.fromMe} jid=${String(key.remoteJid || "").replace(/^\d+(?=\d{4}@)/, "…")} alt=${key.remoteJidAlt || key.senderPn ? "sí" : "no"}`)
  // WhatsApp ya manda muchos chats con un id anónimo (@lid) en vez del número;
  // en ese caso el número real viene aparte (remoteJidAlt / senderPn).
  const candidatos = [key.remoteJid, key.remoteJidAlt, key.senderPn, data?.senderPn, key.participantPn].map((x) => String(x || ""))
  const jid = candidatos.find((x) => x.endsWith("@s.whatsapp.net")) || ""
  // Sólo mensajes de personas (no grupos, no estados) y que no mandamos nosotros
  if (!jid || String(key.remoteJid || "").endsWith("@g.us")) return ok()
  // Lo mandó HETNA: sólo se avisa al backend (si fue una persona del equipo, el respondedor se calla)
  if (key.fromMe) {
    await fetch(`${MEDUSA_BACKEND_URL}/hooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": esperado },
      body: JSON.stringify({ desde_mi: true, numero: jid.replace("@s.whatsapp.net", "").replace(/\D/g, ""), mensaje_id: key.id || null }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null)
    return ok()
  }
  const msg = data?.message || {}
  const imagen = msg.imageMessage
  const texto = msg.conversation || msg.extendedTextMessage?.text || imagen?.caption || ""
  const mensaje = {
    numero: jid.replace("@s.whatsapp.net", "").replace(/\D/g, ""),
    texto: String(texto).slice(0, 2000),
    tipo: imagen ? "imagen" : "texto",
    mensaje_id: key.id || null,
    base64: imagen ? msg.base64 || data?.base64 || null : null,
  }
  let manejado = false
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/hooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": esperado },
      body: JSON.stringify(mensaje),
      signal: AbortSignal.timeout(60_000),
    })
    const res = await r.json().catch(() => ({}))
    manejado = !!res?.manejado
    console.log(`[wa] backend=${r.status} manejado=${manejado} accion=${res?.accion || "-"}`)
  } catch {
    // si el backend no contesta, se intenta con n8n
  }
  const n8n = process.env.N8N_WHATSAPP_WEBHOOK
  if (!manejado && n8n && /^https?:\/\//.test(n8n)) {
    await fetch(n8n, { method: "POST", headers: { "Content-Type": "application/json" }, body: crudo, signal: AbortSignal.timeout(20_000) }).catch(() => null)
  }
  return ok()
}
