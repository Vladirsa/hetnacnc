jest.mock("../social-telegram", () => ({ mandarPrivado: jest.fn() }))
jest.mock("../social-hub", () => ({ iaSocial: () => false }))
jest.mock("../whatsapp-bot", () => ({ productosParecidos: async () => [{ nombre: "Husillo 2.2 kW", liga: "https://hetnacnc.com/mx/products/husillo" }] }))

import { compararProveedores } from "../comparador-proveedores"

describe("comparador de proveedores", () => {
  const consulta: any = { where: () => consulta, count: () => consulta, first: async () => ({ n: 0 }), insert: async () => undefined }
  const knex: any = Object.assign(jest.fn(() => consulta), { schema: { hasTable: async () => true }, raw: () => "x" })
  const contenedor: any = { resolve: () => knex }

  it("pide qué busca", async () => {
    expect((await compararProveedores(contenedor, "sel_1", "a")).ok).toBe(false)
  })
  it("sin IA regresa lo que hay en HETNA", async () => {
    const r: any = await compararProveedores(contenedor, "sel_1", "husillo 2.2 kw")
    expect(r.ok).toBe(true)
    expect(r.en_hetna).toHaveLength(1)
    expect(r.opciones).toEqual([])
  })
  it("respeta el límite diario", async () => {
    consulta.first = async () => ({ n: 99 })
    const r: any = await compararProveedores(contenedor, "sel_1", "husillo 2.2 kw")
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/límite/)
  })
})
