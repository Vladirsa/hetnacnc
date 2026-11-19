// "Subir diseños" (panel de administración): la forma fácil de dar de alta los
// diseños digitales propios de HETNA.
//   1. archivo   -> se guarda en el bucket PRIVADO de B2 (originales/<sku>/...)
//   2. imagen    -> foto tal cual, con fondo blanco (IA) o en escena realista (IA),
//                   se publica en el almacenamiento público de la tienda
//   3. ficha     -> Claude ve la imagen y el nombre del archivo y propone título
//                   SEO, descripción, características, etiquetas, FAQ, categoría,
//                   precio y licencia (todo editable en la pantalla)
//   4. publicar  -> lib/publicar-diseno.ts (el mismo que usa la Digital Factory):
//                   producto + oferta en la tienda HETNA, con descarga automática.
// IA de imágenes: fal.ai (FAL_KEY, la misma del Estudio). IA de texto: Claude.
import Anthropic from "@anthropic-ai/sdk"
import { randomBytes } from "crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { uploadFile } from "./backblaze"
import { fal } from "./fabrica/estudio"
import { subir } from "./fabrica/index"
import { IA_MODELO_WHATSAPP, modeloIA } from "./ia-modelo"
import { iaSocial } from "./social-hub"

export const MAX_MB_ARCHIVO = 14
export const MAX_MB_IMAGEN = 8
export const EXTENSIONES = ["dxf", "svg", "dwg", "ai", "eps", "pdf", "stl", "step", "stp", "3mf", "obj", "crv", "crv3d", "zip", "rar", "nc", "tap", "gcode"]

export const falListo = () => !!(process.env.FAL_KEY || "").trim()

/** SKU nuevo y único para un diseño subido desde el panel. */
export function nuevoSku(ahora = new Date()) {
  const f = ahora.toISOString().slice(2, 10).replace(/-/g, "")
  return `HCNC-S-${f}-${randomBytes(2).toString("hex").toUpperCase()}`
}

export function extension(nombre: string) {
  return (String(nombre).split(".").pop() || "").toLowerCase()
}

/** Nombre de archivo seguro para la llave de B2. */
export function nombreSeguro(nombre: string) {
  const ext = extension(nombre)
  const base = String(nombre)
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${base || "archivo"}.${ext}`
}

export function slug(s: string) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/, "")
}

/** Guarda el archivo del diseño en el bucket privado. */
export async function guardarArchivo(buffer: Buffer, nombre: string, sku?: string) {
  const ext = extension(nombre)
  if (!EXTENSIONES.includes(ext)) throw new Error(`Formato .${ext} no permitido. Usa ${EXTENSIONES.join(", ")}.`)
  const s = sku && /^[A-Z0-9-]{4,40}$/.test(sku) ? sku : nuevoSku()
  const llave = `originales/${s}/${nombreSeguro(nombre)}`
  const r = await uploadFile(buffer, llave)
  if (!r.ok) throw new Error(`No se pudo guardar el archivo: ${r.reason}`)
  return { sku: s, storage_key: llave, formato: ext.toUpperCase(), nombre: String(nombre).slice(0, 120) }
}

async function bajar(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la imagen de la IA (${r.status}).`)
  return Buffer.from(await r.arrayBuffer())
}

/** Cuadrada de 1200 px sobre blanco: así se ven parejas en la tienda. */
async function cuadradaBlanca(buf: Buffer) {
  const sharp = (await import("sharp")).default
  return sharp(buf)
    .resize(1080, 1080, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer()
}

export type ModoImagen = "original" | "fondo_blanco" | "escena"

export function promptEscena(contexto: string) {
  const c = String(contexto || "").slice(0, 200)
  return (
    "Turn this CNC design into a realistic product photo: the piece physically cut on a CNC router or laser, " +
    "in natural MDF or birch plywood (or the material that fits), displayed on a clean light wooden workbench, " +
    "soft daylight, shallow depth of field, professional e-commerce photography, keep the exact shape and details of the design, " +
    "no text, no watermark, no people." +
    (c ? ` Context: ${c}.` : "")
  )
}

/** Prepara la imagen del producto y regresa su URL pública. */
export async function prepararImagen(scope: any, buffer: Buffer, nombre: string, modo: ModoImagen, contexto = "") {
  const sharp = (await import("sharp")).default
  // Siempre se normaliza (rotación, tamaño razonable) antes de cualquier cosa
  const base = await sharp(buffer).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).png().toBuffer()
  const id = randomBytes(4).toString("hex")
  if (modo === "original") {
    return { url: await subir(scope, `disenos/${id}-${slug(nombre) || "imagen"}.jpg`, "image/jpeg", await cuadradaBlanca(base)), modo }
  }
  if (!falListo()) throw new Error("Falta FAL_KEY en el servidor para mejorar imágenes con IA. Sube la imagen tal cual.")
  const original = await subir(scope, `disenos/${id}-original.png`, "image/png", base)
  if (modo === "fondo_blanco") {
    const r = await fal("fal-ai/birefnet/v2", { image_url: original, model: "General Use (Heavy)", output_format: "png" }, 4)
    const u = r?.image?.url
    if (!u) throw new Error("La IA no regresó la imagen sin fondo.")
    return { url: await subir(scope, `disenos/${id}-fondo-blanco.jpg`, "image/jpeg", await cuadradaBlanca(await bajar(u))), modo }
  }
  const r = await fal("fal-ai/flux-pro/kontext", { prompt: promptEscena(contexto), image_url: original, output_format: "jpeg", safety_tolerance: "2" }, 6)
  const u = r?.images?.[0]?.url
  if (!u) throw new Error("La IA no regresó la foto en escena.")
  const sharp2 = (await import("sharp")).default
  const lista = await sharp2(await bajar(u)).resize(1200, 1200, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer()
  return { url: await subir(scope, `disenos/${id}-escena.jpg`, "image/jpeg", lista), modo }
}

/** Subcategorías dentro de "Diseños digitales", para que la IA elija una que exista. */
export async function subcategoriasDisenos(scope: any): Promise<string[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "name", "parent_category_id"] })
  const todas = (data || []) as { id: string; name: string; parent_category_id: string | null }[]
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  const raiz = todas.find((c) => norm(c.name) === norm(process.env.DISENOS_CATEGORIA || "Diseños digitales"))
  if (!raiz) return []
  const dentro = new Set([raiz.id])
  let cambio = true
  while (cambio) {
    cambio = false
    for (const c of todas) if (c.parent_category_id && dentro.has(c.parent_category_id) && !dentro.has(c.id)) { dentro.add(c.id); cambio = true }
  }
  return todas.filter((c) => dentro.has(c.id) && c.id !== raiz.id).map((c) => c.name).sort()
}

export type FichaPropuesta = {
  titulo: string
  titulo_seo: string
  handle: string
  descripcion_corta: string
  descripcion_larga: string
  caracteristicas: string
  formatos: string
  subcategoria: string
  tags: string
  keyword_principal: string
  meta_description: string
  faq: { p: string; r: string }[]
  precio_mxn: number
  licencia: "personal" | "comercial_limitada" | "comercial_ampliada"
  nota: string
}

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "titulo_seo", "descripcion_corta", "descripcion_larga", "caracteristicas", "subcategoria", "tags", "keyword_principal", "meta_description", "faq", "precio_mxn", "licencia", "nota"],
  properties: {
    titulo: { type: "string", description: "Nombre comercial del producto en la tienda, claro: qué es + formato + máquina. Máx. 80 caracteres. Ej. 'Bandeja navideña 30x20 cm — DXF para router CNC'." },
    titulo_seo: { type: "string", description: "Título para Google, 50 a 60 caracteres, palabra clave al inicio, termina en '| HETNA CNC' si cabe." },
    descripcion_corta: { type: "string", description: "Una frase de 15 a 25 palabras: qué es y para qué sirve." },
    descripcion_larga: { type: "string", description: "2 o 3 párrafos cortos en español de México: qué es, para qué máquina y material sirve, ideas de uso o venta. Sólo lo que se ve o se sabe; no inventes medidas que no aparezcan." },
    caracteristicas: { type: "string", description: "4 a 6 puntos separados por ';' (formato, máquina, material recomendado, medidas si se ven, uso)." },
    subcategoria: { type: "string", description: "Una de la lista de subcategorías que existen; vacío si ninguna encaja." },
    tags: { type: "string", description: "6 a 10 etiquetas separadas por coma, en minúsculas, como las buscaría un cliente." },
    keyword_principal: { type: "string", description: "La búsqueda principal en Google, 2 a 5 palabras (ej. 'bandeja navideña dxf')." },
    meta_description: { type: "string", description: "Meta descripción para Google, 140 a 155 caracteres, con la palabra clave y una invitación a comprar o descargar." },
    faq: { type: "array", description: "3 preguntas frecuentes útiles con su respuesta corta.", items: { type: "object", additionalProperties: false, required: ["p", "r"], properties: { p: { type: "string" }, r: { type: "string" } } } },
    precio_mxn: { type: "number", description: "Precio sugerido en pesos: 29 a 49 para piezas sencillas, 59 a 99 para diseños elaborados o de ensamble, 129 a 249 para paquetes. Termina en 9." },
    licencia: { type: "string", enum: ["personal", "comercial_limitada", "comercial_ampliada"], description: "personal para decoración/uso propio; comercial_limitada si es un producto que un taller querría fabricar y vender." },
    nota: { type: "string", description: "Una línea para el dueño: qué revisar o qué dato falta (ej. 'confirma las medidas')." },
  },
}

let ia: Anthropic | null = null

/** Claude propone la ficha completa a partir de la imagen y el nombre del archivo. */
export async function proponerFicha(
  scope: any,
  e: { imagen_url?: string; nombre_archivo?: string; formatos?: string; nota?: string; sku?: string }
): Promise<FichaPropuesta> {
  const formatos = String(e.formatos || "").toUpperCase()
  const nombre = String(e.nombre_archivo || "").slice(0, 120)
  const vacia: FichaPropuesta = {
    titulo: nombre.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Diseño CNC",
    titulo_seo: "",
    handle: "",
    descripcion_corta: "",
    descripcion_larga: "",
    caracteristicas: "",
    formatos,
    subcategoria: "",
    tags: "",
    keyword_principal: "",
    meta_description: "",
    faq: [],
    precio_mxn: 49,
    licencia: "personal",
    nota: "Sin IA en el servidor: llena la ficha a mano.",
  }
  if (!iaSocial()) return { ...vacia, handle: slug(`${vacia.titulo} ${e.sku || ""}`) }
  const subcats: string[] = await subcategoriasDisenos(scope).catch(() => [] as string[])
  ia ??= new Anthropic()
  const contenido: any[] = []
  if (e.imagen_url) contenido.push({ type: "image", source: { type: "url", url: e.imagen_url } })
  contenido.push({
    type: "text",
    text:
      "Eres el editor de catálogo de HETNA CNC, tienda mexicana de diseños digitales para CNC (router, láser, plasma, impresión 3D). " +
      "Escribe la ficha de este diseño para venderlo en la tienda y posicionarlo en Google México. Español de México, claro y sin exagerar.\n" +
      `Archivo: ${nombre || "(sin nombre)"}\nFormatos: ${formatos || "(no se sabe)"}\n` +
      (e.nota ? `Notas del dueño: ${String(e.nota).slice(0, 500)}\n` : "") +
      (subcats.length ? `Subcategorías que existen: ${subcats.join(" | ")}\n` : "") +
      "La entrega es descarga digital inmediata; no se envía nada por paquetería.",
  })
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO_WHATSAPP()),
    max_tokens: 2500,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{ role: "user", content: contenido }],
  } as any)
  if ((resp as any).stop_reason === "refusal") return { ...vacia, handle: slug(`${vacia.titulo} ${e.sku || ""}`), nota: "La IA no pudo describir este diseño: llénalo a mano." }
  const r = JSON.parse((resp as any).content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
  const titulo = String(r.titulo || vacia.titulo).slice(0, 120)
  const precio = Math.max(19, Math.min(999, Math.round(Number(r.precio_mxn) || 49)))
  return {
    titulo,
    titulo_seo: String(r.titulo_seo || titulo).slice(0, 70),
    handle: slug(`${titulo} ${(e.sku || "").toLowerCase()}`),
    descripcion_corta: String(r.descripcion_corta || "").slice(0, 300),
    descripcion_larga: String(r.descripcion_larga || "").slice(0, 3000),
    caracteristicas: String(r.caracteristicas || "").slice(0, 800),
    formatos,
    subcategoria: subcats.includes(r.subcategoria) ? r.subcategoria : "",
    tags: String(r.tags || "").slice(0, 300),
    keyword_principal: String(r.keyword_principal || "").slice(0, 80),
    meta_description: String(r.meta_description || "").slice(0, 160),
    faq: (Array.isArray(r.faq) ? r.faq : []).slice(0, 5).map((x: any) => ({ p: String(x.p || "").slice(0, 200), r: String(x.r || "").slice(0, 500) })),
    precio_mxn: precio,
    licencia: ["personal", "comercial_limitada", "comercial_ampliada"].includes(r.licencia) ? r.licencia : "personal",
    nota: String(r.nota || "").slice(0, 300),
  }
}

/** Revisa lo que llega de la pantalla antes de publicar. Devuelve el error o null. */
export function revisarParaPublicar(b: any): string | null {
  if (b?.derechos_confirmados !== true) return "Confirma que el diseño es tuyo o que tienes derecho a venderlo."
  if (!b?.archivo_storage_key || !String(b.archivo_storage_key).startsWith("originales/")) return "Falta subir el archivo del diseño."
  if (!b?.sku || !/^[A-Z0-9-]{4,40}$/.test(String(b.sku))) return "Falta el SKU del diseño."
  if (!String(b?.titulo || "").trim() || String(b.titulo).trim().length < 3) return "Falta el título."
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(b?.handle || ""))) return "La dirección (handle) debe ir en minúsculas con guiones."
  if (String(b?.descripcion_larga || "").trim().length < 10) return "Falta la descripción."
  if (b?.gratis !== true && !(Number(b?.precio_mxn) > 0)) return "Pon un precio o márcalo como gratis."
  if (!b?.imagen_url) return "Falta la imagen del producto."
  return null
}
