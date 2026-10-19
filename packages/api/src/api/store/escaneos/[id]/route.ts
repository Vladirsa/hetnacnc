import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ESCANEO_MODULE } from "../../../../modules/escaneo"
import EscaneoModuleService from "../../../../modules/escaneo/service"
import { getSignedDownloadUrl } from "../../../../lib/backblaze"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  const { id } = req.params
  const escaneoModuleService = req.scope.resolve<EscaneoModuleService>(ESCANEO_MODULE)

  // El filtro por customer_id es el aislamiento entre talleres: pedir el id de
  // un escaneo ajeno responde 404, no el escaneo.
  const [escaneo] = await escaneoModuleService.listEscaneo3ds({ id, customer_id: customerId })
  if (!escaneo) {
    return res.status(404).json({ message: "Escaneo no encontrado" })
  }

  // Los links se firman al momento de abrir la pantalla y no se guardan: lo
  // que persiste es la llave del archivo, así el escaneo se puede volver a
  // bajar dentro de un año aunque este link caduque en días.
  const descargas: Record<string, string> = {}
  for (const [nombre, llave] of [
    ["stl", escaneo.stl_storage_key],
    ["obj", escaneo.obj_storage_key],
  ] as const) {
    if (!llave) continue
    const firmado = await getSignedDownloadUrl(llave)
    if (firmado.ok) {
      descargas[nombre] = firmado.url
    } else {
      console.error(`[escaneos] no se pudo firmar ${nombre} de ${escaneo.id}:`, firmado.reason)
    }
  }

  res.json({ escaneo, descargas })
}
