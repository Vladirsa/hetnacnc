// Cada 3 horas: portada con IA a los artículos del blog que no tienen
// (lib/blog-portadas.ts). Pocos por vuelta para no gastar de golpe.
import { MedusaContainer } from "@medusajs/framework/types"

import { articulosSinPortada, generarPortada } from "../lib/blog-portadas"

const POR_VUELTA = 4

export default async function portadasBlog(container: MedusaContainer) {
  const logger = container.resolve("logger")
  if (!(process.env.FAL_KEY || "").trim() || process.env.BLOG_PORTADAS === "off") return
  try {
    const pendientes = await articulosSinPortada(container, POR_VUELTA)
    for (const a of pendientes) {
      try {
        await generarPortada(container, a)
        logger.info(`[portadas-blog] portada lista: ${a.slug}`)
      } catch (e) {
        logger.warn(`[portadas-blog] ${a.slug}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    logger.warn(`[portadas-blog] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "portadas-blog",
  schedule: "23 */3 * * *",
}
