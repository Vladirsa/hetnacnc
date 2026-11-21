// GET  /store/mi-empresa → { empresa } (null si no la ha guardado)
// POST /store/mi-empresa { razon_social, rfc, regimen?, uso_cfdi?, cp?, correo? }
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarEmpresa, leerEmpresa } from "../../../lib/cliente-empresa"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ empresa: await leerEmpresa(knex, id) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    res.json({ empresa: await guardarEmpresa(knex, id, req.body) })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
