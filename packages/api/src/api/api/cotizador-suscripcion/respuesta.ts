import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorSuscripcion } from "../../../lib/cotizador-suscripciones"

// Token de sesión de Supabase que manda la app: "Authorization: Bearer <jwt>"
export const tokenDe = (req: MedusaRequest) => {
  const h = String(req.headers.authorization || "")
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined
}

// Mismo formato para todos los errores: { error } con el mensaje para el taller.
export async function responder(req: MedusaRequest, res: MedusaResponse, fn: () => Promise<unknown>) {
  try {
    res.json(await fn())
  } catch (e) {
    if (e instanceof ErrorSuscripcion) {
      res.status(e.status).json({ error: e.message })
      return
    }
    const logger = req.scope.resolve("logger") as any
    logger.error(`[cotizador] suscripción: ${(e as Error).message}`)
    res.status(502).json({ error: "No pudimos hablar con Mercado Pago. Intenta de nuevo en un momento." })
  }
}
