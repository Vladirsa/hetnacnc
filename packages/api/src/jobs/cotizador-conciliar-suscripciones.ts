// Cada día: vuelve a consultar en Mercado Pago y PayPal las suscripciones
// activas del Cotizador (auditoría del 14 nov 2026). Hasta ahora el plan sólo
// cambiaba cuando llegaba el aviso (webhook) del proveedor; si un aviso de
// cancelación o pausa se perdía, el taller conservaba el plan para siempre.
//
// Usa las mismas funciones que procesan los avisos (sincronizarSuscripcion y
// sincronizarSuscripcionPaypal), así que el resultado es el mismo que si el
// aviso hubiera llegado. Las suscripciones que el proveedor da por activas pero
// llevan más de DIAS_GRACIA sin renovarse se reportan a HETNA (no se bajan
// solas: mejor revisar a mano que quitarle el plan a quien sí pagó).
import { MedusaContainer } from "@medusajs/framework/types"

import { sincronizarSuscripcionPaypal } from "../lib/cotizador-paypal"
import { sincronizarSuscripcion, supa, type Negocio } from "../lib/cotizador-suscripciones"
import { sendEmail } from "../lib/resend"

const DIAS_GRACIA = 7

export default async function conciliarSuscripciones(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const activas = await supa<Negocio[]>(
      `/rest/v1/negocios?plan_estado=eq.activa&plan=in.(taller,pro,industrial)&or=(mp_suscripcion_id.not.is.null,pp_suscripcion_id.not.is.null)` +
        `&select=id,nombre,plan,plan_estado,plan_renueva,plan_vence,pago_proveedor,mp_suscripcion_id,mp_suscripcion_pendiente,pp_suscripcion_id,pp_suscripcion_pendiente&limit=500`
    )
    let revisadas = 0
    let fallidas = 0
    for (const n of activas) {
      try {
        if (n.mp_suscripcion_id) await sincronizarSuscripcion(n.mp_suscripcion_id, logger)
        else if (n.pp_suscripcion_id) await sincronizarSuscripcionPaypal(n.pp_suscripcion_id, logger)
        revisadas++
      } catch (e) {
        fallidas++
        logger.error(`[cotizador] no se pudo conciliar la suscripción del taller ${n.id}: ${(e as Error).message}`)
      }
      await new Promise((r) => setTimeout(r, 300)) // sin saturar a los proveedores
    }

    // Activas según el proveedor, pero sin renovarse desde hace más de DIAS_GRACIA
    const corte = new Date(Date.now() - DIAS_GRACIA * 864e5).toISOString()
    const atrasadas = await supa<Negocio[]>(
      `/rest/v1/negocios?plan_estado=eq.activa&plan=in.(taller,pro,industrial)&plan_renueva=lt.${encodeURIComponent(corte)}&select=id,nombre,plan,plan_renueva,pago_proveedor&limit=100`
    )
    logger.info(`[cotizador] conciliación: ${revisadas} revisadas, ${fallidas} con error, ${atrasadas.length} atrasadas más de ${DIAS_GRACIA} días`)
    if (atrasadas.length && process.env.HETNA_LEADS_EMAIL) {
      await sendEmail({
        to: process.env.HETNA_LEADS_EMAIL,
        subject: `Cotizador: ${atrasadas.length} suscripción(es) sin renovar`,
        html:
          `<p>Estos talleres siguen con plan de pago, pero su última renovación es de hace más de ${DIAS_GRACIA} días. Revísalos en Mercado Pago o PayPal:</p><ul>` +
          atrasadas
            .map((a) => `<li>${a.nombre || a.id} · plan ${a.plan} · ${a.pago_proveedor || "?"} · renovaba ${String(a.plan_renueva || "").slice(0, 10)}</li>`)
            .join("") +
          `</ul>`,
      }).catch(() => null)
    }
  } catch (e) {
    logger.error(`[cotizador] falló la conciliación de suscripciones: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cotizador-conciliar-suscripciones",
  schedule: "43 10 * * *",
}
