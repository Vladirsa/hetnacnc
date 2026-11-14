import { IA_MODELO_WHATSAPP, modeloIA } from "../ia-modelo"
import { correoCliente, correoTaller } from "../invitar-whatsapp"

describe("invitación a verificar WhatsApp y modelos de IA", () => {
  it("los correos llevan su botón al lugar correcto y explican BAJA", () => {
    expect(correoTaller("Taller Uno")).toContain("/verificacion")
    expect(correoCliente()).toContain("/mx/user/settings")
    expect(correoTaller()).toContain("BAJA")
  })
  it("el agente usa Sonnet hasta el 1 de diciembre y luego el modelo general", () => {
    delete process.env.IA_MODELO_WHATSAPP
    delete process.env.IA_MODELO
    expect(IA_MODELO_WHATSAPP(new Date("2026-11-20T12:00:00Z"))).toBe("claude-sonnet-5-5")
    expect(IA_MODELO_WHATSAPP(new Date("2026-12-02T12:00:00Z"))).toBe("claude-haiku-5-5")
  })
  it("Haiku va sin respaldo del servidor; los demás con él", () => {
    expect(modeloIA("claude-haiku-5-5")).toEqual({ model: "claude-haiku-5-5" })
    expect(modeloIA("claude-sonnet-5-5")).toMatchObject({ model: "claude-sonnet-5-5", fallbacks: "default" })
  })
})
