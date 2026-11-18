import { limpiarTextoRed, sinLigasCrudas, tieneBasura } from "../limpiar-texto"

describe("limpieza de textos de la IA antes de publicar", () => {
  it("quita el encabezado 'Texto de la publicación' y el markdown", () => {
    const t = limpiarTextoRed("**Texto de la publicación:**\n\n¿Tienes router CNC? 👇\n\n🔩 **Organizador de brocas.** STL listo.\n\n#CNC")
    expect(t).toBe("¿Tienes router CNC? 👇\n\n🔩 Organizador de brocas. STL listo.\n\n#CNC")
    expect(tieneBasura(t)).toBe(false)
  })
  it("quita la nota interna y el guion de diapositivas", () => {
    const t = limpiarTextoRed("**Nota antes de publicar:** El contexto no incluye ningún caso real.\n\n---\n\n**Publicación (Instagram Reel)**\n\nYour motor mount shouldn't take 6 weeks.")
    expect(t).toBe("Your motor mount shouldn't take 6 weeks.")
    const c = limpiarTextoRed("**CARRUSEL – Instagram (7 diapositivas)**\n\n**Diapositiva 1 (portada)**\n🏆 RANKING\n\n---\n\n**Texto de la publicación:**\n\nEl ranking de talleres está por estrenar. {{liga}}")
    expect(c).toBe("El ranking de talleres está por estrenar. {{liga}}")
  })
  it("detecta lo que no debe salir y cambia ligas crudas en Instagram", () => {
    expect(tieneBasura("**Diapositiva 2** algo")).toBe(true)
    expect(tieneBasura("Regístrate aquí 👉 {{liga}}")).toBe(true)
    expect(tieneBasura("Cotiza gratis en hetnacnc.com")).toBe(false)
    expect(sinLigasCrudas("Cotiza aquí 👉 https://hetnacnc.com/r/abc")).toBe("Cotiza aquí 👉 liga en la bio")
  })
})
