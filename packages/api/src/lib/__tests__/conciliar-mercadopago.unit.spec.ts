import { carritoDeReferencia, listoParaRevisar } from "../conciliar-mercadopago"

describe("Revisión de cobros de Mercado Pago sin pedido", () => {
  it("saca el carrito de la referencia del pago", () => {
    expect(carritoDeReferencia("hetna_cart_01JABCDEF123_1712345678901")).toBe("cart_01JABCDEF123")
    expect(carritoDeReferencia("creditos:abc")).toBeNull()
    expect(carritoDeReferencia("hetna_payses_01X_123")).toBeNull()
    expect(carritoDeReferencia("hetna_cart_01X_123; drop")).toBeNull()
    expect(carritoDeReferencia(null)).toBeNull()
  })

  it("espera 10 minutos para que gane el regreso del navegador", () => {
    const ahora = Date.parse("2026-11-22T12:00:00Z")
    expect(listoParaRevisar({ id: 1, status: "approved", date_approved: "2026-11-22T11:55:00Z" }, ahora)).toBe(false)
    expect(listoParaRevisar({ id: 1, status: "approved", date_approved: "2026-11-22T11:40:00Z" }, ahora)).toBe(true)
    expect(listoParaRevisar({ id: 1, status: "rejected", date_approved: "2026-11-22T11:40:00Z" }, ahora)).toBe(false)
    expect(listoParaRevisar({ id: 1, status: "approved", date_approved: null }, ahora)).toBe(false)
  })
})
