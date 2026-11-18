import { disponiblesOferta } from "../aviso-existencia"
import { abandonedCartEmailHtml, abandonedCartSegundoEmailHtml } from "../email-templates"

describe("Piezas disponibles de una oferta", () => {
  const nivel = (stocked: number, reserved = 0) => ({ stocked_quantity: stocked, reserved_quantity: reserved })
  it("existencias menos apartadas, entre lo que se ocupa por pieza", () => {
    expect(disponiblesOferta({ inventory_item_link: [{ required_quantity: 1, inventory_item: { location_levels: [nivel(5, 2), nivel(3)] } }] })).toBe(6)
    expect(disponiblesOferta({ inventory_item_link: [{ required_quantity: 2, inventory_item: { location_levels: [nivel(5)] } }] })).toBe(2)
    expect(disponiblesOferta({ inventory_item_link: [{ required_quantity: 1, inventory_item: { location_levels: [nivel(1, 3)] } }] })).toBe(0)
  })
  it("sin inventario ligado, sin manejar inventario o con pedido sin existencias: se puede comprar", () => {
    expect(disponiblesOferta({ inventory_item_link: [] })).toBe(Infinity)
    expect(disponiblesOferta({ manage_inventory: false, inventory_item_link: [{ inventory_item: { location_levels: [nivel(0)] } }] })).toBe(Infinity)
    expect(disponiblesOferta({ allow_backorder: true, inventory_item_link: [{ inventory_item: { location_levels: [nivel(0)] } }] })).toBe(Infinity)
  })
})

describe("Correos de carrito abandonado", () => {
  const items = [
    { title: "Fresa <recta>", quantity: 2, thumbnail: "https://cdn.x/fresa.jpg", unit_price: 189, product_handle: "fresa-2f" },
    { title: "Aceite", quantity: 1 },
  ]
  it("primer correo: foto, liga a la ficha, precio por renglón y total en pesos", () => {
    const html = abandonedCartEmailHtml({ items, total: 698, currencyCode: "mxn", cartUrl: "https://hetnacnc.com/mx/cart" })
    expect(html).toContain('src="https://cdn.x/fresa.jpg"')
    expect(html).toContain("/mx/products/fresa-2f")
    expect(html).toContain("$378.00 MXN") // 2 × 189
    expect(html).toContain("Total: $698.00 MXN")
    expect(html).toContain("Fresa &lt;recta&gt;") // escapado
    expect(html).toContain("Aceite") // sin foto ni precio también sale
  })
  it("segundo correo: también con fotos y máximo 3 productos", () => {
    const html = abandonedCartSegundoEmailHtml({ items: [...items, ...items], cartUrl: "c", whatsappUrl: "w", cupon: "VUELVE10" })
    expect(html).toContain('src="https://cdn.x/fresa.jpg"')
    expect((html.match(/<tr>/g) || []).length).toBe(3)
    expect(html).toContain("VUELVE10")
  })
})
