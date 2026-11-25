// Impresión 3D bajo pedido: los talleres que imprimen un diseño
// (GET /store/impresion-ofertas, packages/api/src/lib/impresion-catalogo.ts).
export type OfertaImpresion = {
  offer_id: string
  variant_id: string
  material: string
  taller: { nombre: string; handle: string }
  precio: number
  dias: number | null
  colores: string[]
  destacado: boolean
  envio_gratis: boolean
  envio_gratis_desde: number | null
}
export type MaterialImpresion = { variant_id: string; material: string; gramos: number | null; recomendado: number | null }
export type DatosImpresion = {
  producto: { id: string; handle: string; titulo: string }
  materiales: MaterialImpresion[]
  ofertas: OfertaImpresion[]
}

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/** null si el producto no es de Impresión 3D bajo pedido o si el API no contestó. */
export async function datosImpresion(productId: string): Promise<DatosImpresion | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/impresion-ofertas?product_id=${encodeURIComponent(productId)}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return (await res.json()) as DatosImpresion
  } catch {
    return null
  }
}

/** ¿El producto es de Impresión 3D bajo pedido? (lo marca el script que lo publica) */
export const esImpresionBajoPedido = (metadata: unknown) =>
  !!metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).impresion_bajo_pedido === true
