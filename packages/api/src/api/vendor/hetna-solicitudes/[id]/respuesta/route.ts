import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import {
  MOTIVOS_RESPUESTA,
  T_RESPUESTA,
  T_SOLICITUD,
  asegurarTablaRespuestas,
  asegurarTablas,
  boton,
  fila,
  folioTexto,
  ligaPropuestas,
  marco,
  nuevoId,
  ocultarContacto,
} from "../../../../../lib/licitacion"

type Body = { motivo?: string; nota?: string }

// POST /vendor/hetna-solicitudes/:id/respuesta  { motivo, nota }
//
// El taller dice que no puede cotizar, y por qué. Sirve para dos cosas:
// la solicitud deja de aparecerle en "por cotizar", y HETNA sabe qué falta
// en la red (nadie trabaja ese material, nadie tiene capacidad esta semana).
// "mas_info" no es un no: le llega a HETNA para que aclare con el cliente.
//
// DELETE la deshace (se equivocó de botón).
export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const b = (req.body || {}) as Body
  const motivo = String(b.motivo || "")
  if (!MOTIVOS_RESPUESTA[motivo]) return res.status(400).json({ message: "Elige un motivo." })
  const nota = ocultarContacto(String(b.nota || "").trim().slice(0, 1000))
  if (motivo === "mas_info" && nota.length < 5) {
    return res.status(400).json({ message: "Escribe qué información necesitas." })
  }

  await asegurarTablas(knex)
  await asegurarTablaRespuestas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (s.modo === "directa" && s.taller_id !== sellerId) {
    return res.status(403).json({ message: "Esta solicitud es para otro taller." })
  }

  await knex(T_RESPUESTA)
    .insert({ id: nuevoId("resp"), solicitud_id: s.id, seller_id: sellerId, motivo, nota: nota || null })
    .onConflict(["solicitud_id", "seller_id"])
    .merge({ motivo, nota: nota || null, created_at: knex.fn.now() })
  res.json({ ok: true })

  // Un "necesito más información", y cualquier no a una solicitud dirigida a
  // ese taller, le llega a HETNA: es quien habla con el cliente.
  const destino = process.env.HETNA_LEADS_EMAIL
  if (destino && (motivo === "mas_info" || s.modo === "directa")) {
    let taller = sellerId
    try {
      const fila0 = await knex("seller").where({ id: sellerId }).first("name")
      if (fila0?.name) taller = fila0.name
    } catch {}
    const folio = folioTexto(s.folio)
    const r = await sendEmail({
      to: destino,
      subject: `[${folio}] ${taller}: ${MOTIVOS_RESPUESTA[motivo]}`,
      html: marco(
        `${taller} respondió a ${folio}`,
        `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Respuesta", MOTIVOS_RESPUESTA[motivo]) +
          fila("Nota", nota) +
          fila("Cliente", s.contacto?.email || "") +
          fila("WhatsApp", s.contacto?.whatsapp || s.contacto?.telefono || "") +
          `</table>` +
          boton("Ver la solicitud del cliente", ligaPropuestas(s.token))
      ),
    })
    if (!r.sent) logger.info(`[licitacion] aviso de respuesta no enviado: ${r.reason}`)
  }
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarTablaRespuestas(knex)
  await knex(T_RESPUESTA).where({ solicitud_id: String(req.params.id), seller_id: sellerId }).delete()
  res.json({ ok: true })
}
