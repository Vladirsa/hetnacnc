import { textoPedido, type DatosPedido } from "../whatsapp-pedidos"

const d: DatosPedido = {
  id: "order_01ABC",
  numero: "#1023",
  nombre: "Laura",
  articulos: 2,
  total: "$1,250.00",
  digital: false,
  entregado: false,
  envio: "Envío económico",
  paqueteria: "DHL",
  guia: "1234567890",
  rastreo: "https://rastreo.example/1234567890",
  customerId: "cus_1",
  email: "laura@example.com",
}

describe("avisos de pedido por WhatsApp", () => {
  it("recibido: número, artículos, total y liga del pedido", () => {
    const t = textoPedido("recibido", d)
    expect(t).toContain("¡Hola Laura! Tu pedido #1023 con 2 artículos ha sido recibido 📦")
    expect(t).toContain("$1,250.00")
    expect(t).toContain("/mx/user/orders/order_01ABC")
    expect(t).toContain("BAJA")
  })

  it("compra digital: manda a descargas", () => {
    const t = textoPedido("recibido", { ...d, digital: true, articulos: 1 })
    expect(t).toContain("con 1 artículo está lista")
    expect(t).toContain("/mx/user/descargas")
  })

  it("en camino: paquetería, guía y rastreo", () => {
    const t = textoPedido("en_camino", d)
    expect(t).toContain("va en camino")
    expect(t).toContain("Paquetería: DHL · Guía: 1234567890")
    expect(t).toContain("Rastréalo aquí: https://rastreo.example/1234567890")
  })

  it("entregado pide calificar; cancelado explica el reembolso", () => {
    expect(textoPedido("entregado", d)).toContain("fue entregado")
    expect(textoPedido("cancelado", d)).toContain("reembolso")
  })

  it("sin nombre saluda igual", () => {
    expect(textoPedido("recibido", { ...d, nombre: "" })).toMatch(/^¡Hola! Tu pedido/)
  })
})
