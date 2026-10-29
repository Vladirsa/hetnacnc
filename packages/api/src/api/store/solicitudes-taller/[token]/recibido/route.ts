// POST /store/solicitudes-taller/:token/recibido
// El cliente confirma que tiene su pedido: se cierra el proyecto.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, folioTexto } from "../../../../../lib/licitacion"
import { sendEmail } from "../../../../../lib/resend"
import { asegurarSeguimiento, cambiarEtapa, etapaDe } from "../../../../../lib/seguimiento"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })

  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (etapaDe(s) !== "entregada") {
    return res.status(409).json({ message: "Tu pedido todavía no está marcado como entregado." })
  }

  await cambiarEtapa(knex, s, "cerrada", {
    actor: "cliente",
    nota: "Confirmaste que recibiste tu pedido.",
    extra: { estado: "cerrada" },
    logger,
  })
  res.json({ ok: true })

  // HETNA libera el pago al taller cuando el cliente confirma.
  const destino = process.env.HETNA_LEADS_EMAIL
  if (destino) {
    await sendEmail({
      to: destino,
      subject: `[${folioTexto(s.folio)}] El cliente confirmó que recibió su pedido`,
      html: `<p>El cliente confirmó la entrega de ${folioTexto(s.folio)}. Ya se puede liquidar al taller.</p>`,
    })
  }
}
