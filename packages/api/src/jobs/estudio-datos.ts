// Cada mañana (9:47, centro de México): tendencias de YouTube (alarma si un
// video hace 10× la media de su canal) y retención de los videos del Estudio
// (le deja notas al guionista). Sólo si Google está conectado.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estadoGoogle, revisarRetencion, revisarTendencias } from "../lib/fabrica/estudio-datos"

export default async function estudioDatos(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    if (!(await estadoGoogle(knex)).conectado) return
    const t = await revisarTendencias(knex, logger)
    const r = await revisarRetencion(knex, logger)
    logger.info(`[estudio-datos] tendencias: ${t.revisados} videos, ${t.alarmas.length} alarmas · retención: ${r.notas.length} notas`)
  } catch (e) {
    logger.error(`[estudio-datos] ${(e as Error).message}`)
  }
}

export const config = { name: "estudio-datos", schedule: "47 15 * * *" }
