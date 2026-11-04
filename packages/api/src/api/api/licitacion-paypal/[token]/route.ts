import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { capturarPaypalLicitacion } from "../../../../lib/licitacion-cobro"
import { ligaPropuestas } from "../../../../lib/licitacion"

// Regreso de PayPal del pago de una licitación (directo a la cuenta del taller):
// GET https://hetnacnc.com/api/licitacion-paypal/<token>?token=<orden>
// Cobra la orden, la anota y regresa al cliente a su liga.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  const orden = String((req.query as any)?.token || "")
  if (token.length < 32) return res.redirect(302, "https://hetnacnc.com/mx/cotizar")
  try {
    const destino = await capturarPaypalLicitacion(knex, token, orden, logger)
    return res.redirect(302, destino)
  } catch (e) {
    logger.error(`[licitacion] PayPal ${orden}: ${(e as Error).message}`)
    return res.redirect(302, `${ligaPropuestas(token)}?pago=error`)
  }
}
