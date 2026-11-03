// Cotizador en línea de cada taller (hetnacnc.com/t/<slug>), contra
// /api/taller-publico del backend (packages/api/src/lib/cotizador-en-linea.ts).

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type TipoPublico = { id: string; nombre: string; estimable: boolean; medidas: "2d" | "3d" | "ninguna" }
export type ServicioPublico = { id: string; nombre: string; emoji: string; descripcion: string; tipos: TipoPublico[] }
export type TallerPublico = {
  slug: string
  nombre: string
  titulo: string
  descripcion: string
  ciudad: string
  logo: string | null
  sitio: string | null
  whatsapp: string | null
  moneda: "MXN" | "USD"
  mostrar_precio: boolean
  extensiones: string[]
  max_mb: number
  servicios: ServicioPublico[]
}
export type TallerEnDirectorio = { slug: string; nombre: string; descripcion: string; ciudad: string; logo: string | null }

export async function leerTallerPublico(slug: string): Promise<TallerPublico | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/api/taller-publico/${slug}`, { next: { revalidate: 60 } })
    if (!r.ok) return null
    return (await r.json()) as TallerPublico
  } catch {
    return null
  }
}

export async function leerDirectorio(): Promise<TallerEnDirectorio[]> {
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/api/taller-publico`, { next: { revalidate: 300 } })
    if (!r.ok) return []
    return ((await r.json()) as { talleres: TallerEnDirectorio[] }).talleres || []
  } catch {
    return []
  }
}
