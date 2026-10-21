"use server"

// Promociones automáticas por taller, contra /store/promociones/talleres.
//
// Sirven para una sola cosa: poder decirle al cliente, mientras tiene el
// carrito abierto, qué le falta para que un taller le mande gratis. El
// descuento ya lo sabe aplicar el backend; lo que faltaba era enseñarlo.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type EnvioGratis = {
  umbral: number
  atributo: string
  moneda: string | null
  promocion_id: string
}

export type Volumen = {
  min_piezas: number
  tipo: string
  valor: number
  moneda: string | null
  promocion_id: string
}

export type PromosDeTaller = {
  envio_gratis: EnvioGratis | null
  volumen: Volumen[]
}

export async function promocionesDeTalleres(
  sellerIds: string[]
): Promise<Record<string, PromosDeTaller>> {
  const ids = [...new Set(sellerIds.filter(Boolean))]
  if (!ids.length) return {}

  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/promociones/talleres?seller_ids=${encodeURIComponent(ids.join(","))}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": process.env
            .NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        },
        // Una promoción no cambia de un minuto a otro, y esto se pide desde el
        // carrito: cachearlo cinco minutos evita una llamada al backend por
        // cada vez que alguien le sube la cantidad a un renglón.
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return {}
    const { talleres } = (await res.json()) as {
      talleres: Record<string, PromosDeTaller>
    }
    return talleres || {}
  } catch (e) {
    // Sin promociones el carrito se usa igual. La barra simplemente no sale.
    console.error("[promociones] no se pudieron leer", e)
    return {}
  }
}
