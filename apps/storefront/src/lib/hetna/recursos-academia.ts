// Biblioteca de recursos de la Academia (API /store/recursos-academia). Sólo servidor.
// Ligas a materiales de otros sitios: el contenido vive en el sitio original.
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const cabeceras = { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string }

export type Recurso = {
  id: string
  titulo: string
  descripcion: string
  url: string
  fuente: string
  categoria: string
  tipo: string
  imagen_url: string | null
  destacado: boolean
  orden: number
}

// Misma lista que packages/api/src/lib/recursos-academia.ts (una prueba lo revisa).
export const CATEGORIAS_RECURSO: [string, string][] = [
  ["muebles-melamina", "Muebles y melamina"],
  ["carpinteria", "Carpintería y madera"],
  ["router-cnc", "Router CNC"],
  ["corte-laser", "Corte láser"],
  ["plasma", "Plasma CNC"],
  ["impresion-3d", "Impresión 3D"],
  ["electronica", "Electrónica y controladores"],
  ["diseno-cam", "Diseño y CAM"],
  ["programas", "Programas gratis"],
  ["otros", "Otros"],
]
export const TIPOS_RECURSO: Record<string, string> = {
  planos: "Planos",
  guia: "Guía",
  video: "Video",
  programa: "Programa",
  pdf: "Libro o PDF",
  sitio: "Sitio de consulta",
}

export async function listarRecursos(): Promise<Recurso[]> {
  try {
    const r = await fetch(`${API}/store/recursos-academia`, {
      headers: cabeceras,
      next: { revalidate: 300, tags: ["recursos-academia"] },
    })
    if (!r.ok) return []
    const d = (await r.json()) as { recursos?: Recurso[] }
    // Sólo ligas http(s): el API ya lo valida, esto es por si acaso.
    return (d.recursos || []).filter((x) => /^https?:\/\//i.test(x.url))
  } catch {
    return []
  }
}
