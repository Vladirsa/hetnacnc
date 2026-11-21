// Cada martes y viernes: busca SVG con licencia libre (Wikimedia Commons) para
// publicarlos como descarga gratis. Nada se publica solo. Ver lib/disenos-gratis.ts
import { MedusaContainer } from "@medusajs/framework/types"

import { correrDisenosGratis, disenosGratisApagado } from "../lib/disenos-gratis"

export default async function disenosGratisJob(container: MedusaContainer) {
  if (disenosGratisApagado()) return
  const logger = container.resolve("logger")
  try {
    const r = await correrDisenosGratis(container)
    logger.info(`[disenos-gratis] ${r.nuevos} candidato(s) nuevo(s) (${r.temas.join(", ")})`)
  } catch (e) {
    logger.error(`[disenos-gratis] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "disenos-gratis",
  // 6:19 en Ciudad de México, martes y viernes
  schedule: "19 12 * * 2,5",
}
