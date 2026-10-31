/**
 * Pone la foto a los 5 servicios del Laboratorio CAM que se crearon sin ella
 * (seed-cam-services.ts no la ponía antes del 31 de octubre). Sin foto, el
 * catálogo los dejaba fuera por "sin imagen" y en la tienda salían en blanco.
 *
 * Corre una sola vez, sola, en el `medusa db:migrate` del despliegue (Medusa
 * anota los scripts ya corridos en script_migrations). Sólo toca los que no
 * tienen foto: si ya le pusiste una desde el panel, la respeta.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { CAM_PRODUCT_HANDLES, camImageUrl } from "../modules/cam/catalog"

type Clave = keyof typeof CAM_PRODUCT_HANDLES

export default async function imagenesServiciosCam({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const porHandle = new Map(Object.entries(CAM_PRODUCT_HANDLES).map(([k, h]) => [h, k as Clave]))
  const { data: productos } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "thumbnail"],
    filters: { handle: [...porHandle.keys()] },
  })

  const sinFoto = (productos as { id: string; handle: string; thumbnail?: string | null }[]).filter((p) => !p.thumbnail)
  if (!sinFoto.length) {
    logger.info("[imagenes-servicios-cam] Los servicios CAM ya tienen foto (o no existen aquí).")
    return
  }

  // Una foto que no se pudo poner no debe tumbar el despliegue: se avisa y
  // se pone a mano desde el panel (Productos > el servicio > Medios).
  try {
    await updateProductsWorkflow(container).run({
      input: {
        products: sinFoto.map((p) => {
          const url = camImageUrl(porHandle.get(p.handle)!)
          return { id: p.id, thumbnail: url, images: [{ url }] }
        }),
      },
    })
    logger.info(`[imagenes-servicios-cam] Foto puesta a: ${sinFoto.map((p) => p.handle).join(", ")}`)
  } catch (e) {
    logger.warn(`[imagenes-servicios-cam] No se pudo poner la foto: ${e instanceof Error ? e.message : e}`)
  }
}
