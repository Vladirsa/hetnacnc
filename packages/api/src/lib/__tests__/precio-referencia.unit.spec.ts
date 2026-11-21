import { precioInstantaneo } from "../precio-instantaneo"

// Mismos resultados que la calculadora de /cotizar (apps/storefront/src/lib/cotizador/estimador.ts).
// Si cambias el estimador en un lado, cambia el otro y actualiza estos números.
describe("precio de referencia igual al de /cotizar", () => {
  const total = (e: any) => {
    const r = precioInstantaneo(e)
    if (!r.ok) throw new Error(r.mensaje)
    return r.resultado.pvRecomendado
  }
  it("láser, router e impresión 3D", () => {
    expect(total({ servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 5, largo: 3, cantidad: 50 })).toBe(535)
    expect(total({ servicio: "router", material: "MDF 18mm", ancho: 60, largo: 40, cantidad: 1 })).toBe(395)
    expect(total({ servicio: "impresion_3d", material: "PLA", calidad: "Pieza funcional", ancho: 5, largo: 5, alto: 5, cantidad: 1 })).toBe(290)
  })
  it("usa el volumen real del STL en vez de la caja", () => {
    const caja = total({ servicio: "impresion_3d", material: "PLA", ancho: 10, largo: 10, alto: 10, cantidad: 1 })
    const real = total({ servicio: "impresion_3d", material: "PLA", ancho: 10, largo: 10, alto: 10, cantidad: 1, volumen_cm3: 120 })
    expect(real).toBeLessThan(caja / 2)
  })
  it("usa los metros de corte reales del archivo", () => {
    const simple = total({ servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 30, largo: 30, cantidad: 1, corte_mm: 1200 })
    const calado = total({ servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 30, largo: 30, cantidad: 1, corte_mm: 12000 })
    expect(calado).toBeGreaterThan(simple)
  })
})
