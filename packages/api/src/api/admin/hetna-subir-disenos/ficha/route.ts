// POST /admin/hetna-subir-disenos/ficha { imagen_url?, nombre_archivo?, formatos?, nota?, sku? }
// -> ficha propuesta por la IA (título SEO, descripción, etiquetas, FAQ, precio, licencia)
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { proponerFicha } from "../../../../lib/subir-disenos"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, string>
  try {
    res.json(await proponerFicha(req.scope, b))
  } catch (e) {
    req.scope.resolve("logger").warn(`[subir-disenos] ficha: ${(e as Error).message}`)
    res.status(502).json({ message: "La IA no pudo escribir la ficha. Intenta de nuevo o llénala a mano." })
  }
}
