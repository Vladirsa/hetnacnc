// Cada madrugada (3:13, centro de México): si hay una fecha especial en
// temporada (Día de las Madres, Muertos, Navidad…) y productos con su etiqueta,
// hace la imagen y el video de esos productos con el fondo de la fecha.
// De madrugada para no quitarle procesador a la tienda (videos animados).
import { MedusaContainer } from "@medusajs/framework/types"

import { promoTemporada } from "../lib/fabrica/temporadas"

export default async function videosTemporada(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await promoTemporada(container, logger)
  } catch (e) {
    logger.error(`[temporada] fallo: ${(e as Error).message}`)
  }
}

export const config = { name: "videos-temporada", schedule: "13 9 * * *" }
