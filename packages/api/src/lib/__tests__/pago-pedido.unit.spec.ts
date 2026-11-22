import { pedidoPagado, pedidoReembolsado } from "../pago-pedido"

const mp = [{ provider_id: "pp_mercadopago_mercadopago" }]
const manual = [{ provider_id: "pp_system_default" }]

describe("¿Está pagado el pedido?", () => {
  it("lee el cobro del carrito (pedidos divididos de Mercur)", () => {
    expect(pedidoPagado({ payment_collections: [], cart: { payment_collection: { status: "authorized", payments: mp } } })).toBe(true)
    expect(pedidoPagado({ cart: { payment_collection: { status: "not_paid", payments: mp } } })).toBe(false)
  })

  it("autorizado cuenta sólo con proveedores que cobran al autorizar", () => {
    expect(pedidoPagado({ cart: { payment_collection: { status: "authorized", payments: [{ provider_id: "pp_paypal_paypal" }] } } })).toBe(true)
    // Pago manual: autorizado sin cobrar
    expect(pedidoPagado({ cart: { payment_collection: { status: "authorized", payments: manual } } })).toBe(false)
    expect(pedidoPagado({ cart: { payment_collection: { status: "authorized" } } })).toBe(false)
    expect(pedidoPagado({ cart: { payment_collection: { status: "partially_authorized", payments: mp } } })).toBe(false)
  })

  it("capturado cuenta con cualquier proveedor", () => {
    expect(pedidoPagado({ payment_collections: [{ status: "completed", payments: manual }] })).toBe(true)
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
