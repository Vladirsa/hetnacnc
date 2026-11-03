import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrMarketingCotizador, marketingCotizadorApagado } from "../lib/cotizador-marketing"

// Marketing del Cotizador en piloto automático (lib/cotizador-marketing.ts):
// seguimientos, último aviso, anticipo pendiente, gracias + reseña y
// reactivación. Correo sale solo; WhatsApp queda en "Cola de hoy".
// COTIZADOR_MARKETING=off lo apaga.
export default async function cotizadorMarketing(container: MedusaContainer) {
  if (marketingCotizadorApagado() || !process.env.COTIZADOR_SUPABASE_SERVICE_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const r = await correrMarketingCotizador(knex, logger)
    if (r.whatsapp || r.correos)
      logger.info(`[cotizador-marketing] ${r.talleres} taller(es): ${r.correos} correo(s), ${r.whatsapp} WhatsApp en cola`)
  } catch (e) {
    logger.error(`[cotizador-marketing] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cotizador-marketing",
  // 11:07 en Ciudad de México, después de los correos del Cotizador (10:47):
  // comparten el tope diario de Resend.
  schedule: "7 17 * * *",
}
