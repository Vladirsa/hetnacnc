/**
 * Academia fase 1: los cursos creados antes de este cambio no tenían oferta
 * (no se podían comprar) ni precio guardado en el producto. Aquí se preparan
 * una sola vez con lib/cursos.ts (prepararVentaCurso): el precio sale de la
 * variante "Acceso completo"; sin precio queda como curso gratis.
 *
 * Corre sola en el `medusa db:migrate` del despliegue. Si algo falla, avisa en
 * el log y no detiene el despliegue.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { prepararVentaCurso } from "../lib/cursos"

export default async function cursosPrepararVenta({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data: cursos } = await query.graph({
      entity: "course",
      fields: ["id", "slug", "status", "seller_id", "thumbnail_url", "product.id", "product.metadata"],
    })
    let n = 0
    for (const c of cursos as any[]) {
      if (!c?.product?.id || !c.seller_id || c.product.metadata?.es_curso) continue
      try {
        const { data: prods } = await query.graph({
          entity: "product",
          fields: ["variants.prices.amount", "variants.prices.currency_code"],
          filters: { id: c.product.id },
        })
        const precios = ((prods[0] as any)?.variants?.[0]?.prices || []) as { amount: number; currency_code: string }[]
        const mxn = Number(precios.find((p) => p.currency_code === "mxn")?.amount) || 0
        await prepararVentaCurso(container, {
          productId: c.product.id,
          sellerId: c.seller_id,
          precio: mxn,
          thumbnail: c.thumbnail_url,
          slug: c.slug,
        publicado: c.status === "published",
        })
        n++
      } catch (e) {
        logger.warn(`[cursos] no se pudo preparar ${c.slug}: ${(e as Error).message}`)
      }
    }
    logger.info(`[cursos] ${n} cursos existentes preparados para la Academia`)
  } catch (e) {
    logger.warn(`[cursos] migración de cursos omitida: ${(e as Error).message}`)
  }
}
