import { correoMetricas, type Metricas } from "../metricas-extranjeros"

const m: Metricas = {
  talleres: 42, talleres_nuevos_30: 9, productos: 310, solicitudes_30: 6, solicitudes_total: 6, planos: 53,
  paises: [{ nombre: "Colombia", bandera: "🇨🇴", talleres: 3, clientes: 1 }],
}

describe("correo de métricas a talleres extranjeros", () => {
  it("en español, con las cifras reales, su país y las ligas para registrarse y subir productos", () => {
    const c = correoMetricas(m, { nombre: "Juan Pérez", pais: "co", idioma: "es" })
    expect(c.asunto).toContain("así vamos creciendo")
    expect(c.html).toContain("Hola Juan")
    expect(c.html).toContain(">42<")
    expect(c.html).toContain(">+9<")
    expect(c.html).toContain(">310<")
    expect(c.html).toContain("/mx/talleres/unete")
    expect(c.html).toContain("/seller")
    expect(c.html).toContain("/mx/latinoamerica/co")
    expect(c.html).toContain("Colombia: 3 talleres")
  })

  it("en inglés para proveedores de /sell-in-mexico", () => {
    const c = correoMetricas(m, { idioma: "en" })
    expect(c.asunto).toContain("this is how we are growing")
    expect(c.html).toContain("/sell-in-mexico")
    expect(c.html).toContain("Hi,")
  })

  it("una cifra en cero no se presume", () => {
    const c = correoMetricas({ ...m, talleres_nuevos_30: 0, solicitudes_30: 0, solicitudes_total: 0 }, { idioma: "es" })
    expect(c.html).not.toContain("talleres nuevos")
    expect(c.html).not.toContain("solicitudes de cotización")
  })
})

import { textoAnuncioMetricas } from "../metricas-extranjeros"

describe("correos nacionales y anuncio en redes", () => {
  it("talleres nacionales: ventajas y terminar su registro", () => {
    const c = correoMetricas(m, { nombre: "Ana", idioma: "es", segmento: "taller" })
    expect(c.html).toContain("Termina tu registro")
    expect(c.html).toContain("Registro gratis y solicitudes de clientes de su zona")
    expect(c.html).toContain("/mx/herramientas-cnc")
    expect(c.html).not.toContain("/mx/latinoamerica/")
  })

  it("clientes: ventajas de pedir cotización y ligas de compra", () => {
    const c = correoMetricas(m, { idioma: "es", segmento: "cliente" })
    expect(c.asunto).toContain("más talleres para fabricar lo que necesita")
    expect(c.html).toContain("Pide tu cotización gratis")
    expect(c.html).toContain("Pago protegido")
    expect(c.html).toContain("/mx/cotizar/suministro")
    expect(c.html).not.toContain("Termina tu registro")
  })

  it("el anuncio del mes trae sólo las cifras reales y la liga", () => {
    const t = textoAnuncioMetricas({ ...m, solicitudes_30: 0 })
    expect(t).toContain("42 talleres y proveedores CNC en la red (+9 este mes)")
    expect(t).toContain("310 productos")
    expect(t).not.toContain("solicitudes de cotización en los últimos")
    expect(t).toContain("{{liga}}")
  })
})
