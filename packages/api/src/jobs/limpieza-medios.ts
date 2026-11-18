// Cada madrugada (4:41, centro de México): borra del servidor las imágenes y
// videos generados para redes que ya pasaron los días configurados (lib/limpieza-medios).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { limpiarMedios } from "../lib/limpieza-medios"

export default async function limpiezaMedios(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await limpiarMedios(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[limpieza] ${(e as Error).message}`)
  }
}

export const config = { name: "limpieza-medios", schedule: "41 10 * * *" }
