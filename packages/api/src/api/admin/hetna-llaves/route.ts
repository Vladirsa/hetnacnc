// GET  /admin/hetna-llaves — qué funciones del servidor usa cada clave API
//      (n8n, bot de WhatsApp) y si está en modo "cerrar".
// POST /admin/hetna-llaves — permitir o quitar una función a una llave.
// Ver lib/llaves-uso.ts.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { cambiarPermiso, modoCerrar, usoDeLlaves } from "../../../lib/llaves-uso"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ modo: modoCerrar() ? "cerrar" : "observar", llaves: await usoDeLlaves(knex) })
}

const Cuerpo = z.object({
  llave: z.string().min(1).max(200),
  metodo: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  ruta: z.string().min(1).max(200),
  permitida: z.boolean(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ message: "Datos inválidos." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const n = await cambiarPermiso(knex, d.data)
  if (!n) return res.status(404).json({ message: "No encontré esa función para esa llave." })
  res.json({ ok: true })
}
