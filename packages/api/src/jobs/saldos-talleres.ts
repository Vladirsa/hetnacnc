// Cada hora: registra en el saldo de los talleres los pedidos que faltaron
// (pago confirmado después de crear el pedido) y libera lo que ya cumplió sus
// días después de la entrega (lib/saldos-talleres.ts).
import { MedusaContainer } from "@medusajs/framework/types"

import { liberarVencidos, registrarFaltantes } from "../lib/saldos-talleres"

export default async function saldosTalleresJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const nuevos = await registrarFaltantes(container)
    const liberados = await liberarVencidos(container)
    if (nuevos || liberados) logger.info(`[saldos] ${nuevos} ventas registradas, ${liberados} liberadas`)
  } catch (e) {
    logger.error(`[saldos] no se pudo actualizar el saldo de los talleres: ${(e as Error).message}`)
  }
}

export const config = {
  name: "saldos-talleres",
  schedule: "23 * * * *",
}
