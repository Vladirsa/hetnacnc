import { gruposColor, leerMaterial, precioRecomendado, gramosPieza } from "../impresion-bajo-pedido"

describe("variantes a dos colores", () => {
  it("lee el material base del nombre de la variante", () => {
    expect(leerMaterial("PLA · 2 colores")).toEqual({ base: "PLA", dosColores: true })
    expect(leerMaterial("PLA-CF")).toEqual({ base: "PLA-CF", dosColores: false })
  })
  it("recomienda +30 % y pesa lo mismo que a un color", () => {
    const p = { volumen_cm3: 12, medidas_mm: [50, 30, 5] as [number, number, number] }
    const uno = precioRecomendado(p, "PLA")!
    const dos = precioRecomendado(p, "PLA · 2 colores")!
    expect(uno).toBeGreaterThan(0)
    expect(dos).toBeGreaterThanOrEqual(uno * 1.3 - 10)
    expect(dos).toBeLessThanOrEqual(uno * 1.3 + 10)
    expect(gramosPieza(12, "ABS · 2 colores")).toBe(gramosPieza(12, "ABS"))
  })
  it("sólo acepta dos partes con nombre", () => {
    expect(gruposColor({ metadata: { grupos_color: ["Placa", "Letras"] } })).toEqual(["Placa", "Letras"])
    expect(gruposColor({ metadata: { grupos_color: ["Placa"] } })).toBeNull()
    expect(gruposColor({ metadata: { grupos_color: ["Placa", 3] } })).toBeNull()
    expect(gruposColor({ metadata: {} })).toBeNull()
  })
})
