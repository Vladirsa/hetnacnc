import { consejoTablero, htmlTablero, textoTablero } from "../tablero-ventas"

const base: any = {
  desde: "2026-11-16",
  ventas: { pedidos: 4, ingresos: 3200, antes_pedidos: 2, antes_ingresos: 1500 },
  creditos: { compras: 3, vendidos: 25, gastados: 12, antes_compras: 1 },
  disenos: { total: 9, antes: 5, por_herramienta: [{ herramienta: "cocina", n: 6 }, { herramienta: "mueble", n: 3 }] },
  publicaciones: { clics: 120, pagos: 2, ingresos: 398, top: [{ titulo: "Calcula tu precio <en minutos>", clics: 60, pagos: 2, ingresos: 398 }] },
}

describe("tablero de ventas", () => {
  it("resume ventas, créditos, diseños y publicaciones con la comparación", () => {
    const t = textoTablero(base)
    expect(t).toContain("4 pedidos pagados · $3,200")
    expect(t).toContain("▲ +2")
    expect(t).toContain("Cocina integral: 6")
    expect(t).toContain("1. Calcula tu precio")
  })
  it("recomienda impulsar la publicación que vendió; si no hay, la herramienta más usada", () => {
    expect(consejoTablero(base)).toMatch(/^Impulsa/)
    expect(consejoTablero({ ...base, publicaciones: null })).toMatch(/Cocina integral/)
  })
  it("sale aunque falten bloques y el correo escapa el texto", () => {
    expect(textoTablero({ desde: "x", ventas: null, creditos: null, disenos: null, publicaciones: null })).toContain("Tablero")
    expect(htmlTablero(base, "https://x/dashboard")).toContain("&lt;en minutos&gt;")
  })
})
