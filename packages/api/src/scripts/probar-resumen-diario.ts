/**
 * Imprime el resumen de ayer sin mandar ningún correo.
 *
 * Uso (en packages/api):
 *   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-resumen-diario.ts
 *
 * Sirve para ver las cifras hoy mismo, sin esperar a que el job corra a las 8,
 * y para comprobar que cuadran con lo que ves en el panel. No manda correo
 * nunca: para eso está el job.
 *
 * Corre el mismo cálculo que el job (lib/resumen-diario), no una copia.
 */
import { ExecArgs } from "@medusajs/framework/types"

import { calcularResumenDiario } from "../lib/resumen-diario"

export default async function probarResumenDiario({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const r = await calcularResumenDiario(container)

  const dinero = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: (r.moneda || "mxn").toUpperCase(),
      maximumFractionDigits: 0,
    })

  logger.info(`[resumen] día reportado: ${r.dia}`)
  logger.info(`[resumen] pedidos pagados: ${r.pedidos} (antier: ${r.pedidos_antier})`)
  logger.info(`[resumen] ingresos: ${dinero(r.ingresos)} (antier: ${dinero(r.ingresos_antier)})`)
  logger.info(`[resumen] pedidos sin pago confirmado: ${r.pedidos_sin_pagar}`)
  logger.info(`[resumen] clientes nuevos: ${r.clientes_nuevos}`)
  logger.info(
    `[resumen] carritos abandonados: ${r.carritos_abandonados} (${dinero(r.valor_abandonado)} en juego)`
  )
  logger.info(`[resumen] reseñas nuevas: ${r.resenas_nuevas}`)

  if (!r.talleres.length) {
    logger.info("[resumen] ningún taller vendió ayer")
  }
  for (const t of r.talleres) {
    logger.info(`[resumen] ${t.nombre}: ${t.pedidos} pedidos, ${dinero(t.ingresos)}`)
  }

  logger.info(
    "[resumen] las visitas no vienen aquí: viven en GA4 y en el Pixel, no en la base de la tienda."
  )
}
