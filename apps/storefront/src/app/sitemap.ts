// Mapa del sitio para Google: inicio, servicios, herramientas gratis y el Foro CNC México.
// Se vuelve a generar cada hora para incluir los temas nuevos del foro.
import type { MetadataRoute } from "next"

import { SERVICIOS } from "@/components/hetna/servicios-datos"
import { secciones, temasParaMapa } from "@/lib/foro/consultas"
import { SITIO } from "@/lib/foro/tipos"

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
  const [secs, temas] = await Promise.all([secciones().catch(() => null), temasParaMapa().catch(() => [])])
  if (!secs) return fijas
  return [
    ...fijas,
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
