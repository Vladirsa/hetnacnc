import { armarItem, elegibilidad, leerStateML, limpiarDescripcion, stateParaTaller, tituloML } from "../mercadolibre"

const oferta = (extra: Record<string, any> = {}) => ({
  id: "of_1",
  product_id: "prod_1",
  seller_id: "sel_1",
  shipping_profile_id: "sp_fisico",
  manage_inventory: true,
  allow_backorder: false,
  prices: [{ amount: 350, currency_code: "mxn" }],
  inventory_item_link: [{ required_quantity: 1, inventory_item: { location_levels: [{ stocked_quantity: 7, reserved_quantity: 2 }] } }],
  ...extra,
})
const producto = (extra: Record<string, any> = {}) => ({ id: "prod_1", title: "Fresa compresión 1/8", status: "published", thumbnail: "/static/f.jpg", metadata: {}, ...extra })
const digitales = new Set(["sp_digital"])

describe("mercadolibre", () => {
  const antes = process.env.OAUTH_STATE_SECRET
  beforeAll(() => { process.env.OAUTH_STATE_SECRET = "secreto-de-prueba" })
  afterAll(() => { process.env.OAUTH_STATE_SECRET = antes })

  it("firma y lee el state; rechaza alterado o vencido", () => {
    const s = stateParaTaller("sel_ABC", 1_000_000)
    expect(leerStateML(s, 1_000_000 + 60_000)).toBe("sel_ABC")
    expect(leerStateML(s.replace("sel_ABC", "sel_XYZ"), 1_000_000)).toBeNull()
    expect(leerStateML(s, 1_000_000 + 31 * 60_000)).toBeNull()
    expect(leerStateML("basura", 1_000_000)).toBeNull()
  })

  it("elegibilidad: precio y existencias reales del taller", () => {
    expect(elegibilidad(producto(), oferta(), digitales)).toEqual({ ok: true, precio: 350, existencia: 5 })
  })

  it("elegibilidad: fuera digitales, servicios, bajo pedido, sin control de inventario y sin existencias", () => {
    expect(elegibilidad(producto({ metadata: { producto_digital: true } }), oferta(), digitales).ok).toBe(false)
    expect(elegibilidad(producto({ metadata: { tipo_producto: "servicio" } }), oferta(), digitales).ok).toBe(false)
    expect(elegibilidad(producto({ metadata: { tipo_producto: "a_medida" } }), oferta(), digitales).ok).toBe(false)
    expect(elegibilidad(producto(), oferta({ shipping_profile_id: "sp_digital" }), digitales).ok).toBe(false)
    expect(elegibilidad(producto(), oferta({ manage_inventory: false }), digitales).ok).toBe(false)
    expect(elegibilidad(producto(), oferta({ inventory_item_link: [{ required_quantity: 1, inventory_item: { location_levels: [{ stocked_quantity: 1, reserved_quantity: 1 }] } }] }), digitales).ok).toBe(false)
    expect(elegibilidad(producto({ thumbnail: null, images: [] }), oferta(), digitales).ok).toBe(false)
    expect(elegibilidad(producto(), undefined, digitales).ok).toBe(false)
  })

  it("título sin símbolos y cortado en palabra completa", () => {
    expect(tituloML("¡Fresa *compresión* 1/8!")).toBe("Fresa compresión 1/8")
    const t = tituloML("Fresa de compresión dos filos carburo 1/8 para MDF triplay madera acrílico router CNC", 60)
    expect(t.length).toBeLessThanOrEqual(60)
    expect(t.endsWith(" ")).toBe(false)
    expect("Fresa de compresión dos filos carburo 1/8 para MDF triplay madera acrílico router CNC".startsWith(t)).toBe(true)
  })

  it("descripción sin HTML, ligas, correos, teléfonos ni WhatsApp", () => {
    const d = limpiarDescripcion(
      "<p>Fresa de <b>3.175 mm</b> para MDF.</p><ul><li>2 filos</li></ul><p>Más en https://hetnacnc.com/mx o www.otro.com</p><p>Correo: ventas@hetna.mx</p><p>WhatsApp: 221 707 6014</p><p>Llámanos al +52 221 707 6014 😀</p>"
    )
    expect(d).toContain("Fresa de 3.175 mm para MDF.")
    expect(d).toContain("- 2 filos")
    expect(d).not.toMatch(/https?:|www\.|@|707|WhatsApp|😀/i)
  })

  it("arma el item: title o family_name según el modelo del vendedor", () => {
    const b = { titulo: "Fresa 1/8", categoria_id: "MLM189732", precio: 350, existencia: 5, imagenes: ["https://x/a.jpg"], tipo_publicacion: "gold_special" as const, atributos: [{ id: "BRAND", value_name: "XCAN" }], user_products: false }
    const clasico = armarItem(b)
    expect(clasico).toMatchObject({ title: "Fresa 1/8", currency_id: "MXN", available_quantity: 5, buying_mode: "buy_it_now", condition: "new", listing_type_id: "gold_special" })
    expect(clasico.pictures).toEqual([{ source: "https://x/a.jpg" }])
    expect(clasico.attributes).toEqual([{ id: "ITEM_CONDITION", value_name: "Nuevo" }, { id: "BRAND", value_name: "XCAN" }])
    const up = armarItem({ ...b, user_products: true }) as any
    expect(up.family_name).toBe("Fresa 1/8")
    expect(up.title).toBeUndefined()
  })
})

describe("mercadolibre: descripción con medidas", () => {
  it("no borra listas de medidas cortas", () => {
    expect(limpiarDescripcion("Diámetros: 3.175 - 4 - 6 - 8 mm")).toBe("Diámetros: 3.175 - 4 - 6 - 8 mm")
    expect(limpiarDescripcion("Tablero 1220 x 2440 mm")).toBe("Tablero 1220 x 2440 mm")
  })
})
