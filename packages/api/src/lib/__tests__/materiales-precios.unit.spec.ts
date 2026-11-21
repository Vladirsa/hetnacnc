import { MATERIALES, materialDelCotizador } from "../materiales-precios"
import { precioInstantaneo } from "../precio-instantaneo"

describe("base de precios de materiales", () => {
  it("claves únicas y medidas de hoja", () => {
    const claves = MATERIALES.map((m) => m.clave)
    expect(new Set(claves).size).toBe(claves.length)
    expect(MATERIALES.filter((m) => m.unidad === "hoja").every((m) => m.ancho_m && m.largo_m)).toBe(true)
    expect(MATERIALES.length).toBeGreaterThan(35)
  })
  it("traduce lo que elige el cliente en /cotizar", () => {
    expect(materialDelCotizador("router", "MDF 15mm")).toBe("mdf_15")
    expect(materialDelCotizador("laser_co2", "MDF delgado (hasta 2.5mm)")).toBe("mdf_3")
    expect(materialDelCotizador("plasma", "Acero inoxidable", "Placa (cal. 10 o más grueso)")).toBe("inox_cal14")
    expect(materialDelCotizador("plasma", "Acero al carbón", "Lámina delgada (cal. 20 a 12)")).toBe("negra_cal14")
    expect(materialDelCotizador("impresion_3d", "PETG")).toBe("petg_1kg")
  })
  it("el precio al instante suma el material cuando hay dato", () => {
    const base = { servicio: "router", material: "MDF 15mm", ancho: 50, largo: 100, cantidad: 2 }
    const sin = precioInstantaneo(base) as any
    const con = precioInstantaneo({ ...base, precio_material: { nombre: "MDF 15 mm", precio_m2: 160 } }) as any
    expect(con.resultado.cm).toBeCloseTo(0.5 * 160 * 2 * 1.15, 1)
    expect(con.resultado.pvRecomendado).toBeGreaterThan(sin.resultado.pvRecomendado)
    expect(sin.resultado.cm).toBe(0)
  })
})
