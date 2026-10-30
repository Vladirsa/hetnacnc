import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correosCotizadorApagados, correrCorreosCotizador } from "../lib/cotizador-crm"

// Correos automáticos del Cotizador para talleres: bienvenida, "te quedan 4
// días de prueba", "terminó tu prueba" y "ya usaste tus 5 cotizaciones".
// Las reglas están en lib/cotizador-crm.ts. COTIZADOR_CORREOS=off los apaga.
export default async function cotizadorCorreos(container: MedusaContainer) {
  if (correosCotizadorApagados() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const r = await correrCorreosCotizador(knex, logger)
    const total = r.cot_bienvenida + r.cot_prueba_4 + r.cot_prueba_fin + r.cot_limite
    if (total)
      logger.info(
        `[cotizador-correos] enviados ${total} (bienvenida ${r.cot_bienvenida}, quedan días ${r.cot_prueba_4}, fin de prueba ${r.cot_prueba_fin}, límite ${r.cot_limite})`
      )
  } catch (e) {
    logger.error(`[cotizador-correos] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cotizador-correos",
  // 10:47 en Ciudad de México, después del marketing de la tienda (10:37):
  // comparten el tope diario de Resend y la tienda va primero.
  schedule: "47 16 * * *",
}
