// Vista previa 3D automática de los diseños digitales (25 nov 2026).
//
// La ficha ya tiene visor 3D: aparece cuando el producto trae
// metadata.vista_previa (un modelo de MUESTRA público; lib/ficha-extendida.ts).
// Antes sólo lo ponía el vendedor a mano. Aquí, para los diseños STL (o ZIP con
// un STL) que no la tienen: se baja el original del bucket privado, se
// SIMPLIFICA fuerte (agrupando vértices en una rejilla, ~8 000 triángulos) y se
// sube sólo esa muestra. El original nunca se expone: la muestra sirve para
// ver la forma, no para fabricar con calidad.
// La corre jobs/vistas-3d.ts.
import { execFileSync } from "child_process"
import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

import { unzipSync } from "fflate"

import { getSignedDownloadUrl } from "./backblaze"
import { subir } from "./fabrica"

export const MAX_TRIANGULOS = Number(process.env.VISTA3D_MAX_TRIANGULOS || 8000)
// Sube cuando cambia cómo se arma la muestra: el job rehace las vistas automáticas viejas.
// v2 (25 nov 2026): antes un modelo de menos de MAX_TRIANGULOS se subía COMPLETO
// (el portavasos de panal quedó público tal cual); ahora siempre se degrada.
export const VERSION_VISTA = 2
const MAX_BYTES = 95 * 1024 * 1024

/** Triángulos de un STL (binario o ASCII) como [x,y,z]*9 por triángulo. */
export function leerSTL(buf: Buffer): Float32Array {
  const binario = buf.length >= 84 && 84 + buf.readUInt32LE(80) * 50 === buf.length
  if (binario) {
    const n = buf.readUInt32LE(80)
    const out = new Float32Array(n * 9)
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12
      for (let k = 0; k < 9; k++) out[i * 9 + k] = buf.readFloatLE(o + k * 4)
    }
    return out
  }
  const texto = buf.toString("latin1")
  const nums: number[] = []
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) nums.push(+m[1], +m[2], +m[3])
  return new Float32Array(nums.slice(0, nums.length - (nums.length % 9)))
}

/** Simplifica agrupando vértices en celdas de una rejilla (rápido y robusto con mallas sucias). */
export function simplificar(entrada: Float32Array, maxTriPedido = MAX_TRIANGULOS): Float32Array {
  // Siempre se degrada: a lo más la mitad de los triángulos del original (aunque
  // ya sea chico) y, abajo, las medidas quedan en una rejilla gruesa. Así la
  // muestra nunca es el archivo de venta.
  const maxTri = Math.max(12, Math.min(maxTriPedido, Math.floor(entrada.length / 9 / 2)))
  // Un modelo enorme (esculturas de millones de triángulos) se muestrea primero:
  // la tarea corre en el mismo proceso que atiende el sitio y no debe trabarlo.
  const TOPE_ENTRADA = 200_000
  let tris = entrada
  if (entrada.length / 9 > TOPE_ENTRADA) {
    const salto = Math.ceil(entrada.length / 9 / TOPE_ENTRADA)
    const m = new Float32Array(Math.floor(entrada.length / 9 / salto) * 9)
    for (let i = 0, o = 0; o < m.length; i += salto * 9, o += 9) m.set(entrada.subarray(i, i + 9), o)
    tris = m
  }
  const n = tris.length / 9
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < tris.length; i += 3)
    for (let k = 0; k < 3; k++) {
      if (tris[i + k] < min[k]) min[k] = tris[i + k]
      if (tris[i + k] > max[k]) max[k] = tris[i + k]
    }
  const tam = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1
  let celdas = Math.min(1000, Math.ceil(Math.sqrt(maxTri) * 1.6))
  let res = tris
  const claves = new Float64Array(n * 3)
  for (let intento = 0; intento < 12; intento++) {
    const paso = tam / celdas
    const K = celdas + 1
    const suma = new Map<number, number[]>() // celda -> [sx, sy, sz, cuenta]
    for (let v = 0; v < n * 3; v++) {
      const j = v * 3
      const c =
        (Math.floor((tris[j] - min[0]) / paso) * K + Math.floor((tris[j + 1] - min[1]) / paso)) * K + Math.floor((tris[j + 2] - min[2]) / paso)
      claves[v] = c
      const s = suma.get(c)
      if (s) { s[0] += tris[j]; s[1] += tris[j + 1]; s[2] += tris[j + 2]; s[3]++ }
      else suma.set(c, [tris[j], tris[j + 1], tris[j + 2], 1])
    }
    const salida: number[] = []
    const vistos = new Set<string>()
    for (let t = 0; t < n; t++) {
      const a = claves[t * 3], b = claves[t * 3 + 1], c = claves[t * 3 + 2]
      if (a === b || b === c || a === c) continue // se colapsó
      const orden = [a, b, c].sort((x, y) => x - y)
      const firma = `${orden[0]},${orden[1]},${orden[2]}`
      if (vistos.has(firma)) continue
      vistos.add(firma)
      for (const k of [a, b, c]) {
        const s = suma.get(k)!
        salida.push(s[0] / s[3], s[1] / s[3], s[2] / s[3])
      }
    }
    res = new Float32Array(salida)
    if (res.length / 9 <= maxTri && res.length >= 9 * 4) break
    celdas = Math.floor(celdas * 0.8)
  }
  return res
}

export function stlBinario(tris: Float32Array): Buffer {
  const n = tris.length / 9
  const buf = Buffer.alloc(84 + n * 50)
  buf.write("HETNA CNC - vista previa simplificada (no es el archivo de venta)", 0, "ascii")
  buf.writeUInt32LE(n, 80)
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50
    const t = i * 9
    // normal (se calcula para que el visor sombree bien)
    const ux = tris[t + 3] - tris[t], uy = tris[t + 4] - tris[t + 1], uz = tris[t + 5] - tris[t + 2]
    const vx = tris[t + 6] - tris[t], vy = tris[t + 7] - tris[t + 1], vz = tris[t + 8] - tris[t + 2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l; ny /= l; nz /= l
    buf.writeFloatLE(nx, o); buf.writeFloatLE(ny, o + 4); buf.writeFloatLE(nz, o + 8)
    for (let k = 0; k < 9; k++) buf.writeFloatLE(tris[t + k], o + 12 + k * 4)
  }
  return buf
}

/** El STL dentro del archivo: el mismo, o el más grande de un ZIP. null si no hay. */
export function stlDe(nombre: string, buf: Buffer): Buffer | null {
  const n = nombre.toLowerCase()
  if (n.endsWith(".stl")) return buf
  if (n.endsWith(".zip")) {
    try {
      const dentro = unzipSync(new Uint8Array(buf), { filter: (f) => f.name.toLowerCase().endsWith(".stl") && !f.name.startsWith("__MACOSX") })
      const mayor = Object.values(dentro).sort((a, b) => b.length - a.length)[0]
      return mayor ? Buffer.from(mayor) : null
    } catch (e) {
      // fflate no abre ZIP con Deflate64 (Windows lo usa en archivos grandes): «invalid distance».
      // Respaldo: el programa unzip del servidor (Info-ZIP sí lo entiende).
      const conUnzip = stlConUnzip(buf)
      if (conUnzip) return conUnzip
      throw e
    }
  }
  return null
}

/** El STL más grande de un ZIP usando el programa `unzip` (null si no está instalado o no hay STL). */
export function stlConUnzip(buf: Buffer): Buffer | null {
  const dir = mkdtempSync(join(tmpdir(), "vista3d-"))
  try {
    const zip = join(dir, "a.zip")
    writeFileSync(zip, buf)
    const lista = execFileSync("unzip", ["-Z", "-l", zip], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 60_000 })
    // Líneas: permisos versión so tamaño tipo comp fecha hora nombre
    const stls = lista
      .split("\n")
      .map((l) => l.trim().split(/\s+/))
      .filter((c) => c.length >= 10 && /\.stl$/i.test(c.slice(9).join(" ")) && !c.slice(9).join(" ").startsWith("__MACOSX"))
      .map((c) => ({ nombre: c.slice(9).join(" "), tam: Number(c[3]) || 0 }))
      .sort((a, b) => b.tam - a.tam)
    if (!stls.length) return null
    return execFileSync("unzip", ["-p", zip, stls[0].nombre], { maxBuffer: MAX_BYTES * 4, timeout: 120_000 })
  } catch {
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Genera y sube la muestra; devuelve su URL pública. */
export async function generarVista3D(scope: any, p: { handle: string; llave: string }): Promise<string> {
  const liga = await getSignedDownloadUrl(p.llave, 900)
  if (!liga.ok) throw new Error(`sin liga del archivo: ${liga.reason}`)
  const r = await fetch(liga.url, { signal: AbortSignal.timeout(180_000) })
  if (!r.ok) throw new Error(`no se pudo bajar (${r.status})`)
  const largo = Number(r.headers.get("content-length") || 0)
  if (largo > MAX_BYTES) throw new Error("archivo demasiado grande para la vista previa")
  const stl = stlDe(p.llave, Buffer.from(await r.arrayBuffer()))
  if (!stl) throw new Error("no trae STL")
  const tris = simplificar(leerSTL(stl))
  if (tris.length < 9 * 4) throw new Error("STL vacío o ilegible")
  return subir(scope, `vista3d-${p.handle}.stl`, "model/stl", stlBinario(tris))
}
