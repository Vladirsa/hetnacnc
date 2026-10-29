// Mapa del sitio para Google: tienda (categorías, productos), talleres, servicios,
// herramientas, páginas de la empresa, artículos y el Foro CNC México.
// Cada página de la tienda lleva su par en inglés (/us) con hreflang, para que
// Google sepa que /mx es español de México y /us es inglés de EE. UU.
// Se vuelve a generar cada hora para incluir productos y temas nuevos.
import type { MetadataRoute } from "next"

import { SERVICIOS } from "@/components/hetna/servicios-datos"
import { sdk } from "@/lib/client"
import { secciones, temasParaMapa } from "@/lib/foro/consultas"
import { SITIO } from "@/lib/foro/tipos"
import { listarTalleres } from "@/lib/hetna/talleres"
import { listLearningArticles } from "@/lib/data/learning-articles"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const revalidate = 3600

type Frecuencia = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>

const MX = `${SITIO}/mx`
const US = `${SITIO}/us`

// Página con versión en español (/mx) y en inglés (/us), una entrada por idioma
const bilingue = (
  ruta: string,
  changeFrequency: Frecuencia,
  priority: number,
  lastModified: Date = new Date()
): MetadataRoute.Sitemap => {
  const languages = { "es-MX": `${MX}${ruta}`, "en-US": `${US}${ruta}`, "x-default": `${MX}${ruta}` }
  return [
    { url: `${MX}${ruta}`, lastModified, changeFrequency, priority, alternates: { languages } },
    { url: `${US}${ruta}`, lastModified, changeFrequency, priority: Math.max(0.1, priority - 0.1), alternates: { languages } },
  ]
}

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
  ["/cam/subir", "weekly", 0.6],
  ["/cam/lab", "weekly", 0.6],
  ["/cam/torno", "weekly", 0.6],
  ["/talleres", "daily", 0.8],
  ["/talleres/unete", "weekly", 0.8],
  ["/foro-cnc/blog", "weekly", 0.7],
  ["/talleres/fundadores", "weekly", 0.7],
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

const categorias = async (): Promise<string[]> => {
  try {
    const r = (await sdk.store.productCategories.query({
      fields: "handle",
      limit: 200,
      fetchOptions: { next: { revalidate: 3600 } },
    } as never)) as unknown as { product_categories: { handle?: string | null }[] }
    return (r.product_categories ?? []).map((c) => c.handle).filter(Boolean) as string[]
  } catch {
    return []
  }
}

const productos = async (): Promise<{ handle: string; fecha: Date }[]> => {
  try {
    const r = (await sdk.store.products.query({
      fields: "handle,updated_at",
      limit: 500,
      fetchOptions: { next: { revalidate: 3600 } },
    } as never)) as unknown as { products: { handle?: string | null; updated_at?: string | null }[] }
    return (r.products ?? [])
      .filter((p) => p.handle)
      .map((p) => ({ handle: p.handle as string, fecha: p.updated_at ? new Date(p.updated_at) : new Date() }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hoy = new Date()

  const [cats, prods, talleres, secs, temas, { learning_articles }, { trabajos }] = await Promise.all([
    categorias(),
    productos(),
    listarTalleres().catch(() => []),
    secciones().catch(() => null),
    temasParaMapa().catch(() => []),
    listLearningArticles({ limit: 200 }).catch(() => ({ learning_articles: [] })),
    trabajosAbiertos({ limit: 60 }),
  ])

  const tienda: MetadataRoute.Sitemap = [
    ...FIJAS.flatMap(([ruta, f, p]) => bilingue(ruta, f, p, hoy)),
    // generador-2d-3d y laboratorio-cam redirigen (a /herramientas-cnc y /fabricacion): fuera del mapa
    ...SERVICIOS.filter((s) => s.slug !== "generador-2d-3d" && !s.slug.startsWith("laboratorio-cam")).flatMap((s) =>
      bilingue(`/servicios/${s.slug}`, "weekly", s.padre ? 0.7 : 0.8, hoy)
    ),
    ...cats.flatMap((h) => bilingue(`/categories/${h}`, "daily", 0.8, hoy)),
    ...prods.flatMap((p) => bilingue(`/products/${p.handle}`, "weekly", 0.7, p.fecha)),
    ...talleres.flatMap((t) => bilingue(`/talleres/${t.handle}`, "weekly", 0.6, hoy)),
  ]

  // Artículos, trabajos abiertos y foro: contenido escrito en español, solo /mx.
  // De los trabajos sólo van los abiertos: uno cerrado sale del índice (noindex).
  const articulos: MetadataRoute.Sitemap = [
    ...learning_articles.map((a) => ({
      url: `${MX}/foro-cnc/blog/${a.slug}`,
      lastModified: a.published_at ? new Date(a.published_at) : hoy,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${MX}/trabajos`, lastModified: hoy, changeFrequency: "hourly" as const, priority: 0.8 },
    ...trabajos.map((t) => ({
      url: `${MX}/trabajos/${t.folio}`,
      lastModified: new Date(t.creada),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ]
  if (!secs) return [...tienda, ...articulos]
  return [
    ...tienda,
    ...articulos,
    { url: `${MX}/foro-cnc`, lastModified: hoy, changeFrequency: "hourly", priority: 0.8 },
    ...secs.map((s) => ({
      url: `${MX}/foro-cnc/${s.slug}`,
      lastModified: s.ultima ? new Date(s.ultima) : hoy,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...temas.map((t) => ({
      url: `${MX}${t.url}`,
      lastModified: new Date(t.fecha),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]
}
