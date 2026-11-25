import { CALIDADES, COLORES, HETNA_OFRECE, empaque, leerDatos, ligaMedidas, metadataDiseno, precioDiseno, precioFinal, skuDiseno } from "../disenos-listos"
import { join } from "path"

// Diseños listos (lib/disenos-listos.ts): precio por gramaje, SKU y metadata
describe("Diseños listos", () => {
  const datos = leerDatos(join(__dirname, "../../../../../apps/storefront/src/lib/disenos-listos/datos.json"))

  it("datos.json trae los diseños con medidas y volumen", () => {
    expect(datos.length).toBeGreaterThanOrEqual(10)
    for (const d of datos) {
      expect(d.medidas_mm.every((n) => n > 0)).toBe(true)
      expect(d.volumen_cm3).toBeGreaterThan(0)
    }
  })

  it("cada diseño tiene precio y gramos; la calidad alta cuesta más", () => {
    for (const d of datos) {
      const e = precioDiseno(d, "Estándar")!
      const a = precioDiseno(d, "Alta")!
      expect(e.precio).toBeGreaterThan(0)
      expect(e.precio % 5).toBe(0)
      expect(e.gramos).toBeGreaterThan(0)
      expect(a.precio).toBeGreaterThanOrEqual(e.precio)
    }
    // pieza grande pesa y cuesta más que la chica
    const chica = datos.find((d) => d.handle === "hetna-maceta-con-drenaje")!
    const grande = datos.find((d) => d.handle === "hetna-maceta-grande")!
    expect(precioDiseno(grande, "Estándar")!.gramos).toBeGreaterThan(precioDiseno(chica, "Estándar")!.gramos)
  })

  it("precio final con IVA redondeado a $5 hacia arriba", () => {
    expect(precioFinal(100)).toBe(120) // 116 → 120
    expect(precioFinal(150)).toBe(175) // 174 → 175
  })

  it("SKU único por color y calidad, sin acentos", () => {
    const skus = COLORES.flatMap((c) => CALIDADES.map((q) => skuDiseno("hetna-posavasos", c, q)))
    expect(new Set(skus).size).toBe(COLORES.length * CALIDADES.length)
    expect(skuDiseno("hetna-posavasos", "Negro", "Estándar")).toBe("DL-POSAVASOS-NEG-EST")
  })

  it("empaque en kg y cm, metadata para la ficha y liga a la herramienta", () => {
    const d = datos[0]
    const caja = empaque(d, 120)
    expect(caja.weight).toBeCloseTo(0.24, 2)
    expect(caja.length).toBeGreaterThan(2)
    const m = metadataDiseno(d, 120, 299)
    expect(m).toMatchObject({ diseno_listo: true, tipo_producto: "a_medida", gramos: 120, precio_recomendado: 299, hetna_ofrece: `${HETNA_OFRECE.color} · ${HETNA_OFRECE.calidad}` })
    expect(m.medidas_url).toMatch(/^\/disenar\/modelos-3d\?modelo=/)
    expect(ligaMedidas({ herramienta: "modelos-3d", modelo: "maceta", valores: { alto: 140 } })).toBe("/disenar/modelos-3d?modelo=maceta&alto=140")
  })
})
