import { ligaRepetir, textoPedidos } from "../whatsapp-repetir"

describe("repetir pedido por WhatsApp", () => {
  const conCuenta = { folio: "HET-00012", token: "tok-abc", conCuenta: true, resumen: "Placa de acero · 200 piezas", fecha: "2026-10-02", taller: "Taller Uno" }
  const sinCuenta = { ...conCuenta, conCuenta: false }
  it("con cuenta va a Mis piezas; sin cuenta, a la solicitud prellenada", () => {
    expect(ligaRepetir(conCuenta)).toMatch(/\/mx\/user\/piezas\/HET-00012$/)
    expect(ligaRepetir(sinCuenta)).toMatch(/\/mx\/cotizar\?repite=tok-abc$/)
  })
  it("el texto para la IA no lleva tokens ni ligas", () => {
    const t = textoPedidos([conCuenta])
    expect(t).toMatch(/HET-00012/)
    expect(t).not.toMatch(/tok-abc|http/)
    expect(textoPedidos([])).toBe("")
  })
})
