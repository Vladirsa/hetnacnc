import { mediana } from "../reputacion-medida"

describe("tiempo de respuesta del taller", () => {
  it("usa la mediana para que un caso raro no lo arruine", () => {
    expect(mediana([])).toBeNull()
    expect(mediana([5])).toBe(5)
    expect(mediana([1, 2, 100])).toBe(2)
    expect(mediana([4, 1, 3, 2])).toBe(2.5)
  })
})

import { partesPuntaje } from "../reputacion-medida"
import { calidadTaller } from "../asignacion"

describe("puntos por contestar y por rapidez", () => {
  const base = { terminados: 0, terminados_pct: null, calidad: null, puntualidad_pct: null, reclamos: 0, reclamos_resueltos: 0 }

  it("la parte de respuesta promedia rapidez y tasa de respuesta", () => {
    expect(partesPuntaje({ ...base, respuesta_horas: 4, tasa_respuesta_pct: 100 }).respuesta).toBe(1)
    expect(partesPuntaje({ ...base, respuesta_horas: 4, tasa_respuesta_pct: 0 }).respuesta).toBe(0.5)
    expect(partesPuntaje({ ...base, tasa_respuesta_pct: 80 }).respuesta).toBe(0.8)
    expect(partesPuntaje({ ...base }).respuesta).toBeNull()
  })

  it("quien contesta y cotiza rápido se entera antes; quien ignora los avisos, después", () => {
    const rapido = calidadTaller({ medido: { respuesta_horas: 1, tasa_respuesta_pct: 90 } })
    const lento = calidadTaller({ medido: { respuesta_horas: 30, tasa_respuesta_pct: 60 } })
    const ignora = calidadTaller({ medido: { tasa_respuesta_pct: 10 } })
    expect(rapido).toBe(3)
    expect(rapido).toBeGreaterThan(lento)
    expect(ignora).toBe(-1)
    expect(calidadTaller({})).toBe(0)
  })
})
