// "Avísame cuando haya": el cliente deja su correo en un producto agotado y,
// cuando vuelve a haber existencias, le llega un correo (y aviso al celular si
// tiene cuenta y activó los avisos). Un aviso por producto y correo; caduca a
// los 90 días. Cada correo trae la liga para darse de baja.
import { randomBytes } from "crypto"

import { sendEmail } from "./resend"
import { pushACliente } from "./push"
import { STORE_URL, boton, esc, marco } from "./licitacion"

export const T_AVISO_EXISTENCIA = "hetna_aviso_existencia"
const DIA = 86_400_000
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

let listo = false
export async function asegurarAvisosExistencia(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_AVISO_EXISTENCIA))) {
    await knex.schema.createTable(T_AVISO_EXISTENCIA, (t: any) => {
      t.text("id").primary()
      t.text("product_id").notNullable().index()
      t.text("variant_id").nullable()
      t.text("email").notNullable()
      t.text("customer_id").nullable()
      t.text("token").notNullable().unique()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("avisado_en", { useTz: true }).nullable()
      t.timestamp("baja_en", { useTz: true }).nullable()
    })
  }
  listo = true
}

export class ErrorAviso extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje) }
}

/** Guarda el aviso. Si ya había uno pendiente para ese producto y correo, no duplica. */
export async function registrarAviso(knex: any, d: { productId: string; variantId?: string | null; email: string; customerId?: string | null }) {
  await asegurarAvisosExistencia(knex)
  const email = String(d.email || "").trim().toLowerCase().slice(0, 200)
  if (!CORREO.test(email)) throw new ErrorAviso(400, "Escribe un correo válido.")
  if (!/^prod_[A-Za-z0-9]{6,60}$/.test(d.productId)) throw new ErrorAviso(400, "Producto no válido.")
  const variantId = d.variantId && /^variant_[A-Za-z0-9]{6,60}$/.test(d.variantId) ? d.variantId : null
  // Freno contra abuso: máximo 20 avisos pendientes por correo
  const pendientes = await knex(T_AVISO_EXISTENCIA).where({ email }).whereNull("avisado_en").whereNull("baja_en").count("* as n").first()
  if (Number(pendientes?.n || 0) >= 20) throw new ErrorAviso(429, "Ya tienes muchos avisos pendientes.")
  const ya = await knex(T_AVISO_EXISTENCIA).where({ product_id: d.productId, email }).whereNull("avisado_en").whereNull("baja_en").first("id")
  if (ya) return { ok: true, nuevo: false }
  await knex(T_AVISO_EXISTENCIA).insert({
    id: `avx_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    product_id: d.productId, variant_id: variantId, email, customer_id: d.customerId || null,
    token: randomBytes(18).toString("base64url"),
  })
  return { ok: true, nuevo: true }
}

export async function darDeBaja(knex: any, token: string) {
  await asegurarAvisosExistencia(knex)
  if (!token || token.length < 20) return false
  return (await knex(T_AVISO_EXISTENCIA).where({ token }).whereNull("baja_en").update({ baja_en: knex.fn.now() })) > 0
}

type Oferta = {
  product?: { id?: string; status?: string }
  variant_id?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_item_link?: { required_quantity?: number; inventory_item?: { location_levels?: { stocked_quantity?: number; reserved_quantity?: number }[] } }[]
}

/** Piezas que se pueden vender de una oferta (Infinity si no lleva inventario: se fabrica bajo pedido). */
export function disponiblesOferta(o: Oferta): number {
  if (o.manage_inventory === false || o.allow_backorder === true) return Infinity
  const enlaces = o.inventory_item_link || []
  if (!enlaces.length) return Infinity
  let disp = Infinity
  for (const e of enlaces) {
    const libres = (e.inventory_item?.location_levels || []).reduce((s, n) => s + (Number(n.stocked_quantity) || 0) - (Number(n.reserved_quantity) || 0), 0)
    disp = Math.min(disp, Math.floor(libres / Math.max(1, Number(e.required_quantity) || 1)))
  }
  return Math.max(0, disp)
}

/** Productos (y variantes) que hoy tienen existencias, de entre los pedidos. */
export async function conExistencias(query: any, productIds: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (!productIds.length) return out
  const { data } = await query.graph({
    entity: "offer",
    fields: [
      "id", "variant_id", "manage_inventory", "allow_backorder", "product.id", "product.status",
      "inventory_item_link.required_quantity",
      "inventory_item_link.inventory_item.location_levels.stocked_quantity",
      "inventory_item_link.inventory_item.location_levels.reserved_quantity",
    ],
    filters: { product_id: productIds },
  })
  for (const o of (data || []) as Oferta[]) {
    const pid = o.product?.id
    if (!pid || o.product?.status === "draft") continue
    if (disponiblesOferta(o) > 0) {
      out.add(pid)
      if (o.variant_id) out.add(`${pid}|${o.variant_id}`)
    }
  }
  return out
}

/** Revisa los avisos pendientes y avisa a quien ya puede comprar. */
export async function revisarAvisos(knex: any, query: any, logger?: any) {
  await asegurarAvisosExistencia(knex)
  // Caducan a los 90 días
  await knex(T_AVISO_EXISTENCIA).whereNull("avisado_en").whereNull("baja_en").where("created_at", "<", new Date(Date.now() - 90 * DIA)).update({ baja_en: knex.fn.now() })
  const pendientes = (await knex(T_AVISO_EXISTENCIA).whereNull("avisado_en").whereNull("baja_en").limit(500).select("*")) as any[]
  if (!pendientes.length) return { avisados: 0 }
  const ids = [...new Set(pendientes.map((p) => p.product_id))]
  const hay = await conExistencias(query, ids)
  if (!hay.size) return { avisados: 0 }
  const { data: productos } = await query.graph({ entity: "product", fields: ["id", "title", "handle", "thumbnail"], filters: { id: [...hay].filter((x) => !x.includes("|")) } })
  const porId = new Map((productos || []).map((p: any) => [p.id, p]))
  let avisados = 0
  for (const a of pendientes) {
    const listoParaAvisar = a.variant_id ? hay.has(`${a.product_id}|${a.variant_id}`) : hay.has(a.product_id)
    const p: any = porId.get(a.product_id)
    if (!listoParaAvisar || !p) continue
    // Marcar primero: si dos corridas coinciden, sólo una manda el correo
    const n = await knex(T_AVISO_EXISTENCIA).where({ id: a.id }).whereNull("avisado_en").update({ avisado_en: knex.fn.now() })
    if (!n) continue
    const liga = `${STORE_URL}/mx/products/${p.handle}`
    const baja = `${STORE_URL}/api/aviso-existencia/baja?t=${encodeURIComponent(a.token)}`
    const r = await sendEmail({
      to: a.email,
      subject: `Ya hay: ${p.title}`,
      html: marco(
        "Volvió a haber existencias",
        (p.thumbnail ? `<p style="margin:0 0 12px"><img src="${esc(p.thumbnail)}" alt="" width="240" style="max-width:100%;border-radius:10px;border:1px solid #E7E4DC"></p>` : "") +
          `<p style="margin:0 0 12px;color:#40403A">El producto que pediste ya está disponible: <strong>${esc(p.title)}</strong>. Las piezas son limitadas.</p>` +
          boton("Comprar ahora", liga) +
          `<p style="margin:16px 0 0;color:#8A867B;font-size:12px">Recibes este correo porque pediste que te avisáramos. <a href="${esc(baja)}" style="color:#8A867B">No volver a avisarme</a>.</p>`
      ),
    })
    if (!r.sent) logger?.info?.(`[aviso-existencia] correo no enviado a ${a.id}: ${r.reason}`)
    await pushACliente(knex, { customerId: a.customer_id, email: a.email }, { titulo: "Ya hay existencias", cuerpo: p.title, url: liga, etiqueta: `stock-${p.id}` }, logger).catch(() => 0)
    avisados++
  }
  return { avisados }
}
