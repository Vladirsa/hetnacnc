// POST /vendor/hetna-solicitudes/:id/acceso  { mensaje? }
// Licitaciones 3.0 (Fase 1): el taller pide al cliente ver los planos o la
// descripción completa de una licitación restringida (o con archivos "bajo
// autorización"). El cliente aprueba o rechaza desde su liga privada.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas, boton, esc, folioTexto, ligaPropuestas, marco, ocultarContacto, recibePropuestas } from "../../../../../lib/licitacion"
import { T_ACCESO, asegurarPrivacidad, relacionTaller, tallerPuedeVer } from "../../../../../lib/licitacion-privacidad"
import { pushACliente } from "../../../../../lib/push"
import { sendEmail } from "../../../../../lib/resend"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  await asegurarTablas(knex)
  await asegurarPrivacidad(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const rel = await relacionTaller(knex, s, sellerId)
  if (!tallerPuedeVer(s, rel)) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (!recibePropuestas(s) && !rel.propuso) return res.status(409).json({ message: "Esta solicitud ya cerró." })
  if (rel.acceso === "aprobado") return res.json({ ok: true, acceso: "aprobado" })
  if (rel.acceso === "pendiente") return res.json({ ok: true, acceso: "pendiente" })

  const mensaje = ocultarContacto(String(((req.body || {}) as { mensaje?: string }).mensaje || "").trim()).slice(0, 500)
  await knex(T_ACCESO)
    .insert({ solicitud_id: s.id, seller_id: sellerId, estado: "pendiente", mensaje: mensaje || null })
    .onConflict(["solicitud_id", "seller_id"])
    .merge({ estado: "pendiente", mensaje: mensaje || null, created_at: knex.fn.now(), resuelto_en: null })
  res.json({ ok: true, acceso: "pendiente" })

  // Aviso al cliente
  const taller = await knex("seller").where({ id: sellerId }).first("name").catch(() => null)
  const folio = folioTexto(s.folio)
  const liga = `${ligaPropuestas(s.token)}#accesos`
  await pushACliente(
    knex,
    { customerId: s.cliente_id, email: s.contacto?.email },
    { titulo: "Un taller pide ver tus planos", cuerpo: `${folio}: ${taller?.name || "Un taller"} quiere ver los archivos para cotizarte. Apruébalo o recházalo.`, url: liga, etiqueta: `sol-${s.id}` },
    logger
  )
  if (s.contacto?.email) {
    await sendEmail({
      to: s.contacto.email,
      subject: `[${folio}] Un taller pide ver tus planos`,
      html: marco(
        "Un taller quiere ver tus archivos",
        `<p style="color:#40403A"><strong>${esc(taller?.name || "Un taller")}</strong> pide acceso a los planos y la descripción completa de tu solicitud ${esc(folio)} para darte un precio exacto.</p>` +
          (mensaje ? `<p style="margin:0 0 12px;color:#142033;background:#F3F1EA;padding:10px 12px;border-radius:8px">${esc(mensaje)}</p>` : "") +
          `<p style="color:#40403A">Tú decides: sólo los talleres que apruebes podrán descargarlos.</p>` +
          boton("Aprobar o rechazar", liga)
      ),
    }).catch(() => undefined)
  }
}
