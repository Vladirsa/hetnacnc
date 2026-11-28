// Cada 20 minutos: reintenta la entrega de diseños digitales que no salió (28 nov 2026).
// La entrega se dispara en order.placed / payment.captured (lib/digital-delivery.ts), pero
// si el correo falló, Backblaze no respondió o a un producto le faltaba el archivo, nadie la
// volvía a intentar y el cliente se quedaba sin su archivo habiendo pagado. Aquí se toman las
// órdenes de los últimos 7 días sin digital_delivery_sent_at y se vuelven a pasar por la
// entrega (que es idempotente: no duplica correos y sólo manda lo que falta).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { deliverDigitalProductsForOrder } from "../lib/digital-delivery"

const DIAS = 7
const POR_VUELTA = 40
const MAX_INTENTOS = 60 // ~20 horas de reintentos por orden

export default async function reintentarEntregasDigitales(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const filas = await knex("order")
      .whereNull("deleted_at")
      .whereNull("canceled_at")
      .where("created_at", ">", knex.raw(`now() - interval '${DIAS} days'`))
      .where("created_at", "<", knex.raw("now() - interval '5 minutes'")) // la entrega normal va primero
      .whereRaw("coalesce(metadata->>'digital_delivery_sent_at', '') = ''")
      .whereRaw("coalesce(metadata->>'digital_no_aplica', '') <> 'true'")
      .whereRaw("coalesce((metadata->>'digital_delivery_intentos')::int, 0) < ?", [MAX_INTENTOS])
      .orderBy("created_at", "asc")
      .limit(POR_VUELTA)
      .select("id")
    for (const { id } of filas) {
      try {
        await deliverDigitalProductsForOrder(container, id)
      } catch (e) {
        logger.warn(`[reintentar-entregas] ${id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    logger.warn(`[reintentar-entregas] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "reintentar-entregas-digitales",
  schedule: "*/20 * * * *",
}
