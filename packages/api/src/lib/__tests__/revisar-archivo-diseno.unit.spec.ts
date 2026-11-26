import { zipSync } from "fflate"

import { problemaArchivoDiseno, problemaSTL } from "../revisar-archivo-diseno"
import { stlBinario } from "../vista-3d-auto"

const tri = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 0, 0, 10, 0, 0, 0, 10])
const stlBueno = stlBinario(tri)
const stlAscii = Buffer.from("solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x\n")

function zip(archivos: Record<string, Buffer>) {
  const e: Record<string, Uint8Array> = {}
  for (const [n, b] of Object.entries(archivos)) e[n] = new Uint8Array(b)
  return Buffer.from(zipSync(e, { level: 6 }))
}

describe("revisar archivo de diseño", () => {
  it("STL binario y ASCII sanos pasan", () => {
    expect(problemaSTL(stlBueno)).toBeNull()
    expect(problemaSTL(stlAscii)).toBeNull()
    expect(problemaArchivoDiseno("pieza.stl", stlBueno)).toBeNull()
  })

  it("STL cortado o vacío se rechaza", () => {
    expect(problemaArchivoDiseno("pieza.stl", stlBueno.subarray(0, 100))).toMatch(/STL/)
    expect(problemaArchivoDiseno("pieza.stl", Buffer.alloc(10))).toMatch(/STL/)
    expect(problemaArchivoDiseno("pieza.stl", Buffer.alloc(84))).toMatch(/STL/)
  })

  it("ZIP sano pasa y otros formatos no se revisan", () => {
    const b = zip({ "a.step": Buffer.from("x".repeat(5000)), "b.stl": stlBueno, "LEEME.txt": Buffer.from("hola") })
    expect(problemaArchivoDiseno("diseno.zip", b)).toBeNull()
    expect(problemaArchivoDiseno("plano.dxf", Buffer.from("cualquier cosa"))).toBeNull()
  })

  it("ZIP con el STL dañado se rechaza y dice cuál", () => {
    const relleno = Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 7919) % 251))
    const b = zip({ "a.step": Buffer.from("x".repeat(5000)), "b.stl": Buffer.concat([stlBueno, relleno]) })
    // Daña los datos comprimidos de b.stl
    const i = b.indexOf("b.stl") + 5
    for (let k = i + 4; k < i + 30; k++) b[k] ^= 0xff
    const r = problemaArchivoDiseno("diseno.zip", b)
    expect(r).toMatch(/dañado|incompleto/)
  })

  it("ZIP con un STL sin triángulos se rechaza", () => {
    const b = zip({ "b.stl": Buffer.alloc(84) })
    expect(problemaArchivoDiseno("diseno.zip", b)).toMatch(/b\.stl/)
  })

  it("ZIP vacío se rechaza", () => {
    expect(problemaArchivoDiseno("diseno.zip", zip({}))).toMatch(/vacío/)
  })
})
