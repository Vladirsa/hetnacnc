import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../../../../../lib/backblaze"
import { T_FACTURA, asegurarTablaFacturas } from "../../../../../../../lib/facturas"

// Liga firmada (10 min) al PDF o XML de una factura del propio cliente.
//   GET /store/customers/me/facturas/:id/archivo?tipo=pdf|xml -> { url }
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = (req as any).auth_context?.actor_id as string | undefined
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const tipo = String((req.query as any)?.tipo || "") === "xml" ? "xml" : "pdf"
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarTablaFacturas(knex)
  const f = await knex(T_FACTURA).where({ id: String(req.params.id), customer_id: id }).first()
  const clave = f?.[tipo === "pdf" ? "pdf_clave" : "xml_clave"]
  if (!f || f.estado !== "emitida" || !clave) return res.status(404).json({ message: "Esa factura todavía no está disponible." })
  const s = await getSignedDownloadUrl(clave, 600)
  if (!s.ok) return res.status(503).json({ message: "No pudimos abrir el archivo. Intenta de nuevo." })
  return res.json({ url: s.url })
}
