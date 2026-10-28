// Cada 10 minutos: revisa las compras de créditos que siguen pendientes.
// Cubre al cliente que pagó y cerró la ventana antes de regresar a la tienda:
// sus créditos llegan solos en la siguiente vuelta. Las compras que llevan más
// de 3 días sin pagarse se marcan como vencidas.
import { MedusaContainer } from "@medusajs/framework/types"

import { comprasPendientes, confirmarCompra, proveedoresDisponibles, vencerPendientes } from "../lib/creditos-compra"

const DIAS = 3

export default async function confirmarComprasCreditos(container: MedusaContainer) {
  const logger = container.resolve("logger")
  if (!proveedoresDisponibles().length) return

  try {
    const pendientes = await comprasPendientes(container, DIAS)
    let pagadas = 0
    for (const c of pendientes) {
      try {
        const r = await confirmarCompra(container, c.id)
        if (r.estado === "pagado") pagadas++
      } catch (e) {
        logger.warn(`[creditos] compra ${c.id}: ${(e as Error).message}`)
      }
    }
    const vencidas = await vencerPendientes(container, DIAS)
    if (pagadas || vencidas) {
      logger.info(`[creditos] revisión: ${pagadas} compras acreditadas, ${vencidas} vencidas`)
    }
  } catch (e) {
    logger.error(`[creditos] no se pudieron revisar las compras pendientes: ${(e as Error).message}`)
  }
}

export const config = {
  name: "confirmar-compras-creditos",
  schedule: "*/10 * * * *",
}
