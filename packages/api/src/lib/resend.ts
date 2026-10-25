// Envío de correo vía la API REST de Resend (sin SDK adicional). Si no hay
// API key configurada, no hace nada y lo reporta por el logger del llamador
// en vez de lanzar: el marketing por email es opcional, nunca debe tumbar un
// flujo de negocio (registro, checkout, jobs).
const RESEND_API_URL = "https://api.resend.com/emails"

export type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export type SendEmailResult = {
  sent: boolean
  reason?: string
  // true cuando el problema es de configuración y NO se va a arreglar solo:
  // credenciales rechazadas, remitente no autorizado. Lo distingue de un fallo
  // pasajero para que quien llama no reintente en vano.
  configuracion?: boolean
}

export async function sendEmail({
  to,
  subject,
  html,
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
    body: JSON.stringify({ from, to, subject, html }),
  })

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
