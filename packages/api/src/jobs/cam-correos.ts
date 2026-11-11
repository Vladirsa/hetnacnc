import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correosCamApagados, correrCorreosCam } from "../lib/cam-correos"

// Correos automáticos del CAM Studio para cuentas en plan Gratis: "te falta
// el plan X para bajar lo que armaste", "se acabaron tus 5 programas", "tu
// proyecto quedó guardado" y "¿cómo te fue con tu primer programa?".
// Las reglas están en lib/cam-correos.ts. CAM_CORREOS=off los apaga.
export default async function camCorreos(container: MedusaContainer) {
  if (correosCamApagados() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const r = await correrCorreosCam(container, knex, logger)
    const total = r.cam_bloqueo + r.cam_limite + r.cam_proyecto + r.cam_primera
    if (total || r.omitidos)
      logger.info(
        `[cam-correos] enviados ${total} (plan insuficiente ${r.cam_bloqueo}, límite ${r.cam_limite}, primer proyecto ${r.cam_proyecto}, primer programa ${r.cam_primera}); omitidos por frecuencia ${r.omitidos}`
      )
  } catch (e) {
    logger.error(`[cam-correos] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cam-correos",
  // 10:57 en Ciudad de México, después del marketing de la tienda (10:37) y
  // de los correos del Cotizador (10:47): comparten el tope diario de envíos.
  schedule: "57 16 * * *",
}
