// Agente SEO: investiga qué escribe la gente en Google y mejora el título y la
// descripción con que aparece cada producto en los buscadores.
//
//   1. Investigación: para cada producto pregunta al autocompletado público de
//      Google (México, español) qué búsquedas reales empiezan con su tema.
//   2. Propuesta: Claude escribe el título SEO (≤ 65 caracteres, la búsqueda
//      principal al inicio), la descripción para Google (≤ 155) y la búsqueda
//      principal, sin inventar datos del producto.
//   3. Aplica:
//      - Productos de la tienda de HETNA: se cambian solos (metadata.seo_title,
//        metadata.meta_description y el título visible). Lo anterior queda en
//        metadata.seo_anterior para poder regresarlo. La dirección (handle) NO
//        se toca: las ligas y el posicionamiento ya ganado no se pierden.
//      - Productos de los talleres: queda como sugerencia (metadata.seo_sugerencia)
//        y el taller la acepta con un clic desde su tablero.
//   4. Te manda a Telegram qué cambió y las búsquedas que más aparecen.
//
// Cada producto se revisa a lo más cada 60 días (metadata.seo_revisado).
// Variables: SEO_AGENTE_APAGADO=1 · SEO_POR_CORRIDA=12
import Anthropic from "@anthropic-ai/sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { camSellerHandle } from "../modules/cam/catalog"
import { IA_MODELO, modeloIA } from "./ia-modelo"
import { STORE_URL } from "./licitacion"
import { iaSocial } from "./social-hub"
import { mandarPrivado } from "./social-telegram"

const DIA = 86_400_000
const DIAS_ENTRE_REVISIONES = 60
// La tienda agrega " | HETNA CNC" (12) a cada título: 52 + 12 ≈ 64, lo que Google muestra completo.
const MAX_TITULO = 52
const MAX_META = 155

export const seoApagado = () => ["1", "true", "si"].includes(String(process.env.SEO_AGENTE_APAGADO || "").toLowerCase())

export type PropuestaSeo = { titulo_seo: string; meta_description: string; keyword_principal: string; titulo_visible: string; motivo: string }

/** Búsquedas reales del autocompletado de Google México que empiezan con `semilla`. */
export async function sugerenciasGoogle(semilla: string): Promise<string[]> {
  const q = semilla.trim().toLowerCase().slice(0, 80)
  if (!q) return []
  try {
    const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=mx&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HETNA-SEO/1.0)" },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return []
    const d = JSON.parse(await r.text())
    return (Array.isArray(d?.[1]) ? d[1] : []).map((s: unknown) => String(s)).filter(Boolean).slice(0, 10)
  } catch {
    return []
  }
}

/** Palabras clave para preguntarle a Google: el título sin medidas, SKU ni ruido. */
export function semillas(titulo: string, categoria?: string): string[] {
  const limpio = String(titulo || "")
    .toLowerCase()
    .replace(/hcnc-[a-z0-9-]+/g, " ")
    .replace(/\b\d+([.,]\d+)?\s*x\s*\d+([.,]\d+)?(\s*x\s*\d+([.,]\d+)?)?/g, " ")
    .replace(/\b\d+([.,]\d+)?\s*(x|mm|cm|m|pulg|")\b/g, " ")
    .replace(/[|·•—–\-_/()[\]{}:;,.!?¿¡"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const palabras = limpio.split(" ").filter((p) => p.length > 2)
  const s = new Set<string>()
  if (palabras.length) s.add(palabras.slice(0, 3).join(" "))
  if (palabras.length > 1) s.add(palabras.slice(0, 2).join(" "))
  if (categoria) s.add(String(categoria).toLowerCase().slice(0, 40))
  return [...s].filter(Boolean).slice(0, 3)
}

/** Recorta sin partir palabras. */
/** Quita la marca al final ("… | HETNA CNC", "- HETNA"): la tienda ya la agrega. */
export function sinMarca(s: string) {
  return String(s || "").replace(/\s*[|\-–—·:]\s*HETNA(\s+CNC)?(\s+Digital\s+Factory)?\s*$/i, "").trim()
}

export function recortar(s: string, max: number) {
  const t = String(s || "").replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  const corte = t.slice(0, max + 1)
  const i = corte.lastIndexOf(" ")
  return (i > max * 0.6 ? corte.slice(0, i) : t.slice(0, max)).replace(/[\s,;:·|-]+$/, "")
}

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo_seo", "meta_description", "keyword_principal", "titulo_visible", "motivo"],
  properties: {
    titulo_seo: { type: "string", description: "Título para Google, máx. 52 caracteres, con la búsqueda principal al inicio. SIN la marca: la tienda agrega «| HETNA CNC» sola. Sin mayúsculas sostenidas ni signos de más." },
    meta_description: { type: "string", description: "Descripción para Google, máx. 155 caracteres: qué es, para qué sirve y un motivo para dar clic (envío, descarga inmediata, a la medida…). Sólo datos que estén en la ficha." },
    keyword_principal: { type: "string", description: "La búsqueda real (de la lista de Google) que mejor describe el producto." },
    titulo_visible: { type: "string", description: "Título para la página del producto, máx. 80 caracteres, claro y con la búsqueda principal; puede llevar medida o formato si la ficha lo dice." },
    motivo: { type: "string", description: "Una línea para el dueño: por qué este título." },
  },
}

let ia: Anthropic | null = null

export async function proponerSeo(p: { titulo: string; descripcion?: string; categoria?: string; busquedas: string[] }): Promise<PropuestaSeo | null> {
  if (!iaSocial()) return null
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO()),
    max_tokens: 1200,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [
      {
        role: "user",
        content:
          "Eres el especialista SEO de HETNA CNC, marketplace mexicano de CNC (máquinas, herramientas, servicios de corte y diseños digitales). " +
          "Mejora cómo aparece este producto en Google México. Usa las búsquedas reales de abajo; elige la que de verdad describe el producto. " +
          "No inventes medidas, materiales, marcas ni precios que no estén en la ficha. Español de México.\n\n" +
          `Título actual: ${p.titulo}\n` +
          (p.categoria ? `Categoría: ${p.categoria}\n` : "") +
          `Ficha: ${String(p.descripcion || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500)}\n\n` +
          `Búsquedas reales en Google México: ${p.busquedas.length ? p.busquedas.join(" | ") : "(no hubo; usa tu criterio)"}`,
      },
    ],
  } as any)
  if ((resp as any).stop_reason === "refusal") return null
  const r = JSON.parse((resp as any).content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
  return {
    titulo_seo: recortar(sinMarca(r.titulo_seo), MAX_TITULO),
    meta_description: recortar(r.meta_description, MAX_META),
    keyword_principal: recortar(r.keyword_principal, 80),
    titulo_visible: recortar(sinMarca(r.titulo_visible || r.titulo_seo), 80),
    motivo: recortar(r.motivo, 200),
  }
}

/** ¿Toca revisar este producto? */
export function tocaRevisar(meta: Record<string, any> | null | undefined, ahora = new Date()) {
  const r = meta?.seo_revisado
  return !r || ahora.getTime() - new Date(r).getTime() > DIAS_ENTRE_REVISIONES * DIA
}

const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function correrAgenteSeo(container: MedusaContainer, o: { probar?: boolean; ahora?: Date; max?: number } = {}) {
  const ahora = o.ahora || new Date()
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const productos = container.resolve(Modules.PRODUCT) as any
  const max = o.max || Math.max(1, Number(process.env.SEO_POR_CORRIDA) || 12)
  const casa = camSellerHandle()
  const r = { aplicados: [] as string[], sugeridos: 0, revisados: 0, busquedas: new Map<string, number>() }

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "description", "subtitle", "status", "metadata", "categories.name", "sellers.id", "sellers.handle"],
    filters: { status: "published" } as any,
  })
  const pendientes = ((data || []) as any[]).filter((p) => tocaRevisar(p.metadata, ahora)).slice(0, max)

  for (const p of pendientes) {
    const categoria = p.categories?.[0]?.name || ""
    const busquedas: string[] = []
    for (const s of semillas(p.title, categoria)) {
      for (const b of await sugerenciasGoogle(s)) if (!busquedas.includes(b)) busquedas.push(b)
      await new Promise((ok) => setTimeout(ok, 400))
    }
    for (const b of busquedas) r.busquedas.set(b, (r.busquedas.get(b) || 0) + 1)
    let prop: PropuestaSeo | null = null
    try {
      prop = await proponerSeo({ titulo: p.title, descripcion: p.description || p.subtitle, categoria, busquedas: busquedas.slice(0, 15) })
    } catch {
      prop = null
    }
    r.revisados++
    const meta = { ...(p.metadata || {}) }
    if (!prop) {
      if (!o.probar) await productos.updateProducts(p.id, { metadata: { ...meta, seo_revisado: ahora.toISOString() } })
      continue
    }
    const esCasa = (p.sellers || []).some((s: any) => s?.handle === casa)
    if (o.probar) {
      esCasa ? r.aplicados.push(`${p.title} → ${prop.titulo_visible}`) : r.sugeridos++
      continue
    }
    if (esCasa) {
      await productos.updateProducts(p.id, {
        title: prop.titulo_visible,
        metadata: {
          ...meta,
          seo_title: prop.titulo_seo,
          meta_description: prop.meta_description,
          seo_keyword: prop.keyword_principal,
          seo_anterior: { title: p.title, seo_title: meta.seo_title || null, meta_description: meta.meta_description || null, fecha: ahora.toISOString() },
          seo_revisado: ahora.toISOString(),
        },
      })
      r.aplicados.push(`<a href="${STORE_URL}/mx/products/${p.handle}">${escHtml(p.title)}</a> → <b>${escHtml(prop.titulo_visible)}</b>`)
    } else {
      await productos.updateProducts(p.id, {
        metadata: { ...meta, seo_sugerencia: { ...prop, fecha: ahora.toISOString() }, seo_revisado: ahora.toISOString() },
      })
      r.sugeridos++
    }
  }

  if (!o.probar && (r.aplicados.length || r.sugeridos)) {
    const top = [...r.busquedas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b]) => escHtml(b))
    const texto =
      `🔎 Agente SEO: ${r.revisados} producto(s) revisado(s)\n\n` +
      (r.aplicados.length ? `<b>Títulos mejorados en la tienda de HETNA</b>\n${r.aplicados.slice(0, 12).join("\n")}\n\n` : "") +
      (r.sugeridos ? `💡 ${r.sugeridos} sugerencia(s) para talleres: las aceptan con un clic en su tablero.\n\n` : "") +
      (top.length ? `<b>Lo que la gente busca en Google</b>\n${top.join(" · ")}` : "")
    await mandarPrivado(knex, { texto: texto.slice(0, 3800) }).catch(() => undefined)
  }
  return { revisados: r.revisados, aplicados: r.aplicados.length, sugeridos: r.sugeridos }
}

/** El taller acepta la sugerencia SEO de uno de sus productos. */
export async function aceptarSugerencia(container: MedusaContainer, sellerId: string, productId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productos = container.resolve(Modules.PRODUCT) as any
  const { data } = await query.graph({ entity: "product", fields: ["id", "title", "metadata", "sellers.id"], filters: { id: productId } as any })
  const p: any = data?.[0]
  if (!p || !(p.sellers || []).some((s: any) => s?.id === sellerId)) return { ok: false, message: "Ese producto no es tuyo o ya no existe." }
  const s = p.metadata?.seo_sugerencia
  if (!s) return { ok: false, message: "Ese producto ya no tiene sugerencia." }
  const { seo_sugerencia, ...resto } = p.metadata || {}
  await productos.updateProducts(p.id, {
    title: s.titulo_visible || p.title,
    metadata: {
      ...resto,
      seo_title: s.titulo_seo,
      meta_description: s.meta_description,
      seo_keyword: s.keyword_principal,
      seo_anterior: { title: p.title, seo_title: resto.seo_title || null, meta_description: resto.meta_description || null, fecha: new Date().toISOString() },
    },
  })
  return { ok: true }
}

/** El taller descarta la sugerencia. */
export async function descartarSugerencia(container: MedusaContainer, sellerId: string, productId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productos = container.resolve(Modules.PRODUCT) as any
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "sellers.id"], filters: { id: productId } as any })
  const p: any = data?.[0]
  if (!p || !(p.sellers || []).some((s: any) => s?.id === sellerId)) return { ok: false, message: "Ese producto no es tuyo o ya no existe." }
  const { seo_sugerencia, ...resto } = p.metadata || {}
  await productos.updateProducts(p.id, { metadata: resto })
  return { ok: true }
}

/** Sugerencias pendientes de un taller (para su tablero). */
export async function sugerenciasDelTaller(container: MedusaContainer, sellerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: ["id", "products.id", "products.title", "products.metadata"], filters: { id: sellerId } as any })
  return (((data?.[0] as any)?.products || []) as any[])
    .filter((p) => p?.metadata?.seo_sugerencia)
    .map((p) => ({ id: p.id, titulo: p.title, sugerencia: p.metadata.seo_sugerencia }))
}
