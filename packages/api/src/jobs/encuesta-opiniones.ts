// Cada día: encuesta corta («del 0 al 10, ¿nos recomendarías?») a talleres y
// clientes a los 7 días de registrarse. Una sola vez por cuenta. Ver lib/opiniones.ts
import { MedusaContainer } from "@medusajs/framework/types"

import { correrEncuestaNps, encuestaApagada } from "../lib/opiniones"

export default async function encuestaOpinionesJob(container: MedusaContainer) {
  if (encuestaApagada() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  try {
    const r = await correrEncuestaNps(container)
    if (r.talleres || r.clientes || r.fallidos) logger.info(`[opiniones] encuesta: talleres ${r.talleres}, clientes ${r.clientes}, fallidos ${r.fallidos}`)
  } catch (e) {
    logger.error(`[opiniones] encuesta falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "encuesta-opiniones",
  // 11:23 en Ciudad de México
  schedule: "23 17 * * *",
}
