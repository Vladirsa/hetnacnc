// Domingos de madrugada (5:41, centro de México): hace el video EXPLICATIVO LARGO
// para YouTube (horizontal, 4 a 6 minutos, con capítulos; ~0.80 USD de voz y fotos)
// y lo deja como BORRADOR en el Social Hub para que lo apruebes (lib/fabrica/explicativo).
// Se apaga desde la tarjeta del Estudio (casilla «Video largo cada semana»).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { leerEstudioCfg } from "../lib/fabrica/estudio"
import { hacerExplicativo } from "../lib/fabrica/explicativo"

export default async function estudioExplicativoLargo(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    if ((await leerEstudioCfg(container.resolve(ContainerRegistrationKeys.PG_CONNECTION))).largo === false) return
    const r = await hacerExplicativo(container, logger, { largo: true })
    if (!r.hecho) logger.info(`[explicativo-largo] hoy no: ${r.motivo}`)
  } catch (e) {
    logger.error(`[explicativo-largo] ${(e as Error).message}`)
  }
}

export const config = { name: "estudio-explicativo-largo", schedule: "41 11 * * 0" }
