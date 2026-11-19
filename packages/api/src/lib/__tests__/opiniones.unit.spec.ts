jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
jest.mock("../resend", () => ({ sendEmail: jest.fn() }))

import { calcularNps, correoEncuesta, leerTokenEncuesta, limpiarPuntaje, tocaEncuesta, tokenEncuesta } from "../opiniones"

describe("opiniones", () => {
  const antes = process.env.BAJA_SECRET
  beforeAll(() => (process.env.BAJA_SECRET = "secreto-de-prueba"))
  afterAll(() => (process.env.BAJA_SECRET = antes))

  it("token de la encuesta: firma, vigencia y alteraciones", () => {
    const t = tokenEncuesta("taller", "sel_123")
    expect(leerTokenEncuesta(t)).toEqual({ quien: "taller", id: "sel_123" })
    expect(leerTokenEncuesta(tokenEncuesta("cliente", "cus_9"))).toEqual({ quien: "cliente", id: "cus_9" })
    expect(leerTokenEncuesta(t.replace("sel_123", "sel_999"))).toBeNull()
    expect(leerTokenEncuesta(t.replace(/^t\./, "c."))).toBeNull()
    expect(leerTokenEncuesta(t, Date.now() + 31 * 86_400_000)).toBeNull()
    expect(leerTokenEncuesta("basura")).toBeNull()
  })

  it("puntaje de 0 a 10 entero", () => {
    expect(limpiarPuntaje("7")).toBe(7)
    expect(limpiarPuntaje(0)).toBe(0)
    expect(limpiarPuntaje(11)).toBeNull()
    expect(limpiarPuntaje(7.5)).toBeNull()
    expect(limpiarPuntaje("")).toBeNull()
  })

  it("NPS", () => {
    expect(calcularNps([10, 9, 8, 3]).nps).toBe(25)
    expect(calcularNps([]).nps).toBeNull()
  })

  it("encuesta a los 7 días, una sola vez", () => {
    const ahora = new Date("2026-11-20T12:00:00Z")
    expect(tocaEncuesta({ email: "a@b.mx", created_at: "2026-11-12T12:00:00Z" }, ahora)).toBe(true)
    expect(tocaEncuesta({ email: "a@b.mx", created_at: "2026-11-17T12:00:00Z" }, ahora)).toBe(false)
    expect(tocaEncuesta({ email: "a@b.mx", created_at: "2026-11-12T12:00:00Z", metadata: { encuesta_nps: "x" } }, ahora)).toBe(false)
    expect(tocaEncuesta({ email: "a@b.mx", created_at: "2026-09-01T12:00:00Z" }, ahora)).toBe(false)
  })

  it("el correo trae los 11 botones con liga firmada", () => {
    const html = correoEncuesta("cliente", "cus_1", "Ana")
    expect((html.match(/\/mx\/opinion\?t=/g) || []).length).toBe(11)
    expect(html).toContain("&amp;p=10")
  })
})
