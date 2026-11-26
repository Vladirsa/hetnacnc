import { pideDisenoTrabajo } from "../difusion"

describe("Solicitudes que necesitan diseño llegan a diseñadores CAD/CAM", () => {
  it("sin archivo, con boceto o con idea: sí", () => {
    expect(pideDisenoTrabajo({ tiene_archivo: "No tengo archivo, necesito diseño", servicio: "Corte láser" })).toBe(true)
    expect(pideDisenoTrabajo({ tiene_archivo: "Tengo boceto o foto" })).toBe(true)
    expect(pideDisenoTrabajo({ tiene_archivo: "Tengo idea o referencia" })).toBe(true)
    expect(pideDisenoTrabajo({ necesidad: "Diseño" })).toBe(true)
    expect(pideDisenoTrabajo({ servicio: "Diseño CAD/CAM" })).toBe(true)
  })
  it("con archivo profesional: no", () => {
    expect(pideDisenoTrabajo({ tiene_archivo: "Tengo archivo profesional", servicio: "Corte CNC" })).toBe(false)
    expect(pideDisenoTrabajo({})).toBe(false)
    expect(pideDisenoTrabajo(null)).toBe(false)
  })
})
