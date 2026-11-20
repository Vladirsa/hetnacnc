import { ErrorFicha, leerFicha, validarFicha } from "../ficha-extendida"

const base = { compatibilidad: [], videos: [], archivos: [], faq: [] }

describe("ficha técnica del producto", () => {
  it("guarda medidas, tolerancia, modelo de muestra y fotos subidas al sitio", () => {
    const f = validarFicha({
      ...base,
      medidas: "120 × 80 × 15 mm",
      tolerancia: "±0.1 mm",
      vista_previa: "https://hetnacnc.com/static/muestra.stl",
      fotos_fabricada: ["https://hetnacnc.com/static/pieza.jpg"],
    })
    expect(f.medidas).toBe("120 × 80 × 15 mm")
    expect(f.vista_previa).toContain("muestra.stl")
    expect(f.fotos_fabricada).toHaveLength(1)
  })
  it("no acepta modelos ni fotos de otros sitios", () => {
    expect(() => validarFicha({ ...base, vista_previa: "https://otro.com/a.stl" })).toThrow(ErrorFicha)
    expect(() => validarFicha({ ...base, vista_previa: "https://hetnacnc.com/a.pdf" })).toThrow(ErrorFicha)
    expect(() => validarFicha({ ...base, fotos_fabricada: ["https://otro.com/a.jpg"] })).toThrow(ErrorFicha)
  })
  it("un panel viejo que no manda los campos nuevos no los borra", () => {
    const f = validarFicha(base)
    expect(f.medidas).toBeUndefined()
    expect(f.fotos_fabricada).toBeUndefined()
  })
  it("lee lo guardado", () => {
    const f = leerFicha({ medidas: "10 mm", fotos_fabricada: ["https://hetnacnc.com/a.jpg"] })
    expect(f.medidas).toBe("10 mm")
    expect(f.fotos_fabricada).toEqual(["https://hetnacnc.com/a.jpg"])
  })
})
