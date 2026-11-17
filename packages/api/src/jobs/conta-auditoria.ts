// Todos los días (7:43 a. m. hora del centro): loop de auditoría de la contabilidad.
// Actualiza las listas del SAT (semanal), revisa el estatus de las facturas en el
// SAT, corre las reglas fiscales y forenses y avisa por correo de los hallazgos graves.
// CONTA_AUDITORIA=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendEmail } from "../lib/resend"
import { esc, marco, boton } from "../lib/licitacion"
import { ADMIN_URL } from "../lib/seguimiento"
import { contribuyentes, correrAuditoria, refrescarListas } from "../lib/conta/loop"

export default async function contaAuditoria(container: MedusaContainer) {
  if (process.env.CONTA_AUDITORIA === "0") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    const lista = await contribuyentes(knex)
    if (!lista.length) return
    await refrescarListas(knex, logger)
    for (const ctb of lista) {
      const r = await correrAuditoria(knex, ctb, { consultarSat: true, logger })
      logger.info(`[conta] ${ctb.rfc}: ${r.revisadas} facturas, ${r.nuevos} hallazgos nuevos, ${r.cerrados} resueltos solos; SAT: ${r.estatus.revisados} revisadas, ${r.estatus.cancelados} canceladas`)
      const destino = ctb.dueno === "hetna" ? process.env.HETNA_LEADS_EMAIL : null
      if (destino && r.nuevos_alta.length) {
        const m = await sendEmail({
          to: destino,
          subject: `Contabilidad: ${r.nuevos_alta.length} ${r.nuevos_alta.length === 1 ? "hallazgo grave" : "hallazgos graves"} en tus facturas`,
          html: marco("El auditor encontró algo", `<ul style="color:#40403A;padding-left:18px">${r.nuevos_alta.slice(0, 10).map((h) => `<li style="margin-bottom:8px">${esc(h.mensaje)} <span style="color:#6B675C">(${esc(h.base_legal)})</span></li>`).join("")}</ul>` + boton("Ver la auditoría", `${ADMIN_URL}/contabilidad`)),
        })
        if (!m.sent) logger.info(`[conta] aviso no enviado: ${m.reason}`)
      }
    }
  } catch (e) {
    logger.error(`[conta] falló la auditoría: ${(e as Error).message}`)
  }
}

export const config = { name: "conta-auditoria", schedule: "43 13 * * *" }
