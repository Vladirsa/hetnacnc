// Cada día: el agente SEO revisa algunos productos (autocompletado de Google +
// Claude), mejora los títulos de la tienda de HETNA y deja sugerencias a los
// talleres. Ver lib/seo-titulos.ts
import { MedusaContainer } from "@medusajs/framework/types"

import { correrAgenteSeo, seoApagado } from "../lib/seo-titulos"

export default async function agenteSeoJob(container: MedusaContainer) {
  if (seoApagado()) return
  const logger = container.resolve("logger")
  try {
    const r = await correrAgenteSeo(container)
    if (r.revisados) logger.info(`[seo] revisados ${r.revisados}, aplicados ${r.aplicados}, sugeridos ${r.sugeridos}`)
  } catch (e) {
    logger.error(`[seo] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "agente-seo",
  // 4:27 en Ciudad de México: de madrugada, cuando casi nadie visita
  schedule: "27 10 * * *",
}
