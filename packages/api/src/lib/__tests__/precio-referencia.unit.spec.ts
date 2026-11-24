import { precioInstantaneo } from "../precio-instantaneo"
import { estimar, MATERIALES, piezaAMano } from "../estimador-referencia"

// Mismos resultados que la calculadora de /cotizar (apps/storefront/src/lib/cotizador/estimador.ts).
// Si cambias el estimador en un lado, cambia el otro y actualiza estos números.
describe("precio de referencia igual al de /cotizar", () => {
  const total = (e: any) => {
    const r = precioInstantaneo(e)
    if (!r.ok) throw new Error(r.mensaje)
    return r.resultado.pvRecomendado
  }
  it("láser, router e impresión 3D", () => {
    expect(total({ servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 5, largo: 3, cantidad: 50 })).toBe(315)
    expect(total({ servicio: "router", material: "MDF 18mm", ancho: 60, largo: 40, cantidad: 1 })).toBe(250)
    expect(total({ servicio: "impresion_3d", material: "PLA", calidad: "Pieza funcional", ancho: 5, largo: 5, alto: 5, cantidad: 1 })).toBe(280)
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
  it("el margen no se cobra otra vez sobre el material (21 nov 2026)", () => {
    // Subir el acero $10/kg debe subir el precio sólo lo que cuesta el material
    // con su merma (15 %) y recargo (20 %), no además dividido entre (1 − margen).
    const e = { servicio: "plasma", material: "Acero al carbón", calibre: "Placa (cal. 10 o más grueso)", ancho: 20, largo: 20, cantidad: 10 }
    const base = precioInstantaneo(e as any)
    const caro = precioInstantaneo(e as any, { preciosMaterial: { 'Acero 6 mm (1/4")': 44 } })
    if (!base.ok || !caro.ok) throw new Error("sin precio")
    const kg = base.estimado.gramos / 1000
    const diff = caro.resultado.pvRecomendado - base.resultado.pvRecomendado
    expect(Math.abs(diff - kg * 10 * 1.15 * 1.2)).toBeLessThanOrEqual(5)
  })

  it("50 piezas chicas no cuentan 50 minutos de manejo", () => {
    const llaveros = total({ servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 5, largo: 5, cantidad: 50 })
    expect(llaveros).toBeLessThan(450)
  })
  it("pedido mínimo de $150, y 0 lo quita", () => {
    const chico = { servicio: "laser_co2", material: "MDF delgado (hasta 2.5mm)", ancho: 3, largo: 3, cantidad: 1 }
    const r = precioInstantaneo(chico as any)
    if (!r.ok) throw new Error(r.mensaje)
    expect(r.resultado.pvRecomendado).toBe(150)
    expect(r.resultado.pvMinimo).toBeGreaterThanOrEqual(150)
    const sin = precioInstantaneo(chico as any, { pedidoMinimo: 0 })
    if (!sin.ok) throw new Error(sin.mensaje)
    expect(sin.resultado.pvRecomendado).toBeLessThan(150)
  })
  it("maderas sólidas en router: se cotizan por tabla y un panel ancho se arma con tiras (23 nov 2026)", () => {
    const pino = MATERIALES.find((m) => m.nombre === "Pino 19 mm (tabla)")!
    const encino = MATERIALES.find((m) => m.nombre === "Encino 19 mm (tabla)")!
    const chica = estimar({ servicio: "router", pieza: piezaAMano(250, 150, 0, "normal", false), material: pino, cantidad: 10 })
    if (!chica.ok) throw new Error(chica.motivo)
    expect(chica.total).toBeGreaterThan(300)
    const panel = estimar({ servicio: "router", pieza: piezaAMano(600, 400, 0, "normal", false), material: pino, cantidad: 1 })
    if (!panel.ok) throw new Error(panel.motivo)
    expect(panel.avisos.join(" ")).toMatch(/pega 2 tiras/)
    const caro = estimar({ servicio: "router", pieza: piezaAMano(600, 400, 0, "normal", false), material: encino, cantidad: 1 })
    if (!caro.ok) throw new Error(caro.motivo)
    expect(caro.total).toBeGreaterThan(panel.total)
  })
})
