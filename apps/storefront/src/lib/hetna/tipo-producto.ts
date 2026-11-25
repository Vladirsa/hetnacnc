// Ficha universal de producto (pedido de Vlado, 21 nov 2026): UNA sola
// plantilla para todo el catálogo. Lo que cambia entre productos no es el
// diseño, sino qué bloques tienen datos: si un campo no aplica o el taller no
// lo llenó, el bloque se oculta completo (nunca se dibuja vacío ni con "--").
//
// Siete tipos. Los tres de tipo-ficha.ts (digital / servicio / físico) siguen
// mandando en el carrito y el checkout (envío o no); aquí el físico se separa
// en cinco para que la ficha diga lo correcto:
//
//   digital     DXF/STL/STEP: descarga inmediata, licencia, sin dirección
//   herramienta fresas, brocas, refacciones: compatibilidad y garantía
//   stock       producto físico en existencia
//   tallado     tallados y piezas en madera
//   corte       cortes en acrílico, láser o plasma
//   a_medida    fabricación bajo pedido: tiempo de producción
//   servicio    servicios CAM y en línea
//
// El taller lo elige en su panel (metadata.tipo_producto, apps/vendor
// /ficha). Si no lo eligió, se deduce de la categoría, sin inventar.
import { tipoFicha } from "./tipo-ficha"

export type TipoProducto = "digital" | "herramienta" | "stock" | "tallado" | "corte" | "a_medida" | "servicio"

// Íconos que se ven en cualquier Windows o celular: 🪵 (madera) no existe en
// fuentes viejas y salía como una raya (21 nov 2026).
export const TIPOS_PRODUCTO: Record<TipoProducto, { etiqueta: string; icono: string }> = {
  digital: { etiqueta: "Archivo digital", icono: "📁" },
  herramienta: { etiqueta: "Herramienta", icono: "🔧" },
  stock: { etiqueta: "Producto físico", icono: "📦" },
  tallado: { etiqueta: "Tallado en madera", icono: "🌲" },
  corte: { etiqueta: "Corte CNC", icono: "✂️" },
  a_medida: { etiqueta: "Fabricación bajo pedido", icono: "🏭" },
  servicio: { etiqueta: "Servicio en línea", icono: "💻" },
}

type Producto = {
  metadata?: Record<string, unknown> | null
  tags?: { value?: string | null }[] | null
  type?: { value?: string | null } | null
  categories?: { name?: string | null; handle?: string | null }[] | null
  description?: string | null
  attribute_values?: { value?: unknown; attribute?: { name?: string | null } | null }[] | null
  variants?: { sku?: string | null }[] | null
}

const texto = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "")
const lista = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(texto).filter(Boolean)
    : texto(v)
        .split(/\n|;/)
        .map((s) => s.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)

const si = (v: unknown) => v === true || v === "true" || v === "1"

export function tipoProducto(p: Producto | null | undefined): TipoProducto {
  const base = tipoFicha(p as never)
  if (base !== "fisico") return base
  const m = (p?.metadata || {}) as Record<string, unknown>
  const elegido = texto(m.tipo_producto) as TipoProducto
  if (elegido && elegido in TIPOS_PRODUCTO && elegido !== "digital" && elegido !== "servicio") return elegido
  if (si(m.bajo_pedido) || si(m.a_medida)) return "a_medida"
  const cats = (p?.categories || []).map((c) => `${c?.handle || ""} ${c?.name || ""}`.toLowerCase()).join(" ")
  if (/fresa|broca|cortador|herramient|refacci|endmill|boquilla|electrodo/.test(cats)) return "herramienta"
  if (/acr[ií]lico|l[aá]ser|plasma|corte/.test(cats)) return "corte"
  if (/tallad|madera|mdf|pino/.test(cats)) return "tallado"
  return "stock"
}

// ------------------------------------------------------------- descripción

const sinEtiquetas = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()

/**
 * Quita de la descripción lo que quedó vacío de la plantilla del formulario de
 * publicar: renglones que sólo traen "-" y etiquetas sin nada ("Qué incluye:"
 * sin lista abajo). Así no sale "Qué incluye: --" en la ficha.
 */
export function limpiarDescripcion(html?: string | null): string {
  let h = String(html || "")
  // Párrafos o viñetas que sólo traen guiones, puntos o espacios
  h = h.replace(/<(p|li)[^>]*>(\s|&nbsp;|[-–—•*.])*<\/\1>/gi, "")
  // "Etiqueta:" sola, seguida de otra etiqueta, de otro párrafo que no es lista o del final
  h = h.replace(/<p[^>]*>\s*[^<:]{1,40}:\s*<\/p>(?!\s*<ul)/gi, "")
  h = h.replace(/<ul[^>]*>\s*<\/ul>/gi, "")
  return h.trim()
}

/** "Material: Pino" escrito en la descripción → "Pino". */
export function campoDeDescripcion(html: string | null | undefined, etiqueta: RegExp): string {
  for (const m of String(html || "").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = sinEtiquetas(m[1])
    const i = t.indexOf(":")
    if (i > 0 && etiqueta.test(t.slice(0, i).trim())) {
      const v = t.slice(i + 1).trim().replace(/[,;.]+$/, "")
      if (v && !/^[-–—•*.\s]+$/.test(v)) return v
    }
  }
  return ""
}

const atributo = (p: Producto, nombre: RegExp) => {
  const a = (p.attribute_values || []).find((x) => nombre.test(String(x?.attribute?.name || "")))
  return a ? texto(a.value) : ""
}

const primero = (...v: string[]) => v.find(Boolean) || ""

// ------------------------------------------------------------- datos clave

export type Fila = [string, string]

/** Los 4 datos clave junto al precio. Sólo salen los que tienen valor. */
export function datosClave(p: Producto): Fila[] {
  const tipo = tipoProducto(p)
  const m = (p.metadata || {}) as Record<string, unknown>
  const d = p.description
  const filas: Fila[] = []
  const formato = tipo === "digital" ? texto(m.formatos) : ""
  const material = primero(texto(m.material), atributo(p, /^material/i), campoDeDescripcion(d, /^material$/i), tipo === "digital" ? texto(m.material_sugerido) : "")
  if (formato) filas.push(["Formato", formato])
  else if (material) filas.push(["Material", material])
  const medida = primero(texto(m.medida_principal), texto(m.medidas), texto(m.dimensiones), atributo(p, /^medida|dimensi/i), campoDeDescripcion(d, /^medidas?$/i))
  if (medida) filas.push(["Medida", medida])
  const entrega =
    tipo === "digital"
      ? "Descarga inmediata"
      : primero(texto(m.entrega), texto(m.tiempo_produccion), texto(m.tiempo_entrega))
  if (entrega) filas.push([tipo === "a_medida" ? "Producción" : "Entrega", entrega])
  const compat = lista(m.compatibilidad).slice(0, 3).join(", ")
  const uso = primero(texto(m.uso), compat, campoDeDescripcion(d, /^para qu[eé] sirve|^uso/i), tipo === "digital" ? texto(m.maquina) || texto(m.maquina_sugerida) : "")
  if (uso) filas.push([tipo === "herramienta" || compat ? "Compatible con" : "Uso", uso])
  return filas.slice(0, 4)
}

/** SKU de la primera variante que lo tenga. */
export const skuDe = (p: Producto) => (p.variants || []).map((v) => texto(v?.sku)).find(Boolean) || ""

// ------------------------------------------------------- especificaciones

/** Tabla completa de especificaciones: datos del taller + atributos. Sin vacíos. */
export function especificaciones(p: Producto): Fila[] {
  const tipo = tipoProducto(p)
  const m = (p.metadata || {}) as Record<string, unknown>
  const d = p.description
  const filas: Fila[] = []
  const vistos = new Set<string>()
  const agrega = (etiqueta: string, valor: string) => {
    const v = valor.trim()
    if (!v || vistos.has(etiqueta.toLowerCase())) return
    vistos.add(etiqueta.toLowerCase())
    filas.push([etiqueta, v])
  }
  agrega("Tipo", TIPOS_PRODUCTO[tipo].etiqueta)
  agrega("SKU", skuDe(p))
  agrega("Material", primero(texto(m.material), campoDeDescripcion(d, /^material$/i)))
  agrega("Medidas", primero(texto(m.medidas), texto(m.dimensiones), campoDeDescripcion(d, /^medidas?$/i)))
  agrega("Medida principal", texto(m.medida_principal))
  agrega("Espesor", primero(texto(m.espesor), texto(m.grosor)))
  agrega("Tolerancia", primero(texto(m.tolerancia), texto(m.tolerancias)))
  agrega("Acabado", texto(m.acabado))
  agrega("Compatible con", lista(m.compatibilidad).join(", "))
  agrega("Uso", primero(texto(m.uso), campoDeDescripcion(d, /^para qu[eé] sirve|^uso/i)))
  agrega(tipo === "a_medida" ? "Tiempo de producción" : "Entrega", primero(texto(m.tiempo_produccion), texto(m.entrega), texto(m.tiempo_entrega)))
  agrega("Garantía", texto(m.garantia))
  for (const a of p.attribute_values || []) agrega(texto(a?.attribute?.name), texto(a?.value))
  // Con sólo "Tipo" (y quizá SKU) no vale la pena una tabla
  return filas.length > 2 ? filas : []
}

/** Qué incluye / qué no incluye (metadata del taller). */
export function incluyeDe(p: Producto): { incluye: string[]; noIncluye: string[] } {
  const m = (p.metadata || {}) as Record<string, unknown>
  return { incluye: lista(m.incluye), noIncluye: lista(m.no_incluye) }
}

// --------------------------------------------------------------- precio

/**
 * La nota junto al precio. La Ley Federal de Protección al Consumidor (art. 7
 * Bis) pide mostrar el precio total con impuestos, así que todo precio
 * publicado es el final. Lo que cambia por taller (decisión de Vlado, 21 nov
 * 2026) es si emite factura: perfil.factura del taller ("si" / "no").
 */
export function notaPrecio(seller?: { metadata?: Record<string, unknown> | null } | null): string {
  const perfil = ((seller?.metadata || {}) as { perfil?: { factura?: unknown } }).perfil
  const f = texto(perfil?.factura)
  if (f === "si") return "Precio final, IVA incluido · Este taller emite factura"
  if (f === "no") return "Precio final · Este taller no emite factura"
  return "Precio final"
}

/**
 * Medidas escritas en un texto como "600x600 mm", "25 x 15 cm" o
 * "30×20×2 cm" → "600 × 600 mm" (lo que entiende "Fabrícalo"), o "".
 */
export function medidasEnTexto(t: string | null | undefined): string {
  const m = String(t || "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m)\b/i)
  if (!m) return ""
  const k = m[4].toLowerCase() === "cm" ? 10 : m[4].toLowerCase() === "m" ? 1000 : 1
  const n = [m[1], m[2], m[3]].filter(Boolean).map((x) => Math.round(parseFloat(String(x).replace(",", ".")) * k * 10) / 10)
  return n.every((x) => x > 0) ? `${n.join(" × ")} mm` : ""
}
