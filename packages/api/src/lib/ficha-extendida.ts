// @ts-nocheck
// Ficha extendida del producto, capturada por el taller en su panel
// (apps/vendor/src/routes/ficha/page.tsx) y mostrada en la página del producto
// (storefront: components/sections/FichaProducto, lib/helpers/product-metadata.ts).
//
// Se guarda en product.metadata, en las mismas llaves que ya lee la tienda:
//   compatibilidad  string[]                       "Mach3", "GRBL", "Router 1325"
//   videos          string[]                       ligas de YouTube o Vimeo
//   archivos        { nombre, url }[]              manuales, planos, fichas técnicas
//   faq             { pregunta, respuesta }[]
// La tienda acepta también el formato de texto que se escribía a mano en
// Metadata ("Nombre|URL" por línea), así que aquí se leen los dos.
//
// Como lo ve el cliente final, se quitan teléfonos, correos y ligas de los
// textos (el trato va por HETNA) y sólo se aceptan ligas de video y de archivos
// de servicios conocidos o subidos al propio sitio.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { ocultarContacto, STORE_URL } from "./licitacion"

export const LIMITES = { compatibilidad: 30, videos: 6, archivos: 12, faq: 15 }

export type Ficha = {
  compatibilidad: string[]
  videos: string[]
  archivos: { nombre: string; url: string }[]
  faq: { pregunta: string; respuesta: string }[]
}

export class ErrorFicha extends Error {}

const comoJson = (v) => {
  if (typeof v !== "string") return v
  const t = v.trim()
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      return JSON.parse(t)
    } catch {
      return t
    }
  }
  return t
}
const lineas = (t: string) =>
  String(t || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

/** Lo que ya tiene el producto, en el formato que sea, como listas limpias. */
export function leerFicha(meta: Record<string, any> | null | undefined): Ficha {
  const m = meta || {}
  const lista = (v, sep: RegExp) => {
    const d = comoJson(v)
    if (Array.isArray(d)) return d.map((x) => (typeof x === "string" || typeof x === "number" ? String(x).trim() : "")).filter(Boolean)
    if (typeof d === "string") return d.split(sep).map((x) => x.trim()).filter(Boolean)
    return []
  }
  const pares = (v, claves: [string[], string[]], usarUltimo: boolean) => {
    const d = comoJson(v)
    const out = []
    if (Array.isArray(d)) {
      for (const it of d) {
        if (typeof it === "string") out.push([claves[0][0] === "nombre" ? "" : it, claves[0][0] === "nombre" ? it : ""])
        else if (it && typeof it === "object") out.push([claves[0].map((k) => it[k]).find(Boolean) || "", claves[1].map((k) => it[k]).find(Boolean) || ""])
      }
    } else if (typeof d === "string") {
      for (const l of lineas(d)) {
        const i = usarUltimo ? l.lastIndexOf("|") : l.indexOf("|")
        out.push(i === -1 ? (usarUltimo ? ["", l] : [l, ""]) : [l.slice(0, i), l.slice(i + 1)])
      }
    }
    return out.map(([a, b]) => [String(a || "").trim(), String(b || "").trim()])
  }
  return {
    compatibilidad: lista(m.compatibilidad, /[\n,;]+/),
    videos: lista(m.videos, /[\n\s,;]+/),
    archivos: pares(m.archivos, [["nombre", "name", "titulo"], ["url", "href"]], true).map(([nombre, url]) => ({ nombre, url })),
    faq: pares(m.faq, [["pregunta", "p", "q"], ["respuesta", "r", "a"]], false).map(([pregunta, respuesta]) => ({ pregunta, respuesta })),
  }
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}
const HOSTS_VIDEO = ["youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com"]
const HOSTS_ARCHIVO = ["drive.google.com", "docs.google.com", "dropbox.com", "dl.dropboxusercontent.com", "onedrive.live.com", "1drv.ms"]
const hostsPropios = () =>
  [STORE_URL, process.env.FILE_BACKEND_URL, process.env.MEDUSA_BACKEND_URL, process.env.BACKEND_URL]
    .filter(Boolean)
    .map((u) => host(String(u)))
    .filter(Boolean)
    .concat(["hetnacnc.com"])
const permitido = (u: string, hosts: string[]) => {
  const h = host(u)
  return Boolean(h) && hosts.some((x) => h === x || h.endsWith(`.${x}`))
}

const texto = (v, max: number) =>
  ocultarContacto(String(v ?? "").replace(/\s+/g, " ").trim()).slice(0, max)
const parrafo = (v, max: number) =>
  ocultarContacto(String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim()).slice(0, max)

/** Valida lo que manda el panel. Lanza ErrorFicha con un mensaje para el taller. */
export function validarFicha(b: Record<string, any>): Ficha {
  const arr = (v) => (Array.isArray(v) ? v : [])

  const compatibilidad = [...new Set(arr(b.compatibilidad).map((x) => texto(x, 60)).filter(Boolean))]
  if (compatibilidad.length > LIMITES.compatibilidad) throw new ErrorFicha(`Máximo ${LIMITES.compatibilidad} compatibilidades.`)

  const videos = [...new Set(arr(b.videos).map((x) => String(x || "").trim()).filter(Boolean))]
  if (videos.length > LIMITES.videos) throw new ErrorFicha(`Máximo ${LIMITES.videos} videos.`)
  for (const v of videos) {
    if (!/^https:\/\/\S+$/i.test(v) || !permitido(v, HOSTS_VIDEO)) {
      throw new ErrorFicha(`"${v.slice(0, 60)}" no es una liga de YouTube o Vimeo.`)
    }
  }

  const propios = hostsPropios()
  const archivos = arr(b.archivos)
    .map((a) => ({ nombre: texto(a?.nombre, 120), url: String(a?.url || "").trim() }))
    .filter((a) => a.url)
  if (archivos.length > LIMITES.archivos) throw new ErrorFicha(`Máximo ${LIMITES.archivos} archivos.`)
  for (const a of archivos) {
    const valido = /^https?:\/\/\S+$/i.test(a.url) && (permitido(a.url, propios) || permitido(a.url, HOSTS_ARCHIVO))
    if (!valido) throw new ErrorFicha(`El archivo "${a.nombre || a.url.slice(0, 50)}": súbelo aquí o usa una liga de Google Drive, Dropbox u OneDrive.`)
    if (!a.nombre) a.nombre = decodeURIComponent(a.url.split("?")[0].split("/").pop() || "Archivo").slice(0, 120)
  }

  const faq = arr(b.faq)
    .map((f) => ({ pregunta: texto(f?.pregunta, 240), respuesta: parrafo(f?.respuesta, 1200) }))
    .filter((f) => f.pregunta || f.respuesta)
  if (faq.length > LIMITES.faq) throw new ErrorFicha(`Máximo ${LIMITES.faq} preguntas.`)
  if (faq.some((f) => !f.pregunta || !f.respuesta)) throw new ErrorFicha("Cada pregunta necesita su respuesta.")

  return { compatibilidad, videos, archivos, faq }
}

type Producto = { id: string; title: string; handle: string; thumbnail: string | null; status: string; metadata: Record<string, any> | null }

/** Productos del taller con su ficha actual. */
export async function productosDelTaller(container, sellerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "products.id", "products.title", "products.handle", "products.thumbnail", "products.status", "products.metadata"],
    filters: { id: sellerId },
  })
  const productos = ((data?.[0]?.products || []) as Producto[]).filter(Boolean)
  return productos
    .filter((p) => !p.metadata?.es_curso)
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "es"))
    .map((p) => {
      const f = leerFicha(p.metadata)
      return {
        id: p.id,
        titulo: p.title,
        handle: p.handle,
        foto: p.thumbnail,
        estado: p.status,
        ficha: f,
        completa: [f.compatibilidad.length > 0, f.videos.length > 0, f.archivos.length > 0, f.faq.length > 0].filter(Boolean).length,
      }
    })
}

/** Guarda la ficha si el producto es del taller. Conserva el resto del metadata. */
export async function guardarFicha(container, sellerId: string, productId: string, ficha: Ficha) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "metadata", "sellers.id"],
    filters: { id: productId },
  })
  const p = data?.[0]
  if (!p || !(p.sellers || []).some((s) => s?.id === sellerId)) throw new ErrorFicha("Ese producto no es tuyo o ya no existe.")
  const meta = { ...(p.metadata || {}) }
  // Vacío = "" (Medusa borra la llave al combinar metadata; si no, la tienda la
  // lee como vacía y no muestra la sección)
  for (const k of ["compatibilidad", "videos", "archivos", "faq"] as const) {
    meta[k] = ficha[k].length ? ficha[k] : ""
  }
  meta.ficha_actualizada = new Date().toISOString()
  await updateProductsWorkflow(container).run({ input: { selector: { id: productId }, update: { metadata: meta } } })
  return leerFicha(meta)
}
