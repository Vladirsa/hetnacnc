// Al registrarse un taller por su cuenta (queda en "pending_approval"): le
// manda la liga para confirmar su correo. Ver lib/alta-taller.ts.
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { correoConfirmado, mandarConfirmacion, servicioTalleres } from "../lib/alta-taller"

export default async function tallerRegistradoAlta({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const t = await servicioTalleres(container).retrieveSeller(event.data.id)
    if (!t || t.status !== "pending_approval" || correoConfirmado(t)) return
    const r = await mandarConfirmacion(t)
    if (!r.sent) logger.warn(`[alta-taller] no se mandó la confirmación a ${t.email}: ${r.reason}`)
  } catch (e) {
    logger.warn(`[alta-taller] taller ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "seller.created",
}
