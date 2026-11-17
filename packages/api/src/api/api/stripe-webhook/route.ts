import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sincronizarSesionStripe, sincronizarSuscripcionStripe } from "../../../lib/cotizador-stripe"
import { avisoStripeLicitacion } from "../../../lib/licitacion-cobro"

// Aviso de Stripe: https://hetnacnc.com/api/stripe-webhook
// (Stripe > Desarrolladores > Webhooks > Agregar destino; eventos checkout.session.completed,
// checkout.session.async_payment_succeeded/failed, checkout.session.expired,
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
    if (tipo.startsWith("checkout.session.") && typeof o.id === "string") {
      // Pagos únicos (licitaciones): tarjeta al momento; OXXO/SPEI cuando el cliente paga
      if (o.mode === "payment") {
        const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
        await avisoStripeLicitacion(knex, o.id, logger)
      } else if (tipo === "checkout.session.completed") await sincronizarSesionStripe(o.id, logger)
    }
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
