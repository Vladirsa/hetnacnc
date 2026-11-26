import { generarModeloPaquete, normalizarPaquetes, paquetesDe } from "../paquetes-servicio"

const base = { titulo: "Vectorizar logo para corte", desde: 350, entrega_dias: 2, descripcion: "Te entrego DXF y SVG listos para láser.", categoria: "diseno-2d-3d" }

describe("Servicios con precio «desde» de los diseñadores", () => {
  it("limpia y pone id", () => {
    const [p] = normalizarPaquetes([base])
    expect(p).toMatchObject({ titulo: base.titulo, desde: 350, entrega_dias: 2, categoria: "diseno-2d-3d" })
    expect(p.id).toMatch(/^paq_[a-f0-9]{12}$/)
    expect(normalizarPaquetes([{ ...base, id: p.id }])[0].id).toBe(p.id)
  })
  it("categoría desconocida va a «otro»; días vacíos se aceptan", () => {
    expect(normalizarPaquetes([{ ...base, categoria: "x", entrega_dias: "" }])[0]).toMatchObject({ categoria: "otro", entrega_dias: null })
  })
  it("rechaza precio fuera de rango, sin nombre o con contacto", () => {
    expect(() => normalizarPaquetes([{ ...base, desde: 10 }])).toThrow(/desde/)
    expect(() => normalizarPaquetes([{ ...base, titulo: "x" }])).toThrow(/nombre/)
    expect(() => normalizarPaquetes([{ ...base, descripcion: "escríbeme a juan@gmail.com" }])).toThrow(/contacto/)
    expect(() => normalizarPaquetes([{ ...base, descripcion: "Referencia 222 123 4567" }])).toThrow(/teléfono/)
  })
  it("máximo 12 y lo guardado mal no truena la página", () => {
    expect(() => normalizarPaquetes(Array(13).fill(base))).toThrow(/12/)
    expect(paquetesDe({ paquetes: [{ titulo: "x" }] })).toEqual([])
    expect(paquetesDe(null)).toEqual([])
  })
})

jest.mock("../fabrica", () => ({ subir: jest.fn(async (_s: any, nombre: string) => `https://cdn.hetnacnc.com/${nombre}`) }))

// Cubo de 12 triángulos en STL binario
function cuboStl() {
  const v = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map((p) => p.map((x) => x * 10))
  const caras = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]
  const buf = Buffer.alloc(84 + caras.length * 50)
  buf.writeUInt32LE(caras.length, 80)
  caras.forEach((c, i) => c.forEach((k, j) => v[k].forEach((x, e) => buf.writeFloatLE(x, 84 + i * 50 + 12 + j * 12 + e * 4))))
  return buf
}

describe("Muestra 3D de un servicio", () => {
  it("guarda sólo ligas de muestras de HETNA", () => {
    const ok = "https://cdn.hetnacnc.com/modelo3d-sel01-ab12cd34ef.stl"
    expect(normalizarPaquetes([{ ...base, modelo_3d: ok }])[0].modelo_3d).toBe(ok)
    expect(normalizarPaquetes([{ ...base, modelo_3d: "https://otro.com/pieza.stl" }])[0].modelo_3d).toBeNull()
    expect(normalizarPaquetes([{ ...base, modelo_3d: "javascript:alert(1)" }])[0].modelo_3d).toBeNull()
  })
  it("de un STL sube una muestra modelo3d-….stl; lo que no es STL se rechaza", async () => {
    const url = await generarModeloPaquete({}, "sel_01ABC", cuboStl())
    expect(url).toMatch(/modelo3d-sel_01ABC-[a-f0-9]{10}\.stl$/)
    await expect(generarModeloPaquete({}, "sel_01ABC", Buffer.from("hola, no soy un stl"))).rejects.toThrow()
  })
})
