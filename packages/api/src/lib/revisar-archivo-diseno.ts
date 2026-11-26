// Revisión del archivo de un diseño digital ANTES de venderlo (26 nov 2026).
//
// La brida escalonada M12 se publicó con un ZIP cuyo STL estaba dañado
// («invalid compressed data to inflate»): quien la comprara recibía un archivo
// que no abre. Aquí se prueba el archivo al subirlo (pantalla «Subir diseños»,
// lib/subir-disenos.ts) y al publicarlo desde la Digital Factory
// (lib/publicar-diseno.ts): un ZIP debe abrir completo y cada STL debe traer
// triángulos. Otros formatos (DXF, SVG, STEP...) pasan sin revisar.
//
// Sólo se rechaza lo que de verdad está dañado: si algo no se puede revisar
// (p. ej. un ZIP con Deflate64 y el servidor sin el programa unzip), pasa.
import { execFileSync } from "child_process"
import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

import { unzipSync } from "fflate"

/** null si el STL se ve sano; si no, el motivo. */
export function problemaSTL(buf: Buffer): string | null {
  if (buf.length < 84) return "está vacío o incompleto"
  const n = buf.readUInt32LE(80)
  const esperado = 84 + n * 50
  // Binario: el tamaño cuadra con el número de triángulos (algunos programas dejan bytes de más al final)
  if (n > 0 && buf.length >= esperado && buf.length <= esperado + 4096) {
    for (let i = 0; i < Math.min(n, 50); i++) {
      for (let k = 0; k < 12; k++) {
        if (!Number.isFinite(buf.readFloatLE(84 + i * 50 + k * 4))) return "trae datos dañados"
      }
    }
    return null
  }
  // ASCII: «solid ... facet ... vertex x y z»
  const inicio = buf.subarray(0, Math.min(buf.length, 4096)).toString("latin1")
  if (/^\s*solid/i.test(inicio) && /vertex\s+[-+0-9.eE]+\s+[-+0-9.eE]+\s+[-+0-9.eE]+/.test(buf.toString("latin1"))) return null
  return n > 0 ? "está incompleto o dañado" : "no tiene triángulos"
}

type Entrada = { nombre: string; datos: Uint8Array }

/**
 * Prueba el ZIP completo con el programa unzip (revisa el CRC de cada archivo y
 * entiende Deflate64; fflate no hace ninguna de las dos). null si no hay unzip.
 * Si se pide, también saca los STL (para los ZIP que fflate no abre).
 */
function probarConUnzip(buf: Buffer, sacarSTL: boolean): { danado: string | null; entradas: Entrada[] } | null {
  const dir = mkdtempSync(join(tmpdir(), "revisar-"))
  try {
    const zip = join(dir, "a.zip")
    writeFileSync(zip, buf)
    let salida = ""
    try {
      salida = execFileSync("unzip", ["-t", zip], { encoding: "utf8", stdio: "pipe", maxBuffer: 8 * 1024 * 1024, timeout: 120_000 })
    } catch (e: any) {
      if (e?.code === "ENOENT") return null // sin unzip: no se puede saber
      salida = `${e?.stdout || ""}${e?.stderr || ""}`
      // «testing: pieza.stl   bad CRC ...» o «testing: pieza.stl» seguido de «error: ...»
      for (const linea of salida.split("\n")) {
        const m = linea.match(/testing:\s+(.+?)(?:\s{2,}(.*))?$/)
        if (m && (m[2] || "").trim() !== "OK") return { danado: m[1].trim(), entradas: [] }
      }
      return { danado: "", entradas: [] }
    }
    const entradas: Entrada[] = []
    if (sacarSTL) {
      const lista = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 60_000 })
      for (const nombre of lista.split("\n").map((l) => l.trim()).filter(Boolean)) {
        if (!/\.stl$/i.test(nombre) || nombre.startsWith("__MACOSX")) continue
        entradas.push({ nombre, datos: execFileSync("unzip", ["-p", zip, nombre], { maxBuffer: 400 * 1024 * 1024, timeout: 120_000 }) })
      }
    }
    return { danado: null, entradas }
  } catch {
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * null si el archivo se puede vender; si no, un mensaje para quien lo subió.
 * nombre: el nombre del archivo (sólo importa la extensión).
 */
export function problemaArchivoDiseno(nombre: string, buf: Buffer): string | null {
  const n = String(nombre || "").toLowerCase()
  if (n.endsWith(".stl")) {
    const p = problemaSTL(buf)
    return p ? `El STL ${p}. Vuelve a exportarlo desde tu programa de diseño y súbelo otra vez.` : null
  }
  if (!n.endsWith(".zip")) return null

  let entradas: Entrada[] | null = null
  try {
    const todo = unzipSync(new Uint8Array(buf))
    entradas = Object.entries(todo).map(([nombre, datos]) => ({ nombre, datos }))
  } catch {
    // fflate no entiende Deflate64: los STL se sacan con unzip
  }
  if (entradas && !entradas.some((e) => !e.nombre.endsWith("/"))) return "El ZIP está vacío."
  const prueba = probarConUnzip(buf, entradas === null)
  if (prueba?.danado != null) {
    const cual = prueba.danado ? ` «${prueba.danado}»` : ""
    return `El ZIP está dañado: el archivo${cual} no se puede abrir. Vuelve a armar el ZIP con archivos sanos y súbelo otra vez.`
  }
  if (entradas === null) {
    if (!prueba) return null // ni fflate ni unzip lo pudieron revisar: pasa
    entradas = prueba.entradas
    if (!entradas.length) return null // sin STL que revisar (y unzip dice que está sano)
  }

  const stls = entradas.filter((e) => /\.stl$/i.test(e.nombre) && !e.nombre.startsWith("__MACOSX"))
  for (const e of stls) {
    const p = problemaSTL(Buffer.from(e.datos.buffer, e.datos.byteOffset, e.datos.byteLength))
    if (p) return `El STL «${e.nombre}» dentro del ZIP ${p}. Vuelve a exportarlo y arma el ZIP otra vez.`
  }
  if (!entradas.some((e) => !e.nombre.endsWith("/"))) return "El ZIP está vacío."
  return null
}
