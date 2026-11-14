// POST   /admin/hetna-casos/:id   actualiza un trabajo real
// DELETE /admin/hetna-casos/:id   lo borra
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_CASO, asegurarCasos, leerCaso } from "../../../../lib/casos-reales"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCasos(knex)
  const r = leerCaso(req.body)
  if ("error" in r) return res.status(400).json({ message: r.error })
  const n = await knex(T_CASO).where({ id: String(req.params.id) }).update({ ...r.datos, updated_at: knex.fn.now() })
  if (!n) return res.status(404).json({ message: "No existe ese trabajo." })
  res.json({ caso: await knex(T_CASO).where({ id: String(req.params.id) }).first() })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCasos(knex)
  await knex(T_CASO).where({ id: String(req.params.id) }).del()
  res.json({ ok: true })
}
