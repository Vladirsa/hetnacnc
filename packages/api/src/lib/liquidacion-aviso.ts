// Aviso a HETNA para liquidarle al taller lo que HETNA cobró por él, cuando una
// solicitud se cierra. Antes sólo lo mandaba la confirmación del cliente
// (/recibido); si la solicitud se cerraba sola a los DIAS_PARA_CERRAR días de
// la entrega, nadie avisaba y el taller podía quedarse sin cobrar.
import { folioTexto } from "./licitacion"
import { liquidacionTaller, pesos, propuestaElegida } from "./licitacion-cobro"
import { sendEmail } from "./resend"

export async function avisarLiquidacion(knex: any, s: any, motivo: string): Promise<void> {
  const destino = process.env.HETNA_LEADS_EMAIL
  if (!destino) return
  const folio = folioTexto(s.folio)
  const p = await propuestaElegida(knex, s).catch(() => null)
  // También en cobro directo: si el taller desconectó su cuenta, lo que
  // faltaba lo cobró HETNA y hay que liquidarlo.
  const liq = await liquidacionTaller(knex, s).catch(() => null)
  await sendEmail({
    to: destino,
    subject: liq && liq.aPagar > 0 ? `[${folio}] Liquidar al taller ${pesos(liq.aPagar)}` : `[${folio}] Solicitud cerrada`,
    html:
      `<p>${motivo} ${folio}${p?.taller ? ` (${p.taller})` : ""}.</p>` +
      (liq && liq.aPagar > 0
        ? `<p>Cobrado por HETNA: <strong>${pesos(liq.cobrado)}</strong><br>Comisión HETNA (${s.comision_pct ?? "—"}%): <strong>${pesos(liq.comision)}</strong><br>Transferir al taller: <strong>${pesos(liq.aPagar)}</strong>${p?.taller_email ? ` (${p.taller_email})` : ""}</p>`
        : `<p>${s.cobro === "taller" ? "El cliente le pagó directo al taller" : "No hay pagos cobrados por HETNA"}: no hay nada que liquidar.</p>`),
  })
}
