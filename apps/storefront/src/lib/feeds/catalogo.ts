// Catálogo de productos para Google (Merchant Center: Shopping gratis y
// anuncios de Shopping / Performance Max) y Meta (catálogo de Facebook e
// Instagram: tiendas, etiquetas y anuncios de catálogo Advantage+).
//
// SE MANTIENE SOLO: Google y Meta descargan /feeds/google.xml y /feeds/meta.xml
// a la hora que se les programe; este archivo los arma en ese momento con lo
// que hay en la tienda. Un producto nuevo, un precio que cambia o un taller que
// se queda sin existencia se reflejan en la siguiente descarga.
//
// Reglas que no se pueden saltar sin que rechacen el catálogo:
//   - id = el id del producto (prod_...): es el mismo que mandan GA4 y el Pixel
//     (item_id / content_ids). Si no coinciden, los anuncios de catálogo no
//     saben qué vio o compró cada persona.
//   - precio y existencia = los de la oferta ganadora (buybox), los mismos que
//     enseñan la ficha y su schema.org. Google rechaza si no coinciden.
//   - Ni Google Shopping ni los catálogos de Meta aceptan servicios ni archivos
//     descargables: van fuera los diseños digitales, los paquetes de créditos,
//     los archivos gratis y las categorías de servicio (maquila, diseño). Esos
//     se promueven con anuncios de búsqueda y de tráfico, no de catálogo.
//     FEED_INCLUIR_DIGITALES=1 los mete de todos modos (bajo tu riesgo).

import { EMPRESA } from "@/lib/hetna/empresa"
import { getBuyboxWinner, getOfferAmount, getOfferStock, rankOffers, type StoreOffer } from "@/lib/helpers/buybox"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || EMPRESA.sitio).replace(/\/$/, "")
const PAIS = (process.env.FEED_PAIS || "mx").toLowerCase()

// Una hora: lo que tarda en reflejarse un cambio, y lo que se ahorra el backend
const REVALIDAR_S = 3600

// Categorías que son servicio o archivo digital (por nombre o handle)
const NO_FISICO = new RegExp(process.env.FEED_EXCLUIR_CATEGORIAS || "dise[ñn]os?[ -]cnc|software|maquinado|maquila|servicio|dise[ñn]o a la medida|archivos?", "i")

type Categoria = { id: string; name?: string | null; handle?: string | null; parent_category?: Categoria | null }
type Producto = {
  id: string
  title: string
  handle: string
  description?: string | null
  subtitle?: string | null
  thumbnail?: string | null
  material?: string | null
  status?: string
  images?: { url: string }[] | null
  metadata?: Record<string, unknown> | null
  categories?: Categoria[] | null
  type?: { value?: string | null } | null
  seller?: { name?: string | null; store_status?: string | null } | null
  variants?: { sku?: string | null }[] | null
  attribute_values?: { value?: string | null; attribute?: { name?: string | null; handle?: string | null } | null }[] | null
}

export type ItemCatalogo = {
  id: string
  titulo: string
  descripcion: string
  liga: string
  imagen: string
  imagenesExtra: string[]
  disponible: boolean
  precio: number
  precioOferta: number | null
  moneda: string
  marca: string
  condicion: "new" | "used" | "refurbished"
  tipo: string
  taller: string
  gtin: string | null
  mpn: string | null
  etiquetas: string[]
}

export type Excluido = { id: string; titulo: string; motivo: string }

async function pedir<T>(ruta: string): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    headers: { "x-publishable-api-key": PK },
    next: { revalidate: REVALIDAR_S, tags: ["feed-catalogo"] },
  })
  if (!r.ok) throw new Error(`${ruta.split("?")[0]} respondió ${r.status}`)
  return (await r.json()) as T
}

async function regionDelPais(): Promise<{ id: string; currency_code: string }> {
  const { regions } = await pedir<{ regions: { id: string; currency_code: string; countries?: { iso_2?: string }[] }[] }>(
    "/store/regions?limit=50"
  )
  const r = regions.find((x) => x.countries?.some((c) => c.iso_2?.toLowerCase() === PAIS)) || regions[0]
  if (!r) throw new Error("No hay regiones en la tienda")
  return r
}

async function todos<T>(ruta: (offset: number) => string, llave: string): Promise<T[]> {
  const lista: T[] = []
  for (let offset = 0; offset < 20000; offset += 100) {
    const r = await pedir<Record<string, unknown>>(ruta(offset))
    const pagina = (r[llave] as T[]) || []
    lista.push(...pagina)
    if (pagina.length < 100) break
  }
  return lista
}

const limpiar = (t: string | null | undefined, max: number) =>
  String(t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)

const absoluta = (u: string | null | undefined) => {
  if (!u) return ""
  if (u.startsWith("//")) return `https:${u}`
  if (u.startsWith("/")) return `${SITIO}${u}`
  return /^https?:\/\//i.test(u) ? u : ""
}

const rutaCategoria = (c: Categoria): string => {
  const partes: string[] = []
  let x: Categoria | null | undefined = c
  for (let i = 0; x && i < 5; i++, x = x.parent_category) if (x.name) partes.unshift(x.name)
  return partes.join(" > ")
}

function condicionDe(p: Producto): ItemCatalogo["condicion"] {
  const m = p.metadata || {}
  const valores = [m.condicion, m.condition, m.estado, ...(p.attribute_values || [])
    .filter((a) => /condici|condition|estado/i.test(`${a.attribute?.name} ${a.attribute?.handle}`))
    .map((a) => a.value)]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
  if (valores.some((v) => /reacond|refurb/.test(v))) return "refurbished"
  if (valores.some((v) => /usad|used|seminuev|segunda/.test(v))) return "used"
  return "new"
}

const rangoPrecio = (n: number) => (n < 500 ? "menos-500" : n < 2000 ? "500-2000" : n < 10000 ? "2000-10000" : n < 50000 ? "10000-50000" : "mas-50000")

export async function armarCatalogo(): Promise<{ items: ItemCatalogo[]; excluidos: Excluido[]; moneda: string; generado: string }> {
  const region = await regionDelPais()
  const campos = encodeURIComponent(
    "id,title,handle,description,subtitle,thumbnail,material,status,metadata,*images,*categories,*categories.parent_category,*type,*seller,*variants,*attribute_values,*attribute_values.attribute"
  )
  const productos = await todos<Producto>(
    (o) => `/store/products?region_id=${region.id}&limit=100&offset=${o}&fields=${campos}`,
    "products"
  )
  const camposOferta = encodeURIComponent("+calculated_price,+inventory_quantity,+product.id,+seller.name,+seller.handle")
  const ofertas = await todos<StoreOffer>(
    (o) => `/store/offers?region_id=${region.id}&limit=100&offset=${o}&fields=${camposOferta}`,
    "offers"
  )

  const porProducto = new Map<string, StoreOffer[]>()
  for (const of of ofertas) {
    const pid = (of as any).product_id || (of as any).product?.id
    if (!pid) continue
    const l = porProducto.get(pid) || []
    l.push(of)
    porProducto.set(pid, l)
  }

  const incluirDigitales = process.env.FEED_INCLUIR_DIGITALES === "1"
  const items: ItemCatalogo[] = []
  const excluidos: Excluido[] = []
  const fuera = (p: Producto, motivo: string) => excluidos.push({ id: p.id, titulo: p.title, motivo })

  for (const p of productos) {
    const m = p.metadata || {}
    if (p.status && p.status !== "published") continue
    if (p.seller?.store_status === "SUSPENDED") {
      fuera(p, "taller suspendido")
      continue
    }
    if (!incluirDigitales) {
      if (m.producto_digital === true || m.archivo_gratis === true) {
        fuera(p, "archivo digital (Google y Meta no aceptan descargables)")
        continue
      }
      if (m.producto_creditos_3d === true) {
        fuera(p, "paquete de créditos")
        continue
      }
      const cat = (p.categories || []).find((c) => NO_FISICO.test(`${c.name} ${c.handle}`))
      if (cat || m.es_servicio === true) {
        fuera(p, `servicio o digital (categoría ${cat?.name || "servicio"})`)
        continue
      }
    }

    const ganadora = getBuyboxWinner(rankOffers(porProducto.get(p.id) || []))
    const precioFinal = ganadora ? getOfferAmount(ganadora) : null
    if (!ganadora || !precioFinal || precioFinal <= 0) {
      fuera(p, "sin oferta con precio")
      continue
    }
    const imagenes = [p.thumbnail, ...(p.images || []).map((i) => i.url)].map(absoluta).filter(Boolean)
    const unicas = [...new Set(imagenes)]
    if (!unicas.length) {
      fuera(p, "sin imagen")
      continue
    }

    const cp = (ganadora.calculated_price || {}) as { original_amount?: number | null; calculated_amount?: number | null; currency_code?: string }
    const original = Number(cp.original_amount) || 0
    const hayRebaja = original > precioFinal + 0.009
    const categoriaPrincipal = (p.categories || [])[0]
    const marcaMeta = m.marca ?? m.brand
    const taller = ganadora.seller?.name || p.seller?.name || EMPRESA.nombreComercial
    const gtin = typeof m.gtin === "string" && /^\d{8,14}$/.test(m.gtin) ? m.gtin : null
    const mpn = typeof m.mpn === "string" && m.mpn.trim() ? m.mpn.trim().slice(0, 70) : null

    items.push({
      id: p.id,
      titulo: limpiar(p.title, 150),
      descripcion: limpiar(p.description || p.subtitle || p.title, 5000),
      liga: `${SITIO}/${PAIS}/products/${encodeURIComponent(p.handle)}`,
      imagen: unicas[0],
      imagenesExtra: unicas.slice(1, 11),
      disponible: getOfferStock(ganadora) > 0,
      precio: hayRebaja ? original : precioFinal,
      precioOferta: hayRebaja ? precioFinal : null,
      moneda: (cp.currency_code || region.currency_code || "mxn").toUpperCase(),
      marca: limpiar(typeof marcaMeta === "string" && marcaMeta.trim() ? marcaMeta : taller, 70),
      condicion: condicionDe(p),
      tipo: categoriaPrincipal ? rutaCategoria(categoriaPrincipal) : p.type?.value || "",
      taller: limpiar(taller, 100),
      gtin,
      mpn,
      etiquetas: [
        limpiar(taller, 100),
        limpiar(categoriaPrincipal?.name || p.type?.value || "", 100),
        rangoPrecio(precioFinal),
        hayRebaja ? "rebaja" : "precio-normal",
      ],
    })
  }

  return { items, excluidos, moneda: (region.currency_code || "mxn").toUpperCase(), generado: new Date().toISOString() }
}

// ── XML (RSS 2.0 con el espacio g: de Google; Meta, TikTok y Pinterest leen el mismo) ──
const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
const precioTexto = (n: number, moneda: string) => `${n.toFixed(2)} ${moneda}`

export function catalogoXml(items: ItemCatalogo[], titulo: string): string {
  const linea = (k: string, v: string | null | undefined) => (v ? `<g:${k}>${esc(v)}</g:${k}>` : "")
  const cuerpo = items
    .map((it) =>
      [
        "<item>",
        linea("id", it.id),
        `<title>${esc(it.titulo)}</title>`,
        `<description>${esc(it.descripcion)}</description>`,
        `<link>${esc(it.liga)}</link>`,
        linea("title", it.titulo),
        linea("description", it.descripcion),
        linea("link", it.liga),
        linea("image_link", it.imagen),
        ...it.imagenesExtra.map((u) => linea("additional_image_link", u)),
        linea("availability", it.disponible ? "in_stock" : "out_of_stock"),
        linea("price", precioTexto(it.precio, it.moneda)),
        it.precioOferta ? linea("sale_price", precioTexto(it.precioOferta, it.moneda)) : "",
        linea("brand", it.marca),
        linea("condition", it.condicion),
        it.gtin ? linea("gtin", it.gtin) : "",
        it.mpn ? linea("mpn", it.mpn) : "",
        !it.gtin && !it.mpn ? linea("identifier_exists", "no") : "",
        linea("product_type", it.tipo),
        ...it.etiquetas.map((e, i) => (e ? linea(`custom_label_${i}`, e) : "")),
        "</item>",
      ].join("")
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(titulo)}</title>
<link>${esc(SITIO)}</link>
<description>Catálogo de ${esc(EMPRESA.nombreComercial)}</description>
${cuerpo}
</channel>
</rss>
`
}
