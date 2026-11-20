import { partesPuntaje, puntajeMedido } from "../reputacion-medida"

const base = { terminados: 10, terminados_pct: 100, calidad: 5, puntualidad_pct: 100, respuesta_horas: 2, reclamos: 0, reclamos_resueltos: 0 }

describe("puntaje del taller (pesos 19 nov 2026)", () => {
  it("un taller perfecto saca 100", () => {
    expect(puntajeMedido(base)).toBe(100)
  })
  it("los trabajos terminados cuentan por volumen hasta 10", () => {
    expect(partesPuntaje({ ...base, terminados: 5 }).terminados).toBe(0.5)
    expect(partesPuntaje({ ...base, terminados: 20, terminados_pct: 80 }).terminados).toBe(0.8)
  })
  it("responder lento baja puntos", () => {
    expect(partesPuntaje({ ...base, respuesta_horas: 72 }).respuesta).toBe(0)
    expect(puntajeMedido({ ...base, respuesta_horas: 72 })).toBe(90)
  })
  it("un reclamo abierto pesa más que uno resuelto", () => {
    const abierto = puntajeMedido({ ...base, reclamos: 2, reclamos_resueltos: 0 })!
    const resuelto = puntajeMedido({ ...base, reclamos: 2, reclamos_resueltos: 2 })!
    expect(resuelto).toBeGreaterThan(abierto)
  })
  it("si falta un dato, su peso se reparte", () => {
    // sin reseñas ni tiempo de respuesta: sólo terminados, puntualidad y reclamos
    expect(puntajeMedido({ ...base, calidad: null, respuesta_horas: null })).toBe(100)
    expect(puntajeMedido({ terminados: 0, terminados_pct: null, calidad: null, puntualidad_pct: null, reclamos: 0, reclamos_resueltos: 0 })).toBeNull()
  })
})
