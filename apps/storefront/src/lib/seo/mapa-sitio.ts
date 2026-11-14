// Mapa del sitio separado por tipo (auditoría SEO del 13 nov 2026):
//   /sitemap.xml                → índice
//   /sitemaps/paginas.xml       → portada, herramientas, cotizadores, empresa
//   /sitemaps/servicios.xml     → servicios de fabricación y diseño
//   /sitemaps/categorias.xml    → categorías de la tienda
//   /sitemaps/productos.xml     → productos
//   /sitemaps/talleres.xml      → perfiles de talleres
//   /sitemaps/articulos.xml     → blog, cursos y trabajos abiertos
//   /sitemaps/foro.xml          → Foro CNC México
//
// Sólo URLs de /mx: las versiones por país sirven el mismo contenido y su
// canónica es /mx (lib/helpers/hreflang.ts). La única excepción es la portada
// de /us, que tiene título y descripción propios en inglés.
import { SERVICIOS } from "@/components/hetna/servicios-datos"
import { HERRAMIENTAS_DISENO } from "@/lib/hetna/disenar"
import { sdk } from "@/lib/client"
import { categoriasConProductos, tieneContenido } from "@/lib/hetna/catalogo"
import { secciones, temasParaMapa } from "@/lib/foro/consultas"
import { directorioMexico } from "@/lib/hetna/directorio"
import { listarTalleres } from "@/lib/hetna/talleres"
import { listLearningArticles } from "@/lib/data/learning-articles"
import { listCourses } from "@/lib/data/courses"
import { trabajosAbiertos } from "@/lib/trabajos/datos"
import { SITIO_CANONICO } from "@/lib/helpers/hreflang"
import { CIUDADES, GUIAS, enCiudad } from "@/lib/seo/guias"

type Frecuencia = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
export type Entrada = {
  url: string
  lastModified?: Date
  changeFrequency?: Frecuencia
  priority?: number
  alternates?: Record<string, string>
}

const MX = `${SITIO_CANONICO}/mx`
const US = `${SITIO_CANONICO}/us`

const pagina = (ruta: string, changeFrequency: Frecuencia, priority: number, lastModified: Date = new Date()): Entrada => ({
  url: `${MX}${ruta}`,
  lastModified,
  changeFrequency,
  priority,
})

// Rutas fijas que existen y se pueden indexar (las de cuenta, carrito y
// formularios de "gracias" quedan fuera a propósito)
const FIJAS: [string, Frecuencia, number][] = [
  ["", "daily", 1],
  ["/categories", "daily", 0.9],
  ["/servicios", "weekly", 0.8],
  ["/cotizar", "weekly", 0.8],
  ["/cotizar/router-cnc", "weekly", 0.8],
  ["/cotizar/corte-laser", "weekly", 0.8],
  ["/cotizar/corte-plasma", "weekly", 0.8],
  ["/cotizar/impresion-3d", "weekly", 0.8],
  ["/fabricacion", "weekly", 0.9],
  ["/herramientas-cnc", "weekly", 0.9],
  ["/laboratorio-cam", "weekly", 0.8],
  ["/disenar", "weekly", 0.9],
  ["/disenar/cajas", "weekly", 0.9],
  ["/cam/subir", "weekly", 0.6],
  ["/cam/lab", "weekly", 0.6],
  ["/cam/torno", "weekly", 0.6],
  ["/talleres", "weekly", 0.8],
  ["/talleres/unete", "weekly", 0.8],
  ["/talleres/directorio", "weekly", 0.6],
  ["/foro-cnc/blog", "weekly", 0.7],
  ["/foro-cnc/empleos", "weekly", 0.6],
  ["/foro-cnc/profesionales", "weekly", 0.6],
  ["/foro-cnc/eventos", "weekly", 0.6],
  ["/talleres/fundadores", "weekly", 0.7],
  ["/talleres/ranking", "daily", 0.7],
  ["/servicios/envios-hetna", "monthly", 0.6],
  ["/anunciate", "monthly", 0.6],
  ["/quienes-somos", "monthly", 0.5],
  ["/contacto", "monthly", 0.5],
  ["/preguntas-frecuentes", "monthly", 0.5],
  ["/formas-de-pago", "monthly", 0.4],
  ["/devoluciones", "monthly", 0.3],
  ["/terminos-y-condiciones", "yearly", 0.2],
  ["/terminos-vendedores", "yearly", 0.2],
  ["/aviso-de-privacidad", "yearly", 0.2],
]

// Categorías cuya página redirige a otra (categories/[category]/page.tsx).
// Google marca como error una URL del sitemap que redirige; la página de
// destino ya está en la lista estática de arriba.
const CATEGORIAS_QUE_REDIRIGEN = new Set(["servicios"]) // → /fabricacion

const categorias = async (): Promise<string[]> => {
  try {
    const [r, conProductos] = await Promise.all([
      sdk.store.productCategories.query({
        fields: "id,handle,*category_children",
        include_descendants_tree: true,
        limit: 200,
        fetchOptions: { next: { revalidate: 3600 } },
      } as never) as unknown as Promise<{ product_categories: { id: string; handle: string; category_children?: any[] | null }[] }>,
      categoriasConProductos(),
    ])
    // Catálogo honesto: una categoría vacía no se manda a Google (su página queda noindex)
    return (r.product_categories ?? [])
      .filter((c) => tieneContenido(c, conProductos))
      .map((c) => c.handle)
      .filter((h): h is string => !!h && !CATEGORIAS_QUE_REDIRIGEN.has(h))
  } catch {
    return []
  }
}

const productos = async (): Promise<{ handle: string; fecha: Date }[]> => {
  try {
    const r = (await sdk.store.products.query({
      fields: "handle,updated_at,metadata",
      limit: 500,
      fetchOptions: { next: { revalidate: 3600 } },
    } as never)) as unknown as {
      products: { handle?: string | null; updated_at?: string | null; metadata?: Record<string, unknown> | null }[]
    }
    return (r.products ?? [])
      // Los paquetes de créditos 3D no se compran desde su ficha (se pagan en
      // /user/creditos) y llevan noindex (lib/helpers/seo.ts): fuera del mapa.
      .filter((p) => p.handle && p.metadata?.producto_creditos_3d !== true)
      .map((p) => ({ handle: p.handle as string, fecha: p.updated_at ? new Date(p.updated_at) : new Date() }))
  } catch {
    return []
  }
}


async function ciudadesIndexables(): Promise<string[]> {
  const talleres = await listarTalleres().catch(() => [])
  const rutas: string[] = []
  for (const g of GUIAS.filter((x) => x.ciudades)) {
    const delServicio = talleres.filter((t) => t.perfil.servicios.some((s) => g.coincide.includes(s)))
    for (const c of CIUDADES) {
      if (delServicio.some((t) => enCiudad(c, t.perfil.estado, t.perfil.ciudad))) rutas.push(`/cnc/${g.slug}/${c.slug}`)
    }
  }
  return rutas
}

export const ARCHIVOS_MAPA = ["paginas", "servicios", "categorias", "productos", "talleres", "articulos", "foro"] as const
export type ArchivoMapa = (typeof ARCHIVOS_MAPA)[number]

export async function entradasMapa(archivo: ArchivoMapa): Promise<Entrada[]> {
  const hoy = new Date()
  switch (archivo) {
    case "paginas": {
      const portada = { "es-MX": MX, "en-US": US, "x-default": MX }
      return [
        { url: MX, lastModified: hoy, changeFrequency: "daily", priority: 1, alternates: portada },
        { url: US, lastModified: hoy, changeFrequency: "daily", priority: 0.6, alternates: portada },
        ...FIJAS.filter(([r]) => r !== "").map(([r, f, p]) => pagina(r, f, p, hoy)),
        ...HERRAMIENTAS_DISENO.map((h) => pagina(`/disenar/${h.slug}`, "weekly", 0.8, hoy)),
        // Guías CNC; de las ciudades sólo las que tienen talleres de ese
        // servicio en su estado (las demás llevan noindex: cnc/[guia]/[ciudad])
        pagina("/cnc", "weekly", 0.8, hoy),
        ...GUIAS.map((g) => pagina(`/cnc/${g.slug}`, "weekly", 0.8, hoy)),
        ...(await ciudadesIndexables()).map((r) => pagina(r, "weekly", 0.7, hoy)),
      ]
    }
    case "servicios":
      // Redirigen y quedan fuera del mapa: generador-2d-3d y sus generadores (a
      // /disenar) y laboratorio-cam (a /fabricacion)
      return SERVICIOS.filter(
        (s) =>
          s.slug !== "generador-2d-3d" &&
          !HERRAMIENTAS_DISENO.some((h) => s.slug === `generador-2d-3d/${h.slug}`) &&
          !s.slug.startsWith("laboratorio-cam")
      ).map((s) => pagina(`/servicios/${s.slug}`, "weekly", s.padre ? 0.7 : 0.8, hoy))
    case "categorias":
      return (await categorias()).map((h) => pagina(`/categories/${h}`, "daily", 0.8, hoy))
    case "productos":
      return (await productos()).map((p) => pagina(`/products/${p.handle}`, "weekly", 0.7, p.fecha))
    case "talleres":
      return [
        ...(await listarTalleres().catch(() => [])).map((t) => pagina(`/talleres/${t.handle}`, "weekly", 0.6, hoy)),
        // Perfiles no reclamados: sólo los que tienen descripción (los demás son noindex)
        ...(await directorioMexico())
          .filter((e) => e.servicios)
          .map((e) => pagina(`/talleres/directorio/${e.slug}`, "monthly", 0.3, hoy)),
      ]
    case "articulos": {
      const [{ learning_articles }, { courses }, { trabajos }] = await Promise.all([
        listLearningArticles({ limit: 200 }).catch(() => ({ learning_articles: [] as { slug: string; published_at: string | null }[] })),
        listCourses({ limit: 200 }).catch(() => ({ courses: [] as { slug: string; published_at: string | null }[] })),
        trabajosAbiertos({ limit: 60 }),
      ])
      // De los trabajos sólo van los abiertos: uno cerrado sale del índice (noindex).
      return [
        ...learning_articles.map((a) => pagina(`/foro-cnc/blog/${a.slug}`, "monthly", 0.6, a.published_at ? new Date(a.published_at) : hoy)),
        ...courses.map((c) => pagina(`/aprendizaje-cnc/cursos/${c.slug}`, "weekly", 0.7, c.published_at ? new Date(c.published_at) : hoy)),
        pagina("/trabajos", "daily", 0.8, hoy),
        ...trabajos.map((t) => pagina(`/trabajos/${t.folio}`, "daily", 0.6, new Date(t.creada))),
      ]
    }
    case "foro": {
      const [secs, temas] = await Promise.all([secciones().catch(() => null), temasParaMapa().catch(() => [])])
      if (!secs) return []
      const fijas = new Set(FIJAS.map(([r]) => r))
      return [
        pagina("/foro-cnc", "daily", 0.8, hoy),
        ...secs.filter((s) => !fijas.has(`/foro-cnc/${s.slug}`)).map((s) => pagina(`/foro-cnc/${s.slug}`, "daily", 0.7, s.ultima ? new Date(s.ultima) : hoy)),
        ...temas.map((t) => pagina(t.url, "weekly", 0.6, new Date(t.fecha))),
      ]
    }
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function xmlUrlset(lista: Entrada[]): string {
  const vistas = new Set<string>()
  const filas = lista
    .filter((e) => (vistas.has(e.url) ? false : (vistas.add(e.url), true)))
    .map(
      (e) =>
        "<url>" +
        `<loc>${esc(e.url)}</loc>` +
        Object.entries(e.alternates || {})
          .map(([l, h]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(h)}"/>`)
          .join("") +
        (e.lastModified && !isNaN(e.lastModified.getTime()) ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : "") +
        (e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : "") +
        (e.priority != null ? `<priority>${e.priority}</priority>` : "") +
        "</url>"
    )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${filas.join("\n")}\n</urlset>\n`
}

export function xmlIndice(): string {
  const hoy = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ARCHIVOS_MAPA.map(
    (a) => `<sitemap><loc>${SITIO_CANONICO}/sitemaps/${a}.xml</loc><lastmod>${hoy}</lastmod></sitemap>`
  ).join("\n")}\n</sitemapindex>\n`
}
