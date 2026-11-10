// Cada día (10:29, centro de México): imagen y video de un producto de la tienda;
// martes y viernes de un artículo del blog; lunes y jueves de una herramienta.
import { MedusaContainer } from "@medusajs/framework/types"

import { promocionesDelDia } from "../lib/fabrica/promociones"

export default async function promocionesDiarias(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await promocionesDelDia(container, logger)
  } catch (e) {
    logger.error(`[promo] fallo: ${(e as Error).message}`)
  }
}

export const config = { name: "promociones-diarias", schedule: "29 16 * * *" }
