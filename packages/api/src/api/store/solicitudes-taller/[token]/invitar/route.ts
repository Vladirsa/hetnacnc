// POST /store/solicitudes-taller/:token/invitar  { talleres: ["handle", ...] }
// El cliente invita talleres a su licitación (privada, o para que no se la
// pierdan en una pública/restringida). Licitaciones 3.0, Fase 1.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, VENDOR_URL, asegurarTablas, boton, esc, folioTexto, marco, recibePropuestas } from "../../../../../lib/licitacion"
import { invitarTalleres } from "../../../../../lib/licitacion-privacidad"
import { pushATalleres } from "../../../../../lib/push"
import { sendEmail } from "../../../../../lib/resend"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ token: String(req.params.token || "") }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (!recibePropuestas(s)) return res.status(409).json({ message: "Tu solicitud ya no recibe propuestas." })
  const talleres = await invitarTalleres(knex, s.id, ((req.body || {}) as { talleres?: unknown }).talleres)
  if (!talleres.length) return res.status(400).json({ message: "No encontré esos talleres. Escribe el nombre de su tienda como aparece en su liga (hetnacnc.com/mx/talleres/nombre)." })
  res.json({ ok: true, invitados: talleres.map((t) => t.name) })

  const folio = folioTexto(s.folio)
  await pushATalleres(
    knex,
    talleres.map((t) => t.id),
    { titulo: "Te invitaron a cotizar", cuerpo: `${folio}: un cliente quiere tu propuesta. Ábrela en tu panel.`, url: "/seller/solicitudes", etiqueta: `sol-${s.id}` },
    logger
  )
  for (const t of talleres) {
    if (!t.email) continue
    await sendEmail({
      to: t.email,
      subject: `[${folio}] Te invitaron a cotizar un trabajo`,
      html: marco(
        `${esc(t.name)}: te invitaron a cotizar`,
        `<p style="color:#40403A">Un cliente te invitó a su licitación ${esc(folio)}. Revísala y manda tu precio y tiempo de entrega desde tu panel.</p>` +
          boton("Ver la solicitud", `${VENDOR_URL}/solicitudes`)
      ),
    }).catch(() => undefined)
    await new Promise((r) => setTimeout(r, 500))
  }
}
