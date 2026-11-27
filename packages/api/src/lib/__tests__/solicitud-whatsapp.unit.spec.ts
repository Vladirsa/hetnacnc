import { primerNombre, textoConfirmacion } from "../solicitud-whatsapp"

describe("WhatsApp al cliente que pidió cotización", () => {
  it("saluda por su primer nombre", () => {
    expect(primerNombre("ALFREDO PEREZ ARVIZU")).toBe("Alfredo")
    expect(primerNombre("  eréndira ")).toBe("Eréndira")
    expect(primerNombre("")).toBe("")
  })

  it("le dice que le buscamos el mejor taller, con su folio y su liga", () => {
    const t = textoConfirmacion({ folio: 4, token: "abc", trabajo: { servicio: "Corte CNC", material: "MDF" }, contacto: { nombre: "ALFREDO PEREZ" } })
    expect(t).toContain("Hola Alfredo")
    expect(t).toContain("HET-00004")
    expect(t).toContain("(Corte CNC en MDF)")
    expect(t).toContain("buscando el mejor taller")
    expect(t).toContain("/mx/cotizar/propuestas/abc")
    expect(t).toContain("BAJA")
  })

  it("para suministro habla de proveedor y no inventa el servicio", () => {
    const t = textoConfirmacion({ folio: 7, token: "x", tipo: "suministro", trabajo: { servicio: "Otro" }, contacto: {} })
    expect(t).toContain("mejor proveedor")
    expect(t).not.toContain("(")
    expect(t).toContain("Hola 👋")
  })
})
