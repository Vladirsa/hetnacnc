// Genera docs/impresion-bajo-pedido/catalogo.json desde
// src/lib/impresion/catalogo-disenos.ts: corre el mismo Texturizador de la
// página para cada diseño y guarda el volumen (cm³) y las medidas (mm) de la
// pieza, de donde salen los gramos y el precio recomendado de cada material.
//
// Uso (en apps/storefront):
//   FUENTES_DIR=/ruta/con/@fontsource OPENTYPE_JS=/ruta/opentype.js/dist/opentype.js npx tsx scripts/generar-catalogo-impresion.ts
// FUENTES_DIR tiene una carpeta por tipografía con sus archivos .woff, como en
// el paquete de npm (montserrat/files/montserrat-latin-800-normal.woff).
// Las fotos de los rodillos y placas se toman aparte con el navegador (ver
// docs/impresion-bajo-pedido/README.md); las de las piezas de Modelos 3D las
// dibuja este script (vista isométrica) en docs/impresion-bajo-pedido/fotos.
//
// SOLO_MODELOS=1: rehace sólo las piezas de Modelos 3D y deja como están en
// catalogo.json los rodillos y placas (no hacen falta las tipografías).
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import sharp from "sharp"

import { FUENTES } from "@/lib/generador/fuentes"
import { hacerRodillo, hacerSoporte, hacerTexturizador } from "@/lib/generador/texturizador"
import { CATALOGO_IMPRESION, urlHerramienta, type DisenoCatalogo } from "@/lib/impresion/catalogo-disenos"
import { construirMalla, limpiarValores, modeloPorId, valoresIniciales } from "@/lib/generador/modelos3d"

// La página baja opentype.js del CDN; aquí se usa una copia local (OPENTYPE_JS=ruta a dist/opentype.js)
// Se carga hasta que hace falta: con SOLO_MODELOS no se necesita
let opentypeCargado: any = null
const opentype = {
  parse: (b: ArrayBuffer) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    opentypeCargado ??= require(process.env.OPENTYPE_JS || "opentype.js")
    return opentypeCargado.parse(b)
  },
}

const DIR = process.env.FUENTES_DIR || ""
const SALIDA = resolve(__dirname, "../../../docs/impresion-bajo-pedido/catalogo.json")
const FOTOS = resolve(__dirname, "../../../docs/impresion-bajo-pedido/fotos")
const SOLO_MODELOS = process.env.SOLO_MODELOS === "1"

/**
 * Foto de una pieza de Modelos 3D: vista isométrica con sombreado plano y
 * búfer de profundidad, dibujada al doble y reducida (bordes suaves).
 */
async function fotoPieza(t: number[], lado = 1000, color = [194, 86, 10]) {
  const S = lado * 2
  const a = Math.PI / 4, b = Math.atan(1 / Math.SQRT2)
  const giro = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * Math.cos(a) - y * Math.sin(a), y1 = x * Math.sin(a) + y * Math.cos(a)
    return [x1, y1 * Math.sin(b) + z * Math.cos(b), y1 * Math.cos(b) - z * Math.sin(b)]
  }
  const pts: [number, number, number][] = []
  for (let i = 0; i < t.length; i += 3) pts.push(giro(t[i], t[i + 1], t[i + 2]))
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  const k = (S * 0.8) / Math.max(x1 - x0, y1 - y0)
  const ox = (S - (x1 - x0) * k) / 2, oy = (S - (y1 - y0) * k) / 2
  const px = (p: [number, number, number]) => [ox + (p[0] - x0) * k, S - oy - (p[1] - y0) * k, p[2]]
  const img = Buffer.alloc(S * S * 3)
  for (let i = 0; i < S * S; i++) img.set([247, 245, 239], i * 3)
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
        if (l1 < -1e-6 || l2 < -1e-6 || 1 - l1 - l2 < -1e-6) continue
        const z = l1 * A[2] + l2 * B[2] + (1 - l1 - l2) * C[2]
        const o = y * S + x
        if (z >= prof[o]) continue
        prof[o] = z
        img.set(rgb, o * 3)
      }
  }
  return sharp(img, { raw: { width: S, height: S, channels: 3 } }).resize(lado, lado).png({ compressionLevel: 9 }).toBuffer()
}

let wasm: any = null
async function mallaModelo(d: DisenoCatalogo) {
  const m = modeloPorId(d.modelo || "")
  if (!m) throw new Error(`${d.handle}: no existe el modelo ${d.modelo}`)
  if (!wasm) {
    const { default: Module } = await import("manifold-3d")
    wasm = await Module({ locateFile: () => resolve(__dirname, "../node_modules/manifold-3d/manifold.wasm") })
    wasm.setup()
  }
  const malla = await construirMalla(m, limpiarValores(m, { ...valoresIniciales(m), ...(d.valores || {}) }), wasm)
  if (!malla.cerrado) throw new Error(`${d.handle}: la malla no salió cerrada`)
  return malla.tris
}

const previos: any[] = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, "utf8")) : []

function fuente(id: string) {
  const t = FUENTES.find((f) => f.id === id)
  if (!t) throw new Error(`No existe la tipografía ${id}`)
  const ruta = join(DIR, t.id, "files", `${t.id}-latin-${t.peso}-normal.woff`)
  if (!existsSync(ruta)) throw new Error(`Falta ${ruta} (FUENTES_DIR)`)
  const b = readFileSync(ruta)
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

/** Volumen (cm³) y caja (mm) de una malla cerrada. */
function medir(t: number[]) {
  let v = 0
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < t.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.slice(i, i + 9)
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
    for (let k = 0; k < 9; k++) {
      const j = k % 3
      if (t[i + k] < min[j]) min[j] = t[i + k]
      if (t[i + k] > max[j]) max[j] = t[i + k]
    }
  }
  const r1 = (n: number) => Math.round(n * 10) / 10
  return { volumen_cm3: r1(Math.abs(v) / 1000), medidas_mm: [0, 1, 2].map((j) => r1(max[j] - min[j])) as [number, number, number] }
}

async function generar() {
const salida: any[] = []
for (const d of CATALOGO_IMPRESION) {
  if (d.pieza === "modelo") {
    const tris = await mallaModelo(d)
    const m = medir(tris)
    writeFileSync(join(FOTOS, `${d.handle}.png`), await fotoPieza(tris))
    console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${m.medidas_mm.join(" × ")} mm (foto lista)`)
    salida.push({ handle: d.handle, titulo: d.titulo, resumen: d.resumen, pieza: d.pieza, etiquetas: d.etiquetas, herramienta_url: urlHerramienta(d), foto: `fotos/${d.handle}.png`, modelo: d.modelo, valores: d.valores || {}, ...m })
    continue
  }
  if (SOLO_MODELOS) {
    const previo = previos.find((x) => x.handle === d.handle)
    if (!previo) throw new Error(`${d.handle} no está en catalogo.json: corre sin SOLO_MODELOS (con FUENTES_DIR)`)
    salida.push(previo)
    continue
  }
  const o = d.diseno as any
  const f = o.palabras?.length ? fuente(o.fuente || "montserrat") : null
  const comun = { palabras: o.palabras || [], iconos: o.iconos || [], tamano: o.tamano, espacioX: o.espacioX, espacioY: o.espacioY, acomodo: o.acomodo, orilla: o.orilla, relieve: o.relieve, modo: o.modo || "alto", espejo: o.espejo }
  let tris: number[]
  let avisos: string[] = []
  if (d.pieza === "soporte") {
    const r = hacerRodillo(f, { ...comun, modo: "alto", diametro: o.diametro, largo: o.largo, eje: o.eje })
    tris = hacerSoporte(o.eje, o.largo, Math.ceil(r.diametroTotal + 10)).tris
  } else if (o.forma === "rodillo") {
    const r = hacerRodillo(f, { ...comun, modo: "alto", diametro: o.diametro, largo: o.largo, eje: o.eje })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    tris = r.malla.tris
    avisos = r.avisos
  } else {
    const r = hacerTexturizador(f, { ...comun, ancho: o.ancho, alto: o.alto, radio: o.radio, grosor: o.grosor })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    tris = r.malla.tris
    avisos = r.avisos
  }
  const m = medir(tris)
  console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${m.medidas_mm.join(" × ")} mm${avisos.length ? ` — ${avisos.join(" ")}` : ""}`)
  salida.push({
    handle: d.handle,
    titulo: d.titulo,
    resumen: d.resumen,
    pieza: d.pieza,
    etiquetas: d.etiquetas,
    herramienta_url: urlHerramienta(d),
    foto: `fotos/${d.handle}.png`,
    diseno: d.diseno,
    ...m,
  })
}
writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + "\n")
console.log(`\n${salida.length} diseños → ${SALIDA}`)
}

generar().catch((e) => {
  console.error(e)
  process.exit(1)
})
