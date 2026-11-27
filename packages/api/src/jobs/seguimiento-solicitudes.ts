// Cada hora, dos redes de seguridad del seguimiento (ver lib/seguimiento):
//
//   1. Revisión vencida: si HETNA no revisó una solicitud en
//      LICITACION_REVISION_HORAS (24 por defecto), se aprueba sola. Un cliente
//      no puede quedarse esperando porque nadie abrió el dashboard. Si HETNA
//      le pidió información al cliente, el reloj se detiene y vuelve a correr
//      desde esa petición: se aprueba sola pasadas LICITACION_INFO_HORAS (72).
//   2. Entrega sin confirmar: si el cliente no confirma que recibió su pedido
//      en DIAS_PARA_CERRAR días desde que el taller lo marcó entregado, se
//      cierra. Si hubo un problema, el cliente tuvo todo ese tiempo para
//      decirlo. Las que tienen una disputa abierta (lib/disputa) NO se
//      cierran: HETNA media y decide. Al cerrar se avisa a HETNA para
//      liquidarle al taller, igual que cuando el cliente confirma.
//   3. WhatsApp al cliente («te estamos buscando el mejor taller») si no le
//      llegó al mandar su solicitud (lib/solicitud-whatsapp).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { aprobarSolicitud } from "../lib/difusion"
import { confirmarPendientes } from "../lib/solicitud-whatsapp"
import { T_SOLICITUD, folioTexto } from "../lib/licitacion"
import { avisarLiquidacion } from "../lib/liquidacion-aviso"
import { DIAS_PARA_CERRAR, asegurarSeguimiento, cambiarEtapa, horasEsperaInfo, horasRevision, revisionesVencidas } from "../lib/seguimiento"

export default async function seguimientoSolicitudes(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurarSeguimiento(knex)

    const vencidas = (await revisionesVencidas(knex)) as any[]
    for (const s of vencidas) {
      const ok = await aprobarSolicitud(knex, logger, s, "sistema")
      if (ok)
        logger.info(
          `[seguimiento] ${folioTexto(s.folio)} aprobada sola: ${s.info_pedida_en ? `${horasEsperaInfo()} h desde que se pidió información` : `${horasRevision()} h sin revisión`}`
        )
    }

    const entregadas = (await knex(T_SOLICITUD)
      .where({ etapa: "entregada" })
      .whereNull("disputa")
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
      await avisarLiquidacion(knex, s, `Se cerró sola (${DIAS_PARA_CERRAR} días sin que el cliente reportara un problema)`).catch((e) =>
        logger.error(`[seguimiento] ${folioTexto(s.folio)}: no se pudo avisar la liquidación: ${(e as Error).message}`)
      )
    }
    // 3. WhatsApp al cliente que no lo recibió al mandar su solicitud (lib/solicitud-whatsapp)
    const confirmadas = await confirmarPendientes(knex, logger).catch(() => 0)
    if (confirmadas) logger.info(`[seguimiento] confirmaciones por WhatsApp enviadas: ${confirmadas}`)

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
