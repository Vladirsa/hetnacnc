// Regreso de PayPal tras la verificación de tarjeta (?token=<orden>):
// cobra los $10, marca la tarjeta del taller y los devuelve. Luego manda al
// taller a su panel. lib/requisitos-vendedor.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { VENDOR_URL } from "../../../lib/licitacion"
import { confirmarOrdenPayPal } from "../../../lib/requisitos-vendedor"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const orden = String((req.query as any)?.token || "")
  try {
    return res.redirect(await confirmarOrdenPayPal(knex, orden, logger))
  } catch (e) {
    logger.error(`[requisitos] PayPal ${orden}: ${(e as Error).message}`)
    return res.redirect(`${VENDOR_URL}/requisitos?paypal=error`)
  }
}
