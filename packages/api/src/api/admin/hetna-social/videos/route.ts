// GET /admin/hetna-social/videos?estado=pendiente -> videos que suben los talleres (con autorización).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { videosParaRevisar } from "../../../../lib/promocion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const estado = ["pendiente", "aprobado", "rechazado", "retirado"].includes(String((req.query as any)?.estado)) ? String((req.query as any).estado) : "pendiente"
  const filas = await videosParaRevisar(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), estado)
  res.json({
    videos: filas.map((x: any) => ({
      id: x.id, url: x.url, taller: x.taller, handle: x.handle, descripcion: x.descripcion, estado: x.estado, motivo: x.motivo,
      tamano: x.tamano, autorizo_en: x.autorizo_en, autorizo_version: x.autorizo_version, post_id: x.post_id, fecha: x.created_at,
    })),
  })
}
