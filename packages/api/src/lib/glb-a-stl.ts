// Convierte un GLB (glTF binario) a STL binario, sin librerías: lee las mallas
// de la escena con sus transformaciones y escribe los triángulos.
//
// Sirve para los modelos de Tencent HY 3D, que llegan en GLB con textura:
// el visor usa el GLB y el taller se lleva el STL para imprimir o maquinar.
// El glTF va con Y hacia arriba; el STL sale con Z hacia arriba (lo que
// esperan los laminadores y el CAM) y escalado en milímetros.
//
// No soporta mallas comprimidas (Draco / meshopt): en ese caso regresa null y
// el escaneo queda sólo con GLB.

type Mat = number[] // 4x4, columna mayor (como glTF)

const IDENT: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function mult(a: Mat, b: Mat): Mat {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}

function trs(n: any): Mat {
  if (Array.isArray(n.matrix) && n.matrix.length === 16) return n.matrix
  const [tx, ty, tz] = n.translation || [0, 0, 0]
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale || [1, 1, 1]
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

export type ResultadoStl = {
  stl: Buffer
  triangulos: number
  vertices: number
  caja_mm: [number, number, number]
}

/** ladoMayorMm: a cuánto se escala el lado más largo de la pieza. */
export function glbAStl(glb: Buffer, ladoMayorMm = 100): ResultadoStl | null {
  if (glb.length < 20 || glb.readUInt32LE(0) !== 0x46546c67) return null
  let json: any = null
  let bin: Buffer | null = null
  let p = 12
  while (p + 8 <= glb.length) {
    const largo = glb.readUInt32LE(p)
    const tipo = glb.readUInt32LE(p + 4)
    const datos = glb.subarray(p + 8, p + 8 + largo)
    if (tipo === 0x4e4f534a) json = JSON.parse(datos.toString("utf8"))
    else if (tipo === 0x004e4942) bin = datos
    p += 8 + largo
  }
  if (!json || !bin) return null
  const req: string[] = json.extensionsRequired || []
  if (req.some((e) => /draco|meshopt/i.test(e))) return null

  const leerAccesor = (i: number): { n: number; comp: number; get: (k: number, c: number) => number } | null => {
    const a = json.accessors?.[i]
    if (!a || a.bufferView === undefined || a.sparse) return null
    const bv = json.bufferViews[a.bufferView]
    if ((bv.buffer ?? 0) !== 0) return null
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type as string] || 1
    const tam = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType as number]
    if (!tam) return null
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0)
    const paso = bv.byteStride || comps * tam
    const get = (k: number, c: number) => {
      const o = base + k * paso + c * tam
      switch (a.componentType) {
        case 5126: return bin!.readFloatLE(o)
        case 5125: return bin!.readUInt32LE(o)
        case 5123: return bin!.readUInt16LE(o)
        default: return bin!.readUInt8(o)
      }
    }
    return { n: a.count, comp: comps, get }
  }

  // Junta los triángulos en coordenadas del mundo.
  const tris: number[] = []
  let vertices = 0
  const visitar = (ni: number, padre: Mat) => {
    const nodo = json.nodes?.[ni]
    if (!nodo) return
    const m = mult(padre, trs(nodo))
    const malla = nodo.mesh !== undefined ? json.meshes?.[nodo.mesh] : null
    for (const prim of malla?.primitives || []) {
      if ((prim.mode ?? 4) !== 4 || prim.attributes?.POSITION === undefined) continue
      const pos = leerAccesor(prim.attributes.POSITION)
      if (!pos || pos.comp !== 3) continue
      vertices += pos.n
      const mundo = new Float64Array(pos.n * 3)
      for (let k = 0; k < pos.n; k++) {
        const x = pos.get(k, 0), y = pos.get(k, 1), z = pos.get(k, 2)
        mundo[k * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]
        mundo[k * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
        mundo[k * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
      }
      const idx = prim.indices !== undefined ? leerAccesor(prim.indices) : null
      const total = idx ? idx.n : pos.n
      for (let t = 0; t + 2 < total; t += 3) {
        for (let v = 0; v < 3; v++) {
          const k = idx ? idx.get(t + v, 0) : t + v
          // Y arriba (glTF) → Z arriba (STL): (x, y, z) → (x, -z, y)
          tris.push(mundo[k * 3], -mundo[k * 3 + 2], mundo[k * 3 + 1])
        }
      }
    }
    for (const h of nodo.children || []) visitar(h, m)
  }
  const escena = json.scenes?.[json.scene ?? 0]
  const raices: number[] = escena?.nodes || json.nodes?.map((_: unknown, i: number) => i) || []
  for (const r of raices) visitar(r, IDENT)
  if (tris.length < 9) return null

  // Escala a milímetros y apoya la pieza en Z = 0, centrada en X/Y.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < tris.length; i += 3) for (let c = 0; c < 3; c++) {
    min[c] = Math.min(min[c], tris[i + c]); max[c] = Math.max(max[c], tris[i + c])
  }
  const tam = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const esc = ladoMayorMm / (Math.max(...tam) || 1)
  const centro = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]]

  const n = tris.length / 9
  const stl = Buffer.alloc(84 + n * 50)
  stl.write("HETNA CNC - modelo 3D", 0, "ascii")
  stl.writeUInt32LE(n, 80)
  let o = 84
  const v = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 9; k++) v[k] = (tris[t * 9 + k] - centro[k % 3]) * esc
    const ux = v[3] - v[0], uy = v[4] - v[1], uz = v[5] - v[2]
    const wx = v[6] - v[0], wy = v[7] - v[1], wz = v[8] - v[2]
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l; ny /= l; nz /= l
    stl.writeFloatLE(nx, o); stl.writeFloatLE(ny, o + 4); stl.writeFloatLE(nz, o + 8)
    for (let k = 0; k < 9; k++) stl.writeFloatLE(v[k], o + 12 + k * 4)
    o += 50
  }
  const r2 = (x: number) => Math.round(x * esc * 100) / 100
  return { stl, triangulos: n, vertices, caja_mm: [r2(tam[0]), r2(tam[1]), r2(tam[2])] }
}
