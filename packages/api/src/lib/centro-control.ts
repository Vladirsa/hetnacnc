// @ts-nocheck
// Centro de control de HETNA: todo lo que el dueño necesita ver en una pantalla
// (dashboard > Centro de control) y en un correo cada mañana.
//
// Dos partes:
//   1. VENTAS del periodo (7, 30 o 90 días) contra el periodo anterior: pedidos
//      pagados, ingresos, comisión de HETNA, ticket promedio, clientes y
//      talleres nuevos, ventas por día, talleres y productos que más venden.
//   2. AVISOS: lo que necesita que alguien haga algo, ordenado por urgencia.
//      rojo  = afecta a un cliente o a la marca HOY (pedido sin enviar, reseña
//              mala, reclamo, guía que no se pudo comprar, saldo de envíos).
//      ambar = hay que revisarlo pronto (devoluciones con su motivo,
//              cancelaciones, sobrepesos por cobrar, guías sin evidencia).
//      azul  = para estar al tanto (verificaciones por revisar, Cotizador por
//              vencer, pedidos sin pagar).
//
// Cada sección se calcula por separado y, si una falla (un módulo apagado, una
// tabla que todavía no existe), las demás salen igual: el panel nunca se queda
// en blanco por una pieza.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_GUIAS } from "./guias"
import { STORE_URL } from "./licitacion"
import { T_SOBREPESO } from "./sobrepesos"

const DIA = 86_400_000
const HORA = 3_600_000
export const ADMIN = (process.env.ADMIN_PANEL_URL || `${STORE_URL}/dashboard`).replace(/\/$/, "")
const HORAS_SIN_ENVIAR = () => Number(process.env.CONTROL_HORAS_SIN_ENVIAR ?? 48)

export type Nivel = "rojo" | "ambar" | "azul"
export type Aviso = {
  nivel: Nivel
  tipo: string // pedido_sin_enviar | guia_error | saldo_envios | saldo_servicio | limite_servicio | vencimiento | servicio_sin_leer | resena_mala | reclamo | devolucion | cancelacion | sobrepeso | evidencia | verificacion | taller_por_aprobar | cotizador | sin_pagar
  titulo: string
  detalle?: string
  url?: string
  cuando?: string
}

const pagada = (o) =>
  (o.payment_collections || []).some((pc) => ["completed", "partially_captured", "authorized"].includes(pc?.status))

const en = (iso, desde: number, hasta: number) => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= desde && t < hasta
}

const MOTIVO_RECLAMO = {
  missing_item: "Le faltó una pieza",
  wrong_item: "Le llegó otra cosa",
  production_failure: "Llegó dañado o con falla",
  other: "Otro motivo",
}

const pesos = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString("es-MX")}`
const horas = (ms: number) => {
  const h = Math.floor(ms / HORA)
  return h >= 48 ? `${Math.floor(h / 24)} días` : `${h} h`
}

async function seguro<T>(fn: () => Promise<T>, vacio: T, log?): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    log?.warn?.(`[centro-control] ${e?.message || e}`)
    return vacio
  }
}

export async function calcularCentroControl(container, { dias = 30 }: { dias?: number } = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve("logger")
  const ahora = Date.now()
  const desde = ahora - dias * DIA
  const antes = desde - dias * DIA

  // ---- Pedidos (una sola consulta para ventas y avisos) ----------------------
  const ordenes = await seguro(
    async () =>
      (
        await query.graph({
          entity: "order",
          fields: [
            "id",
            "display_id",
            "status",
            "total",
            "currency_code",
            "created_at",
            "canceled_at",
            "email",
            "payment_collections.status",
            "fulfillments.id",
            "fulfillments.shipped_at",
            "fulfillments.canceled_at",
            "items.title",
            "items.quantity",
            "items.product_id",
            "items.unit_price",
          ],
        })
      ).data || [],
    [],
    logger
  )

  const tallerDe = new Map<string, string>()
  await seguro(async () => {
    const { data } = await query.graph({ entity: "order_seller", fields: ["order_id", "seller_id"] })
    for (const e of data || []) if (e?.order_id && e?.seller_id) tallerDe.set(e.order_id, e.seller_id)
  }, undefined, logger)

  const talleres = await seguro(
    async () => (await query.graph({ entity: "seller", fields: ["id", "name", "created_at"] })).data || [],
    [],
    logger
  )
  const nombreTaller = new Map(talleres.map((s) => [s.id, s.name || s.id]))
  const taller = (orderId: string) => nombreTaller.get(tallerDe.get(orderId)) || "sin taller"

  // ---- Ventas ----------------------------------------------------------------
  let moneda = "mxn"
  const actual = { pedidos: 0, ingresos: 0 }
  const previo = { pedidos: 0, ingresos: 0 }
  const porDia = new Map<string, { ingresos: number; pedidos: number }>()
  for (let i = dias - 1; i >= 0; i--) {
    porDia.set(new Date(ahora - i * DIA).toISOString().slice(0, 10), { ingresos: 0, pedidos: 0 })
  }
  const porTaller = new Map<string, { pedidos: number; ingresos: number }>()
  const porProducto = new Map<string, { titulo: string; piezas: number; ingresos: number }>()

  for (const o of ordenes) {
    if (o.currency_code) moneda = o.currency_code
    if (o.status === "canceled" || !pagada(o)) continue
    const total = Number(o.total) || 0
    if (en(o.created_at, desde, ahora)) {
      actual.pedidos++
      actual.ingresos += total
      const d = porDia.get(new Date(o.created_at).toISOString().slice(0, 10))
      if (d) {
        d.ingresos += total
        d.pedidos++
      }
      const s = tallerDe.get(o.id) || "—"
      const t = porTaller.get(s) || { pedidos: 0, ingresos: 0 }
      porTaller.set(s, { pedidos: t.pedidos + 1, ingresos: t.ingresos + total })
      for (const it of o.items || []) {
        const k = it.product_id || it.title
        const p = porProducto.get(k) || { titulo: it.title || "Producto", piezas: 0, ingresos: 0 }
        p.piezas += Number(it.quantity) || 0
        p.ingresos += (Number(it.unit_price) || 0) * (Number(it.quantity) || 0)
        porProducto.set(k, p)
      }
    } else if (en(o.created_at, antes, desde)) {
      previo.pedidos++
      previo.ingresos += total
    }
  }

  const comision = await seguro(
    async () => {
      const { data } = await query.graph({ entity: "commission_line", fields: ["amount", "created_at"] })
      let a = 0
      let p = 0
      for (const l of data || []) {
        if (en(l.created_at, desde, ahora)) a += Number(l.amount) || 0
        else if (en(l.created_at, antes, desde)) p += Number(l.amount) || 0
      }
      return { actual: a, previo: p }
    },
    { actual: 0, previo: 0 },
    logger
  )

  const clientes = await seguro(
    async () => {
      const { data } = await query.graph({ entity: "customer", fields: ["id", "created_at", "has_account"] })
      const cuentas = (data || []).filter((c) => c.has_account)
      return {
        actual: cuentas.filter((c) => en(c.created_at, desde, ahora)).length,
        previo: cuentas.filter((c) => en(c.created_at, antes, desde)).length,
        total: cuentas.length,
      }
    },
    { actual: 0, previo: 0, total: 0 },
    logger
  )

  const carritos = await seguro(
    async () => {
      const { data } = await query.graph({
        entity: "cart",
        fields: ["id", "total", "created_at", "email"],
        filters: { completed_at: null },
      })
      const del = (data || []).filter((c) => en(c.created_at, desde, ahora) && Number(c.total) > 0)
      return { cantidad: del.length, valor: del.reduce((s, c) => s + (Number(c.total) || 0), 0) }
    },
    { cantidad: 0, valor: 0 },
    logger
  )

  const ventas = {
    dias,
    moneda,
    pedidos: actual.pedidos,
    pedidos_antes: previo.pedidos,
    ingresos: actual.ingresos,
    ingresos_antes: previo.ingresos,
    ticket: actual.pedidos ? actual.ingresos / actual.pedidos : 0,
    ticket_antes: previo.pedidos ? previo.ingresos / previo.pedidos : 0,
    comision: comision.actual,
    comision_antes: comision.previo,
    clientes_nuevos: clientes.actual,
    clientes_nuevos_antes: clientes.previo,
    clientes_total: clientes.total,
    talleres_nuevos: talleres.filter((s) => en(s.created_at, desde, ahora)).length,
    talleres_total: talleres.length,
    carritos_abandonados: carritos.cantidad,
    valor_abandonado: carritos.valor,
    por_dia: [...porDia.entries()].map(([dia, v]) => ({ dia, ...v })),
    talleres_top: [...porTaller.entries()]
      .map(([id, v]) => ({ nombre: nombreTaller.get(id) || "Sin taller", ...v }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 8),
    productos_top: [...porProducto.values()].sort((a, b) => b.ingresos - a.ingresos).slice(0, 8),
  }

  // ---- Avisos ----------------------------------------------------------------
  const avisos: Aviso[] = []
  const pedidoUrl = (id: string) => `${ADMIN}/orders/${id}`

  // Pedidos pagados que no se han enviado
  const limite = HORAS_SIN_ENVIAR() * HORA
  for (const o of ordenes) {
    if (o.status === "canceled" || !pagada(o)) continue
    const enviado = (o.fulfillments || []).some((f) => f?.shipped_at && !f?.canceled_at)
    const edad = ahora - new Date(o.created_at).getTime()
    if (!enviado && edad > limite && edad < 60 * DIA) {
      avisos.push({
        nivel: "rojo",
        tipo: "pedido_sin_enviar",
        titulo: `Pedido #${o.display_id} lleva ${horas(edad)} sin enviarse`,
        detalle: `Taller: ${taller(o.id)} · ${pesos(o.total)} · ${(o.items || []).map((i) => i.title).slice(0, 2).join(", ")}`,
        url: pedidoUrl(o.id),
        cuando: o.created_at,
      })
    }
  }

  // Cancelaciones del periodo
  for (const o of ordenes) {
    if (o.status !== "canceled" || !en(o.canceled_at || o.created_at, desde, ahora)) continue
    avisos.push({
      nivel: "ambar",
      tipo: "cancelacion",
      titulo: `Pedido #${o.display_id} cancelado`,
      detalle: `Taller: ${taller(o.id)} · ${pesos(o.total)}`,
      url: pedidoUrl(o.id),
      cuando: o.canceled_at || o.created_at,
    })
  }

  // Pedidos sin pagar de más de 24 h (el cliente se quedó a medias)
  const sinPagar = ordenes.filter(
    (o) => o.status !== "canceled" && !pagada(o) && en(o.created_at, ahora - 7 * DIA, ahora - DIA)
  )
  if (sinPagar.length) {
    avisos.push({
      nivel: "azul",
      tipo: "sin_pagar",
      titulo: `${sinPagar.length} pedido(s) sin pagar de esta semana`,
      detalle: sinPagar.slice(0, 4).map((o) => `#${o.display_id} ${o.email || ""}`).join(" · "),
      url: `${ADMIN}/orders`,
    })
  }

  // Devoluciones con su motivo
  await seguro(async () => {
    const { data } = await query.graph({
      entity: "return",
      fields: ["id", "order_id", "status", "created_at", "items.quantity", "items.note", "items.reason.label", "items.item.title"],
    })
    for (const r of data || []) {
      if (!en(r.created_at, desde, ahora) || r.status === "canceled") continue
      const motivos = (r.items || [])
        .map((i) => [i?.item?.title, i?.reason?.label || "sin motivo", i?.note].filter(Boolean).join(": "))
        .join(" · ")
      avisos.push({
        nivel: "ambar",
        tipo: "devolucion",
        titulo: `Devolución en un pedido de ${taller(r.order_id)}`,
        detalle: motivos || "Sin motivo capturado",
        url: pedidoUrl(r.order_id),
        cuando: r.created_at,
      })
    }
  }, undefined, logger)

  // Reclamos (le faltó algo, le llegó otra cosa, llegó dañado)
  await seguro(async () => {
    const { data } = await query.graph({
      entity: "order_claim",
      fields: ["id", "order_id", "type", "created_at", "canceled_at", "claim_items.reason", "claim_items.note"],
    })
    for (const c of data || []) {
      if (!en(c.created_at, desde, ahora) || c.canceled_at) continue
      const motivos = (c.claim_items || [])
        .map((i) => [MOTIVO_RECLAMO[i?.reason] || "Reclamo", i?.note].filter(Boolean).join(": "))
        .join(" · ")
      avisos.push({
        nivel: "rojo",
        tipo: "reclamo",
        titulo: `Reclamo de un cliente (${taller(c.order_id)})`,
        detalle: motivos || "Sin detalle",
        url: pedidoUrl(c.order_id),
        cuando: c.created_at,
      })
    }
  }, undefined, logger)

  // Reseñas malas (1 o 2 estrellas): cuidan la marca
  await seguro(async () => {
    const { data } = await query.graph({
      entity: "review",
      fields: ["id", "rating", "customer_note", "reference", "status", "created_at"],
    })
    for (const r of data || []) {
      if (!en(r.created_at, desde, ahora) || Number(r.rating) > 2) continue
      avisos.push({
        nivel: "rojo",
        tipo: "resena_mala",
        titulo: `Reseña de ${r.rating} estrella(s) a ${r.reference === "seller" ? "un taller" : "un producto"}`,
        detalle: r.customer_note ? `"${String(r.customer_note).slice(0, 160)}"` : "Sin comentario",
        url: `${ADMIN}/reviews`,
        cuando: r.created_at,
      })
    }
  }, undefined, logger)

  // Guías: errores (incluye saldo de Skydropx) y fotos de evidencia que faltan
  await seguro(async () => {
    if (!(await knex.schema.hasTable(T_GUIAS))) return
    const errores = await knex(T_GUIAS)
      .where({ estado: "error" })
      .where("actualizado", ">", new Date(ahora - 7 * DIA))
      .select("order_id", "seller_id", "error", "actualizado")
      .limit(50)
    const sinSaldo = errores.filter((g) => /saldo|balance|fondos|insufficient|credit/i.test(g.error || ""))
    if (sinSaldo.length) {
      avisos.push({
        nivel: "rojo",
        tipo: "saldo_envios",
        titulo: "Recarga saldo en Skydropx: no se pudieron comprar guías",
        detalle: `${sinSaldo.length} guía(s) fallaron por saldo. Los talleres no pueden enviar hasta que recargues.`,
        url: "https://pro.skydropx.com",
        cuando: sinSaldo[0].actualizado,
      })
    }
    for (const g of errores.filter((x) => !sinSaldo.includes(x)).slice(0, 10)) {
      avisos.push({
        nivel: "rojo",
        tipo: "guia_error",
        titulo: `No se pudo generar una guía (${nombreTaller.get(g.seller_id) || "taller"})`,
        detalle: String(g.error || "Error sin detalle").slice(0, 200),
        url: pedidoUrl(g.order_id),
        cuando: g.actualizado,
      })
    }
    const sinEvidencia = await knex(T_GUIAS)
      .where({ estado: "lista" })
      .where("creado", "<", new Date(ahora - 24 * HORA))
      .where("creado", ">", new Date(ahora - 30 * DIA))
      .whereRaw("coalesce(jsonb_array_length(evidencia), 0) < 4")
      .select("order_id", "seller_id")
      .limit(20)
    if (sinEvidencia.length) {
      const nombres = [...new Set(sinEvidencia.map((g) => nombreTaller.get(g.seller_id) || "taller"))]
      avisos.push({
        nivel: "ambar",
        tipo: "evidencia",
        titulo: `${sinEvidencia.length} guía(s) sin las fotos del paquete`,
        detalle: `Sin fotos no se puede pelear un sobrepeso. Talleres: ${nombres.slice(0, 5).join(", ")}`,
        url: `${ADMIN}/envios`,
      })
    }
    // Gasto en guías del periodo (para saber cuánto saldo se va)
    const [{ gasto }] = await knex(T_GUIAS)
      .whereIn("estado", ["lista", "entregada"])
      .where("creado", ">", new Date(desde))
      .sum({ gasto: "costo" })
    ventas["gasto_guias"] = Number(gasto) || 0
  }, undefined, logger)

  // Sobrepesos por cobrar o en disputa
  await seguro(async () => {
    if (!(await knex.schema.hasTable(T_SOBREPESO))) return
    const filas = await knex(T_SOBREPESO).whereIn("estado", ["por_cobrar", "en_disputa"]).select("referencia", "responsable_nombre", "monto", "estado", "created_at")
    if (filas.length) {
      const total = filas.reduce((s, f) => s + Number(f.monto || 0), 0)
      avisos.push({
        nivel: "ambar",
        tipo: "sobrepeso",
        titulo: `${filas.length} sobrepeso(s) pendientes por ${pesos(total)}`,
        detalle: filas
          .slice(0, 4)
          .map((f) => `${f.referencia} (${f.responsable_nombre || "—"}) ${pesos(f.monto)}${f.estado === "en_disputa" ? " en disputa" : ""}`)
          .join(" · "),
        url: `${ADMIN}/envios`,
      })
    }
  }, undefined, logger)

  // Saldo de Skydropx (lib/saldos.ts): ¿alcanza?, ¿hay que recargar?, notas de compra
  let saldos = null
  await seguro(async () => {
    const { estadoSaldoSkydropx, cargosExtraSkydropx, listarRecargas } = await import("./saldos")
    const s = await estadoSaldoSkydropx(container)
    const recargas = await listarRecargas(container, 20)
    saldos = { skydropx: s, recargas }
    if (s?.recargar) {
      avisos.push({
        nivel: "rojo",
        tipo: "saldo_envios",
        titulo: "Recarga saldo en Skydropx",
        detalle: `Te quedan ${pesos(s.saldo)}${s.dias_restantes !== null ? ` (alcanza para ≈${s.dias_restantes} días)` : ""}. Te sugerimos recargar ${pesos(s.sugerida)} (tope ${pesos(s.tope)}). Gastas ≈${pesos(s.gasto_dia)} al día en guías.`,
        url: s.url_recarga,
      })
    }
    const sinNota = recargas.filter((r) => !r.comprobante_url)
    if (sinNota.length) {
      avisos.push({
        nivel: "azul",
        tipo: "comprobante",
        titulo: `${sinNota.length} recarga(s) sin nota de compra`,
        detalle: "Súbela en Centro de control → Saldos y recargas para tener todos tus comprobantes juntos.",
        url: `${ADMIN}/control`,
      })
    }
    const extras = (await cargosExtraSkydropx().catch(() => [])).filter((c) => c.fecha && en(c.fecha, desde, ahora))
    if (extras.length) {
      avisos.push({
        nivel: "ambar",
        tipo: "cargo_extra",
        titulo: `Skydropx cobró ${extras.length} cargo(s) extra por ${pesos(extras.reduce((t, c) => t + c.monto, 0))}`,
        detalle: `${extras.slice(0, 3).map((c) => `${c.concepto} ${pesos(c.monto)}`).join(" · ")}. Revisa si va como sobrepeso al taller o al cliente.`,
        url: `${ADMIN}/envios`,
      })
    }
  }, undefined, logger)

  // Agente de recargas y vencimientos (lib/vigilancia.ts): RunPod, Meta y Google
  // Ads, Resend, disco del servidor, R2, Supabase, dominio, SSL y Hostinger.
  await seguro(async () => {
    const { vigilarServicios, avisosDeServicios } = await import("./vigilancia")
    const servicios = await vigilarServicios(container)
    saldos = { ...(saldos || { skydropx: null, recargas: [] }), servicios }
    avisos.push(...avisosDeServicios(servicios, `${ADMIN}/control`))
  }, undefined, logger)

  // Talleres nuevos esperando aprobación (lib/alta-taller.ts). Solo los que ya
  // confirmaron su correo: los demás todavía no terminan de registrarse.
  await seguro(async () => {
    const { correoConfirmado } = await import("./alta-taller")
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "email", "status", "created_at", "metadata"],
      filters: { status: "pending_approval" } as Record<string, unknown>,
    })
    const listos = (data || []).filter((t) => correoConfirmado(t))
    if (listos.length) {
      avisos.push({
        nivel: "ambar",
        tipo: "taller_por_aprobar",
        titulo: `${listos.length} taller(es) nuevo(s) esperan que los apruebes`,
        detalle: `${listos.slice(0, 5).map((t) => t.name || t.email).join(", ")}. Mientras no los apruebes no pueden publicar.`,
        url: `${ADMIN}/sellers`,
      })
    }
  }, undefined, logger)

  // Verificaciones de talleres esperando revisión
  await seguro(async () => {
    const { data } = await query.graph({ entity: "verificacion_taller", fields: ["id", "seller_id", "estado", "enviado_en"] })
    const pendientes = (data || []).filter((v) => v.estado === "en_revision")
    if (pendientes.length) {
      avisos.push({
        nivel: "azul",
        tipo: "verificacion",
        titulo: `${pendientes.length} taller(es) esperan que revises su verificación`,
        detalle: pendientes.slice(0, 5).map((v) => nombreTaller.get(v.seller_id) || "taller").join(", "),
        url: `${ADMIN}/verificaciones`,
      })
    }
  }, undefined, logger)

  // Cotizador: pruebas que se terminan y planes cancelados
  await seguro(async () => {
    const { panelVentas } = await import("./cotizador-crm")
    const p = await panelVentas()
    if (p?.por_vencer?.length) {
      avisos.push({
        nivel: "azul",
        tipo: "cotizador",
        titulo: `${p.por_vencer.length} taller(es) del Cotizador por vencer o en el límite`,
        detalle: p.por_vencer.slice(0, 4).map((f) => f.nombre).join(", "),
        url: `${ADMIN}/cotizador`,
      })
    }
  }, undefined, logger)

  const orden = { rojo: 0, ambar: 1, azul: 2 }
  avisos.sort(
    (a, b) => orden[a.nivel] - orden[b.nivel] || new Date(b.cuando || 0).getTime() - new Date(a.cuando || 0).getTime()
  )

  return {
    generado: new Date(ahora).toISOString(),
    ventas,
    saldos,
    avisos,
    conteo: {
      rojo: avisos.filter((a) => a.nivel === "rojo").length,
      ambar: avisos.filter((a) => a.nivel === "ambar").length,
      azul: avisos.filter((a) => a.nivel === "azul").length,
    },
  }
}

// ---- Correo de la mañana ------------------------------------------------------

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const COLOR = { rojo: "#B42318", ambar: "#B54708", azul: "#1D4F8C" }
const ETIQUETA = { rojo: "Urgente", ambar: "Revisar", azul: "Para saber" }

export function correoCentroControl(d: Awaited<ReturnType<typeof calcularCentroControl>>): { asunto: string; html: string } {
  const v = d.ventas
  const urgentes = d.conteo.rojo
  const asunto = urgentes
    ? `⚠ ${urgentes} urgente(s) en HETNA · ayer ${v.pedidos} pedido(s), ${pesos(v.ingresos)}`
    : `HETNA: ayer ${v.pedidos} pedido(s), ${pesos(v.ingresos)} · sin urgencias`
  const filas = d.avisos
    .filter((a) => a.nivel !== "azul")
    .slice(0, 25)
    .map(
      (a) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;vertical-align:top">
<span style="display:inline-block;background:${COLOR[a.nivel]};color:#fff;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700">${ETIQUETA[a.nivel]}</span>
<b style="font-size:14px;color:#142033"> ${esc(a.titulo)}</b>
${a.detalle ? `<div style="font-size:13px;color:#555;margin-top:3px">${esc(a.detalle)}</div>` : ""}
${a.url ? `<div style="margin-top:3px"><a href="${esc(a.url)}" style="font-size:13px;color:#C2560A">Abrir</a></div>` : ""}
</td></tr>`
    )
    .join("")
  const azules = d.avisos.filter((a) => a.nivel === "azul")
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#142033">
<h2 style="margin:0 0 4px">Centro de control HETNA</h2>
<p style="margin:0 0 16px;color:#666;font-size:13px">Ayer</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>
<td style="padding:10px;background:#F7F5F0;border-radius:8px"><div style="font-size:12px;color:#666">Ventas</div><div style="font-size:22px;font-weight:800">${pesos(v.ingresos)}</div></td>
<td style="width:8px"></td>
<td style="padding:10px;background:#F7F5F0;border-radius:8px"><div style="font-size:12px;color:#666">Pedidos</div><div style="font-size:22px;font-weight:800">${v.pedidos}</div></td>
<td style="width:8px"></td>
<td style="padding:10px;background:#F7F5F0;border-radius:8px"><div style="font-size:12px;color:#666">Comisión HETNA</div><div style="font-size:22px;font-weight:800">${pesos(v.comision)}</div></td>
</tr></table>
${filas ? `<h3 style="margin:0 0 6px">Lo que necesita tu atención</h3><table style="width:100%;border-collapse:collapse">${filas}</table>` : `<p style="background:#E6F4EC;color:#14683F;padding:10px;border-radius:8px">Todo en orden: no hay nada urgente.</p>`}
${azules.length ? `<h3 style="margin:18px 0 6px">Para estar al tanto</h3><ul style="padding-left:18px;font-size:13px;color:#444">${azules.map((a) => `<li>${esc(a.titulo)}</li>`).join("")}</ul>` : ""}
<p style="margin-top:20px"><a href="${ADMIN}/control" style="background:#C2560A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Abrir el centro de control</a></p>
</div>`
  return { asunto, html }
}
