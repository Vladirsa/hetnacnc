// Cada hora, dos redes de seguridad del seguimiento (ver lib/seguimiento):
//
//   1. Revisión vencida: si HETNA no revisó una solicitud en
//      LICITACION_REVISION_HORAS (24 por defecto), se aprueba sola. Un cliente
//      no puede quedarse esperando porque nadie abrió el dashboard.
//   2. Entrega sin confirmar: si el cliente no confirma que recibió su pedido
//      en DIAS_PARA_CERRAR días desde que el taller lo marcó entregado, se
//      cierra. Si hubo un problema, el cliente tuvo todo ese tiempo para
//      decirlo.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { aprobarSolicitud } from "../lib/difusion"
import { T_SOLICITUD, folioTexto } from "../lib/licitacion"
import { DIAS_PARA_CERRAR, asegurarSeguimiento, cambiarEtapa, horasRevision } from "../lib/seguimiento"

export default async function seguimientoSolicitudes(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurarSeguimiento(knex)

    const vencidas = (await knex(T_SOLICITUD)
      .where({ estado: "revision" })
      .where("created_at", "<=", new Date(Date.now() - horasRevision() * 3600e3))
      .limit(20)
      .select("*")) as any[]
    for (const s of vencidas) {
      const ok = await aprobarSolicitud(knex, logger, s, "sistema")
      if (ok) logger.info(`[seguimiento] ${folioTexto(s.folio)} aprobada sola: ${horasRevision()} h sin revisión`)
    }

    const entregadas = (await knex(T_SOLICITUD)
      .where({ etapa: "entregada" })
      .where("etapa_desde", "<=", new Date(Date.now() - DIAS_PARA_CERRAR * 864e5))
      .limit(50)
      .select("*")) as any[]
    for (const s of entregadas) {
      await cambiarEtapa(knex, s, "cerrada", {
        actor: "sistema",
        nota: `Se cerró sola ${DIAS_PARA_CERRAR} días después de la entrega.`,
        extra: { estado: "cerrada" },
        logger,
      })
    }
    if (vencidas.length || entregadas.length) {
      logger.info(`[seguimiento] aprobadas solas: ${vencidas.length}, cerradas tras entrega: ${entregadas.length}`)
    }
  } catch (e) {
    logger.error(`[seguimiento] falló la revisión periódica: ${(e as Error).message}`)
  }
}

export const config = {
  name: "seguimiento-solicitudes",
  schedule: "41 * * * *",
}
