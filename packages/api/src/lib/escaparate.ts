// Escaparate diario: cada día anuncia en redes productos de la tienda que todavía
// no se han anunciado (por ejemplo, los que entraron con el importador de Excel,
// que no se anuncian al crearse para no inundar las redes).
//
// Elige productos publicados, con foto, con existencias y con precio en pesos,
// del más nuevo al más viejo, y los manda al Social Hub (lib/social-hub), que
// respeta la configuración del Admin: sale sola dentro del horario o espera visto
// bueno. Nunca repite un producto (origen "producto" + id).
import { T_POST, asegurarSocial, publicacionAutomatica } from "./social-hub"
import { disponiblesOferta } from "./aviso-existencia"

export type Candidato = { id: string; titulo: string; handle: string; imagen: string; resumen: string; precio: number }

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")} MXN`

/** Del catálogo, los productos que se pueden anunciar hoy (sin los ya anunciados). */
export async function candidatos(query: any, knex: any, max = 5): Promise<Candidato[]> {
  await asegurarSocial(knex)
  const { data: productos } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "images.url", "description", "status", "created_at"],
    filters: { status: "published" },
    pagination: { take: 400, order: { created_at: "DESC" } },
  })
  const conFoto = ((productos || []) as any[]).filter((p) => p.thumbnail || p.images?.[0]?.url)
  if (!conFoto.length) return []
  const ya = new Set(((await knex(T_POST).where({ origen: "producto" }).whereIn("origen_id", conFoto.map((p) => p.id)).select("origen_id")) as any[]).map((r) => r.origen_id))
  const pendientes = conFoto.filter((p) => !ya.has(p.id)).slice(0, 60)
  if (!pendientes.length) return []

  const { data: ofertas } = await query.graph({
    entity: "offer",
    fields: [
      "id", "product_id", "manage_inventory", "allow_backorder", "prices.amount", "prices.currency_code",
      "inventory_item_link.required_quantity",
      "inventory_item_link.inventory_item.location_levels.stocked_quantity",
      "inventory_item_link.inventory_item.location_levels.reserved_quantity",
    ],
    filters: { product_id: pendientes.map((p) => p.id) },
  })
  // Precio más bajo con existencias, por producto
  const precio = new Map<string, number>()
  for (const o of (ofertas || []) as any[]) {
    if (disponiblesOferta(o) <= 0) continue
    const mxn = ((o.prices || []) as any[]).filter((p) => String(p.currency_code).toLowerCase() === "mxn").map((p) => Number(p.amount)).filter((n) => n > 0)
    if (!mxn.length) continue
    const m = Math.min(...mxn)
    if (!precio.has(o.product_id) || m < precio.get(o.product_id)!) precio.set(o.product_id, m)
  }
  return pendientes
    .filter((p) => precio.has(p.id))
    .slice(0, max)
    .map((p) => ({
      id: p.id,
      titulo: p.title,
      handle: p.handle,
      imagen: p.thumbnail || p.images?.[0]?.url,
      resumen: String(p.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
      precio: precio.get(p.id)!,
    }))
}

/** Manda al Social Hub los productos del día. Devuelve cuántos quedaron programados o en borrador. */
export async function escaparateDelDia(query: any, knex: any, porDia: number, logger?: any) {
  const lista = await candidatos(query, knex, porDia)
  const base = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
  let hechos = 0
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i]
    const id = await publicacionAutomatica(
      knex,
      {
        origen: "producto",
        origen_id: c.id,
        titulo: c.titulo,
        resumen: c.resumen,
        precio: pesos(c.precio),
        url: `${base}/mx/products/${c.handle}`,
        medios: [{ url: c.imagen, tipo: "imagen" }],
        // Si son varios en el día, se separan 3 horas
        ...(i > 0 ? { programada_para: new Date(Date.now() + i * 3 * 3_600_000) } : {}),
      },
      logger
    )
    if (id) hechos++
  }
  return { hechos, candidatos: lista.length }
}
