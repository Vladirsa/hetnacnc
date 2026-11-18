import { horasEsperaInfo, horasRevision, limiteRevision } from "../seguimiento"

describe("Reloj de la aprobación automática de solicitudes", () => {
  const antes = { ...process.env }
  afterEach(() => {
    process.env = { ...antes }
  })

  it("sin petición de información: 24 h desde que llegó", () => {
    delete process.env.LICITACION_REVISION_HORAS
    expect(horasRevision()).toBe(24)
    expect(limiteRevision({ created_at: "2026-11-18T10:00:00Z" }).toISOString()).toBe("2026-11-19T10:00:00.000Z")
  })

  it("pedir información detiene el reloj y lo vuelve a correr desde la petición (72 h)", () => {
    delete process.env.LICITACION_INFO_HORAS
    expect(horasEsperaInfo()).toBe(72)
    const s = { created_at: "2026-11-18T10:00:00Z", info_pedida_en: "2026-11-19T09:00:00Z" }
    // Ya no vence a las 24 h de creada
    expect(limiteRevision(s).toISOString()).toBe("2026-11-22T09:00:00.000Z")
  })

  it("una nueva petición vuelve a empezar la espera", () => {
    delete process.env.LICITACION_INFO_HORAS
    const s = { created_at: "2026-11-18T10:00:00Z", info_pedida_en: new Date("2026-11-21T08:00:00Z") }
    expect(limiteRevision(s).toISOString()).toBe("2026-11-24T08:00:00.000Z")
  })

  it("las horas se ajustan por variable de entorno", () => {
    process.env.LICITACION_INFO_HORAS = "48"
    process.env.LICITACION_REVISION_HORAS = "12"
    expect(limiteRevision({ created_at: "2026-11-18T10:00:00Z" }).toISOString()).toBe("2026-11-18T22:00:00.000Z")
    expect(limiteRevision({ created_at: "2026-11-18T10:00:00Z", info_pedida_en: "2026-11-18T12:00:00Z" }).toISOString()).toBe(
      "2026-11-20T12:00:00.000Z"
    )
    process.env.LICITACION_INFO_HORAS = "0"
    expect(horasEsperaInfo()).toBe(72)
  })
})
