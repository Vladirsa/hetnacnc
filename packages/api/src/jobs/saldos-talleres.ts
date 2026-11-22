// Cada hora: registra en el saldo de los talleres los pedidos que faltaron
// (pago confirmado después de crear el pedido), retiene lo reembolsado o
// cancelado que aún no se paga, y libera lo que ya cumplió sus
// días después de la entrega (lib/saldos-talleres.ts).
import { MedusaContainer } from "@medusajs/framework/types"

import { liberarVencidos, registrarFaltantes, retenerReembolsados } from "../lib/saldos-talleres"

export default async function saldosTalleresJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const nuevos = await registrarFaltantes(container)
    // Primero lo reembolsado o cancelado, para que no se libere ni se pague
    const retenidos = await retenerReembolsados(container)
    const liberados = await liberarVencidos(container)
    if (retenidos) logger.warn(`[saldos] ${retenidos} pedidos retenidos por reembolso o cancelación: revisar en Pagos a talleres`)
    if (nuevos || liberados) logger.info(`[saldos] ${nuevos} ventas registradas, ${liberados} liberadas`)
  } catch (e) {
    logger.error(`[saldos] no se pudo actualizar el saldo de los talleres: ${(e as Error).message}`)
  }
}

export const config = {
  name: "saldos-talleres",
  schedule: "23 * * * *",
}
