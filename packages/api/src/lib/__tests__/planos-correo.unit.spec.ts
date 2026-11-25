import { PLANOS_NOMBRES, ligaPlano, validarPedidoPlano } from "../planos-correo"

describe("validarPedidoPlano", () => {
  const base = { email: "Taller@Ejemplo.com", plano: "banco-de-trabajo-movil", acepta: true }

  it("acepta un pedido válido y normaliza el correo", () => {
    const v = validarPedidoPlano(base)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.datos.email).toBe("taller@ejemplo.com")
      expect(v.datos.promos).toBe(false)
    }
  })

  it("pide la casilla de permiso", () => {
    expect(validarPedidoPlano({ ...base, acepta: false }).ok).toBe(false)
  })

  it("rechaza correos mal escritos y planos que no existen", () => {
    expect(validarPedidoPlano({ ...base, email: "no-es-correo" }).ok).toBe(false)
    expect(validarPedidoPlano({ ...base, plano: "../otro" }).ok).toBe(false)
  })

  it("guarda el permiso de novedades sólo si viene en true", () => {
    const v = validarPedidoPlano({ ...base, promos: "true" })
    expect(v.ok && v.datos.promos).toBe(false)
    const w = validarPedidoPlano({ ...base, promos: true })
    expect(w.ok && w.datos.promos).toBe(true)
  })

  it("la liga apunta a la página del plano", () => {
    expect(ligaPlano("caballetes-de-triplay")).toContain("/mx/planos/caballetes-de-triplay")
    expect(Object.keys(PLANOS_NOMBRES)).toHaveLength(12)
  })
})
