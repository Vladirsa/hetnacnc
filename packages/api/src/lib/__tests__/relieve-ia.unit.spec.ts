// Profundidad con IA: preparación de la imagen, normalización y validaciones.
import { aTensor, normalizar } from "../relieve-ia/trabajador"
import { ErrorRelieve, disponible, motivoNoDisponible, profundidad, validar } from "../relieve-ia/servicio"

describe("trabajador", () => {
  it("normaliza recortando extremos: cerca = 65535, lejos = 0", () => {
    const v = new Float32Array(1000).map((_, i) => i)
    v[0] = -9999 // valor atípico lejos
    v[999] = 99999 // valor atípico cerca
    const n = normalizar(v)
    expect(n[999]).toBe(65535)
    expect(n[0]).toBe(0)
    expect(n[500]).toBeGreaterThan(30000)
    expect(n[500]).toBeLessThan(35000)
  })

  it("arma el tensor por canal con la media y desviación del modelo", () => {
    const rgb = new Uint8Array([255, 0, 128, 0, 255, 128])
    const t = aTensor(rgb, 2, 1)
    expect(t.length).toBe(6)
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 4) // R del píxel 1
    expect(t[1]).toBeCloseTo((0 - 0.485) / 0.229, 4) // R del píxel 2
    expect(t[2]).toBeCloseTo((0 - 0.456) / 0.224, 4) // G del píxel 1
    expect(t[4]).toBeCloseTo((128 / 255 - 0.406) / 0.225, 4) // B del píxel 1
  })
})

describe("servicio", () => {
  it("valida medidas múltiplos de 14 y el tamaño exacto", () => {
    expect(() => validar(602, 518, 602 * 518 * 3)).not.toThrow()
    expect(() => validar(600, 518, 600 * 518 * 3)).toThrow(ErrorRelieve)
    expect(() => validar(126, 518, 126 * 518 * 3)).toThrow(/entre 140 y 1036/)
    expect(() => validar(1050, 518, 1050 * 518 * 3)).toThrow(/entre 140 y 1036/)
    expect(() => validar(602, 518, 602 * 518 * 3 - 1)).toThrow(/no coincide/)
  })

  it("sin modelo no está disponible y responde 503 sin lanzar procesos", async () => {
    process.env.RELIEVE_IA_MODELO = "/no/existe/modelo.onnx"
    expect(disponible()).toBe(false)
    await expect(profundidad(602, 518, new Uint8Array(602 * 518 * 3))).rejects.toMatchObject({ status: 503 })
  })

  it("dice por qué no está disponible: apagado o sin modelo", () => {
    process.env.RELIEVE_IA = "0"
    expect(motivoNoDisponible()).toBe("apagado")
    delete process.env.RELIEVE_IA
    process.env.RELIEVE_IA_MODELO = "/no/existe/modelo.onnx"
    expect(["sin_motor", "sin_modelo"]).toContain(motivoNoDisponible())
  })
})
