// La llamada a Claude, simulada: respuesta normal, rechazo y JSON dañado
const crear = jest.fn()
jest.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Falsa {
    static APIError = APIError
    static BadRequestError = class extends APIError {}
    static AuthenticationError = class extends APIError {}
    static RateLimitError = class extends APIError {}
    beta = { messages: { create: crear } }
  }
  return { __esModule: true, default: Falsa }
})

import { ErrorLectura, leerMuebleDeImagen } from "../muebles-ia"

const texto = (t: string, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text: t }] })

describe("leerMuebleDeImagen", () => {
  beforeEach(() => crear.mockReset())

  it("manda la imagen en base64 con salida estructurada y regresa la lectura normalizada", async () => {
    crear.mockResolvedValue(texto(JSON.stringify({ tipo: "exhibidor", ancho: 1000, fondoGabinete: 492, fondoRepisas: 250, altoGabinete: 500, repisas: 3, espacioSobreGabinete: 211, separacion: 360, sobreUltima: null, divisores: "ambos", numDivisores: 4, altoDivisor: 240, barrote: 25, confianza: "alta", notas: "Del plano." })))
    const l = await leerMuebleDeImagen("aGVsbG8=", "image/png")
    expect(l.ancho).toBe(1000)
    expect(l.sobreUltima).toBeNull()
    const pedido = crear.mock.calls[0][0]
    expect(pedido.model).toBe("claude-opus-5-5")
    expect(pedido.output_config.format.type).toBe("json_schema")
    expect(pedido.messages[0].content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "aGVsbG8=" } })
  })

  it("un rechazo del modelo se vuelve un error con reembolso", async () => {
    crear.mockResolvedValue(texto("", "refusal"))
    await expect(leerMuebleDeImagen("aGVsbG8=", "image/jpeg")).rejects.toBeInstanceOf(ErrorLectura)
  })

  it("JSON dañado se vuelve un error con reembolso", async () => {
    crear.mockResolvedValue(texto("{no es json"))
    await expect(leerMuebleDeImagen("aGVsbG8=", "image/jpeg")).rejects.toMatchObject({ reembolsar: true })
  })
})
