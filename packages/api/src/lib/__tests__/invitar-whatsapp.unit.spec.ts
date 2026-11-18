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
    expect(IA_MODELO_WHATSAPP(new Date("2026-12-02T12:00:00Z"))).toBe("claude-sonnet-5-5")
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

import { assEstudio, FORMULAS, PERSONAJES, promptEscena, tocaNovela } from "../fabrica/estudio"
describe("Estudio diario", () => {
  it("novela martes, jueves y sábado", () => {
    expect(tocaNovela(new Date("2026-11-17T18:00:00Z"))).toBe(true) // martes
    expect(tocaNovela(new Date("2026-11-16T18:00:00Z"))).toBe(false) // lunes
  })
  it("cada escena lleva cámara distinta y la descripción fija del personaje", () => {
    const a = promptEscena({ toma: "Don Chuy checks a part", personajes: ["Don Chuy"] }, 0)
    const b = promptEscena({ toma: "Don Chuy checks a part", personajes: ["Don Chuy"] }, 1)
    expect(a.video).not.toBe(b.video)
    expect(a.imagen).toContain(PERSONAJES[0].visual)
    expect(a.imagen).toContain("No text")
  })
  it("el gancho y la CTA salen en pantalla", () => {
    const ass = assEstudio([{ texto: "hola mundo", inicio: 0.1, fin: 2 }], "Tu fresa se quema", { texto: "Cotiza gratis", inicio: 2, fin: 4 })
    expect(ass).toContain("TU FRESA SE QUEMA")
    expect(ass).toContain("hetnacnc.com")
    expect(FORMULAS.titulares.length).toBe(10)
  })
})

import { dondeSeVan, idYoutube, vecesSobreMedia } from "../fabrica/estudio-datos"
describe("agentes de datos del Estudio", () => {
  it("tendencia: veces sobre la media del canal", () => {
    expect(vecesSobreMedia(120000, 1_000_000, 100)).toEqual({ media: 10000, veces: 12 })
    expect(vecesSobreMedia(10, 0, 0).veces).toBe(0)
  })
  it("retención: encuentra la caída más fuerte y el segundo", () => {
    const r = dondeSeVan([[0, 1], [0.1, 0.55], [0.5, 0.45], [1, 0.3]], 30)
    expect(r).toEqual({ segundo: 3, caida: 45, al_final: 30 })
  })
  it("saca el id del video de YouTube", () => {
    expect(idYoutube({ url: "https://youtube.com/shorts/abcdefghijk" })).toBe("abcdefghijk")
    expect(idYoutube({ id: "abcdefghijk" })).toBe("abcdefghijk")
  })
})
