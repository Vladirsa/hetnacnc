// Artículos del blog escritos por instructores (talleres) desde su panel.
//
// Nunca se acepta HTML del taller: escribe en texto simple (## subtítulos,
// - listas, **negritas**, [ligas](https://…), ![foto](https://…)) y aquí se
// convierte a HTML escapando todo. Las ligas salen con rel="nofollow ugc".
// Cada artículo nuevo o editado queda "pendiente" y no se ve hasta que HETNA
// lo aprueba en el dashboard (Blog › Por revisar).
import { CATEGORIAS_BLOG, slugDe } from "./blog"

export const MIN_LETRAS = 1500 // ~250 palabras: un artículo, no un anuncio
export const MAX_LETRAS = 40_000
export const MAX_PENDIENTES = 3

export class ErrorArticulo extends Error {}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

const ligaSegura = (u: string, soloHttps = false) => {
  try {
    const x = new URL(u)
    if (x.protocol !== "https:" && (soloHttps || x.protocol !== "http:")) return null
    if (x.username || x.password) return null
    return x.toString()
  } catch {
    return null
  }
}

// Formato en línea sobre texto YA escapado. Las ligas se arman con la URL
// original validada (y escapada), nunca con el texto escapado.
function enLinea(crudo: string): string {
  const partes: string[] = []
  let resto = crudo
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/
  for (let m = re.exec(resto); m; m = re.exec(resto)) {
    partes.push(formato(esc(resto.slice(0, m.index))))
    const u = ligaSegura(m[2])
    partes.push(u ? `<a href="${esc(u)}" rel="nofollow ugc noopener" target="_blank">${formato(esc(m[1]))}</a>` : formato(esc(m[0])))
    resto = resto.slice(m.index + m[0].length)
  }
  partes.push(formato(esc(resto)))
  return partes.join("")
}
const formato = (s: string) => s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, "$1<em>$2</em>")

/** Texto simple del taller → HTML seguro. */
export function textoAHtmlSeguro(texto: string): string {
  return texto
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((b) => {
      const lineas = b.split("\n").filter((l) => l.trim())
      if (!lineas.length) return ""
      const una = lineas.length === 1 ? lineas[0].trim() : null
      if (una && /^###\s/.test(una)) return `<h3>${enLinea(una.replace(/^###\s+/, ""))}</h3>`
      if (una && /^##?\s/.test(una)) return `<h2>${enLinea(una.replace(/^##?\s+/, ""))}</h2>`
      const img = una?.match(/^!\[([^\]]{0,200})\]\((\S{1,500})\)$/)
      if (img) {
        const u = ligaSegura(img[2], true)
        return u ? `<p><img src="${esc(u)}" alt="${esc(img[1])}" loading="lazy" /></p>` : `<p>${enLinea(una!)}</p>`
      }
      if (lineas.every((l) => /^\s*[-*]\s/.test(l))) return `<ul>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`
      if (lineas.every((l) => /^\s*\d+[.)]\s/.test(l))) return `<ol>${lineas.map((l) => `<li>${enLinea(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`
      return `<p>${lineas.map(enLinea).join("<br/>")}</p>`
    })
    .filter(Boolean)
    .join("\n")
}

const limpio = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")

export type ArticuloTaller = {
  title: string
  texto: string
  content_html: string
  excerpt: string
  categoria: string | null
  cover_image_url: string | null
}

/** Valida lo que manda el panel del taller. */
export function leerArticuloTaller(b: Record<string, unknown>): ArticuloTaller {
  const title = limpio(b.titulo, 160)
  if (title.length < 10) throw new ErrorArticulo("El título debe tener al menos 10 letras.")
  const texto = typeof b.texto === "string" ? b.texto.replace(/\r/g, "").trim() : ""
  if (texto.length < MIN_LETRAS) throw new ErrorArticulo(`El artículo está muy corto: escribe al menos ${MIN_LETRAS} letras (unas 250 palabras). Llevas ${texto.length}.`)
  if (texto.length > MAX_LETRAS) throw new ErrorArticulo(`El artículo es muy largo (máximo ${MAX_LETRAS} letras). Divídelo en dos.`)
  const c = limpio(b.categoria, 40)
  const portada = limpio(b.portada_url, 600)
  const cover = portada ? ligaSegura(portada, true) : null
  if (portada && !cover) throw new ErrorArticulo("La portada debe ser una imagen con liga https://")
  const resumen = limpio(b.resumen, 300)
  const sinFormato = texto.replace(/[#*![\]()>-]/g, " ").replace(/\s+/g, " ").trim()
  return {
    title,
    texto,
    content_html: textoAHtmlSeguro(texto),
    excerpt: resumen || sinFormato.slice(0, 220),
    categoria: CATEGORIAS_BLOG.includes(c) ? c : null,
    cover_image_url: cover,
  }
}

/** Slug libre: el título y, si ya existe, un sufijo corto. */
export const slugTaller = (titulo: string, existe: boolean) =>
  existe ? `${slugDe(titulo).slice(0, 80)}-${Date.now().toString(36).slice(-5)}` : slugDe(titulo)
