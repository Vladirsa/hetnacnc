// POST /vendor/hetna-solicitudes/:id/avance
//   { tipo: "avance", nota }                         → el cliente lo ve en su liga y le llega por correo
//   { tipo: "entregada", paqueteria?, guia?, nota? } → etapa "entregada"
//
// Sólo el taller cuya propuesta se eligió, y sólo con el pago confirmado:
// antes de eso no hay pedido que avanzar.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import {
  T_PROPUESTA,
  T_SOLICITUD,
  boton,
  esc,
  folioTexto,
  ligaPropuestas,
  marco,
  ocultarContacto,
} from "../../../../../lib/licitacion"
import { anotar, asegurarSeguimiento, cambiarEtapa, etapaDe } from "../../../../../lib/seguimiento"

type Body = { tipo?: string; nota?: string; paqueteria?: string; guia?: string }

export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const elegida = s.propuesta_elegida
    ? await knex(T_PROPUESTA).where({ id: s.propuesta_elegida }).first("seller_id")
    : null
  if (!elegida || elegida.seller_id !== sellerId) {
    return res.status(403).json({ message: "Este pedido no es tuyo." })
  }
  if (s.estado !== "pagada" && s.pago_estado !== "pagado") {
    return res.status(409).json({ message: "El cliente todavía no paga. No empieces antes de la confirmación." })
  }

  const b = (req.body || {}) as Body
  // El taller escribe para el cliente: sin teléfonos ni correos, como en sus propuestas.
  const nota = ocultarContacto(String(b.nota || "").trim().slice(0, 1000))
  const folio = folioTexto(s.folio)

  if (b.tipo === "avance") {
    if (nota.length < 3) return res.status(400).json({ message: "Escribe el avance." })
    await anotar(knex, s.id, "taller", nota)
    res.json({ ok: true })
    if (s.contacto?.email) {
      const r = await sendEmail({
        to: s.contacto.email,
        subject: `[${folio}] Avance de tu pedido`,
        html: marco(
          "Hay un avance en tu pedido",
          `<p style="margin:0 0 12px;color:#40403A;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(nota)}</p>` +
            boton("Ver mi pedido", ligaPropuestas(s.token))
        ),
      })
      if (!r.sent) logger.info(`[seguimiento] aviso de avance no enviado (${folio}): ${r.reason}`)
    }
    return
  }

  if (b.tipo === "entregada") {
    if (etapaDe(s) === "entregada" || etapaDe(s) === "cerrada") {
      return res.status(409).json({ message: "Este pedido ya está marcado como entregado." })
    }
    const paqueteria = String(b.paqueteria || "").trim().slice(0, 60)
    const guia = String(b.guia || "").trim().slice(0, 80)
    await cambiarEtapa(knex, s, "entregada", {
      actor: "taller",
      nota: nota || (paqueteria ? `Enviado por ${paqueteria}.` : "Entregado."),
      extra: { paqueteria: paqueteria || null, guia: guia || null },
      logger,
    })
    const destino = process.env.HETNA_LEADS_EMAIL
    if (destino) {
      await sendEmail({
        to: destino,
        subject: `[${folio}] El taller marcó el pedido como entregado`,
        html: marco(`${folio} entregado`, `<p style="color:#40403A">${esc([paqueteria, guia].filter(Boolean).join(" · ") || "Sin guía")}</p>`),
      })
    }
    return res.json({ ok: true })
  }

  return res.status(400).json({ message: "Tipo de aviso no válido." })
}
