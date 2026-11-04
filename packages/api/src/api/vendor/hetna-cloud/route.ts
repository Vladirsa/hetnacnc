// GET /vendor/hetna-cloud — la nube del taller: uso y cupo, clientes y proyectos.
// Antes de responder importa las licitaciones que el taller ganó.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_ARCHIVO, T_CLIENTE, T_PROYECTO, asegurarCloud, importarLicitaciones, usoCloud, vigentes } from "../../../lib/cloud"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)

  const importadas = await importarLicitaciones(knex, sellerId).catch((e: Error) => {
    logger.warn(`[cloud] no se importaron licitaciones de ${sellerId}: ${e.message}`)
    return 0
  })

  const [uso, clientes, proyectos, conteos] = await Promise.all([
    usoCloud(knex, sellerId, logger),
    knex(T_CLIENTE).where({ seller_id: sellerId }).orderBy("nombre").limit(500).select("*"),
    knex(T_PROYECTO).where({ seller_id: sellerId }).orderBy("updated_at", "desc").limit(500).select("*"),
    vigentes(knex(T_ARCHIVO).where({ seller_id: sellerId }))
      .groupBy("proyecto_id")
      .select("proyecto_id")
      .count({ n: "*" })
      .sum({ bytes: "tamano" }),
  ])
  const por = Object.fromEntries((conteos as any[]).map((c) => [c.proyecto_id, { archivos: Number(c.n), bytes: Number(c.bytes) || 0 }]))
  return res.json({
    uso,
    importadas,
    clientes,
    proyectos: (proyectos as any[]).map((p) => ({ ...p, archivos: por[p.id]?.archivos || 0, bytes: por[p.id]?.bytes || 0 })),
  })
}
