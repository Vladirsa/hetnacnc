import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrCorreosDiseno, disenosCorreosApagados } from "../lib/disenos-correos"

// Seguimiento automático de las herramientas de diseño: diseño guardado que no
// se ha bajado, créditos de regalo sin usar y créditos por acabarse. Las reglas
// están en lib/disenos-correos.ts. DISENOS_CORREOS=off lo apaga.
export default async function disenosCorreos(container: MedusaContainer) {
  if (disenosCorreosApagados() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const r = await correrCorreosDiseno(knex, logger)
    const total = r.diseno_espera + r.regalo_sin_usar + r.creditos_bajos
    if (total || r.omitidos) logger.info(`[disenos-correos] enviados ${total} (diseño espera ${r.diseno_espera}, regalo sin usar ${r.regalo_sin_usar}, créditos bajos ${r.creditos_bajos}); omitidos por frecuencia ${r.omitidos}`)
  } catch (e) {
    logger.error(`[disenos-correos] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "disenos-correos",
  // 10:42 en Ciudad de México: entre el marketing de la tienda (10:37) y el del cotizador (10:47)
  schedule: "42 16 * * *",
}
