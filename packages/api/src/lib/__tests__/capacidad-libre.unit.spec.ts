import { capacidadVigente, nuevaCapacidad } from "../capacidad-libre"

describe("capacidad libre del taller", () => {
  it("se activa con descuento acotado y vence sola", () => {
    const ahora = Date.parse("2026-11-21T12:00:00Z")
    const c = nuevaCapacidad({ activa: true, descuento_pct: 50, dias: 30, nota: "Router libre <b>" }, ahora)!
    expect(c.descuento_pct).toBe(30)
    expect(Date.parse(c.hasta) - ahora).toBeLessThanOrEqual(15 * 86_400_000)
    expect(c.nota).not.toMatch(/</)
    expect(capacidadVigente({ capacidad_libre: c }, ahora)).not.toBeNull()
    expect(capacidadVigente({ capacidad_libre: c }, Date.parse(c.hasta) + 1)).toBeNull()
  })
  it("apagar o datos raros dan null", () => {
    expect(nuevaCapacidad({ activa: false })).toBeNull()
    expect(capacidadVigente({ capacidad_libre: { hasta: "no" } })).toBeNull()
    expect(capacidadVigente({})).toBeNull()
  })
})
