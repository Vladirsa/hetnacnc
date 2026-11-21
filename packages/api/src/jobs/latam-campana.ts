// Cada martes (11:23, centro de México): la publicación de la semana invitando
// al pre-registro en cada país de Latinoamérica prendido en "Mercados" de la
// configuración de redes (lib/latam-campana). Sin países prendidos, no hace nada.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { campanaLatam } from "../lib/latam-campana"

export default async function latamCampana(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const r = await campanaLatam(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
    if (r.paises.length) logger.info(`[latam] publicaciones de la semana: ${r.paises.join(", ")}`)
  } catch (e) {
    logger.error(`[latam] ${(e as Error).message}`)
  }
}

export const config = { name: "latam-campana", schedule: "23 17 * * 2" }
