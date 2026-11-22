import { perfilValido } from "../../api/store/envio-perfil/middlewares"
import { origenDe, renglonesDelTaller } from "../../modules/skydropx/service"
import { esPerfilDigital, renglonesPorMarcar } from "../envio-digital"

const opts = { origenCp: "72000", origenEstado: "Puebla" }

describe("Envío por taller", () => {
  it("cotiza sólo con los renglones del taller de la opción", () => {
    const context = {
      items: [{ id: "a" }, { id: "b" }, { id: "c" }],
      from_location: { id: "loc1" },
      hetna_renglones_por_almacen: { loc1: ["a", "c"], loc2: ["b"] },
    }
    expect(renglonesDelTaller(context).map((i) => i.id)).toEqual(["a", "c"])
    // Sin el mapa (o almacén desconocido) se usan todos, como antes
    expect(renglonesDelTaller({ items: [{ id: "a" }] }).length).toBe(1)
    expect(renglonesDelTaller({ ...context, from_location: { id: "otro" } }).length).toBe(3)
  })

  it("cotiza desde la dirección del taller y, si no tiene C.P., desde HETNA", () => {
    expect(origenDe({ from_location: { id: "l", address: { postal_code: "06600" } }, hetna_origen_por_almacen: { l: { postal_code: "64000", province: "NL" } } }, opts)).toEqual({ cp: "64000", estado: "NL", ciudad: undefined, colonia: undefined })
    expect(origenDe({ from_location: { id: "l", address: { postal_code: "06600", city: "CDMX" } } }, opts).cp).toBe("06600")
    expect(origenDe({ from_location: { id: "l", address: { postal_code: "" } } }, opts)).toEqual({ cp: "72000", estado: "Puebla", ciudad: undefined, colonia: undefined })
  })
})

describe("Físico + digital del mismo taller", () => {
  const digitales = new Set(["dig"])
  const ofertas = [
    { seller_id: "s1", shipping_profile_id: "fis" },
    { seller_id: "s1", shipping_profile_id: "dig" },
  ]
  it("con un físico en el carrito sólo se acepta envío físico", () => {
    expect(perfilValido({ shipping_profile_id: "dig", seller_ids: ["s1"] }, ofertas, digitales)).toBe(false)
    expect(perfilValido({ shipping_profile_id: "fis", seller_ids: ["s1"] }, ofertas, digitales)).toBe(true)
  })
  it("si sólo hay digitales, la entrega digital sí", () => {
    expect(perfilValido({ shipping_profile_id: "dig", seller_ids: ["s1"] }, [ofertas[1]], digitales)).toBe(true)
  })
  it("los renglones digitales se marcan como 'no requiere envío'", () => {
    const renglones = [
      { id: "r1", requires_shipping: true, offer: { shipping_profile_id: "fis" } },
      { id: "r2", requires_shipping: true, offer: { shipping_profile_id: "dig" } },
      { id: "r3", requires_shipping: false, offer: { shipping_profile_id: "dig" } },
      { id: "r4", requires_shipping: true, offer: [{ shipping_profile_id: "dig" }] },
    ]
    expect(renglonesPorMarcar(renglones, digitales)).toEqual(["r2", "r4"])
  })
  it("reconoce el perfil digital por tipo o por nombre", () => {
    expect(esPerfilDigital({ id: "1", type: "digital" })).toBe(true)
    expect(esPerfilDigital({ id: "2", name: "Producto digital" })).toBe(true)
    expect(esPerfilDigital({ id: "3", name: "Marketplace Shipping", type: "default" })).toBe(false)
  })
})
