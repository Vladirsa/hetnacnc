/**
 * Imprime el resumen de ayer, y si se le pide, lo manda por correo.
 *
 * Uso (en packages/api):
 *
 *   # Sólo imprime. No manda nada.
 *   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-resumen-diario.ts
 *
 *   # Además lo manda a RESUMEN_DIARIO_PARA, para comprobar hoy que el correo
 *   # de mañana a las 8 va a salir de verdad.
 *   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-resumen-diario.ts enviar
 *
 * Mandar se pide a mano, igual que en probar-correo-resenas. Aquí el riesgo es
 * mucho menor -- va al dueño, no a un cliente -- pero vale la pena que los dos
 * guiones se comporten igual: un mismo gesto no debe significar cosas distintas
 * según el archivo.
 *
 * Corre el mismo cálculo que el job (lib/resumen-diario), no una copia.
 */
import { ExecArgs } from "@medusajs/framework/types"

import { calcularResumenDiario } from "../lib/resumen-diario"
import { resumenDiarioEmailHtml } from "../lib/email-templates"
import { sendEmail } from "../lib/resend"

export default async function probarResumenDiario({ container, args }: ExecArgs) {
  const logger = container.resolve("logger")
  const enviar = (args || []).includes("enviar")
  const r = await calcularResumenDiario(container)

  const dinero = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: (r.moneda || "mxn").toUpperCase(),
      maximumFractionDigits: 0,
    })

  logger.info(`[resumen] día reportado: ${r.dia}`)
  // Los totales van PRIMERO: sin ellos, "0 pedidos ayer" no distingue entre un
  // día tranquilo, una tienda sin datos todavía y un filtro de fechas roto.
  logger.info(
    `[resumen] EN TOTAL (histórico): ${r.total_pedidos} pedidos, ${r.total_clientes} clientes, ${r.total_carritos_sin_completar} carritos sin completar`
  )
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

  if (r.total_pedidos === 0) {
    logger.info(
      "[resumen] La tienda no tiene NINGÚN pedido todavía, así que los ceros de ayer son " +
        "correctos y no un error de cálculo. Hasta que haya ventas, este resumen va a salir en ceros."
    )
  } else if (r.pedidos === 0) {
    logger.info(
      `[resumen] Ayer no hubo pedidos, pero la tienda lleva ${r.total_pedidos} en total: ` +
        "el cálculo funciona y ayer simplemente estuvo tranquilo."
    )
  }

  logger.info(
    "[resumen] las visitas no vienen aquí: viven en GA4 y en el Pixel, no en la base de la tienda."
  )

  if (!enviar) {
    logger.info(
      "[resumen] no se mandó correo. Agrega `enviar` al final para probar que el correo sale."
    )
    return
  }

  const para = process.env.RESUMEN_DIARIO_PARA
  if (!para) {
    logger.warn(
      "[resumen] RESUMEN_DIARIO_PARA no está configurada, así que el job de las 8 tampoco mandaría nada. " +
        "Ponla en .env.production y reinicia el API."
    )
    return
  }

  const { sent, reason } = await sendEmail({
    to: para,
    subject: `Ayer: ${r.pedidos} pedidos · ${dinero(r.ingresos)}`,
    html: resumenDiarioEmailHtml(r),
  })

  if (sent) {
    logger.info(`[resumen] correo enviado. Revisa la bandeja de ${para}.`)
  } else {
    logger.warn(`[resumen] NO se pudo enviar: ${reason}`)
  }
}
