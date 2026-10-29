import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { errorForo, foroCorreosListo, mandarAvisos } from "../lib/foro-correos"

// Cada 10 minutos: los avisos del foro que siguen sin leer (respuestas,
// seguidores, mensajes, avales, postulaciones...) salen en un solo correo por
// persona. Sólo para quien eligió "al momento" (lo de fábrica).
export default async function foroAvisos(container: MedusaContainer) {
  if (!foroCorreosListo()) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const n = await mandarAvisos(knex, "al_momento", logger)
    if (n) logger.info(`[foro-avisos] ${n} correos de avisos enviados`)
  } catch (e) {
    errorForo(logger, e, "foro-avisos")
  }
}

export const config = {
  name: "foro-avisos",
  schedule: "*/10 * * * *",
}
