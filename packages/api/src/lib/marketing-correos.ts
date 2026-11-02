// Marketing automático por correo: cuatro correos que se mandan solos según lo
// que hizo (o dejó de hacer) cada cliente.
//
//   recompra       10 a 20 días después de una compra pagada: productos que van
//                  con lo que compró (misma categoría), sin repetir lo comprado.
//   primeros_pasos cuenta creada hace 3 a 10 días y sin compras: cómo comprar,
//                  pedir fabricación y usar las herramientas gratis, con el
//                  recordatorio del cupón de bienvenida.
//   reactivacion   su última compra fue hace 60 a 120 días: lo nuevo desde entonces.
//   novedades      una vez por semana, si hay al menos 3 productos nuevos.
//
// Reglas para no quemar la lista (ni el plan de Resend):
//   - Nunca a quien se dio de baja (lib/baja.ts); todos llevan la liga de baja.
//   - Máximo un correo de éstos por persona cada DIAS_ENTRE_CORREOS días.
//   - Tope diario total (MARKETING_MAX_DIA, 80 por omisión: el plan gratis de
//     Resend permite 100 al día y hay que dejar lugar a los de pedidos).
//   - Cada correo se manda una sola vez por su referencia (pedido, cuenta,
//     edición semanal): queda en hetna_correo_promo.
//   - MARKETING_CORREOS=off lo apaga todo.
import { asegurarTablaBaja, ligaBaja, T_BAJA } from "./baja"
import { CUPON_BIENVENIDA, MINIMO, MONTO, pesos } from "./cupones"
import { STORE_URL, boton, esc, marco } from "./licitacion"
import { sendEmail } from "./resend"

export const T_PROMO = "hetna_correo_promo"
export type TipoPromo = "recompra" | "primeros_pasos" | "reactivacion" | "novedades"

const DIAS_ENTRE_CORREOS = 4
const maxDia = () => Math.max(0, Number(process.env.MARKETING_MAX_DIA) || 80)
export const marketingApagado = () => (process.env.MARKETING_CORREOS || "").toLowerCase() === "off"

let lista = false
export async function asegurarTablaPromo(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_PROMO))) {
    await knex.schema.createTable(T_PROMO, (t: any) => {
      t.increments("id").primary()
      t.text("correo").notNullable().index()
      t.text("tipo").notNullable()
      t.text("ref").notNullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.unique(["tipo", "ref", "correo"])
    })
  }
  await asegurarTablaBaja(knex)
  lista = true
}

// ── Productos para recomendar ─────────────────────────────────────────────────
export type ProductoCorreo = { id: string; title: string; handle: string; thumbnail: string | null }

export async function productosParaCorreo(
  knex: any,
  o: { categorias?: string[]; excluir?: string[]; desde?: Date; limite: number }
): Promise<ProductoCorreo[]> {
  const base = () =>
    knex("product as p")
      .select("p.id", "p.title", "p.handle", "p.thumbnail")
      .where("p.status", "published")
      .whereNull("p.deleted_at")
      .whereNotNull("p.thumbnail")
      .whereRaw("coalesce(p.metadata->>'producto_creditos_3d', 'false') <> 'true'")
      .modify((q: any) => {
        if (o.excluir?.length) q.whereNotIn("p.id", o.excluir)
        if (o.desde) q.where("p.created_at", ">=", o.desde)
      })
      .orderBy("p.created_at", "desc")

  let lista: ProductoCorreo[] = []
  if (o.categorias?.length) {
    lista = await base()
      .whereExists(function (this: any) {
        this.select(knex.raw("1"))
          .from("product_category_product as pc")
          .whereRaw("pc.product_id = p.id")
          .whereIn("pc.product_category_id", o.categorias!)
      })
      .limit(o.limite)
  }
  // Si la categoría no alcanza, se completa con lo más nuevo
  if (lista.length < o.limite) {
    const ya = lista.map((p) => p.id)
    const extra = await base()
      .modify((q: any) => ya.length && q.whereNotIn("p.id", ya))
      .limit(o.limite - lista.length)
    lista = lista.concat(extra)
  }
  return lista
}

// ── Plantillas ─────────────────────────────────────────────────────────────────
const utm = (url: string, tipo: TipoPromo) =>
  `${url}${url.includes("?") ? "&" : "?"}utm_source=email&utm_medium=automatico&utm_campaign=${tipo}`

function tarjetas(productos: ProductoCorreo[], tipo: TipoPromo) {
  return (
    `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 4px">` +
    productos
      .map((p) => {
        const url = utm(`${STORE_URL}/mx/products/${encodeURIComponent(p.handle)}`, tipo)
        return (
          `<tr><td style="padding:8px 0;border-top:1px solid #EEE9DF;width:84px;vertical-align:top">` +
          `<a href="${esc(url)}"><img src="${esc(p.thumbnail)}" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #E7E4DC"></a></td>` +
          `<td style="padding:8px 0 8px 12px;border-top:1px solid #EEE9DF;vertical-align:middle">` +
          `<a href="${esc(url)}" style="color:#142033;font-weight:bold;text-decoration:none;font-size:15px">${esc(p.title)}</a>` +
          `<br><a href="${esc(url)}" style="color:#C2560A;font-size:13px;text-decoration:none">Ver producto →</a></td></tr>`
        )
      })
      .join("") +
    `</table>`
  )
}

const p = (t: string) => `<p style="margin:0 0 12px;color:#40403A;line-height:1.5">${t}</p>`
const saludo = (nombre?: string | null) => (nombre ? `Hola ${esc(nombre)}:` : "Hola:")

// Recordatorio del cupón de bienvenida (lib/cupones.ts) para quien aún no compra.
// Va en "primeros pasos", que sólo reciben cuentas sin pedidos.
const bloqueBienvenida = () =>
  `<div style="margin:0 0 16px;padding:14px;border:2px dashed #C2560A;border-radius:10px;text-align:center">` +
  `<div style="font-size:13px;color:#40403A">Tu regalo de bienvenida sigue activo</div>` +
  `<div style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#142033;margin:4px 0">${esc(CUPON_BIENVENIDA())}</div>` +
  `<div style="font-size:13px;color:#40403A">${pesos(MONTO())} de descuento en tu primera compra de ${pesos(MINIMO())} o más. Escríbelo en tu carrito.</div>` +
  `</div>`

export function correoPromo(
  tipo: TipoPromo,
  d: { nombre?: string | null; productos: ProductoCorreo[]; display_id?: number | null }
): { asunto: string; html: string } {
  const tienda = utm(`${STORE_URL}/mx`, tipo)
  switch (tipo) {
    case "recompra":
      return {
        asunto: "Para tu siguiente proyecto: esto va con tu compra",
        html: marco(
          "Esto va con lo que compraste",
          p(`${saludo(d.nombre)} gracias por tu compra${d.display_id ? ` #${d.display_id}` : ""}. Lo que suelen llevar quienes compraron algo parecido:`) +
            tarjetas(d.productos, tipo) +
            p(`¿Necesitas una pieza a la medida? <a href="${esc(utm(`${STORE_URL}/mx/fabricacion`, tipo))}" style="color:#C2560A">Pide cotización a varios talleres</a> con tu plano o una foto.`) +
            boton("Ver más en la tienda", tienda)
        ),
      }
    case "primeros_pasos":
      return {
        asunto: `Tu cupón de ${pesos(MONTO())} te espera: así le sacas provecho a HETNA`,
        html: marco(
          "Tres cosas que puedes hacer en HETNA",
          p(`${saludo(d.nombre)} gracias por crear tu cuenta.`) +
            bloqueBienvenida() +
            p("Esto es lo que más usan los talleres y makers:") +
            `<ol style="margin:0 0 12px;padding-left:20px;color:#40403A;line-height:1.6">` +
            `<li><b>Comprar</b> piezas, herramientas y diseños listos para cortar, directo de talleres verificados.</li>` +
            `<li><b>Mandar a fabricar</b>: sube tu plano o una foto y recibe cotizaciones de varios talleres. <a href="${esc(utm(`${STORE_URL}/mx/fabricacion`, tipo))}" style="color:#C2560A">Pedir cotización</a></li>` +
            `<li><b>Herramientas gratis</b>: calculadora CNC de avances y velocidades, generador de cajas y archivos gratis. <a href="${esc(utm(`${STORE_URL}/mx/herramientas-cnc`, tipo))}" style="color:#C2560A">Ver herramientas</a></li>` +
            `</ol>` +
            (d.productos.length ? p("Lo más nuevo en la tienda:") + tarjetas(d.productos, tipo) : "") +
            boton("Ir a la tienda", tienda)
        ),
      }
    case "reactivacion":
      return {
        asunto: "Hay novedades desde tu última compra",
        html: marco(
          "Lo nuevo desde tu última visita",
          p(`${saludo(d.nombre)} desde tu última compra se sumaron productos y talleres a HETNA. Algunos que te pueden servir:`) +
            tarjetas(d.productos, tipo) +
            boton("Ver todo lo nuevo", tienda)
        ),
      }
    case "novedades":
      return {
        asunto: "Novedades de la semana en HETNA",
        html: marco(
          "Novedades de la semana",
          p(`${saludo(d.nombre)} esto es lo que se publicó esta semana en HETNA:`) +
            tarjetas(d.productos, tipo) +
            boton("Ver la tienda", tienda)
        ),
      }
  }
}

// ── Candidatos ─────────────────────────────────────────────────────────────────
export type Candidato = {
  tipo: TipoPromo
  ref: string
  correo: string
  nombre: string | null
  customer_id: string
  order_id?: string
  display_id?: number
  desde?: Date
}

const dias = (n: number) => new Date(Date.now() - n * 86400000)

// Órdenes pagadas y no canceladas (misma regla que la entrega digital)
const PAGADA_SQL = `exists (select 1 from order_payment_collection opc
  join payment_collection pc on pc.id = opc.payment_collection_id
  where opc.order_id = o.id and opc.deleted_at is null and pc.deleted_at is null
    and pc.status in ('completed','partially_captured'))`

export async function candidatos(knex: any, tipo: TipoPromo, edicion: string): Promise<Candidato[]> {
  const sinBaja = (col: string) => `not exists (select 1 from ${T_BAJA} b where b.correo = lower(${col}))`
  if (tipo === "recompra") {
    const { rows } = await knex.raw(
      `select o.id as order_id, o.display_id, c.id as customer_id, c.email as correo, c.first_name as nombre
       from "order" o join customer c on c.id = o.customer_id and c.deleted_at is null and c.has_account
       where o.deleted_at is null and o.status <> 'canceled' and coalesce(o.is_draft_order, false) = false
         and o.created_at between ? and ? and ${PAGADA_SQL} and ${sinBaja("c.email")}
       order by o.created_at`,
      [dias(20), dias(10)]
    )
    return rows.map((r: any) => ({ ...r, tipo, ref: r.order_id }))
  }
  if (tipo === "primeros_pasos") {
    const { rows } = await knex.raw(
      `select c.id as customer_id, c.email as correo, c.first_name as nombre
       from customer c
       where c.deleted_at is null and c.has_account and c.created_at between ? and ?
         and not exists (select 1 from "order" o where o.customer_id = c.id and o.deleted_at is null)
         and ${sinBaja("c.email")}
       order by c.created_at`,
      [dias(10), dias(3)]
    )
    return rows.map((r: any) => ({ ...r, tipo, ref: r.customer_id }))
  }
  if (tipo === "reactivacion") {
    const { rows } = await knex.raw(
      `select * from (
         select distinct on (c.id) c.id as customer_id, c.email as correo, c.first_name as nombre,
                o.id as order_id, o.created_at as ultima
         from customer c join "order" o on o.customer_id = c.id
         where c.deleted_at is null and c.has_account and o.deleted_at is null and o.status <> 'canceled'
           and ${PAGADA_SQL} and ${sinBaja("c.email")}
         order by c.id, o.created_at desc
       ) u where u.ultima between ? and ?`,
      [dias(120), dias(60)]
    )
    return rows.map((r: any) => ({ ...r, tipo, ref: `${r.customer_id}:${r.order_id}`, desde: new Date(r.ultima) }))
  }
  // novedades: toda cuenta activa, una vez por edición semanal
  const { rows } = await knex.raw(
    `select c.id as customer_id, c.email as correo, c.first_name as nombre
     from customer c
     where c.deleted_at is null and c.has_account and c.created_at < ? and ${sinBaja("c.email")}
     order by c.created_at`,
    [dias(3)]
  )
  return rows.map((r: any) => ({ ...r, tipo, ref: edicion }))
}

// Semana ISO ("2026-W44"): la referencia de la edición de novedades
export function edicionSemanal(f = new Date()): string {
  const d = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()))
  const dia = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dia)
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const semana = Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`
}

// ── Corrida ────────────────────────────────────────────────────────────────────
export type Resumen = Record<TipoPromo, number> & { omitidos: number; presupuesto: number }

async function productosDe(knex: any, orderId: string): Promise<{ productos: string[]; categorias: string[] }> {
  const { rows } = await knex.raw(
    `select distinct li.product_id, pc.product_category_id
     from order_item oi join order_line_item li on li.id = oi.item_id
     left join product_category_product pc on pc.product_id = li.product_id
     where oi.order_id = ? and oi.deleted_at is null and li.product_id is not null`,
    [orderId]
  )
  return {
    productos: [...new Set<string>(rows.map((r: any) => r.product_id))],
    categorias: [...new Set<string>(rows.map((r: any) => r.product_category_id).filter(Boolean))],
  }
}

export async function correrMarketing(knex: any, logger: any, o: { simular?: boolean } = {}): Promise<Resumen> {
  await asegurarTablaPromo(knex)
  const resumen: Resumen = { recompra: 0, primeros_pasos: 0, reactivacion: 0, novedades: 0, omitidos: 0, presupuesto: 0 }

  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const [{ n: enviadosHoy }] = (await knex(T_PROMO).where("created_at", ">=", hoy).count("* as n")) as any
  let presupuesto = maxDia() - Number(enviadosHoy)
  resumen.presupuesto = presupuesto
  if (presupuesto <= 0) return resumen

  const edicion = edicionSemanal()
  const nuevosSemana = await productosParaCorreo(knex, { desde: dias(7), limite: 6 })
  const recientes = await productosParaCorreo(knex, { limite: 4 })
  const tocadosHoy = new Set<string>()

  // En orden de valor: lo que está más cerca de una compra va primero
  const tipos: TipoPromo[] = ["recompra", "primeros_pasos", "reactivacion", "novedades"]
  for (const tipo of tipos) {
    if (tipo === "novedades" && nuevosSemana.length < 3) continue
    for (const c of await candidatos(knex, tipo, edicion)) {
      if (presupuesto <= 0) return resumen
      const correo = String(c.correo || "").trim().toLowerCase()
      if (!correo || tocadosHoy.has(correo)) continue

      const ya = await knex(T_PROMO).where({ tipo, ref: c.ref, correo }).first()
      if (ya) continue
      const reciente = await knex(T_PROMO).where({ correo }).where("created_at", ">=", dias(DIAS_ENTRE_CORREOS)).first()
      if (reciente) {
        resumen.omitidos++
        continue
      }

      let productos: ProductoCorreo[] = []
      if (tipo === "recompra") {
        const comprado = await productosDe(knex, c.order_id!)
        productos = await productosParaCorreo(knex, { categorias: comprado.categorias, excluir: comprado.productos, limite: 4 })
      } else if (tipo === "reactivacion") {
        productos = await productosParaCorreo(knex, { desde: c.desde, limite: 4 })
        if (productos.length < 2) productos = recientes
      } else if (tipo === "novedades") {
        productos = nuevosSemana
      } else {
        productos = recientes
      }
      if (tipo !== "primeros_pasos" && !productos.length) continue

      const { asunto, html } = correoPromo(tipo, { nombre: c.nombre, productos, display_id: c.display_id })
      tocadosHoy.add(correo)
      if (o.simular) {
        resumen[tipo]++
        presupuesto--
        continue
      }
      const r = await sendEmail({ to: correo, subject: asunto, html, bajaUrl: ligaBaja(correo) })
      if (!r.sent) {
        logger.warn(`[marketing] ${tipo} a ${correo} no enviado: ${r.reason}`)
        // Credenciales o remitente mal: no tiene caso seguir intentando hoy
        if (r.configuracion) return resumen
        continue
      }
      await knex(T_PROMO).insert({ correo, tipo, ref: c.ref }).onConflict(["tipo", "ref", "correo"]).ignore()
      resumen[tipo]++
      presupuesto--
    }
  }
  return resumen
}
