// Al borrar un producto o una presentación, sus ofertas se dan de baja
// (lib/ofertas-sueltas.ts). Si falla, la revisión diaria las recoge.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { bajaOfertasSueltas } from "../lib/ofertas-sueltas"

export default async function productoBorradoOfertas({ container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const n = await bajaOfertasSueltas(container)
    if (n) logger.info(`[ofertas-sueltas] ${n} ofertas dadas de baja al borrar un producto`)
  } catch (e) {
    logger.warn(`[ofertas-sueltas] no se pudieron dar de baja: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.deleted", "product-variant.deleted"],
}
