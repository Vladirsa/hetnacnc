import { TEMAS, temaPara, temporadaDe, acomodarTitulo, bloquesBasicos, componer, cuatroPalabras, gruposSubtitulo, iconoPara, paraVoz, revisar, sanearBloques } from "../fabrica/hyperframes"

describe("videos HyperFrames", () => {
  it("deja máximo 4 palabras en pantalla y conserva la pregunta", () => {
    expect(cuatroPalabras("¿Cuánto cobrar por un corte láser en tu taller?")).toBe("¿Cuánto cobrar corte láser?")
    expect(cuatroPalabras("tu taller pierde trabajos").split(" ").length).toBeLessThanOrEqual(4)
    expect(cuatroPalabras("recibe trabajos")).toBe("Recibe trabajos")
    expect(cuatroPalabras("Cotiza gratis y sin comisión.")).toContain("sin comisión")
  })

  it("el título cabe en 920 px", () => {
    const { lineas, tam } = acomodarTitulo("¿Cuánto cobrar por láser?")
    expect(lineas.length).toBe(2)
    expect(Math.max(...lineas.map((l) => l.length)) * tam * 0.6).toBeLessThan(920)
  })

  it("los subtítulos son de una línea y cubren el tiempo de la frase", () => {
    const g = gruposSubtitulo("La calculadora láser de HETNA te da el costo en segundos, gratis.", 2, 4)
    expect(g.every((x) => x.texto.length <= 28)).toBe(true)
    expect(g[0].inicio).toBe(2)
  })

  it("no acepta cifras que no se dicen ni tipos o iconos inexistentes", () => {
    const b = sanearBloques(
      [
        { tipo: "dato", texto: "Ahorra mucho", narracion: "Ahorra tiempo al cotizar", cifra: "70%", icono: "reloj" },
        { tipo: "inventado", texto: "x", narracion: "y" },
        { tipo: "accion", texto: "Calcula gratis ya mismo hoy", narracion: "Calcula gratis", icono: "no-existe" },
      ],
      { texto: "Únete", narracion: "Únete gratis" },
    )
    expect(b[0].tipo).toBe("gancho") // el primero siempre engancha
    expect(b.find((x) => x.cifra)).toBeUndefined()
    expect(b[1].icono).toBe("calculadora")
    expect(b[b.length - 1].tipo).toBe("cierre")
  })

  it("guion sin IA: gancho, escenas sin repetir objeto y cierre", () => {
    const b = bloquesBasicos({ gancho: "¿Tu taller pierde trabajos por no facturar?", frases: ["Muchos clientes piden factura.", "Verifica tus datos fiscales."], cierre: "Recibe trabajos" })
    expect(b.map((x) => x.tipo)).toEqual(["gancho", "accion", "accion", "cierre"])
    expect(new Set(b.slice(0, 3).map((x) => x.icono)).size).toBe(3)
    expect(iconoPara("corte láser")).toBe("laser")
  })

  it("arma la composición con escenas, subtítulos y voz", () => {
    const b = bloquesBasicos({ gancho: "¿Máquina parada?", frases: ["Publica y cotiza sin comisión."], cierre: "Únete gratis" })
    const { html, total } = componer(b, { duraciones: [2, 3, 2.5], voz: "x.wav" })
    expect(total).toBeGreaterThan(7)
    expect(html).toContain('data-composition-id="main"')
    expect(html).toContain('src="assets/voz.wav"')
    expect((html.match(/class="clip escena"/g) || []).length).toBe(3)
    expect(html).not.toContain("cdn.jsdelivr")
  })

  it("la voz dice la marca bien y los avisos no detienen el video", () => {
    expect(paraVoz("Únete en hetnacnc.com")).toContain("hetna ce ene ce, punto com")
    expect(revisar('{"ok":true,"warnings":[{"message":"x"}]}')).toEqual([])
    const r = revisar(JSON.stringify({ ok: false, layout: { ok: false, findings: [{ severity: "error", code: "text_box_overflow", selector: "#e0-t", message: "Text extends" }, { severity: "warning", code: "canvas_overflow" }] } }))
    expect(r).toHaveLength(1)
    expect(r[0]).toContain("text_box_overflow")
  })

  it("cada video puede salir con otro fondo; foto sólo si hay", () => {
    const vistos = new Set(Array.from({ length: 40 }, (_, i) => temaPara(`post_${i}`)))
    expect(vistos.size).toBeGreaterThanOrEqual(4)
    expect(vistos.has("foto")).toBe(false)
    expect(temaPara("post_1")).toBe(temaPara("post_1"))
    const { html } = componer(bloquesBasicos({ gancho: "¿Máquina parada?", frases: [], cierre: "Únete" }), { duraciones: [2, 2], tema: "noche" })
    expect(html).toContain(`--fondo:${TEMAS.noche.fondo}`)
    const sinFoto = componer(bloquesBasicos({ gancho: "x", frases: [], cierre: "y" }), { duraciones: [2, 2], tema: "foto" }).html
    expect(sinFoto).not.toContain('class="foto"')
    expect(sinFoto).toContain(`--fondo:${TEMAS.plano.fondo}`)
  })

  it("fondos de temporada sólo en sus fechas y Comunidad con fondos tranquilos", () => {
    expect(temporadaDe(new Date("2026-09-10T18:00:00Z"))).toEqual(["patrio"])
    expect(temporadaDe(new Date("2026-11-01T18:00:00Z"))).toEqual(["muertos"])
    expect(temporadaDe(new Date("2026-12-24T18:00:00Z"))).toEqual(["navidad"])
    expect(temporadaDe(new Date("2027-01-05T18:00:00Z"))).toEqual(["navidad"])
    expect(temporadaDe(new Date("2026-11-11T18:00:00Z"))).toEqual([])
    const nov = new Date("2026-11-11T18:00:00Z")
    const negocio = new Set(Array.from({ length: 60 }, (_, i) => temaPara(`p${i}`, false, { fecha: nov })))
    expect(negocio.has("navidad") || negocio.has("muertos") || negocio.has("patrio") || negocio.has("salvia")).toBe(false)
    const dic = Array.from({ length: 60 }, (_, i) => temaPara(`p${i}`, false, { fecha: new Date("2026-12-15T18:00:00Z") }))
    expect(dic.filter((t) => t === "navidad").length).toBeGreaterThan(5)
    const com = new Set(Array.from({ length: 60 }, (_, i) => temaPara(`p${i}`, false, { publico: "comunidad", fecha: new Date("2026-12-15T18:00:00Z") })))
    expect([...com].every((t) => ["papel", "salvia", "noche", "pizarron"].includes(t))).toBe(true)
  })
})
