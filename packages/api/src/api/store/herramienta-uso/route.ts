import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contarUso, usoValido } from "../../../lib/herramienta-uso"

// POST /store/herramienta-uso { herramienta, evento }: uso de las herramientas
// del Estudio para el tablero semanal (lib/herramienta-uso.ts). Nunca falla
// hacia afuera: una estadística perdida no es problema del cliente.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  if (!usoValido(b.herramienta, b.evento)) return res.json({ ok: false })
  try {
    await contarUso(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), b.herramienta as string, b.evento)
  } catch (e) {
    req.scope.resolve("logger").warn(`[herramienta-uso] ${(e as Error).message}`)
  }
  res.json({ ok: true })
}
