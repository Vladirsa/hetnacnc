import { textoCampana } from "../latam-campana"

describe("campaña de pre-registro en Latinoamérica", () => {
  it("turna 3 enfoques y respeta la forma de hablar de cada país", () => {
    const co = [0, 1, 2].map((s) => textoCampana("co", s)!)
    expect(new Set(co.map((t) => t.titulo)).size).toBe(3)
    expect(co[0].texto).toMatch(/Cotizador para talleres ya funciona en Colombia/)
    expect(co[0].url).toMatch(/\/mx\/latinoamerica\/co\?/)
    const ar = textoCampana("ar", 0)!
    expect(ar.texto).toMatch(/Tenés/)
    expect(ar.texto).not.toMatch(/Cotizador para talleres ya funciona/)
    expect(textoCampana("ar", 1)!.texto).toMatch(/Necesitás.*subís/)
  })
  it("sólo países con campaña", () => {
    expect(textoCampana("br", 0)).toBeNull()
    expect(textoCampana("mx", 0)).toBeNull()
  })
})
