// Panel del taller > Guías: pedidos con Envíos HETNA y el estado de su guía.
//   GET /vendor/hetna-guias
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { bloqueoDelTaller, guiasListas, listarParaPanel } from "../../../lib/guias"
import { sobrepesoPublico, sobrepesosDe } from "../../../lib/sobrepesos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  if (!guiasListas()) return res.json({ activo: false, pedidos: [] })
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const [pedidos, bloqueo, sobrepesos] = await Promise.all([
      listarParaPanel(req.scope, sellerId),
      bloqueoDelTaller(req.scope, sellerId),
      sobrepesosDe(knex, "taller", sellerId),
    ])
    res.json({ activo: true, pedidos, bloqueo, sobrepesos: sobrepesos.map(sobrepesoPublico) })
  } catch (e) {
    req.scope.resolve("logger").error(`[guias] lista del taller ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron leer tus pedidos." })
  }
}
