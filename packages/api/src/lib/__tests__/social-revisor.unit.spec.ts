import { pendientesDe, redesConTexto } from "../social-revisor"

describe("Revisor con IA", () => {
  it("la historia no se revisa (no publica texto)", () => {
    expect(redesConTexto(["instagram", "instagram_historia", "facebook"])).toEqual(["instagram", "facebook"])
  })
  it("sólo pide a la IA lo que se arregla con texto", () => {
    const p = { redes: ["facebook"], mercado: "mx", medios: [], textos: { facebook: "Un texto muy largo sin llamada a la accion y sin gancho corto porque la primera linea sigue y sigue sin parar durante mucho mas de noventa caracteres seguidos" } }
    const f = pendientesDe(p, 100)
    expect(Object.keys(f)).toEqual(["facebook"])
    expect(f.facebook.consejos.join(" ")).not.toMatch(/video|imagen/i)
    expect(f.facebook.consejos.length).toBeGreaterThan(0)
  })
  it("si ya cumple, no hay pendientes", () => {
    const p = { redes: ["telegram"], mercado: "mx", medios: [], textos: { telegram: "Cotiza tu pieza CNC\n\nManda tu plano y recibe precios: {{liga}}" } }
    expect(pendientesDe(p, 50)).toEqual({})
  })
})
