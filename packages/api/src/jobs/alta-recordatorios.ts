// Cada día: reenvía la liga de confirmar a talleres que no confirmaron su
// correo (días 1, 3 y 7), felicita a quien publicó su primer producto y manda
// al dueño por Telegram la lista de talleres a medio registro.
// Ver lib/alta-recordatorios.ts
import { MedusaContainer } from "@medusajs/framework/types"

import { altaRecordatoriosApagado, correrAltaRecordatorios } from "../lib/alta-recordatorios"

export default async function altaRecordatoriosJob(container: MedusaContainer) {
  if (altaRecordatoriosApagado() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  try {
    const r = await correrAltaRecordatorios(container)
    if (r.confirmar || r.felicitados || r.fallidos || r.atorados.length)
      logger.info(`[alta-recordatorios] confirmar ${r.confirmar}, felicitados ${r.felicitados}, fallidos ${r.fallidos}, atorados ${r.atorados.length}`)
  } catch (e) {
    logger.error(`[alta-recordatorios] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "alta-recordatorios",
  // 10:47 en Ciudad de México
  schedule: "47 16 * * *",
}
