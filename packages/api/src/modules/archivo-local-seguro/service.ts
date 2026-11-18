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

import { MedusaError } from "@medusajs/framework/utils"
import { LocalFileService } from "@medusajs/medusa/file-local"

/** Extensiones que el navegador abre como página o ejecuta (o que son instaladores). */
const EXT_PROHIBIDAS = new Set([
  "html", "htm", "xhtml", "xht", "shtml", "mht", "mhtml", "hta", "htc",
  "svg", "svgz", "xml", "xsl", "xslt", "rdf", "wsdl",
  "js", "mjs", "cjs", "jsx", "ts", "vbs", "wasm", "swf",
  "php", "phtml", "asp", "aspx", "jsp", "cgi", "pl", "py", "sh", "bash",
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "ps1", "jar", "apk", "dmg", "app",
  "lnk", "url", "iso", "img", "vhd", "chm", "reg", "dll",
])

/** Tipos declarados que se sirven como página aunque la extensión sea otra. */
const MIME_PROHIBIDO = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|application\/javascript|text\/javascript|application\/x-msdownload|application\/x-httpd-php)/i

/** ¿El contenido empieza como una página HTML o un SVG? (sin importar su nombre) */
export function pareceHtml(inicio: string) {
  const t = inicio.replace(/^﻿/, "").trimStart().slice(0, 600).toLowerCase()
  return /^<!doctype\s+html|^<html[\s>]|^<svg[\s>]|^<\?xml[^>]*>\s*(<!doctype[^>]*>\s*)?<(svg|html)[\s>]|<script[\s>]|<iframe[\s>]/.test(t)
}

/** null si se puede guardar; si no, el motivo. */
export function motivoArchivoProhibido(f: { filename?: string; mimeType?: string; content?: string }): string | null {
  const nombre = String(f.filename || "")
  // Todas las extensiones cuentan: "foto.html.jpg" es jpg, pero "foto.jpg.html" es html
  const ext = path.extname(nombre).slice(1).toLowerCase()
  if (!ext) return null
  if (EXT_PROHIBIDAS.has(ext)) return `No se permiten archivos .${ext}.`
  if (f.mimeType && MIME_PROHIBIDO.test(f.mimeType)) return "No se permite ese tipo de archivo."
  // Las imágenes y los documentos no empiezan como una página web
  if (/^(jpe?g|png|gif|webp|avif|heic|bmp|ico|pdf|mp4|webm|mov)$/.test(ext) && typeof f.content === "string") {
    // El contenido llega como texto, binario o base64: se mira de las dos formas
    const crudo = f.content.slice(0, 1200)
    const deBase64 = Buffer.from(crudo.slice(0, crudo.length - (crudo.length % 4)), "base64").toString("latin1")
    if (pareceHtml(crudo) || pareceHtml(deBase64)) return "El archivo no es lo que dice su nombre."
  }
  return null
}

export class ArchivoLocalSeguroService extends LocalFileService {
  async upload(file: any) {
    const motivo = file ? motivoArchivoProhibido(file) : null
    if (motivo) throw new MedusaError(MedusaError.Types.INVALID_DATA, motivo)
    return super.upload(file)
  }

  async getUploadStream(fileData: any) {
    const motivo = fileData ? motivoArchivoProhibido(fileData) : null
    if (motivo) throw new MedusaError(MedusaError.Types.INVALID_DATA, motivo)
    return super.getUploadStream(fileData)
  }
}
