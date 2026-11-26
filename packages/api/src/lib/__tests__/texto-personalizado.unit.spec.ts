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

describe("colores por parte en piezas a dos colores", () => {
  const { revisarColores } = require("../../api/store/carts/texto-personalizado")
  const dos = { dosColores: true, grupos: ["Placa", "Letras"] as [string, string], colores: ["Negro", "Blanco", "Rojo"] }
  it("exige un color de la oferta para cada parte y lo deja con el nombre del taller", () => {
    const m: Record<string, unknown> = { colores: { Placa: " negro ", Letras: "Blanco" }, color: "Negro" }
    expect(revisarColores(m, dos)).toBeNull()
    expect(m.colores).toEqual({ Placa: "Negro", Letras: "Blanco" })
    expect(m.color).toBeUndefined()
  })
  it("rechaza colores que el taller no tiene, partes que faltan o que sobran", () => {
    expect(revisarColores({}, dos)).toMatch(/Elige el color de cada parte/)
    expect(revisarColores({ colores: { Placa: "Negro" } }, dos)).toMatch(/Letras/)
    expect(revisarColores({ colores: { Placa: "Verde", Letras: "Blanco" } }, dos)).toMatch(/Placa/)
    expect(revisarColores({ colores: { Placa: "Negro", Letras: "Blanco", Otra: "Rojo" } }, dos)).toMatch(/no corresponden/)
    expect(revisarColores({ colores: ["Negro", "Blanco"] }, dos)).toMatch(/Elige/)
    expect(revisarColores({ colores: { Placa: "Negro", Letras: "Blanco" } }, { ...dos, grupos: null })).toMatch(/no se vende/)
  })
  it("en las demás variantes quita los colores por parte", () => {
    const m: Record<string, unknown> = { colores: { Placa: "Negro" }, color: "Rojo" }
    expect(revisarColores(m, { ...dos, dosColores: false })).toBeNull()
    expect(m.colores).toBeUndefined()
    expect(m.color).toBe("Rojo")
    expect(revisarColores({ colores: { a: 1 } }, null)).toBeNull()
  })
})
