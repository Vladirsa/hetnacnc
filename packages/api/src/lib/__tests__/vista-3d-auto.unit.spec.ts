import { zipSync } from "fflate"

import { leerSTL, simplificar, stlBinario, stlDe } from "../vista-3d-auto"

// Esfera de muchos triángulos (malla de prueba)
function esfera(seg: number): Float32Array {
  const p = (i: number, j: number) => {
    const t = (i / seg) * Math.PI, f = (j / seg) * 2 * Math.PI
    return [Math.sin(t) * Math.cos(f) * 50, Math.sin(t) * Math.sin(f) * 50, Math.cos(t) * 50]
  }
  const out: number[] = []
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < seg; j++) {
      const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1)
      out.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
  return new Float32Array(out)
}

describe("vista previa 3D automática", () => {
  it("lee el STL binario que escribe y conserva los triángulos", () => {
    const t = esfera(10)
    const leido = leerSTL(stlBinario(t))
    expect(leido.length).toBe(t.length)
    expect(leido[5]).toBeCloseTo(t[5], 3)
  })

  it("lee STL ASCII", () => {
    const ascii = "solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x"
    expect(leerSTL(Buffer.from(ascii)).length).toBe(9)
  })

  it("simplifica una malla grande por debajo del tope y conserva el tamaño", () => {
    const t = esfera(200) // 80 000 triángulos
    const s = simplificar(t, 8000)
    expect(s.length / 9).toBeLessThanOrEqual(8000)
    expect(s.length / 9).toBeGreaterThan(500)
    let max = 0
    for (let i = 0; i < s.length; i++) max = Math.max(max, Math.abs(s[i]))
    expect(max).toBeGreaterThan(40)
    expect(max).toBeLessThanOrEqual(50.01)
  })

  it("también degrada una malla chica: nunca sube el original", () => {
    const t = esfera(30) // 1 800 triángulos, menos que el tope
    const s = simplificar(t, 8000)
    expect(s).not.toBe(t)
    expect(s.length / 9).toBeLessThanOrEqual(900)
    expect(s.length / 9).toBeGreaterThan(50)
  })

  it("saca el STL más grande de un ZIP y nada si no hay STL", () => {
    const grande = stlBinario(esfera(20)), chico = stlBinario(esfera(4))
    const zip = Buffer.from(zipSync({ "a.stl": new Uint8Array(chico), "carpeta/b.STL": new Uint8Array(grande), "leeme.txt": new Uint8Array([65]) }))
    expect(stlDe("originales/x/paquete.zip", zip)?.length).toBe(grande.length)
    expect(stlDe("originales/x/plano.dxf", Buffer.from("x"))).toBeNull()
  })
})

describe("vista previa 3D con modelos enormes", () => {
  it("muestrea y simplifica 1.25 millones de triángulos en poco tiempo", () => {
    const t0 = Date.now()
    const s = simplificar(esfera(790), 8000)
    expect(s.length / 9).toBeLessThanOrEqual(8000)
    expect(Date.now() - t0).toBeLessThan(20000)
  })
})
