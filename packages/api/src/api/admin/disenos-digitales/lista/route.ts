// GET /admin/disenos-digitales/lista -> diseños digitales PUBLICADOS de la tienda, con su precio.
// Lo usan los flujos de n8n que los anuncian («Redes - Un diseño al día» y «Redes -
// Publicaciones para grupos de Telegram»). Antes leían la tabla digital_factory_productos
// de n8n, que tenía 55 diseños «publicados» cuando en la tienda había 7, y no veía los
// diseños subidos por otros caminos (Subir diseños, scripts/disenos). Sólo lee.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type DisenoLista = {
  id: string
  sku: string
  titulo: string
  handle: string
  resumen: string
  imagen_url: string
  formatos: string
  gratis: boolean
  precio_mxn: number
  creado: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: productos } = await query.graph({
    entity: "product",
    fields: ["id", "title", "subtitle", "handle", "thumbnail", "metadata", "created_at", "variants.id"],
    filters: { status: "published" } as any,
  })
  const digitales = (productos as any[]).filter((p) => {
    const m = p.metadata || {}
    return m.producto_digital === true || m.producto_digital === "true"
  })
  // La oferta (Mercur) cuelga de la variante: se busca por variant_id
  const productoDeVariante: Record<string, string> = {}
  for (const p of digitales) for (const v of p.variants || []) if (v?.id) productoDeVariante[v.id] = p.id
  const variantes = Object.keys(productoDeVariante)
  const precio: Record<string, number> = {}
  if (variantes.length) {
    const { data: ofertas } = await query.graph({
      entity: "offer",
      fields: ["id", "variant_id", "prices.amount", "prices.currency_code", "prices.min_quantity"],
      filters: { variant_id: variantes } as any,
    })
    for (const o of ofertas as any[]) {
      const pid = productoDeVariante[o.variant_id]
      const mxn = (o.prices || []).filter((x: any) => String(x?.currency_code || "").toLowerCase() === "mxn" && !(Number(x?.min_quantity) > 1))
      const monto = mxn.length ? Math.min(...mxn.map((x: any) => Number(x.amount) || 0)) : 0
      if (pid && monto > 0 && (!precio[pid] || monto < precio[pid])) precio[pid] = monto
    }
  }
  const disenos: DisenoLista[] = digitales
    .map((p) => {
      const m = p.metadata || {}
      return {
        id: p.id,
        sku: String(m.digital_factory_sku || p.id),
        titulo: String(p.title || ""),
        handle: String(p.handle || ""),
        resumen: String(p.subtitle || ""),
        imagen_url: String(p.thumbnail || ""),
        formatos: String(m.formatos || ""),
        gratis: m.archivo_gratis === true || m.archivo_gratis === "true",
        precio_mxn: precio[p.id] || 0,
        creado: new Date(p.created_at).toISOString(),
      }
    })
    // Sin precio y sin ser gratis no se puede anunciar (no se podría comprar)
    .filter((d) => d.handle && (d.gratis || d.precio_mxn > 0))
    .sort((a, b) => a.creado.localeCompare(b.creado))
  res.json({ total: disenos.length, disenos })
}
