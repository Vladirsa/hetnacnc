// GET /store/expedientes/:clave — expediente digital de un proyecto
// (lib/expediente.ts). La clave es el token de la solicitud (cliente) o la liga
// firmada de 1 hora del taller elegido.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { armarExpediente, solicitudDeClave } from "../../../../lib/expediente"
import { asegurarSeguimiento } from "../../../../lib/seguimiento"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSeguimiento(knex)
  const r = await solicitudDeClave(knex, String(req.params.clave || ""))
  if (!r) return res.status(404).json({ message: "Este expediente no existe o la liga venció." })
  res.setHeader("Cache-Control", "no-store")
  return res.json(await armarExpediente(knex, r.s, r.visor))
}
