// GET  /vendor/hetna-solicitudes/:id/hitos  → hitos del pedido (con ligas a sus fotos)
// POST /vendor/hetna-solicitudes/:id/hitos  { clave, fecha_plan?, hecho?, nota? }
//
// Sólo el taller ganador y con el pago confirmado. Al marcar un hito como hecho
// se anota en el seguimiento del cliente y se le avisa por correo.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import { pushACliente } from "../../../../../lib/push"
import { boton, esc, folioTexto, ligaPropuestas, marco } from "../../../../../lib/licitacion"
import { anotar } from "../../../../../lib/seguimiento"
import { ErrorHito, actualizarHito, hitosDe } from "../../../../../lib/licitacion-hitos"
import { hitosConFotos, pedidoDelTaller } from "../../../../../lib/licitacion-hitos-pedido"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const r = await pedidoDelTaller(knex, String(req.params.id), sellerId)
  if (!r.ok) return res.status(r.error[0]).json({ message: r.error[1] })
  res.json({ hitos: await hitosConFotos(knex, r.s, r.inicio) })
}

export const POST = async (req: AuthenticatedMedusaRequest<{ clave?: string; fecha_plan?: string; hecho?: boolean; nota?: string }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const r = await pedidoDelTaller(knex, String(req.params.id), sellerId)
  if (!r.ok) return res.status(r.error[0]).json({ message: r.error[1] })
  const b = (req.body || {}) as any
  await hitosDe(knex, r.s, r.inicio)
  let out
  try {
    out = await actualizarHito(knex, r.s, String(b.clave || ""), b)
  } catch (e) {
    if (e instanceof ErrorHito) return res.status(e.status).json({ message: e.message })
    throw e
  }
  const hitos = await hitosConFotos(knex, r.s, r.inicio)
  res.json({ ok: true, hitos })

  if (!out.recienHecho) return
  // Hito terminado: queda en el seguimiento del cliente y le avisamos
  const h = hitos.find((x) => x.clave === out.hito.clave)!
  const s = r.s
  const folio = folioTexto(s.folio)
  const atraso = h.dias_diferencia != null && h.dias_diferencia > 0 ? ` (${h.dias_diferencia} ${h.dias_diferencia === 1 ? "día" : "días"} después de lo planeado)` : ""
  await anotar(knex, s.id, "taller", `${h.nombre}: listo${atraso}.${h.nota ? ` ${h.nota}` : ""}${h.fotos.length ? ` (${h.fotos.length} foto${h.fotos.length === 1 ? "" : "s"})` : ""}`).catch(() => null)
  await pushACliente(knex, { customerId: s.cliente_id, email: s.contacto?.email }, {
    titulo: `${h.nombre}: listo`,
    cuerpo: `${folio}: el taller terminó "${h.nombre}"${atraso}.`,
    url: ligaPropuestas(s.token),
    etiqueta: `hito-${s.id}`,
  }, logger)
  if (s.contacto?.email) {
    const m = await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] ${h.nombre}: listo`,
      html: marco(
        `${esc(h.nombre)}: listo`,
        `<p style="margin:0 0 12px;color:#40403A">El taller terminó esta etapa de tu pedido${esc(atraso)}.</p>` +
          (h.nota ? `<p style="margin:0 0 12px;color:#40403A;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(h.nota)}</p>` : "") +
          (h.fotos.length ? `<p style="margin:0 0 12px;color:#40403A">Subió ${h.fotos.length} foto${h.fotos.length === 1 ? "" : "s"}: las ves en tu pedido.</p>` : "") +
          boton("Ver el avance", ligaPropuestas(s.token))
      ),
    })
    if (!m.sent) logger.info(`[hitos] aviso no enviado (${folio}): ${m.reason}`)
  }
}
