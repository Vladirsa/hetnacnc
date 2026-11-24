// Mandar la cotización por correo (lib/cotizador-correo.ts): validaciones,
// tope por taller y el HTML (sin HTML del usuario).
import { POR_DIA_GRATIS, POR_HORA, correoValido, esGratis, esPdf, htmlCorreo, revisarTope } from "../cotizador-correo"

describe("cotizador-correo", () => {
  it("valida correos", () => {
    expect(correoValido("compras@ejemplo.com")).toBe(true)
    expect(correoValido("a@b")).toBe(false)
    expect(correoValido("uno@a.com, dos@b.com")).toBe(false)
    expect(correoValido("x<y>@a.com")).toBe(false)
  })

  it("reconoce un PDF por su inicio", () => {
    expect(esPdf(Buffer.from("%PDF-1.7\n..."))).toBe(true)
    expect(esPdf(Buffer.from("<html>"))).toBe(false)
    expect(esPdf(undefined)).toBe(false)
  })

  it("plan gratis: también con la prueba vencida", () => {
    const ahora = new Date("2026-11-24T12:00:00Z")
    expect(esGratis("gratis")).toBe(true)
    expect(esGratis("taller")).toBe(false)
    expect(esGratis("prueba", "2026-12-01", ahora)).toBe(false)
    expect(esGratis("prueba", "2026-11-01", ahora)).toBe(true)
  })

  it("tope: Gratis 10 al día; 20 por hora para todos", () => {
    const m = new Map<string, number[]>()
    const t = Date.parse("2026-11-24T12:00:00Z")
    for (let i = 0; i < POR_DIA_GRATIS; i++) expect(revisarTope("g", true, t + i * 400_000, m)).toBeNull()
    expect(revisarTope("g", true, t + 4_000_001, m)).toMatch(/plan Gratis/)
    const m2 = new Map<string, number[]>()
    for (let i = 0; i < POR_HORA; i++) expect(revisarTope("p", false, t + i, m2)).toBeNull()
    expect(revisarTope("p", false, t + 100, m2)).toMatch(/última hora/)
    // Una hora después ya puede
    expect(revisarTope("p", false, t + 3_600_001, m2)).toBeNull()
  })

  it("el mensaje se escapa y lleva el botón de la liga", () => {
    const html = htmlCorreo({
      taller: "Taller <b>X</b>",
      mensaje: "Hola <script>alert(1)</script>\nlínea 2\n\nOtro párrafo",
      liga: "https://hetnacnc.com/c/abcDEF1234567890",
      folio: "COT-1",
      gratis: true,
    })
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("Taller &lt;b&gt;X&lt;/b&gt;")
    expect(html).toContain("línea 2")
    expect(html).toContain("Ver y aceptar la cotización en línea")
    expect(html).toContain("Cotizador gratis")
    expect(htmlCorreo({ taller: "T", mensaje: "m", folio: "F", gratis: false })).not.toContain("Cotizador gratis")
  })
})
