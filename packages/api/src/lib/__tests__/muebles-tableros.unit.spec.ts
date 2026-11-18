// Lectura de cualquier mueble como lista de tableros: llamada simulada y normalización
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

import { ErrorLectura, leerTablerosDeImagen, normalizarTableros } from "../muebles-ia"

const texto = (t: string, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text: t }] })
const mesa = {
  tipo: "tableros",
  nombre: "Mesa",
  grosor: 18,
  confianza: "media",
  notas: "Estimé las medidas.",
  tableros: [
    { nombre: "Cubierta", plano: "horizontal", x0: 0, x1: 1200, y0: 0, y1: 700, z0: 732, z1: 750 },
    { nombre: "Pata izquierda", plano: "lateral", x0: 60, x1: 78, y0: 60, y1: 640, z0: 0, z1: 732 },
  ],
}

describe("leerTablerosDeImagen", () => {
  beforeEach(() => crear.mockReset())

  it("pide salida con esquema y regresa los tableros", async () => {
    crear.mockResolvedValue(texto(JSON.stringify(mesa)))
    const l = await leerTablerosDeImagen("aGVsbG8=", "image/jpeg")
    expect(l.tipo).toBe("tableros")
    expect(l.tableros).toHaveLength(2)
    const pedido = crear.mock.calls[0][0]
    expect(pedido.model).toBe("claude-opus-5-5")
    expect(pedido.output_config.format.schema.required).toContain("tableros")
    expect(pedido.system).toMatch(/lateral/)
  })

  it("un rechazo se vuelve error con reembolso", async () => {
    crear.mockResolvedValue(texto("", "refusal"))
    await expect(leerTablerosDeImagen("aGVsbG8=", "image/jpeg")).rejects.toBeInstanceOf(ErrorLectura)
  })
})

describe("normalizarTableros", () => {
  it("ordena cajas invertidas, acota números y descarta tableros sin números", () => {
    const l = normalizarTableros({
      ...mesa,
      tableros: [
        { nombre: "A", plano: "lateral", x0: 18, x1: 0, y0: 0, y1: 300, z0: 9e9, z1: 0 },
        { nombre: "B", plano: "horizontal", x0: 0, x1: 800, y0: 0, y1: 300, z0: NaN, z1: 18 },
        { nombre: "", plano: "raro" as never, x0: 0, x1: 800, y0: 0, y1: 300, z0: 0, z1: 18 },
      ],
    } as never)
    expect(l.tableros).toHaveLength(2)
    expect(l.tableros[0]).toMatchObject({ x0: 0, x1: 18, z0: 0, z1: 3000 })
    expect(l.tableros[1]).toMatchObject({ nombre: "Tablero 2", plano: "horizontal" })
  })

  it("con menos de dos tableros es no_tableros (se reembolsa)", () => {
    expect(normalizarTableros({ ...mesa, tableros: [mesa.tableros[0]] } as never).tipo).toBe("no_tableros")
    expect(normalizarTableros({ ...mesa, grosor: 90 } as never).grosor).toBe(18)
  })
})
