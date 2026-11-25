jest.mock("../planos-catalogo", () => ({ sincronizarProductosPlanos: jest.fn() }))
import { ErrorPlano, normalizarPlano } from "../planos-biblioteca"

const base = {
  slug: "taburete-de-prueba",
  categoria: "Taller",
  nombre: "Taburete de prueba",
  resumen: "Un taburete sencillo para probar.",
  descripcion: "Taburete de triplay para el taller.",
  nivel: "Fácil",
  horas: "1 h",
  piezas: [
    { nombre: "Pata", material: "triplay-18", x0: 0, x1: 18, y0: 0, y1: 300, z0: 0, z1: 450 },
    { nombre: "Asiento", material: "triplay-18", x0: 0, x1: 300, y0: 0, y1: 300, z0: 450, z1: 468 },
  ],
  pasos: [{ titulo: "Armar", nota: "", piezas: ["Pata", "Asiento"] }],
  herrajes: ["Tornillos"],
  herramientas: ["Taladro"],
  notas: [],
}

describe("normalizarPlano", () => {
  it("acepta un plano bien formado y limpia los textos", () => {
    const p = normalizarPlano({ ...base, nombre: "  Taburete   de prueba " })
    expect(p.nombre).toBe("Taburete de prueba")
    expect(p.piezas).toHaveLength(2)
  })
  it("rechaza slugs raros, materiales desconocidos y medidas en cero", () => {
    expect(() => normalizarPlano({ ...base, slug: "../otro" })).toThrow(ErrorPlano)
    expect(() => normalizarPlano({ ...base, slug: "a".repeat(41) })).toThrow(ErrorPlano)
    expect(() => normalizarPlano({ ...base, piezas: [{ ...base.piezas[0], material: "mdf-3" }, base.piezas[1]] })).toThrow(ErrorPlano)
    expect(() => normalizarPlano({ ...base, piezas: [{ ...base.piezas[0], x1: 0 }, base.piezas[1]] })).toThrow(ErrorPlano)
  })
  it("pide categoría Taller o Casa y al menos un paso", () => {
    expect(() => normalizarPlano({ ...base, categoria: "Jardín" })).toThrow(ErrorPlano)
    expect(() => normalizarPlano({ ...base, pasos: [] })).toThrow(ErrorPlano)
  })
})
