// Cada hora: descarga masiva de CFDI del SAT para los contribuyentes con e.firma guardada.
// Una vez al día pide emitidos y recibidos de los últimos 3 días; cada hora revisa
// las solicitudes pendientes y mete lo descargado. CONTA_DESCARGA_SAT=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_CONTRIBUYENTE } from "../lib/conta/almacen"
import { avanzar, conEfirma, planDiario } from "../lib/conta/descarga"

export default async function contaDescargaSat(container: MedusaContainer) {
  if (process.env.CONTA_DESCARGA_SAT === "0" || !process.env.CONTA_EFIRMA_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    for (const { contribuyente_id } of await conEfirma(knex)) {
      const ctb = await knex(T_CONTRIBUYENTE).where({ id: contribuyente_id }).first()
      if (!ctb) continue
      const pedidas = await planDiario(knex, ctb)
      for (const p of pedidas) if (!p.ok) logger.warn(`[conta-sat] ${ctb.rfc}: ${p.mensaje}`)
      const r = await avanzar(knex, ctb, logger)
      if (r.revisadas) logger.info(`[conta-sat] ${ctb.rfc}: ${r.revisadas} solicitudes revisadas, ${r.nuevos} facturas nuevas`)
    }
  } catch (e) {
    logger.error(`[conta-sat] falló: ${(e as Error).message}`)
  }
}

export const config = { name: "conta-descarga-sat", schedule: "37 * * * *" }
