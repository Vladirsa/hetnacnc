// Cada hora: los talleres del Cotizador que cancelaron o pausaron su
// suscripción conservan el plan hasta la fecha que ya pagaron; al pasar esa
// fecha, aquí bajan a Gratis. Ver lib/cotizador-suscripciones.ts.
import { MedusaContainer } from "@medusajs/framework/types"

import { bajarPlanesVencidos } from "../lib/cotizador-suscripciones"

export default async function cotizadorPlanesVencidos(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const n = await bajarPlanesVencidos()
    if (n) logger.info(`[cotizador] ${n} taller(es) pasaron a Gratis al vencer su plan`)
  } catch (e) {
    logger.error(`[cotizador] no se pudieron revisar los planes vencidos: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cotizador-planes-vencidos",
  schedule: "17 * * * *",
}
