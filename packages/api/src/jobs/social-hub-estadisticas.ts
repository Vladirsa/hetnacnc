// Cada 6 horas: lee de Facebook e Instagram las estadísticas de lo publicado
// (alcance, me gusta, comentarios, compartidos, guardados y vistas).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { actualizarEstadisticas } from "../lib/social-estadisticas"

export default async function socialHubEstadisticas(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const r = await actualizarEstadisticas(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
    if (r.leidas) logger.info(`[social] estadísticas leídas: ${r.leidas}`)
  } catch (e) {
    logger.error(`[social] fallo al leer estadísticas: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-estadisticas", schedule: "17 */6 * * *" }
