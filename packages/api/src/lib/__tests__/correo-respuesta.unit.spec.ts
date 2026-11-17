import { cuerpoHtml, redactarRespuestaCorreo } from "../correo-respuesta"

describe("respuesta automática a correos de prospectos", () => {
  it("convierte el texto en párrafos con ligas y escapa HTML", () => {
    const h = cuerpoHtml("Hola <b>equipo</b>:\n\nRegístrense en https://hetnacnc.com/mx/talleres/unete.\nSaludos")
    expect(h).toContain("<p>Hola &lt;b&gt;equipo&lt;/b&gt;:</p>")
    expect(h).toContain('<a href="https://hetnacnc.com/mx/talleres/unete">https://hetnacnc.com/mx/talleres/unete</a>.')
    expect(h).toContain("<br>Saludos")
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
