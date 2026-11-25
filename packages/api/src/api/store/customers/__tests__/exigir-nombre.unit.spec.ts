import { nombreValido } from "../proteger-metadata"

describe("nombreValido (registro de clientes)", () => {
  it("acepta nombres reales, con acentos", () => {
    expect(nombreValido("José")).toBe(true)
    expect(nombreValido("  María Fernanda ")).toBe(true)
    expect(nombreValido("O'Connor")).toBe(true)
  })
  it("rechaza vacíos, sólo números, ligas y código", () => {
    expect(nombreValido("")).toBe(false)
    expect(nombreValido("   ")).toBe(false)
    expect(nombreValido(undefined)).toBe(false)
    expect(nombreValido("12345")).toBe(false)
    expect(nombreValido("visita https://spam.com")).toBe(false)
    expect(nombreValido("<script>")).toBe(false)
    expect(nombreValido("a".repeat(81))).toBe(false)
  })
})
