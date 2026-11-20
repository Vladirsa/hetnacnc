jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
jest.mock("../resend", () => ({ sendEmail: jest.fn() }))

import { correoSeguimiento, ligaSolicitud, tocaSeguimiento } from "../estimados"

describe("reactivador de estimados", () => {
  const base = new Date("2026-11-10T12:00:00Z")
  const e = { toques: 0, created_at: base, servicio: "Corte láser CO2", material: "MDF 3 mm", largo: 30, ancho: 20, cantidad: 10, estimado_min: 450, estimado_max: 700, nombre: "Ana López", email: "a@b.mx" }

  it("toca a los 2 y a los 7 días, nunca más", () => {
    expect(tocaSeguimiento(e, new Date("2026-11-11T12:00:00Z"))).toBeNull()
    expect(tocaSeguimiento(e, new Date("2026-11-12T12:00:00Z"))).toBe(0)
    expect(tocaSeguimiento({ ...e, toques: 1 }, new Date("2026-11-14T12:00:00Z"))).toBeNull()
    expect(tocaSeguimiento({ ...e, toques: 1 }, new Date("2026-11-17T12:00:00Z"))).toBe(1)
    expect(tocaSeguimiento({ ...e, toques: 2 }, new Date("2026-11-20T12:00:00Z"))).toBeNull()
    expect(tocaSeguimiento({ ...e, cerrado: "solicitud" }, new Date("2026-11-12T12:00:00Z"))).toBeNull()
    expect(tocaSeguimiento(e, new Date("2026-12-10T12:00:00Z"))).toBeNull()
  })

  it("la liga lleva la pieza ya capturada", () => {
    const l = ligaSolicitud(e, 0)
    expect(l).toContain("/mx/cotizar?")
    expect(new URL(l).searchParams.get("pieza")).toBe("Corte láser CO2 en MDF 3 mm")
    expect(l).toContain("utm_campaign=estimado_t1")
  })

  it("los dos correos", () => {
    expect(correoSeguimiento(e, 0).asunto).toMatch(/fabricar/)
    expect(correoSeguimiento(e, 0).html).toContain("$450")
    expect(correoSeguimiento(e, 1).html).toContain("wa.me/")
  })
})
