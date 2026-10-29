import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../../../../../lib/resend"
import {
  T_PROPUESTA, T_SOLICITUD, asegurarTablas, boton, fila, folioTexto, ligaPropuestas, marco, nuevoId, ocultarContacto, recibePropuestas,
} from "../../../../../lib/licitacion"
import { cambiarEtapa, etapaDe } from "../../../../../lib/seguimiento"

type Body = { precio?: number | string; dias?: number | string; vigencia_dias?: number | string; incluye_envio?: boolean | string; condiciones?: string }

// El taller manda (o actualiza) su propuesta a una solicitud.
export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  const b = (req.body || {}) as Body
  const precio = Number(String(b.precio ?? "").replace(/[^\d.]/g, ""))
  const dias = Math.round(Number(b.dias))
  const vigencia = Math.round(Number(b.vigencia_dias || 15))
  if (!(precio > 0) || precio > 50_000_000) return res.status(400).json({ message: "Escribe un precio válido." })
  if (!(dias >= 1 && dias <= 365)) return res.status(400).json({ message: "Escribe los días de entrega (1 a 365)." })
  const condiciones = ocultarContacto(String(b.condiciones ?? "").trim().slice(0, 1500))
  const incluye = b.incluye_envio === true || b.incluye_envio === "true" || b.incluye_envio === "si" ? "si" : "no"

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (s.estado !== "abierta") return res.status(409).json({ message: "Esta solicitud ya cerró." })
  if (s.modo === "directa" && s.taller_id !== sellerId) return res.status(403).json({ message: "Esta solicitud es para otro taller." })

  const previa = await knex(T_PROPUESTA).where({ solicitud_id: s.id, seller_id: sellerId }).first("id")
  // Pasada la fecha de cierre ya no entran propuestas nuevas; la que el taller
  // ya mandó sí la puede corregir mientras el cliente no elija.
  if (!previa && !recibePropuestas(s)) {
    return res.status(409).json({ message: "Esta solicitud ya cerró a propuestas nuevas." })
  }
  const datos = { precio, dias, vigencia_dias: vigencia, incluye_envio: incluye, condiciones, updated_at: knex.fn.now() }
  if (previa) {
    await knex(T_PROPUESTA).where({ id: previa.id }).update(datos)
  } else {
    await knex(T_PROPUESTA).insert({ id: nuevoId("prop"), solicitud_id: s.id, seller_id: sellerId, ...datos })
  }
  res.json({ ok: true, actualizada: Boolean(previa) })

  // La primera propuesta pasa la solicitud a "cotizada". Sin correo propio:
  // el aviso de propuesta nueva de abajo ya se lo dice al cliente.
  if (!previa && etapaDe(s) === "enviada_talleres") {
    await cambiarEtapa(knex, s, "cotizada", { actor: "taller", correo: false }).catch((e: Error) =>
      logger.warn(`[seguimiento] no se pudo marcar cotizada: ${e.message}`)
    )
  }

  // Aviso al cliente (solo la primera vez que este taller propone)
  if (!previa && s.contacto?.email) {
    const folio = folioTexto(s.folio)
    const r = await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] Recibiste una nueva propuesta`,
      html: marco(
        "Tienes una nueva propuesta",
        `<table style="border-collapse:collapse;font-size:14px">` +
          fila("Folio", folio) +
          fila("Precio", `$${precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`) +
          fila("Entrega", `${dias} días`) +
          `</table>` +
          boton("Comparar propuestas", ligaPropuestas(s.token))
      ),
    })
    if (!r.sent) logger.info(`[licitacion] aviso de propuesta no enviado: ${r.reason}`)
  }
}
