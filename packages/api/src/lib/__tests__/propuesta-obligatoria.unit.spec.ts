import { faltantesObligatorios, leerPropuestaFormal } from "../licitacion-propuesta"

const sinOcultar = (s: string) => s
const hoy = new Date("2026-11-19T12:00:00Z")

describe("propuesta obligatoria", () => {
  it("pide material, fecha, condiciones de pago y garantía", () => {
    const f = leerPropuestaFormal({}, sinOcultar)
    expect(faltantesObligatorios(f, hoy)).toEqual([
      "el material y las especificaciones",
      "la fecha estimada de entrega",
      "las condiciones de pago",
      "la garantía",
    ])
  })
  it("acepta una propuesta completa y rechaza una fecha pasada", () => {
    const base = { materiales: "Acero A36 cal. 14", condiciones_pago: "50% y 50%", garantia: "30 días" }
    expect(faltantesObligatorios(leerPropuestaFormal({ ...base, fecha_entrega: "2026-12-01" }, sinOcultar), hoy)).toEqual([])
    expect(faltantesObligatorios(leerPropuestaFormal({ ...base, fecha_entrega: "2026-11-01" }, sinOcultar), hoy)).toEqual([
      "una fecha de entrega que no haya pasado",
    ])
  })
})
