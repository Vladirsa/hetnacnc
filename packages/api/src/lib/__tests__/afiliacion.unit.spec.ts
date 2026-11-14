import { afiliadoPorToken, ligaActivar, numeroAfiliado } from "../afiliacion"

describe("afiliación de clientes", () => {
  it("arma el número con 6 dígitos", () => {
    expect(numeroAfiliado(1)).toBe("HC-000001")
    expect(numeroAfiliado(42)).toBe("HC-000042")
    expect(numeroAfiliado(1234567)).toBe("HC-1234567")
  })

  it("la liga de activación va a /mx/activar con el token", () => {
    expect(ligaActivar("abc_DEF-123")).toMatch(/\/mx\/activar\?t=abc_DEF-123$/)
  })

  it("rechaza tokens con formato inválido sin tocar la base", async () => {
    const knex: any = () => {
      throw new Error("no debe consultar")
    }
    await expect(afiliadoPorToken(knex, "")).resolves.toBeNull()
    await expect(afiliadoPorToken(knex, "corto")).resolves.toBeNull()
    await expect(afiliadoPorToken(knex, "con espacios y ; drop table")).resolves.toBeNull()
  })
})
