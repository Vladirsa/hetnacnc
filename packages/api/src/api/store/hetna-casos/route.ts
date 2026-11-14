// GET /store/hetna-casos — trabajos reales publicados (con permiso del cliente)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_CASO, asegurarCasos, casoPublico } from "../../../lib/casos-reales"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCasos(knex)
  const filas = await knex(T_CASO)
    .where({ publicado: true, permiso_cliente: true })
    .orderBy([{ column: "orden" }, { column: "created_at", order: "desc" }])
    .limit(12)
  res.json({ casos: filas.map(casoPublico) })
}
