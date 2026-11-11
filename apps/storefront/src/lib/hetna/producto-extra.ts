// Datos extra de la ficha de producto que ayudan a vender: cuántas veces se vio
// esta semana (aperturas reales de la ficha) y el video que la Fábrica hizo del
// producto para redes. Nunca falla: sin datos regresa ceros.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type ProductoExtra = { vistas_7d: number; video: string | null }

export async function productoExtra(productId: string): Promise<ProductoExtra> {
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-producto-extra?product_id=${encodeURIComponent(productId)}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      // No cambia de un minuto a otro: 10 minutos de caché para no frenar la ficha
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(2500),
    })
    if (!r.ok) return { vistas_7d: 0, video: null }
    const d = await r.json()
    return { vistas_7d: Number(d?.vistas_7d) || 0, video: typeof d?.video === "string" && /^https:\/\//.test(d.video) ? d.video : null }
  } catch {
    return { vistas_7d: 0, video: null }
  }
}
