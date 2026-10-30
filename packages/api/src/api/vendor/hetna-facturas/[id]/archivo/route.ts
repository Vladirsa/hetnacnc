// Liga firmada (10 min) al PDF o XML que subió el taller.
//   GET /vendor/hetna-facturas/:id/archivo?tipo=pdf|xml -> { url }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../../../lib/backblaze"
import { T_FACTURA, asegurarTablaFacturas } from "../../../../../lib/facturas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const tipo = String((req.query as any)?.tipo || "") === "xml" ? "xml_clave" : "pdf_clave"
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaFacturas(knex)
  const f = await knex(T_FACTURA).where({ id: String(req.params.id), seller_id: sellerId }).first()
  if (!f?.[tipo]) return res.status(404).json({ message: "No hay archivo." })
  const s = await getSignedDownloadUrl(f[tipo], 600)
  return s.ok ? res.json({ url: s.url }) : res.status(503).json({ message: "No se pudo abrir el archivo." })
}
