// Pruebas de la propuesta formal y la comparación (Licitaciones 3.0, Fase 2).
import { compararPropuestas, huellaPropuestas, leerPropuestaFormal, omisiones, type PropuestaComparable } from "../licitacion-propuesta"

const base = (o: Partial<PropuestaComparable> = {}): PropuestaComparable => ({
  id: "p1", taller: "Taller A", precio: 1000, moneda: "MXN", dias: 5, incluye_envio: true,
  materiales: "Acero", operaciones: "Corte", fecha_entrega: "2026-12-01", condiciones_pago: "50/50", garantia: "30 días",
  ...o,
})

describe("leerPropuestaFormal", () => {
  it("valida moneda y fecha, y oculta contacto", () => {
    const f = leerPropuestaFormal({ moneda: "eur", fecha_entrega: "mañana", garantia: "llama al 5512345678" }, (s) => s.replace(/\d{8,}/g, "[oculto]"))
    expect(f.moneda).toBe("MXN")
    expect(f.fecha_entrega).toBeNull()
    expect(f.garantia).toBe("llama al [oculto]")
    expect(leerPropuestaFormal({ moneda: "usd", fecha_entrega: "2026-12-01" }, (s) => s).moneda).toBe("USD")
  })
})

describe("omisiones", () => {
  it("una propuesta completa no tiene omisiones", () => {
    expect(omisiones(base())).toEqual([])
  })
  it("detecta garantía, pago, material, procesos, fecha y envío", () => {
    expect(omisiones(base({ garantia: "", condiciones_pago: "", materiales: "", operaciones: "", fecha_entrega: null, incluye_envio: false })).length).toBe(6)
  })
})

describe("compararPropuestas", () => {
  it("marca precios muy bajos o altos contra la mediana, la más rápida y la moneda distinta", () => {
    const r = compararPropuestas([
      base({ id: "a", precio: 500, dias: 3 }),
      base({ id: "b", precio: 1000, dias: 5 }),
      base({ id: "c", precio: 1600, dias: 7 }),
      base({ id: "d", precio: 80, moneda: "USD", dias: 6 }),
    ])
    const notas = Object.fromEntries(r.notas.map((n) => [n.id, n.notas.join(" ")]))
    expect(notas.a).toMatch(/abajo de la mediana/)
    expect(notas.a).toMatch(/más rápida/)
    expect(notas.c).toMatch(/arriba de la mediana/)
    expect(notas.d).toMatch(/USD/)
  })
  it("la huella cambia si cambia el precio", () => {
    expect(huellaPropuestas([base()])).not.toBe(huellaPropuestas([base({ precio: 1200 })]))
  })
})
