// GET/POST /admin/hetna-ajustes/:clave — ajustes del sitio (lib/ajustes-sitio.ts)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CLAVES, T_AJUSTE, asegurarAjustes, leerEjemplo } from "../../../../lib/ajustes-sitio"

const valida = (c: string) => (CLAVES as readonly string[]).includes(c)

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const clave = String(req.params.clave)
  if (!valida(clave)) return res.status(404).json({ message: "No existe ese ajuste." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarAjustes(knex)
  const f = await knex(T_AJUSTE).where({ clave }).first()
  res.json({ valor: f?.valor ?? null })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const clave = String(req.params.clave)
  if (!valida(clave)) return res.status(404).json({ message: "No existe ese ajuste." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarAjustes(knex)
  const r = leerEjemplo(req.body)
  if ("error" in r) return res.status(400).json({ message: r.error })
  if (r.valor === null) await knex(T_AJUSTE).where({ clave }).del()
  else
    await knex(T_AJUSTE)
      .insert({ clave, valor: JSON.stringify(r.valor), updated_at: knex.fn.now() })
      .onConflict("clave")
      .merge()
  res.json({ valor: r.valor })
}
