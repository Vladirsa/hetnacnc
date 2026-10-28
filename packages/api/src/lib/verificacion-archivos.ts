// Archivos privados de la verificación de talleres (INE, fotos del taller y fachada).
//
// NO se guardan en la carpeta pública de imágenes (/static): ahí cualquiera con
// la dirección podría verlos. Van a una carpeta privada del servidor, fuera del
// proyecto, para que sobrevivan a cada despliegue:
//   HETNA_PRIVADO_DIR (si está en el .env de la API)  o  ~/hetna-privado
//   └── verificaciones/<id del taller>/<nombre aleatorio>.<ext>
//
// Solo los entregan las rutas /vendor/hetna-verificacion (al propio taller) y
// /admin/hetna-verificacion (a un administrador). Incluye esta carpeta en tus respaldos.
import { randomBytes } from "crypto"
import { promises as fs } from "fs"
import os from "os"
import path from "path"

export type TipoDocumento =
  | "identificacion_frente"
  | "identificacion_reverso"
  | "fachada"
  | "taller"
  | "comprobante_domicilio"

export const TIPOS: Record<TipoDocumento, { nombre: string; max: number; pdf: boolean; obligatorio: number }> = {
  identificacion_frente: { nombre: "Identificación oficial (frente)", max: 1, pdf: true, obligatorio: 1 },
  identificacion_reverso: { nombre: "Identificación oficial (reverso)", max: 1, pdf: true, obligatorio: 1 },
  fachada: { nombre: "Fachada del taller", max: 2, pdf: false, obligatorio: 1 },
  taller: { nombre: "Interior del taller y máquinas", max: 6, pdf: false, obligatorio: 2 },
  comprobante_domicilio: { nombre: "Comprobante de domicilio (opcional)", max: 1, pdf: true, obligatorio: 0 },
}

export const esTipo = (t: unknown): t is TipoDocumento => typeof t === "string" && t in TIPOS

export type Archivo = {
  id: string
  tipo: TipoDocumento
  archivo: string // nombre interno en disco
  mime: string
  tamano: number
  subido_en: string
}

export const MAX_MB = 8

const FORMATOS: { mime: string; ext: string; firma: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", firma: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", firma: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "application/pdf", ext: "pdf", firma: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
]

// El formato se decide por los primeros bytes del archivo, no por lo que diga el navegador
export const detectarFormato = (b: Buffer) => FORMATOS.find((f) => b.length > 12 && f.firma(b)) ?? null

const raiz = () =>
  path.join(process.env.HETNA_PRIVADO_DIR || path.join(os.homedir(), "hetna-privado"), "verificaciones")

// Los ids de Mercur son "sel_" + letras y números; cualquier otra cosa se rechaza
const carpetaDe = (sellerId: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(sellerId)) throw new Error("Taller no válido")
  return path.join(raiz(), sellerId)
}

const rutaDe = (sellerId: string, archivo: string) => {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(archivo)) throw new Error("Archivo no válido")
  return path.join(carpetaDe(sellerId), archivo)
}

export async function guardarArchivo(sellerId: string, tipo: TipoDocumento, contenido: Buffer): Promise<Archivo> {
  const formato = detectarFormato(contenido)
  if (!formato) throw new Error("Formato no permitido. Usa una foto JPG, PNG o WEBP" + (TIPOS[tipo].pdf ? ", o un PDF." : "."))
  if (formato.mime === "application/pdf" && !TIPOS[tipo].pdf) throw new Error("Aquí solo se aceptan fotos (JPG, PNG o WEBP).")
  if (contenido.length > MAX_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_MB} MB.`)

  const id = randomBytes(16).toString("hex")
  const archivo = `${id}.${formato.ext}`
  await fs.mkdir(carpetaDe(sellerId), { recursive: true, mode: 0o700 })
  await fs.writeFile(rutaDe(sellerId, archivo), contenido, { mode: 0o600 })
  return { id, tipo, archivo, mime: formato.mime, tamano: contenido.length, subido_en: new Date().toISOString() }
}

export const leerArchivo = (sellerId: string, a: Archivo) => fs.readFile(rutaDe(sellerId, a.archivo))

export async function borrarArchivo(sellerId: string, a: Archivo) {
  await fs.rm(rutaDe(sellerId, a.archivo), { force: true })
}

// Borra la carpeta completa de un taller (todos sus documentos)
export async function borrarCarpeta(sellerId: string) {
  await fs.rm(carpetaDe(sellerId), { recursive: true, force: true })
}

// Lista de archivos guardada en la base, ya limpia
export const listaArchivos = (v: unknown): Archivo[] => {
  const lista = Array.isArray(v) ? v : (v as { lista?: unknown } | null)?.lista
  return Array.isArray(lista)
    ? (lista as Archivo[]).filter((a) => a && typeof a.id === "string" && esTipo(a.tipo) && typeof a.archivo === "string")
    : []
}

// Qué falta para poder enviar a revisión
export function faltantes(archivos: Archivo[]): string[] {
  const out: string[] = []
  for (const [tipo, t] of Object.entries(TIPOS) as [TipoDocumento, (typeof TIPOS)[TipoDocumento]][]) {
    const n = archivos.filter((a) => a.tipo === tipo).length
    if (n < t.obligatorio) out.push(t.obligatorio > 1 ? `${t.nombre}: faltan ${t.obligatorio - n}` : t.nombre)
  }
  return out
}

// Respuesta de un archivo privado: nunca se guarda en caché ni se interpreta como página
export function encabezadosPrivados(mime: string) {
  return {
    "Content-Type": mime,
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  }
}
