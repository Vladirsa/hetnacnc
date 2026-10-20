import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../lib/resend"
import { T_PROPUESTA, T_SOLICITUD, VENDOR_URL, asegurarTablas, boton, consultarPago, fila, folioTexto, marco } from "../../../lib/licitacion"

// Aviso de Mercado Pago para pagos de licitación.
// No confiamos en el cuerpo: consultamos el pago a Mercado Pago con nuestra llave
// y solo aceptamos external_reference "licitacion:<id>" con monto y moneda correctos.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const pagoId = String(b?.data?.id || q["data.id"] || q.id || "")

  res.status(200).json({ ok: true }) // Mercado Pago solo necesita un 200 rápido
  if (tipo !== "payment" || !/^\d+$/.test(pagoId)) return

  try {
    const pago = await consultarPago(pagoId)
    const ref = String(pago.external_reference || "")
    if (!ref.startsWith("licitacion:")) return
    await asegurarTablas(knex)
    const s = await knex(T_SOLICITUD).where({ id: ref.slice("licitacion:".length) }).first()
    if (!s) return
    const folio = folioTexto(s.folio)

    if (pago.status !== "approved") {
      await knex(T_SOLICITUD).where({ id: s.id }).whereNot({ pago_estado: "pagado" }).update({ pago_estado: pago.status, pago_id: String(pago.id), updated_at: knex.fn.now() })
      logger.info(`[licitacion] ${folio} pago ${pago.id} en estado ${pago.status}`)
      return
    }
    if (s.pago_estado === "pagado") return // ya procesado

    const esperado = Number(s.pago_monto || 0)
    if (pago.currency_id !== "MXN" || Math.abs(Number(pago.transaction_amount || 0) - esperado) > 0.01) {
      logger.error(`[licitacion] ${folio} pago ${pago.id} con monto/moneda inesperado (${pago.transaction_amount} ${pago.currency_id}, esperado ${esperado} MXN)`)
      return
    }

    await knex(T_SOLICITUD).where({ id: s.id }).update({ pago_estado: "pagado", pago_id: String(pago.id), estado: "pagada", updated_at: knex.fn.now() })

    const p = await knex(`${T_PROPUESTA} as p`).join("seller as v", "v.id", "p.seller_id").where("p.id", s.propuesta_elegida).first("p.*", "v.name as taller", "v.email as taller_email")
    const resumen =
      `<table style="border-collapse:collapse;font-size:14px">` +
      fila("Folio", folio) + fila("Taller", p?.taller || "") +
      fila("Pagado", `$${esperado.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`) + fila("Pago Mercado Pago", String(pago.id)) +
      `</table>`

    const avisos = [
      process.env.HETNA_LEADS_EMAIL && { to: process.env.HETNA_LEADS_EMAIL, subject: `[${folio}] PAGADO · arrancar producción`, html: marco("Pago confirmado", resumen) },
      p?.taller_email && {
        to: p.taller_email,
        subject: `[${folio}] Pago confirmado: ya puedes fabricar`,
        html: marco("¡El cliente pagó! Ya puedes fabricar", resumen + `<p style="color:#40403A">Entrega comprometida: ${p.dias} días. Cuando termines, márcalo en tu panel para coordinar el envío con HETNA.</p>` + boton("Ver en mi panel", `${VENDOR_URL}/solicitudes`)),
      },
      s.contacto?.email && { to: s.contacto.email, subject: `[${folio}] Recibimos tu pago`, html: marco("¡Gracias! Recibimos tu pago", resumen + `<p style="color:#40403A">El taller ya está trabajando en tu pedido. Te avisaremos cuando salga el envío.</p>`) },
    ].filter(Boolean) as { to: string; subject: string; html: string }[]
    for (const a of avisos) {
      const r = await sendEmail(a)
      if (!r.sent) logger.info(`[licitacion] aviso de pago no enviado: ${r.reason}`)
      await new Promise((r) => setTimeout(r, 600))
    }
    logger.info(`[licitacion] ${folio} PAGADO (pago ${pago.id})`)
  } catch (e) {
    logger.error(`[licitacion] error procesando aviso de Mercado Pago ${pagoId}: ${(e as Error).message}`)
  }
}

// Mercado Pago a veces valida la URL con GET.
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })
