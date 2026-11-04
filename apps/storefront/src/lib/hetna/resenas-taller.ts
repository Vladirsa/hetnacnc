// Reseñas de un taller: sólo de trabajos pagados y entregados en HETNA
// (licitaciones). GET /store/hetna-resenas-taller?taller=<handle>
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type ResenaTaller = {
  calidad: number
  tiempo: number
  trato: number
  promedio: number
  comentario: string | null
  autor: string | null
  respuesta_taller: string | null
  fecha: string
  trabajo: string
}

export async function resenasDeTaller(handle: string): Promise<{ resenas: ResenaTaller[]; promedio: number | null; total: number }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-resenas-taller?taller=${encodeURIComponent(handle)}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 300 },
    })
    if (!res.ok) return { resenas: [], promedio: null, total: 0 }
    return await res.json()
  } catch {
    return { resenas: [], promedio: null, total: 0 }
  }
}
