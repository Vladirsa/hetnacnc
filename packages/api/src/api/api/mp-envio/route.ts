import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../lib/resend"
import { STORE_URL, consultarPago, esc, fila, marco } from "../../../lib/licitacion"
import { T_ENVIO, asegurarTablasEnvio, folioEnvio } from "../../../lib/envios"
import { T_SOBREPESO, asegurarTablaSobrepesos, folioSobrepeso } from "../../../lib/sobrepesos"

// Aviso de Mercado Pago para pagos de Envíos HETNA (external_reference "envio:<id>").
// No confiamos en el cuerpo: consultamos el pago con nuestra llave y validamos monto y moneda.
const dir = (d: any) =>
  `${esc(d.nombre)}${d.empresa ? ` (${esc(d.empresa)})` : ""}<br>${esc(d.calle)}, Col. ${esc(d.colonia)}<br>${esc(d.municipio)}, ${esc(d.estado)}, C.P. ${esc(d.cp)}` +
  `${d.referencias ? `<br>Ref.: ${esc(d.referencias)}` : ""}<br>Tel. ${esc(d.telefono)} · ${esc(d.email)}`

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const q = (req.query || {}) as any
  const tipo = String(b.type || b.topic || q.type || q.topic || "")
  const pagoId = String(b?.data?.id || q["data.id"] || q.id || "")

  res.status(200).json({ ok: true })
  if (tipo !== "payment" || !/^\d+$/.test(pagoId)) return

  try {
    const pago = await consultarPago(pagoId)
    const ref = String(pago.external_reference || "")
    if (ref.startsWith("sobrepeso:")) return await pagoDeSobrepeso(knex, logger, pago, ref.slice("sobrepeso:".length))
    if (!ref.startsWith("envio:")) return
    await asegurarTablasEnvio(knex)
    const e = await knex(T_ENVIO).where({ id: ref.slice("envio:".length) }).first()
    if (!e) return
    const folio = folioEnvio(e.folio)

    if (pago.status !== "approved") {
      await knex(T_ENVIO).where({ id: e.id }).whereNot({ estado: "pagado" }).update({ pago_estado: pago.status, pago_id: String(pago.id), updated_at: knex.fn.now() })
      logger.info(`[envios] ${folio} pago ${pago.id} en estado ${pago.status}`)
      return
    }
    if (e.estado !== "pendiente_pago") return // ya procesado
    const esperado = Number(e.precio)
    if (pago.currency_id !== "MXN" || Math.abs(Number(pago.transaction_amount || 0) - esperado) > 0.01) {
      logger.error(`[envios] ${folio} pago ${pago.id} con monto/moneda inesperado (${pago.transaction_amount} ${pago.currency_id}, esperado ${esperado} MXN)`)
      return
    }
    await knex(T_ENVIO).where({ id: e.id }).update({ estado: "pagado", pago_estado: "pagado", pago_id: String(pago.id), updated_at: knex.fn.now() })

    const t = typeof e.tarifa === "string" ? JSON.parse(e.tarifa) : e.tarifa
    const o = typeof e.origen === "string" ? JSON.parse(e.origen) : e.origen
    const d = typeof e.destino === "string" ? JSON.parse(e.destino) : e.destino
    const p = typeof e.paquete === "string" ? JSON.parse(e.paquete) : e.paquete
    const precio = `$${esperado.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`
    const protegido = e.proteccion_valor ? Number(e.proteccion_valor) : 0
    const resumen =
      `<table style="border-collapse:collapse;font-size:14px">` +
      fila("Folio", folio) + fila("Paquetería", `${t.paqueteria} · ${t.servicio}`) + fila("Entrega estimada", t.dias ? `${t.dias} días hábiles` : "") +
      fila("Paquete", `${p.tipo} · ${p.largo}×${p.ancho}×${p.alto} cm · ${p.peso} kg`) + fila("Contenido", e.contenido) +
      (protegido ? fila("Protección", `Valor declarado $${protegido.toLocaleString("es-MX")} MXN`) : "") + fila("Pagado", precio) +
      `</table>`
    const direcciones =
      `<p style="margin:16px 0 4px;color:#6B675C">Remitente</p><p style="margin:0;color:#142033">${dir(o)}</p>` +
      `<p style="margin:16px 0 4px;color:#6B675C">Destinatario</p><p style="margin:0;color:#142033">${dir(d)}</p>`

    const avisos = [
      process.env.HETNA_LEADS_EMAIL && {
        to: process.env.HETNA_LEADS_EMAIL,
        subject: `[${folio}] PAGADO · generar guía ${t.paqueteria}${protegido ? " · CON PROTECCIÓN SOS" : ""}`,
        html: marco("Envío pagado: generar guía en Skydropx", resumen +
          (protegido
            ? `<p style="margin:16px 0 0;padding:12px;border-radius:8px;background:#FDECEA;color:#8A1C14;font-weight:bold">` +
              `⚠ Al generar la guía, activa SOS Protección con valor declarado de $${protegido.toLocaleString("es-MX")} MXN ` +
              `(el cliente pagó $${Number(e.proteccion_costo || 0).toLocaleString("es-MX")} por ella). Debe quedar activa ANTES de la recolección o de entregarlo en sucursal: ` +
              `después del primer movimiento ya no se puede contratar.</p>`
            : "") +
          direcciones +
          `<table style="border-collapse:collapse;font-size:13px;margin-top:16px">${fila("Costo Skydropx", `$${t.costo} MXN`)}${fila("Cotización Skydropx", e.cotizacion_id)}${fila("Tarifa", e.tarifa_id)}${fila("Pago MP", String(pago.id))}</table>`),
      },
      o.email && {
        to: o.email,
        subject: `[${folio}] Recibimos tu pago de envío`,
        html: marco("¡Gracias! Recibimos tu pago", resumen + direcciones +
          `<p style="color:#40403A;margin-top:16px">Estamos generando tu guía. Te la enviaremos por correo con el número de rastreo.</p>` +
          `<p style="color:#40403A;margin-top:12px"><strong>Antes de entregar el paquete:</strong> pega la guía y toma 4 fotos con la guía visible ` +
          `(alto, largo y ancho con la cinta métrica, y el paquete en la báscula). Súbelas en ` +
          `<a href="${STORE_URL}/mx/user/envios" style="color:#C2560A">Mis envíos</a>: si la paquetería reporta sobrepeso, ` +
          `son la prueba para pelearlo.</p>` +
          (protegido
            ? `<p style="color:#40403A;margin-top:12px"><strong>Tu envío va protegido.</strong> Si llega dañado, incompleto o se extravía: ` +
              `si el empaque viene abierto o alterado, recházalo con la paquetería; toma fotos y video del paquete con la guía visible y del contenido, ` +
              `y escríbenos con tu folio y la factura del producto dentro de las 48 horas hábiles después de recibirlo. Nosotros hacemos el reclamo.</p>`
            : "")),
      },
    ].filter(Boolean) as { to: string; subject: string; html: string }[]
    for (const a of avisos) {
      const r = await sendEmail(a)
      if (!r.sent) logger.info(`[envios] aviso de pago no enviado: ${r.reason}`)
      await new Promise((r) => setTimeout(r, 600))
    }
    logger.info(`[envios] ${folio} PAGADO (pago ${pago.id})`)
  } catch (err) {
    logger.error(`[envios] error procesando aviso de Mercado Pago ${pagoId}: ${(err as Error).message}`)
  }
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => res.status(200).json({ ok: true })

// Pago de un sobrepeso (external_reference "sobrepeso:<id>"): mismo cuidado que
// con los envíos, se valida monto y moneda contra lo registrado.
async function pagoDeSobrepeso(knex: any, logger: any, pago: any, id: string) {
  await asegurarTablaSobrepesos(knex)
  const s = await knex(T_SOBREPESO).where({ id }).first()
  if (!s) return
  const folio = folioSobrepeso(s.folio)
  if (pago.status !== "approved" || s.estado === "pagado") return
  if (pago.currency_id !== "MXN" || Math.abs(Number(pago.transaction_amount || 0) - Number(s.monto)) > 0.01) {
    logger.error(`[sobrepesos] ${folio} pago ${pago.id} con monto/moneda inesperado (${pago.transaction_amount} ${pago.currency_id})`)
    return
  }
  await knex(T_SOBREPESO).where({ id }).update({ estado: "pagado", pago_id: String(pago.id), updated_at: knex.fn.now() })
  logger.info(`[sobrepesos] ${folio} PAGADO (pago ${pago.id})`)
  if (process.env.HETNA_LEADS_EMAIL) {
    await sendEmail({
      to: process.env.HETNA_LEADS_EMAIL,
      subject: `[${folio}] Sobrepeso pagado · ${s.referencia}`,
      html: marco("Sobrepeso pagado", `<table style="border-collapse:collapse;font-size:14px">${fila("Folio", folio)}${fila("De", s.referencia)}${fila("Responsable", `${s.responsable_nombre || ""} ${s.responsable_email || ""}`)}${fila("Monto", `$${Number(s.monto)} MXN`)}${fila("Pago MP", String(pago.id))}</table>`),
    })
  }
}
