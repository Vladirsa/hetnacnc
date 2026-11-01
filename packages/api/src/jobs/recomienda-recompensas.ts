import type { MedusaContainer } from "@medusajs/framework/types"

import { asegurarBienvenida, darRecompensas } from "../lib/cupones"

// Recomienda y gana (lib/cupones.ts): una vez al día revisa a los amigos
// recomendados que ya compraron y le manda su cupón a quien los recomendó.
// También se asegura de que exista la promoción BIENVENIDA.
export default async function recomiendaRecompensas(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await asegurarBienvenida(container)
  } catch (e) {
    logger.warn(`[cupones] no se pudo asegurar BIENVENIDA: ${(e as Error).message}`)
  }
  if ((process.env.RECOMIENDA || "").toLowerCase() === "off") return
  try {
    const r = await darRecompensas(container)
    if (r.dadas) logger.info(`[recomienda] ${r.dadas} recompensa(s) entregada(s) de ${r.revisados} amigo(s) revisado(s)`)
  } catch (e) {
    logger.error(`[recomienda] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "recomienda-recompensas",
  // 11:13 en Ciudad de México
  schedule: "13 17 * * *",
}
