import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import { T_PROPUESTA, T_SOLICITUD, VENDOR_URL, asegurarTablas, boton, esc, fila, folioTexto, marco } from "../../../../../lib/licitacion"
import { ErrorContra, crearContraoferta } from "../../../../../lib/licitacion-versiones"
import { pushATalleres } from "../../../../../lib/push"

const pesosMx = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

// POST /store/solicitudes-taller/:token/contraoferta { propuesta_id, precio?, dias?, mensaje? }
// El cliente le propone al taller el precio y/o los días que le funcionan. El taller
// la acepta (su propuesta toma esos valores como versión nueva), la rechaza o corrige.
export const POST = async (req: MedusaRequest<{ propuesta_id?: string; precio?: unknown; dias?: unknown; mensaje?: unknown }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  const b = (req.body || {}) as any
  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const p = await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where({ "p.id": String(b.propuesta_id || ""), "p.solicitud_id": s.id })
    .first("p.*", "v.name as taller", "v.email as taller_email")
  if (!p) return res.status(404).json({ message: "Propuesta no encontrada." })
  let c
  try {
    c = await crearContraoferta(knex, s, p, b)
  } catch (e) {
    if (e instanceof ErrorContra) return res.status(e.status).json({ message: e.message })
    throw e
  }
  res.json({ ok: true, contraoferta: { id: c.id, estado: c.estado } })

  // Aviso al taller (notificación del panel y correo)
  const folio = folioTexto(s.folio)
  const pide = [c.precio != null ? pesosMx(Number(c.precio)) : null, c.dias != null ? `${c.dias} días` : null].filter(Boolean).join(" · ")
  await pushATalleres(knex, [p.seller_id], {
    titulo: "Contraoferta del cliente",
    cuerpo: `${folio}: ${pide || "te dejó un mensaje"}. Acéptala, recházala o corrige tu propuesta.`,
    url: `${VENDOR_URL}/solicitudes`,
    etiqueta: `ctra-${s.id}`,
  }, logger)
  if (p.taller_email) {
    const r = await sendEmail({
      to: p.taller_email,
      subject: `[${folio}] El cliente te mandó una contraoferta`,
      html: marco(
        "El cliente te mandó una contraoferta",
        `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Folio", folio) +
          fila("Tu propuesta", `${pesosMx(Number(p.precio))} · ${p.dias} días`) +
          (c.precio != null ? fila("Precio que pide", pesosMx(Number(c.precio))) : "") +
          (c.dias != null ? fila("Días que pide", `${c.dias} días`) : "") +
          (c.mensaje ? fila("Mensaje", esc(c.mensaje)) : "") +
          `</table>` +
          `<p style="margin:12px 0;color:#40403A">Puedes aceptarla (tu propuesta se actualiza sola), rechazarla con una nota o corregir tu propuesta.</p>` +
          boton("Responder en mi panel", `${VENDOR_URL}/solicitudes`)
      ),
    })
    if (!r.sent) logger.info(`[licitacion] aviso de contraoferta no enviado: ${r.reason}`)
  }
}
