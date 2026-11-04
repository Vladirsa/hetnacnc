// GET /vendor/hetna-cloud/archivos/:id/descarga — liga firmada de 1 hora.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../../../../lib/backblaze"
import { T_ARCHIVO, asegurarCloud, vigentes } from "../../../../../../lib/cloud"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const a = await vigentes(knex(T_ARCHIVO).where({ id: String(req.params.id), seller_id: sellerId })).first("clave", "nombre")
  if (!a) return res.status(404).json({ message: "Archivo no encontrado." })
  const r = await getSignedDownloadUrl(a.clave, 3600)
  if (!r.ok) return res.status(503).json({ message: "No se pudo generar la liga. Intenta en un momento." })
  return res.json({ url: r.url, nombre: a.nombre })
}
