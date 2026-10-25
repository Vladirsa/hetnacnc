import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { sincronizarSuscripcionPaypal } from "../../../lib/cotizador-paypal"

// Aviso de PayPal para las suscripciones del Cotizador:
// https://hetnacnc.com/api/paypal-suscripcion
// (developer.paypal.com > Apps & Credentials > tu app > Webhooks, eventos
// BILLING.SUBSCRIPTION.* y PAYMENT.SALE.COMPLETED).
//
// No se confía en el cuerpo: se consulta la suscripción a PayPal con nuestras
// credenciales y sólo se acepta custom_id "cotizador:<taller>:<plan>".
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = (req.body || {}) as { event_type?: string; resource?: { id?: string; billing_agreement_id?: string } }
  const tipo = String(b.event_type || "")
  const id = tipo.startsWith("BILLING.SUBSCRIPTION.")
    ? String(b.resource?.id || "")
    : tipo.startsWith("PAYMENT.SALE.")
      ? String(b.resource?.billing_agreement_id || "")
      : ""

  res.status(200).json({ ok: true }) // PayPal sólo necesita un 200 rápido
  if (!id) return

  try {
    await sincronizarSuscripcionPaypal(id, logger)
  } catch (e) {
    logger.error(`[cotizador] error con el aviso de PayPal ${tipo} ${id}: ${(e as Error).message}`)
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
