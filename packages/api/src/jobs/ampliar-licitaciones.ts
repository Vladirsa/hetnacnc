// Cada hora: solicitudes abiertas que siguen sin ninguna propuesta se mandan a
// más talleres (a las 48 h) y, a 24 h del cierre, se amplían 3 días y se avisa
// al cliente y a HETNA. Ver lib/licitacion-ampliar. AMPLIAR_LICITACIONES=0 lo apaga.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarTablas } from "../lib/licitacion"
import { asegurarSeguimiento } from "../lib/seguimiento"
import { asegurarPrivacidad } from "../lib/licitacion-privacidad"
import { ampliar, porAmpliar } from "../lib/licitacion-ampliar"

export default async function ampliarLicitaciones(container: MedusaContainer) {
  if (process.env.AMPLIAR_LICITACIONES === "0") return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurarTablas(knex)
    await asegurarSeguimiento(knex)
    await asegurarPrivacidad(knex)
    for (const { s, ronda } of await porAmpliar(knex)) {
      await ampliar(knex, logger, s, ronda).catch((e: Error) => logger.error(`[ampliar] ${s.id}: ${e.message}`))
    }
  } catch (e) {
    logger.error(`[ampliar] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "ampliar-licitaciones",
  schedule: "53 * * * *",
}
