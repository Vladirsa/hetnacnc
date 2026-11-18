// Cada hora: "Avísame cuando haya". A quien pidió aviso de un producto agotado
// le llega correo (y aviso al celular) cuando vuelve a haber existencias.
// AVISOS_EXISTENCIA=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { revisarAvisos } from "../lib/aviso-existencia"

export default async function avisosExistencia(container: MedusaContainer) {
  if (process.env.AVISOS_EXISTENCIA === "0") return
  const logger = container.resolve("logger")
  try {
    const r = await revisarAvisos(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), container.resolve(ContainerRegistrationKeys.QUERY), logger)
    if (r.avisados) logger.info(`[aviso-existencia] ${r.avisados} clientes avisados`)
  } catch (e) {
    logger.error(`[aviso-existencia] falló: ${(e as Error).message}`)
  }
}

export const config = { name: "avisos-existencia", schedule: "11 * * * *" }
