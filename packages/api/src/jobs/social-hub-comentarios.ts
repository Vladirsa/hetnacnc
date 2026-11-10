// Cada 15 minutos: lee los comentarios nuevos de Instagram y Facebook, la IA
// propone respuesta y se contestan solos o se mandan a aprobar por Telegram.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { revisarComentarios } from "../lib/social-comentarios"

export default async function socialHubComentarios(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await revisarComentarios(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[social] comentarios: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-comentarios", schedule: "*/15 * * * *" }
