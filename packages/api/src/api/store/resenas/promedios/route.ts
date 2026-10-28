import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /store/resenas/promedios?product_ids=prod_1,prod_2,...
//
// El ⭐4.9 de las tarjetas, para una lista entera en UNA sola llamada. Pedir el
// promedio tarjeta por tarjeta serían 20 peticiones por pantalla, en la página
// donde más importa la velocidad.
//
// No se usa `getAvgRating` del servicio porque promedia TODAS las reseñas de un
// target, incluidas las pendientes y las rechazadas: el número público tiene que
// contar sólo las publicadas, igual que la lista de la ficha.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const crudo = String(req.query.product_ids || "")
  const ids = crudo.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60)

  if (!ids.length) {
    return res.json({ promedios: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // "product_review" es el alias de consulta del vínculo (aliasA_aliasB, como
  // product_sales_channel), NO el nombre de su tabla en la base. Con el nombre de
  // la tabla, Medusa contesta "Service with alias ... was not found".
  const { data: enlaces } = await query.graph({
    entity: "product_review",
    fields: ["product_id", "review.rating", "review.status"],
    filters: { product_id: ids },
  })

  const acumulado = new Map<string, { suma: number; total: number }>()

  for (const enlace of (enlaces || []) as unknown as {
    product_id?: string
    review?: { rating?: number; status?: string }
  }[]) {
    const id = enlace.product_id
    const resena = enlace.review
    if (!id || !resena || resena.status !== "published") continue
    const previo = acumulado.get(id) || { suma: 0, total: 0 }
    acumulado.set(id, {
      suma: previo.suma + (resena.rating || 0),
      total: previo.total + 1,
    })
  }

  const promedios: Record<string, { promedio: number; total: number }> = {}
  for (const [id, { suma, total }] of acumulado) {
    if (!total) continue
    promedios[id] = { promedio: Number((suma / total).toFixed(1)), total }
  }

  res.json({ promedios })
}
