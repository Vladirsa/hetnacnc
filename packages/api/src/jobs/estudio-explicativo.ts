// Lunes y jueves de madrugada (4:41, centro de México): hace un video
// EXPLICATIVO (motion graphics con voz, 65 a 80 s; cuesta ~0.15 USD de voz) y lo
// deja como BORRADOR en el Social Hub para que lo apruebes (lib/fabrica/explicativo).
// Se apaga desde la tarjeta del Estudio («Explicativo lunes y jueves»).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { leerEstudioCfg } from "../lib/fabrica/estudio"
import { hacerExplicativo } from "../lib/fabrica/explicativo"

export default async function estudioExplicativo(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    if ((await leerEstudioCfg(container.resolve(ContainerRegistrationKeys.PG_CONNECTION))).explicativo === false) return
    const r = await hacerExplicativo(container, logger)
    if (!r.hecho) logger.info(`[explicativo] hoy no: ${r.motivo}`)
  } catch (e) {
    logger.error(`[explicativo] ${(e as Error).message}`)
  }
}

export const config = { name: "estudio-explicativo", schedule: "41 10 * * 1,4" }
