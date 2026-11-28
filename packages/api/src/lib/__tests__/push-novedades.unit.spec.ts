import { avisoNovedades, endpointDePush } from "../push"

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

describe("dirección de la suscripción", () => {
  it("sólo servicios de avisos de los navegadores", () => {
    expect(endpointDePush("https://fcm.googleapis.com/fcm/send/abc")).toBe(true)
    expect(endpointDePush("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true)
    expect(endpointDePush("https://web.push.apple.com/QG")).toBe(true)
    expect(endpointDePush("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true)
    expect(endpointDePush("https://evil.com/fcm.googleapis.com")).toBe(false)
    expect(endpointDePush("https://fcm.googleapis.com.evil.com/x")).toBe(false)
    expect(endpointDePush("http://fcm.googleapis.com/x")).toBe(false)
    expect(endpointDePush("https://fcm.googleapis.com:8443/x")).toBe(false)
    expect(endpointDePush("https://169.254.169.254/latest")).toBe(false)
  })
})
