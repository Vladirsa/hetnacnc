// Cada mañana (10:37, centro de México): si la campaña "verifica tu WhatsApp"
// está prendida, manda el lote de correos del día (lib/invitar-whatsapp).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { seguirCampana } from "../lib/invitar-whatsapp"

export default async function invitarWhatsapp(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const r = await seguirCampana(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
    if (r) logger.info(`[wa-invitacion] ${r.enviados} correos${r.quedan ? "" : " · campaña terminada"}`)
  } catch (e) {
    logger.error(`[wa-invitacion] ${(e as Error).message}`)
  }
}

export const config = { name: "invitar-whatsapp", schedule: "37 16 * * *" }
