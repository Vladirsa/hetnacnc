import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../../../../../lib/backblaze"
import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, recibePropuestas, type Trabajo } from "../../../../../lib/licitacion"

// GET /vendor/hetna-solicitudes/:id/archivos
//
// Ligas firmadas (1 hora) a los archivos que subió el cliente. Las pide el
// taller desde su panel, sólo para solicitudes que puede cotizar o que ya
// cotizó: igual que la lista de solicitudes, nunca una ajena.
const DURACION_S = 60 * 60

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })

  const esSuya = s.modo === "abierta" || s.taller_id === sellerId
  const yaCotizo = await knex(T_PROPUESTA).where({ solicitud_id: s.id, seller_id: sellerId }).first("id")
  if (!esSuya || (!recibePropuestas(s) && !yaCotizo)) {
    return res.status(403).json({ message: "Esta solicitud ya no está disponible." })
  }

  const archivos = ((s.trabajo as Trabajo)?.archivos || [])
  const ligas: { nombre: string; tamano: number; url: string | null }[] = []
  for (const a of archivos) {
    const r = await getSignedDownloadUrl(a.clave, DURACION_S)
    ligas.push({ nombre: a.nombre, tamano: a.tamano, url: r.ok ? r.url : null })
  }
  return res.json({ archivos: ligas })
}
