// Cada hora: «Que HETNA elija por mí». Ver lib/hetna-elige.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarTablas } from "../lib/licitacion"
import { correrHetnaElige } from "../lib/hetna-elige"

export default async function hetnaElige(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurarTablas(knex)
    await correrHetnaElige(knex, logger)
  } catch (e) {
    logger.error(`[hetna-elige] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "hetna-elige",
  schedule: "23 * * * *",
}
