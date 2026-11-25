const crear = jest.fn()
jest.mock("@anthropic-ai/sdk", () => jest.fn().mockImplementation(() => ({ beta: { messages: { create: crear } } })))
jest.mock("../planos-catalogo", () => ({ sincronizarProductosPlanos: jest.fn() }))
jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
const revisar = jest.fn()
jest.mock("../planos-biblioteca", () => {
  const real = jest.requireActual("../planos-biblioteca")
  return { ...real, revisarEnTienda: (...a: unknown[]) => revisar(...a) }
})
import { disenarPlano } from "../planos-agente"

const plano = {
  slug: "taburete-bajo", categoria: "Casa", nombre: "Taburete bajo", resumen: "Un taburete bajo para la casa.", descripcion: "Taburete de triplay.",
  nivel: "Fácil", horas: "1 h", ruedas: 0,
  piezas: [
    { nombre: "Pata", material: "triplay-18", x0: 0, x1: 18, y0: 0, y1: 300, z0: 0, z1: 300 },
    { nombre: "Asiento", material: "triplay-18", x0: 0, x1: 300, y0: 0, y1: 300, z0: 300, z1: 318 },
  ],
  pasos: [{ titulo: "Armar", nota: "", piezas: ["Pata", "Asiento"] }], herrajes: [], herramientas: [], notas: [],
}
const respuesta = (o: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(o) }] })
const idea = { nombre: "Taburete bajo", categoria: "Casa" as const, por_que: "x", medidas_aprox: "30 cm" }

describe("disenarPlano", () => {
  beforeEach(() => { crear.mockReset(); revisar.mockReset() })
  it("reintenta con los errores de la revisión y acepta el plano corregido", async () => {
    crear.mockResolvedValueOnce(respuesta(plano)).mockResolvedValueOnce(respuesta(plano))
    revisar.mockResolvedValueOnce({ ok: false, errores: ["«Pata» no toca a ninguna otra pieza."], avisos: [] }).mockResolvedValueOnce({ ok: true, errores: [], avisos: [] })
    const bitacora: string[] = []
    const r = await disenarPlano(idea, new Set(), bitacora)
    expect(r?.plano.slug).toBe("taburete-bajo")
    expect(crear).toHaveBeenCalledTimes(2)
    const segundo = crear.mock.calls[1][0].messages
    expect(segundo[segundo.length - 1].content).toContain("no toca a ninguna otra pieza")
  })
  it("se rinde después de 3 intentos fallidos", async () => {
    crear.mockResolvedValue(respuesta({ ...plano, slug: "../malo" }))
    const bitacora: string[] = []
    expect(await disenarPlano(idea, new Set(), bitacora)).toBeNull()
    expect(crear).toHaveBeenCalledTimes(3)
    expect(bitacora).toHaveLength(3)
  })
  it("no acepta un slug que ya existe", async () => {
    crear.mockResolvedValue(respuesta(plano))
    revisar.mockResolvedValue({ ok: true, errores: [], avisos: [] })
    expect(await disenarPlano(idea, new Set(["taburete-bajo"]), [])).toBeNull()
  })
})
