import { datosSuficientes } from "../solicitud-desde-whatsapp"
import { textoBase } from "../social-hub"
import { resumenRedes } from "../licitacion-privacidad"
import { textoCierre } from "../solicitud-conversacion"

describe("solicitud registrada desde WhatsApp y su anuncio", () => {
  it("sólo se registra con una descripción que un proveedor entienda", () => {
    expect(datosSuficientes({ descripcion: "barra" })).toBe(false)
    expect(datosSuficientes({ descripcion: "Barra de mandrinar para insertos APMT 1604, zanco 25 mm, largo 250 mm" })).toBe(true)
    expect(datosSuficientes(null)).toBe(false)
  })

  it("el anuncio de suministro busca proveedor, no taller", () => {
    const s = { tipo: "suministro", trabajo: { material: "Barra APMT 1604 zanco 25 mm", ciudad: "Zacatecas", cantidad: "1" }, privacidad: null, contacto: {} }
    const r = resumenRedes(s)
    expect(r).toContain("busca proveedor de barra apmt 1604")
    expect(r).not.toContain("talleres CNC")
    const t = textoBase("licitacion", { titulo: "Trabajo - Barra APMT 1604 zanco 25 mm", lugar: "Zacatecas", resumen: r, tipo: "suministro" })
    expect(t).toContain("¿Vendes herramienta o material CNC en Zacatecas?")
    expect(t).toContain("busca proveedor de barra apmt 1604")
    expect(t).toContain("Regístrate gratis como proveedor")
    expect(t).toContain("{{liga}}")
  })

  it("el de fabricación sigue igual", () => {
    expect(textoBase("licitacion", { titulo: "Corte láser - Acrílico", lugar: "Querétaro" })).toContain("¿Tienes CNC en Querétaro?")
  })

  it("el cierre invita a seguirnos si hay ligas configuradas", () => {
    process.env.SOLICITUD_SEGUIR = "Facebook: https://facebook.com/hetna|Telegram: https://t.me/hetna"
    const c = textoCierre({ folio: 9, contacto: {} })
    expect(c).toContain("Síganos")
    expect(c).toContain("https://t.me/hetna")
    delete process.env.SOLICITUD_SEGUIR
    expect(textoCierre({ folio: 9, contacto: {} })).not.toContain("Síganos")
  })
})
