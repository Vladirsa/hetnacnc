// Script de migración src/scripts/cifrar-llaves.ts con Supabase y Postgres
// falsos: en seco no escribe, con APLICAR=1 cifra sin poner tokens en la URL
// ni valores en el log.
import { randomBytes } from "crypto"

import { cifrar, descifrar, estaCifrado } from "../cifrado-llaves"

const supaMock = jest.fn()
jest.mock("../cotizador-suscripciones", () => ({ supa: (...a: any[]) => supaMock(...a) }))

import cifrarLlaves from "../../scripts/cifrar-llaves"

const LLAVE = randomBytes(32).toString("hex")
const SECRETOS = ["mp-acc-PLANO", "mp-ref-PLANO", "sk_live_PLANO", "tt-acc-PLANO"]

function entorno(config: Record<string, any> = {}, hayTabla = true) {
  const logs: string[] = []
  const log = (m: string) => logs.push(String(m))
  const logger = { info: log, warn: log, error: log }
  const raw = jest.fn(async () => ({ rowCount: 1 }))
  const knex: any = () => ({
    whereIn: () => ({ select: async () => Object.entries(config).map(([clave, valor]) => ({ clave, valor })) }),
  })
  knex.schema = { hasTable: async () => hayTabla }
  knex.raw = raw
  const container = { resolve: (k: string) => (k === "logger" ? logger : knex) }
  return { container, logs, raw }
}

const getsDe = (calls: any[]) => calls.filter((c) => !c[1]?.method)
const patchesDe = (calls: any[]) => calls.filter((c) => c[1]?.method === "PATCH")

beforeEach(() => {
  supaMock.mockReset()
  process.env.COTIZADOR_SUPABASE_SERVICE_KEY = "x"
  process.env.LLAVES_CIFRADO = LLAVE
  delete process.env.APLICAR
})
afterAll(() => {
  delete process.env.COTIZADOR_SUPABASE_SERVICE_KEY
  delete process.env.LLAVES_CIFRADO
  delete process.env.APLICAR
})

function supabaseFalso(patch: (url: string) => any = () => [{}]) {
  const yaCifrada = cifrar("ya-estaba")
  supaMock.mockImplementation(async (url: string, init?: any) => {
    if (init?.method === "PATCH") return patch(url)
    if (url.startsWith("/rest/v1/negocios_mp?"))
      return [
        { negocio_id: "n1", actualizado: "2026-11-18T10:00:00.123+00:00", access_token: "mp-acc-PLANO", refresh_token: "mp-ref-PLANO" },
        { negocio_id: "n2", actualizado: "2026-11-18T10:00:00+00:00", access_token: yaCifrada, refresh_token: null },
      ]
    if (url.startsWith("/rest/v1/negocios_facturapi?")) return [{ negocio_id: "n3", actualizado: "2026-11-18T11:00:00+00:00", llave_prueba: null, llave_real: "sk_live_PLANO" }]
    throw new Error("ruta inesperada")
  })
}

describe("scripts/cifrar-llaves", () => {
  it("sin llave válida no toca nada", async () => {
    delete process.env.LLAVES_CIFRADO
    const { container, raw, logs } = entorno({ tiktok: { access: "tt-acc-PLANO" } })
    await cifrarLlaves({ container } as any)
    expect(supaMock).not.toHaveBeenCalled()
    expect(raw).not.toHaveBeenCalled()
    expect(logs.join("\n")).toMatch(/Falta LLAVES_CIFRADO/)
    process.exitCode = 0
  })

  it("en seco sólo cuenta: sin escrituras y sin valores en el log", async () => {
    supabaseFalso()
    const { container, raw, logs } = entorno({ tiktok: { access: "tt-acc-PLANO", refresh: null } })
    await cifrarLlaves({ container } as any)
    expect(patchesDe(supaMock.mock.calls)).toHaveLength(0)
    expect(raw).not.toHaveBeenCalled()
    const texto = logs.join("\n")
    for (const s of SECRETOS) expect(texto).not.toContain(s)
    expect(texto).toContain("negocios_mp.access_token: 1 en claro, 1 cifradas, 0 vacías")
    expect(texto).toContain("negocios_facturapi.llave_real: 1 en claro, 0 cifradas, 0 vacías")
    expect(texto).toContain("hetna_social_config[tiktok].access: 1 en claro")
  })

  it("con APLICAR=1 cifra lo que está en claro, sin tokens en la URL", async () => {
    process.env.APLICAR = "1"
    supabaseFalso()
    const { container, raw, logs } = entorno({ tiktok: { access: "tt-acc-PLANO" } })
    await cifrarLlaves({ container } as any)
    const patches = patchesDe(supaMock.mock.calls)
    expect(patches).toHaveLength(2) // n1 y n3; n2 ya estaba cifrada
    for (const [url, init] of patches) {
      for (const s of SECRETOS) expect(url).not.toContain(s)
      expect(url).toMatch(/negocio_id=eq\.n[13]&actualizado=eq\./)
      const cuerpo = JSON.parse(init.body)
      for (const v of Object.values(cuerpo)) expect(estaCifrado(v)).toBe(true)
    }
    const mp = JSON.parse(patches[0][1].body)
    expect(descifrar(mp.access_token)).toBe("mp-acc-PLANO")
    expect(descifrar(mp.refresh_token)).toBe("mp-ref-PLANO")
    expect(JSON.parse(patches[1][1].body)).not.toHaveProperty("llave_prueba")

    expect(raw).toHaveBeenCalledTimes(1)
    const params = (raw.mock.calls[0] as any)[1]
    expect(params[1]).toBe("{access}")
    expect(descifrar(params[2])).toBe("tt-acc-PLANO")
    expect(params[3]).toBe("tiktok")
    const texto = logs.join("\n")
    for (const s of SECRETOS) expect(texto).not.toContain(s)
  })

  it("si la fila cambió mientras (PATCH sin filas) la cuenta como saltada", async () => {
    process.env.APLICAR = "1"
    supabaseFalso(() => [])
    const { container, logs } = entorno({})
    await cifrarLlaves({ container } as any)
    expect(logs.join("\n")).toContain("negocios_mp.access_token: 1 en claro, 1 cifradas, 0 vacías; cifradas ahora 0, saltadas por cambio 1")
  })

  it("un error al escribir sólo deja el código HTTP en el log", async () => {
    process.env.APLICAR = "1"
    supabaseFalso(() => {
      throw new Error('Supabase 400: {"message":"Failing row contains (n1, mp-acc-PLANO)"}')
    })
    const { container, logs } = entorno({})
    await cifrarLlaves({ container } as any)
    const texto = logs.join("\n")
    expect(texto).toContain("no se pudo escribir la fila n1: 400")
    for (const s of SECRETOS) expect(texto).not.toContain(s)
  })

  it("tablas que no existen no truenan", async () => {
    supaMock.mockRejectedValue(new Error('Supabase 404: {"code":"PGRST205","message":"Could not find the table"}'))
    const { container, logs } = entorno({}, false)
    await cifrarLlaves({ container } as any)
    const texto = logs.join("\n")
    expect(texto).toContain("negocios_mp: la tabla no existe")
    expect(texto).toContain("hetna_social_config: la tabla no existe")
    expect(texto).toContain("Listo.")
  })
})
