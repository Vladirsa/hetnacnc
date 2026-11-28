import { esRespuesta } from "../respuesta-whatsapp"

describe("respuesta del cliente por WhatsApp a la pregunta de un taller", () => {
  it("cuenta como respuesta lo que trae información", () => {
    expect(esRespuesta("Sí, le mando foto en un momento")).toBe(true)
    expect(esRespuesta("sí")).toBe(true)
    expect(esRespuesta("Es acrílico de 3 mm")).toBe(true)
  })
  it("un «ok» o «gracias» no se guarda como respuesta", () => {
    expect(esRespuesta("ok")).toBe(false)
    expect(esRespuesta("Gracias!")).toBe(false)
    expect(esRespuesta("👍")).toBe(false)
    expect(esRespuesta("")).toBe(false)
  })
})
