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

import { textoPin } from "../pinterest"
describe("Pinterest", () => {
  it("arma título y descripción del pin sin ligas sueltas y dentro de los límites", () => {
    const t = textoPin("Regalos de Navidad hechos en láser\n\nMira más: https://hetnacnc.com/r/abc", "")
    expect(t.titulo).toBe("Regalos de Navidad hechos en láser")
    expect(t.descripcion).not.toContain("https://")
    expect(textoPin("x".repeat(2000), "y".repeat(300)).titulo.length).toBe(100)
  })
})

import { correoFecha, esDeLaFecha } from "../invitar-temporada"
describe("productos de temporada", () => {
  it("reconoce la fecha sólo con la palabra completa en el nombre", () => {
    expect(esDeLaFecha("Esfera navideña de MDF", "navidad")).toBe(true)
    expect(esDeLaFecha("Letrero Feliz Navidad", "navidad")).toBe(true)
    expect(esDeLaFecha("Plantilla de terreno para router", "navidad")).toBe(false)
    expect(esDeLaFecha("Regalo para el 10 de mayo", "dia_madre")).toBe(true)
  })
  it("el correo invita a publicar con la palabra de la fecha", () => {
    expect(correoFecha({ nombre: "Navidad", clave: "navidad" }, "24 de diciembre")).toContain("«navidad»")
  })
})
