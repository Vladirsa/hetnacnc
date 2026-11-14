import { casoPublico, leerCaso } from "../casos-reales"
import { leerEjemplo } from "../ajustes-sitio"

describe("trabajos reales y ejemplo de cotización", () => {
  const base = { titulo: "Letrero MDF", foto_url: "https://hetnacnc.com/static/a.webp" }

  it("no publica sin permiso del cliente", () => {
    expect(leerCaso({ ...base, publicado: true })).toEqual({ error: "Sólo se publica con permiso del cliente." })
    const ok = leerCaso({ ...base, publicado: true, permiso_cliente: true })
    expect("datos" in ok && ok.datos.publicado).toBe(true)
  })

  it("pide título y foto https", () => {
    expect("error" in leerCaso({ foto_url: base.foto_url })).toBe(true)
    expect("error" in leerCaso({ titulo: "x", foto_url: "http://inseguro/a.jpg" })).toBe(true)
    expect("error" in leerCaso({ titulo: "x", foto_url: "javascript:alert(1)" })).toBe(true)
  })

  it("lo público no trae permiso ni banderas internas", () => {
    const p = casoPublico({ id: "c1", ...base, permiso_cliente: true, publicado: true, orden: 3 })
    expect(Object.keys(p).sort()).toEqual(["ciudad", "foto_url", "id", "material", "tiempo_entrega", "tipo_trabajo", "titulo"])
  })

  it("ejemplo: vacío lo quita, incompleto avisa", () => {
    expect(leerEjemplo({})).toEqual({ valor: null })
    expect("error" in leerEjemplo({ pieza: "Placa" })).toBe(true)
    const r = leerEjemplo({ pieza: "Placa", precio: "$1,800 a $2,400", tiempo: "5 días" })
    expect("valor" in r && r.valor?.pieza).toBe("Placa")
  })
})
