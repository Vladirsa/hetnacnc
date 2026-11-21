jest.mock("../social-hub", () => ({ iaSocial: () => false }))
jest.mock("../correo-respuesta", () => ({ datos: async () => [] }))

import { FAQ, redactarSoporte } from "../soporte-correo"

describe("agente de soporte", () => {
  it("trae las preguntas frecuentes sin plantillas sin resolver", () => {
    expect(FAQ.length).toBeGreaterThan(8)
    expect(FAQ.join(" ")).not.toContain("${")
  })
  it("sin IA no contesta solo", async () => {
    const r = await redactarSoporte({} as any, { de: "a@b.mx", asunto: "Duda", texto: "¿Cómo compro?" })
    expect(r.responder).toBe(false)
    expect(r.asunto).toBe("Re: Duda")
  })
})
