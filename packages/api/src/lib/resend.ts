// Envío de correo vía la API REST de Resend (sin SDK adicional). Si no hay
// API key configurada, no hace nada y lo reporta por el logger del llamador
// en vez de lanzar: el marketing por email es opcional, nunca debe tumbar un
// flujo de negocio (registro, checkout, jobs).
const RESEND_API_URL = "https://api.resend.com/emails"

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  // Solo correos promocionales: liga para darse de baja (lib/baja.ts). Se agrega
  // al pie del correo y como encabezado List-Unsubscribe.
  bajaUrl?: string
  // Archivos adjuntos (p. ej. el comprobante PDF de una compra digital)
  adjuntos?: { nombre: string; contenido: Uint8Array | Buffer }[]
}

export type SendEmailResult = {
  sent: boolean
  reason?: string
  // true cuando el problema es de configuración y NO se va a arreglar solo:
  // credenciales rechazadas, remitente no autorizado. Lo distingue de un fallo
  // pasajero para que quien llama no reintente en vano.
  configuracion?: boolean
}

// Uso que Resend reporta en cada envío (encabezados x-resend-*-quota). Lo lee
// el agente de recargas (lib/vigilancia.ts) cuando la llave es "solo envío" y
// no puede consultar GET /usage.
let ultimaCuota: { mes: number | null; dia: number | null; cuando: string } | null = null
function anotarCuota(h: Headers) {
  const n = (k: string) => {
    const v = h.get(k)
    return v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null
  }
  const mes = n("x-resend-monthly-quota")
  const dia = n("x-resend-daily-quota")
  if (mes !== null || dia !== null) ultimaCuota = { mes, dia, cuando: new Date().toISOString() }
}
export const cuotaResend = () => ultimaCuota

export async function sendEmail({
  to,
  subject,
  html,
  bajaUrl,
  adjuntos,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    return { sent: false, reason: "RESEND_API_KEY o RESEND_FROM_EMAIL no configurados" }
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: bajaUrl
        ? html +
          `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888;text-align:center;margin:12px 0 0;">` +
          `¿No quieres recibir estos correos? <a href="${bajaUrl}" style="color:#888;">Darte de baja</a>.</p>`
        : html,
      ...(adjuntos?.length
        ? { attachments: adjuntos.map((a) => ({ filename: a.nombre, content: Buffer.from(a.contenido).toString("base64") })) }
        : {}),
      ...(bajaUrl
        ? { headers: { "List-Unsubscribe": `<${bajaUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
    }),
  })

  anotarCuota(res.headers)

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    const reason = `Resend respondió ${res.status}: ${body}`

    // 401 y 403 son credenciales rechazadas o remitente no autorizado. Eso no
    // se arregla reintentando y no se arregla solo: hasta que alguien cambie la
    // clave, NINGÚN correo de la plataforma va a salir.
    //
    // Se grita en el log a propósito. Que el correo falle en silencio es lo
    // correcto -- nunca debe tumbar un registro ni un checkout -- pero el
    // silencio escondió una clave inválida durante semanas: bienvenida y
    // carrito abandonado fallaban en cada intento y nadie se enteró. Un fallo
    // de configuración tiene que verse; uno pasajero, no.
    if (res.status === 401 || res.status === 403) {
      console.error(
        `[resend] CONFIGURACIÓN INVÁLIDA: ${reason}\n` +
          `[resend] Mientras no se corrija, NINGÚN correo sale: bienvenida, ` +
          `carrito abandonado, reseñas ni resumen diario. ` +
          `Revisa RESEND_API_KEY y RESEND_FROM_EMAIL en .env.production y reinicia el API.`
      )
      return { sent: false, reason, configuracion: true }
    }

    return { sent: false, reason }
  }

  return { sent: true }
}
