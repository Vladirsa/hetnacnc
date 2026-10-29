// Blog del foro: artículos y guías (API /store/blog). Sólo servidor.
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const cabeceras = { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string }

export type ArticuloResumen = {
  id: string
  slug: string
  title: string
  excerpt: string
  cover_image_url: string | null
  video_url: string | null
  categoria: string | null
  guia: boolean
  autor: string | null
  published_at: string
}
export type Articulo = ArticuloResumen & {
  content_html: string
  seo_title: string | null
  seo_description: string | null
  updated_at?: string
}

export const urlArticulo = (slug: string) => `/foro-cnc/blog/${slug}`

export async function listarBlog(o: { categoria?: string; guia?: boolean; limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams()
  if (o.categoria) q.set("categoria", o.categoria)
  if (o.guia) q.set("guia", "1")
  q.set("limit", String(o.limit ?? 12))
  q.set("offset", String(o.offset ?? 0))
  try {
    const r = await fetch(`${API}/store/blog?${q}`, { headers: cabeceras, next: { revalidate: 300, tags: ["blog"] } })
    if (!r.ok) return { articulos: [] as ArticuloResumen[], total: 0 }
    return (await r.json()) as { articulos: ArticuloResumen[]; total: number }
  } catch {
    return { articulos: [] as ArticuloResumen[], total: 0 }
  }
}

export async function articuloBlog(slug: string) {
  try {
    const r = await fetch(`${API}/store/blog/${encodeURIComponent(slug)}`, { headers: cabeceras, next: { revalidate: 300, tags: ["blog"] } })
    if (!r.ok) return null
    return (await r.json()) as { articulo: Articulo; relacionados: ArticuloResumen[] }
  } catch {
    return null
  }
}
