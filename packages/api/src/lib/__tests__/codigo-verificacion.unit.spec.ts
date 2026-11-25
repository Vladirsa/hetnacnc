import { CODIGO_HORAS, codigoValido, codigoVerificacion, fallosVigentes } from "../verificar-correo"

describe("código de 6 dígitos para confirmar el correo", () => {
  const antes = process.env.BAJA_SECRET
  beforeAll(() => {
    process.env.BAJA_SECRET = "secreto-de-prueba-para-codigos-0123456789"
  })
  afterAll(() => {
    if (antes === undefined) delete process.env.BAJA_SECRET
    else process.env.BAJA_SECRET = antes
  })
  const HORA = 3600_000

  it("son 6 números y cambian con la cuenta", () => {
    const a = codigoVerificacion("cus_1")
    expect(a).toMatch(/^[0-9]{6}$/)
    expect(codigoVerificacion("cus_2")).not.toBe(a)
  })

  it("sirve durante su vigencia y después ya no", () => {
    const ahora = Date.now()
    const c = codigoVerificacion("cus_1", Math.floor(ahora / HORA))
    expect(codigoValido("cus_1", c, ahora)).toBe(true)
    expect(codigoValido("cus_1", c.slice(0, 3) + " " + c.slice(3), ahora)).toBe(true)
    expect(codigoValido("cus_1", c, ahora + (CODIGO_HORAS - 1) * HORA)).toBe(true)
    expect(codigoValido("cus_1", c, ahora + (CODIGO_HORAS + 1) * HORA)).toBe(false)
    expect(codigoValido("cus_2", c, ahora)).toBe(codigoVerificacion("cus_2") === c)
    expect(codigoValido("cus_1", "12345", ahora)).toBe(false)
  })

  it("sin secreto no hay código", () => {
    const s = process.env.BAJA_SECRET
    delete process.env.BAJA_SECRET
    const otros = { c: process.env.COOKIE_SECRET, j: process.env.JWT_SECRET }
    delete process.env.COOKIE_SECRET
    delete process.env.JWT_SECRET
    const err = jest.spyOn(console, "error").mockImplementation(() => undefined)
    expect(codigoVerificacion("cus_1")).toBe("")
    err.mockRestore()
    process.env.BAJA_SECRET = s
    if (otros.c !== undefined) process.env.COOKIE_SECRET = otros.c
    if (otros.j !== undefined) process.env.JWT_SECRET = otros.j
  })

  it("los fallos se cuentan por 24 horas", () => {
    const ahora = Date.now()
    expect(fallosVigentes({}, ahora).n).toBe(0)
    const f = { codigo_fallos: { n: 5, desde: new Date(ahora - 2 * HORA).toISOString() } }
    expect(fallosVigentes(f, ahora).n).toBe(5)
    expect(fallosVigentes(f, ahora + 23 * HORA).n).toBe(0)
  })
})
