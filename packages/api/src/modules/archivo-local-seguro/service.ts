// Archivos locales (carpeta /static) con filtro de tipos peligrosos.
//
// Auditoría de seguridad del 18 nov 2026: Medusa guarda lo que suben el panel
// de vendedores (/vendor/uploads) y el de administración en /static, que se
// sirve desde hetnacnc.com sin revisar el tipo. Un taller podía subir un .html
// o un .svg con código y mandarle la liga al administrador: al abrirla, esa
// página corría con la sesión del administrador (podía crear otro administrador
// o cambiar datos de pago).
//
// Este proveedor es el mismo de Medusa (file-local) pero rechaza los archivos
// que el navegador ejecuta como página: por extensión y por contenido. Va a
// nivel del módulo de archivos, así que cubre todas las rutas de subida.
import path from "path"

import mime from "mime"

import { MedusaError } from "@medusajs/framework/utils"
import { LocalFileService } from "@medusajs/medusa/file-local"

/** Instaladores, scripts de sistema y accesos directos: no se guardan aunque sólo se descarguen. */
const EXT_PROHIBIDAS = new Set([
  "php", "phtml", "asp", "aspx", "jsp", "cgi", "pl", "sh", "bash",
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "ps1", "vbs", "jar", "apk", "dmg", "app",
  "lnk", "url", "iso", "img", "vhd", "chm", "reg", "dll", "hta",
])

/**
 * Tipos que el navegador abre como página o ejecuta. No es una lista de
 * extensiones: se pregunta con qué Content-Type lo serviría /static (la misma
 * tabla `mime` que usa express) y se rechaza toda la familia. Así entran
 * también .xsd, .kml, .gpx, .rss y cualquier otro "+xml", que el navegador
 * pinta como documento y ejecuta sus <script>.
 */
const TIPO_ACTIVO = /html|xml|javascript|ecmascript|svg|shockwave|x-component|wasm|xsl/i

/** Tipos declarados que se sirven como página aunque la extensión sea otra. */
const MIME_PROHIBIDO = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|application\/javascript|text\/javascript|application\/x-msdownload|application\/x-httpd-php)/i

/** Content-Type con el que /static serviría un archivo guardado con ese nombre. */
export function tipoServido(filename: string): string {
  // file-local lo guarda como "<hora>-<nombre>": un archivo llamado ".html"
  // queda "123-.html" y se sirve como página, aunque "no tenga extensión"
  return String(mime.lookup(`0-${path.basename(String(filename || "")).trim()}`) || "application/octet-stream")
}

/** ¿El contenido empieza como una página HTML o un SVG? (sin importar su nombre) */
export function pareceHtml(inicio: string) {
  const t = inicio.replace(/^﻿/, "").trimStart().slice(0, 600).toLowerCase()
  return /^<!doctype\s+html|^<html[\s>]|^<svg[\s>]|^<\?xml[^>]*>\s*(<!doctype[^>]*>\s*)?<(svg|html)[\s>]|<script[\s>]|<iframe[\s>]/.test(t)
}

/** ¿Se serviría como página o script? */
export const esTipoActivo = (filename: string) => TIPO_ACTIVO.test(tipoServido(filename))

/** null si se puede guardar; si no, el motivo. */
export function motivoArchivoProhibido(f: { filename?: string; mimeType?: string; content?: string }): string | null {
  const nombre = path.basename(String(f.filename || "")).trim()
  const ext = path.extname(`0-${nombre}`).slice(1).toLowerCase()
  if (EXT_PROHIBIDAS.has(ext)) return `No se permiten archivos .${ext}.`
  if (esTipoActivo(nombre)) return ext ? `No se permiten archivos .${ext}.` : "No se permite ese tipo de archivo."
  if (f.mimeType && MIME_PROHIBIDO.test(f.mimeType) && !/^(csv|txt|json|md)$/.test(ext)) return "No se permite ese tipo de archivo."
  // Las imágenes y los documentos no empiezan como una página web
  if (/^(jpe?g|png|gif|webp|avif|heic|bmp|ico|pdf|mp4|webm|mov)$/.test(ext) && typeof f.content === "string") {
    // El contenido llega como texto, binario o base64: se mira de las dos formas
    const crudo = f.content.slice(0, 1200)
    const deBase64 = Buffer.from(crudo.slice(0, crudo.length - (crudo.length % 4)), "base64").toString("latin1")
    if (pareceHtml(crudo) || pareceHtml(deBase64)) return "El archivo no es lo que dice su nombre."
  }
  return null
}

/**
 * Los archivos privados (entregables de un trabajo: una hoja de preparación
 * .html, un posprocesador .js) sí se guardan, pero con ".descarga" al final:
 * así /static los manda como descarga y el navegador nunca los abre como página.
 */
export function nombreSeguro(f: { filename?: string; access?: string }): string | null {
  if (f.access === "public") return null
  const nombre = String(f.filename || "")
  return esTipoActivo(nombre) && !EXT_PROHIBIDAS.has(path.extname(`0-${path.basename(nombre)}`).slice(1).toLowerCase()) ? `${nombre}.descarga` : null
}

export class ArchivoLocalSeguroService extends LocalFileService {
  async upload(file: any) {
    const seguro = file ? nombreSeguro(file) : null
    if (seguro) return super.upload({ ...file, filename: seguro, mimeType: "application/octet-stream" })
    const motivo = file ? motivoArchivoProhibido(file) : null
    if (motivo) throw new MedusaError(MedusaError.Types.INVALID_DATA, motivo)
    return super.upload(file)
  }

  async getUploadStream(fileData: any) {
    const seguro = fileData ? nombreSeguro(fileData) : null
    if (seguro) return super.getUploadStream({ ...fileData, filename: seguro, mimeType: "application/octet-stream" })
    const motivo = fileData ? motivoArchivoProhibido(fileData) : null
    if (motivo) throw new MedusaError(MedusaError.Types.INVALID_DATA, motivo)
    return super.getUploadStream(fileData)
  }
}
