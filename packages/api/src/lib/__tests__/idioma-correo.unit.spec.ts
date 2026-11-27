import { correoEnSuIdioma, correoValido, huellasFijas, traduccionValida } from "../idioma-correo"

describe("Correos en el idioma del cliente", () => {
  const html = '<table><tr><td><p>Hola Ana, tu pedido <b>#123</b> va en camino.</p><a href="https://hetnacnc.com/mx/user/orders/1">Ver pedido</a><img src="https://x/y.png"></td></tr></table>'

  it("reconoce correos válidos", () => {
    expect(correoValido("Ana@Correo.com")).toBe(true)
    expect(correoValido("no es correo")).toBe(false)
  })

  it("las ligas e imágenes son la huella fija del correo", () => {
    expect(huellasFijas(html)).toEqual(["https://hetnacnc.com/mx/user/orders/1", "https://x/y.png"])
  })

  it("acepta una traducción que conserva ligas y estructura", () => {
    const en = html.replace("Hola Ana, tu pedido", "Hi Ana, your order").replace("va en camino.", "is on its way.").replace("Ver pedido", "View order")
    expect(traduccionValida(html, en)).toBe(true)
  })

  it("rechaza una traducción que cambia o quita una liga", () => {
    expect(traduccionValida(html, html.replace("orders/1", "orders/2"))).toBe(false)
    expect(traduccionValida(html, "<p>Hi</p>")).toBe(false)
  })

  it("en español (o sin base de datos) el correo sale igual", async () => {
    const r = await correoEnSuIdioma("ana@correo.com", "Tu pedido", html)
    expect(r).toEqual({ asunto: "Tu pedido", html, idioma: "es" })
  })

  it("si la traducción falla, sale en español", async () => {
    const antes = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = ""
    const r = await correoEnSuIdioma("ana@correo.com", "Tu pedido", html, "en")
    expect(r.idioma).toBe("es")
    expect(r.html).toBe(html)
    process.env.ANTHROPIC_API_KEY = antes
  })
})
