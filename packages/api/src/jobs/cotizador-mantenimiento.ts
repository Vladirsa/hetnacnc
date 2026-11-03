import { MedusaContainer } from "@medusajs/framework/types"

import { avisosMantenimiento } from "../lib/cotizador-mantenimiento"

// Avisos de mantenimiento de máquinas del Cotizador (lib/cotizador-mantenimiento.ts).
// COTIZADOR_MANTENIMIENTO=off lo apaga.
export default async function cotizadorMantenimiento(container: MedusaContainer) {
  if ((process.env.COTIZADOR_MANTENIMIENTO || "").toLowerCase() === "off") return
  if (!process.env.COTIZADOR_SUPABASE_SERVICE_KEY) return
  const logger = container.resolve("logger")
  try {
    const n = await avisosMantenimiento(logger)
    if (n) logger.info(`[mantenimiento] avisos a ${n} taller(es)`)
  } catch (e) {
    logger.error(`[mantenimiento] falló la revisión: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cotizador-mantenimiento",
  // 8:17 en Ciudad de México, al empezar el día del taller
  schedule: "17 14 * * *",
}
