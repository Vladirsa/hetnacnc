import { computeTier } from "../../modules/cam/catalog"
import { contarTriangulos, statsVerificadas } from "../../modules/cam/contar-triangulos"

const stlBinario = (n: number) => {
  const b = Buffer.alloc(84 + n * 50)
  b.writeUInt32LE(n, 80)
  return b
}

describe("Triángulos contados en el servidor (precio CAM)", () => {
  it("STL binario, STL de texto y OBJ cuentan como el CAM Lab", () => {
    expect(contarTriangulos(stlBinario(1234), "pieza.STL")).toBe(1234)
    const texto = "solid x\n" + "facet normal 0 0 1\nouter loop\nvertex 0 0 0\nendloop\nendfacet\n".repeat(7) + "endsolid x\n"
    expect(contarTriangulos(Buffer.from(texto), "a.stl")).toBe(7)
    // un triángulo, un cuadrado (2) y un pentágono (3)
    const obj = "v 0 0 0\nf 1 2 3\nf 1/1 2/2 3/3 4/4\nf 1 2 3 4 5\n# f 1 2 3 comentario\n"
    expect(contarTriangulos(Buffer.from(obj), "a.obj")).toBe(6)
    expect(contarTriangulos(Buffer.from("ISO-10303-21;"), "a.step")).toBeNull()
  })

  it("mandar menos triángulos de los reales no baja el nivel", () => {
    const real = 600000
    const s = statsVerificadas({ triangles: 0, minutes: 1, points: 10 }, real)
    expect(s?.triangles).toBe(real)
    expect(s?.triangles_servidor).toBe(real)
    expect(computeTier(s)).toBe("Alta")
  })

  it("al cliente honesto no le cambia nada (mismo número o diferencia mínima)", () => {
    expect(statsVerificadas({ triangles: 150000, minutes: 5 }, 150000)?.triangles).toBe(150000)
    expect(statsVerificadas({ triangles: 150000 }, 151000)?.triangles).toBe(150000)
    expect(statsVerificadas({ triangles: 900 }, null)?.triangles).toBe(900)
    expect(statsVerificadas(null, null)).toBeNull()
    expect(statsVerificadas(null, 5000)?.triangles).toBe(5000)
  })
})
