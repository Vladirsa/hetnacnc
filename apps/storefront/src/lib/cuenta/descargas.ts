"use server"

// Mi cuenta > Mis descargas: compras digitales que el cliente puede volver a
// bajar cuando quiera (ver packages/api/src/lib/mis-descargas.ts).
import { getAuthHeaders } from "@/lib/data/cookies"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export type CompraDigital = {
  product_id: string
  titulo: string
  thumbnail: string | null
  handle: string | null
  formato: string | null
  order_id: string
  display_id: number
  fecha: string
}

async function llamar(ruta: string) {
  const auth = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API}${ruta}`, { headers: { "x-publishable-api-key": PK, ...auth }, cache: "no-store" })
  return { res, body: await res.json().catch(() => ({})) }
}

export async function misDescargas(): Promise<CompraDigital[] | null> {
  try {
    const { res, body } = await llamar("/store/customers/me/descargas")
    return res.ok ? body.descargas || [] : null
  } catch {
    return null
  }
}

export async function ligaDescarga(productId: string): Promise<{ ok: true; url: string } | { ok: false; mensaje: string }> {
  if (!/^prod_[A-Za-z0-9]+$/.test(productId)) return { ok: false, mensaje: "Producto no válido." }
  try {
    const { res, body } = await llamar(`/store/customers/me/descargas/${productId}`)
    return res.ok && body.url ? { ok: true, url: body.url } : { ok: false, mensaje: body.message || "No pudimos preparar tu descarga." }
  } catch {
    return { ok: false, mensaje: "No pudimos preparar tu descarga. Intenta de nuevo." }
  }
}
