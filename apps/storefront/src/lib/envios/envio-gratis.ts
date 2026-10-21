"use server"

// El umbral de envío gratis de cada taller, contra /store/envio-gratis.
//
// Sirve para una sola cosa: poder decirle al cliente, mientras tiene el carrito
// abierto, qué le falta para que un taller le mande gratis. El taller lo captura
// en su pantalla de Envíos y el backend ya cobra cero cuando el carrito pasa el
// monto; lo que faltaba era enseñarlo.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type UmbralDeTaller = {
  gratis_desde: number
  precio: number | null
}

export async function umbralesDeEnvioGratis(
  sellerIds: string[]
): Promise<Record<string, UmbralDeTaller>> {
  const ids = [...new Set(sellerIds.filter(Boolean))]
  if (!ids.length) return {}

  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/envio-gratis?seller_ids=${encodeURIComponent(ids.join(","))}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": process.env
            .NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        },
        // El umbral de un taller no cambia de un minuto a otro, y esto se pide
        // desde el carrito: cachearlo cinco minutos evita una llamada al
        // backend cada vez que alguien le sube la cantidad a un renglón.
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return {}
    const { talleres } = (await res.json()) as {
      talleres: Record<string, UmbralDeTaller>
    }
    return talleres || {}
  } catch (e) {
    // Sin esto el carrito se usa igual. La barra simplemente no sale.
    console.error("[envio-gratis] no se pudo leer", e)
    return {}
  }
}
