// Calendario para Google Calendar: formato iCalendar, ligas firmadas y eventos del taller.
const supaMock = jest.fn()
jest.mock("../cotizador-suscripciones", () => {
  class ErrorSuscripcion extends Error {
    constructor(m: string, public status = 400) { super(m) }
  }
  return { ErrorSuscripcion, supa: (...a: any[]) => supaMock(...a) }
})

import { armarIcs, doblar, escIcs, firmaValida, firmar } from "../calendario-ics"
import { eventosTaller, icsTaller } from "../calendario"

const NEG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

beforeAll(() => { process.env.CALENDARIO_SECRET = "secreto-de-prueba-largo-123" })
beforeEach(() => supaMock.mockReset())

describe("formato iCalendar", () => {
  it("escapa comas, punto y coma, diagonales y saltos", () => {
    expect(escIcs("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne")
  })

  it("corta líneas a 75 bytes sin partir acentos ni emojis", () => {
    const larga = "SUMMARY:" + "📦 Entrega áéí ".repeat(20)
    const lineas = doblar(larga).split("\r\n")
    expect(lineas.length).toBeGreaterThan(1)
    for (const l of lineas) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75)
    expect(lineas.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(larga)
  })

  it("arma eventos de todo el día, con hora local y con hora exacta", () => {
    const ics = armarIcs("Mi taller", [
      { uid: "1@x", dia: "2026-12-31", titulo: "Entrega" },
      { uid: "2@x", inicioLocal: "2026-11-20T10:30", minutos: 90, titulo: "Cita" },
      { uid: "3@x", inicio: new Date("2026-11-20T18:00:00Z"), titulo: "Cierre" },
      { uid: "4@x", titulo: "sin fecha" },
    ])
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101")
    expect(ics).toContain("DTSTART;TZID=America/Mexico_City:20261120T103000\r\nDTEND;TZID=America/Mexico_City:20261120T120000")
    expect(ics).toContain("DTSTART:20261120T180000Z")
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
  })
})

describe("ligas firmadas", () => {
  it("cada taller tiene su firma y no sirve para otro", () => {
    const f = firmar(`taller:${NEG}`)
    expect(f).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(firmaValida(`taller:${NEG}`, f)).toBe(true)
    expect(firmaValida("taller:otro", f)).toBe(false)
    expect(firmaValida(`taller:${NEG}`, f.slice(0, 23) + (f[23] === "A" ? "B" : "A"))).toBe(false)
    expect(firmaValida("hetna", f)).toBe(false)
  })

  it("una firma falsa no consulta la base", async () => {
    await expect(icsTaller(NEG, "x".repeat(24))).rejects.toThrow(/no encontrado/)
    await expect(icsTaller("no-es-uuid", firmar("taller:no-es-uuid"))).rejects.toThrow(/no encontrado/)
    expect(supaMock).not.toHaveBeenCalled()
  })
})

describe("eventos del taller", () => {
  it("entregas, citas y mantenimientos, siempre filtrando por el taller", async () => {
    supaMock.mockImplementation(async (ruta: string) => {
      if (ruta.startsWith("/rest/v1/negocios")) return [{ nombre: "Taller Uno" }]
      if (ruta.startsWith("/rest/v1/pedidos")) return [
        { id: "p1", folio: "P-1", estado: "Produccion", total: 1500, fecha_entrega_estimada: "2026-11-25", cliente_id: "c1" },
        { id: "p2", folio: "P-2", estado: "Entregado", fecha_entrega_estimada: "2026-11-10", fecha_entregado: "2026-11-12" },
        { id: "p3", folio: "P-3", estado: "Cancelado", fecha_entrega_estimada: "2026-11-26" },
        { id: "p4", folio: "P-4", estado: "Pedido", fecha_entrega_estimada: null },
      ]
      if (ruta.startsWith("/rest/v1/citas")) return [
        { id: "ct1", titulo: "Visita", fecha_hora: "2026-11-21T10:00:00+00:00", duracion_min: 45, estado: "Programada", lugar: "Planta", cliente_id: "c1" },
        { id: "ct2", titulo: "Vieja", fecha_hora: "2026-11-22T10:00:00+00:00", estado: "Cancelada" },
      ]
      if (ruta.startsWith("/rest/v1/mantenimiento_tareas")) return [{ id: "m1", nombre: "Engrasar husillo", cada_dias: 30, ultima_fecha: "2026-11-01", maquina_id: "q1" }]
      if (ruta.startsWith("/rest/v1/clientes")) return [{ id: "c1", nombre: "Ana", empresa: "Muebles Sol" }]
      if (ruta.startsWith("/rest/v1/maquinaria")) return [{ id: "q1", nombre: "Router grande" }]
      return []
    })
    const { nombre, eventos } = await eventosTaller(NEG)
    expect(nombre).toBe("Taller Uno · Cotizador HETNA")
    expect(eventos.map((e) => e.titulo)).toEqual([
      "📦 Entrega P-1 · Muebles Sol",
      "✅ Entregado P-2",
      "📅 Visita · Muebles Sol",
      "🔧 Engrasar husillo · Router grande",
    ])
    expect(eventos[1].dia).toBe("2026-11-12")
    expect(eventos[2]).toMatchObject({ inicioLocal: "2026-11-21T10:00", minutos: 45, lugar: "Planta" })
    expect(eventos[3].dia).toBe("2026-12-01")
    // Toda consulta de datos del taller va filtrada por su negocio
    for (const [ruta] of supaMock.mock.calls) {
      if (/\/(pedidos|citas|mantenimiento_tareas|clientes)\?/.test(ruta)) expect(ruta).toContain(`negocio_id=eq.${NEG}`)
    }
  })

  it("si una tabla falla, el calendario sale con lo demás", async () => {
    supaMock.mockImplementation(async (ruta: string) => {
      if (ruta.startsWith("/rest/v1/citas")) throw new Error("column negocio_id does not exist")
      if (ruta.startsWith("/rest/v1/pedidos")) return [{ id: "p1", folio: "P-1", estado: "Pedido", fecha_entrega_estimada: "2026-11-25" }]
      return []
    })
    const ics = await icsTaller(NEG, firmar(`taller:${NEG}`))
    expect(ics).toContain("SUMMARY:📦 Entrega P-1")
    expect(ics).toContain("X-WR-CALNAME:Mi taller · Cotizador HETNA")
  })
})
