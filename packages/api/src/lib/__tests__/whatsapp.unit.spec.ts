import { normalizarNumero, textoVerificacion } from "../whatsapp"

describe("WhatsApp", () => {
  it("normaliza celulares de México", () => {
    expect(normalizarNumero("33 1234 5678")).toBe("523312345678")
    expect(normalizarNumero("+52 1 33 1234 5678")).toBe("523312345678")
    expect(normalizarNumero("5213312345678")).toBe("523312345678")
    expect(normalizarNumero("523312345678")).toBe("523312345678")
    expect(normalizarNumero("12345")).toBeNull()
    expect(normalizarNumero("+1 312 555 0101")).toBeNull()
  })
  it("el mensaje de verificación lleva el código de 6 dígitos y la palabra verificación", () => {
    const t = textoVerificacion("482913")
    expect(t).toMatch(/\b482913\b/)
    expect(t).toMatch(/verificaci/i)
  })
})
