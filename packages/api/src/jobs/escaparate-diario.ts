// Cada día (11:31 a. m. hora del centro): escaparate en redes con productos de la
// tienda que aún no se han anunciado (lib/escaparate). ESCAPARATE_POR_DIA (1 por
// omisión, máximo 5) dice cuántos; ESCAPARATE=0 lo apaga. Que salgan solos o
// esperen visto bueno lo decide el Social Hub (Admin > Social > Configuración).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { escaparateDelDia } from "../lib/escaparate"

export default async function escaparateDiario(container: MedusaContainer) {
  if (process.env.ESCAPARATE === "0") return
  const logger = container.resolve("logger")
  const porDia = Math.max(1, Math.min(5, Number(process.env.ESCAPARATE_POR_DIA) || 1))
  try {
    const r = await escaparateDelDia(container.resolve(ContainerRegistrationKeys.QUERY), container.resolve(ContainerRegistrationKeys.PG_CONNECTION), porDia, logger)
    if (r.hechos) logger.info(`[escaparate] ${r.hechos} productos mandados al Social Hub`)
  } catch (e) {
    logger.error(`[escaparate] falló: ${(e as Error).message}`)
  }
}

export const config = { name: "escaparate-diario", schedule: "31 17 * * *" }
