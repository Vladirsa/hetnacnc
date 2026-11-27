import { contarSugerencia, descripcionSegura, estadoIngles, huellaEs, MAX_SUGERENCIAS_DIA, SIN_INGLES, validarIngles } from "../productos-ingles"

describe("Productos en inglés", () => {
  it("la huella es la misma que usa el script de la traducción inicial", () => {
    expect(huellaEs("Mesa", "<p>Hola</p>")).toBe(huellaEs("Mesa", "<p>Hola</p>"))
    expect(huellaEs("Mesa", "<p>Hola</p>")).not.toBe(huellaEs("Mesa", "<p>Hola.</p>"))
    expect(huellaEs("Mesa", "<p>Hola</p>")).toHaveLength(12)
  })

  it("texto sin etiquetas: párrafos en <p>, saltos en <br> y se escapa", () => {
    expect(descripcionSegura("Primero\nsigue\n\nSegundo 5 > 3")).toBe("<p>Primero<br>sigue</p><p>Segundo 5 &gt; 3</p>")
    expect(descripcionSegura("Uno\n\nDos & tres")).toBe("<p>Uno</p><p>Dos &amp; tres</p>")
  })

  it("HTML: sólo etiquetas permitidas, sin atributos ni scripts", () => {
    const sucio = '<p class="x" onclick="robar()">Hola <strong>mundo</strong></p><script>alert(1)</script><a href="https://otro.com">liga</a><img src=x onerror=alert(1)>'
    expect(descripcionSegura(sucio)).toBe("<p>Hola <strong>mundo</strong></p>liga")
  })

  it("rechaza datos de contacto pero acepta medidas", () => {
    expect(() => validarIngles({ en_title: "Panel 600 x 600 mm", en_description: "Cut from 1220 x 2440 mm sheets" })).not.toThrow()
    expect(() => validarIngles({ en_title: "Table", en_description: "Write me at shop@gmail.com" })).toThrow(/contacto/)
    expect(() => validarIngles({ en_title: "Table", en_subtitle: "visit www.mishop.com" })).toThrow(/contacto/)
  })

  it("límite de largo", () => {
    expect(() => validarIngles({ en_title: "x".repeat(201) })).toThrow(/largo/)
  })

  it("estado: falta, lista o vieja si cambió el español", () => {
    const meta = { en_title: "Table", en_hash: huellaEs("Mesa", "Desc") }
    expect(estadoIngles({ title: "Mesa", description: "Desc", metadata: {} })).toBe("falta")
    expect(estadoIngles({ title: "Mesa", description: "Desc", metadata: meta })).toBe("lista")
    expect(estadoIngles({ title: "Mesa grande", description: "Desc", metadata: meta })).toBe("vieja")
    expect(estadoIngles({ title: "Mesa", description: "Desc", metadata: { en_title: "Table" } })).toBe("lista")
    expect(SIN_INGLES).toBe("sin_ingles")
  })

  it("tope diario de traducciones automáticas por taller", () => {
    const hoy = new Date("2026-11-26T12:00:00Z")
    for (let i = 0; i < MAX_SUGERENCIAS_DIA; i++) contarSugerencia("sel_prueba", hoy)
    expect(() => contarSugerencia("sel_prueba", hoy)).toThrow(/límite/)
    expect(() => contarSugerencia("sel_prueba", new Date("2026-11-27T12:00:00Z"))).not.toThrow()
  })
})
