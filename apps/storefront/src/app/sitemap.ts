// Mapa del sitio para Google: inicio, servicios, herramientas gratis y el Foro CNC México.
// Se vuelve a generar cada hora para incluir los temas nuevos del foro.
import type { MetadataRoute } from "next"

import { SERVICIOS } from "@/components/hetna/servicios-datos"
import { secciones, temasParaMapa } from "@/lib/foro/consultas"
import { SITIO } from "@/lib/foro/tipos"
import { listLearningArticles } from "@/lib/data/learning-articles"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `${SITIO}/mx`
  const hoy = new Date()
  const fijas: MetadataRoute.Sitemap = [
    { url: base, lastModified: hoy, changeFrequency: "daily", priority: 1 },
    { url: `${base}/categories`, lastModified: hoy, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/servicios`, lastModified: hoy, changeFrequency: "weekly", priority: 0.8 },
    ...SERVICIOS.map((s) => ({
      url: `${base}/servicios/${s.slug}`,
      lastModified: hoy,
      changeFrequency: "weekly" as const,
      priority: s.padre ? 0.7 : 0.8,
    })),
  ]
  const [secs, temas, { learning_articles }] = await Promise.all([
    secciones().catch(() => null),
    temasParaMapa().catch(() => []),
    listLearningArticles({ limit: 200 }).catch(() => ({ learning_articles: [] })),
  ])
  const articulos: MetadataRoute.Sitemap = learning_articles.map((a) => ({
    url: `${base}/aprendizaje-cnc/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : hoy,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))
  if (!secs) return [...fijas, ...articulos]
  return [
    ...fijas,
    ...articulos,
    { url: `${base}/foro-cnc`, lastModified: hoy, changeFrequency: "hourly", priority: 0.8 },
    ...secs.map((s) => ({
      url: `${base}/foro-cnc/${s.slug}`,
      lastModified: s.ultima ? new Date(s.ultima) : hoy,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...temas.map((t) => ({
      url: `${base}${t.url}`,
      lastModified: new Date(t.fecha),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]
}
