import { normalizarPaquetes, paquetesDe } from "../paquetes-servicio"

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
