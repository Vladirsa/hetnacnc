import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorSuscripcion } from "../../../lib/cotizador-suscripciones"

// Igual que cotizador-suscripcion/respuesta, con un mensaje genérico (no de Mercado Pago)
// para los errores inesperados. Lo usan posventa y "te cargamos tu catálogo".
export async function responderTaller(req: MedusaRequest, res: MedusaResponse, etiqueta: string, fn: () => Promise<unknown>) {
  try {
    res.json(await fn())
  } catch (e) {
    if (e instanceof ErrorSuscripcion) {
      res.status(e.status).json({ error: e.message })
      return
    }
    const logger = req.scope.resolve("logger") as any
    logger.error(`[cotizador] ${etiqueta}: ${(e as Error).message}`)
    res.status(502).json({ error: "No se pudo completar. Intenta de nuevo en un momento." })
  }
}
