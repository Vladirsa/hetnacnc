import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrMarketing, marketingApagado } from "../lib/marketing-correos"

// Marketing automático por correo (recompra, primeros pasos, reactivación y
// novedades de la semana). Las reglas y los topes están en lib/marketing-correos.
// Para ver a quién le tocaría sin mandar nada: src/scripts/probar-marketing.ts
export default async function marketingAutomatico(container: MedusaContainer) {
  if (marketingApagado() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const r = await correrMarketing(knex, logger)
    const total = r.recompra + r.primeros_pasos + r.reactivacion + r.novedades
    if (total || r.omitidos)
      logger.info(
        `[marketing] enviados ${total} (recompra ${r.recompra}, primeros pasos ${r.primeros_pasos}, reactivación ${r.reactivacion}, novedades ${r.novedades}); omitidos por frecuencia ${r.omitidos}`
      )
  } catch (e) {
    logger.error(`[marketing] falló la corrida: ${e}`)
  }
}

export const config = {
  name: "marketing-automatico",
  // 10:37 en Ciudad de México: después del resumen diario y del correo de
  // reseñas, en horario en que la gente revisa el correo.
  schedule: "37 16 * * *",
}
