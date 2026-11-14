import { calcularEstimado, catalogoEstimado } from "../whatsapp-estimado"

const base = { pedir: true, servicio: "laser_co2", material: "MDF 6 mm", largo_mm: 100, ancho_mm: 150, alto_mm: 0, cantidad: 50, complejidad: "normal" }

describe("estimado por WhatsApp", () => {
  it("da un rango con el precio armado por el código", () => {
    const r = calcularEstimado(base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.min).toBeGreaterThan(0)
    expect(r.max).toBeGreaterThan(r.min)
    expect(r.texto).toContain("50 piezas de 100×150 mm en MDF 6 mm")
    expect(r.texto).toContain("/mx/cotizar")
  })

  it("acepta el nombre del material sin acentos ni mayúsculas", () => {
    expect(calcularEstimado({ ...base, material: "mdf 6 MM" }).ok).toBe(true)
  })

  it("no inventa: material que no corresponde al servicio pide plano", () => {
    const r = calcularEstimado({ ...base, servicio: "plasma", material: "MDF 6 mm" })
    expect(r.ok).toBe(false)
    expect(r.texto).toContain("/mx/cotizar")
  })

  it("rechaza medidas o cantidades fuera de rango", () => {
    expect(calcularEstimado({ ...base, largo_mm: 0 }).ok).toBe(false)
    expect(calcularEstimado({ ...base, cantidad: 50000 }).ok).toBe(false)
  })

  it("impresión 3D necesita alto", () => {
    expect(calcularEstimado({ ...base, servicio: "impresora_3d", material: "PLA", alto_mm: 0 }).ok).toBe(false)
    expect(calcularEstimado({ ...base, servicio: "impresora_3d", material: "PLA", alto_mm: 20, cantidad: 2 }).ok).toBe(true)
  })

  it("el catálogo lista servicios con sus materiales", () => {
    expect(catalogoEstimado()).toContain("laser_co2")
    expect(catalogoEstimado()).toContain("MDF 6 mm")
  })
})
