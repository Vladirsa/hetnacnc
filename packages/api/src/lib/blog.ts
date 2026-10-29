// Blog del foro: artículos y guías (módulo learning, modelo learning_article).
// Las rutas /admin/hetna-blog (escribir) y /store/blog (leer) usan esto.
import type { MedusaContainer } from "@medusajs/framework/types"

import { LEARNING_MODULE } from "../modules/learning"
import type LearningModuleService from "../modules/learning/service"

export const servicioBlog = (c: MedusaContainer) => c.resolve<LearningModuleService>(LEARNING_MODULE)

// Secciones del foro a las que puede pertenecer un artículo (foro.secciones).
export const CATEGORIAS_BLOG = [
  "router-cnc", "corte-laser", "plasma", "torno-fresadora", "impresion-3d", "diseno-cam",
  "controladores-electronica", "materiales-herramientas", "precios-negocio", "muestra-tu-trabajo",
]

export const slugDe = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)

type Entrada = Record<string, unknown>
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const url = (v: unknown) => {
  const s = texto(v, 500)
  return /^https?:\/\//.test(s) ? s : null
}

// Valida y normaliza lo que manda el editor del dashboard.
export function leerArticulo(b: Entrada, parcial = false): { datos?: Record<string, unknown>; error?: string } {
  const titulo = texto(b.title, 200)
  const contenido = typeof b.content_html === "string" ? b.content_html.slice(0, 200_000) : ""
  if (!parcial && titulo.length < 8) return { error: "El título debe tener al menos 8 letras." }
  if (!parcial && contenido.trim().length < 50) return { error: "El artículo está muy corto." }
  const datos: Record<string, unknown> = {}
  if (titulo) datos.title = titulo
  if (contenido) datos.content_html = contenido
  const slug = slugDe(texto(b.slug, 120) || titulo)
  if (slug) datos.slug = slug
  if ("excerpt" in b || !parcial) datos.excerpt = texto(b.excerpt, 400) || titulo
  if ("cover_image_url" in b) datos.cover_image_url = url(b.cover_image_url)
  if ("video_url" in b) datos.video_url = url(b.video_url)
  if ("seo_title" in b) datos.seo_title = texto(b.seo_title, 70) || null
  if ("seo_description" in b) datos.seo_description = texto(b.seo_description, 170) || null
  if ("categoria" in b) {
    const c = texto(b.categoria, 40)
    datos.categoria = CATEGORIAS_BLOG.includes(c) ? c : null
  }
  if ("guia" in b) datos.guia = b.guia === true
  if ("autor" in b) datos.autor = texto(b.autor, 80) || null
  if ("publicado" in b) datos.published_at = b.publicado === true ? new Date() : null
  return { datos }
}
