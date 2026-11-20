jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
jest.mock("../social-hub", () => ({ iaSocial: () => false }))
jest.mock("../centro-control", () => ({ ADMIN: "https://hetnacnc.com/dashboard" }))

import { correrInvestigador, correrRespondedor, resolverForoIa } from "../foro-agente"

describe("agente del foro", () => {
  const knex: any = Object.assign(jest.fn(), { schema: { hasTable: jest.fn(async () => true) } })
  const contenedor: any = { resolve: () => knex }

  it("sin IA ni foro configurados no hace nada (ni publica nada)", async () => {
    delete process.env.HETNA_FORO_DB
    delete process.env.HETNA_TALLER_DB
    expect(await correrRespondedor(contenedor)).toEqual({ nuevas: 0, revisadas: 0 })
    expect(await correrInvestigador(contenedor)).toEqual({ ok: false, motivo: "sin IA" })
  })

  it("no publica lo que ya no está pendiente", async () => {
    const consulta: any = { where: () => consulta, first: async () => undefined }
    knex.mockReturnValue(consulta)
    expect(await resolverForoIa(contenedor, 1, "publicar")).toEqual({ ok: false, message: "Ya no está pendiente." })
  })
})
