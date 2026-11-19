import { mediana } from "../reputacion-medida"

describe("tiempo de respuesta del taller", () => {
  it("usa la mediana para que un caso raro no lo arruine", () => {
    expect(mediana([])).toBeNull()
    expect(mediana([5])).toBe(5)
    expect(mediana([1, 2, 100])).toBe(2)
    expect(mediana([4, 1, 3, 2])).toBe(2.5)
  })
})
