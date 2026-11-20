import { precioDesglosado } from "../precio-instantaneo"

describe("precio desglosado", () => {
  it("las partidas suman el precio recomendado y hay precio por volumen", () => {
    for (const e of [
      { servicio: "laser_co2", material: "MDF/Madera (3-5mm)", ancho: 30, largo: 40, cantidad: 5 },
      { servicio: "router", material: "MDF 15mm", ancho: 60, largo: 120, cantidad: 2 },
      { servicio: "plasma", material: "Acero al carbón", calibre: "Placa (cal. 10 o más grueso)", ancho: 20, largo: 20, cantidad: 10 },
      { servicio: "impresion_3d", material: "PLA", calidad: "Pieza funcional", ancho: 5, largo: 5, alto: 5, cantidad: 1 },
    ]) {
      const r = precioDesglosado(e)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.precio.calculo.length).toBeGreaterThan(0)
      expect(Math.abs(r.precio.recomendado + r.precio.iva - r.precio.total)).toBeLessThan(0.05)
      expect(r.precio.por_volumen.some((v) => v.cantidad === e.cantidad)).toBe(true)
      expect(r.precio.minimo).toBeLessThanOrEqual(r.precio.recomendado)
    }
  })
  it("marca el cobro mínimo de plasma en pedidos chicos", () => {
    const r = precioDesglosado({ servicio: "plasma", material: "Acero al carbón", calibre: "Placa (cal. 10 o más grueso)", ancho: 5, largo: 5, cantidad: 1 })
    expect(r.ok && r.precio.aplica_minimo).toBe(true)
  })
  it("rechaza datos incompletos", () => {
    expect(precioDesglosado({ servicio: "laser_co2", ancho: 0, largo: 10, cantidad: 1 }).ok).toBe(false)
    expect(precioDesglosado({ servicio: "otro", ancho: 10, largo: 10, cantidad: 1 }).ok).toBe(false)
  })
})
