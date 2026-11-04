// GET /store/hetna-muestras-3d
// Vitrina de "Imagen a 3D": la foto original y la vista del modelo que generó
// la IA, de los modelos que HETNA hizo con su propia cuenta (cuentas de la
// casa). Nunca los de un cliente. Para que uno no salga, ponle un título que
// empiece con "privado".
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getSignedDownloadUrl } from "../../../lib/backblaze"
import { idsDeLaCasa } from "../../../lib/cuentas-casa"
import { ESCANEO_MODULE } from "../../../modules/escaneo"
import type EscaneoModuleService from "../../../modules/escaneo/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const ids = [...(await idsDeLaCasa(req.scope))]
    if (!ids.length) return res.json({ muestras: [] })
    const servicio = req.scope.resolve<EscaneoModuleService>(ESCANEO_MODULE)
    const filas = await servicio.listEscaneo3ds(
      { customer_id: ids, modo: "preview", estatus: "listo" } as any,
      { order: { created_at: "DESC" }, take: 24 }
    )
    const muestras: { id: string; titulo: string; foto: string; modelo: string }[] = []
    for (const e of filas as any[]) {
      if (muestras.length >= 6) break
      if (/^privado/i.test(String(e.titulo || ""))) continue
      const llaveFoto = Array.isArray(e.fotos) ? e.fotos[0] : null
      if (!llaveFoto || !e.imagen_storage_key) continue
      const [foto, modelo] = await Promise.all([
        getSignedDownloadUrl(llaveFoto, 3600 * 6),
        getSignedDownloadUrl(e.imagen_storage_key, 3600 * 6),
      ])
      if (foto.ok && modelo.ok) muestras.push({ id: e.id, titulo: e.titulo || "Modelo con IA", foto: foto.url, modelo: modelo.url })
    }
    res.setHeader("Cache-Control", "public, max-age=900")
    res.json({ muestras })
  } catch (e) {
    req.scope.resolve("logger").error(`[muestras-3d] ${(e as Error).message}`)
    res.json({ muestras: [] })
  }
}
