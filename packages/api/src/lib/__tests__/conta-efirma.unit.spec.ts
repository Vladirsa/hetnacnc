import { randomBytes } from "crypto"
import { cifrar, descifrar } from "../conta/efirma"

describe("Resguardo cifrado de la e.firma", () => {
  const k = randomBytes(32)
  it("cifra y descifra", () => {
    const c = cifrar(Buffer.from("contraseña-secreta"), k)
    expect(c).not.toContain("secreta")
    expect(descifrar(c, k).toString()).toBe("contraseña-secreta")
    expect(cifrar(Buffer.from("x"), k)).not.toBe(cifrar(Buffer.from("x"), k)) // IV distinto cada vez
  })
  it("si alguien altera lo guardado o usa otra llave, no abre", () => {
    const c = Buffer.from(cifrar(Buffer.from("datos"), k), "base64")
    c[c.length - 1] ^= 1
    expect(() => descifrar(c.toString("base64"), k)).toThrow()
    expect(() => descifrar(cifrar(Buffer.from("datos"), k), randomBytes(32))).toThrow()
  })
  it("sin CONTA_EFIRMA_KEY no hay cifrado", () => {
    const antes = process.env.CONTA_EFIRMA_KEY
    delete process.env.CONTA_EFIRMA_KEY
    expect(() => cifrar(Buffer.from("x"))).toThrow(/CONTA_EFIRMA_KEY/)
    process.env.CONTA_EFIRMA_KEY = antes
  })
})
