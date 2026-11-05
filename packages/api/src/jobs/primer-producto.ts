// Cada día: correo "publica tu primer producto" a los talleres aprobados que
// aún no tienen productos (lib/primer-producto.ts).
// Para ver a quién le tocaría sin mandar nada: src/scripts/probar-primer-producto.ts
import { MedusaContainer } from "@medusajs/framework/types"

import { correrPrimerProducto, primerProductoApagado } from "../lib/primer-producto"

export default async function primerProductoJob(container: MedusaContainer) {
  if (primerProductoApagado() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  try {
    const r = await correrPrimerProducto(container)
    if (r.enviados || r.fallidos || r.baja)
      logger.info(`[primer-producto] enviados ${r.enviados}, de baja ${r.baja}, fallidos ${r.fallidos} (de ${r.pendientes} pendientes)`)
  } catch (e) {
    logger.error(`[primer-producto] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "primer-producto",
  // 11:13 en Ciudad de México, después del marketing a clientes
  schedule: "13 17 * * *",
}
