import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import {
  T_PROPUESTA,
  T_SOLICITUD,
  VENDOR_URL,
  asegurarTablas,
  boton,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
} from "../../../../../lib/licitacion"
import { estadoCobro, ligaDePago, pesos, prepararCobro } from "../../../../../lib/licitacion-cobro"
import { avisarNoElegidos } from "../../../../../lib/licitacion-extra"
import { pushATalleres } from "../../../../../lib/push"
import { cambiarEtapa } from "../../../../../lib/seguimiento"

// El cliente elige una propuesta: se cierra la licitación, se decide cómo se
// cobra (directo al taller si conectó Mercado Pago o PayPal; si no, cobra
// HETNA) y se genera la liga del primer pago (anticipo o total).
export const POST = async (req: MedusaRequest<{ propuesta_id?: string }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  const propuestaId = String((req.body as any)?.propuesta_id || "")

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (s.estado !== "abierta") return res.status(409).json({ message: "Esta solicitud ya tiene una propuesta elegida." })

  const p = await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where({ "p.id": propuestaId, "p.solicitud_id": s.id })
    .first("p.*", "v.name as taller", "v.email as taller_email", "v.metadata as taller_metadata")
  if (!p) return res.status(404).json({ message: "Propuesta no encontrada." })

  // Sólo una elección: si dos pestañas eligen a la vez, gana la primera.
  const cambiadas = await knex.transaction(async (trx: any) => {
    const n = await trx(T_SOLICITUD)
      .where({ id: s.id, estado: "abierta" })
      .update({ estado: "elegida", propuesta_elegida: p.id, updated_at: knex.fn.now() })
    if (!n) return 0
    await trx(T_PROPUESTA).where({ solicitud_id: s.id }).update({ estado: "descartada", updated_at: knex.fn.now() })
    await trx(T_PROPUESTA).where({ id: p.id }).update({ estado: "elegida", updated_at: knex.fn.now() })
    return n
  })
  if (!cambiadas) return res.status(409).json({ message: "Esta solicitud ya tiene una propuesta elegida." })

  const folio = folioTexto(s.folio)
  const elegida = { ...s, estado: "elegida", propuesta_elegida: p.id }
  await cambiarEtapa(knex, s, "aceptada", { actor: "cliente", nota: `Elegiste la propuesta de ${p.taller}.`, correo: false }).catch(
    (e: Error) => logger.warn(`[seguimiento] no se pudo marcar aceptada: ${e.message}`)
  )

  // Cómo se cobra y primera liga de pago
  let pagoUrl: string | null = null
  let cobro: Awaited<ReturnType<typeof estadoCobro>> = null
  try {
    const { modo, pct, cuenta } = await prepararCobro(knex, elegida, p, logger)
    const conCobro = { ...elegida, cobro: modo, comision_pct: pct }
    cobro = await estadoCobro(knex, conCobro, { ...p, taller_email: p.taller_email }, cuenta)
    const metodo = cobro?.metodos.includes("mercadopago") ? "mercadopago" : cobro?.metodos.includes("paypal") ? "paypal" : null
    if (metodo) pagoUrl = (await ligaDePago(knex, conCobro, metodo, logger)).url
  } catch (e) {
    logger.error(`[licitacion] ${folio} no se pudo preparar el cobro: ${(e as Error).message}`)
  }

  res.json({ ok: true, pago_url: pagoUrl, cobro })

  const primerPago = cobro?.siguiente
  const resumen =
    `<table style="border-collapse:collapse;font-size:14px">` +
    fila("Folio", folio) +
    fila("Taller", p.taller) +
    fila("Precio", pesos(Number(p.precio))) +
    fila("Entrega", `${p.dias} días`) +
    (primerPago && primerPago.tipo === "anticipo" ? fila("Anticipo", `${pesos(primerPago.monto)} (${cobro?.anticipo_pct}%)`) : "") +
    `</table>`
  const directo = cobro?.modo === "taller"

  const avisos = [
    process.env.HETNA_LEADS_EMAIL && {
      to: process.env.HETNA_LEADS_EMAIL,
      subject: `[${folio}] El cliente eligió a ${p.taller}`,
      html: marco(
        "Propuesta elegida",
        resumen +
          `<table style="border-collapse:collapse;font-size:14px;margin-top:12px">` +
          fila("Cliente", s.contacto?.nombre || "") +
          fila("Correo", s.contacto?.email || "") +
          fila("Teléfono", s.contacto?.telefono || "") +
          fila("Cobro", directo ? `Directo al taller (${cobro?.metodos.join(" y ")}), sin comisión` : `Cobra HETNA y se transfiere completo al taller al confirmar la entrega`) +
          fila("Liga de pago", pagoUrl ? "Generada y enviada al cliente" : "NO se generó: mándala a mano") +
          `</table>`
      ),
    },
    p.taller_email && {
      to: p.taller_email,
      subject: `[${folio}] ¡El cliente eligió tu propuesta!`,
      html: marco(
        "¡Ganaste la solicitud!",
        resumen +
          `<p style="color:#40403A">${
            directo
              ? `El cliente te paga directo a tu ${esc(cobro?.metodos.includes("mercadopago") ? "Mercado Pago" : "PayPal")}. HETNA no cobra comisión: el pago es completo para ti.`
              : `El cliente le paga a HETNA y te transferimos cuando confirme que recibió, completo (HETNA no cobra comisión). Conecta tu Mercado Pago o PayPal en la app para cobrar directo la próxima vez.`
          }</p>` +
          `<p style="color:#40403A">Te avisaremos cuando el cliente pague. <strong>No inicies el trabajo antes de esa confirmación.</strong></p>` +
          boton("Ver en mi panel", `${VENDOR_URL}/solicitudes`)
      ),
    },
    s.contacto?.email && {
      to: s.contacto.email,
      subject: `[${folio}] Elegiste la propuesta de ${p.taller}`,
      html: marco(
        "¡Listo! Elegiste tu propuesta",
        resumen +
          (pagoUrl
            ? `<p style="color:#40403A">${
                primerPago?.tipo === "anticipo"
                  ? `Paga el anticipo de ${esc(pesos(primerPago.monto))} para que ${esc(p.taller)} empiece. El resto lo pagas desde tu misma liga cuando te lo pida.`
                  : `Paga de forma segura para que ${esc(p.taller)} empiece a fabricar.`
              }</p>` + boton("Pagar ahora", pagoUrl)
            : `<p style="color:#40403A">En breve te enviamos la liga de pago. El pago y el seguimiento de tu pedido se hacen dentro de HETNA.</p>`) +
          `<p style="color:#6B675C;font-size:13px;margin-top:16px">Tu pedido: <a href="${esc(ligaPropuestas(token))}">${esc(ligaPropuestas(token))}</a></p>`
      ),
    },
  ].filter(Boolean) as { to: string; subject: string; html: string }[]

  await pushATalleres(
    knex,
    [p.seller_id],
    { titulo: "¡Ganaste una solicitud!", cuerpo: `${folio}: el cliente eligió tu propuesta. No inicies hasta que confirme el pago.`, url: "/seller/solicitudes", etiqueta: `sol-${s.id}` },
    logger
  )
  for (const a of avisos) {
    const r = await sendEmail(a)
    if (!r.sent) logger.info(`[licitacion] aviso de elección no enviado: ${r.reason}`)
    await new Promise((r) => setTimeout(r, 600))
  }
  await avisarNoElegidos(knex, s, p, logger).catch((e: Error) => logger.warn(`[licitacion] aviso a no elegidos: ${e.message}`))
  logger.info(`[licitacion] ${folio} elegida propuesta ${p.id}; cobro ${cobro?.modo || "—"}; liga de pago: ${pagoUrl ? "sí" : "no"}`)
}
