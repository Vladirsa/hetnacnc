// GET /vendor/hetna-requisitos — qué le falta al taller para publicar y
// cotizar (términos vigentes y tarjeta verificada). lib/requisitos-vendedor.ts
// Con ?mp_pago=<id> (regreso de Mercado Pago) revisa ese pago antes de responder.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MONTO_VERIFICACION, confirmarPagoMP, estadoRequisitos } from "../../../lib/requisitos-vendedor"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  let aviso: string | null = null
  const pago = String((req.query as any)?.mp_pago || "")
  if (/^\d{5,24}$/.test(pago)) {
    const r = await confirmarPagoMP(knex, pago, logger).catch((e: Error) => {
      logger.warn(`[requisitos] no se pudo revisar el pago ${pago}: ${e.message}`)
      return null
    })
    // Sólo cuenta si el pago es de este taller
    if (r && r.sellerId === sellerId && !r.ok && r.motivo) aviso = r.motivo
  }
  const seller = await knex("seller").where({ id: sellerId }).first("id", "email", "name", "metadata")
  res.setHeader("Cache-Control", "no-store")
  return res.json({ ...estadoRequisitos(seller), monto_verificacion: MONTO_VERIFICACION, aviso })
}
