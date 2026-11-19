// Cada día: recalcula la comisión de cursos de los instructores con artículos
// en el blog, para que los artículos de más de ACADEMIA_AUTOR_DIAS dejen de
// contar (lib/comision-autores.ts).
import type { MedusaContainer } from "@medusajs/framework/types"
import { MercurModules } from "@mercurjs/types"

import { servicioBlog } from "../lib/blog"
import { recalcularComisionAutor } from "../lib/comision-autores"

export default async function comisionAutoresJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const conArticulos = await servicioBlog(container).listLearningArticles({ seller_id: { $ne: null } } as any, { take: 5000, select: ["seller_id"] })
    const reglas = await (container.resolve(MercurModules.COMMISSION) as any).listCommissionRates({ code: { $like: "autor-cursos-%" } })
    const talleres = new Set<string>([
      ...conArticulos.map((a: any) => a.seller_id as string),
      ...reglas.map((r: any) => String(r.code).replace("autor-cursos-", "")),
    ])
    let cambios = 0
    for (const id of talleres) {
      try {
        await recalcularComisionAutor(container, id)
        cambios++
      } catch (e) {
        logger.warn(`[comision-autores] ${id}: ${(e as Error).message}`)
      }
    }
    if (cambios) logger.info(`[comision-autores] ${cambios} instructores revisados`)
  } catch (e) {
    logger.error(`[comision-autores] ${(e as Error).message}`)
  }
}

export const config = { name: "comision-autores", schedule: "41 6 * * *" }
