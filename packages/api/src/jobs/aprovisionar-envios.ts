// Cada 5 minutos revisa los talleres y deja listos sus envíos (ver lib/envios-automaticos.ts).
// Así un taller nuevo puede vender sin configurar nada técnico: en cuanto captura su
// dirección en /seller, a los pocos minutos ya tiene "Envío estándar" y "Entrega digital".
import { MedusaContainer } from "@medusajs/framework/types"

import { aprovisionarEnvios } from "../lib/envios-automaticos"

let enCurso = false

export default async function aprovisionarEnviosJob(container: MedusaContainer) {
  if (enCurso) return
  enCurso = true
  const logger = container.resolve("logger")
  try {
    const creadas = await aprovisionarEnvios(container, {
      log: (m: string) => logger.info(`[envios-auto] ${m}`),
    })
    if (creadas) logger.info(`[envios-auto] opciones de envío creadas: ${creadas}`)
  } catch (e) {
    logger.error(`[envios-auto] fallo: ${e}`)
  } finally {
    enCurso = false
  }
}

export const config = {
  name: "aprovisionar-envios-talleres",
  schedule: "*/5 * * * *",
}
