import { correoCliente, correoTaller, type Pedido } from "../correo-pedidos"
import { esPedidoDigital } from "../whatsapp-pedidos"

const base: Pedido = {
  id: "order_1", numero: "#10", nombre: "Ana", email: "ana@ejemplo.com", conCuenta: false,
  taller: { id: "s1", nombre: "Taller <b>X</b>", email: "t@ejemplo.com" },
  renglones: [{ titulo: "Fresa <script>", presentacion: "6 mm", cantidad: 2, precio: "$100.00", foto: "" }],
  subtotal: "$100.00", envioCosto: "$50.00", total: "$150.00", envio: "Envío económico",
  direccion: ["Ana López", "Calle 1", "Puebla, Puebla, 72000"], digital: false, pagado: true, paqueteria: "Estafeta", guia: "123", rastreo: "https://r.ejemplo.com/123",
}

describe("Correos del pedido", () => {
  it("cliente: recibido con productos, total y dirección; escapa el texto", () => {
    const m = correoCliente("recibido", base)
    expect(m.asunto).toContain("#10")
    expect(m.html).toContain("$150.00")
    expect(m.html).toContain("Puebla, Puebla, 72000")
    expect(m.html).not.toContain("<script>")
    expect(m.html).not.toContain("<b>X</b>")
    // Sin cuenta no lleva la liga del pedido (pide iniciar sesión)
    expect(m.html).not.toContain("/user/orders/")
    expect(correoCliente("recibido", { ...base, conCuenta: true }).html).toContain("/user/orders/order_1")
  })

  it("cliente: en camino con paquetería, guía y rastreo", () => {
    const m = correoCliente("en_camino", base)
    expect(m.html).toContain("Estafeta")
    expect(m.html).toContain("123")
    expect(m.html).toContain("https://r.ejemplo.com/123")
  })

  it("taller: pedido nuevo con liga a su panel; digital no pide enviar", () => {
    expect(correoTaller(base).html).toContain("/orders/order_1")
    expect(correoTaller({ ...base, digital: true }).html).toContain("no lleva envío por paquetería")
    expect(correoTaller({ ...base, pagado: false }).html).toContain("Pago pendiente")
    expect(correoCliente("recibido", { ...base, pagado: false }).html).toContain("Falta confirmar el pago")
  })

  it("compra digital: sin envío o sólo Entrega digital", () => {
    expect(esPedidoDigital([])).toBe(true)
    expect(esPedidoDigital([{ name: "Entrega digital" }])).toBe(true)
    expect(esPedidoDigital([{ name: "Envío económico" }])).toBe(false)
    expect(esPedidoDigital([{ name: "Entrega digital" }, { name: "Envío estándar" }])).toBe(false)
  })
})
