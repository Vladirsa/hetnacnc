import { MINIMO_DIARIO, TOPE_SEMANAL, diarioDe, normalizar } from "../anuncios"

describe("agente de anuncios (dinero)", () => {
  it("viene apagado y no se prende sin presupuesto suficiente", () => {
    expect(normalizar({}).activo).toBe(false)
    expect(normalizar({ activo: true, presupuesto_semanal: 100 }).activo).toBe(false) // menos del mínimo de Meta
    expect(normalizar({ activo: true, presupuesto_semanal: MINIMO_DIARIO * 7 }).activo).toBe(true)
  })

  it("nunca pasa del tope semanal del sistema", () => {
    expect(normalizar({ presupuesto_semanal: 999999 }).presupuesto_semanal).toBe(TOPE_SEMANAL)
    expect(normalizar({ presupuesto_semanal: -5 }).presupuesto_semanal).toBe(0)
  })

  it("reparte la semana en días y respeta el mínimo diario", () => {
    expect(diarioDe(normalizar({ presupuesto_semanal: 700 }))).toBe(100)
    expect(diarioDe(normalizar({ presupuesto_semanal: 100 }))).toBe(0)
  })

  it("limpia la cuenta publicitaria y los días", () => {
    const c = normalizar({ cuenta: "act_734227081734669", dias: 99 })
    expect(c.cuenta).toBe("734227081734669")
    expect(c.dias).toBe(14)
  })
})
