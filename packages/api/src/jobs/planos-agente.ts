// Agente de la Biblioteca de planos (lib/planos-agente.ts): cada lunes a las
// 7:23 del centro de México investiga, diseña 10 planos nuevos y los deja como
// borradores en Dashboard → Planos IA. Se apaga con PLANOS_AGENTE_APAGADO=1.
import { MedusaContainer } from "@medusajs/framework/types"

import { agenteApagado, correrAgentePlanos, hayIaPlanos } from "../lib/planos-agente"

export default async function planosAgente(container: MedusaContainer) {
  const logger = container.resolve("logger")
  if (agenteApagado() || !hayIaPlanos()) return
  const r = await correrAgentePlanos(container)
  if (!r.ok) logger.warn(`[planos-agente] ${r.motivo}`)
}

export const config = { name: "planos-agente", schedule: "23 13 * * 1" }
