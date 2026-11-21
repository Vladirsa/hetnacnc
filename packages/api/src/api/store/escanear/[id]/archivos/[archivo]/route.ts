// GET /store/escanear/:id/archivos/:archivo — liga firmada (15 min) de un archivo de la solicitud del cliente
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getSignedDownloadUrl } from "../../../../../../lib/backblaze"
import { cargar } from "../../../../../../lib/escanear"
import { knexDe } from "../../../helpers"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const s = await cargar(knexDe(req), String(req.params.id))
  if (!s || s.customer_id !== req.auth_context.actor_id) return res.status(404).json({ message: "No encontrado." })
  const a = s.archivos.find((x) => x.id === req.params.archivo)
  if (!a) return res.status(404).json({ message: "No encontrado." })
  const r = await getSignedDownloadUrl(a.clave, 900)
  if (!r.ok) return res.status(502).json({ message: "No se pudo preparar la descarga." })
  res.json({ url: r.url, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano })
}
