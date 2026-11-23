import { validarEstimadoCorreo } from "../estimado-correo"

const base = { acepta: true, email: "Ana@Ejemplo.com ", estimado_min: 450, estimado_max: 900, servicio: "Router CNC", cantidad: 3, largo_mm: 300, ancho_mm: 200 }

describe("estimado por correo", () => {
  it("acepta un estimado válido y pasa mm a cm", () => {
    const r = validarEstimadoCorreo(base)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos).toMatchObject({ email: "ana@ejemplo.com", estimado_min: 450, estimado_max: 900, largo: 30, ancho: 20, cantidad: 3 })
  })
  it("pide permiso expreso", () => {
    expect(validarEstimadoCorreo({ ...base, acepta: "true" }).ok).toBe(false)
  })
  it("rechaza correos y rangos raros", () => {
    expect(validarEstimadoCorreo({ ...base, email: "ana" }).ok).toBe(false)
    expect(validarEstimadoCorreo({ ...base, estimado_min: 0 }).ok).toBe(false)
    expect(validarEstimadoCorreo({ ...base, estimado_max: 400 }).ok).toBe(false)
    expect(validarEstimadoCorreo({ ...base, estimado_max: 100_000 }).ok).toBe(false)
  })
})
