import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { corteComisiones } from "../lib/cotizador-comisiones"

// Día 1 de cada mes: cobro de la comisión HETNA de los anticipos que los
// talleres cobraron con PayPal el mes anterior (lib/cotizador-comisiones.ts).
// COTIZADOR_COMISIONES=off lo apaga.
//
// OJO: el job corre TODOS los días y sólo trabaja el día 1. No lo regreses a
// "23 17 1 * *". El planificador en memoria de Medusa 2.21 calcula la próxima
// corrida con setTimeout, y un mes (28-31 días) no cabe en su límite de 24.8
// días: Node lo reduce a 1 ms, el job se dispara, avanza otro mes, vuelve a
// desbordar... y se queda corriendo sin parar (TimeoutOverflowWarning en
// pm2 logs hetna-api y CPU alto). Un día sí cabe.
export default async function cotizadorComisiones(container: MedusaContainer) {
  if ((process.env.COTIZADOR_COMISIONES || "").toLowerCase() === "off") return
  // 17:23 UTC = 11:23 en Ciudad de México, el mismo día en ambos husos.
  if (new Date().getUTCDate() !== 1) return
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
  // Diario a las 11:23 en Ciudad de México; el día 1 se filtra arriba.
  schedule: "23 17 * * *",
}
