import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Readable } from "stream"

/**
 * Lectura de formularios multipart para el servicio CAM, sin dependencias
 * nuevas: usa el lector de formularios que ya trae Node (Request.formData).
 *
 * Deja los archivos en `req.files` con la misma forma que usaba multer
 * (originalname, mimetype, size, buffer) y los campos de texto en `req.body`,
 * para que validateAndTransformBody los valide igual que antes.
 */
export type ArchivoSubido = {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

type Opciones = {
  /** Campos de archivo permitidos y cuántos archivos acepta cada uno. */
  campos: Record<string, number>
  /** Tamaño máximo por archivo, en MB. */
  maxMb: number
  /** "objeto": req.files = { campo: [archivos] } · "lista": req.files = [archivos] */
  forma?: "objeto" | "lista"
}

const MB = 1024 * 1024

export function leerMultipart({ campos, maxMb, forma = "objeto" }: Opciones) {
  const maxArchivo = maxMb * MB
  const maxArchivos = Object.values(campos).reduce((a, b) => a + b, 0)
  // Tope de toda la petición: todos los archivos al máximo más 2 MB de campos.
  const maxTotal = maxArchivo * maxArchivos + 2 * MB

  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const tipo = String(req.headers["content-type"] || "")
    if (!tipo.toLowerCase().startsWith("multipart/form-data")) {
      res.status(400).json({ message: "Se esperaba un formulario con archivos (multipart/form-data)" })
      return
    }
    const largo = Number(req.headers["content-length"] || 0)
    if (largo > maxTotal) {
      res.status(413).json({ message: `El archivo es demasiado grande. Máximo ${maxMb} MB.` })
      return
    }

    let form: FormData
    try {
      // Se corta la lectura si el cuerpo pasa del tope aunque no traiga content-length.
      let leidos = 0
      const cuerpo = (req as unknown as Readable).on("data", (trozo: Buffer) => {
        leidos += trozo.length
        if (leidos > maxTotal) {
          ;(req as unknown as Readable).destroy(new Error("demasiado grande"))
        }
      })
      const peticion = new Request("http://cam.local/subida", {
        method: "POST",
        headers: { "content-type": tipo },
        body: Readable.toWeb(cuerpo) as unknown as ReadableStream,
        duplex: "half",
      } as RequestInit & { duplex: "half" })
      form = await peticion.formData()
    } catch {
      res.status(400).json({ message: "No se pudo leer el formulario. Revisa el tamaño y vuelve a intentar." })
      return
    }

    const porCampo: Record<string, ArchivoSubido[]> = {}
    const lista: ArchivoSubido[] = []
    const cuerpo: Record<string, string> = {}

    for (const [nombre, valor] of form.entries()) {
      if (typeof valor === "string") {
        cuerpo[nombre] = valor
        continue
      }
      const limite = campos[nombre]
      if (!limite) {
        res.status(400).json({ message: `Campo de archivo no esperado: ${nombre}` })
        return
      }
      const ya = porCampo[nombre]?.length ?? 0
      if (ya >= limite) {
        res.status(400).json({ message: `Demasiados archivos en ${nombre}` })
        return
      }
      if (valor.size > maxArchivo) {
        res.status(413).json({ message: `El archivo es demasiado grande. Máximo ${maxMb} MB.` })
        return
      }
      const archivo: ArchivoSubido = {
        fieldname: nombre,
        originalname: valor.name || "archivo",
        mimetype: valor.type || "application/octet-stream",
        size: valor.size,
        buffer: Buffer.from(await valor.arrayBuffer()),
      }
      ;(porCampo[nombre] ??= []).push(archivo)
      lista.push(archivo)
    }

    const r = req as unknown as { files?: unknown; body?: unknown }
    r.files = forma === "lista" ? lista : porCampo
    r.body = cuerpo
    next()
  }
}

/** Archivos que dejó leerMultipart, por campo. */
export function archivosDe(req: MedusaRequest): Record<string, ArchivoSubido[]> {
  const files = (req as unknown as { files?: unknown }).files
  return files && !Array.isArray(files) ? (files as Record<string, ArchivoSubido[]>) : {}
}

/** Archivos que dejó leerMultipart, en una sola lista. */
export function listaDeArchivos(req: MedusaRequest): ArchivoSubido[] {
  const files = (req as unknown as { files?: unknown }).files
  if (Array.isArray(files)) {
    return files as ArchivoSubido[]
  }
  return Object.values(archivosDe(req)).flat()
}
