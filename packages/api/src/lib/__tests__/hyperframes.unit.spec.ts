import { acomodarTitulo, bloquesBasicos, componer, cuatroPalabras, gruposSubtitulo, iconoPara, paraVoz, revisar, sanearBloques } from "../fabrica/hyperframes"

describe("videos HyperFrames", () => {
  it("deja máximo 4 palabras en pantalla y conserva la pregunta", () => {
    expect(cuatroPalabras("¿Cuánto cobrar por un corte láser en tu taller?")).toBe("¿Cuánto cobrar corte láser?")
    expect(cuatroPalabras("tu taller pierde trabajos").split(" ").length).toBeLessThanOrEqual(4)
    expect(cuatroPalabras("recibe trabajos")).toBe("Recibe trabajos")
  })

  it("el título cabe en 920 px", () => {
    const { lineas, tam } = acomodarTitulo("¿Cuánto cobrar por láser?")
    expect(lineas.length).toBe(2)
    expect(Math.max(...lineas.map((l) => l.length)) * tam * 0.52).toBeLessThan(920)
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
    expect(revisar('{"ok":false,"errors":[{"message":"falta"}]}')).toEqual(["falta"])
  })
})
