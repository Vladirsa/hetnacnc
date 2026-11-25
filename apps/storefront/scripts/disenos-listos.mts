// Imágenes y medidas de los Diseños listos (src/lib/disenos-listos/catalogo.ts).
//
//   cd apps/storefront && npx tsx scripts/disenos-listos.mts
//
// Para cada diseño arma la pieza con el mismo motor de la herramienta y deja:
//   - public/disenos-listos/<handle>.png: vista en perspectiva (foto del producto)
//   - src/lib/disenos-listos/datos.json: medidas, volumen y valores completos,
//     que el API usa para el precio por gramaje (publicar-disenos-listos.ts)
// Se puede correr las veces que sea: rehace todo igual.
import { mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

import { DISENOS_LISTOS } from "../src/lib/disenos-listos/catalogo"
import { construirMalla, limpiarValores, modeloPorId, valoresIniciales } from "../src/lib/generador/modelos3d"

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const { default: Module } = await import("manifold-3d")
const wasm: any = await Module({ locateFile: () => join(raiz, "node_modules/manifold-3d/manifold.wasm") })
wasm.setup()

/** Volumen (cm³) de una malla cerrada: suma de tetraedros con el origen. */
function volumenCm3(t: number[]) {
  let v = 0
  for (let i = 0; i < t.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.slice(i, i + 9)
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  return Math.abs(v) / 6 / 1000
}

/**
 * Vista isométrica con sombreado plano y búfer de profundidad (sin navegador):
 * se dibuja al doble de tamaño y se reduce, para bordes suaves.
 */
async function vistaPng(t: number[], lado = 1000, color = [194, 86, 10]) {
  const S = lado * 2
  const a = Math.PI / 4, b = Math.atan(1 / Math.SQRT2)
  const giro = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * Math.cos(a) - y * Math.sin(a), y1 = x * Math.sin(a) + y * Math.cos(a)
    return [x1, y1 * Math.sin(b) + z * Math.cos(b), y1 * Math.cos(b) - z * Math.sin(b)] // [x, y arriba, profundidad]
  }
  const pts: [number, number, number][] = []
  for (let i = 0; i < t.length; i += 3) pts.push(giro(t[i], t[i + 1], t[i + 2]))
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  const margen = S * 0.1
  const k = (S - 2 * margen) / Math.max(x1 - x0, y1 - y0)
  const ox = (S - (x1 - x0) * k) / 2, oy = (S - (y1 - y0) * k) / 2
  const px = (p: [number, number, number]) => [ox + (p[0] - x0) * k, S - oy - (p[1] - y0) * k, p[2]]
  const fondo = [247, 245, 239]
  const img = Buffer.alloc(S * S * 3)
  for (let i = 0; i < S * S; i++) img.set(fondo, i * 3)
  const prof = new Float32Array(S * S).fill(Infinity)
  const luz = [-0.4, 0.5, 0.75], nl = Math.hypot(...luz)
  for (let i = 0; i < t.length; i += 9) {
    const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2]
    const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const ln = Math.hypot(nx, ny, nz) || 1
    nx /= ln; ny /= ln; nz /= ln
    const c = 0.42 + 0.58 * Math.max(0, (nx * luz[0] + ny * luz[1] + nz * luz[2]) / nl)
    const rgb = color.map((v) => Math.round(Math.min(255, v * c + 25 * c)))
    const [A, B, C] = [px(pts[i / 3]), px(pts[i / 3 + 1]), px(pts[i / 3 + 2])]
    const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
    if (Math.abs(d) < 1e-9) continue
    const xa = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), xb = Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], C[0])))
    const ya = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), yb = Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], C[1])))
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const l1 = ((B[1] - C[1]) * (x + 0.5 - C[0]) + (C[0] - B[0]) * (y + 0.5 - C[1])) / d
        const l2 = ((C[1] - A[1]) * (x + 0.5 - C[0]) + (A[0] - C[0]) * (y + 0.5 - C[1])) / d
        const l3 = 1 - l1 - l2
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue
        const z = l1 * A[2] + l2 * B[2] + l3 * C[2]
        const o = y * S + x
        if (z >= prof[o]) continue
        prof[o] = z
        img.set(rgb, o * 3)
      }
  }
  return sharp(img, { raw: { width: S, height: S, channels: 3 } }).resize(lado, lado).png({ compressionLevel: 9 }).toBuffer()
}

const datos = []
mkdirSync(join(raiz, "public/disenos-listos"), { recursive: true })
for (const d of DISENOS_LISTOS) {
  const m = modeloPorId(d.modelo)
  if (!m) throw new Error(`No existe el modelo ${d.modelo} (${d.handle})`)
  const valores = limpiarValores(m, { ...valoresIniciales(m), ...(d.valores || {}) })
  const malla = await construirMalla(m, valores, wasm)
  if (!malla.cerrado) throw new Error(`${d.handle}: la malla no salió cerrada`)
  const png = await vistaPng(malla.tris)
  writeFileSync(join(raiz, "public/disenos-listos", `${d.handle}.png`), png)
  const volumen = volumenCm3(malla.tris)
  datos.push({
    handle: d.handle,
    herramienta: d.herramienta,
    modelo: d.modelo,
    nombre: d.nombre || m.nombre,
    texto: m.texto,
    valores,
    material: d.material,
    dias: d.dias,
    medidas_mm: malla.medidas.map((x) => Math.round(x * 10) / 10),
    volumen_cm3: Math.round(volumen * 100) / 100,
  })
  console.log(`${d.handle}: ${malla.medidas.map((x) => Math.round(x)).join("×")} mm, ${volumen.toFixed(1)} cm³, imagen ${Math.round(png.length / 1024)} KB`)
}
writeFileSync(join(raiz, "src/lib/disenos-listos/datos.json"), JSON.stringify(datos, null, 2) + "\n")
console.log(`Listo: ${datos.length} diseños`)
