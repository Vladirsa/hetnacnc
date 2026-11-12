// @ts-nocheck
// GET /store/hetna-producto-extra?product_id=prod_...
//   -> { vistas_7d, video }  para la ficha de producto:
//      · vistas_7d: aperturas de la ficha en los últimos 7 días (módulo vistas;
//        cuenta aperturas, no personas)
//      · video: el video vertical que la Fábrica hizo de este producto para
//        redes (promoción o fecha especial), si ya existe
// Nunca falla hacia afuera: sin datos devuelve ceros y null.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = String((req.query as any)?.product_id || "")
  res.setHeader("Cache-Control", "public, max-age=600")
  if (!/^prod_[A-Za-z0-9]+$/.test(productId)) return res.json({ vistas_7d: 0, video: null })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const [vistas, video] = await Promise.all([
    knex("producto_vista").where({ product_id: productId }).where("dia", ">=", desde).whereNull("deleted_at").sum({ n: "total" }).first().catch(() => null),
    // Último video publicado (o aprobado) de una promoción de este producto
    knex("hetna_promo as pr")
      .where("pr.ref", productId)
      .where((w: any) => w.where("pr.tipo", "producto").orWhere("pr.tipo", "like", "temporada:%"))
      .orderBy("pr.created_at", "desc")
      .limit(3)
      .select("pr.posts")
      .then(async (filas: any[]) => {
        const ids = filas.flatMap((f) => (Array.isArray(f.posts) ? f.posts : [])).filter(Boolean)
        if (!ids.length) return null
        // Sólo lo ya publicado en redes (nada de borradores) y que no sea de una fecha que ya pasó
        const posts = await knex("hetna_social_post")
          .whereIn("id", ids)
          .whereIn("estado", ["publicada", "parcial"])
          .whereRaw("(vence is null or vence > now())")
          .orderBy("publicada_en", "desc")
          .select("medios")
        for (const p of posts) {
          const v = (Array.isArray(p.medios) ? p.medios : []).find((m: any) => m?.tipo === "video" && /^https:\/\//.test(String(m.url)))
          if (v) return v.url
        }
        return null
      })
      .catch(() => null),
  ])
  res.json({ vistas_7d: Number(vistas?.n) || 0, video })
}
