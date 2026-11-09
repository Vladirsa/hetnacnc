// Cada 5 minutos: publica en redes lo programado del Social Hub (lib/social-hub.ts).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { publicarPendientes } from "../lib/social-hub"

export default async function socialHubPublicar(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await publicarPendientes(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[social] fallo al publicar pendientes: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-publicar", schedule: "*/5 * * * *" }
