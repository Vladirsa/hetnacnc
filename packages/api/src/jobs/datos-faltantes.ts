// Cada semana: correo "Completa tus datos" a los talleres a los que les falta
// llenar su perfil o la ficha de sus productos (lib/datos-faltantes.ts).
// Máximo uno cada 7 días por taller; respeta la baja de correos.
import { MedusaContainer } from "@medusajs/framework/types"

import { correrDatosFaltantes, datosFaltantesApagado } from "../lib/datos-faltantes"

export default async function datosFaltantesJob(container: MedusaContainer) {
  if (datosFaltantesApagado() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  try {
    const r = await correrDatosFaltantes(container)
    if (r.enviados || r.fallidos || r.baja)
      logger.info(`[datos-faltantes] enviados ${r.enviados}, de baja ${r.baja}, fallidos ${r.fallidos} (de ${r.pendientes} pendientes)`)
  } catch (e) {
    logger.error(`[datos-faltantes] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "datos-faltantes",
  // Martes 10:37 en Ciudad de México (16:37 UTC): lejos del lunes lleno de correos
  schedule: "37 16 * * 2",
}
