import { medianaHoras, puntualidadRed } from "../tablero-estrategia"

describe("tablero de la estrategia", () => {
  it("mediana de horas", () => {
    expect(medianaHoras([])).toBeNull()
    expect(medianaHoras([1, 10, 2])).toBe(2)
  })
  it("puntualidad de la red ponderada por entregas", () => {
    expect(puntualidadRed([{}, { medido: { con_fecha: 0, puntualidad_pct: 10 } }]).pct).toBeNull()
    const r = puntualidadRed([{ medido: { con_fecha: 9, puntualidad_pct: 100 } }, { medido: { con_fecha: 1, puntualidad_pct: 0 } }])
    expect(r).toEqual({ pct: 90, entregas: 10 })
  })
})
