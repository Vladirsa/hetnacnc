import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { registrarVenta, retener } from "../lib/saldos-talleres"

// Saldo del taller (lib/saldos-talleres.ts):
//   order.placed -> registra la venta (los diseños digitales
//     quedan disponibles al momento; lo físico, pendiente de entrega)
//   order.canceled -> se retiene: no se le paga al taller
// Si el pago aún no está confirmado al llegar order.placed, la tarea
// saldos-talleres lo registra en su siguiente vuelta.
export default async function saldoTallerPedido({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    if (event.name === "order.canceled") {
      await retener(container, event.data.id, "Pedido cancelado")
      return
    }
    await registrarVenta(container, event.data.id)
  } catch (e) {
    logger.warn(`[saldos] ${event.name} ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
}
