import { BUSQUEDAS_INICIALES, TIPOS, extraerJson, mensajeSugerido } from "../radar"

describe("Radar", () => {
  it("lee el bloque JSON de la respuesta de la IA", () => {
    const t = 'Encontré esto:\n```json\n{"hallazgos":[{"titulo":"Planta nueva","url":"https://x.com/a","relevancia":5}]}\n```'
    expect(extraerJson(t)).toHaveLength(1)
    expect(extraerJson("sin resultados")).toEqual([])
    expect(extraerJson("```json\n{roto\n```")).toEqual([])
  })
  it("las búsquedas iniciales usan tipos válidos e ids únicos", () => {
    for (const b of BUSQUEDAS_INICIALES) expect(TIPOS).toContain(b.tipo)
    expect(new Set(BUSQUEDAS_INICIALES.map((b) => b.id)).size).toBe(BUSQUEDAS_INICIALES.length)
  })
  it("el mensaje sugerido ofrece darse de baja y no lleva datos inventados", () => {
    const m = mensajeSugerido({ tipo: "taller", titulo: "Taller X", datos: { empresa: "Taller X" } })
    expect(m).toContain("no les vuelvo a escribir")
    expect(mensajeSugerido({ tipo: "contenido", titulo: "x" })).toBe("")
  })
})
