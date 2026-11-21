// GET    /admin/escanear/:id/archivos/:archivo — liga firmada (15 min)
// DELETE /admin/escanear/:id/archivos/:archivo — lo quita de la solicitud (el archivo se oculta en el bucket)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl, hideFile } from "../../../../../../lib/backblaze"
import { cargar, guardar } from "../../../../../../lib/escanear"

const knexDe = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const s = await cargar(knexDe(req), String(req.params.id))
  const a = s?.archivos.find((x) => x.id === req.params.archivo)
  if (!a) return res.status(404).json({ message: "No encontrado." })
  const r = await getSignedDownloadUrl(a.clave, 900)
  if (!r.ok) return res.status(502).json({ message: "No se pudo preparar la descarga." })
  res.json({ url: r.url, nombre: a.nombre })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = knexDe(req)
  const s = await cargar(knex, String(req.params.id))
  const a = s?.archivos.find((x) => x.id === req.params.archivo)
  if (!s || !a) return res.status(404).json({ message: "No encontrado." })
  await hideFile(a.clave).catch(() => null)
  const n = await guardar(knex, s.id, { archivos: s.archivos.filter((x) => x.id !== a.id) })
  res.json({ ok: true, solicitud: n })
}
