import { firmaConfirmacion, firmaValida as firmaTallerValida, mandarConfirmacion } from "../alta-taller"
import { firmaBaja, firmaValida as firmaBajaValida, ligaBaja } from "../baja"
import { secretoLigas } from "../secreto-ligas"
import { firmaVerificacionValida, ligaVerificacion, mandarCorreoVerificacion } from "../verificar-correo"

const CLAVES = ["BAJA_SECRET", "COOKIE_SECRET", "JWT_SECRET"] as const

describe("secreto de las ligas de correo (falla cerrado)", () => {
  const antes = Object.fromEntries(CLAVES.map((k) => [k, process.env[k]]))
  const poner = (v: Partial<Record<(typeof CLAVES)[number], string>>) => {
    for (const k of CLAVES) {
      if (v[k] === undefined) delete process.env[k]
      else process.env[k] = v[k]
    }
  }
  let error: jest.SpyInstance
  beforeEach(() => {
    error = jest.spyOn(console, "error").mockImplementation(() => undefined)
  })
  let avisos = 0
  afterEach(() => {
    avisos += error.mock.calls.length
    error.mockRestore()
  })
  afterAll(() => poner(antes as any))

  const futuro = String(Math.floor(Date.now() / 1000) + 3600)
  const parametros = (liga: string) => new URL(liga).searchParams

  it("con un secreto propio firma y valida", () => {
    poner({ BAJA_SECRET: "un-secreto-largo-de-prueba" })
    expect(secretoLigas()).toBe("un-secreto-largo-de-prueba")
    const q = parametros(ligaVerificacion("cus_1"))
    expect(firmaVerificacionValida("cus_1", q.get("e")!, q.get("t")!)).toBe(true)
    expect(firmaVerificacionValida("cus_2", q.get("e")!, q.get("t")!)).toBe(false)
    expect(firmaBajaValida("a@b.mx", parametros(ligaBaja("A@b.mx ")).get("t")!)).toBe(true)
    expect(firmaBajaValida("a@b.mx", "")).toBe(false)
  })

  it.each([{}, { COOKIE_SECRET: "supersecret", JWT_SECRET: "supersecret" }, { BAJA_SECRET: "supersecret" }])(
    "sin secreto o con supersecret no firma ni valida nada (%j)",
    async (entorno) => {
      // Una firma hecha con el secreto de fábrica, como la que armaría un atacante
      poner({ BAJA_SECRET: "x-temporal" })
      const { createHmac } = require("crypto")
      const falsa = (texto: string, s: string) => createHmac("sha256", s).update(texto).digest("base64url").slice(0, 32)

      poner(entorno)
      expect(secretoLigas()).toBeNull()

      expect(ligaVerificacion("cus_1")).toBe("")
      expect(ligaBaja("a@b.mx")).toBe("")
      expect(firmaBaja("a@b.mx")).toBe("")
      for (const s of ["", "supersecret"]) {
        expect(firmaVerificacionValida("cus_1", futuro, falsa(`verificar:cus_1:${futuro}`, s))).toBe(false)
        expect(firmaBajaValida("a@b.mx", falsa("baja:a@b.mx", s))).toBe(false)
        expect(firmaTallerValida("aprobar", "sel_1", futuro, falsa(`taller-aprobar:sel_1:${futuro}`, s))).toBe(false)
        expect(firmaConfirmacion("sel_1", futuro, falsa(`taller-confirmar:sel_1:${futuro}`, s), null)).toBeNull()
      }
      // La firma vacía tampoco pasa
      expect(firmaVerificacionValida("cus_1", futuro, "")).toBe(false)
      expect(firmaBajaValida("a@b.mx", "")).toBe(false)
      expect(firmaTallerValida("aprobar", "sel_1", futuro, "")).toBe(false)
      expect(firmaConfirmacion("sel_1", futuro, "", "a@b.mx")).toBeNull()

      // Y no se manda una liga que no va a servir (sin lanzar)
      expect(await mandarCorreoVerificacion({ id: "cus_1", email: "a@b.mx" })).toMatchObject({ sent: false })
      expect(await mandarConfirmacion({ id: "sel_1", email: "a@b.mx" })).toMatchObject({ sent: false })
    }
  )

  it("deja el error en el log (sin repetirlo en cada liga)", () => {
    expect(avisos).toBe(1)
  })
})
