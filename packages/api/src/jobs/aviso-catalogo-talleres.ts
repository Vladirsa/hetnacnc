// Cada día a las 12:47 (centro de México): manda el siguiente lote del aviso de piezas
// nuevas del catálogo de impresión a los talleres que imprimen en 3D (lib/aviso-catalogo-talleres.ts).
// Cuando ya se avisó a todos, no hace nada.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { loteAvisoCatalogo } from "../lib/aviso-catalogo-talleres"

export default async function avisoCatalogoTalleres(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const r = await loteAvisoCatalogo(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
    if (r.enviados) logger.info(`[aviso-catalogo] ${r.enviados} talleres avisados`)
  } catch (e) {
    logger.error(`[aviso-catalogo] ${(e as Error).message}`)
  }
}

export const config = { name: "aviso-catalogo-talleres", schedule: "47 18 * * *" }
