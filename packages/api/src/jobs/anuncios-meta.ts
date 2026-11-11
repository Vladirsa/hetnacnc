// Agente de anuncios de Meta (lib/anuncios.ts). Todos los días a las 10:17
// (centro de México): revisa gasto y resultados de los anuncios activos; los
// martes, si está prendido y no hay otro, deja UNA propuesta para aprobar.
// Nada se lanza sin la aprobación del dueño en el panel.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { proponerAnuncio, revisarAnuncios } from "../lib/anuncios"

export default async function anunciosMeta(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    await revisarAnuncios(knex, logger)
    const dia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getDay()
    if (dia === 2) await proponerAnuncio(knex, logger)
  } catch (e) {
    logger.error(`[anuncios] ${(e as Error).message}`)
  }
}

export const config = { name: "anuncios-meta", schedule: "17 16 * * *" }
