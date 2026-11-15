import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { sincronizarSesionStripe, sincronizarSuscripcionStripe } from "../../../lib/cotizador-stripe"

// Aviso de Stripe: https://hetnacnc.com/api/stripe-webhook
// (Stripe > Desarrolladores > Webhooks > Agregar destino; eventos checkout.session.completed,
// customer.subscription.created/updated/deleted e invoice.paid).
//
// No se confía en el cuerpo: sólo se toma el id del objeto y se vuelve a consultar a
// Stripe con nuestra llave; sólo cuenta lo que trae la referencia "cotizador:<taller>:<plan>".
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const b = (req.body || {}) as { type?: string; data?: { object?: any } }
  const tipo = String(b.type || "")
  const o = b.data?.object || {}
  res.status(200).json({ received: true }) // Stripe sólo necesita un 200 rápido
  try {
    if (tipo === "checkout.session.completed" && typeof o.id === "string") await sincronizarSesionStripe(o.id, logger)
    else if (tipo.startsWith("customer.subscription.") && typeof o.id === "string") await sincronizarSuscripcionStripe(o.id, logger)
    else if (tipo.startsWith("invoice.")) {
      const sub = o.subscription || o.parent?.subscription_details?.subscription
      if (typeof sub === "string") await sincronizarSuscripcionStripe(sub, logger)
    }
  } catch (e) {
    logger.error(`[stripe] error con el aviso ${tipo}: ${(e as Error).message}`)
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
