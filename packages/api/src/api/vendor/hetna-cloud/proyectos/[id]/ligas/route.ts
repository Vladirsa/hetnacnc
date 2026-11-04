// POST /vendor/hetna-cloud/proyectos/:id/ligas — liga para compartir el
// proyecto con el cliente o con el operador (por defecto: sólo archivos
// liberados, 7 días). La página pública es hetnacnc.com/mx/nube/<token>.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_LIGA, asegurarCloud, proyectoDe, tokenLiga, urlLiga } from "../../../../../../lib/cloud"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const p = await proyectoDe(knex, sellerId, String(req.params.id))
  if (!p) return res.status(404).json({ message: "Proyecto no encontrado." })
  const b = (req.body || {}) as Record<string, unknown>
  const dias = Math.min(90, Math.max(1, parseInt(String(b.dias ?? 7), 10) || 7))
  const activas = await knex(T_LIGA).where({ proyecto_id: p.id }).whereNull("revocada_en").where("vence", ">", knex.fn.now()).count({ n: "*" }).first()
  if (Number(activas?.n) >= 10) return res.status(400).json({ message: "Máximo 10 ligas activas por proyecto. Revoca alguna." })
  const token = tokenLiga()
  await knex(T_LIGA).insert({
    token,
    seller_id: sellerId,
    proyecto_id: p.id,
    solo_liberados: b.solo_liberados !== false,
    vence: new Date(Date.now() + dias * 86400_000),
  })
  return res.status(201).json({ token, url: urlLiga(token), dias })
}
