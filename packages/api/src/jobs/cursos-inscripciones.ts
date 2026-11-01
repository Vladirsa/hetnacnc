// Cada hora: inscribe a quien compró un curso y su pago se confirmó después
// de crear el pedido (lib/cursos.ts). Si ya está inscrito no hace nada.
import { MedusaContainer } from "@medusajs/framework/types"

import { inscribirFaltantes } from "../lib/cursos"

export default async function cursosInscripcionesJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const n = await inscribirFaltantes(container)
    if (n) logger.info(`[cursos] ${n} inscripciones por pedidos pagados`)
  } catch (e) {
    logger.error(`[cursos] no se pudieron revisar las inscripciones: ${(e as Error).message}`)
  }
}

export const config = {
  name: "cursos-inscripciones",
  schedule: "41 * * * *",
}
