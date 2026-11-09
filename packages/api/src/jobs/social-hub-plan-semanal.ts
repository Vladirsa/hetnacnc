// Cada domingo: arma el plan de la semana siguiente (Estrategia de Marketing
// HETNA) y el agente de contenido lo llena con borradores para revisar.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { generarPlan, llenarPlan } from "../lib/estrategia"

export default async function socialHubPlanSemanal(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const { semana, creados } = await generarPlan(knex)
    const { llenados } = await llenarPlan(knex, semana, logger, 80)
    logger.info(`[estrategia] plan de la semana ${semana}: ${creados} huecos nuevos, ${llenados} borradores`)
  } catch (e) {
    logger.error(`[estrategia] no se pudo armar el plan semanal: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-plan-semanal", schedule: "37 23 * * 0" }
