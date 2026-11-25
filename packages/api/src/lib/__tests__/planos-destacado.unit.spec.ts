import { destacadoPlanosHasta, extenderDestacadoPlanos, leerRefDestacadoPlanos } from "../planos-destacado"

const ahora = Date.parse("2026-11-25T12:00:00Z")

describe("destacado en planos", () => {
  it("vigente sólo si no ha vencido", () => {
    expect(destacadoPlanosHasta({ metadata: { destacado_planos: { hasta: "2026-11-30T00:00:00Z" } } }, ahora)).toBe("2026-11-30T00:00:00.000Z")
    expect(destacadoPlanosHasta({ metadata: { destacado_planos: { hasta: "2026-11-20T00:00:00Z" } } }, ahora)).toBeNull()
    expect(destacadoPlanosHasta({ metadata: {} }, ahora)).toBeNull()
  })
  it("pagar suma 7 días a lo que queda", () => {
    expect(extenderDestacadoPlanos(null, ahora)).toBe("2026-12-02T12:00:00.000Z")
    expect(extenderDestacadoPlanos("2026-11-30T12:00:00.000Z", ahora)).toBe("2026-12-07T12:00:00.000Z")
  })
  it("sólo acepta referencias de planos", () => {
    expect(leerRefDestacadoPlanos("destplano:sel_123ABC:a1b2c3d4")).toBe("sel_123ABC")
    expect(leerRefDestacadoPlanos("destpago:sel_123ABC:a1b2c3d4")).toBeNull()
  })
})
