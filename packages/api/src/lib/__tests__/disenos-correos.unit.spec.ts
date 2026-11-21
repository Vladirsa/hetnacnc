import { correoDiseno, whatsappDiseno } from "../disenos-correos"

describe("embudo de diseños", () => {
  it("cada tipo tiene correo con asunto y botón", () => {
    for (const tipo of ["diseno_espera", "regalo_sin_usar", "creditos_bajos", "sin_volver"] as const) {
      const c = correoDiseno(tipo, { nombre: "Ana", diseno: "Cocina <L>", herramienta: "cocina", saldo: 1 })
      expect(c.asunto.length).toBeGreaterThan(5)
      expect(c.html).toContain(`utm_campaign=${tipo}`)
      expect(c.html).not.toContain("<L>")
    }
  })
  it("el WhatsApp lleva liga con su campaña y la de créditos va a la página de créditos", () => {
    expect(whatsappDiseno("sin_volver", { diseno: "Closet", herramienta: "mueble" }).url).toContain("utm_campaign=sin_volver")
    expect(whatsappDiseno("creditos_bajos", { saldo: 0 }).url).toContain("/mx/user/creditos")
    expect(whatsappDiseno("creditos_bajos", { saldo: 0 }).cuerpo).toMatch(/\$\d+/)
  })
})
