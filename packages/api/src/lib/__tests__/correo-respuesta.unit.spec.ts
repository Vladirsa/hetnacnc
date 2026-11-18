import { cuerpoHtml, esLigaDeHetna, redactarRespuestaCorreo } from "../correo-respuesta"

describe("respuesta automática a correos de prospectos", () => {
  it("convierte el texto en párrafos con ligas y escapa HTML", () => {
    const h = cuerpoHtml("Hola <b>equipo</b>:\n\nRegístrense en https://hetnacnc.com/mx/talleres/unete.\nSaludos")
    expect(h).toContain("<p>Hola &lt;b&gt;equipo&lt;/b&gt;:</p>")
    expect(h).toContain('<a href="https://hetnacnc.com/mx/talleres/unete">https://hetnacnc.com/mx/talleres/unete</a>.')
    expect(h).toContain("<br>Saludos")
  })

  it("sólo vuelve liga las direcciones de hetnacnc.com; las demás quedan como texto", () => {
    const h = cuerpoHtml("Paga en https://evil.mx/pago o entra a https://cotizador.hetnacnc.com/x?a=1&b=2 y a http://hetnacnc.com/mx")
    expect(h).not.toContain('href="https://evil.mx')
    expect(h).toContain("https://evil.mx/pago")
    expect(h).toContain('<a href="https://cotizador.hetnacnc.com/x?a=1&amp;b=2">')
    expect(h).not.toContain('href="http://hetnacnc.com')
    for (const mala of [
      "https://hetnacnc.com.evil.mx/a",
      "https://evilhetnacnc.com/a",
      "https://hetnacnc.com@evil.mx/a",
      "https://evil.mx/hetnacnc.com",
      "https://evil.mx\\@hetnacnc.com/a",
      "http://hetnacnc.com/a",
    ]) {
      expect(esLigaDeHetna(mala)).toBe(false)
      expect(cuerpoHtml(`Mira ${mala} ya`)).not.toContain("<a ")
    }
    expect(esLigaDeHetna("https://hetnacnc.com/mx/talleres/unete")).toBe(true)
    expect(esLigaDeHetna("https://WWW.HetnaCNC.com/mx")).toBe(true)
  })

  it("sin IA o con 3 respuestas previas no contesta y lo pasa a una persona", async () => {
    const antes = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const r = await redactarRespuestaCorreo({} as any, { de: "a@b.mx", asunto: "Duda", texto: "¿Cuánto cobran?" })
    expect(r.responder).toBe(false)
    expect(r.asunto).toBe("Re: Duda")
    process.env.ANTHROPIC_API_KEY = "x"
    const r2 = await redactarRespuestaCorreo({} as any, { de: "a@b.mx", asunto: "Re: Duda", texto: "Otra", anteriores: 3 })
    expect(r2.responder).toBe(false)
    expect(r2.asunto).toBe("Re: Duda")
    if (antes === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = antes
  })
})
