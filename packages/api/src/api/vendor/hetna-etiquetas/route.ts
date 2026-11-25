// Etiquetas de producto para impresoras térmicas (panel del taller › Etiquetas,
// apps/vendor/src/routes/etiquetas). Devuelve lo que va en la etiqueta de cada
// oferta del taller: nombre, presentación, SKU, precio y la liga a su ficha.
// Sólo lee; la etiqueta se arma e imprime en el navegador.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const MONEDA = "mxn"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: ofertas }, { data: sellers }] = await Promise.all([
    query.graph({
      entity: "offer",
      fields: ["id", "sku", "product.id", "product.title", "product.handle", "product.thumbnail", "product.status", "product_variant.title", "prices.amount", "prices.currency_code", "prices.min_quantity"],
      filters: { seller_id: sellerId } as any,
    }),
    query.graph({ entity: "seller", fields: ["id", "name", "handle"], filters: { id: sellerId } }),
  ])
  const productos = (ofertas as any[])
    .filter((o) => o.product && o.product.status !== "rejected")
    .map((o) => {
      const base = (o.prices || []).find((p: any) => String(p?.currency_code).toLowerCase() === MONEDA && (p.min_quantity == null || Number(p.min_quantity) <= 1))
      const variante = String(o.product_variant?.title || "")
      return {
        offer_id: o.id as string,
        sku: String(o.sku || ""),
        titulo: String(o.product.title || ""),
        variante: /^(única|default|presentación única)$/i.test(variante) ? "" : variante,
        precio: base ? Number(base.amount) : null,
        handle: String(o.product.handle || ""),
        imagen: o.product.thumbnail || null,
      }
    })
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "es") || a.variante.localeCompare(b.variante, "es"))
  const s = (sellers as any[])[0] || {}
  res.json({ taller: { nombre: s.name || "", handle: s.handle || "" }, productos })
}
