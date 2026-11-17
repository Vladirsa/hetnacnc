// CFDI de las suscripciones del Cotizador (lib/cotizador-facturacion):
//  - Cada día: reintenta los cobros pendientes o con error y los que no llegaron a la contabilidad.
//  - El día 1: factura global del mes anterior (cobros en pesos de talleres sin datos fiscales).
// CFDI_SUSCRIPCIONES=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { facturaGlobalDelMes, llaveHetna, reintentarPendientes } from "../lib/cotizador-facturacion"

export default async function cfdiSuscripciones(container: MedusaContainer) {
  if (process.env.CFDI_SUSCRIPCIONES === "0" || !llaveHetna()) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    const n = await reintentarPendientes(knex, logger)
    if (n) logger.info(`[cfdi-suscripcion] ${n} cobros reintentados`)
    // Fecha en el centro de México
    const mx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
    if (mx.getDate() <= 3) {
      // Del 1 al 3 (por si el día 1 falló): global del mes anterior; es idempotente
      const anio = mx.getMonth() === 0 ? mx.getFullYear() - 1 : mx.getFullYear()
      const mes = mx.getMonth() === 0 ? 12 : mx.getMonth()
      const r = await facturaGlobalDelMes(knex, anio, mes, { logger })
      if (r.estado !== "vacia") logger.info(`[cfdi-suscripcion] global ${mes}/${anio}: ${JSON.stringify(r)}`)
    }
  } catch (e) {
    logger.error(`[cfdi-suscripcion] falló: ${(e as Error).message}`)
  }
}

// 9:07 a. m. del centro (15:07 UTC)
export const config = { name: "cfdi-suscripciones", schedule: "7 15 * * *" }
