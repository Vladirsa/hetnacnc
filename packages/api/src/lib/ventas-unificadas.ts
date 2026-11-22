// @ts-nocheck
// Vista "Ventas" (Fase 1.2 del análisis tipo SAP, docs/analisis-sap-fase0.md):
// una sola lista con las ventas de los 3 sistemas que hoy no se hablan, sin
// mover ni copiar datos (cada venta se queda donde nace):
//
//   tienda      pedidos de Medusa/Mercur (order + hetna_saldo_taller + hetna_factura)
//   licitacion  fabricación a medida (hetna_solicitud + propuesta elegida + pagos)
//   cotizador   cobros por liga de la app del Cotizador (Supabase cotizacion_pagos);
//               sólo el cobro que pasó por HETNA, sin datos del cliente del taller
//
// De cada venta: fecha, taller, total, y en qué va el pago, la factura y la
// entrega. Cada canal se lee por separado: si uno falla, los demás salen.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CAMPOS_PAGO, pedidoPagado, pedidoReembolsado } from "./pago-pedido"
import { T_FACTURA } from "./facturas"
import { T_SALDO } from "./saldos-talleres"
import { T_PROPUESTA, T_SOLICITUD } from "./licitacion"
import { T_PAGO } from "./licitacion-cobro"
import { etapaDe } from "./seguimiento"
import { supa, supabaseListo } from "./cotizador-suscripciones"

export type Canal = "tienda" | "licitacion" | "cotizador"
export type EstadoPago = "pagado" | "pendiente" | "reembolsado" | "parcial"
export type EstadoFactura = "emitida" | "solicitada" | "rechazada" | "no_pedida" | "sin_proceso" | "del_taller"
export type EstadoEntrega = "pendiente" | "enviado" | "entregado" | "cancelado"

export type Venta = {
  canal: Canal
  id: string
  folio: string
  fecha: string
  taller: string | null
  total: number
  moneda: string
  pago: EstadoPago
  factura: EstadoFactura
  entrega: EstadoEntrega
  saldo_taller?: string | null
  nota?: string
}

const num = (v: any) => Number(v?.value ?? v ?? 0) || 0
const iso = (d: any) => (d ? new Date(d).toISOString() : new Date(0).toISOString())

// ---------------------------------------------------------------------------
// Reglas por canal (puras, para probarlas)
// ---------------------------------------------------------------------------
export function ventaTienda(o: any, extra: { taller?: string | null; factura?: string | null; saldo?: string | null } = {}): Venta {
  const f = o.fulfillments || []
  const entrega: EstadoEntrega =
    o.status === "canceled" ? "cancelado" : f.some((x: any) => x?.delivered_at) ? "entregado" : f.some((x: any) => x?.shipped_at) ? "enviado" : "pendiente"
  const pago: EstadoPago = pedidoReembolsado(o) ? "reembolsado" : pedidoPagado(o) ? "pagado" : "pendiente"
  const factura: EstadoFactura = extra.factura === "emitida" || extra.factura === "solicitada" || extra.factura === "rechazada" ? extra.factura : "no_pedida"
  return {
    canal: "tienda",
    id: o.id,
    folio: `#${o.display_id ?? "—"}`,
    fecha: iso(o.created_at),
    taller: extra.taller || null,
    total: num(o.total),
    moneda: String(o.currency_code || "mxn").toUpperCase(),
    pago,
    factura,
    entrega,
    saldo_taller: extra.saldo || null,
  }
}

export function ventaLicitacion(s: any, p: { precio?: any; taller?: string | null; pagos?: { monto: any; estado: string }[] } = {}): Venta {
  const total = num(p.precio)
  const aprobados = (p.pagos || []).filter((x) => x.estado === "approved").reduce((a, x) => a + num(x.monto), 0)
  const reemb = (p.pagos || []).some((x) => /refund|charged_back/.test(String(x.estado)))
  const pago: EstadoPago = reemb ? "reembolsado" : total > 0 && aprobados >= total - 0.5 ? "pagado" : aprobados > 0 ? "parcial" : "pendiente"
  const etapa = etapaDe(s)
  const entrega: EstadoEntrega = etapa === "cancelada" ? "cancelado" : etapa === "entregada" || etapa === "cerrada" ? "entregado" : "pendiente"
  // Cobrada por HETNA: hoy no hay forma de emitir ni subir el CFDI (hueco 9 del análisis)
  const factura: EstadoFactura = s.cobro === "hetna" ? "sin_proceso" : "del_taller"
  return {
    canal: "licitacion",
    id: s.id,
    folio: s.folio ? `HET-${String(s.folio).padStart(5, "0")}` : s.id.slice(-8),
    fecha: iso(s.created_at),
    taller: p.taller || null,
    total,
    moneda: "MXN",
    pago,
    factura,
    entrega,
    nota: s.cobro === "hetna" ? "Cobra HETNA" : s.cobro === "taller" ? "Cobra el taller" : undefined,
  }
}

export function ventaCotizador(pg: any, extra: { taller?: string | null; estadoPedido?: string | null; folio?: string | null } = {}): Venta {
  const e = String(pg.estado || "")
  const pago: EstadoPago = /refund|charged_back/.test(e) ? "reembolsado" : e === "approved" ? "pagado" : "pendiente"
  const ep = String(extra.estadoPedido || "")
  const entrega: EstadoEntrega = ep === "Cancelado" ? "cancelado" : ep === "Entregado" ? "entregado" : ep === "Entrega" ? "enviado" : "pendiente"
  return {
    canal: "cotizador",
    id: String(pg.mp_payment_id || pg.id),
    folio: extra.folio || String(pg.mp_payment_id || "").slice(-8),
    fecha: iso(pg.creado),
    taller: extra.taller || null,
    total: num(pg.monto),
    moneda: "MXN",
    pago,
    factura: "del_taller",
    entrega,
    nota: num(pg.comision_hetna) ? `Comisión HETNA $${num(pg.comision_hetna).toFixed(2)}` : undefined,
  }
}

/** Totales por canal y estado, para el encabezado de la vista. */
export function resumenVentas(ventas: Venta[]) {
  const r: Record<string, { ventas: number; total: number; pagado: number; sin_factura: number; por_entregar: number }> = {}
  for (const v of ventas) {
    const k = `${v.canal}:${v.moneda}`
    const x = (r[k] ||= { ventas: 0, total: 0, pagado: 0, sin_factura: 0, por_entregar: 0 })
    x.ventas++
    x.total += v.total
    if (v.pago === "pagado") x.pagado += v.total
    if (v.pago === "pagado" && (v.factura === "no_pedida" || v.factura === "sin_proceso")) x.sin_factura++
    if (v.pago === "pagado" && (v.entrega === "pendiente" || v.entrega === "enviado")) x.por_entregar++
  }
  return r
}

// ---------------------------------------------------------------------------
// Lectura de cada sistema
// ---------------------------------------------------------------------------
async function intento<T>(nombre: string, f: () => Promise<T>, avisos: string[]): Promise<T | []> {
  try {
    return await f()
  } catch (e) {
    avisos.push(`${nombre}: ${(e as Error).message.slice(0, 200)}`)
    return []
  }
}

async function nombresTalleres(knex: any, ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return new Map<string, string>()
  const filas = await knex("seller").whereIn("id", unicos).select("id", "name")
  return new Map(filas.map((f: any) => [f.id, f.name]))
}

export async function listarVentas(scope: any, o: { dias?: number } = {}) {
  const dias = Math.max(1, Math.min(365, Number(o.dias) || 30))
  const desde = new Date(Date.now() - dias * 864e5)
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const avisos: string[] = []

  const tienda = await intento("Tienda", async () => {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "status", "total", "currency_code", "created_at", "fulfillments.shipped_at", "fulfillments.delivered_at", ...CAMPOS_PAGO],
      filters: { created_at: { $gte: desde } },
    })
    const ids = (data || []).map((x: any) => x.id)
    const [saldos, facturas] = ids.length
      ? await Promise.all([
          (await knex.schema.hasTable(T_SALDO)) ? knex(T_SALDO).whereIn("order_id", ids).select("order_id", "seller_id", "estado") : [],
          (await knex.schema.hasTable(T_FACTURA)) ? knex(T_FACTURA).whereIn("order_id", ids).select("order_id", "estado") : [],
        ])
      : [[], []]
    const saldo = new Map(saldos.map((s: any) => [s.order_id, s]))
    const factura = new Map(facturas.map((f: any) => [f.order_id, f.estado]))
    const talleres = await nombresTalleres(knex, saldos.map((s: any) => s.seller_id))
    return (data || []).map((x: any) => {
      const s: any = saldo.get(x.id)
      return ventaTienda(x, { taller: s ? talleres.get(s.seller_id) || null : null, factura: factura.get(x.id) || null, saldo: s?.estado || null })
    })
  }, avisos)

  const licitaciones = await intento("Licitaciones", async () => {
    if (!(await knex.schema.hasTable(T_SOLICITUD))) return []
    const sols = await knex(T_SOLICITUD).where("created_at", ">=", desde).whereNotNull("propuesta_elegida").select("*").limit(500)
    if (!sols.length) return []
    const props = await knex(T_PROPUESTA).whereIn("id", sols.map((s: any) => s.propuesta_elegida)).select("id", "precio", "seller_id")
    const prop = new Map(props.map((p: any) => [p.id, p]))
    const pagos = (await knex.schema.hasTable(T_PAGO)) ? await knex(T_PAGO).whereIn("solicitud_id", sols.map((s: any) => s.id)).select("solicitud_id", "monto", "estado") : []
    const talleres = await nombresTalleres(knex, props.map((p: any) => p.seller_id))
    return sols.map((s: any) => {
      const p: any = prop.get(s.propuesta_elegida) || {}
      return ventaLicitacion(s, { precio: p.precio, taller: talleres.get(p.seller_id) || null, pagos: pagos.filter((x: any) => x.solicitud_id === s.id) })
    })
  }, avisos)

  const cotizador = await intento("App del Cotizador", async () => {
    if (!supabaseListo()) return []
    const pagos = await supa<any[]>(`/rest/v1/cotizacion_pagos?creado=gte.${desde.toISOString()}&select=mp_payment_id,cotizacion_id,negocio_id,monto,comision_hetna,estado,creado&order=creado.desc&limit=500`)
    if (!pagos?.length) return []
    const negIds = [...new Set(pagos.map((p) => p.negocio_id))].join(",")
    const cotIds = [...new Set(pagos.map((p) => p.cotizacion_id))].join(",")
    const [negocios, pedidos] = await Promise.all([
      supa<any[]>(`/rest/v1/negocios?id=in.(${negIds})&select=id,nombre`),
      supa<any[]>(`/rest/v1/pedidos?cotizacion_id=in.(${cotIds})&select=cotizacion_id,folio,estado`),
    ])
    const neg = new Map((negocios || []).map((n) => [n.id, n.nombre]))
    const ped = new Map((pedidos || []).map((p) => [p.cotizacion_id, p]))
    return pagos.map((p) => {
      const d: any = ped.get(p.cotizacion_id)
      return ventaCotizador(p, { taller: neg.get(p.negocio_id) || null, estadoPedido: d?.estado || null, folio: d?.folio || null })
    })
  }, avisos)

  const ventas = [...tienda, ...licitaciones, ...cotizador].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return { dias, ventas, resumen: resumenVentas(ventas), avisos }
}
