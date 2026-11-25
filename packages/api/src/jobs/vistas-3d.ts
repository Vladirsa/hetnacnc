// Cada 2 horas: vista previa 3D automática de los diseños STL (o ZIP con STL)
// que no tienen (lib/vista-3d-auto.ts). Pocos por vuelta: bajar y simplificar
// un STL grande pesa. Si uno falla se marca para no reintentarlo cada vez.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { VERSION_VISTA, generarVista3D } from "../lib/vista-3d-auto"

const POR_VUELTA = 3

export default async function vistas3d(container: MedusaContainer) {
  if (process.env.VISTA3D_AUTO === "off") return
  const logger = container.resolve("logger")
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const filas = await knex("product")
      .whereNull("deleted_at")
      .whereRaw("metadata->>'producto_digital' = 'true'")
      .whereRaw("(metadata->>'archivo_storage_key') ~* '\\.(stl|zip)$'")
      // Sin vista previa, o con una automática de una versión vieja (la manual del vendedor no se toca)
      .whereRaw(
        "(coalesce(metadata->>'vista_previa', '') = '' or (metadata->>'vista3d_auto' = 'true' and coalesce(metadata->>'vista3d_v', '1') <> ?))",
        [String(VERSION_VISTA)]
      )
      .whereRaw("coalesce(metadata->>'vista3d_error', '') = ''")
      .select("id", "handle", "metadata")
      .limit(POR_VUELTA)
    const productos = container.resolve(Modules.PRODUCT) as any
    for (const f of filas) {
      const meta = typeof f.metadata === "string" ? JSON.parse(f.metadata) : f.metadata || {}
      try {
        const url = await generarVista3D(container, { handle: f.handle, llave: String(meta.archivo_storage_key) })
        await productos.updateProducts(f.id, { metadata: { ...meta, vista_previa: url, vista3d_auto: true, vista3d_v: String(VERSION_VISTA) } })
        // La muestra automática anterior se borra del almacenamiento (la v1 podía ser el modelo completo)
        const vieja = meta.vista3d_auto === true && typeof meta.vista_previa === "string" ? meta.vista_previa : ""
        if (vieja && vieja !== url) {
          const llave = decodeURIComponent(vieja.split("?")[0].split("/").pop() || "")
          if (llave.includes("vista3d-")) await (container.resolve(Modules.FILE) as any).deleteFiles(llave).catch(() => null)
        }
        logger.info(`[vistas-3d] lista: ${f.handle}`)
      } catch (e) {
        const motivo = (e as Error).message.slice(0, 200)
        await productos.updateProducts(f.id, { metadata: { ...meta, vista3d_error: motivo } }).catch(() => null)
        logger.warn(`[vistas-3d] ${f.handle}: ${motivo}`)
      }
    }
  } catch (e) {
    logger.warn(`[vistas-3d] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "vistas-3d",
  schedule: "37 */2 * * *",
}
