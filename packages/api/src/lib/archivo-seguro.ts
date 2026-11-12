// Revisión de los archivos que suben los clientes (planos, modelos, fotos,
// comprimidos) ANTES de guardarlos en el bucket privado. Auditoría del 12 nov
// 2026, problema 4 "protección de archivos técnicos".
//
// Tres capas:
//   1. Contenido real: el archivo tiene que ser lo que dice su extensión. Se
//      rechaza sólo con evidencia (un ejecutable, una página HTML, una firma
//      que no corresponde en formatos binarios estrictos). Los formatos
//      "sueltos" (DXF, IGES, OBJ, STL, SKP, CDR) sólo pasan la revisión de
//      peligro: un falso rechazo cuesta una venta.
//   2. Comprimidos ZIP (y 3MF/F3D, que son ZIP): se lee la lista de archivos
//      sin descomprimir y se rechazan ejecutables, macros y ZIP con contraseña.
//      RAR y 7z no se pueden listar aquí: sólo los revisa el antivirus.
//   3. Antivirus ClamAV, si está instalado (socket de clamd). Si no está o no
//      responde, la subida sigue y el archivo queda marcado "sin antivirus".
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import net from "node:net"

export const T_SUBIDA = "hetna_archivo_subida"

export type Revision =
  | { ok: true; tipo: string; antivirus: Antivirus; sha256: string }
  | { ok: false; motivo: string }
export type Antivirus = "limpio" | "sin_antivirus" | "no_revisado" | "error"

const DE = (b: Buffer, desde: number, hasta: number) => b.subarray(desde, Math.min(hasta, b.length))
const empieza = (b: Buffer, ...bytes: number[]) => bytes.every((x, i) => b[i] === x)
const textoInicio = (b: Buffer, n = 4096) => DE(b, 0, n).toString("latin1")

// Extensiones que nunca deben venir dentro de un comprimido de planos.
// Sólo programas y scripts: lo demás (hojas con macros, accesos directos,
// páginas) suele venir en carpetas de proyecto comprimidas y lo revisa ClamAV.
const PELIGROSAS = new Set([
  "exe", "dll", "com", "bat", "cmd", "scr", "pif", "msi", "msp", "vbs", "vbe", "js", "jse", "wsf", "wsh",
  "ps1", "psm1", "hta", "cpl", "jar", "apk", "sh", "reg", "scf", "gadget", "dmg", "pkg",
])

/** Ejecutables, scripts y páginas web: se rechazan sea cual sea la extensión. */
function peligroUniversal(b: Buffer, ext: string): string | null {
  if (empieza(b, 0x4d, 0x5a)) return "es un programa de Windows (.exe)"
  if (empieza(b, 0x7f, 0x45, 0x4c, 0x46)) return "es un programa de Linux"
  if (
    empieza(b, 0xfe, 0xed, 0xfa, 0xce) || empieza(b, 0xfe, 0xed, 0xfa, 0xcf) ||
    empieza(b, 0xce, 0xfa, 0xed, 0xfe) || empieza(b, 0xcf, 0xfa, 0xed, 0xfe) || empieza(b, 0xca, 0xfe, 0xba, 0xbe)
  )
    return "es un programa de Mac o Java"
  if (empieza(b, 0x23, 0x21)) return "es un script"
  if (ext !== "svg") {
    const t = textoInicio(b, 1024).replace(/^﻿|^\xEF\xBB\xBF/, "").trimStart().toLowerCase()
    if (t.startsWith("<!doctype html") || t.startsWith("<html") || t.startsWith("<script")) return "es una página web, no un plano"
  }
  return null
}

/** SVG: es texto que un navegador puede ejecutar. Sin scripts ni eventos. */
function svgPeligroso(b: Buffer): string | null {
  const t = b.toString("utf8").toLowerCase()
  if (!t.includes("<svg")) return "no parece un SVG"
  if (/<script[\s>]/.test(t) || /javascript:/.test(t) || /<foreignobject[\s>]/.test(t) || /\son[a-z]+\s*=/.test(t))
    return "el SVG trae código (scripts o eventos); expórtalo de nuevo como SVG simple"
  return null
}

/** Firma del formato. null = coincide (o es un formato suelto que no se exige). */
function firmaNoCoincide(b: Buffer, ext: string): string | null {
  const ini = textoInicio(b, 1024)
  switch (ext) {
    case "pdf":
      return ini.includes("%PDF-") ? null : "no es un PDF"
    case "ai":
      return ini.includes("%PDF") || ini.includes("%!PS") ? null : "no es un archivo de Illustrator"
    case "eps":
      return ini.startsWith("%!PS") || empieza(b, 0xc5, 0xd0, 0xd3, 0xc6) ? null : "no es un EPS"
    case "png":
      return empieza(b, 0x89, 0x50, 0x4e, 0x47) ? null : "no es una imagen PNG"
    case "jpg":
    case "jpeg":
      return empieza(b, 0xff, 0xd8, 0xff) ? null : "no es una imagen JPG"
    case "webp":
      return ini.startsWith("RIFF") && ini.slice(8, 12) === "WEBP" ? null : "no es una imagen WEBP"
    case "heic":
      return ini.slice(4, 8) === "ftyp" ? null : "no es una foto HEIC"
    case "zip":
    case "3mf":
    case "f3d":
      return empieza(b, 0x50, 0x4b, 0x03, 0x04) || empieza(b, 0x50, 0x4b, 0x05, 0x06) ? null : `no es un ${ext.toUpperCase()} válido`
    case "rar":
      return ini.startsWith("Rar!\x1a\x07") ? null : "no es un RAR"
    case "7z":
      return empieza(b, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c) ? null : "no es un 7z"
    case "dwg":
      return ini.startsWith("AC1") ? null : "no es un DWG"
    case "step":
    case "stp":
      return textoInicio(b, 4096).includes("ISO-10303-21") ? null : "no es un STEP"
    default:
      // dxf, stl, iges/igs, obj, skp, cdr, svg (aparte): sin firma exigida
      return null
  }
}

/** Lista de nombres dentro de un ZIP leyendo su directorio central (sin
 *  descomprimir). null si no se pudo leer (ZIP64 o dañado: no se rechaza). */
export function nombresZip(b: Buffer): { nombres: string[]; cifrado: boolean } | null {
  const desde = Math.max(0, b.length - 65557)
  let eocd = -1
  for (let i = b.length - 22; i >= desde; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const total = b.readUInt16LE(eocd + 10)
  const inicio = b.readUInt32LE(eocd + 16)
  if (inicio === 0xffffffff || total === 0xffff || inicio >= b.length) return null
  const nombres: string[] = []
  let cifrado = false
  let p = inicio
  for (let n = 0; n < total && n < 20000; n++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) return null
    if (b.readUInt16LE(p + 8) & 1) cifrado = true
    const largo = b.readUInt16LE(p + 28)
    const extra = b.readUInt16LE(p + 30)
    const coment = b.readUInt16LE(p + 32)
    nombres.push(DE(b, p + 46, p + 46 + largo).toString("utf8"))
    p += 46 + largo + extra + coment
  }
  return { nombres, cifrado }
}

function zipPeligroso(b: Buffer): string | null {
  const z = nombresZip(b)
  if (!z) return null
  if (z.cifrado) return "el comprimido tiene contraseña y no se puede revisar; súbelo sin contraseña"
  const malo = z.nombres.find((n) => PELIGROSAS.has((n.split(".").pop() || "").toLowerCase()))
  return malo ? `el comprimido trae un archivo no permitido (${malo.split("/").pop()})` : null
}

// ---------- ClamAV ----------

const socketClam = () => {
  if (process.env.CLAMAV_HOST) return { host: process.env.CLAMAV_HOST, port: Number(process.env.CLAMAV_PORT || 3310) }
  const ruta = process.env.CLAMAV_SOCKET || ["/var/run/clamav/clamd.ctl", "/run/clamav/clamd.ctl", "/var/run/clamd.scan/clamd.sock"].find((r) => existsSync(r))
  return ruta ? { path: ruta } : null
}

/** INSTREAM a clamd. "limpio" | "virus:<nombre>" | estado sin veredicto. */
export function escanearClam(b: Buffer, ms = 90_000): Promise<{ estado: Antivirus } | { virus: string }> {
  const destino = socketClam()
  if (!destino) return Promise.resolve({ estado: "sin_antivirus" })
  return new Promise((ok) => {
    let respuesta = ""
    let listo = false
    const fin = (r: { estado: Antivirus } | { virus: string }) => {
      if (listo) return
      listo = true
      s.destroy()
      ok(r)
    }
    const s = net.connect(destino as any)
    s.setTimeout(ms, () => fin({ estado: "error" }))
    s.on("error", () => fin({ estado: "error" }))
    s.on("data", (d) => (respuesta += d.toString()))
    s.on("end", () => {
      const r = respuesta.replace(/\0/g, "").trim()
      if (/\bOK$/.test(r)) return fin({ estado: "limpio" })
      const m = r.match(/:\s*(.+)\s+FOUND$/)
      if (m) return fin({ virus: m[1] })
      // "INSTREAM size limit exceeded": no lo revisó completo
      fin({ estado: /size limit/i.test(r) ? "no_revisado" : "error" })
    })
    s.on("connect", () => {
      s.write("zINSTREAM\0")
      const TROZO = 64 * 1024
      for (let i = 0; i < b.length; i += TROZO) {
        const parte = b.subarray(i, i + TROZO)
        const largo = Buffer.alloc(4)
        largo.writeUInt32BE(parte.length)
        s.write(largo)
        s.write(parte)
      }
      s.write(Buffer.alloc(4))
    })
  })
}

/** Revisión completa de un archivo en memoria. */
export async function revisarArchivo(b: Buffer, nombre: string): Promise<Revision> {
  const ext = (nombre.split(".").pop() || "").toLowerCase()
  if (!b.length) return { ok: false, motivo: "el archivo está vacío" }
  const motivo =
    peligroUniversal(b, ext) ||
    firmaNoCoincide(b, ext) ||
    (ext === "svg" ? svgPeligroso(b) : null) ||
    (["zip", "3mf", "f3d"].includes(ext) ? zipPeligroso(b) : null)
  if (motivo) return { ok: false, motivo }
  const av = await escanearClam(b)
  if ("virus" in av) return { ok: false, motivo: `el antivirus encontró una amenaza (${av.virus})` }
  return { ok: true, tipo: ext, antivirus: av.estado, sha256: createHash("sha256").update(b).digest("hex") }
}

let tablaLista = false
/** Cada subida queda registrada: quién (IP), qué revisión pasó y, cuando una
 *  solicitud la usa, en cuál. Sirve para no aceptar claves que no pasaron por
 *  aquí y para borrar las subidas que nunca se usaron. */
export async function asegurarSubidas(knex: any) {
  if (tablaLista) return
  if (!(await knex.schema.hasTable(T_SUBIDA))) {
    await knex.schema.createTable(T_SUBIDA, (t: any) => {
      t.text("clave").primary()
      t.text("carpeta").notNullable().index()
      t.text("nombre").notNullable()
      t.bigInteger("tamano").notNullable()
      t.text("sha256").nullable()
      t.text("tipo").nullable()
      t.text("antivirus").nullable()
      t.text("ip").nullable()
      t.text("usado_en").nullable().index()
      t.timestamp("borrado_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  tablaLista = true
}
