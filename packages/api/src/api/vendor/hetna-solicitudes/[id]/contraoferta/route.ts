import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import { pushACliente } from "../../../../../lib/push"
import { T_SOLICITUD, asegurarTablas, boton, esc, fila, folioTexto, ligaPropuestas, marco } from "../../../../../lib/licitacion"
import { ErrorContra, responderContraoferta } from "../../../../../lib/licitacion-versiones"

// POST /vendor/hetna-solicitudes/:id/contraoferta { contraoferta_id, accion: "aceptar" | "rechazar", nota? }
// Aceptar: la propuesta toma el precio y los días que pidió el cliente (versión nueva).
// Rechazar: queda como está y el cliente ve la nota del taller.
export const POST = async (req: AuthenticatedMedusaRequest<{ contraoferta_id?: string; accion?: string; nota?: string }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const b = (req.body || {}) as any
  const accion = b.accion === "aceptar" ? "aceptar" : b.accion === "rechazar" ? "rechazar" : null
  if (!accion) return res.status(400).json({ message: "Elige aceptar o rechazar." })
  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  let r
  try {
    r = await responderContraoferta(knex, s, sellerId, String(b.contraoferta_id || ""), accion, b.nota)
  } catch (e) {
    if (e instanceof ErrorContra) return res.status(e.status).json({ message: e.message })
    throw e
  }
  res.json({ ok: true, estado: r.contra.estado })

  // Aviso al cliente con la respuesta
  const folio = folioTexto(s.folio)
  const acepto = accion === "aceptar"
  await pushACliente(knex, { customerId: s.cliente_id, email: s.contacto?.email }, {
    titulo: acepto ? "El taller aceptó tu contraoferta" : "El taller respondió tu contraoferta",
    cuerpo: acepto ? `${folio}: su propuesta ya tiene el precio y los días que pediste.` : `${folio}: mantiene su propuesta.${r.contra.nota_taller ? ` "${r.contra.nota_taller}"` : ""}`,
    url: ligaPropuestas(s.token),
    etiqueta: `ctra-${s.id}`,
  }, logger)
  if (s.contacto?.email) {
    const m = await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] ${acepto ? "El taller aceptó tu contraoferta" : "El taller respondió tu contraoferta"}`,
      html: marco(
        acepto ? "El taller aceptó tu contraoferta" : "El taller respondió tu contraoferta",
        `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Folio", folio) +
          (acepto ? r.cambios.map((c) => fila(c.campo, `${c.antes} → ${c.despues}`)).join("") : fila("Respuesta", "Mantiene su propuesta")) +
          (r.contra.nota_taller ? fila("Nota del taller", esc(r.contra.nota_taller)) : "") +
          `</table>` +
          boton("Ver propuestas", ligaPropuestas(s.token))
      ),
    })
    if (!m.sent) logger.info(`[licitacion] aviso de respuesta a contraoferta no enviado: ${m.reason}`)
  }
}
