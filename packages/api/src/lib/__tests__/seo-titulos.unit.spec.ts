jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
jest.mock("../social-hub", () => ({ iaSocial: () => false }))
jest.mock("../../modules/cam/catalog", () => ({ camSellerHandle: () => "hetna" }))

import { recortar, semillas, tocaRevisar } from "../seo-titulos"

describe("agente SEO", () => {
  it("semillas sin medidas ni SKU", () => {
    const s = semillas("Letrero de MDF 30x20 cm Bienvenidos HCNC-S-261118-AB12", "Letreros")
    expect(s[0]).toBe("letrero mdf bienvenidos")
    expect(s).toContain("letreros")
    expect(s.join(" ")).not.toMatch(/hcnc/)
  })
  it("recorta sin partir palabras", () => {
    const t = recortar("Celosía decorativa de MDF para pared con diseño geométrico moderno y elegante", 40)
    expect(t.length).toBeLessThanOrEqual(40)
    expect(t.endsWith(" ")).toBe(false)
    expect("Celosía decorativa de MDF para pared con diseño").toContain(t)
  })
  it("revisa cada 60 días", () => {
    const ahora = new Date("2026-11-20T00:00:00Z")
    expect(tocaRevisar({}, ahora)).toBe(true)
    expect(tocaRevisar({ seo_revisado: "2026-11-01T00:00:00Z" }, ahora)).toBe(false)
    expect(tocaRevisar({ seo_revisado: "2026-09-01T00:00:00Z" }, ahora)).toBe(true)
  })
})

describe("sinMarca", () => {
  const { sinMarca } = require("../seo-titulos")
  it("quita la marca al final, que la tienda ya agrega", () => {
    expect(sinMarca("Programa CAM 3 ejes | HETNA CNC")).toBe("Programa CAM 3 ejes")
    expect(sinMarca("Revisión CAM: sujeción | HETNA")).toBe("Revisión CAM: sujeción")
    expect(sinMarca("Tabla de pino - HETNA CNC")).toBe("Tabla de pino")
    expect(sinMarca("HETNA CNC en Chile: talleres")).toBe("HETNA CNC en Chile: talleres")
  })
})
