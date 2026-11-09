// Cada lunes: revisa que las conexiones con redes (vía n8n) sigan funcionando
// y avisa por correo si hubo errores en la semana (permisos vencidos, etc.).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { revisarIntegraciones } from "../lib/social-hub"

export default async function socialHubRevision(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await revisarIntegraciones(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[social] fallo en la revisión de integraciones: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-revision", schedule: "41 15 * * 1" }
