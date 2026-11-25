import {
  datosPieza,
  destacadoHasta,
  extenderDestacado,
  gramosPieza,
  leerRefDestacado,
  MATERIALES_IMPRESION,
  ordenarOfertas,
  precioRecomendado,
  validarOferta,
} from "../impresion-bajo-pedido"

const pieza = { volumen_cm3: 40, medidas_mm: [42, 42, 120] as [number, number, number] }

describe("impresión 3D bajo pedido", () => {
  it("da precio recomendado para todos los materiales, más caro el de más costo", () => {
    for (const m of MATERIALES_IMPRESION) {
      const p = precioRecomendado(pieza, m.valor)
      expect(p).not.toBeNull()
      expect(p! % 10).toBe(0)
    }
    expect(precioRecomendado(pieza, "PLA-CF")!).toBeGreaterThan(precioRecomendado(pieza, "PLA")!)
    expect(precioRecomendado(pieza, "Madera")).toBeNull()
    // una pieza más grande cuesta más
    expect(precioRecomendado({ ...pieza, volumen_cm3: 200 }, "PLA")!).toBeGreaterThan(precioRecomendado(pieza, "PLA")!)
  })

  it("calcula gramos con la densidad del material", () => {
    expect(gramosPieza(40, "PLA")).toBe(Math.round(40 * 0.45 * 1.24))
    expect(gramosPieza(40, "ABS")).toBeLessThan(gramosPieza(40, "PLA"))
  })

  it("lee los datos de la pieza sólo si están completos", () => {
    expect(datosPieza({ metadata: { impresion: { volumen_cm3: 40, medidas_mm: [1, 2, 3] } } })).toEqual({ volumen_cm3: 40, medidas_mm: [1, 2, 3] })
    expect(datosPieza({ metadata: { impresion: { volumen_cm3: 0, medidas_mm: [1, 2, 3] } } })).toBeNull()
    expect(datosPieza({ metadata: {} })).toBeNull()
  })

  it("valida la oferta del taller", () => {
    const ok = validarOferta({ variant_id: "variant_01ABC", precio: "180.5", dias: 3, colores: "Negro, blanco, negro, ,Rojo" })
    expect(ok).toEqual({ variant_id: "variant_01ABC", activa: true, precio: 180.5, dias: 3, colores: ["Negro", "blanco", "Rojo"] })
    expect(() => validarOferta({ variant_id: "variant_01ABC", precio: 5, dias: 3, colores: "Negro" })).toThrow(/precio/)
    expect(() => validarOferta({ variant_id: "variant_01ABC", precio: 100, dias: 0, colores: "Negro" })).toThrow(/días/)
    expect(() => validarOferta({ variant_id: "variant_01ABC", precio: 100, dias: 3, colores: "" })).toThrow(/color/)
    expect(() => validarOferta({ variant_id: "x", precio: 100, dias: 3, colores: "Negro" })).toThrow(/material/)
    // quitar una oferta no pide precio
    expect(validarOferta({ variant_id: "variant_01ABC", activa: false }).activa).toBe(false)
  })

  it("ordena: destacados primero, luego precio, luego días", () => {
    const l = ordenarOfertas([
      { id: "a", destacado: false, precio: 100, dias: 2 },
      { id: "b", destacado: true, precio: 150, dias: 5 },
      { id: "c", destacado: false, precio: 100, dias: 1 },
      { id: "d", destacado: false, precio: 90, dias: 9 },
    ])
    expect(l.map((x) => x.id)).toEqual(["b", "d", "c", "a"])
  })

  it("destacado: vigencia y suma de 30 días", () => {
    const ahora = Date.parse("2026-11-25T12:00:00Z")
    expect(destacadoHasta({ metadata: { destacado_impresion: { hasta: "2026-12-01T00:00:00Z" } } }, ahora)).toBe("2026-12-01T00:00:00.000Z")
    expect(destacadoHasta({ metadata: { destacado_impresion: { hasta: "2026-11-01T00:00:00Z" } } }, ahora)).toBeNull()
    expect(destacadoHasta({}, ahora)).toBeNull()
    expect(extenderDestacado(null, ahora)).toBe("2026-12-25T12:00:00.000Z")
    // si aún está vigente, se suma al final
    expect(extenderDestacado("2026-12-01T00:00:00.000Z", ahora)).toBe("2026-12-31T00:00:00.000Z")
  })

  it("sólo acepta referencias de pago de destacado", () => {
    expect(leerRefDestacado("destpago:sel_01ABC:a1b2c3d4")).toBe("sel_01ABC")
    expect(leerRefDestacado("verifpago:sel_01ABC:a1b2c3d4")).toBeNull()
  })
})

describe("ubicacionPublica (ofertas de impresión)", () => {
  // import tardío: impresion-catalogo arrastra workflows de Medusa
  const { ubicacionPublica } = jest.requireActual("../impresion-catalogo")
  it("da sólo ciudad y estado del perfil, nunca el CP ni otros datos", () => {
    expect(ubicacionPublica({ perfil: { ciudad: " Puebla ", estado: "Puebla", cp: "72000", telefono: "222" } })).toEqual({ ciudad: "Puebla", estado: "Puebla" })
    expect(ubicacionPublica({ perfil: { ciudad: 5, estado: "" } })).toEqual({ ciudad: undefined, estado: undefined })
    expect(ubicacionPublica(null)).toEqual({ ciudad: undefined, estado: undefined })
  })
})
