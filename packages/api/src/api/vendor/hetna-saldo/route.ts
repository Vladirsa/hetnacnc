// Panel del taller > Mi saldo: lo que HETNA le debe y lo que ya le pagó.
//   GET /vendor/hetna-saldo
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SALDO, diasLiberacion, filaParaRespuesta, resumenSaldos } from "../../../lib/saldos-talleres"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const resumen = await resumenSaldos(knex, sellerId)
  const filas = await knex(T_SALDO).where({ seller_id: sellerId }).orderBy("creado", "desc").limit(200)
  res.json({ resumen, dias_liberacion: diasLiberacion(), movimientos: filas.map(filaParaRespuesta) })
}
