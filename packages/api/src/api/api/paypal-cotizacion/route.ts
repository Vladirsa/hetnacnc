import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { unaVezALaVez } from "../../../lib/aviso-unico"
import { reversoPaypal } from "../../../lib/cotizacion-liga"
import { paypal, paypalListo } from "../../../lib/paypal-api"

// Aviso (webhook) de PayPal para reembolsos y contracargos de anticipos del
// Cotizador: https://hetnacnc.com/api/paypal-cotizacion
// Antes no había: con PayPal nunca se veía un reembolso, y el taller seguía
// viendo "Anticipo recibido" (auditoría Thermos, 15 nov 2026).
//
// Para activarlo (una vez), en developer.paypal.com › tu app › Webhooks:
//   URL: https://hetnacnc.com/api/paypal-cotizacion
//   Eventos: PAYMENT.CAPTURE.REFUNDED y PAYMENT.CAPTURE.REVERSED
// y poner el "Webhook ID" en packages/api/.env como PAYPAL_WEBHOOK_ID_COTIZACION.
//
// No se confía en el cuerpo: PayPal confirma la firma del aviso y el estado de
// la captura se vuelve a consultar.
const EVENTOS = ["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"]

/** Id de la captura: en un reembolso viene en la liga "up" (/v2/payments/captures/<id>). */
export function capturaDe(recurso: any): string | null {
  const up = (recurso?.links || []).find((l: any) => l?.rel === "up" && /\/captures\//.test(String(l.href || "")))
  const id = up ? String(up.href).split("/captures/")[1]?.split(/[/?]/)[0] : recurso?.id
  return /^[A-Z0-9]{10,30}$/i.test(String(id || "")) ? String(id) : null
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const evento = (req.body || {}) as any
  const webhookId = process.env.PAYPAL_WEBHOOK_ID_COTIZACION || ""
  if (!webhookId || !paypalListo()) {
    logger.warn("[cotizador] aviso de PayPal sin PAYPAL_WEBHOOK_ID_COTIZACION: no se puede verificar")
    return res.status(503).json({ ok: false })
  }
  if (!EVENTOS.includes(String(evento.event_type || ""))) return res.status(200).json({ ok: true })

  try {
    const h = (n: string) => String(req.get(n) || "")
    const verif = await paypal<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: evento,
      }),
    })
    if (verif.verification_status !== "SUCCESS") {
      logger.warn(`[cotizador] aviso de PayPal con firma no válida (${evento.id || "sin id"})`)
      return res.status(400).json({ ok: false })
    }

    const capturaId = capturaDe(evento.resource)
    if (!capturaId) return res.status(200).json({ ok: true })
    // Estado actual de la captura (si PayPal no la deja leer, el del evento)
    const captura = await paypal<any>(`/v2/payments/captures/${capturaId}`).catch(() => null)
    const estado = String(captura?.status || (evento.event_type === "PAYMENT.CAPTURE.REVERSED" ? "REVERSED" : "REFUNDED"))
    await unaVezALaVez(`pp:${capturaId}`, () => reversoPaypal(capturaId, estado, logger))
    res.status(200).json({ ok: true })
  } catch (e) {
    // 500: PayPal reintenta el aviso
    logger.error(`[cotizador] aviso de PayPal ${evento.id || ""}: ${(e as Error).message}`)
    res.status(500).json({ ok: false })
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
