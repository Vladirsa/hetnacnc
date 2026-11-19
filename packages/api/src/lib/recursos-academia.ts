// Biblioteca de recursos de la Academia (módulo learning, modelo
// learning_resource). /admin/hetna-recursos escribe y /store/recursos-academia
// lee. Son ligas a materiales de otros sitios: el contenido se queda en el
// sitio original y aquí sólo va la ficha con el crédito.
import type { MedusaContainer } from "@medusajs/framework/types"

import { LEARNING_MODULE } from "../modules/learning"
import type LearningModuleService from "../modules/learning/service"

export const servicioRecursos = (c: MedusaContainer) => c.resolve<LearningModuleService>(LEARNING_MODULE)

/** Categorías de la biblioteca: [clave, nombre]. La tienda tiene la misma lista. */
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
export const TIPOS_RECURSO: [string, string][] = [
  ["planos", "Planos"],
  ["guia", "Guía o tutorial"],
  ["video", "Video"],
  ["programa", "Programa"],
  ["pdf", "Libro o PDF"],
  ["sitio", "Sitio de consulta"],
]
const CLAVES_CATEGORIA = CATEGORIAS_RECURSO.map(([c]) => c)
const CLAVES_TIPO = TIPOS_RECURSO.map(([c]) => c)

export const CAMPOS_PUBLICOS = [
  "id", "titulo", "descripcion", "url", "fuente", "categoria", "tipo", "imagen_url", "destacado", "orden",
]

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")

/** Liga válida http(s) con dominio, sin usuario/contraseña. Devuelve la liga normalizada o null. */
export function ligaValida(v: unknown): string | null {
  const s = texto(v, 600)
  if (!s) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  if (u.username || u.password) return null
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null
  return u.toString()
}

/** Nombre del sitio sacado de la liga ("manuales-faciles.blogspot.com"). */
export const dominioDe = (liga: string) => {
  try {
    return new URL(liga).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

type Entrada = Record<string, unknown>

/** Valida lo que manda la pantalla del dashboard. parcial = editar (sólo lo que llegue). */
export function leerRecurso(b: Entrada, parcial = false): { datos?: Record<string, unknown>; error?: string } {
  const datos: Record<string, unknown> = {}
  if (!parcial || "titulo" in b) {
    const t = texto(b.titulo, 160)
    if (t.length < 4) return { error: "El título debe tener al menos 4 letras." }
    datos.titulo = t
  }
  if (!parcial || "url" in b) {
    const u = ligaValida(b.url)
    if (!u) return { error: "La liga debe ser una dirección completa que empiece con https:// (o http://)." }
    datos.url = u
  }
  if (!parcial || "fuente" in b) {
    const f = texto(b.fuente, 120) || (typeof datos.url === "string" ? dominioDe(datos.url) : "")
    if (!f) return { error: "Escribe de qué sitio o autor es (el crédito)." }
    datos.fuente = f
  }
  if (!parcial || "categoria" in b) {
    const c = texto(b.categoria, 40)
    if (!CLAVES_CATEGORIA.includes(c)) return { error: "Elige una categoría." }
    datos.categoria = c
  }
  if (!parcial || "tipo" in b) {
    const t = texto(b.tipo, 20)
    datos.tipo = CLAVES_TIPO.includes(t) ? t : "guia"
  }
  if (!parcial || "descripcion" in b) datos.descripcion = texto(b.descripcion, 500)
  if ("imagen_url" in b) {
    const s = texto(b.imagen_url, 600)
    if (!s) datos.imagen_url = null
    else {
      const u = ligaValida(s)
      if (!u || !u.startsWith("https://")) return { error: "La imagen debe ser una liga que empiece con https://" }
      datos.imagen_url = u
    }
  }
  if ("destacado" in b) datos.destacado = b.destacado === true
  if ("publicado" in b) datos.publicado = b.publicado !== false
  if ("orden" in b) {
    const n = Math.round(Number(b.orden))
    datos.orden = Number.isFinite(n) ? Math.min(Math.max(n, -9999), 9999) : 0
  }
  return { datos }
}
