import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomBytes } from "crypto"

import { listaDeArchivos } from "../../cam-multipart"
import { uploadFile } from "../../../lib/backblaze"
import { EXT_ARCHIVO_SOLICITUD, MAX_MB_ARCHIVO_SOLICITUD } from "../../../lib/licitacion"

// POST /store/solicitud-archivos  (multipart, campo "archivo")
//
// Sube el plano, modelo o foto de una solicitud de fabricación al bucket
// PRIVADO de B2 y devuelve la clave. El formulario manda esas claves junto
// con la solicitud; los talleres las ven con una liga firmada desde su panel.
// El archivo nunca queda en una URL pública.

const nombreSeguro = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100) || "archivo"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const [archivo] = listaDeArchivos(req)
  if (!archivo) {
    return res.status(400).json({ message: "No llegó ningún archivo." })
  }

  const ext = (archivo.originalname.split(".").pop() || "").toLowerCase()
  if (!EXT_ARCHIVO_SOLICITUD.includes(ext)) {
    return res.status(400).json({
      message: `Ese tipo de archivo no se acepta. Sube ${EXT_ARCHIVO_SOLICITUD.slice(0, 12).join(", ")}…`,
    })
  }
  if (!archivo.size) {
    return res.status(400).json({ message: "El archivo está vacío." })
  }

  // destino=taller: fotos del portafolio de un taller que se registra. Van
  // a otra carpeta para no mezclarlas con los planos de los clientes.
  const destino = String((req.body as Record<string, string> | undefined)?.destino || "")
  const carpeta = destino === "taller" ? "talleres" : "solicitudes"
  const mes = new Date().toISOString().slice(0, 7)
  const nombre = nombreSeguro(archivo.originalname)
  const clave = `${carpeta}/${mes}/${randomBytes(12).toString("hex")}/${nombre}`

  const r = await uploadFile(archivo.buffer, clave, archivo.mimetype || "b2/x-auto")
  if (!r.ok) {
    logger.error(`[solicitud-archivos] no se pudo subir ${clave}: ${r.reason}`)
    return res.status(503).json({ message: "No pudimos guardar tu archivo. Intenta de nuevo en un momento." })
  }

  return res.status(201).json({
    clave,
    nombre: archivo.originalname.slice(0, 120),
    tamano: archivo.size,
    tope_mb: MAX_MB_ARCHIVO_SOLICITUD,
  })
}
