"use server"

// Los packs por categoría de los talleres, contra /store/packs.
//
// No son productos ni un módulo aparte: son promociones `buyget` de Medusa que
// el backend ya aplica solo. Esto nada más las lee para poder decírselas al
// cliente, que es la parte que faltaba.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Pack = {
  promocion_id: string
  seller_id: string
  categorias: { id: string; nombre: string | null }[]
  lleva: number
  recibe: number
  tipo: string
  valor: number
  moneda: string | null
  gratis: boolean
}

export async function packsDeTalleres(sellerIds: string[]): Promise<Pack[]> {
  const ids = [...new Set(sellerIds.filter(Boolean))]
  if (!ids.length) return []

  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/packs?seller_ids=${encodeURIComponent(ids.join(","))}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": process.env
            .NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        },
        // Un pack no cambia de un minuto a otro y esto se pide desde la ficha y
        // desde el carrito: cachearlo cinco minutos evita una llamada por cada
        // cambio de cantidad.
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return []
    const { packs } = (await res.json()) as { packs: Pack[] }
    return packs || []
  } catch (e) {
    // Sin packs la tienda se usa igual. El aviso simplemente no sale.
    console.error("[packs] no se pudieron leer", e)
    return []
  }
}
