// Mercado Libre: cada taller conecta SU cuenta y publica sus productos de HETNA.
//
// Fuentes (documentación oficial, leída el 23 nov 2026):
//   developers.mercadolibre.com.mx/es_ar/autenticacion-y-autorizacion
//   developers.mercadolibre.com.mx/es_ar/publica-productos
//   developers.mercadolibre.com.mx/es_ar/categoriza-productos
//   developers.mercadolibre.com.mx/es_ar/descripcion-de-articulos
//   developers.mercadolibre.com.mx/es_ar/user-products
//
// Reglas que salen de ahí y no se pueden cambiar:
//   - El redirect_uri tiene que ser EXACTAMENTE el registrado en la app de
//     Mercado Libre y sin datos variables: lo variable va en `state`.
//   - El access_token dura 6 horas. El refresh_token es de UN SOLO USO y sólo
//     vale el último: dos renovaciones a la vez dejan muerta la conexión. Por
//     eso se renueva de una en una por taller (enCola) y siempre se guarda el nuevo.
//   - La descripción se manda DESPUÉS de crear la publicación, en texto plano.
//   - Vendedores con la etiqueta "user_product_seller" publican con family_name
//     (el title ya no se manda).
//   - Las publicaciones de productos nuevos en México piden Mercado Pago (pago
//     inmediato); eso lo pone Mercado Libre solo.
//   - Mercado Libre prohíbe datos de contacto y ligas externas en la
//     publicación: limpiarDescripcion() los quita.
//
// Variables (.env del API): ML_CLIENT_ID, ML_CLIENT_SECRET y, si la dirección
// registrada no es la de siempre, ML_REDIRECT_URI. Sin LLAVES_CIFRADO no se
// conecta nada (los tokens no se guardan en claro).
import { createHmac, timingSafeEqual } from "crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MERCADOLIBRE_MODULE } from "../modules/mercadolibre"
import { cifradoListo, cifrar, descifrar } from "./cifrado-llaves"
import { disponiblesOferta } from "./aviso-existencia"
import { perfilesDigitales } from "./envio-digital"

const API = "https://api.mercadolibre.com"
const AUTORIZAR = "https://auth.mercadolibre.com.mx/authorization"
const SITIO_ML = "MLM"
const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
export const REDIRECT_ML = () => process.env.ML_REDIRECT_URI || `${SITIO}/api/ml/callback`

export class ErrorML extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

// ── ¿Se puede usar? ─────────────────────────────────────────────────────
/** null si todo está listo; si no, por qué (para enseñarlo en el panel). */
export function motivoNoDisponible(): string | null {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) return "falta_app"
  if (!cifradoListo()) return "falta_cifrado"
  if (!secretoState()) return "falta_secreto"
  return null
}

// ── state firmado (el callback no trae sesión del taller) ──────────────
// Mismo esquema que Mercado Pago/PayPal (lib/cotizacion-liga.ts): sin firma,
// cualquiera podría conectar SU cuenta de Mercado Libre al taller de otro.
const secretoState = () => {
  const s = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || ""
  return s && s !== "supersecret" ? s : ""
}
const firmar = (datos: string) => createHmac("sha256", secretoState()).update(`ml:${datos}`).digest("base64url")

export function stateParaTaller(sellerId: string, ahora = Date.now()): string {
  const datos = `${sellerId}.${ahora}`
  return `${datos}.${firmar(datos)}`
}

export function leerStateML(state: string, ahora = Date.now()): string | null {
  if (!secretoState()) return null
  const partes = String(state || "").split(".")
  if (partes.length !== 3) return null
  const [sellerId, ts, firma] = partes
  const esperada = firmar(`${sellerId}.${ts}`)
  try {
    if (!timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null
  } catch {
    return null
  }
  if (!(ahora - Number(ts) <= 30 * 60_000)) return null // media hora para terminar
  return sellerId
}

export function ligaParaConectar(sellerId: string): string {
  const motivo = motivoNoDisponible()
  if (motivo) throw new ErrorML("Conectar Mercado Libre todavía no está activo.", 503)
  return (
    `${AUTORIZAR}?response_type=code&client_id=${encodeURIComponent(process.env.ML_CLIENT_ID!)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_ML())}&state=${encodeURIComponent(stateParaTaller(sellerId))}`
  )
}

// ── Llamadas al API ─────────────────────────────────────────────────────
type Token = { access_token: string; refresh_token: string; expires_in: number; user_id: number | string }

async function pedirToken(cuerpo: Record<string, string>): Promise<Token> {
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.ML_CLIENT_ID!, client_secret: process.env.ML_CLIENT_SECRET!, ...cuerpo }).toString(),
    signal: AbortSignal.timeout(20_000),
  })
  const d = (await r.json().catch(() => ({}))) as any
  if (!r.ok || !d.access_token || !d.refresh_token) {
    // invalid_grant = el code o el refresh_token ya no sirven (vencido, usado o revocado)
    const e = new ErrorML(d.error === "invalid_grant" ? "vencida" : `Mercado Libre no aceptó la conexión (${d.error || r.status}).`, r.status)
    ;(e as any).codigo = d.error
    throw e
  }
  return d as Token
}

export async function mlApi<T = any>(token: string, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(25_000),
  })
  const d = (await r.json().catch(() => ({}))) as any
  if (!r.ok) throw new ErrorML(mensajeDeError(d) || `Mercado Libre respondió ${r.status}.`, r.status)
  return d as T
}

/** El mensaje útil de un error de Mercado Libre (cause[] trae el detalle por campo). */
export function mensajeDeError(d: any): string {
  const causas = Array.isArray(d?.cause) ? d.cause.map((c: any) => c?.message).filter(Boolean) : []
  return [d?.message, ...causas].filter(Boolean).join(" · ").slice(0, 600)
}

const servicio = (container: any) => container.resolve(MERCADOLIBRE_MODULE) as any

// ── Conectar y desconectar ─────────────────────────────────────────────
export async function terminarConexion(container: any, code: string, state: string) {
  const sellerId = leerStateML(state)
  if (!sellerId) throw new ErrorML("La liga para conectar venció. Vuelve a intentarlo desde tu panel.")
  if (motivoNoDisponible()) throw new ErrorML("Conectar Mercado Libre todavía no está activo.", 503)
  const t = await pedirToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_ML() })
  const yo = await mlApi<{ id: number; nickname?: string; tags?: string[] }>(t.access_token, "GET", "/users/me")
  const datos = {
    seller_id: sellerId,
    ml_user_id: String(yo.id || t.user_id),
    apodo: yo.nickname || null,
    access_token: cifrar(t.access_token),
    refresh_token: cifrar(t.refresh_token),
    expira_en: new Date(Date.now() + (Number(t.expires_in) || 21600) * 1000),
    user_products: (yo.tags || []).includes("user_product_seller"),
  }
  const svc = servicio(container)
  const [previa] = await svc.listMlCuentas({ seller_id: sellerId })
  if (previa) await svc.updateMlCuentas({ id: previa.id, ...datos })
  else await svc.createMlCuentas(datos)
}

export async function desconectar(container: any, sellerId: string) {
  const svc = servicio(container)
  const cuentas = await svc.listMlCuentas({ seller_id: sellerId })
  if (cuentas.length) await svc.deleteMlCuentas(cuentas.map((c: any) => c.id))
}

// Una renovación a la vez por taller (el refresh_token es de un solo uso)
const enCola = new Map<string, Promise<string>>()

/** access_token vigente del taller; lo renueva si le faltan menos de 10 minutos. */
export async function tokenDelTaller(container: any, sellerId: string): Promise<{ token: string; cuenta: any }> {
  const svc = servicio(container)
  const leer = async () => (await svc.listMlCuentas({ seller_id: sellerId }))[0]
  let cuenta = await leer()
  if (!cuenta) throw new ErrorML("Primero conecta tu cuenta de Mercado Libre.", 409)
  if (new Date(cuenta.expira_en).getTime() - Date.now() > 10 * 60_000) return { token: descifrar(cuenta.access_token), cuenta }

  let pendiente = enCola.get(sellerId)
  if (!pendiente) {
    pendiente = (async () => {
      const fresca = await leer() // otra petición pudo renovarlo mientras tanto
      if (new Date(fresca.expira_en).getTime() - Date.now() > 10 * 60_000) return descifrar(fresca.access_token)
      try {
        const t = await pedirToken({ grant_type: "refresh_token", refresh_token: descifrar(fresca.refresh_token) })
        await svc.updateMlCuentas({
          id: fresca.id,
          access_token: cifrar(t.access_token),
          refresh_token: cifrar(t.refresh_token),
          expira_en: new Date(Date.now() + (Number(t.expires_in) || 21600) * 1000),
        })
        return t.access_token
      } catch (e) {
        if ((e as any).codigo === "invalid_grant") {
          await svc.deleteMlCuentas([fresca.id]) // ya no sirve: que vuelva a conectar
          throw new ErrorML("Tu conexión con Mercado Libre venció. Vuelve a conectar tu cuenta.", 409)
        }
        throw e
      }
    })().finally(() => enCola.delete(sellerId))
    enCola.set(sellerId, pendiente)
  }
  const token = await pendiente
  cuenta = await leer()
  return { token, cuenta }
}

// ── Qué se puede publicar ──────────────────────────────────────────────
const TIPOS_NO = new Set(["digital", "servicio", "a_medida"])

export type ProductoTaller = {
  id: string
  title: string
  handle?: string
  status?: string
  description?: string | null
  thumbnail?: string | null
  images?: { url?: string | null }[] | null
  metadata?: Record<string, any> | null
  attribute_values?: { value?: string | null; attribute?: { name?: string | null; handle?: string | null } | null }[] | null
}

export type OfertaTaller = {
  id: string
  product_id?: string
  seller_id?: string
  shipping_profile_id?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  prices?: { amount?: number | string | null; currency_code?: string | null }[] | null
  inventory_item_link?: any[]
}

/** Precio en pesos de la oferta (el más bajo en MXN) o null. Medusa guarda pesos, no centavos. */
export const precioOferta = (o: OfertaTaller): number | null => {
  const mxn = (o.prices || []).filter((p) => String(p.currency_code).toLowerCase() === "mxn").map((p) => Number(p.amount)).filter((n) => n > 0)
  return mxn.length ? Math.min(...mxn) : null
}

/** ¿Se puede publicar en Mercado Libre? Si no, por qué (en palabras del taller). */
export function elegibilidad(p: ProductoTaller, o: OfertaTaller | undefined, digitales: Set<string>): { ok: true; precio: number; existencia: number } | { ok: false; motivo: string } {
  const m = p.metadata || {}
  if (p.status && p.status !== "published") return { ok: false, motivo: "No está publicado en HETNA." }
  if (m.producto_digital === true || m.producto_digital === "true" || m.producto_creditos_3d) return { ok: false, motivo: "Es un archivo digital." }
  if (m.producto_servicio || m.hetna_cam_service) return { ok: false, motivo: "Es un servicio." }
  if (TIPOS_NO.has(String(m.tipo_producto || ""))) {
    return { ok: false, motivo: m.tipo_producto === "a_medida" ? "Se fabrica bajo pedido (Mercado Libre pide existencias)." : m.tipo_producto === "digital" ? "Es un archivo digital." : "Es un servicio." }
  }
  if (!o) return { ok: false, motivo: "No tiene precio ni existencias tuyas." }
  if (o.shipping_profile_id && digitales.has(o.shipping_profile_id)) return { ok: false, motivo: "Se entrega digital." }
  const precio = precioOferta(o)
  if (!precio) return { ok: false, motivo: "No tiene precio en pesos." }
  const existencia = disponiblesOferta(o as any)
  if (!Number.isFinite(existencia)) return { ok: false, motivo: "No lleva control de existencias (Mercado Libre pide un número)." }
  if (existencia <= 0) return { ok: false, motivo: "Sin existencias." }
  if (!(p.thumbnail || p.images?.some((i) => i?.url))) return { ok: false, motivo: "No tiene foto." }
  return { ok: true, precio, existencia }
}

// ── Textos para Mercado Libre ──────────────────────────────────────────
/** Título: sin signos ni símbolos y cortado en palabra completa (máx. de la categoría). */
export function tituloML(titulo: string, max = 60): string {
  const limpio = String(titulo || "")
    .replace(/[¡!¿?*#@$%^&+=~`|\\<>{}[\]"“”'´]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max + 1)
  const espacio = corte.lastIndexOf(" ")
  return (espacio > max * 0.5 ? corte.slice(0, espacio) : limpio.slice(0, max)).trim()
}

/**
 * Descripción en texto plano, sin HTML, ligas, correos, teléfonos ni WhatsApp
 * (Mercado Libre los prohíbe) y sin emojis (rechaza caracteres fuera del texto común).
 */
export function limpiarDescripcion(html: string | null | undefined): string {
  let t = String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  t = t
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "") // correos antes que dominios
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\b[\w.-]+\.(com|mx|net|org)(\.mx)?\b\S*/gi, "")
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, "")
    .replace(/^.*\b(whats\s?app|wa\.me|ll[aá]manos|escr[ií]benos|tel[eé]fono|correo|e-?mail|cel(ular)?:)\b.*$/gim, "")
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n°×±²³½¼¾$+=<>|~^`]/gu, "")
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 45_000)
}

/** URL absoluta de una imagen (Mercado Libre la descarga de nuestra dirección). */
export const imagenAbsoluta = (u: string) => (/^https?:\/\//i.test(u) ? u : `${SITIO}${u.startsWith("/") ? "" : "/"}${u}`)

/** Valor de un atributo del producto por nombre ("Marca", "Modelo"…). */
export function valorAtributo(p: ProductoTaller, ...nombres: string[]): string | null {
  const buscados = nombres.map((n) => n.toLowerCase())
  for (const av of p.attribute_values || []) {
    const n = String(av.attribute?.name || av.attribute?.handle || "").toLowerCase()
    if (buscados.includes(n) && av.value) return String(av.value).trim()
  }
  return null
}

export type AtributoRequerido = { id: string; nombre: string; tipo: string; valores: string[]; condicional: boolean }

export type Borrador = {
  titulo: string
  categoria_id: string
  precio: number
  existencia: number
  imagenes: string[]
  tipo_publicacion: "gold_special" | "gold_pro"
  atributos: { id: string; value_name: string }[]
  user_products: boolean
}

/** Cuerpo de POST /items (sin descripción: va aparte). */
export function armarItem(b: Borrador) {
  return {
    ...(b.user_products ? { family_name: b.titulo } : { title: b.titulo }),
    category_id: b.categoria_id,
    price: Math.round(b.precio * 100) / 100,
    currency_id: "MXN",
    available_quantity: Math.max(1, Math.floor(b.existencia)),
    buying_mode: "buy_it_now",
    listing_type_id: b.tipo_publicacion,
    condition: "new",
    pictures: b.imagenes.slice(0, 10).map((source) => ({ source })),
    attributes: [{ id: "ITEM_CONDITION", value_name: "Nuevo" }, ...b.atributos.filter((a) => a.id !== "ITEM_CONDITION" && a.value_name)],
  }
}

// ── Lo que ve el taller ────────────────────────────────────────────────
async function datosDelTaller(container: any, sellerId: string, productIds?: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: vendedores } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "products.id", "products.title", "products.handle", "products.status", "products.description", "products.thumbnail",
      "products.images.url", "products.metadata",
      "products.attribute_values.value", "products.attribute_values.attribute.name", "products.attribute_values.attribute.handle",
    ],
    filters: { id: sellerId },
  })
  let productos = ((vendedores?.[0]?.products || []) as ProductoTaller[]).filter(Boolean)
  if (productIds) productos = productos.filter((p) => productIds.includes(p.id))
  const ids = productos.map((p) => p.id)
  const { data: ofertas } = ids.length
    ? await query.graph({
        entity: "offer",
        fields: [
          "id", "product_id", "seller_id", "shipping_profile_id", "manage_inventory", "allow_backorder", "prices.amount", "prices.currency_code",
          "inventory_item_link.required_quantity",
          "inventory_item_link.inventory_item.location_levels.stocked_quantity",
          "inventory_item_link.inventory_item.location_levels.reserved_quantity",
        ],
        filters: { product_id: ids, seller_id: sellerId },
      })
    : { data: [] }
  // Con varias variantes se toma la oferta del taller con más existencias
  const oferta = new Map<string, OfertaTaller>()
  for (const o of (ofertas || []) as OfertaTaller[]) {
    const previa = oferta.get(o.product_id!)
    if (!previa || disponiblesOferta(o as any) > disponiblesOferta(previa as any)) oferta.set(o.product_id!, o)
  }
  return { productos, oferta, digitales: await perfilesDigitales(container) }
}

export async function estadoDelTaller(container: any, sellerId: string) {
  const motivo = motivoNoDisponible()
  const svc = servicio(container)
  const [cuenta] = motivo ? [] : await svc.listMlCuentas({ seller_id: sellerId })
  const publicaciones = cuenta ? await svc.listMlPublicacions({ seller_id: sellerId }) : []
  const { productos, oferta, digitales } = await datosDelTaller(container, sellerId)
  return {
    disponible: !motivo,
    motivo,
    redirect_uri: REDIRECT_ML(),
    cuenta: cuenta ? { apodo: cuenta.apodo, ml_user_id: cuenta.ml_user_id, user_products: cuenta.user_products } : null,
    productos: productos.map((p) => {
      const e = elegibilidad(p, oferta.get(p.id), digitales)
      const pub = publicaciones.find((x: any) => x.product_id === p.id)
      return {
        id: p.id,
        titulo: p.title,
        imagen: p.thumbnail || p.images?.[0]?.url || null,
        elegible: e.ok,
        motivo: e.ok ? null : e.motivo,
        precio: e.ok ? e.precio : null,
        existencia: e.ok ? e.existencia : null,
        publicacion: pub ? { ml_item_id: pub.ml_item_id, permalink: pub.permalink, estado: pub.estado, error: pub.ultimo_error } : null,
      }
    }),
  }
}

/** Vista previa: categoría sugerida, título, precio, fotos y los datos que pide la categoría. */
export async function vistaPrevia(container: any, sellerId: string, productId: string, categoriaElegida?: string) {
  const { token, cuenta } = await tokenDelTaller(container, sellerId)
  const { productos, oferta, digitales } = await datosDelTaller(container, sellerId, [productId])
  const p = productos[0]
  if (!p) throw new ErrorML("Ese producto no es tuyo o ya no existe.", 404)
  const e = elegibilidad(p, oferta.get(p.id), digitales)
  if (!e.ok) throw new ErrorML(e.motivo)

  type Sugerida = { category_id: string; category_name: string; domain_name: string; attributes?: { id: string; value_name?: string }[] }
  const sugeridas: Sugerida[] = await mlApi<Sugerida[]>(
    token, "GET", `/sites/${SITIO_ML}/domain_discovery/search?limit=3&q=${encodeURIComponent(p.title)}`
  ).catch(() => [] as Sugerida[])
  const categoria_id = categoriaElegida || sugeridas[0]?.category_id
  if (!categoria_id) throw new ErrorML("Mercado Libre no sugirió una categoría para este título. Prueba con un título más descriptivo.")
  const [cat, atributosCat] = await Promise.all([
    mlApi<any>(token, "GET", `/categories/${categoria_id}`),
    mlApi<any[]>(token, "GET", `/categories/${categoria_id}/attributes`),
  ])
  const requeridos: AtributoRequerido[] = (atributosCat || [])
    .filter((a) => a?.tags?.required || a?.tags?.conditional_required)
    .filter((a) => a.id !== "ITEM_CONDITION")
    .map((a) => ({ id: a.id, nombre: a.name, tipo: a.value_type, valores: (a.values || []).map((v: any) => v.name).slice(0, 50), condicional: !a.tags?.required }))
  // Lo que ya sabemos: atributos del producto en HETNA y los que sugiere el predictor
  const sugerido = new Map((sugeridas.find((s) => s.category_id === categoria_id)?.attributes || []).map((a) => [a.id, a.value_name || ""]))
  const valores: Record<string, string> = {}
  for (const a of requeridos) {
    const v = a.id === "BRAND" ? valorAtributo(p, "marca", "brand") : a.id === "MODEL" ? valorAtributo(p, "modelo", "model") : valorAtributo(p, a.nombre)
    if (v || sugerido.get(a.id)) valores[a.id] = (v || sugerido.get(a.id))!
  }
  const max = Number(cat?.settings?.max_title_length) || 60
  return {
    producto_id: p.id,
    titulo: tituloML(p.title, max),
    max_titulo: max,
    categoria: { id: categoria_id, nombre: cat?.name || "" },
    categorias: sugeridas.map((s) => ({ id: s.category_id, nombre: `${s.domain_name} › ${s.category_name}` })),
    precio: e.precio,
    existencia: e.existencia,
    imagenes: [p.thumbnail, ...(p.images || []).map((i) => i?.url)].filter((u): u is string => !!u).filter((u, i, a) => a.indexOf(u) === i).map(imagenAbsoluta).slice(0, 10),
    descripcion: limpiarDescripcion(p.description),
    requeridos,
    valores,
    user_products: !!cuenta.user_products,
  }
}

/** Publica un producto con lo que el taller revisó en la vista previa. */
export async function publicar(
  container: any,
  sellerId: string,
  datos: { producto_id: string; categoria_id: string; titulo: string; tipo_publicacion?: string; atributos: Record<string, string> }
) {
  const svc = servicio(container)
  const previa = await vistaPrevia(container, sellerId, datos.producto_id, datos.categoria_id)
  const [ya] = await svc.listMlPublicacions({ seller_id: sellerId, product_id: previa.producto_id })
  if (ya?.ml_item_id && ya.estado !== "closed") throw new ErrorML("Este producto ya está publicado en Mercado Libre.", 409)

  const faltan = previa.requeridos.filter((a) => !a.condicional && !String(datos.atributos?.[a.id] || "").trim())
  if (faltan.length) throw new ErrorML(`Faltan datos que pide Mercado Libre: ${faltan.map((a) => a.nombre).join(", ")}.`)
  const titulo = tituloML(datos.titulo || previa.titulo, previa.max_titulo)
  const item = armarItem({
    titulo,
    categoria_id: previa.categoria.id,
    precio: previa.precio,
    existencia: previa.existencia,
    imagenes: previa.imagenes,
    tipo_publicacion: datos.tipo_publicacion === "gold_pro" ? "gold_pro" : "gold_special",
    atributos: Object.entries(datos.atributos || {})
      .filter(([id]) => previa.requeridos.some((a) => a.id === id))
      .map(([id, value_name]) => ({ id, value_name: String(value_name).trim() })),
    user_products: previa.user_products,
  })

  const { token } = await tokenDelTaller(container, sellerId)
  const base = { seller_id: sellerId, product_id: previa.producto_id, categoria_id: previa.categoria.id, precio: previa.precio, existencia: previa.existencia }
  let creado: { id: string; permalink?: string; status?: string }
  try {
    creado = await mlApi(token, "POST", "/items", item)
  } catch (e) {
    const msg = (e as Error).message
    if (ya) await svc.updateMlPublicacions({ id: ya.id, ...base, estado: "error", ultimo_error: msg })
    else await svc.createMlPublicacions({ ...base, estado: "error", ultimo_error: msg })
    throw e
  }
  // La descripción va después de crear la publicación
  let avisoDescripcion: string | null = null
  if (previa.descripcion) {
    await mlApi(token, "POST", `/items/${creado.id}/description`, { plain_text: previa.descripcion }).catch((e) => {
      avisoDescripcion = `La publicación quedó, pero Mercado Libre no aceptó la descripción: ${(e as Error).message}`
    })
  }
  const fila = { ...base, ml_item_id: creado.id, permalink: creado.permalink || null, estado: creado.status || "active", ultimo_error: avisoDescripcion, sincronizado_en: new Date() }
  if (ya) await svc.updateMlPublicacions({ id: ya.id, ...fila })
  else await svc.createMlPublicacions(fila)
  return { ml_item_id: creado.id, permalink: creado.permalink || null, aviso: avisoDescripcion }
}
