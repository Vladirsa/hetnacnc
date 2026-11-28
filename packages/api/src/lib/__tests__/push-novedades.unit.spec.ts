import { avisoNovedades } from "../push"

// Aviso diario de productos nuevos (jobs/novedades-push.ts)
describe("aviso de productos nuevos", () => {
  it("sin productos no hay aviso", () => {
    expect(avisoNovedades([])).toBeNull()
    expect(avisoNovedades([{ title: "", handle: "x" }])).toBeNull()
  })
  it("uno: su nombre y su ficha", () => {
    expect(avisoNovedades([{ title: "Mapa del Pico de Orizaba", handle: "mapa-pico" }])).toEqual({ titulo: "Nuevo en HETNA", cuerpo: "Mapa del Pico de Orizaba", url: "/mx/products/mapa-pico", etiqueta: "novedades" })
  })
  it("varios: cuántos, los primeros tres y la página de novedades", () => {
    const a = avisoNovedades(["A", "B", "C", "D", "E"].map((t) => ({ title: t, handle: t.toLowerCase() })))!
    expect(a.titulo).toBe("5 productos nuevos en HETNA")
    expect(a.cuerpo).toBe("A, B, C y 2 más")
    expect(a.url).toBe("/mx/novedades")
  })
})
