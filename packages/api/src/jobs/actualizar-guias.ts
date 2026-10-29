// Cada 30 minutos: termina las guías que quedaron generándose (Skydropx tarda
// en dar la etiqueta), marca como enviados los pedidos que faltaron, y sigue
// el rastreo hasta marcar el pedido como entregado.
import { MedusaContainer } from "@medusajs/framework/types"

import { actualizarGuias } from "../lib/guias"

export default async function actualizarGuiasJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const { revisadas, entregadas } = await actualizarGuias(container)
    if (entregadas) logger.info(`[guias] ${revisadas} guías revisadas, ${entregadas} entregadas`)
  } catch (e) {
    logger.error(`[guias] no se pudieron revisar las guías: ${(e as Error).message}`)
  }
}

export const config = {
  name: "actualizar-guias",
  schedule: "17,47 * * * *",
}
