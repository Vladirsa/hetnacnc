// Productos en inglés (fase 3 del inglés).
//
// El texto en inglés vive en product.metadata:
//   en_title, en_subtitle, en_description, en_seo_title, en_meta_description
//   en_hash  huella del español (título + descripción) cuando se tradujo
//   en_auto  true si lo tradujo la IA (y no el taller a mano)
// La tienda lo muestra en /us (apps/storefront/src/i18n/datos.ts).
//
// De dónde sale:
//   - la traducción inicial (scripts/productos-ingles.ts),
//   - el taller, en el panel > Productos en inglés (api/vendor/hetna-ingles),
//   - la IA, sola, al crear o cambiar un producto (subscribers/producto-ingles.ts).
// La IA nunca pisa lo que el taller escribió a mano.
import Anthropic from "@anthropic-ai/sdk"
import { createHash } from "crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { revisarMensaje } from "./chat-filtro"
import { IA_MODELO, modeloIA } from "./ia-modelo"

export const CAMPOS_EN = ["en_title", "en_subtitle", "en_description", "en_seo_title", "en_meta_description"] as const
export type CampoEn = (typeof CAMPOS_EN)[number]
export type TextoEn = Partial<Record<CampoEn, string>>

export const LIMITES_EN: Record<CampoEn, number> = {
  en_title: 200,
  en_subtitle: 300,
  en_description: 12000,
  en_seo_title: 90,
  en_meta_description: 200,
}

/** en_hash cuando el taller dejó el producto sin inglés a propósito. */
export const SIN_INGLES = "sin_ingles"

export class ErrorIngles extends Error {
  constructor(m: string, public status = 400) {
    super(m)
  }
}

/** Huella del español (la misma que usa scripts/productos-ingles.ts). */
export const huellaEs = (title: string | null | undefined, description: string | null | undefined) =>
  createHash("sha1").update(`${title || ""}\n${description || ""}`).digest("hex").slice(0, 12)

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export function leerIngles(meta: Record<string, any> | null | undefined): TextoEn {
  const out: TextoEn = {}
  for (const k of CAMPOS_EN) if (texto(meta?.[k])) out[k] = texto(meta?.[k])
  return out
}

// --------------------------------------------------------------- HTML seguro

const ETIQUETAS = new Set(["p", "br", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i"])
const escapar = (s: string) => s.replace(/&(?!(?:[a-z]+|#\d+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Descripción en HTML sencillo. Sin etiquetas: cada párrafo (línea en blanco)
 * va en <p>. Con etiquetas: sólo se quedan las de la lista y sin atributos;
 * scripts, estilos y ligas se quitan.
 */
export function descripcionSegura(entrada: string): string {
  const s = String(entrada || "").replace(/\r\n?/g, "\n").trim()
  if (!s) return ""
  if (!/<[a-z/!][^>]*>/i.test(s)) {
    return s
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`)
      .join("")
  }
  const sinPeligro = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|template)[\s\S]*?<\/\1\s*>/gi, "")
  let out = ""
  let i = 0
  const re = /<\/?([a-z0-9]+)\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sinPeligro))) {
    out += escapar(sinPeligro.slice(i, m.index))
    const tag = m[1].toLowerCase()
    if (ETIQUETAS.has(tag)) out += m[0].startsWith("</") ? `</${tag}>` : tag === "br" ? "<br>" : `<${tag}>`
    i = m.index + m[0].length
  }
  out += escapar(sinPeligro.slice(i))
  return out.trim()
}

/** Valida lo que manda el taller. Vacío = borrar ese campo. */
export function validarIngles(b: Record<string, unknown>): Record<CampoEn, string> {
  const out = {} as Record<CampoEn, string>
  for (const k of CAMPOS_EN) {
    let v = texto(b?.[k])
    if (k === "en_description") v = descripcionSegura(v)
    else v = v.replace(/\s+/g, " ")
    if (v.length > LIMITES_EN[k]) throw new ErrorIngles(`El texto es demasiado largo (máximo ${LIMITES_EN[k]} caracteres).`)
    out[k] = v
  }
  const todo = CAMPOS_EN.map((k) => out[k].replace(/<[^>]+>/g, " ")).join("\n")
  // Las medidas ("600 x 600") y cifras largas no son teléfonos: igual que en reclamos
  if (revisarMensaje(todo).motivos.some((m) => m !== "telefono")) {
    throw new ErrorIngles("Quita correos, redes sociales, ligas o datos de contacto: todo se trata dentro de HETNA.")
  }
  return out
}

// --------------------------------------------------------------- IA

export const iaInglesEncendida = () => !!process.env.ANTHROPIC_API_KEY && (process.env.INGLES_IA || "").toLowerCase() !== "off"

let ia: Anthropic | null = null

const GLOSARIO =
  "Glosario: taller -> shop; taller CNC -> CNC shop; cotización -> quote; cotizar -> get a quote; envío -> shipping; " +
  "planos -> plans; fresa -> bit; boquilla -> nozzle; lámina -> sheet; triplay -> plywood; calibre -> gauge; " +
  "Hecho en México -> Made in Mexico. No traduzcas: HETNA, HETNA CNC, Mercado Pago, PayPal, nombres de ciudades y estados de México, " +
  "nombres de software (Vectric, Fusion, ArtCAM, Mach3, LightBurn). Precios ($350, MXN), medidas (mm, cm) y formatos (DXF, STL, STEP, G-code) quedan igual."

/** Traduce el texto de un producto con IA. Devuelve sólo los campos que traían texto. */
export async function traducirProductoIA(es: {
  title: string
  subtitle?: string | null
  description?: string | null
  seo_title?: string | null
  meta_description?: string | null
}): Promise<TextoEn> {
  if (!iaInglesEncendida()) throw new ErrorIngles("La traducción automática no está disponible por ahora.", 503)
  ia ??= new Anthropic()
  const entrada = {
    title: texto(es.title),
    subtitle: texto(es.subtitle) || null,
    description: texto(es.description).slice(0, 10000) || null,
    seo_title: texto(es.seo_title) || null,
    meta_description: texto(es.meta_description) || null,
  }
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO()),
    max_tokens: 6000,
    system:
      "Traduces fichas de producto de HETNA CNC (marketplace mexicano de CNC, corte láser, impresión 3D, archivos DXF/STL y planos de carpintería) " +
      "del español de México al inglés de Estados Unidos, como lo escribiría un redactor nativo: natural y claro, sin inventar nada. " +
      "La descripción es HTML: conserva todas las etiquetas igual (mismas etiquetas, mismo orden) y traduce sólo el texto. " +
      "seo_title de máximo 65 caracteres; meta_description de máximo 158. Si un campo viene null, devuélvelo null. " +
      GLOSARIO +
      ' Responde SOLO con un objeto JSON: {"title":…,"subtitle":…,"description":…,"seo_title":…,"meta_description":…}',
    messages: [{ role: "user", content: JSON.stringify(entrada) }],
  } as any)
  if ((resp as any).stop_reason === "refusal") throw new ErrorIngles("No se pudo traducir este producto.", 502)
  const crudo = ((resp as any).content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim()
  const json = crudo.slice(crudo.indexOf("{"), crudo.lastIndexOf("}") + 1)
  let d: Record<string, unknown>
  try {
    d = JSON.parse(json)
  } catch {
    throw new ErrorIngles("La traducción automática falló. Intenta de nuevo.", 502)
  }
  const out: TextoEn = {}
  const poner = (k: CampoEn, v: unknown, fuente: unknown) => {
    const t = texto(v)
    if (!t || !texto(fuente)) return
    out[k] = (k === "en_description" ? descripcionSegura(t) : t.replace(/\s+/g, " ")).slice(0, LIMITES_EN[k])
  }
  poner("en_title", d.title, entrada.title)
  poner("en_subtitle", d.subtitle, entrada.subtitle)
  poner("en_description", d.description, entrada.description)
  poner("en_seo_title", d.seo_title, entrada.seo_title)
  poner("en_meta_description", d.meta_description, entrada.meta_description)
  if (!out.en_title) throw new ErrorIngles("La traducción automática falló. Intenta de nuevo.", 502)
  return out
}

// --------------------------------------------------------------- panel del taller

type Producto = {
  id: string
  title: string
  subtitle?: string | null
  description?: string | null
  handle: string
  thumbnail?: string | null
  status: string
  metadata?: Record<string, any> | null
}

/** Estado de la traducción: falta, al día, o vieja (el español cambió después). */
export function estadoIngles(p: Pick<Producto, "title" | "description" | "metadata">): "falta" | "lista" | "vieja" {
  const m = p.metadata || {}
  if (!texto(m.en_title)) return "falta"
  if (texto(m.en_hash) && m.en_hash !== huellaEs(p.title, p.description)) return "vieja"
  return "lista"
}

export async function productosParaIngles(container, sellerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "products.id",
      "products.title",
      "products.subtitle",
      "products.description",
      "products.handle",
      "products.thumbnail",
      "products.status",
      "products.metadata",
    ],
    filters: { id: sellerId },
  })
  const productos = ((data?.[0]?.products || []) as Producto[]).filter(Boolean)
  return productos
    .filter((p) => !p.metadata?.es_curso && p.status !== "rejected")
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "es"))
    .map((p) => ({
      id: p.id,
      handle: p.handle,
      foto: p.thumbnail || null,
      estado: p.status,
      es: {
        title: p.title,
        subtitle: p.subtitle || "",
        description: p.description || "",
        seo_title: texto(p.metadata?.seo_title),
        meta_description: texto(p.metadata?.meta_description),
      },
      en: leerIngles(p.metadata),
      auto: p.metadata?.en_auto === true,
      traduccion: estadoIngles(p),
    }))
}

async function productoDelTaller(container, sellerId: string, productId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "subtitle", "description", "metadata", "sellers.id"],
    filters: { id: productId },
  })
  const p = data?.[0]
  if (!p || !(p.sellers || []).some((s: any) => s?.id === sellerId)) throw new ErrorIngles("Ese producto no es tuyo o ya no existe.", 404)
  return p as Producto
}

/** Guarda el inglés que escribe el taller (manda sobre la IA). */
export async function guardarIngles(container, sellerId: string, productId: string, en: Record<CampoEn, string>) {
  const p = await productoDelTaller(container, sellerId, productId)
  const meta = { ...(p.metadata || {}) }
  // Vacío = "" (al combinar metadata Medusa borra la llave)
  for (const k of CAMPOS_EN) meta[k] = en[k] || ""
  const conTexto = CAMPOS_EN.some((k) => en[k])
  // Si el taller borra todo el inglés, la IA no lo vuelve a poner sola
  meta.en_hash = conTexto ? huellaEs(p.title, p.description) : SIN_INGLES
  meta.en_auto = false
  await updateProductsWorkflow(container).run({ input: { selector: { id: productId }, update: { metadata: meta } } })
  return { en: leerIngles(meta), traduccion: estadoIngles({ ...p, metadata: meta }) }
}

/** Propuesta de la IA para que el taller la revise (no se guarda). */
export async function sugerirIngles(container, sellerId: string, productId: string) {
  const p = await productoDelTaller(container, sellerId, productId)
  return traducirProductoIA({
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    seo_title: p.metadata?.seo_title,
    meta_description: p.metadata?.meta_description,
  })
}

// Tope de propuestas por taller y día (cuida el gasto de IA).
export const MAX_SUGERENCIAS_DIA = 60
const usoDia = new Map<string, { dia: string; n: number }>()
export function contarSugerencia(sellerId: string, ahora = new Date()) {
  const dia = ahora.toISOString().slice(0, 10)
  const u = usoDia.get(sellerId)
  const n = u && u.dia === dia ? u.n : 0
  if (n >= MAX_SUGERENCIAS_DIA) throw new ErrorIngles("Llegaste al límite de traducciones automáticas de hoy. Mañana puedes seguir.", 429)
  usoDia.set(sellerId, { dia, n: n + 1 })
}

// --------------------------------------------------------------- automático

/**
 * Traduce solo un producto nuevo o cambiado. No hace nada si:
 *  - la IA está apagada (sin ANTHROPIC_API_KEY o INGLES_IA=off),
 *  - el taller escribió el inglés a mano (en_auto false con texto),
 *  - la traducción ya corresponde al español de hoy (en_hash igual).
 */
export async function traducirSiHaceFalta(container, productId: string): Promise<"traducido" | "sin_cambio" | "apagado" | "manual"> {
  if (!iaInglesEncendida()) return "apagado"
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "subtitle", "description", "status", "metadata"],
    filters: { id: productId },
  })
  const p = data?.[0] as Producto | undefined
  if (!p || !texto(p.title) || p.metadata?.es_curso || p.metadata?.producto_creditos_3d) return "sin_cambio"
  const m = p.metadata || {}
  const huella = huellaEs(p.title, p.description)
  if (m.en_hash === SIN_INGLES || (texto(m.en_title) && m.en_auto !== true)) return "manual"
  if (texto(m.en_title) && m.en_hash === huella) return "sin_cambio"
  const en = await traducirProductoIA({
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    seo_title: m.seo_title,
    meta_description: m.meta_description,
  })
  const meta = { ...m }
  for (const k of CAMPOS_EN) meta[k] = en[k] || ""
  meta.en_hash = huella
  meta.en_auto = true
  await updateProductsWorkflow(container).run({ input: { selector: { id: productId }, update: { metadata: meta } } })
  return "traducido"
}
