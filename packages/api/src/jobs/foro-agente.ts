// Agente del foro y la Academia (lib/foro-agente.ts):
//   - cada 2 horas: borradores de respuesta para preguntas sin contestar
//   - los lunes a las 7 a. m.: artículo para la Academia (borrador) y tema para el foro
// Nada se publica solo: el dueño aprueba en Dashboard → Foro e IA.
import { MedusaContainer } from "@medusajs/framework/types"

import { correrInvestigador, correrRespondedor, foroAgenteApagado } from "../lib/foro-agente"

export default async function foroAgenteJob(container: MedusaContainer) {
  if (foroAgenteApagado()) return
  const logger = container.resolve("logger")
  try {
    const r = await correrRespondedor(container)
    if (r.nuevas) logger.info(`[foro-agente] ${r.nuevas} borrador(es) de respuesta`)
  } catch (e) {
    logger.error(`[foro-agente] respondedor: ${(e as Error).message}`)
  }
  // Lunes entre 7:00 y 8:59 hora de México (el job corre cada 2 horas, a los :41)
  const mx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
  if (mx.getDay() === 1 && mx.getHours() >= 7 && mx.getHours() < 9) {
    try {
      const r = await correrInvestigador(container)
      logger.info(`[foro-agente] investigador: ${r.ok ? r.titulo : r.motivo}`)
    } catch (e) {
      logger.error(`[foro-agente] investigador: ${(e as Error).message}`)
    }
  }
}

export const config = {
  name: "foro-agente",
  schedule: "41 */2 * * *",
}
