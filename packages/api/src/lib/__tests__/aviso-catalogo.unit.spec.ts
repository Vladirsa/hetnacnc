import { CAMPANA_PIEZAS_NOV, correoCatalogo, imprime3D } from "../aviso-catalogo-talleres"

describe("aviso de piezas nuevas a talleres que imprimen", () => {
  it("sólo talleres con impresión 3D en su perfil", () => {
    expect(imprime3D({ servicios: ["Corte láser", "Impresión 3D"] })).toBe(true)
    expect(imprime3D({ servicios: ["Corte láser", "Router CNC"] })).toBe(false)
    expect(imprime3D(null)).toBe(false)
  })
  it("el correo lista las 12 piezas con su liga y manda a poner precio", () => {
    const html = correoCatalogo(CAMPANA_PIEZAS_NOV, "Taller <Uno>")
    expect(CAMPANA_PIEZAS_NOV.piezas).toHaveLength(12)
    for (const p of CAMPANA_PIEZAS_NOV.piezas) expect(html).toContain(`/mx/products/${p.handle}`)
    expect(html).toContain("/imprimir")
    expect(html).not.toContain("<Uno>")
  })
})
