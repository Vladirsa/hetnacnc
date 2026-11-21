import { correoPrecios, tienePrecios } from "../campana-precios-talleres"

describe("campaña de precios de acabados", () => {
  it("sabe si el taller ya puso algún precio", () => {
    expect(tienePrecios({})).toBe(false)
    expect(tienePrecios({ acabados: ["doblez"] })).toBe(false)
    expect(tienePrecios({ acabados: [{ clave: "doblez" }] })).toBe(false)
    expect(tienePrecios({ acabados: [{ clave: "doblez", precio: "$15 por doblez" }] })).toBe(true)
  })
  it("el correo lleva a su perfil y escapa el nombre", () => {
    const h = correoPrecios("<b>Taller</b>")
    expect(h).toMatch(/perfil-taller/)
    expect(h).not.toMatch(/<b>Taller<\/b>/)
    expect(correoPrecios("x", true)).toMatch(/Ya pusiste/)
  })
})
