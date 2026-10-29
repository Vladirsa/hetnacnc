import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import {
  T_PROPUESTA,
  T_SOLICITUD,
  VENDOR_URL,
  asegurarTablas,
  boton,
  crearPreferenciaPago,
  esc,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
} from "../../../../../lib/licitacion"
import { cambiarEtapa } from "../../../../../lib/seguimiento"

// El cliente elige una propuesta: se cierra la licitación y se genera su liga de
// pago de Mercado Pago (si hay llave). El taller empieza cuando el pago se confirma.
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
    .first("p.*", "v.name as taller", "v.email as taller_email")
  if (!p) return res.status(404).json({ message: "Propuesta no encontrada." })

  await knex.transaction(async (trx: any) => {
    await trx(T_SOLICITUD).where({ id: s.id }).update({ estado: "elegida", propuesta_elegida: p.id, updated_at: knex.fn.now() })
    await trx(T_PROPUESTA).where({ solicitud_id: s.id }).update({ estado: "descartada", updated_at: knex.fn.now() })
    await trx(T_PROPUESTA).where({ id: p.id }).update({ estado: "elegida", updated_at: knex.fn.now() })
  })

  const folio = folioTexto(s.folio)
  const monto = Number(p.precio)
  await cambiarEtapa(knex, s, "aceptada", { actor: "cliente", nota: `Elegiste la propuesta de ${p.taller}.`, correo: false }).catch(
    (e: Error) => logger.warn(`[seguimiento] no se pudo marcar aceptada: ${e.message}`)
  )

  // Liga de pago
  let pagoUrl: string | null = null
  try {
    const pref = await crearPreferenciaPago({
      solicitudId: s.id,
      folio,
      titulo: `${folio} · Fabricación con ${p.taller} · HETNA CNC`,
      monto,
      email: s.contacto?.email,
      retorno: ligaPropuestas(token),
    })
    if (pref) {
      pagoUrl = pref.url
      await knex(T_SOLICITUD).where({ id: s.id }).update({ pago_url: pref.url, pago_estado: "pendiente", pago_monto: monto, updated_at: knex.fn.now() })
    }
  } catch (e) {
    logger.error(`[licitacion] ${folio} no se pudo crear la liga de pago: ${(e as Error).message}`)
  }

  res.json({ ok: true, pago_url: pagoUrl })

  const precio = `$${monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`
  const resumen =
    `<table style="border-collapse:collapse;font-size:14px">` +
    fila("Folio", folio) + fila("Taller", p.taller) + fila("Precio", precio) + fila("Entrega", `${p.dias} días`) +
    `</table>`

  const avisos = [
    process.env.HETNA_LEADS_EMAIL && {
      to: process.env.HETNA_LEADS_EMAIL,
      subject: `[${folio}] El cliente eligió a ${p.taller}`,
      html: marco("Propuesta elegida", resumen +
        `<table style="border-collapse:collapse;font-size:14px;margin-top:12px">` +
        fila("Cliente", s.contacto?.nombre || "") + fila("Correo", s.contacto?.email || "") + fila("Teléfono", s.contacto?.telefono || "") +
        fila("Liga de pago", pagoUrl ? "Generada y enviada al cliente" : "NO se generó: mándala a mano") +
        `</table>`),
    },
    p.taller_email && {
      to: p.taller_email,
      subject: `[${folio}] ¡El cliente eligió tu propuesta!`,
      html: marco("¡Ganaste la solicitud!", resumen +
        `<p style="color:#40403A">Te avisaremos cuando el cliente pague para que empieces a fabricar. <strong>No inicies el trabajo antes de esa confirmación.</strong></p>` +
        boton("Ver en mi panel", `${VENDOR_URL}/solicitudes`)),
    },
    s.contacto?.email && {
      to: s.contacto.email,
      subject: `[${folio}] Elegiste la propuesta de ${p.taller}`,
      html: marco("¡Listo! Elegiste tu propuesta", resumen +
        (pagoUrl
          ? `<p style="color:#40403A">Paga de forma segura con Mercado Pago, con tarjeta o los medios que te muestre al pagar. En cuanto se confirme tu pago, ${esc(p.taller)} empieza a fabricar.</p>` +
            boton("Pagar ahora", pagoUrl)
          : `<p style="color:#40403A">En breve te enviamos la liga de pago. El pago y el seguimiento de tu pedido se hacen dentro de HETNA.</p>`)),
    },
  ].filter(Boolean) as { to: string; subject: string; html: string }[]

  for (const a of avisos) {
    const r = await sendEmail(a)
    if (!r.sent) logger.info(`[licitacion] aviso de elección no enviado: ${r.reason}`)
    await new Promise((r) => setTimeout(r, 600))
  }
  logger.info(`[licitacion] ${folio} elegida propuesta ${p.id}; liga de pago: ${pagoUrl ? "sí" : "no"}`)
}
