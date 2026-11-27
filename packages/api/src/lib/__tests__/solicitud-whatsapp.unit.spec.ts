import { primerNombre } from "../solicitud-whatsapp"
import { combinar, faltantes, textoCierre, textoInicio } from "../solicitud-conversacion"

describe("plática por WhatsApp con el cliente que pidió cotización", () => {
  it("saluda por su primer nombre", () => {
    expect(primerNombre("ALFREDO PEREZ ARVIZU")).toBe("Alfredo")
    expect(primerNombre("")).toBe("")
  })

  it("primer mensaje: formal, sin ligas, con su folio y la primera pregunta", () => {
    const t = textoInicio({ folio: 4, trabajo: { servicio: "Corte CNC", material: "MDF 6 mm" }, contacto: { nombre: "ALFREDO PEREZ" } })
    expect(t).toContain("Buen día, Alfredo")
    expect(t).toContain("HET-00004")
    expect(t).toContain("actualizaremos sus datos para publicarla")
    expect(t).toContain("mejores precios")
    expect(t).toContain("medidas de la pieza")
    expect(t).not.toMatch(/https?:\/\//)
    expect(t).not.toMatch(/completa|lista para publicar/i)
  })

  it("pide en orden lo que falta y deja de pedir el archivo una vez preguntado", () => {
    expect(faltantes({ material: "MDF", cantidad: "10" })).toEqual(["medidas", "archivo", "fecha", "lugar", "acabado"])
    expect(faltantes({ material: "MDF", cantidad: "10" }, { archivo_pedido: true })).not.toContain("archivo")
    expect(faltantes({ medidas: "30x40 cm", material: "MDF", cantidad: "1", tiene_archivo: "Tengo boceto o foto", fecha: "2026-12-02", cp: "78000", acabado: "Natural" })).toEqual([])
  })

  it("guarda lo nuevo sin borrar lo que había", () => {
    const { trabajo, cambios } = combinar({ material: "MDF", descripcion: "Letrero" }, { medidas: "30 x 40 cm", material: "", notas: "Esquinas redondeadas" })
    expect(trabajo.material).toBe("MDF")
    expect(trabajo.medidas).toBe("30 x 40 cm")
    expect(trabajo.descripcion).toContain("Precisado por WhatsApp: Esquinas redondeadas")
    expect(cambios).toHaveLength(2)
  })

  it("cierre: agradece, dice que actualizaremos y publicaremos; cupón y opinión sólo si están configurados", () => {
    delete process.env.SOLICITUD_CUPON
    delete process.env.SOLICITUD_RESENA_GOOGLE
    const sin = textoCierre({ folio: 5, contacto: { nombre: "Eréndira" } })
    expect(sin).toContain("Muchas gracias, Eréndira")
    expect(sin).toContain("actualizaremos los datos de su solicitud")
    expect(sin).not.toMatch(/código|descuento|opinión/)
    process.env.SOLICITUD_CUPON = "GRACIAS10"
    process.env.SOLICITUD_RESENA_GOOGLE = "https://g.page/r/hetna/review"
    const con = textoCierre({ folio: 5, contacto: {} })
    expect(con).toContain("*GRACIAS10*")
    expect(con).toContain("con toda sinceridad")
    expect(con).toContain("https://g.page/r/hetna/review")
    delete process.env.SOLICITUD_CUPON
    delete process.env.SOLICITUD_RESENA_GOOGLE
  })
})
