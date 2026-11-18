"use server"

// "Avísame cuando haya": llama a POST /store/hetna-aviso-existencia desde el servidor.
import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function pedirAvisoExistencia(d: { productId: string; variantId?: string | null; email: string }): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-aviso-existencia`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ product_id: d.productId, variant_id: d.variantId || undefined, email: d.email }),
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: body.message || "No se pudo guardar. Intenta de nuevo." }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: "No se pudo guardar. Intenta de nuevo." }
  }
}
