// POST /store/solicitudes-taller/:token/problema  { tipo, detalle }
// El cliente reporta un problema con su trabajo (cancelar, retraso, defecto,
// otro). Se abre una disputa: la solicitud deja de cerrarse sola, HETNA retiene
// lo cobrado y media. Ver lib/disputa.ts.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  DIAS_HABILES_DECISION_DISPUTA,
  ETAPAS_REPORTABLES,
  NOMBRE_PROBLEMA,
  TIPOS_PROBLEMA,
  TipoProblema,
  escaparHtml,
  fechaPrometida,
  queSigue,
  retrasoCancelable,
} from "../../../../../lib/disputa"
import { T_SOLICITUD, folioTexto } from "../../../../../lib/licitacion"
import { propuestaElegida } from "../../../../../lib/licitacion-cobro"
import { sendEmail } from "../../../../../lib/resend"
import { ADMIN_URL, anotar, asegurarSeguimiento, etapaDe } from "../../../../../lib/seguimiento"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })

  const b = (req.body || {}) as { tipo?: string; detalle?: string }
  const tipo = String(b.tipo || "") as TipoProblema
  const detalle = String(b.detalle || "").trim().slice(0, 2000)
  if (!(TIPOS_PROBLEMA as readonly string[]).includes(tipo)) {
    return res.status(400).json({ message: "Elige qué tipo de problema es." })
  }
  if (detalle.length < 10) {
    return res.status(400).json({ message: "Cuéntanos qué pasó (al menos una frase)." })
  }

  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  const etapa = etapaDe(s)
  if (!(ETAPAS_REPORTABLES as readonly string[]).includes(etapa)) {
    return res.status(409).json({
      message: etapa === "cerrada" || etapa === "cancelada"
        ? "Este proyecto ya terminó. Si necesitas ayuda, escríbenos."
        : "Todavía no eliges taller. Si ya no quieres seguir, simplemente no elijas ninguna propuesta.",
    })
  }
  if (s.disputa) {
    return res.status(409).json({ message: "Ya reportaste un problema y HETNA lo está revisando. Te escribimos pronto." })
  }

  const p = await propuestaElegida(knex, s).catch(() => null)
  const prometida = await fechaPrometida(knex, s, p).catch(() => null)
  const sigue = queSigue(tipo, etapa, retrasoCancelable(prometida))

  // Marca la disputa sólo si nadie se adelantó (doble clic, dos pestañas).
  const n = await knex(T_SOLICITUD)
    .where({ id: s.id })
    .whereNull("disputa")
    .update({ disputa: tipo, disputa_desde: new Date(), disputa_detalle: detalle })
  if (!n) return res.status(409).json({ message: "Ya reportaste un problema y HETNA lo está revisando." })

  await anotar(knex, s.id, "cliente", `Reportaste un problema: ${NOMBRE_PROBLEMA[tipo]}. ${sigue}`)
  res.json({ ok: true, que_sigue: sigue })

  const folio = folioTexto(s.folio)
  const avisos: Promise<unknown>[] = []
  const hetna = process.env.HETNA_LEADS_EMAIL
  if (hetna) {
    avisos.push(
      sendEmail({
        to: hetna,
        subject: `[${folio}] Disputa: ${NOMBRE_PROBLEMA[tipo]}`,
        html:
          `<p><strong>${NOMBRE_PROBLEMA[tipo]}</strong> en ${folio}${p?.taller ? ` (${escaparHtml(p.taller)})` : ""}. Etapa: ${etapa}. Cobro: ${s.cobro || "—"}.</p>` +
          `<p>${escaparHtml(detalle).replace(/\n/g, "<br>")}</p>` +
          (prometida ? `<p>Fecha prometida: ${prometida.toISOString().slice(0, 10)}</p>` : "") +
          `<p>Lo que se le dijo al cliente: ${escaparHtml(sigue)}</p>` +
          `<p>No liberes pagos al taller hasta resolver. Plazo para decidir: ${DIAS_HABILES_DECISION_DISPUTA} días hábiles.</p>` +
          `<p><a href="${ADMIN_URL}">Abrir el dashboard</a></p>`,
      })
    )
  }
  if (p?.taller_email) {
    avisos.push(
      sendEmail({
        to: p.taller_email,
        subject: `[${folio}] El cliente reportó un problema`,
        html:
          `<p>El cliente de la solicitud ${folio} reportó: <strong>${NOMBRE_PROBLEMA[tipo]}</strong>.</p>` +
          `<p>HETNA va a mediar. Responde a este correo con tu versión y tu evidencia (fotos, guía de envío, mensajes, acuerdo SafeDeal). ` +
          `Decidimos en un máximo de ${DIAS_HABILES_DECISION_DISPUTA} días hábiles; mientras tanto el pago que cobró HETNA queda retenido.</p>`,
        ...(hetna ? { responderA: hetna } : {}),
      })
    )
  }
  const r = await Promise.allSettled(avisos)
  for (const x of r) if (x.status === "rejected") logger.error(`[problema] ${folio}: no se pudo avisar: ${x.reason}`)
}
