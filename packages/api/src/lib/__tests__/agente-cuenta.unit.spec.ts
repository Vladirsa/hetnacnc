import { textoCuenta } from "../agente-cuenta"

describe("lo que el Agente sabe de la cuenta de quien escribe", () => {
  it("sin datos no agrega nada", () => {
    expect(textoCuenta({})).toBe("")
    expect(textoCuenta({ solicitudes: [] })).toBe("")
  })

  it("taller con perfil incompleto: qué le falta y la liga para completarlo", () => {
    const t = textoCuenta({ taller: { nombre: "Hecabumex", verificado: false, faltan: ["máquinas", "si emites factura"], recibe: true } })
    expect(t).toContain("taller «Hecabumex»")
    expect(t).toContain("sin verificar")
    expect(t).toContain("máquinas, si emites factura")
    expect(t).toContain("/seller/perfil-taller")
    expect(t).toContain("100 %")
  })

  it("carrito olvidado y propuestas de sus solicitudes, con sus ligas", () => {
    const t = textoCuenta({
      carrito: { productos: ["Fresa 1/8", "Collet ER11"] },
      solicitudes: [{ folio: "HET-00006", etapa: "Cotizada", propuestas: 2, liga: "https://hetnacnc.com/mx/cotizar/propuestas/x" }],
    })
    expect(t).toContain("Fresa 1/8, Collet ER11")
    expect(t).toContain("/mx/cart")
    expect(t).toContain("HET-00006: Cotizada, 2 propuestas")
    expect(t).toContain("/mx/cotizar/propuestas/x")
  })

  it("taller con «Recibiendo solicitudes» en pausa", () => {
    expect(textoCuenta({ taller: { nombre: "X", verificado: true, faltan: [], recibe: false } })).toContain("pausado «Recibiendo solicitudes»")
  })
})
