import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { corteComisiones } from "../lib/cotizador-comisiones"

// Día 1 de cada mes: cobro de la comisión HETNA de los anticipos que los
// talleres cobraron con PayPal el mes anterior (lib/cotizador-comisiones.ts).
// COTIZADOR_COMISIONES=off lo apaga.
export default async function cotizadorComisiones(container: MedusaContainer) {
  if ((process.env.COTIZADOR_COMISIONES || "").toLowerCase() === "off") return
  if (!process.env.COTIZADOR_SUPABASE_SERVICE_KEY) return
  const logger = container.resolve("logger")
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const n = await corteComisiones(logger, knex)
    if (n) logger.info(`[comisiones] ${n} cobro(s) de comisión PayPal creados`)
  } catch (e) {
    logger.error(`[comisiones] falló el corte: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cotizador-comisiones",
  // Día 1 a las 11:23 en Ciudad de México
  schedule: "23 17 1 * *",
}
