import { MATERIALES, materialDelCotizador } from "../materiales-precios"
import { conPrecioDeMercado, precioInstantaneo } from "../precio-instantaneo"

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
  it("el precio de mercado reemplaza al de referencia en el estimador", () => {
    const base = { servicio: "router", material: "MDF 15mm", ancho: 50, largo: 100, cantidad: 2 }
    const ref = precioInstantaneo(base) as any
    const caro = precioInstantaneo({ ...base, precio_material: { nombre: "MDF 15 mm", precio_m2: 900 } }) as any
    const barato = precioInstantaneo({ ...base, precio_material: { nombre: "MDF 15 mm", precio_m2: 50 } }) as any
    expect(caro.resultado.pvRecomendado).toBeGreaterThan(ref.resultado.pvRecomendado)
    expect(barato.resultado.pvRecomendado).toBeLessThan(ref.resultado.pvRecomendado)
  })
  it("hoja → precio por hoja del material; kg → precio por kg", () => {
    const hoja = { clave: "mdf", nombre: "MDF 15 mm", espesor: 15, precio: 530, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 } as any
    expect(conPrecioDeMercado(hoja, { precio_m2: 160 }).precio).toBe(Math.round(160 * 1.22 * 2.44))
    const kg = { clave: "acero", nombre: "Acero", espesor: 1.9, precio: 34, unidad: "kg", densidad: 7.85, merma: 15 } as any
    expect(conPrecioDeMercado(kg, { precio_kg: 41.5 }).precio).toBe(41.5)
    expect(conPrecioDeMercado(kg, null).precio).toBe(34)
  })
})
