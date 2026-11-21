// Cada día (12:17, centro de México): lote de la campaña "pon tus precios de
// acabados" a talleres sin precios, y recordatorio a la semana
// (lib/campana-precios-talleres). CAMPANA_PRECIOS=off la apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { loteCampanaPrecios } from "../lib/campana-precios-talleres"

export default async function campanaPreciosTalleres(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const r = await loteCampanaPrecios(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
    if (r.enviados || r.recordatorios) logger.info(`[campana-precios] ${r.enviados} correos nuevos, ${r.recordatorios} recordatorios`)
  } catch (e) {
    logger.error(`[campana-precios] ${(e as Error).message}`)
  }
}

export const config = { name: "campana-precios-talleres", schedule: "17 18 * * *" }
