// POST /hooks/social-hub/aviso { tipo: "foro", id, titulo, resumen, url }  (con x-hetna-token)
// Contenido nuevo que nace en la tienda (temas del foro) -> publicación automática.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { publicacionAutomatica } from "../../../../lib/social-hub"
import { tokenValido } from "../../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b: any = req.body || {}
  const url = String(b.url || "")
  if (b.tipo !== "foro" || !b.titulo || !/^https:\/\/hetnacnc\.com\//.test(url)) return res.status(400).json({ message: "Aviso no válido." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const id = await publicacionAutomatica(
    knex,
    { origen: "foro", origen_id: String(b.id || url).slice(0, 200), titulo: String(b.titulo).slice(0, 160), resumen: String(b.resumen || "").slice(0, 220), url },
    req.scope.resolve("logger")
  )
  res.json({ ok: true, id })
}
