// GET /store/hetna-ajustes/:clave — ajuste público del sitio (lib/ajustes-sitio.ts)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CLAVES, T_AJUSTE, asegurarAjustes } from "../../../../lib/ajustes-sitio"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const clave = String(req.params.clave)
  if (!(CLAVES as readonly string[]).includes(clave)) return res.status(404).json({ message: "No existe." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarAjustes(knex)
  const f = await knex(T_AJUSTE).where({ clave }).first()
  res.json({ valor: f?.valor ?? null })
}
