// Trabajos reales del sitio (lib/casos-reales.ts).
//   GET  /admin/hetna-casos        todos
//   POST /admin/hetna-casos        crea uno
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { randomUUID } from "crypto"

import { T_CASO, asegurarCasos, leerCaso } from "../../../lib/casos-reales"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCasos(knex)
  res.json({ casos: await knex(T_CASO).orderBy([{ column: "orden" }, { column: "created_at", order: "desc" }]) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarCasos(knex)
  const r = leerCaso(req.body)
  if ("error" in r) return res.status(400).json({ message: r.error })
  const id = `caso_${randomUUID().replace(/-/g, "").slice(0, 20)}`
  await knex(T_CASO).insert({ id, ...r.datos })
  res.json({ caso: await knex(T_CASO).where({ id }).first() })
}
