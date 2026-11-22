// Cada 10 minutos: cobros de Mercado Pago sin pedido (lib/conciliar-mercadopago.ts).
import type { MedusaContainer } from "@medusajs/framework/types"

import { conciliarMercadoPago } from "../lib/conciliar-mercadopago"

export default async function conciliarMercadoPagoJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const r = await conciliarMercadoPago(container)
    if (r.completados || r.avisos) {
      logger.info(`[conciliar-mp] ${r.revisados} pagos revisados, ${r.completados} pedidos creados, ${r.avisos} avisos`)
    }
  } catch (e) {
    logger.error(`[conciliar-mp] no se pudo revisar: ${(e as Error).message}`)
  }
}

export const config = {
  name: "conciliar-mercadopago",
  schedule: "*/10 * * * *",
}
