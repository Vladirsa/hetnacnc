// Correo «Así vamos creciendo» con las cifras reales de HETNA y el anuncio del mes
// en redes (lib/metricas-extranjeros.ts). Corre a diario a las 10:17 (centro de
// México) del día 3 al 10 de cada mes: cada persona recibe uno al mes y el tope
// por corrida reparte el envío en varios días. A quién: talleres y proveedores de
// otros países que se apuntaron, talleres nacionales que llenaron «Únete» sin
// crear su cuenta y clientes con cuenta. METRICAS_EXTRANJEROS_APAGADO=1 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { correrMetricasExtranjeros, metricasExtranjerosApagado, publicarMetricas } from "../lib/metricas-extranjeros"

export default async function metricasExtranjeros(container: MedusaContainer) {
  if (metricasExtranjerosApagado()) return
  const dia = new Date().getUTCDate()
  if (dia < 3 || dia > 10) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    await publicarMetricas(container, knex, logger)
  } catch (e) {
    logger.warn(`[metricas] anuncio del mes: ${(e as Error).message}`)
  }
  try {
    const r = await correrMetricasExtranjeros(knex)
    logger.info(`[metricas] correos enviados ${r.enviados}, ya tenían el del mes ${r.ya}, de baja ${r.baja}, fallidos ${r.fallidos}`)
  } catch (e) {
    logger.error(`[metricas] correos: ${(e as Error).message}`)
  }
}

export const config = { name: "metricas-extranjeros", schedule: "17 16 * * *" }
