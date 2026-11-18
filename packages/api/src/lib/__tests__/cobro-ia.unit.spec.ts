// Cobro de las lecturas con IA: se cobra antes y se regresa si no sirve o falla
const gastar = jest.fn()
const regresar = jest.fn()
jest.mock("../../workflows/spend-credits", () => ({ spendCreditsWorkflow: () => ({ run: gastar }) }))
jest.mock("../../workflows/grant-credits", () => ({ grantCreditsWorkflow: () => ({ run: regresar }) }))
jest.mock("@anthropic-ai/sdk", () => ({ __esModule: true, default: class {} }))

import { ErrorLectura } from "../muebles-ia"
import { lecturaConCobro } from "../../api/store/muebles/cobro-ia"

const pedir = () => {
  const r: { status: number; cuerpo: any } = { status: 200, cuerpo: null }
  const res: any = { status: (c: number) => ((r.status = c), res), json: (b: unknown) => ((r.cuerpo = b), res) }
  const req: any = { body: { imagen: "a".repeat(200), medio: "image/jpeg" }, auth_context: { actor_id: "cus_1" }, scope: { resolve: () => ({ error: jest.fn() }) } }
  return { req, res, r }
}

describe("lecturaConCobro", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "x"
    gastar.mockReset().mockResolvedValue({ result: { saldo_restante: 8 } })
    regresar.mockReset().mockResolvedValue({ result: {} })
  })

  it("lectura útil: cobra 2 y no regresa", async () => {
    const { req, res, r } = pedir()
    await lecturaConCobro(req, res, { descripcion: "x", leer: async () => ({ tipo: "tableros" }), inutil: () => false })
    expect(r.cuerpo).toMatchObject({ ok: true, cobrado: 2, saldo: 8 })
    expect(regresar).not.toHaveBeenCalled()
  })

  it("lectura que no sirve: regresa los créditos", async () => {
    const { req, res, r } = pedir()
    await lecturaConCobro(req, res, { descripcion: "x", leer: async () => ({ tipo: "no_tableros" }), inutil: () => true })
    expect(regresar).toHaveBeenCalledTimes(1)
    expect(regresar.mock.calls[0][0].input).toMatchObject({ customer_id: "cus_1", amount: 2, type: "reembolso" })
    expect(r.cuerpo).toMatchObject({ ok: true, cobrado: 0, saldo: 10 })
  })

  it("la IA falla: regresa los créditos y lo dice", async () => {
    const { req, res, r } = pedir()
    await lecturaConCobro(req, res, { descripcion: "x", leer: async () => { throw new ErrorLectura("La IA no respondió.", true) }, inutil: () => false })
    expect(regresar).toHaveBeenCalledTimes(1)
    expect(r.status).toBe(502)
    expect(r.cuerpo.mensaje).toMatch(/No se te cobró/)
  })

  it("si el reembolso también falla, no dice que no se cobró", async () => {
    regresar.mockRejectedValue(new Error("db"))
    const a = pedir()
    await lecturaConCobro(a.req, a.res, { descripcion: "x", leer: async () => { throw new Error("x") }, inutil: () => false })
    expect(a.r.cuerpo.mensaje).not.toMatch(/No se te cobró/)
    const b = pedir()
    await lecturaConCobro(b.req, b.res, { descripcion: "x", leer: async () => ({}), inutil: () => true })
    expect(b.r.cuerpo).toMatchObject({ ok: true, cobrado: 2 })
  })
})
