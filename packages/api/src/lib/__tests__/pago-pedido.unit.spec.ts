import { pedidoPagado, pedidoReembolsado } from "../pago-pedido"

describe("¿Está pagado el pedido?", () => {
  it("lee el cobro del carrito (pedidos divididos de Mercur)", () => {
    expect(pedidoPagado({ payment_collections: [], cart: { payment_collection: { status: "authorized" } } })).toBe(true)
    expect(pedidoPagado({ cart: { payment_collection: { status: "not_paid" } } })).toBe(false)
  })
  it("también el cobro ligado directo al pedido", () => {
    expect(pedidoPagado({ payment_collections: [{ status: "completed" }] })).toBe(true)
    expect(pedidoPagado({ payment_collections: [{ status: "partially_captured" }] })).toBe(true)
    expect(pedidoPagado({ payment_collections: [{ status: "awaiting" }] })).toBe(false)
  })
  it("sin cobro no está pagado", () => {
    expect(pedidoPagado({})).toBe(false)
    expect(pedidoPagado(null)).toBe(false)
  })
  it("reconoce reembolsos (número o BigNumber)", () => {
    expect(pedidoReembolsado({ cart: { payment_collection: { status: "completed", refunded_amount: 100 } } })).toBe(true)
    expect(pedidoReembolsado({ cart: { payment_collection: { status: "completed", refunded_amount: { value: "0" } } } })).toBe(false)
    expect(pedidoReembolsado({ payment_collections: [{ status: "completed", refunded_amount: { value: "50" } }] })).toBe(true)
  })
})
