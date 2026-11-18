import { armarRespuesta, leerImagen, normalizar } from "../respuesta-grupos"

describe("respuesta rápida a grupos de Facebook", () => {
  const d = normalizar({ pieza: "Soporte con oreja soldada", medidas: "Base 150 x 60 x 10 mm", material: "Acero A-36", proceso: "Corte plasma + soldadura", ciudad: "León" })

  it("arma la liga con la pieza capturada y la marca de los grupos", () => {
    const { liga } = armarRespuesta(d)
    const u = new URL(liga)
    expect(u.pathname).toBe("/mx/cotizar")
    expect(u.searchParams.get("desde")).toBe("facebook")
    expect(u.searchParams.get("pieza")).toBe("Soporte con oreja soldada")
    expect(u.searchParams.get("material")).toBe("Acero A-36")
    expect(u.searchParams.get("utm_source")).toBe("facebook_grupo")
    expect(u.searchParams.get("utm_campaign")).toBe("leon")
  })

  it("el comentario lleva la liga y la zona; el mensaje al taller, el registro", () => {
    const r = armarRespuesta(d)
    expect(r.comentario).toContain("León")
    expect(r.comentario).toContain(r.liga)
    expect(r.mensaje_taller).toContain("/mx/talleres/unete")
    expect(r.mensaje_taller).toContain("6%")
  })

  it("sin pieza usa un nombre genérico y la cantidad va en medidas", () => {
    const u = new URL(armarRespuesta(normalizar({ cantidad: "20 piezas" })).liga)
    expect(u.searchParams.get("pieza")).toBe("Pieza a la medida")
    expect(u.searchParams.get("medidas")).toBe("Cantidad: 20 piezas")
    expect(u.searchParams.get("utm_campaign")).toBe("sin-ciudad")
  })

  it("sólo acepta imágenes en data URL", () => {
    expect(leerImagen("data:image/png;base64,iVBORw0KGgo=")).toEqual({ tipo: "image/png", datos: "iVBORw0KGgo=" })
    expect(leerImagen("data:text/html;base64,PGh0bWw+")).toBeNull()
    expect(leerImagen("https://example.com/a.png")).toBeNull()
  })
})
