// POST /store/solicitudes-taller/:token/recibido
// El cliente confirma que tiene su pedido: se cierra el proyecto.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, folioTexto } from "../../../../../lib/licitacion"
import { liquidacionTaller, pesos, propuestaElegida } from "../../../../../lib/licitacion-cobro"
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

  // Si cobró HETNA, toca transferirle al taller lo cobrado menos la comisión.
  // Si el cliente pagó directo al taller, sólo es aviso.
  const destino = process.env.HETNA_LEADS_EMAIL
  if (destino) {
    const folio = folioTexto(s.folio)
    const p = await propuestaElegida(knex, s).catch(() => null)
    // También en cobro directo: si el taller desconectó su cuenta, lo que
    // faltaba lo cobró HETNA y hay que liquidarlo.
    const liq = await liquidacionTaller(knex, s).catch(() => null)
    await sendEmail({
      to: destino,
      subject: liq && liq.aPagar > 0 ? `[${folio}] Liquidar al taller ${pesos(liq.aPagar)}` : `[${folio}] El cliente confirmó que recibió su pedido`,
      html:
        `<p>El cliente confirmó la entrega de ${folio}${p?.taller ? ` (${p.taller})` : ""}.</p>` +
        (liq && liq.aPagar > 0
          ? `<p>Cobrado por HETNA: <strong>${pesos(liq.cobrado)}</strong><br>Comisión HETNA (${s.comision_pct ?? "—"}%): <strong>${pesos(liq.comision)}</strong><br>Transferir al taller: <strong>${pesos(liq.aPagar)}</strong>${p?.taller_email ? ` (${p.taller_email})` : ""}</p>`
          : `<p>${s.cobro === "taller" ? "El cliente le pagó directo al taller" : "No hay pagos cobrados por HETNA"}: no hay nada que liquidar.</p>`),
    })
  }
}
