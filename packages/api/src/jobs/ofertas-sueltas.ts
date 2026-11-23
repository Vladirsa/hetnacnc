// Una vez al día: ofertas de productos ya borrados (lib/ofertas-sueltas.ts).
// Normalmente no encuentra nada: el subscriber las da de baja al momento.
import type { MedusaContainer } from "@medusajs/framework/types"

import { bajaOfertasSueltas } from "../lib/ofertas-sueltas"

export default async function ofertasSueltasJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const n = await bajaOfertasSueltas(container)
    if (n) logger.info(`[ofertas-sueltas] revisión diaria: ${n} ofertas dadas de baja`)
  } catch (e) {
    logger.error(`[ofertas-sueltas] revisión diaria: ${(e as Error).message}`)
  }
}

export const config = {
  name: "ofertas-sueltas",
  schedule: "37 4 * * *",
}
