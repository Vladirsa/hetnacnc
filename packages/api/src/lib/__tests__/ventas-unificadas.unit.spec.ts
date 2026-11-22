import { resumenVentas, ventaCotizador, ventaLicitacion, ventaTienda } from "../ventas-unificadas"

const cobro = (status: string, refunded = 0) => ({ payment_collections: [{ status, refunded_amount: refunded, payments: [{ provider_id: "pp_mercadopago_mp" }] }] })

describe("Vista Ventas: una regla por canal", () => {
  it("tienda: pago, reembolso, factura y entrega", () => {
    const v = ventaTienda({ id: "order_1", display_id: 12, status: "pending", total: 500, currency_code: "mxn", created_at: "2026-11-20", fulfillments: [{ shipped_at: "x" }], ...cobro("completed") }, { taller: "Taller A", factura: null, saldo: "pendiente" })
    expect(v).toMatchObject({ canal: "tienda", folio: "#12", taller: "Taller A", total: 500, moneda: "MXN", pago: "pagado", factura: "no_pedida", entrega: "enviado", saldo_taller: "pendiente" })
    expect(ventaTienda({ id: "o", status: "completed", total: 1, ...cobro("completed", 1) }).pago).toBe("reembolsado")
    expect(ventaTienda({ id: "o", status: "canceled", total: 1, ...cobro("completed") }).entrega).toBe("cancelado")
    expect(ventaTienda({ id: "o", status: "pending", total: 1, fulfillments: [{ delivered_at: "x" }], ...cobro("authorized") }, { factura: "emitida" })).toMatchObject({ pago: "pagado", entrega: "entregado", factura: "emitida" })
    expect(ventaTienda({ id: "o", status: "pending", total: 1, payment_collections: [{ status: "authorized", payments: [{ provider_id: "pp_system_default" }] }] }).pago).toBe("pendiente")
  })

  it("licitación: anticipo, pago completo, reembolso y factura cuando cobra HETNA", () => {
    const s = { id: "sol_abcdefgh123", folio: 7, estado: "pagada", cobro: "hetna", created_at: "2026-11-21" }
    expect(ventaLicitacion(s, { precio: 1000, pagos: [{ monto: 500, estado: "approved" }] })).toMatchObject({ folio: "HET-00007", pago: "parcial", factura: "sin_proceso", entrega: "pendiente" })
    expect(ventaLicitacion(s, { precio: 1000, pagos: [{ monto: 500, estado: "approved" }, { monto: 500, estado: "approved" }] }).pago).toBe("pagado")
    expect(ventaLicitacion(s, { precio: 1000, pagos: [{ monto: 1000, estado: "refunded" }] }).pago).toBe("reembolsado")
    expect(ventaLicitacion({ ...s, cobro: "taller", etapa: "entregada" }, { precio: 10 })).toMatchObject({ factura: "del_taller", entrega: "entregado" })
  })

  it("app del Cotizador: sólo el cobro por liga, con su pedido", () => {
    const v = ventaCotizador({ mp_payment_id: "123456789", monto: "800", comision_hetna: "24", estado: "approved", creado: "2026-11-21" }, { taller: "Taller B", estadoPedido: "Entregado", folio: "P-0003" })
    expect(v).toMatchObject({ canal: "cotizador", folio: "P-0003", total: 800, pago: "pagado", entrega: "entregado", factura: "del_taller" })
    expect(v.nota).toMatch(/24\.00/)
    expect(ventaCotizador({ mp_payment_id: "1", monto: 1, estado: "refunded" }).pago).toBe("reembolsado")
  })

  it("resumen: pagado, sin factura y por entregar por canal y moneda", () => {
    const r = resumenVentas([
      ventaTienda({ id: "a", status: "pending", total: 100, currency_code: "mxn", ...cobro("completed") }),
      ventaTienda({ id: "b", status: "pending", total: 50, currency_code: "mxn", ...cobro("pending") }),
    ])
    expect(r["tienda:MXN"]).toEqual({ ventas: 2, total: 150, pagado: 100, sin_factura: 1, por_entregar: 1 })
  })
})
