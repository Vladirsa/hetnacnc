// POST /store/solicitudes-taller/:token/acceso  { seller_id, decision: "aprobar" | "rechazar" }
// El cliente decide qué taller puede ver sus planos y la descripción completa
// (Licitaciones 3.0, Fase 1). La liga privada del cliente es su llave.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, VENDOR_URL, asegurarTablas, boton, esc, folioTexto, marco } from "../../../../../lib/licitacion"
import { T_ACCESO, asegurarPrivacidad } from "../../../../../lib/licitacion-privacidad"
import { pushATalleres } from "../../../../../lib/push"
import { sendEmail } from "../../../../../lib/resend"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  await asegurarTablas(knex)
  await asegurarPrivacidad(knex)
  const s = await knex(T_SOLICITUD).where({ token: String(req.params.token || "") }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const b = (req.body || {}) as { seller_id?: string; decision?: string }
  const decision = b.decision === "aprobar" ? "aprobado" : b.decision === "rechazar" ? "rechazado" : null
  if (!decision || !b.seller_id) return res.status(400).json({ message: "Falta el taller o la decisión." })
  const n = await knex(T_ACCESO)
    .where({ solicitud_id: s.id, seller_id: String(b.seller_id) })
    .update({ estado: decision, resuelto_en: knex.fn.now() })
  if (!n) return res.status(404).json({ message: "Ese taller no pidió acceso." })
  res.json({ ok: true, estado: decision })

  const folio = folioTexto(s.folio)
  const aprobado = decision === "aprobado"
  await pushATalleres(
    knex,
    [String(b.seller_id)],
    {
      titulo: aprobado ? "El cliente te dio acceso a los planos" : "El cliente no autorizó el acceso",
      cuerpo: aprobado ? `${folio}: ya puedes descargar los archivos y mandar tu propuesta.` : `${folio}: puedes cotizar con la información pública o hacer una pregunta.`,
      url: "/seller/solicitudes",
      etiqueta: `sol-${s.id}`,
    },
    logger
  )
  const t = await knex("seller").where({ id: String(b.seller_id) }).first("email").catch(() => null)
  if (t?.email) {
    await sendEmail({
      to: t.email,
      subject: `[${folio}] ${aprobado ? "Tienes acceso a los planos" : "Acceso no autorizado"}`,
      html: marco(
        aprobado ? "Ya puedes ver los planos" : "El cliente no autorizó el acceso",
        `<p style="color:#40403A">${aprobado ? `El cliente aprobó que veas los archivos y la descripción completa de ${esc(folio)}.` : `Para ${esc(folio)} el cliente prefirió no compartir los archivos. Puedes cotizar con la información pública o hacerle una pregunta.`}</p>` +
          boton("Abrir mi panel", `${VENDOR_URL}/solicitudes`)
      ),
    }).catch(() => undefined)
  }
}
