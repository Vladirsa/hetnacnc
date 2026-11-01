import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { inscribirPorPedido } from "../lib/cursos"

// Compró un curso -> queda inscrito (lib/cursos.ts). Si el pago se confirma
// después, la tarea cursos-inscripciones lo inscribe en su siguiente vuelta.
export default async function cursoInscripcionPedido({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const n = await inscribirPorPedido(container, event.data.id)
    if (n) logger.info(`[cursos] pedido ${event.data.id}: ${n} inscripción(es)`)
  } catch (e) {
    logger.warn(`[cursos] ${event.name} ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
