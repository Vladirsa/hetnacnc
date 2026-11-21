import { compensacion, configFase4, listaFase4 } from "../fase4"

describe("fase 4: HETNA responde", () => {
  it("está apagada sin claves", () => {
    expect(configFase4({}).activa).toBe(false)
    expect(listaFase4({}).every((x) => !x.listo)).toBe(true)
  })
  it("lee la configuración del .env", () => {
    const c = configFase4({ FASE4_ACTIVA: "1", FASE4_COMPENSACION_PCT_DIA: "2", FASE4_EXPRES_PCT: "25", FASE4_CREDITO_DIAS: "30" })
    expect(c).toMatchObject({ activa: true, compensacionPctDia: 2, compensacionTopePct: 20, expresPct: 25 })
  })
  it("compensación por días de retraso con tope", () => {
    expect(compensacion(1000, 0, 2, 20)).toBe(0)
    expect(compensacion(1000, 3, 2, 20)).toBe(60)
    expect(compensacion(1000, 30, 2, 20)).toBe(200)
    expect(compensacion(1000, 3, null, 20)).toBe(0)
  })
})
