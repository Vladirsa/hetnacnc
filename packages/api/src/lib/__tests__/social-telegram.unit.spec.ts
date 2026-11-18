import { MAX_INTENTOS_CODIGO, puntajeDe, veredictoVincular, vistaPrevia } from "../social-telegram"

describe("Vincular el chat de Telegram", () => {
  const base = { codigo: "123456", codigo_expira: new Date(Date.now() + 60_000).toISOString() }
  it("acepta el código correcto dentro del tope de intentos", () => {
    expect(veredictoVincular({ ...base, codigo_intentos: 1 }, "123456")).toBe("ok")
    expect(veredictoVincular({ ...base, codigo_intentos: MAX_INTENTOS_CODIGO }, "123456")).toBe("ok")
    expect(veredictoVincular({ ...base, codigo_intentos: 2 }, "654321")).toBe("mal")
  })
  it("pasado el tope ya no acepta ni el código correcto", () => {
    expect(veredictoVincular({ ...base, codigo_intentos: MAX_INTENTOS_CODIGO + 1 }, "123456")).toBe("agotado")
  })
  it("sin código o vencido no vincula", () => {
    expect(veredictoVincular({}, "123456")).toBe("mal")
    expect(veredictoVincular({ ...base, codigo_expira: new Date(Date.now() - 1000).toISOString() }, "123456")).toBe("mal")
  })
})

describe("Aprobación por Telegram", () => {
  const p = {
    id: "spost_1", titulo: "Instagram · Cómo cotizar", redes: ["instagram"], mercado: "mx", programada_para: "2026-11-11T18:00:00Z",
    textos: { instagram: "¿Necesitas una pieza CNC?\nCotiza gratis, liga en la bio. Mándaselo a quien lo necesite.\n#CNC #CorteLaser #Mexico\n{{liga}}" },
    medios: [{ url: "https://x/a.mp4", tipo: "video" }],
  }
  it("la vista previa cabe en el pie de foto y no muestra la marca de liga", () => {
    const v = vistaPrevia(p)
    expect(v.length).toBeLessThanOrEqual(950)
    expect(v).toContain("🎬 video")
    expect(v).not.toContain("{{liga}}")
    expect(v).toContain("Instagram")
  })
  it("el puntaje es el menor de sus redes", () => {
    expect(puntajeDe(p)).toBeGreaterThan(0)
    expect(puntajeDe({ ...p, redes: [] })).toBe(0)
  })
})
