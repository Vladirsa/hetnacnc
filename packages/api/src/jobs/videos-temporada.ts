// Cada madrugada (3:13, centro de México): si hay una fecha especial en
// temporada (Día de las Madres, Muertos, Navidad…) y productos con su etiqueta,
// hace la imagen y el video de esos productos con el fondo de la fecha.
// También el Buen Fin, con los datos que pone el dueño.
// De madrugada para no quitarle procesador a la tienda (videos animados).
import { MedusaContainer } from "@medusajs/framework/types"

import { promoBuenFin } from "../lib/fabrica/buen-fin"
import { promoTemporada } from "../lib/fabrica/temporadas"
import { fechasActivas } from "../lib/fabrica/calendario"
import { etiquetarNuevos } from "../lib/invitar-temporada"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function videosTemporada(container: MedusaContainer) {
  const logger = container.resolve("logger")
  // Primero: lo que los talleres publicaron con la palabra de la fecha en el nombre se etiqueta solo
  try {
    const claves = [...new Set([...fechasActivas(), ...fechasActivas(new Date(Date.now() + 14 * 86_400_000))].map(({ f }) => f.clave))]
    if (claves.length) await etiquetarNuevos(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), claves, logger)
  } catch (e) {
    logger.warn(`[temporada] etiquetar: ${(e as Error).message}`)
  }
  try {
    await promoTemporada(container, logger)
  } catch (e) {
    logger.error(`[temporada] fallo: ${(e as Error).message}`)
  }
  // Buen Fin (sólo si el dueño puso fechas y descuento en el panel)
  try {
    await promoBuenFin(container, logger)
  } catch (e) {
    logger.error(`[buen-fin] fallo: ${(e as Error).message}`)
  }
}

export const config = { name: "videos-temporada", schedule: "13 9 * * *" }
