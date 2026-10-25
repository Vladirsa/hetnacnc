import { MedusaContainer } from "@medusajs/framework/types"

import { calcularResumenDiario } from "../lib/resumen-diario"
import { resumenDiarioEmailHtml } from "../lib/email-templates"
import { sendEmail } from "../lib/resend"

// El resumen de ayer, por correo, todas las mañanas.
//
// Se construyeron varias cosas para vender más y no había forma de saber si
// alguna sirve. Esto cierra ese hueco: una cifra al día, con su comparación
// contra el día anterior, para que la siguiente decisión no sea una adivinanza.
//
// A quién se le manda: RESUMEN_DIARIO_PARA. Sin esa variable no hace nada --
// no se adivina un destinatario para un correo que lleva cifras del negocio.
export default async function resumenDiario(container: MedusaContainer) {
  const logger = container.resolve("logger")

  const para = process.env.RESUMEN_DIARIO_PARA
  if (!para || !process.env.RESEND_API_KEY) {
    // Se queda callado a propósito: esto corre todos los días y un aviso diario
    // de algo que el dueño ya decidió no configurar es ruido.
    return
  }

  try {
    const resumen = await calcularResumenDiario(container)

    const { sent, reason } = await sendEmail({
      to: para,
      subject: `Ayer: ${resumen.pedidos} pedidos · ${resumen.ingresos.toLocaleString(
        "es-MX",
        { style: "currency", currency: (resumen.moneda || "mxn").toUpperCase(), maximumFractionDigits: 0 }
      )}`,
      html: resumenDiarioEmailHtml(resumen),
    })

    if (!sent) {
      logger.info(`[resumen-diario] no enviado: ${reason}`)
      return
    }

    logger.info(
      `[resumen-diario] ${resumen.dia}: ${resumen.pedidos} pedidos, ${resumen.carritos_abandonados} carritos abandonados, ${resumen.resenas_nuevas} reseñas`
    )
  } catch (e) {
    // Un resumen que falla no debe tumbar nada más: es informativo.
    logger.error(`[resumen-diario] no se pudo calcular: ${e?.message || e}`)
  }
}

export const config = {
  name: "resumen-diario",
  // 14:00 UTC = 8:00 del centro. Antes que el correo de reseñas, para que el
  // resumen sea lo primero que se lee en la mañana.
  schedule: "0 14 * * *",
}
