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

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<{
  sent: boolean
  reason?: string
}> {
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
    return { sent: false, reason: `Resend respondió ${res.status}: ${body}` }
  }

  return { sent: true }
}
