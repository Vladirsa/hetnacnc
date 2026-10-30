// Mi cuenta > Mis descargas: las compras digitales del cliente, para bajarlas
// las veces que quiera. Cada descarga pide una liga firmada nueva y corta, en
// vez de depender de la de 7 días que llegó por correo.
//
// Sólo cuentan las órdenes pagadas (misma regla que la entrega por correo) y
// sólo las de SU cuenta (customer_id): no se cruza por correo electrónico,
// porque una cuenta nueva con el correo de otro podría bajar sus compras.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { archivoDeProducto } from "./digital-delivery"
import type { ArchivoEntrega } from "./pdf-entrega"

export type CompraDigital = {
  product_id: string
  titulo: string
  thumbnail: string | null
  handle: string | null
  formato: string | null
  order_id: string
  display_id: number
  fecha: string
  storage_key: string
}

const PAGADA = ["completed", "partially_captured"]

export async function comprasDigitales(container: MedusaContainer, customerId: string): Promise<CompraDigital[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: ordenes } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at", "status", "items.product_id", "items.title", "items.thumbnail", "payment_collections.status"],
    filters: { customer_id: customerId },
    pagination: { take: 300, order: { created_at: "DESC" } },
  })
  const pagadas = (ordenes as any[]).filter(
    (o) => o.status !== "canceled" && (o.payment_collections || []).some((pc: any) => PAGADA.includes(pc?.status))
  )
  const ids = [...new Set(pagadas.flatMap((o) => (o.items || []).map((i: any) => i?.product_id)).filter(Boolean))]
  if (!ids.length) return []

  const { data: productos } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "metadata"],
    filters: { id: ids },
  })
  const porId = new Map((productos as any[]).map((p) => [p.id, p]))

  // Un producto comprado dos veces aparece una vez, con la compra más reciente
  const lista: CompraDigital[] = []
  const vistos = new Set<string>()
  for (const o of pagadas) {
    for (const i of o.items || []) {
      const p = porId.get(i?.product_id)
      const m = (p?.metadata || {}) as Record<string, unknown>
      if (!p || vistos.has(p.id) || m.producto_digital !== true || !m.archivo_storage_key) continue
      vistos.add(p.id)
      const a = archivoDeProducto(p, i)
      lista.push({
        product_id: p.id,
        titulo: a.titulo,
        thumbnail: p.thumbnail || i.thumbnail || null,
        handle: p.handle || null,
        formato: a.formato || null,
        order_id: o.id,
        display_id: o.display_id,
        fecha: o.created_at,
        storage_key: String(m.archivo_storage_key),
      })
    }
  }
  return lista
}

// Los archivos digitales de UNA orden del cliente (para su comprobante PDF)
export async function archivosDeOrden(
  container: MedusaContainer,
  customerId: string,
  orderId: string
): Promise<{ orden: { id: string; display_id: number; created_at: string; email: string }; archivos: ArchivoEntrega[] } | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [o],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at", "email", "customer_id", "status", "items.product_id", "items.title", "payment_collections.status"],
    filters: { id: orderId },
  })
  const orden = o as any
  if (!orden || orden.customer_id !== customerId || orden.status === "canceled") return null
  if (!(orden.payment_collections || []).some((pc: any) => PAGADA.includes(pc?.status))) return null
  const ids = [...new Set((orden.items || []).map((i: any) => i?.product_id).filter(Boolean))]
  if (!ids.length) return null
  const { data: productos } = await query.graph({ entity: "product", fields: ["id", "title", "metadata"], filters: { id: ids as string[] } })
  const archivos: ArchivoEntrega[] = []
  const vistos = new Set<string>()
  for (const i of orden.items || []) {
    const p = (productos as any[]).find((x) => x.id === i?.product_id)
    const m = (p?.metadata || {}) as Record<string, unknown>
    if (!p || vistos.has(p.id) || m.producto_digital !== true || !m.archivo_storage_key) continue
    vistos.add(p.id)
    archivos.push(archivoDeProducto(p, i))
  }
  return archivos.length ? { orden, archivos } : null
}
