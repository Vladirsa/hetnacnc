import { frenoFotos, normalizarLecturaFoto } from "../solicitud-foto-ia"

describe("solicitud desde foto", () => {
  it("normaliza lo que regresa la IA sin inventar", () => {
    const l = normalizarLecturaFoto({ pieza: "  Soporte  ", proceso: "Soldadura", acabado: "Cromado", preguntas: ["¿Grosor?", "", 3, "a", "b", "c"], confianza: "x" })
    expect(l.pieza).toBe("Soporte")
    expect(l.proceso).toBe("Otro")
    expect(l.acabado).toBeNull()
    expect(l.medidas).toBeNull()
    expect(l.preguntas.length).toBeLessThanOrEqual(4)
    expect(l.confianza).toBe("baja")
  })
  it("frena a la misma IP después de 6 lecturas en una hora", () => {
    const t = Date.now()
    for (let i = 0; i < 6; i++) expect(frenoFotos("1.2.3.4", t + i)).toBeNull()
    expect(frenoFotos("1.2.3.4", t + 10)).toMatch(/varias fotos/)
    expect(frenoFotos("5.6.7.8", t + 10)).toBeNull()
  })
})
