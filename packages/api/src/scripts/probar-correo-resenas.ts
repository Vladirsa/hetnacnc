/**
 * Corre a mano el recordatorio "califica lo que compraste", sin esperar a que
 * el job diario le toque su hora.
 *
 * Uso (en packages/api):
 *
 *   # EN SECO: dice a quién le escribiría y con qué productos. No manda nada.
 *   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-correo-resenas.ts
 *
 *   # DE VERDAD: manda los correos a clientes reales.
 *   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-correo-resenas.ts enviar
 *
 * En seco por omisión a propósito. Este job le escribe a gente que te compró:
 * un script de prueba que manda correos reales en el primer intento es la forma
 * más rápida de mandarle algo raro a un cliente. Hay que pedirlo con la palabra
 * `enviar`, escrita a mano.
 *
 * Corre exactamente el mismo código que el job (lib/correo-resenas), no una
 * copia: una copia probaría la copia.
 *
 * Los correos salen tapados (ro****@dominio.com) porque estas salidas se pegan
 * en chats. Para verificar al destinatario basta el principio y el dominio.
 *
 * Con `enviar`, las órdenes que reciban el correo quedan marcadas y el job ya no
 * se las vuelve a mandar -- es el mismo candado de siempre, no un efecto del
 * script.
 */
import { ExecArgs } from "@medusajs/framework/types"

import { correrRecordatorioDeResenas } from "../lib/correo-resenas"

export default async function probarCorreoResenas({ container, args }: ExecArgs) {
  const logger = container.resolve("logger")
  const enviar = (args || []).includes("enviar")

  logger.info(
    enviar
      ? "[probar-correo-resenas] MODO REAL: se van a mandar correos a clientes."
      : "[probar-correo-resenas] En seco. No se manda nada. Agrega `enviar` al final para mandar de verdad."
  )

  const reporte = await correrRecordatorioDeResenas(container, { enviar })

  if (reporte.motivo) {
    logger.warn(`[probar-correo-resenas] no se hizo nada: ${reporte.motivo}`)
    return
  }

  logger.info(
    `[probar-correo-resenas] ${reporte.elegibles} órdenes elegibles, ${reporte.yaResenadas} ya reseñadas por completo`
  )

  if (!reporte.detalle.length) {
    logger.info(
      "[probar-correo-resenas] No hay a quién escribirle hoy. " +
        "Puede ser que no haya compras pagadas en la ventana de días, o que ya se les haya pedido. " +
        "Revisa RESENA_EMAIL_MIN_DIAS y RESENA_EMAIL_MAX_DIAS si esperabas alguna."
    )
    return
  }

  for (const d of reporte.detalle) {
    logger.info(
      `[probar-correo-resenas] ${enviar ? "enviado a" : "le escribiría a"} ${d.correo} ` +
        `(orden ${d.order_id}): ${d.productos.join(" · ")}`
    )
  }

  if (enviar) {
    logger.info(`[probar-correo-resenas] correos enviados: ${reporte.enviados}`)
  } else {
    logger.info(
      `[probar-correo-resenas] en seco: serían ${reporte.detalle.length} correos. ` +
        "Vuelve a correrlo con `enviar` al final si se ve bien."
    )
  }
}
