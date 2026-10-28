// Al registrarse un taller: deja constancia de que aceptó los Términos para
// vendedores (la pantalla de registro los muestra junto al botón "Continuar") y,
// si capturó datos bancarios en el registro, de que autorizó su uso (la pantalla
// de datos de pago muestra la autorización). Ver apps/vendor/src/i18n.
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { registrarConstancia } from "../api/vendor/hetna-verificacion/middlewares"

export default async function tallerRegistradoConstancias({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [seller],
    } = (await query.graph({
      entity: "seller",
      fields: ["id", "payment_details.account_number", "payment_details.iban", "payment_details.holder_name"],
      filters: { id: event.data.id },
    })) as unknown as { data: { id: string; payment_details?: Record<string, string | null> | null }[] }
    if (!seller) return
    const pd = seller.payment_details ?? {}
    const bancario = ["account_number", "iban", "holder_name"].some((k) => (pd[k] ?? "").trim() !== "")
    await registrarConstancia(container as any, seller.id, { terminos: true, ...(bancario ? { bancario: "registro" } : {}) })
  } catch (e) {
    logger.warn(`[constancias] taller ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "seller.created",
}
