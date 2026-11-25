import { MAX_TEXTO, revisarTexto } from "../../api/store/carts/texto-personalizado"

describe("texto del cliente en productos personalizables", () => {
  const llavero = { personalizable: true, max: 20 }
  it("exige el texto en un producto personalizable", () => {
    expect(revisarTexto({}, llavero)).toMatch(/Escribe/)
    expect(revisarTexto({ texto: "   " }, llavero)).toMatch(/Escribe/)
    expect(revisarTexto(undefined, llavero)).toMatch(/Escribe/)
  })
  it("limpia espacios y controles, y respeta el máximo del producto", () => {
    const m: Record<string, unknown> = { texto: "  Valen\ttina  " }
    expect(revisarTexto(m, llavero)).toBeNull()
    expect(m.texto).toBe("Valen tina")
    expect(revisarTexto({ texto: "x".repeat(21) }, llavero)).toMatch(/hasta 20/)
    expect(revisarTexto({ texto: "x".repeat(MAX_TEXTO + 1) }, null)).toMatch(new RegExp(`hasta ${MAX_TEXTO}`))
  })
  it("rechaza texto que no es cadena y deja pasar productos normales sin texto", () => {
    expect(revisarTexto({ texto: { a: 1 } }, llavero)).toMatch(/no es válido/)
    expect(revisarTexto({ color: "Negro" }, { personalizable: false, max: 40 })).toBeNull()
    expect(revisarTexto({ color: "Negro" }, null)).toBeNull()
  })
})
