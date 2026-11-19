// GET /store/recursos-academia
// Biblioteca de recursos publicada de la Academia: destacados primero, luego
// por orden y el más nuevo. Son pocos (cientos a lo más): van todos y la
// tienda filtra por categoría en el navegador.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CAMPOS_PUBLICOS, servicioRecursos } from "../../../lib/recursos-academia"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const recursos = await servicioRecursos(req.scope).listLearningResources(
    { publicado: true },
    { take: 500, order: { destacado: "DESC", orden: "ASC", created_at: "DESC" }, select: CAMPOS_PUBLICOS }
  )
  res.json({ recursos })
}
