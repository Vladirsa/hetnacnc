import { MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { VendorRequest } from "./vendor-request"
import { VendorAnalyticsResponse } from "./types"

const DIAS_VENTANA = 30

type OrderItemRow = {
  product_id: string | null
  title: string | null
  quantity: number
  total: number
}

type OrderRow = {
  id: string
  total: number
  currency_code: string
  created_at: string
  items: OrderItemRow[]
}

type PayoutRow = {
  id: string
  display_id: number
  amount: number
  currency_code: string
  status: string
  created_at: string
}

const aFechaISO = (fecha: Date) => fecha.toISOString().slice(0, 10)

export const GET = async (req: VendorRequest, res: MedusaResponse<VendorAnalyticsResponse>) => {
  const sellerId = req.seller_context!.seller_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_VENTANA)

  const { data: sellerOrders } = await query.graph({
    entity: "order_seller",
    fields: ["order_id"],
    filters: { seller_id: sellerId },
  })
  const orderIds = sellerOrders.map((o) => o.order_id)

  const { data: sellerPayouts } = await query.graph({
    entity: "payout_seller",
    fields: ["payout_id"],
    filters: { seller_id: sellerId },
  })
  const payoutIds = sellerPayouts.map((p) => p.payout_id)

  const { data: orders } = orderIds.length
    ? await query.graph({
        entity: "order",
        fields: ["id", "total", "currency_code", "created_at", "items.product_id", "items.title", "items.quantity", "items.total"],
        filters: {
          id: orderIds,
          created_at: { $gte: desde.toISOString() },
        },
      })
    : { data: [] as OrderRow[] }

  const { data: payouts } = payoutIds.length
    ? await query.graph({
        entity: "payout",
        fields: ["id", "display_id", "amount", "currency_code", "status", "created_at"],
        filters: { id: payoutIds },
      })
    : { data: [] as PayoutRow[] }

  let moneda: string | null = null
  const porDia = new Map<string, { pedidos: number; ingresos: number }>()
  for (let i = 0; i < DIAS_VENTANA; i++) {
    const dia = new Date(desde)
    dia.setDate(dia.getDate() + i)
    porDia.set(aFechaISO(dia), { pedidos: 0, ingresos: 0 })
  }

  let ingresosTotales = 0
  const productos = new Map<string, { producto_id: string; titulo: string; cantidad: number; ingresos: number }>()

  for (const orden of orders as unknown as OrderRow[]) {
    const total = Number(orden.total) || 0
    ingresosTotales += total
    moneda ??= orden.currency_code

    const dia = aFechaISO(new Date(orden.created_at))
    const bucket = porDia.get(dia)
    if (bucket) {
      bucket.pedidos += 1
      bucket.ingresos += total
    }

    for (const item of orden.items || []) {
      if (!item.product_id) continue
      const existente = productos.get(item.product_id) ?? {
        producto_id: item.product_id,
        titulo: item.title || "Sin nombre",
        cantidad: 0,
        ingresos: 0,
      }
      existente.cantidad += Number(item.quantity) || 0
      existente.ingresos += Number(item.total) || 0
      productos.set(item.product_id, existente)
    }
  }

  const productosTop = [...productos.values()]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)

  let payoutsPendientes = { cantidad: 0, monto: 0 }
  let payoutsPagados = { cantidad: 0, monto: 0 }
  for (const payout of payouts as unknown as PayoutRow[]) {
    const monto = Number(payout.amount) || 0
    moneda ??= payout.currency_code
    if (payout.status === "paid" || payout.status === "completed") {
      payoutsPagados = { cantidad: payoutsPagados.cantidad + 1, monto: payoutsPagados.monto + monto }
    } else {
      payoutsPendientes = { cantidad: payoutsPendientes.cantidad + 1, monto: payoutsPendientes.monto + monto }
    }
  }

  const payoutsRecientes = [...(payouts as unknown as PayoutRow[])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      display_id: p.display_id,
      monto: Number(p.amount) || 0,
      moneda: p.currency_code,
      estado: p.status,
      creado: p.created_at,
    }))

  res.json({
    moneda,
    pedidos: {
      ventana_dias: DIAS_VENTANA,
      total_pedidos: orders.length,
      ingresos_totales: ingresosTotales,
      por_dia: [...porDia.entries()].map(([fecha, v]) => ({ fecha, pedidos: v.pedidos, ingresos: v.ingresos })),
    },
    productos_top: productosTop,
    payouts: {
      pendientes: payoutsPendientes,
      pagados: payoutsPagados,
      recientes: payoutsRecientes,
    },
  })
}
